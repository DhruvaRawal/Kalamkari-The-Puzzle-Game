import { BOT_LEVEL_LABEL, BOT_LEVELS, defaultGameConfig, isBotLevel, type GameSettings, type LobbyInfo } from '@kalamkari/shared';
import { useState } from 'preact/hooks';
import { app, connect, disconnect, showToast } from '../../state/session';
import { useStore } from '../../state/store';
import { LocalTransport } from '../../state/transport/LocalTransport';
import { WebSocketTransport } from '../../state/transport/WebSocketTransport';

const TURN_OPTIONS = [60_000, 90_000, 120_000, 300_000];

function SettingsFields({ value, onChange, disabled }: { value: GameSettings; onChange: (s: GameSettings) => void; disabled?: boolean }) {
  const v = { ...defaultGameConfig, ...value };
  return (
    <fieldset class="settings" disabled={disabled}>
      <legend>Settings</legend>
      <label class="check">
        <input type="checkbox" checked={v.showFixedCounts} onChange={(e) => onChange({ ...value, showFixedCounts: (e.target as HTMLInputElement).checked })} />
        <span class="label-text">
          Show how many pieces each player has fixed <span class="muted">(never which ones)</span>
        </span>
      </label>
      <label class="check">
        <input
          type="checkbox"
          checked={v.randomInitialRotation}
          onChange={(e) => onChange({ ...value, randomInitialRotation: (e.target as HTMLInputElement).checked })}
        />
        <span class="label-text">
          Deal pieces rotated <span class="muted">(rotate them before they fit)</span>
        </span>
      </label>
      <label class="field">
        Turn timer
        <select value={v.turnTimeoutMs} onChange={(e) => onChange({ ...value, turnTimeoutMs: Number((e.target as HTMLSelectElement).value) })}>
          {TURN_OPTIONS.map((ms) => (
            <option value={ms}>{ms / 1000} seconds</option>
          ))}
        </select>
      </label>
    </fieldset>
  );
}

function LocalSetup() {
  const [count, setCount] = useState(2);
  const [names, setNames] = useState(['', '', '', '']);
  const [settings, setSettings] = useState<GameSettings>({});
  const start = (e: Event) => {
    e.preventDefault();
    try {
      connect(new LocalTransport(names.slice(0, count).map((n, i) => n.trim() || `Player ${i + 1}`), settings));
    } catch (err) {
      showToast(String((err as Error).message), 'error');
    }
  };
  return (
    <form class="card lobby-card" onSubmit={start}>
      <h2>Pass &amp; play</h2>
      <p class="muted">One device, shared between turns. A privacy curtain hides each board.</p>
      <fieldset class="player-count">
        <legend>Players</legend>
        {[2, 3, 4].map((n) => (
          <label class={`chip${count === n ? ' is-active' : ''}`}>
            <input type="radio" name="count" value={n} checked={count === n} onChange={() => setCount(n)} />
            {n}
          </label>
        ))}
      </fieldset>
      {names.slice(0, count).map((name, i) => (
        <label class="field">
          Player {i + 1} name
          <input
            value={name}
            maxLength={24}
            placeholder={`Player ${i + 1}`}
            onInput={(e) => setNames(names.map((n, j) => (j === i ? (e.target as HTMLInputElement).value : n)))}
          />
        </label>
      ))}
      <SettingsFields value={settings} onChange={setSettings} />
      <button class="btn btn--primary btn--large" type="submit">
        Start game
      </button>
    </form>
  );
}

function OnlineSetup() {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [settings, setSettings] = useState<GameSettings>({});
  const go = (fn: (t: WebSocketTransport) => void) => {
    if (!name.trim()) return showToast('Enter your name first.', 'error');
    const t = new WebSocketTransport();
    connect(t);
    fn(t);
  };
  return (
    <div class="card lobby-card">
      <h2>Online</h2>
      <p class="muted">Each player uses their own device. Share the room code.</p>
      <label class="field">
        Your name
        <input value={name} maxLength={24} placeholder="e.g. Meera" onInput={(e) => setName((e.target as HTMLInputElement).value)} />
      </label>
      <form
        class="join-row"
        onSubmit={(e) => {
          e.preventDefault();
          go((t) => t.join(code, name.trim()));
        }}
      >
        <label class="field">
          Room code
          <input
            value={code}
            maxLength={4}
            autoCapitalize="characters"
            placeholder="ABCD"
            onInput={(e) => setCode((e.target as HTMLInputElement).value.toUpperCase())}
          />
        </label>
        <button class="btn" type="submit" disabled={code.trim().length !== 4}>
          Join
        </button>
      </form>
      <div class="divider">
        <span>or</span>
      </div>
      <SettingsFields value={settings} onChange={setSettings} />
      <button class="btn btn--primary btn--large" onClick={() => go((t) => t.create(name.trim(), settings))}>
        Create room
      </button>
    </div>
  );
}

