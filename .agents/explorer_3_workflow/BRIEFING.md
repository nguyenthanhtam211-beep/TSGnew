# BRIEFING — 2026-08-25T07:54:00+07:00

## Mission
Deep code-level exploration and audit of the 5-step end-to-end business workflow and hubs in TSG Business OS.

## 🔒 My Identity
- Archetype: explorer
- Roles: 5-Step E2E Workflow & Hubs Specialist, TypeScript & State Auditor
- Working directory: /Users/Nguyentam/antigravity/TSG-Business---New/.agents/explorer_3_workflow
- Original parent: b0829545-05ed-4483-a894-b3b99bbef5ff
- Milestone: Investigation & Audit

## 🔒 Key Constraints
- Read-only investigation — do NOT implement / modify source code directly
- Focus on Steps 1 to 5 workflow, UI components, pages, context providers, state sync, form validation, and TypeScript checks
- Document all findings in analysis.md and handoff.md

## Current Parent
- Conversation ID: b0829545-05ed-4483-a894-b3b99bbef5ff
- Updated: 2026-08-25T07:54:00+07:00

## Investigation State
- **Explored paths**:
  - `src/App.tsx`: Data enrichment pipelines, view routing, Firestore CRUD methods, `transientFields` deletion
  - `src/lib/business-logic.ts`: Financial calculations (`calculateDeliveryFinances`, `calculatePOLineFinances`), `parseNumber`, `findPriceRecord`, `getSellPriceFromRecord`
  - `src/components/CustomerView.tsx`, `SupplierView.tsx`, `ContactView.tsx`: Master data management, contact dossier, 2-way deep linking
  - `src/components/ContractsView.tsx`, `PricingCombobox.tsx`: Contract OCR reconciliation, pricing lookup
  - `src/components/WorkflowView.tsx`: 5-step interactive workflow, Sourcing calculator, PO intake, Approval & Dual PO, Dispatch planning, PXK, 3-Way Reconciliation
  - `src/components/DeliveryPlanView.tsx`, `LogisticsHubView.tsx`, `DeliveryView.tsx`: Multi-batch delivery scheduling, FullCalendar integration, discrepancy detection, customer/supplier debt calculation
  - `src/lib/dbEngine.ts`, `src/hooks/useFirestoreCollection.ts`: 3-tier memory cache, fallback registration, optimistic local updates
- **Key findings**:
  - `npx tsc --noEmit` and `npm run build` pass with 0 errors.
  - Location matching in `findPriceRecord` looks for `Địa điểm giao hàng` but CSV uses `Giao đến`.
  - `getSellPriceFromRecord` prioritizes old price over `Đơn giá bán mới`.
  - `WorkflowView.handleSavePO` and `OCRView.executeSaveToSystem` lack duplicate PO checks.
  - `App.tsx` `handleUpdateToFirestore` deletes `'Status'` from delivery records due to `transientFields`.
  - `Math.max(0, ...)` truncates negative remaining quantity for over-delivered items.
- **Unexplored areas**: None within the 5-step workflow scope.

## Key Decisions Made
- Documented full findings and line numbers in `analysis.md` and 5-component report in `handoff.md`.

## Artifact Index
- analysis.md — Detailed deep-dive findings for the 5-step workflow & hubs
- handoff.md — 5-component handoff report
- progress.md — Heartbeat progress log
- DISPATCH.md — Incoming mission dispatch log
