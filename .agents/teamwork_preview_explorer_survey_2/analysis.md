# Survey & Technical Architecture Report: Navigation, Layout & Mobile Shell (Milestone R2)

**Explorer 2**: Navigation, Layout & Mobile Shell Specialist  
**Date**: 2026-08-25  
**Target Milestone**: R2 (Navigation, Header, Mobile Bottom Dock, Safe Areas, Breadcrumbs, Active Pill Sidebar)  
**Status**: Survey & Architecture Plan Complete  

---

## 1. Executive Summary

This investigation surveys the navigation and shell architecture of **TSG Business OS** against the enterprise design standards established in `ORIGINAL_REQUEST.md`, `taste-skill` (Anti-slop, density dials, layout discipline), and `impeccable` (OKLCH contrast, neo-kinpaku dark/light surfaces, tactile micro-interactions).

### Key Architectural Diagnoses
1. **Desktop Header Gap**: The application currently has *no unified desktop header bar* in `App.tsx`. Desktop view goes directly from the sidebar into viewports, causing missing global breadcrumbs, absent unified command/search triggers, and fragmented database/cloud status indicators.
2. **Missing Breadcrumb System**: 0 instances of hierarchical breadcrumb navigation exist across the entire application (`src/`), leaving users with no visual location context when drilling into deep views (e.g., `Logistics Hub > Sổ Giao Hàng PXK` or `Đơn Hàng PO > PO-2026-001`).
3. **Sidebar Active State Refinement**: Current sidebar active tab items use simple solid fill (`bg-[#007AFF] text-white`) with static transitions, lacking modern sliding active pills (`layoutId` animated pill), refined OKLCH accent highlights, and tactile feedback.
4. **Mobile Bottom Dock Ergonomics**: Current bottom dock in `App.tsx` (lines 1176–1247) is functional with 6 items, but lacks floating island geometry, sliding active indicator pill, spring physics, and landscape safe-area gutters (`max(env(safe-area-inset-left), 16px)`).
5. **Viewport & Container Resilience**: `App.tsx` root uses `h-screen` instead of `min-h-[100dvh]` and lacks strict container width caps and safe-area margin wrappers for notch/Dynamic Island devices in landscape.

---

## 2. Comprehensive Codebase Survey

### 2.1 Current Shell & Layout Hierarchy (`src/App.tsx`)

| Component / Layer | Current Implementation (`src/App.tsx`) | Limitations & Flaws |
|---|---|---|
| **Root Shell Container** | Line 617: `<div className="flex flex-col lg:flex-row h-screen bg-gray-50 text-gray-900 font-sans print:bg-white print:h-auto print:block overflow-hidden">` | Uses `h-screen` instead of modern iOS 100dvh (`min-h-[100dvh]`). Causes layout jumping when iOS address bar collapses/expands. |
| **Mobile Top Header** | Lines 620–675: `<div className="lg:hidden flex items-center justify-between ... ios-glass ...">` | Mobile-only header. Right-side actions (Memory, AI, Help, Settings) are not unified with desktop. |
| **Desktop Header** | **None** (direct jump to viewport at line 910) | No persistent desktop header for breadcrumbs, global search/actions, sync status, or user profile. |
| **Desktop Sidebar** | Lines 752–907: `<div className="hidden lg:flex bg-[#F5F5F7]/95 backdrop-blur-2xl ...">` | Width switches between `w-64` and `w-16`. Active tab uses harsh solid blue (`bg-[#007AFF] text-white`). |
| **Mobile Navigation Drawer** | Lines 677–750: Sheet sliding from left with backdrop blur. | Accordion groups are functional but lacks smooth spring open/close and refined OKLCH borders. |
| **Mobile Bottom Dock** | Lines 1176–1247: Fixed bar at bottom with 6 action buttons. | Fixed block at bottom instead of floating ergonomic glass dock. No sliding pill transition between tabs. |
| **Main Content Viewport** | Lines 909–1145: `<div className="flex-1 flex flex-col overflow-y-auto min-h-0 ... pb-20 lg:pb-0">` | Needs standardized container padding, landscape safe-area insets, and consistent `pb-24 lg:pb-6` spacing. |

### 2.2 Navigation Data Structure (`src/App.tsx`)

