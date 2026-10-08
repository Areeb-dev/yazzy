import type { Category } from '@game/types';

export interface LastMove {
  id: number;
  playerId: string;
  category: Category;
  score: number;
  /** Final dice that were scored. */
  dice: number[];
  /** Which dice were held at that moment (used to draw the empty tray). */
  heldDice: boolean[];
}

export interface LastRoll {
  nonce: number;
  playerId: string;
  indices: number[];
}
