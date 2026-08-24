import { useFilterPanelViewModel } from '@/hooks/viewmodels';
import { FilterPanelView } from '@/components/ui';

const FilterPanel = () => {
  const vm = useFilterPanelViewModel();
  return <FilterPanelView {...vm} />;
};

export default FilterPanel;
