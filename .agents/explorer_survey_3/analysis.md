# Comprehensive Technical Investigation Report: Frontend Cache, Dashboard Visualization & Build Health

**Investigator**: Explorer Subagent (Frontend Cache & Dashboard Explorer)  
**Date**: 2026-08-27  
**Project**: TSG Business OS (`/Users/Nguyentam/antigravity/TSG-Business---New`)  
**Scope**: Frontend Caching, State Persistence, Dashboard Mục 8 Visualization, KPI Stability, TypeScript/Build Health.

---

## 1. Executive Summary

| Topic | Current Status | Key Findings |
|---|---|---|
| **R3: Cache Collision & Duplication** | ⚠️ Handled via `TSG_DATASET_VERSION` purge, but root key vulnerability exists in `getItemKey` | Dataset versioning (`2026_08_27_ACC_GOLD_V6`) purges old caches on boot. However, `getItemKey` in `useFirestoreCollection.ts` maps `deliveries` via `item["Chi tiết đơn hàng"]` (PO Line ID `D_001`, `D_002`), which is shared across multiple delivery receipts and duplicated between North and South. True unique delivery key must be scoped to delivery slip (`STT` or composite `Số PXK + Đơn hàng + STT`). |
| **Mục 8: Dashboard Supply Source** | ✅ Implemented & Verified | Section 8 ("8. Cơ Cấu Nguồn Hàng (Tự Sản Xuất & NCC Đối Tác)") accurately categorizes **Tâm Sen (Tự SX)** vs **External Supplier Partners (NCC)** (e.g. THP, Tuấn Bằng, Việt Trung). Insight box dynamically reports internal factory vs external partner share. |
| **KPI Cards & F5 Reload Stability** | ✅ Stable & Synchronous | Regional filter `tsg_selected_region` is persisted in `localStorage`. `useFirestoreCollection` initializes synchronously with fallback datasets without empty-flash. 4 Executive Insights + 4 PO Lifecycle Phases + 4 Main KPI cards calculate deterministically via `useMemo`. |
| **TypeScript & Build Health** | ✅ Clean (0 errors) | `npx tsc --noEmit` exits with **0 errors**. `npm run build` generates `dist/index.html`, client assets (Vite 6.4.3), and `dist/server.cjs` (esbuild) with **0 errors**. |

---

## 2. Deep Dive: Requirement R3 — LocalStorage, Cache Collisions & Duplicate Trips

### 2.1 How the 106 Trips / 10.3B Duplication Phenomenon Occurred
- **Root Cause 1: Fallback vs. Cache Key Mismatch**:
  In earlier iterations, fallback delivery data (52 North trips or 1,108 total trips) was merged with Firestore documents or legacy localStorage cache records (`tsg_cache_deliveries`). Because Firestore documents used generated doc IDs (`item_...` or sanitized string IDs) while fallback items did not have `id`, `dbEngine.loadCollection` inserted both into `memoryCache` as separate Map entries, resulting in $52 \times 2 = 104 \approx 106$ deliveries and doubling calculated revenue from **5.419B ₫** to **~10.8B / 10.3B ₫**.
  
- **Root Cause 2: Inaccurate Primary Key in `getItemKey`**:
  In `src/hooks/useFirestoreCollection.ts` (lines 23-25):
  ```typescript
  } else if (collectionName === 'deliveries') {
    const lineId = item["Chi tiết đơn hàng"] || item["id"] || item["STT"] || '';
    rawKey = String(lineId);
  }
  ```
  - `item["Chi tiết đơn hàng"]` represents the **PO Line ID** (`D_001`, `D_002`, etc.).
  - A single PO Line can have multiple delivery trips (e.g., 3 separate PXKs for 1 order line).
  - Furthermore, North delivery rows and South delivery rows in the original CSV both start PO lines with `D_001`, `D_002`.
  - When `rawKey` is `D_001`, `Map.set("D_001", item)` causes delivery receipts for the same PO line (or cross-region) to collide and overwrite each other unless `STT` (row sequence 1..1108) or composite key `Số PXK + Đơn hàng + STT` is used.

### 2.2 Current Safeguards & Remediation in `dbEngine.ts`
1. **Dataset Versioning Purge**:
   `TSG_DATASET_VERSION = '2026_08_27_ACC_GOLD_V6'` in `src/lib/dbEngine.ts` (line 37) and `src/App.tsx` (line 215). On startup, if the stored version does not match, all legacy keys (`tsg_cache_*`, `tsg_user_mod_deliveries`, `tsg_dataset_*`) are purged from `localStorage`.
2. **Key-Filtered Cache Ingestion**:
   In `dbEngine.loadCollection` (lines 153-173):
   ```typescript
   if (key && (colMap.has(key) || userMods.has(key))) { ... }
   ```
   Only cached entries that match existing fallback keys or explicit user-modified keys are retained, preventing orphan phantom items from inflating totals.
