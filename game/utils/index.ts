import { DICE_COUNT } from '../types';

export const emptyDice = (): number[] => Array<number>(DICE_COUNT).fill(0);
export const noneHeld = (): boolean[] => Array<boolean>(DICE_COUNT).fill(false);

export const isValidDie = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 6;

/** True once all five dice show a face. */
export const isRolled = (dice: readonly number[]): boolean =>
  dice.length === DICE_COUNT && dice.every(isValidDie);

export const sumDice = (dice: readonly number[]): number => dice.reduce((a, b) => a + b, 0);

/** counts[face] for faces 1..6 (index 0 unused). */
export function countFaces(dice: readonly number[]): number[] {
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const d of dice) if (isValidDie(d)) counts[d]++;
  return counts;
}
