import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const target = process.env.VITE_PROXY_TARGET ?? 'http://localhost:3001';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@game': fileURLToPath(new URL('../game', import.meta.url)) } },
  server: {
    port: 5173,
    fs: { allow: ['..'] },
    proxy: { '/socket.io': { target, ws: true, changeOrigin: true } },
  },
  build: { outDir: 'dist', emptyOutDir: true },
});
