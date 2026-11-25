export const ERROR_MESSAGES = {
  GAME_ENDED: 'The game is over.',
  UNKNOWN_PLAYER: 'Unknown player.',
  UNKNOWN_ACTION: 'Unknown action.',
  INVALID_SETUP: 'Invalid game setup.',
  NOT_YOUR_TURN: "It's not your turn.",
  AUCTION_OPEN: 'Wait for the auction to close.',
  ALREADY_BOUGHT: 'You already bought a piece this turn.',
  ALREADY_SOLD: 'You already sold a piece this turn.',
  INSUFFICIENT_COINS: "You don't have enough coins.",
  POOL_EMPTY: 'The Auction House has no pieces left.',
  NOT_IN_HAND: "You don't hold that piece.",
  PIECE_FIXED: "Fixed pieces can't be moved or sold.",
  NO_PIECES_TO_SELL: 'You have no unfixed pieces to sell.',
  BANK_INSUFFICIENT_COINS: "The Auction House can't afford this sale.",
  NO_AUCTION: 'There is no auction open.',
  SELLER_CANNOT_BID: "You can't bid on your own piece.",
  BID_TOO_LOW: 'That bid is too low.',
  BID_EXCEEDS_COINS: "You can't bid more coins than you have.",
  OUT_OF_BOUNDS: "That slot isn't on the board.",
  WRONG_DESIGN: "That piece doesn't belong to your design.",
  WRONG_SLOT: "That piece doesn't go there.",
  WRONG_ROTATION: 'Right slot, but the piece needs rotating.',
  SLOT_TAKEN: 'That slot is already filled.',
} as const;

export type ErrorCode = keyof typeof ERROR_MESSAGES;

export interface GameError {
  code: ErrorCode;
  message: string;
}

export const gameError = (code: ErrorCode): GameError => ({ code, message: ERROR_MESSAGES[code] });
