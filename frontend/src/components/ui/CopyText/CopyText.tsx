import { useState, useCallback } from 'react';
import HighlightText from '@/components/ui/HighlightText/HighlightText';
import styles from './CopyText.module.css';

interface Props {
  text: string;
  className?: string;
  highlight?: string;
}

const CopyText = ({ text, className, highlight }: Props) => {
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

  return (
    <span
      className={`${styles.root} ${copied ? styles.copied : ''} ${className ?? ''}`}
      onClick={copy}
      title={copied ? '복사됨!' : text}
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
