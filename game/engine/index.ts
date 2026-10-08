import {
  CATEGORIES,
  DICE_COUNT,
  MAX_ROLLS,
  type Category,
  type DieRoller,
  type GameErrorCode,
  type GamePlayer,
  type GameState,
  type Scores,
} from '../types';
import { calculateTotal, isScorecardComplete, scoreCategory } from '../scoring';
import { emptyDice, isRolled, isValidDie, noneHeld } from '../utils';

export class GameError extends Error {
  constructor(
    public readonly code: GameErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'GameError';
  }
}

const freshTurn = (p: GamePlayer): GamePlayer => ({
  ...p,
  dice: emptyDice(),
  heldDice: noneHeld(),
  rollsRemaining: MAX_ROLLS,
});

const isCategory = (v: unknown): v is Category =>
  typeof v === 'string' && (CATEGORIES as readonly string[]).includes(v);

function mapPlayer(state: GameState, id: string, fn: (p: GamePlayer) => GamePlayer): GameState {
  return { ...state, players: state.players.map((p) => (p.id === id ? fn(p) : p)) };
}

export function createGame(players: { id: string; name: string }[]): GameState {
  if (players.length < 1 || new Set(players.map((p) => p.id)).size !== players.length) {
    throw new GameError('INVALID_PLAYERS', 'A game needs at least one player with unique ids');
  }
  return {
    players: players.map((p) =>
      freshTurn({
        id: p.id,
        name: p.name,
        dice: [],
        heldDice: [],
        rollsRemaining: MAX_ROLLS,
        scores: {},
        totalScore: 0,
      }),
    ),
    currentPlayerId: players[0].id,
    status: 'playing',
    winnerIds: [],
    endReason: null,
  };
}

/** Throws unless `playerId` may act right now. Returns that player's state. */
function assertCanAct(state: GameState, playerId: string): GamePlayer {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) throw new GameError('PLAYER_NOT_FOUND', 'Player is not part of this game');
  if (state.status !== 'playing') throw new GameError('GAME_FINISHED', 'The game is over');
  if (state.currentPlayerId !== playerId) throw new GameError('NOT_YOUR_TURN', "It's not your turn");
  return player;
}

export interface RollResult {
  state: GameState;
  rolledIndices: number[];
}

/** Roll every die that is not held. The first roll of a turn rolls all five. */
export function rollDice(state: GameState, playerId: string, roller: DieRoller): RollResult {
  const player = assertCanAct(state, playerId);
  if (player.rollsRemaining <= 0) {
    throw new GameError('NO_ROLLS_REMAINING', 'No rolls left this turn. Choose a category to score.');
  }
  const firstRoll = player.rollsRemaining === MAX_ROLLS;
  const rolledIndices = player.dice
    .map((_, i) => i)
    .filter((i) => firstRoll || !player.heldDice[i]);
  if (rolledIndices.length === 0) {
    throw new GameError('INVALID_HOLD', 'All dice are held. Release at least one to roll.');
  }
  const dice = player.dice.map((d, i) => {
    if (!rolledIndices.includes(i)) return d;
    const value = roller();
    if (!isValidDie(value)) throw new GameError('INVALID_DIE', 'Dice roller returned an invalid value');
    return value;
  });
  return {
    rolledIndices,
    state: mapPlayer(state, playerId, (p) => ({
      ...p,
      dice,
      rollsRemaining: p.rollsRemaining - 1,
    })),
  };
}

/** Replace the hold mask. Held dice stay put on the next roll. */
export function setHeld(state: GameState, playerId: string, held: unknown): GameState {
  const player = assertCanAct(state, playerId);
  if (player.rollsRemaining === MAX_ROLLS) {
    throw new GameError('MUST_ROLL_FIRST', 'Roll the dice before holding any');
  }
  if (player.rollsRemaining === 0) {
    throw new GameError('NO_ROLLS_REMAINING', 'No rolls left, so there is nothing to hold');
  }
  if (!Array.isArray(held) || held.length !== DICE_COUNT || !held.every((h) => typeof h === 'boolean')) {
    throw new GameError('INVALID_HOLD', `Hold must be a list of ${DICE_COUNT} true/false values`);
  }
  return mapPlayer(state, playerId, (p) => ({ ...p, heldDice: [...(held as boolean[])] }));
}

export interface ScoreResult {
  state: GameState;
  category: Category;
  score: number;
}

export function selectScore(state: GameState, playerId: string, category: unknown): ScoreResult {
  const player = assertCanAct(state, playerId);
  if (!isCategory(category)) throw new GameError('INVALID_CATEGORY', 'Unknown score category');
  if (player.scores[category] !== undefined) {
    throw new GameError('CATEGORY_USED', 'You already scored that category');
  }
  if (player.rollsRemaining === MAX_ROLLS || !isRolled(player.dice)) {
    throw new GameError('MUST_ROLL_FIRST', 'Roll the dice before scoring');
  }

  const score = scoreCategory(player.dice, category);
  const scores: Scores = { ...player.scores, [category]: score };
  let next = mapPlayer(state, playerId, (p) => ({ ...p, scores, totalScore: calculateTotal(scores) }));

  if (next.players.every((p) => isScorecardComplete(p.scores))) {
    next = {
      ...next,
      status: 'finished',
      endReason: 'completed',
      winnerIds: getWinners(next.players),
    };
  } else {
    const idx = next.players.findIndex((p) => p.id === playerId);
    const nextPlayer = next.players[(idx + 1) % next.players.length];
    next = mapPlayer({ ...next, currentPlayerId: nextPlayer.id }, nextPlayer.id, freshTurn);
  }
  return { state: next, category, score };
}

/** Everyone with the highest total. More than one id means a draw. */
export function getWinners(players: readonly GamePlayer[]): string[] {
  const best = Math.max(...players.map((p) => p.totalScore));
  return players.filter((p) => p.totalScore === best).map((p) => p.id);
}

/** Ends the game early; the remaining player(s) win. */
export function forfeitGame(state: GameState, loserId: string): GameState {
  if (!state.players.some((p) => p.id === loserId)) {
    throw new GameError('PLAYER_NOT_FOUND', 'Player is not part of this game');
  }
  if (state.status === 'finished') return state;
  return {
    ...state,
    status: 'finished',
    endReason: 'forfeit',
    winnerIds: state.players.filter((p) => p.id !== loserId).map((p) => p.id),
  };
}

export const getPlayer = (state: GameState, id: string): GamePlayer | undefined =>
  state.players.find((p) => p.id === id);
