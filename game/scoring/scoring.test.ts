import { describe, expect, it } from 'vitest';
import {
  UPPER_BONUS,
  calculateTotal,
  getPotentialScores,
  scoreCategory,
  upperBonus,
  upperSubtotal,
} from './index';
import { CATEGORIES, type Category, type Scores } from '../types';

const s = (dice: number[], c: Category) => scoreCategory(dice, c);

describe('upper section', () => {
  it.each([
    ['ones', [1, 1, 2, 3, 1], 3],
    ['twos', [2, 2, 5, 6, 1], 4],
    ['threes', [3, 3, 3, 3, 1], 12],
    ['fours', [4, 1, 2, 3, 5], 4],
    ['fives', [5, 5, 5, 5, 5], 25],
    ['sixes', [6, 6, 1, 2, 3], 12],
  ] as const)('%s sums only matching dice', (cat, dice, expected) => {
    expect(s([...dice], cat)).toBe(expected);
  });

  it('scores 0 when no die matches', () => {
    expect(s([2, 3, 4, 5, 6], 'ones')).toBe(0);
  });
});

describe('three / four of a kind', () => {
  it('three of a kind sums all dice', () => {
    expect(s([3, 3, 3, 4, 6], 'three_of_a_kind')).toBe(19);
  });
  it('three of a kind accepts four and five of a kind', () => {
    expect(s([2, 2, 2, 2, 6], 'three_of_a_kind')).toBe(14);
    expect(s([5, 5, 5, 5, 5], 'three_of_a_kind')).toBe(25);
  });
  it('three of a kind is 0 with only a pair', () => {
    expect(s([3, 3, 4, 5, 6], 'three_of_a_kind')).toBe(0);
  });
  it('four of a kind sums all dice', () => {
    expect(s([4, 4, 4, 4, 1], 'four_of_a_kind')).toBe(17);
    expect(s([6, 6, 6, 6, 6], 'four_of_a_kind')).toBe(30);
  });
  it('four of a kind is 0 with only three matching', () => {
    expect(s([4, 4, 4, 1, 2], 'four_of_a_kind')).toBe(0);
  });
});

describe('full house', () => {
  it('scores 25 for three + two', () => {
    expect(s([2, 2, 5, 5, 5], 'full_house')).toBe(25);
    expect(s([6, 1, 6, 1, 6], 'full_house')).toBe(25);
  });
  it('is 0 for three of a kind alone, two pair or four of a kind', () => {
    expect(s([2, 2, 2, 4, 5], 'full_house')).toBe(0);
    expect(s([2, 2, 3, 3, 5], 'full_house')).toBe(0);
    expect(s([2, 2, 2, 2, 5], 'full_house')).toBe(0);
  });
  it('is 0 for five of a kind (no joker rule)', () => {
    expect(s([3, 3, 3, 3, 3], 'full_house')).toBe(0);
  });
});

describe('straights', () => {
  it.each([
    [[1, 2, 3, 4, 6]],
    [[2, 3, 4, 5, 5]],
    [[3, 4, 5, 6, 1]],
    [[1, 2, 3, 4, 5]],
    [[2, 3, 4, 5, 6]],
    [[4, 3, 3, 2, 1]],
  ])('%j is a small straight (30)', (dice) => {
    expect(s(dice, 'small_straight')).toBe(30);
  });
  it.each([[[1, 2, 3, 5, 6]], [[1, 1, 2, 3, 5]], [[2, 2, 2, 2, 2]]])('%j is not a small straight', (dice) => {
    expect(s(dice, 'small_straight')).toBe(0);
  });
  it('large straight needs five in a row', () => {
    expect(s([1, 2, 3, 4, 5], 'large_straight')).toBe(40);
    expect(s([6, 5, 4, 3, 2], 'large_straight')).toBe(40);
    expect(s([1, 2, 3, 4, 6], 'large_straight')).toBe(0);
    expect(s([1, 2, 3, 4, 4], 'large_straight')).toBe(0);
  });
});

describe('yazzy and chance', () => {
  it('yazzy is 50 for five of a kind', () => {
    expect(s([4, 4, 4, 4, 4], 'yazzy')).toBe(50);
  });
  it('yazzy is 0 otherwise', () => {
    expect(s([4, 4, 4, 4, 3], 'yazzy')).toBe(0);
  });
  it('chance is the sum of all dice', () => {
    expect(s([1, 2, 3, 4, 6], 'chance')).toBe(16);
  });
});

describe('invalid input and totals', () => {
  it('scores 0 for unrolled dice', () => {
    for (const c of CATEGORIES) expect(s([0, 0, 0, 0, 0], c)).toBe(0);
    expect(s([1, 2, 3], 'chance')).toBe(0);
  });

  it('awards the 35 point bonus at 63+ in the upper section', () => {
    const scores: Scores = { ones: 3, twos: 6, threes: 9, fours: 12, fives: 15, sixes: 18 };
    expect(upperSubtotal(scores)).toBe(63);
    expect(upperBonus(scores)).toBe(UPPER_BONUS);
    expect(calculateTotal(scores)).toBe(63 + 35);
    expect(upperBonus({ ...scores, sixes: 12 })).toBe(0);
  });

  it('lists potential scores only for open categories', () => {
    const potential = getPotentialScores([1, 1, 1, 2, 3], { ones: 1 });
    expect(potential.ones).toBeUndefined();
    expect(potential.three_of_a_kind).toBe(8);
    expect(Object.keys(potential)).toHaveLength(12);
  });
});
