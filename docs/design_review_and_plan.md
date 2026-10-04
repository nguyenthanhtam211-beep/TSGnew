# TSG Business OS — Đánh giá thiết kế & Kế hoạch triển khai

## Phần 1 — Đánh giá thiết kế hiện tại

### Kết luận chính
Giao diện vẫn chưa đạt **không phải vì chọn sai phong cách**, mà vì **hệ thống chưa có design system**. Mỗi màn hình (25 file, khoảng 41.500 dòng) tự viết class Tailwind riêng. Mấy lần redesign trước, kể cả lần tôi vừa làm, đều chỉ sửa tại chỗ từng header, nên hệ thống không bao giờ thực sự đồng nhất.

### Số liệu đo trực tiếp từ mã nguồn

| Hạng mục | Hiện trạng | Mức chuẩn của một hệ thống chuyên nghiệp |
|---|---|---|
| Màu xanh chủ đạo | **5 mã khác nhau**: `#007AFF` (121), `#0066FF` (47), `#0066D6` (13), `#0062CC` (6), `#0052CC` (2) | 1 màu chính + 1 màu hover |
| Nền xám | **6 mã**: `#F5F5F7` (113), `#FBFBFD` (46), `#F8F9FA`, `#F8FAFA`, `#F8F9FB`, `#F8FAFC` | 2–3 lớp nền |
| Bo góc | `xl` 736, `lg` 411, `2xl` 357, `3xl` 83, `md` 72, cộng 5 giá trị tùy ý | 3 cấp (control / card / modal) |
| Cỡ chữ tùy ý | `text-[11px]` 424, `text-[10px]` 346, `text-[9px]` 40, `text-[8px]` 1 | Không có chữ dưới 11px, theo thang cỡ chữ cố định |
| Màu nhấn | emerald 794, amber 469, purple 336, rose 220, indigo 179, teal 134… | Màu chỉ mang ý nghĩa trạng thái (thành công / cảnh báo / lỗi / thông tin) |
| Đổ bóng | 7 cấp được dùng lẫn lộn | 3 cấp |
| Gradient | 45 chỗ | 0–2 (chỉ logo/thương hiệu) |
| Chữ IN HOA | 348 chỗ | Hạn chế, chỉ dùng cho nhãn cột |
| Overlay/modal tự viết | **44 overlay trong 25 file** | 1 component `Modal` + 1 `Drawer` |
| Bộ component `Cockpit*` | Chỉ **4 file** dùng | Mọi màn hình đều dùng |
| `<button>` tự viết | 566 | Hầu hết qua `Button` |

> [!WARNING]
> **Lỗi tôi gây ra ở lần trước:** class `font-space-grotesk` (dùng ở 12 chỗ) **không tồn tại** trong `index.css`, nên tiêu đề modal vẫn hiển thị font Inter thay vì Space Grotesk. Class đúng là `font-display`. Kế hoạch bên dưới sẽ sửa lỗi này.

### Các vấn đề người dùng nhìn thấy
1. **Thiếu thứ bậc thị giác**: rất nhiều badge, màu và chữ IN HOA cùng cạnh tranh sự chú ý → màn hình "ồn", khó biết nhìn vào đâu trước.
2. **Chữ quá nhỏ**: hơn 800 chỗ dùng chữ 9–11px → mỏi mắt khi đọc số liệu kế toán/PO cả ngày.
3. **Chưa đồng nhất giữa các bảng**: mỗi màn hình có toolbar, cách lọc, phân trang, trạng thái rỗng và nút hành động khác nhau.
4. **Pha trộn 3 phong cách**: macOS (`#F5F5F7`, `#007AFF`, segmented pills), Linear (hairline) và dashboard nhiều màu (gradient, badge sặc sỡ).
5. **Modal không đồng nhất**: kích thước, padding, footer và vị trí nút chính mỗi nơi một kiểu.

---

## Phần 2 — Định hướng thiết kế (cần anh chọn 1)

| Phương án | Mô tả | Phù hợp khi |
|---|---|---|
| **A. Ledger Pro** (đề xuất) | Gần như đơn sắc: chữ xám đậm trên nền trắng/xám nhạt, chỉ **1 màu nhấn cobalt**, màu trạng thái dịu. Bảng dày đặc, số liệu dùng font tabular, ít bo góc (6/8/12px). Tham khảo: Linear, Stripe Dashboard, Ramp. | Làm việc chủ yếu với dữ liệu, PO, công nợ |
| B. Warm Enterprise | Nền màu kem ấm, tiêu đề serif, nhấn xanh rêu. Sang trọng, khác biệt. Tham khảo: Notion Calendar, Mercury. | Muốn giao diện có cá tính thương hiệu riêng |
| C. Dark Cockpit | Mặc định nền tối, nhấn neon nhẹ. Tham khảo: Vercel, Raycast. | Làm việc nhiều vào ban đêm, màn hình lớn |

