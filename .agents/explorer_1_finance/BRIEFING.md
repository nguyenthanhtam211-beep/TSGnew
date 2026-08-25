# BRIEFING — 2026-08-25T00:52:00Z

## Mission
Deep code-level exploration and audit of 13 data tables and financial calculations (Revenue, COGS, Gross Profit, Margin %, currency parsing/formatting, lookups, edge cases) across TSG Business OS.

## 🔒 My Identity
- Archetype: Teamwork Explorer
- Roles: Financial Calculations & 13 Data Tables Specialist
- Working directory: /Users/Nguyentam/antigravity/TSG-Business---New/.agents/explorer_1_finance
- Original parent: b0829545-05ed-4483-a894-b3b99bbef5ff
- Milestone: Investigation & Synthesis Complete

## 🔒 Key Constraints
- Read-only investigation — do NOT modify source code files
- Document exact file paths, line numbers, logical discrepancies, and concrete proposed fixes in analysis.md and handoff.md
- Report findings back to parent orchestrator via send_message

## Current Parent
- Conversation ID: b0829545-05ed-4483-a894-b3b99bbef5ff
- Updated: 2026-08-25T00:52:00Z

## Investigation State
- **Explored paths**: `src/types.ts`, `src/data.ts`, `src/lib/dbEngine.ts`, `src/lib/business-logic.ts`, `src/hooks/useFirestoreCollection.ts`, `src/utils/formatters.ts`, `src/App.tsx`, `src/components/DashboardView.tsx`, `src/components/DeliveryView.tsx`, `src/components/DeliveryPlanView.tsx`, `src/components/LogisticsHubView.tsx`, `src/components/PODetailModal.tsx`, `src/components/DualPODocumentModal.tsx`, `src/components/WorkflowView.tsx`, `src/components/CommissionView.tsx`, `src/components/ContractsView.tsx`, `src/components/ProductsView.tsx`, `src/components/SpecsView.tsx`, `src/components/CustomerView.tsx`, `src/components/SupplierView.tsx`, `src/components/PriceReconciliationPanel.tsx`, `src/components/ProductDetailModal.tsx`, `src/lib/gemini.ts`, `src/lib/pdf-exporter.ts`, `src/lib/driveSync.ts`.
- **Key findings**:
  1. Local naive `parseNumber` definitions in `DeliveryPlanView.tsx`, `DeliveryView.tsx`, `MasterCalendarView.tsx` breaking Vietnamese dot-separated thousands (e.g. `1.800` -> `1.8`).
  2. `getBuyPriceFromRecord` in `src/lib/business-logic.ts` missing `Giá AVP`, `Giá vốn`, `Giá mua` fallbacks, causing COGS = 0 and Margin = 100% on products with blank buying price (e.g. `Gsp_094`, `Gsp_142`, `Gsp_148`).
  3. `findPriceRecord` not matching exact price codes (`Gsp_XXX`) even though `DELIVERY_DATA` stores `Gsp_XXX` in the `Mã sản phẩm` column.
  4. Logic bug in `PODetailModal.tsx` (`isNaN(qty || price)`), causing `NaN` propagation.
  5. Whitespace padding in PO numbers in `src/data.ts` (`" 26/KHVT/0547"`, `" 26/KHVT/0600"`).
  6. Missing `Thành tiền dòng / Số lượng` price fallback in `calculatePOLineFinances`.
- **Unexplored areas**: None within the scope of 13 data tables and financial formulas.

## Key Decisions Made
- Fully documented all 13 data tables schemas, foreign key mappings, formula definitions, and bug locations in `analysis.md` and `handoff.md`.

## Artifact Index
- DISPATCH.md — Task dispatch log
- BRIEFING.md — Persistent agent state
- progress.md — Heartbeat and progress tracking
- analysis.md — Deep technical audit of tables, relationships, and financial formulas
- handoff.md — 5-component structured handoff report
