import React from 'react';
import { Search, Database, RefreshCw } from 'lucide-react';

export interface CockpitTableEmptyStateProps {
  title?: string;
  description?: string;
  searchTerm?: string;
  onClearSearch?: () => void;
  icon?: React.ReactNode;
}

export default function CockpitTableEmptyState({
  title = 'Không tìm thấy dữ liệu phù hợp',
  description = 'Thử điều chỉnh từ khóa tìm kiếm hoặc bỏ chọn các bộ lọc đang kích hoạt',
  searchTerm,
  onClearSearch,
  icon,
}: CockpitTableEmptyStateProps) {
  return (
    <div className="py-16 px-4 text-center flex flex-col items-center justify-center">
      <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200/80 flex items-center justify-center text-slate-400 mb-3.5 shadow-2xs">
        {icon || <Search size={22} />}
      </div>
      <h3 className="text-sm font-bold text-slate-800 font-display">
        {title}
      </h3>
      <p className="text-xs text-slate-400 mt-1 max-w-sm">
        {description}
      </p>
      {searchTerm && onClearSearch && (
        <button
          onClick={onClearSearch}
          className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors shadow-xs"
        >
          <RefreshCw size={12} />
          <span>Xóa bộ lọc tìm kiếm "{searchTerm}"</span>
        </button>
      )}
    </div>
  );
}
