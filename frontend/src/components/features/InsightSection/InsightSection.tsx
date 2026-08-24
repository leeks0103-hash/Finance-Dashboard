import { useInsightViewModel } from '@/hooks/viewmodels';
import { InsightSectionView } from '@/components/ui';
import { useQuickSearchStore } from '@/store/quickSearch.store';

const InsightSection = () => {
  const vm = useInsightViewModel();
  const setFinanceSearch = useQuickSearchStore(s => s.setFinance);

  return (
    <InsightSectionView
      isLoading={vm.isLoading}
      isEmpty={vm.isEmpty}
      heading="재무 인사이트"
      comments={vm.comments}
      onCodeSearch={setFinanceSearch}
      lists={[
        { variant: 'profit', title: '이익율 상위',   rows: vm.top },
        { variant: 'risk',   title: '저수익 / 손실', rows: vm.risk },
      ]}
    />
  );
};

export default InsightSection;