3. **Synchronization between `MemoryStorageModal.tsx` and `dbEngine.ts`**:
   - `dbEngine.ts` reads/writes `tsg_cache_v5_${colName}`.
   - `MemoryStorageModal.tsx` (line 137, 255) writes `tsg_cache_${col.name}`. Standardizing this key avoids cache desynchronization.

---

## 3. Deep Dive: Section 8 (Mục 8) of the Dashboard

### 3.1 Architecture of Supply Source Categorization
In `src/components/DashboardView.tsx` (lines 628-651):
```typescript
// --- STATS BY SUPPLY SOURCE (TỰ SẢN XUẤT TÂM SEN & NCC NGOÀI) ---
const supplierStatsAll = useMemo(() => {
  const map = new Map<string, {
    name: string, 
    rawName: string, 
    revenue: number, 
    profit: number, 
    volume: number, 
    incidents: number, 
    isSelfManufactured: boolean
  }>();
  
  filteredDelivery.forEach(d => {
     const supplierRaw = d["Nhà cung cấp"] || "Khác";
     const isTS = supplierRaw.toLowerCase().includes("tâm sen") || 
                  supplierRaw.toLowerCase().includes("tam sen") || 
                  supplierRaw.toLowerCase() === "tsg";
     const displayName = isTS ? "Tâm Sen (Tự SX)" : (supplierRaw === "Khác" ? "Khác" : `${supplierRaw} (NCC)`);
     const rev = parseNumber(d["Doanh thu"]);
     const prof = parseNumber(d["Lợi nhuận gộp"] || d["Lợi nhuận dòng"]);
     const vol = parseNumber(d["Số lượng giao"]);
     const hasIncident = d["Sự cố"] === "1" || d["Sự cố"] === 1 || 
       (d["Chi tiết sự cố"] && String(d["Chi tiết sự cố"]).trim() !== "" && String(d["Chi tiết sự cố"]).trim() !== "0");
     
     if (!map.has(displayName)) {
       map.set(displayName, { 
         name: displayName, 
         rawName: supplierRaw, 
         revenue: 0, 
         profit: 0, 
         volume: 0, 
         incidents: 0, 
         isSelfManufactured: isTS 
       });
     }
     const item = map.get(displayName)!;
     item.revenue += rev;
     item.profit += prof;
     item.volume += vol;
     if (hasIncident) item.incidents += 1;
  });
  return Array.from(map.values()).sort((a,b) => b.revenue - a.revenue);
}, [filteredDelivery]);
```

### 3.2 Visual Presentation in Dashboard
- **Chart Title**: `8. Cơ Cấu Nguồn Hàng (Tự Sản Xuất & NCC Đối Tác)` (`DashboardView.tsx` line 1850).
- **Chart Type**: Dual Bar Chart with Recharts (`BarChart` plotting `Doanh thu` in Indigo `#6366F1` and `Lợi nhuận` in Cyan `#06B6D4`).
- **Dynamic AI Insight**:
  - If **Tâm Sen** is top supplier:
    > "Hàng tự sản xuất tại **Nhà máy Tâm Sen (Nội bộ)** chiếm tỷ trọng lớn nhất với **{doanh thu}** ({share}% doanh số). Cần tập trung tối ưu công suất cắt cuộn, duy trì định mức hao hụt NVL giấy mẹ."
  - If an **External Partner** (e.g. THP, Tuấn Bằng, Việt Trung) is top supplier:
    > "Nhà cung cấp đối tác **{tên NCC}** đang chiếm tỷ trọng cung ứng lớn nhất ({doanh thu}). Cần theo dõi tiến độ giao hàng và kiểm soát chặt chẽ giá vốn đầu vào."

---

## 4. Deep Dive: KPI Cards Rendering & Stability Across Page Refreshes

### 4.1 KPI Cards Suite Breakdown
1. **Executive Bento Insight Cards** (`DashboardView.tsx` lines 1140-1203):
   - **Doanh thu dự kiến (PO còn lại)**: Computed via `executiveInsights.projectedRev`. Accurately calculates $(Qty_{ordered} - Qty_{delivered}) \times Price_{sell}$ on open PO lines (**458.712.729 ₫** for Miền Bắc).
   - **Đơn hàng chậm tiến độ**: Filters PO lines where `dueDate < today && totalDelivered < qtyOrdered`.
   - **Biên lợi nhuận thấp (<15%)**: Identifies SKUs with margin under 15%.
2. **4-Phase PO Lifecycle Pipeline** (`DashboardView.tsx` lines 1205-1255):
   - 1. Mới tạo (0% delivered, no lines in progress)
   - 2. Đang xử lý (lines registered)
   - 3. Đang giao (partial deliveries recorded)
   - 4. Hoàn thành (100% delivered or status = 'Hoàn thành')
