import { Suspense, type ReactNode } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Spinner } from '@/components/ui';

interface Props { children: ReactNode; label?: string; }

const SuspenseSection = ({ children, label }: Props) => (
  <ErrorBoundary>
    <Suspense fallback={<Spinner label={label} />}>
      {children}
    </Suspense>
  </ErrorBoundary>
);

export default SuspenseSection;
