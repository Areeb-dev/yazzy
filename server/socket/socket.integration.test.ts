import { io as connect, type Socket } from 'socket.io-client';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { ClientToServerEvents, ServerToClientEvents } from '../../game/types/protocol';
import { createGameServer } from '../app';
import { loadConfig } from '../config';

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;

let server: ReturnType<typeof createGameServer>;
let url: string;
const open: Client[] = [];

beforeAll(async () => {
  server = createGameServer(loadConfig({ BOT_DELAY_MS: '5' }), { clientDist: '' });
  url = `http://localhost:${await server.listen(0)}`;
});
afterAll(() => server.close());
afterEach(() => {
  while (open.length) open.pop()!.disconnect();
});

async function client(): Promise<Client> {
  const c: Client = connect(url, { transports: ['websocket'], forceNew: true, reconnection: false });
  open.push(c);
  await new Promise<void>((resolve, reject) => {
    c.on('connect', resolve);
    c.on('connect_error', reject);
  });
  return c;
}

/** Resolves with the first payload of `event`. */
const next = <E extends keyof ServerToClientEvents>(c: Client, event: E) =>
  new Promise<Parameters<ServerToClientEvents[E]>[0]>((resolve) => {
    (c as any).once(event, (p: any) => resolve(p));
  });

describe('real Socket.IO multiplayer', () => {
  it('creates a room, joins by code and starts the game for both players', async () => {
    const a = await client();
    const b = await client();
    const created = next(a, 'room_created');
    a.emit('create_room', { name: 'Ann' });
    const { room, session } = await created;
    expect(room.roomCode).toHaveLength(5);
    expect(room.status).toBe('waiting');

    const startedA = next(a, 'game_started');
    const startedB = next(b, 'game_started');
    const joined = next(b, 'room_joined');
    b.emit('join_room', { roomCode: room.roomCode, name: 'Ben' });
    expect((await joined).session.playerId).not.toBe(session.playerId);
    expect((await startedA).room.status).toBe('playing');
    expect((await startedB).room.players).toHaveLength(2);
  });

  it('broadcasts rolls to both players and rejects out-of-turn actions', async () => {
    const a = await client();
    const b = await client();
    const created = next(a, 'room_created');
    a.emit('create_room', { name: 'Ann' });
    const { room } = await created;
    const started = next(b, 'game_started');
    b.emit('join_room', { roomCode: room.roomCode, name: 'Ben' });
    await started;

    const err = next(b, 'room_error');
    b.emit('roll_dice');
    expect((await err).code).toBe('NOT_YOUR_TURN');

    const seenByB = next(b, 'dice_rolled');
    a.emit('roll_dice');
    const rolled = await seenByB;
    expect(rolled.room.players[0].dice.every((d) => d >= 1 && d <= 6)).toBe(true);
    expect(rolled.room.players[0].rollsRemaining).toBe(2);
  });

  it('reports invalid, full and malformed joins', async () => {
    const a = await client();
    const b = await client();
    const c = await client();
    const created = next(a, 'room_created');
    a.emit('create_room', { name: 'Ann' });
    const { room } = await created;
    const started = next(b, 'game_started');
    b.emit('join_room', { roomCode: room.roomCode, name: 'Ben' });
    await started;

    let err = next(c, 'room_error');
    c.emit('join_room', { roomCode: room.roomCode, name: 'Cy' });
    expect((await err).code).toBe('ROOM_FULL');

    err = next(c, 'room_error');
    c.emit('join_room', { roomCode: 'QQQQQ', name: 'Cy' });
    expect((await err).code).toBe('ROOM_NOT_FOUND');

    err = next(c, 'room_error');
    c.emit('join_room', {} as any);
    expect((await err).code).toBe('INVALID_ROOM_CODE');
  });

  it('lets a disconnected player reconnect and restores their state', async () => {
    const a = await client();
    const b = await client();
    const created = next(a, 'room_created');
    a.emit('create_room', { name: 'Ann' });
    const { room, session } = await created;
    const started = next(b, 'game_started');
    b.emit('join_room', { roomCode: room.roomCode, name: 'Ben' });
    await started;
    const rolled = next(a, 'dice_rolled');
    a.emit('roll_dice');
    const { room: before } = await rolled;

    const left = next(b, 'player_left');
    a.disconnect();
    expect((await left).room.players[0].connected).toBe(false);

    const a2 = await client();
    const back = next(a2, 'room_rejoined');
    const seen = next(b, 'player_reconnected');
    a2.emit('rejoin_room', { roomCode: session.roomCode, token: session.token });
    const restored = await back;
    expect(restored.room.players[0].dice).toEqual(before.players[0].dice);
    expect((await seen).room.players[0].connected).toBe(true);
  });

  it('restarts an online game only when both players agree', async () => {
    const a = await client();
    const b = await client();
    const created = next(a, 'room_created');
    a.emit('create_room', { name: 'Ann' });
    const { room } = await created;
    const started = next(b, 'game_started');
    b.emit('join_room', { roomCode: room.roomCode, name: 'Ben' });
    const { room: first } = await started;
    expect(new Set(first.players.map((p) => p.color)).size).toBe(2);

    a.emit('roll_dice');
    await next(a, 'dice_rolled');
    a.emit('select_score', { category: 'chance' });
    await next(b, 'turn_changed');

    const asked = next(b, 'restart_requested');
    a.emit('restart_game');
    expect((await asked).room.restartVotes).toHaveLength(1);

    const restarted = next(a, 'game_started');
    b.emit('restart_game');
    const { room: fresh } = await restarted;
    expect(fresh.players.every((p) => Object.keys(p.scores).length === 0)).toBe(true);
    expect(fresh.restartVotes).toEqual([]);
  });

  it('plays solo vs bot over the socket', async () => {
    const a = await client();
    const created = next(a, 'room_created');
    const started = next(a, 'game_started');
    a.emit('create_solo', { name: 'Ann' });
    const { session } = await created;
    expect((await started).room.players[1].isBot).toBe(true);

    a.emit('roll_dice');
    await next(a, 'dice_rolled');
    const scored = next(a, 'score_updated');
    a.emit('select_score', { category: 'chance' });
    expect((await scored).category).toBe('chance');

    // The bot answers on its own.
    const botMoved = new Promise<string>((resolve) => {
      a.on('score_updated', (p) => p.playerId !== session.playerId && resolve(p.category));
    });
    expect(typeof (await botMoved)).toBe('string');
  });
});
