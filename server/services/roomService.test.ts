import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServerToClientEvents } from '../../game/types/protocol';
import { CATEGORIES } from '../../game/types';
import { loadConfig } from '../config';
import { InMemoryRoomStore } from '../rooms/roomStore';
import { RoomError, RoomService, toErrorPayload, type Broadcaster } from './roomService';
import { GameError } from '../../game/engine';

interface Sent {
  target: 'room' | 'socket';
  to: string;
  event: keyof ServerToClientEvents;
  payload: any;
}

function setup(envOverrides: Record<string, string> = {}, startTime = 1_000_000) {
  const sent: Sent[] = [];
  const memberships = new Map<string, Set<string>>();
  const clock = { now: startTime };
  const broadcaster: Broadcaster = {
    join: (s, r) => void (memberships.get(r) ?? memberships.set(r, new Set()).get(r)!).add(s),
    leave: (s, r) => void memberships.get(r)?.delete(s),
    toRoom: (to, event, ...args) => void sent.push({ target: 'room', to, event, payload: args[0] }),
    toSocket: (to, event, ...args) => void sent.push({ target: 'socket', to, event, payload: args[0] }),
  };
  const store = new InMemoryRoomStore();
  const service = new RoomService({
    store,
    broadcaster,
    config: loadConfig({ BOT_DELAY_MS: '0', ...envOverrides }),
    now: () => clock.now,
  });
  const last = (event: keyof ServerToClientEvents) => [...sent].reverse().find((s) => s.event === event);
  const all = (event: keyof ServerToClientEvents) => sent.filter((s) => s.event === event);
  const code = () => last('room_created')!.payload.room.roomCode as string;
  return { service, store, sent, clock, memberships, last, all, code };
}

/** Creates a room with host socket "s1", joins guest socket "s2". */
function startedOnlineGame() {
  const ctx = setup();
  ctx.service.createRoom('s1', 'Ann');
  const roomCode = ctx.code();
  ctx.service.joinRoom('s2', roomCode, 'Ben');
  const room = ctx.service.getRoom(roomCode)!;
  return { ...ctx, roomCode, room, host: room.players[0], guest: room.players[1] };
}

const errorCode = (fn: () => void) => {
  try {
    fn();
  } catch (e) {
    return (e as RoomError | GameError).code;
  }
  return null;
};

describe('room creation', () => {
  it('creates a waiting room with a 5 character code and gives the host a session', () => {
    const { service, last, code, memberships } = setup();
    service.createRoom('s1', 'Ann');
    const evt = last('room_created')!;
    expect(evt.to).toBe('s1');
    expect(code()).toMatch(/^[A-HJKMNP-Z2-9]{5}$/);
    expect(evt.payload.room.status).toBe('waiting');
    expect(evt.payload.room.players).toHaveLength(1);
    expect(evt.payload.session.token).toHaveLength(48);
    expect(memberships.get(code())!.has('s1')).toBe(true);
  });

  it('generates unique codes', () => {
    const { service, store } = setup();
    for (let i = 0; i < 50; i++) service.createRoom(`s${i}`, 'P');
    expect(store.all()).toHaveLength(50);
    expect(new Set(store.all().map((r) => r.roomCode)).size).toBe(50);
  });

  it('sanitises and defaults player names', () => {
    const { service, last } = setup();
    service.createRoom('s1', '  <b>Ann</b>   the   great and very very long name  ');
    const name = last('room_created')!.payload.room.players[0].name as string;
    expect(name).not.toMatch(/[<>]/);
    expect(name.length).toBeLessThanOrEqual(20);
    service.createRoom('s2', 42);
    expect(last('room_created')!.payload.room.players[0].name).toBe('Player');
  });

  it('never exposes tokens or socket ids in the public view', () => {
    const { service, last } = setup();
    service.createRoom('s1', 'Ann');
    const json = JSON.stringify(last('room_created')!.payload.room);
    expect(json).not.toContain('token');
    expect(json).not.toContain('socketId');
  });
});

