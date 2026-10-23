import { useMemo, useState } from 'react';
import { Button } from '@/components/ui';
import { useExtractCoverage } from '@/hooks/useExtractCoverage';
import { useDataHealth } from '@/hooks/useDataHealth';
import type { CoverageStatus, ExtractTarget } from '@/types/extract.types';
import styles from './ExtractFilePicker.module.css';

const STATUS_LABEL: Record<CoverageStatus, string> = {
  extracted: '반영됨',
  merged:    '다른 보고서로 반영',
  no_table:  '표 없음',
  failed:    '열기 실패',
  pending:   '아직 안 읽음',
};
// 확인이 필요한 상태를 위로
const STATUS_RANK: Record<CoverageStatus, number> = { failed: 0, pending: 1, merged: 2, no_table: 3, extracted: 4 };

interface Row {
  file: string;
  finance?: CoverageStatus;
  kpi?: CoverageStatus;
  /** 데이터 이상(Navbar "!" 배지)에 걸린 이유 — 있으면 목록 맨 위·빨간 행 */
  issues?: string[];
  /** 담당자가 '수정 완료'를 누른 시각·사람 — 빨간 행 그대로 두고 배지(재추출할 파일), 빨간 행 중 맨 위 */
  ack?: { at: string; by: string };
}

interface Props {
  selected: string[];
  onChange: (files: string[]) => void;
  targets: ExtractTarget[];
  disabled?: boolean;
}

/**
 * "선택한 파일만 다시 추출"용 파일 고르기(2026-10-19) — 추출 현황과 같은 원본 폴더 목록.
 * 재무·KPI 대상 폴더 규칙이 달라(KPI는 깊이 2까지) 파일마다 두 쪽 상태를 따로 보여 줌. 지금 고른 대상에 없는 파일은 고를 수 없음
 */
const ExtractFilePicker = ({ selected, onChange, targets, disabled }: Props) => {
  const { data, isLoading } = useExtractCoverage(true, undefined);
  const { data: health } = useDataHealth();
  const [query, setQuery] = useState('');

  // 데이터 이상("!")에 걸린 파일 → 이유. '생성 예정'류(pending)는 배지에 안 뜨므로 제외
  const issuesByFile = useMemo(() => {
    const m = new Map<string, string[]>();
    const add = (f: string, why: string) => {
      if (!f) return;
      const list = m.get(f) ?? [];
      if (!list.includes(why)) list.push(why);
      m.set(f, list);
    };
    for (const r of health?.rows ?? []) if (!r.pending) add(r.file, 'KPI ↔ 재무 코드 불일치');
    for (const c of health?.conflicts ?? []) {
      if (!c.pending) for (const f of c.files) add(f, `코드 충돌(${c.source} ${c.code})`);
    }
    for (const a of health?.finished_anomalies ?? []) add(a.filename, '완료 보고에 매출·직접원가 외 값');
    return m;
  }, [health]);

  const rows = useMemo<Row[]>(() => {
    const map = new Map<string, Row>();
    for (const t of ['finance', 'kpi'] as const) {
      for (const it of data?.[t]?.items ?? []) {
        const r = map.get(it.file) ?? { file: it.file };
        r[t] = it.status;
        r.issues = issuesByFile.get(it.file);
        r.ack = health?.acks?.[it.file];
        map.set(it.file, r);
      }
    }
    // 데이터 이상 파일이 맨 위, 그다음 상태(실패·미처리 …) 순
    const rank = (r: Row) => (r.issues ? (r.ack ? -20 : -10) : 0) + Math.min(
      r.finance ? STATUS_RANK[r.finance] : 9, r.kpi ? STATUS_RANK[r.kpi] : 9);
    return [...map.values()].sort((a, b) => rank(a) - rank(b) || a.file.localeCompare(b.file, 'ko'));
  }, [data, issuesByFile, health]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const q = query.trim().toLowerCase();
  const visible = q ? rows.filter(r => r.file.toLowerCase().includes(q)) : rows;
  const inTargets = (r: Row) => targets.some(t => r[t] !== undefined);

  const toggle = (file: string) =>
    onChange(selectedSet.has(file) ? selected.filter(f => f !== file) : [...selected, file]);

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <input
          className={styles.search}
          type="search"
          placeholder="파일명 검색"
          value={query}
          onChange={e => setQuery(e.target.value)}
          disabled={disabled}
        />
        <span className={styles.count}>선택 {selected.length}개</span>
        <Button variant="ghost" size="sm" onClick={() => onChange([])} disabled={disabled || selected.length === 0}>
          선택 해제
        </Button>
      </div>
      <ul className={styles.list}>
        {isLoading && <li className={styles.empty}>원본 폴더 목록 불러오는 중…</li>}
        {!isLoading && visible.length === 0 && <li className={styles.empty}>맞는 파일이 없습니다</li>}
        {visible.map(r => {
          const usable = inTargets(r);
          const tip = [r.file, ...(r.issues ?? []).map(w => `! ${w}`),
            ...(r.ack ? [`✓ 수정 완료${r.ack.by ? ` · ${r.ack.by}` : ''} · ${r.ack.at} — 다시 추출하세요`] : []),
            ...(usable ? [] : ['지금 고른 대상(재무/KPI)의 추출 범위가 아닌 파일'])].join('\n');
          return (
            <li key={r.file}>
              <label className={`${styles.item} ${usable ? '' : styles.itemOff} ${r.issues ? styles.itemIssue : ''}`}
                title={tip}>
                <input
                  type="checkbox"
                  checked={selectedSet.has(r.file)}
                  onChange={() => toggle(r.file)}
                  disabled={disabled || (!usable && !selectedSet.has(r.file))}
                />
                <span className={styles.file}>
                  {r.issues && <span className={styles.issueMark} aria-label="데이터 이상">!</span>}
                  {r.file}
                  {r.ack && <span className={styles.ackBadge}>✓ 수정 완료</span>}
                </span>
                <span className={styles.status}>
                  {(['finance', 'kpi'] as const).map(t => r[t] && (
                    <span key={t} className={`${styles.pill} ${styles[`pill_${r[t]}`]}`}>
                      {t === 'finance' ? '재무' : 'KPI'} {STATUS_LABEL[r[t]!]}
                    </span>
                  ))}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default ExtractFilePicker;
