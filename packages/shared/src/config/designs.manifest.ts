/**
 * The designs players can be given. Each game uses only the designs assigned to its players
 * (2 players → 2 designs → 32 pieces), picked at random, so this list must have >= maxPlayers entries.
 *
 * To swap in a real image: change `image`. Set it to null to use the generated placeholder.
 * To add a design: add one line here and drop the image into packages/client/public/assets/designs/.
 */
export interface DesignManifestEntry {
  id: string;
  name: string;
  /** Path served by the client, or null to always use the placeholder. */
  image: string | null;
  /** Colours for the generated placeholder (also used as the design's accent). */
  palette: [string, string, string];
}

export const designsManifest: DesignManifestEntry[] = [
  { id: 'elephant', name: 'Gaja — Elephant', image: '/assets/designs/design-1.jpg', palette: ['#1f3a5f', '#8b2e1f', '#e9d8b4'] },
  { id: 'castle', name: 'Qila — Castle', image: '/assets/designs/design-2.jpg', palette: ['#5a2a1c', '#d9a441', '#f1e4c7'] },
  { id: 'lotus', name: 'Kamal — Lotus', image: '/assets/designs/design-3.jpg', palette: ['#b5651d', '#c8553d', '#f4d58d'] },
  { id: 'mountain', name: 'Parvat — Mountain', image: '/assets/designs/design-4.jpg', palette: ['#2f4f3a', '#6b8e6b', '#e6dcc2'] },
];

export const designIds = (): string[] => designsManifest.map((d) => d.id);

export function getDesign(id: string): DesignManifestEntry | undefined {
  return designsManifest.find((d) => d.id === id);
}
