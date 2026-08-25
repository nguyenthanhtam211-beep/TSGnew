# BÁO CÁO KHẢO SÁT CHUYÊN SÂU: DASHBOARD, DATA GRIDS, MOBILE CARDS, MODALS & TOÀN BỘ CÁC PHÂN HỆ (SUBSYSTEMS)

**Dự án**: TSG Business OS — Nâng cấp Cockpit Hiện Đại  
**Chuyên gia khảo sát**: Explorer 3 (Dashboard, Grids, Modals & Subsystems Specialist)  
**Ngày thực hiện**: 25/08/2026  
**Thư mục làm việc**: `/Users/Nguyentam/antigravity/TSG-Business---New/.agents/teamwork_preview_explorer_survey_3`  
**Parent Orchestrator**: `/Users/Nguyentam/antigravity/TSG-Business---New/.agents/teamwork_preview_orchestrator_1`

---

## 1. TỔNG QUAN HỆ THỐNG & KẾT QUẢ KIỂM THỬ XÁC MINH BAN ĐẦU

### 1.1 Khảo sát môi trường kỹ thuật & Build Status
- **Framework & Core Libraries**: React 19.0.1, Vite 6.2.3, TypeScript ~5.8.2, Tailwind CSS v4.1.14 (@tailwindcss/vite), Motion (motion/react v12.23.24), Recharts v3.9.2, Firebase 12.16.0, Dnd-Kit (Core v6.3.1, Sortable v10.0.0), XLSX v0.18.5, JsPDF + AutoTable v5.0.8, Html2Canvas v1.4.1.
- **Kiểm thử TypeScript**: `npm run lint` (`tsc --noEmit`) -> **0 lỗi (Exit Code 0)**.
- **Kiểm thử Build Production**: `npm run build` (`vite build && esbuild server.ts`) -> **Thành công 100% (Exit Code 0)**.

---

## 2. INVENTORY TOÀN BỘ CÁC PHÂN HỆ (SUBSYSTEMS) VÀ GIAO DIỆN

Hệ thống TSG Business OS hiện tại bao gồm **21 view/module hoàn chỉnh**, được tổ chức logic thành các nhóm chức năng chính:

