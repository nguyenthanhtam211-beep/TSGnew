# BRIEFING — 2026-08-25T01:08:45Z

## Mission
Implement accurate Vietnamese financial calculation logic, price matching, and safe number parsing across business logic and UI components.

## 🔒 My Identity
- Archetype: worker
- Roles: implementer, qa, specialist
- Working directory: /Users/Nguyentam/antigravity/TSG-Business---New/.agents/worker_1_finance
- Original parent: b0829545-05ed-4483-a894-b3b99bbef5ff
- Milestone: Worker 1 - Financial Calculations & 13 Data Tables Specialist

## 🔒 Key Constraints
- DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task.
- Handle Vietnamese number formats (dots thousand separator, comma decimal separator, percentages, currency strings).
- Ensure fallback unit price inference (`Thành tiền / Số lượng`).
- Ensure safe margin/profit calculation preventing NaN.
- Direct match and fallback matching in `findPriceRecord`.
- Clean up duplicate/broken `parseNumber` in components (`DeliveryPlanView`, `DeliveryView`, `MasterCalendarView`, `PODetailModal`).
- Trim whitespace in PO numbers in `src/data.ts`.
- `npx tsc --noEmit` must pass with 0 type errors.

## Current Parent
- Conversation ID: b0829545-05ed-4483-a894-b3b99bbef5ff
- Updated: 2026-08-25T01:08:45Z

## Task Summary
- **What to build**: Robust `parseNumber`, updated `findPriceRecord`, `getBuyPriceFromRecord`, `getSellPriceFromRecord`, `calculatePOLineFinances`, `calculateDeliveryFinances`, component integration, PO number whitespace trimming in `src/data.ts`.
- **Success criteria**: All price and finance calculations accurate, zero NaNs, zero type errors (`npx tsc --noEmit`), tests passing, production build passing (`npm run build`).
- **Interface contracts**: `PROJECT.md`
- **Code layout**: `src/lib/business-logic.ts`, `src/components/*`, `src/data.ts`

## Key Decisions Made
- Enhanced `parseNumber` in `src/lib/business-logic.ts` to support VN/US number formats, parentheses/minus negatives, currency symbols, percentages, and nullish inputs.
- Added direct code and location matching in `findPriceRecord`.
- Extended `getBuyPriceFromRecord` to fallback to `Giá AVP`, `Giá vốn`, `Giá mua`, `Đơn giá mua mới`.
- Prioritized `Đơn giá bán mới` in `getSellPriceFromRecord`.
- Added unit price inference from `Thành tiền / Số lượng` and NaN guardrails in `calculatePOLineFinances` and `calculateDeliveryFinances`.
- Replaced local `parseNumber` in `DeliveryPlanView.tsx`, `DeliveryView.tsx`, `MasterCalendarView.tsx`, and `PODetailModal.tsx`.
- Trimmed whitespace around PO numbers in `src/data.ts`.

## Change Tracker
- **Files modified**:
  * `src/lib/business-logic.ts`: Enhanced `parseNumber`, `findPriceRecord`, `getBuyPriceFromRecord`, `getSellPriceFromRecord`, `calculateDeliveryFinances`, `calculatePOLineFinances`.
  * `src/components/DeliveryPlanView.tsx`: Removed local buggy `parseNumber` and imported from `business-logic`.
  * `src/components/DeliveryView.tsx`: Removed local buggy `parseNumber` and imported from `business-logic`.
  * `src/components/MasterCalendarView.tsx`: Removed local buggy `parseNumber` and imported from `business-logic`.
  * `src/components/PODetailModal.tsx`: Replaced all `parseFloat` with `parseNumber` and fixed safe stats & chartData calculations.
  * `src/data.ts`: Trimmed leading whitespace on PO numbers (`26/KHVT/0547`, `26/KHVT/0600`).
  * `scripts/test-finance.ts`: Added verification suite for financial logic.
- **Build status**: PASS (`npx tsc --noEmit` & `npm run build` both exit 0)
- **Pending issues**: None

## Quality Status
- **Build/test result**: PASS (0 type errors, 17/17 parse tests passed, full dataset linkage verified)
- **Lint status**: 0 errors
- **Tests added/modified**: `scripts/test-finance.ts`

## Loaded Skills
- None explicitly required

## Artifact Index
- `.agents/worker_1_finance/DISPATCH.md` — Assignment instructions
- `.agents/worker_1_finance/BRIEFING.md` — Agent state and working memory
- `.agents/worker_1_finance/progress.md` — Liveness & progress tracking
- `.agents/worker_1_finance/handoff.md` — Final completion report
