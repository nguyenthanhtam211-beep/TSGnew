# Execution Plan

## Phase 0: Survey & Initial Technical Mapping
- Spawn 3 parallel Explorers:
  - Explorer 1: Focus on Data Sources, Accounting Data Files/Stores, Revenue/COGS/Gross Profit calculations for North (5.419.475.060 ₫ / 52 docs), South (45.556.624.491 ₫ / 1056 docs), and Company-wide (50.976.099.551 ₫ / 1108 docs), and Tam Sen internal manufacturing COGS.
  - Explorer 2: Focus on PO Lines & PO Orders, delivery matching, real-time pending expected revenue (458.712.729 ₫) vs 100% full PO calculation bug.
  - Explorer 3: Focus on Frontend/Dashboard caching, localStorage key collision causing duplicate counts (106 deliveries / 10.3B), Section 8 Internal Factory vs Partners, and TypeScript/build health.

## Phase 1: Synthesize Findings & Author PROJECT.md
- Feature Inventory mapping R1, R2, R3 and Acceptance Criteria.
- Modular milestone plan with clear interfaces.
- Test infrastructure architecture.

## Phase 2: Dual Track Execution
- Track A (E2E Testing Track): Scaffold automated tests checking exact numbers, refresh idempotency, filtering across Miền Bắc, Miền Nam, Toàn công ty.
- Track B (Implementation Track): Modular fix and hardening of accounting logic, PO line linkage, caching layer, and UI visual report.

## Phase 3: Verification & Auditing
- Reviewer checks (Correctness, Types, Build).
- Challenger checks (Edge cases, refresh cycles, state mutations).
- Final Gate Pass.

## Phase 4: Final Handoff
- Generate handoff.md and completion report.
