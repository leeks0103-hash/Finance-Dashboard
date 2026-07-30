import { StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Spinner } from '@/components/ui';
import './index.css';
import App from './App';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:  3 * 60 * 1000,
      gcTime:    10 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <Suspense fallback={<Spinner />}>
          <App />
        </Suspense>
      </ErrorBoundary>
    </QueryClientProvider>
  </StrictMode>
);
