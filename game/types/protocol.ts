import type { Category, EndReason, GameErrorCode, Scores } from './index';

export type RoomStatus = 'waiting' | 'playing' | 'finished';
export type RoomMode = 'solo' | 'online';
export type PlayerColor = 'red' | 'blue';

export type RoomErrorCode =
  | 'INVALID_ROOM_CODE'
  | 'ROOM_NOT_FOUND'
  | 'ROOM_FULL'
  | 'ROOM_EXPIRED'
  | 'GAME_FINISHED'
  | 'ALREADY_IN_ROOM'
  | 'NOT_IN_ROOM'
  | 'GAME_NOT_ACTIVE'
  | 'INVALID_SESSION'
  | 'INTERNAL';

export type ErrorCode = RoomErrorCode | GameErrorCode;

/** Everything a client may know about a player. No tokens or socket ids. */
export interface PublicPlayer {
  id: string;
  name: string;
  isBot: boolean;
  /** Random per game: one player is red, the other blue. */
  color: PlayerColor;
  connected: boolean;
  /** Only revealed while it is this player's turn; zeros otherwise. */
  dice: number[];
  heldDice: boolean[];
  rollsRemaining: number;
  scores: Scores;
  upperSubtotal: number;
  upperBonus: number;
  totalScore: number;
}

export interface RoomView {
  roomCode: string;
  mode: RoomMode;
  status: RoomStatus;
  players: PublicPlayer[];
  currentPlayerId: string | null;
  createdAt: number;
  winnerIds: string[];
  endReason: EndReason | null;
  /** Players who asked for a restart. Online games restart once both humans agree. */
  restartVotes: string[];
}

/** Secret credentials handed only to the player they belong to. */
export interface Session {
  roomCode: string;
  playerId: string;
  token: string;
}

export interface ClientToServerEvents {
  create_room: (p: { name: string }) => void;
  create_solo: (p: { name: string }) => void;
  join_room: (p: { roomCode: string; name: string }) => void;
  rejoin_room: (p: { roomCode: string; token: string }) => void;
  leave_room: () => void;
  restart_game: () => void;
  decline_restart: () => void;
  roll_dice: () => void;
  hold_dice: (p: { held: boolean[] }) => void;
  select_score: (p: { category: Category }) => void;
}

export interface ServerToClientEvents {
  room_created: (p: { room: RoomView; session: Session }) => void;
  room_joined: (p: { room: RoomView; session: Session }) => void;
  room_rejoined: (p: { room: RoomView; session: Session }) => void;
  room_left: () => void;
  room_error: (p: { code: ErrorCode; message: string }) => void;
  player_joined: (p: { room: RoomView; playerId: string }) => void;
  player_left: (p: { room: RoomView; playerId: string }) => void;
  player_reconnected: (p: { room: RoomView; playerId: string }) => void;
  game_started: (p: { room: RoomView }) => void;
  restart_requested: (p: { room: RoomView; playerId: string }) => void;
  restart_declined: (p: { room: RoomView; playerId: string }) => void;
  dice_rolled: (p: { room: RoomView; playerId: string; rolledIndices: number[] }) => void;
  dice_held: (p: { room: RoomView; playerId: string }) => void;
  score_updated: (p: {
    room: RoomView;
    playerId: string;
    category: Category;
    score: number;
    dice: number[];
  }) => void;
  turn_changed: (p: { room: RoomView; currentPlayerId: string }) => void;
  game_finished: (p: { room: RoomView; winnerIds: string[] }) => void;
}
