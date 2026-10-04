import React, { forwardRef } from 'react';
import clsx from 'clsx';

export interface FieldProps {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
}: FieldProps) {
  return (
    <div className={clsx("space-y-1.5", className)}>
      {label && (
        <label className="block text-xs font-semibold text-ink-2 select-none">
          {label}
          {required && <span className="text-bad ml-1 font-bold">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-xs text-bad font-medium">{error}</p>
      ) : hint ? (
        <p className="text-xs text-ink-3">{hint}</p>
      ) : null}
    </div>
  );
}

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({
  error,
  className,
  ...rest
}, ref) => {
  return (
    <input
      ref={ref}
      className={clsx(
        "w-full h-9 px-3 text-xs bg-surface text-ink rounded-control border transition-all outline-none",
        "placeholder:text-ink-4",
        error 
          ? "border-bad focus:ring-2 focus:ring-bad/30" 
          : "border-line hover:border-line-strong focus:border-brand focus:ring-2 focus:ring-brand/20",
        "disabled:opacity-50 disabled:bg-subtle disabled:pointer-events-none",
        className
      )}
      {...rest}
    />
  );
});

Input.displayName = 'Input';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(({
  error,
  className,
  children,
  ...rest
}, ref) => {
  return (
    <select
      ref={ref}
      className={clsx(
        "w-full h-9 px-3 text-xs bg-surface text-ink rounded-control border transition-all outline-none cursor-pointer",
        error 
          ? "border-bad focus:ring-2 focus:ring-bad/30" 
          : "border-line hover:border-line-strong focus:border-brand focus:ring-2 focus:ring-brand/20",
        "disabled:opacity-50 disabled:bg-subtle disabled:pointer-events-none",
        className
      )}
      {...rest}
    >
      {children}
    </select>
  );
});

Select.displayName = 'Select';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({
  error,
  className,
  ...rest
}, ref) => {
  return (
    <textarea
      ref={ref}
      className={clsx(
        "w-full p-3 text-xs bg-surface text-ink rounded-control border transition-all outline-none resize-none",
        "placeholder:text-ink-4",
        error 
          ? "border-bad focus:ring-2 focus:ring-bad/30" 
          : "border-line hover:border-line-strong focus:border-brand focus:ring-2 focus:ring-brand/20",
        "disabled:opacity-50 disabled:bg-subtle disabled:pointer-events-none",
        className
      )}
      {...rest}
    />
  );
});

Textarea.displayName = 'Textarea';

export default Field;
