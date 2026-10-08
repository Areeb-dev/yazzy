import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents, Session } from '@game/types/protocol';

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// Empty = same origin (Vite proxies /socket.io in dev; the server serves the build in prod).
const url = (import.meta.env.VITE_SERVER_URL as string | undefined) || undefined;

export const socket: GameSocket = io(url, { autoConnect: false });

// sessionStorage is per tab, so two tabs on one machine can play each other while testing.
const SESSION_KEY = 'yazzy.session';
const NAME_KEY = 'yazzy.name';

export function loadSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}
export function saveSession(s: Session | null): void {
  try {
    if (s) sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* storage unavailable: reconnect just won't survive a reload */
  }
}
export const loadName = (): string => {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
};
export const saveName = (name: string): void => {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    /* ignore */
  }
};
