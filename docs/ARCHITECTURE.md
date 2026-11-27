# Architecture

```
packages/
  shared/   pure TypeScript: config, model, engine, protocol   (no DOM, no Node APIs)
  client/   Vite + Preact SVG UI, transports                   (depends on shared)
  server/   Node + ws rooms                                    (depends on shared)
```

npm workspaces link the three packages. `@kalamkari/shared` is consumed **as TypeScript source**.
Vite, Vitest and `tsx` all compile it on the fly, so there's no build step between packages and no
duplicated output.

## 1. The one engine

```
reduce(state, action) -> { ok: true, state } | { ok: false, error: { code, message } }
```

* **Pure and deterministic.** Randomness comes from a seeded `mulberry32` RNG whose state is part of
  `GameState`. Time never comes from `Date.now()`: every action carries `now`, which the *host* stamps.
  Replaying the same action log from the same seed gives exactly the same game.
* **Immutable.** Each rule returns a new state, and `structuredClone` is never needed in hot paths.
* **One rule per file** (`engine/rules/*.ts`). Each file exports two things:
  * `xxxBlockReason(facts)`: a pure validator over a *small facts object*, not over `GameState`.
  * `applyXxx(state, action)`: the state transition. It calls the validator first.

  The engine builds the facts object from full `GameState`. The UI builds it from the projected
  `PlayerView` (`selectors.ts`). Buttons are disabled, and their tooltips explained, by **the same
  function** the server uses to reject an action, so client and server never disagree.
* **Placement has one validation path.** `canFixPiece({ ownerDesignId, piece, rotation, slot })`
  lives in `model/piece.ts`. The drag-snap check, the keyboard placement and `rules/place.ts` all call it.

### Actions

| Action | Who | Notes |
|---|---|---|
| `BUY` | active player | 1×/turn, needs coins ≥ price and a non-empty pool |
| `SELL {pieceId}` | active player | 1×/turn; the bank pays immediately, then an auction opens |
| `BID {amount}` | anyone but the seller | open ascending |
| `END_TURN` | active player | counts as a *pass* if nothing was bought or sold |
| `ROTATE {pieceId, rotation}` | any player, any time | own unfixed pieces |
| `PLACE {pieceId, row, col}` | any player, any time | fixes the piece if `canFixPiece` passes |
| `TICK` | host only | closes expired auctions and auto-ends timed-out turns |
| `SET_CONNECTED` | host only | for disconnect handling |

Hosts strip `TICK`/`SET_CONNECTED` from client input and **overwrite `playerId` and `now`** on every
client action, so a client can't spoof another player or the clock.

### GameHost (shared)

`engine/host.ts` wraps `reduce` with the bookkeeping that every host needs: current state, `dispatch`,
`tick(now)`, `nextDeadline()` and `viewFor(playerId)`. **The server room and `LocalTransport` both use
it**, so timer logic and projection aren't written twice. Hosts only add the I/O: sockets or an in-memory
callback, plus `setTimeout`.

## 2. Hidden information

`projectStateFor(state, viewerId)` returns a `PlayerView`. It's the **only** shape that leaves a host,
for local play as well as online play.

| Data | Owner sees | Others see |
|---|---|---|
| Design id | ✔ | ✘ never, not even after the game ends |
| Hand piece ids and rotations | ✔ | total pieces owned only. Unfixed hand size is shown only alongside fixed counts. |
| "X fixed a piece" log entries | ✔ | only if `showFixedCounts` is on |
| Fixed piece ids | ✔ | count only, and only if `showFixedCounts` is on (always shown in the final standings) |
| Pool contents | ✘ | ✘ (count only) |
| Auction piece | ✘ (the seller already knows it) | class and payout only |
| RNG state, seed | ✘ | ✘ |
| Name, avatar, coins, connection | ✔ | ✔ |

`projection.test.ts` serialises every player's view and checks that no other player's design id, hand,
fixed ids, pool ids or auction piece id appears **anywhere** in the JSON.

## 3. Transports

```ts
interface Transport {
  readonly kind: 'local' | 'online';      // for display only: never used to branch game logic
  controllablePlayers(): PlayerId[];      // local hotseat: every player; online: just me
  dispatch(action: ClientAction): void;
  subscribe(listener: (ev: TransportEvent) => void): () => void;
  acknowledgeHandoff(): void;             // dismiss the privacy curtain
  dispose(): void;
}
TransportEvent = view | error | status | handoff
```

