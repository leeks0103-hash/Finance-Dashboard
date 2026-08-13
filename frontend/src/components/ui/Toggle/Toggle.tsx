import styles from './Toggle.module.css';

interface Props {
  checked:   boolean;
  onChange:  () => void;
  label?:    string;  // 트랙 내부에 표시되는 텍스트
  disabled?: boolean;
}

const Toggle = ({ checked, onChange, label, disabled = false }: Props) => (
  <button
    role="switch"
    aria-checked={checked}
    aria-label={label}
    aria-disabled={disabled}
    disabled={disabled}
    className={`${styles.track} ${checked ? styles.on : ''} ${disabled ? styles.disabled : ''}`}
    onClick={onChange}
  >
    {label && <span className={styles.innerLabel}>{label}</span>}
    <span className={styles.thumb} />
  </button>
);

export default Toggle;
