import { useRef, useEffect, useState, useCallback } from 'react';
import { Button, Spinner, CopyText } from '@/components/ui';
import { useClipboardPopup } from '@/components/ui/DataTable/useClipboardPopup';
import { CellPopup }         from '@/components/ui/DataTable/CellPopup';
import { useFinanceCrossCheckViewModel } from '@/hooks/viewmodels';
import { formatBillion, formatRate } from '@/utils';
import type { Project } from '@/types/finance.types';
import styles from './FinanceCrossCheckPanel.module.css';

// v2 — 표시 컬럼을 재무 PPT 추출 전체 항목으로 확장(7 → 15개)하며 저장된 폭 무효화
const LS_KEY = 'finance-cross-check-col-widths-v2';
// 재무 PPT에서 추출되는 항목 전부. project_code는 패널 헤더에 이미 있어(모든 행 동일값) 컬럼에서는 제외
// 보고단계가 첫 컬럼 — .stageCell의 좌측 색상 바가 행 시작 표시 역할을 하므로 순서 유지
const HEADERS = [
  '보고단계', '파트', '연도',
  '매출', '지출', '직접원가', '인건비', '공통원가', '경상이익', '이익율',
  '미수사유', '비고', '처리일', '반영일', '파일명',
] as const;
const DEFAULT_WIDTHS = [100, 90, 60, 88, 88, 88, 80, 88, 92, 76, 140, 160, 100, 100, 220];
const RIGHT_COLS = new Set([3, 4, 5, 6, 7, 8, 9]); // 숫자 컬럼 인덱스

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

// 현대 브랜드 9색 — 검토계열 Active Blue / 제안 Sky Blue / 계획·착수 Hyundai Blue / 중간 Gold / 완료 Black 파생
const STAGE_COLOR: Record<string, string> = {
  '사전검토': '#00aad2', '검토': '#00aad2',
  '제안':     '#aacae6', '사업계획': '#002c5f',
  '착수':     '#002c5f', '중간': '#a36b4f',
  '완료':     '#2b2b2b',
};
function stageColor(stage: string) {
  for (const [k, v] of Object.entries(STAGE_COLOR)) if (stage.includes(k)) return v;
  return '#6b6257';
}

interface RowProps { r: Project; onCell: (text: string, copyable?: boolean) => void; }
function TableRow({ r, onCell }: RowProps) {
  const isLoss = r.operating_profit < 0;
  const dash   = (v?: string) => (v && v.trim()) || '-';
  const note   = dash(r.note);
  const missed = dash(r.missed_bid_reason);
  const fname  = dash(r.filename);
  // 20자 넘는 텍스트는 클릭하면 전체 내용 팝업 (다른 표와 동일 규칙)
  const longCell = (text: string, cls: string) => (
    <td className={`${cls}${text.length > 20 ? ` ${styles.clickable}` : ''}`}
        title={text} onClick={text.length > 20 ? () => onCell(text) : undefined}>{text}</td>
  );
  return (
    <tr style={{ '--stage-color': stageColor(r.stage) } as React.CSSProperties}>
      <td className={styles.stageCell}>{r.stage}</td>
      <td className={styles.truncCell} title={r.part}>{dash(r.part)}</td>
      <td className={styles.yearCell}>{r.year}년</td>
      <td className={styles.numCell}>{formatBillion(r.revenue)}</td>
      <td className={styles.numCell}>{formatBillion(r.expenditure)}</td>
      <td className={styles.numCell}>{formatBillion(r.direct_cost)}</td>
      <td className={styles.numCell}>{formatBillion(r.labor_cost)}</td>
      <td className={styles.numCell}>{formatBillion(r.overhead)}</td>
      <td className={`${styles.numCell}${isLoss ? ` ${styles.loss}` : ''}`}>
        {formatBillion(r.operating_profit)}
      </td>
      <td className={`${styles.numCell}${isLoss ? ` ${styles.loss}` : ''}`}>
        {formatRate(r.profit_rate)}
      </td>
      {longCell(missed, styles.truncCell)}
      {longCell(note, styles.truncCell)}
      <td className={styles.yearCell}>{dash(r.processed_at)}</td>
      <td className={styles.yearCell}>{dash(r.reflected_at)}</td>
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

  const { isLoading, isAmbiguous, fileCount, sorted } = useFinanceCrossCheckViewModel(projectCode);
  const totalWidth = colWidths.reduce((a, b) => a + b, 0);

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

  return (
    <>
      <div ref={panelRef} className={styles.panel}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <span className={styles.title}>재무 이력</span>
            {/* 프로젝트코드 클릭 → 클립보드 복사 (1depth 테이블과 동일 동작) */}
            <CopyText text={projectCode} className={styles.code} />
          </div>
          <Button unstyled className={styles.closeBtn} onClick={onClose} aria-label="닫기">×</Button>
        </div>

        {isLoading ? (
          <div className={styles.center}><Spinner size="sm" fullPage={false} label="" /></div>
        ) : isAmbiguous ? (
          <div className={styles.emptyBox}>
            <span className={styles.emptyIcon}>⚠️</span>
            <strong className={styles.emptyTitle}>특정 불가</strong>
            <span className={styles.emptySub}>이 코드를 {fileCount}개 파일이 공유합니다</span>
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
