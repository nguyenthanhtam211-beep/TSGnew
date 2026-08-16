import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { googleSignIn, getAccessToken, logout, initAuth, ensureGoogleToken, openGoogleAuthTab } from '../lib/auth';
import { app, db } from '../firebase';
import { collection, writeBatch, doc, getDocs } from 'firebase/firestore';
import { 
  RefreshCw, Download, Database, CheckCircle, LogOut, FileSpreadsheet, 
  ShieldCheck, ExternalLink, CloudUpload, Sparkles, Check, UploadCloud, 
  Bot, Key, Eye, EyeOff, Cpu, Zap, AlertCircle, HardDrive, Globe,
  Lock, Sliders, ChevronRight, Laptop, Info, ArrowUpRight, Copy
} from 'lucide-react';
import { PRICING_DATA, PO_HEADER_DATA, PO_LINES_DATA, DELIVERY_DATA, CUSTOMER_DATA, SUPPLIER_DATA, CONTACT_DATA, PRODUCT_DATA, DELIVERY_PLAN_DATA } from '../data';
import { handleFirestoreError, OperationType } from '../lib/errorHelper';
import { getItemKey } from '../hooks/useFirestoreCollection';
import { getStoredGeminiKey, setStoredGeminiKey, testGeminiConnection } from '../lib/gemini';
import { exportMasterDataToExcelDirectly, getStoredMasterSpreadsheetId } from '../lib/driveSync';
import Papa from 'papaparse';

const parseCSV = (csv: string) => {
  return Papa.parse(csv.trim(), { header: true, skipEmptyLines: true }).data;
};

// Helper to convert array of objects into 2D array [headers, ...rows]
function prepareSheetValues(docs: any[], defaultHeaders?: string[]): string[][] {
  if (!docs || docs.length === 0) {
    return defaultHeaders ? [defaultHeaders, ["(Chưa có dữ liệu)"]] : [["Thông tin"], ["(Chưa có dữ liệu)"]];
  }
  
  const keySet = new Set<string>();
  if (defaultHeaders && defaultHeaders.length > 0) {
    defaultHeaders.forEach(h => keySet.add(h));
  }
  docs.forEach(doc => {
    Object.keys(doc).forEach(k => {
      if (k !== 'isDeleted') keySet.add(k);
    });
  });
  
  const headers = Array.from(keySet);
  const rows = docs.map(docItem => {
    return headers.map(h => {
      const val = docItem[h];
      if (val === undefined || val === null) return "";
      if (typeof val === 'object') return JSON.stringify(val);
      return String(val);
    });
  });

  return [headers, ...rows];
}

