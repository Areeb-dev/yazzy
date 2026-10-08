import { describe, expect, it } from 'vitest';
import {
  GameError,
  createGame,
  forfeitGame,
  getWinners,
  rollDice,
  selectScore,
  setHeld,
} from './index';
import { CATEGORIES, MAX_ROLLS, type DieRoller, type GameState } from '../types';

/** Deterministic roller that cycles through the given values. */
const seq = (...values: number[]): DieRoller => {
  let i = 0;
  return () => values[i++ % values.length];
};

const newGame = () =>
  createGame([
    { id: 'a', name: 'Ann' },
    { id: 'b', name: 'Ben' },
  ]);

const expectCode = (fn: () => unknown, code: string) => {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(GameError);
    expect((e as GameError).code).toBe(code);
    return;
  }
  throw new Error(`expected GameError ${code}`);
};

const me = (s: GameState, id = 'a') => s.players.find((p) => p.id === id)!;

describe('createGame', () => {
  it('starts with the first player, empty dice and 3 rolls', () => {
    const g = newGame();
    expect(g.currentPlayerId).toBe('a');
    expect(g.status).toBe('playing');
    expect(me(g).dice).toEqual([0, 0, 0, 0, 0]);
    expect(me(g).rollsRemaining).toBe(MAX_ROLLS);
  });
  it('rejects duplicate or missing players', () => {
    expectCode(() => createGame([]), 'INVALID_PLAYERS');
    expectCode(() => createGame([{ id: 'x', name: '1' }, { id: 'x', name: '2' }]), 'INVALID_PLAYERS');
  });
});

describe('rolling', () => {
  it('rolls all five dice on the first roll and uses a server-supplied roller', () => {
    const { state, rolledIndices } = rollDice(newGame(), 'a', seq(1, 2, 3, 4, 5));
    expect(me(state).dice).toEqual([1, 2, 3, 4, 5]);
    expect(rolledIndices).toEqual([0, 1, 2, 3, 4]);
    expect(me(state).rollsRemaining).toBe(2);
  });

  it('does not mutate the previous state', () => {
    const g = newGame();
    rollDice(g, 'a', seq(6));
    expect(me(g).rollsRemaining).toBe(3);
  });

  it('allows at most three rolls', () => {
    let g = newGame();
    for (let i = 0; i < 3; i++) g = rollDice(g, 'a', seq(1, 2, 3, 4, 5)).state;
    expect(me(g).rollsRemaining).toBe(0);
    expectCode(() => rollDice(g, 'a', seq(1)), 'NO_ROLLS_REMAINING');
  });

  it('rejects an invalid value from the roller', () => {
    expectCode(() => rollDice(newGame(), 'a', () => 7), 'INVALID_DIE');
  });
});

describe('holding', () => {
  const afterFirstRoll = () => rollDice(newGame(), 'a', seq(1, 2, 3, 4, 5)).state;

  it('keeps held dice unchanged on the next roll', () => {
    let g = setHeld(afterFirstRoll(), 'a', [true, false, true, false, false]);
    const r = rollDice(g, 'a', seq(6));
    g = r.state;
    expect(me(g).dice).toEqual([1, 6, 3, 6, 6]);
    expect(r.rolledIndices).toEqual([1, 3, 4]);
  });

  it('lets the player unhold dice before rolling again', () => {
    let g = setHeld(afterFirstRoll(), 'a', [true, true, true, true, true]);
    g = setHeld(g, 'a', [false, false, false, false, false]);
    g = rollDice(g, 'a', seq(6)).state;
    expect(me(g).dice).toEqual([6, 6, 6, 6, 6]);
  });

  it('cannot hold before the first roll', () => {
    expectCode(() => setHeld(newGame(), 'a', [true, false, false, false, false]), 'MUST_ROLL_FIRST');
  });

  it('cannot hold once rolls are used up', () => {
    let g = newGame();
    for (let i = 0; i < 3; i++) g = rollDice(g, 'a', seq(1, 2, 3, 4, 5)).state;
    expectCode(() => setHeld(g, 'a', [true, true, true, true, true]), 'NO_ROLLS_REMAINING');
  });

  it('validates the shape of the hold mask', () => {
    const g = afterFirstRoll();
    expectCode(() => setHeld(g, 'a', [true, true]), 'INVALID_HOLD');
    expectCode(() => setHeld(g, 'a', 'yes'), 'INVALID_HOLD');
    expectCode(() => setHeld(g, 'a', [1, 0, 1, 0, 1]), 'INVALID_HOLD');
  });

  it('cannot roll with every die held', () => {
    const g = setHeld(afterFirstRoll(), 'a', [true, true, true, true, true]);
    expectCode(() => rollDice(g, 'a', seq(1)), 'INVALID_HOLD');
  });
});

