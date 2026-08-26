import { Button } from '@/components/ui';
import { formatBillion, formatRate } from '@/utils';
import type { Project } from '@/types';
import styles from './FinanceDetailPanel.module.css';

interface Props {
  project: Project;
  onClose: () => void;
}

/**
 * 미수주는 실적현황에는 없고 재무(PPT)에만 존재하는 데이터라 교차조회할 대상이 없음 —
 * 목록에서 안 보여주던 나머지 재무 필드(연도/단계/원가 구성/처리일 등)를 그대로 펼쳐서 보여줌.
 * 이미 fetch된 Project 객체를 그대로 쓰므로 별도 API 호출 없음.
 */
const FinanceDetailPanel = ({ project: p, onClose }: Props) => (
  <div className={styles.panel}>
    <div className={styles.header}>
      <span className={styles.title}>재무 데이터(PPT) 상세 — {p.project_code}</span>
      <Button unstyled className={styles.closeBtn} onClick={onClose} aria-label="닫기">✕</Button>
    </div>

    <div className={styles.grid}>
      <div className={styles.field}><span className={styles.label}>연도</span><span>{p.year}</span></div>
      <div className={styles.field}><span className={styles.label}>보고단계</span><span>{p.stage}</span></div>
      <div className={styles.field}><span className={styles.label}>매출</span><span>{formatBillion(p.revenue)}</span></div>
      <div className={styles.field}><span className={styles.label}>지출</span><span>{formatBillion(p.expenditure)}</span></div>
      <div className={styles.field}><span className={styles.label}>직접원가</span><span>{formatBillion(p.direct_cost)}</span></div>
      <div className={styles.field}><span className={styles.label}>인건비</span><span>{formatBillion(p.labor_cost)}</span></div>
      <div className={styles.field}><span className={styles.label}>공통원가</span><span>{formatBillion(p.overhead)}</span></div>
      <div className={styles.field}>
        <span className={styles.label}>경상이익</span>
        <span className={p.operating_profit < 0 ? styles.loss : undefined}>{formatBillion(p.operating_profit)}</span>
      </div>
      <div className={styles.field}><span className={styles.label}>이익율</span><span>{formatRate(p.profit_rate)}</span></div>
      <div className={styles.field}><span className={styles.label}>처리일</span><span>{p.processed_at || '-'}</span></div>
      <div className={styles.field}><span className={styles.label}>반영일</span><span>{p.reflected_at || '-'}</span></div>
    </div>
  </div>
);

export default FinanceDetailPanel;
