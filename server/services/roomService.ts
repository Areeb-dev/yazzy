import { chooseCategory, decideHold } from '../../game/bot';
import * as engine from '../../game/engine';
import { GameError } from '../../game/engine';
import { MAX_ROLLS, type DieRoller, type GameState } from '../../game/types';
import type {
  ErrorCode,
  PlayerColor,
  RoomErrorCode,
  ServerToClientEvents,
  Session,
} from '../../game/types/protocol';
import type { ServerConfig } from '../config';
import { generateRoomCode, normalizeRoomCode } from '../rooms/roomCode';
import type { RoomStore } from '../rooms/roomStore';
import type { Room, RoomPlayer } from '../rooms/types';
import { toRoomView } from '../rooms/roomView';
import { newId, newToken, randomIndex, secureRoller } from '../utils/secure';

export class RoomError extends Error {
  constructor(
    public readonly code: RoomErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'RoomError';
  }
}

export function toErrorPayload(err: unknown): { code: ErrorCode; message: string } {
  if (err instanceof RoomError || err instanceof GameError) return { code: err.code, message: err.message };
  console.error('[yazzy] unexpected error', err);
  return { code: 'INTERNAL', message: 'Something went wrong. Please try again.' };
}

/** Transport abstraction so the service never touches Socket.IO directly. */
export interface Broadcaster {
  join(socketId: string, roomCode: string): void;
  leave(socketId: string, roomCode: string): void;
  toRoom<E extends keyof ServerToClientEvents>(
    roomCode: string,
    event: E,
    ...args: Parameters<ServerToClientEvents[E]>
  ): void;
  toSocket<E extends keyof ServerToClientEvents>(
    socketId: string,
    event: E,
    ...args: Parameters<ServerToClientEvents[E]>
  ): void;
}

export interface RoomServiceOptions {
  store: RoomStore;
  broadcaster: Broadcaster;
  config: ServerConfig;
  roller?: DieRoller;
  now?: () => number;
}

const MAX_NAME = 20;
const BOT_NAME = 'Bot';
const otherColor = (c: PlayerColor): PlayerColor => (c === 'red' ? 'blue' : 'red');

export function sanitizeName(raw: unknown): string {
  if (typeof raw !== 'string') return 'Player';
  const name = raw
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NAME);
  return name || 'Player';
}

export class RoomService {
  private readonly store: RoomStore;
  private readonly out: Broadcaster;
  private readonly config: ServerConfig;
  private readonly roller: DieRoller;
  private readonly now: () => number;
  private readonly sockets = new Map<string, { roomCode: string; playerId: string }>();
  private readonly botTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(o: RoomServiceOptions) {
    this.store = o.store;
    this.out = o.broadcaster;
    this.config = o.config;
    this.roller = o.roller ?? secureRoller;
    this.now = o.now ?? Date.now;
  }


  createRoom(socketId: string, rawName: unknown): void {
    this.leaveRoom(socketId);
    const room = this.newRoom('online');
    const host = this.newPlayer(sanitizeName(rawName), socketId, this.randomColor());
    room.players.push(host);
    this.register(room, host, socketId);
    this.out.toSocket(socketId, 'room_created', { room: toRoomView(room), session: this.session(room, host) });
  }

  createSolo(socketId: string, rawName: unknown): void {
    this.leaveRoom(socketId);
    const room = this.newRoom('solo');
    const human = this.newPlayer(sanitizeName(rawName), socketId, this.randomColor());
    const bot: RoomPlayer = {
      id: newId(),
      name: BOT_NAME,
      isBot: true,
      color: otherColor(human.color),
      token: '',
      socketId: null,
      connected: true,
    };
    room.players.push(human, bot);
    this.register(room, human, socketId);
    this.out.toSocket(socketId, 'room_created', { room: toRoomView(room), session: this.session(room, human) });
    this.startGame(room);
  }

  joinRoom(socketId: string, rawCode: unknown, rawName: unknown): void {
    const code = normalizeRoomCode(rawCode);
    if (!code) throw new RoomError('INVALID_ROOM_CODE', 'Room codes are 5 letters and numbers.');
    if (this.sockets.get(socketId)?.roomCode === code) {
      throw new RoomError('ALREADY_IN_ROOM', 'You are already in this room.');
    }
    const room = this.store.get(code);
    if (!room || room.mode === 'solo') throw new RoomError('ROOM_NOT_FOUND', `No room with code ${code}. Check the code and try again.`);
    if (this.isExpired(room)) {
      this.deleteRoom(room);
      throw new RoomError('ROOM_EXPIRED', 'That room has expired. Ask your friend to create a new one.');
    }
    if (room.status === 'finished') throw new RoomError('GAME_FINISHED', 'That game has already finished.');
    if (room.players.length >= 2) throw new RoomError('ROOM_FULL', 'That room is full.');

    this.leaveRoom(socketId);
    const guest = this.newPlayer(sanitizeName(rawName), socketId, otherColor(room.players[0].color));
    room.players.push(guest);
    this.register(room, guest, socketId);
    this.out.toSocket(socketId, 'room_joined', { room: toRoomView(room), session: this.session(room, guest) });
    this.out.toRoom(room.roomCode, 'player_joined', { room: toRoomView(room), playerId: guest.id });
    this.startGame(room);
  }

