import { useState } from 'react';
import { Button } from '@/components/ui';
import ChartColorModal from './ChartColorModal';
import styles from './AdminSections.module.css';

/**
 * 관리자 페이지 > 차트 색상(2026-10-23 — 예전엔 ⚙ 메뉴의 "차트 색상 > 색상 바꾸기", 이제 관리자 기능).
 * 역할(매출·원가·계획…)별 색을 고르는 창(ChartColorModal)을 여기서 연다. 색은 이 브라우저(localStorage)에만 저장됨(2026-10-08)
 */
const AdminChartColorSection = () => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <section className={`${styles.group} ${styles.toggleGroup}`}>
        <div className={styles.toggleText}>
          <span className={styles.label}>차트 색상</span>
          <span className={styles.toggleDesc}>
            막대·도넛 차트의 역할별 색(주간/야간 따로)을 고릅니다 — 이 브라우저에만 저장되며 다른 사람 화면에는 적용되지 않습니다
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>색상 바꾸기</Button>
      </section>
      {open && <ChartColorModal onClose={() => setOpen(false)} />}
    </>
  );
};

export default AdminChartColorSection;
