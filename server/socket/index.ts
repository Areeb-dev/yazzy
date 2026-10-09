import type { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '../../game/types/protocol';
import { toErrorPayload, type Broadcaster, type RoomService } from '../services/roomService';

export type GameServer = Server<ClientToServerEvents, ServerToClientEvents>;

type Emitter = { emit: (event: string, ...args: unknown[]) => boolean };

export function createBroadcaster(io: GameServer): Broadcaster {
  return {
    join: (socketId, roomCode) => void io.in(socketId).socketsJoin(roomCode),
    leave: (socketId, roomCode) => void io.in(socketId).socketsLeave(roomCode),
    toRoom: (roomCode, event, ...args) => void (io.to(roomCode) as unknown as Emitter).emit(event, ...args),
    toSocket: (socketId, event, ...args) => void (io.to(socketId) as unknown as Emitter).emit(event, ...args),
  };
}

const field = (payload: unknown, key: string): unknown =>
  payload && typeof payload === 'object' ? (payload as Record<string, unknown>)[key] : undefined;

export function registerSocketHandlers(io: GameServer, service: RoomService): void {
  io.on('connection', (socket) => {
    // Wraps each handler so a bad request becomes a `room_error`, never a crash.
    const handle =
      (fn: (payload: unknown) => void) =>
      (payload?: unknown): void => {
        try {
          fn(payload);
        } catch (err) {
          socket.emit('room_error', toErrorPayload(err));
        }
      };

    socket.on('create_room', handle((p) => service.createRoom(socket.id, field(p, 'name'))));
    socket.on('create_solo', handle((p) => service.createSolo(socket.id, field(p, 'name'))));
    socket.on('join_room', handle((p) => service.joinRoom(socket.id, field(p, 'roomCode'), field(p, 'name'))));
    socket.on('rejoin_room', handle((p) => service.rejoinRoom(socket.id, field(p, 'roomCode'), field(p, 'token'))));
    socket.on('leave_room', handle(() => service.leaveRoom(socket.id)));
    socket.on('restart_game', handle(() => service.restartGame(socket.id)));
    socket.on('decline_restart', handle(() => service.declineRestart(socket.id)));
    socket.on('roll_dice', handle((p) => service.rollDice(socket.id, field(p, 'held'))));
    socket.on('hold_dice', handle((p) => service.holdDice(socket.id, field(p, 'held'))));
    socket.on('select_score', handle((p) => service.selectScore(socket.id, field(p, 'category'))));
    socket.on('disconnect', () => service.handleDisconnect(socket.id));
  });
}
