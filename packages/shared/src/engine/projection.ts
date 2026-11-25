import { parsePieceId } from '../model/piece';
import type { GameState, PlayerId, PlayerView } from '../model/types';
import { pieceClassOf } from './rules/sell';

/**
 * The only shape of game state that may leave a host. Hides other players' designs, hands and
 * fixed pieces, the pool contents, the face-down auction piece and the RNG.
 * viewerId null = spectator (sees only public information).
 */
export function projectStateFor(state: GameState, viewerId: PlayerId | null): PlayerView {
  const viewer = state.players.find((p) => p.id === viewerId) ?? null;
  const ended = state.phase === 'ended';
  const { auction } = state;

  return {
    version: state.version,
    viewerId: viewer?.id ?? null,
    config: state.config,
    layout: state.layout,
    phase: state.phase,
    me: viewer && {
      id: viewer.id,
      designId: viewer.designId,
      hand: viewer.hand.map((id) => ({
        id,
        ref: parsePieceId(id),
        rotation: state.rotations[id] ?? 0,
        pieceClass: pieceClassOf(id, state.config),
      })),
      fixed: viewer.fixed.map(parsePieceId),
    },
    players: state.players.map((p) => {
      const open = p.id === viewer?.id || ended || state.config.showFixedCounts;
      return {
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        coins: p.coins,
        pieceCount: p.hand.length + p.fixed.length,
        handCount: open ? p.hand.length : null,
        fixedCount: open ? p.fixed.length : null,
        connected: p.connected,
      };
    }),
    bank: { coins: state.bank.coins, poolCount: state.bank.pool.length },
    turn: { ...state.turn },
    auction: auction && {
      id: auction.id,
      sellerId: auction.sellerId,
      pieceClass: auction.pieceClass,
      payout: auction.payout,
      highBid: auction.highBid && { playerId: auction.highBid.playerId, amount: auction.highBid.amount },
      bidCount: auction.bidCount,
      startedAt: auction.startedAt,
      endsAt: auction.endsAt,
    },
    result: state.result,
    // "X fixed a piece" entries would reveal fixed counts; only show them when counts are public.
    log: state.config.showFixedCounts
      ? state.log
      : state.log.filter((e) => e.kind !== 'fixed' || e.playerId === viewer?.id),
  };
}
