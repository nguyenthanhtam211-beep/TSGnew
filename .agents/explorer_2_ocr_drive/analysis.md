# BÁO CÁO PHÂN TÍCH CHUYÊN SÂU HỆ THỐNG OCR, ĐẶT TÊN CHỨNG TỪ & LƯU TRỮ GOOGLE DRIVE 3 TẦNG (TSG BUSINESS OS)

**Người thực hiện**: Explorer 2 (OCR & Google Drive Storage Specialist)  
**Thời gian hoàn thành**: 2026-08-25  
**Mục tiêu**: Rà soát và kiểm toán toàn diện mã nguồn phân hệ Trích xuất OCR bằng Gemini AI, thuật toán Đặt tên tệp thông minh (`documentNaming.ts`), quy trình Tải lên & Đồng bộ Google Drive 2 chiều, cùng cơ chế Lưu trữ bền vững 3 tầng (RAM / LocalStorage / Cloud Firestore).

---

## MỤC LỤC
1. [Tổng quan Đánh giá & Bảng xếp hạng Rủi ro](#1-tổng-quan-đánh-giá--bảng-xếp-hạng-rủi-ro)
2. [Kiểm toán Phân hệ OCR Gemini AI](#2-kiểm-toán-phân-hệ-ocr-gemini-ai)
3. [Kiểm toán Thuật toán Đặt Tên Chứng Từ Thông Minh](#3-kiểm-toán-thuật-toán-đặt-tên-chứng-từ-thông-minh)
4. [Kiểm toán Quy trình Đồng Bộ & Lưu Trữ Google Drive](#4-kiểm-toán-quy-trình-đồng-bộ--lưu-trữ-google-drive)
5. [Kiểm toán Cơ chế Lưu Trữ Bền Vững 3 Tầng](#5-kiểm-toán-cơ-chế-lưu-trữ-bền-vững-3-tầng)
6. [Tổng hợp Lỗi Mã Nguồn & Chiến Lược Khắc Phục](#6-tổng-hợp-lỗi-mã-nguồn--chiến-lược-khắc-phục)

---

## 1. TỔNG QUAN ĐÁNH GIÁ & BẢNG XẾP HẠNG RỦI RO

| Mã Lỗi | Hạng Mục | Tệp & Dòng Mã Nguồn | Mức Độ | Tác Động Nghiệp Vụ |
| :--- | :--- | :--- | :---: | :--- |
| **BUG-OCR-01** | OCR Serverless Endpoint | `api/ocr.ts:123` | **CRITICAL** | Endpoint `/api/ocr` ghi cứng (hardcode) prompt PO/PXK và bỏ qua hoàn toàn `body.prompt` truyền từ `processContractOCR`, khiến OCR Hợp đồng & Phụ lục bị trích xuất sai cấu trúc khi chạy qua máy chủ. |
| **BUG-OCR-02** | Xử lý Ngày tháng OCR | `src/components/WorkflowView.tsx:438, 1685` | **HIGH** | OCR trả về định dạng `DD/MM/YYYY`, khi gán trực tiếp vào State `poDate` đã làm hỏng thẻ `<input type="date">` (yêu cầu bắt buộc `YYYY-MM-DD`), gây lỗi hiển thị trắng/lỗi form và sai lệch chuỗi ngày tháng. |
| **BUG-OCR-03** | Schema Thuế VAT & Báo giá | `src/lib/gemini.ts:281-305`, `api/ocr.ts:138-162` | **MEDIUM** | Prompt & JSON Schema thiếu các trường Pháp lý & Thuế GTGT (`taxCode`, `vatRate`, `vatAmount`, `totalAmountWithVat`). Thiếu loại chứng từ Báo giá (`BG`/`Quotation`) trong enum phân loại. |
| **BUG-DRV-01** | Trả về Kết quả Drive | `src/App.tsx:469-526`, `src/components/OCRView.tsx:495` | **HIGH** | Hàm `handleUploadToDrive` trong `App.tsx` không có lệnh `return driveData`, khiến `OCRView.tsx` nhận về `undefined` và không bao giờ hiển thị Banner liên kết Google Drive cho người dùng. |
| **BUG-DRV-02** | Xung đột Tên Bảng Firestore | `src/lib/driveSync.ts:188` vs `src/App.tsx:151, 507` | **HIGH** | `driveSync.ts` ghi vào collection `storage_files`, trong khi `App.tsx` và `StorageView.tsx` lại đọc/ghi vào `file_storage`, làm phân mảnh và mất dấu bản ghi chứng từ trên giao diện. |
| **BUG-DRV-03** | Lỗi Escape Ký tự Google Drive API | `src/lib/driveSync.ts:839` | **MEDIUM** | Chuỗi thay thế `replace(/'/g, "\'")` là no-op trong JavaScript, khiến các thư mục chứa dấu nháy đơn `'` (ví dụ tên sản phẩm `10's`) gây lỗi `HTTP 400 Invalid Query` trên Google Drive API. |
| **BUG-NAM-01** | Bỏ sót KH Thăng Long | `src/lib/documentNaming.ts:63-70` | **HIGH** | Hàm `getShortCustomerName` thiếu khách hàng lớn nhất **Thuốc lá Thăng Long**, khiến tên file của Thăng Long bị phân rã theo regex fallback không đồng bộ (`ThuoclaThangLong...`). |
| **BUG-NAM-02** | Thiếu Giới hạn Độ dài & Tiền tố Báo giá | `src/lib/documentNaming.ts:108-119` | **MEDIUM** | Thiếu tiền tố `BG` cho Báo giá (bị mặc định về `PXK`). Không có cơ chế cắt ngắn (length limit) tránh vượt quá 255 ký tự hệ thống tệp và thiếu hash chống trùng tên khi thiếu metadata. |
| **BUG-CAC-01** | Tràn Bộ Nhớ LocalStorage Quota | `src/lib/dbEngine.ts:292, 345` | **MEDIUM** | Ghi đè toàn bộ mảng JSON vào LocalStorage mà không loại trừ dữ liệu base64/tệp đính kèm lớn có nguy cơ gây lỗi `QuotaExceededError` (5MB), làm ngưng trệ cơ chế lưu trữ cục bộ. |

---

## 2. KIỂM TOÁN PHÂN HỆ OCR GEMINI AI

### 2.1. Cấu Trúc Dual-Engine (Google AI Studio REST & Serverless `/api/ocr`)
Phân hệ OCR được thiết kế với cơ chế dự phòng 2 tầng (Dual-Engine):
- **Tầng 1 (Client-Direct REST API)**: Gọi trực tiếp endpoint Google AI Studio:
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`
  với cơ chế tự động thử lại mô hình `gemini-2.0-flash`.
- **Tầng 2 (Serverless `/api/ocr`)**: Gọi thông qua API proxy nội bộ của Next.js/Vercel.

### 2.2. Điểm Lỗi Nghiêm Trọng trong Trích Xuất Chứng Từ
#### 🔴 LỖI 1: Bỏ qua `body.prompt` tại `api/ocr.ts`
- **Vị trí**: `api/ocr.ts:123-163`
- **Chi tiết**: Trong hàm `processContractOCR` (`src/lib/gemini.ts:525`), client gửi payload chứa `prompt` chuyên biệt cho Hợp đồng và Phụ lục giá. Tuy nhiên, tại `api/ocr.ts`, biến `prompt` được khai báo cố định bằng chuỗi trích xuất PO/PXK mà không kiểm tra `body?.prompt`.
- **Hậu quả**: Khi người dùng quét Hợp đồng và hệ thống sử dụng serverless proxy, AI sẽ nhận nhầm prompt bóc tách PXK, làm mất toàn bộ thông tin pháp lý hợp đồng, tóm tắt điều khoản rủi ro (`aiExecutiveSummary`) và bảng danh mục giá cam kết.
- **Đoạn mã hiện tại**:
  ```typescript
  // api/ocr.ts line 123:
  const prompt = `Bạn là một chuyên gia OCR tài liệu doanh nghiệp hàng đầu của Tập đoàn Tâm Sen (TSG)...`;
  // Hoàn toàn không lấy body.prompt!
  ```
- **Giải pháp đề xuất**:
  ```typescript
  const prompt = body?.prompt || `Bạn là một chuyên gia OCR tài liệu doanh nghiệp hàng đầu...`;
  ```

#### 🔴 LỖI 2: Xung đột Định dạng Ngày Tháng (`DD/MM/YYYY` vs `YYYY-MM-DD`)
- **Vị trí**: `src/components/WorkflowView.tsx:438`
- **Chi tiết**: Gemini Prompt yêu cầu OCR trả về ngày định dạng `DD/MM/YYYY`. Tại dòng 438 của `WorkflowView.tsx`, code thực hiện:
  ```typescript
  if (ocrData.documentDate) {
    setPoDate(ocrData.documentDate);
  }
  ```
  Trong khi đó, trường input ở dòng 1685 lại là:
  ```typescript
  <input
    type="date"
    value={poDate}
    onChange={(e) => setPoDate(e.target.value)}
    className="..."
  />
  ```
  Chuẩn HTML5 của `<input type="date">` bắt buộc giá trị `value` phải là định dạng ISO `YYYY-MM-DD`. Khi gán chuỗi `DD/MM/YYYY`, trình duyệt không parse được giá trị, khiến ô chọn ngày bị trắng và các hàm sau đó như `poDate.split("-").reverse().join("/")` (dòng 456, 593, 640) bị lỗi logic.
- **Giải pháp đề xuất**:
  ```typescript
  if (ocrData.documentDate) {
    setPoDate(parseDateToISO(ocrData.documentDate) || new Date().toISOString().split("T")[0]);
  }
  ```

#### 🟡 LỖI 3: Thiếu Thuế VAT, Mã Số Thuế & Loại Báo Giá
- **Vị trí**: `src/lib/gemini.ts:281-305` & `api/ocr.ts:138-162`
- **Chi tiết**: Trong hóa đơn GTGT điện tử và báo giá của ngành thuốc lá/bao bì, các thông tin sau là cốt lõi nhưng đang thiếu trong Prompt:
  1. `buyerTaxCode` & `sellerTaxCode`: Mã số thuế 2 bên để đối chiếu dữ liệu khách hàng/nhà cung cấp.
  2. `vatRate` (% thuế GTGT: 0%, 5%, 8%, 10%), `vatAmount` (Tiền thuế), `totalAmountWithVat` (Tổng thanh toán).
  3. Phân loại chứng từ `documentType` chỉ gồm `"PO" | "PXK" | "Invoice" | "Unknown"`, thiếu `"Quotation"` (Báo giá) và `"Contract"` (Hợp đồng).

---

## 3. KIỂM TOÁN THUẬT TOÁN ĐẶT TÊN CHỨNG TỪ THÔNG MINH

### 3.1. Phân Tích `src/lib/documentNaming.ts`
Quy tắc đặt tên chuẩn theo thiết kế:
`[LOẠI]_[SỐ_CT]_[NGÀY]_[KHÁCH_HÀNG]_[PO].ext`

### 3.2. Điểm Bất Cập Cụ Thể
#### 🔴 LỖI 1: Bỏ sót Khách Hàng Thăng Long trong `getShortCustomerName`
- **Vị trí**: `src/lib/documentNaming.ts:63-70`
- **Chi tiết**:
  ```typescript
  if (lower.includes('thanh hóa') || lower.includes('thanh hoa')) return 'ThuocLaThanhHoa';
  if (lower.includes('bắc sơn') || lower.includes('bac son')) return 'ThuocLaBacSon';
  if (lower.includes('long an')) return 'ThuocLaLongAn';
  if (lower.includes('đà nẵng') || lower.includes('da nang')) return 'ThuocLaDaNang';
  if (lower.includes('sài gòn') || lower.includes('sai gon')) return 'ThuocLaSaiGon';
  if (lower.includes('an việt phát') || lower.includes('an viet phat') || lower.includes('avp')) return 'AnVietPhat';
  if (lower.includes('tâm sen') || lower.includes('tam sen')) return 'TamSen';
  ```
  Khách hàng chiếm hơn 50% đơn hàng là **Công ty TNHH MTV Thuốc lá Thăng Long** hoàn toàn không có trong danh sách điều kiện if! Khi xử lý tên "Công ty TNHH MTV Thuốc lá Thăng Long", hàm bị rơi xuống fallback và sinh ra `ThuoclaThangLong` (chữ l viết thường) hoặc `ThuoclaThangLong-KCNThachThat` nếu chuỗi có kèm địa chỉ nhà máy.
- **Giải pháp**: Bổ sung:
  ```typescript
  if (lower.includes('thăng long') || lower.includes('thang long')) return 'ThuocLaThangLong';
  if (lower.includes('ngân sơn') || lower.includes('ngan son')) return 'ThuocLaNganSon';
  ```

#### 🟡 LỖI 2: Phân Loại Tiền Tố Chứng Từ Thiếu Báo Giá
- **Vị trí**: `src/lib/documentNaming.ts:108-119`
- **Chi tiết**: Nếu chứng từ là "Báo giá", `generateSmartDocumentFileName` không nhận diện được tiền tố nên mặc định gán `prefix = 'PXK'`. Cần bổ sung:
  ```typescript
  else if (typeUpper.includes('BG') || typeUpper.includes('BÁO GIÁ') || typeUpper.includes('QUOTATION')) {
    prefix = 'BG';
  }
  ```

#### 🟡 LỖI 3: Giới Hạn Độ Dài & Nguy Cơ Trùng Tên Khi Thiếu Metadata
- **Vị trí**: `src/lib/documentNaming.ts:10-21, 129-148`
- **Chi tiết**:
  - Không có giới hạn độ dài từng phần tử hoặc toàn bộ tên file. Nếu OCR đọc nhầm một đoạn văn bản dài vào `documentNumber`, tên file có thể vượt quá 255 ký tự.
  - Khi không có `documentNumber` và `buyerName`, tên file chỉ còn `PXK_2026-08-25.pdf`. Nếu upload nhiều file trong ngày sẽ gây ghi đè/trùng lặp.
- **Giải pháp**: Cắt giới hạn tối đa 60 ký tự cho mỗi trường và bổ sung timestamp/hash ngắn khi thiếu số chứng từ.

---

## 4. KIỂM TOÁN QUY TRÌNH ĐỒNG BỘ & LƯU TRỮ GOOGLE DRIVE

### 4.1. Luồng Tải Lên Trực Tiếp (Client-Side Direct Upload)
Trong `src/lib/driveSync.ts`, hàm `uploadFileDirectToGoogleDrive` thực hiện tải tệp lên Google Drive qua phương thức REST `multipart/related`.
Cây thư mục phân cấp được tạo theo logic:
`TSG_Business_Documents` -> `[Năm]` -> `[Loại_Chứng_Từ]` -> `Thang_[Tháng]`

### 4.2. Điểm Gãy Kết Nối & Lỗi Logic
#### 🔴 LỖI 1: Hàm `handleUploadToDrive` trong `App.tsx` không return kết quả
- **Vị trí**: `src/App.tsx:469-526`
- **Chi tiết**: `OCRView.tsx` (dòng 495-511) gọi `onUploadToDrive` và chờ `res` để hiển thị `savedDriveInfo` (đường dẫn Drive, thư mục Drive, tên file). Tuy nhiên, `handleUploadToDrive` trong `App.tsx` không trả về bất kỳ giá trị nào (`return undefined`).
- **Hậu quả**: Dù file đã tải lên Drive thành công, giao diện OCR không bao giờ hiển thị nút bấm "Xem Bản Scan Trên Drive" và "Mở Thư Mục TSG_Business_Documents".
- **Giải pháp**: Thêm lệnh `return` ở cuối `handleUploadToDrive`:
  ```typescript
  return {
    ...driveData,
    fileId,
    fileName: fileNameToSave,
    folderPath: `TSG_Business_Documents / ${year} / ${metadata.documentType} / Thang_${month}`,
    folderLink: (driveData as any).folderLink
  };
  ```

#### 🔴 LỖI 2: Bất Nhất Tên Bảng Lưu Trữ Firestore (`storage_files` vs `file_storage`)
- **Vị trí**:
  - `src/lib/driveSync.ts:188`: `doc(db, 'storage_files', record.id)` -> Ghi vào `storage_files`
  - `src/App.tsx:151`: `useFirestoreCollection('file_storage', [])` -> Đọc từ `file_storage`
  - `src/App.tsx:507`: `handleAddToFirestore('file_storage', ...)` -> Ghi vào `file_storage`
- **Hậu quả**: Khi các hàm trong `driveSync.ts` hoặc `ContractsView.tsx` ghi nhận tài liệu qua `registerAndUploadDriveDocument`, dữ liệu bị đẩy vào collection `storage_files`, hoàn toàn không hiển thị trên `StorageView.tsx` (vốn đang lắng nghe `file_storage`).
- **Giải pháp**: Chuẩn hóa thống nhất 1 tên collection duy nhất: `file_storage`.

#### 🟡 LỖI 3: Lỗi Regex Escape Query Google Drive API
- **Vị trí**: `src/lib/driveSync.ts:839`
- **Chi tiết**:
  ```typescript
  const safeName = folderName.replace(/'/g, "\'");
  ```
  Ký tự `"\'"` trong chuỗi JavaScript đơn giản là `'`. Do đó không có bất kỳ ký tự `\` nào được thêm vào chuỗi. Khi tên thư mục có dấu nháy đơn (ví dụ tên quy cách bao bì), câu truy vấn `name = '...'` gửi lên Drive API sẽ bị lỗi cú pháp `400 Bad Request`.
- **Giải pháp**:
  ```typescript
  const safeName = folderName.replace(/'/g, "\\'");
  ```

---

## 5. KIỂM TOÁN CƠ CHẾ LƯU TRỮ BỀN VỮNG 3 TẦNG

### 5.1. Mô Hình 3 Tầng Dữ Liệu
1. **Tầng 1 - RAM Memory Cache**: Lớp `Map<string, Map<string, any>>` trong `TSGDataEngine` (`src/lib/dbEngine.ts`), phản hồi 0ms.
2. **Tầng 2 - Local Persistence**: `localStorage` lưu trữ `tsg_cache_${collection}` kết hợp `tsg_user_mod_${collection}` để bảo vệ các thay đổi người dùng không bị mất khi offline hoặc khi dữ liệu đám mây chưa tải xong. Đồng bộ đa tab qua Event `storage`.
3. **Tầng 3 - Cloud Firestore**: Đồng bộ 2 chiều ngầm với cơ chế timeout 3.5 giây và snapshot listener qua `useFirestoreCollection`.

### 5.2. Đánh Giá Độ Tin Cậy & Rủi Ro
- **Ưu điểm**: Kiến trúc Local-First rất mạnh mẽ, giao diện không bao giờ bị đơ (freeze) khi mất mạng hoặc Firebase phản hồi chậm.
- **Rủi ro Cần Khắc Phục**:
  1. **Khóa Chính `getItemKey` cho `po_lines`**: Trong `src/hooks/useFirestoreCollection.ts:22`, khóa của `po_lines` là `${parent}_${stt}` (ví dụ `26_KHVT_0082_D_001`). Khi `dbEngine.getById('po_lines', 'D_001')` được gọi, sẽ không tìm thấy nếu không tra cứu theo đúng composite key.
  2. **Dung lượng LocalStorage**: Trình duyệt giới hạn LocalStorage ở mức 5MB. Cần đảm bảo các trường lưu nội dung file hoặc chuỗi Base64 dài không được lưu vào `tsg_cache_file_storage`.

---

## 6. TỔNG HỢP LỖI MÃ NGUỒN & CHIẾN LƯỢC KHẮC PHỤC

### Bảng Kế Hoạch Sửa Lỗi Chi Tiết Cho Implementer

```markdown
1. api/ocr.ts
   - Sửa dòng 123: `const prompt = body?.prompt || defaultPrompt;`
   - Bổ sung các trường `taxCode`, `vatRate`, `vatAmount`, `totalAmountWithVat` vào default schema.

2. src/lib/gemini.ts
   - Cập nhật prompt trích xuất PO/PXK bổ sung hướng dẫn nhận diện Mã số thuế và Thuế suất GTGT.
   - Thêm enum phân loại `"BG" | "Báo giá" | "Quotation"`.

3. src/lib/documentNaming.ts
   - Thêm `thăng long` / `thang long` -> `ThuocLaThangLong` và `ngân sơn` -> `ThuocLaNganSon` trong `getShortCustomerName`.
   - Bổ sung tiền tố `BG` cho Báo giá trong `generateSmartDocumentFileName`.
   - Giới hạn độ dài chuỗi tối đa và bổ sung hậu tố ngẫu nhiên an toàn nếu thiếu Số chứng từ.

4. src/lib/driveSync.ts
   - Sửa escape query Drive API: `folderName.replace(/'/g, "\\'")`.
   - Đổi collection `storage_files` thành `file_storage` tại dòng 188.
   - Đồng nhất quy chuẩn đường dẫn thư mục `TSG_Business_Documents / Năm / Loại_CT / Tháng`.

5. src/App.tsx
   - Bổ sung lệnh `return` trả về `driveData` trong hàm `handleUploadToDrive` (dòng 522).

6. src/components/WorkflowView.tsx
   - Sửa dòng 438: bọc `parseDateToISO(ocrData.documentDate)` trước khi set vào `poDate` để tương thích thẻ `<input type="date">`.
```

---
*Báo cáo được hoàn thành bởi Explorer 2.*
