# HANDOFF REPORT: HOÀN TẤT CHUẨN HÓA TÀI CHÍNH & LIÊN KẾT 13 BẢNG DỮ LIỆU
**Agent:** Worker 1 (Financial Calculations & 13 Data Tables Specialist)  
**Parent Orchestrator:** `b0829545-05ed-4483-a894-b3b99bbef5ff`  
**Handoff Type:** Hard (Implementation Complete & Verified)  
**Working Directory:** `/Users/Nguyentam/antigravity/TSG-Business---New/.agents/worker_1_finance`

---

## 1. OBSERVATION (Quan sát trực tiếp & Thay đổi mã nguồn)

1. **`src/lib/business-logic.ts`**:
   - Nâng cấp hàm `parseNumber`:
     * Xử lý số âm kế toán `(100)` $\rightarrow$ `-100` và dấu trừ `-1.800` $\rightarrow$ `-1800`.
     * Tự động loại bỏ ký hiệu tiền tệ (`₫`, `đ`, `$`, `VND`, `vnd`), phần trăm `%`, và khoảng trắng.
     * Xử lý định dạng phân cách hàng nghìn bằng dấu chấm kiểu Việt Nam (`718.062.120,00`, `1.800`, `10.861`) và kiểu quốc tế (`718,062,120.00`, `1,800`).
     * Xử lý số thập phân tiếng Việt có dấu phẩy (`2,5`, `35,63%`).
     * An toàn với `null`, `undefined`, chuỗi rỗng và trả về `0`.
   - Nâng cấp `scoreProductMatch` và `findPriceRecord`:
     * Bổ sung so khớp trực tiếp theo mã giá bán / mã giá (`Mã giá bán`, `Mã giá`, `Gsp_XXX`) ngay từ bước 0 và bước 3.
     * Bổ sung so khớp địa điểm / điểm nhận hàng trên các trường `Giao đến`, `Địa điểm giao hàng`, `Địa chỉ giao hàng`.
     * Hỗ trợ tìm kiếm mở rộng toàn bộ bảng giá khi bộ lọc theo khách hàng không tìm thấy kết quả.
   - Nâng cấp `getBuyPriceFromRecord`:
     * Bổ sung đầy đủ chuỗi ưu tiên giá vốn: `Đơn giá mua mới` $\rightarrow$ `Đơn giá mua` $\rightarrow$ `Giá nhập` $\rightarrow$ `Giá mua` $\rightarrow$ `Giá AVP` $\rightarrow$ `Giá vốn` $\rightarrow$ `Giá trị vốn`.
     * Đảm bảo các sản phẩm `Gsp_094`, `Gsp_142`, `Gsp_148` nhận đúng Giá AVP thay vì trả về `0`.
   - Nâng cấp `getSellPriceFromRecord`:
     * Chuỗi ưu tiên: `Đơn giá bán mới` $\rightarrow$ `Đơn giá bán` $\rightarrow$ `Giá bán`.
   - Nâng cấp `calculatePOLineFinances` và `calculateDeliveryFinances`:
     * Bổ sung cơ chế suy luận đơn giá từ `Thành tiền / Số lượng` khi đơn giá là 0.
     * Bọc kiểm tra `isNaN` trên toàn bộ các giá trị đầu ra `revenue`, `profit`, `margin` để triệt tiêu hoàn toàn `NaN`.

2. **`src/components/DeliveryPlanView.tsx`, `src/components/DeliveryView.tsx`, `src/components/MasterCalendarView.tsx`**:
   - Xóa bỏ toàn bộ các khai báo cục bộ lỗi của hàm `parseNumber` (chỉ xử lý `replace(/,/g, '')`).
   - Import trực tiếp `parseNumber` từ `../lib/business-logic`.

3. **`src/components/PODetailModal.tsx`**:
   - Import `parseNumber` từ `../lib/business-logic`.
   - Thay thế toàn bộ các phép tính `parseFloat(String(...).replace(/,/g, ''))` và biểu thức lỗi `isNaN(qty || price)` tại dòng 221-224 và trong bảng chi tiết bằng `parseNumber`.
   - Đảm bảo tính toán `totalOrderedQty`, `totalDeliveredQty`, `totalAmount`, `completionRate` và `chartData` luôn chính xác 100%, không bị `NaN`.

