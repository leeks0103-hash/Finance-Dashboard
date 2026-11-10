import { Button } from '@/components/ui';
import { useDataHealthException } from '@/hooks/useDataHealth';
import { alertDialog, confirmDialog } from '@/utils/dialog';
import styles from './HealthAckButton.module.css';

interface Props {
  /** 예외 처리할 파일들 — 코드 충돌은 그 충돌의 파일 전부 */
  files: string[];
}

/**
 * 데이터 이상("!") 목록의 **관리자 전용** '예외 처리' 버튼(2026-11-10) — 한 파일에 프로젝트 코드가 둘인데 KPI는 하나인 것처럼
 * 의도한 불일치를 빨간 "!"에서 뺌. 모든 사람 화면에서 사라지고 관리자 페이지(PPT 추출 > 예외 처리한 데이터 이상)에 남음.
 * PPT가 고쳐져 이상의 내용이 바뀌면 서버가 저절로 풀어 다시 "!"가 뜸. "수정 완료"(담당자 표시)와는 별개
 */
const HealthExceptionButton = ({ files }: Props) => {
  const ex = useDataHealthException();
  const run = async () => {
    const ok = await confirmDialog(
      '예외 처리하면 **모든 사람 화면에서 이 이상의 빨간 느낌표가 사라집니다.**\n'
      + '관리자 페이지(PPT 추출 > 예외 처리한 데이터 이상)에는 남고, PPT가 고쳐져 이상의 내용이 바뀌면 자동으로 다시 표시돼요.',
      { title: '예외 처리할까요?', confirmText: '예외 처리' },
    );
    if (!ok) return;
    try {
      const r = await ex.set(files, true);
      if (!r.ok) await alertDialog(r.error ?? '예외 처리하지 못했습니다', { error: true });
    } catch {
      await alertDialog('예외 처리하지 못했습니다 — 잠시 뒤 다시 시도하세요', { error: true });
    }
  };
  return (
    <Button unstyled className={styles.btn} onClick={run} disabled={ex.pending}
      title="의도한 불일치면 눌러 주세요 — 빨간 느낌표에서 빠지고 관리자 페이지에 남습니다">
      예외 처리
    </Button>
  );
};

export default HealthExceptionButton;
