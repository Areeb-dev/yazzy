import type { GameState } from '../../game/types';
import type { PlayerColor, RoomMode, RoomStatus } from '../../game/types/protocol';

/** Connection-level info for a participant. Game stats live in `gameState.players`. */
export interface RoomPlayer {
  id: string;
  name: string;
  isBot: boolean;
  color: PlayerColor;
  /** Secret used to reclaim this seat after a disconnect. Never sent to other clients. */
  token: string;
  socketId: string | null;
  connected: boolean;
}

export interface Room {
  id: string;
  roomCode: string;
  mode: RoomMode;
  status: RoomStatus;
  players: RoomPlayer[];
  currentPlayerId: string | null;
  createdAt: number;
  lastActivityAt: number;
  gameState: GameState | null;
  /** Ids of players who asked to restart. */
  restartVotes: string[];
}
