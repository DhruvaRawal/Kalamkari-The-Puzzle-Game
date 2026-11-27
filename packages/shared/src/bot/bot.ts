import { pieceClassAt } from '../model/piece';
import type { HandPieceView, PieceClass, PlayerView } from '../model/types';
import type { PlayerAction } from '../protocol/actions';
import { payoutFor } from '../engine/rules/sell';
import { availableActions, bidOptions, sellPieceBlockReason } from '../engine/selectors';

/*
 * Computer players. A bot decides from its own PlayerView only, exactly what a human in its seat
 * would see, so it can't peek at hidden designs, hands or the face-down auction piece.
 */

export type BotLevel = 'easy' | 'medium' | 'hard';
export const BOT_LEVELS: readonly BotLevel[] = ['easy', 'medium', 'hard'];
export const BOT_LEVEL_LABEL: Record<BotLevel, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
export const isBotLevel = (x: unknown): x is BotLevel => typeof x === 'string' && (BOT_LEVELS as readonly string[]).includes(x);

export const BOT_NAMES = [
  'Meera', 'Arjun', 'Kavya', 'Ravi', 'Lakshmi', 'Vikram', 'Anaya', 'Dev', 'Isha', 'Kabir',
  'Nila', 'Rohan', 'Sita', 'Tara', 'Uma', 'Yash', 'Zoya', 'Aditi', 'Bhanu', 'Chitra',
] as const;
export const BOT_NAME_PREFIX = 'BOT ';

interface Profile {
  /** Pause before acting, so people can follow what the bot does. [min, max] ms. */
  thinkMs: [number, number];
  /** Chance, per step, that it notices a piece it can fix. */
  placeChance: number;
  /** Chance, per turn, that it buys. */
  buyChance: number;
  /** Chance, per turn, that it sells. */
  sellChance: number;
  /** Only sell while it has fewer coins than this (or the pool is empty): every spare it sells is a piece someone else needs. */
  sellBelowCoins: number;
  /** Chance, per turn, that it sells anyway once the pool is empty (keeps the game moving). */
  emptyPoolSellChance: number;
  /** Chance that a sale is a random piece instead of a spare one (a mistake). */
  sellMistake: number;
  /** Coins a piece it surely needs is worth to it; the bid cap is this × the chance the lot is useful. */
  pieceWorth: number;
  /** Ignore what it knows and bid on a hunch. */
  bidsBlind: boolean;
  /** Assume sellers sell pieces that aren't theirs (see chanceLotIsNeeded). */
  readSeller: boolean;
  /** Share of its own coins it adds to a needed piece's worth: coins only matter as a tie-break. */
  spendRich: number;
  /** Coins it keeps back for buying while the pool still has pieces. */
  reserve: number;
}

const PROFILES: Record<BotLevel, Profile> = {
  easy: { thinkMs: [2500, 4500], placeChance: 0.35, buyChance: 0.6, sellChance: 0.5, sellBelowCoins: Infinity, emptyPoolSellChance: 1, sellMistake: 0.3, pieceWorth: 3, bidsBlind: true, readSeller: false, spendRich: 0, reserve: 0 },
  medium: { thinkMs: [1500, 3000], placeChance: 0.75, buyChance: 0.85, sellChance: 0.8, sellBelowCoins: 8, emptyPoolSellChance: 0.8, sellMistake: 0, pieceWorth: 4, bidsBlind: false, readSeller: false, spendRich: 0.25, reserve: 0 },
  hard: { thinkMs: [800, 1600], placeChance: 1, buyChance: 1, sellChance: 1, sellBelowCoins: 4, emptyPoolSellChance: 0.5, sellMistake: 0, pieceWorth: 6, bidsBlind: false, readSeller: true, spendRich: 0.6, reserve: 1 },
};

/** How long a bot waits before its next move. */
export function botThinkMs(level: BotLevel, random: () => number = Math.random): number {
  const [lo, hi] = PROFILES[level].thinkMs;
  return Math.round(lo + (hi - lo) * random());
}

/** A stable 0..1 roll for one decision, so "does it buy this turn?" doesn't change between steps. */
function roll(...parts: (string | number)[]): number {
  let h = 2166136261;
  for (const ch of parts.join('|')) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * Chance the face-down lot is a piece this bot still needs, from what it can see.
 * `readSeller`: assume the seller is getting rid of a piece that isn't theirs (a sensible seller
 * would), which rules out the seller's own design. In a 2-player game that makes every spare
 * the seller sells a piece of this bot's design.
 */
