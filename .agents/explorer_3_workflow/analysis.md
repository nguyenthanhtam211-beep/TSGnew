# Báo Cáo Khảo Sát Chuyên Sâu: Luồng Nghiệp Vụ 5 Bước & Các Hub Điều Hành (TSG Business OS)

## Tóm Tắt Tổng Quan (Executive Summary)
Đã hoàn thành đợt kiểm tra, rà soát mã nguồn chuyên sâu (Deep Code-Level Exploration & Audit) cho toàn bộ **Luồng Nghiệp Vụ 5 Bước (End-to-End Workflow)** và các Trung tâm Điều hành (Hubs) trong hệ thống **TSG Business OS** (Tâm Sen Group ERP 2026).
- **TypeScript Check**: `npx tsc --noEmit` hoàn thành không có lỗi biên dịch (Exit code 0).
- **Build Production**: `npm run build` thành công 100% (Vite production bundle + esbuild server bundle).
- **Phạm vi kiểm tra**: 5 bước E2E từ Khai báo Master Data (Bước 1), Hợp đồng & Bảng giá (Bước 2), Tiếp nhận PO (Bước 3), Lập kế hoạch giao hàng (Bước 4) đến Phiếu xuất kho PXK & Đối soát công nợ (Bước 5), cùng hệ thống đồng bộ dữ liệu đa tầng (RAM / LocalStorage / Cloud Firestore).

---

## 1. Khảo Sát Chi Tiết Luồng Nghiệp Vụ 5 Bước (Step-by-Step Deep Dive)

### Bước 1: Quản Trị Dữ Liệu Gốc (Master Data) & Liên Kết Đa Chiều (Customer / Supplier / Contact)
**Mã nguồn khảo sát**: `src/components/CustomerView.tsx`, `src/components/SupplierView.tsx`, `src/components/ContactView.tsx`, `src/lib/companyUtils.ts`.

#### Cơ chế hoạt động:
1. **Khách hàng (`CustomerView.tsx`)**:
   - Quản lý hồ sơ công ty, phân loại (`Bao bì Carton`, `Thuốc lá - Nhà sản xuất`), tình trạng mua hàng, hạn mức công nợ (`Hạn mức nợ`), hạn thanh toán, và hồ sơ đại diện pháp luật.
   - Liên kết 2 chiều với Danh bạ (`getLinkedContacts`): Tìm kiếm nhân sự theo danh sách ID tường minh `Liên hệ liên kết` hoặc theo tên công ty rút gọn (`compName === custCode || compName === custName`).
   - Deep Linking: Tiếp nhận `targetCustomerId` từ các phân hệ khác (PO, Delivery, Logistics) và tự động mở modal chi tiết khách hàng tương ứng.
2. **Nhà cung cấp (`SupplierView.tsx`)**:
   - Quản lý nhà cung ứng bao bì/nguyên liệu (YFY Hà Nam, Tuấn Bằng, Thuận Hòa Phát, Tâm Sen, MM Vidon, IPVN, Ojitex,...), nhóm hàng, đánh giá sao, chỉ số giao trễ/lỗi hàng, và hợp đồng nguyên tắc.
   - Deep Linking: Tiếp nhận `targetSupplierId` và tự động kích hoạt sub-tab hồ sơ NCC.
3. **Danh bạ (`ContactView.tsx`)**:
   - Phân loại danh bạ 3 nhóm: Lãnh đạo cấp cao (`isExecutive`: Chủ tịch, Tổng giám đốc, Giám đốc, Phó giám đốc), Khách hàng, Nhà cung cấp, và Quan hệ VIP (`starred`).
   - Tích hợp Dossier 360°: Quản lý Công việc (`tasks`), Dự án (`projects`), Nhật ký hoạt động (`activities`) cho từng nhân sự.

