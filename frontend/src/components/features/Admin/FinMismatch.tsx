import { useState } from 'react';
import { Button, CopyText, Modal } from '@/components/ui';
import { useFinMismatch } from '@/hooks/useFinMismatch';
import { openFinanceFileOrAlert } from '@/hooks/useOpenFile';
import type { FinMismatchRow } from '@/types/performance.types';
import FinMismatchTableModal from './FinMismatchTableModal';
import styles from './FinMismatch.module.css';

const won = (v: number | null) => (v == null ? '-' : `${v.toLocaleString('ko-KR')}원`);
const signed = (v: number | null) => (v == null ? '-' : `${v > 0 ? '+' : ''}${v.toLocaleString('ko-KR')}원`);

const Line = ({ label, perf, fin, diff, bad }: {
  label: string; perf: number | null; fin: number | null; diff: number | null; bad: boolean;
}) => (
  <div className={`${styles.line} ${bad ? styles.bad : ''}`}>
    <span className={styles.lineLabel}>{label}</span>
    <span className={styles.num} title="실적현황 당월 추정">{won(perf)}</span>
    <span className={styles.vs}>vs</span>
    <span className={styles.num} title="재무 이력(완료 보고)">{won(fin)}</span>
    <span className={styles.diff}>{bad ? signed(diff) : '일치'}</span>
  </div>
);

const Item = ({ r }: { r: FinMismatchRow }) => (
  <li className={styles.item}>
    <div className={styles.head}>
      <span className={styles.code}><CopyText text={r.project_code} /></span>
      <span className={styles.name} title={r.project_name}>{r.project_name}</span>
    </div>
    <div className={styles.meta}>{[r.team, r.part, r.manager].filter(Boolean).join(' · ')}</div>
    <Line label="매출" perf={r.perf_revenue} fin={r.fin_revenue} diff={r.revenue_diff} bad={r.revenue_mismatch} />
    <Line label="직접원가" perf={r.perf_cost} fin={r.fin_cost} diff={r.cost_diff} bad={r.cost_mismatch} />
    {r.fin_filename && (
      <div className={styles.file}><CopyText text={r.fin_filename} onOpen={openFinanceFileOrAlert} /></div>
    )}
  </li>
);

/**
 * 관리자 기능 > 완료 프로젝트 재무 불일치(2026-10-06) — 진행 '완료'인데 실적현황(당월 추정 매출·직접원가)과
 * 재무 이력 완료 보고 금액이 1,000원 이상 다른 프로젝트. 프로젝트 상세의 빨간 칸과 같은 기준.
 * 데이터 이상 배지(코드 충돌 등)와는 성격이 달라 따로 둠. 버튼을 누르면 목록이 모달로 열림
 */
const FinMismatch = ({ inline = false }: { inline?: boolean }) => {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const { rows, total, isLoading, isError, exportCsv } = useFinMismatch(true);

  return (
    <section className={styles.wrap}>
      <div className={styles.top}>
        <div className={styles.titleBox}>
          <span className={styles.title}>
            완료 프로젝트 재무 불일치
            {/* [⤢ 확대 버튼 주석 처리 — 2026-10-23 요청, 복구하려면 아래 블록을 풀 것] 넓은 창에서 표로(정렬·검색·컬럼 조절)
            <Button unstyled className={styles.expandBtn} disabled={!total} onClick={() => setExpanded(true)}
              aria-label="표로 크게 보기" title="표로 크게 보기">⤢</Button>
            */}
          </span>
          <span className={styles.sub}>완료인데 실적현황 매출·직접원가가 재무 이력(완료 보고)과 다름 · 1,000원 미만 차이는 제외</span>
        </div>
        <Button variant="ghost" size="sm" disabled={!total} onClick={() => void exportCsv()}>↓ CSV</Button>
        {/* inline(관리자 기능 창, 2026-10-29) — 버튼 없이 목록을 바로 아래에 펼침. 건수는 상태 글자로 */}
        {inline
          ? <span className={styles.state}>
              {isLoading ? '확인 중…' : isError ? '불러오기 실패' : !total ? '불일치 없음' : `${total}건`}
            </span>
          : (
            <Button variant="primary" size="sm" disabled={isLoading || isError || !total} onClick={() => setOpen(true)}>
              {isLoading ? '확인 중…' : isError ? '불러오기 실패' : !total ? '불일치 없음' : `${total}건 보기`}
            </Button>
          )}
      </div>
      {inline && total > 0 && (
        <ul className={styles.list}>
          {rows.map(r => <Item key={r.project_code + r.fin_filename} r={r} />)}
        </ul>
      )}
      {/* 목록은 페이지에 펼치지 않고 모달로(2026-10-23 요청) */}
      {!inline && open && total > 0 && (
        <Modal title="완료 프로젝트 재무 불일치" sub={`${total}건 · 완료인데 실적현황 매출·직접원가가 재무 이력(완료 보고)과 다름 · 1,000원 미만 차이는 제외`}
          width="min(1000px, 94vw)" onClose={() => setOpen(false)}>
          <ul className={styles.list}>
            {rows.map(r => <Item key={r.project_code + r.fin_filename} r={r} />)}
          </ul>
        </Modal>
      )}
      {expanded && (
        <FinMismatchTableModal rows={rows} isLoading={isLoading} onExportCsv={() => void exportCsv()}
          onClose={() => setExpanded(false)} />
      )}
    </section>
  );
};

export default FinMismatch;
