import { useFilterPanelViewModel } from '@/hooks/viewmodels';
import { FilterChip } from '@/components/ui';
import styles from './FilterPanel.module.css';

const FilterPanel = () => {
  const vm = useFilterPanelViewModel();

  return (
    <div className={styles.panel}>
      <div className={styles.group}>
        <span className={styles.label}>연도</span>
        <div className={styles.chips}>
          <FilterChip label="전체" checked={vm.filters.year === ''} onChange={() => vm.setYear('')} />
          {vm.years.map(y => (
            <FilterChip key={y} label={y} checked={vm.filters.year === y}
              onChange={() => vm.toggleYear(y)} onHover={() => vm.prefetchYear(y)} />
          ))}
        </div>
      </div>

      <div className={styles.divider} />

      <div className={styles.group}>
        <span className={styles.label}>파트</span>
        <div className={styles.chips}>
          {vm.parts.map(p => (
            <FilterChip key={p} label={p} checked={vm.filters.parts.includes(p)}
              onChange={() => vm.togglePart(p)} onHover={() => vm.prefetchPart(p)} />
          ))}
        </div>
      </div>

      <div className={styles.divider} />

      <div className={styles.group}>
        <span className={styles.label}>보고단계</span>
        <div className={styles.chips}>
          {vm.stages.map(s => (
            <FilterChip key={s} label={s} checked={vm.filters.stages.includes(s)}
              onChange={() => vm.toggleStage(s)} onHover={() => vm.prefetchStage(s)} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default FilterPanel;