#### Điểm phát hiện & Rủi ro:
- **Lưu trữ dữ liệu Dossier chưa đồng bộ Cloud**: Các tác vụ (`tasks`), dự án (`projects`) và nhật ký tương tác (`activities`) của liên hệ đang lưu trữ độc lập tại `localStorage` (`tsg_contact_tasks`, `tsg_contact_projects`, `tsg_contact_activities`), chưa được đẩy lên các collection `tasks`/`projects`/`activities` của Firestore thông qua `dbEngine.save`.
- **Chuẩn hóa tên công ty khi so khớp**: Trong `getLinkedContacts` (dòng 140-150 ở `CustomerView.tsx` và `SupplierView.tsx`), việc so khớp tên công ty sử dụng chuỗi nguyên bản thay vì gọi hàm `cleanCompanyName(compName)`, dẫn đến trường hợp tên công ty dài trên danh bạ (VD: "CÔNG TY TNHH BAO BÌ YFY HÀ NAM") có thể không khớp hoàn hảo với mã NCC "YFY" nếu không có alias.

---

### Bước 2: Quản Lý Hợp Đồng & Tra Cứu Bảng Giá Hiệu Lực (Contracts & Pricing Active Lookup)
**Mã nguồn khảo sát**: `src/components/ContractsView.tsx`, `src/components/PricingCombobox.tsx`, `src/lib/business-logic.ts`, `src/data.ts`.

#### Cơ chế hoạt động:
1. **Hợp đồng kinh tế (`ContractsView.tsx`)**:
   - Bóc tách Hợp đồng bằng Gemini OCR AI (`processContractOCR`), tự động trích xuất Số HĐ, Ngày ký, Thời hạn hiệu lực, Điều khoản thanh toán/giao nhận và Bảng chi tiết sản phẩm cam kết.
   - Đối chiếu giá hợp đồng với Bảng giá 2026 (`reconciledOcrProducts`, `selectedContractReconciled`): Tự động phát hiện giá khớp (`exact`), cao hơn (`higher`), thấp hơn (`lower`), hoặc sản phẩm mới (`new`).
2. **Tra cứu Bảng Giá 2026 (`findPriceRecord` & `PricingCombobox.tsx`)**:
   - `findPriceRecord` trong `business-logic.ts` thực hiện tra cứu theo mức độ ưu tiên: Khách hàng -> Địa điểm giao hàng -> Mã SKU chính xác -> Thuật toán chấm điểm trùng khớp mờ (Fuzzy Token Overlap Score).

#### Điểm phát hiện & Rủi ro:
- **Lỗi ánh xạ trường Địa Điểm Giao Hàng trong `findPriceRecord`**:
  - Tại `src/lib/business-logic.ts` dòng 164:
    ```typescript
    const pLoc = normalizeString(p["Địa điểm giao hàng"] || p["Địa chỉ giao hàng"] || "");
    ```
  - Tuy nhiên, trong `PRICING_DATA` (`src/data.ts` dòng 108), tiêu đề cột địa điểm giao là `"Giao đến"` (VD: "Thăng Long", "Thanh Hoá"). Do đó, `findPriceRecord` bỏ lỡ trường `"Giao đến"` khi lọc giá theo điểm giao.
- **Thứ tự ưu tiên Đơn Giá Bán Mới**:
  - Tại `src/lib/business-logic.ts` dòng 238:
    ```typescript
    export const getSellPriceFromRecord = (record: any): number => {
      if (!record) return 0;
      return parseNumber(record['Đơn giá bán']) || parseNumber(record['Giá bán']) || parseNumber(record['Đơn giá bán mới']) || 0;
    };
    ```
  - Nếu sản phẩm có `"Đơn giá bán mới"` (giá chiết khấu hoặc đàm phán lại đã cập nhật), nhưng cột `"Đơn giá bán"` cũ vẫn có giá trị, hàm luôn lấy giá cũ và bỏ qua `"Đơn giá bán mới"`.
