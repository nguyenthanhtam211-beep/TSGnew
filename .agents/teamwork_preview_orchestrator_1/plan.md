# Master Execution Plan: Enterprise Cockpit UI/UX Redesign

## Goal
Transform TSG Business OS into a high-density, modern Enterprise Cockpit interface adhering to `.design_skills/taste-skill` and `.design_skills/impeccable`.

## Phases & Milestones

### Phase 0: Survey & Codebase Exploration (Parallel Explorers)
- Map project structure, UI components, styling conventions, navigation structure, data grids, modal systems, and subsystem views.
- Deep dive into `.design_skills/taste-skill/skills/taste-skill/SKILL.md` and `.design_skills/impeccable/DESIGN.md`.
- Produce unified `PROJECT.md` with Feature Inventory and Architecture.

### Phase 1: Milestone R1 - Design Tokens, Tailwind Config, Fonts & CSS Infrastructure
- Setup OKLCH/Slate color palette, vibrant modern accents (`#007AFF`, `#10B981`, `#F59E0B`, `#6366F1`), fonts (Roboto Condensed / Inter / Roboto tabular-nums), spring physics, subtle borders, micro-interactions in `tailwind.config.js` and `index.css`.

### Phase 2: Milestone R2 - Navigation, Header & Mobile Bottom Dock
- Glassmorphism sticky header, active pill navigation sidebar, responsive Mobile Bottom Dock (Thumb zone friendly, landscape safe area), breadcrumbs.

### Phase 3: Milestone R3 - Dashboard & Logistics Hub 360° Bento Grid
- High-density asymmetrical Bento Grid for KPI cards, Recharts chart theme polish, custom tooltips, pill progress bars, real-time activity stream widgets.

### Phase 4: Milestone R4 - Modern Desktop Data Grid, Inset-Grouped Mobile Cards, Modals/Drawers
- High-performance sticky header Data Grid with alternate subtle rows, density dials, column filter popovers, Mobile Apple Inset-Grouped cards with 4-box financial summary, bottom sheets, modern drawers.

### Phase 5: Milestone R5 - Full Subsystems Integration & UI Consistency
- Propagate new UI system across all modules: PO, Delivery, Delivery Plan, Pricing, OCR, Customer, Supplier, Storage, Contacts.

### Phase 6: Quality Gate & Verification
- Run `npx tsc --noEmit` and `npm run build` to verify 0 errors and complete visual / functional integrity.
