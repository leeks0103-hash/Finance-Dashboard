import { Button } from '@/components/ui/Button';
import styles from './ErrorFallback.module.css';

interface Props {
  message?:     string;
  title?:       string;
  description?: string;
  onRetry?:     () => void;
}

const ErrorFallback = ({
  message,
  title       = '오류가 발생했습니다',
  description = '데이터를 불러오는 중 오류가 발생했습니다.',
  onRetry,
}: Props) => (
  <div className={styles.wrap} role="alert">
    <span className={styles.icon}>⚠️</span>
    <p className={styles.message}>{message ?? `${title} — ${description}`}</p>
    {onRetry && (
      <Button variant="danger" size="sm" onClick={onRetry}>다시 시도</Button>
    )}
  </div>
);

export default ErrorFallback;