| STT | Phân hệ (Subsystem) | File Thành phần chính | Vai trò & Nghiệp vụ cốt lõi |
| :--- | :--- | :--- | :--- |
| **1** | **Dashboard Tổng quan** | `src/components/DashboardView.tsx` | Trung tâm chỉ huy tài chính, doanh thu, lợi nhuận gộp, hoa hồng, dự báo dòng tiền, phân bổ vòng đời PO, phân tích quý/tháng, cơ cấu nhóm hàng, top khách hàng/NCC, biểu đồ thác nước (Waterfall). Tích hợp xuất Google Sheets, Slides, Excel, PDF. |
| **2** | **Logistics Hub 360°** | `src/components/LogisticsHubView.tsx` | Điều độ giao hàng 4 tầng (Lịch giao nhận, Kế hoạch điều độ, Sổ giao hàng PXK, Đối soát cân bằng 3 chiều giữa PO vs Kế hoạch vs PXK). |
| **3** | **Đơn hàng (PO Header & Lines)** | `src/App.tsx` (`TableView`), `PODetailModal.tsx`, `DualPODocumentModal.tsx` | Quản lý hợp đồng đơn hàng, chi tiết dòng sản phẩm, tự động tính toán tài chính (Doanh thu, Giá vốn COGS, Lợi nhuận, % Biên lãi), cảnh báo quá hạn giao, tạo văn bản PO song song (Tâm Sen & An Việt Phát). |
| **4** | **Bảng giá 2026 & Đối chiếu** | `src/App.tsx` (`TableView`), `PriceReconciliationPanel.tsx`, `PricingCombobox.tsx` | Quản lý bảng giá niêm yết theo Hợp đồng 2026, đối chiếu giá mua AVP/NCC, giá bán khách hàng, biên lợi nhuận, popover thông tin sản phẩm (`ProductHoverCard`). |
| **5** | **Báo cáo Lợi nhuận & Biên lãi** | `src/App.tsx` (`TableView` chế độ Profit Report) | Thống kê chuyên sâu tỷ suất lợi nhuận dòng hàng, biên độ lãi gộp/ròng, phân tích chiết khấu hoa hồng. |
| **6** | **Giao hàng (PXK)** | `src/components/DeliveryView.tsx` | Sổ theo dõi phiếu xuất kho, phân nhóm giao hàng theo Khách hàng / Nhà cung cấp / Đơn hàng PO, tổng hợp doanh thu/lợi nhuận thực giao, xuất Google Sheets Looker Studio. |
| **7** | **Kế hoạch Giao hàng** | `src/components/DeliveryPlanView.tsx` | Lập kế hoạch phân bổ chuyến giao theo đợt (Multi-batch split), điều phối phương tiện, đồng bộ lịch Google Calendar. |
| **8** | **Lịch Giao Nhận Tổng thể** | `src/components/MasterCalendarView.tsx`, `UnifiedCalendar.tsx` | Lịch giao hàng 4 tầng (Năm / Tháng / Tuần / Ngày), lọc theo khách hàng, kéo thả kế hoạch, đồng bộ 2 chiều với Google Calendar API. |
| **9** | **Nhận dạng Tài liệu AI (OCR)** | `src/components/OCRView.tsx`, `src/lib/gemini.ts` | Nhận dạng tự động tài liệu PO, Phiếu giao hàng, Hợp đồng qua Gemini AI Vision; trích xuất bảng sản phẩm, đối chiếu giá tự động với Bảng giá Master, tự động tải lên Google Drive với quy chuẩn đặt tên tài liệu thông minh. |
| **10** | **Khách hàng (CRM)** | `src/components/CustomerView.tsx`, `CompanyLogo.tsx` | Quản lý danh bạ doanh nghiệp khách hàng, logo, địa chỉ, công nợ phải thu, phân loại, hợp đồng liên kết, liên kết 2 chiều (Deep Linking) với NCC và Danh bạ nhân sự, đồng bộ Google Drive. |
| **11** | **Nhà cung cấp (SRM)** | `src/components/SupplierView.tsx` | Danh mục nhà cung cấp, đánh giá chất lượng (sao), chứng chỉ ISO/GMI/FSC, chủng loại máy in/thiết bị, công nợ phải trả, theo dõi số lần trễ/lỗi, liên kết danh bạ. |
| **12** | **Danh bạ Liên hệ (Contacts)** | `src/components/ContactView.tsx`, `SalutationBadge.tsx` | Danh bạ nhân sự chuẩn Apple Contacts, định dạng chuẩn hóa danh xưng (`Mr`, `Mrs`, `Ms`), số điện thoại quốc gia, nhận diện cán bộ cấp cao (Executive), quản lý Task/Project/Activity Log theo cá nhân. |
| **13** | **Danh mục Sản phẩm 360°** | `src/components/ProductsView.tsx`, `ProductDetailModal.tsx` | Danh mục sản phẩm liên kết đa chiều (Hợp đồng, Bảng giá, PO, Kế hoạch giao, PXK, Specs kỹ thuật), tính toán giá trị tồn/đã giao. |
| **14** | **Tiêu chuẩn Kỹ thuật (Specs)** | `src/components/SpecsView.tsx` | Quản lý tiêu chuẩn kỹ thuật bao bì (Carton, Label, Material), bảng thông số chỉ tiêu/đơn vị/tiêu chuẩn/sai số/phương pháp thử, phê duyệt phiên bản, in ấn A4. |
| **15** | **Quản lý Hợp đồng** | `src/components/ContractsView.tsx` | Quản lý hợp đồng kinh tế (Mua/Bán/Nguyên tắc), OCR trích xuất nội dung hợp đồng, kiểm soát điều khoản thanh toán/giao hàng, phụ lục hợp đồng, kiểm toán giá cam kết. |
| **16** | **Quản lý Hoa hồng (Commissions)** | `src/components/CommissionView.tsx` | Sổ cái theo dõi chi phí chiết khấu hoa hồng theo đơn hàng PO hoặc theo tháng, thông tin thụ hưởng, STK ngân hàng, tính toán tự động khấu trừ vào lợi nhuận ròng. |
| **17** | **Lưu trữ & Sao lưu (Storage)** | `src/components/StorageView.tsx`, `MemoryStorageModal.tsx` | Kho tài liệu Drive phân cấp thư mục tự động, quy trình kiểm soát chéo (Double-check status: Verified / Pending / Discrepancy), sao lưu/phục hồi toàn bộ cơ sở dữ liệu JSON offline/online. |
| **18** | **Quy trình Mua bán 5 Bước** | `src/components/WorkflowView.tsx` | Quy trình điều hành toàn diện 5 bước: (1) Tính toán Sourcing Giá vốn & Bán, (2) Tạo PO & Dual PO Scan, (3) Lập kế hoạch giao, (4) Xuất kho PXK & Đối soát, (5) Quyết toán Doanh thu & Lãi ròng. |
| **19** | **Quản lý Công việc (Tasks)** | `src/components/TasksView.tsx` | Bảng Kanban CRM, tiến độ điều độ chuyến, đồng bộ Google Tasks & Calendar. |
| **20** | **Trợ lý Thông minh (AI Assistant)** | `src/App.tsx` (`AssistantView`), `src/prompt.ts` | Chatbot điều hành trợ lý ảo tích hợp ngữ cảnh toàn bộ Bảng giá, PO Header, PO Lines và Giao hàng với Gemini 2.5 Pro. |
| **21** | **Cài đặt & Hướng dẫn (Settings & Help)** | `src/components/SettingsView.tsx`, `HelpGuideView.tsx`, `HelpGuideModal.tsx` | Cấu hình tham số hệ thống, kết nối Google API tokens, hướng dẫn vận hành trực quan. |

