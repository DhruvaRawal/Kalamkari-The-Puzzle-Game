import { availableActions, type HandPieceView, type PieceId, type PlayerView, type Slot } from '@kalamkari/shared';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { AuctionHouse } from '../../components/AuctionHouse';
import { BidPanel } from '../../components/BidPanel';
import { Board, slotFromPoint } from '../../components/Board';
import { Piece } from '../../components/Piece';
import { PlayerPanel } from '../../components/PlayerPanel';
import { PrivacyCurtain } from '../../components/PrivacyCurtain';
import { Tray, trayPosFromDrop } from '../../components/Tray';
import { TurnBanner } from '../../components/TurnBanner';
import { useGameView } from '../../hooks/useGameView';
import { useNow } from '../../hooks/useNow';
import { acknowledgeHandoff, app, disconnect, dispatch } from '../../state/session';
import { useStore } from '../../state/store';
import { designName, pieceLabel, rotationLabel } from '../../utils/format';
import { useTrayLayout, type TrayPos } from '../../utils/trayLayout';
import { SellConfirm } from '../auction/SellConfirm';
import { dragStore, dropZones, type DropInfo } from '../placement/dragDrop';
import { DragLayer } from '../placement/DragLayer';
import { attemptPlace, rotatePiece } from '../placement/placement';
import { GameLog } from './GameLog';
import { GameOver } from './GameOver';
import { TurnAlert, useTurnAlert } from './TurnAlert';

const OPACITY_KEY = 'kalamkari.designOpacity';
const DEFAULT_OPACITY = 0.2;

/** How strongly the design shows through the empty board. A per-device preference, not game state. */
function useDesignOpacity(): [number, (v: number) => void] {
  const [value, setValue] = useState(() => {
    try {
      const v = Number(localStorage.getItem(OPACITY_KEY));
      return localStorage.getItem(OPACITY_KEY) !== null && v >= 0 && v <= 1 ? v : DEFAULT_OPACITY;
    } catch {
      return DEFAULT_OPACITY;
    }
  });
  const set = (v: number) => {
    setValue(v);
    try {
      localStorage.setItem(OPACITY_KEY, String(v));
    } catch {
      /* private mode: keep it for this session only */
    }
  };
  return [value, set];
}

