import React, { useState } from 'react';
import { FileSpreadsheet, ExternalLink, RefreshCw, CheckCircle2, AlertCircle, Database, BarChart3, Copy, Check, Sparkles, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { ensureGoogleToken, clearStoredGoogleToken, openGoogleAuthTab } from '../lib/auth';

interface GoogleSheetsSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  deliveries?: any[];
  poLines?: any[];
  poHeaders?: any[];
  customers?: any[];
}

export default function GoogleSheetsSyncModal({
  isOpen,
  onClose,
  deliveries = [],
  poLines = [],
  poHeaders = [],
  customers = []
}: GoogleSheetsSyncModalProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [copiedBigQuery, setCopiedBigQuery] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    spreadsheetId: string;
    spreadsheetUrl: string;
    lookerStudioUrl: string;
    summary: {
      deliveriesCount: number;
      dailySummariesCount: number;
      poLinesCount: number;
      customersCount?: number;
      syncedAt: string;
    };
  } | null>(() => {
    const saved = localStorage.getItem('google_sheets_sync_result');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  if (!isOpen) return null;

  const savedSheetId = syncResult?.spreadsheetId || localStorage.getItem('google_spreadsheet_id') || '';

  const handleSync = async (createNew = false) => {
    setIsSyncing(true);
    const loadingToast = toast.loading('Đang chuẩn bị dữ liệu và đồng bộ tới Google Sheets...');

    try {
      let token = await ensureGoogleToken([
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive.file'
      ]);

      const spreadsheetIdToSend = createNew ? '' : savedSheetId;

      let response = await fetch('/api/sheets/sync', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          spreadsheetId: spreadsheetIdToSend,
          deliveries,
          poLines,
          poHeaders,
          customers
        })
      });

      if (response.status === 401) {
        clearStoredGoogleToken();
        token = await ensureGoogleToken([
          'https://www.googleapis.com/auth/spreadsheets',
          'https://www.googleapis.com/auth/drive.file'
        ], true);
        response = await fetch('/api/sheets/sync', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            spreadsheetId: spreadsheetIdToSend,
            deliveries,
            poLines,
            poHeaders,
            customers
          })
        });
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Đồng bộ thất bại. Vui lòng kiểm tra lại quyền Google Sheets.');
      }

      // Save spreadsheet ID and sync result
      if (data.spreadsheetId) {
        localStorage.setItem('google_spreadsheet_id', data.spreadsheetId);
      }
      localStorage.setItem('google_sheets_sync_result', JSON.stringify(data));
      setSyncResult(data);

      toast.success('Đồng bộ thành công dữ liệu báo cáo sang Google Sheets!', { id: loadingToast });
    } catch (err: any) {
      console.error('Sync error:', err);
      toast.error(err.message || 'Lỗi khi đồng bộ Google Sheets', { id: loadingToast });
    } finally {
      setIsSyncing(false);
    }
  };

  const bigQuerySql = syncResult ? `CREATE OR REPLACE EXTERNAL TABLE \`your_project_id.your_dataset.daily_deliveries\`
OPTIONS (
  format = 'GOOGLE_SHEETS',
  uris = ['${syncResult.spreadsheetUrl}'],
  sheet_range = 'Daily_Deliveries_LookerStudio',
  skip_leading_rows = 1
);` : '';

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedBigQuery(true);
    toast.success('Đã sao chép câu lệnh SQL BigQuery!');
    setTimeout(() => setCopiedBigQuery(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden border border-slate-100 my-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 p-6 text-white relative">
          <button 
            onClick={onClose}
            className="absolute top-5 right-5 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors"
          >
            <X size={18} />
          </button>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white/15 rounded-xl backdrop-blur-md">
              <FileSpreadsheet size={28} className="text-emerald-100" />
            </div>
            <div>
              <h3 className="text-xl font-bold tracking-tight">Đồng bộ Google Sheets (BI & Looker Studio / BigQuery)</h3>
              <p className="text-emerald-100 text-xs mt-1">Chuẩn hóa dữ liệu phẳng, tự động ép kiểu Ngày/Số tương thích 100% với Looker Studio & BigQuery</p>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Action Buttons */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <div className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Sparkles size={16} className="text-emerald-600" />
                Đồng bộ Báo cáo Hàng ngày & PO
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {savedSheetId ? `Bảng tính hiện tại: ID ...${savedSheetId.slice(-8)}` : 'Chưa có Bảng tính kết nối.'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <button
                onClick={openGoogleAuthTab}
                className="px-3 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors flex items-center gap-1.5"
                title="Mở tab mới để đăng nhập Google không bị chặn"
              >
                <ExternalLink size={14} />
                <span>Mở Tab Mới</span>
              </button>

              {savedSheetId && (
                <button
                  onClick={() => handleSync(true)}
                  disabled={isSyncing}
                  className="px-3 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-50"
                  title="Tạo file Google Sheets mới hoàn toàn"
                >
                  Tạo File mới
                </button>
              )}
              <button
                onClick={() => handleSync(false)}
                disabled={isSyncing}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition-all shadow-md hover:shadow-emerald-600/20 disabled:opacity-50"
              >
                {isSyncing ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    Đang xuất dữ liệu...
                  </>
                ) : (
                  <>
                    <RefreshCw size={16} />
                    {savedSheetId ? 'Đồng bộ Cập nhật' : 'Tạo & Đồng bộ ngay'}
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Sync Result Links & Details */}
          {syncResult && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3">
                <CheckCircle2 size={20} className="text-emerald-600 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-emerald-900">Đã cập nhật dữ liệu thành công!</h4>
                  <p className="text-xs text-emerald-700 mt-0.5">
                    Thời gian đồng bộ: {new Date(syncResult.summary.syncedAt).toLocaleString('vi-VN')} | {syncResult.summary.deliveriesCount} bản ghi giao hàng | {syncResult.summary.poLinesCount} dòng PO
                  </p>
                </div>
              </div>

              {/* Quick Links */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <a
                  href={syncResult.spreadsheetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="p-4 rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50/50 to-white hover:border-emerald-400 hover:shadow-md transition-all group flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-lg group-hover:scale-105 transition-transform">
                      <FileSpreadsheet size={20} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800">Mở File Google Sheets</div>
                      <div className="text-[11px] text-slate-500">Xem toàn bộ 3 Bảng dữ liệu phẳng</div>
                    </div>
                  </div>
                  <ExternalLink size={16} className="text-slate-400 group-hover:text-emerald-600 transition-colors" />
                </a>

                <a
                  href={syncResult.lookerStudioUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="p-4 rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50/50 to-white hover:border-blue-400 hover:shadow-md transition-all group flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-100 text-blue-700 rounded-lg group-hover:scale-105 transition-transform">
                      <BarChart3 size={20} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800">Tạo Báo cáo Looker Studio</div>
                      <div className="text-[11px] text-slate-500">Kết nối trực tiếp vào Looker Studio BI</div>
                    </div>
                  </div>
                  <ExternalLink size={16} className="text-slate-400 group-hover:text-blue-600 transition-colors" />
                </a>
              </div>

              {/* BigQuery Integration Box */}
              <div className="bg-slate-900 rounded-xl p-4 text-slate-200 space-y-3 border border-slate-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider">
                    <Database size={15} />
                    Kết nối Google BigQuery (External Table SQL)
                  </div>
                  <button
                    onClick={() => copyToClipboard(bigQuerySql)}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition-colors"
                  >
                    {copiedBigQuery ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                    {copiedBigQuery ? 'Đã sao chép' : 'Sao chép SQL'}
                  </button>
                </div>
                <div className="bg-slate-950 p-3 rounded-lg overflow-x-auto text-[11px] font-mono text-slate-300 border border-slate-800 leading-relaxed">
                  {bigQuerySql}
                </div>
                <p className="text-[11px] text-slate-400 italic">
                  * Chạy câu lệnh SQL trên trong BigQuery console để tạo Bảng liên kết tự động truy vấn dữ liệu từ Google Sheet này mà không tốn chi phí lưu trữ.
                </p>
              </div>
            </div>
          )}

          {/* Sheet Format Specifications */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Cấu trúc 3 Bảng Dữ liệu đã định dạng sẵn:</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  Daily_Deliveries_LookerStudio
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Bảng chi tiết giao hàng phẳng (Flat table), 1 dòng / 1 sản phẩm giao. Đơn giá, doanh thu, lợi nhuận, ngày ISO YYYY-MM-DD.
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  Daily_Summary_Aggregated
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Tổng hợp theo ngày cho biểu đồ chuỗi thời gian (Time-series charts) trong Looker Studio: Tổng số lượng, doanh thu, lợi nhuận, margin %.
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                  PO_Lines_LookerStudio
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Theo dõi tiến độ đơn hàng PO: Số lượng đặt, đã giao, còn lại, % hoàn thành, hạn giao hàng ISO.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>* Định dạng tự động hóa dữ liệu phẳng cho BI Dashboard</span>
          <button
            onClick={onClose}
            className="px-4 py-2 font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
