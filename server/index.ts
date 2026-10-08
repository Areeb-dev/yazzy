import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config';
import { createGameServer } from './app';

// Works from the repo root and from inside the workspace folder.
loadEnv({ path: fileURLToPath(new URL('../.env', import.meta.url)) });

const config = loadConfig();
const server = createGameServer(config);

server.listen().then((port) => {
  console.log(`[yazzy] server listening on http://localhost:${port}`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => void server.close().then(() => process.exit(0)));
}
