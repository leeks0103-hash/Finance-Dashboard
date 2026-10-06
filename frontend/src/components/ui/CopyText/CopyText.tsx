import { useState, useCallback, useContext, type MouseEvent } from 'react';
import HighlightText from '@/components/ui/HighlightText/HighlightText';
import { Button } from '@/components/ui/Button';
import { FileOpenVisibleContext } from '@/components/ui/fileOpenContext';
import type { FileOpener } from '@/types/fileOpen.types';
import styles from './CopyText.module.css';

interface Props {
  text: string;
  className?: string;
  /** 부모 폭을 넘으면 한 줄로 자르고 … 표시(전체는 title 툴팁) — 좁은 칸에 긴 값이 오는 표용 */
  truncate?: boolean;
  highlight?: string;
  /** 제공 시: 더블클릭→onSearch 호출(클릭은 항상 복사). 미제공 시: 더블클릭 동작 없음 */
  onSearch?: (text: string) => void;
  /** 제공 시: 텍스트 옆에 "↗" 바로가기 버튼 — 클릭하면 onOpen(원본 PPT 열기).
   *  2026-09-15 주석 처리했다가 2026-09-29 복구. 관리자 설정(FileOpenVisibleContext)이 숨김이면 안 보임.
   *  Promise를 돌려주면 끝날 때까지 버튼에 스피너("파일 여는 중") 표시.
   *  onOpen.openFolder가 있으면 ↗ 옆에 폴더 버튼도(파일이 든 폴더 열기, 2026-10-06) */
  onOpen?: FileOpener;
  /** 가운데 정렬 칸용 — 오른쪽에 숨겨 둔 호버 복사 아이콘 자리만큼 왼쪽에도 여백을 줘서 글자가 칸 정중앙에 오게 */
  centered?: boolean;
}

// 파일 열기 스피너 최소 표시 시간 — 서버가 바로 응답해도 깜빡 지나가지 않게
const OPENING_MIN_MS = 600;

/** ↗ 대신 쓰는 SVG 아이콘 — 글꼴 문자(↗)는 폰트마다 굵기·크기·위치가 달라 표 안에서 삐뚤게 보였음 */
const OpenIcon = () => (
  <svg className={styles.openIcon} viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
    <path d="M5 2H2.5A.5.5 0 0 0 2 2.5v7a.5.5 0 0 0 .5.5h7a.5.5 0 0 0 .5-.5V7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path className={styles.openArrow} d="M7 2h3v3M10 2 5.5 6.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** 폴더 아이콘 — ↗와 같은 선 굵기·크기 */
const FolderIcon = () => (
  <svg className={styles.openIcon} viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
    <path d="M1.5 3.2v5.6a.7.7 0 0 0 .7.7h7.6a.7.7 0 0 0 .7-.7V4.6a.7.7 0 0 0-.7-.7H6L5 2.5H2.2a.7.7 0 0 0-.7.7Z"
      fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
  </svg>
);

/** 폴더 열림 ✓ */
const DoneIcon = () => (
  <svg className={styles.openIcon} viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
    <path d="M2.5 6.3 5 8.7l4.6-5.2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// 복사 완료 표시 길이 — CopyText.module.css .check/.copied 애니메이션(1.5s)과 맞출 것
const COPIED_MS = 1500;

const CopyText = ({ text, className, highlight, onSearch, onOpen, truncate, centered }: Props) => {
  const [copied, setCopied] = useState(false);
  const [opening, setOpening] = useState(false);
  // 폴더 열기 — 누르면 스피너, 열리면 ✓ 잠깐(복사·↗처럼 눌렀다는 반응, 2026-10-06)
  const [folderState, setFolderState] = useState<'idle' | 'busy' | 'done'>('idle');
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

  const handleOpenFolder = async (e: MouseEvent) => {
    e.stopPropagation();
    if (!onOpen?.openFolder || folderState === 'busy') return;
    setFolderState('busy');
    const minWait = new Promise(r => setTimeout(r, OPENING_MIN_MS));
    let ok = false;
    try {
      const [r] = await Promise.all([onOpen.openFolder(text), minWait]);
      ok = !!(r as { ok?: boolean } | undefined)?.ok;
    } finally {
      setFolderState(ok ? 'done' : 'idle');
      if (ok) setTimeout(() => setFolderState('idle'), COPIED_MS);
    }
  };

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

  // 바로가기(↗)가 같이 있으면 호버 복사 아이콘을 아예 안 그림 — 평소엔 숨겨둔 복사 아이콘 자리(12px)가 글자와 ↗
  // 사이에 빈칸으로 남아 ↗가 글자에서 멀리 떨어져 보였음(2026-09-30). ↗ 뒤에 복사 아이콘을 띄우는 안은
  // "아이콘 둘이 나란히 생기는 건 아닌 것 같다"로 반려 → 글자 호버 배경으로만 복사 가능함을 알리고,
  // 복사한 직후의 ✓만 ↗ 뒤 자리에 잠깐 표시. 전체 폭은 그대로라 표 컬럼 폭은 안 바뀜
  const showOpen = !!onOpen && canOpen;
  // 복사 후: 텍스트 체크마크 / 복사 전: CSS로만 만든 아이콘(after면 호버 아이콘 없이 ✓만)
  const copyIcon = (after: boolean) => (
    <span className={`${styles.icon} ${after ? styles.iconAfter : ''} ${copied ? styles.check : ''}`} aria-hidden="true">
      {copied ? '✓' : ''}
    </span>
  );

  return (
    <span className={`${styles.wrap} ${truncate ? styles.truncWrap : ''}`}>
      <span
        className={`${styles.root} ${truncate ? styles.truncWrap : ''} ${copied ? styles.copied : ''} ${centered && !showOpen ? styles.centered : ''} ${className ?? ''}`}
        onClick={handleClick}
        onDoubleClick={handleDblClick}
        title={title}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && copy()}
      >
        {truncate
          ? <span className={styles.truncText}><HighlightText text={text} query={highlight} /></span>
          : <HighlightText text={text} query={highlight} />}
        {!showOpen && copyIcon(false)}
      </span>
      {showOpen && (
        <Button
          unstyled
          className={`${styles.openBtn} ${opening ? styles.opening : ''}`}
          title={opening ? '파일 여는 중…' : `원본 파일 열기(바로가기) — ${text}`}
          aria-label={opening ? '파일 여는 중' : '바로가기'}
          aria-busy={opening}
          onClick={handleOpen}
        >
          {opening ? <span className={styles.openSpinner} aria-hidden="true" /> : <OpenIcon />}
        </Button>
      )}
      {showOpen && onOpen?.openFolder && (
        <Button unstyled
          className={`${styles.openBtn} ${styles.folderBtn} ${folderState === 'busy' ? styles.opening : ''} ${folderState === 'done' ? styles.folderDone : ''}`}
          title={folderState === 'busy' ? '폴더 여는 중…' : folderState === 'done' ? '폴더를 열었습니다' : `파일이 있는 폴더 열기 — ${text}`}
          aria-label={folderState === 'done' ? '폴더 열림' : '폴더 열기'} aria-busy={folderState === 'busy'}
          onClick={handleOpenFolder}>
          {folderState === 'busy' ? <span className={styles.openSpinner} aria-hidden="true" />
            : folderState === 'done' ? <DoneIcon /> : <FolderIcon />}
        </Button>
      )}
      {showOpen && copyIcon(true)}
    </span>
  );
};

export default CopyText;
