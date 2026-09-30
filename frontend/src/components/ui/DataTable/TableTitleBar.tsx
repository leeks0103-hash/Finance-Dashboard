import type { ReactNode } from 'react';
import { InfoButton } from '@/components/ui/InfoButton/InfoButton';
import styles from './TableTitleBar.module.css';

interface Props {
  title:         string;
  /** 생략하면 건수 배지 숨김 */
  count?:        ReactNode;
  toolbarExtra?: ReactNode;
  /** 제공 시 제목 옆에 ⓘ 버튼 표시 — 클릭하면 데이터 기준 설명 팝오버 */
  info?:         ReactNode;
  /** 제목줄 아래(툴바+표)에만 붙일 클래스 — 뷰 전환 페이드처럼 제목·토글은 가만히 두고 표만 움직일 때 */
  bodyClassName?: string;
  /** 부모 높이를 꽉 채움(DataTable fillHeight) */
  fill?:         boolean;
  children:      ReactNode;
}

/** 테이블 상단 제목 + 건수 배지 + 툴바 확장 슬롯 래퍼 — DataTable·KpiRawTable 공용 */
export const TableTitleBar = ({ title, count, toolbarExtra, info, bodyClassName, fill, children }: Props) => (
  <div className={`${styles.outerGroup} ${fill ? styles.fill : ''}`}>
    <div className={styles.outerTitle}>
      <div className={styles.outerTitleLeft}>
        <div className={styles.titleGroup}>
          <span className={styles.title}>{title}</span>
          {count != null && <span className={styles.count}>{count}</span>}
          {info && <InfoButton>{info}</InfoButton>}
        </div>
        <div className={styles.scrollHint}>⇔ Shift + 마우스 휠로 가로 스크롤</div>
      </div>
      {toolbarExtra && <div className={styles.extra}>{toolbarExtra}</div>}
    </div>
    {bodyClassName ? <div className={bodyClassName}>{children}</div> : children}
  </div>
);