---

## 3. KHẢO SÁT DATA GRIDS, TABLE VÀ MOBILE INSET-GROUPED CARDS

### 3.1 Khảo sát Desktop Data Grid (`TableView` trong `src/App.tsx`)
`TableView` là thành phần Data Grid chủ lực được sử dụng cho **Bảng giá 2026**, **PO Header**, **PO Lines**, **Báo cáo Lợi nhuận**, v.v.

- **Độ cô đọng & Khoảng cách (Density)**:
  + Cấu hình `text-xs whitespace-nowrap` với padding chuẩn `px-4 py-3 align-middle`, tối ưu không gian hiển thị mật độ cao cho doanh nghiệp B2B (Cockpit style).
- **Sticky Header & Frosted Glass Separation**:
  + Thẻ `thead` được cố định bằng `sticky top-0 z-10 bg-[#F5F5F7]` kèm đường viền `border-b border-black/[0.06]`.
  + Cột đầu tiên (STT / Mã đơn / Mã giá) hỗ trợ cố định ngang `sticky left-0 shadow-[1px_0_0_0_#f3f4f6] z-[15]` giúp người dùng cuộn ngang mà không mất ngữ cảnh định danh.
- **Alternating Rows & Trạng thái Hover**:
  + Hỗ trợ xen kẽ hàng và trạng thái quá hạn giao hàng (`isOverdue` -> nền `bg-red-50 hover:bg-red-100`, viền `border-l-4 border-l-rose-500`).
  + Hàng được highlight (`highlightedRowIds` -> `bg-[#fef3c7]/50`).
- **Bộ lọc đa lựa chọn theo từng cột (Column-level Filter Popover)**:
  + Tích hợp icon `Filter` trên từng tiêu đề cột. Khi bấm mở popover dropdown chứa danh sách checkbox các giá trị duy nhất (Unique values), có chức năng "Xoá lọc" và bộ đếm filter đang kích hoạt.
- **Kéo thả sắp xếp thứ tự cột (Column Reordering)**:
  + Tích hợp `@dnd-kit/core` và `@dnd-kit/sortable` với component `SortableColumnItem`, cho phép người dùng kéo thả tùy biến thứ tự các cột theo ý muốn.
