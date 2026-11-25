import { AVATAR_COLOURWAYS, AVATAR_MOTIFS } from '../config/avatars';
import { designIds as manifestDesignIds } from '../config/designs.manifest';
import { resolveConfig, type GameConfig } from '../config/gameConfig';
import { allPieces } from '../model/design';
import { getLayout } from '../model/jigsaw';
import type { GameState, PlayerId, PlayerState, Rotation } from '../model/types';
import { gameError, type GameError } from './errors';
import { createRng, nextInt, shuffle } from './rng';
import { startTurn } from './rules/turn';
import { appendLog } from './util';

export interface CreateGameOptions {
  /** In seat order; turns go clockwise through this list. */
  players: { id: PlayerId; name: string }[];
  seed: number;
  now: number;
  config?: Partial<GameConfig>;
  /** Designs to choose from (one per player is put in play). Defaults to the manifest. */
  designIds?: string[];
}

export type CreateGameResult = { ok: true; state: GameState } | { ok: false; error: GameError & { detail: string } };

const fail = (detail: string): CreateGameResult => ({ ok: false, error: { ...gameError('INVALID_SETUP'), detail } });

export function createGame(opts: CreateGameOptions): CreateGameResult {
  const config = resolveConfig(opts.config);
  const available = opts.designIds ?? manifestDesignIds();
  const n = opts.players.length;
  const { rows, cols } = config.grid;

  if (n < config.minPlayers || n > config.maxPlayers) {
    return fail(`Need ${config.minPlayers}-${config.maxPlayers} players, got ${n}.`);
  }
  if (new Set(opts.players.map((p) => p.id)).size !== n) return fail('Player ids must be unique.');
  if (available.length < n) return fail(`Need at least ${n} designs, have ${available.length}.`);

  let rng = createRng(opts.seed);
  // Only the players' own designs are in play: one random design per player.
  let designs: string[];
  [designs, rng] = shuffle(available, rng);
  const designIds = designs.slice(0, n);
  const pieces = allPieces(designIds, rows, cols);
  if (pieces.length < n * config.handSize) return fail('Not enough pieces to deal.');
  let deck: string[];
  [deck, rng] = shuffle(pieces, rng);

  // Avatars use their own stream so they never change the deal or anything else in the game.
  // A distinct motif per player, each in a random colourway.
  let avatarRng = createRng(opts.seed ^ 0x5eeda7a7);
  let motifs: number[];
  [motifs, avatarRng] = shuffle(
    Array.from({ length: AVATAR_MOTIFS }, (_, i) => i),
    avatarRng,
  );
  const avatars = opts.players.map((_, i) => {
    let colourway: number;
    [colourway, avatarRng] = nextInt(avatarRng, AVATAR_COLOURWAYS);
    return motifs[i % AVATAR_MOTIFS] + colourway * AVATAR_MOTIFS;
  });

  const rotations: Record<string, Rotation> = {};
  const players: PlayerState[] = opts.players.map((p, i) => {
    const hand = deck.slice(i * config.handSize, (i + 1) * config.handSize);
    for (const id of hand) {
      let r = 0;
      if (config.randomInitialRotation) [r, rng] = nextInt(rng, 4);
      rotations[id] = r as Rotation;
    }
    return {
      id: p.id,
      name: p.name.trim().slice(0, 24) || `Player ${i + 1}`,
      designId: designs[i],
      coins: config.startingCoins,
      hand,
      fixed: [],
      connected: true,
      avatar: avatars[i],
    };
  });

  let first: number;
  [first, rng] = nextInt(rng, n);

  let state: GameState = {
    config,
    layout: getLayout(rows, cols),
    designIds,
    rng,
    phase: 'playing',
    players,
    bank: { coins: config.bankStartingCoins, pool: deck.slice(n * config.handSize) },
    rotations,
    turn: { playerId: players[first].id, number: 0, bought: false, sold: false, deadline: null },
    auction: null,
    nextAuctionId: 1,
    emptyPoolPasses: 0,
    result: null,
    log: [],
    version: 0,
  };
  state = appendLog(state, { kind: 'start', at: opts.now, playerId: players[first].id });
  state = startTurn(state, players[first].id, opts.now);
  return { ok: true, state };
}
