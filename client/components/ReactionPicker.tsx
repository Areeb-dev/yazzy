import { useState } from 'react';
import { EMOJI_REACTIONS, THROWABLE_REACTIONS, type ReactionDef, type ReactionKind } from '@game/types/reactions';
import { ReactionGlyph } from './ReactionGlyph';

type Tab = 'emoji' | 'throwable';

export function ReactionPicker({
  meName,
  open,
  onClose,
  onPick,
}: {
  meName: string;
  open: boolean;
  onClose: () => void;
  onPick: (id: string, kind: ReactionKind) => void;
}) {
  const [tab, setTab] = useState<Tab>('emoji');
  const [picked, setPicked] = useState<string | null>(null);

  if (!open) return null;

  const choose = (def: ReactionDef) => {
    setPicked(def.id);
    onPick(def.id, def.kind);
    onClose();
  };

  const grid = tab === 'emoji' ? EMOJI_REACTIONS : THROWABLE_REACTIONS;

  return (
    <div className="reaction-root" role="presentation">
      <button type="button" className="reaction-backdrop" aria-label="Close reactions" onClick={onClose} />
      <div className="reaction-sheet" role="dialog" aria-modal="true" aria-label="Send a reaction">
        <header className="reaction-head">
          <div className="reaction-head-user">
            <span className="avatar-ring avatar-ring-me reaction-head-avatar">
              <span className="avatar-face avatar-face-human" aria-hidden="true" />
            </span>
            <span className="reaction-head-name">{meName}</span>
          </div>
          <button type="button" className="reaction-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className="reaction-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'emoji'}
            className="reaction-tab"
            data-active={tab === 'emoji'}
            onClick={() => setTab('emoji')}
          >
            <span aria-hidden="true">😊</span> Emojis
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'throwable'}
            className="reaction-tab"
            data-active={tab === 'throwable'}
            onClick={() => setTab('throwable')}
          >
            <span aria-hidden="true">💣</span> Throwables
          </button>
        </div>
        <div className="reaction-grid" role="tabpanel">
          {grid.map((def) => (
            <button
              key={def.id}
              type="button"
              className="reaction-cell"
              data-selected={picked === def.id}
              onClick={() => choose(def)}
            >
              <ReactionGlyph id={def.id} emoji={def.emoji} className="reaction-emoji" />
              <span className="reaction-label">{def.label}</span>
            </button>
          ))}
        </div>
        {tab === 'emoji' && (
          <p className="reaction-section-title">Throwables</p>
        )}
        {tab === 'emoji' && (
          <div className="reaction-grid reaction-grid-secondary">
            {THROWABLE_REACTIONS.map((def) => (
              <button
                key={def.id}
                type="button"
                className="reaction-cell"
                onClick={() => choose(def)}
              >
                <ReactionGlyph id={def.id} emoji={def.emoji} className="reaction-emoji" />
                <span className="reaction-label">{def.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
