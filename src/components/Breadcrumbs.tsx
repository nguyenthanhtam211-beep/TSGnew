import React from 'react';
import { ChevronRight, Home, LayoutDashboard, Truck, FileText, Camera, Bot, HardDrive, CheckCircle, Users, Package, HelpCircle, Settings, TrendingUp } from 'lucide-react';
import { motion } from 'motion/react';
import clsx from 'clsx';
import { SPRING_PRESETS } from '../lib/design-tokens';

export interface BreadcrumbItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  isClickable?: boolean;
}

export interface BreadcrumbsProps {
  activeTab: string;
  subTab?: string;
  itemContext?: {
    label: string;
    id?: string;
    type?: string;
  } | null;
  onNavigate: (tabId: string) => void;
  className?: string;
}

// Comprehensive tab metadata mapping
const TAB_METADATA: Record<string, { label: string; group: string; groupTitle: string; icon: React.ReactNode }> = {
  dashboard: { label: 'Bàn Làm Việc & Báo Cáo', group: 'executive', groupTitle: 'Tổng Quan & Điều Hành', icon: <LayoutDashboard size={13} className="text-blue-500" /> },
  workflow: { label: 'Quy Trình Nghiệp Vụ 5 Bước', group: 'executive', groupTitle: 'Tổng Quan & Điều Hành', icon: <TrendingUp size={13} className="text-indigo-500" /> },
  po: { label: 'Quản Lý Đơn Hàng PO', group: 'logistics', groupTitle: 'Kinh Doanh & Logistics', icon: <FileText size={13} className="text-teal-500" /> },
  factory: { label: 'Nhà Máy & Sản Xuất LGT', group: 'logistics', groupTitle: 'Kinh Doanh & Logistics', icon: <Package size={13} className="text-amber-500" /> },
  polines: { label: 'Chi Tiết Đơn Hàng PO', group: 'logistics', groupTitle: 'Kinh Doanh & Logistics', icon: <FileText size={13} className="text-teal-500" /> },
  logistics: { label: 'Kế Hoạch & Giao Hàng 360°', group: 'logistics', groupTitle: 'Kinh Doanh & Logistics', icon: <Truck size={13} className="text-orange-500" /> },
  delivery_plan: { label: 'Kế Hoạch Giao Hàng', group: 'logistics', groupTitle: 'Kinh Doanh & Logistics', icon: <Truck size={13} className="text-orange-500" /> },
  delivery: { label: 'Sổ Giao Hàng PXK', group: 'logistics', groupTitle: 'Kinh Doanh & Logistics', icon: <Truck size={13} className="text-emerald-500" /> },
  customers: { label: 'Khách Hàng & Đối Tác', group: 'commercial', groupTitle: 'Thương Mại & Danh Mục', icon: <Users size={13} className="text-sky-500" /> },
  pricing: { label: 'Bảng Giá, Hợp Đồng & Hoa Hồng', group: 'commercial', groupTitle: 'Thương Mại & Danh Mục', icon: <Package size={13} className="text-emerald-500" /> },
  contracts: { label: 'Quản Lý Hợp Đồng', group: 'commercial', groupTitle: 'Thương Mại & Danh Mục', icon: <FileText size={13} className="text-indigo-500" /> },
  commissions: { label: 'Hoa Hồng & Chiết Khấu', group: 'commercial', groupTitle: 'Thương Mại & Danh Mục', icon: <Package size={13} className="text-amber-500" /> },
  products: { label: 'Sản Phẩm & Tiêu Chuẩn Specs', group: 'commercial', groupTitle: 'Thương Mại & Danh Mục', icon: <Package size={13} className="text-purple-500" /> },
  specs: { label: 'Tiêu Chuẩn Kỹ Thuật Specs', group: 'commercial', groupTitle: 'Thương Mại & Danh Mục', icon: <Package size={13} className="text-indigo-500" /> },
  suppliers: { label: 'Nhà Cung Cấp', group: 'commercial', groupTitle: 'Thương Mại & Danh Mục', icon: <Users size={13} className="text-amber-500" /> },
  contacts: { label: 'Danh Bạ & Liên Hệ', group: 'commercial', groupTitle: 'Thương Mại & Danh Mục', icon: <Users size={13} className="text-blue-500" /> },
  ocr: { label: 'Quét OCR & Định Giá', group: 'ai_storage', groupTitle: 'AI & Trung Tâm Lưu Trữ', icon: <Camera size={13} className="text-indigo-600" /> },
  assistant: { label: 'Trợ Lý AI Gemini', group: 'ai_storage', groupTitle: 'AI & Trung Tâm Lưu Trữ', icon: <Bot size={13} className="text-purple-600" /> },
  storage: { label: 'Kho Tệp & Sổ Đối Soát', group: 'ai_storage', groupTitle: 'AI & Trung Tâm Lưu Trữ', icon: <HardDrive size={13} className="text-slate-500" /> },
  tasks: { label: 'Công Việc & Lịch Hạn', group: 'ai_storage', groupTitle: 'AI & Trung Tâm Lưu Trữ', icon: <CheckCircle size={13} className="text-emerald-600" /> },
  help: { label: 'Trợ Giúp & Cẩm Nang', group: 'system', groupTitle: 'Hệ Thống', icon: <HelpCircle size={13} className="text-blue-600" /> },
  settings: { label: 'Cài Đặt Hệ Thống', group: 'system', groupTitle: 'Hệ Thống', icon: <Settings size={13} className="text-slate-600" /> }
};

