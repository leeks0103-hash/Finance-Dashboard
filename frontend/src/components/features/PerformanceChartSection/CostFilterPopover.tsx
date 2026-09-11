import type { ChangeEvent } from 'react';
import styles from './CostFilterPopover.module.css';

interface Props {
  teams:        string[];
  selectedTeam: string;
  onTeamChange: (v: string) => void;
  /** 접두어 제거된 전체 파트 목록(팀 소속과 무관하게 항상 동일한 하나의 평평한 목록) */
  parts:        string[];
  /** 접두어 제거된 값. '전체'가 기본 */
  selectedPart: string;
  onPartChange: (v: string) => void;
}

const ALL = 'all';
const teamValue = (team: string) => `team:${team}`;
const partValue = (part: string) => `part:${part}`;

/**
 * 원가 비율 카드 제목줄의 팀/파트 필터 — 다른 필터 셀렉트(FilterSelect)와 똑같이 생긴
 * 네이티브 <select>. optgroup으로 "팀"/"파트"를 나눠 보여주되 둘은 대등한 개별 선택지다
 * (팀을 먼저 골라야 파트가 나오는 계단식 아님) — 하나를 고르면 다른 쪽은 자동으로 전체로 풀린다.
 */
const CostFilterPopover = ({ teams, selectedTeam, onTeamChange, parts, selectedPart, onPartChange }: Props) => {
  const value = selectedTeam ? teamValue(selectedTeam) : selectedPart !== '전체' ? partValue(selectedPart) : ALL;

  const handleChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value;
    if (v === ALL) { onTeamChange(''); return; }
    const [kind, ...rest] = v.split(':');
    const name = rest.join(':');
    if (kind === 'team') onTeamChange(name);
    else onPartChange(name);
  };

  return (
    <select
      className={styles.select}
      value={value}
      onChange={handleChange}
      aria-label="원가 비율 팀/파트 필터"
    >
      <option value={ALL}>전체</option>
      <optgroup label="팀">
        {teams.map(team => <option key={team} value={teamValue(team)}>{team}</option>)}
      </optgroup>
      <optgroup label="파트">
        {parts.map(part => <option key={part} value={partValue(part)}>{part}</option>)}
      </optgroup>
    </select>
  );
};

export default CostFilterPopover;
