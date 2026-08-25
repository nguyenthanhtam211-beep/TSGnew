## 2026-08-25T00:49:41Z

You are Explorer 2 (OCR & Google Drive Storage Specialist).
Working directory: /Users/Nguyentam/antigravity/TSG-Business---New/.agents/explorer_2_ocr_drive
Original Request: /Users/Nguyentam/antigravity/TSG-Business---New/.agents/ORIGINAL_REQUEST.md

Your mission:
1. Conduct a deep code-level exploration and audit of the Gemini AI OCR document extraction module:
   - Inspect OCR services, prompts, schemas, parsing logic for documents (PO, Hóa đơn VAT, Phiếu xuất kho, Báo giá, Biên bản giao hàng).
   - Check extraction quality for document number (Số chứng từ), document date (Ngày lập), customer name/tax code, line item tables (Mã hàng, tên hàng, ĐVT, số lượng, đơn giá, thành tiền, thuế VAT).
2. Audit smart document naming algorithm:
   - Inspect `src/lib/documentNaming.ts` (or equivalent file) for structure `[LOẠI]_[SỐ_CT]_[NGÀY]_[KHÁCH_HÀNG]_[PO].ext`.
   - Check Vietnamese diacritics stripping (loại bỏ dấu tiếng Việt chuẩn xác, chuyển thành ASCII không dấu), special character sanitation, length limits, and fallback when metadata is missing.
3. Audit Google Drive upload & sync workflows:
   - Check Google Drive API integration, folder hierarchy creation (`Năm / Tháng / [LOẠI_CHỨNG_TỪ]`), file upload, file ID/URL storage in `FileStorageData`.
   - Check 3-tier caching mechanism (RAM memory cache, LocalStorage / IndexedDB, Cloud Firestore storage) and cache invalidation / synchronization reliability.
4. Document all findings, buggy files, exact line numbers, and proposed fix strategies in:
   `/Users/Nguyentam/antigravity/TSG-Business---New/.agents/explorer_2_ocr_drive/analysis.md`
   and `/Users/Nguyentam/antigravity/TSG-Business---New/.agents/explorer_2_ocr_drive/handoff.md`.
5. Send a completion message to the parent orchestrator with a summary of findings. Do NOT modify source code files.
