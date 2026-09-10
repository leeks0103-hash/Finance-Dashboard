import { useEffect, useRef, useState } from 'react';
import { Button } from '../Button';
import styles from './DownloadMenu.module.css';

export interface DownloadItem {
  key:       string;
  label:     string;
  desc:      string;
  available: boolean;
  size:      number;
  modified:  string;
}

interface Props {
  items:     DownloadItem[];
  /** 다운로드 URL 생성 — 호출부가 API 경로를 정한다(ui는 경로를 모름) */
  hrefOf:    (key: string) => string;
  isLoading?: boolean;
  /** 버튼 표시 텍스트 — 탭마다 무엇을 받는지 바로 알 수 있도록 호출부가 지정 */
  buttonLabel?: string;
}

const fmtSize = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)}MB` : `${Math.round(bytes / 1024)}KB`;

/**
 * 엑셀 원본 다운로드 메뉴 — 버튼 하나로 접어두고 클릭 시 파일 목록을 펼친다.
 * 항목은 <a download> 라서 브라우저가 그대로 받아준다(서버가 그 시점 디스크 파일을 내보냄).
 */
export const DownloadMenu = ({ items, hrefOf, isLoading = false, buttonLabel = '↓ 엑셀' }: Props) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // 바깥 클릭 / ESC 로 닫기
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className={styles.wrap} ref={ref}>
      <Button variant="success" size="sm" onClick={() => setOpen(o => !o)} disabled={isLoading}>
        {buttonLabel}
      </Button>

      {open && (
        <div className={styles.menu} role="menu">
          <div className={styles.menuHead}>추출 엑셀 원본</div>
          {items.length === 0 && <div className={styles.empty}>받을 수 있는 파일이 없습니다</div>}
          {items.map(f => (
            f.available ? (
              <a
                key={f.key}
                className={styles.item}
                href={hrefOf(f.key)}
                download
                role="menuitem"
                onClick={() => setOpen(false)}
              >
                <span className={styles.itemLabel}>{f.label}</span>
                <span className={styles.itemDesc}>{f.desc}</span>
                <span className={styles.itemMeta}>{f.modified} · {fmtSize(f.size)}</span>
              </a>
            ) : (
              <div key={f.key} className={`${styles.item} ${styles.disabled}`} role="menuitem" aria-disabled>
                <span className={styles.itemLabel}>{f.label}</span>
                <span className={styles.itemDesc}>파일 없음 — 추출 스크립트를 먼저 실행해주세요</span>
              </div>
            )
          ))}
          <div className={styles.foot}>추출을 다시 돌리면 최신본이 받아집니다</div>
        </div>
      )}
    </div>
  );
};
