# Original User Request

## 2026-08-25T00:48:59Z

Kiểm tra chuyên sâu kiến trúc nghiệp vụ và tính đúng đắn dữ liệu của TSG Business OS (liên kết 13 bảng dữ liệu, tính toán giá vốn/doanh thu/lợi nhuận, bóc tách OCR và đồng bộ Google Drive), đồng thời trực tiếp rà soát và khắc phục ngay các điểm bất hợp lý trong mã nguồn.

Working directory: /Users/Nguyentam/antigravity/TSG-Business---New
Integrity mode: development

## Requirements

### R1. Rà soát & Chuẩn hóa Tính toán Tài chính & Liên kết 13 Bảng Dữ Liệu
Kiểm tra toàn diện tính toàn vẹn dữ liệu và độ chính xác của các công thức tài chính trên toàn hệ thống:
- Luồng đối chiếu giữa 13 bảng dữ liệu: `CustomerData`, `SupplierData`, `ContactData`, `ContractsData`, `PricingData`, `ProductData`, `SpecsData`, `POHeaderData`, `POLinesData`, `DeliveryPlanData`, `DeliveryData`, `CommissionData`, `FileStorageData`.
- Tính đúng đắn của công thức: Giá vốn COGS (Đơn giá mua x Số lượng), Doanh thu (Đơn giá bán x Số lượng), Lợi nhuận gộp (Doanh thu - COGS), Tỷ suất lợi nhuận (Margin %) trên từng dòng PO, từng chuyến giao hàng PXK và tổng thể Dashboard.
- Xử lý các trường hợp dữ liệu rỗng (null/undefined), định dạng số tiếng Việt (dấu chấm/phẩy), và các mã sản phẩm chưa khớp trong bảng giá. Trực tiếp sửa mã nguồn nếu phát hiện công thức sai lệch.

### R2. Đánh giá & Hoàn thiện Phân hệ OCR & Lưu Trữ Google Drive
Rà soát luồng bóc tách chứng từ và lưu trữ tự động:
- Khả năng trích xuất chính xác Số chứng từ, Ngày lập, Khách hàng, Bảng chi tiết hàng hóa từ ảnh/PDF scan bằng Gemini AI OCR.
- Tính chính xác của thuật toán Đặt Tên File Thông Minh (`src/lib/documentNaming.ts`) theo cấu trúc chuẩn: `[LOẠI]_[SỐ_CT]_[NGÀY]_[KHÁCH_HÀNG]_[PO].ext`.
- Luồng đẩy file lên thư mục Google Drive theo năm/tháng/loại chứng từ và cơ chế lưu trữ bền vững vào bộ nhớ 3 tầng (RAM / Local / Cloud Firestore).

### R3. Rà soát Luồng Nghiệp Vụ 5 Bước (End-to-End Workflow)
Đảm bảo tính thông suốt từ đầu vào đến đầu ra:
- Bước 1: Khai báo Khách hàng / Nhà cung cấp / Danh bạ.
- Bước 2: Quản lý Hợp đồng & Bảng giá hiệu lực (Pricing 2026).
- Bước 3: Tiếp nhận Đơn hàng PO (PO_Header & PO_Lines), tự động điền đơn giá và cảnh báo trùng lặp.
- Bước 4: Lập Kế hoạch điều độ giao hàng (Delivery Plan), chia đợt giao và theo dõi tiến độ %.
- Bước 5: Tạo Phiếu xuất kho (PXK), ghi nhận chuyến hàng thực tế, phát hiện lệch số và đối soát công nợ.

### R4. Thực hiện Sửa lỗi Trực tiếp & Kiểm thử Toàn vẹn (Direct Implementation & Verification)
- Khi phát hiện bất kỳ lỗi logic, liên kết gãy hoặc bất cập trong quá trình kiểm tra, trực tiếp chỉnh sửa mã nguồn để tối ưu hóa.
- Chạy kiểm tra TypeScript (`npx tsc --noEmit`) và Build production (`npm run build`) để đảm bảo hệ thống hoạt động ổn định 100%.

## Acceptance Criteria

### Data & Financial Integrity
- [ ] 100% các công thức Doanh thu, Giá vốn, Lợi nhuận gộp và Tỷ suất % được chuẩn hóa nhất quán trên Dashboard, PO Lines, Delivery, Delivery Plan và Logistics Hub.
- [ ] Dữ liệu giữa PO Header và PO Lines liên kết chính xác theo mã đơn hàng; thông tin sản phẩm và khách hàng được truy xuất chuẩn xác không bị rỗng.

### OCR & Drive Workflow
- [ ] Module OCR trích xuất chính xác các trường dữ liệu và tự động sinh tên file chuẩn không bị lỗi ký tự đặc biệt hoặc dấu tiếng Việt.
- [ ] Chức năng lưu trữ file và đồng bộ Drive hoạt động thông suốt với thư mục phân cấp rõ ràng.

### Build & Stability
- [ ] Toàn bộ mã nguồn vượt qua kiểm tra biên dịch TypeScript (`npx tsc --noEmit`) không có lỗi.
- [ ] Bản build production (`npm run build`) thành công 100%.