- **Kiểm tra thời hạn hiệu lực của Bảng Giá**:
  - `findPriceRecord` hiện chưa đối soát trường `"Ngày bắt đầu"` và `"Ngày kết thúc"` với ngày đặt hàng của PO, dẫn đến nguy cơ áp dụng bảng giá đã hết hạn nếu có nhiều phiên bản giá cùng mã sản phẩm.

---

### Bước 3: Tiếp Nhận Đơn Hàng PO (PO Intake & Dual PO Dispatch)
**Mã nguồn khảo sát**: `src/components/WorkflowView.tsx` (Bước 1 & Bước 2), `src/components/PODetailModal.tsx`, `src/components/DualPODocumentModal.tsx`, `src/components/OCRView.tsx`.

#### Cơ chế hoạt động:
1. **Nhập PO Đa Kênh (OCR Scan & Thủ công)**:
   - OCR tự động nhận diện Số PO, Ngày đặt, Khách hàng, và danh sách sản phẩm.
   - Bảng Bắt Cặp Giá (`PriceReconciliationPanel.tsx`): Tự động điền đơn giá bán/đơn giá nhập từ Bảng giá 2026, cho phép người dùng chọn lại mã giá hoặc điều chỉnh đơn giá đàm phán riêng.
   - Tính toán tài chính dòng PO: `Thành tiền dòng = Đơn giá bán x Số lượng`, `Giá vốn COGS = Đơn giá nhập x Số lượng`, `Lợi nhuận = Thành tiền - Giá vốn`.
2. **Cơ chế Dual PO (Xuất song song 2 Đơn Hàng)**:
   - `DualPODocumentModal.tsx` sinh tự động 2 chứng từ chuẩn mực:
     - **PO 1 (Tâm Sen -> Khách hàng)**: Đơn giá bán SO theo hợp đồng/báo giá khách hàng.
     - **PO 2 (An Việt Phát -> Nhà cung cấp)**: Đơn giá mua PO theo hợp đồng nguyên tắc nhà máy sản xuất (YFY, Tuấn Bằng, Thuận Hòa Phát,...).
   - Tự động chuyển đổi số tiền thành chữ tiếng Việt (`numberToWordsVN`) và hỗ trợ xuất bản in / PDF chuẩn khổ A4.

#### Điểm phát hiện & Rủi ro:
- **Thiếu Cảnh Báo Trùng Số PO trong `WorkflowView.tsx` & `OCRView.tsx`**:
  - Tại `App.tsx` trong `TableView` (dòng 1414, 2059), hệ thống đã có logic `isDuplicatePO` để chặn tạo đơn trùng.
  - Tuy nhiên, trong `WorkflowView.tsx` (`handleSavePO`, dòng 623) và `OCRView.tsx` (`executeSaveToSystem`, dòng 472), khi lưu PO mới, hệ thống **chưa kiểm tra** xem số đơn hàng `newPoNumber` đã tồn tại trong `poHeaders` hay chưa. Điều này có thể dẫn đến việc vô tình ghi đè (overwrite) PO Header cũ và tạo ra các mã chi tiết dòng `D_xxx` phân mảnh.
- **Khoảng trắng trong Mã Đơn Hàng**:
  - Dữ liệu `data.ts` có một số đơn hàng chứa dấu cách đầu chuỗi (như `" 26/KHVT/0547"`, `" 26/KHVT/0600"`). Cần đảm bảo hàm lưu đơn luôn thực hiện `.trim()` triệt để.

---

### Bước 4: Lập Kế Hoạch Điều Độ Giao Hàng (Delivery Dispatch Planning)
**Mã nguồn khảo sát**: `src/components/DeliveryPlanView.tsx`, `src/components/LogisticsHubView.tsx`, `src/components/MasterCalendarView.tsx`, `src/components/UnifiedCalendar.tsx`.

