import React from 'react';
import clsx from 'clsx';

export type BadgeTone = 'cobalt' | 'emerald' | 'amber' | 'rose' | 'purple' | 'slate';
export type BadgeSize = 'xs' | 'sm' | 'md';

export interface CockpitBadgeProps {
  children: React.ReactNode;
  tone?: BadgeTone;
  size?: BadgeSize;
  dot?: boolean;
  className?: string;
  icon?: React.ReactNode;
}

const toneStyles: Record<BadgeTone, { container: string; dot: string }> = {
  cobalt: {
    container: 'bg-blue-50 dark:bg-blue-950/40 text-[#0066FF] dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60',
    dot: 'bg-[#0066FF]',
  },
  emerald: {
    container: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60',
    dot: 'bg-emerald-500',
  },
  amber: {
    container: 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60',
    dot: 'bg-amber-500',
  },
  rose: {
    container: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/60',
    dot: 'bg-rose-500',
  },
  purple: {
    container: 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 border border-purple-200/60 dark:border-purple-800/60',
    dot: 'bg-purple-500',
  },
  slate: {
    container: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/80',
    dot: 'bg-slate-400',
  },
};

const sizeStyles: Record<BadgeSize, string> = {
  xs: 'px-1.5 py-0.5 text-[10px] gap-1 rounded-sm font-semibold uppercase tracking-wider',
  sm: 'px-2 py-0.5 text-[11px] gap-1.5 rounded-md font-medium',
  md: 'px-2.5 py-1 text-xs gap-1.5 rounded-md font-medium',
};

export const CockpitBadge: React.FC<CockpitBadgeProps> = ({
  children,
  tone = 'slate',
  size = 'sm',
  dot = false,
  icon,
  className,
}) => {
  const { container, dot: dotBg } = toneStyles[tone];

  return (
    <span
      className={clsx(
        'inline-flex items-center select-none font-mono leading-none tracking-tight',
        container,
        sizeStyles[size],
        className
      )}
    >
      {dot && <span className={clsx('w-1.5 h-1.5 rounded-full shrink-0', dotBg)} />}
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </span>
  );
};

export default CockpitBadge;
