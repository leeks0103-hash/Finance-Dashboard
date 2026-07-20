import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';
import App from './App';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:  3 * 60 * 1000,  // 3분 — 같은 필터 재요청 방지
      gcTime:    10 * 60 * 1000,  // 10분 캐시 보존
      retry: 1,
      refetchOnWindowFocus: false, // 탭 전환마다 재요청 방지
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>
);
