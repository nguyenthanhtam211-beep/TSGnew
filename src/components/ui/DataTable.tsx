import React from 'react';
import clsx from 'clsx';
import { Loader2 } from 'lucide-react';
import CockpitTableEmptyState from './CockpitTableEmptyState';

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  render?: (row: T, index: number) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
  width?: string;
  className?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  onRowClick?: (row: T, index: number) => void;
  rowKey?: (row: T, index: number) => string | number;
  className?: string;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  loading = false,
  emptyTitle = "Không có dữ liệu",
  emptyDescription = "Thử điều chỉnh bộ lọc hoặc tạo bản ghi mới",
  onRowClick,
  rowKey,
  className,
}: DataTableProps<T>) {
  return (
    <div className={clsx("bg-surface border border-line rounded-card overflow-hidden shadow-card", className)}>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-subtle/80 border-b border-line text-ink-3 uppercase text-[11px] font-semibold tracking-wider select-none">
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{ width: col.width }}
                  className={clsx(
                    "px-3.5 py-2.5 whitespace-nowrap",
                    col.align === 'right' && "text-right",
                    col.align === 'center' && "text-center",
                    col.className
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="py-12 text-center text-ink-3">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-brand" />
                    <span className="text-xs">Đang tải dữ liệu...</span>
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="p-8">
                  <CockpitTableEmptyState
                    title={emptyTitle}
                    description={emptyDescription}
                  />
                </td>
              </tr>
            ) : (
              data.map((row, index) => {
                const key = rowKey ? rowKey(row, index) : row.id || row.key || index;
                return (
                  <tr
                    key={key}
                    onClick={() => onRowClick && onRowClick(row, index)}
                    className={clsx(
                      "transition-colors",
                      onRowClick ? "cursor-pointer hover:bg-subtle/70" : "hover:bg-subtle/40"
                    )}
                  >
                    {columns.map((col) => {
                      const value = col.render ? col.render(row, index) : row[col.key];
                      return (
                        <td
                          key={col.key}
                          className={clsx(
                            "px-3.5 py-2.5 text-ink-2 align-middle",
                            col.align === 'right' && "text-right font-mono tabular-nums",
                            col.align === 'center' && "text-center",
                            col.className
                          )}
                        >
                          {value}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default DataTable;