4. **`src/data.ts`**:
   - Chuẩn hóa xóa bỏ toàn bộ khoảng trắng dư thừa trong mã đơn hàng (`" 26/KHVT/0547"`, `" 26/KHVT/0600"` $\rightarrow$ `"26/KHVT/0547"`, `"26/KHVT/0600"`) tại `CUSTOMER_DATA`, `PO_LINES_DATA`, `PO_HEADER_DATA`, `DELIVERY_DATA`.

---

## 2. LOGIC CHAIN (Chuỗi lập luận từ Quan sát đến Kết quả)

1. **Chuẩn hóa `parseNumber` $\rightarrow$ Thống nhất toán học trên toàn hệ thống**:
   - Tất cả dữ liệu đầu vào (từ bảng CSV trong `data.ts`, OCR trích xuất, hoặc người dùng nhập) dù ở định dạng số tiếng Việt (`1.800`, `718.062.120,00`), quốc tế hay phần trăm đều được chuyển đổi thành số thực JavaScript chuẩn xác.
2. **Khớp mã giá trực tiếp & Giá AVP $\rightarrow$ Giá vốn và Tỷ suất lợi nhuận Margin % chính xác**:
   - Việc `findPriceRecord` nhận diện `Gsp_XXX` trực tiếp giúp dòng PXK giao hàng và PO Lines tìm thấy ngay dòng giá tương ứng mà không bị sai lệch.
   - Fallback `Giá AVP` giúp `Gsp_094`, `Gsp_142`, `Gsp_148` có giá vốn hợp lệ (ví dụ `Gsp_094` có giá AVP 99.000đ), ngăn chặn hiện tượng Margin bị tính ảo thành 100%.
3. **Triệt tiêu lỗi `isNaN` trong `PODetailModal` $\rightarrow$ Giao diện chi tiết PO ổn định**:
   - Phép tính tổng tiền PO không còn bị chuyển thành `NaN` khi gặp trường đơn giá hoặc số lượng trống.
4. **Xóa khoảng trắng mã PO $\rightarrow$ 360° Data Graph liên kết hoàn hảo**:
   - Bộ lọc `.filter(d => d['Đơn hàng'] === '26/KHVT/0547')` và `26/KHVT/0600` khớp 100% giữa PO Header (2 POs), PO Lines (4 lines) và Delivery Data (5 deliveries).

---

## 3. CAVEATS (Phạm vi & Giả định)

- **Bảo toàn các thành phần khác**: Không thay đổi logic OCR hay UI ngoài phạm vi các tệp được phân công.
- **Không có cảnh báo hay lỗi kiểu**: Toàn bộ các thay đổi tuân thủ nghiêm ngặt hệ thống type của TypeScript.

---

## 4. CONCLUSION (Kết luận hoàn thành nhiệm vụ)

- Toàn bộ 4 nhóm yêu cầu của Worker 1 đã được triển khai đầy đủ và kiểm thử thành công 100%.
- Không còn bất kỳ hàm `parseNumber` cục bộ lỗi nào trong các views được giao.
- Hệ thống sẵn sàng cho các phân hệ tiếp theo (Worker 2 - OCR & Drive Storage, Worker 3 - 5-Step Workflow).

---

## 5. VERIFICATION METHOD (Phương pháp kiểm chứng)

1. **Kiểm tra biên dịch TypeScript**:
   ```bash
   npx tsc --noEmit
   ```
   *Kết quả*: Exit code 0, 0 lỗi.

2. **Kiểm thử chuyên sâu tính toán tài chính (`scripts/test-finance.ts`)**:
   ```bash
   npx tsx scripts/test-finance.ts
   ```
   *Kết quả thực tế*:
   - 17/17 test case `parseNumber` PASS (bao gồm `718.062.120,00`, `1.800`, `35.63%`, `(50.000)`, `250.000 ₫`).
   - `Gsp_094` (Giá AVP: 99.000đ), `Gsp_142` (Giá AVP: 77.313,6đ), `Gsp_148` (Giá AVP: 80.381,6đ) lấy đúng giá vốn.
   - `calculatePOLineFinances` và `calculateDeliveryFinances` tính doanh thu, lợi nhuận, margin % chính xác, không có NaN.
   - PO `26/KHVT/0547` (3 lines, 1 delivery) và PO `26/KHVT/0600` (1 line, 4 deliveries) liên kết chính xác 100%.

3. **Kiểm tra bản Build Production**:
   ```bash
   npm run build
   ```
   *Kết quả*: Vite build thành công trong 4.72s, esbuild bundle server.cjs hoàn tất.
