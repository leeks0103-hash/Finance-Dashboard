import { useKpiViewModel } from '@/hooks/viewmodels';
import { KpiCard, ErrorFallback } from '@/components/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useFilters } from '@/hooks';
import styles from './KpiSection.module.css';

const KpiSection = () => {
  const vm = useKpiViewModel();
  const qc = useQueryClient();
  const { filters } = useFilters();

  const handleRetry = () => qc.invalidateQueries({ queryKey: ['summary', filters] });

  if (vm.isError) return (
    <ErrorFallback
      title="KPI 데이터 오류"
      description="데이터를 불러오지 못했습니다. 갱신 버튼을 눌러 재시도해 주세요."
      onRetry={handleRetry}
    />
  );

  // 로딩 중 / 카드 없음 — 같은 스켈레톤 그리드, empty는 dimmed 처리만 다름
  const isPlaceholder = vm.isLoading || vm.cards.length === 0;

  return (
    <div className={styles.grid}>
      {isPlaceholder
        ? [0, 1, 2, 3].map(i => (
            <div key={i} className={`${styles.skeleton} ${vm.isLoading ? '' : styles.dimmed}`} />
          ))
        : vm.cards.map(card => (
            <KpiCard
              key={card.label}
              label={card.label}
              value={card.value}
              accent={card.accent}
              trend={card.trend}
              trendUp={card.trendUp}
            />
          ))}
    </div>
  );
};

export default KpiSection;
