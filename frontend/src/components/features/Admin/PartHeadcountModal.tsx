import { Modal } from '@/components/ui';
import PartHeadcountPanel from './PartHeadcountPanel';

/**
 * 파트별 인원 바로 입력 창(2026-10-23) — 관리자가 상단 바 아이콘으로 관리자 페이지까지 가지 않고 그 자리에서 고치게.
 * 안은 관리자 페이지 섹션과 같은 PartHeadcountPanel
 */
const PartHeadcountModal = ({ onClose }: { onClose: () => void }) => (
  <Modal title="파트별 인원" sub="실적 탭 인당 매출·손익·관리비 차트의 분모 — 저장하면 모든 사용자에게 바로 반영됩니다"
    width="min(960px, 94vw)" onClose={onClose}>
    <PartHeadcountPanel hideTitle />
  </Modal>
);

export default PartHeadcountModal;
