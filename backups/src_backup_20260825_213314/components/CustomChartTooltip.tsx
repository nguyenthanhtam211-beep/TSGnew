import React from 'react';
import { RECHARTS_PALETTE } from '../lib/design-tokens';

export interface CustomChartTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string | number;
  title?: string;
  subtitle?: string;
  isCurrency?: boolean;
  isPercentage?: boolean;
  unit?: string;
  showTotal?: boolean;
  totalLabel?: string;
  theme?: 'dark' | 'light' | 'auto';
  formatter?: (value: any, name: string, item: any, index: number) => [string, string] | string;
  indicatorStyle?: 'dot' | 'pill' | 'bar';
}

/**
 * Format currency in Vietnamese Dong (VNĐ) with high-density tabular numbers
 */
export function formatVND(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '0 đ';
  const num = typeof value === 'string' ? parseFloat(value.replace(/,/g, '')) || 0 : value;
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num);
}

/**
 * Compact currency formatter for high-density cards (e.g. 1.5 Tỷ, 320 Tr)
 */
export function formatCompactVND(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '0 đ';
  const num = typeof value === 'string' ? parseFloat(value.replace(/,/g, '')) || 0 : value;
  const abs = Math.abs(num);
  if (abs >= 1_000_000_000) {
    return `${(num / 1_000_000_000).toFixed(2)} Tỷ đ`;
  }
  if (abs >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)} Tr đ`;
  }
  return formatVND(num);
}

/**
 * Reusable Glassmorphic Recharts Tooltip Component for TSG Enterprise Cockpit
 */
export const CustomChartTooltip: React.FC<CustomChartTooltipProps> = ({
  active,
  payload,
  label,
  title,
  subtitle,
  isCurrency = true,
  isPercentage = false,
  unit,
  showTotal = false,
  totalLabel = 'Tổng cộng',
  theme = 'dark',
  formatter,
  indicatorStyle = 'dot',
}) => {
  if (!active || !payload || !payload.length) {
    return null;
  }

  // Calculate sum for total display if requested
  const totalValue = showTotal
    ? payload.reduce((sum, item) => {
        const val = typeof item.value === 'number' ? item.value : parseFloat(String(item.value || 0));
        return isNaN(val) ? sum : sum + val;
      }, 0)
    : null;

  const displayTitle = title || (label !== undefined && label !== null ? String(label) : '');

  const isDark = theme === 'dark';

  return (
    <div
      className={`min-w-[200px] max-w-[320px] rounded-xl p-3 shadow-2xl transition-all duration-150 animate-in fade-in-0 zoom-in-95 pointer-events-none select-none z-50 ${
        isDark
          ? 'bg-slate-900/92 backdrop-blur-xl border border-white/15 text-slate-100 shadow-[0_20px_40px_-10px_rgba(0,0,0,0.5)]'
          : 'bg-white/95 backdrop-blur-xl border border-slate-200/90 text-slate-800 shadow-[0_16px_32px_-8px_rgba(15,23,42,0.15)]'
      }`}
    >
      {/* Tooltip Header */}
      {displayTitle && (
        <div className={`pb-2 mb-2 border-b flex items-center justify-between gap-2 ${
          isDark ? 'border-slate-800' : 'border-slate-100'
        }`}>
          <div>
            <div className={`text-xs font-bold tracking-tight ${
              isDark ? 'text-slate-100' : 'text-slate-900'
            }`}>
              {displayTitle}
            </div>
            {subtitle && (
              <div className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {subtitle}
              </div>
            )}
          </div>
          <span className={`text-[9.5px] font-mono px-1.5 py-0.5 rounded uppercase font-semibold ${
            isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
          }`}>
            Cockpit
          </span>
        </div>
      )}

      {/* Series Items */}
      <div className="space-y-1.5">
        {payload.map((item, idx) => {
          const color = item.color || item.fill || item.stroke || RECHARTS_PALETTE.colors[idx % RECHARTS_PALETTE.colors.length];
          const rawValue = item.value;
          
          let formattedValue = '';
          let displayName = item.name || item.dataKey || `Chỉ số ${idx + 1}`;

          if (formatter) {
            const custom = formatter(rawValue, displayName, item, idx);
            if (Array.isArray(custom)) {
              formattedValue = custom[0];
              displayName = custom[1] || displayName;
            } else {
              formattedValue = custom;
            }
          } else if (isPercentage) {
            formattedValue = `${typeof rawValue === 'number' ? rawValue.toFixed(1) : rawValue}%`;
          } else if (isCurrency) {
            formattedValue = formatVND(rawValue);
          } else {
            formattedValue = new Intl.NumberFormat('vi-VN').format(Number(rawValue) || 0) + (unit ? ` ${unit}` : '');
          }

          return (
            <div
              key={`tooltip-item-${idx}`}
              className="flex items-center justify-between gap-3 text-xs leading-tight"
            >
              <div className="flex items-center gap-2 min-w-0">
                {indicatorStyle === 'dot' && (
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs ring-2 ring-white/10"
                    style={{ backgroundColor: color }}
                  />
                )}
                {indicatorStyle === 'pill' && (
                  <span
                    className="w-3.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: color }}
                  />
                )}
                {indicatorStyle === 'bar' && (
                  <span
                    className="w-1 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: color }}
                  />
                )}
                <span
                  className={`truncate font-medium text-[11.5px] ${
                    isDark ? 'text-slate-300' : 'text-slate-600'
                  }`}
                  title={displayName}
                >
                  {displayName}
                </span>
              </div>

              <div className="text-right shrink-0">
                <span
                  className={`font-mono font-bold text-xs tabular-nums ${
                    isDark ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  {formattedValue}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Optional Total Section */}
      {showTotal && totalValue !== null && (
        <div
          className={`mt-2.5 pt-2 border-t flex items-center justify-between gap-3 text-xs ${
            isDark ? 'border-slate-800' : 'border-slate-100'
          }`}
        >
          <span className={`font-semibold text-[11.5px] ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
            {totalLabel}
          </span>
          <span className="font-mono font-black text-xs tabular-nums text-emerald-400">
            {isCurrency ? formatVND(totalValue) : new Intl.NumberFormat('vi-VN').format(totalValue) + (unit ? ` ${unit}` : '')}
          </span>
        </div>
      )}
    </div>
  );
};

export default CustomChartTooltip;
