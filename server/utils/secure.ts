import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import type { DieRoller } from '../../game/types';

/** Cryptographically secure d6. The only source of dice values in the system. */
export const secureRoller: DieRoller = () => randomInt(1, 7);
export const newToken = (): string => randomBytes(24).toString('hex');
export const newId = (): string => randomUUID();
export const randomIndex = (max: number): number => randomInt(0, max);