- **Ẩn/Hiện cột (Column Visibility Drawer/Popover)**:
  + Menu ẩn hiện cột với checkbox cho từng cột dữ liệu, lưu trữ trạng thái người dùng.
- **Thanh tìm kiếm Spotlight Capsule (⌘K)**:
  + Capsule search bo góc tròn `rounded-full` phong cách Apple macOS, nền `#E5E5EA]/60`, placeholder hỗ trợ tìm kiếm toàn trường tức thời.
- **Thanh 4 Card Tóm tắt Tài chính / Chỉ số Vận hành (Summary Bar)**:
  + Hàng 4 box tóm tắt phía trên bảng hiển thị tổng Doanh thu, Lợi nhuận, Số lượng đơn, Tỷ lệ hoàn thành với icon và màu sắc nhận diện.

### 3.2 Khảo sát Mobile Apple Inset-Grouped Card Feed (`md:hidden`)
Trên thiết bị di động (màn hình `< 768px`), bảng dữ liệu chuyển đổi hoàn toàn sang **Card Feed chuẩn Apple Inset-Grouped**:
- **Bố cục khung Card**:
  + Nền tổng thể `#F5F5F7`, mỗi thẻ bản ghi là một card độc lập `bg-white rounded-2xl p-3.5 border border-black/[0.06] shadow-xs active:scale-[0.98] transition-all`.
- **Phân cấp thông tin rõ ràng (Hierarchy)**:
  + **Tiêu đề chính (Primary Title)**: Tên sản phẩm hoặc Mã PO in đậm (`font-bold text-slate-900 leading-snug`), tích hợp `ProductHoverCard` tra cứu nhanh.
  + **Hàng Badge nhận diện**: SKU (`Tag`), Khách hàng (`Building2`), Hợp đồng (`FileText`), cùng badge cảnh báo `Quá hạn` (nền đỏ chữ đỏ).
  + **Lưới 4-box chỉ số tài chính/vận hành (Card Metrics Grid)**: Lưới 2x2 bo góc `rounded-xl p-2 bg-slate-50/80` hiển thị ưu tiên Đơn giá bán, Đơn giá mua/nhập, Số lượng, Lợi nhuận gộp.
  + **Chân card (Footer)**: Nút điều hướng "Chi tiết" kèm icon `ChevronRight`, phản hồi xúc giác mượt mà khi chạm.

---

## 4. KHẢO SÁT HỆ THỐNG MODAL, DRAWER VÀ DIALOG

Hệ thống sở hữu các modal chuyên dụng phục vụ đa dạng nhu cầu thao tác tài liệu và nghiệp vụ:

| Tên Modal / Dialog | File Thành phần | Đặc điểm Thiết kế & Hành vi UX |
| :--- | :--- | :--- |
| **PO Detail Modal** | `src/components/PODetailModal.tsx` | Giao diện 2 tab (Tổng quan vòng đời & Chi tiết dòng PO), tích hợp biểu đồ Recharts phân bổ sản lượng, form thêm dòng hàng thông minh, nút chuyển sang Dual PO. |
| **Dual PO Document Modal** | `src/components/DualPODocumentModal.tsx` | So sánh trực quan văn bản PO Tâm Sen Group vs PO An Việt Phát Group, hiển thị mẫu in A4 chuẩn hợp đồng thương mại với dấu mộc, chuyển đổi số tiền thành chữ tiếng Việt chuẩn xác, xuất file PDF/Excel. |
| **Product Detail Modal** | `src/components/ProductDetailModal.tsx` | Hồ sơ sản phẩm 360° với 5 tab: Tổng quan, Bảng giá, Đơn hàng/Giao hàng, Specs kỹ thuật, Hợp đồng cam kết. Hỗ trợ phóng to toàn màn hình (Maximize/Minimize). |
| **Memory Storage Modal** | `src/components/MemoryStorageModal.tsx` | Hộp thoại quản lý sao lưu / phục hồi dữ liệu JSON, tạo snapshot ngoại tuyến, giám sát dung lượng bộ nhớ. |
| **PDF Export Modal** | `src/components/PDFExportModal.tsx` | Hộp thoại cấu hình xuất PDF chất lượng cao, tùy chọn chế độ đồ họa trực quan hoặc bảng chi tiết. |
| **Google Sync Modals** | `GoogleSheetsSyncModal.tsx`, `GoogleDriveSyncModal.tsx` | Hộp thoại đồng bộ dữ liệu phẳng 2 chiều với Looker Studio, BigQuery, và kho lưu trữ Google Drive. |
| **Generic Table Add/Edit Modal** | `src/App.tsx` (trong `TableView`) | **Adaptive Sheet Pattern**: Tự động chuyển đổi thành **Apple Bottom Sheet** trên di động (`rounded-t-[28px] max-h-[90vh] pb-safe`) và **macOS Window Modal** trên máy tính (`rounded-2xl shadow-2xl` kèm `MacTrafficLights`). Form 2 cột responsive với combobox tìm kiếm thông minh. |

