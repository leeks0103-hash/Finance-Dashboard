import { useEffect } from 'react';
import { usePerformanceOptions } from '@/hooks/usePerformanceData';
import { stripPartPrefix } from '@/utils';
import { sortParts } from '@/utils/partOrder';
import { usePerfStore } from '@/store/perf.store';
import { FilterChip, MultiSelectDropdown } from '@/components/ui';
import { isAllSelected } from '@/utils/array';
import styles from './PerformanceFilterBar.module.css';

const PerformanceFilterBar = () => {
  const { data: options } = usePerformanceOptions();
  const selectedParts      = usePerfStore(s => s.selectedParts);
  const togglePart         = usePerfStore(s => s.togglePart);
  const selectedTeam       = usePerfStore(s => s.selectedTeam);
  const setTeam            = usePerfStore(s => s.setTeam);
  const clearTeamLabel     = usePerfStore(s => s.clearTeamLabel);
  const initialized        = usePerfStore(s => s.initialized);
  const initializeDefaults = usePerfStore(s => s.initializeDefaults);

  const parts = sortParts((options?.parts ?? []).map(stripPartPrefix));
  const teams = options?.teams ?? [];
  const teamParts = options?.team_parts ?? {};

  // 최초 방문 시 한 번만 — 파트 전체 선택 상태로 시작
  useEffect(() => {
    if (!initialized && parts.length) {
      initializeDefaults(parts);
    }
  }, [initialized, parts, initializeDefaults]);

  const allPartsSelected = isAllSelected(selectedParts, parts);
  const toggleAllParts = () => {
    (allPartsSelected ? selectedParts : parts.filter(p => !selectedParts.includes(p)))
      .forEach(togglePart);
  };

  // 팀 선택 시 그 팀 소속 파트로 칩 동기화 — "전체 팀"이면 전체 파트로 복원
  const handleTeamChange = (team: string) => {
    const nextParts = team ? (teamParts[team] ?? []).map(stripPartPrefix) : parts;
    setTeam(team, nextParts);
  };

  // 팀 선택 상태에서 파트 칩을 수동으로 건드려 그 팀 소속 세트와 달라지면(추가/해제 모두)
  // 팀 드롭박스를 "전체 팀"으로 되돌림 — 실제 필터(파트 선택)는 그대로 두고 라벨만 정정
  useEffect(() => {
    if (!selectedTeam) return;
    const expected = (teamParts[selectedTeam] ?? []).map(stripPartPrefix);
    const matches = expected.length === selectedParts.length && expected.every(p => selectedParts.includes(p));
    if (!matches) clearTeamLabel();
  }, [selectedParts, selectedTeam, teamParts, clearTeamLabel]);

  return (
    <div className={styles.panel}>
      <div className={styles.teamWrap}>
        <span className={styles.label}>팀</span>
        <select
          className={`${styles.teamSelect} ${selectedTeam ? styles.active : ''}`}
          value={selectedTeam}
          onChange={e => handleTeamChange(e.target.value)}
        >
          <option value="">전체 팀</option>
          {teams.map(team => (
            <option key={team} value={team}>{team}</option>
          ))}
        </select>
        <span className={styles.teamArrow}>▾</span>
      </div>
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
    </div>
  );
};

export default PerformanceFilterBar;
