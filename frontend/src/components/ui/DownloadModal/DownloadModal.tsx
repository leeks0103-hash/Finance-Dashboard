import { useEffect, useState } from 'react';
import styles from './DownloadModal.module.css';

interface Props {
  open: boolean;
  filename?: string;
}

/**
 * PDF 다운로드 진행 모달
 * - open=true: 서버 응답 대기 중 (indeterminate progress)
 * - open=false: 자동으로 사라짐
 */
const DownloadModal = ({ open, filename = '파일' }: Props) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setVisible(true);
    } else {
      // 100% 애니메이션 완료 후 fade out
      const t = setTimeout(() => setVisible(false), 400);
      return () => clearTimeout(t);
    }
  }, [open]);

  if (!visible) return null;

  return (
    <div className={`${styles.overlay} ${!open ? styles.fading : ''}`}>
      <div className={styles.modal}>
        <div className={styles.icon}>📄</div>
        <div className={styles.title}>{filename} 생성 중…</div>
        <div className={styles.subtitle}>서버에서 PDF를 생성하고 있습니다.</div>
        <div className={styles.track}>
          <div className={`${styles.bar} ${open ? styles.running : styles.done}`} />
        </div>
        <div className={styles.hint}>잠시만 기다려 주세요</div>
      </div>
    </div>
  );
};

export default DownloadModal;