describe('joining rooms', () => {
  it('starts the game automatically when the second player joins', () => {
    const { last, all, room, guest, host } = startedOnlineGame();
    expect(last('room_joined')!.to).toBe('s2');
    expect(last('player_joined')!.payload.playerId).toBe(guest.id);
    expect(all('game_started')).toHaveLength(1);
    expect(room.status).toBe('playing');
    expect(room.currentPlayerId).toBe(host.id);
  });

  it('accepts lower-case codes with whitespace', () => {
    const ctx = setup();
    ctx.service.createRoom('s1', 'Ann');
    ctx.service.joinRoom('s2', `  ${ctx.code().toLowerCase()} `, 'Ben');
    expect(ctx.service.getRoom(ctx.code())!.status).toBe('playing');
  });

  it('rejects an unknown room', () => {
    const { service } = setup();
    expect(errorCode(() => service.joinRoom('s2', 'ZZZZZ', 'Ben'))).toBe('ROOM_NOT_FOUND');
  });

  it('rejects malformed codes', () => {
    const { service } = setup();
    expect(errorCode(() => service.joinRoom('s2', 'AB', 'Ben'))).toBe('INVALID_ROOM_CODE');
    expect(errorCode(() => service.joinRoom('s2', undefined, 'Ben'))).toBe('INVALID_ROOM_CODE');
    expect(errorCode(() => service.joinRoom('s2', 'AB!K2', 'Ben'))).toBe('INVALID_ROOM_CODE');
  });

  it('rejects a third player: max two per room', () => {
    const { service, roomCode } = startedOnlineGame();
    expect(errorCode(() => service.joinRoom('s3', roomCode, 'Cy'))).toBe('ROOM_FULL');
  });

  it('rejects joining a finished game', () => {
    const { service, roomCode, room } = startedOnlineGame();
    room.status = 'finished';
    expect(errorCode(() => service.joinRoom('s3', roomCode, 'Cy'))).toBe('GAME_FINISHED');
  });

  it('cannot join your own room twice', () => {
    const ctx = setup();
    ctx.service.createRoom('s1', 'Ann');
    expect(errorCode(() => ctx.service.joinRoom('s1', ctx.code(), 'Ann'))).toBe('ALREADY_IN_ROOM');
  });

  it('rejects solo rooms and expired rooms', () => {
    const solo = setup();
    solo.service.createSolo('s1', 'Ann');
    expect(errorCode(() => solo.service.joinRoom('s2', solo.code(), 'Ben'))).toBe('ROOM_NOT_FOUND');

    const ctx = setup({ WAITING_ROOM_TTL_MIN: '1' });
    ctx.service.createRoom('s1', 'Ann');
    ctx.clock.now += 61_000;
    expect(errorCode(() => ctx.service.joinRoom('s2', ctx.code(), 'Ben'))).toBe('ROOM_EXPIRED');
    expect(ctx.store.all()).toHaveLength(0);
  });
});

