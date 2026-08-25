# Enterprise Cockpit Design System & Tokens/CSS Infrastructure Analysis

**Author:** Explorer 1 (Design Guidelines & Tokens/CSS Infrastructure Specialist)  
**Date:** 2026-08-25  
**Target System:** TSG Business OS — Enterprise Cockpit UI/UX Re-architecture (Milestones R1 - R5)  
**Status:** Completed Analysis for Milestone R1 Planning

---

## 1. Executive Summary & Design Read

> **Design Read:**  
> *"Reading this as: High-performance B2B Enterprise ERP & Operations Cockpit for supply chain, purchase orders, logistics scheduling, pricing reconciliation, and commercial intelligence, with an Enterprise Cockpit aesthetic (linear precision, crisp data density, Apple macOS Sequoia chrome, tactile spring physics, OKLCH/Slate color ramps, vibrant semantic accents, and tabular typography)."*

The current TSG Business OS codebase possesses rich business logic and comprehensive workflows across 13+ modules. However, the visual and CSS foundation currently relies on ad-hoc Tailwind classes, inconsistent hardcoded hex colors (`#1D1D1F`, `#F5F5F7`, `#F8F9FA`, `#007AFF`), uncalibrated gray/slate mixtures, coarse borders (`border-black/[0.08]`, `border-gray-300`), and fragmented micro-interaction behaviors.

Milestone R1 establishes the master CSS/token foundation in `src/index.css`, `index.html`, and a shared design tokens module (`src/lib/design-tokens.ts`), providing:
1. **Neutral Slate & OKLCH Ramp**: High-contrast, glare-free, enterprise-grade surface elevations.
2. **Vibrant Semantic Accent Colors**: Pure `#007AFF` (Enterprise Blue), `#10B981` (Emerald), `#F59E0B` (Amber), `#6366F1` (Indigo/Patina), `#EF4444` (Rose), and `#8B5CF6` (AI Assistant).
3. **Dual-Face Typography System**: `Roboto Condensed` for authoritative headers and display titles; `Inter` / `Roboto` with `font-variant-numeric: tabular-nums` for precision financial tables, metrics, and KPI figures.
4. **Spring Physics & Tactile Micro-Interactions**: Apple-grade tactile press (`scale(0.98)` / `translateY(1px)` with `cubic-bezier(0.16, 1, 0.3, 1)` spring curve), frosted glassmorphism overlays with sub-pixel edge refraction.
5. **Hairline Border Architecture**: Elimination of harsh, heavy borders in favor of delicate sub-pixel 1px hairlines (`border-slate-200/70` / `oklch(88% 0.01 240 / 0.6)`).
6. **Density Dials (`VISUAL_DENSITY: 8`, `DESIGN_VARIANCE: 4`, `MOTION_INTENSITY: 4`)**: Maximum scannability, dense tabular structures, zero wasted white space, high operational throughput.

---

## 2. Dial Configuration & Core Architectural Rules

| Dial | Value | Rationale |
| :--- | :---: | :--- |
| **`VISUAL_DENSITY`** | **8** | Enterprise Cockpit configuration: High data density, compact table rows, tight headers, maximum operational visibility without unnecessary vertical scroll. |
| **`DESIGN_VARIANCE`** | **4** | High structural consistency, aligned bento grids, strict rectangular/pill component hierarchy, no gratuitous asymmetry. |
| **`MOTION_INTENSITY`** | **4** | Snappy, motivated micro-interactions (spring tap feedback, smooth tab cross-fades, instant hover states); zero sluggish animations that slow daily data entry. |

---

## 3. Current vs. Target Design System Gap Matrix

