# HANDOFF REPORT: KIỂM TOÁN TÀI CHÍNH & 13 BẢNG DỮ LIỆU TSG BUSINESS OS
**Agent:** Explorer 1 (Financial Calculations & 13 Data Tables Specialist)  
**Parent Orchestrator:** `b0829545-05ed-4483-a894-b3b99bbef5ff`  
**Handoff Type:** Hard (Complete Investigation)  
**Working Directory:** `/Users/Nguyentam/antigravity/TSG-Business---New/.agents/explorer_1_finance`

---

## 1. OBSERVATION (Quan sát trực tiếp & Dẫn chứng mã nguồn)

1. **Định nghĩa hàm `parseNumber` cục bộ bị lỗi tại 3 components**:
   - `src/components/DeliveryPlanView.tsx` (Dòng 31–37)
   - `src/components/DeliveryView.tsx` (Dòng 51–57)
   - `src/components/MasterCalendarView.tsx` (Dòng 40–46)
   - **Mã nguồn trích dẫn**:
     ```ts
     const parseNumber = (val: any): number => {
       if (val == null) return 0;
       if (typeof val === 'number') return val;
       const cleaned = String(val).replace(/,/g, '').trim();
       const parsed = parseFloat(cleaned);
       return isNaN(parsed) ? 0 : parsed;
     };
     ```
   - **Hành vi quan sát**: `parseFloat("1.800")` trả về `1.8` thay vì `1800`. Phân tách hàng nghìn bằng dấu chấm tiếng Việt bị hiểu sai thành số thập phân.

2. **Hàm tra cứu giá vốn `getBuyPriceFromRecord` bỏ sót `Giá AVP`**:
   - `src/lib/business-logic.ts` (Dòng 241–244):
     ```ts
     export const getBuyPriceFromRecord = (record: any): number => {
       if (!record) return 0;
       return parseNumber(record['Đơn giá mua']) || parseNumber(record['Giá nhập']) || parseNumber(record['Đơn giá mua mới']) || 0;
     };
     ```
   - Trong `src/data.ts` (Dòng 130, 160, 161), các mã `Gsp_094`, `Gsp_142`, `Gsp_148` có `Đơn giá mua` rỗng nhưng có `Giá AVP` (`"99,000.00"`, `"77,313.60"`, `"80,381.60"`). Kết quả là `getBuyPriceFromRecord` trả về `0`, dẫn đến tính lợi nhuận gộp thành 100% doanh thu.

3. **Hàm `findPriceRecord` không so khớp trực tiếp `Mã giá bán` (`Gsp_XXX`)**:
   - `src/lib/business-logic.ts` (Dòng 127–195): Chỉ tìm kiếm theo `p["Mã sản phẩm"] || p["Mã hàng"]`.
   - Trong `src/data.ts` (Bảng `DELIVERY_DATA` L220–268), cột `Mã sản phẩm` thực chất lưu các mã giá như `Gsp_117`, `Gsp_123`, `Gsp_093`. Khi gọi `findPriceRecord` với `sku = "Gsp_117"`, việc so khớp mã sản phẩm thất bại và phải rơi vào fuzzy search theo tên.

4. **Lỗi logic biểu thức `isNaN(qty || price)` trong `PODetailModal.tsx`**:
   - `src/components/PODetailModal.tsx` (Dòng 221–224):
     ```ts
     relatedPoLines.forEach(line => {
       const qty = parseFloat(String(line['Số lượng'] || '0').replace(/,/g, ''));
       const price = parseFloat(String(line['Đơn giá bán'] || '0').replace(/,/g, ''));
       totalOrderedQty += isNaN(qty) ? 0 : qty;
       totalAmount += isNaN(qty || price) ? 0 : (qty * price);
     });
     ```
   - **Hành vi quan sát**: Trong JS, nếu `qty = 10` và `price = NaN`, `qty || price` trả về `10`. `isNaN(10)` là `false`, làm phép tính `10 * NaN` diễn ra và biến `totalAmount` thành `NaN`.

5. **Khoảng trắng dư thừa trong mã đơn hàng của tập dữ liệu mẫu**:
   - `src/data.ts` (Dòng 191–194, 216–217, 221, 264–267): Có các chuỗi mã PO `" 26/KHVT/0547"`, `" 26/KHVT/0600"` có dấu cách ở đầu, gây gãy liên kết khi so sánh chuỗi bằng `===`.

---

## 2. LOGIC CHAIN (Chuỗi lập luận từ Quan sát đến Kết luận)

1. **Từ Quan sát 1 $\rightarrow$ Lỗi tính toán tiến độ & điều độ giao hàng**:
   - Do 3 components `DeliveryPlanView`, `DeliveryView`, `MasterCalendarView` sử dụng phiên bản `parseNumber` rút gọn chỉ xóa dấu phẩy mà không xử lý dấu chấm tiếng Việt, bất kỳ dữ liệu nào có định dạng hàng nghìn kiểu `1.800` (như trong bảng PO Lines L165) đều bị parse thành `1.8`, dẫn đến số lượng cần giao, số lượng đã giao và doanh thu bị tính sai lệch nghiêm trọng.