describe('scoring a turn', () => {
  it('scores, resets the turn and passes play to the next player', () => {
    let g = rollDice(newGame(), 'a', seq(2, 2, 2, 5, 5)).state;
    const r = selectScore(g, 'a', 'full_house');
    expect(r.score).toBe(25);
    expect(me(r.state).scores.full_house).toBe(25);
    expect(me(r.state).totalScore).toBe(25);
    expect(r.state.currentPlayerId).toBe('b');
    expect(me(r.state, 'b').rollsRemaining).toBe(MAX_ROLLS);
    expect(me(r.state, 'b').dice).toEqual([0, 0, 0, 0, 0]);
  });

  it('cannot score before rolling', () => {
    expectCode(() => selectScore(newGame(), 'a', 'chance'), 'MUST_ROLL_FIRST');
  });

  it('prevents scoring the same category twice', () => {
    let g = rollDice(newGame(), 'a', seq(1, 2, 3, 4, 5)).state;
    g = selectScore(g, 'a', 'chance').state;
    g = rollDice(g, 'b', seq(1)).state;
    g = selectScore(g, 'b', 'chance').state;
    g = rollDice(g, 'a', seq(1, 2, 3, 4, 5)).state;
    expectCode(() => selectScore(g, 'a', 'chance'), 'CATEGORY_USED');
  });

  it('rejects unknown categories', () => {
    const g = rollDice(newGame(), 'a', seq(1)).state;
    expectCode(() => selectScore(g, 'a', 'bogus'), 'INVALID_CATEGORY');
    expectCode(() => selectScore(g, 'a', 42), 'INVALID_CATEGORY');
  });
});

describe('turn validation', () => {
  it("rejects actions out of turn", () => {
    const g = newGame();
    expectCode(() => rollDice(g, 'b', seq(1)), 'NOT_YOUR_TURN');
    const rolled = rollDice(g, 'a', seq(1)).state;
    expectCode(() => setHeld(rolled, 'b', [true, true, true, true, true]), 'NOT_YOUR_TURN');
    expectCode(() => selectScore(rolled, 'b', 'chance'), 'NOT_YOUR_TURN');
  });
  it('rejects unknown players', () => {
    expectCode(() => rollDice(newGame(), 'zzz', seq(1)), 'PLAYER_NOT_FOUND');
  });
});

function playFullGame(roller: DieRoller): GameState {
  let g = newGame();
  for (let turn = 0; turn < CATEGORIES.length * 2; turn++) {
    const id = g.currentPlayerId;
    g = rollDice(g, id, roller).state;
    const open = CATEGORIES.find((c) => me(g, id).scores[c] === undefined)!;
    g = selectScore(g, id, open).state;
  }
  return g;
}

describe('game end and winner', () => {
  it('finishes after all 13 categories are scored by every player', () => {
    const g = playFullGame(seq(3, 3, 3, 4, 4));
    expect(g.status).toBe('finished');
    expect(g.endReason).toBe('completed');
    expect(g.players.every((p) => Object.keys(p.scores).length === 13)).toBe(true);
    expectCode(() => rollDice(g, g.currentPlayerId, seq(1)), 'GAME_FINISHED');
  });

  it('declares a draw when totals tie', () => {
    const g = playFullGame(seq(3, 3, 3, 4, 4));
    expect(g.winnerIds.sort()).toEqual(['a', 'b']);
  });

  it('picks the highest total as the winner', () => {
    const players = newGame().players.map((p) => ({ ...p, totalScore: p.id === 'a' ? 120 : 200 }));
    expect(getWinners(players)).toEqual(['b']);
  });

  it('awards a forfeit to the remaining player', () => {
    const g = forfeitGame(newGame(), 'a');
    expect(g.status).toBe('finished');
    expect(g.endReason).toBe('forfeit');
    expect(g.winnerIds).toEqual(['b']);
  });
});
