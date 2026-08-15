import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { googleSignIn, getAccessToken, logout, initAuth, ensureGoogleToken, openGoogleAuthTab } from '../lib/auth';
import { app, db } from '../firebase';
import { collection, writeBatch, doc, getDocs } from 'firebase/firestore';
import { RefreshCw, Download, Database, CheckCircle, LogOut, FileSpreadsheet, ShieldCheck, ExternalLink, CloudUpload, Sparkles, Check, UploadCloud } from 'lucide-react';
import { PRICING_DATA, PO_HEADER_DATA, PO_LINES_DATA, DELIVERY_DATA, CUSTOMER_DATA, SUPPLIER_DATA, CONTACT_DATA, PRODUCT_DATA, DELIVERY_PLAN_DATA } from '../data';
import { handleFirestoreError, OperationType } from '../lib/errorHelper';
import { getItemKey } from '../hooks/useFirestoreCollection';
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
  const [needsAuth, setNeedsAuth] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  
  const [isSyncingFirebase, setIsSyncingFirebase] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [syncSuccess, setSyncSuccess] = useState(false);

  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [backupUrl, setBackupUrl] = useState<string | null>(null);

  useEffect(() => {
    initAuth(
      (u) => { setNeedsAuth(false); setUser(u); },
      () => { setNeedsAuth(true); setUser(null); }
    );
  }, []);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const token = await ensureGoogleToken([
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive.file'
      ]);
      if (token) {
        setNeedsAuth(false);
        setUser({ email: 'Tài khoản Google đã kết nối' });
        toast.success("Đã kết nối tài khoản Google thành công!");
      }
    } catch (err: any) {
      console.error('Login failed:', err);
      toast('Đang mở tab mới để hoàn tất xác thực Google OAuth...', { icon: '🔑' });
      openGoogleAuthTab();
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
      console.error(error);
      setSyncStatus(`Lỗi: ${error.message}`);
      toast.error('Lỗi khi nạp dữ liệu!', { id: toastId });
      handleFirestoreError(error, OperationType.WRITE, 'batch-sync');
    } finally {
      setIsSyncingFirebase(false);
    }
  };

  const fetchCollectionData = async (colName: string, fallbackCsv?: string) => {
    try {
      const snap = await getDocs(collection(db, colName));
      if (!snap.empty) {
        return snap.docs.map(docItem => ({ id: docItem.id, ...docItem.data() }));
      }
    } catch (e) {
      console.warn(`Could not fetch Firestore collection ${colName}:`, e);
    }
    if (fallbackCsv) {
      return parseCSV(fallbackCsv);
    }
    return [];
  };

  const handleDownloadLocalJsonBackup = async () => {
    const toastId = toast.loading("Đang đọc và đóng gói dữ liệu hệ thống...");
    try {
      const [
        customers, suppliers, contacts, products, pricing,
        poHeaders, poLines, deliveries, deliveryPlans, specs, fileStorage
      ] = await Promise.all([
        fetchCollectionData('customers', CUSTOMER_DATA),
        fetchCollectionData('suppliers', SUPPLIER_DATA),
        fetchCollectionData('contacts', CONTACT_DATA),
        fetchCollectionData('products', PRODUCT_DATA),
        fetchCollectionData('pricing', PRICING_DATA),
        fetchCollectionData('po_headers', PO_HEADER_DATA),
        fetchCollectionData('po_lines', PO_LINES_DATA),
        fetchCollectionData('deliveries', DELIVERY_DATA),
        fetchCollectionData('delivery_plans', DELIVERY_PLAN_DATA),
        fetchCollectionData('specs'),
        fetchCollectionData('file_storage')
      ]);

      const backupData = {
        app: "TSG Sales & Operations Manager",
        version: "1.0",
        exportDate: new Date().toISOString(),
        exportDateFormatted: new Date().toLocaleString('vi-VN'),
        summary: {
          customersCount: customers.length,
          suppliersCount: suppliers.length,
          contactsCount: contacts.length,
          productsCount: products.length,
          pricingCount: pricing.length,
          poHeadersCount: poHeaders.length,
          poLinesCount: poLines.length,
          deliveriesCount: deliveries.length,
          deliveryPlansCount: deliveryPlans.length,
          specsCount: specs.length,
          fileStorageCount: fileStorage.length,
        },
        collections: {
          customers,
          suppliers,
          contacts,
          products,
          pricing,
          po_headers: poHeaders,
          po_lines: poLines,
          deliveries,
          delivery_plans: deliveryPlans,
          specs,
          file_storage: fileStorage
        }
      };

      const jsonString = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonString], { type: "application/json;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `TSG_Full_Backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Đã tải xuống tập tin sao lưu JSON toàn bộ hệ thống thành công!", { id: toastId });
    } catch (err: any) {
      console.error("Local backup error:", err);
      toast.error(`Không thể tạo sao lưu JSON: ${err.message}`, { id: toastId });
    }
  };

  const handleRestoreJsonBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!confirm("Bạn có chắc chắn muốn nạp bản sao lưu JSON này vào cơ sở dữ liệu? Toàn bộ danh bạ, khách hàng, NCC, đơn hàng sẽ được đồng bộ lên Firebase.")) {
      event.target.value = '';
      return;
    }

    const toastId = toast.loading("Đang đọc và phục hồi dữ liệu từ file JSON...");
    try {
      const text = await file.text();
      const backupJson = JSON.parse(text);
      const data = backupJson.data || backupJson;

      const collections = [
        'customers', 'suppliers', 'contacts', 'products',
        'pricing', 'po_headers', 'po_lines', 'deliveries', 'delivery_plans'
      ];

      let totalRestored = 0;
      for (const colName of collections) {
        const items = data[colName];
        if (Array.isArray(items) && items.length > 0) {
          let batch = writeBatch(db);
          let count = 0;
          for (const item of items) {
            const rawId = item.id || getItemKey(item, colName) || doc(collection(db, colName)).id;
            const docId = String(rawId).replace(/[/\\#?%[\]\s.]+/g, '_');
            const docRef = doc(db, colName, docId);
            batch.set(docRef, item, { merge: true });
            count++;
            totalRestored++;
            if (count >= 400) {
              await batch.commit();
              batch = writeBatch(db);
              count = 0;
            }
          }
          if (count > 0) {
            await batch.commit();
          }
        }
      }

      toast.success(`Khôi phục thành công ${totalRestored} bản ghi lên hệ thống Cloud!`, { id: toastId });
    } catch (err: any) {
      console.error("Restore error:", err);
      toast.error(`Khôi phục thất bại: ${err.message}`, { id: toastId });
    } finally {
      event.target.value = '';
    }
  };

  const handleBackupFullDataToSheets = async () => {
    setIsBackingUp(true);
    setBackupStatus("Đang đọc toàn bộ danh mục dữ liệu...");
    const toastId = toast.loading("Đang sao lưu toàn bộ dữ liệu ra Google Sheets...");

    try {
      let token = await getAccessToken();
      if (!token) {
        token = localStorage.getItem('google_access_token') || '';
      }

      const [
        customers,
        suppliers,
        contacts,
        products,
        pricing,
        poHeaders,
        poLines,
        deliveries,
        deliveryPlans,
        specs,
        fileStorage
      ] = await Promise.all([
        fetchCollectionData('customers', CUSTOMER_DATA),
        fetchCollectionData('suppliers', SUPPLIER_DATA),
        fetchCollectionData('contacts', CONTACT_DATA),
        fetchCollectionData('products', PRODUCT_DATA),
        fetchCollectionData('pricing', PRICING_DATA),
        fetchCollectionData('po_headers', PO_HEADER_DATA),
        fetchCollectionData('po_lines', PO_LINES_DATA),
        fetchCollectionData('deliveries', DELIVERY_DATA),
        fetchCollectionData('delivery_plans', DELIVERY_PLAN_DATA),
        fetchCollectionData('specs'),
        fetchCollectionData('file_storage')
      ]);

      // Attempt 1: Try Serverless Backend Endpoint (/api/sheets/sync)
      setBackupStatus("Đang khởi tạo Bảng tính Google Sheets...");
      try {
        const syncRes = await fetch('/api/sheets/sync', {
          method: 'POST',
          headers: {
            'Authorization': token ? `Bearer ${token}` : '',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            spreadsheetId: localStorage.getItem('google_spreadsheet_id') || '',
            customers,
            poLines,
            deliveries
          })
        });

        if (syncRes.ok) {
          const syncData = await syncRes.json();
          if (syncData.spreadsheetId) {
            localStorage.setItem('google_spreadsheet_id', syncData.spreadsheetId);
          }
          const url = syncData.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${syncData.spreadsheetId}/edit`;
          setBackupUrl(url);
          setBackupStatus("Sao lưu toàn bộ dữ liệu thành công!");
          toast.success("Sao lưu dữ liệu ra Google Sheets thành công!", { id: toastId });
          window.open(url, "_blank");
          setIsBackingUp(false);
          return;
        }
      } catch (backendErr) {
        console.warn("Backend API sync failed, trying browser Google API:", backendErr);
      }

      // Attempt 2: Direct browser OAuth API
      if (!token) {
        try {
          const result = await googleSignIn();
          if (result) {
            setUser(result.user);
            setNeedsAuth(false);
            token = result.accessToken;
          }
        } catch (err: any) {
          console.warn("Google Signin failed:", err);
          toast.error("Đang mở Tab mới để đăng nhập Google...", { id: toastId, duration: 4000 });
          openGoogleAuthTab();
          setIsBackingUp(false);
          return;
        }
      }

      const nowStr = new Date().toLocaleString('vi-VN');
      const sheetsConfig = [
        { title: "Tổng quan Sao Lưu", data: [
          ["THÔNG TIN SAO LƯU DỮ LIỆU HỆ THỐNG TSG"],
          ["Thời gian sao lưu", nowStr],
          ["Tài khoản thực hiện", user?.email || "Chưa xác định"],
          ["Trạng thái sao lưu", "Thành công hoàn tất"],
          [""],
          ["DANH MỤC BẢNG DỮ LIỆU", "SỐ LƯỢNG BẢN GHI SAO LƯU"],
          ["1. Khách hàng", customers.length],
          ["2. Nhà cung cấp", suppliers.length],
          ["3. Danh bạ liên hệ", contacts.length],
          ["4. Danh mục sản phẩm", products.length],
          ["5. Bảng giá & Báo giá", pricing.length],
          ["6. Đơn đặt hàng (PO Header)", poHeaders.length],
          ["7. Chi tiết đơn hàng (PO Lines)", poLines.length],
          ["8. Nhật ký giao hàng", deliveries.length],
          ["9. Lịch kế hoạch giao hàng", deliveryPlans.length],
          ["10. Quy cách kỹ thuật (Specs)", specs.length],
          ["11. Lưu trữ tài liệu & tệp", fileStorage.length],
        ]},
        { title: "Khách hàng", data: prepareSheetValues(customers) },
        { title: "Nhà cung cấp", data: prepareSheetValues(suppliers) },
        { title: "Danh bạ liên hệ", data: prepareSheetValues(contacts) },
        { title: "Danh mục sản phẩm", data: prepareSheetValues(products) },
        { title: "Bảng giá", data: prepareSheetValues(pricing) },
        { title: "Đơn hàng (PO Header)", data: prepareSheetValues(poHeaders) },
        { title: "Chi tiết đơn hàng (PO Lines)", data: prepareSheetValues(poLines) },
        { title: "Nhật ký giao hàng", data: prepareSheetValues(deliveries) },
        { title: "Kế hoạch giao hàng", data: prepareSheetValues(deliveryPlans) },
        { title: "Quy cách kỹ thuật", data: prepareSheetValues(specs) },
        { title: "Lưu trữ tài liệu", data: prepareSheetValues(fileStorage) }
      ];

      const createRes = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          properties: {
            title: `[SAO LƯU DỮ LIỆU TSG] ${new Date().toLocaleDateString('vi-VN')} ${new Date().toLocaleTimeString('vi-VN')}`
          },
          sheets: sheetsConfig.map(s => ({
            properties: { title: s.title }
          }))
        })
      });

      const createData = await createRes.json();
      if (createData.error) throw new Error(createData.error.message || "Lỗi tạo file Google Sheets");

      const spreadsheetId = createData.spreadsheetId;
      if (spreadsheetId) {
        localStorage.setItem('google_spreadsheet_id', spreadsheetId);
        const valueData = sheetsConfig.map(s => ({
          range: `'${s.title}'!A1`,
          values: s.data
        }));

        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            valueInputOption: "USER_ENTERED",
            data: valueData
          })
        });

        const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
        setBackupUrl(url);
        setBackupStatus("Sao lưu toàn bộ dữ liệu thành công!");
        toast.success("Sao lưu toàn bộ dữ liệu ra Google Sheets thành công!", { id: toastId });
        window.open(url, "_blank");
      }
    } catch (error: any) {
      console.error("Backup error:", error);
      setBackupStatus(`Lỗi sao lưu: ${error.message}`);
      toast.error(`Sao lưu thất bại: ${error.message}`, { id: toastId });
    } finally {
      setIsBackingUp(false);
    }
  };

  return (
    <div className="flex-1 p-8 bg-gray-50 overflow-y-auto">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Cài đặt & Quản lý Dữ liệu</h2>
          <p className="text-sm text-gray-500 mt-1">Quản lý kết nối Google Workspace, nạp dữ liệu chuẩn và sao lưu dữ liệu toàn hệ thống</p>
        </div>

        {/* GOOGLE BACKUP MAIN SECTION */}
        <div className="bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-900 rounded-2xl text-white p-6 md:p-8 shadow-xl relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 opacity-10 pointer-events-none">
             <FileSpreadsheet size={320} />
          </div>
          
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
             <div className="space-y-3 max-w-xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-200 text-xs font-semibold uppercase tracking-wider">
                   <Sparkles size={14} className="text-emerald-300" /> Tính năng Sao lưu tự động
                </div>
                <h3 className="text-2xl font-bold text-white tracking-tight">
                   Sao lưu toàn bộ Dữ liệu ra Google Sheet
                </h3>
                <p className="text-emerald-100/90 text-sm leading-relaxed">
                   Xuất đồng bộ tất cả các bảng dữ liệu: <strong>Khách hàng, Nhà cung cấp, Bảng giá, Đơn đặt hàng (PO), Nhật ký giao hàng, Danh bạ, Sản phẩm</strong> ra một sổ tay Google Sheets chuyên nghiệp với từng trang tính (Sheet) riêng biệt.
                </p>
                {needsAuth ? (
                  <p className="text-xs text-amber-200 bg-amber-500/20 border border-amber-400/30 px-3 py-2 rounded-lg">
                    ⚠️ Yêu cầu kết nối tài khoản Google để tải trực tiếp lên Google Drive của bạn.
                  </p>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-emerald-200 bg-emerald-950/40 px-3 py-2 rounded-lg border border-emerald-500/20 w-fit">
                    <CheckCircle size={15} className="text-emerald-400" />
                    Tài khoản sẵn sàng: <strong>{user?.email}</strong>
                  </div>
                )}
             </div>

             <div className="w-full md:w-auto flex flex-col items-center gap-3">
                <button
                  onClick={handleBackupFullDataToSheets}
                  disabled={isBackingUp}
                  className="w-full md:w-auto px-6 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl transition-all shadow-lg hover:shadow-emerald-500/25 flex items-center justify-center gap-3 text-base active:scale-98 disabled:opacity-75 disabled:cursor-not-allowed"
                >
                  {isBackingUp ? (
                     <>
                        <RefreshCw className="animate-spin" size={20} />
                        <span>Đang sao lưu...</span>
                     </>
                  ) : (
                     <>
                        <FileSpreadsheet size={20} />
                        <span>Sao lưu ngay ra Google Sheet</span>
                     </>
                  )}
                </button>

                <div className="flex flex-wrap gap-2 w-full justify-center">
                  <button
                    onClick={handleDownloadLocalJsonBackup}
                    className="flex-1 md:flex-none px-3.5 py-2 bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-200 border border-emerald-500/30 font-medium rounded-lg transition-all text-xs flex items-center justify-center gap-1.5"
                    title="Tải tập tin sao lưu JSON chứa toàn bộ dữ liệu về máy vi tính"
                  >
                    <Download size={14} />
                    <span>Tải sao lưu JSON (Offline)</span>
                  </button>

                  <label 
                    className="flex-1 md:flex-none px-3.5 py-2 bg-blue-950/60 hover:bg-blue-900/80 text-blue-200 border border-blue-500/30 font-medium rounded-lg transition-all text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    title="Khôi phục dữ liệu từ tập tin JSON đã sao lưu trước đó"
                  >
                    <UploadCloud size={14} />
                    <span>Khôi phục từ file JSON</span>
                    <input 
                      type="file" 
                      accept=".json" 
                      onChange={handleRestoreJsonBackup} 
                      className="hidden" 
                    />
                  </label>
                </div>

                {backupStatus && (
                  <span className="text-xs text-emerald-200 text-center font-medium max-w-xs animate-fade-in">
                    {backupStatus}
                  </span>
                )}

                {backupUrl && (
                  <a
                    href={backupUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-emerald-300 hover:text-white underline font-medium"
                  >
                    <ExternalLink size={13} /> Mở Bảng tính Google Sheets đã sao lưu
                  </a>
                )}
             </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Google Account Settings */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex flex-col">
            <div className="flex items-center gap-3 mb-4">
               <Download className="text-emerald-600" size={24} />
               <h3 className="font-bold text-gray-900">Kết nối Google Workspace</h3>
            </div>
            <p className="text-sm text-gray-600 mb-6 flex-1">
               Kết nối tài khoản Google để cấp quyền tạo bảng tính Google Sheets, Slide báo cáo và giao diện tích hợp Google Calendar/Tasks.
            </p>
            
            {needsAuth ? (
               <button 
                onClick={handleLogin}
                disabled={isLoggingIn}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-medium bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
               >
                  <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-4 h-4" />
                  {isLoggingIn ? 'Đang kết nối...' : 'Đăng nhập với Google'}
               </button>
            ) : (
               <div className="space-y-3">
                 <div className="flex items-center justify-between bg-emerald-50 px-3.5 py-2.5 rounded-lg border border-emerald-100">
                    <div className="flex items-center gap-2 text-sm text-emerald-800 font-medium truncate">
                       <CheckCircle size={16} className="text-emerald-600 flex-shrink-0" />
                       <span className="truncate">{user?.email}</span>
                    </div>
                    <button onClick={logout} className="text-red-500 hover:text-red-700 p-1 rounded-md hover:bg-red-50" title="Đăng xuất">
                       <LogOut size={16} />
                    </button>
                 </div>
                 
                 <button 
                  onClick={handleBackupFullDataToSheets}
                  disabled={isBackingUp}
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-sm"
                 >
                    {isBackingUp ? <RefreshCw className="animate-spin" size={16} /> : <FileSpreadsheet size={16} />}
                    {isBackingUp ? 'Đang tạo Bảng tính...' : 'Xuất dữ liệu toàn hệ thống'}
                 </button>
               </div>
            )}
          </div>

          {/* AI Direct Assistant & Google API Diagnostic Control Card */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 rounded-2xl p-6 text-white border border-slate-800 shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-500/20 rounded-xl border border-blue-400/30">
                  <Sparkles className="text-blue-300 animate-pulse" size={22} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Trung Tâm Điều Hành AI & Chẩn Đoán Google API</h3>
                  <p className="text-slate-300 text-xs mt-0.5">Kết nối trực tiếp với Trợ lý AI và chẩn đoán đường truyền Google Sheets/Drive</p>
                </div>
              </div>
              <span className="px-3 py-1 bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 rounded-full text-xs font-semibold">
                Sẵn sàng 24/7
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700 space-y-2">
                <p className="font-bold text-blue-300 flex items-center gap-1.5 text-sm">
                  <Sparkles size={14} /> Chỉnh Sửa Trực Tiếp Cùng AI (Antigravity)
                </p>
                <p className="text-slate-300 text-xs leading-relaxed">
                  Bạn có thể ra lệnh bằng tiếng Việt trực tiếp với trợ lý AI tại cửa sổ Chat để:
                </p>
                <ul className="list-disc list-inside text-slate-300 text-[11px] space-y-1 font-mono bg-slate-950/60 p-2.5 rounded border border-slate-800">
                  <li>"Sửa giao diện bảng sang tối màu Indigo"</li>
                  <li>"Thêm trường thông tin mới vào Đơn hàng PO"</li>
                  <li>"Cấu hình tự động báo cáo doanh thu"</li>
                </ul>
              </div>

              <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700 space-y-3 flex flex-col justify-between">
                <div>
                  <p className="font-bold text-emerald-300 text-sm flex items-center gap-1.5">
                    <Database size={14} /> Google Spreadsheet ID Hiện Tại
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1 font-mono bg-slate-950 p-2 rounded border border-slate-800 truncate">
                    {localStorage.getItem('google_spreadsheet_id') || 'Chưa có Bảng tính kết nối (Bấm Đồng bộ Google để tự khởi tạo)'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const savedId = localStorage.getItem('google_spreadsheet_id');
                      if (savedId) {
                        window.open(`https://docs.google.com/spreadsheets/d/${savedId}`, '_blank');
                      } else {
                        toast.error('Chưa có Google Spreadsheet ID! Vui lòng ấn Đồng bộ Google trước.');
                      }
                    }}
                    className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium text-xs transition-colors flex items-center justify-center gap-1"
                  >
                    <ExternalLink size={13} /> Mở Google Sheet ↗
                  </button>
                  <button
                    onClick={handleDownloadLocalJsonBackup}
                    className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg font-medium text-xs transition-colors flex items-center justify-center gap-1"
                  >
                    <Download size={13} /> Tải Sao Lưu JSON
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
