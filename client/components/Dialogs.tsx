import type { RoomView } from '@game/types/protocol';

export interface DialogAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'lime' | 'cream' | 'opp' | 'danger';
}

const VARIANT_CLASS: Record<NonNullable<DialogAction['variant']>, string> = {
  primary: 'primary-blue',
  lime: 'primary-mint',
  cream: 'ghost-grey',
  opp: 'primary-blue',
  danger: 'danger-solid',
};

function RestartArt() {
  return (
    <div className="modal-art" aria-hidden="true">
      <span className="spark s1" />
      <span className="spark s2" />
      <span className="spark s3" />
      <span className="art-die white">
        <i />
        <i />
        <i />
      </span>
      <span className="art-die red">
        <i />
        <i />
      </span>
    </div>
  );
}

/** A card with a title, a line of text and a stack of buttons. */
export function ActionDialog({
  title,
  detail,
  actions,
  onDismiss,
  illustrated,
}: {
  title: string;
  detail: string;
  actions: DialogAction[];
  /** Tapping outside closes it (omit for choices that must be answered). */
  onDismiss?: () => void;
  /** Show the restart dice illustration from the mockup. */
  illustrated?: boolean;
}) {
  return (
    <div className="backdrop" role="dialog" aria-modal="true" aria-label={title} onClick={onDismiss}>
      <div className="modal panel-card" onClick={(e) => e.stopPropagation()}>
        {illustrated && <RestartArt />}
        <h2>{title}</h2>
        <p>{detail}</p>
        <div className="modal-actions">
          {actions.map((a, i) => (
            <button
              key={a.label}
              type="button"
              className={`btn-soft wide ${VARIANT_CLASS[a.variant ?? (i === 0 && illustrated ? 'danger' : 'primary')]}`}
              onClick={a.onClick}
              autoFocus={i === 0}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ResultModal({
  room,
  meId,
  waitingForRestart,
  onLeave,
  onPlayAgain,
}: {
  room: RoomView;
  meId: string;
  /** I asked for a rematch and am waiting for the other player. */
  waitingForRestart: boolean;
  onLeave: () => void;
  onPlayAgain: () => void;
}) {
  const me = room.players.find((p) => p.id === meId)!;
  const opponent = room.players.find((p) => p.id !== meId)!;
  const draw = room.winnerIds.length > 1;
  const won = room.winnerIds.includes(meId) && !draw;
  const forfeit = room.endReason === 'forfeit';
  const title = draw ? 'DRAW' : won ? 'YOU WIN' : `${opponent.name.toUpperCase()} WINS`;
  const detail = waitingForRestart
    ? `Waiting for ${opponent.name} to accept…`
    : forfeit
      ? won
        ? `${opponent.name} left the game.`
        : 'You left the game.'
      : draw
        ? 'Same total, no tiebreaker.'
        : won
          ? 'Nice rolling!'
          : 'Better luck next time.';

  return (
    <div className="backdrop" role="dialog" aria-modal="true" aria-label="Game result">
      <div className="modal panel-card">
        <RestartArt />
        <h2>{title}</h2>
        <p>{detail}</p>
        <div className="result-chips">
          <div className="chip chip-me" data-win={room.winnerIds.includes(me.id)}>
            You
            <b>{me.totalScore}</b>
          </div>
          <div className="chip chip-opp" data-win={room.winnerIds.includes(opponent.id)}>
            {opponent.name}
            <b>{opponent.totalScore}</b>
          </div>
        </div>
        <div className="modal-actions">
          {!forfeit && (
            <button type="button" className="btn-soft primary-mint wide" onClick={onPlayAgain} disabled={waitingForRestart}>
              {waitingForRestart ? 'WAITING…' : 'PLAY AGAIN'}
            </button>
          )}
          <button type="button" className="btn-soft ghost-grey wide" onClick={onLeave}>
            MENU
          </button>
        </div>
      </div>
    </div>
  );
}
