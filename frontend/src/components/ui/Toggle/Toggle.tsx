import styles from './Toggle.module.css';

interface Props {
  checked:  boolean;
  onChange: () => void;
  label?:   string;
}

const Toggle = ({ checked, onChange, label }: Props) => (
  <div className={styles.wrapper}>
    <button
      role="switch"
      aria-checked={checked}
      className={`${styles.track} ${checked ? styles.on : ''}`}
      onClick={onChange}
    >
      <span className={styles.thumb} />
    </button>
    {label && (
      <span className={styles.label} onClick={onChange}>{label}</span>
    )}
  </div>
);

export default Toggle;
