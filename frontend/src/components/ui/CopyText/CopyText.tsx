import { useState, useCallback, useContext, type MouseEvent } from 'react';
import HighlightText from '@/components/ui/HighlightText/HighlightText';
import { Button } from '@/components/ui/Button';
import { FileOpenVisibleContext } from '@/components/ui/fileOpenContext';
import styles from './CopyText.module.css';

interface Props {
  text: string;
  className?: string;
  highlight?: string;
  /** 제공 시: 더블클릭→onSearch 호출(클릭은 항상 복사). 미제공 시: 더블클릭 동작 없음 */
  onSearch?: (text: string) => void;
  /** 제공 시: 텍스트 옆에 "↗" 바로가기 버튼 — 클릭하면 onOpen(원본 PPT 열기).
   *  2026-09-15 주석 처리했다가 2026-09-29 복구. 관리자 설정(FileOpenVisibleContext)이 숨김이면 안 보임.
   *  Promise를 돌려주면 끝날 때까지 버튼에 스피너("파일 여는 중") 표시 */
  onOpen?: (text: string) => void | Promise<unknown>;
}

// 파일 열기 스피너 최소 표시 시간 — 서버가 바로 응답해도 깜빡 지나가지 않게
const OPENING_MIN_MS = 600;

/** ↗ 대신 쓰는 SVG 아이콘 — 글꼴 문자(↗)는 폰트마다 굵기·크기·위치가 달라 표 안에서 삐뚤게 보였음 */
const OpenIcon = () => (
  <svg className={styles.openIcon} viewBox="0 0 12 12" width="11" height="11" aria-hidden="true">
    <path d="M5 2H2.5A.5.5 0 0 0 2 2.5v7a.5.5 0 0 0 .5.5h7a.5.5 0 0 0 .5-.5V7" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    <path className={styles.openArrow} d="M7 2h3v3M10 2 5.5 6.5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// 복사 완료 표시 길이 — CopyText.module.css .check/.copied 애니메이션(1.5s)과 맞출 것
const COPIED_MS = 1500;

const CopyText = ({ text, className, highlight, onSearch, onOpen }: Props) => {
  const [copied, setCopied] = useState(false);
  const [opening, setOpening] = useState(false);
  const canOpen = useContext(FileOpenVisibleContext);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), COPIED_MS);
  }, [text]);

  const handleOpen = async (e: MouseEvent) => {
    e.stopPropagation();
    if (!onOpen || opening) return;
    setOpening(true);
    const minWait = new Promise(r => setTimeout(r, OPENING_MIN_MS));
    try {
      await Promise.all([onOpen(text), minWait]);
    } finally {
      setOpening(false);
    }
  };

  // stopPropagation 필수 — DataTable 안에서 쓰일 때 부모 <td>의 팝업/검색-채우기 클릭이 중복 발동되는 것 방지
  const handleClick = (e: MouseEvent) => { e.stopPropagation(); copy(); };
  const handleDblClick = onSearch
    ? (e: MouseEvent) => { e.stopPropagation(); onSearch(text); }
    : undefined;

  const title = onSearch
    ? `클릭: 복사 / 더블클릭: 검색 — ${text}`
    : (copied ? '복사됨!' : text);

  return (
    <span className={styles.wrap}>
      <span
        className={`${styles.root} ${copied ? styles.copied : ''} ${className ?? ''}`}
        onClick={handleClick}
        onDoubleClick={handleDblClick}
        title={title}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && copy()}
      >
        <HighlightText text={text} query={highlight} />
        {/* 복사 후: 텍스트 체크마크 / 복사 전: CSS로만 만든 아이콘 */}
        <span className={`${styles.icon} ${copied ? styles.check : ''}`}>
          {copied ? '✓' : ''}
        </span>
      </span>
      {onOpen && canOpen && (
        <Button
          unstyled
          className={`${styles.openBtn} ${opening ? styles.opening : ''}`}
          title={opening ? '파일 여는 중…' : `바로가기 — ${text}`}
          aria-label={opening ? '파일 여는 중' : '바로가기'}
          aria-busy={opening}
          onClick={handleOpen}
        >
          {opening ? <span className={styles.openSpinner} aria-hidden="true" /> : <OpenIcon />}
        </Button>
      )}
    </span>
  );
};

export default CopyText;
