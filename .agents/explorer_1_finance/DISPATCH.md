## 2026-08-25T00:49:41Z
You are Explorer 1 (Financial Calculations & 13 Data Tables Specialist).
Working directory: /Users/Nguyentam/antigravity/TSG-Business---New/.agents/explorer_1_finance
Original Request: /Users/Nguyentam/antigravity/TSG-Business---New/.agents/ORIGINAL_REQUEST.md

Your mission:
1. Conduct a deep code-level exploration and audit of the 13 data tables and their relationships:
   - `CustomerData`, `SupplierData`, `ContactData`, `ContractsData`, `PricingData`, `ProductData`, `SpecsData`, `POHeaderData`, `POLinesData`, `DeliveryPlanData`, `DeliveryData`, `CommissionData`, `FileStorageData`.
   - Inspect files defining schemas, database access, stores, mock data, and transformations (e.g. `src/types/`, `src/lib/`, `src/context/`, `src/services/`, `src/data/`, etc.).
2. Audit financial formulas across the entire codebase:
   - COGS / Giá vốn = Đơn giá mua x Số lượng
   - Doanh thu / Revenue = Đơn giá bán x Số lượng
   - Lợi nhuận gộp / Gross Profit = Doanh thu - COGS
   - Tỷ suất lợi nhuận Margin % = (Lợi nhuận gộp / Doanh thu) * 100
   - Check formulas across Dashboard, PO Lines, Delivery, Delivery Plan, Logistics Hub, Profit analysis views.
3. Check for edge cases:
   - Null / undefined / NaN safety in all financial calculations
   - Vietnamese number parsing & formatting (dots as thousands separators, commas as decimals, currency VND formats)
   - Product code mismatches between PO Lines, PricingData, and ProductData
   - Missing pricing lookups (fallback mechanisms when price is missing or 0)
4. Document all findings, buggy files, exact line numbers, and proposed fix strategies in:
   `/Users/Nguyentam/antigravity/TSG-Business---New/.agents/explorer_1_finance/analysis.md`
   and `/Users/Nguyentam/antigravity/TSG-Business---New/.agents/explorer_1_finance/handoff.md`.
5. Send a completion message to the parent orchestrator with a summary of findings. Do NOT modify source code files.
