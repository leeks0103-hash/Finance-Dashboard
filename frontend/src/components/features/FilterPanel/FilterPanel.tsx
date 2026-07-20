import { useFilters } from '@/hooks/useFilters';
import { useFilterOptions } from '@/hooks/useFilterOptions';
import { FilterChip } from '@/components/ui';
import styles from './FilterPanel.module.css';

const FilterPanel = () => {
  const { filters, setYear, togglePart, toggleStage } = useFilters();
  const { years, parts, stages } = useFilterOptions();

  return (
    <div className={styles.panel}>
      <div className={styles.group}>
        <span className={styles.label}>연도</span>
        <select
          className={styles.select}
          value={filters.year}
          onChange={e => setYear(e.target.value)}
        >
          <option value="">전체</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <div className={styles.divider} />

      <div className={styles.group}>
        <span className={styles.label}>파트</span>
        <div className={styles.chips}>
          {parts.map(p => (
            <FilterChip
              key={p}
              label={p}
              checked={filters.parts.includes(p)}
              onChange={() => togglePart(p)}
            />
          ))}
        </div>
      </div>

      <div className={styles.divider} />

      <div className={styles.group}>
        <span className={styles.label}>보고단계</span>
        <div className={styles.chips}>
          {stages.map(s => (
            <FilterChip
              key={s}
              label={s}
              checked={filters.stages.includes(s)}
              onChange={() => toggleStage(s)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default FilterPanel;
