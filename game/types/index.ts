export const DICE_COUNT = 5;
export const MAX_ROLLS = 3;

export const CATEGORIES = [
  'ones',
  'twos',
  'threes',
  'fours',
  'fives',
  'sixes',
  'three_of_a_kind',
  'four_of_a_kind',
  'full_house',
  'small_straight',
  'large_straight',
  'yazzy',
  'chance',
] as const;

export type Category = (typeof CATEGORIES)[number];

export const UPPER_CATEGORIES: readonly Category[] = CATEGORIES.slice(0, 6);
export const LOWER_CATEGORIES: readonly Category[] = CATEGORIES.slice(6);

export const CATEGORY_LABELS: Record<Category, string> = {
  ones: 'Ones',
  twos: 'Twos',
  threes: 'Threes',
  fours: 'Fours',
  fives: 'Fives',
  sixes: 'Sixes',
  three_of_a_kind: 'Three of a Kind',
  four_of_a_kind: 'Four of a Kind',
  full_house: 'Full House',
  small_straight: 'Small Straight',
  large_straight: 'Large Straight',
  yazzy: 'Yazzy',
  chance: 'Chance',
};

export type Scores = Partial<Record<Category, number>>;

/** Returns a random integer 1..6. Injected so the engine stays pure and testable. */
export type DieRoller = () => number;

export interface GamePlayer {
  id: string;
  name: string;
  /** 0 = not rolled yet this turn */
  dice: number[];
  heldDice: boolean[];
  rollsRemaining: number;
  scores: Scores;
  totalScore: number;
}

export type GameStatus = 'playing' | 'finished';
export type EndReason = 'completed' | 'forfeit';

export interface GameState {
  players: GamePlayer[];
  currentPlayerId: string;
  status: GameStatus;
  winnerIds: string[];
  endReason: EndReason | null;
}

export type GameErrorCode =
  | 'INVALID_PLAYERS'
  | 'PLAYER_NOT_FOUND'
  | 'GAME_FINISHED'
  | 'NOT_YOUR_TURN'
  | 'NO_ROLLS_REMAINING'
  | 'MUST_ROLL_FIRST'
  | 'INVALID_HOLD'
  | 'INVALID_CATEGORY'
  | 'CATEGORY_USED'
  | 'INVALID_DIE';
