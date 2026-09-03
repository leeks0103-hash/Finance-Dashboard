import { useState, useCallback, type MouseEvent } from 'react';
import HighlightText from '@/components/ui/HighlightText/HighlightText';
import styles from './CopyText.module.css';

interface Props {
  text: string;
  className?: string;
  highlight?: string;
  /** 제공 시: 클릭→onSearch 호출, 더블클릭→복사. 미제공 시: 클릭→복사(기존 동작) */
  onSearch?: (text: string) => void;
}

const CopyText = ({ text, className, highlight, onSearch }: Props) => {
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

  return (
    <span
      className={`${styles.root} ${copied ? styles.copied : ''} ${className ?? ''}`}
      onClick={handleClick}
      onDoubleClick={handleDblClick}
      title={onSearch ? `클릭: 복사 / 더블클릭: 검색 — ${text}` : (copied ? '복사됨!' : text)}
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
  );
};

export default CopyText;
