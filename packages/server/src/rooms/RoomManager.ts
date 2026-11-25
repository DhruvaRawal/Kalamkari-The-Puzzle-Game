import { randomInt } from 'node:crypto';
import { Room } from './Room';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I / O to avoid confusion with 1 / 0
const IDLE_MS = 30 * 60_000;

export class RoomManager {
  private rooms = new Map<string, Room>();
  private sweeper: ReturnType<typeof setInterval>;

  constructor(private readonly clock: () => number = Date.now) {
    this.sweeper = setInterval(() => this.sweep(), 60_000);
    this.sweeper.unref?.();
  }

  create(): Room {
    let code: string;
    do {
      code = Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
    } while (this.rooms.has(code));
    const room = new Room(code, this.clock);
    this.rooms.set(code, room);
    return room;
  }

  get(code: string): Room | undefined {
    return this.rooms.get(code.trim().toUpperCase());
  }

  get size(): number {
    return this.rooms.size;
  }

  /** Drops rooms nobody has been connected to for a while. */
  sweep(now = Date.now()): void {
    for (const [code, room] of this.rooms) {
      if (room.connectedCount === 0 && now - room.lastActive > IDLE_MS) {
        room.dispose();
        this.rooms.delete(code);
      }
    }
  }

  dispose(): void {
    clearInterval(this.sweeper);
    for (const room of this.rooms.values()) room.dispose();
    this.rooms.clear();
  }
}
