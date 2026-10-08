import { CATEGORIES, UPPER_CATEGORIES, type Category, type Scores } from '../types';
import { countFaces, isRolled, sumDice } from '../utils';

export const UPPER_BONUS_THRESHOLD = 63;
export const UPPER_BONUS = 35;

export const FIXED_SCORES = {
  full_house: 25,
  small_straight: 30,
  large_straight: 40,
  yazzy: 50,
} as const;

const FACE: Partial<Record<Category, number>> = {
  ones: 1,
  twos: 2,
  threes: 3,
  fours: 4,
  fives: 5,
  sixes: 6,
};

function hasRun(counts: number[], length: number): boolean {
  for (let start = 1; start + length - 1 <= 6; start++) {
    let ok = true;
    for (let f = start; f < start + length; f++) if (counts[f] === 0) ok = false;
    if (ok) return true;
  }
  return false;
}

/** Score the given dice in a category. Unrolled / invalid dice score 0. */
export function scoreCategory(dice: readonly number[], category: Category): number {
  if (!isRolled(dice)) return 0;
  const counts = countFaces(dice);
  const total = sumDice(dice);
  const maxCount = Math.max(...counts.slice(1));

  const face = FACE[category];
  if (face !== undefined) return counts[face] * face;

  switch (category) {
    case 'three_of_a_kind':
      return maxCount >= 3 ? total : 0;
    case 'four_of_a_kind':
      return maxCount >= 4 ? total : 0;
    case 'full_house': {
      const groups = counts.slice(1).filter((c) => c > 0).sort();
      return groups.length === 2 && groups[0] === 2 && groups[1] === 3 ? FIXED_SCORES.full_house : 0;
    }
    case 'small_straight':
      return hasRun(counts, 4) ? FIXED_SCORES.small_straight : 0;
    case 'large_straight':
      return hasRun(counts, 5) ? FIXED_SCORES.large_straight : 0;
    case 'yazzy':
      return maxCount === 5 ? FIXED_SCORES.yazzy : 0;
    case 'chance':
      return total;
    default:
      return 0;
  }
}

export const openCategories = (scores: Scores): Category[] =>
  CATEGORIES.filter((c) => scores[c] === undefined);

/** What each still-open category would score with these dice. */
export function getPotentialScores(dice: readonly number[], scores: Scores): Scores {
  const out: Scores = {};
  for (const c of openCategories(scores)) out[c] = scoreCategory(dice, c);
  return out;
}

export const upperSubtotal = (scores: Scores): number =>
  UPPER_CATEGORIES.reduce((sum, c) => sum + (scores[c] ?? 0), 0);

export const upperBonus = (scores: Scores): number =>
  upperSubtotal(scores) >= UPPER_BONUS_THRESHOLD ? UPPER_BONUS : 0;

export const calculateTotal = (scores: Scores): number =>
  CATEGORIES.reduce((sum, c) => sum + (scores[c] ?? 0), 0) + upperBonus(scores);

export const isScorecardComplete = (scores: Scores): boolean => openCategories(scores).length === 0;
