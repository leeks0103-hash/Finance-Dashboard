import { useKpiFilterPanelViewModel } from '@/hooks/viewmodels';
import { FilterChip } from '@/components/ui';
import styles from './KpiFilterBar.module.css';

const KpiFilterBar = () => {
  const vm = useKpiFilterPanelViewModel();

  return (
    <div className={styles.panel}>
      <div className={styles.group}>
        <span className={styles.label}>연도</span>
        <div className={styles.chips}>
          {vm.years.map(y => (
            <FilterChip key={y} label={y} checked={vm.filters.years.includes(y)}
              onChange={() => vm.toggleYear(y)} />
          ))}
        </div>
      </div>

      <div className={styles.divider} />

      <div className={styles.group}>
        <span className={styles.label}>파트</span>
        <div className={styles.chips}>
          {vm.parts.map(p => (
            <FilterChip key={p} label={p} checked={vm.filters.parts.includes(p)}
              onChange={() => vm.togglePart(p)} />
          ))}
        </div>
      </div>

      <div className={styles.divider} />

      <div className={styles.group}>
        <span className={styles.label}>보고단계</span>
        <div className={styles.chips}>
          {vm.stages.map(s => (
            <FilterChip key={s} label={s} checked={vm.filters.stages.includes(s)}
              onChange={() => vm.toggleStage(s)} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default KpiFilterBar;
