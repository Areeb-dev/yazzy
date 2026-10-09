import { memo } from 'react';
import {
  CATEGORY_LABELS,
  LOWER_CATEGORIES,
  UPPER_CATEGORIES,
  type Category,
  type Scores,
} from '@game/types';
import { UPPER_BONUS, UPPER_BONUS_THRESHOLD, upperBonus, upperSubtotal } from '@game/scoring';
import type { PublicPlayer } from '@game/types/protocol';
import { CategoryTile } from './CategoryTile';
import type { TipTarget } from './RuleTip';

interface Props {
  me: PublicPlayer;
  opponent: PublicPlayer;
  /** Scores as they should be *shown* (a score is withheld until its dice have landed). */
  meScores: Scores;
  oppScores: Scores;
  /** Empty boxes light up and can be tapped. */
  selectable: boolean;
  selected: Category | null;
  /** What the picked box would score with the dice on the table. Shown in that box only. */
  preview: number | null;
  /** `${playerId}:${category}` of the box that just got its number. */
  pop: string | null;
  /** Changes each time the bonus counter should sparkle. 0 = no sparkle. */
  sparkId: number;
  onPick: (category: Category) => void;
  /** A row icon (or the bonus label) was tapped: show how it scores. */
  onInfo: (id: TipTarget, rect: DOMRect) => void;
}

function ScorecardInner({ me, opponent, meScores, oppScores, selectable, selected, preview, pop, sparkId, onPick, onInfo }: Props) {
  const mineCell = (cat: Category) => {
    const key = `${me.id}:${cat}`;
    const value = meScores[cat];
    if (value !== undefined) {
      return (
        <div className="cell cell-me filled" data-cell={key} data-pop={pop === key}>
          {value}
        </div>
      );
    }
    if (selectable) {
      return (
        <button
          type="button"
          className="cell cell-me open"
          data-cell={key}
          data-selected={selected === cat}
          aria-pressed={selected === cat}
          aria-label={`Choose ${CATEGORY_LABELS[cat]}`}
          onClick={() => onPick(cat)}
        >
          {selected === cat && preview !== null ? preview : null}
        </button>
      );
    }
    return <div className="cell cell-me" data-cell={key} />;
  };

  const theirCell = (cat: Category) => {
    const key = `${opponent.id}:${cat}`;
    const value = oppScores[cat];
    return (
      <div className="cell cell-opp" data-cell={key} data-pop={pop === key}>
        {value}
      </div>
    );
  };

  const circle = (scores: Scores) =>
    upperBonus(scores) > 0 ? `+${UPPER_BONUS}` : `${upperSubtotal(scores)}/${UPPER_BONUS_THRESHOLD}`;

  const burst = sparkId > 0 && (
    <span className="burst" key={sparkId} aria-hidden="true">
      {Array.from({ length: 8 }, (_, i) => (
        <i key={i} style={{ ['--a' as string]: `${i * 45}deg` }} />
      ))}
    </span>
  );

  return (
    <section className="board" aria-label="Scorecard">
      <div className="board-inner">
        <div className="strips" aria-hidden="true">
          <i />
          <i />
        </div>
        <div className="divider" aria-hidden="true" />
        {Array.from({ length: 7 }, (_, row) => {
          const upper = UPPER_CATEGORIES[row];
          const lower = LOWER_CATEGORIES[row];
          return (
            <div className="brow" key={row}>
              <div className="half">
                {upper ? (
                  <>
                    <CategoryTile category={upper} onInfo={onInfo} />
                    {mineCell(upper)}
                    {theirCell(upper)}
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="bonus-label"
                      aria-label="Upper bonus: show rules"
                      onClick={(e) => onInfo('bonus', e.currentTarget.getBoundingClientRect())}
                    >
                      BONUS
                      <b>+{UPPER_BONUS}</b>
                    </button>
                    <div className="bonus-circle" aria-label={`Your upper section ${circle(meScores)}`}>
                      {circle(meScores)}
                      {burst}
                    </div>
                    <div className="bonus-circle" aria-label={`Opponent upper section ${circle(oppScores)}`}>
                      {circle(oppScores)}
                    </div>
                  </>
                )}
              </div>
              <div className="half">
                <CategoryTile category={lower} onInfo={onInfo} />
                {mineCell(lower)}
                {theirCell(lower)}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export const Scorecard = memo(ScorecardInner);
