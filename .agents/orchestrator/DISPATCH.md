## 2026-08-25T00:49:13Z
You are the Project Orchestrator for TSG Business OS Deep Business Architecture & Data Integrity Audit & Repair.

Your project root is: /Users/Nguyentam/antigravity/TSG-Business---New
Your working directory is: /Users/Nguyentam/antigravity/TSG-Business---New/.agents/orchestrator
Authoritative User Request is recorded in: /Users/Nguyentam/antigravity/TSG-Business---New/.agents/ORIGINAL_REQUEST.md

## Mission & Requirements
Execute a deep audit, code fixes, and verification across 4 core areas:

1. **R1. Rà soát & Chuẩn hóa Tính toán Tài chính & Liên kết 13 Bảng Dữ Liệu**:
   - Check and fix relationships across 13 data tables (`CustomerData`, `SupplierData`, `ContactData`, `ContractsData`, `PricingData`, `ProductData`, `SpecsData`, `POHeaderData`, `POLinesData`, `DeliveryPlanData`, `DeliveryData`, `CommissionData`, `FileStorageData`).
   - Standardize formulas across Dashboard, PO Lines, Delivery, Delivery Plan, Logistics Hub:
     * COGS / Giá vốn (Đơn giá mua x Số lượng)
     * Doanh thu (Đơn giá bán x Số lượng)
     * Lợi nhuận gộp (Doanh thu - COGS)
     * Tỷ suất lợi nhuận Margin % ((Lợi nhuận gộp / Doanh thu) * 100)
   - Handle null/undefined values, Vietnamese number formatting (dot/comma), missing pricing lookups, product code mismatches.

2. **R2. Đánh giá & Hoàn thiện Phân hệ OCR & Lưu Trữ Google Drive**:
   - Verify Gemini AI OCR document extraction (document number, date, customer, line item tables from scanned PDF/images).
   - Verify and fix smart document naming algorithm (`src/lib/documentNaming.ts` or related files) matching pattern `[LOẠI]_[SỐ_CT]_[NGÀY]_[KHÁCH_HÀNG]_[PO].ext` with proper Vietnamese diacritics stripping and sanitation.
   - Verify and fix Google Drive upload/sync workflows (hierarchical year/month/type folders) and multi-tier caching (RAM / Local / Cloud Firestore).

3. **R3. Rà soát Luồng Nghiệp Vụ 5 Bước (End-to-End Workflow)**:
   - Step 1: Customer / Supplier / Contact master data setup.
   - Step 2: Contracts & Pricing active lookup (Pricing 2026).
   - Step 3: PO Intake (PO_Header & PO_Lines), auto price population & duplicate detection.
   - Step 4: Delivery Dispatch Planning (Delivery Plan), split deliveries & % progress tracking.
   - Step 5: Warehouse Export Note (PXK / Delivery), actual shipment logs, discrepancy detection, and debt reconciliation.

4. **R4. Sửa lỗi Trực tiếp & Kiểm thử Toàn vẹn (Direct Implementation & Verification)**:
   - Directly edit source code to fix all identified issues, edge cases, and broken links.
   - Run TypeScript type checks (`npx tsc --noEmit`) and production build (`npm run build`) to ensure 100% build success without errors.
