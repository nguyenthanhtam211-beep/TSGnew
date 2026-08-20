import React from 'react';
import { User, Sparkles } from 'lucide-react';

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
    cleanName: name || rawName
  };
}

interface SalutationBadgeProps {
  salutation?: string | null;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

/**
 * Hiển thị Icon Apple Badge tinh tế cho Mr / Mrs / Ms
 */
export default function SalutationBadge({ salutation, size = 'sm', showLabel = false }: SalutationBadgeProps) {
  if (!salutation) return null;

  const sLower = salutation.toLowerCase().trim();

  if (sLower.startsWith('mr') || sLower === 'ông' || sLower === 'anh') {
    return (
      <span 
        className={`inline-flex items-center gap-1 font-semibold rounded-full bg-blue-50/90 text-[#0071E3] border border-blue-200/80 shadow-2xs select-none ${
          size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs'
        }`}
        title="Mr (Nam / Quý ông)"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-[#0071E3] inline-block" />
        <span className="font-mono tracking-tight font-bold">Mr</span>
      </span>
    );
  }

  if (sLower.startsWith('mrs') || sLower === 'bà') {
    return (
      <span 
        className={`inline-flex items-center gap-1 font-semibold rounded-full bg-rose-50/90 text-rose-600 border border-rose-200/80 shadow-2xs select-none ${
          size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs'
        }`}
        title="Mrs (Nữ / Quý bà)"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block" />
        <span className="font-mono tracking-tight font-bold">Mrs</span>
      </span>
    );
  }

  if (sLower.startsWith('ms') || sLower.startsWith('miss') || sLower === 'chị' || sLower === 'cô') {
    return (
      <span 
        className={`inline-flex items-center gap-1 font-semibold rounded-full bg-purple-50/90 text-purple-600 border border-purple-200/80 shadow-2xs select-none ${
          size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs'
        }`}
        title="Ms (Nữ / Quý cô)"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-purple-500 inline-block" />
        <span className="font-mono tracking-tight font-bold">Ms</span>
      </span>
    );
  }

  return (
    <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded-full font-medium border border-slate-200">
      {salutation}
    </span>
  );
}