/** Online waiting room: shown after create/join until the host starts. */
export function WaitingRoom({ transport, lobby }: { transport: WebSocketTransport; lobby: LobbyInfo | null }) {
  const status = useStore(app, (s) => s.status);
  if (!lobby) {
    return (
      <div class="card lobby-card">
        <p role="status">{status === 'offline' ? 'Could not join.' : 'Connecting…'}</p>
        <button class="btn btn--ghost" onClick={disconnect}>
          Back
        </button>
      </div>
    );
  }
  const isHost = transport.playerId === lobby.hostId;
  const canStart = lobby.players.length >= lobby.minPlayers;
  const seatsLeft = lobby.maxPlayers - lobby.players.length;
  return (
    <div class="card lobby-card waiting">
      <h2>
        Room <span class="room-code">{lobby.code}</span>
      </h2>
      <p class="muted">Share this code. {lobby.minPlayers}–{lobby.maxPlayers} players.</p>
      <ul class="lobby-players">
        {lobby.players.map((p) => (
          <li class={p.bot ? 'is-bot' : undefined}>
            <span class="lobby-player-name">
              {p.name}
              {p.id === lobby.hostId && <span class="tag">host</span>}
              {p.id === transport.playerId && <span class="tag">you</span>}
              {!p.connected && <span class="tag tag--off">offline</span>}
              {p.bot && !isHost && <span class="tag">{BOT_LEVEL_LABEL[p.bot]}</span>}
            </span>
            {p.bot && isHost && (
              <span class="bot-controls">
                <select
                  class="bot-level"
                  value={p.bot}
                  aria-label={`${p.name} difficulty`}
                  onChange={(e) => {
                    const level = (e.target as HTMLSelectElement).value;
                    if (isBotLevel(level)) transport.setBotLevel(p.id, level);
                  }}
                >
                  {BOT_LEVELS.map((l) => (
                    <option value={l}>{BOT_LEVEL_LABEL[l]}</option>
                  ))}
                </select>
                <button class="btn btn--small btn--ghost bot-remove" onClick={() => transport.removeBot(p.id)} aria-label={`Remove ${p.name}`} title="Remove bot">
                  ✕
                </button>
              </span>
            )}
          </li>
        ))}
      </ul>
      {isHost && seatsLeft > 0 && (
        <button class="btn add-bot" onClick={() => transport.addBot()}>
          + Add bot
        </button>
      )}
      <SettingsFields value={lobby.settings} onChange={(s) => transport.updateSettings(s)} disabled={!isHost} />
      {isHost ? (
        <button class="btn btn--primary btn--large" disabled={!canStart} onClick={() => transport.start()}>
          {canStart ? 'Start game' : 'Waiting for players…'}
        </button>
      ) : (
        <p role="status">Waiting for the host to start…</p>
      )}
      <button class="btn btn--ghost" onClick={disconnect}>
        Leave room
      </button>
    </div>
  );
}

export function Lobby() {
  const [tab, setTab] = useState<'local' | 'online'>('local');
  return (
    <main class="lobby">
      <div class="hero">
        <div class="motif-ring" aria-hidden="true" />
        <h1>Kalamkari</h1>
        <p class="tagline">Bid, barter and piece together your secret hand-painted design.</p>
      </div>
      <div class="tabs" role="tablist" aria-label="Game mode">
        <button role="tab" aria-selected={tab === 'local'} class={`tab${tab === 'local' ? ' is-active' : ''}`} onClick={() => setTab('local')}>
          This device
        </button>
        <button role="tab" aria-selected={tab === 'online'} class={`tab${tab === 'online' ? ' is-active' : ''}`} onClick={() => setTab('online')}>
          Online
        </button>
      </div>
      {tab === 'local' ? <LocalSetup /> : <OnlineSetup />}
      <details class="card rules-summary">
        <summary>How to play</summary>
        <ul>
          <li>You secretly own one design. Complete all its pieces first to win.</li>
          <li>
            On your turn you may <strong>Buy</strong> (1 coin for a random piece) and <strong>Sell</strong> (the Auction House pays you, then auctions
            the piece face-down), once each, in either order.
          </li>
          <li>Any time, even off-turn, drag pieces onto your board. Correct pieces lock in for good. Rotate with double-tap or R.</li>
          <li>If the pool runs dry and everyone passes for a full round, the most fixed pieces wins.</li>
        </ul>
      </details>
    </main>
  );
}
