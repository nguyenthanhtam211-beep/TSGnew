# BRIEFING — 2026-08-25T01:06:45Z

## Mission
Fix and enhance OCR extraction (tax fields, custom prompts), Google Drive storage (folder escaping, collection alignment), and document naming conventions (TL short code, BG prefix, 100% clean ASCII diacritics stripping).

## 🔒 My Identity
- Archetype: worker
- Roles: implementer, qa, specialist
- Working directory: /Users/Nguyentam/antigravity/TSG-Business---New/.agents/worker_2_ocr_drive
- Original parent: b0829545-05ed-4483-a894-b3b99bbef5ff
- Milestone: Worker 2 - OCR & Drive Storage Specialist

## 🔒 Key Constraints
- Accept custom prompt in `api/ocr.ts`
- Include tax fields in `api/ocr.ts` and `src/lib/gemini.ts`: `buyerTaxCode`, `sellerTaxCode`, `vatRate`, `vatAmount`, `totalAmountWithVat`
- Update `src/lib/documentNaming.ts` for `"Thuốc lá Thăng Long"` / `"Thăng Long"` (`TL`), `'BG'` prefix, 100% clean ASCII diacritics stripping
- Fix single quote escaping and align collection name `'file_storage'` in `src/lib/driveSync.ts`
- Must pass `npx tsc --noEmit` with 0 errors
- DO NOT CHEAT: genuine logic only, no dummy/facade implementations

## Current Parent
- Conversation ID: b0829545-05ed-4483-a894-b3b99bbef5ff
- Updated: 2026-08-25T01:06:45Z

## Task Summary
- **What to build**: Completed implementation of OCR prompt customizability, tax fields extraction schema, smart document naming rules (Thăng Long & BG), clean ASCII diacritics stripping, and drive sync single quote query escape + `'file_storage'` collection alignment.
- **Success criteria**: All 4 files modified cleanly, `npx tsc --noEmit` passed with 0 errors, full behavioral verification performed.
- **Interface contracts**: PROJECT.md
- **Code layout**: api/ and src/lib/

## Key Decisions Made
- `api/ocr.ts`: Read `customPrompt` from `body?.prompt` (or parsed JSON body) with fallback to `defaultPrompt`.
- `src/lib/documentNaming.ts`: Added `replace(/[đĐ]/g, ...).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x00-\x7F]/g, '')` for 100% clean ASCII.
- `src/lib/driveSync.ts`: Unified Firestore collection name to `'file_storage'` and fixed single-quote replacement to `folderName.replace(/'/g, "\\'")`.

## Artifact Index
- DISPATCH.md — Assignment instructions
- progress.md — Real-time progress log
- handoff.md — Final completion report

## Change Tracker
- **Files modified**:
  - `api/ocr.ts`: Support custom prompt in request body, include VAT/tax fields in default schema.
  - `src/lib/gemini.ts`: Include VAT/tax fields in OCR schema.
  - `src/lib/documentNaming.ts`: Added Thăng Long short name mapping, BG quotation prefix, and 100% ASCII diacritics stripping.
  - `src/lib/driveSync.ts`: Aligned collection name to `'file_storage'`, fixed query single quote escaping.
- **Build status**: Pass (0 type errors)
- **Pending issues**: None

## Quality Status
- **Build/test result**: Pass (`npx tsc --noEmit` exited code 0)
- **Lint status**: Clean
- **Tests added/modified**: Automated verification executed successfully

## Loaded Skills
None