export function chanceLotIsNeeded(view: PlayerView, pieceClass: PieceClass, readSeller = false): number {
  const me = view.me;
  if (!me) return 0;
  const { rows, cols } = view.layout;
  let perDesign = 0;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (pieceClassAt(r, c, rows, cols) === pieceClass) perDesign++;
  const ofClass = (refs: { row: number; col: number }[]) => refs.filter((x) => pieceClassAt(x.row, x.col, rows, cols) === pieceClass).length;
  const fixed = ofClass(me.fixed);
  const mineInHand = ofClass(me.hand.filter((h) => h.ref.designId === me.designId).map((h) => h.ref));
  const othersInHand = ofClass(me.hand.filter((h) => h.ref.designId !== me.designId).map((h) => h.ref));
  const missing = perDesign - fixed - mineInHand;
  const designs = view.players.length;
  // Pieces of this class it can't account for, among the designs the lot could come from.
  const unknown = readSeller
    ? perDesign * (designs - 1) - fixed - mineInHand - (othersInHand * (designs - 2)) / Math.max(1, designs - 1)
    : perDesign * designs - fixed - mineInHand - othersInHand;
  return unknown > 0 ? Math.min(1, Math.max(0, missing) / unknown) : 0;
}

const isMine = (view: PlayerView, h: HandPieceView) => h.ref.designId === view.me?.designId;

/**
 * True when the only piece in the pool is the one this bot just sold and nobody bid on. Buying it
 * back would loop forever: sell, no bids, buy back, every turn.
 */
function onlyOwnLotInPool(view: PlayerView): boolean {
  if (!view.turn.sold || view.bank.poolCount !== 1) return false;
  for (let i = view.log.length - 1; i >= 0; i--) {
    const kind = view.log[i].kind;
    if (kind === 'auctionUnsold') return true;
    if (kind === 'auctionWon' || kind === 'buy' || kind === 'turn') return false;
  }
  return false;
}

/**
 * The bot's next move, or null to wait. Call it again after each move (and after a pause): it
 * returns one step at a time, e.g. rotate a piece, then place it.
 */
export function chooseBotAction(view: PlayerView, now: number, level: BotLevel, random: () => number = Math.random): PlayerAction | null {
  const me = view.me;
  if (!me || view.phase !== 'playing') return null;
  const p = PROFILES[level];

  // 1. Bid on someone else's lot.
  const auction = view.auction;
  if (auction) {
    const bid = chooseBid(view, now, p);
    if (bid) return bid;
  } else if (view.turn.playerId === me.id) {
    // 2. Its own turn first, so nobody waits on it: buy, sell a spare, end the turn.
    const move = chooseTurnMove(view, level, p);
    if (move) return move;
  }

  // 3. Then fix pieces of its own design (allowed any time, even off-turn).
  const fixable = me.hand.find((h) => isMine(view, h) && !me.fixed.some((f) => f.row === h.ref.row && f.col === h.ref.col));
  if (fixable && random() < p.placeChance) {
    if (fixable.rotation !== 0) return { type: 'ROTATE', pieceId: fixable.id, rotation: 0 };
    return { type: 'PLACE', pieceId: fixable.id, row: fixable.ref.row, col: fixable.ref.col };
  }
  return null;
}

function chooseBid(view: PlayerView, now: number, p: Profile): PlayerAction | null {
  const me = view.me!;
  const auction = view.auction!;
  if (auction.sellerId === me.id || auction.highBid?.playerId === me.id) return null;
  const opts = bidOptions(view, me.id, now);
  if (opts.blocked) return null;
  const keep = view.bank.poolCount > 0 ? p.reserve : 0;
  const chance = p.bidsBlind ? roll(me.id, 'lot', auction.id) : chanceLotIsNeeded(view, auction.pieceClass, p.readSeller);
  const worth = p.pieceWorth + p.spendRich * opts.maxBid;
  const cap = Math.min(opts.maxBid - keep, Math.floor(chance * worth + 0.25));
  return opts.minBid <= cap ? { type: 'BID', amount: opts.minBid } : null;
}

function chooseTurnMove(view: PlayerView, level: BotLevel, p: Profile): PlayerAction | null {
  const me = view.me!;
  const acts = availableActions(view, me.id);
  const turnKey = [me.id, view.turn.number];
  const missing = view.layout.rows * view.layout.cols - me.fixed.length - me.hand.filter((h) => isMine(view, h)).length;

  if (!acts.buy && missing > 0 && !onlyOwnLotInPool(view) && roll(...turnKey, 'buy') < p.buyChance) return { type: 'BUY' };

  const myCoins = view.players.find((x) => x.id === me.id)?.coins ?? 0;
  if (!acts.sell && (myCoins < p.sellBelowCoins || (view.bank.poolCount === 0 && roll(...turnKey, 'flow') < p.emptyPoolSellChance)) && roll(...turnKey, 'sell') < p.sellChance) {
    const sellable = me.hand.filter((h) => !sellPieceBlockReason(view, h));
    const spare = sellable.filter((h) => !isMine(view, h));
    const pool = roll(...turnKey, 'oops') < p.sellMistake ? sellable : spare;
    if (pool.length) {
      // Hard bots sell a spare that pays most; the others pick any.
      const best = Math.max(...pool.map((h) => payoutFor(h.pieceClass, view.config)));
      const choices = level === 'hard' ? pool.filter((h) => payoutFor(h.pieceClass, view.config) === best) : pool;
      const pick = choices[Math.floor(roll(...turnKey, 'pick') * choices.length)];
      return { type: 'SELL', pieceId: pick.id };
    }
  }

  return acts.endTurn ? null : { type: 'END_TURN' };
}
