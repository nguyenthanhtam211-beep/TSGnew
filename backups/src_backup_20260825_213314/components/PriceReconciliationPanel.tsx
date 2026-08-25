import React, { useState } from 'react';
import { 
  CheckCircle, AlertTriangle, AlertCircle, Sparkles, 
  HelpCircle, ShieldCheck, Calendar, Tag, Trash2, Plus, Search,
  ArrowRight, Info, Check, RefreshCw
} from 'lucide-react';
import { findPriceRecord, findMatchingSuggestions, parseNumber, formatVND } from '../lib/business-logic';
import { ProductHoverCard } from './ProductHoverCard';

export interface ReconciliationItem {
  id?: string;
  code: string; // OCR code or customer code
  name: string; // OCR name or scanned name
  unit: string;
  quantity: number;
  deliveryDate?: string; // OCR delivery date
  poPrice: number; // Price on PO document (if present)
  effectivePrice: number; // Selling price applied (from Bảng Giá)
  buyPrice: number; // Buy/Cost price (from Bảng Giá)
  priceCode?: string; // Mã giá (e.g., Gsp_082)
  masterProductCode?: string; // Mã SP trong Bảng Giá
  masterProductName?: string; // Tên SP trong Bảng Giá
  supplier?: string;
  notes?: string;
  [key: string]: any;
}

interface PriceReconciliationPanelProps {
  customer: string;
  items: ReconciliationItem[];
  pricingData: any[];
  onChangeItem: (index: number, updated: ReconciliationItem) => void;
  onApplyAllMasterPrices: () => void;
  isApproved: boolean;
  onToggleApproved: (val: boolean) => void;
  onRemoveItem?: (index: number) => void;
}

