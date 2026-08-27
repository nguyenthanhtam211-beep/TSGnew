# BRIEFING — 2026-08-26T19:17:00Z

## Mission
Investigate all data sources, JSON/TS/data files, accounting calculations, and business logic for Revenue, COGS, and Gross Profit across North, South, and Company-wide scopes, and determine the root cause for COGS = 0 on internally manufactured items (e.g. Lưỡi Gà Trắng).

## 🔒 My Identity
- Archetype: Explorer
- Roles: Data & Accounting Investigation, Code & Data Auditor
- Working directory: /Users/Nguyentam/antigravity/TSG-Business---New/.agents/explorer_survey_1/
- Original parent: 2166d984-88ea-4947-a28e-a89ca0c93ac4
- Milestone: Exploration & Root-Cause Accounting Analysis

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Maintain persistent memory in BRIEFING.md (keep under ~100 lines)
- File outputs: analysis.md, handoff.md, progress.md
- Communicate results via send_message to parent

## Current Parent
- Conversation ID: 2166d984-88ea-4947-a28e-a89ca0c93ac4
- Updated: 2026-08-26T19:17:00Z

## Investigation State
- **Explored paths**: `src/data.ts`, `src/lib/business-logic.ts`, `src/lib/dbEngine.ts`, `src/components/DashboardView.tsx`, `src/App.tsx`, `src/data/accounting_imported.json`, `src/data/factory_imported.json`, `scripts/verify-all.ts`, `scripts/test-finance.ts`.
- **Key findings**:
  1. North Scope: 52 vouchers, Revenue 5.419.475.060 ₫, COGS 3.957.078.067,2 ₫, Profit 1.462.396.992,8 ₫ (Margin 26.98%).
  2. South Scope: 1.056 vouchers (1044 Sài Gòn + 9 Bến Tre + 3 Quốc Đại), Revenue 45.556.624.491 ₫.
  3. Company-wide: 1.108 vouchers, Revenue 50.976.099.551 ₫.
  4. North Remaining PO Revenue: 458.712.729 ₫ across 4 unfulfilled PO lines (D_014, D_036, D_044, D_045).
  5. Tam Sen COGS = 0 Root Cause: Internal factory delivery vouchers have no external vendor buy price in raw ledger; North resolved via AVP/buy price fallback in `PRICING_DATA` (`getBuyPriceFromRecord`), South has 23 lines without AVP mapping.
  6. Dashboard `projectedRev` and `App.tsx` regional filter nuances documented with recommendations for implementers.
- **Unexplored areas**: None (100% investigated and verified).

## Key Decisions Made
- All numbers audited down to the exact Dong with 100% precision. Full evidence recorded in `analysis.md` and `handoff.md`.

## Artifact Index
- /Users/Nguyentam/antigravity/TSG-Business---New/.agents/explorer_survey_1/analysis.md — Comprehensive data & accounting analysis
- /Users/Nguyentam/antigravity/TSG-Business---New/.agents/explorer_survey_1/handoff.md — 5-component handoff report
- /Users/Nguyentam/antigravity/TSG-Business---New/.agents/explorer_survey_1/progress.md — Liveness & step tracking
