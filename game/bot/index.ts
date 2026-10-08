import { DICE_COUNT, type Category, type Scores } from '../types';
import { openCategories, scoreCategory } from '../scoring';

/**
 * Rough "par" for each category: roughly what a decent player ends up scoring there.
 * Scoring above par is a gain; scoring below par (or a zero) is a cost. This is how the
 * bot ranks priorities (Yazzy / straights are worth far more than par, Chance and the low
 * upper boxes are the cheapest places to dump a bad hand) and respects used categories.
 */
const PAR: Record<Category, number> = {
  ones: 2.5,
  twos: 5,
  threes: 7.5,
  fours: 10,
  fives: 12.5,
  sixes: 15,
  three_of_a_kind: 21,
  four_of_a_kind: 13,
  full_house: 22,
  small_straight: 25,
  large_straight: 20,
  yazzy: 10,
  chance: 22,
};

const value = (dice: readonly number[], category: Category): number =>
  scoreCategory(dice, category) - PAR[category];

function bestValue(dice: readonly number[], open: readonly Category[]): number {
  let best = -Infinity;
  for (const c of open) {
    const v = value(dice, c);
    if (v > best) best = v;
  }
  return best;
}

/** Pick the open category with the best payoff for these (final) dice. */
export function chooseCategory(dice: readonly number[], scores: Scores): Category {
  const open = openCategories(scores);
  if (open.length === 0) throw new Error('No open categories left');
  let best = open[0];
  let bestV = -Infinity;
  for (const c of open) {
    const v = value(dice, c);
    if (v > bestV) {
      bestV = v;
      best = c;
    }
  }
  return best;
}

/** Expected best payoff if the dice NOT in `mask` are re-rolled once. */
function expectedValue(dice: readonly number[], mask: number, open: readonly Category[]): number {
  const free: number[] = [];
  for (let i = 0; i < DICE_COUNT; i++) if (!(mask & (1 << i))) free.push(i);
  if (free.length === 0) return bestValue(dice, open);

  const total = 6 ** free.length;
  const trial = [...dice];
  let sum = 0;
  for (let n = 0; n < total; n++) {
    let rest = n;
    for (const idx of free) {
      trial[idx] = (rest % 6) + 1;
      rest = Math.floor(rest / 6);
    }
    sum += bestValue(trial, open);
  }
  return sum / total;
}

/**
 * Decide which dice to keep before the next roll. Evaluates all 32 hold patterns by the
 * expected payoff of one more roll (over only the categories still open) and keeps the best.
 * Ties favour holding more dice. Returns an all-true mask when standing pat is best.
 */
export function decideHold(dice: readonly number[], rollsRemaining: number, scores: Scores): boolean[] {
  if (rollsRemaining <= 0) return Array<boolean>(DICE_COUNT).fill(true);
  const open = openCategories(scores);
  if (open.length === 0) return Array<boolean>(DICE_COUNT).fill(true);

  let bestMask = 0;
  let bestEV = -Infinity;
  let bestHeld = -1;
  for (let mask = 0; mask < 1 << DICE_COUNT; mask++) {
    const ev = expectedValue(dice, mask, open);
    const heldCount = mask.toString(2).split('1').length - 1;
    if (ev > bestEV + 1e-9 || (Math.abs(ev - bestEV) <= 1e-9 && heldCount > bestHeld)) {
      bestEV = ev;
      bestMask = mask;
      bestHeld = heldCount;
    }
  }
  return Array.from({ length: DICE_COUNT }, (_, i) => Boolean(bestMask & (1 << i)));
}