* **LocalTransport** runs a `GameHost` in memory. It emits the view for the current *viewer* (the
  active player). When the active player changes, it emits a `handoff` and holds back the next player's
  view until `acknowledgeHandoff()` is called. That's the "pass the device" curtain.
* **WebSocketTransport** talks to the server: create/join a room with a 4-letter code, then a resume
  token kept in `localStorage` for reconnects, with exponential backoff. It never emits `handoff`.

The game UI only knows `Transport`. The lobby is the only place that chooses which one to build.

## 4. Server

* `rooms/RoomManager.ts`: creates rooms, generates join codes and tokens, removes idle rooms.
* `rooms/Room.ts`: lobby (seats, host, settings), then a `GameHost`. After every accepted action it
  sends **each socket its own projection**. It schedules one `setTimeout` for the host's next deadline
  (auction end or turn timeout) instead of polling.
* **Bots** (`shared/src/bot/bot.ts`): `chooseBotAction(view, now, level)` returns one move at a
  time from the bot's **own projection**, so a bot knows no more than a person in its seat. The room
  seats bots as members without a socket and, while a game with bots is on, checks every 250 ms
  whether a bot is due to move. Each bot pauses before reacting (Easy 2.5–4.5 s, Medium 1.5–3 s,
  Hard 0.8–1.6 s) so people can follow along.
* `transport/ws.ts`: parses and validates messages (`protocol/messages.ts`), applies rate limiting
  and message size limits, and maps sockets to players.
* The server also serves `packages/client/dist` in production, so a single port handles everything.

## 5. Client

```
state/store.ts           tiny external store + useStore(selector) hook
state/session.ts         binds a Transport to the store
state/transport/*        Transport.ts, LocalTransport.ts, WebSocketTransport.ts
components/              presentational, reusable
  PieceShape             THE piece renderer: svg path from buildPiecePath + clipPath image;
                         props: faceDown, locked, rotation, size, highlight
  Piece                  PieceShape plus pointer/keyboard interaction
  Board                  mode="live" (slots + faint design + fixed pieces) or mode="reference" (thumbnail)
  Slot, Tray, Coin, PlayerPanel, AuctionHouse, BidPanel, TurnBanner, PrivacyCurtain
features/
  lobby/                 local setup and online create/join
  game/                  GameScreen layout and action bar (Buy / Sell / End turn)
  auction/               sell confirmation
  placement/             useDragDrop (pointer events, hit testing) and keyboard placement
```

### Piece geometry

`model/piecePath.ts` → `buildPiecePath(edges, size)` draws a closed path clockwise. Every edge uses the
same normalized knob curve, mirrored for sockets and rotated per side. `PieceShape` renders:

```svg
<clipPath id=…><path d=buildPiecePath(cell.edges)/></clipPath>
<image href=design.jpg x=-col*S y=-row*S width=cols*S height=rows*S clip-path=url(#…)/>
```

The image is never sliced, and every piece of every design comes from one function plus 16 strings of data.

## 6. Scaling knobs

| Change | What to edit |
|---|---|
| 5×5 grid | `gameConfig.grid`. Optionally add a `"5x5"` layout to `jigsawLayout.json`, otherwise one is generated. |
| 5th design | Add a line in `designs.manifest.ts` and an image in `public/assets/designs/`. Games pick one design per player from the manifest. |
| Prices, timers, coins, hand size | `gameConfig.ts` |
| New action | Add `rules/foo.ts` (validator + apply), add the union member in `protocol/actions.ts`, add the case in `reducer.ts`. |

## 7. Deviations from the suggested structure

* Added `engine/host.ts` so the server and local mode share timer and projection orchestration.
* Added `engine/rules/turn.ts` (advancing turns, pass/stalemate bookkeeping), `rotate.ts` and `tick.ts`.
  These are rules with no natural home in the suggested files.
* Added `model/piecePath.ts` to keep geometry separate from layout data (`jigsaw.ts`).
* Design images are `.jpg`, not `.png`: the 5432 px source PNGs (~33 MB each) were downscaled to
  1200 px JPEGs (~0.5 MB each) for the web.
* Server split into `app.ts` (HTTP + WS bootstrap, exported for integration tests) and `index.ts`
  (CLI entry).
* Placement feature split into `dragDrop.ts` (pointer gestures + drop-zone registry), `placement.ts`
  (the single `attemptPlace`/`rotatePiece` used by both drag and keyboard) and `DragLayer.tsx` (the
  dragged ghost).
