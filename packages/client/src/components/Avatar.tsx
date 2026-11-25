import { AVATAR_COUNT } from '@kalamkari/shared';
import type { JSX } from 'preact';

/** Background, motif colour, accent. Drawn from the Kalamkari palette. */
const COLOURWAYS: [string, string, string][] = [
  ['#8b2e1f', '#f4ead5', '#d9a441'], // madder
  ['#1f3a5f', '#f4ead5', '#d9a441'], // indigo
  ['#3f5f31', '#f4ead5', '#d9a441'], // leaf
];

type Motif = (fg: string, accent: string) => JSX.Element;

const petals = (n: number, rx: number, ry: number, dist: number, fill: string, offset = 0) =>
  Array.from({ length: n }, (_, i) => (
    <ellipse cx={50} cy={50 - dist} rx={rx} ry={ry} fill={fill} transform={`rotate(${(360 / n) * i + offset} 50 50)`} />
  ));

/** Eight hand-block-print style motifs. */
const MOTIFS: { name: string; draw: Motif }[] = [
  {
    name: 'Sun',
    draw: (fg, ac) => (
      <>
        {Array.from({ length: 12 }, (_, i) => (
          <path d="M50 14 L55 30 L45 30 Z" fill={i % 2 ? ac : fg} transform={`rotate(${i * 30} 50 50)`} />
        ))}
        <circle cx={50} cy={50} r={17} fill={ac} />
        <circle cx={50} cy={50} r={11} fill="none" stroke={fg} stroke-width={2.5} />
        <circle cx={50} cy={50} r={4} fill={fg} />
      </>
    ),
  },
  {
    name: 'Lotus',
    draw: (fg, ac) => (
      <>
        <path d="M50 26 C60 38 60 56 50 66 C40 56 40 38 50 26 Z" fill={fg} />
        <path d="M50 66 C40 62 28 50 26 36 C38 40 46 50 50 66 Z" fill={ac} />
        <path d="M50 66 C60 62 72 50 74 36 C62 40 54 50 50 66 Z" fill={ac} />
        <path d="M50 66 C38 68 26 62 20 52 C32 50 42 56 50 66 Z" fill={fg} />
        <path d="M50 66 C62 68 74 62 80 52 C68 50 58 56 50 66 Z" fill={fg} />
        <path d="M30 74 Q50 66 70 74" fill="none" stroke={ac} stroke-width={3} stroke-linecap="round" />
      </>
    ),
  },
  {
    name: 'Paisley',
    draw: (fg, ac) => (
      <>
        <path d="M44 76 C24 72 22 46 38 34 C50 25 66 26 70 16 C78 34 74 60 58 72 C54 75 49 77 44 76 Z" fill={fg} />
        <path d="M46 66 C34 62 34 46 44 40 C52 35 60 36 63 30 C66 42 64 56 55 63 C52 66 49 67 46 66 Z" fill={ac} />
        <circle cx={48} cy={53} r={5} fill={fg} />
      </>
    ),
  },
  {
    name: 'Fish',
    draw: (fg, ac) => (
      <>
        <path d="M18 50 C30 30 58 28 72 50 C58 72 30 70 18 50 Z" fill={fg} />
        <path d="M70 50 L86 36 L82 50 L86 64 Z" fill={ac} />
        <path d="M34 42 Q40 50 34 58 M44 40 Q50 50 44 60 M54 41 Q60 50 54 59" fill="none" stroke={ac} stroke-width={2.5} />
        <circle cx={27} cy={47} r={3} fill={ac} />
      </>
    ),
  },
  {
    name: 'Peacock feather',
    draw: (fg, ac) => (
      <>
        <path d="M50 88 L50 52" stroke={fg} stroke-width={3} />
        {Array.from({ length: 7 }, (_, i) => (
          <path d={`M50 ${84 - i * 5} L${36 - i} ${76 - i * 7}`} stroke={fg} stroke-width={1.6} />
        ))}
        {Array.from({ length: 7 }, (_, i) => (
          <path d={`M50 ${84 - i * 5} L${64 + i} ${76 - i * 7}`} stroke={fg} stroke-width={1.6} />
        ))}
        <ellipse cx={50} cy={36} rx={18} ry={22} fill={fg} />
        <ellipse cx={50} cy={39} rx={12} ry={15} fill={ac} />
        <ellipse cx={50} cy={42} rx={6} ry={8} fill="#1f3a5f" stroke={fg} stroke-width={1.5} />
      </>
    ),
  },
  {
    name: 'Mandala',
    draw: (fg, ac) => (
      <>
        {petals(8, 7, 15, 20, fg)}
        {petals(8, 4, 9, 18, ac, 22.5)}
        <circle cx={50} cy={50} r={11} fill={ac} />
        <circle cx={50} cy={50} r={5} fill={fg} />
      </>
    ),
  },
  {
    name: 'Moon',
    draw: (fg, ac) => (
      <>
        <path d="M58 20 A31 31 0 1 0 74 72 A25 25 0 1 1 58 20 Z" fill={fg} />
        <path d="M70 26 L73 34 L81 35 L75 40 L77 48 L70 44 L63 48 L65 40 L59 35 L67 34 Z" fill={ac} />
      </>
    ),
  },
  {
    name: 'Tree of life',
    draw: (fg, ac) => (
      <>
        <path d="M46 84 L48 54 L52 54 L54 84 Z" fill={fg} />
        <path d="M50 64 L36 52 M50 60 L64 50" stroke={fg} stroke-width={3} stroke-linecap="round" />
        <circle cx={50} cy={36} r={16} fill={fg} />
        <circle cx={33} cy={46} r={10} fill={fg} />
        <circle cx={67} cy={46} r={10} fill={fg} />
        {[
          [50, 30],
          [42, 40],
          [58, 40],
          [33, 46],
          [67, 46],
        ].map(([x, y]) => (
          <circle cx={x} cy={y} r={3.5} fill={ac} />
        ))}
        <path d="M34 84 Q50 78 66 84" fill="none" stroke={ac} stroke-width={3} stroke-linecap="round" />
      </>
    ),
  },
];

