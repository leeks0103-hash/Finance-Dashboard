import { useKpiViewModel } from '@/hooks/viewmodels';
import { KpiCard, ErrorFallback, QueryGate } from '@/components/ui';
import styles from './KpiSection.module.css';

/** 재무 탭 상단 KPI 카드 4개. 로딩/에러/빈 상태 분기는 QueryGate가 담당. */
const KpiSection = () => {
  const vm = useKpiViewModel();

  return (
    <QueryGate
      loading={vm.isLoading}
      error={vm.isError}
      empty={!vm.isLoading && vm.cards.length === 0}
      loadingView={
        <div className={styles.grid}>
          {['a', 'b', 'c', 'd'].map(k => <div key={k} className={styles.skeleton} />)}
        </div>
      }
      errorView={
        <ErrorFallback
          title="KPI 데이터 오류"
          description="데이터를 불러오지 못했습니다. 갱신 버튼을 눌러 재시도해 주세요."
          onRetry={vm.refetch}
        />
      }
      emptyView={
        <div className={styles.grid}>
          <div className={styles.emptyNote}>표시할 재무 데이터가 없습니다.</div>
        </div>
      }
    >
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
    </QueryGate>
  );
};

export default KpiSection;