| Aspect | Current Codebase State | Target Enterprise Cockpit State (Milestone R1) |
| :--- | :--- | :--- |
| **Color System** | Hardcoded hex strings (`#1D1D1F`, `#F5F5F7`, `#007AFF`) and arbitrary Tailwind classes (`bg-gray-50`, `bg-slate-50`, `bg-blue-600`) scattered across 40+ JSX files. | Centralized CSS variables in `@theme` (Tailwind v4) and type-safe token constants in `src/lib/design-tokens.ts`. Full OKLCH & Slate spectrum. |
| **Neutral Surfaces** | Mixed warm-gray `#F8F9FA` with Apple light-gray `#F5F5F7` and dirty gray-200 borders. | Clean 4-tier Slate Surface Elevation: `bg-cockpit-bg` (`#F8F9FB`), `bg-cockpit-surface` (`#FFFFFF`), `bg-cockpit-subtle` (`#F1F5F9`), `bg-cockpit-raised` (`#FAFAFC`). |
| **Vibrant Accents** | Inconsistent color codes across views; charts use random hex values in Recharts. | 5 Locked Semantic Accents: **Electric Blue (`#007AFF`)**, **Emerald (`#10B981`)**, **Amber (`#F59E0B`)**, **Indigo (`#6366F1`)**, **Rose (`#EF4444`)**, **Purple (`#8B5CF6`)**. |
| **Typography** | Generic sans-serif inheritance; tabular numbers only partially active via manual `.font-mono` classes. | Strict 2-tier font hierarchy: **Display/Header = Roboto Condensed** (tight tracking `-0.02em`), **Data/Body/Table = Inter / Roboto Tabular-Nums** (`tnum 1`, `zero 1`). |
| **Borders & Dividers** | Coarse `border-black/[0.08]`, heavy `border-gray-300`, `border-gray-200` creating visual clutter. | Micro Hairlines: `1px solid rgba(203, 213, 225, 0.65)` (`border-slate-200/70`) with subtle inner highlight glow. |
| **Micro-Interactions** | Simple `active:scale-95` on some buttons, none on table rows, no spring easing. | Standardized `.cockpit-spring-press` with `cubic-bezier(0.16, 1, 0.3, 1)` curve, smooth hover lift, keyboard focus rings (`ring-2 ring-blue-500/40 ring-offset-1`). |
| **Glassmorphism** | Basic `.ios-glass` without light refraction or reduced-transparency fallback. | Refined `.cockpit-glass` with `backdrop-filter: blur(20px) saturate(180%)`, 1px top highlight, smooth shadow, and dark mode ready fallback. |
| **Density & Layout** | Loose card padding (`p-6`, `gap-6`) consuming excessive vertical height. | Compact cockpit layout (`p-3.5`, `py-2`, `gap-3`), dense table cell padding (`py-2 px-3`), fixed sticky headers with frosted shadow. |

---

## 4. Master Design Token Architecture (Tailwind v4 `@theme`)

### 4.1 OKLCH & Slate Neutral Color Ramp
```css
:root {
  /* Cockpit Neutral Surfaces (Light Theme Default) */
  --cockpit-bg: oklch(0.978 0.005 240);          /* #F8F9FB - Primary App Ground */
  --cockpit-surface: oklch(1 0 0);               /* #FFFFFF - Card & Panel Ground */
  --cockpit-surface-subtle: oklch(0.962 0.008 240);/* #F1F5F9 - Sidebar & Sub-bars */
  --cockpit-surface-raised: oklch(0.992 0.003 240);/* #FAFAFC - Elevated Controls */
  --cockpit-surface-hover: oklch(0.945 0.012 240); /* #E2E8F0 - Hover Highlights */
  --cockpit-surface-active: oklch(0.925 0.015 240);/* #CBD5E1 - Pressed States */

  /* Hairlines & Dividers (Anti-coarseness) */
  --cockpit-hairline: oklch(0.88 0.012 240 / 0.7);  /* rgba(203, 213, 225, 0.7) */
  --cockpit-hairline-subtle: oklch(0.92 0.008 240 / 0.6);
  --cockpit-hairline-strong: oklch(0.75 0.025 240 / 0.8); /* Active / Focus Borders */

  /* Cockpit Typography Scale */
  --cockpit-text-primary: oklch(0.20 0.02 260);    /* #0F172A - Dominant Black/Slate */
  --cockpit-text-secondary: oklch(0.42 0.025 250); /* #334155 - Subheads & Column Labels */
  --cockpit-text-muted: oklch(0.58 0.02 250);     /* #64748B - Captions, Meta */
  --cockpit-text-faint: oklch(0.72 0.015 250);    /* #94A3B8 - Disabled, Placeholders */

  /* Vibrant Cockpit Semantic Accents */
  --accent-blue: #007AFF;                         /* Primary Navigation / Focus / CTA */
  --accent-blue-hover: #0066D6;
  --accent-blue-subtle: rgba(0, 122, 255, 0.08);
  --accent-blue-border: rgba(0, 122, 255, 0.25);

  --accent-emerald: #10B981;                      /* Completed / Reconciled / Profit */
  --accent-emerald-hover: #059669;
  --accent-emerald-subtle: rgba(16, 185, 129, 0.08);
  --accent-emerald-border: rgba(16, 185, 129, 0.25);

  --accent-amber: #F59E0B;                        /* In-Progress / Scheduled / Pending */
  --accent-amber-hover: #D97706;
  --accent-amber-subtle: rgba(245, 158, 11, 0.08);
  --accent-amber-border: rgba(245, 158, 11, 0.25);

  --accent-indigo: #6366F1;                       /* Contracts / OCR / Intelligence */
  --accent-indigo-hover: #4F46E5;
  --accent-indigo-subtle: rgba(99, 102, 241, 0.08);
  --accent-indigo-border: rgba(99, 102, 241, 0.25);

  --accent-rose: #EF4444;                         /* Overdue / Alert / Cancellation */
  --accent-rose-hover: #DC2626;
  --accent-rose-subtle: rgba(239, 68, 68, 0.08);
  --accent-rose-border: rgba(239, 68, 68, 0.25);

  --accent-purple: #8B5CF6;                       /* AI Assistant / Gemini */
  --accent-purple-hover: #7C3AED;
  --accent-purple-subtle: rgba(139, 92, 246, 0.08);
  --accent-purple-border: rgba(139, 92, 246, 0.25);

  /* Elevation Shadows */
  --shadow-cockpit-card: 0 1px 3px 0 rgba(15, 23, 42, 0.04), 0 1px 2px -1px rgba(15, 23, 42, 0.03);
  --shadow-cockpit-raised: 0 4px 6px -1px rgba(15, 23, 42, 0.05), 0 2px 4px -2px rgba(15, 23, 42, 0.04);
  --shadow-cockpit-float: 0 12px 24px -4px rgba(15, 23, 42, 0.08), 0 8px 16px -6px rgba(15, 23, 42, 0.04);
  --shadow-cockpit-glass: 0 8px 32px 0 rgba(15, 23, 42, 0.06);

  /* Spring Physics Easings */
  --ease-cockpit-spring: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-cockpit-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);
}
```

