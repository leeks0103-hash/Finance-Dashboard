import { useMemo } from 'react';
import { Button } from '@/components/ui/Button';
import styles from './Pagination.module.css';

interface Props {
  page:           number;   // 1-based 현재 페이지
  pageCount:      number;   // 전체 페이지 수
  onPageChange:   (page: number) => void;
  windowSize?:    number;   // 표시할 페이지 번호 수 (기본 5)
}

const Pagination = ({ page, pageCount, onPageChange, windowSize = 5 }: Props) => {
  const pageIndex = page - 1;

  const pagerNums = useMemo(() => {
    const half  = Math.floor(windowSize / 2);
    const start = Math.max(0, Math.min(pageIndex - half, pageCount - windowSize));
    return Array.from({ length: Math.min(windowSize, pageCount) }, (_, i) => start + i);
  }, [pageIndex, pageCount, windowSize]);

  if (pageCount <= 1) return null;

  return (
    <div className={styles.bar}>
      <span className={styles.spacer} />
      <nav className={styles.nav}>
        <Button variant="ghost" size="sm" className={styles.item}
          onClick={() => onPageChange(page - 1)} disabled={page <= 1}>이전</Button>
        {pagerNums.map(idx => (
          <Button key={idx}
            variant={idx === pageIndex ? 'primary' : 'ghost'} size="sm"
            className={`${styles.item} ${idx === pageIndex ? styles.active : ''}`}
            onClick={() => onPageChange(idx + 1)}>
            {idx + 1}
          </Button>
        ))}
        <Button variant="ghost" size="sm" className={styles.item}
          onClick={() => onPageChange(page + 1)} disabled={page >= pageCount}>다음</Button>
      </nav>
      <span className={styles.label}>{page} / {pageCount}</span>
    </div>
  );
};

export default Pagination;
