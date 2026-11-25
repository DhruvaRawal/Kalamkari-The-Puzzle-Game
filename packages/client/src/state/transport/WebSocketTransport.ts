import {
  WS_PATH,
  type ClientAction,
  type ClientMessage,
  type GameSettings,
  type PlayerAction,
  type PlayerId,
  type ServerMessage,
} from '@kalamkari/shared';
import { Emitter, type Transport, type TransportEvent } from './Transport';

/** Per-tab (survives reloads, and two tabs can hold two different seats). */
const SESSION_KEY = 'kalamkari.online';

export interface SavedSession {
  code: string;
  token: string;
  playerId: PlayerId;
}

export function loadSavedSession(): SavedSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as SavedSession) : null;
  } catch {
    return null;
  }
}

function saveSession(s: SavedSession | null) {
  try {
    if (s) sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* storage unavailable: reconnect after reload won't work, play continues */
  }
}

const defaultUrl = () => `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}${WS_PATH}`;

/**
 * Online play. The first message (create / join / resume) is replayed as `resume` after any drop,
 * with exponential backoff, so a flaky connection or a page reload rejoins the same seat.
 */
export class WebSocketTransport implements Transport {
  readonly kind = 'online' as const;
  private readonly events = new Emitter();
  private socket: WebSocket | null = null;
  private session: SavedSession | null = null;
  private intro: ClientMessage | null = null;
  private retry = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private disposed = false;
  private last: { lobby?: TransportEvent; view?: TransportEvent; status: TransportEvent } = {
    status: { type: 'status', status: 'connecting' },
  };

  constructor(private readonly url = defaultUrl()) {}

  get playerId(): PlayerId | null {
    return this.session?.playerId ?? null;
  }

  create(name: string, settings: GameSettings) {
    this.begin({ t: 'create', name, settings });
  }
  join(code: string, name: string) {
    this.begin({ t: 'join', code: code.trim().toUpperCase(), name });
  }
  resume(saved: SavedSession) {
    this.session = saved;
    this.begin({ t: 'resume', code: saved.code, token: saved.token });
  }
  start() {
    this.send({ t: 'start' });
  }
  updateSettings(settings: GameSettings) {
    this.send({ t: 'settings', settings });
  }

  controllablePlayers(): PlayerId[] {
    return this.session ? [this.session.playerId] : [];
  }

  dispatch(action: ClientAction): void {
    const { playerId: _ignored, ...rest } = action; // the server decides who we are
    this.send({ t: 'action', action: rest as PlayerAction });
  }

  subscribe(listener: (ev: TransportEvent) => void): () => void {
    const off = this.events.on(listener);
    listener(this.last.status);
    if (this.last.lobby) listener(this.last.lobby);
    if (this.last.view) listener(this.last.view);
    return off;
  }

  acknowledgeHandoff(): void {
    /* online play never hands a device over */
  }

  dispose(): void {
    this.disposed = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if (this.pingTimer) clearInterval(this.pingTimer);
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify({ t: 'leave' }));
    this.socket?.close();
    saveSession(null);
  }

  private begin(intro: ClientMessage) {
    this.intro = intro;
    this.open();
  }

  private emit(ev: TransportEvent) {
    if (ev.type === 'status') this.last.status = ev;
    if (ev.type === 'lobby') this.last.lobby = ev;
    if (ev.type === 'view') this.last.view = ev;
    this.events.emit(ev);
  }

  private open() {
    if (this.disposed) return;
    this.emit({ type: 'status', status: this.retry === 0 ? 'connecting' : 'reconnecting' });
    const ws = new WebSocket(this.url);
    this.socket = ws;
    ws.onopen = () => {
      this.retry = 0;
      const intro = this.session ? { t: 'resume', code: this.session.code, token: this.session.token } : this.intro;
      if (intro) ws.send(JSON.stringify(intro));
      if (this.pingTimer) clearInterval(this.pingTimer);
      this.pingTimer = setInterval(() => this.send({ t: 'ping' }), 20_000);
    };
    ws.onmessage = (e) => this.receive(String(e.data));
    ws.onclose = () => {
      if (this.pingTimer) clearInterval(this.pingTimer);
      if (this.disposed) return;
      this.emit({ type: 'status', status: 'reconnecting' });
      const delay = Math.min(10_000, 500 * 2 ** this.retry++);
      this.retryTimer = setTimeout(() => this.open(), delay);
    };
  }

  private receive(raw: string) {
    let msg: ServerMessage;
    try {
      msg = JSON.parse(raw) as ServerMessage;
    } catch {
      return;
    }
    switch (msg.t) {
      case 'welcome':
        this.session = { code: msg.code, token: msg.token, playerId: msg.playerId };
        saveSession(this.session);
        this.emit({ type: 'status', status: 'online' });
        break;
      case 'lobby':
        this.emit({ type: 'lobby', lobby: msg.lobby });
        break;
      case 'state':
        this.emit({ type: 'view', view: msg.view, serverNow: msg.serverNow });
        break;
      case 'error':
        if (msg.code === 'BAD_SESSION' || msg.code === 'ROOM_NOT_FOUND') {
          // Our seat is gone: stop retrying.
          this.session = null;
          saveSession(null);
          this.emit({ type: 'status', status: 'offline' });
        }
        this.emit({ type: 'error', code: msg.code, message: msg.message });
        break;
      case 'pong':
        break;
    }
  }

  private send(msg: ClientMessage) {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(msg));
    else if (msg.t === 'action') this.emit({ type: 'error', code: 'OFFLINE', message: 'Not connected — reconnecting…' });
  }
}
