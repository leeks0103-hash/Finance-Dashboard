import { usePerformanceOptions } from '@/hooks/usePerformanceData';
import { usePerfStore } from '@/store/perf.store';
import { FilterChip, MultiSelectDropdown } from '@/components/ui';
import { isAllSelected } from '@/utils/array';
import styles from './PerformanceFilterBar.module.css';

const PerformanceFilterBar = () => {
  const { data: options } = usePerformanceOptions();
  const selectedParts = usePerfStore(s => s.selectedParts);
  const togglePart    = usePerfStore(s => s.togglePart);
  const selectedTeam  = usePerfStore(s => s.selectedTeam);
  const setTeam       = usePerfStore(s => s.setTeam);

  const parts = (options?.parts ?? []).map((p: string) => p.replace(/^[①-⑦]\s*/, ''));
  const teams = options?.teams ?? [];

  const allPartsSelected = isAllSelected(selectedParts, parts);
  const toggleAllParts = () => {
    (allPartsSelected ? selectedParts : parts.filter(p => !selectedParts.includes(p)))
      .forEach(togglePart);
  };

  return (
    <div className={styles.panel}>
      <div className={`${styles.group} ${styles.chipsOnly}`}>
        <span className={styles.label}>파트</span>
        <div className={styles.chips}>
          <FilterChip label="전체" checked={allPartsSelected} onChange={toggleAllParts} />
          {parts.map(p => (
            <FilterChip key={p} label={p} checked={selectedParts.includes(p)}
              onChange={() => togglePart(p)} />
          ))}
        </div>
      </div>
      <div className={styles.dropdownOnly}>
        <MultiSelectDropdown label="파트" options={parts} selected={selectedParts}
          onToggle={togglePart} onReset={() => selectedParts.forEach(togglePart)} />
      </div>
      <div className={styles.teamWrap}>
        <select
          className={`${styles.teamSelect} ${selectedTeam ? styles.active : ''}`}
          value={selectedTeam}
          onChange={e => setTeam(e.target.value)}
        >
          <option value="">전체 팀</option>
          {teams.map(team => (
            <option key={team} value={team}>{team}</option>
          ))}
        </select>
        <span className={styles.teamArrow}>▾</span>
      </div>
    </div>
  );
};

export default PerformanceFilterBar;