  /** Reclaim a seat after a dropped connection or page reload. */
  rejoinRoom(socketId: string, rawCode: unknown, rawToken: unknown): void {
    const code = normalizeRoomCode(rawCode);
    const room = code ? this.store.get(code) : undefined;
    if (!room) throw new RoomError('ROOM_NOT_FOUND', 'That game is no longer available.');
    const token = typeof rawToken === 'string' ? rawToken : '';
    const player = token ? room.players.find((p) => !p.isBot && p.token === token) : undefined;
    if (!player) throw new RoomError('INVALID_SESSION', 'Could not restore your seat in that game.');

    if (player.socketId && player.socketId !== socketId) {
      this.sockets.delete(player.socketId);
      this.out.leave(player.socketId, room.roomCode);
    }
    this.leaveIfElsewhere(socketId, room.roomCode);
    player.socketId = socketId;
    player.connected = true;
    this.touch(room);
    this.sockets.set(socketId, { roomCode: room.roomCode, playerId: player.id });
    this.out.join(socketId, room.roomCode);
    this.out.toSocket(socketId, 'room_rejoined', { room: toRoomView(room), session: this.session(room, player) });
    this.out.toRoom(room.roomCode, 'player_reconnected', { room: toRoomView(room), playerId: player.id });
  }

  handleDisconnect(socketId: string): void {
    const entry = this.sockets.get(socketId);
    if (!entry) return;
    this.sockets.delete(socketId);
    const room = this.store.get(entry.roomCode);
    const player = room?.players.find((p) => p.id === entry.playerId);
    if (!room || !player || player.socketId !== socketId) return;
    player.socketId = null;
    player.connected = false;
    this.touch(room);
    this.out.toRoom(room.roomCode, 'player_left', { room: toRoomView(room), playerId: player.id });
  }

  /** Explicit leave. Solo/waiting rooms close; leaving a live online game forfeits it. */
  leaveRoom(socketId: string): void {
    const entry = this.sockets.get(socketId);
    if (!entry) return;
    this.sockets.delete(socketId);
    this.out.leave(socketId, entry.roomCode);
    this.out.toSocket(socketId, 'room_left');

    const room = this.store.get(entry.roomCode);
    if (!room) return;
    if (room.mode === 'solo' || room.status === 'waiting') {
      this.deleteRoom(room);
      return;
    }
    const player = room.players.find((p) => p.id === entry.playerId);
    if (!player) return;
    player.connected = false;
    player.socketId = null;
    player.token = ''; // seat given up for good
    room.restartVotes = [];
    if (room.status === 'playing' && room.gameState) {
      this.applyState(room, engine.forfeitGame(room.gameState, player.id));
      room.status = 'finished';
      this.out.toRoom(room.roomCode, 'game_finished', {
        room: toRoomView(room),
        winnerIds: room.gameState!.winnerIds,
      });
    } else {
      this.out.toRoom(room.roomCode, 'player_left', { room: toRoomView(room), playerId: player.id });
    }
    if (room.players.every((p) => p.isBot || !p.connected)) this.deleteRoom(room);
  }

  // ---------------------------------------------------------------- restart

  /**
   * Solo games restart at once. Online games need both humans to ask; the first request is
   * announced to the other player, who can accept (by asking too) or decline.
   */
  restartGame(socketId: string): void {
    const entry = this.sockets.get(socketId);
    const room = entry ? this.store.get(entry.roomCode) : undefined;
    if (!entry || !room) throw new RoomError('NOT_IN_ROOM', 'You are not in a room.');
    if (room.status === 'waiting') throw new RoomError('GAME_NOT_ACTIVE', 'The game has not started.');
    const humans = room.players.filter((p) => !p.isBot);
    if (humans.some((p) => !p.connected || !p.token)) {
      throw new RoomError('GAME_NOT_ACTIVE', 'Your opponent is not in the room.');
    }
    if (!room.restartVotes.includes(entry.playerId)) room.restartVotes.push(entry.playerId);
    if (humans.every((p) => room.restartVotes.includes(p.id))) {
      this.restart(room);
      return;
    }
    this.touch(room);
    this.out.toRoom(room.roomCode, 'restart_requested', { room: toRoomView(room), playerId: entry.playerId });
  }

