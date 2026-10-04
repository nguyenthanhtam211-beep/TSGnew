import React from 'react';
import clsx from 'clsx';

export type StatusTone = 'ok' | 'warn' | 'bad' | 'info' | 'neutral';

export interface StatusBadgeProps {
  tone?: StatusTone;
  children: React.ReactNode;
  icon?: React.ReactNode;
  showDot?: boolean;
  className?: string;
}

export function StatusBadge({
  tone = 'neutral',
  children,
  icon,
  showDot = true,
  className,
}: StatusBadgeProps) {
  const toneStyles: Record<StatusTone, { badge: string; dot: string }> = {
    ok: {
      badge: "bg-ok-soft text-ok border-ok/20",
      dot: "bg-ok",
    },
    warn: {
      badge: "bg-warn-soft text-warn border-warn/20",
      dot: "bg-warn",
    },
    bad: {
      badge: "bg-bad-soft text-bad border-bad/20",
      dot: "bg-bad",
    },
    info: {
      badge: "bg-info-soft text-info border-info/20",
      dot: "bg-info",
    },
    neutral: {
      badge: "bg-subtle text-ink-3 border-line",
      dot: "bg-ink-4",
    },
  };

  const current = toneStyles[tone];

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium border select-none",
        current.badge,
        className
      )}
    >
      {showDot && !icon && (
        <span className={clsx("w-1.5 h-1.5 rounded-full shrink-0", current.dot)} />
      )}
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </span>
  );
}

export default StatusBadge;
