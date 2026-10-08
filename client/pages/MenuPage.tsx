import { useState } from 'react';
import { ActionDialog } from '../components/Dialogs';
import { Logo } from '../components/Logo';
import { SoftBg } from '../components/SoftBg';
import { loadName, saveName } from '../services/socket';

interface Props {
  onSolo: (name: string) => void;
  onCreate: (name: string) => void;
  onJoin: () => void;
  connected: boolean;
}

export function MenuPage({ onSolo, onCreate, onJoin, connected }: Props) {
  const [name, setName] = useState(loadName);
  const [editing, setEditing] = useState(false);
  const [help, setHelp] = useState(false);
  const [settings, setSettings] = useState(false);
  const clean = name.trim();
  const go = (fn: (n: string) => void) => () => {
    saveName(clean);
    fn(clean || 'Player');
  };

  return (
    <div className="frame page page-menu">
      <SoftBg interactive />
      <Logo />

      <div className="menu-card">
        <div className="profile-row">
          <span className="avatar" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <circle cx="12" cy="9" r="4" fill="currentColor" />
              <path d="M4 20c1.8-3.5 5-5 8-5s6.2 1.5 8 5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
            </svg>
          </span>
          {editing ? (
            <input
              className="profile-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => {
                saveName(name.trim());
                setEditing(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  saveName(name.trim());
                  setEditing(false);
                }
              }}
              maxLength={20}
              placeholder="Player"
              autoComplete="nickname"
              autoFocus
              aria-label="Your name"
            />
          ) : (
            <span className="profile-name">{clean || 'Player'}</span>
          )}
          <button
            type="button"
            className="btn-edit"
            onClick={() => setEditing(true)}
            aria-label="Edit name"
          >
            Edit
          </button>
        </div>

        <div className="menu-actions">
          <button type="button" className="btn-soft primary-yellow" onClick={go(onSolo)} disabled={!connected}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M8 5.5v13l11-6.5z" fill="currentColor" />
            </svg>
            Play Solo
          </button>
          <button type="button" className="btn-soft secondary-white" onClick={go(onCreate)} disabled={!connected}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="2.4" />
              <path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
            </svg>
            Create Room
            <span className="chev" aria-hidden="true">
              ›
            </span>
          </button>
          <button
            type="button"
            className="btn-soft secondary-white"
            onClick={() => {
              saveName(clean);
              onJoin();
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M14 4h4.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H14"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
              <path
                d="M4 12h10m-3.5-3.5L14 12l-3.5 3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Join Room
            <span className="chev" aria-hidden="true">
              ›
            </span>
          </button>
        </div>

        <div className="menu-footer">
          <button type="button" className="btn-link" onClick={() => setHelp(true)}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M6 4h9l3 3v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
              />
              <path d="M8 10h8M8 14h6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
            How to Play
          </button>
          <button type="button" className="btn-link" onClick={() => setSettings(true)}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" strokeWidth="2.2" />
              <path
                d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M5.8 5.8l1.6 1.6M16.6 16.6l1.6 1.6M18.2 5.8l-1.6 1.6M7.4 16.6l-1.6 1.6"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            </svg>
            Settings
          </button>
        </div>
      </div>

      {!connected && <p className="conn-note">Connecting to the game server…</p>}

      {help && (
        <ActionDialog
          title="HOW TO PLAY"
          detail="Roll up to 3 times each turn. Tap dice to hold them. Fill every box once — upper 63+ earns +35. Five of a kind is a Yazzy (50)."
          onDismiss={() => setHelp(false)}
          actions={[{ label: 'GOT IT', variant: 'primary', onClick: () => setHelp(false) }]}
        />
      )}
      {settings && (
        <ActionDialog
          title="SETTINGS"
          detail="Tap Edit on your profile to change your display name. It is saved on this device."
          onDismiss={() => setSettings(false)}
          actions={[
            {
              label: 'EDIT NAME',
              onClick: () => {
                setSettings(false);
                setEditing(true);
              },
            },
            { label: 'CLOSE', variant: 'cream', onClick: () => setSettings(false) },
          ]}
        />
      )}
    </div>
  );
}
