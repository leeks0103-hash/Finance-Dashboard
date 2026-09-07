import { useMemo } from 'react';
import { Button } from '@/components/ui/Button';
import styles from './Pagination.module.css';

interface Props {
  page:           number;
  pageCount:      number;
  onPageChange:   (page: number) => void;
  /** 한 번에 보여줄 페이지 번호 개수(블록 크기). 예: 10 → 1~10, 11~20 … */
  windowSize?:    number;
}

const Pagination = ({ page, pageCount, onPageChange, windowSize = 10 }: Props) => {
  const pageIndex = page - 1;

  // 슬라이딩(현재 페이지가 항상 가운데)이 아니라 블록 단위 —
  // 1~10 페이지에선 항상 1~10만 보이고, 11페이지로 넘어가야 11~20이 보임.
  const pagerNums = useMemo(() => {
    const start = Math.floor(pageIndex / windowSize) * windowSize;
    const end   = Math.min(start + windowSize, pageCount);
    return Array.from({ length: Math.max(0, end - start) }, (_, i) => start + i);
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
