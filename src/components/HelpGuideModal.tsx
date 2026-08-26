import React, { useState } from 'react';
import { 
  HelpCircle, 
  BookOpen, 
  Sparkles, 
  TrendingUp, 
  Truck, 
  Camera, 
  HardDrive, 
  Bot, 
  ChevronRight, 
  Search, 
  X, 
  ExternalLink, 
  Layers, 
  Scale, 
  FileText, 
  Package, 
  DollarSign, 
  ShieldCheck,
  Command,
  ArrowRight,
  Database,
  CalendarDays,
  AlertTriangle,
  Building2,
  Users,
  Compass,
  ArrowUpRight,
  Filter,
  Check,
  Zap,
  Globe2
} from 'lucide-react';
import clsx from 'clsx';
import MacTrafficLights from './MacTrafficLights';

interface HelpGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab?: (tab: string) => void;
}

export default function HelpGuideModal({ isOpen, onClose, onNavigateTab }: HelpGuideModalProps) {
  const [activeCategory, setActiveCategory] = useState<'quickstart' | 'collaboration' | 'logistics' | 'ocr' | 'storage' | 'ai' | 'faq'>('quickstart');
  const [searchQuery, setSearchQuery] = useState('');

  const navigate = (tab: string) => {
    if (onNavigateTab) {
      onNavigateTab(tab);
    }
  };

  const isSearching = searchQuery.trim().length > 0;
  const q = searchQuery.toLowerCase().trim();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 lg:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150 font-sans">
      <div className="bg-[#F8F9FB] dark:bg-slate-900 rounded-3xl w-full max-w-5xl h-[92vh] max-h-[860px] flex flex-col shadow-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-150 text-slate-800 dark:text-slate-100">
        
        {/* Top Window Bar */}
        <div className="px-5 sm:px-6 py-3.5 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <MacTrafficLights onClose={onClose} />
            <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-black text-xs shadow-2xs">
                <BookOpen size={14} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                  <span>Trung Tâm Trợ Giúp & Cẩm Nang Sử Dụng</span>
                  <span className="text-[10px] font-bold uppercase bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full border border-blue-200/60 dark:border-blue-800">TSG OS 2026</span>
                </h3>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick search inside modal */}
            <div className="relative hidden sm:block w-48 lg:w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm hướng dẫn, phím tắt..."
                className="w-full pl-8 pr-7 py-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs outline-none border border-transparent focus:border-blue-400 focus:bg-white dark:focus:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              title="Đóng (Esc)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body: 2-Column macOS Help Viewer */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
          
          {/* Left Navigation Sidebar */}
          <div className="w-full md:w-64 bg-white dark:bg-slate-900 border-r border-slate-200/80 dark:border-slate-800 p-3 space-y-1 overflow-y-auto shrink-0 custom-scrollbar">
            <div className="px-3 py-1.5 text-[10.5px] font-extrabold text-slate-400 uppercase tracking-wider">
              Chủ Đề Hướng Dẫn
            </div>

            <button
              onClick={() => { setActiveCategory('quickstart'); setSearchQuery(''); }}
              className={clsx(
                "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition text-left cursor-pointer",
                activeCategory === 'quickstart' && !isSearching
                  ? "bg-blue-600 text-white shadow-xs" 
                  : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              )}
            >
              <Sparkles size={15} className={activeCategory === 'quickstart' && !isSearching ? "text-white" : "text-blue-600 dark:text-blue-400"} />
              <span className="truncate">1. Bắt Đầu & Bộ Lọc Vùng</span>
            </button>

            <button
              onClick={() => { setActiveCategory('collaboration'); setSearchQuery(''); }}
              className={clsx(
                "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition text-left cursor-pointer",
                activeCategory === 'collaboration' && !isSearching
                  ? "bg-blue-600 text-white shadow-xs" 
                  : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              )}
            >
              <Users size={15} className={activeCategory === 'collaboration' && !isSearching ? "text-white" : "text-indigo-600 dark:text-indigo-400"} />
              <span className="truncate">2. Phối Hợp GĐ & Kế Toán</span>
            </button>

            <button
              onClick={() => { setActiveCategory('logistics'); setSearchQuery(''); }}
              className={clsx(
                "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition text-left cursor-pointer",
                activeCategory === 'logistics' && !isSearching
                  ? "bg-blue-600 text-white shadow-xs" 
                  : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              )}
            >
              <Truck size={15} className={activeCategory === 'logistics' && !isSearching ? "text-white" : "text-teal-600 dark:text-teal-400"} />
              <span className="truncate">3. Kế Hoạch & Logistics 360°</span>
            </button>

            <button
              onClick={() => { setActiveCategory('ocr'); setSearchQuery(''); }}
              className={clsx(
                "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition text-left cursor-pointer",
                activeCategory === 'ocr' && !isSearching
                  ? "bg-blue-600 text-white shadow-xs" 
                  : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              )}
            >
              <Camera size={15} className={activeCategory === 'ocr' && !isSearching ? "text-white" : "text-purple-600 dark:text-purple-400"} />
              <span className="truncate">4. Quét OCR & Bảng Giá 2026</span>
            </button>

            <button
              onClick={() => { setActiveCategory('storage'); setSearchQuery(''); }}
              className={clsx(
                "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition text-left cursor-pointer",
                activeCategory === 'storage' && !isSearching
                  ? "bg-blue-600 text-white shadow-xs" 
                  : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              )}
            >
              <HardDrive size={15} className={activeCategory === 'storage' && !isSearching ? "text-white" : "text-emerald-600 dark:text-emerald-400"} />
              <span className="truncate">5. Kho Drive & Chứng Từ Gốc</span>
            </button>

            <button
              onClick={() => { setActiveCategory('ai'); setSearchQuery(''); }}
              className={clsx(
                "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition text-left cursor-pointer",
                activeCategory === 'ai' && !isSearching
                  ? "bg-blue-600 text-white shadow-xs" 
                  : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              )}
            >
              <Bot size={15} className={activeCategory === 'ai' && !isSearching ? "text-white" : "text-indigo-600 dark:text-indigo-400"} />
              <span className="truncate">6. Trợ Lý AI Gemini 3.6</span>
            </button>

            <button
              onClick={() => { setActiveCategory('faq'); setSearchQuery(''); }}
              className={clsx(
                "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition text-left cursor-pointer",
                activeCategory === 'faq' && !isSearching
                  ? "bg-blue-600 text-white shadow-xs" 
                  : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              )}
            >
              <HelpCircle size={15} className={activeCategory === 'faq' && !isSearching ? "text-white" : "text-amber-600 dark:text-amber-400"} />
              <span className="truncate">7. Câu Hỏi Thường Gặp (FAQ)</span>
            </button>

            {/* Shortcuts Mini Card */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 mt-3 px-1 space-y-2">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/70 dark:border-slate-700/60 space-y-1.5">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Phím Tắt Tiện Ích</span>
                <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400">
                  <span>Tìm nhanh</span>
                  <kbd className="px-1.5 py-0.2 bg-white dark:bg-slate-700 rounded border border-slate-200 dark:border-slate-600 font-mono text-[9.5px] font-bold">⌘K</kbd>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400">
                  <span>Toàn màn hình</span>
                  <kbd className="px-1.5 py-0.2 bg-white dark:bg-slate-700 rounded border border-slate-200 dark:border-slate-600 font-mono text-[9.5px] font-bold">⌃⌘F</kbd>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400">
                  <span>Đóng cửa sổ</span>
                  <kbd className="px-1.5 py-0.2 bg-white dark:bg-slate-700 rounded border border-slate-200 dark:border-slate-600 font-mono text-[9.5px] font-bold">Esc</kbd>
                </div>
              </div>
            </div>
          </div>

          {/* Right Content Area */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-5 custom-scrollbar bg-[#F8F9FB] dark:bg-slate-900/60">
            
            {/* Quickstart Tab */}
            {activeCategory === 'quickstart' && (
              <div className="space-y-5 animate-in fade-in duration-150">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-3xl p-6 text-white space-y-3 shadow-md">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10.5px] font-bold uppercase tracking-wider bg-white/20 px-3 py-1 rounded-full backdrop-blur-xs">
                      Hệ Điều Hành Doanh Nghiệp Tâm Sen Group
                    </span>
                    <span className="text-[10.5px] font-mono bg-emerald-400/20 text-emerald-200 px-2 py-0.5 rounded-full border border-emerald-400/30">
                      Phiên bản 2.6
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
                    Kiến Trúc TSG Business OS & Bộ Lọc Vùng Miền 1-Chạm
                  </h2>
                  <p className="text-xs sm:text-sm text-blue-100 leading-relaxed">
                    Hệ thống quản trị hợp nhất kinh doanh, tài chính, đơn hàng (PO), điều độ giao nhận (Logistics) và chứng từ OCR tự động bằng trí tuệ nhân tạo Gemini.
                  </p>
                </div>

                {/* Regional Switcher Explanation Card */}
                <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-200/80 dark:border-slate-700 shadow-xs space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h4 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                      <Compass className="text-blue-600" size={18} />
                      <span>Hướng Dẫn Sử Dụng Bộ Lọc Vùng Miền (Header)</span>
                    </h4>
                    <span className="text-[11px] font-bold text-blue-700 bg-blue-50 dark:bg-blue-950/60 dark:text-blue-300 px-2.5 py-0.5 rounded-full border border-blue-200">
                      🌟 Tính Năng Mới
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div className="p-3.5 bg-blue-50/70 dark:bg-blue-950/30 rounded-2xl border border-blue-200/70 dark:border-blue-800/60 space-y-1.5">
                      <div className="flex items-center gap-2 text-xs font-bold text-blue-800 dark:text-blue-300">
                        <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                        <span>Chế độ 🌟 Miền Bắc (Mặc định cho Bạn)</span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        Chỉ hiển thị số liệu của <strong>3 nhà máy trọng điểm</strong>: <em>Thuốc lá Thăng Long, Thuốc lá Bắc Sơn, Thuốc lá Thanh Hóa</em>. Giúp bạn tập trung điều độ mà không bị rối mắt bởi dữ liệu miền khác.
                      </p>
                    </div>

                    <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200/70 dark:border-slate-700 space-y-1.5">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                        <Globe2 size={14} className="text-slate-500" />
                        <span>Chế độ Toàn công ty (Dành cho Kế toán)</span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        Hiển thị trọn vẹn cả 2 miền (Thêm <em>Thuốc lá Sài Gòn, Bến Tre, Quốc Đại</em> &rarr; Tổng ~50,98 Tỷ ₫ / 1.108 dòng phát sinh) để kế toán lập báo cáo tài chính tổng hợp.
                      </p>
                    </div>
                  </div>
                </div>

                {/* 4 Pillars Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div className="bg-white dark:bg-slate-800 p-4.5 rounded-3xl border border-slate-200/80 dark:border-slate-700 shadow-xs space-y-2">
                    <div className="w-8 h-8 rounded-xl bg-teal-50 dark:bg-teal-950/50 text-teal-600 flex items-center justify-center">
                      <Truck size={17} />
                    </div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">1. Kế Hoạch & Logistics 360°</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      Lịch giao nhận 4 tầng (Năm/Tháng/Tuần/Ngày), chia chuyến điều độ theo PO, quản lý phiếu xuất kho và ma trận đối soát 3 chiều.
                    </p>
                  </div>

                  <div className="bg-white dark:bg-slate-800 p-4.5 rounded-3xl border border-slate-200/80 dark:border-slate-700 shadow-xs space-y-2">
                    <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 flex items-center justify-center">
                      <Camera size={17} />
                    </div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">2. OCR & Định Giá Đa Bảng</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      Chụp ảnh/PDF chứng từ giao hàng &rarr; AI tự bóc tách, đối chiếu Bảng Giá 2026, tính doanh thu, giá vốn và ghi nhận vào CSDL.
                    </p>
                  </div>

                  <div className="bg-white dark:bg-slate-800 p-4.5 rounded-3xl border border-slate-200/80 dark:border-slate-700 shadow-xs space-y-2">
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center">
                      <HardDrive size={17} />
                    </div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">3. Kho Drive & Cảnh Báo Chứng Từ</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      Tự động lưu trữ file scan trên Google Drive và gắn huy hiệu cảnh báo <strong>⚠️ Thiếu chứng từ gốc</strong> khi chưa có bản ký nhận.
                    </p>
                  </div>

                  <div className="bg-white dark:bg-slate-800 p-4.5 rounded-3xl border border-slate-200/80 dark:border-slate-700 shadow-xs space-y-2">
                    <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 flex items-center justify-center">
                      <Bot size={17} />
                    </div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">4. Trợ Lý AI Gemini 3.6</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      Phân tích tài chính, truy vấn doanh thu khách hàng, kiểm tra số lượng giao thiếu và lập kế hoạch kinh doanh tự động 24/7.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Collaboration Tab */}
            {activeCategory === 'collaboration' && (
              <div className="space-y-5 animate-in fade-in duration-150">
                <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-700 shadow-xs space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                        <Users size={20} className="text-indigo-600" />
                        <span>Mô Hình Phối Hợp 4 Bước Giữa Bạn & Kế Toán</span>
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Phân công rõ ràng - Không chồng chéo - Đủ dữ liệu đối soát
                      </p>
                    </div>

                    <button
                      onClick={() => navigate('workflow')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 rounded-xl text-xs font-bold hover:bg-indigo-100 transition cursor-pointer"
                    >
                      <span>Mở Quy Trình</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>

                  <div className="space-y-3 pt-1">
                    <div className="p-4 bg-blue-50/70 dark:bg-blue-950/30 rounded-2xl border border-blue-200/70 dark:border-blue-800/60 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-extrabold text-blue-800 dark:text-blue-300">
                          <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">1</span>
                          <span>Bước 1: Tiếp Nhận Đơn Đặt Hàng PO (Bạn phụ trách)</span>
                        </div>
                        <span className="text-[10px] font-bold bg-blue-200/60 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-2 py-0.5 rounded">Miền Bắc</span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 pl-7 leading-relaxed">
                        Bạn nhập PO hoặc quét OCR file đơn hàng của khách gửi (Thăng Long, Bắc Sơn, Thanh Hóa). Hệ thống tự lấy mã giá niêm yết từ Bảng giá 2026.
                      </p>
                    </div>

                    <div className="p-4 bg-teal-50/70 dark:bg-teal-950/30 rounded-2xl border border-teal-200/70 dark:border-teal-800/60 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-extrabold text-teal-800 dark:text-teal-300">
                          <span className="w-5 h-5 rounded-full bg-teal-600 text-white flex items-center justify-center text-[10px]">2</span>
                          <span>Bước 2: Điều Độ & Chụp BBGH Ký Nhận (Bạn phụ trách)</span>
                        </div>
                        <span className="text-[10px] font-bold bg-teal-200/60 text-teal-800 dark:bg-teal-900 dark:text-teal-200 px-2 py-0.5 rounded">Vận hành</span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 pl-7 leading-relaxed">
                        Bạn bố trí chuyến xe giao theo ngày. Khi giao xong, lái xe hoặc bạn chỉ cần dùng điện thoại chụp lại <strong>Biên bản giao hàng (BBGH) / PXK có chữ ký nhận</strong> đưa vào mục Quét OCR.
                      </p>
                    </div>

                    <div className="p-4 bg-purple-50/70 dark:bg-purple-950/30 rounded-2xl border border-purple-200/70 dark:border-purple-800/60 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-extrabold text-purple-800 dark:text-purple-300">
                          <span className="w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center text-[10px]">3</span>
                          <span>Bước 3: Xuất Hóa Đơn VAT & Nhập Số HĐ (Kế toán phụ trách)</span>
                        </div>
                        <span className="text-[10px] font-bold bg-purple-200/60 text-purple-800 dark:bg-purple-900 dark:text-purple-200 px-2 py-0.5 rounded">Tài chính</span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 pl-7 leading-relaxed">
                        Kế toán mở hệ thống, thấy trạng thái <strong>ĐÃ GIAO HÀNG</strong> và có bản scan gốc &rarr; Tiến hành xuất Hóa đơn GTGT, nhập Số hóa đơn và Ngày xuất HĐ vào hệ thống.
                      </p>
                    </div>

                    <div className="p-4 bg-emerald-50/70 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200/70 dark:border-emerald-800/60 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-extrabold text-emerald-800 dark:text-emerald-300">
                          <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">4</span>
                          <span>Bước 4: Đối Soát Công Nợ & Bù Trừ Chứng Từ (Dùng chung)</span>
                        </div>
                        <span className="text-[10px] font-bold bg-emerald-200/60 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 px-2 py-0.5 rounded">Đối soát</span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 pl-7 leading-relaxed">
                        Cả 2 bên cùng nhìn vào 1 bảng công nợ duy nhất. Nếu dòng nào còn hiện huy hiệu <strong className="text-amber-600">⚠️ Thiếu chứng từ gốc</strong>, hai bên sẽ biết ngay để bổ sung chứng từ kịp thời trước kỳ thanh toán.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Logistics 360 Tab */}
            {activeCategory === 'logistics' && (
              <div className="space-y-5 animate-in fade-in duration-150">
                <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-700 shadow-xs space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                      <Truck size={20} className="text-teal-600" />
                      <span>Hướng Dẫn Sử Dụng Kế Hoạch & Giao Hàng 360°</span>
                    </h3>

                    <button
                      onClick={() => navigate('logistics')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 rounded-xl text-xs font-bold hover:bg-teal-100 transition cursor-pointer"
                    >
                      <span>Mở Logistics Hub</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                    <div className="p-4 rounded-2xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/70 dark:border-blue-800/60 space-y-1.5">
                      <div className="flex items-center gap-2 text-xs font-bold text-blue-800 dark:text-blue-300">
                        <CalendarDays size={16} />
                        <span>1. Lịch Giao Nhận 4 Tầng</span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        Chuyển đổi linh hoạt giữa góc nhìn <strong>Năm / Tháng / Tuần / Ngày</strong> để theo dõi mật độ các chuyến xe. Nhấp vào sự kiện để xem chi tiết đơn hàng hoặc mở phiếu giao hàng.
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-teal-50/60 dark:bg-teal-950/30 border border-teal-200/70 dark:border-teal-800/60 space-y-1.5">
                      <div className="flex items-center gap-2 text-xs font-bold text-teal-800 dark:text-teal-300">
                        <Layers size={16} />
                        <span>2. Kế Hoạch Điều Độ Phân Cấp</span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        Xem cây phân cấp Đơn hàng &rarr; Chi tiết sản phẩm. Bấm <strong>"Chia Nhiều Đợt"</strong> để tách 1 đơn hàng lớn thành nhiều chuyến xe vào các ngày khác nhau.
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-orange-50/60 dark:bg-orange-950/30 border border-orange-200/70 dark:border-orange-800/60 space-y-1.5">
                      <div className="flex items-center gap-2 text-xs font-bold text-orange-800 dark:text-orange-300">
                        <FileText size={16} />
                        <span>3. Sổ Giao Hàng PXK</span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        Quản lý toàn bộ phiếu xuất kho thực tế: Biển số xe, đơn giá bán, đơn giá mua (COGS), doanh thu và lợi nhuận gộp từng chuyến xe.
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200/70 dark:border-purple-800/60 space-y-1.5">
                      <div className="flex items-center gap-2 text-xs font-bold text-purple-800 dark:text-purple-300">
                        <Scale size={16} />
                        <span>4. Đối Soát 3 Chiều</span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        Bảng ma trận tự động kiểm tra số lượng Đặt vs Kế hoạch vs Thực giao và hiển thị tỷ lệ hoàn thành (%) kèm nút xuất Excel 1-click.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* OCR Tab */}
            {activeCategory === 'ocr' && (
              <div className="space-y-5 animate-in fade-in duration-150">
                <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-700 shadow-xs space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                      <Camera size={20} className="text-purple-600" />
                      <span>Quét OCR & Tự Động Định Giá Đa Bảng</span>
                    </h3>

                    <button
                      onClick={() => navigate('ocr')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 rounded-xl text-xs font-bold hover:bg-purple-100 transition cursor-pointer"
                    >
                      <span>Mở Quét OCR</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    Sử dụng mô hình thị giác trí tuệ nhân tạo Google Gemini Vision để bóc tách siêu tốc các văn bản scan hoặc ảnh chụp:
                  </p>

                  <ol className="space-y-2.5 pt-1 text-xs text-slate-700 dark:text-slate-300 list-decimal list-inside">
                    <li className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                      <strong>Tải ảnh / PDF chứng từ lên</strong>: Kéo thả hoặc chụp ảnh trực tiếp Phiếu xuất kho (PXK), Biên bản giao hàng (BBGH) hoặc Đơn hàng (PO).
                    </li>
                    <li className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                      <strong>AI tự động nhận diện & liên kết Bảng Giá 2026</strong>: Tự động trích xuất Mã giá (<code className="bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 font-mono text-[11px]">Gsp_...</code>), Hợp đồng căn cứ, Đơn giá bán, Đơn giá mua (COGS) và % Biên lợi nhuận.
                    </li>
                    <li className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                      <strong>Tự chọn bảng giá linh hoạt</strong>: Bấm vào nút mã giá trên từng dòng để mở hộp thoại tìm kiếm và thay đổi sang mức giá hoặc hợp đồng khác nếu cần.
                    </li>
                    <li className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                      <strong>Bấm "Lưu Vào Hệ Thống"</strong>: Hệ thống tự động ghi nhận vào <strong>Deliveries</strong>, cập nhật số lượng giao trong <strong>PO Lines</strong>, đổi trạng thái <strong>Kế hoạch giao hàng</strong> sang Hoàn thành, và lưu file vào Google Drive.
                    </li>
                  </ol>
                </div>
              </div>
            )}

            {/* Storage Tab */}
            {activeCategory === 'storage' && (
              <div className="space-y-5 animate-in fade-in duration-150">
                <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-700 shadow-xs space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                      <HardDrive size={20} className="text-emerald-600" />
                      <span>Kho Lưu Trữ Google Drive & Quản Lý Chứng Từ Gốc</span>
                    </h3>

                    <button
                      onClick={() => navigate('storage')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-bold hover:bg-emerald-100 transition cursor-pointer"
                    >
                      <span>Mở Kho Tệp</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>

                  <div className="space-y-3 pt-1">
                    <div className="p-4 bg-emerald-50/70 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200/80 dark:border-emerald-800/60 space-y-1.5">
                      <strong className="text-xs font-bold text-emerald-900 dark:text-emerald-300 block">📁 Cấu Trúc Thư Mục Chuẩn Trên Google Drive:</strong>
                      <code className="text-[11px] font-mono text-emerald-800 dark:text-emerald-200 bg-white dark:bg-slate-900 px-2.5 py-1.5 rounded-xl block border border-emerald-200 dark:border-emerald-800 mt-1">
                        TSG_Business_Documents / 2026 / [Loại_Chứng_Từ] / Thang_[XX]
                      </code>
                    </div>

                    <div className="p-4 bg-amber-50/70 dark:bg-amber-950/30 rounded-2xl border border-amber-200/80 dark:border-amber-800/60 space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                      <strong className="text-amber-900 dark:text-amber-300 font-bold block flex items-center gap-1.5">
                        <AlertTriangle size={14} className="text-amber-500" />
                        <span>Ý Nghĩa Cảnh Báo "Thiếu Chứng Từ Gốc":</span>
                      </strong>
                      <p className="leading-relaxed">
                        Xuất hiện khi đơn hàng hoặc chuyến giao hàng đã có số liệu xuất kho nhưng chưa đính kèm file scan BBGH có chữ ký hoặc Hóa đơn VAT gốc. Giúp 2 bên rà soát không bị sót chứng từ trước khi thanh toán.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* AI Tab */}
            {activeCategory === 'ai' && (
              <div className="space-y-5 animate-in fade-in duration-150">
                <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-700 shadow-xs space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                      <Bot size={20} className="text-indigo-600" />
                      <span>Trợ Lý Thông Minh Gemini 3.6 Flash</span>
                    </h3>

                    <button
                      onClick={() => navigate('assistant')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 rounded-xl text-xs font-bold hover:bg-indigo-100 transition cursor-pointer"
                    >
                      <span>Mở Trợ Lý AI</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    Trợ lý ảo được kết nối trực tiếp với toàn bộ 13 cơ sở dữ liệu thời gian thực của hệ thống. Bạn có thể hỏi bằng tiếng Việt tự nhiên:
                  </p>

                  <div className="space-y-2 pt-1">
                    <div className="p-3 bg-indigo-50/60 dark:bg-indigo-950/40 rounded-xl border border-indigo-200/70 dark:border-indigo-800/60 text-xs text-indigo-900 dark:text-indigo-200 font-medium">
                      💡 <em>"Tổng doanh thu và lợi nhuận tháng này của Thuốc lá Thanh Hóa là bao nhiêu?"</em>
                    </div>
                    <div className="p-3 bg-indigo-50/60 dark:bg-indigo-950/40 rounded-xl border border-indigo-200/70 dark:border-indigo-800/60 text-xs text-indigo-900 dark:text-indigo-200 font-medium">
                      💡 <em>"Những đơn hàng PO nào của Bắc Sơn đang bị giao thiếu cần bổ sung tuần này?"</em>
                    </div>
                    <div className="p-3 bg-indigo-50/60 dark:bg-indigo-950/40 rounded-xl border border-indigo-200/70 dark:border-indigo-800/60 text-xs text-indigo-900 dark:text-indigo-200 font-medium">
                      💡 <em>"Sản phẩm nào có biên lợi nhuận thấp hơn 15% cần đàm phán lại giá với nhà cung cấp?"</em>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* FAQ Tab */}
            {activeCategory === 'faq' && (
              <div className="space-y-5 animate-in fade-in duration-150">
                <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-700 shadow-xs space-y-4">
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                    <HelpCircle size={20} className="text-amber-600" />
                    <span>Câu Hỏi Thường Gặp & Xử Lý Sự Cố (FAQ)</span>
                  </h3>

                  <div className="space-y-3 pt-1">
                    <details className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200/60 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 space-y-2 cursor-pointer" open>
                      <summary className="font-bold text-slate-900 dark:text-white text-xs">Dữ liệu của tôi được lưu ở đâu? Có bị mất khi tắt trình duyệt không?</summary>
                      <p className="text-slate-600 dark:text-slate-300 pt-2 leading-relaxed">
                        Hệ thống sử dụng cơ chế lưu trữ kép <strong>Double Storage Engine</strong>: Vừa lưu trữ an toàn trong bộ nhớ máy cục bộ (IndexedDB/Local Engine), vừa tự động đồng bộ lên máy chủ đám mây Google Firestore. Mọi thay đổi đều được bảo toàn 100% khi tắt hoặc mở lại trình duyệt.
                      </p>
                    </details>

                    <details className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200/60 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 space-y-2 cursor-pointer">
                      <summary className="font-bold text-slate-900 dark:text-white text-xs">Khi xoay ngang màn hình điện thoại thì các nút có bị che không?</summary>
                      <p className="text-slate-600 dark:text-slate-300 pt-2 leading-relaxed">
                        Hệ thống đã được tối ưu hóa giao diện di động <strong>Mobile-First & Touch-First</strong>, tự động co giãn an toàn (Safe-Area Insets) và thanh dock điều hướng đáy chỉ hiện khi xoay dọc, giúp bạn xem bảng biểu rộng rãi khi xoay ngang mà không bị che khuất.
                      </p>
                    </details>

                    <details className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200/60 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 space-y-2 cursor-pointer">
                      <summary className="font-bold text-slate-900 dark:text-white text-xs">Làm thế nào để xuất dữ liệu ra file Excel hoặc PDF?</summary>
                      <p className="text-slate-600 dark:text-slate-300 pt-2 leading-relaxed">
                        Ở mỗi bảng (Đơn hàng, Bảng giá, Sổ giao hàng, Ma trận đối soát), bạn đều có nút <strong>"Xuất Excel"</strong> hoặc <strong>"In PDF"</strong> ở góc phải phía trên để tải về báo cáo định dạng chuẩn A4 landscape.
                      </p>
                    </details>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-3.5 bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Tâm Sen Group • Tài liệu hướng dẫn v2.6 (2026)</span>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
          >
            Đã Hiểu & Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
