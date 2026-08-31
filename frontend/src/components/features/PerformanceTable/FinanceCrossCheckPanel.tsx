import { useRef, useEffect, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getProjects } from '@/api/finance.api';
import { Button, Spinner } from '@/components/ui';
import { useClipboardPopup } from '@/components/ui/DataTable/useClipboardPopup';
import { CellPopup }         from '@/components/ui/DataTable/CellPopup';
import { sortStages }        from '@/utils/stageOrder';
import { extractRealCode }   from '@/utils/projectCode';
import { formatBillion, formatRate } from '@/utils';
import type { Filters, Project } from '@/types/finance.types';
import { STALE_5MIN, GC_10MIN } from '@/hooks/queryClient';
import styles from './FinanceCrossCheckPanel.module.css';

const EMPTY_FILTERS: Filters = { years: [], parts: [], stages: [] };
const LS_KEY = 'finance-cross-check-col-widths';
// 보고단계 | 연도 | 매출 | 지출 | 이익율 | 비고 | 파일명
const DEFAULT_WIDTHS = [110, 64, 80, 80, 90, 160, 220];
const HEADERS = ['보고단계', '연도', '매출', '지출', '이익율', '비고', '파일명'] as const;
const RIGHT_COLS = new Set([2, 3, 4]); // 숫자 컬럼 인덱스

function loadWidths(): number[] {
  try {
    const s = localStorage.getItem(LS_KEY);
    if (s) {
      const w = JSON.parse(s) as number[];
      if (Array.isArray(w) && w.length === DEFAULT_WIDTHS.length) return w;
    }
  } catch {}
  return [...DEFAULT_WIDTHS];
}

interface Props {
  projectCode: string;
  onClose:     () => void;
}

const STAGE_COLOR: Record<string, string> = {
  '사전검토': '#818cf8', '검토': '#818cf8',
  '제안':     '#60a5fa', '사업계획': '#34d399',
  '착수':     '#34d399', '중간': '#fbbf24',
  '완료':     '#7c3aed',
};
function stageColor(stage: string) {
  for (const [k, v] of Object.entries(STAGE_COLOR)) if (stage.includes(k)) return v;
  return '#94a3b8';
}

interface RowProps { r: Project; onCell: (text: string, copyable?: boolean) => void; }
function TableRow({ r, onCell }: RowProps) {
  const isLoss = r.operating_profit < 0;
  const note   = r.note     || '-';
  const fname  = r.filename || '-';
  return (
    <tr style={{ '--stage-color': stageColor(r.stage) } as React.CSSProperties}>
      <td className={styles.stageCell}>{r.stage}</td>
      <td className={styles.yearCell}>{r.year}년</td>
      <td className={styles.numCell}>{formatBillion(r.revenue)}</td>
      <td className={styles.numCell}>{formatBillion(r.expenditure)}</td>
      <td className={`${styles.numCell}${isLoss ? ` ${styles.loss}` : ''}`}>
        {isLoss ? `손실 ${formatBillion(r.operating_profit)}` : formatRate(r.profit_rate)}
      </td>
      <td className={`${styles.truncCell}${note.length > 15 ? ` ${styles.clickable}` : ''}`}
          title={note} onClick={note.length > 15 ? () => onCell(note) : undefined}>{note}</td>
      <td className={`${styles.fileCell} ${styles.clickable}`}
          title={fname} onClick={() => onCell(fname, true)}>{fname}</td>
    </tr>
  );
}

