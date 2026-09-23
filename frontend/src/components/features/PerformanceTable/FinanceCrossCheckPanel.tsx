import { useRef, useEffect, useState, useCallback } from 'react';
import { Button, Spinner, CopyText } from '@/components/ui';
import { useClipboardPopup } from '@/components/ui/DataTable/useClipboardPopup';
import { CellPopup }         from '@/components/ui/DataTable/CellPopup';
import { useFinanceCrossCheckViewModel } from '@/hooks/viewmodels';
import { formatBillion, formatRate, alertDialog } from '@/utils';
import { openFinanceFile } from '@/api/finance.api';
import type { Project } from '@/types/finance.types';
import styles from './FinanceCrossCheckPanel.module.css';

const openFile = (filename: string) => {
  openFinanceFile(filename).then(r => { if (!r.ok) alertDialog(r.message ?? '파일을 열 수 없습니다.', { error: true }); });
};

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

interface RowProps { r: Project; onCell: (text: string, copyable?: boolean, onOpen?: () => void) => void; }
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
          title={fname} onClick={() => onCell(fname, true, () => openFile(fname))}>{fname}</td>
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

    // 컬럼 15개 기본폭 합(1570px)이 패널 자체 최대폭(1520px)보다 넓어서, 좁을 때만 채우던
    // 기존 로직(total >= wrapW면 그대로 둠)으론 항상 ~80px 가로스크롤이 고정으로 남아있었음
    // — 넓을 때도 줄여서 항상 컨테이너에 꼭 맞춘다(2026-09-23, "가로스크롤 없어도 되는 테이블" 피드백)
    const scaleToFill = (widths: number[]) => {
      const total = widths.reduce((a, b) => a + b, 0);
      if (!total) return widths;
      const scale = wrapW / total;
      return widths.map(w => Math.max(40, Math.round(w * scale)));
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

  // 컬럼 리사이즈 — 옆 컬럼에서 폭을 빌려와 합(=테이블 총 폭)이 항상 그대로 유지됨
  // (DataTable의 compact fixedTotalWidth와 동일 원칙 — 한 컬럼 넓히면 테이블이 넓어지는 게 아니라
  // 옆 컬럼이 그만큼 줄어야 가로스크롤이 안 생김, 2026-09-23 피드백)
  const startResize = useCallback((colIdx: number, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const isLast = colIdx === colWidths.length - 1;
    const neighborIdx = isLast ? colIdx - 1 : colIdx + 1;
    if (neighborIdx < 0) return;   // 컬럼 1개뿐이면 빌려올 곳이 없음
    const startSelfW = colWidths[colIdx];
    const startNeighborW = colWidths[neighborIdx];
    const MIN_W = 40;
    const sign = isLast ? -1 : 1;   // 마지막 컬럼은 "앞" 컬럼에서 빌려오므로 부호가 뒤집힘

    const onMove = (ev: PointerEvent) => {
      const rawDelta = (ev.clientX - startX) * sign;
      const maxGrow = startNeighborW - MIN_W;     // 이웃이 줄어들 수 있는 최대치
      const maxShrink = -(startSelfW - MIN_W);    // 내가 줄어들 수 있는 최대치
      const delta = Math.max(maxShrink, Math.min(maxGrow, rawDelta));
      setColWidths(prev => {
        const next = [...prev];
        next[colIdx] = startSelfW + delta;
        next[neighborIdx] = startNeighborW - delta;
        return next;
      });
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

  // 더블클릭 자동 맞춤 — 이 컬럼의 실제 td 폰트로 측정(이전엔 무조건 0번째 td 폰트를 써서
  // stageCell의 굵은 폰트가 다른 컬럼 측정에 섞여 들어갔음) + padding을 실측(getComputedStyle)해서
  // 반영 → 예전엔 400px 상한 때문에 미수사유·비고처럼 긴 텍스트는 늘려도 계속 "..." 로 잘려 보였음.
  // 이제 상한을 없애고 그만큼을 "다른 컬럼들"에서 비례로 빌려와 테이블 총 폭은 그대로 유지한다
  // (resize 핸들의 fixedTotalWidth 원칙과 동일, 2026-09-23)
  const MIN_W = 40;
  const autoFit = useCallback((colIdx: number) => {
    const tbl = tableRef.current;
    if (!tbl) return;

    const span = document.createElement('span');
    span.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;left:-9999px;top:-9999px';
    document.body.appendChild(span);

    const thEl  = tbl.querySelectorAll('thead th')[colIdx] as HTMLElement | undefined;
    const tdEls = tbl.querySelectorAll(`tbody td:nth-child(${colIdx + 1})`);
    const firstTd = tdEls[0] as HTMLElement | undefined;
    const thStyle = thEl ? getComputedStyle(thEl) : null;
    const tdStyle = firstTd ? getComputedStyle(firstTd) : thStyle;
    const thPad = thStyle ? parseFloat(thStyle.paddingLeft) + parseFloat(thStyle.paddingRight) : 24;
    const tdPad = tdStyle ? parseFloat(tdStyle.paddingLeft) + parseFloat(tdStyle.paddingRight) : 24;

    span.style.font  = thStyle?.font ?? '';
    span.textContent = HEADERS[colIdx];
    let maxW = span.offsetWidth + thPad + 14;   // +14 = 정렬 화살표/핸들 여유

    span.style.font = tdStyle?.font ?? '';
    tdEls.forEach(td => {
      span.textContent = (td as HTMLElement).textContent ?? '';
      maxW = Math.max(maxW, span.offsetWidth + tdPad + 4);
    });
    document.body.removeChild(span);

    setColWidths(prev => {
      const startSelfW = prev[colIdx];
      const wanted = Math.max(MIN_W, Math.round(maxW));
      const growNeeded = wanted - startSelfW;
      const next = [...prev];

      if (growNeeded <= 0) {
        // 오히려 줄어드는 경우 — 남는 폭은 옆 컬럼(마지막이면 앞 컬럼)에 돌려준다
        const neighborIdx = colIdx === prev.length - 1 ? colIdx - 1 : colIdx + 1;
        next[colIdx] = wanted;
        if (neighborIdx >= 0) next[neighborIdx] = prev[neighborIdx] + (startSelfW - wanted);
      } else {
        // 다른 모든 컬럼에서 필요한 만큼 비례로 빌려옴 — 각자 MIN_W 밑으론 안 내려감,
        // 다 합쳐도 모자라면 빌릴 수 있는 만큼만(테이블 총 폭은 항상 그대로 유지)
        const others = prev.map((w, i) => ({ i, w })).filter(o => o.i !== colIdx);
        const availTotal = others.reduce((a, o) => a + Math.max(0, o.w - MIN_W), 0);
        const actualGrow = Math.min(growNeeded, availTotal);
        next[colIdx] = startSelfW + actualGrow;
        others.forEach(o => {
          const slack = Math.max(0, o.w - MIN_W);
          const take = availTotal > 0 ? Math.round((slack / availTotal) * actualGrow) : 0;
          next[o.i] = o.w - take;
        });
      }

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