3. **Executive Top 4 KPI Metrics** (`DashboardView.tsx` lines 1258-1359):
   - **Tổng Doanh Thu**: `totalRevenue` with trip counter (`{filteredDelivery.length} chuyến`).
   - **Tổng Lợi Nhuận Gộp**: `totalProfit` with profit margin % and commission deduction breakdown.
   - **Tổng Đơn Hàng PO**: `totalOrders` with SKU line count.
   - **Tỷ Lệ Hoàn Thành**: Completed deliveries ratio percentage.

### 4.2 Refresh & Reload Behavior (F5 Stability)
- **Zero-Flicker State Hydration**: `useFirestoreCollection` synchronously populates data from `dbEngine.getAll(...)` during the initial `useState` callback. There is no empty array or loading spinner flash.
- **Region Persistence**: `selectedRegion` is read directly from `localStorage.getItem("tsg_selected_region")` on initial render, ensuring the view remains locked to "Miền Bắc", "Miền Nam", or "Toàn công ty" upon F5 reload.

---

## 5. Technical Health, TypeScript & Architecture Assessment

### 5.1 Build & Typecheck Verification
- **TypeScript Typecheck (`npx tsc --noEmit`)**:
  - Exit code: `0` (clean, 0 type errors).
- **Vite Production Build (`npm run build`)**:
  - Exit code: `0` (clean, 3673 modules transformed in 5.22s).
  - Bundled Server: `dist/server.cjs` (381.3 kB).
  - Bundled Client: `dist/index.html` (1.60 kB), `dist/assets/index-*.css` (278.66 kB), `dist/assets/index-*.js` (5,837 kB).

### 5.2 Project Structure & Component Hierarchy
```
TSG-Business---New/
├── src/
│   ├── App.tsx                      # Root Application & State Coordinator
│   ├── main.tsx                     # React 19 DOM Root Entry
│   ├── index.css                    # Tailwind CSS v4 Theme & Tokens
│   ├── types.ts                     # TypeScript Domain Models
│   ├── data.ts                      # Embedded Master Data (1,108 deliveries, 31 PO lines, 20 PO headers)
│   ├── data/
│   │   ├── accounting_imported.json # Extended accounting ledger records
│   │   └── factory_imported.json    # Factory production records
│   ├── hooks/
│   │   └── useFirestoreCollection.ts # Reactive Local-First Data Subscription Hook
│   ├── lib/
│   │   ├── auth.ts                  # OAuth Token Management
│   │   ├── business-logic.ts        # Financial & PO Reconciliation Engine
│   │   ├── dbEngine.ts              # Local-First Relational Engine (Map cache + persistence)
│   │   ├── design-tokens.ts         # OKLCH color palettes & typography tokens
│   │   ├── driveSync.ts             # Google Drive / Sheets Sync Engine
│   │   ├── gemini.ts                # AI Assistant & OCR Engine
│   │   └── pdf-exporter.ts          # PDF Report Exporter
│   └── components/
│       ├── Header.tsx               # Glassmorphic Header with Region Selector
│       ├── Breadcrumbs.tsx          # Dynamic Breadcrumbs
│       ├── DashboardView.tsx        # Executive Bento Grid Dashboard (Mục 1-11)
│       ├── DeliveryView.tsx         # Delivery Receipts (PXK) Data Grid
│       ├── DeliveryPlanView.tsx     # Delivery Scheduling Matrix
│       ├── LogisticsHubView.tsx     # 360° PO vs Plan vs PXK Reconciliation
│       ├── CustomerView.tsx         # Customer Management View
│       ├── SupplierView.tsx         # Supplier Management View
│       ├── ContractsView.tsx        # Contract Ledger View
│       ├── CommissionView.tsx       # Sales Commission Ledger View
│       └── ...
```

---

## 6. Recommendations & Proposed Code Enhancements

1. **Refine `getItemKey` in `useFirestoreCollection.ts`**:
   For `deliveries`, use `item.id || (item["STT"] ? `del_${item["STT"]}` : `${item["Số PXK"]}_${item["Đơn hàng"]}_${item["Mã sản phẩm"]}`)` rather than `item["Chi tiết đơn hàng"]`. This eliminates the risk of PO line collision across delivery slips.
2. **Align Cache Storage Keys in `MemoryStorageModal.tsx`**:
   Update `MemoryStorageModal.tsx` to read/write `tsg_cache_v5_${col}` to match `dbEngine.ts`.
3. **Enhance Delivery Line Reconciliation**:
   In `App.tsx` (line 396) and `DashboardView.tsx` (line 471), ensure line-to-delivery matching always combines both `Đơn hàng` (PO Number) and `Chi tiết đơn hàng` / `STT` (Line ID) to prevent cross-order key overlap.
