# Handoff Report — Explorer 3: 5-Step E2E Workflow & Hubs Specialist

## 1. Observation
1. **TypeScript Compilation & Build Output**:
   - Executed command `npx tsc --noEmit`: Exited with code `0`, no compilation errors.
   - Executed command `npm run build`: Exited with code `0`, built bundle in 4.91s (`dist/index.html` 1.54 kB, `dist/assets/index-FL3G6eK7.js` 5,474.65 kB, `dist/server.cjs` 123.2 kB).
2. **Step 1 (Master Data & Contact Dossier)**:
   - In `src/components/CustomerView.tsx` (lines 140-151) & `src/components/SupplierView.tsx` (lines 135-146), `getLinkedContacts` resolves contacts using:
     ```typescript
     const compName = String(c["Công ty"] || "").toLowerCase().trim();
     const custName = String(customer["Tên đầy đủ"] || "").toLowerCase().trim();
     const custCode = String(customer["Customer_ID"] || "").toLowerCase().trim();
     return compName && (compName === custName || compName === custCode || (custName.length > 3 && custName.includes(compName)));
     ```
   - In `src/components/ContactView.tsx` (lines 172-184), tasks, projects, and activity logs are persisted solely via `localStorage.getItem('tsg_contact_tasks')` rather than cloud-backed `dbEngine.save`.
3. **Step 2 (Contracts & Active Pricing Lookup)**:
   - In `src/lib/business-logic.ts` (lines 161-169):
     ```typescript
     if (location) {
       const normLoc = normalizeString(location);
       const matchedLoc = candidates.find(p => {
         const pLoc = normalizeString(p["Địa điểm giao hàng"] || p["Địa chỉ giao hàng"] || "");
         const pCode = normalizeString(p["Mã sản phẩm"] || p["Mã hàng"] || "");
         return pLoc.includes(normLoc) && (pCode === normalizeString(sku) || combinedQuery.includes(pCode));
       });
       if (matchedLoc) return matchedLoc;
     }
     ```
     In `PRICING_DATA` (`src/data.ts` line 108), the destination column header is `"Giao đến"`, not `"Địa điểm giao hàng"`.
   - In `src/lib/business-logic.ts` (line 238):
     ```typescript
     export const getSellPriceFromRecord = (record: any): number => {
       if (!record) return 0;
       return parseNumber(record['Đơn giá bán']) || parseNumber(record['Giá bán']) || parseNumber(record['Đơn giá bán mới']) || 0;
     };
     ```
     `'Đơn giá bán'` takes precedence over `'Đơn giá bán mới'`, ignoring updated negotiated price terms.
4. **Step 3 (PO Intake & Dual PO Creation)**:
   - In `src/components/WorkflowView.tsx` (lines 623-636), `handleSavePO` only checks `!newPoNumber.trim()`, `!poCustomer`, and `poLines.length === 0`. It does NOT check `combinedPoHeadersData.some(...)` for existing PO numbers, allowing duplicate PO overwrite without warning.
   - In `src/components/OCRView.tsx` (lines 80, 472-515), `poHeaders` is declared as a prop but never queried in `executeSaveToSystem` to detect duplicate PO intake.
   - In `src/components/DualPODocumentModal.tsx` (lines 98-178, 194-250), dual PO generation correctly splits Tâm Sen PO (SO with customer selling price) and An Việt Phát PO (PO with supplier purchase cost).
5. **Step 4 (Delivery Dispatch Planning)**:
   - In `src/data.ts` line 406 (`DELIVERY_PLAN_DATA`), headers are: `Mã kế hoạch,Đơn hàng,Sản phẩm,Khách hàng,Ngày dự kiến,Số lượng cần giao,Trạng thái`.
   - In `src/components/WorkflowView.tsx` lines 969-982, plan creation saves `Kế hoạch ID`, `Chi tiết đơn hàng`, `Số lượng kế hoạch`, `Số lượng cần giao`, `Ngày giao kế hoạch`.
   - In `src/components/DeliveryPlanView.tsx` lines 112-120, multi-batch creation reads/writes `Mã kế hoạch`, `Ngày dự kiến`, `Số lượng cần giao`.
6. **Step 5 (Warehouse Export Note PXK & Debt Reconciliation)**:
   - In `src/App.tsx` (line 283 & line 335):
     ```typescript
     const remaining = Math.max(0, ordered - totalDelivered);
     ```
     For over-delivered lines (e.g. `2/TS/26` with 5,244 kg delivered vs 5,000 kg ordered), remaining is truncated to 0 instead of -244.
   - In `src/App.tsx` (lines 436-442) in `handleUpdateToFirestore`:
     ```typescript
     const transientFields = [
       'id', 'Doanh thu dự kiến', 'Lợi nhuận dự kiến', 'Tiến độ', 'Số dòng', 'Status',
       'Doanh thu', 'Lợi nhuận gộp', 'Tiến độ giao', 'isOverdue', 'qtyOrdered', 
       'qtyDelivered', 'remainingQty', 'currentRevenue', 'currentProfit', 'margin', 
       'isDelayed', 'isReconciled'
     ];
     transientFields.forEach(field => delete dataToSave[field]);
     ```
     In `DELIVERY_DATA`, the CSV column header is `"Status"`. Updating delivery records via `handleUpdateToFirestore` deletes the `"Status"` column.

