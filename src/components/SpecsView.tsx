import React, { useState, useMemo } from 'react';
import { 
  FileText, Plus, Search, Filter, Edit3, Trash2, ChevronRight, 
  Settings, Layers, Ruler, Palette, ShieldCheck, Download, MoreVertical,
  Save, Package, Eye, LayoutGrid, Table as TableIcon, Printer, FileSpreadsheet,
  CheckCircle2, AlertCircle, Clock, Copy, Sparkles, Building2, Check, X,
  FileDown, ArrowUpRight, Share2, Tag, ChevronDown, CheckSquare
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import clsx from 'clsx';
import * as XLSX from 'xlsx';
import {
  CockpitTableToolbar,
  CockpitPagination,
  CockpitBadge,
  CockpitTableEmptyState,
  Modal,
  Button
} from './ui';

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
    { criterion: 'Cấu trúc thùng carton', unit: 'Kiểu', standard: 'Thùng A1 (Đối khẩu nắp chạm tâm)', tolerance: 'FEFCO 0201', testMethod: 'Quan sát kết cấu mẫu' },
    { criterion: 'Số lớp & Loại sóng', unit: '-', standard: '5 lớp sóng BC (hoặc 3 lớp sóng B)', tolerance: '± 0.2mm', testMethod: 'Thước panme đo sóng' },
    { criterion: 'Loại giấy mặt ngoài (Top Liner)', unit: 'gsm', standard: 'Kraft mộc vàng K175 (hoặc K250 XK)', tolerance: '± 5 gsm', testMethod: 'Cân điện tử ISO 536' },
    { criterion: 'Giấy sóng & Giấy giữa', unit: 'gsm', standard: 'Medium M125 + Giấy lót M125 + Medium M125', tolerance: '± 5 gsm', testMethod: 'Cân điện tử ISO 536' },
    { criterion: 'Giấy mặt trong (Inner Liner)', unit: 'gsm', standard: 'Kraft K150 / Testliner', tolerance: '± 5 gsm', testMethod: 'Cân điện tử ISO 536' },
    { criterion: 'Độ chịu bục carton (Bursting Strength)', unit: 'kPa', standard: '≥ 1150 (≥ 11.7 kgf/cm²)', tolerance: '- 40 kPa', testMethod: 'Máy đo độ bục Mullen ISO 2759' },
    { criterion: 'Độ nén cạnh (ECT)', unit: 'kN/m', standard: '≥ 5.5', tolerance: '- 0.2 kN/m', testMethod: 'Máy nén cạnh ISO 3037' },
    { criterion: 'Độ chịu nén thùng (BCT)', unit: 'KgF', standard: '≥ 380', tolerance: '- 5%', testMethod: 'Máy nén thùng ISO 12048' },
    { criterion: 'Độ hút nước Cobb 60 (Mặt ngoài)', unit: 'g/m²', standard: '≤ 45', tolerance: '+ 5 g/m²', testMethod: 'Phương pháp Cobb ISO 535' },
    { criterion: 'Độ ẩm carton', unit: '%', standard: '8.0 - 12.0', tolerance: '± 1.0%', testMethod: 'Máy sấy ẩm ISO 287' },
    { criterion: 'Mối nối ghép thân thùng', unit: '-', standard: 'Dập ghim thép mạ kẽm chống rỉ / Ghim đôi', tolerance: 'Cách mép 15mm', testMethod: 'Kiểm tra độ gập mép' }
  ],
  Material: [
    { criterion: 'Quy cách khổ rộng cuộn', unit: 'mm', standard: '71 mm (hoặc 95 mm)', tolerance: '± 0.5 mm', testMethod: 'Thước panme điện tử' },
    { criterion: 'Chiều dài cuộn tiêu chuẩn', unit: 'm', standard: '800 m', tolerance: '± 5 m', testMethod: 'Bộ đếm mét máy chia cuộn' },
    { criterion: 'Trọng lượng riêng cuộn tiêu chuẩn', unit: 'kg/cuộn', standard: '11.92 kg/cuộn (95mm: 15.95 kg)', tolerance: '± 0.20 kg', testMethod: 'Cân điện tử công nghiệp kiểm định' },
    { criterion: 'Định lượng giấy (Grammage)', unit: 'gsm', standard: '210 gsm (Tùy chọn 230 gsm)', tolerance: '± 5 gsm', testMethod: 'Cân phân tích ISO 536' },
    { criterion: 'Độ dày giấy (Caliper)', unit: 'µm', standard: '280 µm (0.28 mm)', tolerance: '± 10 µm', testMethod: 'Đo độ dày vi sai ISO 534' },
    { criterion: 'Độ bền kéo dọc (Tensile MD)', unit: 'kN/m', standard: '≥ 8.5', tolerance: '- 0.3 kN/m', testMethod: 'Máy thử kéo universal ISO 1924-2' },
    { criterion: 'Độ bền kéo ngang (Tensile CD)', unit: 'kN/m', standard: '≥ 4.2', tolerance: '- 0.2 kN/m', testMethod: 'Máy thử kéo universal ISO 1924-2' },
    { criterion: 'Độ trắng bề mặt ISO', unit: '%', standard: '≥ 85% ISO (Trắng sứ đều màu)', tolerance: '± 2%', testMethod: 'Máy đo độ trắng quang học ISO 2470' },
    { criterion: 'Đường kính lõi trong (Core ID)', unit: 'mm', standard: '76 mm (3 inch)', tolerance: '± 1.0 mm', testMethod: 'Thước cặp cơ khí' },
    { criterion: 'Đường kính ngoài cuộn (Outer OD)', unit: 'mm', standard: '420 - 450 mm', tolerance: '± 10 mm', testMethod: 'Thước đo ngoài' },
    { criterion: 'Độ ẩm cuộn giấy', unit: '%', standard: '6.5 - 8.0', tolerance: '± 0.5%', testMethod: 'Máy sấy hồng ngoại ISO 287' },
    { criterion: 'Quy cách bọc màng bảo vệ', unit: '-', standard: 'Bọc màng PE chống ẩm, tem nhãn đầu cuộn', tolerance: 'Kín 100%', testMethod: 'Quan sát ngoại quan' }
  ],
  Label: [
    { criterion: 'Chất liệu giấy mặt (Face Stock)', unit: '-', standard: 'Giấy Ivory 230gsm / Decal Fasson cao cấp', tolerance: 'Đúng mẫu duyệt', testMethod: 'Cân định lượng & soi sợi' },
    { criterion: 'Loại keo dính (Adhesive)', unit: '-', standard: 'Keo Acrylic vĩnh viễn (Permanent)', tolerance: 'Phủ đều 20 gsm', testMethod: 'Kiểm tra bóc tách keo' },
    { criterion: 'Độ bám dính bóc 180° (Peel Adhesion)', unit: 'N/25mm', standard: '≥ 16.0', tolerance: '- 1.0 N', testMethod: 'Máy thử kéo bám dính FTM 1' },
    { criterion: 'Độ dính ban đầu (Loop Tack)', unit: 'N', standard: '≥ 12.0', tolerance: '- 1.0 N', testMethod: 'Máy đo độ dính nhanh FTM 9' },
    { criterion: 'Công nghệ in ấn', unit: '-', standard: 'In Offset UV 4 màu (CMYK) + Màu pha Pantone', tolerance: 'Delta E ≤ 2.0', testMethod: 'Máy quang phổ màu X-Rite' },
    { criterion: 'Gia công hoàn thiện bề mặt', unit: '-', standard: 'Cán màng BOPP bóng / mờ chống trầy xước', tolerance: 'Không bọt khí', testMethod: 'Thử xé màng & cồn 90°' },
    { criterion: 'Độ bóng bề mặt (Gloss 60°)', unit: '%', standard: '≥ 88', tolerance: '± 3%', testMethod: 'Máy đo độ bóng góc 60°' },
    { criterion: 'Độ bền cọ xát màu mực', unit: 'Lần', standard: '≥ 100 lần không phai màu', tolerance: '- 10 lần', testMethod: 'Máy chà xát mực Sutherland Rub Test' },
    { criterion: 'Dung sai bế định hình', unit: 'mm', standard: 'Đúng đường kính bế ma-két', tolerance: '± 0.3 mm', testMethod: 'Thước kính quang học' }
  ],
  Other: [
    { criterion: 'Chất liệu quy chuẩn', unit: '-', standard: 'Gỗ keo xẻ sấy / Nhựa HDPE / Màng PE', tolerance: 'Đúng chủng loại', testMethod: 'Kiểm tra xuất xứ CO/CQ' },
    { criterion: 'Tiêu chuẩn khử trùng (Pallet)', unit: '-', standard: 'Hun trùng đạt chuẩn ISPM 15 / Sấy nhiệt HT', tolerance: 'Đóng dấu kiểm dịch', testMethod: 'Chứng thư kiểm dịch thực vật' },
    { criterion: 'Kích thước phủ bì', unit: 'mm', standard: '1200 x 1000 x 150 mm', tolerance: '± 3.0 mm', testMethod: 'Thước cuộn thép' },
    { criterion: 'Tải trọng chịu lực tĩnh', unit: 'kg', standard: '≥ 1500 kg', tolerance: '- 50 kg', testMethod: 'Thử tải trọng tĩnh giàn' },
    { criterion: 'Tải trọng chịu lực động', unit: 'kg', standard: '≥ 800 kg', tolerance: '- 30 kg', testMethod: 'Thử tải trọng xe nâng' },
    { criterion: 'Độ ẩm vật liệu', unit: '%', standard: '≤ 18%', tolerance: '± 1%', testMethod: 'Máy đo ẩm kim gỗ' }
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
  const [activeTab, setActiveTab] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDetailSpec, setSelectedDetailSpec] = useState<any>(null);
  const [isPreviewImageOpen, setIsPreviewImageOpen] = useState(false);
  
  const [editingRow, setEditingRow] = useState<any>(null);
  const [formData, setFormData] = useState<Partial<SpecRecord>>({
    'Thông số kỹ thuật': []
  });

  // Statistics
  const stats = useMemo(() => {
    const total = specsData.length;
    const carton = specsData.filter(s => s['Loại sản phẩm'] === 'Carton').length;
    const material = specsData.filter(s => s['Loại sản phẩm'] === 'Material').length;
    const label = specsData.filter(s => s['Loại sản phẩm'] === 'Label').length;
    const other = specsData.filter(s => s['Loại sản phẩm'] === 'Other').length;
    const approved = specsData.filter(s => s['Trạng thái'] === 'Đã phê duyệt').length;
    const draft = specsData.filter(s => s['Trạng thái'] === 'Nháp').length;
    return { total, carton, material, label, other, approved, draft };
  }, [specsData]);

  // Filtered dataset based on search and active tab
  const filteredData = useMemo(() => {
    return specsData.filter(s => {
      const matchSearch = 
        (s['Tên tiêu chuẩn'] || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s['Mã Spec'] || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s['Khách hàng'] || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s['Sản phẩm liên kết'] || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      let matchTab = true;
      if (activeTab === 'CARTON') matchTab = s['Loại sản phẩm'] === 'Carton';
      else if (activeTab === 'MATERIAL') matchTab = s['Loại sản phẩm'] === 'Material';
      else if (activeTab === 'LABEL') matchTab = s['Loại sản phẩm'] === 'Label';
      else if (activeTab === 'OTHER') matchTab = s['Loại sản phẩm'] === 'Other';
      else if (activeTab === 'APPROVED') matchTab = s['Trạng thái'] === 'Đã phê duyệt';
      else if (activeTab === 'DRAFT') matchTab = s['Trạng thái'] === 'Nháp';

      return matchSearch && matchTab;
    });
  }, [specsData, searchTerm, activeTab]);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const paginatedSpecs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage, pageSize]);

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
      toast.success(`Đã nạp bộ chỉ tiêu ISO mẫu cho ${cat}`);
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
      setFormData(JSON.parse(JSON.stringify(row)));
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

  const handleCloneSpec = (spec: any) => {
    const cloned = JSON.parse(JSON.stringify(spec));
    delete cloned.id;
    cloned['Mã Spec'] = `SPEC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    cloned['Tên tiêu chuẩn'] = `${cloned['Tên tiêu chuẩn']} (Bản sao)`;
    cloned['Phiên bản'] = '1.0';
    cloned['Trạng thái'] = 'Nháp';
    cloned['Ngày lập'] = new Date().toISOString().split('T')[0];

    setEditingRow(null);
    setFormData(cloned);
    setIsModalOpen(true);
    toast.success("Đã nhân bản tiêu chuẩn! Vui lòng chỉnh sửa và lưu.");
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

  const handleExportAllToExcel = () => {
    try {
      const exportRows = specsData.map(s => ({
        'Mã Spec': s['Mã Spec'],
        'Tên tiêu chuẩn': s['Tên tiêu chuẩn'],
        'Loại sản phẩm': s['Loại sản phẩm'],
        'Khách hàng': s['Khách hàng'],
        'Sản phẩm liên kết': s['Sản phẩm liên kết'],
        'Phiên bản': s['Phiên bản'],
        'Trạng thái': s['Trạng thái'],
        'Ngày lập': s['Ngày lập'],
        'Người lập': s['Người lập'],
        'Người phê duyệt': s['Người phê duyệt'] || '',
        'Số chỉ tiêu kỹ thuật': (s['Thông số kỹ thuật'] || []).length,
        'Quy cách đóng gói': s['Quy cách đóng gói'] || '',
        'Ghi chú': s['Ghi chú'] || ''
      }));

      const ws = XLSX.utils.json_to_sheet(exportRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Danh_Muc_Specs_ISO");
      XLSX.writeFile(wb, `TSG_Specs_Directory_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success("Đã xuất tệp Excel Danh mục Specs ISO thành công!");
    } catch (e: any) {
      toast.error(`Lỗi xuất Excel: ${e.message}`);
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
    <div className="space-y-4">
      {/* 1. Cockpit Header & Live HUD Stats Toolbar */}
      <CockpitTableToolbar
        moduleCode="MOD // 07 · SPECS"
        title="Quản Lý Tiêu Chuẩn Kỹ Thuật (Specs QA/QC)"
        subtitle="Định chuẩn thông số kỹ thuật sản phẩm, kiểm soát độ chịu nén, định lượng, dung sai ISO 9001:2015"
        icon={<ShieldCheck size={22} className="text-white" />}
        stats={[
          { label: 'Tổng Tiêu Chuẩn', value: stats.total, tone: 'cobalt' },
          { label: 'Thùng Carton', value: stats.carton, tone: 'emerald' },
          { label: 'Cuộn Lưỡi Gà', value: stats.material, tone: 'cobalt' },
          { label: 'Tem Nhãn', value: stats.label, tone: 'amber' },
          { label: 'Phụ Kiện / Khác', value: stats.other, tone: 'default' },
          { label: 'Đã Duyệt', value: stats.approved, tone: 'emerald' },
        ]}
        searchPlaceholder="Tìm theo Mã Spec, Tên tiêu chuẩn, Khách hàng hoặc Sản phẩm..."
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        tabs={[
          { id: 'ALL', label: 'Tất cả', count: stats.total },
          { id: 'CARTON', label: '📦 Thùng Carton', count: stats.carton },
          { id: 'MATERIAL', label: '🧵 Cuộn Lưỡi Gà', count: stats.material },
          { id: 'LABEL', label: '🏷️ Tem Nhãn', count: stats.label },
          { id: 'OTHER', label: '🧱 Phụ Kiện', count: stats.other },
          { id: 'APPROVED', label: 'Đã Duyệt', count: stats.approved },
          { id: 'DRAFT', label: 'Bản Nháp', count: stats.draft },
        ]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        filtersSlot={
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-black/[0.06]">
            <button
              onClick={() => setViewMode('grid')}
              className={clsx(
                "p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1",
                viewMode === 'grid' ? "bg-white text-blue-600 shadow-2xs" : "text-slate-500 hover:text-slate-900"
              )}
              title="Xem dạng thẻ"
            >
              <LayoutGrid size={15} />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={clsx(
                "p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1",
                viewMode === 'table' ? "bg-white text-blue-600 shadow-2xs" : "text-slate-500 hover:text-slate-900"
              )}
              title="Xem dạng bảng"
            >
              <TableIcon size={15} />
            </button>
          </div>
        }
        onExport={handleExportAllToExcel}
        onAddNew={() => handleOpenModal()}
        addNewLabel="Thêm Tiêu Chuẩn"
      />

      {/* 3. Main Data View (Grid or Table) */}
      {filteredData.length === 0 ? (
        <CockpitTableEmptyState
          title="Chưa tìm thấy tiêu chuẩn kỹ thuật phù hợp"
          description="Thử thay đổi từ khóa tìm kiếm hoặc bấm nút bên dưới để tạo Tiêu chuẩn Spec ISO mới."
          searchTerm={searchTerm}
          onClearSearch={() => setSearchTerm('')}
        />
      ) : viewMode === 'grid' ? (
        /* GRID VIEW CARDS */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredData.map((row, idx) => (
            <div 
              key={idx}
              className="bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group hover:border-blue-400/80"
            >
              <div className="p-5 space-y-4">
                {/* Header Badge */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-md text-[11px] font-mono font-bold tracking-wider">
                      {row['Mã Spec']}
                    </span>
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold">
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
                <div 
                  className="cursor-pointer"
                  onClick={() => setSelectedDetailSpec(row)}
                >
                  <h3 className="font-bold text-slate-900 text-base group-hover:text-blue-600 transition-colors line-clamp-1">
                    {row['Tên tiêu chuẩn']}
                  </h3>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                    <Building2 size={13} className="text-slate-400 shrink-0" />
                    <span className="font-medium text-slate-700 truncate">{row['Khách hàng'] || 'Chưa gán KH'}</span>
                  </div>
                </div>

                {/* Technical Parameters Quick Pills */}
                <div 
                  className="space-y-1.5 bg-slate-50/80 p-3 rounded-xl border border-slate-100 cursor-pointer hover:bg-blue-50/50 transition-colors"
                  onClick={() => setSelectedDetailSpec(row)}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Thông số cốt lõi:</p>
                    <span className="text-[10px] text-blue-600 font-bold flex items-center gap-0.5">
                      Chi tiết <ChevronRight size={12} />
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(row['Thông số kỹ thuật'] || []).slice(0, 3).map((p: any, pidx: number) => (
                      <span key={pidx} className="px-2 py-0.5 bg-white text-slate-700 border border-slate-200 rounded-md text-[11px] font-medium">
                        <strong className="text-slate-900">{p.criterion}:</strong> {p.standard} {p.unit}
                      </span>
                    ))}
                    {(row['Thông số kỹ thuật'] || []).length > 3 && (
                      <span className="px-2 py-0.5 bg-blue-100/60 text-blue-700 rounded-md text-[10px] font-bold">
                        +{(row['Thông số kỹ thuật'] || []).length - 3} thông số
                      </span>
                    )}
                  </div>
                </div>

                {/* Blueprint / Design Image Preview if available */}
                {row['Hình ảnh thiết kế'] && (
                  <div 
                    onClick={() => {
                      setSelectedDetailSpec(row);
                      setIsPreviewImageOpen(true);
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
                  {row['Ngày lập']}
                </span>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => handleCloneSpec(row)}
                    className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Nhân bản Spec (Clone)"
                  >
                    <Copy size={15} />
                  </button>
                  <button 
                    onClick={() => handlePrintSpec(row)}
                    className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="In Phiếu Spec ISO (TDS)"
                  >
                    <Printer size={15} />
                  </button>
                  <button 
                    onClick={() => handleOpenModal(row)}
                    className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Sửa tiêu chuẩn"
                  >
                    <Edit3 size={15} />
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
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="cockpit-table-shell flex flex-col overflow-hidden">
          <div className="overflow-x-auto flex-1 min-h-0">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="cockpit-table-header">
                <tr>
                  <th className="px-6 py-3.5">Mã Spec / Tên Tiêu Chuẩn</th>
                  <th className="px-6 py-3.5">Khách hàng & Sản phẩm</th>
                  <th className="px-6 py-3.5 text-center">Phiên bản</th>
                  <th className="px-6 py-3.5 text-center">Trạng thái</th>
                  <th className="px-6 py-3.5">Ngày tạo</th>
                  <th className="px-6 py-3.5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04]">
                {paginatedSpecs.map((row, idx) => (
                  <tr key={idx} className="cockpit-table-row">
                    <td className="px-6 py-3.5">
                      <div 
                        className="flex flex-col cursor-pointer"
                        onClick={() => setSelectedDetailSpec(row)}
                      >
                        <span className="font-bold text-slate-900 transition-colors">{row['Tên tiêu chuẩn']}</span>
                        <span className="cockpit-code text-blue-600 font-mono font-bold mt-0.5">{row['Mã Spec']}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-800">{row['Khách hàng']}</span>
                        <span className="text-[11px] text-slate-400">{row['Sản phẩm liên kết']}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3.5 text-center font-mono">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[11px] font-bold">
                        v{row['Phiên bản'] || '1.0'}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-center">
                      <CockpitBadge
                        tone={row['Trạng thái'] === 'Đã phê duyệt' ? 'emerald' : 'amber'}
                        dot
                        size="sm"
                      >
                        {row['Trạng thái']}
                      </CockpitBadge>
                    </td>
                    <td className="px-6 py-3.5 text-xs font-mono tabular-nums text-slate-500">
                      {row['Ngày lập']}
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button 
                          onClick={() => handleCloneSpec(row)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Nhân bản Spec"
                        >
                          <Copy size={15} />
                        </button>
                        <button 
                          onClick={() => handlePrintSpec(row)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="In Spec ISO"
                        >
                          <Printer size={15} />
                        </button>
                        <button 
                          onClick={() => handleOpenModal(row)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Sửa"
                        >
                          <Edit3 size={15} />
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
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Unified Pagination */}
          <CockpitPagination
            currentPage={currentPage}
            totalItems={filteredData.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={(newSize) => { setPageSize(newSize); setCurrentPage(1); }}
          />
        </div>
      )}

      {/* 4. MODAL XEM CHI TIẾT SPEC & BẢNG THÔNG SỐ NHANH */}
      <Modal
        open={Boolean(selectedDetailSpec)}
        onClose={() => setSelectedDetailSpec(null)}
        title={selectedDetailSpec ? `${selectedDetailSpec['Mã Spec']} - ${selectedDetailSpec['Tên tiêu chuẩn']}` : 'Chi Tiết Spec'}
        subtitle={selectedDetailSpec ? `Khách hàng: ${selectedDetailSpec['Khách hàng']} | SP: ${selectedDetailSpec['Sản phẩm liên kết']}` : undefined}
        size="2xl"
        maximizable
        footer={
          selectedDetailSpec && (
            <div className="flex flex-col sm:flex-row justify-between items-center w-full gap-3">
              <span className="text-xs text-ink-muted">
                Người duyệt: <strong className="text-ink">{selectedDetailSpec['Người phê duyệt'] || 'Ban Giám Đốc TSG'}</strong>
              </span>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() => setSelectedDetailSpec(null)}
                >
                  Đóng
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    handlePrintSpec(selectedDetailSpec);
                    setSelectedDetailSpec(null);
                  }}
                  icon={<Printer size={15} />}
                >
                  In Phiếu Kỹ Thuật (TDS)
                </Button>
              </div>
            </div>
          )
        }
      >
        {selectedDetailSpec && (
          <div className="space-y-6 text-xs">
            {/* Section 1: Table Bảng chỉ tiêu kỹ thuật */}
            <div className="space-y-3">
              <h4 className="font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2 text-sm">
                <Layers size={18} className="text-blue-600" /> 
                <span>BẢNG CHỈ TIÊU KỸ THUẬT CHI TIẾT</span>
              </h4>
              <div className="bg-[#F8FAFC] rounded-2xl border border-slate-200/80 overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100/90 text-[11px] font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200/80">
                        <th className="py-3 px-4 w-1/3">CHỈ TIÊU</th>
                        <th className="py-3 px-3 text-center w-20">ĐVT</th>
                        <th className="py-3 px-4 w-1/4">TIÊU CHUẨN MẪU</th>
                        <th className="py-3 px-3 text-center">DUNG SAI</th>
                        <th className="py-3 px-4">PHƯƠNG PHÁP THỬ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/70 text-xs">
                      {(selectedDetailSpec['Thông số kỹ thuật'] || []).map((p: any, idx: number) => (
                        <tr key={idx} className="hover:bg-white/80 transition-colors">
                          <td className="py-3 px-4 font-bold text-slate-900">{p.criterion}</td>
                          <td className="py-3 px-3 text-center font-mono text-slate-600 font-medium">{p.unit}</td>
                          <td className="py-3 px-4 font-bold text-blue-700 text-sm font-sans">{p.standard}</td>
                          <td className="py-3 px-3 text-center text-slate-600 font-medium">{p.tolerance || '-'}</td>
                          <td className="py-3 px-4 text-slate-600 font-medium">{p.testMethod || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Section 2: Box Quy cách đóng gói & Bảo quản */}
            {selectedDetailSpec['Quy cách đóng gói'] && (
              <div className="bg-blue-50/60 border border-blue-100/90 p-4 sm:p-5 rounded-2xl space-y-1">
                <h5 className="font-bold text-blue-950 text-xs sm:text-sm">Quy cách đóng gói & Bảo quản:</h5>
                <p className="text-slate-700 text-xs sm:text-sm leading-relaxed">{selectedDetailSpec['Quy cách đóng gói']}</p>
              </div>
            )}

            {/* Section 3: Bản vẽ CAD / Thiết kế đính kèm */}
            {selectedDetailSpec['Hình ảnh thiết kế'] && (
              <div className="space-y-2">
                <h5 className="font-bold text-slate-900 text-xs uppercase tracking-wide">Bản vẽ CAD / Thiết kế đính kèm:</h5>
                <div className="rounded-2xl bg-slate-50 border border-slate-200/80 overflow-hidden p-3 flex items-center justify-center max-h-80 shadow-2xs">
                  <img 
                    src={selectedDetailSpec['Hình ảnh thiết kế']} 
                    className="rounded-xl max-h-72 object-cover w-full" 
                    alt="CAD Design preview" 
                    referrerPolicy="no-referrer" 
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* 5. MODAL THIẾT LẬP / SỬA SPECS CHUYÊN SÂU ISO */}
      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingRow ? `Hiệu Chỉnh Spec Kỹ Thuật (${formData['Mã Spec']})` : "Thiết Lập Định Chuẩn ISO Sản Phẩm Mới"}
        subtitle="Quy chuẩn kiểm soát chất lượng QA/QC ISO 9001:2015 - TSG Business OS"
        size="2xl"
        maximizable
        footer={
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between w-full">
            <div className="flex gap-1.5">
              {['Nháp', 'Đã phê duyệt', 'Hết hiệu lực'].map(status => (
                <button
                  key={status} type="button"
                  onClick={() => setFormData({...formData, 'Trạng thái': status as any})}
                  className={clsx(
                    "px-2.5 py-1 rounded-lg text-xs font-bold transition-all border cursor-pointer",
                    formData['Trạng thái'] === status ? "bg-slate-900 border-slate-900 text-white" : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                  )}
                >
                  {status}
                </button>
              ))}
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
                Hủy bỏ
              </Button>
              <Button variant="primary" type="submit" form="spec-form" icon={<Save size={15} />}>
                {editingRow ? "Cập Nhật Spec" : "Lưu & Phê Duyệt ISO"}
              </Button>
            </div>
          </div>
        }
      >
        {/* Modal Body Form */}
        <form id="spec-form" onSubmit={handleSubmit} className="space-y-6">
              {/* Preset Buttons for Quick Autofill */}
              <div className="bg-blue-50/70 p-4 rounded-2xl border border-blue-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-bold text-blue-900">
                  <Sparkles size={16} className="text-blue-600 animate-bounce" />
                  <span>Nạp nhanh chỉ tiêu mẫu ISO chuẩn:</span>
                </div>
                <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                  <button 
                    type="button" 
                    onClick={() => applyPresetTemplate('Carton')}
                    className="px-3 py-1.5 bg-white hover:bg-blue-600 hover:text-white border border-blue-200 text-blue-700 text-xs font-bold rounded-xl transition-all shadow-sm flex-1 sm:flex-initial"
                  >
                    📦 Thùng Carton 3/5 lớp
                  </button>
                  <button 
                    type="button" 
                    onClick={() => applyPresetTemplate('Material')}
                    className="px-3 py-1.5 bg-white hover:bg-emerald-600 hover:text-white border border-emerald-200 text-emerald-700 text-xs font-bold rounded-xl transition-all shadow-sm flex-1 sm:flex-initial"
                  >
                    🧵 Cuộn Lưỡi Gà Trắng
                  </button>
                  <button 
                    type="button" 
                    onClick={() => applyPresetTemplate('Label')}
                    className="px-3 py-1.5 bg-white hover:bg-purple-600 hover:text-white border border-purple-200 text-purple-700 text-xs font-bold rounded-xl transition-all shadow-sm flex-1 sm:flex-initial"
                  >
                    🏷️ Tem Nhãn & In Ấn
                  </button>
                  <button 
                    type="button" 
                    onClick={() => applyPresetTemplate('Other')}
                    className="px-3 py-1.5 bg-white hover:bg-slate-700 hover:text-white border border-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all shadow-sm flex-1 sm:flex-initial"
                  >
                    🧱 Phụ Kiện & Pallet
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

        </form>
      </Modal>
    </div>
  );
}
