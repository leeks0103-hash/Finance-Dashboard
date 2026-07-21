import { useFilterPanelViewModel } from '@/hooks/viewmodels';
import { FilterChip } from '@/components/ui';
import styles from './FilterPanel.module.css';

const FilterPanel = () => {
  const vm = useFilterPanelViewModel();

  return (
    <div className={styles.panel}>
      <div className={styles.group}>
        <span className={styles.label}>연도</span>
        <select
          className={styles.select}
          value={vm.filters.year}
          onChange={e => vm.setYear(e.target.value)}
          onMouseEnter={vm.prefetchYears}
        >
          <option value="">전체</option>
          {vm.years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <div className={styles.divider} />

      <div className={styles.group}>
        <span className={styles.label}>파트</span>
        <div className={styles.chips}>
          {vm.parts.map(p => (
            <FilterChip
              key={p}
              label={p}
              checked={vm.filters.parts.includes(p)}
              onChange={() => vm.togglePart(p)}
              onHover={() => vm.prefetchPart(p)}
            />
          ))}
        </div>
      </div>

      <div className={styles.divider} />

      <div className={styles.group}>
        <span className={styles.label}>보고단계</span>
        <div className={styles.chips}>
          {vm.stages.map(s => (
            <FilterChip
              key={s}
              label={s}
              checked={vm.filters.stages.includes(s)}
              onChange={() => vm.toggleStage(s)}
              onHover={() => vm.prefetchStage(s)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default FilterPanel;
