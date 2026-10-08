import { useCallback, useEffect, useRef, useState } from 'react';
import type { Category } from '@game/types';
import type { RoomView, Session } from '@game/types/protocol';
import { loadSession, saveSession, socket } from '../services/socket';
import type { LastMove, LastRoll } from '../types';

const SESSION_LOST = new Set(['ROOM_NOT_FOUND', 'INVALID_SESSION', 'ROOM_EXPIRED']);

/** Owns the socket connection and mirrors the server's room state. The server is the source of truth. */
export function useGameClient() {
  const [room, setRoom] = useState<RoomView | null>(null);
  const [session, setSession] = useState<Session | null>(() => loadSession());
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastMove, setLastMove] = useState<LastMove | null>(null);
  const [lastRoll, setLastRoll] = useState<LastRoll | null>(null);
  const counter = useRef(0);
  const rejoining = useRef(false);
  const roomRef = useRef<RoomView | null>(null);

  useEffect(() => {
    const show = (r: RoomView | null) => {
      roomRef.current = r;
      setRoom(r);
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
    socket.on('disconnect', () => setConnected(false));
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
    });
    socket.on('dice_held', ({ room: r }) => show(r));
    socket.on('score_updated', ({ room: r, playerId, category, score, dice }) => {
      // The new view already hides that player's dice, so read the hold mask from the previous one.
      const heldDice = roomRef.current?.players.find((p) => p.id === playerId)?.heldDice ?? [];
      show(r);
      setLastMove({ id: ++counter.current, playerId, category, score, dice, heldDice });
    });
    socket.on('turn_changed', ({ room: r }) => show(r));
    socket.on('game_finished', ({ room: r }) => show(r));
    socket.on('room_error', ({ code, message }) => {
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
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const actions = {
    createRoom: (name: string) => socket.emit('create_room', { name }),
    createSolo: (name: string) => socket.emit('create_solo', { name }),
    joinRoom: (roomCode: string, name: string) => socket.emit('join_room', { roomCode, name }),
    leave: () => socket.emit('leave_room'),
    restart: () => socket.emit('restart_game'),
    declineRestart: () => socket.emit('decline_restart'),
    roll: () => socket.emit('roll_dice'),
    hold: (held: boolean[]) => socket.emit('hold_dice', { held }),
    score: (category: Category) => socket.emit('select_score', { category }),
  };

  const me = room && session ? (room.players.find((p) => p.id === session.playerId) ?? null) : null;
  return { room, session, me, connected, error, clearError, lastMove, lastRoll, actions };
}

export type GameClient = ReturnType<typeof useGameClient>;
