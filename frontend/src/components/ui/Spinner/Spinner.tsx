import styles from './Spinner.module.css';

interface Props {
  size?: 'sm' | 'md' | 'lg';
  fullPage?: boolean;
  label?: string;
}

const Spinner = ({ size = 'lg', fullPage = true, label = '로딩 중…' }: Props) => (
  <div className={`${styles.wrap} ${fullPage ? styles.fullPage : ''}`} role="status" aria-label={label}>
    <div className={`${styles.ring} ${styles[size]}`} />
    {label && <span className={styles.label}>{label}</span>}
  </div>
);

export default Spinner;
