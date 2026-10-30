import { Modal } from '@/components/ui';
import PartHeadcountPanel, { type HeadcountKind } from './PartHeadcountPanel';

interface Props {
  /** 처음 보여 줄 연도 — 2027 계획 보기 카드에서 열면 'y27' */
  initialKind?: HeadcountKind;
  onClose: () => void;
}

/**
 * 파트별 인원 입력 창(2026-10-23) — 실적 탭 "파트별 인원" 카드 오른쪽 끝의 [인원 입력](AdminQuickActions, 2026-10-29 — 예전엔 상단 바 아이콘).
 * 관리자 기능 창에는 넣지 않음. 인원은 관리자만 고칠 수 있음
 */
// 계획 인원은 2026-10-27 주석 처리 — 부제도 현재 인원만 안내
const PartHeadcountModal = ({ initialKind, onClose }: Props) => (
  <Modal title="파트별 인원" sub="2026·2027 인원 — 각 연도 보기 인당 차트의 분모, 저장하면 모든 사용자에게 바로 반영됩니다"
    width="min(960px, 94vw)" onClose={onClose}>
    <PartHeadcountPanel hideTitle initialKind={initialKind} />
  </Modal>
);

export default PartHeadcountModal;