#### Cơ chế hoạt động:
1. **Lập Kế Hoạch & Chia Đợt Giao Hàng (Multi-Batch Split)**:
   - Theo dõi sản lượng cần giao của từng dòng PO: `qtyRemainingToPlan = Math.max(0, qtyOrdered - qtyPlanned)`.
   - Cho phép chia tách 1 dòng PO lớn thành nhiều đợt giao hàng định kỳ (VD: đợt 1 sau 7 ngày, đợt 2 sau 14 ngày) qua modal `handleOpenMultiBatch`.
2. **Điều phối Lịch Vận Tải (Logistics Calendar)**:
   - Tích hợp `FullCalendar` hiển thị lịch giao hàng trực quan theo tuần/tháng, lọc theo Nhà xe vận chuyển (`Song Dũng`, `YFY`,...).
   - Tích hợp 1-click thêm sự kiện vào **Google Calendar** qua Google Calendar API / Deep Link URL (`generateGoogleCalendarUrl`).

#### Điểm phát hiện & Rủi ro:
- **Không nhất quán Tên Trường Dữ Liệu Kế Hoạch Giao Hàng**:
  - Trong `src/data.ts` (`DELIVERY_PLAN_DATA`), tiêu đề cột là: `Mã kế hoạch, Đơn hàng, Sản phẩm, Khách hàng, Ngày dự kiến, Số lượng cần giao, Trạng thái`.
  - Trong `DeliveryPlanView.tsx`: sử dụng `p['Số lượng cần giao']` và `p['Ngày dự kiến']`.
  - Trong `WorkflowView.tsx` (dòng 969-982): khi tạo mới lại lưu các trường `p['Kế hoạch ID']`, `p['Số lượng kế hoạch']`, `p['Ngày giao kế hoạch']`.
  - Mặc dù `WorkflowView.tsx` đã bổ sung thêm `Số lượng cần giao: plannedQty` để tương thích, cần chuẩn hóa toàn bộ các component đọc chung một bộ key thống nhất (`Số lượng cần giao` / `Ngày dự kiến`).

---

### Bước 5: Phiếu Xuất Kho (PXK / Delivery), Đối Soát & Công Nợ
**Mã nguồn khảo sát**: `src/components/DeliveryView.tsx`, `src/components/LogisticsHubView.tsx` (Sub-tab Reconcile), `src/components/PriceReconciliationPanel.tsx`, `src/lib/business-logic.ts`.

#### Cơ chế hoạt động:
1. **Xuất Kho & Ghi Nhận Chuyến Hàng Thực Tế**:
   - Tạo phiếu xuất kho PXK kèm Biên bản giao nhận (BBBG), ghi nhận người ký nhận, đơn vị vận chuyển, trạng thái sự cố hàng hỏng/lỗi.
   - Tự động đồng bộ số lượng đã giao lũy kế (`Đã giao`) về dòng PO (`po_lines`) và cập nhật trạng thái hoàn thành (`Hoàn thành = 1`) khi giao đủ 100%.
2. **Đối Soát 3 Chiều & Phát Hiện Lệch Số (3-Way Logistics Reconciliation)**:
   - Đối chiếu: **1. Đặt hàng (PO) vs 2. Kế hoạch điều độ (Plan) vs 3. Thực tế xuất kho (PXK)**.
   - Phân loại rõ ràng 4 trạng thái:
     - `Khớp 100%`: Giao đủ số lượng đặt.
     - `Giao thiếu`: Giao chưa đủ số lượng đặt.
     - `Giao thừa`: Giao vượt số lượng đặt (VD: PO đặt 5.000 kg, thực giao 5.244 kg -> Lệch +244 kg).
     - `Chưa giao`: Chưa có chuyến xe xuất kho.
