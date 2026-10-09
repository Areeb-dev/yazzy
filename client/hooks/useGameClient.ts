import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MAX_ROLLS, type Category } from '@game/types';
import { noneHeld } from '@game/utils';
import type { PublicPlayer, RoomView, Session } from '@game/types/protocol';
import { loadSession, saveSession, socket } from '../services/socket';
import type { LastMove, LastRoll } from '../types';

const SESSION_LOST = new Set(['ROOM_NOT_FOUND', 'INVALID_SESSION', 'ROOM_EXPIRED']);

function syncHoldRef(ref: { current: boolean[] }, held: boolean[] | undefined): void {
  if (held && held.length === 5) ref.current = [...held];
}

/** Owns the socket connection and mirrors the server's room state. The server is the source of truth. */
export function useGameClient() {
  const [room, setRoom] = useState<RoomView | null>(null);
  const [session, setSession] = useState<Session | null>(() => loadSession());
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastMove, setLastMove] = useState<LastMove | null>(null);
  const [lastRoll, setLastRoll] = useState<LastRoll | null>(null);
  const [rollPending, setRollPending] = useState(false);
  /** Optimistic hold mask while toggling; cleared when the server confirms dice state. */
  const [localHeld, setLocalHeld] = useState<boolean[] | null>(null);
  const counter = useRef(0);
  const rejoining = useRef(false);
  const roomRef = useRef<RoomView | null>(null);
  const sessionRef = useRef<Session | null>(session);
  const holdRef = useRef<boolean[]>(noneHeld());
  const rollPendingRef = useRef(false);

  sessionRef.current = session;

  const clearRollPending = useCallback(() => {
    rollPendingRef.current = false;
    setRollPending(false);
  }, []);

  const clearLocalHeld = useCallback(() => setLocalHeld(null), []);

  useEffect(() => {
    const show = (r: RoomView | null) => {
      roomRef.current = r;
      setRoom(r);
      const pid = sessionRef.current?.playerId;
      if (r && pid && r.currentPlayerId === pid) {
        const p = r.players.find((pl) => pl.id === pid);
        syncHoldRef(holdRef, p?.heldDice);
      } else if (!r || !pid || r.currentPlayerId !== pid) {
        holdRef.current = noneHeld();
      }
      clearLocalHeld();
    };
    const adopt = (r: RoomView, s?: Session) => {
      show(r);
      if (s) {
        setSession(s);
        saveSession(s);
      }
    };
    const drop = () => {
      show(null);
      setSession(null);
      setLastMove(null);
      setLastRoll(null);
      clearRollPending();
      clearLocalHeld();
      holdRef.current = noneHeld();
      saveSession(null);
    };

    socket.on('connect', () => {
      setConnected(true);
      const s = loadSession();
      if (s) {
        rejoining.current = true;
        socket.emit('rejoin_room', { roomCode: s.roomCode, token: s.token });
      }
    });
    socket.on('disconnect', () => {
      setConnected(false);
      clearRollPending();
    });
    socket.on('room_created', ({ room: r, session: s }) => adopt(r, s));
    socket.on('room_joined', ({ room: r, session: s }) => adopt(r, s));
    socket.on('room_rejoined', ({ room: r, session: s }) => {
      rejoining.current = false;
      adopt(r, s);
    });
    socket.on('room_left', drop);
    socket.on('player_joined', ({ room: r }) => show(r));
    socket.on('player_left', ({ room: r }) => show(r));
    socket.on('player_reconnected', ({ room: r }) => show(r));
    socket.on('game_started', ({ room: r }) => {
      setLastMove(null);
      setLastRoll(null);
      clearRollPending();
      clearLocalHeld();
      show(r);
    });
    socket.on('restart_requested', ({ room: r }) => show(r));
    socket.on('restart_declined', ({ room: r, playerId }) => {
      show(r);
      const myId = loadSession()?.playerId;
      const who = r.players.find((p) => p.id === playerId);
      if (who && who.id !== myId) setError(`${who.name} declined the restart.`);
    });
    socket.on('dice_rolled', ({ room: r, playerId, rolledIndices }) => {
      show(r);
      setLastRoll({ nonce: ++counter.current, playerId, indices: rolledIndices });
      if (playerId === sessionRef.current?.playerId) clearRollPending();
    });
    socket.on('dice_held', ({ room: r }) => show(r));
    socket.on('score_updated', ({ room: r, playerId, category, score, dice }) => {
      const heldDice = roomRef.current?.players.find((p) => p.id === playerId)?.heldDice ?? [];
      show(r);
      setLastMove({ id: ++counter.current, playerId, category, score, dice, heldDice });
    });
    socket.on('turn_changed', ({ room: r }) => {
      show(r);
      clearRollPending();
    });
    socket.on('game_finished', ({ room: r }) => {
      show(r);
      clearRollPending();
    });
    socket.on('room_error', ({ code, message }) => {
      clearRollPending();
      if (SESSION_LOST.has(code) && (rejoining.current || code === 'ROOM_EXPIRED')) {
        rejoining.current = false;
        drop();
        setError(code === 'ROOM_EXPIRED' ? 'That room expired.' : 'Your previous game is no longer available.');
        return;
      }
      setError(message);
    });

    socket.connect();
    return () => {
      socket.removeAllListeners();
    };
  }, [clearLocalHeld, clearRollPending]);

  const clearError = useCallback(() => setError(null), []);

  const toggleHold = useCallback((index: number) => {
    const r = roomRef.current;
    const pid = sessionRef.current?.playerId;
    if (!r || !pid || r.currentPlayerId !== pid) return;
    const serverMe = r.players.find((p) => p.id === pid);
    if (!serverMe || serverMe.rollsRemaining <= 0 || serverMe.rollsRemaining === MAX_ROLLS) return;

    const next = holdRef.current.map((h, i) => (i === index ? !h : h));
    holdRef.current = next;
    setLocalHeld(next);
    socket.emit('hold_dice', { held: next });
  }, []);

  const roll = useCallback(() => {
    if (rollPendingRef.current) return;
    const r = roomRef.current;
    const pid = sessionRef.current?.playerId;
    if (!r || !pid || r.currentPlayerId !== pid) return;
    const serverMe = r.players.find((p) => p.id === pid);
    if (!serverMe || serverMe.rollsRemaining <= 0) return;

    rollPendingRef.current = true;
    setRollPending(true);

    const payload: { held?: boolean[] } = {};
    if (serverMe.rollsRemaining < MAX_ROLLS && serverMe.dice.every((d) => d > 0)) {
      payload.held = [...holdRef.current];
    }
    socket.emit('roll_dice', payload);
  }, []);

  const actions = useMemo(
    () => ({
      createRoom: (name: string) => socket.emit('create_room', { name }),
      createSolo: (name: string) => socket.emit('create_solo', { name }),
      joinRoom: (roomCode: string, name: string) => socket.emit('join_room', { roomCode, name }),
      leave: () => socket.emit('leave_room'),
      restart: () => socket.emit('restart_game'),
      declineRestart: () => socket.emit('decline_restart'),
      roll,
      toggleHold,
      score: (category: Category) => socket.emit('select_score', { category }),
    }),
    [roll, toggleHold],
  );

  const meRaw = room && session ? (room.players.find((p) => p.id === session.playerId) ?? null) : null;
  const me: PublicPlayer | null = useMemo(() => {
    if (!meRaw || !room || !session || room.currentPlayerId !== meRaw.id) return meRaw;
    if (!localHeld) return meRaw;
    return { ...meRaw, heldDice: localHeld };
  }, [meRaw, room, session, localHeld]);

  return { room, session, me, connected, error, clearError, lastMove, lastRoll, rollPending, actions };
}

export type GameClient = ReturnType<typeof useGameClient>;