  declineRestart(socketId: string): void {
    const entry = this.sockets.get(socketId);
    const room = entry ? this.store.get(entry.roomCode) : undefined;
    if (!entry || !room || room.restartVotes.length === 0) return;
    room.restartVotes = [];
    this.touch(room);
    this.out.toRoom(room.roomCode, 'restart_declined', { room: toRoomView(room), playerId: entry.playerId });
  }

  private restart(room: Room): void {
    const timer = this.botTimers.get(room.roomCode);
    if (timer) clearTimeout(timer);
    this.botTimers.delete(room.roomCode);
    room.restartVotes = [];
    // Colours are re-drawn for every new game.
    const first = this.randomColor();
    room.players[0].color = first;
    if (room.players[1]) room.players[1].color = otherColor(first);
    this.startGame(room);
  }

  // ---------------------------------------------------------------- game actions (player-initiated)

  rollDice(socketId: string, held?: unknown): void {
    this.performRoll(...this.activeContext(socketId), held);
  }

  holdDice(socketId: string, held: unknown): void {
    this.performHold(...this.activeContext(socketId), held);
  }

  selectScore(socketId: string, category: unknown): void {
    this.performScore(...this.activeContext(socketId), category);
  }

  // ---------------------------------------------------------------- housekeeping

  /** Removes expired rooms. Call periodically. Returns how many were removed. */
  sweepExpired(): number {
    let removed = 0;
    for (const room of this.store.all()) {
      if (!this.isExpired(room)) continue;
      for (const p of room.players) {
        if (p.socketId) this.out.toSocket(p.socketId, 'room_error', { code: 'ROOM_EXPIRED', message: 'This room expired.' });
      }
      this.deleteRoom(room);
      removed++;
    }
    return removed;
  }

  shutdown(): void {
    for (const t of this.botTimers.values()) clearTimeout(t);
    this.botTimers.clear();
  }

  getRoom(roomCode: string): Room | undefined {
    return this.store.get(roomCode);
  }

  // ---------------------------------------------------------------- internals

  private newRoom(mode: Room['mode']): Room {
    const now = this.now();
    const roomCode = generateRoomCode((c) => this.store.get(c) !== undefined);
    const room: Room = {
      id: newId(),
      roomCode,
      mode,
      status: 'waiting',
      players: [],
      currentPlayerId: null,
      createdAt: now,
      lastActivityAt: now,
      gameState: null,
      restartVotes: [],
    };
    this.store.set(room);
    return room;
  }

  private randomColor(): PlayerColor {
    return randomIndex(2) === 0 ? 'red' : 'blue';
  }

  private newPlayer(name: string, socketId: string, color: PlayerColor): RoomPlayer {
    return { id: newId(), name, isBot: false, color, token: newToken(), socketId, connected: true };
  }

  private register(room: Room, player: RoomPlayer, socketId: string): void {
    this.sockets.set(socketId, { roomCode: room.roomCode, playerId: player.id });
    this.out.join(socketId, room.roomCode);
  }

  private session(room: Room, player: RoomPlayer): Session {
    return { roomCode: room.roomCode, playerId: player.id, token: player.token };
  }

  private leaveIfElsewhere(socketId: string, roomCode: string): void {
    const cur = this.sockets.get(socketId);
    if (cur && cur.roomCode !== roomCode) this.leaveRoom(socketId);
  }

  private startGame(room: Room): void {
    room.status = 'playing';
    this.applyState(room, engine.createGame(room.players.map((p) => ({ id: p.id, name: p.name }))));
    this.out.toRoom(room.roomCode, 'game_started', { room: toRoomView(room) });
    this.scheduleBotIfNeeded(room);
  }

  private applyState(room: Room, state: GameState): void {
    room.gameState = state;
    room.currentPlayerId = state.status === 'playing' ? state.currentPlayerId : null;
    this.touch(room);
  }

  private touch(room: Room): void {
    room.lastActivityAt = this.now();
  }

  private deleteRoom(room: Room): void {
    const timer = this.botTimers.get(room.roomCode);
    if (timer) clearTimeout(timer);
    this.botTimers.delete(room.roomCode);
    this.store.delete(room.roomCode);
    for (const p of room.players) {
      if (p.socketId) {
        this.sockets.delete(p.socketId);
        this.out.leave(p.socketId, room.roomCode);
      }
    }
  }