`App.tsx` defines 5 navigation groups across 19 active views:
1. **Executive (`executive`)**:
   - `dashboard`: "Bàn Làm Việc & Báo Cáo" (Bảng Điều Hành)
   - `workflow`: "Quy Trình Nghiệp Vụ 5 Bước"
2. **Logistics & Sales (`logistics`)**:
   - `po`: "Quản Lý Đơn Hàng PO"
   - `logistics`: "Kế Hoạch & Giao Hàng 360°" (Sub-tabs: `calendar`, `plan`, `delivery`, `reconcile`)
3. **Commercial & Catalog (`commercial`)**:
   - `customers`: "Khách Hàng & Đối Tác"
   - `pricing`: "Bảng Giá, Hợp Đồng & Hoa Hồng" (Sub-views: `contracts`, `commissions`, `pricing`)
   - `products`: "Sản Phẩm & Tiêu Chuẩn Specs" (Sub-views: `products`, `specs`)
4. **AI & Storage Hub (`ai_storage`)**:
   - `ocr`: "Quét OCR & Định Giá"
   - `assistant`: "Trợ Lý AI Gemini"
   - `storage`: "Kho Tệp & Sổ Đối Soát"
   - `tasks`: "Công Việc & Lịch Hạn"
5. **System (`system`)**:
   - `help`: "Trợ Giúp & Hướng Dẫn"
   - `settings`: "Cài Đặt Hệ Thống"

---

## 3. Impeccable & Taste-Skill Design Directives for R2

### 3.1 Glassmorphism & Header Surface Guidelines
- **Background**: Frosted OKLCH neutral glass `bg-white/80 dark:bg-slate-900/80 backdrop-blur-md`.
- **Border**: Clean subtle hairline border `border-b border-slate-200/80 dark:border-slate-800/80` (1px hairline, zero heavy drop shadow).
- **Height**: Standardized height cap `h-14` (56px) on desktop, `h-13` (52px) on mobile, `h-11` (44px) in mobile landscape.
- **Components inside Header**:
  - Left: Sidebar collapse toggle, Breadcrumb trail (e.g., `Logistics Hub > Kế Hoạch Giao`), Page Title.
  - Center/Right: Global search bar (`Cmd+K` pill trigger), Real-time Database Sync pulse pill (`13 CSDL • Live`), Gemini AI sparkle trigger, Help guide modal trigger, System status.

### 3.2 Clean Active Pill Sidebar
- **Active State (`NavItem`)**:
  - Replace solid square background with a refined pill background using Motion's `layoutId="active-sidebar-pill"`.
  - Color: Active pill `bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 font-semibold ring-1 ring-blue-500/25` or crisp enterprise blue `bg-[#007AFF] text-white shadow-xs` with subtle 1px border.
  - Icon container: Crisp rounded square with subtle elevation (`w-7 h-7 rounded-lg flex items-center justify-center`).
  - Badges: Tabular numbers `font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-full`.
- **Collapsed Mode (`w-16` / 64px)**:
  - Center icons vertically and horizontally.
  - Show floating tooltip / hover cards with item label and badge count on hover.
  - Keep traffic lights visible and aligned.

### 3.3 Thumb-Zone Mobile Bottom Dock
- **Floating Island Geometry**:
  - Instead of a full-bleed flat bar, elevate to a floating pill dock:
    `fixed bottom-3 inset-x-3 max-w-md mx-auto z-50 ios-glass border border-white/40 dark:border-slate-700/50 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] px-2 py-1.5`
  - Safe-area bottom offset: `calc(12px + env(safe-area-inset-bottom, 0px))`.
- **Sliding Pill Active Indicator**:
  - Uses `layoutId="mobile-dock-active-pill"` for smooth physical slide between the 6 items.
- **Tactile Touch Physics**:
  - `whileTap={{ scale: 0.88 }}` with spring damping `stiffness: 450, damping: 32`.
  - Icon + micro-label (`text-[9.5px] font-semibold tracking-tight`).
  - Active tab highlighted in vibrant Electric Blue `#007AFF`.

### 3.4 Landscape Safe Area & Responsive Containers
- **Landscape Safe Areas**:
  - Header & Bottom Dock: `pl-[max(env(safe-area-inset-left),16px)] pr-[max(env(safe-area-inset-right),16px)]`.
  - Viewport padding: `pl-[max(env(safe-area-inset-left),12px)] pr-[max(env(safe-area-inset-right),12px)]`.
