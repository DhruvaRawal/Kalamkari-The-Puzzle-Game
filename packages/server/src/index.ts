import { startServer } from './app';

const port = Number(process.env.PORT ?? 8787);
const { port: actual } = await startServer({ port });
console.log(`Kalamkari server listening on http://localhost:${actual} (WebSocket path /ws)`);