export const avatarName = (index: number) => MOTIFS[(((index % AVATAR_COUNT) + AVATAR_COUNT) % AVATAR_COUNT) % MOTIFS.length].name;

export interface AvatarProps {
  index: number;
  /** Diameter in CSS px, ring included. */
  size?: number;
  /**
   * Fraction of the turn clock left (0..1) for the active player; null for everyone else.
   * The ring depletes clockwise from the top as the turn runs out.
   */
  timeLeft?: number | null;
  /** The turn clock is paused (an auction is running). */
  paused?: boolean;
  /** Under 10 s: the ring turns red. */
  urgent?: boolean;
}

/** A generated Kalamkari-style avatar with a ring that doubles as the turn timer. */
export function Avatar({ index, size = 52, timeLeft = null, paused = false, urgent = false }: AvatarProps) {
  const i = ((index % AVATAR_COUNT) + AVATAR_COUNT) % AVATAR_COUNT;
  const motif = MOTIFS[i % MOTIFS.length];
  const [bg, fg, ac] = COLOURWAYS[Math.floor(i / MOTIFS.length) % COLOURWAYS.length];
  const active = timeLeft !== null;
  const left = Math.max(0, Math.min(1, timeLeft ?? 1));
  const tone = !active ? 'idle' : paused ? 'paused' : urgent ? 'urgent' : left < 0.34 ? 'low' : 'ok';
  return (
    <svg class={`avatar avatar--${tone}`} width={size} height={size} viewBox="-10 -10 120 120" aria-hidden="true">
      {/* Ring: a track, then the remaining time drawn on top (pathLength makes the dash a percentage). */}
      <circle class="avatar-track" cx={50} cy={50} r={55} />
      {active && (
        <circle
          class="avatar-time"
          cx={50}
          cy={50}
          r={55}
          pathLength={100}
          stroke-dasharray={`${left * 100} 100`}
          transform="rotate(-90 50 50)"
        />
      )}
      <clipPath id={`avatar-clip-${i}`}>
        <circle cx={50} cy={50} r={47} />
      </clipPath>
      <g clip-path={`url(#avatar-clip-${i})`}>
        <rect x={0} y={0} width={100} height={100} fill={bg} />
        {motif.draw(fg, ac)}
      </g>
      {/* Block-print dotted border. */}
      <circle cx={50} cy={50} r={44} fill="none" stroke={ac} stroke-width={2} stroke-dasharray="0.1 5.5" stroke-linecap="round" />
      <circle cx={50} cy={50} r={47} fill="none" stroke="#2b1d14" stroke-width={1.5} />
    </svg>
  );
}
