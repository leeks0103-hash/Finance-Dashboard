import { useState } from 'react';
import { Modal, FilterSelect } from '@/components/ui';
import { useSecretMailPreview } from '@/hooks/useSecretMail';
import type { SecretMailRow } from '@/types/secretMail.types';
import styles from './SecretMailPreviewModal.module.css';

interface Props {
  rows: SecretMailRow[];
  /** 처음 보여 줄 사람 사번 */
  initialEmp: string;
  sender: string | null;
  onClose: () => void;
}

/**
 * 시크릿 키 메일 미리보기(2026-10-22) — 서버가 실제로 보낼 때와 같은 함수(secret_mail.build_message)로 만든 메일을
 * Outlook 메일처럼 보여 줌. 키만 가림(화면을 같이 보는 자리에서 남의 키가 드러나지 않게). 사람을 바꿔 가며 확인 가능
 */
const SecretMailPreviewModal = ({ rows, initialEmp, sender, onClose }: Props) => {
  const [emp, setEmp] = useState(initialEmp);
  const { data, isLoading, error } = useSecretMailPreview(emp);
  const msg = data?.message;
  const none = <span className={styles.none}>(없음)</span>;

  return (
    <Modal title="메일 미리보기" sub="실제로 보낼 때와 같은 내용 · 시크릿 키만 가려서 보여 줍니다" width="min(1000px, 94vw)" onClose={onClose}>
      <div className={styles.root}>
        <FilterSelect label="받는 사람" value={emp} onChange={setEmp} allLabel={null}
          options={rows.map(r => ({ value: r.emp, label: `${r.name || r.emp} (${r.emp})` }))} />

        {isLoading && <span className={styles.muted}>불러오는 중…</span>}
        {error && <span className={styles.error}>{error}</span>}
        {msg && (
          <div className={styles.mail}>
            <dl className={styles.head}>
              <dt>보낸 사람</dt><dd>{sender ?? '(Outlook 기본 계정)'}</dd>
              <dt>받는 사람</dt><dd>{msg.to}</dd>
              <dt>참조</dt><dd>{msg.cc || none}</dd>
              <dt>숨은 참조</dt><dd>{msg.bcc || none}</dd>
              <dt>제목</dt><dd className={styles.subject}>{msg.subject}</dd>
            </dl>
            <pre className={styles.body}>{msg.body}</pre>
          </div>
        )}
        {data && (
          <span className={styles.muted}>
            실제 메일엔 가린 부분 없이 {data.name || data.emp}님 키 전체({data.key_length}자)가 들어갑니다.
          </span>
        )}
      </div>
    </Modal>
  );
};

export default SecretMailPreviewModal;
