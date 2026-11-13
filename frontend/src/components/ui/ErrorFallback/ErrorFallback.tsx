import { Button } from '@/components/ui/Button';
import styles from './ErrorFallback.module.css';

interface Props {
  message?:     string;
  title?:       string;
  description?: string;
  onRetry?:     () => void;
  /** 한 줄 알림 모양(아이콘·문구·다시 시도를 가로로, 여백 작게) — 페이지 위 안내용(2026-11-04) */
  compact?:     boolean;
}

const ErrorFallback = ({
  message,
  title       = '오류가 발생했습니다',
  description = '데이터를 불러오는 중 오류가 발생했습니다.',
  onRetry,
  compact = false,
}: Props) => (
  <div className={`${styles.wrap}${compact ? ` ${styles.compact}` : ''}`} role="alert">
    <span className={styles.icon}>⚠️</span>
    <p className={styles.message}>{message ?? `${title}: ${description}`}</p>
    {onRetry && (
      <Button variant="danger" size="sm" onClick={onRetry}>다시 시도</Button>
    )}
  </div>
);

export default ErrorFallback;
