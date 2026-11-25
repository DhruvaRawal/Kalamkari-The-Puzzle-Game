/**
 * Player avatars are generated pictures (no image files). Avatar `n` is motif `n % AVATAR_MOTIFS` in
 * colourway `floor(n / AVATAR_MOTIFS)`; the client draws them. The engine only picks the indices, so
 * every screen shows the same avatar for the same player. Players at one table never share a motif.
 */
export const AVATAR_MOTIFS = 8;
export const AVATAR_COLOURWAYS = 3;
export const AVATAR_COUNT = AVATAR_MOTIFS * AVATAR_COLOURWAYS;
