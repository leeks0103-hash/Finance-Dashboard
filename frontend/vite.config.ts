import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// 백엔드(Flask) 포트 — 기본 5000, 다른 포트로 띄울 땐 BACKEND_PORT=5001 npm run dev
const BACKEND_PORT = process.env.BACKEND_PORT || '5000';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: `http://localhost:${BACKEND_PORT}`,
        changeOrigin: true,
      },
    },
  },
});