3. **Đối Soát Công Nợ Phải Thu / Phải Trả**:
   - Tự động tổng hợp công nợ phải thu theo từng Khách hàng (`receivablesByCustomer`) và công nợ phải trả theo từng Nhà cung cấp (`payablesBySupplier`) dựa trên các phiếu giao có `AccountingStatus !== "Đã thu tiền"` / `"Đã chi tiền"`.

#### Điểm phát hiện & Rủi ro:
- **Cắt giảm số âm khi tính Số Lượng Còn Lại**:
  - Tại `src/App.tsx` (dòng 283 và dòng 335):
    ```typescript
    const remaining = Math.max(0, ordered - totalDelivered);
    ```
  - Việc dùng `Math.max(0, ...)` làm mất thông tin giao thừa (over-delivery). Khi khách hàng nhận thừa (như đơn hàng `1/TS/26` nhận 5.244 kg so với 5.000 kg đặt), cột `Còn lại` bị ép về `0` thay vì `-244`, làm giảm khả năng kiểm soát hao hụt/giao thừa ở chế độ xem bảng phẳng.
- **Xóa nhầm trường `Status` khi lưu Firestore**:
  - Tại `src/App.tsx` dòng 436-442 trong `handleUpdateToFirestore`:
    `transientFields` bao gồm `'Status'`. Tuy nhiên, trong `DELIVERY_DATA` của `src/data.ts`, tiêu đề cột trạng thái thực tế là `"Status"` (với các giá trị `"Hoàn thành"`, `"Đang tiến hành"`). Khi người dùng chỉnh sửa một dòng phiếu giao và gọi `handleUpdateToFirestore`, trường `"Status"` bị xóa khỏi payload lưu vào Firestore.

---

## 2. Kiểm Tra Thành Phần Giao Diện (UI/UX) & Điều Hướng (Navigation)

1. **2-Way Deep Linking (Điều Hướng Chéo 2 Chiều)**:
   - Điều hướng từ PO Lines / Delivery sang Khách hàng (`handleNavigateToCustomer`) và Nhà cung cấp (`handleNavigateToSupplier`) hoạt động mượt mà, tự động lọc và mở modal chi tiết thực thể.
   - Điều hướng từ Khách hàng / Nhà cung cấp sang Danh bạ (`handleNavigateToContact`) hoạt động chuẩn xác.
2. **Mac Traffic Lights & Responsive Header**:
   - Hệ thống traffic lights phong cách macOS Sequoia (nút Đỏ: Đóng/Trở về Dashboard; nút Vàng: Thu gọn Sidebar; nút Xanh: Toàn màn hình) phản hồi tốt, có phím tắt và tooltip hướng dẫn.
3. **State Desynchronization across Tabs**:
   - Nhờ cơ chế `TSGDataEngine` (`dbEngine.ts`) kết hợp `BroadcastChannel` / `window.storage` event bus, khi dữ liệu thay đổi ở một tab (hoặc thêm PO ở WorkflowView), các view khác (Dashboard, PO Lines, LogisticsHub) nhận event và cập nhật dữ liệu tức thì không cần reload.

---

## 3. Bảng Tổng Hợp Lỗi Phát Hiện & Chiến Lược Khắc Phục (Bug Matrix & Strategy)