export default function SettingsView() {
  const [activeSection, setActiveSection] = useState<'google' | 'gemini' | 'data' | 'system' | 'about'>('google');
  const [needsAuth, setNeedsAuth] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  
  const [isSyncingFirebase, setIsSyncingFirebase] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [syncSuccess, setSyncSuccess] = useState(false);

  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [backupUrl, setBackupUrl] = useState<string | null>(null);

  // Gemini AI Connection State
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [isTestingGemini, setIsTestingGemini] = useState(false);
  const [geminiTestResult, setGeminiTestResult] = useState<any>(null);

  // Custom Google Client ID & Manual Token
  const [customClientId, setCustomClientId] = useState(() => localStorage.getItem('google_custom_client_id') || '');
  const [manualToken, setManualToken] = useState(() => localStorage.getItem('google_access_token') || '');

  useEffect(() => {
    initAuth(
      (u) => { setNeedsAuth(false); setUser(u); },
      () => { setNeedsAuth(true); setUser(null); }
    );
    const key = getStoredGeminiKey();
    if (key) {
      setGeminiApiKey(key);
      setGeminiTestResult({ success: true, model: 'gemini-2.5-flash', text: 'Đã sẵn sàng' });
    }
  }, []);

  const handleSaveGeminiKey = async () => {
    if (!geminiApiKey.trim()) {
      setStoredGeminiKey('');
      setGeminiTestResult(null);
      toast.success("Đã xóa khóa Gemini API Key.");
      return;
    }

    setIsTestingGemini(true);
    const toastId = toast.loading("Đang kiểm tra kết nối với Google AI Studio...");
    try {
      const result = await testGeminiConnection(geminiApiKey.trim());
      setGeminiTestResult(result);
      if (result.success) {
        setStoredGeminiKey(geminiApiKey.trim());
        toast.success(`Kết nối thành công với Google Gemini (${result.model})!`, { id: toastId });
      } else {
        toast.error(`Kiểm tra thất bại: ${result.error}`, { id: toastId });
      }
    } catch (e: any) {
      toast.error(`Lỗi: ${e.message}`, { id: toastId });
    } finally {
      setIsTestingGemini(false);
    }
  };

  const handleSaveCustomClientId = () => {
    if (customClientId.trim()) {
      localStorage.setItem('google_custom_client_id', customClientId.trim());
      toast.success("Đã lưu Google Client ID tùy chỉnh.");
    } else {
      localStorage.removeItem('google_custom_client_id');
      toast.success("Đã đặt lại Google Client ID mặc định.");
    }
  };

  const handleLogin = async () => {
    setIsLoggingIn(true);
    const toastId = toast.loading("Đang mở kết nối xác thực Google...");
    try {
      const token = await ensureGoogleToken([
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive.file'
      ], true);
      if (token) {
        setNeedsAuth(false);
        setUser({ email: 'Tài khoản Google đã kết nối' });
        toast.success("Đã kết nối tài khoản Google thành công!", { id: toastId });
      }
    } catch (err: any) {
      console.error('Login failed:', err);
      toast.error(`Không thể kết nối Google: ${err.message || err}`, { id: toastId });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSyncFirebase = async () => {
    if (!window.confirm("Bạn có chắc chắn muốn nạp toàn bộ dữ liệu demo (dữ liệu chuẩn) vào hệ thống? (Dữ liệu cũ sẽ bị đè nếu trùng ID)")) return;
    setIsSyncingFirebase(true);
    setSyncStatus("Đang nạp dữ liệu...");
    setSyncSuccess(false);
    const toastId = toast.loading('Đang nạp dữ liệu...');
    try {
      const collections = [
        { name: "customers", data: parseCSV(CUSTOMER_DATA), idField: "Customer_ID" },
        { name: "suppliers", data: parseCSV(SUPPLIER_DATA), idField: "Mã nhà cung cấp" },
        { name: "pricing", data: parseCSV(PRICING_DATA), idField: "Mã giá" },
        { name: "po_headers", data: parseCSV(PO_HEADER_DATA), idField: "Số PO" },
        { name: "po_lines", data: parseCSV(PO_LINES_DATA), idField: "Mã dòng (D_XXX)" },
        { name: "deliveries", data: parseCSV(DELIVERY_DATA), idField: "Mã giao hàng" },
        { name: "contacts", data: parseCSV(CONTACT_DATA), idField: "Tên" },
        { name: "products", data: parseCSV(PRODUCT_DATA), idField: "Mã sản phẩm" },
        { name: "delivery_plans", data: parseCSV(DELIVERY_PLAN_DATA), idField: "Mã kế hoạch" }
      ];
      
      for (const col of collections) {
        const batch = writeBatch(db);
        col.data.forEach((item: any) => {
          if (item[col.idField]) {
            const docRef = doc(collection(db, col.name), item[col.idField]);
            batch.set(docRef, item);
          }
        });
        await batch.commit();
      }
      setSyncStatus("Nạp dữ liệu thành công!");
      setSyncSuccess(true);
      toast.success('Nạp dữ liệu chuẩn thành công!', { id: toastId });
      setTimeout(() => {
        setSyncStatus(null);
        setSyncSuccess(false);
      }, 10000);
    } catch (error: any) {
      console.error("Lỗi khi nạp dữ liệu Firebase:", error);
      setSyncStatus("Lỗi: " + error.message);
      toast.error('Nạp dữ liệu thất bại: ' + error.message, { id: toastId });
    } finally {
      setIsSyncingFirebase(false);
    }
  };

  const handleBackupFullDataToSheets = async () => {
    setIsBackingUp(true);
    setBackupStatus("Đang thu thập dữ liệu từ hệ thống...");
    setBackupUrl(null);
    const toastId = toast.loading('Đang khởi tạo sao lưu dữ liệu...');

    try {
      let token = await getAccessToken();
      if (!token) {
        token = await ensureGoogleToken([
          'https://www.googleapis.com/auth/spreadsheets',
          'https://www.googleapis.com/auth/drive.file'
        ]);
      }

      if (!token) {
        throw new Error('Chưa kết nối tài khoản Google. Vui lòng đăng nhập Google trước.');
      }

      setBackupStatus("Đang truy vấn các danh mục dữ liệu...");

      const tableNames = [
        { name: 'contacts', title: 'Danh bạ' },
        { name: 'customers', title: 'Khách hàng' },
        { name: 'suppliers', title: 'Nhà cung cấp' },
        { name: 'products', title: 'Sản phẩm' },
        { name: 'pricing', title: 'Bảng giá' },
        { name: 'po_headers', title: 'Đơn hàng (PO)' },
        { name: 'po_lines', title: 'Chi tiết PO (Lines)' },
        { name: 'deliveries', title: 'Nhật ký giao hàng' },
        { name: 'delivery_plans', title: 'Kế hoạch giao hàng' },
      ];

      const allTableData: { title: string; values: string[][] }[] = [];

      for (const t of tableNames) {
        try {
          const snap = await getDocs(collection(db, t.name));
          const docs = snap.docs.map(d => d.data()).filter(d => !d.isDeleted);
          const values = prepareSheetValues(docs);
          allTableData.push({ title: t.title, values });
        } catch (e) {
          console.warn(`Lỗi lấy bảng ${t.name}:`, e);
          allTableData.push({ title: t.title, values: [["Lỗi"], ["Không thể truy xuất dữ liệu"]] });
        }
      }

      setBackupStatus("Đang tạo tệp Google Sheets...");

      const now = new Date();
      const timestamp = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      const spreadsheetTitle = `[TSG ERP] Sao lưu Toàn bộ Dữ liệu - ${timestamp}`;

      const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          properties: {
            title: spreadsheetTitle
          },
          sheets: allTableData.map(t => ({
            properties: {
              title: t.title
            }
          }))
        })
      });

      if (!createRes.ok) {
        const err = await createRes.json();
        throw new Error(err.error?.message || 'Không thể tạo tệp Google Sheets mới.');
      }

      const createdSheet = await createRes.json();
      const spreadsheetId = createdSheet.spreadsheetId;

      setBackupStatus("Đang đồng bộ dữ liệu vào từng trang tính...");

      const updateData = allTableData.map(t => ({
        range: `'${t.title}'!A1`,
        values: t.values
      }));

      const batchUpdateRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          valueInputOption: 'USER_ENTERED',
          data: updateData
        })
      });

      if (!batchUpdateRes.ok) {
        const err = await batchUpdateRes.json();
        throw new Error(err.error?.message || 'Không thể ghi dữ liệu vào Google Sheets.');
      }

      const fileUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
      setBackupUrl(fileUrl);
      setBackupStatus(`Sao lưu thành công: ${spreadsheetTitle}`);
      toast.success("Sao lưu toàn bộ dữ liệu ra Google Sheets thành công!", { id: toastId });

    } catch (err: any) {
      console.error("Backup to Google Sheets error:", err);
      setBackupStatus(`Lỗi: ${err.message || err}`);
      toast.error(`Sao lưu thất bại: ${err.message || err}`, { id: toastId });
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleDownloadOfflineBackup = async () => {
    const toastId = toast.loading('Đang xuất tệp JSON sao lưu hệ thống...');
    try {
      const collections = ["customers", "suppliers", "pricing", "po_headers", "po_lines", "deliveries", "contacts", "products", "delivery_plans", "specs"];
      const backupData: Record<string, any[]> = {};
      
      for (const colName of collections) {
        try {
          const snap = await getDocs(collection(db, colName));
          backupData[colName] = snap.docs.map(d => d.data());
        } catch (e) {
          console.warn(`Lỗi xuất bảng ${colName}:`, e);
          backupData[colName] = [];
        }
      }

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `TSG_ERP_Full_Backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('Đã tải xuống tệp JSON sao lưu an toàn!', { id: toastId });
    } catch (err: any) {
      toast.error('Lỗi khi tải bản sao lưu: ' + err.message, { id: toastId });
    }
  };

  const masterSpreadsheetId = getStoredMasterSpreadsheetId();

  return (
    <div className="flex-1 bg-[#F5F5F7] min-h-screen text-[#1D1D1F] flex flex-col font-sans">
      
      {/* Apple macOS Top Bar / Window Header */}
      <div className="bg-white/80 backdrop-blur-xl border-b border-black/[0.06] sticky top-0 z-20 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Traffic Lights */}
          <div className="flex items-center gap-1.5 mr-2">
            <span className="w-3 h-3 rounded-full bg-[#FF5F56] border border-[#E0443E]/50 shadow-xs inline-block" />
            <span className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-[#DEA123]/50 shadow-xs inline-block" />
            <span className="w-3 h-3 rounded-full bg-[#27C93F] border border-[#1AAB29]/50 shadow-xs inline-block" />
          </div>
          <div>
            <h1 className="text-base font-semibold tracking-[-0.015em] text-[#1D1D1F] flex items-center gap-2">
              <span>Cài đặt hệ thống</span>
              <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">macOS Sequoia Style</span>
            </h1>
            <p className="text-xs text-slate-500">Quản lý kết nối đám mây, trí tuệ nhân tạo và kho dữ liệu doanh nghiệp</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {user?.email && (
            <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-medium border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Google Connected</span>
            </div>
          )}
          {geminiTestResult?.success && (
            <div className="flex items-center gap-2 px-3 py-1 bg-purple-50 text-purple-700 rounded-full text-xs font-medium border border-purple-200">
              <Sparkles size={13} className="text-purple-600" />
              <span>Gemini 2.5 Flash</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Apple Split-View Settings Container */}
      <div className="max-w-6xl w-full mx-auto p-4 md:p-6 lg:p-8 flex-1 flex flex-col md:flex-row gap-6">
        
        {/* Left Column: Apple Source List Navigation */}
        <div className="w-full md:w-64 shrink-0 space-y-1">
          <div className="px-3 py-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Tài nguyên & Kết nối
          </div>
          
          <button
            onClick={() => setActiveSection('google')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 ${
              activeSection === 'google'
                ? 'bg-[#007AFF] text-white shadow-sm font-semibold'
                : 'text-slate-700 hover:bg-black/[0.04]'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-1.5 rounded-lg ${activeSection === 'google' ? 'bg-white/20' : 'bg-emerald-100 text-emerald-700'}`}>
                <Globe size={15} />
              </div>
              <span>Google Workspace</span>
            </div>
            <ChevronRight size={14} className={activeSection === 'google' ? 'text-white/70' : 'text-slate-400'} />
          </button>

          <button
            onClick={() => setActiveSection('gemini')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 ${
              activeSection === 'gemini'
                ? 'bg-[#007AFF] text-white shadow-sm font-semibold'
                : 'text-slate-700 hover:bg-black/[0.04]'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-1.5 rounded-lg ${activeSection === 'gemini' ? 'bg-white/20' : 'bg-purple-100 text-purple-700'}`}>
                <Bot size={15} />
              </div>
              <span>Gemini AI Intelligence</span>
            </div>
            <ChevronRight size={14} className={activeSection === 'gemini' ? 'text-white/70' : 'text-slate-400'} />
          </button>

          <button
            onClick={() => setActiveSection('data')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 ${
              activeSection === 'data'
                ? 'bg-[#007AFF] text-white shadow-sm font-semibold'
                : 'text-slate-700 hover:bg-black/[0.04]'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-1.5 rounded-lg ${activeSection === 'data' ? 'bg-white/20' : 'bg-blue-100 text-blue-700'}`}>
                <HardDrive size={15} />
              </div>
              <span>Kho Master Data & Backup</span>
            </div>
            <ChevronRight size={14} className={activeSection === 'data' ? 'text-white/70' : 'text-slate-400'} />
          </button>

          <div className="pt-4 px-3 py-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Hệ thống & Cấu hình
          </div>

          <button
            onClick={() => setActiveSection('system')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 ${
              activeSection === 'system'
                ? 'bg-[#007AFF] text-white shadow-sm font-semibold'
                : 'text-slate-700 hover:bg-black/[0.04]'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-1.5 rounded-lg ${activeSection === 'system' ? 'bg-white/20' : 'bg-amber-100 text-amber-700'}`}>
                <Sliders size={15} />
              </div>
              <span>Nạp dữ liệu chuẩn Demo</span>
            </div>
            <ChevronRight size={14} className={activeSection === 'system' ? 'text-white/70' : 'text-slate-400'} />
          </button>

          <button
            onClick={() => setActiveSection('about')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 ${
              activeSection === 'about'
                ? 'bg-[#007AFF] text-white shadow-sm font-semibold'
                : 'text-slate-700 hover:bg-black/[0.04]'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-1.5 rounded-lg ${activeSection === 'about' ? 'bg-white/20' : 'bg-slate-200 text-slate-700'}`}>
                <Info size={15} />
              </div>
              <span>Giới thiệu TSG Business OS</span>
            </div>
            <ChevronRight size={14} className={activeSection === 'about' ? 'text-white/70' : 'text-slate-400'} />
          </button>
        </div>

        {/* Right Column: Apple Inset Grouped Detail Panes */}
        <div className="flex-1 space-y-6">
          
          {/* SECTION: Google Workspace */}
          {activeSection === 'google' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="bg-white rounded-2xl border border-black/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
                <div className="p-6 border-b border-black/[0.06] flex items-center justify-between">
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
                      <Globe size={22} />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-[#1D1D1F]">Google Workspace & Cloud Hub</h2>
                      <p className="text-xs text-slate-500 mt-0.5">Tự động đồng bộ 2 chiều với Google Drive, Google Sheets và Calendar</p>
                    </div>
                  </div>
                  {user ? (
                    <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-full flex items-center gap-1.5">
                      <CheckCircle size={13} /> Đã kích hoạt
                    </span>
                  ) : (
                    <span className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-semibold rounded-full">
                      Chưa kết nối
                    </span>
                  )}
                </div>

                <div className="p-6 space-y-4">
                  {user ? (
                    <div className="bg-[#F5F5F7] rounded-xl p-4 flex items-center justify-between border border-black/[0.04]">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm">
                          G
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-[#1D1D1F]">{user.email || 'Tài khoản Google đã kết nối'}</p>
                          <p className="text-[11px] text-emerald-700 mt-0.5 font-medium">Quyền truy cập: Google Drive & Google Sheets Master Data</p>
                        </div>
                      </div>
                      <button
                        onClick={logout}
                        className="px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-red-200"
                      >
                        Ngắt kết nối
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <button
                        onClick={handleLogin}
                        disabled={isLoggingIn}
                        className="w-full py-3 bg-[#007AFF] hover:bg-[#0062CC] active:bg-[#0051A8] text-white rounded-xl text-xs font-semibold shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-4 h-4 bg-white rounded-full p-0.5" />
                        <span>{isLoggingIn ? 'Đang xác thực Google...' : 'Đăng nhập & Cấp quyền Google Workspace'}</span>
                      </button>

                      {/* Direct Token Fallback for origin_mismatch */}
                      <div className="p-4 bg-[#F5F5F7] rounded-xl border border-black/[0.06] space-y-2.5">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-semibold text-slate-700">
                            🔑 Hoặc dán trực tiếp Google Access Token (Nếu gặp lỗi origin_mismatch):
                          </label>
                          <a
                            href="https://developers.google.com/oauthplayground"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] font-semibold text-[#007AFF] hover:underline"
                          >
                            Lấy Token nhanh qua OAuth Playground ↗
                          </a>
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="password"
                            placeholder="ya29.a0A..."
                            value={manualToken}
                            onChange={(e) => setManualToken(e.target.value)}
                            className="flex-1 bg-white border border-black/[0.08] rounded-xl px-3 py-1.5 text-xs font-mono outline-none focus:border-[#007AFF]"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (manualToken.trim()) {
                                localStorage.setItem('google_access_token', manualToken.trim());
                                setUser({ email: 'Tài khoản Google đã kết nối (Direct Token)' });
                                setNeedsAuth(false);
                                toast.success('Đã lưu Google Access Token thành công!');
                              }
                            }}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shrink-0"
                          >
                            Lưu Token
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Actions Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <button
                      onClick={handleBackupFullDataToSheets}
                      disabled={isBackingUp}
                      className="p-4 rounded-xl border border-black/[0.08] hover:border-[#007AFF] hover:bg-blue-50/40 text-left transition-all group"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
                          <FileSpreadsheet size={18} />
                        </div>
                        <ArrowUpRight size={16} className="text-slate-400 group-hover:text-[#007AFF] transition-colors" />
                      </div>
                      <h4 className="text-xs font-semibold text-[#1D1D1F]">Tạo Bản Sao Toàn Diện</h4>
                      <p className="text-[11px] text-slate-500 mt-1">Xuất toàn bộ 9 bảng danh mục ra một tệp Google Sheets mới độc lập.</p>
                    </button>

                    <button
                      onClick={() => exportMasterDataToExcelDirectly()}
                      className="p-4 rounded-xl border border-black/[0.08] hover:border-[#007AFF] hover:bg-blue-50/40 text-left transition-all group"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
                          <Download size={18} />
                        </div>
                        <ArrowUpRight size={16} className="text-slate-400 group-hover:text-[#007AFF] transition-colors" />
                      </div>
                      <h4 className="text-xs font-semibold text-[#1D1D1F]">Tải Excel Master (.xlsx)</h4>
                      <p className="text-[11px] text-slate-500 mt-1">Tải trực tiếp file Excel 9 trang tính để lưu vào máy hoặc Google Drive.</p>
                    </button>
                  </div>

                  {backupUrl && (
                    <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200 text-xs flex items-center justify-between">
                      <span className="text-emerald-800 font-medium truncate">{backupStatus}</span>
                      <a 
                        href={backupUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold flex items-center gap-1 shrink-0 ml-2"
                      >
                        <span>Mở Sheets</span>
                        <ExternalLink size={12} />
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Developer / Advanced Settings Inset Card */}
              <div className="bg-white rounded-2xl border border-black/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-6 space-y-4">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Cấu hình nâng cao (OAuth Client ID)</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Nếu bạn sử dụng tài khoản Google Cloud riêng hoặc muốn tùy biến Client ID, bạn có thể dán ID bên dưới:
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customClientId}
                    onChange={(e) => setCustomClientId(e.target.value)}
                    placeholder="779403158794-...apps.googleusercontent.com"
                    className="flex-1 bg-[#F5F5F7] border border-black/[0.08] rounded-xl px-3.5 py-2 text-xs font-mono outline-none focus:border-[#007AFF] focus:bg-white"
                  />
                  <button
                    onClick={handleSaveCustomClientId}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold"
                  >
                    Lưu
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* SECTION: Gemini AI */}
          {activeSection === 'gemini' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="bg-white rounded-2xl border border-black/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
                <div className="p-6 border-b border-black/[0.06] flex items-center justify-between">
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-500/20">
                      <Bot size={22} />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-[#1D1D1F]">Google Gemini AI Intelligence</h2>
                      <p className="text-xs text-slate-500 mt-0.5">Mô hình AI đa phương thức: Phân tích báo cáo B2B, OCR đọc chứng từ, tính giá</p>
                    </div>
                  </div>
                  {geminiTestResult?.success ? (
                    <span className="px-3 py-1 bg-purple-100 text-purple-800 text-xs font-semibold rounded-full flex items-center gap-1.5">
                      <CheckCircle size={13} /> Sẵn sàng ({geminiTestResult.model})
                    </span>
                  ) : (
                    <span className="px-3 py-1 bg-amber-100 text-amber-800 text-xs font-semibold rounded-full flex items-center gap-1.5">
                      <AlertCircle size={13} /> Dùng AI tích hợp
                    </span>
                  )}
                </div>

                <div className="p-6 space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-semibold text-[#1D1D1F]">
                        Google AI Studio API Key
                      </label>
                      <a
                        href="https://aistudio.google.com/app/apikey"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-semibold text-[#007AFF] hover:underline flex items-center gap-1"
                      >
                        <span>Lấy API Key chính thức miễn phí ↗</span>
                      </a>
                    </div>
                    <div className="relative">
                      <input
                        type={showGeminiKey ? 'text' : 'password'}
                        value={geminiApiKey}
                        onChange={(e) => setGeminiApiKey(e.target.value)}
                        placeholder="Dán mã API Key dạng AIzaSy..."
                        className="w-full bg-[#F5F5F7] border border-black/[0.08] rounded-xl px-4 py-2.5 pr-10 text-xs font-mono outline-none focus:border-purple-500 focus:bg-white transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowGeminiKey(!showGeminiKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showGeminiKey ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  {geminiTestResult && (
                    <div className={`p-3.5 rounded-xl text-xs flex items-center justify-between ${
                      geminiTestResult.success 
                        ? 'bg-purple-50 text-purple-900 border border-purple-200' 
                        : 'bg-red-50 text-red-900 border border-red-200'
                    }`}>
                      <span className="truncate">{geminiTestResult.text || geminiTestResult.error}</span>
                      {geminiTestResult.model && (
                        <span className="font-mono text-[10px] font-bold px-2 py-0.5 bg-white rounded-md shadow-xs ml-2">
                          {geminiTestResult.model}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="pt-2 flex gap-3">
                    <button
                      onClick={handleSaveGeminiKey}
                      disabled={isTestingGemini}
                      className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white rounded-xl font-semibold text-xs transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isTestingGemini ? (
                        <>
                          <RefreshCw size={15} className="animate-spin" />
                          <span>Đang kiểm tra kết nối Google AI Studio...</span>
                        </>
                      ) : (
                        <>
                          <Zap size={15} />
                          <span>Lưu & Kiểm tra kết nối Gemini</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* AI Features Checklist Card */}
              <div className="bg-white rounded-2xl border border-black/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-6 space-y-3">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Khả năng AI đã được kích hoạt</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-700">
                  <div className="p-3 bg-[#F5F5F7] rounded-xl flex items-start gap-2.5">
                    <span className="text-purple-600 font-bold">✓</span>
                    <div>
                      <p className="font-semibold text-[#1D1D1F]">Trợ lý Báo cáo Tức thì</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">Tra cứu tiến độ PO, doanh thu, lợi nhuận NCC theo ngôn ngữ tự nhiên.</p>
                    </div>
                  </div>
                  <div className="p-3 bg-[#F5F5F7] rounded-xl flex items-start gap-2.5">
                    <span className="text-purple-600 font-bold">✓</span>
                    <div>
                      <p className="font-semibold text-[#1D1D1F]">OCR Chứng từ Đa định dạng</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">Kéo thả ảnh hóa đơn, phiếu xuất kho để trích xuất tự động vào hệ thống.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION: Kho Master Data & Backup */}
          {activeSection === 'data' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="bg-white rounded-2xl border border-black/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-6 space-y-6">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
                    <HardDrive size={22} />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-[#1D1D1F]">Kho Lưu Trữ & Bản Sao Dự Phòng</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Đảm bảo an toàn 100% dữ liệu danh bạ, khách hàng, nhà cung cấp và đơn hàng</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-5 rounded-2xl bg-[#F5F5F7] border border-black/[0.04] space-y-3 flex flex-col justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-[#1D1D1F] flex items-center gap-2">
                        <Download size={16} className="text-blue-600" />
                        <span>Sao lưu Ngoại tuyến (JSON)</span>
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-1">Tải về toàn bộ cơ sở dữ liệu dạng tệp JSON tiêu chuẩn có thể khôi phục bất cứ khi nào.</p>
                    </div>
                    <button
                      onClick={handleDownloadOfflineBackup}
                      className="w-full py-2.5 bg-white hover:bg-slate-50 text-slate-800 border border-black/[0.08] rounded-xl text-xs font-semibold transition-all shadow-xs"
                    >
                      Tải tệp JSON về máy
                    </button>
                  </div>

                  <div className="p-5 rounded-2xl bg-[#F5F5F7] border border-black/[0.04] space-y-3 flex flex-col justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-[#1D1D1F] flex items-center gap-2">
                        <FileSpreadsheet size={16} className="text-emerald-600" />
                        <span>Sổ Bảng Tính Excel (.xlsx)</span>
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-1">Tạo file Excel 9 trang tính chuẩn hóa format tương thích 100% với Google Sheets.</p>
                    </div>
                    <button
                      onClick={() => exportMasterDataToExcelDirectly()}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-all shadow-xs"
                    >
                      Xuất Sổ Bảng Tính Excel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION: Nạp Dữ liệu chuẩn Demo */}
          {activeSection === 'system' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="bg-white rounded-2xl border border-black/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-6 space-y-6">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
                    <Database size={22} />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-[#1D1D1F]">Nạp Cơ Sở Dữ Liệu Chuẩn TSG</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Khởi tạo dữ liệu mẫu gốc gồm đầy đủ Khách hàng, NCC, Bảng giá và Đơn hàng PO</p>
                  </div>
                </div>

                <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-2">
                  <p className="font-semibold">⚠️ Lưu ý quan trọng:</p>
                  <p>Hành động này sẽ ghi đè các bản ghi trùng mã ID với bộ dữ liệu mẫu chuẩn của Tâm Sen Group. Hãy chỉ bấm khi bạn muốn reset về trạng thái ban đầu.</p>
                </div>

                <button
                  onClick={handleSyncFirebase}
                  disabled={isSyncingFirebase}
                  className="w-full py-3 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-xl text-xs font-semibold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSyncingFirebase ? (
                    <>
                      <RefreshCw size={15} className="animate-spin" />
                      <span>{syncStatus || 'Đang nạp dữ liệu...'}</span>
                    </>
                  ) : (
                    <>
                      <Database size={15} />
                      <span>Nạp toàn bộ dữ liệu mẫu vào Firebase</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* SECTION: About TSG Business OS */}
          {activeSection === 'about' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="bg-white rounded-2xl border border-black/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-8 text-center space-y-4">
                <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 text-white flex items-center justify-center mx-auto shadow-xl shadow-blue-500/20">
                  <Laptop size={32} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[#1D1D1F] tracking-[-0.015em]">TSG Business OS</h2>
                  <p className="text-xs text-slate-500 mt-1">Phiên bản 2.5 • Thiết kế theo chuẩn Apple Human Interface Guidelines (macOS Sequoia)</p>
                </div>
                <div className="max-w-md mx-auto p-4 bg-[#F5F5F7] rounded-xl text-xs text-slate-600 leading-relaxed border border-black/[0.04] text-left space-y-1.5 font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Kiến trúc:</span>
                    <span className="font-semibold text-slate-800">React 19 + TypeScript + Vite</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Đồng bộ Cloud:</span>
                    <span className="font-semibold text-emerald-700">Google Drive & Sheets API v4</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Trí tuệ nhân tạo:</span>
                    <span className="font-semibold text-purple-700">Google Gemini 2.5 Flash</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Cơ sở dữ liệu:</span>
                    <span className="font-semibold text-slate-800">Firebase Firestore Cloud Database</span>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

    </div>
  );
}