/** Cell size for tray pieces, by viewport width. */
function useTrayCellSize(): number {
  const pick = () => (window.innerWidth < 420 ? 54 : window.innerWidth < 960 ? 64 : 72);
  const [size, setSize] = useState(pick);
  useEffect(() => {
    const on = () => setSize(pick());
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return size;
}

export function GameScreen() {
  const view = useGameView();
  const transport = useStore(app, (s) => s.transport);
  const handoff = useStore(app, (s) => s.handoff);
  if (!view || !transport) return <p class="loading">Loading game…</p>;
  return (
    <>
      <GameTable view={view} bidders={transport.controllablePlayers()} />
      {handoff && <PrivacyCurtain name={handoff.name} onReveal={acknowledgeHandoff} />}
    </>
  );
}

function GameTable({ view, bidders }: { view: PlayerView; bidders: string[] }) {
  const me = view.me;
  const timersActive = view.phase === 'playing';
  const now = useNow(timersActive);
  const justFixed = useStore(app, (s) => s.justFixed);
  const hoverSlot = useStore(dragStore, (s) => s.hoverSlot);
  const draggingId = useStore(dragStore, (s) => s.pieceId);
  const cell = useTrayCellSize();
  const [designOpacity, setDesignOpacity] = useDesignOpacity();
  const [turnAlert, dismissTurnAlert] = useTurnAlert(view);

  const [selected, setSelected] = useState<PieceId | null>(null);
  const [sellMode, setSellMode] = useState(false);
  const [sellCandidate, setSellCandidate] = useState<PieceId | null>(null);
  const [kb, setKb] = useState<{ pieceId: PieceId; cursor: Slot } | null>(null);
  const [announce, setAnnounce] = useState('');
  const boardRef = useRef<SVGSVGElement | null>(null);

  const tray = useTrayLayout(`${view.viewerId}-${me?.designId}`);
  const actions = view.viewerId ? availableActions(view, view.viewerId) : null;
  const hand = me?.hand ?? [];
  const byId = useMemo(() => new Map(hand.map((h) => [h.id, h])), [hand]);

  // Leaving sell mode once the sale happened or became impossible.
  useEffect(() => {
    if (sellMode && actions?.sell) setSellMode(false);
  }, [sellMode, actions?.sell]);
  // Forget selections of pieces we no longer hold.
  useEffect(() => {
    if (selected && !byId.has(selected)) setSelected(null);
    if (kb && !byId.has(kb.pieceId)) setKb(null);
  }, [byId, selected, kb]);

  const slotAt = useCallback((x: number, y: number) => slotFromPoint(boardRef.current, x, y, view.layout), [view.layout]);

  const onDrop = (info: DropInfo) => {
    const slot = slotFromPoint(dropZones.board, info.cx, info.cy, view.layout);
    if (slot) {
      attemptPlace(view, info.pieceId, slot);
      return;
    }
    const pos = dropZones.tray && trayPosFromDrop(dropZones.tray, info.left, info.top, info.box);
    if (pos) tray.move(info.pieceId, pos);
  };

  const activate = (piece: HandPieceView) => {
    setSelected(piece.id);
    if (sellMode) {
      setSellCandidate(piece.id);
      return;
    }
    const start = kb?.cursor ?? { row: 0, col: 0 };
    setKb({ pieceId: piece.id, cursor: start });
    setAnnounce(`Placing piece. Use arrow keys to choose a slot, Enter to place, R to rotate, Escape to cancel. Row ${start.row + 1}, column ${start.col + 1}.`);
  };

  // Keyboard placement: arrows move a cursor over the board, Enter places.
  // Layout effect: the listener must be live before the very next keypress.
  useLayoutEffect(() => {
    if (!kb) return;
    const { rows, cols } = view.layout;
    const onKey = (e: KeyboardEvent) => {
      const move = (dr: number, dc: number) => {
        const cursor = { row: (kb.cursor.row + dr + rows) % rows, col: (kb.cursor.col + dc + cols) % cols };
        setKb({ ...kb, cursor });
        setAnnounce(`Row ${cursor.row + 1}, column ${cursor.col + 1}`);
      };
      switch (e.key) {
        case 'ArrowUp':
          move(-1, 0);
          break;
        case 'ArrowDown':
          move(1, 0);
          break;
        case 'ArrowLeft':
          move(0, -1);
          break;
        case 'ArrowRight':
          move(0, 1);
          break;
        case 'r':
        case 'R':
          rotatePiece(view, kb.pieceId, e.shiftKey ? -1 : 1);
          break;
        case 'Enter':
        case ' ':
          if (attemptPlace(view, kb.pieceId, kb.cursor)) {
            setAnnounce('Piece locked in place.');
            setKb(null);
            // Keep keyboard users in the tray: focus the next piece.
            setTimeout(() => document.querySelector<HTMLElement>('.tray .piece')?.focus(), 0);
          }
          break;
        case 'Escape':
          setKb(null);
          setAnnounce('Placement cancelled.');
          document.querySelector<HTMLElement>(`[data-piece="${kb.pieceId}"] .piece`)?.focus();
          break;
        default:
          return;
      }
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [kb, view]);

  const nudge = (id: PieceId, pos: TrayPos, dx: number, dy: number) =>
    tray.move(id, { x: Math.min(1, Math.max(0, pos.x + dx * 0.04)), y: Math.max(0, pos.y + dy * 12) });

  const selectedPiece = selected ? byId.get(selected) : undefined;
  const sellPiece = sellCandidate ? byId.get(sellCandidate) : undefined;
  const fixedCount = me?.fixed.length ?? 0;
  const total = view.layout.rows * view.layout.cols;

  return (
    <div class={`game${turnAlert ? ' turn-fresh' : ''}`}>
      <TurnBanner
        view={view}
        now={now}
        actions={actions}
        sellMode={sellMode}
        onBuy={() => dispatch({ type: 'BUY' })}
        onSell={() => {
          setSellMode(!sellMode);
          if (!sellMode) setAnnounce('Sell mode. Choose a piece from your tray.');
        }}
        onEndTurn={() => dispatch({ type: 'END_TURN' })}
      />

      <div class="side">
        <PlayerPanel view={view} now={now} />
        <AuctionHouse view={view}>
          <BidPanel view={view} now={now} bidders={bidders} onBid={(playerId, amount) => dispatch({ type: 'BID', amount, playerId })} />
        </AuctionHouse>
      </div>

      <section class="card board-card" aria-label="Your secret board">
        {me ? (
          <>
            <div class="board-head">
              <Board layout={view.layout} designId={me.designId} mode="reference" label={`Reference picture: ${designName(me.designId)}`} class="board-thumb" />
              <div>
                <h2 class="card-title">Your design: {designName(me.designId)}</h2>
                <p class="muted">
                  {fixedCount}/{total} fixed · secret to you
                </p>
              </div>
            </div>
            <Board
              layout={view.layout}
              designId={me.designId}
              mode="live"
              fixed={me.fixed}
              justFixed={justFixed}
              hoverSlot={draggingId ? hoverSlot : null}
              cursorSlot={kb?.cursor ?? null}
              svgRef={(el: SVGSVGElement | null) => {
                boardRef.current = el;
                dropZones.board = el;
              }}
              label={`Your board, ${fixedCount} of ${total} pieces fixed.${kb ? ` Cursor at row ${kb.cursor.row + 1}, column ${kb.cursor.col + 1}.` : ''}`}
              designOpacity={designOpacity}
            />
            <label class="opacity-control">
              <span class="opacity-label">Design visibility</span>
              <span class="opacity-icon" aria-hidden="true">
                ◌
              </span>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                aria-label="Design visibility"
                value={Math.round(designOpacity * 100)}
                onInput={(e) => setDesignOpacity(Number(e.currentTarget.value) / 100)}
                aria-valuetext={`${Math.round(designOpacity * 100)} percent`}
              />
              <span class="opacity-icon" aria-hidden="true">
                ●
              </span>
              <output class="opacity-value">{Math.round(designOpacity * 100)}%</output>
            </label>
          </>
        ) : (
          <p class="muted board-hidden">Boards are private.</p>
        )}
      </section>

      {me && (
        <Tray
          pieces={hand}
          positions={tray.positions}
          size={cell}
          trayRef={(el) => (dropZones.tray = el)}
          onAssign={tray.assign}
          header={
            <div class="tray-head">
              <h2 class="card-title">Your pieces ({hand.length})</h2>
              {sellMode ? (
                <p class="sell-hint" role="status">
                  Choose a piece to sell.{' '}
                  <button class="btn btn--small btn--ghost" onClick={() => setSellMode(false)}>
                    Cancel
                  </button>
                </p>
              ) : selectedPiece ? (
                <div class="piece-tools" role="toolbar" aria-label="Selected piece">
                  <span class="muted piece-tools-label">{rotationLabel(selectedPiece.rotation)}</span>
                  <button class="btn btn--small" onClick={() => rotatePiece(view, selectedPiece.id, -1)} aria-label="Rotate left">
                    ↺
                  </button>
                  <button class="btn btn--small" onClick={() => rotatePiece(view, selectedPiece.id, 1)} aria-label="Rotate right">
                    ↻
                  </button>
                  <button class="btn btn--small btn--ghost" onClick={() => activate(selectedPiece)}>
                    Place with keys
                  </button>
                </div>
              ) : (
                <p class="muted tray-hint">Drag a piece onto your board. Tap to select, double-tap to rotate.</p>
              )}
            </div>
          }
          renderPiece={(piece, style, pos) => (
            <div key={piece.id} data-piece={piece.id} class="piece-slot" style={style}>
              <Piece
                piece={piece}
                layout={view.layout}
                ownDesignId={me.designId}
                size={cell}
                selected={selected === piece.id || kb?.pieceId === piece.id}
                lifted={draggingId === piece.id}
                slotAt={slotAt}
                onSelect={() => {
                  setSelected(piece.id);
                  if (sellMode) setSellCandidate(piece.id);
                }}
                onFocus={() => setSelected(piece.id)}
                onActivate={() => activate(piece)}
                onRotate={(dir) => {
                  rotatePiece(view, piece.id, dir);
                  setAnnounce(pieceLabel(piece.ref, ((piece.rotation + dir + 4) % 4) as 0, me.designId, piece.pieceClass));
                }}
                onNudge={(dx, dy) => nudge(piece.id, pos, dx, dy)}
                onDrop={onDrop}
              />
            </div>
          )}
        />
      )}

      <GameLog view={view} />

      <p class="sr-only" aria-live="assertive">
        {announce}
      </p>
      <DragLayer view={view} />
      <TurnAlert alert={turnAlert} onDismiss={dismissTurnAlert} />

      {sellPiece && (
        <SellConfirm
          view={view}
          piece={sellPiece}
          onCancel={() => setSellCandidate(null)}
          onConfirm={() => {
            dispatch({ type: 'SELL', pieceId: sellPiece.id });
            setSellCandidate(null);
            setSellMode(false);
            setSelected(null);
            setAnnounce('Piece sold. Auction started.');
          }}
        />
      )}
      {view.phase === 'ended' && <GameOver view={view} onLeave={disconnect} />}
    </div>
  );
}
