# Handoff Report: Design Guidelines & Tokens/CSS Infrastructure Specialist (Explorer 1)

**Agent:** Explorer 1 (`teamwork_preview_explorer_survey_1`)  
**Target:** Parent Orchestrator (`teamwork_preview_orchestrator_1`)  
**Milestone:** Survey & Milestone R1 Planning  
**Date:** 2026-08-25  

---

## 1. Observation

1. **Original Request & Project Targets (`ORIGINAL_REQUEST.md:1-24`):**
   - Goal: Re-architect and elevate TSG Business OS UI/UX to Modern Enterprise Cockpit style.
   - Milestone R1: "Design Tokens & Tailwind & index.css (Neutral OKLCH/Slate ramp, vibrant accent colors #007AFF, #10B981, #F59E0B, #6366F1, phông chữ Roboto Condensed & Inter/Roboto tabular-nums, spring physics, tactile micro-interactions, loại bỏ viền thô)."
2. **Design Skill Frameworks:**
   - `.design_skills/taste-skill/skills/taste-skill/SKILL.md:43-76`: Core dial configuration (`VISUAL_DENSITY: 8`, `DESIGN_VARIANCE: 4`, `MOTION_INTENSITY: 4` for cockpit); anti-slop rules; typography pairings; WCAG AA contrast rules.
   - `.design_skills/impeccable/DESIGN.md:8-105`: OKLCH color definitions; strict hairline-first rule (`1px sub-pixel borders`); tactile elevation; semantic token discipline.
3. **Current Styling & Token State:**
   - `src/index.css:1-49`: Uses basic `@import "tailwindcss";` and raw font variables without Tailwind v4 `@theme` block. Colors are hardcoded with `#F8F9FA`, `#1E293B`, and scattered tailwind color utilities.
   - `index.html:18-21`: Loads Roboto Condensed, Roboto, Inter via Google Fonts, but body has hardcoded `bg-[#F5F5F7]` and `text-[#1D1D1F]`.
   - `src/App.tsx:752-840, 1177-1247, 2285-2400`: Relies on hardcoded hex classes (`bg-[#F5F5F7]`, `text-[#1D1D1F]`, `bg-[#007AFF]`, `border-black/[0.06]`, `border-gray-200`, `border-gray-300`). Coarse borders degrade visual hierarchy.
4. **Build & Typecheck Baseline:**
   - Tool execution `npm run lint` (`tsc --noEmit`) ran successfully with exit code 0.

---

## 2. Logic Chain

1. From **Observation 1 & 3**, the current codebase has strong functionality but lacks a centralized, scalable design token architecture. Color constants, fonts, borders, and shadows are duplicated across 40+ components with differing shades and harsh borders.
2. From **Observation 2**, the target Enterprise Cockpit aesthetic requires high visual density (`VISUAL_DENSITY: 8`), disciplined motion (`MOTION_INTENSITY: 4`), structured variance (`DESIGN_VARIANCE: 4`), OKLCH/Slate neutral surfaces, and vibrant locked semantic accents (`#007AFF`, `#10B981`, `#F59E0B`, `#6366F1`).
3. From **Observation 3**, Tailwind v4 is present in the build pipeline (`@tailwindcss/vite: ^4.1.14`), making the `@theme` directive in `src/index.css` the exact standard mechanism to expose semantic tokens (`bg-cockpit-bg`, `bg-cockpit-surface`, `text-cockpit-text`, `border-cockpit-hairline`, `accent-blue`, `accent-emerald`, `accent-amber`, `accent-indigo`, etc.).
4. Adding a dedicated TypeScript token dictionary `src/lib/design-tokens.ts` allows Recharts chart definitions, badge styling maps, and Motion spring presets to share the exact same values as CSS tokens, ensuring 100% UI consistency across Milestones R1 to R5.

---

## 3. Caveats

1. **Scope Boundary:** This survey is read-only. Source code modifications (updating `src/index.css`, creating `src/lib/design-tokens.ts`, updating `index.html`, etc.) will be executed in Milestone R1 implementation.
2. **Third-Party Calendar / Print Styles:** FullCalendar and print stylesheets in `src/index.css:104-174` must be preserved while adding the new `@theme` tokens.

---

## 4. Conclusion

The design system roadmap for Milestone R1 is fully mapped and ready for execution:
1. **`src/index.css`**: Inject Tailwind v4 `@theme`, OKLCH/Slate 4-tier surface ramp, 6 vibrant semantic accents (`#007AFF`, `#10B981`, `#F59E0B`, `#6366F1`, `#EF4444`, `#8B5CF6`), dual typography (`Roboto Condensed` display + `Inter` tabular data), spring micro-interaction classes (`.cockpit-spring-press`), and hairline border rules.
2. **`src/lib/design-tokens.ts`**: Create type-safe TS tokens for Recharts, badges, and Motion transitions.
3. **`index.html`**: Optimize font weights and metadata.
4. **`src/components/MacTrafficLights.tsx` & `SalutationBadge.tsx`**: Update to consume cockpit tokens and spring physics.

All findings, token specifications, and code blueprints are documented in:
`/Users/Nguyentam/antigravity/TSG-Business---New/.agents/teamwork_preview_explorer_survey_1/analysis.md`

---

## 5. Verification Method

To independently verify the survey and prepare for Milestone R1:
1. **TypeScript Typecheck:**
   ```bash
   npm run lint
   # Expected: tsc --noEmit completes with 0 errors
   ```
2. **Build Verification:**
   ```bash
   npm run build
   # Expected: Vite 6 builds dist/ without CSS or module resolution errors
   ```
3. **Inspect Analysis Report:**
   Read `/Users/Nguyentam/antigravity/TSG-Business---New/.agents/teamwork_preview_explorer_survey_1/analysis.md` for the full CSS `@theme` specification and file action plan.
