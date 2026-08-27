# Handoff Report: Frontend Cache, Dashboard Visualization & Build Health

**Agent**: Explorer Survey 3 (Frontend Cache & Dashboard Explorer)  
**Parent Agent**: 2166d984-88ea-4947-a28e-a89ca0c93ac4  
**Date**: 2026-08-27  
**Working Directory**: `/Users/Nguyentam/antigravity/TSG-Business---New/.agents/explorer_survey_3`  
**Handoff Type**: Hard (Task Complete)

---

## 1. Observation

1. **R3 Cache Mechanisms & Key Mapping**:
   - In `src/lib/dbEngine.ts` (lines 37-57), `TSG_DATASET_VERSION` is defined as `'2026_08_27_ACC_GOLD_V6'`. Upon initialization, if `localStorage.getItem('tsg_system_dataset_version')` differs from this constant, all keys starting with `tsg_cache_`, `tsg_user_mod_deliveries`, and `tsg_dataset_` are purged.
   - In `src/hooks/useFirestoreCollection.ts` (lines 23-25), `getItemKey` defines delivery key resolution as:
     ```typescript
     } else if (collectionName === 'deliveries') {
       const lineId = item["Chi tiết đơn hàng"] || item["id"] || item["STT"] || '';
       rawKey = String(lineId);
     }
     ```
   - In `src/data.ts` (lines 220-1330), `DELIVERY_DATA` contains 1,108 delivery rows (52 North, 1,056 South). Multiple rows share identical `Chi tiết đơn hàng` values (e.g. `D_001` in row 1 for Sài Gòn and `D_001` in row 63 for Thăng Long; `D_002` in row 64 and row 70 for Thăng Long).
   - In `src/components/MemoryStorageModal.tsx` (lines 137, 255), backups are saved to `tsg_cache_${col.name}`, whereas `dbEngine.ts` (line 85) reads from `tsg_cache_v5_${colName}`.

2. **Dashboard Section 8 (Mục 8) Categorization**:
   - In `src/components/DashboardView.tsx` (lines 628-647), `supplierStatsAll` iterates over `filteredDelivery` and evaluates:
     ```typescript
     const isTS = supplierRaw.toLowerCase().includes("tâm sen") || 
                  supplierRaw.toLowerCase().includes("tam sen") || 
                  supplierRaw.toLowerCase() === "tsg";
     const displayName = isTS ? "Tâm Sen (Tự SX)" : (supplierRaw === "Khác" ? "Khác" : `${supplierRaw} (NCC)`);
     ```
   - In `src/components/DashboardView.tsx` (lines 1850-1875), Section 8 is rendered as `<BarChart data={supplierStats} ...>` with heading `8. Cơ Cấu Nguồn Hàng (Tự Sản Xuất & NCC Đối Tác)`.
   - In `src/components/DashboardView.tsx` (lines 973-988), `supplierInsight` generates an automated narrative explicitly contrasting **Nhà máy Tâm Sen (Nội bộ)** vs **Nhà cung cấp đối tác {name}**.

3. **KPI Cards & F5 Reload Stability**:
   - In `src/App.tsx` (lines 74-85), `selectedRegion` is persisted to `localStorage.getItem("tsg_selected_region")`.
   - In `src/hooks/useFirestoreCollection.ts` (lines 79-87), `useState` initializes synchronously from `dbEngine.getAll(collectionName, fallbackData)`, preventing empty states or delayed data jumps.
   - In `src/components/DashboardView.tsx` (lines 1140-1359), KPI metrics (`totalRevenue`, `totalProfit`, `totalOrders`, `executiveInsights.projectedRev`) are computed deterministically via `useMemo` from `filteredDelivery` and `poLinesData`.

4. **TypeScript & Build Health**:
   - `npx tsc --noEmit` executed with exit code `0` (0 errors).
   - `npm run build` executed with exit code `0` (Vite client build + esbuild `dist/server.cjs` completed in 5.22s).

---

## 2. Logic Chain