export function PriceReconciliationPanel({
  customer,
  items,
  pricingData,
  onChangeItem,
  onApplyAllMasterPrices,
  isApproved,
  onToggleApproved,
  onRemoveItem
}: PriceReconciliationPanelProps) {
  const [searchTerm, setSearchTerm] = useState("");

  // Filter pricing options for selected customer or all
  const customerPricing = React.useMemo(() => {
    if (!customer) return pricingData;
    const filtered = pricingData.filter(p => 
      p["RP_Khách hàng"] === customer || 
      p["Giao đến"] === customer ||
      p["Khách hàng"] === customer
    );
    return filtered.length > 0 ? filtered : pricingData;
  }, [pricingData, customer]);

  // Calculate totals safely
  const totalRevenue = items.reduce((sum, item: any) => {
    const eff = item.effectivePrice !== undefined ? parseNumber(item.effectivePrice) : (parseNumber(item["Đơn giá bán"]) || parseNumber(item.poPrice));
    const qty = item.quantity !== undefined ? parseNumber(item.quantity) : parseNumber(item["Số lượng"]);
    return sum + (eff * qty);
  }, 0);

  const totalCogs = items.reduce((sum, item: any) => {
    const buy = item.buyPrice !== undefined ? parseNumber(item.buyPrice) : parseNumber(item["Đơn giá nhập"]);
    const qty = item.quantity !== undefined ? parseNumber(item.quantity) : parseNumber(item["Số lượng"]);
    return sum + (buy * qty);
  }, 0);

  const totalProfit = totalRevenue - totalCogs;
  const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  // Count binding progress
  const boundCount = items.filter((item: any) => {
    const eff = item.effectivePrice !== undefined ? parseNumber(item.effectivePrice) : parseNumber(item["Đơn giá bán"]);
    return (item.priceCode && item.priceCode !== 'N/A' && item.priceCode !== 'Gsp_N/A') ||
      (item.masterProductCode && item.masterProductCode !== '') ||
      (eff > 0);
  }).length;

  const allBound = boundCount === items.length && items.length > 0;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-5 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
              <ShieldCheck size={20} />
            </span>
            <h3 className="font-bold text-slate-800 text-base">Hệ thống Bóc Tách PO & Gắn Giá Bảng Giá 2026</h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            OCR đã trích xuất Mã SP, Tên SP, SL & Ngày giao hàng từ PO ({customer || 'Khách hàng chưa chọn'}). Người lên đơn chọn gắn đúng Bảng Giá 2026 bên dưới để đảm bảo chính xác 100%.
          </p>
        </div>

        {boundCount < items.length && (
          <button
            type="button"
            onClick={onApplyAllMasterPrices}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-lg text-xs font-bold shadow-sm transition active:scale-95 shrink-0"
          >
            <Sparkles size={14} className="animate-pulse" />
            ⚡ Tự động khớp nhanh Bảng giá cho {items.length - boundCount} dòng
          </button>
        )}
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">Dự toán Doanh thu</span>
          <span className="text-base font-extrabold text-blue-700 block">{formatVND(totalRevenue)}</span>
          <span className="text-[10px] text-slate-400 mt-0.5 block">{items.length} mặt hàng trong PO</span>
        </div>

        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">Giá vốn (COGS)</span>
          <span className="text-base font-bold text-slate-700 block">{formatVND(totalCogs)}</span>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Giá nhập từ Bảng giá</span>
        </div>

        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">Lợi nhuận gộp</span>
          <div className="flex items-center gap-2">
            <span className="text-base font-extrabold text-emerald-600 block">{formatVND(totalProfit)}</span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${avgMargin >= 10 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
              {avgMargin.toFixed(1)}%
            </span>
          </div>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Biên lợi nhuận gộp</span>
        </div>

        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">Tiến độ Gắn Bảng Giá</span>
          <div className="flex items-center gap-1.5 mt-1">
            <span className={`text-sm font-extrabold ${allBound ? 'text-emerald-700' : 'text-amber-700'}`}>
              {boundCount} / {items.length}
            </span>
            <span className="text-xs text-slate-500">mặt hàng đã gắn</span>
          </div>
          <div className="w-full bg-slate-200 h-1.5 rounded-full mt-1.5 overflow-hidden">
            <div 
              className={`h-full transition-all duration-300 ${allBound ? 'bg-emerald-500' : 'bg-amber-500'}`}
              style={{ width: `${items.length > 0 ? (boundCount / items.length) * 100 : 0}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Main Table: Manual Price Binding */}
      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
        <div className="bg-slate-100/80 px-4 py-3 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
            <Tag size={16} className="text-blue-600" />
            <span>DANH SÁCH MẶT HÀNG PO & BẢNG BẮT CẶP BẢNG GIÁ 2026</span>
          </div>
          <span className="text-[11px] text-slate-500 italic">
            💡 Chọn trực tiếp sản phẩm trong Bảng Giá 2026 để gắn giá bán & giá nhập chính xác
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase text-slate-500 font-bold">
                <th className="px-3 py-3 w-8 text-center">#</th>
                <th className="px-3 py-3 min-w-[200px]">Thông tin PO (OCR Quét)</th>
                <th className="px-3 py-3 min-w-[120px] text-center">Ngày giao hàng</th>
                <th className="px-3 py-3 min-w-[260px]">Gắn với Bảng Giá 2026 (Thủ công)</th>
                <th className="px-3 py-3 w-28 text-right">Đơn giá bán</th>
                <th className="px-3 py-3 w-32 text-right">Thành tiền dòng</th>
                <th className="px-3 py-3 w-10 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {items.map((item, idx) => {
                const queryText = `${item.code || ''} ${item.name || ''}`.trim();

                // Find suggested price record in customer pricing
                const suggestedRecord = findPriceRecord(pricingData, { 
                  sku: item.code, 
                  name: item.name,
                  customer 
                });

                const topSuggestions = findMatchingSuggestions(pricingData, queryText, customer, 3);

                const suggestedSell = suggestedRecord ? (
                  parseNumber(suggestedRecord['Giá bán']) || 
                  parseNumber(suggestedRecord['Đơn giá bán']) || 
                  parseNumber(suggestedRecord['Đơn giá bán mới'])
                ) : 0;

                const suggestedBuy = suggestedRecord ? (
                  parseNumber(suggestedRecord['Giá nhập']) || 
                  parseNumber(suggestedRecord['Đơn giá mua'])
                ) : 0;

                const suggestedPriceCode = suggestedRecord ? (suggestedRecord['Mã giá'] || suggestedRecord['Mã giá bán']) : '';

                // Safe extraction of properties supporting both formats
                const itemName = (item as any).name || (item as any)["Tên sản phẩm"] || (item as any).masterProductName || "Sản phẩm chưa đặt tên";
                const itemCode = (item as any).code || (item as any)["Mã sản phẩm"] || (item as any).masterProductCode || "";
                const itemUnit = (item as any).unit || (item as any)["ĐVT"] || "Cái";
                const itemQty = (item as any).quantity !== undefined ? parseNumber((item as any).quantity) : parseNumber((item as any)["Số lượng"]);
                const itemEffPrice = (item as any).effectivePrice !== undefined ? parseNumber((item as any).effectivePrice) : (parseNumber((item as any)["Đơn giá bán"]) || parseNumber((item as any).poPrice));
                const itemBuyPrice = (item as any).buyPrice !== undefined ? parseNumber((item as any).buyPrice) : parseNumber((item as any)["Đơn giá nhập"]);
                const lineTotal = itemEffPrice * itemQty;

                // Is currently bound?
                const isBound = Boolean(
                  item.masterProductCode || 
                  (item.priceCode && item.priceCode !== 'N/A' && item.priceCode !== 'Gsp_N/A') ||
                  itemEffPrice > 0
                );

                return (
                  <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                    {/* Index */}
                    <td className="px-3 py-3 text-center text-slate-400 font-mono font-medium">{idx + 1}</td>

                    {/* OCR Info: Scanned Code, Name, Qty */}
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-900 text-xs">{itemName}</span>
                        <ProductHoverCard productName={itemName} productCode={itemCode} pricingData={pricingData}>
                          <button type="button" className="text-slate-400 hover:text-blue-600 transition">
                            <HelpCircle size={13} />
                          </button>
                        </ProductHoverCard>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-1">
                        <span className="font-mono bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded font-semibold text-slate-700">
                          {itemCode || 'Mã SP'}
                        </span>
                        <span>SL: <strong className="text-slate-800 font-mono font-bold">{itemQty.toLocaleString('vi-VN')}</strong> {itemUnit}</span>
                        {(item.poPrice || 0) > 0 && (
                          <span className="text-slate-400">| Giá PO: {formatVND(item.poPrice)}</span>
                        )}
                      </div>
                    </td>

                    {/* Delivery Date */}
                    <td className="px-3 py-3 text-center">
                      <div className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-700">
                        <Calendar size={13} className="text-blue-600 shrink-0" />
                        <input
                          type="text"
                          value={item.deliveryDate || ""}
                          placeholder="DD/MM/YYYY"
                          onChange={(e) => {
                            onChangeItem(idx, { ...item, deliveryDate: e.target.value });
                          }}
                          className="w-24 text-center bg-transparent border-none outline-none font-medium focus:ring-1 focus:ring-blue-500 rounded text-slate-800"
                        />
                      </div>
                    </td>

                    {/* Manual Pricing Binding Selector */}
                    <td className="px-3 py-3 space-y-1.5">
                      <div className="relative">
                        <select
                          value={item.masterProductCode || item.code || ""}
                          onChange={(e) => {
                            const selectedCode = e.target.value;
                            const rec = customerPricing.find(p => p["Mã sản phẩm"] === selectedCode) || 
                                        pricingData.find(p => p["Mã sản phẩm"] === selectedCode);
                            if (rec) {
                              const sell = parseNumber(rec["Giá bán"] || rec["Đơn giá bán"] || rec["Đơn giá bán mới"]);
                              const buy = parseNumber(rec["Giá nhập"] || rec["Đơn giá mua"]);
                              const pCode = rec["Mã giá"] || rec["Mã giá bán"] || "Gsp_N/A";
                              const supplier = rec["RP_Nhà cung cấp"] || rec["Nhà cung cấp"] || "Tâm Sen";

                              onChangeItem(idx, {
                                ...item,
                                masterProductCode: rec["Mã sản phẩm"],
                                masterProductName: rec["Tên sản phẩm"],
                                effectivePrice: sell,
                                buyPrice: buy,
                                priceCode: pCode,
                                supplier: supplier,
                                notes: `Bound with ${rec["Mã sản phẩm"]}`
                              });
                            }
                          }}
                          className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        >
                          <option value="">-- Chọn gắn mặt hàng Bảng giá 2026 --</option>
                          {topSuggestions.length > 0 && (
                            <optgroup label="✨ Gợi ý khớp từ khóa tốt nhất">
                              {topSuggestions.map((p, pIdx) => {
                                const pSell = parseNumber(p["Giá bán"] || p["Đơn giá bán"] || p["Đơn giá bán mới"]);
                                const pBuy = parseNumber(p["Giá nhập"] || p["Đơn giá mua"]);
                                return (
                                  <option key={`sug-${pIdx}`} value={p["Mã sản phẩm"]}>
                                    ⭐ [{p["Mã sản phẩm"]}] {p["Tên sản phẩm"]} - Giá bán: {formatVND(pSell)}
                                  </option>
                                );
                              })}
                            </optgroup>
                          )}
                          <optgroup label="📋 Bảng giá khách hàng">
                            {customerPricing.map((p, pIdx) => {
                              const pSell = parseNumber(p["Giá bán"] || p["Đơn giá bán"] || p["Đơn giá bán mới"]);
                              const pBuy = parseNumber(p["Giá nhập"] || p["Đơn giá mua"]);
                              return (
                                <option key={pIdx} value={p["Mã sản phẩm"]}>
                                  [{p["Mã sản phẩm"]}] {p["Tên sản phẩm"]} - Giá bán: {formatVND(pSell)} | Giá nhập: {formatVND(pBuy)}
                                </option>
                              );
                            })}
                          </optgroup>
                        </select>
                      </div>

                      {/* Status / Quick Suggestion Chips */}
                      <div className="flex flex-wrap items-center gap-1 text-[11px]">
                        {isBound ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 font-bold">
                            <Check size={12} />
                            Đã gắn: {item.priceCode || 'Bảng giá'} ({formatVND(item.effectivePrice)})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 font-semibold shrink-0">
                            <AlertCircle size={12} />
                            Chưa chọn Bảng giá
                          </span>
                        )}

                        {!isBound && topSuggestions.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1 mt-0.5">
                            {topSuggestions.map((sug, sIdx) => {
                              const sugSell = parseNumber(sug["Giá bán"] || sug["Đơn giá bán"] || sug["Đơn giá bán mới"]);
                              const sugBuy = parseNumber(sug["Giá nhập"] || sug["Đơn giá mua"]);
                              const sugCode = sug["Mã giá"] || sug["Mã giá bán"] || "Gsp_N/A";
                              return (
                                <button
                                  key={sIdx}
                                  type="button"
                                  onClick={() => {
                                    onChangeItem(idx, {
                                      ...item,
                                      masterProductCode: sug["Mã sản phẩm"],
                                      masterProductName: sug["Tên sản phẩm"],
                                      effectivePrice: sugSell,
                                      buyPrice: sugBuy,
                                      priceCode: sugCode,
                                      supplier: sug["RP_Nhà cung cấp"] || sug["Nhà cung cấp"]
                                    });
                                  }}
                                  className="inline-flex items-center gap-1 text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-md transition font-bold border border-blue-200 cursor-pointer text-[10px]"
                                  title={`Khớp từ khóa sản phẩm: ${sug["Tên sản phẩm"]}`}
                                >
                                  <Sparkles size={11} className="text-amber-500 shrink-0" />
                                  Gợi ý: [{sug["Mã sản phẩm"]}] {sug["Tên sản phẩm"]} ({formatVND(sugSell)})
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Effective Selling Price */}
                    <td className="px-3 py-3 text-right">
                      <div className="inline-flex flex-col items-end">
                        <input
                          type="number"
                          value={itemEffPrice || 0}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            onChangeItem(idx, { 
                              ...item, 
                              effectivePrice: val, 
                              "Đơn giá bán": val,
                              "Thành tiền dòng": val * itemQty 
                            });
                          }}
                          className="w-24 text-right border border-slate-200 rounded-lg p-1.5 font-mono font-bold text-blue-700 focus:ring-2 focus:ring-blue-500 outline-none text-xs"
                        />
                        <span className="text-[9px] text-slate-400 mt-0.5">Giá vốn: {formatVND(itemBuyPrice || 0)}</span>
                      </div>
                    </td>

                    {/* Line Total */}
                    <td className="px-3 py-3 text-right font-mono font-extrabold text-blue-800 text-sm">
                      {formatVND(lineTotal)}
                    </td>

                    {/* Delete Item Action */}
                    <td className="px-3 py-3 text-center">
                      {onRemoveItem && (
                        <button
                          type="button"
                          onClick={() => onRemoveItem(idx)}
                          className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition"
                          title="Xóa dòng mặt hàng này"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Checkbox */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="approvalCheckbox"
            checked={isApproved}
            onChange={(e) => onToggleApproved(e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
          />
          <label htmlFor="approvalCheckbox" className="text-xs font-semibold text-slate-800 cursor-pointer select-none">
            Xác nhận đã kiểm tra kỹ chi tiết PO và gắn đúng Đơn giá trong Bảng Giá 2026 cho đơn hàng
          </label>
        </div>

        <div className="text-xs text-slate-500 font-medium shrink-0">
          Trạng thái gắn giá: {isApproved ? (
            <span className="text-emerald-700 font-bold bg-emerald-100 px-3 py-1 rounded-md">
              ✓ Đã sẵn sàng phát hành đơn hàng
            </span>
          ) : (
            <span className="text-amber-700 font-bold bg-amber-100 px-3 py-1 rounded-md">
              ⏳ Chờ người lên đơn xác nhận gắn giá
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
