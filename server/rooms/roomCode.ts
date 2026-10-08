import { randomInt } from 'node:crypto';

// No 0/O, 1/I/L so codes are easy to read aloud.
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 5;

export function generateRoomCode(exists: (code: string) => boolean): string {
  for (let attempt = 0; attempt < 200; attempt++) {
    let code = '';
    for (let i = 0; i < ROOM_CODE_LENGTH; i++) code += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
    if (!exists(code)) return code;
  }
  throw new Error('Could not allocate a unique room code');
}

/** Returns the normalised code, or null if the input cannot be a room code. */
export function normalizeRoomCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const code = raw.trim().toUpperCase();
  return /^[A-Z0-9]{5}$/.test(code) ? code : null;
}
