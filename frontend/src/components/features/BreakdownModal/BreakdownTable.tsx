import { useMemo, useState, type ReactNode } from 'react';
import styles from './BreakdownTable.module.css';

export interface BreakdownColumn<R> {
  key:       string;
  header:    string;
  /** 짧은 분류값(파트·보고단계 등)은 center, 숫자값은 right, 코드·이름처럼 긴 텍스트는 기본(left) */
  align?:    'left' | 'right' | 'center';
  /** 파일명처럼 긴 텍스트인데 nowrap이면 표가 옆으로 넘칠 수 있는 컬럼 — 줄바꿈 허용 */
  wrap?:     boolean;
  /** 코드처럼 짧은 게 보통인데 placeholder 값이 길어질 수 있는 컬럼 — 말줄임표로 자르고
   *  title(브라우저 기본 툴팁)로 전체 텍스트 확인. 이 표는 컬럼 리사이즈가 안 되고, 어차피
   *  CopyText가 title로 전체 텍스트를 보여주므로 wrap(여러 줄)보다 이쪽이 행 높이가 안정적 */
  truncate?: boolean;
  /** truncate 컬럼의 최대 폭(px, 기본 220) — 코드처럼 짧게 두고 싶은 컬럼용 */
  maxWidth?: number;
  /** 정렬용 원시값 */
  sortValue: (row: R) => string | number;
  /** 화면 표시 */
  render:    (row: R) => ReactNode;
  /** true면 같은 묶음(groupKey) 행끼리 이 칸을 셀 병합(rowSpan) — 묶음 첫 행에만 그림 */
  groupSpan?: (row: R) => boolean;
}

const alignClass = (align: BreakdownColumn<unknown>['align']) =>
  align === 'right' ? styles.right : align === 'center' ? styles.center : '';

interface Props<R> {
  columns:    BreakdownColumn<R>[];
  rows:       R[];
  /** 합계행 — 정렬과 무관하게 항상 맨 아래 고정 */
  totalLabel: string;
  /** 합계값 한 칸 — totalValues를 주면 무시 */
  totalValue?: ReactNode;
  /** 합계값 여러 칸 — 라벨 다음 열부터 한 칸씩(예: 계획 합계 | 실적 합계) */
  totalValues?: ReactNode[];
  /** 합계 라벨 셀이 차지할 열 수 */
  totalSpan:  number;
  /** 초기 정렬 컬럼 key (기본: 마지막 컬럼, 내림차순). 어떤 컬럼과도 안 맞으면 rows 순서 그대로 */
  defaultSortKey?: string;
  /** 행별 추가 클래스(예: 임시 제외된 행 흐리게) — 지정 없으면 기존과 동일 */
  rowClassName?: (row: R) => string | undefined;
  /** 같은 값을 돌려주는 행끼리 정렬 후에도 붙여서 보여줌(묶음 첫 행 자리에 모음). null이면 묶음 아님 */
  groupKey?: (row: R) => string | null | undefined;
}

const arrow = (state: 'asc' | 'desc' | null) =>
  state === 'asc' ? '▲' : state === 'desc' ? '▼' : '↕';

export function BreakdownTable<R>({
  columns, rows, totalLabel, totalValue, totalValues, totalSpan, defaultSortKey, rowClassName, groupKey,
}: Props<R>) {
  const lastKey = columns[columns.length - 1]?.key;
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' }>(
    { key: defaultSortKey ?? lastKey, dir: 'desc' },
  );
  const totals = totalValues ?? [totalValue];

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

  // 묶음 행은 정렬 뒤 첫 행 자리에 모으고, 행마다 묶음 크기·첫 행 여부를 기록(셀 병합용)
  const laidOut = useMemo(() => {
    if (!groupKey) return sorted.map(row => ({ row, span: 1, first: true }));
    const members = new Map<string, R[]>();
    for (const r of sorted) {
      const g = groupKey(r);
      if (g) members.set(g, [...(members.get(g) ?? []), r]);
    }
    const out: { row: R; span: number; first: boolean }[] = [];
    const placed = new Set<string>();
    for (const r of sorted) {
      const g = groupKey(r);
      if (!g) { out.push({ row: r, span: 1, first: true }); continue; }
      if (placed.has(g)) continue;
      placed.add(g);
      const ms = members.get(g)!;
      ms.forEach((m, i) => out.push({ row: m, span: ms.length, first: i === 0 }));
    }
    return out;
  }, [sorted, groupKey]);

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
                className={`${alignClass(c.align)} ${sort.key === c.key ? styles.active : ''}`}
                onClick={() => onHeader(c.key)}
                title={c.header}
              >
                <span className={styles.headerLabel}>{c.header}</span>
                <span className={styles.sortIcon}>{arrow(sort.key === c.key ? sort.dir : null)}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {laidOut.map(({ row, span, first }, i) => (
            <tr key={i} className={rowClassName?.(row)}>
              {columns.map((c, ci) => {
                const merged = span > 1 && !!c.groupSpan?.(row);
                if (merged && !first) return null;
                return (
                <td
                  key={c.key}
                  rowSpan={merged ? span : undefined}
                  className={`${alignClass(c.align)} ${c.wrap ? styles.wrapCell : ''} ${merged ? styles.spanCell : ''} ${ci === columns.length - 1 ? styles.lastCol : ''}`}
                >
                  {/* 표 칸(td)의 max-width는 브라우저가 무시하기도 해서 안쪽 div로 자름 — 가로 스크롤 방지 */}
                  {c.truncate
                    ? <div className={styles.truncateCell} style={c.maxWidth ? { maxWidth: c.maxWidth } : undefined}>{c.render(row)}</div>
                    : c.render(row)}
                </td>
                );
              })}
            </tr>
          ))}
          <tr className={styles.totalRow}>
            <td colSpan={totalSpan}>{totalLabel}</td>
            {totals.map((v, i) => <td key={i} className={styles.right}>{v}</td>)}
            {/* 합계값 칸 뒤에 남는 컬럼(예: 파일명)이 있으면 그만큼 마저 채움 */}
            {columns.length - totalSpan - totals.length > 0 && (
              <td colSpan={columns.length - totalSpan - totals.length} />
            )}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default BreakdownTable;
