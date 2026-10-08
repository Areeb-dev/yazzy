import { MAX_ROLLS } from '../../game/types';
import type { PublicPlayer, RoomView } from '../../game/types/protocol';
import { upperBonus, upperSubtotal } from '../../game/scoring';
import { emptyDice, noneHeld } from '../../game/utils';
import type { Room } from './types';

/**
 * Builds the payload clients may see. Tokens and socket ids never leave the server, and a
 * player's dice are only revealed while it is their turn.
 */
export function toRoomView(room: Room): RoomView {
  const playing = room.status === 'playing';
  const players: PublicPlayer[] = room.players.map((rp) => {
    const gp = room.gameState?.players.find((p) => p.id === rp.id);
    const reveal = playing && gp !== undefined && room.currentPlayerId === rp.id;
    const scores = gp?.scores ?? {};
    return {
      id: rp.id,
      name: rp.name,
      isBot: rp.isBot,
      color: rp.color,
      connected: rp.connected,
      dice: reveal ? [...gp.dice] : emptyDice(),
      heldDice: reveal ? [...gp.heldDice] : noneHeld(),
      rollsRemaining: reveal ? gp.rollsRemaining : MAX_ROLLS,
      scores: { ...scores },
      upperSubtotal: upperSubtotal(scores),
      upperBonus: upperBonus(scores),
      totalScore: gp?.totalScore ?? 0,
    };
  });
  return {
    roomCode: room.roomCode,
    mode: room.mode,
    status: room.status,
    players,
    currentPlayerId: playing ? room.currentPlayerId : null,
    createdAt: room.createdAt,
    winnerIds: room.gameState?.winnerIds ?? [],
    endReason: room.gameState?.endReason ?? null,
    restartVotes: [...room.restartVotes],
  };
}
