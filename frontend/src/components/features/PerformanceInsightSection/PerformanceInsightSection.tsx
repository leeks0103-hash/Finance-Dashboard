import { usePerformanceInsightViewModel } from '@/hooks/viewmodels';
import { InsightSectionView } from '@/components/ui';
import { useQuickSearchStore } from '@/store/quickSearch.store';

const PerformanceInsightSection = () => {
  const vm = usePerformanceInsightViewModel();
  const setPerfSearch = useQuickSearchStore(s => s.setPerf);

  return (
    <InsightSectionView
      isLoading={vm.isLoading}
      isEmpty={vm.isEmpty}
      heading="실적 인사이트"
      comments={vm.comments}
      onCodeSearch={setPerfSearch}
      lists={[
        { variant: 'default', title: '목표 대비 부진', rows: vm.worst },
        { variant: 'risk',    title: '손실 / 저수익',  rows: vm.risk },
      ]}
    />
  );
};

export default PerformanceInsightSection;
