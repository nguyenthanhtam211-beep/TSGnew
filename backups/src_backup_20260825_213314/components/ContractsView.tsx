import React, { useState, useMemo } from 'react';
import { 
  FileText, Plus, Search, Filter, Calendar, CheckCircle2, Clock, 
  AlertTriangle, ArrowUpRight, DollarSign, Download, Eye, Edit3, 
  Trash2, Sparkles, Scale, Building2, User, ChevronRight, FileCheck,
  Paperclip, Tag, ArrowRight, ShieldCheck, Upload, Camera, Loader2,
  Bot, Zap, Check, Layers, RefreshCw, CheckSquare
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import clsx from 'clsx';
import MacTrafficLights from './MacTrafficLights';
import { formatVND, parseNumber, formatDateForDisplay, parseDateToISO, findPriceRecord } from '../lib/business-logic';
import { processContractOCR } from '../lib/gemini';
import { registerAndUploadDriveDocument, getDriveFolderPath, formatShortFileName } from '../lib/driveSync';
import CompanyLogo from './CompanyLogo';

export interface ContractItem {
  id?: string;
  contractNumber: string; // Số hợp đồng (e.g. 01/2026/HĐMB-TS)
  title: string; // Tên/Trích yếu hợp đồng
  partnerName: string; // Khách hàng hoặc Nhà cung cấp
  partnerType: 'Khách hàng' | 'Nhà cung cấp';
  contractType: 'Bán hàng' | 'Mua hàng' | 'Nguyên tắc' | 'Gia công';
  signDate: string; // Ngày ký (YYYY-MM-DD or DD/MM/YYYY)
  effectiveDate: string; // Ngày có hiệu lực
  expirationDate: string; // Ngày hết hạn
  totalValue: number; // Giá trị hợp đồng (VNĐ)
  paymentTerms: string; // Điều khoản thanh toán
  deliveryTerms?: string; // Điều khoản giao nhận
  aiExecutiveSummary?: string; // Tóm tắt sơ bộ nội dung hợp đồng bởi AI
  status: 'Hiệu lực' | 'Hết hạn' | 'Đang thương thảo' | 'Thanh lý';
  attachmentName?: string; // Tên tệp đính kèm scan
  attachmentUrl?: string;
  notes?: string;
  // Danh mục sản phẩm cam kết trong hợp đồng
  products?: {
    productCode: string;
    productName: string;
    unit: string;
    contractPrice: number; // Đơn giá ký kết
    quantity?: number;
    notes?: string;
  }[];
  // Danh sách phụ lục đi kèm
  appendices?: {
    appendixNumber: string;
    title: string;
    signDate: string;
    content: string;
    priceAdjustment?: string;
  }[];
}

interface ContractsViewProps {
  contractsData?: any[];
  pricingData?: any[];
  customerData?: any[];
  supplierData?: any[];
  onAddContract?: (contract: ContractItem) => Promise<void>;
  onUpdateContract?: (contract: ContractItem) => Promise<void>;
  onDeleteContract?: (contract: ContractItem) => Promise<void>;
}

export default function ContractsView({
  contractsData = [],
  pricingData = [],
  customerData = [],
  supplierData = [],
  onAddContract,
  onUpdateContract,
  onDeleteContract
}: ContractsViewProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'customer' | 'supplier' | 'audit'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContract, setSelectedContract] = useState<ContractItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMobileDetailOpen, setIsMobileDetailOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<ContractItem | null>(null);

  // OCR Contract & Price Reconciliation State
  const [isOcrModalOpen, setIsOcrModalOpen] = useState(false);
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const [ocrContractResult, setOcrContractResult] = useState<Partial<ContractItem> | null>(null);
  const [ocrActiveTab, setOcrActiveTab] = useState<'all' | 'summary' | 'products' | 'reconciliation'>('all');

  // Form State
  const [formData, setFormData] = useState<Partial<ContractItem>>({
    contractNumber: '',
    title: '',
    partnerName: '',
    partnerType: 'Khách hàng',
    contractType: 'Bán hàng',
    signDate: new Date().toISOString().split('T')[0],
    effectiveDate: new Date().toISOString().split('T')[0],
    expirationDate: '',
    totalValue: 0,
    paymentTerms: 'Chuyển khoản 30 ngày',
    deliveryTerms: '',
    aiExecutiveSummary: '',
    status: 'Hiệu lực',
    notes: '',
    products: [],
    appendices: []
  });

  // Filtered contracts list
  const filteredContracts = useMemo(() => {
    return contractsData.filter(c => {
      if (activeTab === 'customer' && c.partnerType !== 'Khách hàng') return false;
      if (activeTab === 'supplier' && c.partnerType !== 'Nhà cung cấp') return false;
      
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        (c.contractNumber || '').toLowerCase().includes(query) ||
        (c.title || '').toLowerCase().includes(query) ||
        (c.partnerName || '').toLowerCase().includes(query) ||
        (c.contractType || '').toLowerCase().includes(query)
      );
    });
  }, [contractsData, activeTab, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const total = contractsData.length;
    const active = contractsData.filter(c => c.status === 'Hiệu lực').length;
    const totalVal = contractsData.reduce((acc, c) => acc + (parseNumber(c.totalValue) || 0), 0);
    const expiringSoon = contractsData.filter(c => {
      if (!c.expirationDate || c.status !== 'Hiệu lực') return false;
      const exp = new Date(parseDateToISO(c.expirationDate));
      const now = new Date();
      const diffDays = (exp.getTime() - now.getTime()) / (1000 * 3600 * 24);
      return diffDays >= 0 && diffDays <= 45;
    }).length;

    return { total, active, totalVal, expiringSoon };
  }, [contractsData]);

  // Reconciled OCR Products vs Pricing 2026
  const reconciledOcrProducts = useMemo(() => {
    if (!ocrContractResult || !ocrContractResult.products) return [];
    return ocrContractResult.products.map(p => {
      const matchedPricing = findPriceRecord(pricingData, {
        sku: p.productCode || p.productName,
        name: p.productName,
        customer: ocrContractResult.partnerName
      });
      const currentPrice = matchedPricing ? (parseNumber(matchedPricing['Đơn giá bán']) || parseNumber(matchedPricing['Đơn giá bán mới']) || parseNumber(matchedPricing['Giá bán'])) : 0;
      const contractPrice = parseNumber(p.contractPrice) || 0;
      const diff = currentPrice > 0 ? (contractPrice - currentPrice) : 0;
      const diffPct = currentPrice > 0 ? (diff / currentPrice) * 100 : 0;
      
      let matchStatus: 'exact' | 'higher' | 'lower' | 'new' = 'exact';
      if (!matchedPricing || currentPrice === 0) {
        matchStatus = 'new';
      } else if (Math.abs(diff) < 1) {
        matchStatus = 'exact';
      } else if (diff > 0) {
        matchStatus = 'higher';
      } else {
        matchStatus = 'lower';
      }

      return {
        ...p,
        matchedPricing,
        currentPrice,
        diff,
        diffPct,
        matchStatus
      };
    });
  }, [ocrContractResult, pricingData]);

  // Reconciled Selected Contract Products vs Pricing 2026
  const selectedContractReconciled = useMemo(() => {
    if (!selectedContract || !selectedContract.products) return [];
    return selectedContract.products.map(p => {
      const matchedPricing = findPriceRecord(pricingData, {
        sku: p.productCode || p.productName,
        name: p.productName,
        customer: selectedContract.partnerName
      });
      const currentPrice = matchedPricing ? (parseNumber(matchedPricing['Đơn giá bán']) || parseNumber(matchedPricing['Đơn giá bán mới']) || parseNumber(matchedPricing['Giá bán'])) : 0;
      const contractPrice = parseNumber(p.contractPrice) || 0;
      const diff = currentPrice > 0 ? (contractPrice - currentPrice) : 0;
      const diffPct = currentPrice > 0 ? (diff / currentPrice) * 100 : 0;
      
      let matchStatus: 'exact' | 'higher' | 'lower' | 'new' = 'exact';
      if (!matchedPricing || currentPrice === 0) {
        matchStatus = 'new';
      } else if (Math.abs(diff) < 1) {
        matchStatus = 'exact';
      } else if (diff > 0) {
        matchStatus = 'higher';
      } else {
        matchStatus = 'lower';
      }

      return {
        ...p,
        matchedPricing,
        currentPrice,
        diff,
        diffPct,
        matchStatus
      };
    });
  }, [selectedContract, pricingData]);

  // Load sample contract for rapid testing
  const handleLoadSampleContract = (sample: 'ThangLong' | 'ThanhHoa' | 'BacSon') => {
    if (sample === 'ThangLong') {
      setOcrContractResult({
        contractNumber: '177/HĐ-TLTL',
        title: 'Hợp đồng mua bán bao bì carton & vỏ hộp thuốc lá năm 2026',
        partnerName: 'Công ty TNHH MTV Thuốc lá Thăng Long',
        partnerType: 'Khách hàng',
        contractType: 'Bán hàng',
        signDate: '2026-01-15',
        effectiveDate: '2026-01-15',
        expirationDate: '2026-12-31',
        totalValue: 580000000,
        paymentTerms: 'Chuyển khoản trong vòng 30 ngày kể từ ngày nhận đủ hóa đơn GTGT hợp lệ',
        deliveryTerms: 'Giao hàng theo từng đợt tại kho bên mua - KCN Thạch Thất, Hà Nội',
        aiExecutiveSummary: `• Hợp đồng nguyên tắc cung ứng bao bì carton và vỏ hộp thuốc lá Thăng Long năm 2026.
• Đơn giá ký kết cố định trong 12 tháng, làm căn cứ áp bảng giá niêm yết Gsp_082.
• Điều khoản thanh toán 30 ngày chuyển khoản sau đối soát hóa đơn GTGT.
• Cam kết bảo hành chất lượng in ấn và định lượng giấy 100% theo tiêu chuẩn Specs ký duyệt.`,
        attachmentName: '177_HD_TLTL_2026_Signed.pdf',
        attachmentUrl: 'https://drive.google.com/drive/search?q=177/H%C4%90-TLTL',
        products: [
          { productCode: 'TH130/07', productName: 'Thùng carton Vỏ bao Thăng Long', unit: 'Thùng', contractPrice: 2700, quantity: 50000, notes: 'Quy cách sóng E, in offset 4 màu' },
          { productCode: 'TH25/07', productName: 'Thùng carton Bao cứng Thăng Long', unit: 'Thùng', contractPrice: 2500, quantity: 30000, notes: 'Quy cách carton 3 lớp' },
          { productCode: 'TH211/05', productName: 'Vỏ hộp Thuốc lá Thăng Long 20', unit: 'Hộp', contractPrice: 1800, quantity: 100000, notes: 'Giấy Ivory 300gsm' }
        ]
      });
      toast.success("Đã nạp mẫu Hợp đồng Thuốc lá Thăng Long (177/HĐ-TLTL)!");
    } else if (sample === 'ThanhHoa') {
      setOcrContractResult({
        contractNumber: '01/HĐ-TLTH',
        title: 'Hợp đồng kinh tế cung ứng nhãn bao & thùng carton',
        partnerName: 'Công ty Thuốc lá Thanh Hóa',
        partnerType: 'Khách hàng',
        contractType: 'Bán hàng',
        signDate: '2026-02-01',
        effectiveDate: '2026-02-01',
        expirationDate: '2026-12-31',
        totalValue: 340000000,
        paymentTerms: 'Thanh toán chuyển khoản sau 45 ngày kể từ ngày ký biên bản giao nhận PXK',
        deliveryTerms: 'Giao hàng tận kho Nhà máy Thuốc lá Thanh Hóa, TP. Thanh Hóa',
        aiExecutiveSummary: `• Hợp đồng cung ứng nhãn bao và thùng carton đóng gói cho các dòng sản phẩm thuốc lá Thanh Hóa.
• Cơ chế đơn giá đã bao gồm chi phí vận chuyển đến kho nhà máy Thanh Hóa.
• Thời hạn thanh toán 45 ngày; bên mua có quyền phạt 0.05%/ngày nếu bên bán giao chậm tiến độ PO.`,
        attachmentName: '01_HD_TLTH_2026_Scan.pdf',
        attachmentUrl: 'https://drive.google.com/drive/search?q=01/H%C4%90-TLTH',
        products: [
          { productCode: 'LGTTS-002-95', productName: 'Nhãn bao Thuốc lá Thanh Hóa', unit: 'Tờ', contractPrice: 450, quantity: 120000, notes: 'Giấy Couche 80gsm cán màng' },
          { productCode: 'TH25/07', productName: 'Thùng carton Thanh Hóa', unit: 'Thùng', contractPrice: 2700, quantity: 25000, notes: 'Thùng carton 5 lớp in Flexo' }
        ]
      });
      toast.success("Đã nạp mẫu Hợp đồng Thuốc lá Thanh Hóa (01/HĐ-TLTH)!");
    } else if (sample === 'BacSon') {
      setOcrContractResult({
        contractNumber: '102/HĐ2026-TLBS-TS',
        title: 'Hợp đồng mua bán thùng carton chịu lực Bắc Sơn',
        partnerName: 'Công ty Thuốc lá Bắc Sơn',
        partnerType: 'Khách hàng',
        contractType: 'Bán hàng',
        signDate: '2026-01-20',
        effectiveDate: '2026-01-20',
        expirationDate: '2027-01-20',
        totalValue: 420000000,
        paymentTerms: 'Thanh toán đợt theo từng lệnh PO trong vòng 15 ngày sau đối soát công nợ',
        deliveryTerms: 'Giao tại kho bên bán (FOB Kho TSG Hà Nội)',
        aiExecutiveSummary: `• Hợp đồng mua bán bao bì carton chịu lực 5 lớp đặc chủng cho nhà máy Bắc Sơn.
• Đơn giá tính theo xuất xưởng (FOB); bên mua tự chịu trách nhiệm điều xe vận tải.
• Đối soát công nợ định kỳ vào ngày 25 hàng tháng.`,
        attachmentName: '102_HD2026_TLBS_TS.pdf',
        attachmentUrl: 'https://drive.google.com/drive/search?q=102/H%C4%902026-TLBS-TS',
        products: [
          { productCode: 'TH130/07', productName: 'Thùng carton Bắc Sơn 5 lớp', unit: 'Thùng', contractPrice: 3200, quantity: 40000, notes: 'Sóng BC chịu nén >450kg' },
          { productCode: 'KN-01', productName: 'Khay chia ngăn carton Bắc Sơn', unit: 'Cái', contractPrice: 1100, quantity: 80000, notes: 'Mặt hàng mới cần bổ sung vào Bảng giá' }
        ]
      });
      toast.success("Đã nạp mẫu Hợp đồng Thuốc lá Bắc Sơn (102/HĐ2026-TLBS-TS)!");
    }
  };

  // Upload file OCR Contract
  const handleUploadContractFile = async (file: File) => {
    setIsOcrProcessing(true);
    const toastId = toast.loading("Gemini AI đang bóc tách Hợp đồng & Bảng giá...");
    try {
      const result = await processContractOCR(file);
      const contractNum = result.contractNumber || file.name.replace(/\.[^/.]+$/, "");
      const shortName = formatShortFileName('HD', contractNum, result.partnerName, file.name.endsWith('.pdf') ? 'pdf' : 'jpg');
      const { fullPath } = getDriveFolderPath(result.signDate || new Date(), '01_CONTRACTS');
      
      setOcrContractResult({
        ...result,
        attachmentName: shortName,
        attachmentUrl: `https://drive.google.com/drive/search?q=${encodeURIComponent(shortName)}`
      });

      // Đăng ký lưu trữ file vào thư mục Drive phân loại theo Năm / Tháng
      await registerAndUploadDriveDocument({
        file,
        type: 'HD',
        categoryKey: '01_CONTRACTS',
        docNumber: contractNum,
        partnerName: result.partnerName,
        date: result.signDate,
        customFileName: shortName
      });

      toast.success(`Đã bóc tách & lưu hồ sơ HĐ vào thư mục Drive (${fullPath})!`, { id: toastId });
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Không thể xử lý OCR Hợp đồng. Vui lòng thử lại.", { id: toastId });
    } finally {
      setIsOcrProcessing(false);
    }
  };

  // Save OCR Contract to Firestore & System
  const handleSaveOcrContract = async () => {
    if (!ocrContractResult || !ocrContractResult.contractNumber) {
      toast.error("Vui lòng quét hoặc nhập Số Hợp Đồng trước khi lưu!");
      return;
    }

    const contractNum = ocrContractResult.contractNumber || '';
    const shortName = ocrContractResult.attachmentName || formatShortFileName('HD', contractNum, ocrContractResult.partnerName, 'pdf');
    const { fullPath } = getDriveFolderPath(ocrContractResult.signDate, '01_CONTRACTS');

    const newContract: ContractItem = {
      contractNumber: contractNum,
      title: ocrContractResult.title || 'Hợp đồng mua bán hàng hóa',
      partnerName: ocrContractResult.partnerName || 'Chưa rõ đối tác',
      partnerType: ocrContractResult.partnerType || 'Khách hàng',
      contractType: ocrContractResult.contractType || 'Bán hàng',
      signDate: ocrContractResult.signDate || new Date().toISOString().split('T')[0],
      effectiveDate: ocrContractResult.effectiveDate || new Date().toISOString().split('T')[0],
      expirationDate: ocrContractResult.expirationDate || '',
      totalValue: ocrContractResult.totalValue || 0,
      paymentTerms: ocrContractResult.paymentTerms || 'Chuyển khoản 30 ngày',
      deliveryTerms: ocrContractResult.deliveryTerms || '',
      aiExecutiveSummary: ocrContractResult.aiExecutiveSummary || '',
      status: 'Hiệu lực',
      attachmentName: shortName,
      attachmentUrl: ocrContractResult.attachmentUrl || `https://drive.google.com/drive/search?q=${encodeURIComponent(shortName)}`,
      notes: `Lưu tại Google Drive: ${fullPath}`,
      products: ocrContractResult.products || [],
      appendices: []
    };

    if (onAddContract) {
      await onAddContract(newContract);
      toast.success(`Đã lưu Hợp đồng ${newContract.contractNumber} vào hệ thống & thư mục Drive!`);
      setSelectedContract(newContract);
      setIsOcrModalOpen(false);
    }
  };

  // Handle open Add/Edit Modal
  const handleOpenAdd = () => {
    setEditingContract(null);
    setFormData({
      contractNumber: `HĐ-${new Date().getFullYear()}/${Math.floor(100 + Math.random() * 900)}`,
      title: 'Hợp đồng mua bán hàng hóa nguyên vật liệu',
      partnerName: customerData[0]?.['Tên khách hàng'] || '',
      partnerType: 'Khách hàng',
      contractType: 'Bán hàng',
      signDate: new Date().toISOString().split('T')[0],
      effectiveDate: new Date().toISOString().split('T')[0],
      expirationDate: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().split('T')[0],
      totalValue: 0,
      paymentTerms: 'Thanh toán chuyển khoản trong vòng 30 ngày kể từ ngày giao hàng & xuất HĐ',
      status: 'Hiệu lực',
      notes: 'Hợp đồng làm căn cứ pháp lý đối chiếu giá mua bán với Kế toán',
      products: [
        { productCode: '', productName: '', unit: 'Thùng', contractPrice: 0, quantity: 1000 }
      ],
      appendices: []
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (contract: ContractItem) => {
    setEditingContract(contract);
    setFormData({
      ...contract,
      signDate: parseDateToISO(contract.signDate),
      effectiveDate: parseDateToISO(contract.effectiveDate),
      expirationDate: parseDateToISO(contract.expirationDate)
    });
    setIsModalOpen(true);
  };

  const handleSaveContract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.contractNumber || !formData.partnerName) {
      toast.error('Vui lòng nhập Số hợp đồng và Đối tác!');
      return;
    }

    try {
      const payload: ContractItem = {
        ...formData,
        id: editingContract?.id || `contract_${Date.now()}`,
        contractNumber: formData.contractNumber || '',
        title: formData.title || 'Hợp đồng kinh tế',
        partnerName: formData.partnerName || '',
        partnerType: formData.partnerType || 'Khách hàng',
        contractType: formData.contractType || 'Bán hàng',
        signDate: formData.signDate || '',
        effectiveDate: formData.effectiveDate || '',
        expirationDate: formData.expirationDate || '',
        totalValue: parseNumber(formData.totalValue),
        paymentTerms: formData.paymentTerms || '',
        deliveryTerms: formData.deliveryTerms || '',
        aiExecutiveSummary: formData.aiExecutiveSummary || '',
        status: formData.status || 'Hiệu lực',
        products: formData.products || [],
        appendices: formData.appendices || []
      };

      if (editingContract && onUpdateContract) {
        await onUpdateContract(payload);
        toast.success('Đã cập nhật Hợp đồng!');
      } else if (onAddContract) {
        await onAddContract(payload);
        toast.success('Đã thêm mới Hợp đồng thành công!');
      }

      setIsModalOpen(false);
    } catch (err: any) {
      console.error('Save contract error:', err);
      toast.error('Lỗi khi lưu hợp đồng!');
    }
  };

  const handleDelete = async (contract: ContractItem) => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa Hợp đồng ${contract.contractNumber}?`)) {
      if (onDeleteContract) {
        await onDeleteContract(contract);
        toast.success('Đã xóa Hợp đồng!');
        if (selectedContract?.id === contract.id) setSelectedContract(null);
      }
    }
  };

  // Add a product line in contract form
  const handleAddProductLine = () => {
    setFormData(prev => ({
      ...prev,
      products: [
        ...(prev.products || []),
        { productCode: '', productName: '', unit: 'Cái', contractPrice: 0, quantity: 0 }
      ]
    }));
  };

  // Remove a product line
  const handleRemoveProductLine = (idx: number) => {
    setFormData(prev => ({
      ...prev,
      products: (prev.products || []).filter((_, i) => i !== idx)
    }));
  };

  return (
    <div className="flex-1 bg-[#F5F5F7] flex flex-col min-h-full overflow-y-auto pb-24 lg:pb-8">
      {/* Top Header */}
      <div className="bg-white/80 backdrop-blur-md border-b border-black/[0.06] px-4 sm:px-6 lg:px-8 py-4 sm:py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-xs font-bold uppercase tracking-wider">
              Pháp lý & Bảng Giá
            </span>
            <h1 className="text-lg sm:text-xl font-bold text-[#1D1D1F] tracking-tight">Hợp Đồng & Phụ Lục Kinh Tế</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Quét OCR hợp đồng, tóm tắt điều khoản AI, trích xuất bảng đơn giá cam kết và đối chiếu chéo Bảng Giá 2026
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => {
              setIsOcrModalOpen(true);
              if (!ocrContractResult) handleLoadSampleContract('ThangLong');
            }}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 active:scale-95 transition-all"
          >
            <Sparkles size={15} className="animate-pulse" />
            <span>Quét OCR Hợp Đồng & Đối Chiếu Bảng Giá</span>
          </button>
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold shadow-2xs active:scale-95 transition-all"
          >
            <Plus size={15} />
            <span>Thêm HĐ</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="px-4 sm:px-6 lg:px-8 py-4 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-black/[0.06] shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1 sm:mb-2">
            <span className="truncate">Tổng Hợp đồng</span>
            <FileText size={16} className="text-blue-500 shrink-0" />
          </div>
          <p className="text-lg sm:text-xl lg:text-2xl font-bold text-[#1D1D1F]">{stats.total}</p>
          <span className="text-[10px] sm:text-[11px] text-slate-400">Đã lưu trong hệ thống</span>
        </div>

        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-black/[0.06] shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1 sm:mb-2">
            <span className="truncate">Đang Có Hiệu Lực</span>
            <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
          </div>
          <p className="text-lg sm:text-xl lg:text-2xl font-bold text-emerald-600">{stats.active}</p>
          <span className="text-[10px] sm:text-[11px] text-emerald-600/80">Căn cứ pháp lý chuẩn</span>
        </div>

        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-black/[0.06] shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1 sm:mb-2">
            <span className="truncate">Sắp Hết Hạn (&lt;45 ngày)</span>
            <Clock size={16} className="text-amber-500 shrink-0" />
          </div>
          <p className="text-lg sm:text-xl lg:text-2xl font-bold text-amber-600">{stats.expiringSoon}</p>
          <span className="text-[10px] sm:text-[11px] text-amber-600/80">Cần tái ký / lập phụ lục</span>
        </div>

        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-black/[0.06] shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1 sm:mb-2">
            <span className="truncate">Tổng Giá Trị Cam Kết</span>
            <DollarSign size={16} className="text-purple-500 shrink-0" />
          </div>
          <p className="text-base sm:text-lg lg:text-2xl font-bold text-purple-700 truncate" title={formatVND(stats.totalVal)}>{formatVND(stats.totalVal)}</p>
          <span className="text-[10px] sm:text-[11px] text-purple-600/80">Quy mô các hợp đồng</span>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 px-4 sm:px-6 lg:px-8 flex flex-col lg:flex-row gap-4 sm:gap-6 min-h-0">
        {/* Left: Contracts Table List */}
        <div className="flex-1 bg-white rounded-2xl border border-black/[0.06] shadow-2xs flex flex-col min-h-[400px] overflow-hidden">
          {/* Filter Bar */}
          <div className="p-3 sm:p-4 border-b border-black/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1 bg-[#F5F5F7] p-1 rounded-xl overflow-x-auto max-w-full">
              <button
                onClick={() => setActiveTab('all')}
                className={clsx(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                  activeTab === 'all' ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-900"
                )}
              >
                Tất cả ({contractsData.length})
              </button>
              <button
                onClick={() => setActiveTab('customer')}
                className={clsx(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                  activeTab === 'customer' ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-900"
                )}
              >
                HĐ Khách hàng
              </button>
              <button
                onClick={() => setActiveTab('supplier')}
                className={clsx(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                  activeTab === 'supplier' ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-900"
                )}
              >
                HĐ Nhà cung cấp
              </button>
            </div>

            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input
                type="text"
                placeholder="Tìm số HĐ, tên đối tác..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 bg-[#F5F5F7] border border-transparent rounded-xl text-xs focus:bg-white focus:border-blue-500 outline-none transition-all"
              />
            </div>
          </div>

          {/* Table / Cards Container */}
          <div className="flex-1 overflow-y-auto">
            {filteredContracts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400">
                <FileText size={48} className="mb-3 text-slate-300 stroke-[1.5]" />
                <p className="text-sm font-semibold text-slate-600">Chưa có Hợp đồng nào</p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">
                  Hãy bấm "Thêm Hợp Đồng Mới" hoặc quét OCR hợp đồng PDF/scan để nạp danh mục đơn giá đối chiếu
                </p>
                <button
                  onClick={handleOpenAdd}
                  className="mt-4 px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl text-xs font-bold transition-all"
                >
                  + Thêm Hợp Đồng Đầu Tiên
                </button>
              </div>
            ) : (
              <>
                {/* Mobile Cards Feed (Visible on sm:hidden) */}
                <div className="block sm:hidden p-3 space-y-3">
                  {filteredContracts.map((contract, index) => {
                    const isSelected = selectedContract?.id === contract.id;
                    return (
                      <div
                        key={contract.id || index}
                        onClick={() => {
                          setSelectedContract(contract);
                          setIsMobileDetailOpen(true);
                        }}
                        className={clsx(
                          "bg-white rounded-2xl p-4 border border-black/[0.06] shadow-xs active:scale-[0.99] transition-all cursor-pointer",
                          isSelected ? "ring-2 ring-blue-500/50 bg-blue-50/20" : ""
                        )}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2.5">
                          <div className="flex items-center gap-2.5">
                            <CompanyLogo name={contract.partnerName} size="sm" />
                            <div>
                              <h4 className="font-bold text-sm text-[#1D1D1F] leading-snug">{contract.partnerName}</h4>
                              <p className="font-mono text-xs text-blue-600 font-bold mt-0.5">{contract.contractNumber}</p>
                            </div>
                          </div>
                          <span className={clsx(
                            "px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 inline-flex items-center gap-1",
                            contract.status === 'Hiệu lực' ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                            contract.status === 'Hết hạn' ? "bg-red-50 text-red-700 border border-red-200" :
                            "bg-amber-50 text-amber-700 border border-amber-200"
                          )}>
                            <span className={clsx(
                              "w-1.5 h-1.5 rounded-full",
                              contract.status === 'Hiệu lực' ? "bg-emerald-500" :
                              contract.status === 'Hết hạn' ? "bg-red-500" : "bg-amber-500"
                            )} />
                            {contract.status}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 bg-[#F5F5F7] p-2.5 rounded-xl text-xs mb-3">
                          <div>
                            <span className="text-[10px] text-slate-500 block">Loại hợp đồng</span>
                            <span className="font-bold text-slate-800">{contract.contractType}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 block">Giá trị hợp đồng</span>
                            <span className="font-bold text-purple-700">
                              {contract.totalValue ? formatVND(contract.totalValue) : 'Theo đơn đặt'}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 block">Ngày ký</span>
                            <span className="font-medium text-slate-700">{formatDateForDisplay(contract.signDate)}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 block">Hết hạn</span>
                            <span className="font-medium text-slate-700">{formatDateForDisplay(contract.expirationDate) || 'Vô thời hạn'}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedContract(contract);
                              setIsMobileDetailOpen(true);
                            }}
                            className="text-blue-600 font-bold text-xs flex items-center gap-1 hover:underline"
                          >
                            Xem đối chiếu giá ({(contract.products || []).length} mục) &rarr;
                          </button>
                          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => handleOpenEdit(contract)}
                              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                              title="Sửa"
                            >
                              <Edit3 size={15} />
                            </button>
                            <button
                              onClick={() => handleDelete(contract)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                              title="Xóa"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop Table (Visible on sm and above) */}
                <table className="hidden sm:table w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-[#F5F5F7] text-slate-500 font-semibold border-b border-black/[0.06] z-10">
                    <tr>
                      <th className="py-3 px-4">Số Hợp Đồng</th>
                      <th className="py-3 px-4">Đối Tác</th>
                      <th className="py-3 px-4">Loại HĐ</th>
                      <th className="py-3 px-4">Ngày Ký</th>
                      <th className="py-3 px-4">Thời Hạn</th>
                      <th className="py-3 px-4 text-right">Giá Trị (VNĐ)</th>
                      <th className="py-3 px-4 text-center">Trạng Thái</th>
                      <th className="py-3 px-4 text-center">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.04]">
                    {filteredContracts.map((contract, index) => {
                      const isSelected = selectedContract?.id === contract.id;
                      return (
                        <tr
                          key={contract.id || index}
                          onClick={() => setSelectedContract(contract)}
                          className={clsx(
                            "hover:bg-blue-50/50 cursor-pointer transition-colors",
                            isSelected ? "bg-blue-50/70" : ""
                          )}
                        >
                          <td className="py-3 px-4 font-mono font-bold text-blue-600">
                            {contract.contractNumber}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <CompanyLogo name={contract.partnerName} size="sm" />
                              <div>
                                <p className="font-bold text-slate-900 truncate max-w-[180px]">{contract.partnerName}</p>
                                <span className="text-[10px] text-slate-400">{contract.partnerType}</span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium text-[11px]">
                              {contract.contractType}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            {formatDateForDisplay(contract.signDate)}
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            {formatDateForDisplay(contract.expirationDate) || 'Vô thời hạn'}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-slate-900">
                            {contract.totalValue ? formatVND(contract.totalValue) : 'Theo đơn đặt'}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={clsx(
                              "px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1",
                              contract.status === 'Hiệu lực' ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                              contract.status === 'Hết hạn' ? "bg-red-50 text-red-700 border border-red-200" :
                              "bg-amber-50 text-amber-700 border border-amber-200"
                            )}>
                              <span className={clsx(
                                "w-1.5 h-1.5 rounded-full",
                                contract.status === 'Hiệu lực' ? "bg-emerald-500" :
                                contract.status === 'Hết hạn' ? "bg-red-500" : "bg-amber-500"
                              )} />
                              {contract.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1" onClick={e => e.stopPropagation()}>
                              <button
                                onClick={() => handleOpenEdit(contract)}
                                className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                title="Chỉnh sửa"
                              >
                                <Edit3 size={14} />
                              </button>
                              <button
                                onClick={() => handleDelete(contract)}
                                className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                title="Xóa"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </div>

        {/* Right: Contract Detail & Price Matching Panel (Desktop Only, lg:flex) */}
        <div className="hidden lg:flex w-96 bg-white rounded-2xl border border-black/[0.06] shadow-2xs flex-col overflow-hidden">
          {selectedContract ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Detail Header */}
              <div className="p-4 border-b border-black/[0.06] bg-[#F5F5F7] flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Chi Tiết Hợp Đồng</span>
                  <h3 className="text-sm font-bold text-slate-900 font-mono mt-0.5">{selectedContract.contractNumber}</h3>
                </div>
                <button
                  onClick={() => handleOpenEdit(selectedContract)}
                  className="px-2.5 py-1 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold shadow-2xs transition-all flex items-center gap-1"
                >
                  <Edit3 size={12} />
                  Sửa
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {/* General Info */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Thông tin chung</h4>
                  <div className="bg-[#F5F5F7] p-3 rounded-xl space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Đối tác:</span>
                      <span className="font-bold text-slate-900 text-right">{selectedContract.partnerName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Loại hợp đồng:</span>
                      <span className="font-semibold text-slate-800">{selectedContract.contractType}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Ngày ký:</span>
                      <span className="font-medium text-slate-800">{formatDateForDisplay(selectedContract.signDate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Thời hạn:</span>
                      <span className="font-medium text-slate-800">
                        {formatDateForDisplay(selectedContract.effectiveDate)} ➔ {formatDateForDisplay(selectedContract.expirationDate) || 'Không thời hạn'}
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-slate-200/60 pt-2">
                      <span className="text-slate-500">Điều khoản TT:</span>
                      <span className="font-medium text-slate-800 text-right">{selectedContract.paymentTerms}</span>
                    </div>
                    {selectedContract.deliveryTerms && (
                      <div className="flex justify-between border-t border-slate-200/60 pt-2">
                        <span className="text-slate-500">Giao hàng:</span>
                        <span className="font-medium text-slate-800 text-right">{selectedContract.deliveryTerms}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* AI Executive Summary Box (Nội dung sơ bộ AI) */}
                {selectedContract.aiExecutiveSummary && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles size={13} className="text-indigo-600" />
                      <span>Tóm Tắt Sơ Bộ Bởi AI</span>
                    </h4>
                    <div className="bg-gradient-to-br from-indigo-50/80 via-blue-50/60 to-purple-50/40 border border-indigo-200/70 p-3.5 rounded-2xl text-xs text-slate-700 leading-relaxed whitespace-pre-line shadow-2xs">
                      {selectedContract.aiExecutiveSummary}
                    </div>
                  </div>
                )}

                {/* File Hợp Đồng Gốc (PDF Scan trên Google Drive) */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                    <span>Hồ Sơ Hợp Đồng Gốc (PDF)</span>
                    <span className="text-[9px] bg-rose-100 text-rose-800 font-bold px-1.5 py-0.5 rounded">DRIVE CLOUD</span>
                  </h4>
                  <div className="bg-rose-50/60 border border-rose-200/80 p-3 rounded-xl space-y-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                        <FileText size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-900 truncate" title={selectedContract.attachmentName || `${selectedContract.contractNumber}.pdf`}>
                          {selectedContract.attachmentName || `${selectedContract.contractNumber.replace(/\//g, '_')}_HopDongGoc.pdf`}
                        </p>
                        <span className="text-[10px] text-rose-700 font-medium block">
                          Thư mục: 📁 01_Hop_Dong_Goc_Va_Phu_Luc_PDF
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-1 border-t border-rose-200/50">
                      <a
                        href={selectedContract.attachmentUrl || `https://drive.google.com/drive/search?q=${encodeURIComponent(selectedContract.contractNumber)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-all shadow-xs"
                      >
                        <Eye size={13} />
                        <span>Mở PDF trên Drive</span>
                        <ArrowUpRight size={12} />
                      </a>
                      <button
                        onClick={() => {
                          const url = selectedContract.attachmentUrl || `https://drive.google.com/drive/search?q=${encodeURIComponent(selectedContract.contractNumber)}`;
                          navigator.clipboard.writeText(url);
                          toast.success("Đã sao chép đường dẫn file PDF trên Google Drive!");
                        }}
                        className="px-2.5 py-1.5 bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 rounded-lg text-[11px] font-semibold transition-all"
                        title="Sao chép link Drive"
                      >
                        Copy Link
                      </button>
                    </div>
                  </div>
                </div>

                {/* Price Table & Reconciliation in Contract */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Đơn Giá Ký & Đối Chiếu 2026</h4>
                    <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                      {selectedContractReconciled.length} mục
                    </span>
                  </div>

                  {selectedContractReconciled.length === 0 ? (
                    <div className="p-4 bg-slate-50 rounded-xl text-center text-xs text-slate-400 border border-dashed border-slate-200">
                      Chưa nhập danh mục đơn giá cam kết trong hợp đồng này.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {selectedContractReconciled.map((p, idx) => (
                        <div key={idx} className="p-3 bg-[#F5F5F7] rounded-xl border border-black/[0.04] space-y-2 text-xs">
                          <div className="flex justify-between items-start">
                            <span className="font-bold text-slate-900">{p.productName}</span>
                            <span className="font-bold text-blue-600 font-mono text-xs">{formatVND(p.contractPrice)}</span>
                          </div>
                          
                          {/* Cross-Check with Pricing 2026 */}
                          <div className="bg-white/80 p-2 rounded-lg border border-black/[0.04] flex items-center justify-between text-[11px]">
                            <span className="text-slate-500">Bảng giá 2026:</span>
                            {p.currentPrice > 0 ? (
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-slate-700 font-semibold">{formatVND(p.currentPrice)}</span>
                                <span className={clsx(
                                  "px-1.5 py-0.2 text-[9px] font-bold rounded",
                                  p.matchStatus === 'exact' ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                                  p.matchStatus === 'higher' ? "bg-amber-50 text-amber-700 border border-amber-200" :
                                  "bg-rose-50 text-rose-700 border border-rose-200"
                                )}>
                                  {p.matchStatus === 'exact' ? 'Khớp 100%' : (p.diff > 0 ? `+${p.diffPct.toFixed(1)}%` : `${p.diffPct.toFixed(1)}%`)}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded font-semibold">
                                Mặt hàng mới
                              </span>
                            )}
                          </div>

                          <div className="flex justify-between text-[11px] text-slate-400">
                            <span>ĐVT: {p.unit}</span>
                            {p.quantity ? <span>Số lượng: {p.quantity.toLocaleString('vi-VN')}</span> : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Appendices */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Phụ Lục Hợp Đồng</h4>
                    <span className="text-[10px] font-bold text-slate-500">
                      {(selectedContract.appendices || []).length} phụ lục
                    </span>
                  </div>

                  {(selectedContract.appendices || []).length === 0 ? (
                    <div className="p-3 bg-slate-50 rounded-xl text-center text-[11px] text-slate-400">
                      Không có phụ lục điều chỉnh giá
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {(selectedContract.appendices || []).map((app, idx) => (
                        <div key={idx} className="p-3 bg-amber-50/60 border border-amber-200/60 rounded-xl space-y-1 text-xs">
                          <div className="flex justify-between font-bold text-amber-900">
                            <span>{app.appendixNumber}</span>
                            <span className="text-[11px] font-normal text-amber-700">{formatDateForDisplay(app.signDate)}</span>
                          </div>
                          <p className="text-slate-700 text-[11px]">{app.title}</p>
                          {app.priceAdjustment && (
                            <span className="inline-block text-[10px] font-semibold text-emerald-700 bg-emerald-100/60 px-1.5 py-0.5 rounded">
                              {app.priceAdjustment}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-6 text-center text-slate-400">
              <FileText size={36} className="mb-2 text-slate-300 stroke-[1.5]" />
              <p className="text-xs font-bold text-slate-600">Chọn 1 Hợp Đồng</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                để xem chi tiết điều khoản, tóm tắt AI, bảng đơn giá đối chiếu và phụ lục
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Detail Modal Sheet */}
      {isMobileDetailOpen && selectedContract && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200 border border-black/[0.08]">
            <div className="px-5 py-4 border-b border-black/[0.06] flex items-center justify-between bg-[#F5F5F7]">
              <div className="flex items-center gap-3">
                <MacTrafficLights onClose={() => setIsMobileDetailOpen(false)} />
                <div className="h-4 w-px bg-black/[0.08]" />
                <h3 className="text-sm font-bold text-[#1D1D1F] flex items-center gap-2">
                  <FileText size={15} className="text-blue-600" />
                  Chi Tiết Hợp Đồng
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsMobileDetailOpen(false);
                  handleOpenEdit(selectedContract);
                }}
                className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-bold shadow-2xs flex items-center gap-1"
              >
                <Edit3 size={13} />
                Sửa
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 p-4 rounded-2xl text-center space-y-1">
                <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">Số Hợp Đồng</span>
                <p className="text-xl font-black text-blue-900 font-mono">
                  {selectedContract.contractNumber}
                </p>
                <span className="inline-block text-[11px] font-bold px-2 py-0.5 rounded bg-white/80 text-blue-800 border border-blue-200">
                  Trạng thái: {selectedContract.status}
                </span>
              </div>

              {/* AI Summary in Mobile */}
              {selectedContract.aiExecutiveSummary && (
                <div className="space-y-1.5">
                  <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-wider flex items-center gap-1">
                    <Sparkles size={12} />
                    Tóm Tắt Sơ Bộ Bởi AI
                  </h4>
                  <div className="bg-indigo-50/70 border border-indigo-200/70 p-3 rounded-xl text-xs text-slate-700 whitespace-pre-line leading-relaxed">
                    {selectedContract.aiExecutiveSummary}
                  </div>
                </div>
              )}

              <div className="bg-[#F5F5F7] p-4 rounded-2xl space-y-2.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Đối tác:</span>
                  <span className="font-bold text-slate-900 flex items-center gap-1.5">
                    <CompanyLogo name={selectedContract.partnerName} size="xs" />
                    {selectedContract.partnerName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Loại hợp đồng:</span>
                  <span className="font-semibold text-slate-800">{selectedContract.contractType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Ngày ký:</span>
                  <span className="font-medium text-slate-800">{formatDateForDisplay(selectedContract.signDate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Thời hạn:</span>
                  <span className="font-medium text-slate-800">
                    {formatDateForDisplay(selectedContract.effectiveDate)} ➔ {formatDateForDisplay(selectedContract.expirationDate) || 'Không thời hạn'}
                  </span>
                </div>
                <div className="flex justify-between border-t border-slate-200/60 pt-2">
                  <span className="text-slate-500">Điều khoản TT:</span>
                  <span className="font-medium text-slate-800 text-right">{selectedContract.paymentTerms}</span>
                </div>
              </div>

              {/* File Hợp Đồng Gốc (PDF Scan trên Google Drive) - Mobile */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                  <span>Hồ Sơ Hợp Đồng Gốc (PDF)</span>
                  <span className="text-[9px] bg-rose-100 text-rose-800 font-bold px-1.5 py-0.5 rounded">DRIVE CLOUD</span>
                </h4>
                <div className="bg-rose-50/60 border border-rose-200/80 p-3 rounded-2xl space-y-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <FileText size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-900 truncate">
                        {selectedContract.attachmentName || `${selectedContract.contractNumber.replace(/\//g, '_')}_HopDongGoc.pdf`}
                      </p>
                      <span className="text-[10px] text-rose-700 font-medium block">
                        Thư mục: 📁 01_Hop_Dong_Goc_Va_Phu_Luc_PDF
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-1 border-t border-rose-200/50">
                    <a
                      href={selectedContract.attachmentUrl || `https://drive.google.com/drive/search?q=${encodeURIComponent(selectedContract.contractNumber)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs"
                    >
                      <Eye size={14} />
                      <span>Xem File PDF Gốc</span>
                      <ArrowUpRight size={13} />
                    </a>
                  </div>
                </div>
              </div>

              {/* Price list in contract */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Bảng Đơn Giá Ký Kết & Đối Chiếu ({selectedContractReconciled.length} mục)
                </h4>
                {selectedContractReconciled.length === 0 ? (
                  <div className="p-3 bg-slate-50 rounded-xl text-center text-xs text-slate-400 border border-dashed border-slate-200">
                    Chưa nhập danh mục đơn giá cam kết trong hợp đồng này.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto">
                    {selectedContractReconciled.map((p, idx) => (
                      <div key={idx} className="p-3 bg-[#F5F5F7] rounded-xl border border-black/[0.04] space-y-1.5 text-xs">
                        <div className="flex justify-between items-center">
                          <p className="font-bold text-slate-900">{p.productName}</p>
                          <span className="font-bold text-blue-600 font-mono">{formatVND(p.contractPrice)}</span>
                        </div>
                        <div className="flex justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/40">
                          <span>Bảng giá 2026: {p.currentPrice ? formatVND(p.currentPrice) : 'Mới'}</span>
                          <span className={clsx(
                            "font-bold",
                            p.matchStatus === 'exact' ? "text-emerald-600" :
                            p.matchStatus === 'higher' ? "text-amber-600" : "text-rose-600"
                          )}>
                            {p.matchStatus === 'exact' ? '✓ Khớp' : `${p.diff > 0 ? '+' : ''}${p.diffPct.toFixed(1)}%`}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Appendices in Mobile */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Phụ Lục Hợp Đồng ({(selectedContract.appendices || []).length})
                </h4>
                {(selectedContract.appendices || []).length === 0 ? (
                  <div className="p-2.5 bg-slate-50 rounded-xl text-center text-[11px] text-slate-400">
                    Không có phụ lục điều chỉnh giá
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(selectedContract.appendices || []).map((app, idx) => (
                      <div key={idx} className="p-2.5 bg-amber-50/60 border border-amber-200/60 rounded-xl space-y-1 text-xs">
                        <div className="flex justify-between font-bold text-amber-900">
                          <span>{app.appendixNumber}</span>
                          <span className="text-[10px] font-normal text-amber-700">{formatDateForDisplay(app.signDate)}</span>
                        </div>
                        <p className="text-slate-700 text-[11px]">{app.title}</p>
                        {app.priceAdjustment && (
                          <span className="inline-block text-[10px] font-semibold text-emerald-700 bg-emerald-100/60 px-1.5 py-0.5 rounded">
                            {app.priceAdjustment}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setIsMobileDetailOpen(false)}
                className="w-full py-3 bg-[#007AFF] text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 active:scale-[0.98] transition-all"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Contract Modal - Apple macOS Window Style */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-black/[0.08] max-h-[90vh] flex flex-col">
            {/* Apple Header */}
            <div className="px-6 py-4 border-b border-black/[0.06] flex items-center justify-between bg-[#F5F5F7] shrink-0">
              <div className="flex items-center gap-3">
                <MacTrafficLights onClose={() => setIsModalOpen(false)} />
                <div className="h-4 w-px bg-black/[0.08]" />
                <h3 className="text-sm font-bold text-[#1D1D1F] flex items-center gap-2">
                  <FileText size={16} className="text-blue-600" />
                  {editingContract ? 'Cập Nhật Hợp Đồng' : 'Thêm Hợp Đồng Mới'}
                </h3>
              </div>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveContract} className="flex-1 overflow-auto p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Số Hợp Đồng *</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: 01/2026/HĐMB-TSG"
                    value={formData.contractNumber || ''}
                    onChange={e => setFormData({ ...formData, contractNumber: e.target.value })}
                    className="w-full px-3.5 py-2 bg-[#F5F5F7] border border-slate-200 rounded-xl text-xs font-mono font-bold focus:bg-white focus:border-blue-500 outline-none transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Trích yếu / Tiêu đề</label>
                  <input
                    type="text"
                    placeholder="Hợp đồng mua bán nguyên vật liệu..."
                    value={formData.title || ''}
                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3.5 py-2 bg-[#F5F5F7] border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-blue-500 outline-none transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Đối Tác (Khách / NCC) *</label>
                  <input
                    type="text"
                    required
                    list="partner-list"
                    placeholder="Chọn hoặc nhập tên đối tác"
                    value={formData.partnerName || ''}
                    onChange={e => setFormData({ ...formData, partnerName: e.target.value })}
                    className="w-full px-3.5 py-2 bg-[#F5F5F7] border border-slate-200 rounded-xl text-xs font-bold focus:bg-white focus:border-blue-500 outline-none transition-all"
                  />
                  <datalist id="partner-list">
                    {customerData.map((c, i) => (
                      <option key={`c-${i}`} value={c['Tên khách hàng'] || c['Khách hàng']} />
                    ))}
                    {supplierData.map((s, i) => (
                      <option key={`s-${i}`} value={s['Tên nhà cung cấp'] || s['Nhà cung cấp']} />
                    ))}
                  </datalist>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Phân Loại</label>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={formData.partnerType || 'Khách hàng'}
                      onChange={e => setFormData({ ...formData, partnerType: e.target.value as any })}
                      className="px-3 py-2 bg-[#F5F5F7] border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-blue-500 outline-none transition-all"
                    >
                      <option value="Khách hàng">Khách hàng</option>
                      <option value="Nhà cung cấp">Nhà cung cấp</option>
                    </select>
                    <select
                      value={formData.contractType || 'Bán hàng'}
                      onChange={e => setFormData({ ...formData, contractType: e.target.value as any })}
                      className="px-3 py-2 bg-[#F5F5F7] border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-blue-500 outline-none transition-all"
                    >
                      <option value="Bán hàng">Bán hàng</option>
                      <option value="Mua hàng">Mua hàng</option>
                      <option value="Nguyên tắc">Nguyên tắc</option>
                      <option value="Gia công">Gia công</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Ngày Ký</label>
                  <input
                    type="date"
                    value={formData.signDate || ''}
                    onChange={e => setFormData({ ...formData, signDate: e.target.value })}
                    className="w-full px-3.5 py-2 bg-[#F5F5F7] border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-blue-500 outline-none transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Ngày Hết Hạn</label>
                  <input
                    type="date"
                    value={formData.expirationDate || ''}
                    onChange={e => setFormData({ ...formData, expirationDate: e.target.value })}
                    className="w-full px-3.5 py-2 bg-[#F5F5F7] border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-blue-500 outline-none transition-all"
                  />
                </div>
              </div>

              {/* File Hợp Đồng Gốc (PDF) Lưu Trên Google Drive */}
              <div className="border-t border-slate-200 pt-4 space-y-2">
                <label className="text-xs font-bold text-slate-900 uppercase flex items-center gap-1.5">
                  <FileText size={15} className="text-rose-600" />
                  File Hợp Đồng Gốc PDF (Lưu trữ Google Drive)
                </label>
                <p className="text-[11px] text-slate-500">
                  Tải lên file scan PDF hoặc nhập link Google Drive trong thư mục <code>01_Hop_Dong_Goc_Va_Phu_Luc_PDF</code> để đối chiếu chéo khi xuất đơn & kiểm tra bảng giá.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <input
                      type="text"
                      placeholder="Tên file scan (VD: 01_2026_HDMB_ThangLong.pdf)"
                      value={formData.attachmentName || ''}
                      onChange={e => setFormData({ ...formData, attachmentName: e.target.value })}
                      className="w-full px-3.5 py-2 bg-[#F5F5F7] border border-slate-200 rounded-xl text-xs font-mono focus:bg-white focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <input
                      type="url"
                      placeholder="Link Google Drive (VD: https://drive.google.com/file/d/...)"
                      value={formData.attachmentUrl || ''}
                      onChange={e => setFormData({ ...formData, attachmentUrl: e.target.value })}
                      className="w-full px-3.5 py-2 bg-[#F5F5F7] border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-blue-500 outline-none"
                    />
                  </div>
                </div>
                {/* Drag & Drop or Browse file */}
                <div className="flex items-center gap-3 pt-1">
                  <label className="cursor-pointer px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border border-rose-200/60">
                    <Paperclip size={14} />
                    <span>Chọn File PDF từ máy tính</span>
                    <input
                      type="file"
                      accept=".pdf,application/pdf"
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setFormData(prev => ({
                            ...prev,
                            attachmentName: file.name,
                            attachmentUrl: prev.attachmentUrl || `https://drive.google.com/drive/search?q=${encodeURIComponent(file.name)}`
                          }));
                          toast.success(`Đã đính kèm file: ${file.name}`);
                        }
                      }}
                    />
                  </label>
                  {formData.attachmentName && (
                    <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                      <CheckCircle2 size={13} />
                      {formData.attachmentName}
                    </span>
                  )}
                </div>
              </div>

              {/* Product Pricing Section in Contract */}
              <div className="border-t border-slate-200 pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 uppercase">Danh Mục Sản Phẩm & Đơn Giá Cam Kết</h4>
                    <p className="text-[11px] text-slate-500">Căn cứ để kế toán đối chiếu chéo khi xuất hóa đơn & nhận PO</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddProductLine}
                    className="px-3 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                  >
                    <Plus size={14} />
                    Thêm Hàng Hóa
                  </button>
                </div>

                <div className="space-y-2">
                  {(formData.products || []).map((prod, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 bg-[#F5F5F7] p-3 rounded-xl items-center">
                      <div className="col-span-5">
                        <input
                          type="text"
                          placeholder="Tên sản phẩm / quy cách"
                          value={prod.productName}
                          onChange={e => {
                            const newProducts = [...(formData.products || [])];
                            newProducts[idx].productName = e.target.value;
                            setFormData({ ...formData, products: newProducts });
                          }}
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold outline-none"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="text"
                          placeholder="ĐVT (Thùng/Cái)"
                          value={prod.unit}
                          onChange={e => {
                            const newProducts = [...(formData.products || [])];
                            newProducts[idx].unit = e.target.value;
                            setFormData({ ...formData, products: newProducts });
                          }}
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none text-center"
                        />
                      </div>
                      <div className="col-span-4">
                        <input
                          type="number"
                          placeholder="Đơn giá (VNĐ)"
                          value={prod.contractPrice || ''}
                          onChange={e => {
                            const newProducts = [...(formData.products || [])];
                            newProducts[idx].contractPrice = parseFloat(e.target.value) || 0;
                            setFormData({ ...formData, products: newProducts });
                          }}
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-blue-600 outline-none text-right"
                        />
                      </div>
                      <div className="col-span-1 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveProductLine(idx)}
                          className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-[#007AFF] hover:bg-[#0062CC] text-white rounded-xl text-xs font-bold shadow-sm shadow-blue-500/20 active:scale-95 transition-all"
                >
                  Lưu Hợp Đồng
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI Contract OCR & Price Cross-Reference Modal */}
      {isOcrModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl overflow-hidden animate-in zoom-in-95 duration-200 border border-black/[0.08] max-h-[92vh] flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-black/[0.06] flex items-center justify-between bg-[#F5F5F7] shrink-0">
              <div className="flex items-center gap-3">
                <MacTrafficLights onClose={() => setIsOcrModalOpen(false)} />
                <div className="h-4 w-px bg-black/[0.08]" />
                <h3 className="text-sm font-bold text-[#1D1D1F] flex items-center gap-2">
                  <Sparkles size={16} className="text-blue-600" />
                  <span>Quét OCR Hợp Đồng & Đối Chiếu Bảng Giá (Gemini AI)</span>
                </h3>
              </div>
              <span className="text-[11px] font-semibold bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full border border-blue-200/50">
                Tự động bóc tách + Tóm tắt AI + Đối chiếu 2026
              </span>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
              {/* Top: Upload Area & Quick Samples */}
              <div className="bg-[#F5F5F7] p-4 rounded-2xl border border-black/[0.04] space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                      <Camera size={14} className="text-blue-600" />
                      Nạp Chứng Từ Hợp Đồng / Phụ Lục (PDF Scan hoặc Ảnh)
                    </span>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Hệ thống tự động quét số HĐ, đối tác, điều khoản, tóm tắt sơ bộ AI và đối chiếu chéo đơn giá với Bảng Giá 2026.
                    </p>
                  </div>

                  {/* Sample test buttons */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-bold text-slate-400">Mẫu thử:</span>
                    <button
                      type="button"
                      onClick={() => handleLoadSampleContract('ThangLong')}
                      className="px-2.5 py-1 bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-[11px] font-bold transition-all shadow-2xs"
                    >
                      HĐ Thăng Long 177
                    </button>
                    <button
                      type="button"
                      onClick={() => handleLoadSampleContract('ThanhHoa')}
                      className="px-2.5 py-1 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-[11px] font-bold transition-all shadow-2xs"
                    >
                      HĐ Thanh Hóa 01
                    </button>
                    <button
                      type="button"
                      onClick={() => handleLoadSampleContract('BacSon')}
                      className="px-2.5 py-1 bg-white hover:bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-[11px] font-bold transition-all shadow-2xs"
                    >
                      HĐ Bắc Sơn 102
                    </button>
                  </div>
                </div>

                {/* Dropzone */}
                <label className="border-2 border-dashed border-slate-300 hover:border-blue-500 bg-white/70 hover:bg-blue-50/30 rounded-2xl p-4 flex flex-col items-center justify-center cursor-pointer transition-all">
                  <input
                    type="file"
                    accept=".pdf,application/pdf,image/*"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) handleUploadContractFile(file);
                    }}
                  />
                  {isOcrProcessing ? (
                    <div className="flex items-center gap-2 text-blue-600 font-bold text-xs py-2">
                      <Loader2 size={18} className="animate-spin" />
                      <span>Gemini AI đang bóc tách điều khoản và đối chiếu giá...</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 text-slate-600 text-xs py-1">
                      <Upload size={18} className="text-blue-600" />
                      <span>Kéo thả file PDF Hợp đồng / Ảnh scan hoặc <strong>Bấm vào đây để chọn tệp</strong></span>
                    </div>
                  )}
                </label>
              </div>

              {/* Display Result in 3 Connected Sections */}
              {ocrContractResult && (
                <div className="space-y-5">
                  {/* Grid 2 Columns: Col 1 = Contract Info & AI Summary | Col 2 = Products & Price Cross-Check */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                    
                    {/* Left: Column 1 - Legal Info & AI Executive Summary (5 cols) */}
                    <div className="lg:col-span-5 space-y-4">
                      {/* Legal Summary Card */}
                      <div className="bg-white p-4 rounded-2xl border border-black/[0.06] shadow-2xs space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Thông Tin Pháp Lý</span>
                          <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                            {ocrContractResult.contractNumber || 'Chưa rõ số HĐ'}
                          </span>
                        </div>

                        <div className="space-y-2 text-xs">
                          <div>
                            <span className="text-[11px] text-slate-500 block">Tiêu đề hợp đồng:</span>
                            <span className="font-bold text-slate-900 leading-snug">{ocrContractResult.title || 'Hợp đồng mua bán'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Đối tác:</span>
                            <span className="font-bold text-slate-900 text-right">{ocrContractResult.partnerName}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 bg-[#F5F5F7] p-2.5 rounded-xl">
                            <div>
                              <span className="text-[10px] text-slate-500 block">Ngày ký</span>
                              <span className="font-semibold text-slate-800">{formatDateForDisplay(ocrContractResult.signDate)}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-500 block">Thời hạn</span>
                              <span className="font-semibold text-slate-800">{formatDateForDisplay(ocrContractResult.expirationDate) || '12 Tháng'}</span>
                            </div>
                          </div>
                          <div className="bg-[#F5F5F7] p-2.5 rounded-xl space-y-1">
                            <span className="text-[10px] text-slate-500 block">Điều khoản thanh toán:</span>
                            <p className="font-medium text-slate-800 text-[11px] leading-relaxed">{ocrContractResult.paymentTerms}</p>
                          </div>
                        </div>
                      </div>

                      {/* AI Executive Summary Card */}
                      <div className="bg-gradient-to-br from-indigo-50/90 via-blue-50/70 to-purple-50/50 p-4 rounded-2xl border border-indigo-200/80 shadow-2xs space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                            <Bot size={15} className="text-indigo-600" />
                            <span>Tóm Tắt Sơ Bộ Bởi AI</span>
                          </span>
                          <span className="text-[10px] font-bold bg-indigo-200/60 text-indigo-800 px-2 py-0.5 rounded-full">
                            Gemini 2.5
                          </span>
                        </div>
                        <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-line bg-white/70 p-3 rounded-xl border border-indigo-100">
                          {ocrContractResult.aiExecutiveSummary || 'Đang phân tích điều khoản hợp đồng...'}
                        </div>
                      </div>
                    </div>

                    {/* Right: Column 2 & 3 - Product Pricing Extracted & Reconciliation Table (7 cols) */}
                    <div className="lg:col-span-7 space-y-4">
                      {/* Extracted Product Pricing & Reconciliation */}
                      <div className="bg-white p-4 rounded-2xl border border-black/[0.06] shadow-2xs space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                          <div>
                            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                              <Scale size={14} className="text-emerald-600" />
                              <span>Bảng Đơn Giá & Đối Chiếu Bảng Giá 2026</span>
                            </h4>
                            <p className="text-[11px] text-slate-500">So sánh đơn giá ký kết với Bảng giá hiện hành</p>
                          </div>
                          <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                            {reconciledOcrProducts.length} mặt hàng
                          </span>
                        </div>

                        {/* Comparison Table */}
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-[#F5F5F7] text-slate-500 font-semibold border-b border-black/[0.06]">
                                <th className="py-2.5 px-3">Mặt hàng & Quy cách</th>
                                <th className="py-2.5 px-2 text-center">ĐVT</th>
                                <th className="py-2.5 px-3 text-right">Giá Hợp Đồng</th>
                                <th className="py-2.5 px-3 text-right">Bảng Giá 2026</th>
                                <th className="py-2.5 px-2 text-center">Đối Chiếu</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-black/[0.04]">
                              {reconciledOcrProducts.map((item, idx) => (
                                <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                                  <td className="py-3 px-3">
                                    <p className="font-bold text-slate-900">{item.productName}</p>
                                    <span className="font-mono text-[10px] text-slate-400">{item.productCode || item.notes || 'Quy cách chuẩn'}</span>
                                  </td>
                                  <td className="py-3 px-2 text-center text-slate-600 font-medium">{item.unit}</td>
                                  <td className="py-3 px-3 text-right font-mono font-bold text-blue-700">
                                    {formatVND(item.contractPrice)}
                                  </td>
                                  <td className="py-3 px-3 text-right font-mono text-slate-700">
                                    {item.currentPrice > 0 ? (
                                      <span className="font-semibold">{formatVND(item.currentPrice)}</span>
                                    ) : (
                                      <span className="text-[10px] text-slate-400 italic">Chưa niêm yết</span>
                                    )}
                                  </td>
                                  <td className="py-3 px-2 text-center">
                                    {item.matchStatus === 'exact' ? (
                                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                        <Check size={11} /> Khớp 100%
                                      </span>
                                    ) : item.matchStatus === 'higher' ? (
                                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                        +{item.diffPct.toFixed(1)}% (Cao hơn)
                                      </span>
                                    ) : item.matchStatus === 'lower' ? (
                                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                                        {item.diffPct.toFixed(1)}% (Thấp hơn)
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                                        Mặt hàng mới
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Note & Drive Link */}
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/60 flex items-center justify-between text-xs text-slate-600">
                          <div className="flex items-center gap-2">
                            <FileText size={15} className="text-rose-600" />
                            <span>File lưu trữ: <strong>{ocrContractResult.attachmentName || 'HopDong_Scan.pdf'}</strong> (Thư mục 📁 01_Hop_Dong_Goc_Va_Phu_Luc_PDF)</span>
                          </div>
                          <a
                            href={ocrContractResult.attachmentUrl || `https://drive.google.com/drive/search?q=${encodeURIComponent(ocrContractResult.contractNumber || '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 font-bold text-xs flex items-center gap-1 hover:underline"
                          >
                            <span>Drive PDF</span>
                            <ArrowUpRight size={12} />
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="px-6 py-4 border-t border-black/[0.06] bg-[#F5F5F7] flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => setIsOcrModalOpen(false)}
                className="px-4 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Đóng
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveOcrContract}
                  className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 active:scale-95 transition-all flex items-center gap-1.5"
                >
                  <CheckSquare size={14} />
                  <span>Lưu Hợp Đồng & Bảng Giá Vào Hệ Thống</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