Kế hoạch bên dưới viết theo **Phương án A**. Nếu chọn B hoặc C thì chỉ cần thay giá trị token ở Giai đoạn 1, các giai đoạn còn lại giữ nguyên.

---

## Phần 3 — Kế hoạch triển khai (dành cho Gemini)

### Nguyên tắc bắt buộc (đưa vào mọi prompt)
1. **Không đổi logic nghiệp vụ**: không đụng Firestore, state, tính toán, handler. Chỉ sửa JSX/className.
2. **Mỗi giai đoạn = 1 commit riêng**, chạy `npx tsc --noEmit` và `npm run build` → cả hai phải đạt 0 lỗi rồi mới commit.
3. **Mỗi lần chỉ chuyển đổi một file.** File > 1.500 dòng thì chia theo từng khối (bảng → modal → drawer).
4. **Cấm** sau Giai đoạn 2: mã màu hex trong className, `text-[Npx]`, `rounded-[Npx]`, `bg-gradient-*` (trừ logo).
5. Tạo nhánh trước khi bắt đầu: `git checkout -b redesign/ledger-pro` (để có thể quay lại `main` bất cứ lúc nào).

### Giai đoạn 0 — Sao lưu & sửa lỗi nhanh (15 phút)
- `git tag pre-redesign-v2`
- Thay toàn bộ `font-space-grotesk` → `font-display`.
- **Nghiệm thu:** `grep -r font-space-grotesk src` không còn kết quả.

### Giai đoạn 1 — Design tokens (`src/index.css`)
Thay khối `@theme` và `:root` bằng **một nguồn token duy nhất**:

```css
@theme {
  /* Nền */
  --color-canvas: #F7F7F8;      /* nền app */
  --color-surface: #FFFFFF;     /* card, modal, bảng */
  --color-subtle: #F2F2F4;      /* header bảng, hover, input */
  --color-line: #E6E6EA;        /* viền hairline */
  --color-line-strong: #D4D4DA;
  /* Chữ */
  --color-ink: #111114;
  --color-ink-2: #3F3F46;
  --color-ink-3: #71717A;
  --color-ink-4: #A1A1AA;
  /* Màu nhấn duy nhất */
  --color-brand: #2F5BEA;
  --color-brand-hover: #2549C7;
  --color-brand-soft: #EEF2FE;
  /* Màu trạng thái (chỉ dùng cho trạng thái) */
  --color-ok: #15803D;    --color-ok-soft: #ECFDF3;
  --color-warn: #B45309;  --color-warn-soft: #FFF7E6;
  --color-bad: #B91C1C;   --color-bad-soft: #FEF2F2;
  --color-info: #0369A1;  --color-info-soft: #EFF8FF;
  /* Bo góc */
  --radius-control: 6px;  --radius-card: 10px;  --radius-modal: 14px;
  /* Đổ bóng */
  --shadow-card: 0 1px 2px rgb(17 17 20 / 0.04);
  --shadow-pop: 0 8px 24px -6px rgb(17 17 20 / 0.12);
  --shadow-modal: 0 24px 48px -12px rgb(17 17 20 / 0.25);
  /* Font */
  --font-display: "Space Grotesk", "Inter", sans-serif;
  --font-sans: "Inter", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;
}
```

Thang cỡ chữ (dùng class Tailwind chuẩn): `text-xs` 12px (nhãn, meta), `text-sm` 14px (nội dung, ô bảng), `text-base` 16px (tiêu đề card), `text-lg` 18px (tiêu đề modal), `text-2xl` 24px (tiêu đề trang). Chữ nhỏ nhất là **12px**.

- **Nghiệm thu:** build đạt; có thể dùng các class như `bg-surface`, `text-ink-3`, `border-line`, `rounded-card`.

### Giai đoạn 2 — Bộ component dùng chung (`src/components/ui/`)
Viết lại / bổ sung các component sau. Mỗi component < 150 dòng, chỉ dùng token:

| Component | API tối thiểu |
|---|---|
| `Button` | `variant: primary \| secondary \| ghost \| danger`, `size: sm \| md`, `icon`, `loading` |
| `IconButton` | `icon`, `label` (bắt buộc, dùng làm aria-label), `size` |
| `Modal` | `open`, `onClose`, `title`, `subtitle`, `icon`, `size: sm \| md \| lg \| xl`, `footer`, `maximizable`. Tự xử lý ESC, click nền, khóa scroll, focus trap. Header: icon + tiêu đề bên trái, **1 nút ✕** bên phải. Footer: `Hủy` (ghost) bên trái nút chính (primary), căn phải. |
| `Drawer` | Giống `Modal`, trượt từ phải, `width: md \| lg` |
| `Field` + `Input` / `Select` / `Textarea` | `label`, `hint`, `error`, `required`; chiều cao 36px; viền `line`; khi focus hiện ring `brand` |
| `DataTable` | Header dính, chữ 12px màu `ink-3`, hàng cao 40px, số căn phải dùng `font-mono tabular-nums`, hover hàng `bg-subtle`, trạng thái rỗng/đang tải tích hợp sẵn |
| `Toolbar` | Ô tìm kiếm + bộ lọc + khu vực nút hành động bên phải |
| `PageHeader` | `title`, `description`, `actions` |
| `StatusBadge` | `tone: ok \| warn \| bad \| info \| neutral`, nền soft, chấm tròn 6px, không IN HOA |
| `Card`, `Stat`, `Tabs`, `EmptyState` | |