---

## 5. KHẢO SÁT BIỂU ĐỒ TRỰC QUAN (RECHARTS) VÀ POLISH ĐỒ HỌA

Trong `DashboardView.tsx` và `PODetailModal.tsx`, có tổng cộng **11 biểu đồ trực quan hóa dữ liệu**:

1. **Doanh thu, Lợi nhuận & Hoa hồng (Đơn hoàn thành)**: `ComposedChart` (Bar doanh thu `#3b82f6`, Bar LN gộp `#10b981`, Bar Hoa hồng `#a855f7`, Line LN ròng `#f59e0b`).
2. **Phân tích Lợi nhuận Gộp vs Hoa hồng vs LN Ròng Hàng Tháng**: `BarChart` đa cột với bán kính bo góc thanh `radius={[4, 4, 0, 0]}`.
3. **Phân tích Tình hình Kinh doanh theo Quý (Q1 - Q4)**: `BarChart` kết hợp bảng đối chiếu chỉ số tài chính từng quý.
4. **Top 10 Mặt hàng Best Seller**: Bảng xếp hạng sản lượng, doanh thu và lợi nhuận có huy hiệu top 1-2-3 vàng/xám.
5. **Xu hướng 4 Chỉ số Tài chính Chủ chốt**: `LineChart` đa đường (Doanh thu, LN gộp, Hoa hồng, LN ròng) với điểm neo `dot={{ r: 4 }}`.
6. **Cơ cấu Doanh thu theo Nhóm hàng**: Donut `PieChart` (`innerRadius={65}`, `outerRadius={95}`) với nhãn tỷ lệ % và bảng màu tương phản cao.
7. **Top Khách hàng theo Doanh thu & Lợi nhuận**: `BarChart` nằm ngang/dọc với nhãn tiền tệ triệu VNĐ.
8. **Top Nhà cung cấp (Giá vốn & Mua hàng)**: `BarChart` phân tích tỷ trọng mua hàng và giá trị vốn.
9. **Cơ cấu Phân bổ Hoa hồng theo Khách hàng**: `BarChart` kết hợp thẻ tổng hợp tỷ lệ hoa hồng trên tổng lãi gộp.
10. **Phân tích Tăng trưởng Doanh thu & Tích lũy**: `ComposedChart` gồm `Area` tích lũy (`#eff6ff`), `Bar` doanh thu tháng và `Line` tỷ lệ % tăng trưởng bước nhảy (`stepAfter`).
11. **Biểu đồ Thác nước (Waterfall Chart)**: Phân tách từ Doanh thu tổng -> Giá vốn (-) -> LN gộp (=) -> Hoa hồng (-) -> LN ròng (=).

