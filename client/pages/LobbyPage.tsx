import { useState } from 'react';
import type { RoomView } from '@game/types/protocol';
import { Logo } from '../components/Logo';
import { SoftBg } from '../components/SoftBg';

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  }
}

export function LobbyPage({ room, meId, onLeave }: { room: RoomView; meId: string; onLeave: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (await copyText(room.roomCode)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="frame page page-lobby">
      <SoftBg />
      <Logo className="logo logo-sm" />

      <div className="panel-card">
        <h1>ROOM CODE</h1>
        <div className="code-box">
          <p className="code-big" aria-label={`Room code ${room.roomCode.split('').join(' ')}`}>
            {room.roomCode.split('').join(' ')}
          </p>
          <button type="button" className="icon-copy" onClick={copy} aria-label="Copy room code">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="8" y="8" width="11" height="11" rx="2.5" fill="none" stroke="currentColor" strokeWidth="2.2" />
              <path d="M6 15H5.5A2.5 2.5 0 0 1 3 12.5v-7A2.5 2.5 0 0 1 5.5 3h7A2.5 2.5 0 0 1 15 5.5V6" fill="none" stroke="currentColor" strokeWidth="2.2" />
            </svg>
          </button>
        </div>

        <button type="button" className="btn-soft primary-mint wide" onClick={copy}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="8" y="8" width="11" height="11" rx="2.5" fill="none" stroke="currentColor" strokeWidth="2.2" />
            <path d="M6 15H5.5A2.5 2.5 0 0 1 3 12.5v-7A2.5 2.5 0 0 1 5.5 3h7A2.5 2.5 0 0 1 15 5.5V6" fill="none" stroke="currentColor" strokeWidth="2.2" />
          </svg>
          {copied ? 'Copied' : 'Copy Code'}
        </button>

        <ul className="player-list" aria-label="Players">
          {room.players.map((p) => (
            <li key={p.id} className={`player-row soft ${p.id === meId ? 'me' : 'opp'}`}>
              <span className="player-avatar" data-tone={p.id === meId ? 'me' : 'opp'} aria-hidden="true">
                {p.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="player-name">{p.id === meId ? `${p.name} (you)` : p.name}</span>
              <span className={`ready-pill ${p.connected ? 'on' : 'off'}`}>{p.connected ? 'Ready' : 'Offline'}</span>
            </li>
          ))}
          {room.players.length < 2 && (
            <li className="player-row soft empty">
              <span className="wait-ring" aria-hidden="true" />
              <span className="player-name">Waiting for opponent...</span>
            </li>
          )}
        </ul>

        <button type="button" className="btn-soft danger-soft wide" onClick={onLeave}>
          Cancel
        </button>
      </div>
    </div>
  );
}
