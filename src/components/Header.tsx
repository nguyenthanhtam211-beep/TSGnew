import React, { useState, useEffect } from 'react';
import { 
  Menu, PanelLeftClose, PanelLeft, Search, Database, Bot, 
  HelpCircle, Settings, Maximize2, Minimize2, Bell, Sparkles,
  Command, CheckCircle2, RefreshCw, X, ArrowRight, ShieldCheck,
  FileText, Truck, Users, Package, HardDrive
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import clsx from 'clsx';
import { Breadcrumbs } from './Breadcrumbs';
import { SPRING_PRESETS } from '../lib/design-tokens';

export interface HeaderProps {
  activeTab: string;
  onNavigate: (tabId: string) => void;
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  subTab?: string;
  itemContext?: {
    label: string;
    id?: string;
    type?: string;
  } | null;
  onOpenMemoryModal: () => void;
  onOpenHelpModal: () => void;
  onToggleFullscreen?: () => void;
  onOpenMobileMenu?: () => void;
  dbCount?: number;
  selectedRegion?: 'north' | 'all' | 'south';
  onRegionChange?: (region: 'north' | 'all' | 'south') => void;
  isSyncing?: boolean;
  className?: string;
}

interface SearchResultItem {
  id: string;
  title: string;
  category: string;
  icon: React.ReactNode;
  tabId: string;
  shortcut?: string;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onNavigate,
  isSidebarCollapsed,
  onToggleSidebar,
  subTab,
  itemContext,
  onOpenMemoryModal,
  onOpenHelpModal,
  onToggleFullscreen,
  onOpenMobileMenu,
  dbCount = 13,
  selectedRegion = 'north',
  onRegionChange,
  isSyncing = false,
  className
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSearchPaletteOpen, setIsSearchPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState('');
  const [selectedResultIndex, setSelectedResultIndex] = useState(0);

  // Sync fullscreen state
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Global Cmd+K / Ctrl+K keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchPaletteOpen(prev => !prev);
      } else if (e.key === 'Escape' && isSearchPaletteOpen) {
        setIsSearchPaletteOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchPaletteOpen]);

  // Search items database for Cmd+K palette
  const SEARCH_ITEMS: SearchResultItem[] = [
    { id: 'dash', title: 'Bàn Làm Việc & Báo Cáo Doanh Thu', category: 'Điều Hành', icon: <FileText size={15} className="text-blue-500" />, tabId: 'dashboard', shortcut: '⌘1' },
    { id: 'po', title: 'Quản Lý Đơn Hàng PO Mua Bán', category: 'Logistics', icon: <FileText size={15} className="text-teal-500" />, tabId: 'po', shortcut: '⌘2' },
    { id: 'logistics', title: 'Kế Hoạch & Giao Hàng 360° (PXK)', category: 'Logistics', icon: <Truck size={15} className="text-orange-500" />, tabId: 'logistics', shortcut: '⌘3' },
    { id: 'pricing', title: 'Bảng Giá Niêm Yết, Hợp Đồng & Hoa Hồng', category: 'Thương Mại', icon: <Package size={15} className="text-emerald-500" />, tabId: 'pricing' },
    { id: 'cust', title: 'Danh Sách Khách Hàng & Đối Tác', category: 'Thương Mại', icon: <Users size={15} className="text-sky-500" />, tabId: 'customers' },
    { id: 'prod', title: 'Sản Phẩm & Tiêu Chuẩn Specs', category: 'Thương Mại', icon: <Package size={15} className="text-purple-500" />, tabId: 'products' },
    { id: 'ocr', title: 'Quét OCR Trích Xuất Chứng Từ Tự Động', category: 'AI & Kho', icon: <Bot size={15} className="text-indigo-500" />, tabId: 'ocr' },
    { id: 'ai', title: 'Trợ Lý AI Gemini Tư Vấn Kinh Doanh', category: 'AI & Kho', icon: <Sparkles size={15} className="text-purple-500" />, tabId: 'assistant' },
    { id: 'storage', title: 'Kho Tệp & Sổ Đối Soát Tài Liệu', category: 'AI & Kho', icon: <HardDrive size={15} className="text-slate-500" />, tabId: 'storage' },
    { id: 'tasks', title: 'Lịch Làm Việc & Công Việc Cần Xử Lý', category: 'Điều Hành', icon: <CheckCircle2 size={15} className="text-emerald-500" />, tabId: 'tasks' },
    { id: 'settings', title: 'Cài Đặt Hệ Thống & Phân Quyền', category: 'Hệ Thống', icon: <Settings size={15} className="text-slate-500" />, tabId: 'settings' },
    { id: 'help', title: 'Cẩm Nang Hướng Dẫn Sử Dụng Chi Tiết', category: 'Hệ Thống', icon: <HelpCircle size={15} className="text-blue-500" />, tabId: 'help' },
  ];

  const filteredSearchResults = SEARCH_ITEMS.filter(item => {
    const q = paletteQuery.toLowerCase().trim();
    if (!q) return true;
    return item.title.toLowerCase().includes(q) || item.category.toLowerCase().includes(q) || item.tabId.toLowerCase().includes(q);
  });

  const handleSelectResult = (tabId: string) => {
    onNavigate(tabId);
    setIsSearchPaletteOpen(false);
    setPaletteQuery('');
  };

  const handleToggleFullscreenInternal = () => {
    if (onToggleFullscreen) {
      onToggleFullscreen();
    } else {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => console.warn(err));
      } else {
        document.exitFullscreen().catch(err => console.warn(err));
      }
    }
  };

  return (
    <>
      {/* Main Glassmorphism Header Bar */}
      <header className={clsx(
        "sticky top-0 z-30 w-full h-14 backdrop-blur-md bg-white/85 dark:bg-slate-900/85 border-b border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between px-3 sm:px-5 transition-all select-none print:hidden",
        className
      )}>
        {/* Left Section: Mobile Menu / Desktop Sidebar Toggle + TSG Pill + Breadcrumbs */}
        <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
          {/* Mobile Hamburger Drawer Trigger */}
          <motion.button
            type="button"
            whileTap={{ scale: 0.92 }}
            onClick={onOpenMobileMenu}
            className="lg:hidden p-1.5 -ml-1 text-slate-700 dark:text-slate-200 hover:text-slate-900 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            aria-label="Mở Menu Điều Hướng"
          >
            <Menu size={20} />
          </motion.button>

          {/* Desktop Sidebar Toggle Button */}
          <motion.button
            type="button"
            whileTap={{ scale: 0.92 }}
            transition={SPRING_PRESETS.cockpitSpring}
            onClick={onToggleSidebar}
            className="hidden lg:flex items-center justify-center p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-slate-100/80 dark:hover:bg-slate-800/60 transition cursor-pointer"
            title={isSidebarCollapsed ? "Mở rộng Sidebar (⌘B)" : "Thu gọn Sidebar (⌘B)"}
          >
            {isSidebarCollapsed ? (
              <PanelLeft size={18} className="text-slate-600 dark:text-slate-300" />
            ) : (
              <PanelLeftClose size={18} className="text-slate-600 dark:text-slate-300" />
            )}
          </motion.button>

          {/* Collapsed TSG Mini Badge */}
          {isSidebarCollapsed && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              className="hidden lg:flex items-center gap-1.5 px-2 py-0.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg shadow-xs text-xs font-black tracking-tight"
            >
              TSG
            </motion.div>
          )}

          {/* Hairline Divider */}
          <div className="h-4 w-px bg-slate-200/80 dark:bg-slate-700/80 hidden sm:block shrink-0" />

          {/* Dynamic Breadcrumbs */}
          <div className="min-w-0 flex-1">
            <Breadcrumbs 
              activeTab={activeTab}
              subTab={subTab}
              itemContext={itemContext}
              onNavigate={onNavigate}
            />
          </div>
        </div>

        {/* Center / Right Section: Region Switcher, Cmd+K Search, DB Pulse, AI Sparkle, Actions, Avatar */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Regional Switcher Pill */}
          <div className="flex items-center p-0.5 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200/60 dark:border-slate-700/60 text-xs font-bold">
            <button
              type="button"
              onClick={() => onRegionChange && onRegionChange('north')}
              className={clsx(
                "px-2 sm:px-2.5 py-1 rounded-lg text-[11px] transition cursor-pointer flex items-center gap-1",
                selectedRegion === 'north'
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              )}
              title="Lọc 3 khách hàng Miền Bắc (Thăng Long, Bắc Sơn, Thanh Hóa)"
            >
              <span>🌟 Miền Bắc</span>
            </button>

            <button
              type="button"
              onClick={() => onRegionChange && onRegionChange('south')}
              className={clsx(
                "px-2 sm:px-2.5 py-1 rounded-lg text-[11px] transition cursor-pointer flex items-center gap-1",
                selectedRegion === 'south'
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              )}
              title="Lọc khách hàng Miền Nam (Bến Tre, Sài Gòn)"
            >
              <span>Miền Nam</span>
            </button>

            <button
              type="button"
              onClick={() => onRegionChange && onRegionChange('all')}
              className={clsx(
                "px-2 sm:px-2.5 py-1 rounded-lg text-[11px] transition cursor-pointer flex items-center gap-1",
                selectedRegion === 'all'
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              )}
              title="Toàn bộ công ty (Dành cho Kế toán)"
            >
              <span className="hidden sm:inline">Toàn công ty</span>
              <span className="sm:hidden">Tất cả</span>
            </button>
          </div>

          {/* Quick Search Cmd+K Trigger Pill */}
          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            transition={SPRING_PRESETS.cockpitSpring}
            onClick={() => setIsSearchPaletteOpen(true)}
            className="hidden xl:flex items-center gap-2.5 px-3 py-1.5 bg-slate-100/90 hover:bg-slate-200/80 dark:bg-slate-800/70 dark:hover:bg-slate-800/90 border border-slate-200/70 dark:border-slate-700/60 rounded-xl text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition shadow-2xs group cursor-pointer"
            title="Tìm kiếm nhanh toàn hệ thống (⌘K)"
          >
            <Search size={13} className="text-slate-400 group-hover:text-blue-500 transition-colors" />
            <span className="text-[11.5px] font-medium hidden lg:inline">Tìm nhanh tính năng, đơn hàng...</span>
            <span className="text-[11.5px] font-medium lg:hidden">Tìm nhanh...</span>
            <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9.5px] font-mono font-bold bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 rounded-md text-slate-500 shadow-2xs">
              ⌘K
            </kbd>
          </motion.button>

          {/* Database Sync Status Pill */}
          <motion.button
            type="button"
            whileTap={{ scale: 0.95 }}
            transition={SPRING_PRESETS.cockpitSpring}
            onClick={onOpenMemoryModal}
            className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 bg-emerald-50/90 hover:bg-emerald-100/90 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/70 rounded-xl text-xs font-semibold transition cursor-pointer shadow-2xs"
            title="Trung tâm cơ sở dữ liệu & Sao lưu Drive"
          >
            {isSyncing ? (
              <RefreshCw size={13} className="text-emerald-600 animate-spin" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            )}
            <span className="text-[11px] hidden sm:inline">{dbCount} CSDL • Online</span>
            <span className="text-[11px] font-mono font-bold sm:hidden">{dbCount}</span>
          </motion.button>

          {/* Gemini AI Sparkle Quick Trigger */}
          <motion.button
            type="button"
            whileTap={{ scale: 0.95 }}
            transition={SPRING_PRESETS.cockpitSpring}
            onClick={() => onNavigate('assistant')}
            className={clsx(
              "flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs",
              activeTab === 'assistant'
                ? "bg-purple-600 text-white shadow-purple-500/25"
                : "bg-purple-50/90 hover:bg-purple-100/90 dark:bg-purple-950/40 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800/70"
            )}
            title="Mở Trợ Lý AI Gemini 2.5"
          >
            <Sparkles size={13} className={activeTab === 'assistant' ? "text-amber-300 animate-pulse" : "text-purple-600"} />
            <span className="text-[11px] hidden sm:inline">AI Trợ lý</span>
            <span className="text-[11px] sm:hidden">AI</span>
          </motion.button>

          {/* Help Guide Modal Trigger */}
          <motion.button
            type="button"
            whileTap={{ scale: 0.92 }}
            onClick={onOpenHelpModal}
            className="hidden sm:flex items-center justify-center p-1.5 text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            title="Cẩm Nang Hướng Dẫn Sử Dụng (F1)"
          >
            <HelpCircle size={17} />
          </motion.button>

          {/* Fullscreen Toggle Button */}
          <motion.button
            type="button"
            whileTap={{ scale: 0.92 }}
            onClick={handleToggleFullscreenInternal}
            className="hidden lg:flex items-center justify-center p-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            title={isFullscreen ? "Thoát toàn màn hình" : "Toàn màn hình (⌃⌘F)"}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </motion.button>

          {/* User Profile Avatar Pill */}
          <motion.div 
            whileTap={{ scale: 0.96 }}
            onClick={() => onNavigate('settings')}
            className="flex items-center gap-2 pl-1 sm:pl-1.5 pr-2 py-1 bg-slate-100/80 hover:bg-slate-200/70 dark:bg-slate-800/60 dark:hover:bg-slate-800/90 border border-slate-200/60 dark:border-slate-700/60 rounded-full transition cursor-pointer shadow-2xs select-none"
            title="Tài khoản Quản Trị • Cài đặt"
          >
            <div className="relative">
              <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center text-[10px] font-black shadow-2xs">
                TSG
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border border-white dark:border-slate-900" />
            </div>
            <div className="hidden xl:flex flex-col text-left">
              <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 leading-none">Nguyễn Tâm</span>
              <span className="text-[9px] font-medium text-slate-400 leading-none mt-0.5">Admin</span>
            </div>
          </motion.div>
        </div>
      </header>

      {/* Global Command Palette / Quick Search Modal (Cmd+K) */}
      <AnimatePresence>
        {isSearchPaletteOpen && (
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 sm:pt-28 px-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSearchPaletteOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm"
            />

            {/* Dialog Container */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={SPRING_PRESETS.cockpitSpring}
              className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden z-10"
            >
              {/* Search Bar Input */}
              <div className="flex items-center px-4 py-3 border-b border-slate-200/70 dark:border-slate-800 gap-3 bg-slate-50/70 dark:bg-slate-800/40">
                <Search size={18} className="text-blue-500 shrink-0" />
                <input
                  autoFocus
                  type="text"
                  value={paletteQuery}
                  onChange={(e) => {
                    setPaletteQuery(e.target.value);
                    setSelectedResultIndex(0);
                  }}
                  placeholder="Tìm nhanh phân hệ, đơn hàng PO, khách hàng, báo cáo..."
                  className="flex-1 bg-transparent border-none outline-none text-sm text-slate-900 dark:text-white placeholder:text-slate-400 font-medium"
                />
                {paletteQuery && (
                  <button 
                    onClick={() => setPaletteQuery('')}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60"
                  >
                    <X size={14} />
                  </button>
                )}
                <kbd className="px-2 py-0.5 text-[10px] font-mono font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-400 shadow-2xs">
                  ESC
                </kbd>
              </div>

              {/* Results List */}
              <div className="max-h-[340px] overflow-y-auto p-2 space-y-1 custom-scrollbar">
                {filteredSearchResults.length === 0 ? (
                  <div className="py-8 text-center text-slate-400">
                    <p className="text-xs">Không tìm thấy phân hệ nào phù hợp với từ khóa &ldquo;{paletteQuery}&rdquo;</p>
                  </div>
                ) : (
                  filteredSearchResults.map((item, idx) => (
                    <motion.button
                      key={item.id}
                      type="button"
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleSelectResult(item.tabId)}
                      className={clsx(
                        "w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition cursor-pointer group",
                        idx === selectedResultIndex 
                          ? "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300" 
                          : "hover:bg-slate-100/80 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 flex items-center justify-center shadow-2xs shrink-0">
                          {item.icon}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold truncate group-hover:text-blue-600 transition-colors">
                            {item.title}
                          </p>
                          <p className="text-[10px] text-slate-400 font-medium">
                            {item.category} • Phân hệ TSG
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {item.shortcut && (
                          <span className="hidden sm:inline-block px-1.5 py-0.5 text-[9px] font-mono font-bold bg-slate-200/60 dark:bg-slate-800 rounded text-slate-500">
                            {item.shortcut}
                          </span>
                        )}
                        <ArrowRight size={14} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
                      </div>
                    </motion.button>
                  ))
                )}
              </div>

              {/* Palette Footer */}
              <div className="px-4 py-2.5 border-t border-slate-200/60 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between text-[11px] text-slate-400">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={13} className="text-emerald-500" />
                  <span>TSG Business OS • Điều hướng thông minh</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>Nhấn</span>
                  <kbd className="px-1.5 py-0.2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[9px] font-mono">↵ Chọn</kbd>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Header;
