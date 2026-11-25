# Kalamkari

A jigsaw-puzzle and auction board game for 2–4 players. Each player secretly owns one hand-painted
design. Buy pieces from the Auction House, sell pieces back to it, and bid on face-down lots. Snap
pieces into your board at any time, even on other players' turns. The first player to complete their
design wins.

* **Pass & play**: one device, with a privacy curtain between turns.
* **Online**: rooms with 4-letter join codes, per-player hidden information, and reconnect.

Docs: [Rules](docs/RULES.md) · [Architecture](docs/ARCHITECTURE.md)

## Requirements

Node.js 20+ (tested on Node 26) and npm 10+.

## Install

```powershell
npm install
```

## Run

**Pass & play, or development:**

```powershell
npm run dev
```

Open http://localhost:5173 and choose **This device**.

**Online, development** (two terminals; Vite proxies `/ws` to the game server):

```powershell
npm run dev:server
```

```powershell
npm run dev
```

Choose **Online**, create a room, and share the code. Other devices on your network can open
`http://<your-ip>:5173`.

**Production** (one port serves both the built client and the WebSocket):

```powershell
npm run build
```

```powershell
npm start
```

Open http://localhost:8787. Set `PORT` to change the port. `GET /healthz` reports status.

## Test

```powershell
npm test
```

```powershell
npm run typecheck
```

`npm test` runs 76 Vitest tests:

* `jigsaw.test.ts`: the edge matrix (interior seams are tab↔socket, borders are flat, 4 of each
  archetype), generated layouts, and `buildPiecePath`.
* `setup.test.ts`: dealing for 2/3/4 players, determinism, and scaling to 5×5 or a 5th design, and avatars.
* `turns.test.ts`: Buy, Sell, auctions, bids, ties, timers, disconnects, stalemate, every edge case
  from the brief, and a randomized fuzz test that checks coins and pieces are always conserved.
* `placement.test.ts`: the single placement rule, locking, winning, and simultaneous completion.
* `projection.test.ts`: no secret leaks to any viewer, and selectors match what the engine accepts.
* `server.test.ts`: real WebSocket rooms, projection per socket, anti-spoofing, reconnect, and
  server-side auction timers.

## Controls

| | Mouse / touch | Keyboard |
|---|---|---|
| Select a piece | tap | Tab to it |
| Rotate | double-tap, or ↺ ↻ in the tray toolbar | `R` / `Shift+R` |
| Place | drag onto your board | `Enter` → arrow keys to pick a slot → `Enter` (`Esc` cancels) |
| Rearrange tray | drag within the tray | arrow keys (hold `Shift` for bigger steps) |
| Sell | **Sell**, then tap a piece, then confirm | **Sell**, then `Enter` on a piece |

A ★ marks pieces that belong to your own design. The **Design visibility** slider under your board
sets how strongly the picture shows through the empty slots. The ring around the active player's
avatar is the turn clock. The ☾/☀ button in the top-right corner switches between light and dark mode.
It follows your system setting until you pick one, and remembers your choice on that device.

## Customising

> These are maintenance notes for the copyright holder. The [license](LICENSE) does not allow
> anyone else to modify the game.

### Swap in or add a design image

All designs are listed in `packages/shared/src/config/designs.manifest.ts`:

```ts
{ id: 'lotus', name: 'Kamal — Lotus', image: '/assets/designs/design-3.jpg', palette: [...] },
```

* **Swap an image**: put the file in `packages/client/public/assets/designs/` and change `image`.
  This is a one-line change.
* **Missing image**: set `image: null`, or let the file 404. A generated gradient-and-ring
  placeholder in the design's `palette` is used instead.
* **Add a 5th design**: add one more line. Each game picks one random design per player from the
  manifest, so more designs means more variety. Only the players' designs are in play (2 players →
  32 pieces).

Use square images. The repo ships 1200 px JPEGs made from the 5432 px source PNGs in `Puzzle Designs/`.

### Change the grid (for example 5×5)

Edit `grid` in `packages/shared/src/config/gameConfig.ts`. If `jigsawLayout.json` has no `"5x5"`
entry, a valid layout is generated deterministically. To use a hand-drawn cut, add a
`"5x5": [["FSSF", ...], ...]` entry. Each string lists the Top, Right, Bottom and Left edges as
F (flat), T (tab) or S (socket). `validateLayout()` and the unit tests check it.

### Rules and numbers

Every number lives in `gameConfig.ts`: coins, hand size, prices, sale payouts per class, bid step,
auction and turn timers, rotation, and fixed-count visibility. The lobby exposes the player-facing
settings: fixed-count visibility, rotated dealing, and the turn timer.

## Project layout

```
packages/shared   pure TS engine: config, model, reducer + rules, projection, selectors, GameHost, protocol
packages/client   Vite + Preact UI; LocalTransport (hotseat) and WebSocketTransport (online)
packages/server   Node http + ws: rooms, per-player projection, timers, reconnect, static hosting
docs/             RULES, ARCHITECTURE
```

The same reducer and validators run on the server, in local mode, and in the UI's enable/disable
checks. See [ARCHITECTURE.md](docs/ARCHITECTURE.md).

## License

Copyright (c) 2026 Dhruva Rawal. All rights reserved.

Kalamkari is **not open source**. You may download it and play it for personal, non-commercial
fun. You may not change, share, redistribute or sell it, or use it or the game's design for any
commercial purpose, without written permission. The software is provided as is, without any
warranty. See [LICENSE](LICENSE) for the full terms. For permission requests, contact
rawaldhruva2004@gmail.com.
