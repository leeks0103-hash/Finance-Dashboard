import { FilterChip } from '../FilterChip';
import { MultiSelectDropdown } from '../MultiSelectDropdown';
import { isAllSelected } from '@/utils/array';
import type { Filters } from '@/types';
import styles from './FilterPanelView.module.css';

interface DimensionProps {
  label:         string;
  options:       string[];
  selected:      string[];
  onToggle:      (value: string) => void;
  onHover?:      (value: string) => void;
  /** 연도는 개별 선택이 자연스러워 "전체" 칩을 안 씀 — 파트/보고단계만 켬 */
  showSelectAll: boolean;
}

function FilterDimension({ label, options, selected, onToggle, onHover, showSelectAll }: DimensionProps) {
  const allSelected = isAllSelected(selected, options);
  const toggleAll = () => {
    (allSelected ? selected : options.filter(o => !selected.includes(o))).forEach(onToggle);
  };

  return (
    <>
      <div className={`${styles.group} ${styles.chipsOnly}`}>
        <span className={styles.label}>{label}</span>
        <div className={styles.chips}>
          {showSelectAll && <FilterChip label="전체" checked={allSelected} onChange={toggleAll} />}
          {options.map(o => (
            <FilterChip key={o} label={o} checked={selected.includes(o)}
              onChange={() => onToggle(o)} onHover={onHover ? () => onHover(o) : undefined} />
          ))}
        </div>
      </div>
      <div className={styles.dropdownOnly}>
        <MultiSelectDropdown label={label} options={options} selected={selected}
          onToggle={onToggle} onReset={() => selected.forEach(onToggle)} onHover={onHover} />
      </div>
    </>
  );
}

interface Props {
  filters: Filters;
  years:   string[];
  parts:   string[];
  stages:  string[];
  toggleYear:  (year: string) => void;
  togglePart:  (part: string) => void;
  toggleStage: (stage: string) => void;
  /** 재무 탭만 필터 조합 미리 fetch — KPI는 옵션 소스가 가벼워서 생략 가능 */
  prefetchYear?:  (year: string) => void;
  prefetchPart?:  (part: string) => void;
  prefetchStage?: (stage: string) => void;
}

/** 재무/KPI 필터 패널 공용 레이아웃 — 연도/파트/보고단계 3차원, 넓은 화면은 칩·좁은 화면은 드롭다운 */
export const FilterPanelView = ({
  filters, years, parts, stages,
  toggleYear, togglePart, toggleStage,
  prefetchYear, prefetchPart, prefetchStage,
}: Props) => (
  <div className={styles.panel}>
    <FilterDimension label="연도" options={years} selected={filters.years}
      onToggle={toggleYear} onHover={prefetchYear} showSelectAll={false} />

    <div className={`${styles.divider} ${styles.chipsOnly}`} />

    <FilterDimension label="파트" options={parts} selected={filters.parts}
      onToggle={togglePart} onHover={prefetchPart} showSelectAll />

    <div className={`${styles.divider} ${styles.chipsOnly}`} />

    <FilterDimension label="보고단계" options={stages} selected={filters.stages}
      onToggle={toggleStage} onHover={prefetchStage} showSelectAll />
  </div>
);
