import React from 'react';
import clsx from 'clsx';
import { motion } from 'motion/react';

export interface CockpitCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  children: React.ReactNode;
  className?: string;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  badge?: React.ReactNode;
  interactive?: boolean;
  noPadding?: boolean;
}

export const CockpitCard: React.FC<CockpitCardProps> = ({
  children,
  className,
  title,
  subtitle,
  icon,
  action,
  badge,
  interactive = false,
  noPadding = false,
  ...props
}) => {
  const CardWrapper = interactive ? motion.div : 'div';
  const interactiveProps = interactive
    ? {
        whileHover: { y: -2, transition: { duration: 0.15, ease: 'easeOut' } },
        whileTap: { y: 0, transition: { duration: 0.1 } },
      }
    : {};

  return (
    <CardWrapper
      {...(interactiveProps as any)}
      className={clsx(
        'relative bg-white dark:bg-slate-900 border border-slate-200/85 dark:border-slate-800/85 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.02)] transition-all overflow-hidden',
        interactive && 'hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-[0_6px_16px_rgba(0,0,0,0.04)] cursor-pointer',
        className
      )}
      {...props}
    >
      {(title || icon || action || badge) && (
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2.5 min-w-0">
            {icon && (
              <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 shrink-0">
                {icon}
              </div>
            )}
            <div className="min-w-0">
              {title && (
                <h3 className="font-display font-semibold text-sm text-slate-900 dark:text-slate-100 tracking-tight truncate">
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-sans truncate">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {badge}
            {action}
          </div>
        </div>
      )}
      <div className={clsx(!noPadding && 'p-5')}>{children}</div>
    </CardWrapper>
  );
};

export default CockpitCard;