const SUBTAB_LABELS: Record<string, string> = {
  calendar: 'Lịch Giao Hàng Trực Quan',
  plan: 'Kế Hoạch Điều Phối',
  delivery: 'Sổ Giao Hàng PXK',
  reconcile: 'Đối Soát 3 Chiều',
  pricing: 'Bảng Giá Niêm Yết 2026',
  contracts: 'Danh Sách Hợp Đồng',
  commissions: 'Quản Lý Hoa Hồng',
  products: 'Danh Mục Sản Phẩm',
  specs: 'Bảng Specs Kỹ Thuật'
};

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({
  activeTab,
  subTab,
  itemContext,
  onNavigate,
  className
}) => {
  const currentMeta = TAB_METADATA[activeTab] || {
    label: activeTab,
    group: 'system',
    groupTitle: 'Hệ Thống',
    icon: <LayoutDashboard size={13} className="text-blue-500" />
  };

  const isHome = activeTab === 'dashboard' && !subTab && !itemContext;

  return (
    <nav 
      aria-label="Breadcrumb" 
      className={clsx("flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 overflow-x-auto no-scrollbar select-none", className)}
    >
      {/* Root Home Button */}
      <motion.button
        type="button"
        whileTap={{ scale: 0.92 }}
        transition={SPRING_PRESETS.cockpitSpring}
        onClick={() => onNavigate('dashboard')}
        className={clsx(
          "flex items-center gap-1.5 px-2 py-1 rounded-lg transition-colors cursor-pointer",
          isHome 
            ? "text-blue-600 dark:text-blue-400 font-bold bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-800/60 shadow-2xs" 
            : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800/60"
        )}
        title="Trở về Bàn Làm Việc"
      >
        <Home size={13} className={isHome ? "text-blue-600 dark:text-blue-400" : "text-slate-400 dark:text-slate-500"} />
        <span className="hidden sm:inline">Tổng quan</span>
      </motion.button>

      {!isHome && (
        <>
          {/* Chevron Separator */}
          <ChevronRight size={12} className="text-slate-300 dark:text-slate-600 shrink-0" />

          {/* Group Category */}
          <span className="hidden md:inline-flex items-center text-slate-400 dark:text-slate-500 text-[11px] font-semibold tracking-wide uppercase px-1">
            {currentMeta.groupTitle}
          </span>

          <ChevronRight size={12} className="hidden md:inline-block text-slate-300 dark:text-slate-600 shrink-0" />

          {/* Current Active View Pill */}
          <motion.button
            type="button"
            whileTap={{ scale: 0.95 }}
            transition={SPRING_PRESETS.cockpitSpring}
            onClick={() => onNavigate(activeTab)}
            className={clsx(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-colors cursor-pointer shrink-0",
              !subTab && !itemContext
                ? "bg-blue-50/90 dark:bg-blue-950/50 text-[#007AFF] dark:text-blue-400 font-bold border border-blue-200/70 dark:border-blue-800/60 shadow-2xs"
                : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800/60 font-semibold"
            )}
          >
            {currentMeta.icon}
            <span className="truncate max-w-[140px] sm:max-w-[220px]">{currentMeta.label}</span>
          </motion.button>
        </>
      )}

      {/* Subtab Segment if present */}
      {subTab && (
        <>
          <ChevronRight size={12} className="text-slate-300 dark:text-slate-600 shrink-0" />
          <span className={clsx(
            "flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold shrink-0",
            !itemContext 
              ? "bg-blue-50/90 dark:bg-blue-950/50 text-[#007AFF] dark:text-blue-400 font-bold border border-blue-200/70 dark:border-blue-800/60 shadow-2xs"
              : "text-slate-600 dark:text-slate-300"
          )}>
            {SUBTAB_LABELS[subTab] || subTab}
          </span>
        </>
      )}

      {/* Item Context (e.g. PO Code, Product Name) */}
      {itemContext && (
        <>
          <ChevronRight size={12} className="text-slate-300 dark:text-slate-600 shrink-0" />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-1.5 px-2.5 py-0.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60 rounded-lg text-xs font-mono font-bold shadow-2xs shrink-0"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="truncate max-w-[160px] sm:max-w-[240px]">{itemContext.label}</span>
          </motion.div>
        </>
      )}
    </nav>
  );
};

export default Breadcrumbs;
