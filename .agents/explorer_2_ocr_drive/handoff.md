# HANDOFF REPORT — EXPLORER 2 (OCR & GOOGLE DRIVE SPECIALIST)

**Task**: Deep Code-Level Exploration & Audit of Gemini AI OCR Document Extraction, Smart Document Naming (`documentNaming.ts`), Google Drive Storage & 3-Tier Caching Architecture.  
**Working Directory**: `/Users/Nguyentam/antigravity/TSG-Business---New/.agents/explorer_2_ocr_drive`  
**Date**: 2026-08-25  

---

## 1. OBSERVATION

1. **OCR Serverless API ignores custom prompt (`api/ocr.ts:123`)**:
   - In `src/lib/gemini.ts:525`, `processContractOCR` sends `{ base64, mimeType, apiKey, prompt }` to `/api/ocr`.
   - In `api/ocr.ts:123`, the code declares:
     ```typescript
     const prompt = `Bạn là một chuyên gia OCR tài liệu doanh nghiệp hàng đầu của Tập đoàn Tâm Sen (TSG)...`;
     ```
     It hardcodes the PO/PXK prompt and does not read `body?.prompt`.
2. **Date format incompatibility breaks HTML5 Date input (`src/components/WorkflowView.tsx:438, 1685`)**:
   - In `src/prompt.ts` & `src/lib/gemini.ts:287`, OCR returns `"DD/MM/YYYY"` (e.g. `"28/04/2026"`).
   - In `src/components/WorkflowView.tsx:438`:
     ```typescript
     if (ocrData.documentDate) {
       setPoDate(ocrData.documentDate);
     }
     ```
   - In `src/components/WorkflowView.tsx:1685`: `<input type="date" value={poDate} ... />`.
   - Browser `<input type="date">` strictly rejects `"28/04/2026"` and renders blank/invalid. Subsequent code `poDate.split("-").reverse().join("/")` at lines 456, 593, 640 breaks.
3. **Missing return in `handleUploadToDrive` breaks Google Drive UI banner (`src/App.tsx:469-526`, `src/components/OCRView.tsx:495-507`)**:
   - In `src/components/OCRView.tsx:495-507`, the UI expects `onUploadToDrive` to return `{ driveLink, folderLink, folderPath }` to set `savedDriveInfo`.
   - In `src/App.tsx:469-526`, `handleUploadToDrive` executes upload but has NO return statement (returns `undefined`), causing the Drive link banner to never appear in `OCRView`.
4. **Collection Name Discrepancy between Drive sync and UI (`src/lib/driveSync.ts:188` vs `src/App.tsx:151, 507`)**:
   - `src/lib/driveSync.ts:188` writes file records to `doc(db, 'storage_files', record.id)`.
   - `src/App.tsx:151` and `src/components/StorageView.tsx` listen to and write to collection `'file_storage'`. Records saved by `registerAndUploadDriveDocument` are invisible in `StorageView`.
5. **No-op Single Quote Escape in Google Drive Folder Query (`src/lib/driveSync.ts:839`)**:
   - `const safeName = folderName.replace(/'/g, "\'");` in `driveSync.ts:839` fails to escape `'` because `"\'"` in JS string evaluates to `'`. Query `name = '...'` fails with `400 Bad Request` if folder name contains `'`.
6. **Missing Primary Customer "Thuốc lá Thăng Long" in Smart Naming (`src/lib/documentNaming.ts:63-70`)**:
   - `getShortCustomerName` explicitly checks Thanh Hóa, Bắc Sơn, Long An, Đà Nẵng, Sài Gòn, An Việt Phát, Tâm Sen, but omits Thăng Long, resulting in inconsistent fallback naming `ThuoclaThangLong...`.
7. **Missing "BG" / "Báo giá" in Document Naming Prefix (`src/lib/documentNaming.ts:108-119`)**:
   - `generateSmartDocumentFileName` maps BBGH, PO, HD, INVOICE. Any quotation/báo giá document falls through to default `PXK`, mislabeling quotation files as delivery notes.

---

## 2. LOGIC CHAIN

