import type { ReactNode } from 'react';
import { Button } from '@/components/ui';
import styles from './AdminSections.module.css';

interface Props {
  title: string;
  desc: string;
  buttonLabel: string;
  onClick: () => void;
  /** 버튼 왼쪽에 붙는 작은 상태 표시(예: 추출 중…) */
  badge?: ReactNode;
}

/**
 * 관리자 페이지에서 내용이 큰 항목(실적현황 파일·PPT 추출 등)을 페이지에 펼쳐 놓지 않고 "제목 + 설명 + 열기 버튼" 한 줄 카드로 두고,
 * 눌렀을 때 모달로 여는 용도(2026-10-23 요청). 모달 자체는 쓰는 쪽이 관리 — 같은 모달을 다른 곳(상단 바)에서도 열 수 있게
 */
const AdminActionCard = ({ title, desc, buttonLabel, onClick, badge }: Props) => (
  <section className={`${styles.group} ${styles.toggleGroup}`}>
    <div className={styles.toggleText}>
      <span className={styles.label}>{title}</span>
      <span className={styles.toggleDesc}>{desc}</span>
    </div>
    {badge}
    <Button variant="primary" size="sm" onClick={onClick}>{buttonLabel}</Button>
  </section>
);

export default AdminActionCard;