describe('authoritative actions', () => {
  it('lets only the current player roll, and validates turn order', () => {
    const { service } = startedOnlineGame();
    expect(errorCode(() => service.rollDice('s2'))).toBe('NOT_YOUR_TURN');
    service.rollDice('s1');
  });

  it('enforces the three roll limit', () => {
    const { service } = startedOnlineGame();
    service.rollDice('s1');
    service.rollDice('s1');
    service.rollDice('s1');
    expect(errorCode(() => service.rollDice('s1'))).toBe('NO_ROLLS_REMAINING');
  });

  it('server generates dice: values are 1-6 and clients cannot submit dice', () => {
    const { service, last } = startedOnlineGame();
    service.rollDice('s1');
    const dice = last('dice_rolled')!.payload.room.players[0].dice as number[];
    expect(dice).toHaveLength(5);
    expect(dice.every((d) => d >= 1 && d <= 6)).toBe(true);
  });

  it('holds dice and keeps them on re-roll', () => {
    const { service, last } = startedOnlineGame();
    service.rollDice('s1');
    const first = last('dice_rolled')!.payload.room.players[0].dice as number[];
    service.holdDice('s1', [true, true, false, false, true]);
    expect(last('dice_held')!.payload.room.players[0].heldDice).toEqual([true, true, false, false, true]);
    service.rollDice('s1');
    const second = last('dice_rolled')!.payload.room.players[0].dice as number[];
    expect([second[0], second[1], second[4]]).toEqual([first[0], first[1], first[4]]);
  });

  it('rejects malformed holds, unknown and duplicate categories', () => {
    const { service } = startedOnlineGame();
    expect(errorCode(() => service.holdDice('s1', [true]))).toBe('MUST_ROLL_FIRST');
    service.rollDice('s1');
    expect(errorCode(() => service.holdDice('s1', 'all'))).toBe('INVALID_HOLD');
    expect(errorCode(() => service.selectScore('s1', 'nonsense'))).toBe('INVALID_CATEGORY');
  });

  it('scores, passes the turn, and prevents scoring out of turn or twice', () => {
    const { service, last, host, guest } = startedOnlineGame();
    expect(errorCode(() => service.selectScore('s1', 'chance'))).toBe('MUST_ROLL_FIRST');
    service.rollDice('s1');
    expect(errorCode(() => service.selectScore('s2', 'chance'))).toBe('NOT_YOUR_TURN');
    service.selectScore('s1', 'chance');
    expect(last('score_updated')!.payload.category).toBe('chance');
    expect(last('turn_changed')!.payload.currentPlayerId).toBe(guest.id);
    service.rollDice('s2');
    service.selectScore('s2', 'chance');
    service.rollDice('s1');
    expect(errorCode(() => service.selectScore('s1', 'chance'))).toBe('CATEGORY_USED');
    expect(host.id).not.toBe(guest.id);
  });

  it("only reveals the active player's dice", () => {
    const { service, last } = startedOnlineGame();
    service.rollDice('s1');
    const view = last('dice_rolled')!.payload.room;
    expect(view.players[0].dice.every((d: number) => d > 0)).toBe(true);
    expect(view.players[1].dice).toEqual([0, 0, 0, 0, 0]);
  });

  it('plays a whole online game to a winner', () => {
    const { service, last, room } = startedOnlineGame();
    for (let turn = 0; turn < 26; turn++) {
      const socket = room.currentPlayerId === room.players[0].id ? 's1' : 's2';
      service.rollDice(socket);
      const gp = room.gameState!.players.find((p) => p.id === room.currentPlayerId)!;
      const open = CATEGORIES.find((c) => gp.scores[c] === undefined)!;
      service.selectScore(socket, open);
    }
    expect(room.status).toBe('finished');
    const done = last('game_finished')!.payload;
    expect(done.winnerIds.length).toBeGreaterThanOrEqual(1);
    expect(errorCode(() => service.rollDice('s1'))).toBe('GAME_NOT_ACTIVE');
  });

  it('rejects actions from sockets that are not in a room', () => {
    const { service } = setup();
    expect(errorCode(() => service.rollDice('ghost'))).toBe('NOT_IN_ROOM');
  });
});

