import { placeBlockReason, type PlaceBlockReason } from '../model/piece';
import type { HandPieceView, PieceId, PlayerId, PlayerView, Slot } from '../model/types';
import type { ErrorCode } from './errors';
import { bidBlockReason, minNextBid } from './rules/bid';
import { buyBlockReason } from './rules/buy';
import { endTurnBlockReason } from './rules/pass';
import { minPayout, payoutFor, sellBlockReason } from './rules/sell';
import type { TurnFacts } from './rules/turn';

/*
 * Selectors over a PlayerView. They build the same "facts" the engine builds from full state and
 * call the very same validators, so the UI can never offer an action the engine would reject.
 */

const turnFactsOf = (v: PlayerView, playerId: PlayerId): TurnFacts => ({
  ended: v.phase !== 'playing',
  isTurn: v.turn.playerId === playerId,
  auctionOpen: v.auction !== null,
});

const publicPlayer = (v: PlayerView, id: PlayerId) => v.players.find((p) => p.id === id);

export interface AvailableActions {
  buy: ErrorCode | null;
  sell: ErrorCode | null;
  endTurn: ErrorCode | null;
}

export function availableActions(v: PlayerView, playerId: PlayerId): AvailableActions {
  const tf = turnFactsOf(v, playerId);
  const me = publicPlayer(v, playerId);
  return {
    buy: buyBlockReason({
      ...tf,
      bought: v.turn.bought,
      coins: me?.coins ?? 0,
      price: v.config.buyPrice,
      poolCount: v.bank.poolCount,
    }),
    sell: sellBlockReason({
      ...tf,
      sold: v.turn.sold,
      // Only the viewer acts on Sell, and they always see their own hand size.
      handCount: v.me?.id === playerId ? v.me.hand.length : (me?.handCount ?? 0),
      bankCoins: v.bank.coins,
      minPayout: minPayout(v.config),
    }),
    endTurn: endTurnBlockReason(tf),
  };
}

/** Why the viewer can't sell this particular piece (null = can). */
export function sellPieceBlockReason(v: PlayerView, piece: HandPieceView): ErrorCode | null {
  if (!v.me) return 'UNKNOWN_PLAYER';
  return sellBlockReason({
    ...turnFactsOf(v, v.me.id),
    sold: v.turn.sold,
    handCount: v.me.hand.length,
    bankCoins: v.bank.coins,
    minPayout: minPayout(v.config),
    piece: { inHand: v.me.hand.some((h) => h.id === piece.id), fixed: false, payout: payoutFor(piece.pieceClass, v.config) },
  });
}

export const sellPayout = (v: PlayerView, piece: HandPieceView) => payoutFor(piece.pieceClass, v.config);

export interface BidOptions {
  blocked: ErrorCode | null;
  minBid: number;
  maxBid: number;
}

const bidFactsOf = (v: PlayerView, playerId: PlayerId, now: number) => ({
  ended: v.phase !== 'playing',
  auctionOpen: v.auction !== null && now < v.auction.endsAt,
  isSeller: v.auction?.sellerId === playerId,
  coins: publicPlayer(v, playerId)?.coins ?? 0,
  minNext: v.auction ? minNextBid(v.auction, v.config) : v.config.minBid,
});

export function bidOptions(v: PlayerView, playerId: PlayerId, now: number): BidOptions {
  const facts = bidFactsOf(v, playerId, now);
  return { blocked: bidBlockReason(facts), minBid: facts.minNext, maxBid: facts.coins };
}

export const bidBlockReasonFor = (v: PlayerView, playerId: PlayerId, amount: number, now: number) =>
  bidBlockReason({ ...bidFactsOf(v, playerId, now), amount });

/** The snap check used by drag-and-drop and keyboard placement. */
export function placementBlockReason(v: PlayerView, pieceId: PieceId, slot: Slot): PlaceBlockReason | 'NOT_IN_HAND' | null {
  const piece = v.me?.hand.find((h) => h.id === pieceId);
  if (!v.me || !piece) return 'NOT_IN_HAND';
  return placeBlockReason({
    ownerDesignId: v.me.designId,
    piece: piece.ref,
    rotation: piece.rotation,
    slot,
    fixed: v.me.fixed,
  });
}

export const playerName = (v: PlayerView, id: PlayerId | null | undefined) =>
  (id && publicPlayer(v, id)?.name) || 'Someone';
