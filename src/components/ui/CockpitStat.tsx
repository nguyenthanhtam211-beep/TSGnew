import React from 'react';
import clsx from 'clsx';
import { motion } from 'motion/react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export interface CockpitStatProps {
  label: string;
  value: string | number;
  subValue?: string;
  unit?: string;
  delta?: {
    value: number | string;
    trend: 'up' | 'down' | 'neutral';
    label?: string;
  };
  icon?: React.ReactNode;
  iconBg?: string;
  accentColor?: string;
  className?: string;
  onClick?: () => void;
}

export const CockpitStat: React.FC<CockpitStatProps> = ({
  label,
  value,
  subValue,
  unit,
  delta,
  icon,
  iconBg = 'bg-blue-50 dark:bg-blue-950/40 text-[#0066FF]',
  accentColor,
  className,
  onClick,
}) => {
  const StatWrapper = onClick ? motion.div : 'div';
  const motionProps = onClick
    ? {
        whileHover: { y: -2, transition: { duration: 0.15 } },
        whileTap: { y: 0 },
      }
    : {};

  return (
    <StatWrapper
      {...(motionProps as any)}
      onClick={onClick}
      className={clsx(
        'relative p-5 bg-white dark:bg-slate-900 border border-slate-200/85 dark:border-slate-800/85 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.02)] transition-all overflow-hidden flex flex-col justify-between',
        onClick && 'cursor-pointer hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-[0_4px_12px_rgba(0,0,0,0.04)]',
        className
      )}
    >
      {/* Top Header: Label & Icon */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 font-sans tracking-tight">
          {label}
        </span>
        {icon && (
          <div className={clsx('p-2 rounded-xl shrink-0', iconBg)}>
            {icon}
          </div>
        )}
      </div>

      {/* Main Metric Value: Tabular Numbers with Space Grotesk */}
      <div className="flex items-baseline gap-1.5 my-1">
        <span className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-slate-900 dark:text-slate-100 font-mono tabular-nums">
          {value}
        </span>
        {unit && (
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-sans">
            {unit}
          </span>
        )}
      </div>

      {/* Footer Info: Delta trend or Subvalue */}
      {(delta || subValue) && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-[11px]">
          {delta && (
            <span
              className={clsx(
                'inline-flex items-center gap-0.5 font-semibold font-mono px-1.5 py-0.5 rounded-md',
                delta.trend === 'up' && 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40',
                delta.trend === 'down' && 'text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40',
                delta.trend === 'neutral' && 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800'
              )}
            >
              {delta.trend === 'up' && <TrendingUp size={11} />}
              {delta.trend === 'down' && <TrendingDown size={11} />}
              {delta.trend === 'neutral' && <Minus size={11} />}
              <span>{delta.value}</span>
            </span>
          )}
          {delta?.label && (
            <span className="text-slate-400 dark:text-slate-500 truncate">
              {delta.label}
            </span>
          )}
          {subValue && (
            <span className="text-slate-500 dark:text-slate-400 truncate ml-auto font-mono text-[11px]">
              {subValue}
            </span>
          )}
        </div>
      )}
    </StatWrapper>
  );
};

export default CockpitStat;
