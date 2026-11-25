import type { GameConfig } from '../../config/gameConfig';
import { parsePieceId, pieceClassAt } from '../../model/piece';
import type { GameState, PieceClass, PieceId, PlayerId } from '../../model/types';
import { gameError, type ErrorCode, type GameError } from '../errors';
import { appendLog, findPlayer, takeFromHand, updatePlayer } from '../util';
import { pauseTurn, turnBlockReason, turnFacts, type TurnFacts } from './turn';

export interface SellFacts extends TurnFacts {
  sold: boolean;
  /** Unfixed pieces held. */
  handCount: number;
  bankCoins: number;
  /** Cheapest possible payout; used before a piece is chosen. */
  minPayout: number;
  /** Present once a piece is chosen. */
  piece?: { inHand: boolean; fixed: boolean; payout: number };
}

export function sellBlockReason(f: SellFacts): ErrorCode | null {
  const general =
    turnBlockReason(f) ??
    (f.sold ? 'ALREADY_SOLD' : null) ??
    (f.handCount === 0 ? 'NO_PIECES_TO_SELL' : null) ??
    (f.bankCoins < f.minPayout ? 'BANK_INSUFFICIENT_COINS' : null);
  if (general || !f.piece) return general;
  if (f.piece.fixed) return 'PIECE_FIXED';
  if (!f.piece.inHand) return 'NOT_IN_HAND';
  if (f.bankCoins < f.piece.payout) return 'BANK_INSUFFICIENT_COINS';
  return null;
}

export function pieceClassOf(pieceId: PieceId, config: GameConfig): PieceClass {
  const { row, col } = parsePieceId(pieceId);
  return pieceClassAt(row, col, config.grid.rows, config.grid.cols);
}

export const payoutFor = (pieceClass: PieceClass, config: GameConfig) => config.sellPayout[pieceClass];
export const minPayout = (config: GameConfig) => Math.min(...Object.values(config.sellPayout));

export function applySell(state: GameState, playerId: PlayerId, pieceId: PieceId, now: number): GameState | GameError {
  const player = findPlayer(state, playerId);
  if (!player) return gameError('UNKNOWN_PLAYER');
  const inHand = player.hand.includes(pieceId);
  const fixed = player.fixed.includes(pieceId);
  // Only parse ids we know are real pieces; anything else is rejected as NOT_IN_HAND below.
  const pieceClass = inHand || fixed ? pieceClassOf(pieceId, state.config) : 'corner';
  const payout = payoutFor(pieceClass, state.config);
  const blocked = sellBlockReason({
    ...turnFacts(state, playerId),
    sold: state.turn.sold,
    handCount: player.hand.length,
    bankCoins: state.bank.coins,
    minPayout: minPayout(state.config),
    piece: { inHand, fixed, payout },
  });
  if (blocked) return gameError(blocked);

  let s = takeFromHand(state, playerId, pieceId);
  s = updatePlayer(s, playerId, (p) => ({ ...p, coins: p.coins + payout }));
  s = {
    ...s,
    bank: { ...s.bank, coins: s.bank.coins - payout },
    turn: pauseTurn({ ...s.turn, sold: true }, now), // turn clock pauses during the auction
    auction: {
      id: s.nextAuctionId,
      pieceId,
      sellerId: playerId,
      pieceClass,
      payout,
      highBid: null,
      bidCount: 0,
      startedAt: now,
      endsAt: now + s.config.auctionDurationMs,
    },
    nextAuctionId: s.nextAuctionId + 1,
  };
  return appendLog(s, { kind: 'sell', at: now, playerId, pieceClass, payout });
}
