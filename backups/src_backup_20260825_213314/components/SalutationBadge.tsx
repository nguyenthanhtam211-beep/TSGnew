import React from 'react';
import { COCKPIT_ACCENTS } from '../lib/design-tokens';

export type SalutationType = 'Mr' | 'Mrs' | 'Ms' | 'Miss' | 'Anh' | 'Chị' | 'Ông' | 'Bà' | string;

/**
 * Phân tích và tách biệt Danh xưng (Mr, Mrs, Ms...) và Tên sạch của liên hệ
 */
export function parseContactSalutation(rawName: string = '', explicitSalutation: string = ''): {
  salutation: 'Mr' | 'Mrs' | 'Ms' | null;
  salutationLabel: string;
  cleanName: string;
} {
  let name = (rawName || '').trim();
  let sal = (explicitSalutation || '').trim();

  // If name has Mr/Mrs/Ms prefix (e.g. "Mrs Hoàn", "Mr Nguyễn Tuấn Bằng", "Ms. Ánh")
  const match = name.match(/^(Mr\.?|Mrs\.?|Ms\.?|Miss|Anh|Chị|Ông|Bà)\s+/i);
  if (match) {
    if (!sal) {
      sal = match[1].replace('.', '');
    }
    name = name.slice(match[0].length).trim();
  }

  const sLower = sal.toLowerCase();
  let normalizedType: 'Mr' | 'Mrs' | 'Ms' | null = null;
  let label = sal;

  if (sLower === 'mr' || sLower === 'ông' || sLower === 'anh' || sLower === 'nam') {
    normalizedType = 'Mr';
    label = 'Mr (Nam)';
  } else if (sLower === 'mrs' || sLower === 'bà' || sLower === 'chị' || sLower === 'nữ') {
    normalizedType = 'Mrs';
    label = 'Mrs (Nữ)';
  } else if (sLower === 'ms' || sLower === 'miss' || sLower === 'cô') {
    normalizedType = 'Ms';
    label = 'Ms (Nữ / Quý cô)';
  }

  return {
    salutation: normalizedType,
    salutationLabel: label,
    cleanName: name || rawName,
  };
}

interface SalutationBadgeProps {
  salutation?: string | null;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

/**
 * Enterprise Cockpit Salutation Badge with Apple HIG styling and spring micro-interactions.
 */
export default function SalutationBadge({ salutation, size = 'sm', showLabel = false }: SalutationBadgeProps) {
  if (!salutation) return null;

  const sLower = salutation.toLowerCase().trim();

  const sizeClasses = {
    sm: 'px-1.5 py-0.5 text-[10.5px]',
    md: 'px-2 py-0.5 text-xs',
    lg: 'px-2.5 py-1 text-xs',
  }[size] || 'px-1.5 py-0.5 text-[10.5px]';

  // Mr (Electric Blue Accent)
  if (sLower.startsWith('mr') || sLower === 'ông' || sLower === 'anh') {
    return (
      <span 
        className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-[#007AFF]/10 text-[#007AFF] border border-[#007AFF]/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_1px_2px_rgba(0,122,255,0.06)] select-none tabular-nums cockpit-spring-press hover:scale-[1.04] active:scale-[0.96] transition-transform ${sizeClasses}`}
        title="Mr (Nam / Quý ông)"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-[#007AFF] shadow-[0_0_4px_rgba(0,122,255,0.5)] inline-block" />
        <span className="font-semibold tracking-tight font-display">Mr</span>
        {showLabel && <span className="text-[10px] text-[#007AFF]/80 font-normal">Nam</span>}
      </span>
    );
  }

  // Mrs (Rose Accent)
  if (sLower.startsWith('mrs') || sLower === 'bà') {
    return (
      <span 
        className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_1px_2px_rgba(239,68,68,0.06)] select-none tabular-nums cockpit-spring-press hover:scale-[1.04] active:scale-[0.96] transition-transform ${sizeClasses}`}
        title="Mrs (Nữ / Quý bà)"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444] shadow-[0_0_4px_rgba(239,68,68,0.5)] inline-block" />
        <span className="font-semibold tracking-tight font-display">Mrs</span>
        {showLabel && <span className="text-[10px] text-[#EF4444]/80 font-normal">Nữ</span>}
      </span>
    );
  }

  // Ms (AI Purple / Indigo Accent)
  if (sLower.startsWith('ms') || sLower.startsWith('miss') || sLower === 'chị' || sLower === 'cô') {
    return (
      <span 
        className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-[#8B5CF6]/10 text-[#8B5CF6] border border-[#8B5CF6]/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_1px_2px_rgba(139,92,246,0.06)] select-none tabular-nums cockpit-spring-press hover:scale-[1.04] active:scale-[0.96] transition-transform ${sizeClasses}`}
        title="Ms (Nữ / Quý cô)"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6] shadow-[0_0_4px_rgba(139,92,246,0.5)] inline-block" />
        <span className="font-semibold tracking-tight font-display">Ms</span>
        {showLabel && <span className="text-[10px] text-[#8B5CF6]/80 font-normal">Quý cô</span>}
      </span>
    );
  }

  // Generic / Default Fallback
  return (
    <span 
      className={`inline-flex items-center gap-1 font-medium rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/80 select-none tabular-nums cockpit-spring-press ${sizeClasses}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 inline-block" />
      <span className="font-display">{salutation}</span>
    </span>
  );
}
