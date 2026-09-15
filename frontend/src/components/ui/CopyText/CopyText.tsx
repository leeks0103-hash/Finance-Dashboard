import { useState, useCallback, type MouseEvent } from 'react';
import HighlightText from '@/components/ui/HighlightText/HighlightText';
// import { Button } from '@/components/ui/Button';   // 바로가기 버튼 주석 처리로 미사용(2026-09-15)
import styles from './CopyText.module.css';

interface Props {
  text: string;
  className?: string;
  highlight?: string;
  /** 제공 시: 더블클릭→onSearch 호출(클릭은 항상 복사). 미제공 시: 더블클릭 동작 없음 */
  onSearch?: (text: string) => void;
  /** 제공 시: 텍스트 옆에 "↗" 버튼이 항상 보이고, 클릭하면 onOpen 호출 — 파일명 셀의 "원본 열기" 용도.
   *  버튼 렌더링은 일단 주석 처리(2026-09-15) — prop/호출부는 그대로 둬서 복구 시 버튼만 해제하면 됨 */
  onOpen?: (text: string) => void;
}

const CopyText = ({ text, className, highlight, onSearch, onOpen: _onOpen }: Props) => {
  const [copied, setCopied] = useState(false);

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
    setTimeout(() => setCopied(false), 1500);
  }, [text]);

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
      {/* 파일 바로가기 버튼 — 일단 전부 주석 처리 (2026-09-15)
      {onOpen && (
        <Button
          unstyled
          className={styles.openBtn}
          title={`바로가기 — ${text}`}
          aria-label="바로가기"
          onClick={e => { e.stopPropagation(); onOpen(text); }}
        >
          ↗
        </Button>
      )}
      */}
    </span>
  );
};

export default CopyText;
