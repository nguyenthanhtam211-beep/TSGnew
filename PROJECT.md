# Project: TSG Business OS Deep Business Architecture & Data Integrity Audit & Repair

## Architecture
TSG Business OS is a unified ERP/Operating System for TSG Group built with React 19, TypeScript, Tailwind CSS, Lucide icons, Vite, and Cloud Firestore with a 3-tier offline/online storage cache.
- **Master Data Layer**: 13 interconnected entities (`CustomerData`, `SupplierData`, `ContactData`, `ContractsData`, `PricingData`, `ProductData`, `SpecsData`, `POHeaderData`, `POLinesData`, `DeliveryPlanData`, `DeliveryData`, `CommissionData`, `FileStorageData`).
- **Financial Calculation Engine**: `src/lib/business-logic.ts` — standardized financial formulas (COGS, Revenue, Gross Profit, Margin %, Tax, Multi-tier Pricing AVP/TSG, Vietnamese currency formatting).
- **Intelligent Document OCR**: `src/lib/gemini.ts` & `api/ocr.ts` — Gemini 2.5/Flash AI document parsing, JSON extraction, table recognition.
- **Smart Document Naming & Storage**: `src/lib/documentNaming.ts` & `src/lib/driveSync.ts` — diacritics stripping, standard naming pattern `[LOẠI]_[SỐ_CT]_[NGÀY]_[KHÁCH_HÀNG]_[PO].ext`, hierarchical Google Drive storage, 3-tier sync (RAM / Local / Firestore).
- **5-Step Core Business Workflow**: `src/components/WorkflowView.tsx`, `DeliveryPlanView.tsx`, `DeliveryView.tsx`, `MasterCalendarView.tsx`, `LogisticsHubView.tsx`.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Standardize `parseNumber` | Vietnamese dot/comma format parser exported and used consistently | M1 | survey |
| 2 | Direct Pricing SKU Matching | `findPriceRecord` match `Mã giá bán` / `Mã giá` (`Gsp_XXX`) & `Giao đến` | M1 | survey |
| 3 | COGS AVP & Supplier Price Lookup | `getBuyPriceFromRecord` fallback to `Giá AVP`, `Giá vốn`, `Giá mua` | M1 | survey |
| 4 | Safe PODetailModal calculations | Replace unsafe `isNaN(qty || price)` with robust `parseNumber` | M1 | survey |
| 5 | Clean PO Dataset Keys | Trim leading/trailing whitespace in PO numbers (` 26/KHVT/0547`) | M1 | survey |
| 6 | Delivery Transient Fields Fix | Prevent stripping `"Status"` column during Firestore document update in `App.tsx` | M1 | survey |
| 7 | Serverless Custom OCR Prompt | Support `body?.prompt` in `api/ocr.ts` for contract & custom OCR | M2 | survey |
| 8 | HTML5 Date Input Normalization | Convert OCR `DD/MM/YYYY` to `YYYY-MM-DD` for `<input type="date">` in `WorkflowView.tsx` | M2 | survey |
| 9 | Drive Upload Metadata Return | Ensure `handleUploadToDrive` returns uploaded file metadata & links to `OCRView.tsx` | M2 | survey |
| 10 | Firestore Collection Unification | Align `driveSync.ts` with `App.tsx`/`StorageView.tsx` on `'file_storage'` collection | M2 | survey |
| 11 | Drive Query Quote Escaping | Fix single quote escaping in `driveSync.ts` folder search queries | M2 | survey |
| 12 | Smart Naming Rules & Prefixes | Add "Thuốc lá Thăng Long" customer code and `'BG'` quotation prefix in `documentNaming.ts` | M2 | survey |
| 13 | Duplicate PO Intake Protection | Add duplicate PO check with confirmation prompt in `WorkflowView` and `OCRView` | M3 | survey |
| 14 | Delivery Plan Key Synchronization | Align `Số lượng cần giao`/`Số lượng kế hoạch` & `Ngày dự kiến`/`Ngày giao kế hoạch` | M3 | survey |
| 15 | Signed Delivery Variance | Support true variance tracking for over-delivery quantities | M3 | survey |
| 16 | TypeScript & Production Build Verification | Verify `npx tsc --noEmit` and `npm run build` with 0 errors | M4 | survey |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | M1: Financial Calculations & Master Data Tables | Fix `business-logic.ts`, `data.ts`, `App.tsx`, `DeliveryPlanView.tsx`, `DeliveryView.tsx`, `MasterCalendarView.tsx`, `PODetailModal.tsx` | none | DONE |
| 2 | M2: OCR & Google Drive Storage Module | Fix `api/ocr.ts`, `gemini.ts`, `documentNaming.ts`, `driveSync.ts`, `WorkflowView.tsx`, `App.tsx` | none | DONE |
| 3 | M3: 5-Step E2E Workflow & Hubs | Fix duplicate PO protection, delivery plan key harmonization, delivery status, and UI workflow stability | M1, M2 | DONE |
| 4 | M4: Final Review, Build & Integrity Verification | Comprehensive testing, Reviewer audit, TypeScript type check, and production build | M1, M2, M3 | DONE |

## Interface Contracts
### `src/lib/business-logic.ts` ↔ UI Components
- `parseNumber(val: any): number`: Parses Vietnamese formatted strings (`"718.062.120,00"`, `"1.800"`, `"35.63%"`, numbers, null, undefined) into standard JS numbers.
- `findPriceRecord(pricingData: any[], sku: string, location?: string, searchTerms?: string): any`: Searches `PRICING_DATA` checking `Mã sản phẩm`, `Mã hàng`, `Mã giá bán`, `Mã giá`, destination `Giao đến`, `Địa điểm giao hàng`.
- `getBuyPriceFromRecord(record: any): number`: Returns highest priority cost price (`Đơn giá mua`, `Giá nhập`, `Đơn giá mua mới`, `Giá AVP`, `Giá vốn`, `Giá mua`).
- `getSellPriceFromRecord(record: any): number`: Returns highest priority selling price (`Đơn giá bán mới`, `Đơn giá bán`, `Giá bán`).

### `src/lib/documentNaming.ts` ↔ OCR & Storage
- `generateSmartDocumentFileName(doc: DocumentNamingInfo): string`: Returns `[LOẠI]_[SỐ_CT]_[NGÀY]_[KHÁCH_HÀNG]_[PO].ext` with clean ASCII without diacritics.
- Document types supported: `PO`, `PXK`, `HD` (Hóa đơn), `BG` (Báo giá), `BBGH` (Biên bản giao hàng), `PL` (Phụ lục), `HD_NT` (Hợp đồng nguyên tắc).

## Code Layout
- `src/lib/business-logic.ts`: Financial calculation engine & data transformation.
- `src/lib/gemini.ts`: AI OCR service & prompt schemas.
- `src/lib/documentNaming.ts`: Smart file naming algorithms.
- `src/lib/driveSync.ts`: Google Drive REST API & 3-tier storage synchronization.
- `src/data.ts`: Initial dataset fallback schemas for 13 tables.
- `src/App.tsx`: Global application state, routing, and Firestore update handlers.
- `src/components/`: Core view components (`WorkflowView.tsx`, `OCRView.tsx`, `DeliveryPlanView.tsx`, `DeliveryView.tsx`, `MasterCalendarView.tsx`, `StorageView.tsx`, `PODetailModal.tsx`, etc.).
