# Dispatch Assignment — Worker 3: 5-Step E2E Workflow & Hubs Implementation Specialist

## 2026-08-25T01:09:17Z

**Role**: implementer, qa, specialist
**Working directory**: `/Users/Nguyentam/antigravity/TSG-Business---New/.agents/worker_3_workflow`
**Original Request**: `/Users/Nguyentam/antigravity/TSG-Business---New/.agents/ORIGINAL_REQUEST.md`
**Explorer 3 Report**: `/Users/Nguyentam/antigravity/TSG-Business---New/.agents/explorer_3_workflow/handoff.md`
**Project Spec**: `/Users/Nguyentam/antigravity/TSG-Business---New/PROJECT.md`

### Specific Scope & Assignments:
1. `src/App.tsx`:
   - In `handleUpdateToFirestore` (around line 436-442): remove `'Status'` from `transientFields` deletion list so that delivery records retain their `"Status"` column in Firestore.
   - In `handleUploadToDrive` (around line 469-526): ensure `handleUploadToDrive` returns `{ ...driveData, fileId, fileName: fileNameToSave, folderPath, folderLink }` so `OCRView.tsx` receives `savedDriveInfo` and can display the Google Drive confirmation banner.
   - In remaining quantity calculations (lines 283 & 335): handle remaining quantities appropriately (preserve signed difference or avoid artificial clamping that obscures over-fulfillment).
2. `src/components/WorkflowView.tsx`:
   - When receiving OCR data (around line 438): convert `ocrData.documentDate` to ISO format `YYYY-MM-DD` using `parseDateToISO(ocrData.documentDate)` when setting `poDate` state, so HTML5 `<input type="date">` displays correctly and doesn't break.
   - In `handleSavePO` (around line 623): add duplicate PO check against existing `combinedPoHeadersData` with confirmation/warning dialog before saving.
   - In delivery plan creation (around lines 969-982): synchronize both `'Số lượng cần giao'` and `'Số lượng kế hoạch'`, `'Ngày dự kiến'` and `'Ngày giao kế hoạch'` so all views can query both key conventions seamlessly.
3. `src/components/OCRView.tsx`:
   - In `executeSaveToSystem` (around line 472-515): add duplicate PO check against `poHeaders` before saving.
4. `src/components/ContactView.tsx`:
   - Ensure contact dossier project/task/activity state is reliably managed.
