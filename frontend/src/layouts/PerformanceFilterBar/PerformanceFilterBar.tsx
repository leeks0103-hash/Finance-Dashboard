import { usePerformanceOptions } from '@/hooks/usePerformanceData';
import { usePerfStore } from '@/store/perf.store';
import { MultiSelectDropdown } from '@/components/ui';
import styles from './PerformanceFilterBar.module.css';

const PerformanceFilterBar = () => {
  const { data: options } = usePerformanceOptions();
  const selectedParts = usePerfStore(s => s.selectedParts);
  const togglePart    = usePerfStore(s => s.togglePart);
  const selectedTeam  = usePerfStore(s => s.selectedTeam);
  const setTeam       = usePerfStore(s => s.setTeam);
  const reset         = usePerfStore(s => s.reset);

  const parts = (options?.parts ?? []).map((p: string) => p.replace(/^[①-⑦]\s*/, ''));
  const teams = options?.teams ?? [];

  return (
    <div className={styles.panel}>
      <MultiSelectDropdown
        label="파트"
        options={parts}
        selected={selectedParts}
        onToggle={togglePart}
        onReset={reset}
      />
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
