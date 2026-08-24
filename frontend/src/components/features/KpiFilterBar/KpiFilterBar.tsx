import { useKpiFilterPanelViewModel } from '@/hooks/viewmodels';
import { FilterPanelView } from '@/components/ui';

const KpiFilterBar = () => {
  const vm = useKpiFilterPanelViewModel();
  return <FilterPanelView {...vm} />;
};

export default KpiFilterBar;
