## 2026-08-25T00:54:05Z
You are Worker 1 (Financial Calculations & 13 Data Tables Specialist).
Working directory: /Users/Nguyentam/antigravity/TSG-Business---New/.agents/worker_1_finance
Original Request: /Users/Nguyentam/antigravity/TSG-Business---New/.agents/ORIGINAL_REQUEST.md
Explorer 1 Report: /Users/Nguyentam/antigravity/TSG-Business---New/.agents/explorer_1_finance/handoff.md
Project Spec: /Users/Nguyentam/antigravity/TSG-Business---New/PROJECT.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A reviewer will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your owned files for implementation:
1. `src/lib/business-logic.ts`:
   - Enhance `parseNumber` to handle Vietnamese formatted numbers (dots as thousand separators, commas as decimals like `"718.062.120,00"`, `"1.800"`, percentages `"35.63%"`, numbers, null, undefined) safely and export it.
   - Update `findPriceRecord`: ensure direct match on `Mã giá bán` / `Mã giá` (`Gsp_XXX`), destination matching on `p["Giao đến"]` and `p["Địa điểm giao hàng"]`.
   - Update `getBuyPriceFromRecord`: add support for `record['Giá AVP']`, `record['Giá vốn']`, `record['Giá mua']`, `record['Đơn giá mua mới']`.
   - Update `getSellPriceFromRecord`: prioritize `record['Đơn giá bán mới']` when available, then `record['Đơn giá bán']`, `record['Giá bán']`.
   - Update `calculatePOLineFinances` / `calculateDeliveryFinances`: ensure fallback unit price inference from `Thành tiền / Số lượng` when unit price is 0, safe margin/profit calculation preventing NaN.
2. `src/components/DeliveryPlanView.tsx`, `src/components/DeliveryView.tsx`, `src/components/MasterCalendarView.tsx`:
   - Remove local broken `parseNumber` definitions and import `parseNumber` from `../lib/business-logic`.
3. `src/components/PODetailModal.tsx`:
   - Fix lines 221-224 to safely calculate `totalOrderedQty` and `totalAmount` using `parseNumber`.
4. `src/data.ts`:
   - Trim leading/trailing whitespace in PO numbers (`" 26/KHVT/0547"`, `" 26/KHVT/0600"`).

After making edits:
- Run `npx tsc --noEmit` to verify 0 type errors.
- Write your completion report in `/Users/Nguyentam/antigravity/TSG-Business---New/.agents/worker_1_finance/handoff.md`.
- Send a completion message to the parent orchestrator with command outputs and changes.
