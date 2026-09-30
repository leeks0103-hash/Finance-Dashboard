import type { ReactNode } from 'react';
import { Button, QueryGate } from '@/components/ui';
import styles from './BreakdownParts.module.css';

/**
 * 드릴다운(산출 근거) 모달 공통 조각 — KPI·실적·재무 드릴다운이 같은 모양으로 쓰는 것들.
 * 표 자체는 BreakdownTable(KPI·실적) / DataTable(재무).
 */

export const BreakdownState = ({ children }: { children: ReactNode }) => (
  <div className={styles.state}>{children}</div>
);

interface GateProps {
  vm: { isLoading: boolean; isError: boolean; available: boolean; message?: string | null };
  /** 조회는 됐지만 이 항목에 집계된 행이 없음 */
  empty: boolean;
  emptyText: string;
  /** 빈 상태 위에 같이 보여줄 안내(KPI의 note 등) */
  emptyNote?: ReactNode;
  children: ReactNode;
}

/** 불러오는 중 > 오류 > 사용 불가(백엔드 message) > 행 없음 > 내용 */
export const BreakdownGate = ({ vm, empty, emptyText, emptyNote, children }: GateProps) => (
  <QueryGate
    loading={vm.isLoading}
    error={vm.isError}
    empty={!vm.available || empty}
    loadingView={<BreakdownState>불러오는 중…</BreakdownState>}
    errorView={<BreakdownState>데이터를 불러오지 못했습니다.</BreakdownState>}
    emptyView={vm.available
      ? <>{emptyNote}<BreakdownState>{emptyText}</BreakdownState></>
      : <BreakdownState>{vm.message ?? '표시할 데이터가 없습니다.'}</BreakdownState>}
  >
    {children}
  </QueryGate>
);

/** "이 값이 무슨 데이터인지" 안내 박스 — lead의 <b>·<code>는 강조 스타일 */
export const BreakdownExplain = ({ lead, sub }: { lead?: ReactNode; sub?: ReactNode }) => (
  <div className={styles.explain}>
    {lead && <p className={styles.explainLead}>{lead}</p>}
    {sub && <p className={styles.explainSub}>{sub}</p>}
  </div>
);

/** 기준 안내 한 줄 + CSV 버튼 — 표 위(top)·아래(bottom) 어디 두느냐에 따라 여백 방향만 다름 */
export const BreakdownFoot = ({ note, onCsv, placement }: {
  note: ReactNode;
  onCsv: () => void;
  placement: 'top' | 'bottom';
}) => (
  <div className={`${styles.foot} ${placement === 'top' ? styles.footTop : styles.footBottom}`}>
    <span className={styles.count}>{note}</span>
    <Button variant="success" size="sm" onClick={onCsv}>↓ 이 목록 CSV</Button>
  </div>
);

/** 표 위 작은 안내문 (ⓘ …) */
export const BreakdownNote = ({ children }: { children: ReactNode }) => (
  <p className={styles.note}>ⓘ {children}</p>
);
