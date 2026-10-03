import React from 'react';
import { Search, X, SlidersHorizontal, RefreshCw, Download, Plus, LayoutGrid, List } from 'lucide-react';
import clsx from 'clsx';
import CockpitButton from './CockpitButton';

export interface CockpitTableToolbarStat {
  label: string;
  value: string | number;
  sub?: string;
  tone?: 'default' | 'cobalt' | 'emerald' | 'amber' | 'rose';
}

export interface CockpitTableFilterTab {
  id: string;
  label: string;
  count?: number;
  icon?: React.ReactNode;
}

export interface CockpitTableToolbarProps {
  moduleCode: string;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  stats?: CockpitTableToolbarStat[];
  
  // Search
  searchTerm: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  searchResultCount?: number;

  // Tabs
  tabs?: CockpitTableFilterTab[];
  activeTab?: string;
  onTabChange?: (tabId: string) => void;

  // Custom filters dropdowns slot
  filtersSlot?: React.ReactNode;

  // Actions slot
  onRefresh?: () => void;
  onExport?: () => void;
  onAddNew?: () => void;
  addNewLabel?: string;
  extraActionsSlot?: React.ReactNode;

  // View mode
  viewMode?: 'table' | 'cards';
  onViewModeChange?: (mode: 'table' | 'cards') => void;
}

export default function CockpitTableToolbar({
  moduleCode,
  title,
  subtitle,
  icon,
  stats = [],
  searchTerm,
  onSearchChange,
  searchPlaceholder = 'Tìm kiếm dữ liệu...',
  searchResultCount,
  tabs = [],
  activeTab,
  onTabChange,
  filtersSlot,
  onRefresh,
  onExport,
  onAddNew,
  addNewLabel = 'Thêm mới',
  extraActionsSlot,
  viewMode,
  onViewModeChange,
}: CockpitTableToolbarProps) {
  return (
    <div className="space-y-3.5 mb-4">
      {/* 1. Header Banner & Live HUD Metrics Ribbon */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-[0_1px_3px_0_rgba(15,23,42,0.03)] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Module Identity */}
        <div className="flex items-start sm:items-center gap-3.5">
          {icon && (
            <div className="w-11 h-11 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-md shadow-slate-900/10">
              {icon}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200/80 inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                {moduleCode}
              </span>
              <span className="text-slate-300 hidden sm:inline">•</span>
              <span className="text-[11px] font-medium text-slate-500 font-mono">REALTIME SYNC</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold font-display text-slate-900 tracking-tight mt-0.5">
              {title}
            </h1>
            {subtitle && (
              <p className="text-xs text-slate-500 mt-0.5 hidden sm:block">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Live HUD Metrics Ribbon */}
        {stats.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {stats.map((s, idx) => {
              const toneClasses = {
                default: 'border-slate-200 bg-slate-50 text-slate-900',
                cobalt: 'border-blue-200/90 bg-blue-50/70 text-blue-900',
                emerald: 'border-emerald-200/90 bg-emerald-50/70 text-emerald-900',
                amber: 'border-amber-200/90 bg-amber-50/70 text-amber-900',
                rose: 'border-rose-200/90 bg-rose-50/70 text-rose-900',
              }[s.tone || 'default'];

              return (
                <div 
                  key={idx}
                  className={clsx(
                    "px-3 py-2 rounded-xl border shrink-0 min-w-[105px] transition-all",
                    toneClasses
                  )}
                >
                  <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
                    {s.label}
                  </p>
                  <p className="text-sm font-bold font-mono tabular-nums tracking-tight mt-0.5">
                    {s.value}
                  </p>
                  {s.sub && (
                    <p className="text-[9px] text-slate-400 mt-0.5 truncate">
                      {s.sub}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. Unified Toolbar Controls */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-3 shadow-[0_1px_2px_0_rgba(15,23,42,0.02)] flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          {/* Universal Search Input */}
          <div className="relative flex-1 min-w-[240px] max-w-xl">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full pl-9 pr-24 py-2 bg-slate-50/90 hover:bg-slate-50 focus:bg-white border border-slate-200/90 focus:border-blue-600 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-3 focus:ring-blue-100 transition-all"
            />
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
              {searchTerm && (
                <button 
                  onClick={() => onSearchChange('')}
                  className="p-1 hover:bg-slate-200/70 rounded-md text-slate-400 hover:text-slate-600 transition-colors"
                  title="Xóa tìm kiếm"
                >
                  <X size={13} />
                </button>
              )}
              {searchResultCount !== undefined && (
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-200/80 text-slate-600 font-semibold">
                  {searchResultCount} kết quả
                </span>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {extraActionsSlot}

            {onRefresh && (
              <button
                onClick={onRefresh}
                className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
                title="Làm mới dữ liệu"
              >
                <RefreshCw size={15} />
              </button>
            )}

            {onExport && (
              <button
                onClick={onExport}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors"
              >
                <Download size={14} className="text-slate-500" />
                <span className="hidden sm:inline">Xuất Excel</span>
              </button>
            )}

            {viewMode && onViewModeChange && (
              <div className="inline-flex p-1 rounded-xl bg-slate-100 border border-slate-200/80">
                <button
                  onClick={() => onViewModeChange('table')}
                  className={clsx(
                    "p-1.5 rounded-lg text-xs font-semibold transition-all",
                    viewMode === 'table' ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-700"
                  )}
                  title="Chế độ bảng"
                >
                  <List size={14} />
                </button>
                <button
                  onClick={() => onViewModeChange('cards')}
                  className={clsx(
                    "p-1.5 rounded-lg text-xs font-semibold transition-all",
                    viewMode === 'cards' ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-700"
                  )}
                  title="Chế độ thẻ Bento"
                >
                  <LayoutGrid size={14} />
                </button>
              </div>
            )}

            {onAddNew && (
              <button
                onClick={onAddNew}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm shadow-blue-500/20 transition-all hover:shadow-md hover:shadow-blue-500/25 active:scale-[0.98]"
              >
                <Plus size={15} />
                <span>{addNewLabel}</span>
              </button>
            )}
          </div>
        </div>

        {/* Tabs & Secondary Filters Ribbon */}
        {(tabs.length > 0 || filtersSlot) && (
          <div className="pt-2 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-2.5">
            {/* Segmented Filter Tabs */}
            {tabs.length > 0 && (
              <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
                {tabs.map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => onTabChange?.(tab.id)}
                      className={clsx(
                        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer",
                        isActive 
                          ? "bg-slate-900 text-white shadow-xs" 
                          : "bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/80"
                      )}
                    >
                      {tab.icon}
                      <span>{tab.label}</span>
                      {tab.count !== undefined && (
                        <span className={clsx(
                          "px-1.5 py-0.2 rounded-full text-[10px] font-mono tabular-nums font-bold ml-0.5",
                          isActive ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
                        )}>
                          {tab.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Custom Secondary Dropdown Filters */}
            {filtersSlot && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-none flex-wrap">
                {filtersSlot}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
