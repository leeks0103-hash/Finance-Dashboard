import { useMemo, useState, type ReactNode } from 'react';
import styles from './BreakdownTable.module.css';

export interface BreakdownColumn<R> {
  key:       string;
  header:    string;
  align?:    'left' | 'right';
  /** 정렬용 원시값 */
  sortValue: (row: R) => string | number;
  /** 화면 표시 */
  render:    (row: R) => ReactNode;
}

interface Props<R> {
  columns:    BreakdownColumn<R>[];
  rows:       R[];
  /** 합계행 — 정렬과 무관하게 항상 맨 아래 고정 */
  totalLabel: string;
  totalValue: ReactNode;
  /** 합계 라벨 셀이 차지할 열 수 (마지막 값 열 제외) */
  totalSpan:  number;
  /** 초기 정렬 컬럼 key (기본: 마지막 컬럼, 내림차순) */
  defaultSortKey?: string;
}

const arrow = (state: 'asc' | 'desc' | null) =>
  state === 'asc' ? '▲' : state === 'desc' ? '▼' : '↕';

export function BreakdownTable<R>({
  columns, rows, totalLabel, totalValue, totalSpan, defaultSortKey,
}: Props<R>) {
  const lastKey = columns[columns.length - 1]?.key;
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' }>(
    { key: defaultSortKey ?? lastKey, dir: 'desc' },
  );

  const sorted = useMemo(() => {
    const col = columns.find(c => c.key === sort.key);
    if (!col) return rows;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = col.sortValue(a);
      const vb = col.sortValue(b);
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return String(va).localeCompare(String(vb), 'ko') * dir;
    });
  }, [rows, columns, sort]);

  const onHeader = (key: string) =>
    setSort(s => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));

  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            {columns.map(c => (
              <th
                key={c.key}
                className={`${c.align === 'right' ? styles.right : ''} ${sort.key === c.key ? styles.active : ''}`}
                onClick={() => onHeader(c.key)}
              >
                {c.header}
                <span className={styles.sortIcon}>{arrow(sort.key === c.key ? sort.dir : null)}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr key={i}>
              {columns.map(c => (
                <td key={c.key} className={c.align === 'right' ? styles.right : ''}>
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
          <tr className={styles.totalRow}>
            <td colSpan={totalSpan}>{totalLabel}</td>
            <td className={styles.right}>{totalValue}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default BreakdownTable;
