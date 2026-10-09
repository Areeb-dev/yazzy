import { useEffect, useState } from 'react';
import { MAX_ROLLS, UPPER_CATEGORIES, type Category, type Scores } from '@game/types';
import { calculateTotal, scoreCategory } from '@game/scoring';
import type { PublicPlayer } from '@game/types/protocol';
import { ActionDialog, ResultModal } from '../components/Dialogs';
import { DiceTray } from '../components/DiceTray';
import { RestartButton, ScoreBadge, TurnPills } from '../components/EdgeWidgets';
import { FLIGHT_MS, FlyingDice } from '../components/FlyingDice';
import { RollBar } from '../components/RollBar';
import { RuleTip, type TipTarget } from '../components/RuleTip';
import { Scorecard } from '../components/Scorecard';
import type { GameClient } from '../hooks/useGameClient';
import type { LastMove } from '../types';

const POP_MS = 800;

export function GamePage({ client }: { client: GameClient }) {
  const { room, me, lastMove, lastRoll, actions } = client;
  const [selected, setSelected] = useState<Category | null>(null);
  const [flight, setFlight] = useState<LastMove | null>(null);
  const [pop, setPop] = useState<{ key: string; id: number; upper: boolean } | null>(null);
  const [menu, setMenu] = useState(false);
  const [tip, setTip] = useState<{ target: TipTarget; rect: DOMRect } | null>(null);

  // New score from the server: fly the dice to the box, then reveal the number.
  useEffect(() => {
    if (!lastMove) return;
    setFlight(lastMove);
    const land = setTimeout(() => {
      setFlight(null);
      setPop({
        key: `${lastMove.playerId}:${lastMove.category}`,
        id: lastMove.id,
        upper: UPPER_CATEGORIES.includes(lastMove.category),
      });
    }, FLIGHT_MS);
    return () => clearTimeout(land);
  }, [lastMove]);

  useEffect(() => {
    if (!pop) return;
    const t = setTimeout(() => setPop(null), POP_MS);
    return () => clearTimeout(t);
  }, [pop]);

  const currentId = room?.currentPlayerId ?? null;
  // A box picked for one set of dice should not carry over to the next roll or turn.
  useEffect(() => setSelected(null), [currentId, me?.rollsRemaining]);

  const opponentWantsRestart = !!room && !!me && room.mode === 'online' && room.restartVotes.some((id) => id !== me.id) && !room.restartVotes.includes(me.id);
  // An incoming restart question replaces whatever dialog was open.
  useEffect(() => {
    if (opponentWantsRestart) setMenu(false);
  }, [opponentWantsRestart]);

  if (!room || !me) return null;
  const opponent = room.players.find((p) => p.id !== me.id) as PublicPlayer;

  const solo = room.mode === 'solo';
  const iVoted = room.restartVotes.includes(me.id);
  const waitingForRestart = iVoted && !solo;

  const busy = flight !== null;
  const playing = room.status === 'playing';
  const myTurn = playing && currentId === me.id && !busy;
  const rolled = me.dice.every((d) => d > 0);
  const allHeld = me.heldDice.every(Boolean);
  const canRoll = myTurn && me.rollsRemaining > 0 && !(rolled && allHeld);
  const canPick = myTurn && rolled;
  const canPlay = canPick && selected !== null;

  // Whoever is playing shows their dice in the tray (the bot's only during its own turn).
  const active = room.players.find((p) => p.id === currentId) ?? me;
  const mineActive = active.id === me.id;

  // Rolls tumble for you and for the bot, but another human's rolls just show up: no animation.
  const roller = lastRoll ? room.players.find((p) => p.id === lastRoll.playerId) : undefined;
  const animateRolls = !!roller && (roller.id === me.id || roller.isBot);

  // The score that is still "in the air" stays hidden so the number appears when the dice land.
  const visible = (p: PublicPlayer): Scores => {
    if (!flight || flight.playerId !== p.id) return p.scores;
    const rest = { ...p.scores };
    delete rest[flight.category];
    return rest;
  };
  const meScores = visible(me);
  const oppScores = visible(opponent);

  const status = (() => {
    if (!playing) return 'Game over';
    if (waitingForRestart) return `Waiting for ${opponent.name} to accept the restart…`;
    if (busy) return '…';
    if (myTurn) {
      if (me.rollsRemaining === MAX_ROLLS) return 'Your turn: roll the dice';
      if (me.rollsRemaining > 0) return 'Tap dice to hold, roll again or pick a box';
      return 'Pick a box, then press play';
    }
    if (!active.connected) return `${active.name} lost connection. Waiting…`;
    return active.isBot ? 'Bot is playing…' : `${active.name} is playing…`;
  })();

  const toggleHold = (i: number) => {
    const next = [...me.heldDice];
    next[i] = !next[i];
    actions.hold(next);
  };

  const leave = () => {
    setMenu(false);
    actions.leave();
  };

  const menuDialog = solo ? (
    <ActionDialog
      title="RESTART GAME?"
      detail="Your current game will be lost."
      illustrated
      onDismiss={() => setMenu(false)}
      actions={[
        { label: 'Restart', variant: 'danger', onClick: () => (setMenu(false), actions.restart()) },
        { label: 'Keep Playing', variant: 'cream', onClick: () => setMenu(false) },
        { label: 'Main Menu', variant: 'cream', onClick: leave },
      ]}
    />
  ) : iVoted ? (
    <ActionDialog
      title="WAITING…"
      detail={`Waiting for ${opponent.name} to accept the restart.`}
      onDismiss={() => setMenu(false)}
      actions={[
        { label: 'CANCEL REQUEST', variant: 'cream', onClick: () => (setMenu(false), actions.declineRestart()) },
        { label: 'CLOSE', variant: 'cream', onClick: () => setMenu(false) },
      ]}
    />
  ) : (
    <ActionDialog
      title="RESTART GAME?"
      detail={`Ask ${opponent.name} to start over. Both players must agree.`}
      illustrated
      onDismiss={() => setMenu(false)}
      actions={[
        { label: 'Ask to Restart', variant: 'danger', onClick: () => (setMenu(false), actions.restart()) },
        { label: 'Keep Playing', variant: 'cream', onClick: () => setMenu(false) },
        { label: 'Leave (counts as loss)', variant: 'cream', onClick: leave },
      ]}
    />
  );

  return (
    <>
      <div className="frame page-game">
        <TurnPills
          meName={me.name}
          oppName={opponent.name}
          meActive={playing && currentId === me.id}
          oppActive={playing && currentId === opponent.id}
          status={status}
          onBack={() => setMenu(true)}
        />
        <RestartButton onClick={() => setMenu(true)} waiting={waitingForRestart} />
        <Scorecard
          me={me}
          opponent={opponent}
          meScores={meScores}
          oppScores={oppScores}
          selectable={canPick}
          selected={selected}
          preview={canPick && selected ? scoreCategory(me.dice, selected) : null}
          pop={pop?.key ?? null}
          sparkId={pop?.upper ? pop.id : 0}
          onPick={(c) => setSelected((cur) => (cur === c ? null : c))}
          onInfo={(target, rect) => setTip({ target, rect })}
        />
        <DiceTray
          dice={active.dice}
          held={active.heldDice}
          interactive={mineActive && myTurn && rolled && me.rollsRemaining > 0}
          lastRoll={lastRoll}
          animateRolls={animateRolls}
          flyingHeld={flight ? flight.heldDice : null}
          onToggle={toggleHold}
        />
        <RollBar
          rollsRemaining={me.rollsRemaining}
          canRoll={canRoll}
          showPlay={myTurn && rolled}
          canPlay={canPlay}
          onRoll={actions.roll}
          onPlay={() => {
            if (selected) {
              actions.score(selected);
              setSelected(null);
            }
          }}
        />
      </div>

      <ScoreBadge opponent={calculateTotal(oppScores)} me={calculateTotal(meScores)} />

      {flight && <FlyingDice key={flight.id} move={flight} />}
      {tip && <RuleTip target={tip.target} rect={tip.rect} onClose={() => setTip(null)} />}

      {room.status === 'finished' && !busy && (
        <ResultModal
          room={room}
          meId={me.id}
          waitingForRestart={waitingForRestart}
          onLeave={actions.leave}
          onPlayAgain={actions.restart}
        />
      )}
      {menu && !opponentWantsRestart && menuDialog}
      {opponentWantsRestart && (
        <ActionDialog
          title="RESTART?"
          detail={`${opponent.name} wants to start over.`}
          illustrated
          actions={[
            { label: 'Yes, Restart', variant: 'lime', onClick: actions.restart },
            { label: 'No', variant: 'cream', onClick: actions.declineRestart },
          ]}
        />
      )}
    </>
  );
}