describe('disconnect and reconnect', () => {
  it('keeps the game alive and marks the player disconnected', () => {
    const { service, last, room, host } = startedOnlineGame();
    service.handleDisconnect('s1');
    expect(room.status).toBe('playing');
    expect(room.players[0].connected).toBe(false);
    expect(last('player_left')!.payload.playerId).toBe(host.id);
    expect(last('player_left')!.payload.room.players[0].connected).toBe(false);
  });

  it('restores seat and state on rejoin with the token', () => {
    const { service, last, roomCode, room, host } = startedOnlineGame();
    service.rollDice('s1');
    const diceBefore = [...room.gameState!.players[0].dice];
    const token = host.token;
    service.handleDisconnect('s1');
    service.rejoinRoom('s9', roomCode, token);
    const evt = last('room_rejoined')!;
    expect(evt.to).toBe('s9');
    expect(evt.payload.session.playerId).toBe(host.id);
    expect(evt.payload.room.players[0].dice).toEqual(diceBefore);
    expect(last('player_reconnected')!.payload.playerId).toBe(host.id);
    expect(room.players[0].connected).toBe(true);
    // the new socket can act as the host
    service.rollDice('s9');
  });

  it('rejects wrong tokens and missing rooms', () => {
    const { service, roomCode } = startedOnlineGame();
    expect(errorCode(() => service.rejoinRoom('s9', roomCode, 'nope'))).toBe('INVALID_SESSION');
    expect(errorCode(() => service.rejoinRoom('s9', roomCode, ''))).toBe('INVALID_SESSION');
    expect(errorCode(() => service.rejoinRoom('s9', 'ZZZZZ', 'x'))).toBe('ROOM_NOT_FOUND');
  });

  it('takes over a seat that still looks connected (e.g. second tab)', () => {
    const { service, roomCode, host } = startedOnlineGame();
    service.rejoinRoom('s9', roomCode, host.token);
    expect(errorCode(() => service.rollDice('s1'))).toBe('NOT_IN_ROOM');
    service.rollDice('s9');
  });

  it('removes rooms nobody returns to after the grace period', () => {
    const ctx = setup({ RECONNECT_GRACE_MIN: '1' });
    ctx.service.createRoom('s1', 'Ann');
    ctx.service.joinRoom('s2', ctx.code(), 'Ben');
    ctx.service.handleDisconnect('s1');
    ctx.service.handleDisconnect('s2');
    ctx.clock.now += 30_000;
    expect(ctx.service.sweepExpired()).toBe(0);
    ctx.clock.now += 60_000;
    expect(ctx.service.sweepExpired()).toBe(1);
    expect(ctx.store.all()).toHaveLength(0);
  });
});

describe('leaving', () => {
  it('closes a waiting room', () => {
    const ctx = setup();
    ctx.service.createRoom('s1', 'Ann');
    ctx.service.leaveRoom('s1');
    expect(ctx.store.all()).toHaveLength(0);
    expect(ctx.last('room_left')!.to).toBe('s1');
  });

  it('forfeits an online game to the remaining player', () => {
    const { service, last, room, guest } = startedOnlineGame();
    service.leaveRoom('s1');
    expect(room.status).toBe('finished');
    const done = last('game_finished')!.payload;
    expect(done.winnerIds).toEqual([guest.id]);
    expect(done.room.endReason).toBe('forfeit');
  });
});

