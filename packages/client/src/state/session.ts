import type { ClientAction, LobbyInfo, PieceId, PlayerId, PlayerView, Rotation, Slot } from '@kalamkari/shared';
import { createStore } from './store';
import type { ConnectionStatus, Transport, TransportEvent } from './transport/Transport';

export interface Toast {
  id: number;
  message: string;
  tone: 'info' | 'error' | 'warning' | 'success';
}

/** Local predictions applied on top of the last view until the host confirms them. */
export interface Optimistic {
  fixed: Record<PieceId, Slot>;
  rotations: Record<PieceId, Rotation>;
}

export interface AppState {
  transport: Transport | null;
  view: PlayerView | null;
  lobby: LobbyInfo | null;
  status: ConnectionStatus;
  handoff: { toPlayerId: PlayerId; name: string } | null;
  toast: Toast | null;
  /** hostNow - Date.now(), so countdowns use the host's clock. */
  clockOffset: number;
  optimistic: Optimistic;
  /** Pieces that just locked in (for the lock animation). */
  justFixed: PieceId[];
}

const emptyOptimistic: Optimistic = { fixed: {}, rotations: {} };

export const app = createStore<AppState>({
  transport: null,
  view: null,
  lobby: null,
  status: 'offline',
  handoff: null,
  toast: null,
  clockOffset: 0,
  optimistic: emptyOptimistic,
  justFixed: [],
});

let unsubscribe: (() => void) | null = null;
let toastSeq = 0;

export function showToast(message: string, tone: Toast['tone'] = 'info') {
  const id = ++toastSeq;
  app.set({ toast: { id, message, tone } });
  setTimeout(() => {
    if (app.get().toast?.id === id) app.set({ toast: null });
  }, 3200);
}

/** Drops predictions the host has confirmed (or made moot). */
function reconcile(o: Optimistic, view: PlayerView): Optimistic {
  const hand = new Map(view.me?.hand.map((h) => [h.id, h]) ?? []);
  const fixed = Object.fromEntries(Object.entries(o.fixed).filter(([id]) => hand.has(id)));
  const rotations = Object.fromEntries(
    Object.entries(o.rotations).filter(([id, r]) => hand.has(id) && hand.get(id)!.rotation !== r),
  ) as Record<PieceId, Rotation>;
  return { fixed, rotations };
}

function onEvent(ev: TransportEvent) {
  switch (ev.type) {
    case 'view': {
      const s = app.get();
      app.set({
        view: ev.view,
        clockOffset: ev.serverNow - Date.now(),
        optimistic: reconcile(s.optimistic, ev.view),
        handoff: ev.view.viewerId ? null : s.handoff,
      });
      break;
    }
    case 'lobby':
      app.set({ lobby: ev.lobby });
      break;
    case 'status':
      app.set({ status: ev.status });
      break;
    case 'handoff':
      app.set({ handoff: { toPlayerId: ev.toPlayerId, name: ev.name }, optimistic: emptyOptimistic });
      break;
    case 'error':
      app.set({ optimistic: emptyOptimistic });
      showToast(ev.message, 'error');
      break;
  }
}

export function connect(transport: Transport) {
  disconnect();
  app.set({ transport, view: null, lobby: null, handoff: null, optimistic: emptyOptimistic, justFixed: [] });
  unsubscribe = transport.subscribe(onEvent);
}

export function disconnect() {
  unsubscribe?.();
  unsubscribe = null;
  app.get().transport?.dispose();
  app.set({ transport: null, view: null, lobby: null, handoff: null, status: 'offline' });
}

/** Sends an action, predicting PLACE / ROTATE locally so drag-and-drop feels instant online. */
export function dispatch(action: ClientAction) {
  const { transport, optimistic } = app.get();
  if (!transport) return;
  if (action.type === 'ROTATE') {
    app.set({ optimistic: { ...optimistic, rotations: { ...optimistic.rotations, [action.pieceId]: action.rotation } } });
  } else if (action.type === 'PLACE') {
    app.set({
      optimistic: { ...optimistic, fixed: { ...optimistic.fixed, [action.pieceId]: { row: action.row, col: action.col } } },
      justFixed: [...app.get().justFixed, action.pieceId],
    });
    setTimeout(() => app.set({ justFixed: app.get().justFixed.filter((id) => id !== action.pieceId) }), 900);
  }
  transport.dispatch(action);
}

export function acknowledgeHandoff() {
  app.get().transport?.acknowledgeHandoff();
}

/** The last view with local predictions applied. Everything in the game UI reads this. */
export function effectiveView(view: PlayerView | null, o: Optimistic): PlayerView | null {
  if (!view?.me || (Object.keys(o.fixed).length === 0 && Object.keys(o.rotations).length === 0)) return view;
  const me = view.me;
  const hand = me.hand
    .filter((h) => !o.fixed[h.id])
    .map((h) => (o.rotations[h.id] !== undefined ? { ...h, rotation: o.rotations[h.id] } : h));
  const fixed = [...me.fixed, ...me.hand.filter((h) => o.fixed[h.id]).map((h) => h.ref)];
  const players = view.players.map((p) =>
    p.id === me.id ? { ...p, handCount: hand.length, fixedCount: fixed.length, pieceCount: hand.length + fixed.length } : p,
  );
  return { ...view, me: { ...me, hand, fixed }, players };
}
