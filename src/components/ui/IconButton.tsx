import React, { forwardRef } from 'react';
import clsx from 'clsx';

export type IconButtonSize = 'sm' | 'md' | 'lg';
export type IconButtonVariant = 'secondary' | 'ghost' | 'danger';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  label: string; // Mandatory for accessibility / aria-label
  size?: IconButtonSize;
  variant?: IconButtonVariant;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(({
  icon,
  label,
  size = 'md',
  variant = 'ghost',
  className,
  type = 'button',
  disabled,
  ...rest
}, ref) => {
  const baseStyles = "inline-flex items-center justify-center rounded-md transition-all select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 active:scale-95 disabled:opacity-40 disabled:pointer-events-none";

  const sizeStyles = {
    sm: "w-7 h-7 text-xs",
    md: "w-8 h-8 text-sm",
    lg: "w-9 h-9 text-base",
  };

  const variantStyles = {
    ghost: "text-ink-3 hover:text-ink hover:bg-subtle border border-transparent",
    secondary: "bg-surface text-ink-2 border border-line hover:bg-subtle hover:text-ink shadow-xs",
    danger: "text-bad hover:bg-bad-soft border border-transparent",
  };

  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      disabled={disabled}
      className={clsx(baseStyles, sizeStyles[size], variantStyles[variant], className)}
      {...rest}
    >
      {icon}
    </button>
  );
});

IconButton.displayName = 'IconButton';
export default IconButton;
