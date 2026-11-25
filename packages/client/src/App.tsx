import { useEffect } from 'preact/hooks';
import { ThemeToggle } from './components/ThemeToggle';
import { GameScreen } from './features/game/GameScreen';
import { Lobby, WaitingRoom } from './features/lobby/Lobby';
import { app, connect, disconnect } from './state/session';
import { useStore } from './state/store';
import { loadSavedSession, WebSocketTransport } from './state/transport/WebSocketTransport';

function Toast() {
  const toast = useStore(app, (s) => s.toast);
  return (
    <div class="toast-region" role="status" aria-live="polite">
      {toast && (
        <div key={toast.id} class={`toast toast--${toast.tone}`}>
          {{ error: '⚠ ', warning: '↻ ', success: '✔ ', info: '' }[toast.tone]}
          {toast.message}
        </div>
      )}
    </div>
  );
}

function ConnectionBadge() {
  const transport = useStore(app, (s) => s.transport);
  const status = useStore(app, (s) => s.status);
  if (!transport || transport.kind === 'local' || status === 'online') return null;
  return (
    <div class={`conn-badge is-${status}`} role="status">
      {status === 'reconnecting' ? 'Reconnecting…' : status === 'connecting' ? 'Connecting…' : 'Disconnected: this room has closed.'}
      {status === 'offline' && (
        <button class="btn btn--small" onClick={disconnect}>
          Back to lobby
        </button>
      )}
    </div>
  );
}

export function App() {
  const transport = useStore(app, (s) => s.transport);
  const view = useStore(app, (s) => s.view);
  const lobby = useStore(app, (s) => s.lobby);

  // Rejoin an online seat after a reload.
  useEffect(() => {
    const saved = loadSavedSession();
    if (saved && !app.get().transport) {
      const t = new WebSocketTransport();
      connect(t);
      t.resume(saved);
    }
  }, []);

  let screen;
  if (!transport) screen = <Lobby />;
  else if (view) screen = <GameScreen />;
  else if (transport instanceof WebSocketTransport) screen = (
    <main class="lobby">
      <WaitingRoom transport={transport} lobby={lobby} />
    </main>
  );
  else screen = <GameScreen />;

  return (
    <>
      <ThemeToggle />
      <ConnectionBadge />
      {screen}
      <Toast />
    </>
  );
}
