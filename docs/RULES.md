# Kalamkari: Rules

## Goal

You secretly own one of the designs. Be the first to fix all 16 of its pieces into your board.

## Components

* One design per player, each cut into the same 4×4 jigsaw: 4 corners, 8 edges and 4 centres. Only
  the players' designs are used, so 2 players play with 32 pieces, 3 with 48 and 4 with 64.
* 10 coins per player, plus 10 for the Auction House: 30, 40 or 50 coins in all.
* The **Auction House** (the bank) holds the leftover pieces (the *pool*) and its coins.

## Setup

* 2–4 players. Each player is secretly given a different design.
* Each player gets 10 random pieces, from any design in play, and 10 coins.
* The Auction House keeps the remaining pieces (2 players 12, 3 players 18, 4 players 24) and 10 coins.
* A random player starts. Play goes clockwise.

## Your turn

You may do each of these **once**, in either order, then end your turn:

* **Buy**: pay 1 coin to the Auction House and draw a random piece from the pool. Only you see it.
* **Sell**: pick one of your unfixed pieces. The Auction House pays you at once: corner 1, edge 2,
  centre 2. The piece then goes **face-down to auction**.

If you do neither, you **pass**.

### Auctions

* Every other player may bid. The seller may not.
* Everyone sees that a piece is on offer, its class, and the sale price, but not which piece it is.
* Bids are open and ascending, in steps of at least 1 coin, starting at 1. You can't bid more coins
  than you have.
* The clock starts at 15 s. After any bid at least 5 s remain. A tie can't happen: each bid must beat
  the last, so the earlier bid stands.
* The highest bidder pays the Auction House and takes the piece. With no bids, the piece joins the pool.
* After the auction the turn returns to the seller if they haven't bought yet. Otherwise it passes on.

## Placing pieces, any time

At any moment, including other players' turns and during auctions, you can rearrange and rotate
your pieces and drop them on your board. A piece **locks** only in its correct slot of *your* design,
the right way up. Locked pieces can't be moved or sold. Pieces from other designs never lock.

Nobody ever sees your design or which pieces you've placed. A lobby setting (off by default) lets
opponents see how many pieces you've fixed.

## Winning

* The game ends the moment someone fixes their last piece, and they win. If several players
  completed at once, the one with the most coins wins.
* **Stalemate**: if the pool is empty and every player passes in a row, the game ends. The most fixed
  pieces wins, and ties share the win.

## Edge cases

* The Auction House can't afford your sale: the sale is blocked, and the reason is shown.
* No coins: you can still sell or pass.
* Empty pool: Buy is disabled.
* No unfixed pieces: Sell is disabled.
* Timeouts: a turn auto-ends after 90 s (configurable). If you disconnect on your turn, you get
  15 s. If you reconnect in time, your full clock comes back.
