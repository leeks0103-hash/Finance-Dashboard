import styles from './HighlightText.module.css';

interface Props {
  text: string;
  query?: string;
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const HighlightText = ({ text, query }: Props) => {
  const q = query?.trim();
  if (!q) return <>{text}</>;

  const parts = text.split(new RegExp(`(${escapeRegExp(q)})`, 'gi'));
  if (parts.length === 1) return <>{text}</>;

  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1
          ? <mark key={`${i}-${part}`} className={styles.mark}>{part}</mark>
          : part,
      )}
    </>
  );
};

export default HighlightText;
