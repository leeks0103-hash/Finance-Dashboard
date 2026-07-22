import type { ReactNode } from 'react';
import styles from './ChartCard.module.css';

// 헤드리스 컴파운드 — 로직 없음, 구조(Root/Title/Body)만 제공
// 스타일은 CSS 모듈이 담당, 소비자는 컴포지션으로 구성

const Root = ({ children }: { children: ReactNode }) => (
  <div className={styles.root}>{children}</div>
);

const Title = ({ children }: { children: ReactNode }) => (
  <div className={styles.title}>{children}</div>
);

const Body = ({ children }: { children: ReactNode }) => (
  <div className={styles.body}>{children}</div>
);

export const ChartCard = Object.assign(Root, { Title, Body });