  private isExpired(room: Room): boolean {
    const now = this.now();
    const c = this.config;
    const humanOnline = room.players.some((p) => !p.isBot && p.connected);
    if (!humanOnline && now - room.lastActivityAt > c.reconnectGraceMs) return true;
    if (room.status === 'waiting' && now - room.createdAt > c.waitingRoomTtlMs) return true;
    return now - room.lastActivityAt > c.idleRoomTtlMs;
  }

  private activeContext(socketId: string): [Room, string] {
    const entry = this.sockets.get(socketId);
    const room = entry ? this.store.get(entry.roomCode) : undefined;
    if (!entry || !room) throw new RoomError('NOT_IN_ROOM', 'You are not in a room.');
    if (room.status !== 'playing' || !room.gameState) throw new RoomError('GAME_NOT_ACTIVE', 'The game has not started.');
    return [room, entry.playerId];
  }

  // Shared by humans and the bot, so both obey exactly the same engine rules.

  private performRoll(room: Room, playerId: string, held?: unknown): void {
    let state = room.gameState!;
    if (held !== undefined) {
      const gp = engine.getPlayer(state, playerId);
      if (gp && gp.rollsRemaining > 0 && gp.rollsRemaining < MAX_ROLLS) {
        state = engine.setHeld(state, playerId, held);
      }
    }
    const { state: next, rolledIndices } = engine.rollDice(state, playerId, this.roller);
    this.applyState(room, next);
    this.out.toRoom(room.roomCode, 'dice_rolled', { room: toRoomView(room), playerId, rolledIndices });
  }

  private performHold(room: Room, playerId: string, held: unknown): void {
    this.applyState(room, engine.setHeld(room.gameState!, playerId, held));
    this.out.toRoom(room.roomCode, 'dice_held', { room: toRoomView(room), playerId });
  }

  private performScore(room: Room, playerId: string, category: unknown): void {
    const dice = [...engine.getPlayer(room.gameState!, playerId)!.dice];
    const result = engine.selectScore(room.gameState!, playerId, category);
    this.applyState(room, result.state);
    this.out.toRoom(room.roomCode, 'score_updated', {
      room: toRoomView(room),
      playerId,
      category: result.category,
      score: result.score,
      dice,
    });
    if (result.state.status === 'finished') {
      room.status = 'finished';
      this.out.toRoom(room.roomCode, 'game_finished', {
        room: toRoomView(room),
        winnerIds: result.state.winnerIds,
      });
    } else {
      this.out.toRoom(room.roomCode, 'turn_changed', {
        room: toRoomView(room),
        currentPlayerId: result.state.currentPlayerId,
      });
      this.scheduleBotIfNeeded(room);
    }
  }

  // ---------------------------------------------------------------- bot driver

  private scheduleBotIfNeeded(room: Room): void {
    if (room.status !== 'playing') return;
    const current = room.players.find((p) => p.id === room.currentPlayerId);
    if (!current?.isBot) return;
    const existing = this.botTimers.get(room.roomCode);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      this.botTimers.delete(room.roomCode);
      this.botStep(room.roomCode);
    }, this.config.botDelayMs);
    timer.unref?.();
    this.botTimers.set(room.roomCode, timer);
  }

  /** One bot action: roll, adjust holds, or score. Re-schedules itself until the turn ends. */
  private botStep(roomCode: string): void {
    const room = this.store.get(roomCode);
    if (!room || room.status !== 'playing' || !room.gameState) return;
    const bot = room.players.find((p) => p.id === room.currentPlayerId && p.isBot);
    const gp = bot && engine.getPlayer(room.gameState, bot.id);
    if (!bot || !gp) return;

    try {
      if (gp.rollsRemaining === MAX_ROLLS) {
        this.performRoll(room, bot.id);
      } else if (gp.rollsRemaining === 0) {
        this.performScore(room, bot.id, chooseCategory(gp.dice, gp.scores));
        return; // performScore schedules the next actor if needed
      } else {
        const held = decideHold(gp.dice, gp.rollsRemaining, gp.scores);
        if (held.every(Boolean)) {
          this.performScore(room, bot.id, chooseCategory(gp.dice, gp.scores));
          return;
        }
        if (held.some((h, i) => h !== gp.heldDice[i])) this.performHold(room, bot.id, held);
        else this.performRoll(room, bot.id);
      }
      this.scheduleBotIfNeeded(room);
    } catch (err) {
      console.error('[yazzy] bot failed', err);
    }
  }
}
