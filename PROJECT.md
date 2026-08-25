# Project: TSG Business OS - Enterprise Cockpit UI/UX Redesign

## Architecture
TSG Business OS is a modern enterprise web application built on React 19 + TypeScript + Vite + Tailwind CSS v4 + Lucide Icons + Recharts + Motion (Framer Motion).
The system follows a high-density, tactile Enterprise Cockpit aesthetic adhering to `.design_skills/taste-skill` and `.design_skills/impeccable`.

### Core Architectural Pillars
1. **Design Tokens & CSS System (R1)**:
   - Neutral ramp: OKLCH / Slate 50-950 with 4 elevation tiers (`surface-canvas`, `surface-card`, `surface-overlay`, `surface-elevated`).
   - Semantic Vibrant Accents: Electric Blue `#007AFF`, Emerald `#10B981`, Amber `#F59E0B`, Indigo/Patina `#6366F1`, Rose `#EF4444`, Purple `#8B5CF6`.
   - Dual-face Typography: Roboto Condensed for display headers & metric cards; Inter / Roboto tabular-nums for numeric and financial grids.
   - Spring Physics: `cubic-bezier(0.16, 1, 0.3, 1)` and Motion spring presets (`cockpitSpring`, `cockpitBouncy`).
   - Hairline Borders: Sub-pixel `border-slate-200/60 dark:border-slate-800/60` with frosted glass backdrops.
2. **Shell & Navigation (R2)**:
   - Desktop Glassmorphism Header: Unified top bar with dynamic breadcrumbs, `Cmd+K` trigger, database status indicator, quick action buttons.
   - Active Pill Sidebar: Motion `layoutId="active-sidebar-pill"`, crisp numeric badges, collapsible state with tooltips.
   - Thumb-zone Mobile Bottom Dock: Floating rounded-2xl glass island dock, spring touch feedback, badge indicators.
   - Viewport & Safe-area: `min-h-[100dvh]` and landscape notch safe-area handling.
3. **Dashboard & Logistics Hub 360° Bento Grid (R3)**:
   - Asymmetrical Bento Grid layout for Executive KPIs and 4-phase PO lifecycle pipeline.
   - 11 Polished Recharts charts with Glassmorphic custom tooltips and gradient fills.
   - Logistics Hub 360° with 3-way balance reconciliation grid (PO vs Plan vs PXK).
4. **Data Grid, Mobile Cards & Dialogs (R4)**:
   - High-density Cockpit Data Grid: Sticky frosted header, alternate subtle rows, column filter popovers, `@dnd-kit` column ordering, 4-box financial summary metrics.
   - Mobile Apple Inset-Grouped Cards: 4-box financial summary, status chips, SKU tags, tactile spring feedback.
   - Adaptive Dialogs: macOS-style desktop modal & mobile slide-up bottom sheets with gesture dismiss.
