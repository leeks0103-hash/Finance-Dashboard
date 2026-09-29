import { useRef, useEffect, useMemo } from 'react';
import { DataTable, Button, Spinner, CopyText } from '@/components/ui';
import { useFinanceCrossCheckViewModel } from '@/hooks/viewmodels';
import { useUiStore } from '@/store';
import type { Project } from '@/types/finance.types';
// downloadFinanceCsv — 재무 이력 CSV 버튼 주석 처리로 미사용(2026-09-28). 복구 시 버튼과 함께 해제
import { buildFinanceColumns /*, downloadFinanceCsv */ } from './financeColumns';
import styles from './FinanceCrossCheckPanel.module.css';

interface Props {
  projectCode: string;
  onClose:     () => void;
}

// 재무 이력 2뎁스 패널 — 표는 "재무 데이터 검색 결과"(FinanceSearchResults)와 같은 DataTable·컬럼 정의 사용
// (예전 자체 <table> 구현을 걷어내고 통일, 2026-09-28). 프로젝트코드는 패널 헤더에 있고 모든 행이
// 같은 값이라 컬럼에서만 뺀다
const FinanceCrossCheckPanel = ({ projectCode, onClose }: Props) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const { isLoading, isAmbiguous, fileCount, sorted } = useFinanceCrossCheckViewModel(projectCode);
  const columns = useMemo(() => buildFinanceColumns('').filter(c => c.accessorKey !== 'project_code'), []);
  const rawValues = useUiStore(s => s.showRawValues);

  // 가로 스크롤 translateX 동기화 — 부모(실적 테이블)가 가로 스크롤돼도 패널은 화면에 고정
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
    // 스크롤 위치를 바로 따라가지 않고 매 프레임 남은 거리의 18%씩 쫓아감 — 표가 먼저 움직이고 패널이
    // 살짝 끌려오다 제자리에 붙는 느낌(2026-09-29, "고정된 느낌 말고" 요청). 움직임 줄이기 설정이면 즉시
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let current = el.scrollLeft;
    let raf = 0;
    const apply = () => { panel.style.transform = `translateX(${current}px)`; };
    const step = () => {
      const target = el!.scrollLeft;
      current += (target - current) * 0.18;
      if (Math.abs(target - current) < 0.5) { current = target; raf = 0; apply(); return; }
      apply();
      raf = requestAnimationFrame(step);
    };
    const sync = () => {
      if (reduce) { current = el!.scrollLeft; apply(); return; }
      if (!raf) raf = requestAnimationFrame(step);
    };
    apply();
    el.addEventListener('scroll', sync, { passive: true });
    // 패널 폭 = 스크롤 컨테이너의 "보이는" 폭 — 고정 1600px이면 넓은 화면에선 남고 좁은 화면에선
    // 잘렸음(2026-09-28). 펼침 td의 좌측 보더(3px)만큼 뺀다
    const fit = () => { panel.style.width = `${el!.clientWidth - 3}px`; };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => { el!.removeEventListener('scroll', sync); ro.disconnect(); cancelAnimationFrame(raf); };
  }, []);

  return (
    <div ref={panelRef} className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.title}>재무 이력</span>
          {/* 프로젝트코드 클릭 → 클립보드 복사 (1depth 테이블과 동일 동작) */}
          <CopyText text={projectCode} className={styles.code} />
        </div>
        <div className={styles.headerRight}>
          {/* CSV 다운로드 — 일단 주석 처리(2026-09-28 요청). 복구 시 위 downloadFinanceCsv import도 해제.
              이 표는 title이 없어 DataTable toolbarExtra(제목줄 슬롯)가 렌더되지 않아 패널 헤더에 둠
          <Button variant="success" size="sm" onClick={() => downloadFinanceCsv(`재무이력_${projectCode}`, sorted)} disabled={isLoading || isAmbiguous || sorted.length === 0}>
            ↓ CSV
          </Button>
          */}
          <Button unstyled className={styles.closeBtn} onClick={onClose} aria-label="닫기">×</Button>
        </div>
      </div>

      {isLoading ? (
        <div className={styles.center}><Spinner size="sm" fullPage={false} label="" /></div>
      ) : isAmbiguous ? (
        <div className={styles.emptyBox}>
          <span className={styles.emptyIcon}>⚠️</span>
          <strong className={styles.emptyTitle}>특정 불가</strong>
          <span className={styles.emptySub}>이 코드를 {fileCount}개 파일이 공유합니다</span>
        </div>
      ) : (
        <DataTable<Project>
          data={sorted}
          columns={columns as never}
          getRowId={row => String(row._row_num)}
          meta={{ rawValues }}
          defaultPageSize={10}
          // 행 수 선택 셀렉트 숨김(2026-09-29 요청) — 옵션이 1개면 DataTable이 셀렉트를 안 그림.
          // 복구 시 아래 줄로 교체: pageSizeOptions={[10, 20]}
          pageSizeOptions={[10]}
          emptyIcon="📂"
          emptyTitle="재무 데이터 없음"
          emptyDescription="PPT에서 추출된 재무 이력이 없습니다"
          storageKey="perf-finance-cross-check"
          scrollable={false}
        />
      )}
    </div>
  );
};

export default FinanceCrossCheckPanel;
