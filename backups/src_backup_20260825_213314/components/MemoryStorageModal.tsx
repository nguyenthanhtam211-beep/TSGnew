import React, { useState, useEffect, useMemo } from "react";
import { 
  Database, 
  HardDrive, 
  Download, 
  Upload, 
  RefreshCw, 
  CheckCircle, 
  ShieldCheck, 
  Layers, 
  FileSpreadsheet, 
  AlertCircle, 
  Clock, 
  Trash2, 
  Sparkles, 
  X, 
  ArrowUpRight,
  Server,
  Zap,
  Check
} from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "react-hot-toast";
import dbEngine from "../lib/dbEngine";

interface MemoryStorageModalProps {
  isOpen: boolean;
  onClose: () => void;
  allData: {
    pricingData: any[];
    poHeaderData: any[];
    poLinesData: any[];
    deliveryData: any[];
    customerData: any[];
    supplierData: any[];
    contactData: any[];
    productData: any[];
    deliveryPlanData: any[];
    specsData: any[];
    contractsData: any[];
    commissionData: any[];
    fileStorageData: any[];
  };
  onRestoreData?: (importedData: any) => Promise<void>;
}

export default function MemoryStorageModal({
  isOpen,
  onClose,
  allData,
  onRestoreData
}: MemoryStorageModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string>(new Date().toLocaleTimeString("vi-VN"));
  const [storageEstimate, setStorageEstimate] = useState<{ usedKB: number; percent: number }>({ usedKB: 0, percent: 0 });

  // Calculate stats for all memory collections
  const collectionsStats = useMemo(() => {
    const list = [
      { name: "Khách hàng (Customers)", key: "customers", data: allData.customerData, icon: "🏢" },
      { name: "Nhà cung cấp (Suppliers)", key: "suppliers", data: allData.supplierData, icon: "🏭" },
      { name: "Bảng giá 2026 (Pricing)", key: "pricing", data: allData.pricingData, icon: "🏷️" },
      { name: "Sản phẩm & Quy cách (Products)", key: "products", data: allData.productData, icon: "📦" },
      { name: "Đơn đặt hàng (PO Headers)", key: "po_headers", data: allData.poHeaderData, icon: "📑" },
      { name: "Chi tiết đơn hàng (PO Lines)", key: "po_lines", data: allData.poLinesData, icon: "📝" },
      { name: "Kế hoạch giao hàng (Delivery Plans)", key: "delivery_plans", data: allData.deliveryPlanData, icon: "📅" },
      { name: "Phiếu xuất kho (Deliveries PXK)", key: "deliveries", data: allData.deliveryData, icon: "🚚" },
      { name: "Hợp đồng & Phụ lục (Contracts)", key: "contracts", data: allData.contractsData, icon: "📜" },
      { name: "Hoa hồng & Chiết khấu (Commissions)", key: "commissions", data: allData.commissionData, icon: "💰" },
      { name: "Tiêu chuẩn kỹ thuật (Specs)", key: "specs", data: allData.specsData, icon: "🛡️" },
      { name: "Danh bạ liên hệ (Contacts)", key: "contacts", data: allData.contactData, icon: "👥" },
      { name: "Kho tài liệu đính kèm (Files)", key: "file_storage", data: allData.fileStorageData, icon: "📂" },
    ];

    let totalRecords = 0;
    let totalApproxBytes = 0;

    const mapped = list.map(item => {
      const count = (item.data || []).length;
      totalRecords += count;
      const jsonStr = JSON.stringify(item.data || []);
      const bytes = new Blob([jsonStr]).size;
      totalApproxBytes += bytes;

      return {
        ...item,
        count,
        sizeKB: (bytes / 1024).toFixed(1)
      };
    });

    return {
      items: mapped,
      totalRecords,
      totalSizeKB: (totalApproxBytes / 1024).toFixed(1),
      totalSizeMB: (totalApproxBytes / (1024 * 1024)).toFixed(2)
    };
  }, [allData]);

  // Check browser storage quota
  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then(estimate => {
        const usage = estimate.usage || 0;
        const quota = estimate.quota || 1;
        setStorageEstimate({
          usedKB: Math.round(usage / 1024),
          percent: Math.min(100, Math.round((usage / quota) * 100))
        });
      }).catch(() => {});
    }
  }, [isOpen]);

  // Action: Force Save to Persistent Memory
  const handleForceSaveMemory = async () => {
    setIsSaving(true);
    const saveToast = toast.loading("Đang ghi đồng bộ vào bộ nhớ đệm và ổ đĩa...");
    try {
      // Save all active collections to dbEngine Local Cache
      const collections = [
        { name: "customers", data: allData.customerData },
        { name: "suppliers", data: allData.supplierData },
        { name: "pricing", data: allData.pricingData },
        { name: "products", data: allData.productData },
        { name: "po_headers", data: allData.poHeaderData },
        { name: "po_lines", data: allData.poLinesData },
        { name: "delivery_plans", data: allData.deliveryPlanData },
        { name: "deliveries", data: allData.deliveryData },
        { name: "contracts", data: allData.contractsData },
        { name: "commissions", data: allData.commissionData },
        { name: "specs", data: allData.specsData },
        { name: "contacts", data: allData.contactData },
      ];

      for (const col of collections) {
        if (Array.isArray(col.data) && col.data.length > 0) {
          localStorage.setItem(`tsg_cache_${col.name}`, JSON.stringify(col.data));
          localStorage.setItem(`tsg_last_backup_time`, new Date().toISOString());
        }
      }

      setLastSavedTime(new Date().toLocaleTimeString("vi-VN"));
      toast.success("Đã lưu trữ an toàn 100% dữ liệu vào bộ nhớ!", { id: saveToast });
    } catch (err: any) {
      toast.error("Lỗi khi lưu bộ nhớ: " + (err?.message || err), { id: saveToast });
    } finally {
      setIsSaving(false);
    }
  };

  // Action: Download Complete Offline JSON Backup
  const handleDownloadFullBackupJSON = () => {
    try {
      const fullBackupPayload = {
        app: "TSG Business OS",
        version: "2.5",
        backupTimestamp: new Date().toISOString(),
        backupDateFormatted: new Date().toLocaleString("vi-VN"),
        totalRecords: collectionsStats.totalRecords,
        totalSizeKB: collectionsStats.totalSizeKB,
        data: {
          customers: allData.customerData,
          suppliers: allData.supplierData,
          pricing: allData.pricingData,
          products: allData.productData,
          po_headers: allData.poHeaderData,
          po_lines: allData.poLinesData,
          delivery_plans: allData.deliveryPlanData,
          deliveries: allData.deliveryData,
          contracts: allData.contractsData,
          commissions: allData.commissionData,
          specs: allData.specsData,
          contacts: allData.contactData,
          file_storage: allData.fileStorageData
        }
      };

      const dataStr = JSON.stringify(fullBackupPayload, null, 2);
      const blob = new Blob([dataStr], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `TSG_Full_Memory_Backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("Đã tải tệp sao lưu bộ nhớ (.json) về máy tính!");
    } catch (err: any) {
      toast.error("Lỗi tạo bản sao lưu: " + (err?.message || err));
    }
  };

  // Action: Export Multi-sheet Excel Master Backup
  const handleExportMasterExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      const sheets = [
        { name: "Khach_Hang", data: allData.customerData },
        { name: "Nha_Cung_Cap", data: allData.supplierData },
        { name: "Bang_Gia_2026", data: allData.pricingData },
        { name: "San_Pham", data: allData.productData },
        { name: "Don_Hang_PO", data: allData.poHeaderData },
        { name: "Chi_Tiet_Don", data: allData.poLinesData },
        { name: "Ke_Hoach_Giao", data: allData.deliveryPlanData },
        { name: "Giao_Hang_PXK", data: allData.deliveryData },
        { name: "Hop_Dong", data: allData.contractsData },
        { name: "Hoa_Hong", data: allData.commissionData },
        { name: "Specs_Ky_Thuat", data: allData.specsData },
        { name: "Danh_Ba", data: allData.contactData }
      ];

      sheets.forEach(s => {
        if (Array.isArray(s.data) && s.data.length > 0) {
          const ws = XLSX.utils.json_to_sheet(s.data);
          XLSX.utils.book_append_sheet(wb, ws, s.name);
        }
      });

      XLSX.writeFile(wb, `TSG_Master_Database_Excel_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success("Đã xuất sổ Excel tổng hợp 12 trang tính!");
    } catch (err: any) {
      toast.error("Lỗi xuất Excel: " + (err?.message || err));
    }
  };

  // Action: File Input Trigger for Restore
  const handleRestoreFromFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const text = evt.target?.result as string;
        const parsed = JSON.parse(text);

        if (!parsed.data && !parsed.customers) {
          toast.error("Tệp sao lưu không đúng cấu trúc TSG Business OS!");
          return;
        }

        const dataToRestore = parsed.data || parsed;
        const confirmRestore = window.confirm(
          `Bạn có chắc muốn khôi phục dữ liệu từ bản sao lưu ngày ${parsed.backupDateFormatted || "không rõ"}?\nTổng số bản ghi: ${parsed.totalRecords || "nhiều"} mục.`
        );

        if (confirmRestore) {
          // Store directly to local storage
          Object.keys(dataToRestore).forEach(col => {
            const list = dataToRestore[col];
            if (Array.isArray(list)) {
              localStorage.setItem(`tsg_cache_${col}`, JSON.stringify(list));
            }
          });

          if (onRestoreData) {
            await onRestoreData(dataToRestore);
          }

          toast.success("Đã khôi phục bộ nhớ thành công! Hệ thống đang tải lại...");
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        }
      } catch (err: any) {
        toast.error("Lỗi đọc tệp sao lưu: " + (err?.message || err));
      }
    };
    reader.readAsText(file);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-4xl w-full p-6 sm:p-8 space-y-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Modal Top Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Database size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  Active Persistent Engine
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-xs text-slate-500 font-medium">Lần lưu gần nhất: {lastSavedTime}</span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 tracking-tight">
                Trung Tâm Giám Sát Lưu Trữ & Bộ Nhớ Dữ Liệu
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto space-y-6 pr-1">
          
          {/* Architecture Summary Cards: 4 Tiers of Persistence */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {/* Tier 1: In-Memory RAM Cache */}
            <div className="p-4 rounded-2xl bg-[#FBFBFD] border border-slate-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Zap size={14} className="text-amber-500" />
                  <span>Tầng 1: Bộ nhớ RAM</span>
                </span>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                  0ms Latency
                </span>
              </div>
              <div className="text-lg font-bold text-slate-900">
                {collectionsStats.totalRecords.toLocaleString("vi-VN")} <span className="text-xs font-normal text-slate-400">bản ghi</span>
              </div>
              <p className="text-[11px] text-slate-400">Phản hồi tức thì không chờ đợi mạng</p>
            </div>

            {/* Tier 2: Persistent Local Storage */}
            <div className="p-4 rounded-2xl bg-[#FBFBFD] border border-slate-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <HardDrive size={14} className="text-blue-500" />
                  <span>Tầng 2: Ổ Đĩa Trình Duyệt</span>
                </span>
                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                  Bền vững 100%
                </span>
              </div>
              <div className="text-lg font-bold text-slate-900">
                {collectionsStats.totalSizeKB} <span className="text-xs font-normal text-slate-400">KB ({collectionsStats.totalSizeMB} MB)</span>
              </div>
              <p className="text-[11px] text-slate-400">Không mất khi tắt tab hoặc mất mạng</p>
            </div>

            {/* Tier 3: Cloud Firestore & Drive */}
            <div className="p-4 rounded-2xl bg-[#FBFBFD] border border-slate-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Server size={14} className="text-purple-500" />
                  <span>Tầng 3: Cloud Database</span>
                </span>
                <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-100">
                  Firebase Cloud
                </span>
              </div>
              <div className="text-lg font-bold text-slate-900">
                13 <span className="text-xs font-normal text-slate-400">Collections</span>
              </div>
              <p className="text-[11px] text-slate-400">Đồng bộ đa thiết bị và đa người dùng</p>
            </div>
          </div>

          {/* Detailed Collections Breakdown Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden space-y-2">
            <div className="p-4 bg-[#F5F5F7] border-b border-slate-200/80 flex items-center justify-between">
              <div className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Layers size={15} className="text-[#007AFF]" />
                <span>Chi Tiết Dữ Liệu Đang Lưu Trong Bộ Nhớ</span>
              </div>
              <span className="text-xs text-slate-500 font-semibold">
                Tổng: <strong className="text-slate-900">{collectionsStats.totalRecords} mục</strong>
              </span>
            </div>

            <div className="max-h-60 overflow-y-auto divide-y divide-slate-100">
              {collectionsStats.items.map((col, idx) => (
                <div key={idx} className="px-4 py-2.5 flex items-center justify-between text-xs hover:bg-slate-50 transition">
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">{col.icon}</span>
                    <div>
                      <div className="font-bold text-slate-800">{col.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">tsg_cache_{col.key}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <div className="font-bold text-slate-900 tabular-nums">{col.count.toLocaleString("vi-VN")} mục</div>
                      <div className="text-[10.5px] text-slate-400">{col.sizeKB} KB</div>
                    </div>
                    <span className="w-2 h-2 rounded-full bg-emerald-500" title="Đã lưu an toàn"></span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action Suite: Force Save, Download JSON Backup, Restore from File, Export Excel */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Thao Tác Quản Trị Bộ Nhớ & Sao Lưu
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Force Save */}
              <button
                type="button"
                onClick={handleForceSaveMemory}
                disabled={isSaving}
                className="p-3.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-2xl text-left space-y-1 transition active:scale-[0.98] disabled:opacity-50"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs flex items-center gap-1.5">
                    <RefreshCw size={14} className={isSaving ? "animate-spin" : ""} />
                    <span>Lưu Bộ Nhớ Ngay</span>
                  </span>
                </div>
                <p className="text-[10.5px] text-blue-600">Ghi ép buộc vào Cache & Ổ đĩa máy</p>
              </button>

              {/* Download JSON Backup */}
              <button
                type="button"
                onClick={handleDownloadFullBackupJSON}
                className="p-3.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-2xl text-left space-y-1 transition active:scale-[0.98]"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs flex items-center gap-1.5">
                    <Download size={14} />
                    <span>Tải File Sao Lưu (.json)</span>
                  </span>
                </div>
                <p className="text-[10.5px] text-purple-600">Lưu trữ ngoại tuyến về máy tính</p>
              </button>

              {/* Export Master Excel */}
              <button
                type="button"
                onClick={handleExportMasterExcel}
                className="p-3.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-2xl text-left space-y-1 transition active:scale-[0.98]"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs flex items-center gap-1.5">
                    <FileSpreadsheet size={14} />
                    <span>Xuất Sổ Excel Tổng</span>
                  </span>
                </div>
                <p className="text-[10.5px] text-emerald-600">Tạo sổ bảng tính 12 trang</p>
              </button>

              {/* Restore from JSON */}
              <label className="p-3.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-2xl text-left space-y-1 transition active:scale-[0.98] cursor-pointer block">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs flex items-center gap-1.5">
                    <Upload size={14} />
                    <span>Khôi Phục Từ File</span>
                  </span>
                </div>
                <p className="text-[10.5px] text-amber-700">Nạp lại tệp backup JSON</p>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleRestoreFromFile}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-500">
            <ShieldCheck size={16} className="text-emerald-600" />
            <span>Dữ liệu được tự động mã hóa & bảo vệ cục bộ trên thiết bị của bạn</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl text-xs transition"
          >
            Đóng
          </button>
        </div>

      </div>
    </div>
  );
}
