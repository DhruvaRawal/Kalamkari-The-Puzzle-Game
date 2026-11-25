import type { GameConfig } from '../config/gameConfig';

export type EdgeType = 'flat' | 'tab' | 'socket';
/** Clockwise from the top: [top, right, bottom, left]. */
export type PieceEdges = readonly [EdgeType, EdgeType, EdgeType, EdgeType];
export type PieceClass = 'corner' | 'edge' | 'center';
/** Quarter turns clockwise. 0 = upright. */
export type Rotation = 0 | 1 | 2 | 3;

export type PlayerId = string;
export type DesignId = string;
/** `${designId}:${row}:${col}`. Encodes identity, so it is itself secret information. */
export type PieceId = string;

export interface PieceRef {
  designId: DesignId;
  row: number;
  col: number;
}

export interface Slot {
  row: number;
  col: number;
}

export interface JigsawLayout {
  rows: number;
  cols: number;
  /** cells[row][col] */
  cells: PieceEdges[][];
}

// ---------------------------------------------------------------------------------------------
// Authoritative state (lives only on the host)
// ---------------------------------------------------------------------------------------------

export interface PlayerState {
  id: PlayerId;
  name: string;
  designId: DesignId;
  coins: number;
  /** Unfixed pieces held. */
  hand: PieceId[];
  /** Pieces fixed into this player's own design. */
  fixed: PieceId[];
  connected: boolean;
  /** Generated avatar index, 0..AVATAR_COUNT-1. Public, cosmetic. */
  avatar: number;
}

export interface Bid {
  playerId: PlayerId;
  amount: number;
  at: number;
}

export interface AuctionState {
  id: number;
  pieceId: PieceId;
  sellerId: PlayerId;
  pieceClass: PieceClass;
  payout: number;
  highBid: Bid | null;
  bidCount: number;
  startedAt: number;
  endsAt: number;
}

export interface TurnState {
  playerId: PlayerId;
  number: number;
  bought: boolean;
  sold: boolean;
  /** Absolute time the turn auto-ends; null while an auction is open (clock paused). */
  deadline: number | null;
  /** The deadline before a disconnect shortened it; restored on reconnect. */
  restoreDeadline?: number | null;
}

export type LogEntry =
  | { kind: 'start'; at: number; playerId: PlayerId }
  | { kind: 'turn'; at: number; playerId: PlayerId }
  | { kind: 'buy'; at: number; playerId: PlayerId }
  | { kind: 'sell'; at: number; playerId: PlayerId; pieceClass: PieceClass; payout: number }
  | { kind: 'bid'; at: number; playerId: PlayerId; amount: number }
  | { kind: 'auctionWon'; at: number; playerId: PlayerId; amount: number }
  | { kind: 'auctionUnsold'; at: number }
  | { kind: 'pass'; at: number; playerId: PlayerId; timedOut: boolean }
  | { kind: 'fixed'; at: number; playerId: PlayerId }
  | { kind: 'connection'; at: number; playerId: PlayerId; connected: boolean }
  | { kind: 'end'; at: number; reason: GameResult['reason']; winners: PlayerId[] };

export interface Standing {
  playerId: PlayerId;
  fixedCount: number;
  coins: number;
}

export interface GameResult {
  reason: 'completed' | 'stalemate';
  winners: PlayerId[];
  standings: Standing[];
}

export interface GameState {
  config: GameConfig;
  layout: JigsawLayout;
  designIds: DesignId[];
  rng: number;
  phase: 'playing' | 'ended';
  /** Seat order; turns go clockwise = increasing index. */
  players: PlayerState[];
  bank: { coins: number; pool: PieceId[] };
  /** Rotation of every piece currently in some hand. */
  rotations: Record<PieceId, Rotation>;
  turn: TurnState;
  auction: AuctionState | null;
  nextAuctionId: number;
  /** Consecutive passes made while the pool was empty (stalemate detection). */
  emptyPoolPasses: number;
  result: GameResult | null;
  log: LogEntry[];
  version: number;
}

// ---------------------------------------------------------------------------------------------
// Projected state (what a single viewer may know)
// ---------------------------------------------------------------------------------------------

export interface HandPieceView {
  id: PieceId;
  ref: PieceRef;
  rotation: Rotation;
  pieceClass: PieceClass;
}

export interface MeView {
  id: PlayerId;
  designId: DesignId;
  hand: HandPieceView[];
  fixed: PieceRef[];
}

export interface PlayerPublicView {
  id: PlayerId;
  name: string;
  avatar: number;
  coins: number;
  /** Every piece this player owns (held + fixed). Always public. */
  pieceCount: number;
  /**
   * Unfixed pieces held. Hidden (null) together with fixedCount, because
   * pieceCount - handCount would reveal the fixed count.
   */
  handCount: number | null;
  /** null when hidden by settings (always shown for yourself and in final standings). */
  fixedCount: number | null;
  connected: boolean;
}

export interface AuctionView {
  id: number;
  sellerId: PlayerId;
  pieceClass: PieceClass;
  payout: number;
  highBid: { playerId: PlayerId; amount: number } | null;
  bidCount: number;
  startedAt: number;
  endsAt: number;
}

export interface PlayerView {
  version: number;
  viewerId: PlayerId | null;
  config: GameConfig;
  layout: JigsawLayout;
  phase: GameState['phase'];
  me: MeView | null;
  players: PlayerPublicView[];
  bank: { coins: number; poolCount: number };
  turn: TurnState;
  auction: AuctionView | null;
  result: GameResult | null;
  log: LogEntry[];
}