5. **Subsystems Integrity (R5)**:
   - Complete end-to-end UI/UX polish across all 10 core subsystems: Dashboard, Purchase Orders (PO), Delivery, Delivery Plan, Pricing, OCR/AI Ingestion, Customer, Supplier, Storage, Contacts, plus ancillary modules (Contracts, Commission, Workflow, Specs).

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | OKLCH/Slate 4-tier surface system | Neutral ramp with canvas, card, overlay, elevated tokens | M1 (R1) | Survey / Impeccable |
| 2 | Semantic vibrant accent palette | #007AFF, #10B981, #F59E0B, #6366F1, #EF4444, #8B5CF6 | M1 (R1) | Survey / Taste |
| 3 | Dual-face typography & tabular nums | Roboto Condensed + Inter/Roboto tabular-nums | M1 (R1) | Survey / Taste |
| 4 | Spring physics & tactile interactions | Micro-interactions, spring curves, button press scale | M1 (R1) | Survey / Taste |
| 5 | Design Tokens Module | `src/lib/design-tokens.ts` typed constants & presets | M1 (R1) | Survey 1 |
| 6 | Sub-pixel hairline borders | Elimination of harsh 1px borders in favor of slate-200/60 | M1 (R1) | Survey 1 |
| 7 | Unified Glassmorphism Desktop Header | Sticky blur header with breadcrumbs, Cmd+K, sync status | M2 (R2) | Survey 2 |
| 8 | Dynamic Breadcrumbs Component | Hierarchical breadcrumb navigation in header | M2 (R2) | Survey 2 |
| 9 | Active Pill Sidebar Navigation | Smooth pill background animation via Motion layoutId | M2 (R2) | Survey 2 |
| 10 | Thumb-Zone Floating Mobile Bottom Dock | Floating glass dock with spring feedback & badges | M2 (R2) | Survey 2 |
| 11 | Safe Area & 100dvh Viewport Handling | iOS Safari notch & landscape orientation gutters | M2 (R2) | Survey 2 |
| 12 | Bento Grid Executive Dashboard | Asymmetrical 3-card executive KPI & 4-stage pipeline | M3 (R3) | Survey 3 |
| 13 | Recharts Glassmorphic Custom Tooltips | Custom styled tooltip component with tabular values | M3 (R3) | Survey 3 |
| 14 | Logistics Hub 360° 4-Tier Reconciliation | 3-way balance grid (PO vs Plan vs Delivery) | M3 (R3) | Survey 3 |
| 15 | High-Density Sticky Data Grid | Frosted header, alternate rows, column filters, dnd-kit | M4 (R4) | Survey 3 |
| 16 | Mobile Apple Inset-Grouped Cards | 4-box financial summary, status chips, SKU tags | M4 (R4) | Survey 3 |
| 17 | Adaptive Modals & Bottom Sheets | macOS window desktop modal + mobile touch sheet | M4 (R4) | Survey 3 |
| 18 | Subsystems Rollout & Integrity | Dashboard, PO, Delivery, Delivery Plan, Pricing, OCR, Customer, Supplier, Storage, Contacts | M5 (R5) | Survey 3 |
| 19 | TypeScript & Build Verification | 0 errors across `npx tsc --noEmit` and `npm run build` | M6 (Verify) | Quality Gate |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | R1: Design Tokens, Tailwind, index.css, Fonts | Tokens, CSS variables, typography, spring physics, design-tokens.ts | none | DONE |
| M2 | R2: Navigation, Header, Breadcrumbs, Mobile Dock | Glassmorphic Header, Breadcrumbs, Active Pill Sidebar, Mobile Dock | M1 | DONE |
| M3 | R3: Dashboard & Logistics Hub 360° Bento Grid | Asymmetrical Bento Grid, Recharts Tooltips, Logistics 360° | M1, M2 | DONE |
| M4 | R4: Desktop Data Grid, Inset Cards, Modals/Sheets | TableView polish, Mobile cards, Adaptive Modals/Sheets | M1, M2 | PLANNED |
| M5 | R5: Subsystems Full Rollout & Integrity | 10 core subsystems UI consistency & polish | M1, M2, M3, M4 | PLANNED |
| M6 | Verification: TypeScript & Build Quality Gate | `npx tsc --noEmit` and `npm run build` 100% clean | M1, M2, M3, M4, M5 | PLANNED |

## Code Layout
- `src/lib/design-tokens.ts`: Central design tokens, color ramps, Motion presets, chart palettes.
- `src/index.css`: Tailwind v4 theme, surface elevation variables, hairline borders, spring utility classes.
- `index.html`: Google Font imports and viewport meta configurations.
- `src/components/layout/`:
  - `Header.tsx`: Unified desktop/mobile glassmorphic header.
  - `Breadcrumbs.tsx`: Reusable dynamic hierarchical breadcrumbs.
  - `Sidebar.tsx`: Active pill desktop sidebar.
  - `MobileBottomNav.tsx`: Floating thumb-zone mobile dock.
- `src/components/dashboard/`:
  - `BentoExecutiveCards.tsx`, `LogisticsHub360.tsx`, `CustomChartTooltip.tsx`.
- `src/components/common/`:
  - `TableView.tsx` (or `CockpitDataGrid.tsx`), `MobileCardList.tsx`, `AdaptiveModal.tsx`, `AdaptiveBottomSheet.tsx`.
- `src/views/` (Subsystems):
  - `DashboardView.tsx`, `POListView.tsx`, `DeliveryManagementView.tsx`, `DeliveryPlanView.tsx`, `PricingView.tsx`, `OCRView.tsx`, `CustomerListView.tsx`, `SupplierListView.tsx`, `StorageView.tsx`, `ContactsView.tsx`.
