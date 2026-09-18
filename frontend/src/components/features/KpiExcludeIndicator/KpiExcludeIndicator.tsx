import { useKpiExcludeStore } from '@/store/kpiExclude.store';
import { Button } from '@/components/ui';
import styles from './KpiExcludeIndicator.module.css';

/**
 * KPI 목표 vs 실적 차트/KPI 집계 표가 지금 임시 제외 중인 프로젝트가 있으면 알려주는 배지.
 * 드릴다운 모달을 열지 않고도 "지금 값이 전체 데이터가 아니다"를 바로 알 수 있게 —
 * 제외는 새로고침하면 사라지지만, 그 전까지는 화면에 계속 표시해야 헷갈리지 않는다.
 */
const KpiExcludeIndicator = () => {
  const excludedFiles = useKpiExcludeStore(s => s.excludedFiles);
  const clearExcluded = useKpiExcludeStore(s => s.clearExcluded);
  if (excludedFiles.length === 0) return null;

  return (
    <span className={styles.badge}>
      임시 제외 {excludedFiles.length}건 적용 중
      <Button unstyled className={styles.reset} onClick={clearExcluded}>초기화</Button>
    </span>
  );
};

export default KpiExcludeIndicator;
