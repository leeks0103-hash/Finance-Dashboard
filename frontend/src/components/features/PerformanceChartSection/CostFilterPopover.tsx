import type { ChangeEvent } from 'react';
import FilterIcon from '@/components/ui/FilterIcon/FilterIcon';
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
  /** 상단 필터바 선택과 다르면 true — 깔때기 아이콘을 빨간색으로 */
  differs?:     boolean;
}

const ALL = 'all';
const teamValue = (team: string) => `team:${team}`;
const partValue = (part: string) => `part:${part}`;

/**
 * 원가 비율 카드 제목줄의 팀/파트 필터 — 다른 필터 셀렉트(FilterSelect)와 똑같이 생긴
 * 네이티브 <select>. optgroup으로 "팀"/"파트"를 나눠 보여주되 둘은 대등한 개별 선택지다
 * (팀을 먼저 골라야 파트가 나오는 계단식 아님) — 하나를 고르면 다른 쪽은 자동으로 전체로 풀린다.
 */
const CostFilterPopover = ({ teams, selectedTeam, onTeamChange, parts, selectedPart, onPartChange, differs = false }: Props) => {
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
    <span
      className={styles.wrap}
      title={differs ? '상단 필터와 다른 범위를 보고 있습니다 — 이 카드는 상단 필터와 따로 고릅니다' : '이 카드만의 팀/파트 선택(상단 필터와 같은 범위)'}
    >
    {/* 상단 필터바와 같은 깔때기 — 상단 필터와 범위가 다르면 빨간색(2026-10-21) */}
    <FilterIcon className={`${styles.icon} ${differs ? styles.iconDiff : ''}`} />
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
    </span>
  );
};

export default CostFilterPopover;