### 4.2 Tailwind v4 `@theme` Definition
```css
@theme {
  --font-display: "Roboto Condensed", -apple-system, BlinkMacSystemFont, sans-serif;
  --font-body: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-mono: "Inter", "Roboto Mono", SFMono-Regular, monospace;
  --font-tabular: "Inter", "Roboto", system-ui, sans-serif;

  --color-cockpit-bg: var(--cockpit-bg);
  --color-cockpit-surface: var(--cockpit-surface);
  --color-cockpit-subtle: var(--cockpit-surface-subtle);
  --color-cockpit-raised: var(--cockpit-surface-raised);
  --color-cockpit-hover: var(--cockpit-surface-hover);
  --color-cockpit-active: var(--cockpit-surface-active);
  --color-cockpit-hairline: var(--cockpit-hairline);
  --color-cockpit-hairline-strong: var(--cockpit-hairline-strong);

  --color-cockpit-text: var(--cockpit-text-primary);
  --color-cockpit-secondary: var(--cockpit-text-secondary);
  --color-cockpit-muted: var(--cockpit-text-muted);
  --color-cockpit-faint: var(--cockpit-text-faint);

  --color-accent-blue: var(--accent-blue);
  --color-accent-emerald: var(--accent-emerald);
  --color-accent-amber: var(--accent-amber);
  --color-accent-indigo: var(--accent-indigo);
  --color-accent-rose: var(--accent-rose);
  --color-accent-purple: var(--accent-purple);

  --shadow-cockpit-card: var(--shadow-cockpit-card);
  --shadow-cockpit-raised: var(--shadow-cockpit-raised);
  --shadow-cockpit-float: var(--shadow-cockpit-float);
  --shadow-cockpit-glass: var(--shadow-cockpit-glass);
}
```

---

## 5. Typography Hierarchy & Tabular Numerical Alignment

| Role | Font Family | Weight | Size / Line-Height | Tracking | Use Case |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Hero / H1** | `Roboto Condensed` | 700 / 800 | `text-2xl sm:text-3xl` (1.2) | `-0.025em` | Main View Titles, Banner Headers |
| **Section H2** | `Roboto Condensed` | 600 / 700 | `text-lg sm:text-xl` (1.25) | `-0.02em` | Bento Tile Headers, Sub-section Titles |
| **Card H3** | `Roboto Condensed` | 600 | `text-sm sm:text-base` (1.3) | `-0.015em` | Modal Headers, Panel Titles |
| **Body UI** | `Inter` | 400 / 500 | `text-xs sm:text-sm` (1.5) | `-0.01em` | Standard text, descriptions, buttons |
| **Tabular Numbers** | `Inter` (tabular) | 600 / 700 | `text-xs` to `text-2xl` | `-0.015em` | Currencies, Quantities, Margins, Dates, PO numbers |
| **Eyebrow / Overline** | `Roboto Condensed` | 700 (caps) | `text-[10px]` / `text-[11px]` | `+0.08em` | Category tags, Module section markers |
| **Badge Label** | `Inter` | 600 | `text-[10.5px]` | `0` | Status Pills, Filter counters |

