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
    // 5173은 Vite 기본값이라 다른 프로젝트와 충돌 잦음 — 5174도 마찬가지(다른 프로젝트가
    // 5173 충돌 시 자동으로 5174로 옮겨감). 자동 증가 범위 밖의 값으로 고정.
    port: 5188,
    strictPort: true,
    proxy: {
      '/api': {
        target: `http://localhost:${BACKEND_PORT}`,
        changeOrigin: true,
      },
    },
  },
});
