import type { GameConfig } from '../../config/gameConfig';
import type { AuctionView, GameState, PlayerId } from '../../model/types';
import { gameError, type ErrorCode, type GameError } from '../errors';
import { appendLog, findPlayer, giveToHand, updatePlayer } from '../util';
import { finishTurn, resumeTurn } from './turn';

export interface BidFacts {
  ended: boolean;
  auctionOpen: boolean;
  isSeller: boolean;
  coins: number;
  minNext: number;
  /** Omit to ask "can this player bid at all?". */
  amount?: number;
}

export function bidBlockReason(f: BidFacts): ErrorCode | null {
  if (f.ended) return 'GAME_ENDED';
  if (!f.auctionOpen) return 'NO_AUCTION';
  if (f.isSeller) return 'SELLER_CANNOT_BID';
  if (f.coins < f.minNext) return 'INSUFFICIENT_COINS';
  if (f.amount === undefined) return null;
  if (f.amount < f.minNext) return 'BID_TOO_LOW';
  if (f.amount > f.coins) return 'BID_EXCEEDS_COINS';
  return null;
}

/** Lowest legal next bid. Bids strictly increase, so a tie can never displace the earlier bid. */
export const minNextBid = (auction: Pick<AuctionView, 'highBid'>, config: GameConfig): number =>
  auction.highBid ? auction.highBid.amount + config.bidStep : config.minBid;

export function applyBid(state: GameState, playerId: PlayerId, amount: number, now: number): GameState | GameError {
  const player = findPlayer(state, playerId);
  if (!player) return gameError('UNKNOWN_PLAYER');
  const { auction } = state;
  const blocked = bidBlockReason({
    ended: state.phase !== 'playing',
    auctionOpen: auction !== null && now < auction.endsAt,
    isSeller: auction?.sellerId === playerId,
    coins: player.coins,
    minNext: auction ? minNextBid(auction, state.config) : state.config.minBid,
    amount,
  });
  if (blocked || !auction) return gameError(blocked ?? 'NO_AUCTION');

  const s: GameState = {
    ...state,
    auction: {
      ...auction,
      highBid: { playerId, amount, at: now },
      bidCount: auction.bidCount + 1,
      endsAt: Math.max(auction.endsAt, now + state.config.bidResetMs),
    },
  };
  return appendLog(s, { kind: 'bid', at: now, playerId, amount });
}

/** Settles the open auction. The turn then returns to the seller, or moves on if they already bought. */
export function closeAuction(state: GameState, now: number): GameState {
  const { auction } = state;
  if (!auction) return state;
  let s: GameState = { ...state, auction: null };
  const bid = auction.highBid;
  const winner = bid && findPlayer(s, bid.playerId);
  if (bid && winner && winner.coins >= bid.amount) {
    s = updatePlayer(s, bid.playerId, (p) => ({ ...p, coins: p.coins - bid.amount }));
    s = { ...s, bank: { ...s.bank, coins: s.bank.coins + bid.amount } };
    s = giveToHand(s, bid.playerId, auction.pieceId);
    s = appendLog(s, { kind: 'auctionWon', at: now, playerId: bid.playerId, amount: bid.amount });
  } else {
    s = { ...s, bank: { ...s.bank, pool: [...s.bank.pool, auction.pieceId] } };
    s = appendLog(s, { kind: 'auctionUnsold', at: now });
  }
  return s.turn.bought ? finishTurn(s, now) : resumeTurn(s, now);
}
