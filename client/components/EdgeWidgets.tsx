/** Settings / restart control in the game top bar. */
export function RestartButton({ onClick, waiting }: { onClick: () => void; waiting: boolean }) {
  return (
    <button
      type="button"
      className="icon-btn settings-btn"
      data-waiting={waiting}
      onClick={onClick}
      aria-label={waiting ? 'Restart requested, tap to cancel' : 'Game settings'}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M10.2 3.4h3.6l.5 2.2a6.8 6.8 0 0 1 1.7 1l2.1-.9 1.8 3.1-1.6 1.5c.2.6.3 1.2.3 1.8s-.1 1.2-.3 1.8l1.6 1.5-1.8 3.1-2.1-.9a6.8 6.8 0 0 1-1.7 1l-.5 2.2h-3.6l-.5-2.2a6.8 6.8 0 0 1-1.7-1l-2.1.9-1.8-3.1 1.6-1.5A6.9 6.9 0 0 1 5.4 12c0-.6.1-1.2.3-1.8L4.1 8.7l1.8-3.1 2.1.9a6.8 6.8 0 0 1 1.7-1l.5-2.1Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="12" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    </button>
  );
}

/** Running totals tucked into the bottom-left corner. */
export function ScoreBadge({ opponent, me }: { opponent: number; me: number }) {
  return (
    <div className="score-badge" role="status" aria-label={`Score: you ${me}, opponent ${opponent}`}>
      <b className="score-opp">{opponent}</b>
      <i aria-hidden="true" />
      <b className="score-me">{me}</b>
    </div>
  );
}

export function TurnPills({
  meName,
  oppName,
  meActive,
  oppActive,
  status,
  onBack,
}: {
  meName: string;
  oppName: string;
  meActive: boolean;
  oppActive: boolean;
  status: string;
  onBack: () => void;
}) {
  return (
    <div className="topbar">
      <div className="topbar-row">
        <button type="button" className="icon-btn back-btn" onClick={onBack} aria-label="Open menu">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 6 9 12l6 6" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="vs-pill" aria-label={`${meName} versus ${oppName}`}>
          <span className="pill pill-me" data-active={meActive}>
            {meName}
          </span>
          <span className="vs-sep" aria-hidden="true">
            vs
          </span>
          <span className="pill pill-opp" data-active={oppActive}>
            {oppName}
          </span>
        </div>
        <span className="topbar-spacer" aria-hidden="true" />
      </div>
      <p className="status" aria-live="polite">
        {status}
      </p>
    </div>
  );
}
