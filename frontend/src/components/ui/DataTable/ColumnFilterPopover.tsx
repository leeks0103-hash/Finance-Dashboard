import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../Button';
import { useEscToClose } from '../useEscToClose';
import type { ColumnFilterSpec, ColumnFilterValue } from '@/types/columnFilter.types';
import styles from './ColumnFilterPopover.module.css';

interface Props {
  anchor:  HTMLElement;
  colId:   string;
  title:   string;
  spec:    ColumnFilterSpec;
  /** select 열의 고를 값 목록 */
  options?: string[];
  value?:  ColumnFilterValue;
  /** null = 이 열 필터 해제 */
  onApply: (v: ColumnFilterValue | null) => void;
  onClose: () => void;
}

const W = 260;
const EDGE = 12;
const UNIT_LABEL = { eok: '억', pct: '%' } as const;

const parseNum = (s: string): number | null => {
  const t = s.replace(/,/g, '').trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

/** 머리글 깔때기를 누르면 그 열 아래에 뜨는 필터 창 — body 포털 + fixed(표의 overflow에 안 잘리게) */
export const ColumnFilterPopover = ({ anchor, colId, title, spec, options = [], value, onApply, onClose }: Props) => {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  useEscToClose(onClose);

  // 입력 상태 — 적용 버튼(또는 Enter)을 눌러야 서버에 걸림
  const [q, setQ] = useState(value?.type === 'text' ? value.q : '');
  const [picked, setPicked] = useState<Set<string>>(
    () => new Set(value?.type === 'select' ? value.values : []));
  const [find, setFind] = useState('');
  const [min, setMin] = useState(value?.type === 'number' && value.min != null ? String(value.min) : '');
  const [max, setMax] = useState(value?.type === 'number' && value.max != null ? String(value.max) : '');

  // 깔때기 오른쪽 끝에 맞춰 아래로, 화면 밖으로 안 나가게
  useLayoutEffect(() => {
    const place = () => {
      const r = anchor.getBoundingClientRect();
      const left = Math.min(Math.max(EDGE, r.right - W), window.innerWidth - W - EDGE);
      setPos({ top: r.bottom + 6, left });
    };
    place();
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || anchor.contains(t)) return;
      onClose();
    };
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    document.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
      document.removeEventListener('mousedown', onDown);
    };
  }, [anchor, onClose]);

  const shown = useMemo(() => {
    const f = find.trim().toLowerCase();
    return f ? options.filter(o => o.toLowerCase().includes(f)) : options;
  }, [options, find]);

  const minN = parseNum(min);
  const maxN = parseNum(max);
  const numInvalid = (min.trim() !== '' && minN == null) || (max.trim() !== '' && maxN == null)
    || (minN != null && maxN != null && minN > maxN);

  const apply = () => {
    if (spec.type === 'text') {
      onApply(q.trim() ? { id: colId, type: 'text', q: q.trim() } : null);
    } else if (spec.type === 'select') {
      onApply(picked.size ? { id: colId, type: 'select', values: [...picked] } : null);
    } else {
      if (numInvalid) return;
      onApply(minN == null && maxN == null ? null : { id: colId, type: 'number', unit: spec.unit, min: minN, max: maxN });
    }
    onClose();
  };
  const onKey = (e: React.KeyboardEvent) => { if (e.key === 'Enter') apply(); };

  const toggle = (o: string) => setPicked(prev => {
    const next = new Set(prev);
    if (next.has(o)) next.delete(o); else next.add(o);
    return next;
  });
  const allShownPicked = shown.length > 0 && shown.every(o => picked.has(o));
  const toggleAllShown = () => setPicked(prev => {
    const next = new Set(prev);
    shown.forEach(o => (allShownPicked ? next.delete(o) : next.add(o)));
    return next;
  });

  return createPortal(
    <div ref={ref} className={styles.pop}
      style={{ width: W, top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}
      role="dialog" aria-label={`${title} 필터`}>
      <div className={styles.head}>{title}</div>

      {spec.type === 'text' && (
        <input className={styles.input} autoFocus placeholder="포함하는 글자" value={q}
          onChange={e => setQ(e.target.value)} onKeyDown={onKey} />
      )}

      {spec.type === 'select' && <>
        <input className={styles.input} autoFocus placeholder="목록에서 찾기" value={find}
          onChange={e => setFind(e.target.value)} onKeyDown={onKey} />
        <label className={`${styles.option} ${styles.optionAll}`}>
          <input type="checkbox" checked={allShownPicked} onChange={toggleAllShown} />
          <span>{find.trim() ? '찾은 항목 전체' : '전체'}</span>
        </label>
        <div className={styles.list}>
          {shown.length === 0 && <div className={styles.empty}>일치하는 항목 없음</div>}
          {shown.map(o => (
            <label key={o} className={styles.option}>
              <input type="checkbox" checked={picked.has(o)} onChange={() => toggle(o)} />
              <span>{o}</span>
            </label>
          ))}
        </div>
      </>}

      {spec.type === 'number' && (
        <div className={styles.range}>
          <label className={styles.rangeRow}>
            <input className={styles.input} autoFocus inputMode="decimal" placeholder="예: 2.1" value={min}
              onChange={e => setMin(e.target.value)} onKeyDown={onKey} />
            <span>{UNIT_LABEL[spec.unit]} 이상</span>
          </label>
          <label className={styles.rangeRow}>
            <input className={styles.input} inputMode="decimal" placeholder="비워 두면 제한 없음" value={max}
              onChange={e => setMax(e.target.value)} onKeyDown={onKey} />
            <span>{UNIT_LABEL[spec.unit]} 이하</span>
          </label>
          {numInvalid && <div className={styles.error}>숫자를 확인하세요 (이상 ≤ 이하)</div>}
        </div>
      )}

      <div className={styles.foot}>
        <Button variant="ghost" size="sm" disabled={!value} onClick={() => { onApply(null); onClose(); }}>
          해제
        </Button>
        <Button variant="primary" size="sm" disabled={spec.type === 'number' && numInvalid} onClick={apply}>
          적용
        </Button>
      </div>
    </div>,
    document.body,
  );
};

/** 칩·툴팁용 한 줄 요약 */
export const describeColumnFilter = (v: ColumnFilterValue, title: string): string => {
  if (v.type === 'text') return `${title}: "${v.q}"`;
  if (v.type === 'select') {
    return v.values.length === 1 ? `${title}: ${v.values[0]}` : `${title}: ${v.values[0]} 외 ${v.values.length - 1}`;
  }
  const u = UNIT_LABEL[v.unit];
  if (v.min != null && v.max != null) return `${title}: ${v.min}~${v.max}${u}`;
  if (v.min != null) return `${title} ≥ ${v.min}${u}`;
  return `${title} ≤ ${v.max}${u}`;
};