- Xóa `MacTrafficLights.tsx` cùng mọi import và export của nó trong `index.ts`.
- **Nghiệm thu:** tạo trang tạm `/ui-preview` (chỉ ở dev) hiển thị mọi component với mọi variant, chụp ảnh để duyệt **trước khi** sang Giai đoạn 3.

### Giai đoạn 3 — App shell (`App.tsx`, sidebar, topbar)
- Sidebar rộng 240px, nền `canvas`, mục đang chọn có nền `surface` + viền `line`, icon 16px, nhóm menu có nhãn 12px màu `ink-4`.
- Topbar cao 56px: breadcrumb bên trái; ô tìm kiếm toàn cục, nút đồng bộ Drive và avatar bên phải.
- Vùng nội dung: `max-w-[1440px]`, padding 24px, mỗi trang bắt đầu bằng `PageHeader`.
- Menu mobile dùng `Drawer`.

### Giai đoạn 4 — Chuyển đổi từng màn hình (theo thứ tự ưu tiên)
Mỗi màn hình làm theo checklist:
1. Thay khối tiêu đề bằng `PageHeader`.
2. Thay bảng bằng `DataTable` + `Toolbar` + `Pagination`.
3. Thay mọi overlay `fixed inset-0` bằng `Modal` / `Drawer`.
4. Thay `<button>` bằng `Button` / `IconButton`.
5. Thay input bằng `Field` + `Input`.
6. Thay badge màu tự viết bằng `StatusBadge`.
7. Xóa hex, `text-[Npx]`, gradient còn sót.

Thứ tự: `TableView` (PO) → `CustomerView` → `SupplierView` → `ProductsView` + `ProductDetailModal` → `PODetailModal` + `DualPODocumentModal` → `DeliveryView` → `ContractsView` → `CommissionView` → `ContactView` → `DashboardView` → `SpecsView`, `OCRView`, `StorageView` → `WorkflowView`, `TasksView`, `LogisticsHubView`, `MasterCalendarView`, `FactoryManagementView` → `SettingsView`, `HelpGuide*`, `GoogleDriveSyncModal`, `POFileUploadModal`.

### Giai đoạn 5 — Dọn dẹp & chặn tái phát
Chạy các lệnh sau; **tất cả phải trả về 0**:
```bash
grep -rE "#[0-9A-Fa-f]{6}" src/components --include=*.tsx | grep -v CompanyLogo | wc -l
grep -rE "text-\[[0-9]+px\]" src | wc -l
grep -rE "rounded-\[[0-9]+px\]" src | wc -l
grep -r "fixed inset-0" src/components --include=*.tsx | grep -v "ui/" | wc -l
grep -r "MacTrafficLights" src | wc -l
```
Thêm các lệnh này vào script `npm run lint:design` để lần sửa sau không làm hỏng lại.

### Giai đoạn 6 — QA
- Kiểm tra ở 3 độ rộng: 1440px, 1024px, 390px (mobile).
- Mở và đóng **mọi** modal: ESC, click nền và nút ✕ đều đóng; nút chính nằm bên phải footer.
- Tab bằng bàn phím qua form: focus ring luôn nhìn thấy được.
- Merge `redesign/ledger-pro` → `main` → Vercel tự deploy.

---

## Phần 4 — Prompt mẫu cho Gemini

**Prompt khởi động (Giai đoạn 0–2):**
> Đọc `design_review_and_plan.md`. Thực hiện Giai đoạn 0, 1, 2 trên nhánh `redesign/ledger-pro`. Không sửa logic nghiệp vụ. Sau mỗi giai đoạn chạy `npx tsc --noEmit` và `npm run build`, chỉ commit khi cả hai đạt 0 lỗi. Dừng sau Giai đoạn 2 và cho tôi xem trang `/ui-preview`.

**Prompt cho mỗi màn hình (Giai đoạn 4):**
> Chuyển đổi `src/components/<File>.tsx` theo checklist Giai đoạn 4 trong `design_review_and_plan.md`. Chỉ dùng component trong `src/components/ui/` và token đã định nghĩa. Không đổi state, handler hay truy vấn Firestore. Sau khi xong: chạy tsc và build, chạy các lệnh grep của Giai đoạn 5 **chỉ trên file này** và báo kết quả, rồi commit `refactor(ui): migrate <File> to design system`.

> [!TIP]
> Nên duyệt kết quả sau Giai đoạn 2 (trang `/ui-preview`) và sau màn hình đầu tiên (`TableView`). Nếu ưng hai mốc này thì các màn hình còn lại chỉ là lặp lại cùng một khuôn.
