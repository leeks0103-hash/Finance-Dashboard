import type { ChangeEvent } from 'react';
import styles from './FilterSelect.module.css';

export interface FilterSelectOption {
  value: string;
  label: string;
}

interface Props {
  value:      string;
  onChange:   (value: string) => void;
  /** 문자열 배열이면 value = label 로 간주 */
  options:    readonly (string | FilterSelectOption)[];
  /** 맨 위 '전체' 항목 라벨. null 이면 표시 안 함 (기본 "전체") */
  allLabel?:  string | null;
  /** 셀렉트 앞에 붙는 텍스트 라벨 (예: "파트") */
  label?:     string;
  ariaLabel?: string;
}

const norm = (o: string | FilterSelectOption): FilterSelectOption =>
  typeof o === 'string' ? { value: o, label: o } : o;

/**
 * 필터용 드롭다운 — DataTable 검색범위 셀렉트와 동일한 스타일.
 * 페이지 곳곳에서 반복되던 `<select className={styles.filterSelect}>` 패턴을 하나로.
 */
export const FilterSelect = ({
  value, onChange, options, allLabel = '전체', label, ariaLabel,
}: Props) => (
  <span className={styles.wrap}>
    {label && <span className={styles.label}>{label}</span>}
    <select
      className={styles.select}
      value={value}
      aria-label={ariaLabel ?? label}
      onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange(e.target.value)}
    >
      {allLabel != null && <option value="">{allLabel}</option>}
      {options.map(norm).map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  </span>
);

export default FilterSelect;