describe('solo mode with bot', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const humanTurn = (ctx: ReturnType<typeof setup>, roomCode: string) => {
    const room = ctx.service.getRoom(roomCode)!;
    ctx.service.rollDice('h');
    const gp = room.gameState!.players[0];
    ctx.service.selectScore('h', CATEGORIES.find((c) => gp.scores[c] === undefined)!);
  };

  it('starts immediately with the human going first', () => {
    const ctx = setup();
    ctx.service.createSolo('h', 'Ann');
    const room = ctx.service.getRoom(ctx.code())!;
    expect(room.mode).toBe('solo');
    expect(room.status).toBe('playing');
    expect(room.currentPlayerId).toBe(room.players[0].id);
    expect(room.players[1].isBot).toBe(true);
  });

  it('bot takes its turn after the human scores: rolls, up to 3 times, then scores', () => {
    const ctx = setup();
    ctx.service.createSolo('h', 'Ann');
    const roomCode = ctx.code();
    humanTurn(ctx, roomCode);
    const room = ctx.service.getRoom(roomCode)!;
    const bot = room.players[1];
    expect(room.currentPlayerId).toBe(bot.id);

    vi.advanceTimersByTime(1000);
    for (let i = 0; i < 20 && room.currentPlayerId === bot.id; i++) vi.advanceTimersByTime(1);

    expect(room.currentPlayerId).toBe(room.players[0].id);
    const botRolls = ctx.all('dice_rolled').filter((e) => e.payload.playerId === bot.id);
    expect(botRolls.length).toBeGreaterThanOrEqual(1);
    expect(botRolls.length).toBeLessThanOrEqual(3);
    const botScore = ctx.all('score_updated').find((e) => e.payload.playerId === bot.id)!;
    expect(CATEGORIES).toContain(botScore.payload.category);
    expect(botScore.payload.dice.every((d: number) => d >= 1 && d <= 6)).toBe(true);
  });

  it("hides the bot's dice when it is not the bot's turn", () => {
    const ctx = setup();
    ctx.service.createSolo('h', 'Ann');
    ctx.service.rollDice('h');
    const view = ctx.last('dice_rolled')!.payload.room;
    expect(view.players[1].dice).toEqual([0, 0, 0, 0, 0]);
  });

  it('plays a full game to a winner screen', () => {
    const ctx = setup();
    ctx.service.createSolo('h', 'Ann');
    const roomCode = ctx.code();
    const room = ctx.service.getRoom(roomCode)!;
    for (let turn = 0; turn < 13; turn++) {
      humanTurn(ctx, roomCode);
      for (let i = 0; i < 50 && room.status === 'playing' && room.currentPlayerId === room.players[1].id; i++) {
        vi.advanceTimersByTime(1);
      }
    }
    expect(room.status).toBe('finished');
    const players = room.gameState!.players;
    expect(players.every((p) => Object.keys(p.scores).length === 13)).toBe(true);
    expect(ctx.last('game_finished')!.payload.winnerIds.length).toBeGreaterThanOrEqual(1);
  });

  it('stops the bot when the room is closed', () => {
    const ctx = setup();
    ctx.service.createSolo('h', 'Ann');
    humanTurn(ctx, ctx.code());
    ctx.service.leaveRoom('h');
    vi.advanceTimersByTime(5000);
    expect(ctx.all('dice_rolled').filter((e) => e.payload.playerId !== ctx.last('room_created')!.payload.session.playerId)).toHaveLength(0);
  });
});

describe('player colours', () => {
  it('gives the two online players different colours', () => {
    for (let i = 0; i < 20; i++) {
      const { room } = startedOnlineGame();
      const [a, b] = room.players.map((p) => p.color);
      expect(['red', 'blue']).toContain(a);
      expect(['red', 'blue']).toContain(b);
      expect(a).not.toBe(b);
    }
  });

  it('gives the bot the opposite colour in solo', () => {
    for (let i = 0; i < 20; i++) {
      const ctx = setup();
      ctx.service.createSolo('h', 'Ann');
      const room = ctx.service.getRoom(ctx.code())!;
      expect(room.players[0].color).not.toBe(room.players[1].color);
    }
  });

  it('draws both colours across games (not always the same seat)', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const { room } = startedOnlineGame();
      seen.add(room.players[0].color);
    }
    expect(seen.size).toBe(2);
  });

  it('exposes colours in the public view', () => {
    const { last } = startedOnlineGame();
    const view = last('game_started')!.payload.room;
    expect(view.players.map((p: any) => p.color).sort()).toEqual(['blue', 'red']);
  });
});

