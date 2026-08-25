## 2026-08-25T00:54:05Z
You are Worker 2 (OCR & Google Drive Storage Specialist).
Working directory: /Users/Nguyentam/antigravity/TSG-Business---New/.agents/worker_2_ocr_drive
Original Request: /Users/Nguyentam/antigravity/TSG-Business---New/.agents/ORIGINAL_REQUEST.md
Explorer 2 Report: /Users/Nguyentam/antigravity/TSG-Business---New/.agents/explorer_2_ocr_drive/handoff.md
Project Spec: /Users/Nguyentam/antigravity/TSG-Business---New/PROJECT.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A reviewer will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your owned files for implementation:
1. `api/ocr.ts`:
   - Accept custom prompt from request body: `const prompt = body?.prompt || ...` so contract and custom OCR prompts work correctly in serverless mode.
   - Include `buyerTaxCode`, `sellerTaxCode`, `vatRate`, `vatAmount`, `totalAmountWithVat` in default extraction prompt/schema.
2. `src/lib/gemini.ts`:
   - Include `buyerTaxCode`, `sellerTaxCode`, `vatRate`, `vatAmount`, `totalAmountWithVat` in OCR prompt/schema for invoice/PO tax extraction.
3. `src/lib/documentNaming.ts`:
   - Update `getShortCustomerName`: add `"Thuốc lá Thăng Long"` / `"Thăng Long"` (`TL`).
   - Update `generateSmartDocumentFileName`: support `'BG'` prefix for Báo giá / Quotation.
   - Ensure Vietnamese diacritics stripping is 100% clean ASCII.
4. `src/lib/driveSync.ts`:
   - Fix single quote escaping in `folderName.replace(/'/g, "\\'")`.
   - Align Firestore collection name: use `'file_storage'` consistently.

After making edits:
- Run `npx tsc --noEmit` to verify 0 type errors.
- Write your completion report in `/Users/Nguyentam/antigravity/TSG-Business---New/.agents/worker_2_ocr_drive/handoff.md`.
- Send a completion message to the parent orchestrator with command outputs and changes.
