# Handoff Report: Navigation, Layout & Mobile Shell (Milestone R2)

## 1. Observation

Direct code observations from the TSG Business OS codebase:
- **Root Layout & Viewport (`src/App.tsx:617`)**:
  ```tsx
  <div className="flex flex-col lg:flex-row h-screen bg-gray-50 text-gray-900 font-sans print:bg-white print:h-auto print:block overflow-hidden">
  ```
  Uses `h-screen` which can cause viewport jumping on iOS Safari when the URL address bar expands/contracts.
- **Mobile Top Header (`src/App.tsx:621–675`)**:
  Mobile header exists (`lg:hidden flex items-center justify-between ... ios-glass ...`), but there is *no corresponding unified desktop header*. On desktop (`lg:flex`), content begins immediately with `<div className="flex-1 flex flex-col overflow-y-auto min-h-0 ... pb-20 lg:pb-0">` (`src/App.tsx:910`).
- **Breadcrumb Navigation**:
  Search for `breadcrumb` across `src/` yielded 0 matches. No hierarchical breadcrumbs exist anywhere in the application.
- **Desktop Sidebar Navigation (`src/App.tsx:752–907`) & `NavItem` (`src/App.tsx:1284–1344`)**:
  Active tab state is styled with static classes:
  ```tsx
  isActive ? "bg-[#007AFF] text-white shadow-xs font-semibold" : "text-[#1D1D1F] hover:bg-black/[0.04] font-medium"
  ```
  Lacks a shared animated active pill (`layoutId="activeSidebarPill"`) and modern OKLCH border/accent highlights.
- **Mobile Bottom Navigation Dock (`src/App.tsx:1176–1247`)**:
  Implemented as a full-bleed fixed bottom bar:
  ```tsx
  <div className="lg:hidden fixed bottom-0 left-0 right-0 z-[100] ios-glass border-t border-black/[0.06] pl-[max(env(safe-area-inset-left),12px)] pr-[max(env(safe-area-inset-right),12px)] py-1 landscape:py-0.5 flex items-center justify-around text-slate-500 pb-[max(env(safe-area-inset-bottom),8px)] shadow-[0_-4px_25px_rgba(0,0,0,0.08)] pointer-events-auto select-none">
  ```
  Contains 6 action buttons (`dashboard`, `logistics`, `po`, `ocr`, `assistant`, `menu`), but lacks a floating island pill geometry, animated sliding active tab indicator, and landscape safe-area container gutters.
- **Safe Area Tokens (`src/index.css:14, 206–251`)**:
  Contains `--safe-bottom: env(safe-area-inset-bottom, 16px);`, `.pb-mobile-nav`, and `.ios-glass` (`backdrop-filter: blur(24px) saturate(180%)`).
- **Baseline Typecheck**:
  Command `npx tsc --noEmit` exited with code 0 (0 errors).

---

## 2. Logic Chain

1. **Premise 1**: Enterprise Cockpit standards (defined in `ORIGINAL_REQUEST.md`, `taste-skill`, and `impeccable`) require cohesive navigation hierarchy, glassmorphism headers, tactile micro-interactions, and flawless mobile ergonomics.
2. **Premise 2**: The current codebase lacks a desktop header and breadcrumb system, creating a navigation gap where desktop users lack location context, unified quick search, and global system status.
3. **Premise 3**: Mobile users interact primarily in the thumb zone; elevating the bottom dock from a flat full-width bar to a floating frosted glass pill with sliding spring indicator (`layoutId="mobileDockActivePill"`) significantly improves touch ergonomics and aesthetics.
4. **Premise 4**: Replacing static active sidebar styles with sliding spring pills (`layoutId="activeSidebarPill"`) brings the sidebar into compliance with macOS Sequoia and neo-kinpaku design standards.
5. **Conclusion**: Executing Milestone R2 requires:
   - Creating/integrating a unified `Breadcrumbs` component and `AppHeader` (glassmorphic header with breadcrumbs, Cmd+K search trigger, and DB status).
   - Upgrading `AppSidebar` / `NavItem` with sliding active pills and refined accordion groups.
   - Upgrading `MobileBottomDock` to a floating glass island with spring touch physics.
   - Ensuring `min-h-[100dvh]` and landscape safe-area insets across all containers.

---

## 3. Caveats

- **Caveat 1**: Individual module views (e.g. `DashboardView`, `LogisticsHubView`, `CustomerView`) have their own internal headers and filter toolbars. The global `AppHeader` should complement rather than duplicate view-level actions.
- **Caveat 2**: Mobile bottom dock has 6 items; on very small screens (< 360px width), label text must remain compact (`text-[9.5px]`) to avoid line wrapping.
- **Caveat 3**: All motion transitions must respect `prefers-reduced-motion` to maintain accessibility compliance.

---

## 4. Conclusion

The survey for Milestone R2 is complete with concrete specifications and file mapping:
1. **Target Files for Modification**:
   - `src/App.tsx` (Main shell integration, Header, Sidebar, Bottom Dock, Safe Areas)
   - `src/index.css` (Glass tokens, safe-area utilities, touch feedback classes)
   - `src/components/index.ts` (Component exports)
   - `src/components/MacTrafficLights.tsx` (macOS control polish)
2. **New Components to Create**:
   - `src/components/Breadcrumbs.tsx` (Dynamic hierarchical breadcrumbs)
   - Optionally `src/components/AppHeader.tsx` and `src/components/MobileBottomDock.tsx` (for clean modular separation)
3. **Readiness**: All structural requirements, CSS classes, Motion parameters, and design tokens are mapped. The codebase is currently 100% type-safe and ready for R2 implementation.

---

## 5. Verification Method

To independently verify the navigation and shell implementation in R2:
1. **TypeScript Build Verification**:
   ```bash
   npx tsc --noEmit
   npm run build
   ```
2. **Desktop Header & Breadcrumbs Verification**:
   - Verify desktop viewport (width >= 1024px) displays top glass header (`h-14`, `backdrop-blur-md`).
   - Switch tabs (`dashboard` -> `po` -> `logistics` -> `customers`) and verify breadcrumb trail updates dynamically (e.g., `Kinh Doanh & Logistics > Quản Lý Đơn Hàng PO`).
3. **Sidebar Active Pill Verification**:
   - Click between sidebar items and verify smooth sliding spring transition on the active pill background.
   - Test collapse toggle (Yellow traffic light or collapse button) and verify `w-16` icon alignment and tooltip labels.
4. **Mobile Bottom Dock Verification**:
   - Simulate mobile viewport (e.g. iPhone 14/15 390x844).
   - Verify floating bottom dock is centered with rounded-2xl glass geometry and active tab indicator slides smoothly.
5. **Landscape Safe Area Verification**:
   - Simulate mobile landscape viewport (844x390, 932x430).
   - Verify safe area gutters (`pl-[max(env(safe-area-inset-left),16px)]`, `pr-[max(env(safe-area-inset-right),16px)]`) prevent content from clipping behind the notch.
