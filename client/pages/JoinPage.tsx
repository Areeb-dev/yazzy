import { useState } from 'react';
import { Logo } from '../components/Logo';
import { SoftBg } from '../components/SoftBg';
import { loadName, saveName } from '../services/socket';

interface Props {
  onJoin: (code: string, name: string) => void;
  onBack: () => void;
  connected: boolean;
  error: string | null;
}

export function JoinPage({ onJoin, onBack, connected, error }: Props) {
  const [name, setName] = useState(loadName);
  const [code, setCode] = useState('');
  const cleanName = name.trim();
  const ready = code.length === 5 && cleanName.length > 0 && connected;

  const submit = () => {
    if (!ready) return;
    saveName(cleanName);
    onJoin(code, cleanName);
  };

  return (
    <div className="frame page page-join">
      <SoftBg />
      <Logo />

      <div className="panel-card">
        <h1>JOIN ROOM</h1>

        <label className="soft-field">
          <span className="field-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <circle cx="12" cy="9" r="4" fill="currentColor" />
              <path d="M4 20c1.8-3.5 5-5 8-5s6.2 1.5 8 5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
            </svg>
          </span>
          <span className="sr-only">Your Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            maxLength={20}
            placeholder="Your Name"
            autoComplete="nickname"
            autoFocus={!cleanName}
            aria-required="true"
          />
        </label>

        <label className="soft-field">
          <span className="field-icon hash" aria-hidden="true">
            #
          </span>
          <span className="sr-only">Room Code</span>
          <input
            className="code-soft"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5))}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            autoFocus={!!cleanName}
            aria-invalid={error ? true : undefined}
            placeholder="Room Code"
          />
        </label>

        <p role="alert" className="form-msg">
          {error ?? (cleanName ? '' : 'Add your name to join.')}
        </p>

        <button type="button" className="btn-soft primary-blue wide" onClick={submit} disabled={!ready}>
          Join Game
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 12h12m-4-4 4 4-4 4" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button type="button" className="btn-soft ghost-grey wide" onClick={onBack}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 6 9 12l6 6" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back
        </button>
      </div>
    </div>
  );
}
