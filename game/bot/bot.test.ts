import { describe, expect, it } from 'vitest';
import { chooseCategory, decideHold } from './index';
import { CATEGORIES, type Scores } from '../types';

describe('chooseCategory', () => {
  it('takes a Yazzy when it is available', () => {
    expect(chooseCategory([6, 6, 6, 6, 6], {})).toBe('yazzy');
  });
  it('takes a large straight', () => {
    expect(chooseCategory([1, 2, 3, 4, 5], {})).toBe('large_straight');
  });
  it('takes a small straight over chance', () => {
    expect(chooseCategory([1, 2, 3, 4, 6], {})).toBe('small_straight');
  });
  it('takes a full house', () => {
    expect(chooseCategory([3, 3, 5, 5, 5], {})).toBe('full_house');
  });
  it('prefers a strong upper box over a mediocre three of a kind', () => {
    expect(chooseCategory([6, 6, 6, 2, 1], {})).toBe('sixes');
  });
  it('never picks a category that is already used', () => {
    const used: Scores = { yazzy: 50, large_straight: 40 };
    expect(chooseCategory([6, 6, 6, 6, 6], used)).not.toBe('yazzy');
    expect(chooseCategory([1, 2, 3, 4, 5], used)).not.toBe('large_straight');
  });
  it('sacrifices a cheap box on a bad hand instead of burning Yazzy', () => {
    const choice = chooseCategory([1, 2, 2, 4, 6], {});
    expect(['ones', 'twos', 'chance']).toContain(choice);
  });
  it('returns the only open category', () => {
    const scores: Scores = Object.fromEntries(CATEGORIES.filter((c) => c !== 'fours').map((c) => [c, 0]));
    expect(chooseCategory([1, 1, 1, 1, 1], scores)).toBe('fours');
  });
  it('throws when the scorecard is full', () => {
    const full: Scores = Object.fromEntries(CATEGORIES.map((c) => [c, 0]));
    expect(() => chooseCategory([1, 1, 1, 1, 1], full)).toThrow();
  });
});

describe('decideHold', () => {
  it('holds all five dice on a Yazzy', () => {
    expect(decideHold([3, 3, 3, 3, 3], 2, {})).toEqual([true, true, true, true, true]);
  });
  it('keeps four of a kind and rerolls the odd die', () => {
    expect(decideHold([4, 4, 2, 4, 4], 1, {})).toEqual([true, true, false, true, true]);
  });
  it('chases a large straight from four in a row', () => {
    const held = decideHold([1, 2, 3, 4, 6], 2, {});
    expect(held).toEqual([true, true, true, true, false]);
  });
  it('keeps the pair of sixes and rerolls the rest', () => {
    const held = decideHold([6, 6, 1, 2, 3], 2, {});
    expect(held.slice(0, 2)).toEqual([true, true]);
    expect(held.slice(2)).toEqual([false, false, false]);
  });
  it('stands pat on a completed large straight', () => {
    expect(decideHold([2, 3, 4, 5, 6], 2, {})).toEqual([true, true, true, true, true]);
  });
  it('does not chase a category that is already used', () => {
    const held = decideHold([3, 3, 3, 3, 3], 2, { yazzy: 50 });
    // Five threes still make a fine four of a kind, but it should not hold nothing.
    expect(held.filter(Boolean).length).toBeGreaterThanOrEqual(3);
  });
  it('holds everything when no rolls remain', () => {
    expect(decideHold([1, 2, 3, 4, 6], 0, {})).toEqual([true, true, true, true, true]);
  });
  it('runs fast enough for real-time play', () => {
    const t = Date.now();
    decideHold([1, 3, 4, 6, 6], 2, {});
    expect(Date.now() - t).toBeLessThan(500);
  });
});
