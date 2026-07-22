import type { ReactNode } from 'react';
import styles from './InsightListCard.module.css';

// 헤드리스 컴파운드 — title 문자열 prop → Title 슬롯으로 승격
// 소비자가 뱃지·카운트 등 임의 ReactNode를 타이틀에 삽입 가능

const Root = ({ children }: { children: ReactNode }) => (
  <div className={styles.card}>{children}</div>
);

const Title = ({ children }: { children: ReactNode }) => (
  <div className={styles.title}>{children}</div>
);

const Body = ({ children }: { children: ReactNode }) => (
  <div className={styles.body}>{children}</div>
);

export const InsightListCard = Object.assign(Root, { Title, Body });
