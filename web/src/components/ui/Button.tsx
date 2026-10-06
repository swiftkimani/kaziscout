import { LoaderCircle } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'md' | 'sm';
  /** Shows a spinner and ignores clicks, so an action cannot be submitted twice. */
  isBusy?: boolean;
  icon?: ReactNode;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  isBusy = false,
  icon,
  children,
  onClick,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      className={`btn btn--${variant}${size === 'sm' ? ' btn--sm' : ''}`}
      aria-busy={isBusy}
      onClick={isBusy ? (event) => event.preventDefault() : onClick}
    >
      {isBusy ? <LoaderCircle className="btn__spinner" size={16} aria-hidden /> : icon}
      {children}
    </button>
  );
}
