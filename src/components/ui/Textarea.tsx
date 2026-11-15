import { useId } from 'react';
import type { ComponentProps } from 'react';
import { cn } from '../../utils/cn';
import styles from './Field.module.css';

export interface TextareaProps extends ComponentProps<'textarea'> {
  label?: string;
  error?: string;
  hint?: string;
}

export function Textarea(props: TextareaProps) {
  const {
    label,
    error,
    hint,
    id: propsId,
    required,
    rows = 3,
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
      <div className={cn(styles.fieldWrapper, error && styles.hasError)}>
        <textarea
          id={id}
          rows={rows}
          className={cn(styles.textarea)}
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