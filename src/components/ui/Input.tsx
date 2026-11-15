import { useId } from 'react';
import type { ComponentProps } from 'react';
import { cn } from '../../utils/cn';
import styles from './Field.module.css';

export interface InputProps extends ComponentProps<'input'> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: string;
}

export function Input(props: InputProps) {
  const {
    label,
    error,
    hint,
    icon,
    id: propsId,
    required,
    className,
    ...rest
  } = props;

  const generatedId = useId();
  const id = propsId ?? generatedId;
  const errorId = error ? `${id}-error` : undefined;
  const hintId = hint && !error ? `${id}-hint` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn(styles.wrapper, className)}>
      {label && (
        <label htmlFor={id} className={styles.label}>
          {label}
          {required && (
            <span className={styles.requiredMark} aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      <div
        className={cn(
          styles.fieldWrapper,
          icon && styles.withIcon,
          error && styles.hasError
        )}
      >
        {icon && (
          <span
            className={cn(styles.icon, 'material-symbols-outlined')}
            aria-hidden="true"
          >
            {icon}
          </span>
        )}
        <input
          id={id}
          className={cn(styles.input)}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={describedBy}
          {...rest}
        />
      </div>
      {error && (
        <p id={errorId} className={cn(styles.message, styles.errorMessage)} role="alert">
          {error}
        </p>
      )}
      {hint && !error && (
        <p id={hintId} className={cn(styles.message, styles.hintMessage)}>
          {hint}
        </p>
      )}
    </div>
  );
}