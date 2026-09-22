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
  const setTeamLabel       = usePerfStore(s => s.setTeamLabel);
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

  // 파트 칩 선택이 바뀔 때마다 팀 라벨을 재계산 — 반대 방향(팀 클릭 → 파트 하이라이트)은
  // handleTeamChange가 이미 처리하니, 여기서는 그 역방향(파트 클릭 → 팀 하이라이트)을 채움.
  // 현재 선택된 파트 집합이 어느 한 팀의 소속 파트 집합과 정확히 같으면 그 팀을 하이라이트,
  // 아니면(팀 선택 중 파트를 건드려 세트가 달라진 경우 포함) "전체 팀"으로 되돌림
  useEffect(() => {
    const matchedTeam = teams.find(team => {
      const expected = (teamParts[team] ?? []).map(stripPartPrefix);
      return expected.length === selectedParts.length && expected.every(p => selectedParts.includes(p));
    }) ?? '';
    setTeamLabel(matchedTeam);
  }, [selectedParts, teams, teamParts, setTeamLabel]);

  return (
    <div className={styles.panel}>
      <div className={`${styles.group} ${styles.chipsOnly}`}>
        <span className={styles.label}>팀</span>
        <div className={styles.chips}>
          <FilterChip label="전체" checked={!selectedTeam} onChange={() => handleTeamChange('')} />
          {teams.map(team => (
            <FilterChip key={team} label={team} checked={selectedTeam === team}
              onChange={() => handleTeamChange(team)} />
          ))}
        </div>
      </div>
      <div className={styles.dropdownOnly}>
        <div className={styles.teamWrap}>
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
