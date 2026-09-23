import { createPortal } from 'react-dom';
import { Button } from '@/components/ui';
import { useScrollLock } from '@/components/ui/useScrollLock';
import { useEscToClose } from '@/components/ui/useEscToClose';
import { useExport } from '@/hooks/useExport';
import ProjectTable from '@/components/features/ProjectTable';
import styles from './FinanceDataModal.module.css';

interface Props {
  onClose: () => void;
}

/**
 * 재무 데이터 단독 확인용 모달 — 설정(⚙) 드롭다운에서 열림.
 * "재무 데이터" 탭 자체는 실적현황으로 통합되면서 네비게이션에서 빠졌는데(TabNav 주석 참고),
 * 재무 원본 표만 따로 훑어보고 싶을 때 탭 전환 없이 바로 볼 방법이 없다는 요청으로 추가(2026-09-22).
 * ProjectTable은 자체 데이터훅(useProjectTableViewModel)을 갖고 있어 필터바 없이도 단독 동작.
 */
const FinanceDataModal = ({ onClose }: Props) => {
  useScrollLock();
  useEscToClose(onClose);
  // 메인 재무현황 ActionBar의 CSV 버튼은 담당자 지정으로 내려가 있지만, 이 모달은 별개 요청
  // (2026-09-23 — "재무 데이터 확인 모달에 csv 만들어줘")이라 exportCsv를 그대로 재사용
  const { exportCsv } = useExport();

  return createPortal(
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <div className={styles.panel} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className={styles.header}>
          <span className={styles.title}>재무 데이터 확인</span>
          <div className={styles.headerActions}>
            <Button variant="success" size="sm" onClick={exportCsv}>↓ CSV</Button>
            <Button unstyled className={styles.closeBtn} onClick={onClose} aria-label="닫기">✕</Button>
          </div>
        </div>
        <div className={styles.body}>
          <ProjectTable />
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default FinanceDataModal;
