import React, { useState, useEffect } from 'react';
import { 
  Cloud, RefreshCw, ExternalLink, Download, ArrowUpRight, 
  CheckCircle, AlertCircle, X, FileSpreadsheet, ShieldCheck, 
  UploadCloud, ArrowDownRight, HardDrive, FileCheck, Layers
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { 
  getStoredSpreadsheetId, getDriveFileUrl, getExcelDownloadUrl, 
  pushMasterDataToDrive, pullMasterDataFromDrive, MASTER_SHEET_TITLE,
  DriveSyncPayload
} from '../lib/driveSync';
import { ensureGoogleToken, openGoogleAuthTab, getStoredGoogleToken } from '../lib/auth';

interface GoogleDriveSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: DriveSyncPayload;
}

export default function GoogleDriveSyncModal({ isOpen, onClose, data }: GoogleDriveSyncModalProps) {
  const [isPushing, setIsPushing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [spreadsheetId, setSpreadsheetId] = useState<string>('');
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const storedId = getStoredSpreadsheetId();
      setSpreadsheetId(storedId);
      const last = localStorage.getItem('google_last_sync_time');
      if (last) setLastSyncTime(last);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const driveUrl = getDriveFileUrl(spreadsheetId);
  const excelDownloadUrl = getExcelDownloadUrl(spreadsheetId);

  // 1. ERP ➔ Google Drive (Đẩy lên Drive)
  const handlePushToDrive = async () => {
    setIsPushing(true);
    const toastId = toast.loading("Đang đồng bộ dữ liệu lên Google Drive...");
    try {
      let token = getStoredGoogleToken();
      if (!token) {
        token = await ensureGoogleToken();
      }
      if (!token) throw new Error("Chưa có quyền truy cập Google Account.");

      const result = await pushMasterDataToDrive(token, data);
      setSpreadsheetId(result.spreadsheetId);
      const timeStr = new Date().toLocaleString('vi-VN');
      setLastSyncTime(timeStr);
      localStorage.setItem('google_last_sync_time', timeStr);

      toast.success("Đã đồng bộ toàn bộ bảng dữ liệu lên Google Drive thành công!", { id: toastId });
    } catch (err: any) {
      console.error("Push to Drive error:", err);
      toast.error(`Đồng bộ thất bại: ${err.message || err}`, { id: toastId });
    } finally {
      setIsPushing(false);
    }
  };

  // 2. Google Drive ➔ ERP (Kéo về ERP)
  const handlePullFromDrive = async () => {
    if (!spreadsheetId) {
      toast.error("Vui lòng thực hiện 'Đẩy lên Google Drive' lần đầu để tạo bảng tính trung tâm.");
      return;
    }

    if (!confirm("Bạn có chắc chắn muốn nạp dữ liệu từ Google Sheets về hệ thống ERP? Dữ liệu trên hệ thống sẽ được cập nhật đồng bộ.")) {
      return;
    }

    setIsPulling(true);
    const toastId = toast.loading("Đang đọc dữ liệu mới nhất từ Google Drive về ERP...");
    try {
      let token = getStoredGoogleToken();
      if (!token) {
        token = await ensureGoogleToken();
      }
      if (!token) throw new Error("Chưa có quyền truy cập Google Account.");

      const result = await pullMasterDataFromDrive(token, spreadsheetId);
      const timeStr = new Date().toLocaleString('vi-VN');
      setLastSyncTime(timeStr);
      localStorage.setItem('google_last_sync_time', timeStr);

      toast.success(
        `Đã kéo về thành công: ${result.contactsCount} danh bạ, ${result.customersCount} khách hàng, ${result.suppliersCount} nhà cung cấp!`, 
        { id: toastId }
      );
    } catch (err: any) {
      console.error("Pull from Drive error:", err);
      toast.error(`Kéo dữ liệu thất bại: ${err.message || err}`, { id: toastId });
    } finally {
      setIsPulling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
        
        {/* Header - Apple macOS Modal Style */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 via-white to-blue-50/40">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <Cloud size={24} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                Kho Dữ Liệu Đồng Bộ Google Drive
                <span className="text-[10px] px-2 py-0.5 bg-blue-100 text-blue-800 font-semibold rounded-full">2-Way Sync</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Lưu trữ master spreadsheet, chỉnh sửa trên Sheets và đồng bộ 2 chiều tức thì
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs sm:text-sm">

          {/* Drive File Status Box */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet className="text-emerald-600 shrink-0" size={22} />
                <div>
                  <div className="font-bold text-slate-900 text-sm">{MASTER_SHEET_TITLE}</div>
                  <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                    {spreadsheetId ? `ID: ${spreadsheetId}` : 'Chưa khởi tạo tệp Master trên Drive'}
                  </div>
                </div>
              </div>

              {spreadsheetId ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-lg shrink-0">
                  <CheckCircle size={13} /> Đã kết nối Drive
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-100 px-2.5 py-1 rounded-lg shrink-0">
                  <AlertCircle size={13} /> Sẵn sàng tạo mới
                </span>
              )}
            </div>

            {lastSyncTime && (
              <div className="text-[11px] text-slate-400 flex items-center gap-1.5 pt-2 border-t border-slate-200/60">
                <RefreshCw size={11} className="text-blue-500" />
                Đồng bộ lần cuối: <strong className="text-slate-700">{lastSyncTime}</strong>
              </div>
            )}
          </div>

          {/* Direct Access & Download Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <a
              href={driveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`p-3.5 rounded-2xl border flex items-center justify-between transition-all ${
                spreadsheetId 
                  ? 'bg-blue-50/70 border-blue-200 text-blue-900 hover:bg-blue-100 hover:border-blue-300 shadow-2xs' 
                  : 'bg-slate-50 border-slate-200 text-slate-400 pointer-events-none'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <ExternalLink size={18} className="text-blue-600" />
                <div className="text-left">
                  <div className="font-bold text-xs">Mở trên Google Drive</div>
                  <div className="text-[11px] opacity-75">Xem & chỉnh sửa trực tiếp</div>
                </div>
              </div>
              <ArrowUpRight size={16} className="text-blue-600" />
            </a>

            <a
              href={excelDownloadUrl || '#'}
              download
              className={`p-3.5 rounded-2xl border flex items-center justify-between transition-all ${
                spreadsheetId 
                  ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900 hover:bg-emerald-100 hover:border-emerald-300 shadow-2xs' 
                  : 'bg-slate-50 border-slate-200 text-slate-400 pointer-events-none'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Download size={18} className="text-emerald-600" />
                <div className="text-left">
                  <div className="font-bold text-xs">Tải Excel (.xlsx) từ Drive</div>
                  <div className="text-[11px] opacity-75">Tải về máy tính tức thì</div>
                </div>
              </div>
              <Download size={16} className="text-emerald-600" />
            </a>
          </div>

          {/* 2-Way Synchronization Actions */}
          <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-4">
            <div>
              <div className="font-bold text-sm text-slate-100 flex items-center gap-2">
                <RefreshCw size={16} className="text-blue-400" />
                Thao tác Đồng bộ 2 Chiều (Bi-Directional Sync)
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Lựa chọn hướng đồng bộ giữa hệ thống ERP và Google Sheets trên Drive của bạn.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {/* Push Action */}
              <button
                onClick={handlePushToDrive}
                disabled={isPushing || isPulling}
                className="p-3.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all shadow-md flex items-center justify-center gap-2 text-xs active:scale-98 disabled:opacity-60"
              >
                {isPushing ? (
                  <>
                    <RefreshCw className="animate-spin" size={16} />
                    <span>Đang đẩy lên Drive...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud size={16} />
                    <span>(1) Đẩy ERP ➔ Google Drive</span>
                  </>
                )}
              </button>

              {/* Pull Action */}
              <button
                onClick={handlePullFromDrive}
                disabled={isPushing || isPulling || !spreadsheetId}
                className="p-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition-all shadow-md flex items-center justify-center gap-2 text-xs active:scale-98 disabled:opacity-60"
              >
                {isPulling ? (
                  <>
                    <RefreshCw className="animate-spin" size={16} />
                    <span>Đang kéo về ERP...</span>
                  </>
                ) : (
                  <>
                    <ArrowDownRight size={16} />
                    <span>(2) Kéo Google Drive ➔ ERP</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Sync Information Guide */}
          <div className="p-3.5 bg-blue-50/60 rounded-2xl border border-blue-100/80 text-blue-900 text-xs space-y-1.5">
            <div className="font-bold flex items-center gap-1.5">
              <ShieldCheck size={15} className="text-blue-600" />
              Cách dữ liệu được lưu trữ & đồng bộ:
            </div>
            <ul className="list-disc list-inside space-y-1 text-slate-600 pl-1 text-[11px]">
              <li>Bảng tính chứa đầy đủ các tab: <strong>Danh bạ</strong>, <strong>Khách hàng</strong>, <strong>Nhà cung cấp</strong>, <strong>Sản phẩm</strong>, <strong>PO</strong>.</li>
              <li>Bạn có thể vào Google Drive chỉnh sửa thông tin nhân sự/khách hàng, sau đó bấm <strong>"(2) Kéo Google Drive ➔ ERP"</strong> để cập nhật ngay.</li>
              <li>Bạn có thể tải file Excel về máy tính bất cứ lúc nào qua nút <strong>"Tải Excel (.xlsx) từ Drive"</strong>.</li>
            </ul>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 flex justify-end bg-slate-50/80">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition-all shadow-2xs"
          >
            Đóng
          </button>
        </div>

      </div>
    </div>
  );
}