---

## 2. Logic Chain
1. **Price Lookup Inaccuracy (Step 2)**:
   - *Observation 3* shows `findPriceRecord` checks `p["Địa điểm giao hàng"]`, but `PRICING_DATA` stores destination in `p["Giao đến"]`.
   - As a consequence, queries with destination locations (e.g. `Thăng Long` vs `Thanh Hoá` for `TH130/07`) fail location match and fall back to the first SKU match (`Gsp_082` at 12,155 VND instead of `Gsp_131` at 12,316 VND).
   - Furthermore, `getSellPriceFromRecord` prioritizes `'Đơn giá bán'` over `'Đơn giá bán mới'`, ignoring negotiated revisions.
2. **Duplicate PO Overwrite Vulnerability (Step 3)**:
   - *Observation 4* shows neither `WorkflowView.handleSavePO` nor `OCRView.executeSaveToSystem` validates `newPoNumber` against existing headers in state/props.
   - Therefore, re-saving or re-scanning a document with an existing PO number will overwrite the existing `po_headers` Firestore doc and create mismatched line references without user confirmation.
3. **Delivery Status Data Loss (Step 5)**:
   - *Observation 6* shows `handleUpdateToFirestore` removes `'Status'` from `dataToSave`.
   - In `DELIVERY_DATA`, `"Status"` holds the persistent delivery state (`Hoàn thành`, `Đang tiến hành`).
   - Removing `'Status'` during document update strips the status property from Firestore, leading to state reversion upon next reload.
4. **Discrepancy Reporting Truncation (Step 5)**:
   - *Observation 6* shows `Math.max(0, ordered - totalDelivered)` discards negative remainders.
   - When actual deliveries exceed ordered quantity (such as bulk rolls or raw paper), the system fails to display the negative variance (-244) in flattened views, masking over-fulfillment.

---

## 3. Caveats
- No direct source code changes were made during this turn (Read-Only Investigation Mode).
- External Google API calls (Google Drive upload, Google Sheets sync, Google Calendar event creation) require active OAuth access tokens (`google_access_token` in localStorage). When tokens expire or are absent, the application gracefully skips cloud sync or notifies the user without blocking local workflow operations.
- Initial CSV seed data contains historical mock entries with inconsistent date string formats (`DD/MM/YYYY`, `MM/DD/YYYY`, and `YYYY/MM/DD`); `business-logic.ts`'s `parseDateToISO` normalizes most patterns, but strict ISO storage is recommended for all newly created entities.

---

## 4. Conclusion
The 5-step end-to-end business workflow in **TSG Business OS** is structurally sound with complete UI components, rich bidirectional deep-linking, multi-tier data engine caching, and working build/compilation pipelines.

To achieve 100% operational precision and data integrity, the following 6 targeted fixes should be applied:
1. **Fix `src/lib/business-logic.ts`**:
   - Add `p["Giao đến"]` to destination check in `findPriceRecord`.
   - Prioritize `record['Đơn giá bán mới']` over `record['Đơn giá bán']` in `getSellPriceFromRecord`.
2. **Fix `src/components/WorkflowView.tsx` & `src/components/OCRView.tsx`**:
   - Add duplicate PO check against existing headers with confirmation warnings.
3. **Fix `src/App.tsx`**:
   - Remove `'Status'` from `transientFields` deletion list in `handleUpdateToFirestore` (or only exclude if runtime calculated).
   - Preserve signed variance in remaining calculation or format over-delivery clearly.
4. **Standardize Delivery Plan keys**:
   - Ensure both `'Số lượng cần giao'` and `'Số lượng kế hoạch'`, `'Ngày dự kiến'` and `'Ngày giao kế hoạch'` are always synchronized.

---

## 5. Verification Method
1. **TypeScript Verification**:
   ```bash
   npx tsc --noEmit
   ```
   *Expected result*: Exit code 0, 0 type errors.
2. **Production Build Verification**:
   ```bash
   npm run build
   ```
   *Expected result*: Vite build + esbuild server bundle completes successfully in `< 10s`.
3. **Workflow Code Inspections**:
   - Inspect `src/lib/business-logic.ts` line 164 & 238 for price matching logic.
   - Inspect `src/components/WorkflowView.tsx` line 623 for PO validation logic.
   - Inspect `src/App.tsx` line 442 for `transientFields` handling.
