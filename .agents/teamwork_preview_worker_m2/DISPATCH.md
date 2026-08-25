## 2026-08-25T01:42:12Z

Assignee: Worker 2 (Milestone M2)
Working Directory: /Users/Nguyentam/antigravity/TSG-Business---New/.agents/teamwork_preview_worker_m2
Parent Orchestrator: /Users/Nguyentam/antigravity/TSG-Business---New/.agents/teamwork_preview_orchestrator_1

Tasks for Milestone M2:
1. Implement Breadcrumbs:
   - Create reusable `src/components/Breadcrumbs.tsx` (or `src/components/layout/Breadcrumbs.tsx`).
   - Dynamic path derivation from active tab/module, subtab, and optional item context with subtle icons and spring interactions.
2. Implement / Polish Header:
   - Provide a unified glassmorphism header (`backdrop-blur-md bg-white/85 dark:bg-slate-900/85 border-b border-slate-200/60 dark:border-slate-800/60`).
   - Include Breadcrumbs, global `Cmd+K` / Quick Search trigger pill, DB/Cloud sync status indicator (`Online / Syncing` with pulse dot), notification / quick action icons, and user avatar.
   - Clean responsive layout for desktop, tablet, and mobile.
3. Refactor Desktop Sidebar Navigation in `src/App.tsx`:
   - Active pill indicator using Motion `layoutId="active-sidebar-pill"` with subtle accent glow and smooth spring transition.
   - Crisp tabular badge count tags (`tabular-nums font-mono text-xs`).
   - Clean grouping with hairline dividers.
   - Collapsible state (`w-16` vs `w-64`) with smooth spring animation and tooltip hover states.
4. Refactor Mobile Bottom Navigation in `src/components/MobileBottomNav.tsx`:
   - Floating rounded-2xl glass island dock (`cockpit-glass` with thumb-zone positioning and bottom safe area padding).
   - Sliding active pill indicator (`layoutId="mobile-dock-pill"`).
   - Tactile spring touch physics (`whileTap={{ scale: 0.88 }}`) and notification badges.
5. Safe Area & Viewport Handling:
   - Update outer layout containers to use `min-h-[100dvh]` instead of `h-screen`.
   - Add safe-area padding for iOS Safari notch and landscape orientations (`padding-bottom: max(env(safe-area-inset-bottom), 12px)`, landscape gutters).
6. Verify:
   - Run `npx tsc --noEmit` and `npm run build` via terminal commands to confirm 0 TypeScript errors and 0 build errors.
   - Document commands executed and exact output in your report.
7. Output:
   - Write your implementation summary to `/Users/Nguyentam/antigravity/TSG-Business---New/.agents/teamwork_preview_worker_m2/changes.md` and `/Users/Nguyentam/antigravity/TSG-Business---New/.agents/teamwork_preview_worker_m2/handoff.md`.
   - Send a completion message to the parent orchestrator with the summary and verification results.
