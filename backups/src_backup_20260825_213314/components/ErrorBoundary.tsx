import React, { Component, ErrorInfo, ReactNode } from 'react';
import { RefreshCw, AlertTriangle, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in React ErrorBoundary:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleClearAndReload = () => {
    try {
      // Clear potentially corrupt runtime cache while preserving user modifications
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith('tsg_cache_') && !k.startsWith('tsg_user_mod_')) {
          localStorage.removeItem(k);
        }
      });
    } catch (e) {}
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4 font-sans">
          <div className="max-w-lg w-full bg-slate-800/90 border border-slate-700/80 rounded-2xl shadow-2xl p-6 sm:p-8 backdrop-blur-md">
            {/* Apple macOS style header */}
            <div className="flex items-center gap-2 mb-6">
              <span className="w-3 h-3 rounded-full bg-red-500 inline-block"></span>
              <span className="w-3 h-3 rounded-full bg-amber-500 inline-block"></span>
              <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span>
              <span className="text-xs font-mono text-slate-400 ml-2">TSG Business OS • Phục hồi hệ thống</span>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0 text-amber-400">
                <AlertTriangle size={24} />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-bold text-white tracking-tight">Đã xảy ra sự cố hiển thị</h2>
                <p className="text-xs sm:text-sm text-slate-300 mt-1 leading-relaxed">
                  Hệ thống đã tự động bảo vệ an toàn toàn bộ dữ liệu của bạn. Bạn có thể làm mới trang để tiếp tục làm việc bình thường.
                </p>
              </div>
            </div>

            {this.state.error && (
              <div className="mt-4 p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-400 max-h-32 overflow-y-auto">
                {this.state.error.toString()}
              </div>
            )}

            <div className="mt-6 flex flex-col sm:flex-row items-center gap-3">
              <button
                onClick={this.handleReload}
                className="w-full sm:w-auto flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#0071E3] hover:bg-[#0066D6] text-white rounded-xl text-xs font-semibold shadow-lg shadow-blue-500/20 active:scale-98 transition-all"
              >
                <RefreshCw size={14} />
                <span>Tải lại trang</span>
              </button>
              <button
                onClick={this.handleClearAndReload}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-700/80 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium border border-slate-600/80 transition-all"
                title="Xóa bộ đệm tạm thời và tải lại"
              >
                <Home size={14} />
                <span>Khôi phục đệm & Tải lại</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