- **Container Max-Width Discipline**:
  - Viewports wrapped in `max-w-[1500px] mx-auto w-full px-3 sm:px-6 lg:px-8 py-4 sm:py-6`.
  - Avoid horizontal overflow (`overflow-x-hidden`).

---

## 4. File-by-File Change Plan for Milestone R2

### File 1: `src/components/Breadcrumbs.tsx` (NEW COMPONENT)
**Purpose**: Reusable dynamic breadcrumb navigation bar with home icon, category group title, active view title, sub-tab context, and clickable crumbs.
**Key Features**:
- Receives `activeTab`, `navGroups`, `subTabTitle`, `onNavigateTab`.
- Automatically determines group hierarchy (e.g. `Kinh Doanh & Logistics` -> `Kế Hoạch & Giao Hàng 360°` -> `Lịch Giao Nhận`).
- Clean chevron separators (`<ChevronRight size={12} className="text-slate-400" />`).
- Subtle hover states and quick jump back.

### File 2: `src/components/AppHeader.tsx` (NEW COMPONENT or MODULARIZED HEADER)
**Purpose**: Unified Desktop & Mobile Glassmorphism Header Bar.
**Key Features**:
- Desktop: Left toggle sidebar button, Mac Traffic Lights, Breadcrumbs component, Center Quick Search Pill (`Cmd+K`), Right Quick Action Pills (Database Sync Status, Gemini AI Sparkle, Help Guide, Settings, Fullscreen Toggle).
- Mobile: Integrated iOS glass header with hamburger menu, TSG branding, active view title, safe-area top padding, and quick action icons.

### File 3: `src/components/AppSidebar.tsx` or `src/App.tsx` (Sidebar Refinement)
**Purpose**: Desktop macOS Sequoia Active Pill Sidebar.
**Key Features**:
- Active pill with Motion `layoutId="active-sidebar-pill"`.
- Accordion navigation groups with smooth expand/collapse.
- In-sidebar instant feature search with clear button.
- Tooltips for collapsed mode.
- Storage & DB status summary button.

### File 4: `src/components/MobileBottomDock.tsx` (NEW COMPONENT or INTEGRATED DOCK)
**Purpose**: Thumb-friendly floating iOS dock with spring physics.
**Key Features**:
- Floating glass pill geometry with safe-area bottom offset.
- Motion `layoutId="mobile-dock-active-pill"` for sliding active background.
- Badge counters for PO and Delivery with tabular numerals.
- Landscape-optimized compact layout (`landscape:py-0.5`).

### File 5: `src/index.css` (Style & Safe-Area Updates)
**Purpose**: Design tokens, glassmorphism utilities, safe-area classes, and spring tap feedback.
**Updates**:
- Enhanced `.ios-glass` with OKLCH neutral backdrop support.
- Safe-area utilities: `.safe-area-pt`, `.safe-area-pb`, `.safe-area-pl`, `.safe-area-pr`.
- `.pb-mobile-dock` spacing helper for views.
- Viewport stability rule: `min-h-[100dvh]` root wrapper.

### File 6: `src/components/index.ts`
**Purpose**: Export new navigation components (`Breadcrumbs`, `AppHeader`, `MobileBottomDock`).

---

## 5. Verification & Quality Gates for Milestone R2

| Checkpoint | Target State | Verification Method |
|---|---|---|
| **TypeScript Compilation** | 0 errors | `npx tsc --noEmit` |
| **Vite Build** | 0 errors | `npm run build` |
| **Desktop Glass Header** | Height 56px, backdrop blur, breadcrumbs visible, Cmd+K search trigger | DOM inspection & visual check |
| **Active Pill Sidebar** | Sliding active pill with spring motion, smooth accordion collapse | Interaction testing |
| **Mobile Floating Dock** | Floating rounded-2xl glass dock, thumb-friendly tap targets, safe-area insets | Responsive viewport simulation (375px, 390px, 430px) |
| **Landscape Safe Areas** | No content clipping behind notch/Dynamic Island | Landscape simulation (844x390, 932x430) |

---
*Report prepared for Milestone R2 implementation by Explorer 2.*
