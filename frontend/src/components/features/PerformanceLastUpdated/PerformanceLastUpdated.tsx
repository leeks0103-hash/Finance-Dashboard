import { usePerformanceSummary } from '@/hooks/usePerformanceSummary';
import styles from './PerformanceLastUpdated.module.css';

const fmtTs = (raw: string | null | undefined): string => {
  if (!raw) return '';
  // "2026-08-26 14:30:00" → "08-26 14:30"
  return raw.length >= 16 ? raw.slice(5, 16) : raw;
};

/**
 * 실적현황 필터바 오른쪽 끝의 "최종 업데이트" 표시.
 * 다운로드 버튼(PerformanceActionBar)이 Navbar로 옮겨가면서 함께 있던 이 표시가
 * 같이 없어졌었는데, filterGroup 오른쪽 끝에 다시 붙여달라는 요청으로 복구(2026-09-17).
 */
const PerformanceLastUpdated = () => {
  const { data: sum } = usePerformanceSummary();
  const displayTs = fmtTs(sum?.loaded_at);

  return (
    <span
      className={styles.lastLoaded}
      style={{ visibility: displayTs ? 'visible' : 'hidden' }}
      title="데이터 최종 업데이트"
    >
      업데이트 {displayTs || '00-00 00:00'}
    </span>
  );
};

export default PerformanceLastUpdated;
