import { StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Spinner } from '@/components/ui';
import { queryClient } from '@/hooks/queryClient';
import './index.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <QueryClientProvider client={queryClient}>
        <ErrorBoundary>
          <Suspense fallback={<Spinner />}>
            <App />
          </Suspense>
        </ErrorBoundary>
      </QueryClientProvider>
    </HashRouter>
  </StrictMode>
);