const FinanceCrossCheckPanel = ({ projectCode, onClose }: Props) => {
  const panelRef  = useRef<HTMLDivElement>(null);
  const tableRef  = useRef<HTMLTableElement>(null);
  const fittedRef = useRef(false);
  const { popup, copied, openPopup, closePopup, copyPopupText } = useClipboardPopup();
  const [colWidths, setColWidths] = useState<number[]>(loadWidths);


  // 첫 진입 시 DEFAULT_WIDTHS를, 저장값 있으면 저장값을 컨테이너에 비례 스케일
  useEffect(() => {
    if (sorted.length === 0 || fittedRef.current) return;
    fittedRef.current = true;

    const wrapW = tableRef.current?.parentElement?.getBoundingClientRect().width ?? 0;
    if (!wrapW) return;

    const scaleToFill = (widths: number[]) => {
      const total = widths.reduce((a, b) => a + b, 0);
      if (total >= wrapW) return widths;
      const scale = wrapW / total;
      return widths.map(w => Math.round(w * scale));
    };

    if (localStorage.getItem(LS_KEY)) {
      setColWidths(prev => scaleToFill(prev));
    } else {
      setColWidths(scaleToFill([...DEFAULT_WIDTHS]));
    }
  }, [sorted.length]);

  // 가로 스크롤 translateX 동기화
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    let el: HTMLElement | null = panel.parentElement;
    while (el) {
      const ox = getComputedStyle(el).overflowX;
      if (ox === 'auto' || ox === 'scroll') break;
      el = el.parentElement;
    }
    if (!el) return;
    const sync = () => { panel.style.transform = `translateX(${el!.scrollLeft}px)`; };
    sync();
    el.addEventListener('scroll', sync, { passive: true });
    return () => el!.removeEventListener('scroll', sync);
  }, []);

  // 컬럼 리사이즈
  const startResize = useCallback((colIdx: number, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = colWidths[colIdx];

    const onMove = (ev: PointerEvent) => {
      const next = [...colWidths];
      next[colIdx] = Math.max(40, startW + ev.clientX - startX);
      setColWidths(next);
    };
    const onUp = () => {
      setColWidths(prev => {
        localStorage.setItem(LS_KEY, JSON.stringify(prev));
        return prev;
      });
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }, [colWidths]);

  // 더블클릭 자동 맞춤
  const autoFit = useCallback((colIdx: number) => {
    const tbl = tableRef.current;
    if (!tbl) return;

    const span = document.createElement('span');
    span.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;left:-9999px;top:-9999px';
    document.body.appendChild(span);

    const thEl   = tbl.querySelectorAll('thead th')[colIdx] as HTMLElement;
    const firstTd = tbl.querySelector('tbody td') as HTMLElement | null;
    const thFont  = thEl  ? getComputedStyle(thEl).font   : '';
    const tdFont  = firstTd ? getComputedStyle(firstTd).font : thFont;

    span.style.font  = thFont;
    span.textContent = HEADERS[colIdx];
    let maxW = span.offsetWidth + 28;

    span.style.font = tdFont;
    tbl.querySelectorAll(`tbody td:nth-child(${colIdx + 1})`).forEach(td => {
      span.textContent = (td as HTMLElement).textContent ?? '';
      maxW = Math.max(maxW, span.offsetWidth + 20);
    });
    document.body.removeChild(span);

    setColWidths(prev => {
      const next = [...prev];
      next[colIdx] = Math.min(Math.max(maxW, 40), 400);
      localStorage.setItem(LS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const realCode   = extractRealCode(projectCode);
  const searchTerm = realCode ?? projectCode;

  const { data, isLoading } = useQuery({
    queryKey: ['finance-by-code', searchTerm],
    queryFn:  () => getProjects(EMPTY_FILTERS, { page: 1, pageSize: 20, search: searchTerm, field: 'project_code' })
      .then(r => r.data),
    staleTime: STALE_5MIN,
    gcTime:    GC_10MIN,
  });

  const rows          = data ?? [];
  const distinctFiles = new Set(rows.map(r => r.filename));
  const isAmbiguous   = !realCode && distinctFiles.size > 1;
  const stageRank     = new Map(sortStages(rows.map(r => r.stage)).map((s, i) => [s, i]));
  const sorted        = [...rows].sort((a, b) => (stageRank.get(a.stage) ?? 99) - (stageRank.get(b.stage) ?? 99));
  const totalWidth    = colWidths.reduce((a, b) => a + b, 0);

  return (
    <>
      <div ref={panelRef} className={styles.panel}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <span className={styles.title}>재무 이력</span>
            <span className={styles.code}>{projectCode}</span>
          </div>
          <Button unstyled className={styles.closeBtn} onClick={onClose} aria-label="닫기">×</Button>
        </div>

        {isLoading ? (
          <div className={styles.center}><Spinner size="sm" fullPage={false} label="" /></div>
        ) : isAmbiguous ? (
          <div className={styles.emptyBox}>
            <span className={styles.emptyIcon}>⚠️</span>
            <strong className={styles.emptyTitle}>특정 불가</strong>
            <span className={styles.emptySub}>이 코드를 {distinctFiles.size}개 파일이 공유합니다</span>
          </div>
        ) : sorted.length === 0 ? (
          <div className={styles.emptyBox}>
            <span className={styles.emptyIcon}>📂</span>
            <strong className={styles.emptyTitle}>재무 데이터 없음</strong>
            <span className={styles.emptySub}>PPT에서 추출된 재무 이력이 없습니다</span>
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table ref={tableRef} className={styles.table} style={{ width: '100%', minWidth: totalWidth, tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  {HEADERS.map((h, i) => (
                    <th
                      key={h}
                      style={{ width: colWidths[i] }}
                      className={RIGHT_COLS.has(i) ? styles.right : undefined}
                    >
                      {h}
                      <div
                        className={styles.resizeHandle}
                        onPointerDown={e => startResize(i, e)}
                        onDoubleClick={e => { e.stopPropagation(); autoFit(i); }}
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((r, i) => (
                  <TableRow key={`${r.stage}-${r.year}-${i}`} r={r} onCell={openPopup} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CellPopup
        title="내용"
        popup={popup}
        copied={copied}
        onClose={closePopup}
        onCopy={copyPopupText}
      />
    </>
  );
};

export default FinanceCrossCheckPanel;
