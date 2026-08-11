import { useKpiFilterPanelViewModel } from '@/hooks/viewmodels';
import { MultiSelectDropdown } from '@/components/ui';
import styles from './KpiFilterBar.module.css';

const KpiFilterBar = () => {
  const vm = useKpiFilterPanelViewModel();

  return (
    <div className={styles.panel}>
      <MultiSelectDropdown
        label="연도"
        options={vm.years}
        selected={vm.filters.years}
        onToggle={vm.toggleYear}
        onReset={() => vm.filters.years.forEach(vm.toggleYear)}
      />
      <MultiSelectDropdown
        label="파트"
        options={vm.parts}
        selected={vm.filters.parts}
        onToggle={vm.togglePart}
        onReset={() => vm.filters.parts.forEach(vm.togglePart)}
      />
      <MultiSelectDropdown
        label="보고단계"
        options={vm.stages}
        selected={vm.filters.stages}
        onToggle={vm.toggleStage}
        onReset={() => vm.filters.stages.forEach(vm.toggleStage)}
      />
    </div>
  );
};

export default KpiFilterBar;
