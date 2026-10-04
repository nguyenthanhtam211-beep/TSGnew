import React from 'react';
import clsx from 'clsx';
import { Search } from 'lucide-react';

export interface TabOption {
  id: string;
  label: string;
  count?: number;
}

export interface ToolbarProps {
  searchQuery?: string;
  onSearchChange?: (val: string) => void;
  searchPlaceholder?: string;
  tabs?: TabOption[];
  activeTab?: string;
  onTabChange?: (id: string) => void;
  children?: React.ReactNode; // custom filters or action buttons
  actions?: React.ReactNode;
  className?: string;
}

export function Toolbar({
  searchQuery,
  onSearchChange,
  searchPlaceholder = "Tìm kiếm...",
  tabs,
  activeTab,
  onTabChange,
  children,
  actions,
  className,
}: ToolbarProps) {
  return (
    <div className={clsx("flex flex-col md:flex-row md:items-center justify-between gap-3 bg-surface p-2 rounded-card border border-line shadow-card", className)}>
      <div className="flex items-center gap-2 flex-1 flex-wrap">
        {/* Search Input */}
        {onSearchChange && (
          <div className="relative min-w-[200px] max-w-sm flex-1">
            <Search className="w-3.5 h-3.5 text-ink-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery || ''}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full h-8 pl-8 pr-3 text-xs bg-subtle text-ink rounded-control border border-transparent hover:border-line focus:border-brand focus:bg-surface focus:ring-2 focus:ring-brand/20 transition-all outline-none placeholder:text-ink-4"
            />
          </div>
        )}

        {/* Filter Tabs */}
        {tabs && tabs.length > 0 && (
          <div className="inline-flex p-0.5 bg-subtle rounded-control border border-line/60">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onTabChange && onTabChange(tab.id)}
                  className={clsx(
                    "px-2.5 py-1 text-xs rounded-control font-medium transition-all select-none flex items-center gap-1.5",
                    isActive
                      ? "bg-surface text-ink font-semibold shadow-xs"
                      : "text-ink-3 hover:text-ink hover:bg-surface/50"
                  )}
                >
                  <span>{tab.label}</span>
                  {tab.count !== undefined && (
                    <span className={clsx(
                      "text-[10px] px-1.5 py-0.2 rounded-full font-mono",
                      isActive ? "bg-subtle text-ink" : "bg-line/60 text-ink-3"
                    )}>
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {children}
      </div>

      {actions && (
        <div className="flex items-center gap-2 shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}

export default Toolbar;
