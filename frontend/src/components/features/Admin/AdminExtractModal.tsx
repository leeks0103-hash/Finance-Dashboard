import { Modal } from '@/components/ui';
import type { useExtractJob } from '@/hooks/useExtractJob';
import AdminExtractSection from './AdminExtractSection';
import styles from './AdminSections.module.css';

interface Props {
  /** 호출하는 쪽의 useExtractJob 그대로 — 진행 상태·인증을 그 화면의 "추출 중…" 표시와 맞추려고 */
  extractJob: ReturnType<typeof useExtractJob>;
  /** 노란 "!"(업데이트 요청)에서 열 때 — 이 파일들을 고른 채 '선택' 방식으로 시작 */
  initialSelected?: string[];
  onClose: () => void;
}

/**
 * PPT 추출 창(2026-10-23) — 관리자 페이지의 "PPT 추출" 카드와 상단 바(노란 "!"의 추출로 열기·"추출 중…" 배지)가 같은 창을 연다.
 * 관리자 페이지로 넘어가지 않고 그 자리에서 추출·추출 현황을 보게
 */
const AdminExtractModal = ({ extractJob, initialSelected, onClose }: Props) => (
  <Modal title="PPT 추출" sub="재무·KPI PPT를 다시 읽어 데이터에 반영 · 추출 현황" width="min(1000px, 94vw)" className={styles.extractModal} onClose={onClose}>
    <AdminExtractSection extractJob={extractJob} initialSelected={initialSelected} />
  </Modal>
);

export default AdminExtractModal;
