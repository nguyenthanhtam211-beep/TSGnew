import React from 'react';
import clsx from 'clsx';
import { motion } from 'motion/react';
import { Loader2, Check, AlertCircle } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'emerald';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';
export type ButtonState = 'idle' | 'loading' | 'success' | 'error';

export interface CockpitButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  state?: ButtonState;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  fullWidth?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-[#0066FF] hover:bg-[#0052CC] text-white border border-[#0066FF] shadow-xs active:bg-[#0047B3]',
  secondary: 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700/80',
  outline: 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300/80 dark:border-slate-700/80 shadow-2xs',
  ghost: 'bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 border border-transparent',
  danger: 'bg-rose-600 hover:bg-rose-700 text-white border border-rose-600 shadow-xs',
  emerald: 'bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-600 shadow-xs',
};

const sizeStyles: Record<ButtonSize, string> = {
  xs: 'h-7 px-2.5 text-[11px] gap-1.5 rounded-md font-medium',
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-md font-medium',
  md: 'h-9 px-4 text-xs gap-2 rounded-lg font-medium',
  lg: 'h-10 px-5 text-sm gap-2.5 rounded-lg font-medium',
};

export const CockpitButton: React.FC<CockpitButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  state = 'idle',
  icon,
  iconRight,
  fullWidth = false,
  disabled,
  className,
  onClick,
  ...props
}) => {
  const isDisabled = disabled || state === 'loading';

  return (
    <motion.button
      whileTap={!isDisabled ? { scale: 0.98 } : undefined}
      transition={{ duration: 0.1 }}
      disabled={isDisabled}
      onClick={onClick}
      className={clsx(
        'inline-flex items-center justify-center select-none font-sans transition-all duration-150',
        'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0066FF] focus-visible:ring-offset-1',
        variantStyles[variant],
        sizeStyles[size],
        fullWidth && 'w-full',
        isDisabled && 'opacity-50 cursor-not-allowed pointer-events-none',
        className
      )}
      {...(props as any)}
    >
      {state === 'loading' ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : state === 'success' ? (
        <Check className="w-3.5 h-3.5 text-emerald-400" />
      ) : state === 'error' ? (
        <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
      ) : (
        icon && <span className="shrink-0">{icon}</span>
      )}
      <span>{children}</span>
      {state === 'idle' && iconRight && <span className="shrink-0">{iconRight}</span>}
    </motion.button>
  );
};

export default CockpitButton;
