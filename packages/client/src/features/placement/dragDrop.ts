import type { PieceId, Slot } from '@kalamkari/shared';
import { useRef } from 'preact/hooks';
import { createStore } from '../../state/store';

/** Live drag state, read by the ghost layer and the board's hover highlight. */
export interface DragState {
  pieceId: PieceId | null;
  /** Top-left of the ghost in viewport px. */
  x: number;
  y: number;
  /** Ghost box size in px. */
  box: number;
  hoverSlot: Slot | null;
}

export const dragStore = createStore<DragState>({ pieceId: null, x: 0, y: 0, box: 0, hoverSlot: null });

/** Elements that accept drops. Registered by Board and Tray through refs. */
export const dropZones: { board: SVGSVGElement | null; tray: HTMLElement | null } = { board: null, tray: null };

export interface DropInfo {
  pieceId: PieceId;
  /** Centre of the ghost, viewport px. */
  cx: number;
  cy: number;
  /** Top-left of the ghost, viewport px. */
  left: number;
  top: number;
  box: number;
}

export interface PieceDragOptions {
  pieceId: PieceId;
  disabled?: boolean;
  onTap?: () => void;
  onDoubleTap?: () => void;
  /** Hover feedback while dragging. */
  slotAt: (x: number, y: number) => Slot | null;
  onDrop: (info: DropInfo) => void;
}

const DRAG_THRESHOLD = 6;
const DOUBLE_TAP_MS = 320;

/**
 * Pointer-event drag for one piece (mouse, pen and touch). Small movements count as a tap,
 * so a single gesture model covers select, double-tap-to-rotate and drag-to-place.
 */
export function usePieceDrag(opts: PieceDragOptions) {
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const lastTap = useRef(0);

  const onPointerDown = (e: PointerEvent) => {
    if (optsRef.current.disabled || e.button > 0) return;
    const el = e.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    const grabX = e.clientX - rect.left;
    const grabY = e.clientY - rect.top;
    const startX = e.clientX;
    const startY = e.clientY;
    let dragging = false;
    el.setPointerCapture(e.pointerId);

    const move = (ev: PointerEvent) => {
      if (!dragging && Math.hypot(ev.clientX - startX, ev.clientY - startY) < DRAG_THRESHOLD) return;
      dragging = true;
      const x = ev.clientX - grabX;
      const y = ev.clientY - grabY;
      dragStore.set({
        pieceId: optsRef.current.pieceId,
        x,
        y,
        box: rect.width,
        hoverSlot: optsRef.current.slotAt(x + rect.width / 2, y + rect.height / 2),
      });
    };
    const finish = (ev: PointerEvent, cancelled: boolean) => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', cancel);
      if (el.hasPointerCapture(ev.pointerId)) el.releasePointerCapture(ev.pointerId);
      const { x, y, box } = dragStore.get();
      dragStore.set({ pieceId: null, hoverSlot: null });
      if (cancelled) return;
      if (dragging) {
        optsRef.current.onDrop({ pieceId: optsRef.current.pieceId, cx: x + box / 2, cy: y + box / 2, left: x, top: y, box });
        return;
      }
      const now = performance.now();
      if (now - lastTap.current < DOUBLE_TAP_MS) {
        lastTap.current = 0;
        optsRef.current.onDoubleTap?.();
      } else {
        lastTap.current = now;
        optsRef.current.onTap?.();
      }
    };
    const up = (ev: PointerEvent) => finish(ev, false);
    const cancel = (ev: PointerEvent) => finish(ev, true);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', cancel);
  };

  return { onPointerDown };
}
