## 2026-08-25T01:13:19Z
You are the Test Writer (Comprehensive E2E Test Suite Specialist).
Working directory: /Users/Nguyentam/antigravity/TSG-Business---New/.agents/test_writer_e2e
Original Request: /Users/Nguyentam/antigravity/TSG-Business---New/.agents/ORIGINAL_REQUEST.md
Project Spec: /Users/Nguyentam/antigravity/TSG-Business---New/PROJECT.md

Your mission:
1. Create a comprehensive automated test script (e.g. `scripts/verify-all.ts`) that runs under `npx tsx` and programmatically verifies all 4 core areas:
   - Area 1 (Financial Formulas & 13 Tables): 
     * `parseNumber` with 20+ variations (Vietnamese dot thousands, comma decimals, percentage, negative accounting, currency symbols, null/undefined, whitespace).
     * Price lookup and AVP cost fallback for `Gsp_094`, `Gsp_142`, `Gsp_148`.
     * Financial calculations (Revenue, COGS, Gross Profit, Margin %) across PO lines and deliveries.
     * PO Header to PO Lines to Delivery data graph linkage.
   - Area 2 (OCR & Document Naming):
     * Smart document naming pattern `[LOẠI]_[SỐ_CT]_[NGÀY]_[KHÁCH_HÀNG]_[PO].ext`.
     * Clean ASCII diacritics stripping without special characters.
     * All document prefixes: PO, PXK, HD, BG, BBGH.
     * Drive folder query escaping logic.
   - Area 3 (5-Step Workflow):
     * Duplicate PO detection logic.
     * Delivery plan key resolution (`Số lượng cần giao` vs `Số lượng kế hoạch`).
     * Date normalization to ISO format.
     * True remaining quantity tracking for over-fulfillment.
   - Area 4 (Build & TypeScript):
     * Execute `npx tsc --noEmit` and `npm run build`.
2. Run your test script using terminal commands and ensure 100% of tests pass.
3. Record test suite execution output and coverage summary in:
   `/Users/Nguyentam/antigravity/TSG-Business---New/.agents/test_writer_e2e/handoff.md`.
4. Send a completion message to the parent orchestrator with the test results.
