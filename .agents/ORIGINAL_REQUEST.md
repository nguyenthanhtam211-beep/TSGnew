# Original User Request

## 2026-08-26T19:11:09Z

# Teamwork Project Prompt — Executed

Audit and lock 100% accounting accuracy for Revenue, COGS, Gross Profit, and Dashboard Reports across North, South, and Company-wide scopes with zero discrepancy and zero cache duplication.

Working directory: /Users/Nguyentam/antigravity/TSG-Business---New
Integrity mode: development

## Requirements

### R1. Đối Soát & Khóa Cứng Dữ Liệu Doanh Thu & Giá Vốn (Single Source of Truth)
- Khóa cứng doanh thu thực tế theo đúng sổ hóa đơn kế toán:
  - **Miền Bắc (3 khách hàng: Thăng Long, Thanh Hóa, Bắc Sơn)**: Chính xác từng đồng **5.419.475.060 ₫** (52 chứng từ giao hàng).
  - **Miền Nam (Bến Tre, Sài Gòn, Quốc Đại)**: Chính xác **45.556.624.491 ₫** (1.056 chứng từ).
  - **Toàn công ty**: **50.976.099.551 ₫** (1.108 chứng từ).
- Khóa chuẩn Giá vốn hàng bán (COGS) và Lợi nhuận gộp thực tế:
  - Miền Bắc: Giá vốn **3.957.078.067 ₫** → Lợi nhuận gộp thực tế **1.462.396.993 ₫** (Biên LN **26.98%**).
  - Khắc phục triệt để việc kế toán ghi nhận Giá vốn = 0 đối với các sản phẩm Lưỡi Gà Trắng tự sản xuất nội bộ của Nhà máy Tâm Sen.

### R2. Chuẩn Hóa Liên Kết Đơn Hàng PO & Doanh Thu Dự Kiến
- Khớp nối toàn bộ 52 chứng từ giao hàng thực tế miền Bắc vào 31 dòng PO Lines của 20 Đơn hàng PO.
- Tính toán chính xác theo thời gian thực:
  - Sản lượng đã giao & sản lượng còn lại của từng PO Line.
  - Chỉ tiêu **Doanh thu dự kiến (PO còn lại)** chỉ tính trên khối lượng hàng chưa xuất của các PO mở đang thực hiện (**458.712.729 ₫**), không được tính ảo 100% toàn bộ giá trị PO.

### R3. Khắc Phục Triệt Để Bộ Nhớ Đệm Trình Duyệt & Trực Quan Hóa Báo Cáo Dashboard
- Loại bỏ 100% cơ chế gộp đệm cũ (`localStorage` key collision) gây nhân đôi doanh số hoặc hiển thị thừa chuyến giao hàng.
- Báo cáo Dashboard trực quan hóa chuẩn:
  - Mục 8: Hiển thị đúng vai trò **Tâm Sen là Nhà máy Tự Sản Xuất (Nội bộ)** vs **Các Nhà Cung Cấp Đối Tác (THP, Tuấn Bằng, Việt Trung...)**.
  - Các thẻ KPI (Tổng Doanh Thu, Tổng Lợi Nhuận Gộp, Tỷ Lệ Hoàn Thành, Doanh Thu Dự Kiến) hiển thị nhất quán, bất biến khi tải lại trang.

## Acceptance Criteria

### Tính Toàn Vẹn Số Liệu Kế Toán
- [ ] Khi chọn bộ lọc `Miền Bắc`: KPI Doanh thu hiển thị đúng **5.419.475.060 ₫** (52 chuyến).
- [ ] Khi chọn bộ lọc `Miền Bắc`: KPI Lợi nhuận gộp hiển thị đúng **1.462.396.993 ₫** (Biên LN **26.98%**).
- [ ] Khi chọn bộ lọc `Miền Bắc`: Doanh thu dự kiến PO còn lại hiển thị đúng **458.712.729 ₫**.
- [ ] Khi chọn bộ lọc `Toàn công ty`: KPI Doanh thu hiển thị đúng **50.976.099.551 ₫** (1.108 chuyến).

### Trải Nghiệm & Độ Bền Vững Hệ Thống
- [ ] Người dùng nhấn F5 hoặc tải lại trang bất kỳ lúc nào, số liệu luôn giữ nguyên 100%, không bị nhân đôi (106 chuyến / 10.3 tỷ) hoặc sai lệch.
- [ ] Không yêu cầu người dùng phải xác nhận thủ công hoặc can thiệp kỹ thuật mỗi khi xem báo cáo.
- [ ] Lệnh kiểm tra kiểu TypeScript (`npx tsc --noEmit`) và đóng gói (`npm run build`) đạt 0 lỗi.
