import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RoomManager } from './rooms/RoomManager';
import { attachWebSockets } from './transport/ws';

const here = dirname(fileURLToPath(import.meta.url));
const DEFAULT_STATIC = resolve(here, '../../client/dist');

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.json': 'application/json',
  '.map': 'application/json',
  '.ico': 'image/x-icon',
};

export interface RunningServer {
  port: number;
  rooms: RoomManager;
  close(): Promise<void>;
}

/** HTTP (built client, if present) + WebSocket game server on one port. */
export function startServer(opts: { port?: number; staticDir?: string } = {}): Promise<RunningServer> {
  const staticDir = opts.staticDir ?? DEFAULT_STATIC;
  const rooms = new RoomManager();

  const server: Server = createServer((req, res) => {
    if (req.url === '/healthz') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, rooms: rooms.size }));
      return;
    }
    if (!existsSync(staticDir)) {
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Kalamkari game server is running. Build the client (npm run build) or use the Vite dev server.');
      return;
    }
    const urlPath = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
    let file = normalize(join(staticDir, urlPath));
    if (!file.startsWith(staticDir + sep) && file !== staticDir) {
      res.writeHead(403).end();
      return;
    }
    if (!existsSync(file) || statSync(file).isDirectory()) file = join(staticDir, 'index.html'); // SPA fallback
    const ext = extname(file);
    res.writeHead(200, {
      'content-type': TYPES[ext] ?? 'application/octet-stream',
      'cache-control': ext === '.html' ? 'no-cache' : 'public, max-age=86400',
    });
    createReadStream(file).pipe(res);
  });

  const wss = attachWebSockets(server, rooms);

  return new Promise((resolvePromise) => {
    server.listen(opts.port ?? 8787, () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : (opts.port ?? 8787);
      resolvePromise({
        port,
        rooms,
        close: () =>
          new Promise((done) => {
            rooms.dispose();
            for (const c of wss.clients) c.terminate();
            wss.close();
            server.close(() => done());
          }),
      });
    });
  });
}