describe('restart', () => {
  const playOneTurn = (service: RoomService, socket: string) => {
    service.rollDice(socket);
    service.selectScore(socket, 'chance');
  };

  it('restarts a solo game immediately', () => {
    const ctx = setup();
    ctx.service.createSolo('h', 'Ann');
    const room = ctx.service.getRoom(ctx.code())!;
    ctx.service.rollDice('h');
    ctx.service.selectScore('h', 'chance');
    expect(Object.keys(room.gameState!.players[0].scores)).toHaveLength(1);
    ctx.service.restartGame('h');
    expect(room.status).toBe('playing');
    expect(Object.keys(room.gameState!.players[0].scores)).toHaveLength(0);
    expect(room.currentPlayerId).toBe(room.players[0].id);
    expect(ctx.all('game_started')).toHaveLength(2);
  });

  it('online: needs both players to agree', () => {
    const { service, last, all, room, host, guest } = startedOnlineGame();
    playOneTurn(service, 's1');
    service.restartGame('s1');
    expect(last('restart_requested')!.payload.playerId).toBe(host.id);
    expect(last('restart_requested')!.payload.room.restartVotes).toEqual([host.id]);
    expect(Object.keys(room.gameState!.players[0].scores)).toHaveLength(1); // not restarted yet
    service.restartGame('s2');
    expect(all('game_started')).toHaveLength(2);
    expect(room.restartVotes).toEqual([]);
    expect(room.gameState!.players.every((p) => Object.keys(p.scores).length === 0)).toBe(true);
    expect(room.players.map((p) => p.id)).toEqual([host.id, guest.id]);
  });

  it('online: the other player can decline', () => {
    const { service, last, room, guest } = startedOnlineGame();
    service.restartGame('s1');
    service.declineRestart('s2');
    expect(room.restartVotes).toEqual([]);
    expect(last('restart_declined')!.payload.playerId).toBe(guest.id);
    expect(Object.keys(room.gameState!.players[0].scores)).toHaveLength(0);
  });

  it('asking twice does not restart on its own', () => {
    const { service, all } = startedOnlineGame();
    service.restartGame('s1');
    service.restartGame('s1');
    expect(all('game_started')).toHaveLength(1);
  });

  it('works after a finished game', () => {
    const { service, room } = startedOnlineGame();
    for (let turn = 0; turn < 26; turn++) {
      const socket = room.currentPlayerId === room.players[0].id ? 's1' : 's2';
      service.rollDice(socket);
      const gp = room.gameState!.players.find((p) => p.id === room.currentPlayerId)!;
      service.selectScore(socket, CATEGORIES.find((c) => gp.scores[c] === undefined)!);
    }
    expect(room.status).toBe('finished');
    service.restartGame('s1');
    service.restartGame('s2');
    expect(room.status).toBe('playing');
    expect(room.gameState!.winnerIds).toEqual([]);
  });

  it('is refused in a waiting room and when the opponent left', () => {
    const waiting = setup();
    waiting.service.createRoom('s1', 'Ann');
    expect(errorCode(() => waiting.service.restartGame('s1'))).toBe('GAME_NOT_ACTIVE');

    const { service } = startedOnlineGame();
    service.handleDisconnect('s2');
    expect(errorCode(() => service.restartGame('s1'))).toBe('GAME_NOT_ACTIVE');
    expect(errorCode(() => service.restartGame('ghost'))).toBe('NOT_IN_ROOM');
  });

  it('cancels the pending bot move when a solo game restarts', () => {
    vi.useFakeTimers();
    try {
      const ctx = setup();
      ctx.service.createSolo('h', 'Ann');
      const room = ctx.service.getRoom(ctx.code())!;
      ctx.service.rollDice('h');
      ctx.service.selectScore('h', 'chance'); // bot is now scheduled
      ctx.service.restartGame('h');
      vi.advanceTimersByTime(5000);
      expect(ctx.all('dice_rolled').filter((e) => e.payload.playerId === room.players[1].id)).toHaveLength(0);
      expect(room.currentPlayerId).toBe(room.players[0].id);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('error mapping', () => {
  it('maps known errors and hides unknown ones', () => {
    expect(toErrorPayload(new RoomError('ROOM_FULL', 'x'))).toEqual({ code: 'ROOM_FULL', message: 'x' });
    expect(toErrorPayload(new GameError('NOT_YOUR_TURN', 'y')).code).toBe('NOT_YOUR_TURN');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const unknown = toErrorPayload(new Error('secret stack info'));
    expect(unknown.code).toBe('INTERNAL');
    expect(unknown.message).not.toContain('secret');
  });
});
