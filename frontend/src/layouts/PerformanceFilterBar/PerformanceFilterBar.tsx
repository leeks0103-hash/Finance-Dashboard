import { usePerformanceOptions } from '@/hooks/usePerformanceData';
import { usePerfStore } from '@/store/perf.store';
import { MultiSelectDropdown } from '@/components/ui';
import styles from './PerformanceFilterBar.module.css';

const PerformanceFilterBar = () => {
  const { data: options } = usePerformanceOptions();
  const selectedParts = usePerfStore(s => s.selectedParts);
  const togglePart    = usePerfStore(s => s.togglePart);
  const reset         = usePerfStore(s => s.reset);

  const parts = (options?.parts ?? []).map((p: string) => p.replace(/^[①-⑦]\s*/, ''));

  return (
    <MultiSelectDropdown
      label="파트"
      options={parts}
      selected={selectedParts}
      onToggle={togglePart}
      onReset={reset}
    />
  );
};

export default PerformanceFilterBar;
