import React, { useState, useMemo } from 'react';
import { 
  FileText, Plus, Search, Filter, Edit3, Trash2, ChevronRight, 
  Settings, Layers, Ruler, Palette, ShieldCheck, Download, MoreVertical,
  Save, Package, Eye, LayoutGrid, Table as TableIcon, Printer, FileSpreadsheet,
  CheckCircle2, AlertCircle, Clock, Copy, Sparkles, Building2, Check, X
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import clsx from 'clsx';

interface SpecParameter {
  criterion: string;
  unit: string;
  standard: string;
  tolerance?: string;
  testMethod?: string;
}

interface SpecRecord {
  id?: string;
  'Mã Spec': string;
  'Tên tiêu chuẩn': string;
  'Loại sản phẩm': 'Carton' | 'Label' | 'Material' | 'Other';
  'Khách hàng': string;
  'Sản phẩm liên kết': string;
  'Mã sản phẩm': string;
  'Phiên bản': string;
  'Ngày lập': string;
  'Người lập': string;
  'Người phê duyệt'?: string;
  'Trạng thái': 'Nháp' | 'Đã phê duyệt' | 'Hết hiệu lực';
  'Thông số kỹ thuật': SpecParameter[];
  'Quy cách đóng gói'?: string;
  'Ghi chú'?: string;
  'Hình ảnh thiết kế'?: string;
}

const PRESET_TEMPLATES: Record<string, SpecParameter[]> = {
  Carton: [
    { criterion: 'Định lượng giấy sóng Sóng A/B/C/E', unit: 'gsm', standard: '150 - 250', tolerance: '± 5%', testMethod: 'Cân điện tử ISO 536' },
    { criterion: 'Độ chịu nén thùng (BCT)', unit: 'KgF', standard: '≥ 350', tolerance: '- 5%', testMethod: 'Máy nén thùng ISO 12048' },
    { criterion: 'Độ bục carton (Bursting Strength)', unit: 'kPa', standard: '≥ 1200', tolerance: '± 50', testMethod: 'Máy đo độ bục ISO 2759' },
    { criterion: 'Kích thước phủ ngoài (LxWxH)', unit: 'mm', standard: '600 x 400 x 350', tolerance: '± 2mm', testMethod: 'Thước cặp / Thước cuộn' },
    { criterion: 'Độ ẩm carton', unit: '%', standard: '8 - 12', tolerance: '± 1%', testMethod: 'Máy đo độ ẩm sấy' }
  ],
  Label: [
    { criterion: 'Loại keo dính (Adhesive type)', unit: '-', standard: 'Acrylic / Hotmelt', tolerance: '-', testMethod: 'Quan sát / Kiểm tra kéo' },
    { criterion: 'Độ dày màng mặt (Face Stock)', unit: 'µm', standard: '80', tolerance: '± 5µm', testMethod: 'Thước panme điện tử' },
    { criterion: 'Độ bám dính (Peel Adhesion)', unit: 'N/25mm', standard: '≥ 15', tolerance: '- 10%', testMethod: 'Máy thử độ kéo FTM 1' },
    { criterion: 'Chịu nhiệt độ vận hành', unit: '°C', standard: '-20 đến +80', tolerance: '-', testMethod: 'Tủ thử sốc nhiệt' }
  ],
  Material: [
    { criterion: 'Độ dãn dài khi đứt (Elongation)', unit: '%', standard: '≥ 150', tolerance: '± 10%', testMethod: 'Máy đo kéo dãn ASTM D882' },
    { criterion: 'Độ bền kéo (Tensile Strength)', unit: 'MPa', standard: '≥ 45', tolerance: '± 5', testMethod: 'Máy thử kéo universal' }
  ]
};

export default function SpecsView({ 
  specsData = [], 
  productData = [],
  customerData = [],
  onAdd, 
  onEdit, 
  onDelete 
}: { 
  specsData: any[], 
  productData: any[],
  customerData: any[],
  onAdd: (row: any) => Promise<void>, 
  onEdit: (row: any) => Promise<void>, 
  onDelete: (row: any) => Promise<void> 
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [selectedStatus, setSelectedStatus] = useState<string>("All");
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [viewingSpec, setViewingSpec] = useState<any>(null);
  
  const [editingRow, setEditingRow] = useState<any>(null);
  const [formData, setFormData] = useState<Partial<SpecRecord>>({
    'Thông số kỹ thuật': []
  });

  // Filtered dataset
  const filteredData = useMemo(() => {
    return specsData.filter(s => {
      const matchSearch = 
        (s['Tên tiêu chuẩn'] || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s['Mã Spec'] || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s['Khách hàng'] || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s['Sản phẩm liên kết'] || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchCategory = selectedCategory === "All" || s['Loại sản phẩm'] === selectedCategory;
      const matchStatus = selectedStatus === "All" || s['Trạng thái'] === selectedStatus;

      return matchSearch && matchCategory && matchStatus;
    });
  }, [specsData, searchTerm, selectedCategory, selectedStatus]);

  // Statistics
  const stats = useMemo(() => {
    const total = specsData.length;
    const carton = specsData.filter(s => s['Loại sản phẩm'] === 'Carton').length;
    const label = specsData.filter(s => s['Loại sản phẩm'] === 'Label').length;
    const approved = specsData.filter(s => s['Trạng thái'] === 'Đã phê duyệt').length;
    const draft = specsData.filter(s => s['Trạng thái'] === 'Nháp').length;
    return { total, carton, label, approved, draft };
  }, [specsData]);

  const addParameter = () => {
    const params = [...(formData['Thông số kỹ thuật'] || [])];
    params.push({ criterion: '', unit: '', standard: '', tolerance: '', testMethod: '' });
    setFormData({ ...formData, 'Thông số kỹ thuật': params });
  };

  const applyPresetTemplate = (cat: string) => {
    if (PRESET_TEMPLATES[cat]) {
      setFormData({
        ...formData,
        'Loại sản phẩm': cat as any,
        'Thông số kỹ thuật': JSON.parse(JSON.stringify(PRESET_TEMPLATES[cat]))
      });
      toast.success(`Đã áp dụng bộ chỉ tiêu mẫu ISO cho ${cat}`);
    }
  };

  const updateParameter = (index: number, field: keyof SpecParameter, value: string) => {
    const params = [...(formData['Thông số kỹ thuật'] || [])];
    params[index] = { ...params[index], [field]: value };
    setFormData({ ...formData, 'Thông số kỹ thuật': params });
  };

  const removeParameter = (index: number) => {
    const params = [...(formData['Thông số kỹ thuật'] || [])];
    params.splice(index, 1);
    setFormData({ ...formData, 'Thông số kỹ thuật': params });
  };

  const handleOpenModal = (row: any = null) => {
    if (row) {
      setEditingRow(row);
      setFormData(row);
    } else {
      setEditingRow(null);
      setFormData({
        'Mã Spec': `SPEC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
        'Ngày lập': new Date().toISOString().split('T')[0],
        'Trạng thái': 'Đã phê duyệt',
        'Phiên bản': '1.0',
        'Loại sản phẩm': 'Carton',
        'Người lập': 'Phòng Quản Lý Chất Lượng (QA/QC)',
        'Người phê duyệt': 'Ban Giám Đốc TSG',
        'Thông số kỹ thuật': JSON.parse(JSON.stringify(PRESET_TEMPLATES.Carton))
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingRow) {
        await onEdit({ ...editingRow, ...formData });
        toast.success("Đã cập nhật tiêu chuẩn kỹ thuật!");
      } else {
        await onAdd(formData);
        toast.success("Đã khởi tạo tiêu chuẩn ISO mới!");
      }
      setIsModalOpen(false);
    } catch (error) {
      toast.error("Lỗi khi lưu dữ liệu tiêu chuẩn");
    }
  };

  const handlePrintSpec = (spec: any) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>TIÊU CHUẨN KỸ THUẬT - ${spec['Mã Spec']}</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; margin: 30px; color: #1e293b; line-height: 1.5; }
          .header { display: flex; justify-content: space-between; border-bottom: 3px solid #0f172a; padding-bottom: 15px; margin-bottom: 20px; }
          .title { font-size: 20px; font-weight: bold; color: #0f172a; text-transform: uppercase; }
          .subtitle { font-size: 12px; color: #64748b; font-weight: 600; }
          .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; }
          .meta-table td { padding: 8px 12px; border: 1px solid #cbd5e1; }
          .meta-label { font-weight: bold; background: #f8fafc; width: 22%; color: #475569; }
          .spec-table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 12px; }
          .spec-table th { background: #0f172a; color: white; padding: 10px; text-align: left; text-transform: uppercase; }
          .spec-table td { padding: 9px 10px; border: 1px solid #cbd5e1; }
          .spec-table tr:nth-child(even) { background: #f8fafc; }
          .footer { margin-top: 40px; display: flex; justify-content: space-between; text-align: center; font-size: 12px; }
          .sign-box { width: 28%; }
          .sign-line { margin-top: 60px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="title">TẬP ĐOÀN TSG BUSINESS</div>
            <div class="subtitle">BẢNG TIÊU CHUẨN KỸ THUẬT SẢN PHẨM (TECHNICAL DATA SHEET)</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 16px; font-weight: bold; color: #2563eb;">${spec['Mã Spec']}</div>
            <div style="font-size: 11px; color: #64748b;">Phiên bản: ${spec['Phiên bản']} | ISO 9001:2015</div>
          </div>
        </div>

        <table class="meta-table">
          <tr>
            <td class="meta-label">Tên tiêu chuẩn / SP:</td>
            <td style="font-weight: bold; color: #0f172a;">${spec['Tên tiêu chuẩn'] || '-'}</td>
            <td class="meta-label">Loại sản phẩm:</td>
            <td>${spec['Loại sản phẩm'] || '-'}</td>
          </tr>
          <tr>
            <td class="meta-label">Khách hàng:</td>
            <td style="font-weight: bold;">${spec['Khách hàng'] || '-'}</td>
            <td class="meta-label">Sản phẩm liên kết:</td>
            <td>${spec['Sản phẩm liên kết'] || '-'}</td>
          </tr>
          <tr>
            <td class="meta-label">Ngày hiệu lực:</td>
            <td>${spec['Ngày lập'] || '-'}</td>
            <td class="meta-label">Trạng thái:</td>
            <td style="font-weight: bold; color: #059669;">${spec['Trạng thái'] || 'Đã phê duyệt'}</td>
          </tr>
        </table>

        <h4 style="margin-bottom: 8px; text-transform: uppercase; font-size: 13px; color: #0f172a;">I. DANH MỤC CHỈ TIÊU KỸ THUẬT CHI TIẾT</h4>
        <table class="spec-table">
          <thead>
            <tr>
              <th style="width: 5%;">STT</th>
              <th style="width: 30%;">Tên chỉ tiêu</th>
              <th style="width: 12%;">Đơn vị</th>
              <th style="width: 20%;">Tiêu chuẩn mẫu</th>
              <th style="width: 15%;">Dung sai</th>
              <th>Phương pháp thử</th>
            </tr>
          </thead>
          <tbody>
            ${(spec['Thông số kỹ thuật'] || []).map((p: any, idx: number) => `
              <tr>
                <td style="text-align: center; font-weight: bold;">${idx + 1}</td>
                <td style="font-weight: 600;">${p.criterion || '-'}</td>
                <td style="text-align: center;">${p.unit || '-'}</td>
                <td style="font-weight: bold; color: #1e3a8a;">${p.standard || '-'}</td>
                <td>${p.tolerance || '-'}</td>
                <td>${p.testMethod || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        ${spec['Quy cách đóng gói'] ? `
          <h4 style="margin-top: 20px; margin-bottom: 8px; text-transform: uppercase; font-size: 13px; color: #0f172a;">II. QUY CÁCH ĐÓNG GÓI & BẢO QUẢN</h4>
          <div style="background: #f8fafc; padding: 12px; border: 1px solid #cbd5e1; font-size: 12px; border-radius: 6px;">
            ${spec['Quy cách đóng gói']}
          </div>
        ` : ''}

        <div class="footer">
          <div class="sign-box">
            <div>NGƯỜI LẬP SPECS</div>
            <div class="sign-line">${spec['Người lập'] || 'Phòng QC'}</div>
          </div>
          <div class="sign-box">
            <div>KIỂM TRA CHẤT LƯỢNG</div>
            <div class="sign-line">Trưởng Phòng QA</div>
          </div>
          <div class="sign-box">
            <div>BAN GIÁM ĐỐC PHÊ DUYỆT</div>
            <div class="sign-line">${spec['Người phê duyệt'] || 'Giám Đốc Kỹ Thuật'}</div>
          </div>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  return (
    <div className="space-y-6">
      {/* 1. Modern Hero Section */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 rounded-3xl p-6 text-white shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 bg-blue-500/20 border border-blue-400/30 text-blue-300 rounded-full text-xs font-semibold flex items-center gap-1.5">
                <ShieldCheck size={14} className="animate-pulse" /> Tiêu chuẩn ISO 9001:2015
              </span>
              <span className="px-3 py-1 bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 rounded-full text-xs font-semibold">
                Kiểm soát Chất lượng (QA/QC)
              </span>
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">
              Quản Lý Tiêu Chuẩn Kỹ Thuật (Specs)
            </h2>
            <p className="text-slate-300 text-xs md:text-sm mt-1 max-w-2xl">
              Hệ thống định chuẩn thông số kỹ thuật sản phẩm, kiểm soát độ chịu nén, định lượng, kích thước và quy cách đóng gói xuất khẩu.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={() => handleOpenModal()}
              className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-3 rounded-2xl font-bold transition-all shadow-lg shadow-blue-600/30 flex items-center gap-2 hover:scale-[1.02] active:scale-95"
            >
              <Plus size={20} />
              Thêm Tiêu Chuẩn ISO
            </button>
          </div>
        </div>

        {/* Quick Stats inside Hero */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-800/80">
          <div className="bg-slate-800/60 backdrop-blur p-3.5 rounded-2xl border border-slate-700/50">
            <p className="text-slate-400 text-[11px] font-bold uppercase">Tổng số Spec ISO</p>
            <p className="text-xl md:text-2xl font-black text-white mt-0.5">{stats.total}</p>
          </div>
          <div className="bg-slate-800/60 backdrop-blur p-3.5 rounded-2xl border border-slate-700/50">
            <p className="text-blue-300 text-[11px] font-bold uppercase">Specs Thùng Carton</p>
            <p className="text-xl md:text-2xl font-black text-blue-400 mt-0.5">{stats.carton}</p>
          </div>
          <div className="bg-slate-800/60 backdrop-blur p-3.5 rounded-2xl border border-slate-700/50">
            <p className="text-purple-300 text-[11px] font-bold uppercase">Specs Nhãn & In</p>
            <p className="text-xl md:text-2xl font-black text-purple-400 mt-0.5">{stats.label}</p>
          </div>
          <div className="bg-slate-800/60 backdrop-blur p-3.5 rounded-2xl border border-slate-700/50">
            <p className="text-emerald-300 text-[11px] font-bold uppercase">Đã Phê Duyệt QA</p>
            <p className="text-xl md:text-2xl font-black text-emerald-400 mt-0.5">{stats.approved}</p>
          </div>
        </div>
      </div>

      {/* 2. Controls & Search Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        {/* Search */}
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Tìm theo Mã Spec, Tên tiêu chuẩn, Khách hàng hoặc Sản phẩm..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Filters & View Mode Toggle */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
          <select
            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold px-3 py-2.5 rounded-xl outline-none"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="All">Tất cả phân loại</option>
            <option value="Carton">Thùng Carton</option>
            <option value="Label">Nhãn in ấn</option>
            <option value="Material">Nguyên vật liệu</option>
            <option value="Other">Khác</option>
          </select>

          <select
            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold px-3 py-2.5 rounded-xl outline-none"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
          >
            <option value="All">Tất cả trạng thái</option>
            <option value="Đã phê duyệt">Đã phê duyệt</option>
            <option value="Nháp">Bản nháp</option>
            <option value="Hết hiệu lực">Hết hiệu lực</option>
          </select>

          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setViewMode('grid')}
              className={clsx(
                "p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1",
                viewMode === 'grid' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-900"
              )}
              title="Xem dạng thẻ"
            >
              <LayoutGrid size={16} />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={clsx(
                "p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1",
                viewMode === 'table' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-900"
              )}
              title="Xem dạng bảng"
            >
              <TableIcon size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* 3. Main Data View (Grid or Table) */}
      {filteredData.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center space-y-3">
          <ShieldCheck size={48} className="mx-auto text-slate-300" />
          <h3 className="font-bold text-slate-700 text-lg">Chưa tìm thấy tiêu chuẩn kỹ thuật phù hợp</h3>
          <p className="text-slate-400 text-xs max-w-sm mx-auto">Thử thay đổi từ khóa tìm kiếm hoặc bấm nút bên dưới để tạo Tiêu chuẩn Spec ISO mới.</p>
          <button 
            onClick={() => handleOpenModal()}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
          >
            <Plus size={16} /> Tạo Spec Mới
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID VIEW CARDS */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredData.map((row, idx) => (
            <div 
              key={idx}
              className="bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group hover:border-blue-300"
            >
              <div className="p-5 space-y-4">
                {/* Header Badge */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-md text-[11px] font-mono font-bold tracking-wider">
                      {row['Mã Spec']}
                    </span>
                    <span className="ml-2 px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold">
                      v{row['Phiên bản'] || '1.0'}
                    </span>
                  </div>
                  <span className={clsx(
                    "px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1",
                    row['Trạng thái'] === 'Đã phê duyệt' ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"
                  )}>
                    {row['Trạng thái'] === 'Đã phê duyệt' ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                    {row['Trạng thái']}
                  </span>
                </div>

                {/* Title & Product */}
                <div>
                  <h3 className="font-bold text-slate-900 text-base group-hover:text-blue-600 transition-colors line-clamp-1">
                    {row['Tên tiêu chuẩn']}
                  </h3>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                    <Building2 size={13} className="text-slate-400 shrink-0" />
                    <span className="font-medium text-slate-700 truncate">{row['Khách hàng'] || 'Chưa gán KH'}</span>
                  </div>
                </div>

                {/* Technical Parameters Quick Pills */}
                <div className="space-y-1.5 bg-slate-50/80 p-3 rounded-xl border border-slate-100">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Thông số cốt lõi:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(row['Thông số kỹ thuật'] || []).slice(0, 3).map((p: any, pidx: number) => (
                      <span key={pidx} className="px-2 py-0.5 bg-white text-slate-700 border border-slate-200 rounded-md text-[11px] font-medium">
                        <strong className="text-slate-900">{p.criterion}:</strong> {p.standard} {p.unit}
                      </span>
                    ))}
                    {(row['Thông số kỹ thuật'] || []).length > 3 && (
                      <span className="px-2 py-0.5 bg-slate-200/60 text-slate-600 rounded-md text-[10px] font-bold">
                        +{(row['Thông số kỹ thuật'] || []).length - 3} thông số khác
                      </span>
                    )}
                  </div>
                </div>

                {/* Blueprint / Design Image Preview if available */}
                {row['Hình ảnh thiết kế'] && (
                  <div 
                    onClick={() => {
                      setViewingSpec(row);
                      setIsPreviewOpen(true);
                    }}
                    className="h-24 rounded-xl bg-slate-100 overflow-hidden relative cursor-pointer border border-slate-200 group/img"
                  >
                    <img src={row['Hình ảnh thiết kế']} className="w-full h-full object-cover group-hover/img:scale-105 transition-transform" alt="Design preview" referrerPolicy="no-referrer" />
                    <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1">
                      <Eye size={14} /> Xem bản vẽ CAD
                    </div>
                  </div>
                )}
              </div>

              {/* Card Footer Actions */}
              <div className="p-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-400 font-medium">
                  Ngày lập: {row['Ngày lập']}
                </span>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => handlePrintSpec(row)}
                    className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="In Phiếu Spec ISO (TDS)"
                  >
                    <Printer size={16} />
                  </button>
                  <button 
                    onClick={() => handleOpenModal(row)}
                    className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Sửa tiêu chuẩn"
                  >
                    <Edit3 size={16} />
                  </button>
                  <button 
                    onClick={() => {
                      if (window.confirm(`Xóa tiêu chuẩn ${row['Mã Spec']}?`)) {
                        onDelete(row);
                      }
                    }}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    title="Xóa tiêu chuẩn"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[11px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">
                  <th className="px-6 py-3.5">Mã Spec / Tên Tiêu Chuẩn</th>
                  <th className="px-6 py-3.5">Khách hàng & Sản phẩm</th>
                  <th className="px-6 py-3.5 text-center">Phiên bản</th>
                  <th className="px-6 py-3.5 text-center">Trạng thái</th>
                  <th className="px-6 py-3.5">Ngày tạo</th>
                  <th className="px-6 py-3.5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{row['Tên tiêu chuẩn']}</span>
                        <span className="text-[11px] font-mono font-bold text-blue-500">{row['Mã Spec']}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-800">{row['Khách hàng']}</span>
                        <span className="text-[11px] text-slate-400">{row['Sản phẩm liên kết']}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[11px] font-bold">
                        v{row['Phiên bản'] || '1.0'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={clsx(
                        "px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider",
                        row['Trạng thái'] === 'Đã phê duyệt' ? "bg-emerald-50 text-emerald-600 border border-emerald-200" : "bg-amber-50 text-amber-600 border border-amber-200"
                      )}>
                        {row['Trạng thái']}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs font-medium text-slate-500">
                      {row['Ngày lập']}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button 
                          onClick={() => handlePrintSpec(row)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="In Spec ISO"
                        >
                          <Printer size={16} />
                        </button>
                        <button 
                          onClick={() => handleOpenModal(row)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Sửa"
                        >
                          <Edit3 size={16} />
                        </button>
                        <button 
                          onClick={() => {
                            if (window.confirm(`Xóa tiêu chuẩn ${row['Mã Spec']}?`)) {
                              onDelete(row);
                            }
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Xóa"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. MODAL THIẾT LẬP SPECS CHUYÊN SÂU ISO */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-[9999] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 my-auto">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-slate-900 to-indigo-950 p-6 flex justify-between items-center shrink-0 border-b border-slate-800">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-600/30 border border-blue-400/40 rounded-2xl flex items-center justify-center text-blue-300 shadow-lg">
                  <ShieldCheck size={26} />
                </div>
                <div>
                  <h3 className="text-white font-bold text-lg leading-tight">
                    {editingRow ? `Hiệu Chỉnh Spec Kỹ Thuật (${formData['Mã Spec']})` : "Thiết Lập Định Chuẩn ISO Sản Phẩm Mới"}
                  </h3>
                  <p className="text-blue-300 text-xs mt-0.5 font-medium">
                    Quy chuẩn kiểm soát chất lượng QA/QC ISO 9001:2015 - TSG Business OS
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all"
              >
                <X size={20} />
              </button>
            </div>
            
            {/* Modal Body Form */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
              {/* Preset Buttons for Quick Autofill */}
              <div className="bg-blue-50/70 p-4 rounded-2xl border border-blue-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-bold text-blue-900">
                  <Sparkles size={16} className="text-blue-600 animate-bounce" />
                  <span>Nạp nhanh chỉ tiêu mẫu ISO chuẩn:</span>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <button 
                    type="button" 
                    onClick={() => applyPresetTemplate('Carton')}
                    className="px-3 py-1.5 bg-white hover:bg-blue-600 hover:text-white border border-blue-200 text-blue-700 text-xs font-bold rounded-xl transition-all shadow-sm flex-1 sm:flex-initial"
                  >
                    Thùng Carton 3/5 lớp
                  </button>
                  <button 
                    type="button" 
                    onClick={() => applyPresetTemplate('Label')}
                    className="px-3 py-1.5 bg-white hover:bg-purple-600 hover:text-white border border-purple-200 text-purple-700 text-xs font-bold rounded-xl transition-all shadow-sm flex-1 sm:flex-initial"
                  >
                    Tem Nhãn Decal
                  </button>
                  <button 
                    type="button" 
                    onClick={() => applyPresetTemplate('Material')}
                    className="px-3 py-1.5 bg-white hover:bg-emerald-600 hover:text-white border border-emerald-200 text-emerald-700 text-xs font-bold rounded-xl transition-all shadow-sm flex-1 sm:flex-initial"
                  >
                    Nguyên vật liệu
                  </button>
                </div>
              </div>

              {/* Thông tin chung */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Mã Spec ID</label>
                  <input 
                    type="text" required readOnly 
                    className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm font-mono font-bold text-blue-600 outline-none" 
                    value={formData['Mã Spec'] || ''} 
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Loại sản phẩm</label>
                  <select 
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none"
                    value={formData['Loại sản phẩm']}
                    onChange={(e) => setFormData({...formData, 'Loại sản phẩm': e.target.value as any})}
                  >
                    <option value="Carton">Thùng Carton</option>
                    <option value="Label">Nhãn in ấn</option>
                    <option value="Material">Nguyên vật liệu</option>
                    <option value="Other">Khác</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Tên tiêu chuẩn / Bản vẽ CAD</label>
                  <input 
                    type="text" required placeholder="VD: Thùng carton 5 lớp Johnnie Walker JGI-427"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/20"
                    value={formData['Tên tiêu chuẩn'] || ''}
                    onChange={(e) => setFormData({...formData, 'Tên tiêu chuẩn': e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Khách hàng</label>
                  <select 
                    required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none"
                    value={formData['Khách hàng'] || ''}
                    onChange={(e) => setFormData({...formData, 'Khách hàng': e.target.value})}
                  >
                    <option value="">-- Chọn khách hàng --</option>
                    {customerData.map((c, i) => (
                      <option key={i} value={c['Tên khách hàng'] || c['Tên đầy đủ']}>{c['Tên khách hàng'] || c['Tên đầy đủ']}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Sản phẩm liên kết</label>
                  <select 
                    required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none"
                    value={formData['Sản phẩm liên kết'] || ''}
                    onChange={(e) => setFormData({...formData, 'Sản phẩm liên kết': e.target.value})}
                  >
                    <option value="">-- Chọn sản phẩm --</option>
                    {productData.map((p, i) => (
                      <option key={i} value={p['Tên sản phẩm']}>{p['Tên sản phẩm']}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Phiên bản Spec</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-center" 
                    value={formData['Phiên bản'] || '1.0'} 
                    onChange={(e) => setFormData({...formData, 'Phiên bản': e.target.value})} 
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Người duyệt ISO</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium" 
                    value={formData['Người phê duyệt'] || 'Giám Đốc Kỹ Thuật'} 
                    onChange={(e) => setFormData({...formData, 'Người phê duyệt': e.target.value})} 
                  />
                </div>
              </div>

              {/* Bảng chỉ tiêu kỹ thuật chi tiết */}
              <div className="space-y-3 pt-2">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="text-slate-900 font-bold text-sm flex items-center gap-2">
                      <Layers size={18} className="text-blue-600" />
                      DANH MỤC CHỈ TIÊU KỸ THUẬT VÀ PHƯƠNG PHÁP THỬ ISO
                    </h4>
                  </div>
                  <button 
                    type="button" onClick={addParameter}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-all flex items-center gap-1.5 shadow-sm"
                  >
                    <Plus size={14} /> Thêm chỉ tiêu
                  </button>
                </div>

                <div className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-[10px] font-black text-slate-600 uppercase tracking-widest border-b border-slate-200">
                        <th className="px-4 py-2.5 w-1/3">Tên chỉ tiêu kỹ thuật</th>
                        <th className="px-4 py-2.5 w-24 text-center">Đơn vị</th>
                        <th className="px-4 py-2.5 w-1/4">Tiêu chuẩn mẫu</th>
                        <th className="px-4 py-2.5">Dung sai cho phép</th>
                        <th className="px-4 py-2.5">Phương pháp thử</th>
                        <th className="px-4 py-2.5 w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs">
                      {(formData['Thông số kỹ thuật'] || []).map((param, pidx) => (
                        <tr key={pidx} className="hover:bg-white transition-colors">
                          <td className="p-2">
                            <input 
                              type="text" placeholder="VD: Độ chịu nén BCT"
                              className="w-full bg-white px-3 py-2 rounded-xl text-xs font-bold outline-none border border-slate-200 focus:border-blue-500"
                              value={param.criterion} onChange={(e) => updateParameter(pidx, 'criterion', e.target.value)}
                            />
                          </td>
                          <td className="p-2">
                            <input 
                              type="text" placeholder="KgF, gsm, mm"
                              className="w-full bg-white px-3 py-2 rounded-xl text-xs text-center font-mono outline-none border border-slate-200 focus:border-blue-500"
                              value={param.unit} onChange={(e) => updateParameter(pidx, 'unit', e.target.value)}
                            />
                          </td>
                          <td className="p-2">
                            <input 
                              type="text" placeholder="VD: ≥ 350"
                              className="w-full bg-white px-3 py-2 rounded-xl text-xs font-bold text-blue-900 outline-none border border-slate-200 focus:border-blue-500"
                              value={param.standard} onChange={(e) => updateParameter(pidx, 'standard', e.target.value)}
                            />
                          </td>
                          <td className="p-2">
                            <input 
                              type="text" placeholder="VD: ± 5%"
                              className="w-full bg-white px-3 py-2 rounded-xl text-xs outline-none border border-slate-200 focus:border-blue-500"
                              value={param.tolerance} onChange={(e) => updateParameter(pidx, 'tolerance', e.target.value)}
                            />
                          </td>
                          <td className="p-2">
                            <input 
                              type="text" placeholder="VD: Máy đo nén ISO 12048"
                              className="w-full bg-white px-3 py-2 rounded-xl text-xs outline-none border border-slate-200 focus:border-blue-500"
                              value={param.testMethod} onChange={(e) => updateParameter(pidx, 'testMethod', e.target.value)}
                            />
                          </td>
                          <td className="p-2 text-center">
                            <button type="button" onClick={() => removeParameter(pidx)} className="text-slate-400 hover:text-rose-600 transition-colors p-1">
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Quy cách đóng gói & Hình ảnh */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Quy cách đóng gói & Bảo quản</label>
                  <textarea 
                    placeholder="VD: Đóng kiện 25 cái/xấp, bọc màng co PE, lót pallet gỗ tiệt trùng..."
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs h-24 outline-none focus:ring-2 focus:ring-blue-500/20"
                    value={formData['Quy cách đóng gói'] || ''}
                    onChange={(e) => setFormData({...formData, 'Quy cách đóng gói': e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Link Hình ảnh Bản vẽ CAD / Thiết kế</label>
                  <input 
                    type="text" 
                    placeholder="https://... (Dán URL hình ảnh bản vẽ)"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-blue-500/20 mb-2"
                    value={formData['Hình ảnh thiết kế'] || ''}
                    onChange={(e) => setFormData({...formData, 'Hình ảnh thiết kế': e.target.value})}
                  />
                  {formData['Hình ảnh thiết kế'] && (
                    <div className="h-16 rounded-xl bg-slate-100 overflow-hidden border border-slate-200 flex items-center justify-center">
                      <img src={formData['Hình ảnh thiết kế']} className="h-full object-contain" alt="Preview" referrerPolicy="no-referrer" />
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer Controls */}
              <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row gap-3 items-center justify-between">
                <div className="flex gap-2 w-full sm:w-auto">
                  {['Nháp', 'Đã phê duyệt', 'Hết hiệu lực'].map(status => (
                    <button
                      key={status} type="button"
                      onClick={() => setFormData({...formData, 'Trạng thái': status as any})}
                      className={clsx(
                        "px-3 py-1.5 rounded-xl text-xs font-bold transition-all border",
                        formData['Trạng thái'] === status ? "bg-slate-900 border-slate-900 text-white" : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                      )}
                    >
                      {status}
                    </button>
                  ))}
                </div>

                <div className="flex gap-3 w-full sm:w-auto justify-end">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all">
                    Hủy bỏ
                  </button>
                  <button type="submit" className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-all shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2">
                    <Save size={16} /> {editingRow ? "Cập Nhật Spec" : "Lưu & Phê Duyệt ISO"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. MODAL XEM HÌNH ẢNH BẢN VẼ BẢN QUYỀN */}
      {isPreviewOpen && viewingSpec && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl max-w-4xl w-full p-6 text-white space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-lg text-white">{viewingSpec['Tên tiêu chuẩn']}</h3>
                <p className="text-xs text-blue-400 font-mono">{viewingSpec['Mã Spec']} | Khách hàng: {viewingSpec['Khách hàng']}</p>
              </div>
              <button onClick={() => setIsPreviewOpen(false)} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-hidden rounded-2xl bg-black flex items-center justify-center border border-slate-800 p-2">
              <img src={viewingSpec['Hình ảnh thiết kế']} className="max-h-[65vh] object-contain mx-auto" alt="CAD Specs" referrerPolicy="no-referrer" />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => handlePrintSpec(viewingSpec)} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-500 flex items-center gap-1.5">
                <Printer size={16} /> In Phân Tích Kỹ Thuật (TDS)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
