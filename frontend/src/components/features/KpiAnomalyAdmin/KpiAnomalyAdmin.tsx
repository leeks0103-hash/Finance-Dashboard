import { Button, CopyText } from '@/components/ui';
import type { KpiAnomaly, KpiAnomalyExcepted } from '@/types/kpi.types';
import styles from './KpiAnomalyAdmin.module.css';

interface Props {
  /** 지금 의심으로 안내되는 건(프로젝트 단위) — 배너가 보일 때만 목록을 그림 */
  items:       KpiAnomaly[];
  showItems:   boolean;
  /** 관리자가 예외 처리한 건 */
  excepted:    KpiAnomalyExcepted[];
  pending:     boolean;
  onExcept:    (item: KpiAnomaly, done: boolean) => void;
}

const metricsText = (a: KpiAnomaly) => a.metrics.map(m => `${m.metric} ${m.value}`).join(' · ');

const Row = ({ a, action, note }: { a: KpiAnomaly; action: React.ReactNode; note?: string }) => (
  <li className={styles.item}>
    <div className={styles.head}>
      <span className={styles.code}>{a.project_code || '(코드 없음)'}</span>
      <span className={styles.stage}>{a.stage}</span>
      {action}
    </div>
    <CopyText text={a.file} className={styles.file} />
    <span className={styles.metrics}>실적이 채워진 지표 {a.metrics.length}개: {metricsText(a)}</span>
    {note && <span className={styles.note}>{note}</span>}
  </li>
);

/**
 * KPI 탭 — 조기입력 의심 건의 관리자 예외 처리(2026-11-11). 관리자에게만 그림.
 * 한 건 = 프로젝트 하나(지표가 여러 개여도 한 줄). 의도한 입력이면 [예외 처리] → 모든 사람의 안내·빨간 행에서 빠지고
 * 아래 "예외 처리한 건"에 남아 [해제]로 되돌림. PPT 값이 바뀌면 서버가 저절로 풀어 다시 의심으로 표시.
 */
const KpiAnomalyAdmin = ({ items, showItems, excepted, pending, onExcept }: Props) => {
  const list = showItems ? items : [];
  if (list.length === 0 && excepted.length === 0) return null;
  return (
    <section className={styles.root} aria-label="조기입력 의심 관리">
      {list.length > 0 && (
        <>
          <div className={styles.title}>의심 항목 · {list.length}건 <span className={styles.sub}>(관리자에게만 보임)</span></div>
          <ul className={styles.list}>
            {list.map(a => (
              <Row key={a.id} a={a} action={
                <Button unstyled className={styles.btn} disabled={pending} onClick={() => onExcept(a, true)}>예외 처리</Button>
              } />
            ))}
          </ul>
        </>
      )}
      {excepted.length > 0 && (
        <>
          <div className={styles.title}>예외 처리한 건 · {excepted.length}건
            <span className={styles.sub}> 안내·빨간 행에서는 빠져 있고, PPT 값이 바뀌면 자동으로 다시 표시됩니다</span>
          </div>
          <ul className={styles.list}>
            {excepted.map(a => (
              <Row key={a.id} a={a}
                note={`${a.by ? `${a.by} · ` : ''}${a.at.slice(0, 16)} 처리`}
                action={
                  <>
                    <span className={styles.badge}>관리자 예외 처리 (임시)</span>
                    <Button unstyled className={styles.btn} disabled={pending} onClick={() => onExcept(a, false)}>해제</Button>
                  </>
                } />
            ))}
          </ul>
        </>
      )}
    </section>
  );
};

export default KpiAnomalyAdmin;