2. **Từ Quan sát 2 & 3 $\rightarrow$ Lỗi tính toán COGS & Doanh thu trong PXK**:
   - Khi dòng giao hàng gọi `calculateDeliveryFinances`, việc truyền mã `Gsp_117` không được `findPriceRecord` khớp trực tiếp theo mã giá. Đồng thời, các sản phẩm như `Gsp_094` có `Đơn giá mua` rỗng bị trả về giá vốn bằng `0`, làm cho tỷ suất lợi nhuận Margin % nhảy lên 100%.

3. **Từ Quan sát 4 $\rightarrow$ Nguy cơ sập giao diện hiển thị tổng giá trị đơn hàng**:
   - Lỗi đánh giá điều kiện `isNaN(qty || price)` khiến bất kỳ dòng PO nào có đơn giá bán bị lỗi định dạng sẽ làm toàn bộ thẻ tổng tiền PO hiển thị `NaN ₫`.

4. **Từ Quan sát 5 $\rightarrow$ Đứt gãy luồng 360° Data Graph**:
   - Việc mã đơn hàng có khoảng trắng `" 26/KHVT/0547"` khiến các câu lệnh lọc `.filter(d => d['Đơn hàng'] === poNum)` không tìm thấy dòng giao hàng tương ứng của PO nếu `poNum` được chuẩn hóa thành `"26/KHVT/0547"`.

---

## 3. CAVEATS (Phạm vi chưa kiểm tra & Giả định)

1. **Giả định về Bảng giá AVP**:
   - Trong mô hình 3 tầng giá của TSG (Giá nhập NCC $\rightarrow$ Giá AVP $\rightarrow$ Giá bán Khách hàng), khi `Đơn giá mua` từ NCC chưa được cập nhật trong Bảng giá, việc fallback sang `Giá AVP` là giải pháp an toàn nhất để tránh giá vốn bằng 0.
2. **Dữ liệu trên Cloud Firestore**:
   - Dữ liệu cục bộ trong `src/data.ts` là fallback khi Firestore rỗng. Các bản ghi đã lưu trên Firestore từ các phiên trước có thể chứa dữ liệu chuỗi đã định dạng, do đó toàn bộ các hàm đọc dữ liệu phải luôn sử dụng `parseNumber` thông minh.

---

## 4. CONCLUSION (Kết luận & Đề xuất hành động cho Implementer)

1. **Cập nhật `src/lib/business-logic.ts`**:
   - Bổ sung kiểm tra `Mã giá bán` / `Mã giá` trực tiếp trong `findPriceRecord`.
   - Bổ sung `Giá AVP`, `Giá vốn`, `Giá mua` vào `getBuyPriceFromRecord`.
   - Bổ sung fallback suy luận đơn giá từ `Thành tiền dòng / Số lượng` trong `calculatePOLineFinances` khi đơn giá bán = 0.
2. **Xóa bỏ các hàm `parseNumber` cục bộ**:
   - Chuyển `DeliveryPlanView.tsx`, `DeliveryView.tsx`, `MasterCalendarView.tsx` sang dùng `parseNumber` từ `src/lib/business-logic.ts`.
3. **Sửa lỗi tính tổng an toàn trong `PODetailModal.tsx`**:
   - Thay thế hoàn toàn phép tính `isNaN(qty || price)` bằng `parseNumber`.
4. **Chuẩn hóa dữ liệu `src/data.ts`**:
   - Trim bỏ khoảng trắng đầu chuỗi của các mã PO `"26/KHVT/0547"` và `"26/KHVT/0600"`.

---

## 5. VERIFICATION METHOD (Phương pháp kiểm chứng độc lập)

1. **Kiểm tra biên dịch mã nguồn**:
   ```bash
   npx tsc --noEmit
   ```
   *Yêu cầu*: 0 lỗi TypeScript.
2. **Kiểm thử độc lập hàm `parseNumber` với các định dạng số**:
   ```ts
   // Test cases cần đạt:
   parseNumber("718.062.120,00") === 718062120
   parseNumber("718,062,120.00") === 718062120
   parseNumber("1.800") === 1800
   parseNumber("1,800") === 1800
   parseNumber("35.63%") === 35.63
   parseNumber(null) === 0
   parseNumber(undefined) === 0
   parseNumber("") === 0
   ```
3. **Kiểm tra tính toán COGS & Margin cho `Gsp_094`, `Gsp_142`, `Gsp_148`**:
   - Xác nhận `getBuyPriceFromRecord` lấy được giá AVP (không trả về 0), đảm bảo Margin % tính ra đúng thực tế thay vì 100%.
4. **Kiểm tra khớp nối PO và Delivery**:
   - Xác nhận PO `26/KHVT/0547` và `26/KHVT/0600` hiển thị đầy đủ các đợt giao hàng PXK và tính đúng tiến độ %.
