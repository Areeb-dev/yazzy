/** Top bar with player avatars (Ludo-style), live scores, and turn status. */
export function GameAvatarsBar({
  meName,
  oppName,
  meScore,
  oppScore,
  meActive,
  oppActive,
  meConnected,
  oppConnected,
  oppIsBot,
  status,
  waitingRestart,
  onBack,
  onSettings,
  onMeAvatarClick,
}: {
  meName: string;
  oppName: string;
  meScore: number;
  oppScore: number;
  meActive: boolean;
  oppActive: boolean;
  meConnected: boolean;
  oppConnected: boolean;
  oppIsBot: boolean;
  status: string;
  waitingRestart: boolean;
  onBack: () => void;
  onSettings: () => void;
  onMeAvatarClick: () => void;
}) {
  return (
    <div className="topbar">
      <div className="topbar-row avatars-row">
        <button type="button" className="icon-btn back-btn" onClick={onBack} aria-label="Open menu">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 6 9 12l6 6" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="avatars-strip" aria-label={`${meName} ${meScore} versus ${oppName} ${oppScore}`}>
          <button
            type="button"
            className="avatar-slot avatar-me"
            data-avatar-id="me"
            data-active={meActive}
            onClick={onMeAvatarClick}
            aria-label={`${meName}, tap for reactions`}
          >
            <span className="avatar-ring avatar-ring-me">
              <span className="avatar-face avatar-face-human" aria-hidden="true" />
              {meConnected && <span className="avatar-online" aria-hidden="true" />}
            </span>
            <span className="avatar-name">{meName}</span>
          </button>
          <div className="avatars-score" role="status" aria-label={`Score ${meScore} versus ${oppScore}`}>
            <b className="avatars-score-me">{meScore}</b>
            <span className="avatars-vs">vs</span>
            <b className="avatars-score-opp">{oppScore}</b>
          </div>
          <div className="avatar-slot avatar-opp" data-avatar-id="opp" data-active={oppActive} aria-label={oppName}>
            <span className={`avatar-ring ${oppIsBot ? 'avatar-ring-bot' : 'avatar-ring-opp'}`}>
              <span className={`avatar-face ${oppIsBot ? 'avatar-face-bot' : 'avatar-face-human'}`} aria-hidden="true" />
              {oppConnected && <span className="avatar-online" aria-hidden="true" />}
            </span>
            <span className="avatar-name">{oppName}</span>
          </div>
        </div>
        <button
          type="button"
          className="icon-btn settings-btn"
          data-waiting={waitingRestart}
          onClick={onSettings}
          aria-label={waitingRestart ? 'Restart requested, tap to cancel' : 'Game settings'}
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
      </div>
      <p className="status" aria-live="polite">
        {status}
      </p>
    </div>
  );
}