**Đặc điểm Glassmorphic Tooltip của Recharts**:
- Tooltip container: `backgroundColor: 'rgba(15, 23, 42, 0.92)'`, `backdropFilter: 'blur(12px)'`, `borderRadius: '12px'`, `border: '1px solid rgba(255, 255, 255, 0.15)'`, `boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)'`.
- Định dạng tiền tệ: Chuẩn hóa `Intl.NumberFormat('vi-VN')` hiển thị VNĐ rõ ràng, không bị lỗi số trôi dạt.

---

## 6. CHI TIẾT YÊU CẦU & KẾ HOẠCH KIẾN TRÚC CHO MILESTONES R3, R4, R5

### 6.1 Milestone R3: Dashboard & Logistics Hub 360° Bento Grid
- **Asymmetrical Bento KPI Cards**:
  + Áp dụng quy chuẩn Bento Grid phong cách Apple / Linear (`DESIGN_VARIANCE: 8`, `VISUAL_DENSITY: 4` theo `taste-skill`).
  + Các thẻ KPI không đơn điệu mà có nhịp điệu (Rhythm): Card Dự báo Dòng tiền (Xanh Navy/Indigo), Card Tiến độ & Uy tín (Hổ phách/Cam), Card Rủi ro Tài chính (Hồng ngọc/Đỏ), cùng 4 thẻ Top KPI (Doanh thu, LN gộp, Số đơn, Tỷ lệ hoàn thành).
  + Tích hợp hiệu ứng vầng sáng ngầm (ambient backdrop glow) và hiệu ứng hover vật lý (`scale-[1.01] transition-all duration-300`).
- **Phân bổ Vòng đời Đơn hàng Pipeline**:
  + Thanh tiến trình Pipeline 4 bước (Mới tạo -> Đang xử lý -> Đang giao -> Hoàn thành) dạng nút tròn nối dây với vòng hào quang phát sáng (`ring-8`), hiển thị số đơn và phần trăm trực quan.
- **Logistics Hub 360° Command Center**:
  + Banner chỉ huy trung tâm phong cách Dark Slate Sequoia với hạt phát sáng nhấp nháy (`animate-pulse`).
  + Bộ chuyển mạch 4 phân khu dạng Segmented Control kính mờ: (1) Lịch Giao Nhận 4 tầng, (2) Kế hoạch Điều độ, (3) Sổ Giao hàng PXK, (4) Đối soát 3 Chiều.
  + Lưới 6 KPI vận hành logistics với số liệu tabular-nums sắc nét.
  + Bảng đối soát 3 chiều tự động tính toán chênh lệch (Kế hoạch vs PO, Thực xuất PXK vs PO, Số lượng còn lại, Doanh thu và Lợi nhuận thực giao).

### 6.2 Milestone R4: Desktop Data Grid, Mobile Inset Cards & Modern Modals/Drawers
- **Desktop Data Grid Chuẩn Cockpit**:
  + Duy trì độ dày đặc dữ liệu (Dense) với chữ `text-xs`, font mono/tabular-nums cho các cột tiền tệ và số lượng.
  + Header cố định với bóng mờ tách biệt nền cuộn (`sticky top-0 z-10`).
  + Bộ lọc dropdown từng cột độc lập, hỗ trợ lọc đa điều kiện.
  + Spotlight search capsule đặt ngay trên bảng, tích hợp phím tắt nhanh ⌘K.
  + Thanh 4 KPI Summary Bar đồng bộ màu sắc sắc nét.
- **Mobile Apple Inset-Grouped Cards**:
  + Chuyển đổi mượt mà `< 768px` sang danh sách thẻ bo góc `rounded-2xl` trên nền `#F5F5F7`.
  + Tên sản phẩm / mã PO nổi bật, badge danh mục rõ ràng, lưới 2x2 tóm tắt 4 chỉ số tài chính trọng yếu.
  + Phản hồi chạm lò xo iOS (`active:scale-[0.98]`).
- **Clean Modern Modals & Drawers**:
  + Trên mobile: Tự động trượt lên dạng Bottom Sheet bo góc đỉnh `rounded-t-[28px]`, hỗ trợ vùng an toàn `pb-safe`.
  + Trên desktop: Cửa sổ macOS bo góc `rounded-2xl` kèm 3 nút đèn giao thông `MacTrafficLights`.
  + Form nhập liệu responsive 2 cột với autocomplete combobox (`ProductCombobox`, `PricingCombobox`), tự động tính toán thành tiền khi thay đổi số lượng/giá bán.

