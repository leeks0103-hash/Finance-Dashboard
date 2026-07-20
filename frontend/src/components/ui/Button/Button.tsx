import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './Button.module.css';

type Variant = 'primary' | 'danger' | 'success' | 'ghost';
type Size    = 'sm' | 'md';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  children: ReactNode;
}

const Button = ({
  variant = 'ghost',
  size = 'sm',
  loading = false,
  icon,
  children,
  disabled,
  className = '',
  ...rest
}: Props) => (
  <button
    className={`${styles.btn} ${styles[variant]} ${styles[size]} ${className}`}
    disabled={disabled || loading}
    aria-busy={loading}
    {...rest}
  >
    {loading ? <span className={styles.spinner} aria-hidden /> : icon}
    {children}
  </button>
);

export default Button;
