import { MAX_ROLLS } from '@game/types';

interface Props {
  rollsRemaining: number;
  canRoll: boolean;
  /** PLAY slides in after the first roll. */
  showPlay: boolean;
  canPlay: boolean;
  onRoll: () => void;
  onPlay: () => void;
}

export function RollBar({ rollsRemaining, canRoll, showPlay, canPlay, onRoll, onPlay }: Props) {
  const used = MAX_ROLLS - rollsRemaining;
  return (
    <div className="rollbar">
      <div className="rollbar-actions">
        <button
          type="button"
          className="btn-soft primary-blue roll"
          disabled={!canRoll}
          onClick={onRoll}
          aria-label={`Roll dice, ${rollsRemaining} of ${MAX_ROLLS} rolls left`}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" fill="none" stroke="currentColor" strokeWidth="2.4" />
            <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
            <circle cx="12" cy="12" r="1.5" fill="currentColor" />
            <circle cx="15.5" cy="15.5" r="1.5" fill="currentColor" />
          </svg>
          ROLL
        </button>
        <button
          type="button"
          className="btn-soft primary-blue play"
          data-hidden={!showPlay}
          disabled={!canPlay}
          tabIndex={showPlay ? 0 : -1}
          onClick={onPlay}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 12.5 10 17.5 19 7.5" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          PLAY
        </button>
      </div>
      <span className="rcs" aria-hidden="true">
        {Array.from({ length: MAX_ROLLS }, (_, i) => (
          <span key={i} className="rc" data-used={i < used}>
            {i + 1}
          </span>
        ))}
      </span>
    </div>
  );
}