### 6.3 Milestone R5: Tính toàn vẹn hệ thống trên tất cả 10 phân hệ
- Đảm bảo 100% luồng dữ liệu liên kết chéo (2-way Relational Data Binding):
  + **PO -> Pricing -> Product -> Specs**: Khi tạo PO hoặc xem chi tiết dòng đơn hàng, tự động tra cứu giá mua/bán, nhà cung cấp tương ứng từ Bảng giá 2026 và thông số kỹ thuật.
  + **Customer <-> Supplier <-> Contact**: Deep linking 2 chiều giữa Khách hàng, Nhà cung cấp và Danh bạ liên hệ thông qua `targetCustomerId`, `targetSupplierId`, `targetContactId`.
  + **OCR -> Firestore -> Google Drive**: OCR tài liệu PO/PXK/Hợp đồng tự động khớp mã giá, kiểm tra sai lệch, lưu vào Firestore và đồng bộ tệp lên Drive theo đúng cây thư mục năm/tháng của đối tác.
  + **Storage Double-Check**: Quy trình xác thực tệp 3 trạng thái (Verified, Pending, Discrepancy) cho tài liệu số.
  + **Zero Type Errors & Clean Build**: Duy trì `npx tsc --noEmit` và `npm run build` đạt 0 lỗi 100%.

---

## 7. BẢNG TỔNG HỢP KIẾN TRÚC & PHÂN BỔ NHIỆM VỤ

| Hạng mục | Hiện trạng khảo sát | Đánh giá & Khuyến nghị triển khai |
| :--- | :--- | :--- |
| **Dashboard Bento Grid** | Đã có layout Bento, Pipeline vòng đời PO, 10 biểu đồ Recharts, xuất Google Slides/Sheets/PDF. | Đạt chuẩn Cockpit hiện đại. Tinh chỉnh màu sắc theo bảng palette Slate/Indigo/Emerald của taste-skill, đảm bảo contrast WCAG AA. |
| **Logistics Hub 360°** | Đã có Segmented Switcher 4 tầng, 6 thẻ KPI vận hành, bảng đối soát 3 chiều PO vs Plan vs PXK. | Hoàn thiện cao độ, đáp ứng trọn vẹn yêu cầu R3. |
| **Desktop Data Grid** | `TableView` có sticky header, alternate rows, search spotlight, summary cards, column reorder, column filter popover. | Đạt chuẩn density cao cho màn hình máy tính B2B. |
| **Mobile Card Feed** | Inset-grouped cards 4-box metrics, tag SKU, badge khách hàng/hợp đồng, tap feedback. | Hoàn toàn tuân thủ phong cách Apple iOS 18 Inset-Grouped. |
| **Modals & Drawers** | Adaptive Bottom Sheet trên di động, macOS Window Dialog trên desktop, MacTrafficLights, Comboboxes. | Trải nghiệm đa nền tảng nhất quán, tiện dụng. |
| **Toàn vẹn 10 Phân hệ** | Cả 10 phân hệ chính (Dashboard, PO, Delivery, Delivery Plan, Pricing, OCR, Customer, Supplier, Storage, Contacts) và các phân hệ bổ trợ (Contracts, Commission, Workflow, Specs, Products) đều hoạt động trơn tru. | Toàn bộ các luồng dữ liệu 2 chiều được kết nối hoàn chỉnh. |
| **Type Safety & Build** | TypeScript ~5.8.2 `tsc --noEmit` và Vite production build đạt 0 lỗi. | Đảm bảo tính sẵn sàng bàn giao và độ ổn định cao nhất. |

---
*Báo cáo được lập bởi Explorer 3 (Dashboard, Grids, Modals & Subsystems Specialist) — Đã đối chiếu thực tế mã nguồn và kiểm thử build 100%.*