| STT | Vị Trí File & Dòng | Hiện Tượng / Lỗ Hổng | Đánh Giá Tác Động | Chiến Lược Khắc Phục Đề Xuất |
|---|---|---|---|---|
| **1** | `src/lib/business-logic.ts`<br>Dòng 164 | `findPriceRecord` tìm kiếm trường địa điểm qua `p["Địa điểm giao hàng"]` nhưng trong `PRICING_DATA` cột có tên là `"Giao đến"`. | **Cao**: Không khớp được mã giá theo địa điểm giao hàng (VD: Thăng Long vs Thanh Hóa). | Bổ sung `p["Giao đến"]` vào chuỗi tìm kiếm địa điểm: `p["Giao đến"] \|\| p["Địa điểm giao hàng"] \|\| ...`. |
| **2** | `src/lib/business-logic.ts`<br>Dòng 238 | `getSellPriceFromRecord` ưu tiên `'Đơn giá bán'` trước `'Đơn giá bán mới'`. | **Trung bình**: Bỏ qua giá mới đàm phán nếu giá cũ vẫn tồn tại. | Đổi thứ tự ưu tiên: `parseNumber(record['Đơn giá bán mới']) \|\| parseNumber(record['Đơn giá bán']) \|\| ...`. |
| **3** | `src/components/WorkflowView.tsx`<br>Dòng 623-636 | `handleSavePO` không kiểm tra số PO đã tồn tại trước khi lưu vào `po_headers`. | **Cao**: Nguy cơ ghi đè đơn hàng PO đã có và gây xung đột dữ liệu dòng PO. | Thêm kiểm tra `combinedPoHeadersData.some(h => normalizeString(h["Đơn hàng"]) === normalizeString(newPoNumber))` và hiển thị cảnh báo `toast.error` kèm yêu cầu xác nhận. |
| **4** | `src/components/OCRView.tsx`<br>Dòng 472-515 | `executeSaveToSystem` không kiểm tra trùng lặp `poHeaders` khi lưu đơn hàng bóc tách từ OCR. | **Cao**: Ghi đè PO Header khi người dùng quét lại file hóa đơn/PO cũ. | Bổ sung kiểm tra trùng lặp số đơn hàng với `poHeaders` prop và hiển thị modal cảnh báo người dùng. |
| **5** | `src/App.tsx`<br>Dòng 437-442 | `handleUpdateToFirestore` xóa trường `'Status'` trong danh sách `transientFields`. | **Cao**: Làm mất cột trạng thái của phiếu giao hàng (`DELIVERY_DATA` dùng header `Status`). | Giữ lại `'Status'` cho collection `deliveries`, hoặc đổi tên trường tạm tính sang `_runtimeStatus`. |
| **6** | `src/App.tsx`<br>Dòng 283, 335 | Sử dụng `Math.max(0, ordered - totalDelivered)` làm triệt tiêu số âm của trường hợp giao thừa. | **Trung bình**: Không hiển thị được số lượng giao vượt định mức (-244 kg). | Giữ nguyên số âm để thể hiện lượng chênh lệch (variance), chỉ format hiển thị với màu sắc cảnh báo riêng. |
| **7** | `src/components/DeliveryPlanView.tsx`<br>vs `src/components/WorkflowView.tsx` | Không đồng nhất tên trường kế hoạch (`Số lượng cần giao` / `Ngày dự kiến` vs `Số lượng kế hoạch` / `Ngày giao kế hoạch`). | **Trung bình**: Tiềm ẩn lỗi đọc giá trị `undefined` khi truyền giữa các màn hình. | Chuẩn hóa toàn bộ các component dùng bộ đôi song song `{ 'Số lượng cần giao': qty, 'Số lượng kế hoạch': qty, 'Ngày dự kiến': date, 'Ngày giao kế hoạch': date }`. |
| **8** | `src/components/ContactView.tsx`<br>Dòng 172-184 | Dữ liệu Tasks, Projects, Activities của liên hệ chỉ lưu ở `localStorage`. | **Thấp**: Không đồng bộ giữa các máy tính khác nhau. | Chuyển sang lưu qua `dbEngine.save('tasks', ...)` và `dbEngine.save('projects', ...)` để đồng bộ Firestore. |

---

## 4. Kết Luận
Toàn bộ kiến trúc 5 bước của hệ thống **TSG Business OS** được thiết kế bài bản, logic liên kết 13 bảng dữ liệu chặt chẽ và giao diện trực quan. Sau khi khắc phục các điểm bất cập được chỉ ra trong bảng ma trận trên, hệ thống sẽ đạt độ chính xác 100% về cả dữ liệu vận hành và tính toán tài chính.
