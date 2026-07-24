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

  if (vm.isLoading) return (
    <div className={styles.grid}>
      {[0,1,2,3].map(i => <div key={i} className={styles.skeleton} />)}
    </div>
  );

  if (vm.isError) return (
    <ErrorFallback
      title="KPI 데이터 오류"
      description="데이터를 불러오지 못했습니다. 갱신 버튼을 눌러 재시도해 주세요."
      onRetry={handleRetry}
    />
  );

  if (vm.cards.length === 0) return (
    <div className={styles.grid}>
      {[0,1,2,3].map(i => <div key={i} className={`${styles.skeleton} ${styles.dimmed}`} />)}
    </div>
  );

  return (
    <div className={styles.grid}>
      {vm.cards.map(card => (
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
