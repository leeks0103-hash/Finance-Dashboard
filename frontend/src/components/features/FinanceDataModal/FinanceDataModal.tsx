import { Button, ModalShell, ModalCloseButton } from '@/components/ui';
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
  // 메인 재무현황 ActionBar의 CSV 버튼은 담당자 지정으로 내려가 있지만, 이 모달은 별개 요청
  // (2026-09-23 — "재무 데이터 확인 모달에 csv 만들어줘")이라 exportCsv를 그대로 재사용
  const { exportCsv } = useExport();

  // 제목 없는 큰 패널이라 표준 Modal 대신 뼈대만 — 스크롤 잠금·ESC·퇴장 애니메이션은 ModalShell이 처리
  return (
    <ModalShell onClose={onClose} className={styles.panel} overlayClassName={styles.overlay}>
      {close => (
        <>
          {/* 모달 제목("재무 데이터 확인")은 표 제목("프로젝트 재무 상세")과 중복이라 삭제, CSV는 표
              제목줄 오른쪽 끝으로(2026-09-28) — 헤더엔 닫기 버튼만 */}
          <div className={styles.header}>
            <ModalCloseButton onClick={close} />
          </div>
          <div className={styles.body}>
            <ProjectTable toolbarExtra={<Button variant="success" size="sm" onClick={exportCsv}>↓ CSV</Button>} />
          </div>
        </>
      )}
    </ModalShell>
  );
};

export default FinanceDataModal;
