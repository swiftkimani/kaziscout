import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

interface FieldShellProps {
  label: string;
  hint?: string;
  error?: string;
}

function FieldShell({
  id,
  label,
  hint,
  error,
  children,
}: FieldShellProps & { id: string; children: ReactNode }) {
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      {children}
      {hint && !error && (
        <span className="field__hint" id={`${id}-hint`}>
          {hint}
        </span>
      )}
      {error && (
        <span className="field__error" id={`${id}-error`}>
          {error}
        </span>
      )}
    </div>
  );
}

function describedBy(id: string, { hint, error }: FieldShellProps): string | undefined {
  if (error) return `${id}-error`;
  return hint ? `${id}-hint` : undefined;
}

export function TextField(props: FieldShellProps & InputHTMLAttributes<HTMLInputElement>) {
  const { label, hint, error, ...input } = props;
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <input
        {...input}
        id={id}
        className="input"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, props)}
      />
    </FieldShell>
  );
}

export function TextAreaField(
  props: FieldShellProps & TextareaHTMLAttributes<HTMLTextAreaElement>,
) {
  const { label, hint, error, ...textarea } = props;
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <textarea
        {...textarea}
        id={id}
        className="input"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, props)}
      />
    </FieldShell>
  );
}

export function SelectField(
  props: FieldShellProps & SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode },
) {
  const { label, hint, error, children, ...select } = props;
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <select {...select} id={id} className="input" aria-describedby={describedBy(id, props)}>
        {children}
      </select>
    </FieldShell>
  );
}

export function Checkbox({
  label,
  ...input
}: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="checkbox">
      <input {...input} type="checkbox" />
      {label}
    </label>
  );
}
