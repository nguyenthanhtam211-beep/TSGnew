import React, { forwardRef } from 'react';
import clsx from 'clsx';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
  children,
  variant = 'secondary',
  size = 'md',
  icon,
  iconRight,
  loading = false,
  disabled,
  className,
  type = 'button',
  ...rest
}, ref) => {
  const isDisabled = disabled || loading;

  const baseStyles = "inline-flex items-center justify-center font-medium transition-all select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100";

  const sizeStyles = {
    sm: "h-8 px-2.5 text-xs rounded-md gap-1.5",
    md: "h-9 px-3.5 text-xs rounded-md gap-2 font-semibold",
    lg: "h-10 px-4 text-sm rounded-lg gap-2 font-semibold",
  };

  const variantStyles = {
    primary: "bg-brand text-white hover:bg-brand-hover shadow-xs border border-transparent",
    secondary: "bg-surface text-ink-2 border border-line hover:bg-subtle hover:text-ink shadow-xs",
    ghost: "bg-transparent text-ink-3 hover:text-ink hover:bg-subtle border border-transparent",
    danger: "bg-bad-soft text-bad border border-bad/20 hover:bg-bad hover:text-white transition-colors",
    subtle: "bg-subtle text-ink-2 hover:bg-line border border-transparent",
  };

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      className={clsx(baseStyles, sizeStyles[size], variantStyles[variant], className)}
      {...rest}
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
      ) : icon ? (
        <span className="shrink-0">{icon}</span>
      ) : null}
      
      {children && <span>{children}</span>}

      {!loading && iconRight && (
        <span className="shrink-0">{iconRight}</span>
      )}
    </button>
  );
});

Button.displayName = 'Button';
export default Button;
