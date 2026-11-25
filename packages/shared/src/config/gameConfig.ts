import type { PieceClass } from '../model/types';

/**
 * Every tunable number in the game. Rules and UI read from the resolved config stored in
 * GameState.config; nothing else should contain these literals.
 */
export interface GameConfig {
  minPlayers: number;
  maxPlayers: number;
  grid: { rows: number; cols: number };
  /** Coins each player starts with. */
  startingCoins: number;
  /** Coins the Auction House starts with (total = players × startingCoins + this). */
  bankStartingCoins: number;
  /** Pieces dealt to each player at setup. */
  handSize: number;
  /** Coins paid to the Auction House for one random piece. */
  buyPrice: number;
  /** Coins the Auction House pays a seller, by the piece's class in its own design. */
  sellPayout: Record<PieceClass, number>;
  minBid: number;
  bidStep: number;
  auctionDurationMs: number;
  /** After a bid, at least this much time remains on the auction clock. */
  bidResetMs: number;
  turnTimeoutMs: number;
  /** Turn timeout used while the active player is disconnected. */
  disconnectedTurnTimeoutMs: number;
  /** Deal, sell-back and buy pieces at a random 0/90/180/270° rotation. */
  randomInitialRotation: boolean;
  /** When on, opponents see how many pieces you have fixed (never which). */
  showFixedCounts: boolean;
  /** Max public log entries kept in state. */
  logLimit: number;
}

export const defaultGameConfig: GameConfig = {
  minPlayers: 2,
  maxPlayers: 4,
  grid: { rows: 4, cols: 4 },
  startingCoins: 10,
  bankStartingCoins: 10,
  handSize: 10,
  buyPrice: 1,
  sellPayout: { corner: 1, edge: 2, center: 2 },
  minBid: 1,
  bidStep: 1,
  auctionDurationMs: 15_000,
  bidResetMs: 5_000,
  turnTimeoutMs: 90_000,
  disconnectedTurnTimeoutMs: 15_000,
  randomInitialRotation: true,
  showFixedCounts: false,
  logLimit: 50,
};

/** Settings a lobby host may change from the UI. Everything else stays at defaults. */
export type GameSettings = Partial<
  Pick<GameConfig, 'showFixedCounts' | 'turnTimeoutMs' | 'auctionDurationMs' | 'randomInitialRotation'>
>;

export const SETTING_KEYS = [
  'showFixedCounts',
  'turnTimeoutMs',
  'auctionDurationMs',
  'randomInitialRotation',
] as const satisfies readonly (keyof GameSettings)[];

export function resolveConfig(overrides: Partial<GameConfig> = {}): GameConfig {
  return {
    ...defaultGameConfig,
    ...overrides,
    grid: { ...defaultGameConfig.grid, ...overrides.grid },
    sellPayout: { ...defaultGameConfig.sellPayout, ...overrides.sellPayout },
  };
}

/** Keeps only known settings with sane types (used on untrusted lobby input). */
export function sanitizeSettings(input: unknown): GameSettings {
  const out: GameSettings = {};
  if (!input || typeof input !== 'object') return out;
  const src = input as Record<string, unknown>;
  if (typeof src.showFixedCounts === 'boolean') out.showFixedCounts = src.showFixedCounts;
  if (typeof src.randomInitialRotation === 'boolean') out.randomInitialRotation = src.randomInitialRotation;
  const ms = (v: unknown, min: number, max: number) =>
    typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : undefined;
  const turn = ms(src.turnTimeoutMs, 10_000, 600_000);
  if (turn !== undefined) out.turnTimeoutMs = turn;
  const auction = ms(src.auctionDurationMs, 5_000, 120_000);
  if (auction !== undefined) out.auctionDurationMs = auction;
  return out;
}
