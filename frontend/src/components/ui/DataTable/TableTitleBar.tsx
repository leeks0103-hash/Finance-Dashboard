import type { ReactNode } from 'react';
import styles from './TableTitleBar.module.css';

interface Props {
  title:         string;
  /** 생략하면 건수 배지 숨김 */
  count?:        ReactNode;
  toolbarExtra?: ReactNode;
  children:      ReactNode;
}

/** 테이블 상단 제목 + 건수 배지 + 툴바 확장 슬롯 래퍼 — DataTable·KpiRawTable 공용 */
export const TableTitleBar = ({ title, count, toolbarExtra, children }: Props) => (
  <div className={styles.outerGroup}>
    <div className={styles.outerTitle}>
      <div className={styles.outerTitleLeft}>
        <div className={styles.titleGroup}>
          <span className={styles.title}>{title}</span>
          {count != null && <span className={styles.count}>{count}</span>}
        </div>
        <div className={styles.scrollHint}>⇔ Shift + 마우스 휠로 가로 스크롤</div>
      </div>
      {toolbarExtra && <div>{toolbarExtra}</div>}
    </div>
    {children}
  </div>
);