1. **From Observation 1**: When `processContractOCR` invokes `/api/ocr`, `api/ocr.ts` ignores the supplied contract prompt. Therefore, Gemini executes the PO/PXK prompt and extracts empty/garbled contract fields. Fixing `const prompt = body?.prompt || defaultPrompt;` directly restores Contract OCR functionality on serverless deployments.
2. **From Observation 2**: Setting `poDate` to a non-ISO date string violates HTML5 date input specifications. By wrapping the assignment with `parseDateToISO(ocrData.documentDate)`, `poDate` will always store `YYYY-MM-DD`, allowing the `<input type="date">` to populate properly and preventing downstream date formatting errors.
3. **From Observation 3**: Because `handleUploadToDrive` in `App.tsx` lacks a `return` statement, any `.then((res) => { ... })` handler in caller components receives `undefined`. Adding `return { ...driveData, fileId, fileName: fileNameToSave, folderPath, folderLink };` ensures caller components receive metadata and display the Drive scan link.
4. **From Observation 4**: Divergence between `'storage_files'` in `driveSync.ts` and `'file_storage'` in `App.tsx`/`StorageView.tsx` creates a split-brain storage state. Unifying all file metadata under `'file_storage'` guarantees full observability in `StorageView`.
5. **From Observation 5**: Google Drive search syntax requires escaping single quotes with a backslash `\'`. In JavaScript regex replacement, this requires `'\\\'` or `replace(/'/g, "\\'")`.
6. **From Observations 6 & 7**: Expanding `getShortCustomerName` and adding `'BG'` prefix to `generateSmartDocumentFileName` guarantees 100% compliance with the naming format `[LOẠI]_[SỐ_CT]_[NGÀY]_[KHÁCH_HÀNG]_[PO].ext`.

---

## 3. CAVEATS

- **Google Drive OAuth Token**: Client-side direct upload requires an active Google OAuth access token with `https://www.googleapis.com/auth/drive.file` scope. If the token expires, the system gracefully falls back to local and Firestore metadata storage.
- **Gemini API Limits**: Direct Google AI Studio REST calls rely on the user's configured API key. When missing or invalid, client falls back to serverless `/api/ocr` or local simulation.
- **Scope Restriction**: In accordance with the Explorer persona, no source code files were modified during this investigation.

---

## 4. CONCLUSION

The OCR, Smart Document Naming, and Google Drive 3-Tier Storage modules have a strong foundational architecture (Dual-Engine AI, Local-First 3-Tier Cache, Direct REST Multipart Drive Upload). However, 7 distinct integration bugs currently hinder end-to-end execution:
1. `api/ocr.ts:123` hardcoded prompt ignoring custom contract prompts.
2. `src/components/WorkflowView.tsx:438` unparsed date string breaking `<input type="date">`.
3. `src/App.tsx:522` missing return value in `handleUploadToDrive`.
4. `src/lib/driveSync.ts:188` Firestore collection name mismatch (`storage_files` vs `file_storage`).
5. `src/lib/driveSync.ts:839` faulty query string single-quote escaping.
6. `src/lib/documentNaming.ts:63` missing Thăng Long in customer abbreviation list.
7. `src/lib/documentNaming.ts:108` missing BG prefix for quotation documents.

All issues have concrete line-by-line fix strategies detailed in `analysis.md`.

---

## 5. VERIFICATION METHOD

1. **TypeScript Compilation Verification**:
   ```bash
   npx tsc --noEmit
   ```
2. **Production Build Verification**:
   ```bash
   npm run build
   ```
3. **Simulated Document Naming Test**:
   - Verify `generateSmartDocumentFileName({ documentType: 'BG', documentNumber: 'BG-01', buyerName: 'Công ty TNHH MTV Thuốc lá Thăng Long', documentDate: '2026-08-25' })` outputs `BG_BG-01_2026-08-25_ThuocLaThangLong.pdf`.
4. **Simulated OCR Date Test**:
   - Verify `parseDateToISO('28/04/2026')` returns `'2026-04-28'` and binds seamlessly to `<input type="date" />`.
5. **Simulated Drive Upload Return Test**:
   - Verify `handleUploadToDrive` resolves with `{ driveFileId, driveLink, folderPath, folderLink }`.
