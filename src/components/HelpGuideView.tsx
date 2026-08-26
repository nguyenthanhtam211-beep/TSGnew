import React, { useState } from "react";
import { 
  BookOpen, 
  Sparkles, 
  TrendingUp, 
  Truck, 
  Camera, 
  HardDrive, 
  Bot, 
  CheckCircle, 
  ChevronRight, 
  Search, 
  ExternalLink, 
  Layers, 
  Scale, 
  FileText, 
  Package, 
  DollarSign, 
  ShieldCheck,
  CalendarDays,
  HelpCircle,
  ArrowRight,
  Database,
  ArrowUpRight,
  AlertTriangle,
  Building2,
  Users,
  Compass,
  Check,
  Zap,
  Globe2,
  X
} from "lucide-react";
import clsx from "clsx";
import MacTrafficLights from "./MacTrafficLights";

interface HelpGuideViewProps {
  onNavigateTab?: (tab: string) => void;
}

export default function HelpGuideView({ onNavigateTab }: HelpGuideViewProps) {
  const [activeCategory, setActiveCategory] = useState<"quickstart" | "collaboration" | "logistics" | "ocr" | "storage" | "ai" | "faq">("quickstart");
  const [searchQuery, setSearchQuery] = useState("");

  const navigate = (tab: string) => {
    if (onNavigateTab) {
      onNavigateTab(tab);
    }
  };

  const isSearching = searchQuery.trim().length > 0;
  const q = searchQuery.toLowerCase().trim();

  return (
    <div className="space-y-6 max-w-[1700px] mx-auto p-3 sm:p-6 lg:p-8 font-sans animate-in fade-in duration-200">
      
      {/* 🌟 HERO HEADER BANNER */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0F172A] rounded-3xl p-6 sm:p-8 text-white shadow-2xl border border-slate-700/50">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-80 h-80 bg-gradient-to-bl from-blue-500/20 via-teal-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-12 w-64 h-64 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-[11px] font-bold uppercase tracking-wider backdrop-blur-md">
                  <BookOpen size={13} className="text-blue-400" />
                  TSG Business OS Knowledge Base
                </span>
                <span className="text-slate-500">•</span>
                <div className="flex items-center gap-1.5 text-xs text-slate-300 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                  <span>Cẩm nang nghiệp vụ & hướng dẫn vận hành v2.6 (2026)</span>
                </div>
              </div>
              
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
                <Sparkles className="text-blue-400" size={30} />
                <span>Trung Tâm Trợ Giúp & Cẩm Nang Sử Dụng</span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 max-w-3xl leading-relaxed">
                Hướng dẫn chi tiết quy trình phối hợp 2 miền giữa Giám đốc (Bao bì Miền Bắc) & Kế toán (Toàn công ty), điều độ Logistics 360°, bóc tách chứng từ OCR bằng AI Gemini và kiểm soát chứng từ gốc.
              </p>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                type="button"
                onClick={() => navigate("workflow")}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-xs font-bold shadow-lg shadow-blue-600/30 transition flex items-center gap-2 cursor-pointer"
              >
                <TrendingUp size={15} />
                <span>Xem Quy Trình 4 Bước</span>
              </button>

              <button
                type="button"
                onClick={() => navigate("assistant")}
                className="px-4 py-2.5 bg-white/10 hover:bg-white/20 border border-white/15 text-white rounded-2xl text-xs font-semibold backdrop-blur-md transition flex items-center gap-2 cursor-pointer"
              >
                <Bot size={15} className="text-purple-300" />
                <span>Hỏi Trợ Lý AI</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2-COLUMN ENTERPRISE GUIDE LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Navigation Sidebar (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-3 sm:p-4 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-2">
            
            {/* Live Search Input */}
            <div className="relative px-1 mb-2">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm bài viết, tính năng, phím tắt..."
                className="w-full pl-9 pr-8 py-2 bg-slate-100 dark:bg-slate-800/80 rounded-2xl text-xs outline-none border border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <div className="px-3 py-1 text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
              Danh Mục Hướng Dẫn
            </div>

            <button
              onClick={() => { setActiveCategory("quickstart"); setSearchQuery(""); }}
              className={clsx(
                "w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-bold transition text-left cursor-pointer",
                activeCategory === "quickstart" && !isSearching
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/20" 
                  : "text-slate-700 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-800/60"
              )}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={clsx("w-8 h-8 rounded-xl flex items-center justify-center shrink-0", activeCategory === "quickstart" && !isSearching ? "bg-white/20 text-white" : "bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400")}>
                  <Sparkles size={16} />
                </div>
                <div className="min-w-0">
                  <span className="block font-extrabold text-xs truncate">1. Bắt Đầu & Bộ Lọc Vùng Miền</span>
                  <span className={clsx("text-[10px] block font-normal truncate", activeCategory === "quickstart" && !isSearching ? "text-blue-100" : "text-slate-400")}>
                    Kiến trúc ERP & Lọc Miền Bắc
                  </span>
                </div>
              </div>
              <ChevronRight size={15} className={activeCategory === "quickstart" && !isSearching ? "text-white" : "text-slate-400"} />
            </button>

            <button
              onClick={() => { setActiveCategory("collaboration"); setSearchQuery(""); }}
              className={clsx(
                "w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-bold transition text-left cursor-pointer",
                activeCategory === "collaboration" && !isSearching
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/20" 
                  : "text-slate-700 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-800/60"
              )}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={clsx("w-8 h-8 rounded-xl flex items-center justify-center shrink-0", activeCategory === "collaboration" && !isSearching ? "bg-white/20 text-white" : "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400")}>
                  <Users size={16} />
                </div>
                <div className="min-w-0">
                  <span className="block font-extrabold text-xs truncate">2. Phối Hợp Giám Đốc & Kế Toán</span>
                  <span className={clsx("text-[10px] block font-normal truncate", activeCategory === "collaboration" && !isSearching ? "text-blue-100" : "text-slate-400")}>
                    Quy trình 4 bước tinh gọn
                  </span>
                </div>
              </div>
              <ChevronRight size={15} className={activeCategory === "collaboration" && !isSearching ? "text-white" : "text-slate-400"} />
            </button>

            <button
              onClick={() => { setActiveCategory("logistics"); setSearchQuery(""); }}
              className={clsx(
                "w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-bold transition text-left cursor-pointer",
                activeCategory === "logistics" && !isSearching
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/20" 
                  : "text-slate-700 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-800/60"
              )}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={clsx("w-8 h-8 rounded-xl flex items-center justify-center shrink-0", activeCategory === "logistics" && !isSearching ? "bg-white/20 text-white" : "bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400")}>
                  <Truck size={16} />
                </div>
                <div className="min-w-0">
                  <span className="block font-extrabold text-xs truncate">3. Kế Hoạch & Logistics 360°</span>
                  <span className={clsx("text-[10px] block font-normal truncate", activeCategory === "logistics" && !isSearching ? "text-blue-100" : "text-slate-400")}>
                    Lịch 4 tầng & Đối soát 3 chiều
                  </span>
                </div>
              </div>
              <ChevronRight size={15} className={activeCategory === "logistics" && !isSearching ? "text-white" : "text-slate-400"} />
            </button>

            <button
              onClick={() => { setActiveCategory("ocr"); setSearchQuery(""); }}
              className={clsx(
                "w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-bold transition text-left cursor-pointer",
                activeCategory === "ocr" && !isSearching
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/20" 
                  : "text-slate-700 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-800/60"
              )}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={clsx("w-8 h-8 rounded-xl flex items-center justify-center shrink-0", activeCategory === "ocr" && !isSearching ? "bg-white/20 text-white" : "bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400")}>
                  <Camera size={16} />
                </div>
                <div className="min-w-0">
                  <span className="block font-extrabold text-xs truncate">4. Quét OCR & Bảng Giá 2026</span>
                  <span className={clsx("text-[10px] block font-normal truncate", activeCategory === "ocr" && !isSearching ? "text-blue-100" : "text-slate-400")}>
                    Gemini Vision bóc tách & giá vốn
                  </span>
                </div>
              </div>
              <ChevronRight size={15} className={activeCategory === "ocr" && !isSearching ? "text-white" : "text-slate-400"} />
            </button>

            <button
              onClick={() => { setActiveCategory("storage"); setSearchQuery(""); }}
              className={clsx(
                "w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-bold transition text-left cursor-pointer",
                activeCategory === "storage" && !isSearching
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/20" 
                  : "text-slate-700 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-800/60"
              )}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={clsx("w-8 h-8 rounded-xl flex items-center justify-center shrink-0", activeCategory === "storage" && !isSearching ? "bg-white/20 text-white" : "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400")}>
                  <HardDrive size={16} />
                </div>
                <div className="min-w-0">
                  <span className="block font-extrabold text-xs truncate">5. Kho Drive & Chứng Từ Gốc</span>
                  <span className={clsx("text-[10px] block font-normal truncate", activeCategory === "storage" && !isSearching ? "text-blue-100" : "text-slate-400")}>
                    Cây thư mục & Cảnh báo thiếu scan
                  </span>
                </div>
              </div>
              <ChevronRight size={15} className={activeCategory === "storage" && !isSearching ? "text-white" : "text-slate-400"} />
            </button>

            <button
              onClick={() => { setActiveCategory("ai"); setSearchQuery(""); }}
              className={clsx(
                "w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-bold transition text-left cursor-pointer",
                activeCategory === "ai" && !isSearching
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/20" 
                  : "text-slate-700 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-800/60"
              )}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={clsx("w-8 h-8 rounded-xl flex items-center justify-center shrink-0", activeCategory === "ai" && !isSearching ? "bg-white/20 text-white" : "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400")}>
                  <Bot size={16} />
                </div>
                <div className="min-w-0">
                  <span className="block font-extrabold text-xs truncate">6. Trợ Lý AI Gemini 3.6 Flash</span>
                  <span className={clsx("text-[10px] block font-normal truncate", activeCategory === "ai" && !isSearching ? "text-blue-100" : "text-slate-400")}>
                    Truy vấn dữ liệu & Báo cáo
                  </span>
                </div>
              </div>
              <ChevronRight size={15} className={activeCategory === "ai" && !isSearching ? "text-white" : "text-slate-400"} />
            </button>

            <button
              onClick={() => { setActiveCategory("faq"); setSearchQuery(""); }}
              className={clsx(
                "w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-bold transition text-left cursor-pointer",
                activeCategory === "faq" && !isSearching
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/20" 
                  : "text-slate-700 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-800/60"
              )}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={clsx("w-8 h-8 rounded-xl flex items-center justify-center shrink-0", activeCategory === "faq" && !isSearching ? "bg-white/20 text-white" : "bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400")}>
                  <HelpCircle size={16} />
                </div>
                <div className="min-w-0">
                  <span className="block font-extrabold text-xs truncate">7. Câu Hỏi Thường Gặp (FAQ)</span>
                  <span className={clsx("text-[10px] block font-normal truncate", activeCategory === "faq" && !isSearching ? "text-blue-100" : "text-slate-400")}>
                    Lưu trữ dữ liệu & Khắc phục lỗi
                  </span>
                </div>
              </div>
              <ChevronRight size={15} className={activeCategory === "faq" && !isSearching ? "text-white" : "text-slate-400"} />
            </button>
          </div>

          {/* Keyboard Shortcuts Card */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-3">
            <span className="text-[10.5px] font-extrabold text-slate-400 uppercase tracking-wider block">
              Phím Tắt Toàn Hệ Thống
            </span>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-600 dark:text-slate-400 font-medium">Tìm kiếm nhanh tính năng</span>
                <kbd className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-lg border border-slate-200 dark:border-slate-700 font-mono text-[11px] font-bold">⌘K</kbd>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-600 dark:text-slate-400 font-medium">Chế độ toàn màn hình</span>
                <kbd className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-lg border border-slate-200 dark:border-slate-700 font-mono text-[11px] font-bold">⌃⌘F</kbd>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-600 dark:text-slate-400 font-medium">Mở Cẩm Nang Trợ Giúp</span>
                <kbd className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-lg border border-slate-200 dark:border-slate-700 font-mono text-[11px] font-bold">F1</kbd>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-slate-600 dark:text-slate-400 font-medium">Đóng cửa sổ / Modal</span>
                <kbd className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-lg border border-slate-200 dark:border-slate-700 font-mono text-[11px] font-bold">Esc</kbd>
              </div>
            </div>
          </div>
        </div>

        {/* Right Detail Content Panel (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Quickstart Tab */}
          {activeCategory === "quickstart" && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 flex-wrap gap-2">
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                    <Sparkles className="text-blue-600" size={22} />
                    <span>Tổng Quan Hệ Điều Hành & Bộ Lọc Vùng Miền 1-Chạm</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Cấu trúc vận hành liên kết 13 bảng CSDL và phân quyền hiển thị thông minh
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => navigate("dashboard")}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 hover:bg-blue-100 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  <span>Mở Bàn Làm Việc</span>
                  <ArrowUpRight size={14} />
                </button>
              </div>

              {/* Regional Scope Card */}
              <div className="p-5 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800/80 dark:to-slate-800/40 rounded-3xl border border-blue-200/70 dark:border-slate-700 space-y-3">
                <div className="flex items-center gap-2 text-xs font-extrabold text-blue-900 dark:text-blue-200 uppercase tracking-wide">
                  <Compass size={16} className="text-blue-600" />
                  <span>Cách Sử Dụng Bộ Lọc Vùng Miền (Header Switcher)</span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-blue-100 dark:border-slate-700 space-y-1">
                    <div className="font-bold text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                      <span>1. Chế độ 🌟 Miền Bắc (Dành cho Bạn)</span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                      Lọc trọn vẹn 3 khách hàng trọng điểm: <strong>Thuốc lá Thăng Long</strong> (~3,97 Tỷ), <strong>Thuốc lá Thanh Hóa</strong> (~1,02 Tỷ), <strong>Thuốc lá Bắc Sơn</strong> (~429 Triệu) &rarr; Tổng <strong>5,42 Tỷ ₫</strong>.
                    </p>
                  </div>

                  <div className="p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1">
                    <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Globe2 size={14} className="text-slate-500" />
                      <span>2. Chế độ Toàn công ty (Dành cho Kế toán)</span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                      Hiển thị toàn diện cả 6 nhà máy (Thêm *Sài Gòn, Bến Tre, Quốc Đại* &rarr; Tổng <strong>50,98 Tỷ ₫</strong> / 1.108 dòng) để đối soát doanh thu & giá vốn tổng thể.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/70 dark:border-slate-700 space-y-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center font-bold">
                    <Database size={16} />
                  </div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-xs">Cơ Chế Bộ Nhớ Kép (Double Storage Engine)</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Tự động lưu trữ cục bộ bảo toàn 100% dữ liệu ngoại tuyến và tự động đồng bộ tức thì lên đám mây Firestore khi có kết nối mạng.
                  </p>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/70 dark:border-slate-700 space-y-2">
                  <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 flex items-center justify-center font-bold">
                    <Camera size={16} />
                  </div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-xs">Trí Tuệ Nhân Tạo Thị Giác Gemini</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Bóc tách siêu tốc các văn bản scan, hóa đơn ảnh chụp, tự động liên kết mã giá sản phẩm 2026 và hợp đồng căn cứ.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Collaboration Tab */}
          {activeCategory === "collaboration" && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 flex-wrap gap-2">
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                    <Users className="text-indigo-600" size={22} />
                    <span>Quy Trình Phối Hợp 4 Bước Giữa Bạn & Kế Toán</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Chu trình khép kín: Nhận đơn PO &rarr; Giao hàng & Chụp BBGH &rarr; Xuất hóa đơn VAT &rarr; Đối soát công nợ
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => navigate("workflow")}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  <span>Mở Quy Trình 4 Bước</span>
                  <ArrowUpRight size={14} />
                </button>
              </div>

              <div className="space-y-3.5">
                <div className="p-4 bg-blue-50/60 dark:bg-blue-950/30 rounded-2xl border border-blue-200/70 dark:border-blue-800/60 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-extrabold text-blue-800 dark:text-blue-300">
                      <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">1</span>
                      <span>Bước 1: Tiếp Nhận PO & Chọn Khách Hàng (Bạn phụ trách)</span>
                    </div>
                    <span className="text-[10px] font-bold bg-blue-200/60 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-2 py-0.5 rounded">Miền Bắc</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 pl-7 leading-relaxed">
                    Khi nhận được đơn hàng (PO) từ Thăng Long, Bắc Sơn, Thanh Hóa &rarr; Bạn vào mục <strong>Quản Lý Đơn Hàng PO</strong> hoặc <strong>Quét OCR</strong> để tạo đơn. Hệ thống tự động điền danh mục sản phẩm và giá niêm yết theo Hợp Đồng 2026.
                  </p>
                </div>

                <div className="p-4 bg-teal-50/60 dark:bg-teal-950/30 rounded-2xl border border-teal-200/70 dark:border-teal-800/60 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-extrabold text-teal-800 dark:text-teal-300">
                      <span className="w-5 h-5 rounded-full bg-teal-600 text-white flex items-center justify-center text-[10px]">2</span>
                      <span>Bước 2: Lập Kế Hoạch & Chụp BBGH Ký Nhận (Bạn phụ trách)</span>
                    </div>
                    <span className="text-[10px] font-bold bg-teal-200/60 text-teal-800 dark:bg-teal-900 dark:text-teal-200 px-2 py-0.5 rounded">Vận hành</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 pl-7 leading-relaxed">
                    Bạn vào <strong>Logistics Hub</strong> để chia chuyến điều độ theo ngày. Khi giao xong, bạn hoặc lái xe chụp <strong>Biên bản giao hàng (BBGH) / PXK có chữ ký nhận</strong> bằng điện thoại đưa vào mục Quét OCR.
                  </p>
                </div>

                <div className="p-4 bg-purple-50/60 dark:bg-purple-950/30 rounded-2xl border border-purple-200/70 dark:border-purple-800/60 space-y-1.5">
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

                <div className="p-4 bg-emerald-50/60 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200/70 dark:border-emerald-800/60 space-y-1.5">
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
          )}

          {/* Logistics 360 Tab */}
          {activeCategory === "logistics" && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 flex-wrap gap-2">
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                    <Truck className="text-teal-600" size={22} />
                    <span>Trung Tâm Điều Độ & Kế Hoạch Giao Hàng 360°</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Hợp nhất 4 trụ cột nghiệp vụ giao nhận trong 1 không gian duy nhất
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => navigate("logistics")}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 hover:bg-teal-100 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  <span>Mở Logistics 360°</span>
                  <ArrowUpRight size={14} />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/70 dark:border-slate-700 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-blue-700 dark:text-blue-300">
                    <CalendarDays size={16} />
                    <span>1. Lịch Giao Nhận 4 Tầng</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    Cho phép quan sát toàn cục theo <strong>Năm / Tháng / Tuần / Ngày</strong>. Các chuyến xe được tô màu theo trạng thái (Mới, Đang giao, Đã hoàn thành).
                  </p>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/70 dark:border-slate-700 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-teal-700 dark:text-teal-300">
                    <Layers size={16} />
                    <span>2. Kế Hoạch Điều Độ Phân Cấp</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    Xem danh sách các đơn hàng PO đang chờ giao, số lượng đã lên kế hoạch và số lượng còn tồn đọng chưa bố trí chuyến.
                  </p>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/70 dark:border-slate-700 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-orange-700 dark:text-orange-300">
                    <FileText size={16} />
                    <span>3. Sổ Giao Hàng PXK</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    Sổ cái toàn bộ các phiếu xuất kho thực tế: Biển số xe, người vận chuyển, giá bán, giá vốn và biên lợi nhuận gộp chi tiết từng phiếu.
                  </p>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/70 dark:border-slate-700 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-purple-700 dark:text-purple-300">
                    <Scale size={16} />
                    <span>4. Ma Trận Đối Soát 3 Chiều</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    Tự động tổng hợp và kiểm tra chéo tiến độ giao hàng của từng sản phẩm. Phát hiện ngay các đơn hàng bị giao thừa hoặc giao thiếu.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* OCR Tab */}
          {activeCategory === "ocr" && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 flex-wrap gap-2">
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                    <Camera className="text-purple-600" size={22} />
                    <span>Quét OCR & Tự Động Định Giá Đa Bảng</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Bóc tách tài liệu thông minh bằng Google Gemini 2.5 Flash Vision
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => navigate("ocr")}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 hover:bg-purple-100 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  <span>Mở Quét OCR</span>
                  <ArrowUpRight size={14} />
                </button>
              </div>

              <div className="space-y-3 text-xs text-slate-700 dark:text-slate-300">
                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/70 dark:border-slate-700 space-y-1">
                  <strong className="text-slate-900 dark:text-white text-xs block">1. Tải ảnh hoặc file PDF chứng từ</strong>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                    Kéo thả hoặc tải lên hình ảnh Phiếu xuất kho (PXK), Biên bản bàn giao hàng hóa hoặc Đơn hàng (PO).
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/70 dark:border-slate-700 space-y-1">
                  <strong className="text-slate-900 dark:text-white text-xs block">2. AI nhận diện và đối chiếu Bảng Giá 2026</strong>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                    AI tự động đọc mã hàng, số lượng và liên kết với Bảng Giá 2026 để điền Đơn giá bán, Giá vốn (COGS) và Hợp đồng căn cứ.
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/70 dark:border-slate-700 space-y-1">
                  <strong className="text-slate-900 dark:text-white text-xs block">3. Tự chọn lại bảng giá linh hoạt</strong>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                    Bấm vào nút <strong>"🏷️ Chọn Bảng Giá..."</strong> để mở hộp thoại tìm kiếm trực quan và thay đổi mức giá hoặc hợp đồng khác.
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/70 dark:border-slate-700 space-y-1">
                  <strong className="text-slate-900 dark:text-white text-xs block">4. Tự động đồng bộ liên hoàn sang 4 bảng CSDL</strong>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                    Khi bấm <strong>"Lưu Vào Hệ Thống"</strong>, hệ thống tự động: Ghi vào sổ PXK (\`deliveries\`), Cập nhật tiến độ PO (\`po_lines\`), Chuyển trạng thái Kế hoạch giao (\`delivery_plans\`) sang Hoàn thành, và tải file scan lên Google Drive.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Storage Tab */}
          {activeCategory === "storage" && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 flex-wrap gap-2">
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                    <HardDrive className="text-emerald-600" size={22} />
                    <span>Kho Lưu Trữ Google Drive & Quản Lý Chứng Từ Gốc</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Cấu trúc cây thư mục đám mây và cơ chế kiểm soát chéo
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => navigate("storage")}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  <span>Mở Kho Tệp & Sổ Đối Soát</span>
                  <ArrowUpRight size={14} />
                </button>
              </div>

              <div className="space-y-4 text-xs text-slate-700 dark:text-slate-300">
                <div className="p-4 bg-emerald-50/60 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200/80 dark:border-emerald-800/60 space-y-1.5">
                  <strong className="text-emerald-950 dark:text-emerald-300 font-bold block text-xs">📂 Cấu Trúc Cây Thư Mục Chuẩn Trên Google Drive:</strong>
                  <code className="text-[11px] font-mono text-emerald-800 dark:text-emerald-200 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-xl block border border-emerald-200 dark:border-emerald-800">
                    TSG_Business_Documents / 2026 / [Loại_Chứng_Từ] / Thang_[XX]
                  </code>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/70 dark:border-slate-700 space-y-2">
                  <strong className="text-slate-900 dark:text-white font-bold block text-xs">🟢 Trạng Thái Đối Soát 2 Chiều:</strong>
                  <p>• <strong>🟢 Đã khớp 100%</strong>: Dữ liệu trên file scan hoàn toàn trùng khớp với đơn giá và số lượng trên hệ thống.</p>
                  <p>• <strong>🟡 Chờ rà soát</strong>: Chứng từ mới tải lên cần kế toán kiểm tra lại chữ ký/con dấu.</p>
                  <p>• <strong>🔴 Lệch số liệu</strong>: Phát hiện chênh lệch giữa thực tế giao và hợp đồng/bảng giá.</p>
                </div>
              </div>
            </div>
          )}

          {/* AI Tab */}
          {activeCategory === "ai" && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 flex-wrap gap-2">
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                    <Bot className="text-indigo-600" size={22} />
                    <span>Trợ Lý Thông Minh Gemini 3.6 Flash</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Trực tiếp phân tích và truy vấn dữ liệu từ 13 bảng CSDL
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => navigate("assistant")}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  <span>Mở Trợ Lý AI</span>
                  <ArrowUpRight size={14} />
                </button>
              </div>

              <div className="space-y-3">
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Bạn có thể đặt bất kỳ câu hỏi nào bằng tiếng Việt tự nhiên, trợ lý sẽ trích xuất số liệu và đưa ra phân tích chính xác:
                </p>

                <div className="space-y-2 pt-1">
                  <div className="p-3 bg-indigo-50/60 dark:bg-indigo-950/40 rounded-xl border border-indigo-200/70 dark:border-indigo-800/60 text-xs text-indigo-900 dark:text-indigo-200 font-medium">
                    💡 <em>"Tổng doanh thu và lợi nhuận tháng này của khách hàng Thuốc lá Thanh Hóa là bao nhiêu?"</em>
                  </div>
                  <div className="p-3 bg-indigo-50/60 dark:bg-indigo-950/40 rounded-xl border border-indigo-200/70 dark:border-indigo-800/60 text-xs text-indigo-900 dark:text-indigo-200 font-medium">
                    💡 <em>"Những đơn hàng PO nào đang bị giao thiếu và cần giao bổ sung trong tuần này?"</em>
                  </div>
                  <div className="p-3 bg-indigo-50/60 dark:bg-indigo-950/40 rounded-xl border border-indigo-200/70 dark:border-indigo-800/60 text-xs text-indigo-900 dark:text-indigo-200 font-medium">
                    💡 <em>"Sản phẩm nào có biên lợi nhuận thấp hơn 15% cần đàm phán lại giá với nhà cung cấp?"</em>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* FAQ Tab */}
          {activeCategory === "faq" && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                    <HelpCircle className="text-amber-600" size={22} />
                    <span>Câu Hỏi Thường Gặp & Xử Lý Sự Cố (FAQ)</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Giải đáp các thắc mắc phổ biến về vận hành và an toàn dữ liệu
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <details className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/70 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 space-y-2 cursor-pointer" open>
                  <summary className="font-bold text-slate-900 dark:text-white text-xs">Dữ liệu của tôi được lưu ở đâu? Có bị mất khi tắt trình duyệt không?</summary>
                  <p className="text-slate-600 dark:text-slate-400 pt-2 leading-relaxed">
                    Hệ thống sử dụng cơ chế lưu trữ kép <strong>Double Storage Engine</strong>: Vừa lưu trữ an toàn trong bộ nhớ máy cục bộ (IndexedDB/Local Engine), vừa tự động đồng bộ lên máy chủ đám mây Google Firestore. Mọi thay đổi đều được bảo toàn 100% khi tắt hoặc mở lại trình duyệt.
                  </p>
                </details>

                <details className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/70 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 space-y-2 cursor-pointer">
                  <summary className="font-bold text-slate-900 dark:text-white text-xs">Tôi muốn kết nối Google Drive thì làm như thế nào?</summary>
                  <p className="text-slate-600 dark:text-slate-400 pt-2 leading-relaxed">
                    Bạn chỉ cần bấm vào nút <strong>"Đăng nhập Google"</strong> trong mục <em>Kho Tệp & Sổ Đối Soát</em> hoặc khi lưu tệp OCR một lần duy nhất trong phiên làm việc. Hệ thống sẽ tự động ghi nhớ mã xác thực trong suốt phiên.
                  </p>
                </details>

                <details className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/70 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 space-y-2 cursor-pointer">
                  <summary className="font-bold text-slate-900 dark:text-white text-xs">Làm thế nào để xuất dữ liệu ra file Excel hoặc PDF?</summary>
                  <p className="text-slate-600 dark:text-slate-400 pt-2 leading-relaxed">
                    Ở mỗi bảng (Đơn hàng, Bảng giá, Sổ giao hàng, Ma trận đối soát), bạn đều có nút <strong>"Xuất Excel"</strong> hoặc <strong>"In PDF"</strong> ở góc phải phía trên để tải về báo cáo định dạng chuẩn A4 landscape.
                  </p>
                </details>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
