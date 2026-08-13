import { useFilterPanelViewModel } from '@/hooks/viewmodels';
import { FilterChip, MultiSelectDropdown } from '@/components/ui';
import { isAllSelected } from '@/utils/array';
import styles from './FilterPanel.module.css';

const FilterPanel = () => {
  const vm = useFilterPanelViewModel();

  const allPartsSelected = isAllSelected(vm.filters.parts, vm.parts);
  const toggleAllParts = () => {
    (allPartsSelected ? vm.filters.parts : vm.parts.filter(p => !vm.filters.parts.includes(p)))
      .forEach(vm.togglePart);
  };

  const allStagesSelected = isAllSelected(vm.filters.stages, vm.stages);
  const toggleAllStages = () => {
    (allStagesSelected ? vm.filters.stages : vm.stages.filter(s => !vm.filters.stages.includes(s)))
      .forEach(vm.toggleStage);
  };

  return (
    <div className={styles.panel}>
      <div className={`${styles.group} ${styles.chipsOnly}`}>
        <span className={styles.label}>연도</span>
        <div className={styles.chips}>
          {vm.years.map(y => (
            <FilterChip key={y} label={y} checked={vm.filters.years.includes(y)}
              onChange={() => vm.toggleYear(y)} onHover={() => vm.prefetchYear(y)} />
          ))}
        </div>
      </div>
      <div className={styles.dropdownOnly}>
        <MultiSelectDropdown label="연도" options={vm.years} selected={vm.filters.years}
          onToggle={vm.toggleYear} onReset={() => vm.filters.years.forEach(vm.toggleYear)} onHover={vm.prefetchYear} />
      </div>

      <div className={`${styles.divider} ${styles.chipsOnly}`} />

      <div className={`${styles.group} ${styles.chipsOnly}`}>
        <span className={styles.label}>파트</span>
        <div className={styles.chips}>
          <FilterChip label="전체" checked={allPartsSelected} onChange={toggleAllParts} />
          {vm.parts.map(p => (
            <FilterChip key={p} label={p} checked={vm.filters.parts.includes(p)}
              onChange={() => vm.togglePart(p)} onHover={() => vm.prefetchPart(p)} />
          ))}
        </div>
      </div>
      <div className={styles.dropdownOnly}>
        <MultiSelectDropdown label="파트" options={vm.parts} selected={vm.filters.parts}
          onToggle={vm.togglePart} onReset={() => vm.filters.parts.forEach(vm.togglePart)} onHover={vm.prefetchPart} />
      </div>

      <div className={`${styles.divider} ${styles.chipsOnly}`} />

      <div className={`${styles.group} ${styles.chipsOnly}`}>
        <span className={styles.label}>보고단계</span>
        <div className={styles.chips}>
          <FilterChip label="전체" checked={allStagesSelected} onChange={toggleAllStages} />
          {vm.stages.map(s => (
            <FilterChip key={s} label={s} checked={vm.filters.stages.includes(s)}
              onChange={() => vm.toggleStage(s)} onHover={() => vm.prefetchStage(s)} />
          ))}
        </div>
      </div>
      <div className={styles.dropdownOnly}>
        <MultiSelectDropdown label="보고단계" options={vm.stages} selected={vm.filters.stages}
          onToggle={vm.toggleStage} onReset={() => vm.filters.stages.forEach(vm.toggleStage)} onHover={vm.prefetchStage} />
      </div>
    </div>
  );
};

export default FilterPanel;
