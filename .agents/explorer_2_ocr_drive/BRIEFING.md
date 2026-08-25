# BRIEFING — 2026-08-25T07:52:55Z

## Mission
Audit Gemini AI OCR extraction, smart document naming, and Google Drive 3-tier storage architecture in TSG Business OS.

## 🔒 My Identity
- Archetype: Explorer
- Roles: OCR & Google Drive Storage Specialist
- Working directory: /Users/Nguyentam/antigravity/TSG-Business---New/.agents/explorer_2_ocr_drive
- Original parent: b0829545-05ed-4483-a894-b3b99bbef5ff
- Milestone: Explorer 2 Audit Complete

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Inspect OCR services, prompts, schemas, parsing logic for PO, VAT invoices, PXK, Quotations, Delivery records
- Audit documentNaming.ts for formatting, Vietnamese diacritics stripping, fallbacks
- Audit Google Drive integration, folder hierarchy, and 3-tier caching (RAM / LocalStorage-IndexedDB / Firestore)
- Output analysis.md and handoff.md

## Current Parent
- Conversation ID: b0829545-05ed-4483-a894-b3b99bbef5ff
- Updated: 2026-08-25T07:52:55Z

## Investigation State
- **Explored paths**: `src/lib/gemini.ts`, `api/ocr.ts`, `src/prompt.ts`, `src/lib/documentNaming.ts`, `src/lib/driveSync.ts`, `src/lib/dbEngine.ts`, `src/hooks/useFirestoreCollection.ts`, `src/components/OCRView.tsx`, `src/components/WorkflowView.tsx`, `src/components/ContractsView.tsx`, `src/components/StorageView.tsx`, `src/components/GoogleDriveSyncModal.tsx`, `src/App.tsx`
- **Key findings**:
  1. `api/ocr.ts:123` hardcoded prompt ignores `body.prompt`, breaking contract OCR serverless fallback.
  2. `WorkflowView.tsx:438` assigns `DD/MM/YYYY` directly into state bound to `<input type="date">`, causing blank input and date parsing errors.
  3. `App.tsx:469-526` `handleUploadToDrive` lacks a `return` statement, preventing the Google Drive link banner from showing in `OCRView.tsx`.
  4. Collection name mismatch: `driveSync.ts:188` writes to `'storage_files'`, while `App.tsx:151` and `StorageView.tsx` read `'file_storage'`.
  5. `driveSync.ts:839` fails to escape single quotes in Google Drive search queries.
  6. `documentNaming.ts:63` omits "Thuốc lá Thăng Long" in `getShortCustomerName` and lacks `'BG'` prefix for quotations.
- **Unexplored areas**: None within OCR and Drive storage scope.

## Key Decisions Made
- All findings, root causes, exact code lines, and proposed fix strategies compiled in `analysis.md` and `handoff.md`.

## Artifact Index
- DISPATCH.md — Initial mission dispatch
- BRIEFING.md — Persistent working memory
- progress.md — Liveness tracker
- analysis.md — Deep technical findings & code audit
- handoff.md — 5-Component handoff report