### Tabular Numerical Enforcer:
```css
.tabular-nums,
[data-tabular="true"],
.font-tabular {
  font-family: var(--font-tabular) !important;
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum" 1, "zero" 1;
  letter-spacing: -0.015em;
}
```

---

## 6. Micro-Interactions, Spring Physics & Tactile Feedback

```css
/* Tactile Spring Button & Interactive Elements */
.cockpit-spring-press {
  transition: transform 0.18s cubic-bezier(0.16, 1, 0.3, 1), 
              box-shadow 0.18s cubic-bezier(0.16, 1, 0.3, 1),
              background-color 0.15s ease,
              border-color 0.15s ease;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

.cockpit-spring-press:active {
  transform: scale(0.97) translateY(1px);
}

.cockpit-spring-press:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--cockpit-bg), 0 0 0 4px var(--accent-blue);
}

/* Frosted Glassmorphism Cockpit Header & Float Dock */
.cockpit-glass {
  background-color: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border-color: var(--cockpit-hairline);
  box-shadow: inset 0 1px 0 0 rgba(255, 255, 255, 0.8), 0 4px 20px -4px rgba(15, 23, 42, 0.05);
}

/* Reduced Motion Safety */
@media (prefers-reduced-motion: reduce) {
  .cockpit-spring-press,
  .cockpit-card-hover {
    transition: none !important;
    transform: none !important;
  }
}
```

---

## 7. Inventory of Files to Create / Update for Milestone R1

### 1. `src/styles/tokens.css` (or incorporated into `src/index.css`)
- **Action:** Update/Overhaul `src/index.css`.
- **Details:** Add full Tailwind v4 `@theme`, CSS variables for OKLCH surfaces, semantic accent colors, typography definitions, spring animations, tabular-num enforcement, scrollbar polish, and density utility classes.

### 2. `src/lib/design-tokens.ts` (NEW File)
- **Action:** Create `src/lib/design-tokens.ts`.
- **Details:** Type-safe constants for:
  - `COCKPIT_COLORS` (hex & OKLCH values for Blue, Emerald, Amber, Indigo, Rose, Purple, Slate tiers).
  - `RECHARTS_THEME` (standard palette for Bar, Line, Pie, Area charts).
  - `STATUS_BADGE_VARIANTS` (pre-computed classNames for Completed, In-Progress, Overdue, Neutral, etc.).
  - `SPRING_TRANSITIONS` (Framer/Motion spring configs for `motion.div`).

### 3. `index.html`
- **Action:** Update `index.html`.
- **Details:** Ensure optimized Google Fonts `preconnect` and exact weight imports for Roboto Condensed (400, 500, 600, 700, 800), Inter (400, 500, 600, 700), Roboto (400, 500, 700). Set `meta theme-color` to `#F8F9FA`.

### 4. `src/components/MacTrafficLights.tsx`
- **Action:** Update `src/components/MacTrafficLights.tsx`.
- **Details:** Apply exact macOS Sequoia colors (`#FF5F56`, `#FFBD2E`, `#27C93F`), sub-pixel border, spring press feedback, and proper hover glyphs (`×`, `–`, `⤢`).

### 5. `src/components/SalutationBadge.tsx`
- **Action:** Refactor/Polish `SalutationBadge.tsx` and badge helpers with tabular-nums and accent tokens.

---

## 8. Milestone R1 Readiness & Verification Plan

1. **Static Analysis & Linting:**
   - Execute `npx tsc --noEmit` to guarantee 0 TypeScript compilation errors.
2. **Build Verification:**
   - Execute `npm run build` with Vite 6 & Tailwind v4 to ensure pristine artifact emission without stylesheet warnings.
3. **Visual Verification Matrix:**
   - Confirm font fallback order: `Roboto Condensed` active on all `<h1>` - `<h3>`, `Inter` active on data cells.
   - Confirm tabular numerical vertical alignment on currency/quantity columns.
   - Confirm tactile spring feedback on all buttons and interactive pills.
   - Confirm zero harsh black borders.
