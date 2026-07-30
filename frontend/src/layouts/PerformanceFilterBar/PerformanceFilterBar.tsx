import { usePerformanceOptions } from '@/hooks/usePerformanceData';
import { usePerfStore } from '@/store/perf.store';
import { FilterChip, Button } from '@/components/ui';
import styles from './PerformanceFilterBar.module.css';

const PerformanceFilterBar = () => {
  const { data: options } = usePerformanceOptions();
  const selectedParts = usePerfStore(s => s.selectedParts);
  const togglePart    = usePerfStore(s => s.togglePart);
  const reset         = usePerfStore(s => s.reset);

  const parts = options?.parts ?? [];

  return (
    <div className={styles.bar}>
      <span className={styles.label}>파트</span>
      <div className={styles.chips}>
        {parts.map(part => (
          <FilterChip
            key={part}
            label={part.replace(/^[①-⑦]\s*/, '')}
            checked={selectedParts.includes(part)}
            onChange={() => togglePart(part)}
          />
        ))}
      </div>
      {selectedParts.length > 0 && (
        <Button variant="ghost" size="sm" onClick={reset}>초기화</Button>
      )}
    </div>
  );
};

export default PerformanceFilterBar;
