import { Button } from '@/components/ui';
import type { DataHealthAck } from '@/api/dataHealth.api';
import styles from './HealthAckButton.module.css';

interface Props {
  ack?: DataHealthAck;
  onToggle: (done: boolean) => void;
}

const CheckIcon = () => (
  <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3.5 8.5l3 3 6-7" />
  </svg>
);

/**
 * 데이터 이상("!") 목록의 파일별 '수정 완료' 표시(2026-10-20) — PPT를 고친 사람이 누르면 서버에 남아
 * 관리자가 재추출할 파일을 알 수 있음. 재추출되면 서버가 저절로 지움(그래도 이상이면 다시 빨간 "!").
 * 줄이 길어지지 않게 시각·'재추출 대기'는 툴팁으로, 취소(×)는 마우스 올렸을 때만
 */
const HealthAckButton = ({ ack, onToggle }: Props) => {
  if (!ack) {
    return (
      <Button unstyled className={styles.btn} onClick={() => onToggle(true)}
        title="PPT를 고쳤으면 눌러 주세요 — 관리자가 보고 다시 추출합니다">
        <CheckIcon />수정 완료
      </Button>
    );
  }
  const tip = `${ack.by ? `${ack.by} · ` : ''}${ack.at.slice(5, 16)} 수정 완료 — 관리자 재추출 대기 (다시 추출하면 사라짐)`;
  return (
    <span className={styles.done} title={tip}>
      <CheckIcon />수정 완료{ack.by ? <span className={styles.by}>· {ack.by}</span> : null}
      <Button unstyled className={styles.undo} onClick={() => onToggle(false)}
        title="수정 완료 표시 취소" aria-label="수정 완료 표시 취소">×</Button>
    </span>
  );
};

export default HealthAckButton;
