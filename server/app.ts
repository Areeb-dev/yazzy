import cors from 'cors';
import express from 'express';
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import type { ServerConfig } from './config';
import { InMemoryRoomStore, type RoomStore } from './rooms/roomStore';
import { RoomService } from './services/roomService';
import { createBroadcaster, registerSocketHandlers, type GameServer } from './socket';

export interface CreateServerOptions {
  store?: RoomStore;
  /** Absolute path to a built client to serve. Auto-detected when omitted. */
  clientDist?: string;
}

function findClientDist(): string | undefined {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return [path.resolve(here, '../client/dist'), path.resolve(here, '../../client/dist')].find((p) =>
    existsSync(path.join(p, 'index.html')),
  );
}

export function createGameServer(config: ServerConfig, options: CreateServerOptions = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: config.clientOrigins }));
  app.get('/health', (_req, res) => res.json({ ok: true }));

  const clientDist = options.clientDist ?? findClientDist();
  if (clientDist) {
    app.use(express.static(clientDist));
    app.use((_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
  }

  const httpServer = createServer(app);
  const io: GameServer = new Server(httpServer, {
    cors: { origin: config.clientOrigins },
    // A phone that locks its screen should have time to come back before it counts as gone.
    pingTimeout: 30_000,
  });

  const service = new RoomService({
    store: options.store ?? new InMemoryRoomStore(),
    broadcaster: createBroadcaster(io),
    config,
  });
  registerSocketHandlers(io, service);

  const sweeper = setInterval(() => service.sweepExpired(), 60_000);
  sweeper.unref();

  return {
    app,
    httpServer,
    io,
    service,
    listen: (port = config.port) =>
      new Promise<number>((resolve) => {
        httpServer.listen(port, () => {
          const addr = httpServer.address();
          resolve(typeof addr === 'object' && addr ? addr.port : port);
        });
      }),
    close: () =>
      new Promise<void>((resolve) => {
        clearInterval(sweeper);
        service.shutdown();
        void io.close(() => resolve());
      }),
  };
}
