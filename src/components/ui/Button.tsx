import { type ComponentProps, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../utils/cn';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'md' | 'sm';

interface ButtonProps extends ComponentProps<'button'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  icon?: string;
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  icon,
  children,
  className,
  type = 'button',
  disabled,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      className={cn(
        styles.button,
        styles[variant],
        styles[size],
        className
      )}
      data-full-width={fullWidth}
      disabled={isDisabled}
      aria-busy={loading}
      aria-disabled={isDisabled}
      {...rest}
    >
      {loading ? (
        <span className={styles.spinner} aria-hidden="true" />
      ) : (
        <>
          {icon && <span className={styles.icon} aria-hidden="true"><span className="material-symbols-outlined">{icon}</span></span>}
          {children && <span className={styles.label}>{children}</span>}
        </>
      )}
    </button>
  );
}

interface LinkButtonProps {
  to: string;
  external?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  icon?: string;
  className?: string;
  children: ReactNode;
}

export function LinkButton({
  to,
  external = false,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  icon,
  className,
  children,
}: LinkButtonProps) {
  const baseClasses = cn(
    styles.linkButton,
    styles[variant as keyof typeof styles],
    styles[size as keyof typeof styles],
    className
  );

  const isExternalLink = external || /^https?:\/\//i.test(to);
  const isTelOrMailto = /^(tel:|mailto:)/i.test(to);

  if (isExternalLink) {
    return (
      <a
        href={to}
        target={isTelOrMailto ? undefined : '_blank'}
        rel={isTelOrMailto ? undefined : 'noopener noreferrer'}
        className={baseClasses}
        data-full-width={fullWidth}
      >
        {icon && <span className={styles.icon} aria-hidden="true"><span className="material-symbols-outlined">{icon}</span></span>}
        {children && <span className={styles.label}>{children}</span>}
      </a>
    );
  }

  return (
    <Link
      to={to}
      className={baseClasses}
      data-full-width={fullWidth}
    >
      {icon && <span className={styles.icon} aria-hidden="true"><span className="material-symbols-outlined">{icon}</span></span>}
      {children && <span className={styles.label}>{children}</span>}
    </Link>
  );
}