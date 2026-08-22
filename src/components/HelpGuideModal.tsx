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
  CheckCircle, 
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
  CalendarDays
} from 'lucide-react';
import clsx from 'clsx';
import MacTrafficLights from './MacTrafficLights';

interface HelpGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab?: (tab: string) => void;
}

export default function HelpGuideModal({ isOpen, onClose, onNavigateTab }: HelpGuideModalProps) {
  const [activeCategory, setActiveCategory] = useState<'quickstart' | 'workflow' | 'logistics' | 'ocr' | 'storage' | 'ai' | 'faq'>('quickstart');
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150 font-sans">
      <div className="bg-[#F8F9FA] rounded-3xl w-full max-w-5xl h-[90vh] max-h-[850px] flex flex-col shadow-2xl border border-slate-200/80 overflow-hidden animate-in zoom-in-95 duration-150 text-slate-800">
        {/* Top Window Bar */}
        <div className="px-6 py-4 bg-white border-b border-slate-200/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <MacTrafficLights onClose={onClose} />
            <div className="h-4 w-px bg-slate-200" />
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-black text-xs shadow-2xs">
                <BookOpen size={14} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <span>Trung Tâm Trợ Giúp & Cẩm Nang Sử Dụng</span>
                  <span className="text-[10px] font-bold uppercase bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-100">TSG OS 2026</span>
                </h3>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body: 2-Column macOS Help Viewer */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
          {/* Left Navigation Sidebar */}
          <div className="w-full md:w-64 bg-white border-r border-slate-200/80 p-3 space-y-1 overflow-y-auto shrink-0 custom-scrollbar">
            <div className="px-3 py-1.5 text-[10.5px] font-extrabold text-slate-400 uppercase tracking-wider">
              Chủ Đề Hướng Dẫn
            </div>

            <button
              onClick={() => setActiveCategory('quickstart')}
              className={clsx(
                "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition text-left cursor-pointer",
                activeCategory === 'quickstart' ? "bg-blue-600 text-white shadow-xs" : "text-slate-700 hover:bg-slate-100"
              )}
            >
              <Sparkles size={15} className={activeCategory === 'quickstart' ? "text-white" : "text-blue-600"} />
              <span>1. Giới Thiệu & Bắt Đầu</span>
            </button>

            <button
              onClick={() => setActiveCategory('workflow')}
              className={clsx(
                "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition text-left cursor-pointer",
                activeCategory === 'workflow' ? "bg-blue-600 text-white shadow-xs" : "text-slate-700 hover:bg-slate-100"
              )}
            >
              <TrendingUp size={15} className={activeCategory === 'workflow' ? "text-white" : "text-indigo-600"} />
              <span>2. Quy Trình 5 Bước</span>
            </button>

            <button
              onClick={() => setActiveCategory('logistics')}
              className={clsx(
                "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition text-left cursor-pointer",
                activeCategory === 'logistics' ? "bg-blue-600 text-white shadow-xs" : "text-slate-700 hover:bg-slate-100"
              )}
            >
              <Truck size={15} className={activeCategory === 'logistics' ? "text-white" : "text-teal-600"} />
              <span>3. Giao Hàng & Logistics 360°</span>
            </button>

            <button
              onClick={() => setActiveCategory('ocr')}
              className={clsx(
                "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition text-left cursor-pointer",
                activeCategory === 'ocr' ? "bg-blue-600 text-white shadow-xs" : "text-slate-700 hover:bg-slate-100"
              )}
            >
              <Camera size={15} className={activeCategory === 'ocr' ? "text-white" : "text-purple-600"} />
              <span>4. Quét OCR & Định Giá Đa Bảng</span>
            </button>

            <button
              onClick={() => setActiveCategory('storage')}
              className={clsx(
                "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition text-left cursor-pointer",
                activeCategory === 'storage' ? "bg-blue-600 text-white shadow-xs" : "text-slate-700 hover:bg-slate-100"
              )}
            >
              <HardDrive size={15} className={activeCategory === 'storage' ? "text-white" : "text-emerald-600"} />
              <span>5. Kho Drive & Đối Soát 2 Bên</span>
            </button>

            <button
              onClick={() => setActiveCategory('ai')}
              className={clsx(
                "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition text-left cursor-pointer",
                activeCategory === 'ai' ? "bg-blue-600 text-white shadow-xs" : "text-slate-700 hover:bg-slate-100"
              )}
            >
              <Bot size={15} className={activeCategory === 'ai' ? "text-white" : "text-indigo-600"} />
              <span>6. Trợ Lý AI Gemini</span>
            </button>

            <button
              onClick={() => setActiveCategory('faq')}
              className={clsx(
                "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition text-left cursor-pointer",
                activeCategory === 'faq' ? "bg-blue-600 text-white shadow-xs" : "text-slate-700 hover:bg-slate-100"
              )}
            >
              <HelpCircle size={15} className={activeCategory === 'faq' ? "text-white" : "text-amber-600"} />
              <span>7. Câu Hỏi Thường Gặp (FAQ)</span>
            </button>

            <div className="pt-4 border-t border-slate-100 mt-4 px-2 space-y-2">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1.5">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Phím Tắt Tiện Ích</span>
                <div className="flex items-center justify-between text-[11px] text-slate-600">
                  <span>Toàn màn hình</span>
                  <kbd className="px-1.5 py-0.5 bg-white rounded border border-slate-200 font-mono text-[10px] font-bold">⌃⌘F</kbd>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-600">
                  <span>Tìm nhanh</span>
                  <kbd className="px-1.5 py-0.5 bg-white rounded border border-slate-200 font-mono text-[10px] font-bold">⌘K</kbd>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-600">
                  <span>Đóng cửa sổ</span>
                  <kbd className="px-1.5 py-0.5 bg-white rounded border border-slate-200 font-mono text-[10px] font-bold">Esc</kbd>
                </div>
              </div>
            </div>
          </div>

          {/* Right Content Area */}
          <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 custom-scrollbar bg-[#F8F9FA]">
            {/* Quickstart Tab */}
            {activeCategory === 'quickstart' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-3xl p-6 text-white space-y-3 shadow-md">
                  <span className="text-[10.5px] font-bold uppercase tracking-wider bg-white/20 px-3 py-1 rounded-full backdrop-blur-xs">
                    Kiến Trúc TSG Business OS
                  </span>
                  <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
                    Hệ Điều Hành Doanh Nghiệp Tâm Sen Group (ERP 2026)
                  </h2>
                  <p className="text-xs sm:text-sm text-blue-100 leading-relaxed">
                    Hệ thống quản trị kinh doanh, tài chính, đơn hàng (PO), điều độ giao nhận (Logistics) và bóc tách chứng từ tự động ứng dụng trí tuệ nhân tạo Google Gemini Vision.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-2.5">
                    <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                      <Truck size={18} />
                    </div>
                    <h4 className="text-sm font-bold text-slate-900">1. Kế Hoạch & Giao Hàng 360°</h4>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Lịch giao nhận trực quan 4 tầng (Năm/Tháng/Tuần/Ngày), chia chuyến điều độ theo PO, quản lý phiếu xuất kho (PXK) và ma trận đối soát 3 chiều.
                    </p>
                  </div>

                  <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-2.5">
                    <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                      <Camera size={18} />
                    </div>
                    <h4 className="text-sm font-bold text-slate-900">2. OCR & Định Giá Đa Bảng</h4>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Chụp ảnh/PDF chứng từ giao hàng $\rightarrow$ AI tự động bóc tách, đối chiếu Bảng Giá 2026, tính doanh thu, giá vốn và ghi nhận sang 4 bảng CSDL.
                    </p>
                  </div>

                  <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <HardDrive size={18} />
                    </div>
                    <h4 className="text-sm font-bold text-slate-900">3. Sổ Đối Soát Double-Check</h4>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Tự động tạo cây thư mục Google Drive <code className="bg-slate-100 px-1 py-0.5 rounded text-[11px]">TSG_Business_Documents</code> và bảng đối soát 2 bên giữa Kế toán và Giám đốc.
                    </p>
                  </div>

                  <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-2.5">
                    <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <Bot size={18} />
                    </div>
                    <h4 className="text-sm font-bold text-slate-900">4. Trợ Lý AI Gemini 3.6 Flash</h4>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Phân tích tài chính, truy vấn doanh thu khách hàng, kiểm tra số lượng giao thiếu và lập kế hoạch kinh doanh tự động 24/7.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Workflow Tab */}
            {activeCategory === 'workflow' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
                  <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <TrendingUp size={20} className="text-indigo-600" />
                    <span>Quy Trình Nghiệp Vụ Khép Kín 5 Bước</span>
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Hệ thống vận hành theo chuỗi liên kết dữ liệu tự động giữa 13 bảng cơ sở dữ liệu:
                  </p>

                  <div className="space-y-3 pt-2">
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/60 space-y-1">
                      <div className="flex items-center gap-2 text-xs font-bold text-blue-700">
                        <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">1</span>
                        <span>Tiếp Nhận Đơn Hàng PO & Chọn Khách Hàng</span>
                      </div>
                      <p className="text-xs text-slate-600 pl-7">
                        Chọn khách hàng $\rightarrow$ Hệ thống tự động lọc danh mục sản phẩm từ <strong>Bảng Giá 2026</strong> và <strong>Hợp Đồng Gốc</strong>.
                      </p>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/60 space-y-1">
                      <div className="flex items-center gap-2 text-xs font-bold text-teal-700">
                        <span className="w-5 h-5 rounded-full bg-teal-600 text-white flex items-center justify-center text-[10px]">2</span>
                        <span>Đối Chiếu Giá Bán (SO) $\leftrightarrow$ Giá Mua Xưởng (PO)</span>
                      </div>
                      <p className="text-xs text-slate-600 pl-7">
                        Tính toán tự động: Doanh thu bán cho Khách $\leftrightarrow$ Chi phí giá vốn mua từ NCC $\leftrightarrow$ Lợi nhuận gộp & Biên LN (%).
                      </p>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/60 space-y-1">
                      <div className="flex items-center gap-2 text-xs font-bold text-amber-700">
                        <span className="w-5 h-5 rounded-full bg-amber-600 text-white flex items-center justify-center text-[10px]">3</span>
                        <span>Lập Kế Hoạch Giao Hàng & Chia Đợt Điều Độ</span>
                      </div>
                      <p className="text-xs text-slate-600 pl-7">
                        Bố trí lịch giao theo ngày, tuần, tháng. Phân chia số lượng cho các chuyến xe vận tải.
                      </p>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/60 space-y-1">
                      <div className="flex items-center gap-2 text-xs font-bold text-orange-700">
                        <span className="w-5 h-5 rounded-full bg-orange-600 text-white flex items-center justify-center text-[10px]">4</span>
                        <span>Xuất Kho Thực Tế & Quét OCR Biên Bản Giao Hàng</span>
                      </div>
                      <p className="text-xs text-slate-600 pl-7">
                        Khi xe xuất xưởng $\rightarrow$ Quét ảnh chụp PXK $\rightarrow$ Tự động khớp giá thành và trừ kho.
                      </p>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/60 space-y-1">
                      <div className="flex items-center gap-2 text-xs font-bold text-emerald-700">
                        <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">5</span>
                        <span>Đối Soát 3 Chiều & Báo Cáo Tài Chính</span>
                      </div>
                      <p className="text-xs text-slate-600 pl-7">
                        Tự động cân bằng: <strong>Đặt PO $\leftrightarrow$ Kế Hoạch $\leftrightarrow$ Thực Giao PXK $\leftrightarrow$ Còn Lại</strong>.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Logistics 360 Tab */}
            {activeCategory === 'logistics' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
                  <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <Truck size={20} className="text-teal-600" />
                    <span>Hướng Dẫn Sử Dụng Kế Hoạch & Giao Hàng 360°</span>
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200/70 space-y-1.5">
                      <div className="flex items-center gap-2 text-xs font-bold text-blue-800">
                        <CalendarDays size={16} />
                        <span>1. Lịch Giao Nhận (4 Tầng)</span>
                      </div>
                      <p className="text-xs text-blue-900/80 leading-relaxed">
                        Chuyển đổi giữa góc nhìn <strong>Năm / Tháng / Tuần / Ngày</strong> để theo dõi mật độ chuyến xe. Bấm vào sự kiện để xem chi tiết đơn hàng hoặc mở phiếu giao.
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-teal-50/60 border border-teal-200/70 space-y-1.5">
                      <div className="flex items-center gap-2 text-xs font-bold text-teal-800">
                        <Layers size={16} />
                        <span>2. Kế Hoạch Điều Độ</span>
                      </div>
                      <p className="text-xs text-teal-900/80 leading-relaxed">
                        Xem cây phân cấp Đơn hàng $\rightarrow$ Chi tiết sản phẩm. Bấm <strong>"Chia Nhiều Đợt"</strong> để tách 1 đơn thành nhiều ngày giao khác nhau.
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-orange-50/60 border border-orange-200/70 space-y-1.5">
                      <div className="flex items-center gap-2 text-xs font-bold text-orange-800">
                        <FileText size={16} />
                        <span>3. Sổ Giao Hàng PXK</span>
                      </div>
                      <p className="text-xs text-orange-900/80 leading-relaxed">
                        Quản lý toàn bộ phiếu xuất kho thực tế: biển số xe, đơn giá bán, đơn giá mua, doanh thu và lợi nhuận gộp từng chuyến.
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-purple-50/60 border border-purple-200/70 space-y-1.5">
                      <div className="flex items-center gap-2 text-xs font-bold text-purple-800">
                        <Scale size={16} />
                        <span>4. Đối Soát 3 Chiều</span>
                      </div>
                      <p className="text-xs text-purple-900/80 leading-relaxed">
                        Bảng ma trận tự động kiểm tra số lượng Đặt vs Kế hoạch vs Thực giao và hiển thị tỷ lệ hoàn thành (%) kèm nút xuất Excel 1-click.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* OCR Tab */}
            {activeCategory === 'ocr' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
                  <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <Camera size={20} className="text-purple-600" />
                    <span>Quét OCR & Tự Động Định Giá Đa Bảng</span>
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Sử dụng mô hình Vision của Google Gemini để tự động hóa khâu nhập liệu chứng từ:
                  </p>

                  <ol className="space-y-3 pt-2 text-xs text-slate-700 list-decimal list-inside">
                    <li className="p-3 bg-slate-50 rounded-xl border border-slate-200/60">
                      <strong>Tải ảnh / PDF chứng từ lên</strong>: Hỗ trợ Phiếu xuất kho (PXK), Biên bản giao hàng hoặc Đơn đặt hàng (PO).
                    </li>
                    <li className="p-3 bg-slate-50 rounded-xl border border-slate-200/60">
                      <strong>AI tự động nhận diện & liên kết Bảng Giá 2026</strong>: Tự động trích xuất Mã giá (<code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono text-[11px]">Gsp_...</code>), Hợp đồng căn cứ, Đơn giá bán, Đơn giá mua (COGS) và % Biên lợi nhuận.
                    </li>
                    <li className="p-3 bg-slate-50 rounded-xl border border-slate-200/60">
                      <strong>Tự chọn bảng giá linh hoạt</strong>: Bấm vào nút mã giá trên từng dòng để mở hộp thoại tìm kiếm và thay đổi sang mức giá hoặc hợp đồng khác nếu cần.
                    </li>
                    <li className="p-3 bg-slate-50 rounded-xl border border-slate-200/60">
                      <strong>Bấm "Lưu Vào Hệ Thống"</strong>: Hệ thống tự động ghi nhận vào <strong>Deliveries</strong>, cập nhật số lượng giao trong <strong>PO Lines</strong>, đổi trạng thái <strong>Kế hoạch giao hàng</strong> sang Hoàn thành, và lưu file vào Google Drive.
                    </li>
                  </ol>
                </div>
              </div>
            )}

            {/* Storage Tab */}
            {activeCategory === 'storage' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
                  <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <HardDrive size={20} className="text-emerald-600" />
                    <span>Kho Lưu Trữ Google Drive & Sổ Đối Soát 2 Bên</span>
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Được thiết kế để Giám đốc và Kế toán cùng kiểm soát, đối soát chéo từng chứng từ:
                  </p>

                  <div className="space-y-3 pt-2">
                    <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-200/80 space-y-1">
                      <strong className="text-xs font-bold text-emerald-900 block">📁 Cấu Trúc Thư Mục Chuẩn Trên Google Drive:</strong>
                      <code className="text-[11px] font-mono text-emerald-800 bg-white px-2 py-1 rounded block border border-emerald-200 mt-1">
                        TSG_Business_Documents / 2026 / [Loại_Chứng_Từ] / Thang_[XX]
                      </code>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/60 space-y-1.5 text-xs text-slate-700">
                      <strong className="text-slate-900 block">🟢 Trạng Thái Đối Soát 2 Bên:</strong>
                      <p>• <strong>🟢 Đã khớp 100%</strong>: Số liệu trên chứng từ scan hoàn toàn trùng khớp với đơn giá và số lượng trên hệ thống.</p>
                      <p>• <strong>🟡 Chờ rà soát</strong>: Chứng từ mới tải lên cần kế toán kiểm tra lại chữ ký/con dấu.</p>
                      <p>• <strong>🔴 Lệch số liệu</strong>: Phát hiện chênh lệch giữa thực tế giao và hợp đồng/bảng giá.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* AI Tab */}
            {activeCategory === 'ai' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
                  <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <Bot size={20} className="text-indigo-600" />
                    <span>Trợ Lý Thông Minh Gemini 3.6 Flash</span>
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Trợ lý ảo được kết nối trực tiếp với 13 cơ sở dữ liệu thời gian thực của hệ thống:
                  </p>

                  <div className="space-y-2 pt-2">
                    <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-200/70 text-xs text-indigo-900 font-medium">
                      💡 <em>"Tổng doanh thu và lợi nhuận tháng này của khách hàng Thuốc lá Thanh Hóa là bao nhiêu?"</em>
                    </div>
                    <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-200/70 text-xs text-indigo-900 font-medium">
                      💡 <em>"Những đơn hàng PO nào đang bị giao thiếu và cần giao bổ sung trong tuần này?"</em>
                    </div>
                    <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-200/70 text-xs text-indigo-900 font-medium">
                      💡 <em>"Sản phẩm nào có biên lợi nhuận thấp hơn 15% cần đàm phán lại giá với nhà cung cấp?"</em>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* FAQ Tab */}
            {activeCategory === 'faq' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
                  <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <HelpCircle size={20} className="text-amber-600" />
                    <span>Câu Hỏi Thường Gặp (FAQ)</span>
                  </h3>

                  <div className="space-y-3 pt-2">
                    <details className="p-4 bg-slate-50 rounded-2xl border border-slate-200/60 text-xs text-slate-700 space-y-2 cursor-pointer">
                      <summary className="font-bold text-slate-900">Dữ liệu của tôi được lưu ở đâu? Có bị mất khi tắt trình duyệt không?</summary>
                      <p className="text-slate-600 pt-2 leading-relaxed">
                        Hệ thống sử dụng cơ chế lưu trữ kép <strong>Double Storage Engine</strong>: Vừa lưu trữ an toàn trong bộ nhớ máy cục bộ (IndexedDB/Local Engine), vừa tự động đồng bộ lên máy chủ đám mây Google Firestore. Mọi thay đổi đều được bảo toàn 100% khi tắt hoặc mở lại trình duyệt.
                      </p>
                    </details>

                    <details className="p-4 bg-slate-50 rounded-2xl border border-slate-200/60 text-xs text-slate-700 space-y-2 cursor-pointer">
                      <summary className="font-bold text-slate-900">Tôi muốn kết nối Google Drive thì làm như thế nào?</summary>
                      <p className="text-slate-600 pt-2 leading-relaxed">
                        Bạn chỉ cần bấm vào nút <strong>"Đăng nhập Google"</strong> trong mục <em>Kho Lưu Trữ</em> hoặc khi lưu tệp OCR một lần duy nhất trong phiên làm việc. Hệ thống sẽ tự động ghi nhớ mã xác thực trong suốt phiên.
                      </p>
                    </details>

                    <details className="p-4 bg-slate-50 rounded-2xl border border-slate-200/60 text-xs text-slate-700 space-y-2 cursor-pointer">
                      <summary className="font-bold text-slate-900">Làm thế nào để xuất dữ liệu ra file Excel hoặc PDF?</summary>
                      <p className="text-slate-600 pt-2 leading-relaxed">
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
        <div className="px-6 py-3.5 bg-white border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-500 shrink-0">
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
