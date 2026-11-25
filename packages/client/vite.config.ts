import preact from '@preact/preset-vite';
import { defineConfig } from 'vite';

const SERVER_PORT = Number(process.env.KALAMKARI_SERVER_PORT ?? 8787);

export default defineConfig({
  plugins: [preact()],
  server: {
    host: true,
    port: 5173,
    proxy: { '/ws': { target: `ws://localhost:${SERVER_PORT}`, ws: true } },
  },
  build: { target: 'es2022', sourcemap: true },
});