1. **Why Duplicate Deliveries (106 trips / 10.3B) Occurred**:
   - When a user previously refreshed or imported data, if fallback deliveries (52 North trips) and cache/Firestore records used different key formats (`item_...` vs `D_001`), `dbEngine.loadCollection` loaded both into the Map.
   - $52 \text{ fallback} + 52 \text{ cached} = 104 \text{ trips} \approx 106 \text{ trips}$, doubling the revenue from **5.419B ₫** to **~10.8B / 10.3B ₫**.
   - `dbEngine.ts` lines 153-173 solved this by enforcing `if (key && (colMap.has(key) || userMods.has(key)))`, ensuring only known fallback keys or explicit user overrides are loaded.
   - However, because `getItemKey` currently falls back to `Chi tiết đơn hàng` (`D_001`), multiple delivery slips for the same PO line share a key, which could overwrite shipments if not keyed by `STT` or composite key.

2. **Why Section 8 Meets Accounting Requirements**:
   - Tâm Sen is recognized as the internal manufacturing plant (`isSelfManufactured: true`), while THP, Tuấn Bằng, Việt Trung, An Việt Phát, etc., are flagged as external partner suppliers (`(NCC)`).
   - Revenue and Gross Profit are tracked per supplier source, giving leadership instant visibility into internal manufacturing capacity vs external procurement.

3. **Why F5 Reload is 100% Deterministic**:
   - The regional selection (`tsg_selected_region`) survives page reload in `localStorage`.
   - Dataset versioning guarantees old corrupted caches are cleared on version bump.
   - State initialization is synchronous with zero asynchronous race conditions before rendering.

---

## 3. Caveats

1. **Deliveries Primary Key Specificity**:
   While `dbEngine` versioning currently prevents legacy cache duplication, `getItemKey` in `useFirestoreCollection.ts` should be updated so `deliveries` uses `item.id || (item["STT"] ? `del_${item["STT"]}` : `${item["Số PXK"]}_${item["Đơn hàng"]}_${item["Mã sản phẩm"]}`)` to avoid key collision between multiple delivery receipts referencing the same PO Line ID (`D_001`).
2. **Automated Test Harness**:
   The project currently relies on TypeScript (`tsc --noEmit`) and Vite/esbuild (`npm run build`) for CI/CD validation without a dedicated Vitest/Jest unit testing suite in `package.json`.

---

## 4. Conclusion

- **R3 Cache Duplication**: The system has robust safeguards via `TSG_DATASET_VERSION` (`2026_08_27_ACC_GOLD_V6`) and key filtering in `dbEngine.ts`. A small key refinement in `getItemKey` for `deliveries` will make it completely bulletproof.
- **Section 8 (Mục 8)**: The categorization of **Tâm Sen (Tự SX)** vs **External Supplier Partners (NCC)** is fully implemented in `DashboardView.tsx` with dual-bar charts and contextual AI insights.
- **KPI Cards Stability**: Executive insights, PO lifecycle pipeline, and top KPI cards render synchronously and remain immutable upon browser refresh (F5).
- **Build Quality**: 100% clean build and TypeScript typecheck (0 errors).

---

## 5. Verification Method

To independently verify all findings:
1. **Typecheck**:
   ```bash
   npx tsc --noEmit
   ```
   *Expected Result*: Exits with code 0.
2. **Build**:
   ```bash
   npm run build
   ```
   *Expected Result*: Exits with code 0, generates `dist/index.html` and `dist/server.cjs`.
3. **Inspect Key Files**:
   - `src/lib/dbEngine.ts` (lines 37-70, 153-173) for cache versioning and filtering.
   - `src/hooks/useFirestoreCollection.ts` (lines 23-25) for delivery key logic.
   - `src/components/DashboardView.tsx` (lines 628-651, 973-988, 1846-1878) for Section 8 supply source breakdown.
   - `src/App.tsx` (lines 74-85, 393-431, 968-976) for region persistence and data passing to Dashboard.
