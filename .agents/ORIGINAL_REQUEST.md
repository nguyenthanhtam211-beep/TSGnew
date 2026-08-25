# Original User Request

## Initial Request — 2026-08-25T08:32:41+07:00

<USER_REQUEST>
Tái cấu trúc và nâng tầm toàn diện thiết kế giao diện (UI/UX) của hệ thống TSG Business OS theo phong cách Enterprise Cockpit Hiện Đại — kết hợp tinh hoa triết lý chống rập khuôn (Anti-Slop) từ taste-skill và độ chính xác vi mô (Micro-interaction & Spatial Precision) từ impeccable.

Working directory: /Users/Nguyentam/antigravity/TSG-Business---New
Integrity mode: development

Design Framework References:
- Taste-Skill: .design_skills/taste-skill/skills/taste-skill/SKILL.md (Bento grids, anti-slop, density dials)
- Impeccable: .design_skills/impeccable/DESIGN.md (OKLCH contrast, spatial rhythm, tactile micro-interactions)

## Requirements

### R1. Kiến tạo Hệ Thống Design Tokens & Quy Chuẩn Enterprise Cockpit
Thiết lập bộ design tokens chuẩn xác trong src/index.css và cấu hình Tailwind:
- Bảng màu & Tương phản: Bảng màu trung tính tinh tế (Neutral ramp chuẩn OKLCH/Slate), độ tương phản cao cho số liệu tài chính (#007AFF Apple Blue, #10B981 Emerald, #F59E0B Amber, #6366F1 Indigo) trên nền sáng ấm thanh thoát (#F8F9FA / #FFFFFF).
- Typography & Tabular Data: Đồng bộ phông chữ thương hiệu Roboto Condensed cho tiêu đề và Roboto / Inter tabular-nums cho số liệu kế toán.
- Micro-Interactions & Spring Physics: Hiệu ứng hover nhấc nổi nhẹ (translate-y-[-1px], bóng đổ tinh tế shadow-xs), hiệu ứng tap co nhẹ (scale-[0.98]), nút bấm có cảm giác xúc giác (tactile feedback).
- Loại bỏ viền thừa & Rác thị giác: Chuyển đổi các đường viền dày thành phân tách không gian bằng nền tinh tế (border-slate-200/60, bg-slate-50/50).

### R2. Nâng Cấp Khung Điều Hướng, Header & Mobile Navigation Dock
- Thanh bên Desktop (Sidebar): Bố cục thanh thoát, phân nhóm menu khoa học, hiệu ứng active pill sắc sảo, chỉ báo trạng thái kết nối và dung lượng dữ liệu gọn gàng.
- Thanh tiêu đề trên (Header): Hiển thị phân hệ hiện tại kèm breadcrumb, nút truy cập nhanh Trợ lý AI, Bộ nhớ đám mây và Trợ giúp với hiệu ứng kính mờ (Glassmorphism tinh xảo).
- Thanh điều hướng di động (Mobile Bottom Dock): Tối ưu 100% cho thao tác 1 ngón tay cái (Thumb Zone), hỗ trợ an toàn khi xoay ngang (landscape safe-area-insets), phản hồi tức thì không delay.

### R3. Thiết Kế Lại Dashboard & Logistics Hub 360° theo Bố Cục Bento Grid
- Bento KPI Cards: Bố trí thẻ thông tin bất đối xứng (Asymmetrical Bento Grid), làm nổi bật các chỉ số cốt lõi: Doanh thu, Lợi nhuận gộp, Số lượng giao hàng và Tiến độ đơn PO.
- Biểu đồ & Phân tích trực quan: Tinh chỉnh Recharts với dải màu hiện đại, tooltip tương tác mượt mà, định dạng tiền tệ ₫ và tỷ lệ phần trăm chuẩn xác.
- Thanh tiến độ & Trạng thái: Các thanh tiến độ giao hàng (Delivery Progress Bar) dạng thanh viên thuốc bo tròn mềm mại, chuyển màu theo % hoàn thành.

### R4. Tối Ưu Hóa Bảng Dữ Liệu Lớn & Thẻ Di Động Chuẩn Apple
- Chế độ Desktop (Data Grid): Lưới dữ liệu mật độ cao, tiêu đề dính (Sticky Header) với bóng đổ mờ, phân cách dòng xen kẽ nhẹ, thao tác kéo thả và lọc cột liền mạch.
- Chế độ Mobile (Apple Inset-Grouped Cards): Thẻ thông tin định danh sản phẩm với đầy đủ Tên SP, SKU, Khách hàng, Lưới tài chính 4 ô và Bottom Sheet trượt mượt từ đáy màn hình.
- Hộp thoại (Modals & Drawers): Thiết kế lại toàn bộ hộp thoại thêm/sửa đơn hàng, xem chi tiết PO, xem bảng giá theo phong cách hiện đại, thanh thoát, không gây rối mắt.

### R5. Kiểm Thử & Xác Thực Toàn Vẹn Hệ Thống
- Đảm bảo 100% các phân hệ (Dashboard, PO, Delivery, Delivery Plan, Pricing, OCR, Customer, Supplier, Storage, Contacts) hiển thị đồng nhất.
- Chạy kiểm tra TypeScript (npx tsc --noEmit) và Build production (npm run build) đảm bảo 0 lỗi.

## Acceptance Criteria

### Aesthetic & UX Polish
- [ ] Giao diện toàn hệ thống thể hiện rõ nét phong cách Enterprise Cockpit: hiện đại, thanh thoát, mật độ thông tin cao nhưng không rối mắt.
- [ ] Mọi nút bấm, thẻ và bảng biểu có micro-interaction mượt mà (hover, focus, active tactile state).
- [ ] Bố cục Dashboard và Logistics Hub 360° được nâng cấp lên dạng Bento Grid bất đối xứng cao cấp.

### Responsive & Ergonomics
- [ ] Trải nghiệm trên điện thoại (cả dọc và xoay ngang) đạt chuẩn Apple HIG: thao tác 1 tay thuận tiện, bottom sheet trượt đáy, không vỡ layout.
- [ ] Trải nghiệm trên máy tính đạt độ sắc nét cao, hiển thị tối ưu không gian làm việc.

### Build & Stability
- [ ] Toàn bộ mã nguồn vượt qua kiểm tra biên dịch TypeScript (npx tsc --noEmit) với 0 lỗi.
- [ ] Bản build production (npm run build) thành công 100%.
</USER_REQUEST>
