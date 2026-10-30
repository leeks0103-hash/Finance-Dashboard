import type { ReactNode } from 'react';
import { Skeleton } from '../Skeleton';
import styles from './ChartStateGrid.module.css';

export interface ChartStateItem {
  key: string;
  /** 실제 차트 카드와 같은 칸 크기(span) 클래스 — 로딩/에러/빈 상태에서도 레이아웃이 안 무너지게 */
  className?: string;
}

interface Props {
  variant: 'skeleton' | 'error' | 'empty';
  /** 카드가 놓일 칸들 — 실제 차트와 같은 id·span 목록 */
  items: ChartStateItem[];
  icon?: ReactNode;
  message?: string;
  /** 카드 최소 높이(px) — 쓰는 쪽 .grid의 행 높이와 맞출 것 (기본 400) */
  minHeight?: number;
}

/** 차트 영역 로딩(스켈레톤)·에러·데이터 없음 플레이스홀더 — 셋이 같은 칸 배치에 내용만 다름 */
const ChartStateGrid = ({ variant, items, icon, message, minHeight }: Props) => {
  const sizing = minHeight != null ? ({ '--state-card-min-h': `${minHeight}px` } as React.CSSProperties) : undefined;
  return (
    <>
      {items.map(({ key, className = '' }) => variant === 'skeleton' ? (
        <Skeleton key={key} className={`${styles.skeleton} ${className}`} style={sizing} />
      ) : (
        <div key={key} className={`${variant === 'error' ? styles.errorCard : styles.emptyCard} ${className}`} style={sizing}>
          <span className={variant === 'error' ? styles.errorIcon : styles.emptyIcon}>{icon}</span>
          <span>{message}</span>
        </div>
      ))}
    </>
  );
};

export default ChartStateGrid;
