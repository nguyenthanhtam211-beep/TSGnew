import React, { useState, useRef } from 'react';
import { FileText, Download, Printer, X, Sparkles, Layout, Table, CheckCircle2, RefreshCw, BarChart3, ShieldCheck, Eye } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { exportElementToPDF, generateStructuredPDFReport } from '../lib/pdf-exporter';

interface PDFExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  dashboardRef?: React.RefObject<HTMLDivElement | null>;
  deliveryData: any[];
  poLinesData: any[];
  summaryStats: {
    totalRevenue: number;
    totalProfit: number;
    totalVolume: number;
    totalDeliveries: number;
  };
  timeFilterLabel?: string;
  categoryFilterLabel?: string;
}

export default function PDFExportModal({
  isOpen,
  onClose,
  dashboardRef,
  deliveryData = [],
  poLinesData = [],
  summaryStats,
  timeFilterLabel = 'Tất cả thời gian',
  categoryFilterLabel = 'Tất cả Nhóm hàng'
}: PDFExportModalProps) {
  const [reportType, setReportType] = useState<'visual' | 'table'>('visual');
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const [reportTitle, setReportTitle] = useState('BÁO CÁO TỔNG QUAN HOẠT ĐỘNG ERP TÂM SEN');
  const [includeLogo, setIncludeLogo] = useState(true);
  const [includeSignature, setIncludeSignature] = useState(false);
  const [signatureTitle, setSignatureTitle] = useState('Đại diện Doanh nghiệp / Giám đốc');
  const [marginSize, setMarginSize] = useState<'narrow' | 'standard' | 'wide'>('standard');
  const [isGenerating, setIsGenerating] = useState(false);

  if (!isOpen) return null;

  const marginValues: Record<string, [number, number, number, number]> = {
    narrow: [4, 4, 4, 4],
    standard: [8, 8, 8, 8],
    wide: [14, 14, 14, 14]
  };

  const handleGenerateAndDownload = async () => {
    setIsGenerating(true);
    const toastId = toast.loading('Đang khởi tạo tài liệu PDF chất lượng cao...');

    try {
      const currentMargin = marginValues[marginSize] || [8, 8, 8, 8];

      if (reportType === 'visual' && dashboardRef?.current) {
        // High-DPI Visual Dashboard PDF
        const sanitizedFilename = reportTitle.replace(/[^a-zA-Z0-9_ -]/g, '').trim() || 'Bao_Cao_ERP_Tam_Sen';
        await exportElementToPDF(
          dashboardRef.current,
          {
            filename: `${sanitizedFilename}.pdf`,
            orientation,
            margin: currentMargin,
            includeLogo,
            includeSignature,
            signatureTitle
          }
        );
        toast.success('Đã xuất file PDF Đồ họa Dashboard thành công!', { id: toastId });
      } else {
        // Structured Vector Data Table PDF
        generateStructuredPDFReport({
          title: reportTitle,
          subtitle: `Bộ lọc: ${timeFilterLabel} | ${categoryFilterLabel}`,
          filename: 'Bao_Cao_ERP_Tam_Sen_Chi_Tiet.pdf',
          deliveryData,
          poLinesData,
          summaryStats,
          orientation,
          margin: currentMargin,
          includeLogo,
          includeSignature,
          signatureTitle
        });
        toast.success('Đã xuất file PDF Bảng biểu dữ liệu thành công!', { id: toastId });
      }
      onClose();
    } catch (err: any) {
      console.error('PDF Export Error:', err);
      toast.error('Lỗi khi khởi tạo PDF: ' + (err.message || 'Vui lòng thử lại'), { id: toastId });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDirectPrint = () => {
    toast.success("Đang mở cửa sổ in... Vui lòng chọn 'Lưu dưới dạng PDF' hoặc chọn Máy in.", { duration: 4000 });
    setTimeout(() => {
      window.print();
    }, 500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-100 my-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-blue-700 to-indigo-800 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors"
          >
            <X size={18} />
          </button>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white/15 rounded-xl backdrop-blur-md">
              <FileText size={26} className="text-blue-100" />
            </div>
            <div>
              <h3 className="text-xl font-bold tracking-tight">Xuất Báo Báo PDF Chuyên Nghiệp</h3>
              <p className="text-blue-100 text-xs mt-1">Xuất trực tiếp thành file .PDF chuẩn vector & độ phân giải cao</p>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Formats Selection */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
              1. Chọn Định Dạng Báo Cáo:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setReportType('visual')}
                className={`p-4 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                  reportType === 'visual'
                    ? 'border-blue-600 bg-blue-50/70 shadow-sm ring-2 ring-blue-500/20'
                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100/80'
                }`}
              >
                {reportType === 'visual' && (
                  <CheckCircle2 size={18} className="absolute top-3 right-3 text-blue-600" />
                )}
                <div className="flex items-center gap-2.5 text-blue-900 font-bold text-sm mb-1">
                  <Layout size={18} className="text-blue-600" />
                  Báo Cáo Đồ Họa (Visual Dashboard)
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Bao gồm đầy đủ các Biểu đồ, Thẻ KPI, Đồ thị doanh thu & Lợi nhuận của Dashboard.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setReportType('table')}
                className={`p-4 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                  reportType === 'table'
                    ? 'border-blue-600 bg-blue-50/70 shadow-sm ring-2 ring-blue-500/20'
                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100/80'
                }`}
              >
                {reportType === 'table' && (
                  <CheckCircle2 size={18} className="absolute top-3 right-3 text-blue-600" />
                )}
                <div className="flex items-center gap-2.5 text-indigo-900 font-bold text-sm mb-1">
                  <Table size={18} className="text-indigo-600" />
                  Báo Cáo Bảng Biểu (Structured PDF)
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Xuất danh sách dữ liệu phẳng, bảng chi tiết giao hàng & KPI tổng hợp theo trang A4.
                </p>
              </button>
            </div>
          </div>

          {/* Title & Options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                Tiêu đề Báo cáo:
              </label>
              <input
                type="text"
                value={reportTitle}
                onChange={(e) => setReportTitle(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                Khổ giấy & Hướng trang (Orientation):
              </label>
              <select
                value={orientation}
                onChange={(e) => setOrientation(e.target.value as 'landscape' | 'portrait')}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="landscape">A4 Khổ Ngang (Landscape - Khuyên dùng)</option>
                <option value="portrait">A4 Khổ Dọc (Portrait)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                Lề trang (Margins):
              </label>
              <select
                value={marginSize}
                onChange={(e) => setMarginSize(e.target.value as 'narrow' | 'standard' | 'wide')}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="standard">Chuẩn (8mm)</option>
                <option value="narrow">Hẹp (4mm)</option>
                <option value="wide">Rộng (14mm)</option>
              </select>
            </div>
          </div>

          {/* Header & Footer Customization Toggles */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-3">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
              Tùy chỉnh Header / Footer & Chữ ký:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <label className="flex items-center gap-2.5 p-2.5 bg-white rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50/80 transition-colors">
                <input
                  type="checkbox"
                  checked={includeLogo}
                  onChange={(e) => setIncludeLogo(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                />
                <div>
                  <span className="font-semibold text-slate-800 block">Logo Công Ty [TS]</span>
                  <span className="text-[11px] text-slate-500 block">Hiển thị badge logo ở góc trái Header</span>
                </div>
              </label>

              <label className="flex items-center gap-2.5 p-2.5 bg-white rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50/80 transition-colors">
                <input
                  type="checkbox"
                  checked={includeSignature}
                  onChange={(e) => setIncludeSignature(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                />
                <div>
                  <span className="font-semibold text-slate-800 block">Khung Chữ Ký & Dấu</span>
                  <span className="text-[11px] text-slate-500 block">Thêm phần ký duyệt & ngày tháng ở cuối</span>
                </div>
              </label>
            </div>

            {includeSignature && (
              <div className="pt-2">
                <label className="text-[11px] font-bold text-slate-600 mb-1 block">
                  Chức danh ký duyệt (Bên phải):
                </label>
                <input
                  type="text"
                  value={signatureTitle}
                  onChange={(e) => setSignatureTitle(e.target.value)}
                  placeholder="Đại diện Doanh nghiệp / Giám đốc"
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            )}
          </div>

          {/* Quick Summary Info */}
          <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2 text-xs text-slate-600">
            <div className="font-bold text-slate-800 flex items-center gap-1.5">
              <ShieldCheck size={16} className="text-emerald-600" />
              Thông số file PDF sẽ tạo:
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              <div>
                <span className="text-slate-400 block text-[10px]">Doanh thu:</span>
                <span className="font-semibold text-blue-700">{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(summaryStats?.totalRevenue || 0)}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Lợi nhuận:</span>
                <span className="font-semibold text-emerald-700">{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(summaryStats?.totalProfit || 0)}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Lượt giao hàng:</span>
                <span className="font-semibold text-slate-800">{summaryStats?.totalDeliveries || deliveryData.length} lượt</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Độ phân giải:</span>
                <span className="font-semibold text-indigo-700">200 DPI Vector</span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleDirectPrint}
            className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <Printer size={15} />
            Mở Hộp Thoại In
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-800"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleGenerateAndDownload}
              disabled={isGenerating}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-md hover:shadow-blue-600/20 disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <RefreshCw size={15} className="animate-spin" />
                  Đang tạo File PDF...
                </>
              ) : (
                <>
                  <Download size={15} />
                  Tải Xuống File PDF
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
