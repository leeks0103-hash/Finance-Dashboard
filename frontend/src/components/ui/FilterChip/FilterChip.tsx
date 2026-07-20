import styles from './FilterChip.module.css';

interface Props {
  label: string;
  checked: boolean;
  onChange: () => void;
}

const FilterChip = ({ label, checked, onChange }: Props) => (
  <button
    type="button"
    className={`${styles.chip} ${checked ? styles.checked : ''}`}
    onClick={onChange}
    aria-pressed={checked}
  >
    {label}
  </button>
);

export default FilterChip;
