# BÁO CÁO PHÂN TÍCH CHUYÊN SÂU: 13 BẢNG DỮ LIỆU & CÔNG THỨC TÀI CHÍNH TSG BUSINESS OS
**Chuyên viên:** Explorer 1 (Financial Calculations & 13 Data Tables Specialist)  
**Thời gian kiểm tra:** 2026-08-25  
**Phạm vi:** Kiểm tra toàn bộ 13 bảng dữ liệu, luồng liên kết quan hệ (Foreign Keys), các công thức tài chính (Doanh thu, Giá vốn COGS, Lợi nhuận gộp, Biên lợi nhuận %), chuẩn hóa xử lý số tiếng Việt, và cơ chế tra cứu giá (Pricing Lookup Fallbacks).

---

## 1. TỔNG QUAN HỆ THỐNG 13 BẢNG DỮ LIỆU & MÔ HÌNH QUAN HỆ (360° DATA GRAPH)

Hệ thống TSG Business OS quản trị 13 bảng dữ liệu cốt lõi vận hành theo kiến trúc Local-First Reactive Data Engine (`src/lib/dbEngine.ts`) kết hợp Cloud Firestore Sync (`src/hooks/useFirestoreCollection.ts`):

```
                       ┌───────────────────────┐
                       │     CustomerData      │ (Khách hàng)
                       └───────────┬───────────┘
                                   │ 1:N
           ┌───────────────────────┼───────────────────────┐
           ▼                       ▼                       ▼
┌─────────────────────┐ ┌─────────────────────┐ ┌─────────────────────┐
│    ContractsData    │ │    POHeaderData     │ │     ContactData     │
│   (Hợp đồng 2026)   │ │  (Đơn hàng Header)  │ │  (Danh bạ nhân sự)  │
└──────────┬──────────┘ └──────────┬──────────┘ └──────────┬──────────┘
           │ 1:N                   │ 1:N                   │
           ▼                       ▼                       ▼
┌─────────────────────┐ ┌─────────────────────┐ ┌─────────────────────┐
│     PricingData     │ │     POLinesData     │ │   CommissionData    │
│  (Bảng giá 3 tầng)  │ │ (Chi tiết dòng đơn) │ │  (Hoa hồng chiết)   │
└──────────┬──────────┘ └──────────┬──────────┘ └─────────────────────┘
           │ 1:N                   │ 1:N
           ▼                       ▼
┌─────────────────────┐ ┌─────────────────────┐ ┌─────────────────────┐
│     ProductData     │◄┼─────────────────────┤ │  DeliveryPlanData   │
│ (Danh mục sản phẩm) │ │    DeliveryData     │ │(Kế hoạch giao hàng) │
└──────────┬──────────┘ │  (Phiếu xuất kho)   │ └──────────┬──────────┘
           │ 1:1        └──────────┬──────────┘            │
           ▼                       │                       │
┌─────────────────────┐            │                       │
│      SpecsData      │            ▼                       ▼
│ (Tiêu chuẩn TCKT)   │ ┌─────────────────────────────────────────────┐
└─────────────────────┘ │               FileStorageData               │
                        │    (Lưu trữ chứng từ Drive & OCR Scan)      │
                        └─────────────────────────────────────────────┘
```

### Chi tiết 13 Bảng & Định Danh Khóa Chính (Primary / Foreign Keys):

| STT | Tên Bảng (Collection) | Khóa chính (PK) | Khóa ngoại (FK) liên kết | File Schema / Dữ liệu gốc |
|:---|:---|:---|:---|:---|
| 1 | `CustomerData` (`customers`) | `Customer_ID` / `id` | Liên kết sang PO, Contracts, Pricing, Delivery, Commission | `src/data.ts` (L1-12) |
| 2 | `SupplierData` (`suppliers`) | `Mã nhà cung cấp` | Liên kết sang Pricing (`RP_Nhà cung cấp`), Products, Contracts, Delivery | `src/data.ts` (L14-37) |
| 3 | `ContactData` (`contacts`) | `ID` / `Tên_Công ty` | `Công ty` $\rightarrow$ `Customer_ID` / `Mã nhà cung cấp` | `src/data.ts` (L39-106) |
| 4 | `ContractsData` (`contracts`) | `id` / `contractNumber` | `partnerName` $\rightarrow$ Customers/Suppliers; `products` $\rightarrow$ Pricing | `src/types.ts`, `ContractsView.tsx` |
| 5 | `PricingData` (`pricing`) | `Mã giá bán` (`Gsp_XXX`) | `Mã sản phẩm` $\rightarrow$ Products; `RP_Khách hàng` $\rightarrow$ Customers; `RP_Nhà cung cấp` $\rightarrow$ Suppliers | `src/data.ts` (L108-161) |
| 6 | `ProductData` (`products`) | `Mã sản phẩm` | `Khách hàng` $\rightarrow$ Customers; `Mã Nhà Cung Cấp` $\rightarrow$ Suppliers; `Thông Số Sản Phẩm` $\rightarrow$ Specs (`Mã Spec`); `Giá 2026` $\rightarrow$ Pricing | `src/data.ts` (L270-404) |
| 7 | `SpecsData` (`specs`) | `Mã Spec` | `Mã sản phẩm` $\rightarrow$ Products; `Khách hàng` $\rightarrow$ Customers | `src/data.ts` (L411-494) |
| 8 | `POHeaderData` (`po_headers`) | `Đơn hàng` / `Số PO` | `Khách hàng` $\rightarrow$ Customers; `Chi tiết đơn hàng` $\rightarrow$ PO Lines STTs | `src/data.ts` (L197-218) |
| 9 | `POLinesData` (`po_lines`) | `STT` (`D_XXX`) / `Số đơn hàng_STT` | `Số đơn hàng` $\rightarrow$ PO Header; `Mã giá bán` $\rightarrow$ Pricing; `Mã của khách` $\rightarrow$ Products | `src/data.ts` (L163-195) |
| 10 | `DeliveryPlanData` (`delivery_plans`) | `Mã kế hoạch` (`KP-XXX`) | `Đơn hàng` $\rightarrow$ PO Header; `Sản phẩm` $\rightarrow$ Products / PO Lines; `Khách hàng` $\rightarrow$ Customers | `src/data.ts` (L406-410) |
| 11 | `DeliveryData` (`deliveries`) | `STT` / `Số PXK_STT` | `Chi tiết đơn hàng` $\rightarrow$ PO Lines (`STT`); `Đơn hàng` $\rightarrow$ PO Header; `Mã sản phẩm` $\rightarrow$ Pricing (`Mã giá bán`); `Nhà cung cấp` $\rightarrow$ Suppliers | `src/data.ts` (L220-268) |
| 12 | `CommissionData` (`commissions`) | `id` (`comm_XXX`) | `customerName` $\rightarrow$ Customers; `beneficiaryName` $\rightarrow$ Contacts; `poNumber` $\rightarrow$ PO Header | `src/components/CommissionView.tsx` |
| 13 | `FileStorageData` (`file_storage`) | `fileId` / `file_id` | Liên kết file lưu trữ Drive/Cloud với mã PO, PXK, Khách hàng | `src/lib/driveSync.ts` |

---

## 2. KIỂM TOÁN CÁC CÔNG THỨC TÀI CHÍNH TOÀN HỆ THỐNG

### 2.1. Bộ Công Thức Chuẩn Chuẩn Hóa
1. **Giá vốn (COGS - Cost of Goods Sold)**:
   $$\text{Giá vốn} = \text{Đơn giá mua (hoặc Đơn giá nhập)} \times \text{Số lượng}$$
2. **Doanh thu (Revenue)**:
   $$\text{Doanh thu} = \text{Đơn giá bán} \times \text{Số lượng}$$
3. **Lợi nhuận gộp (Gross Profit)**:
   $$\text{Lợi nhuận gộp} = \text{Doanh thu} - \text{Giá vốn} = (\text{Đơn giá bán} - \text{Đơn giá mua}) \times \text{Số lượng}$$
4. **Tỷ suất / Biên lợi nhuận (Gross Margin %)**:
   $$\text{Biên LN (\%)} = \begin{cases} \left( \dfrac{\text{Lợi nhuận gộp}}{\text{Doanh thu}} \right) \times 100 & \text{khi } \text{Doanh thu} > 0 \\ 0 & \text{khi } \text{Doanh thu} \le 0 \end{cases}$$

---

### 2.2. Chi Tiết Lỗi Logic & Điểm Bất Cập Phát Hiện Trong Mã Nguồn

#### 🔴 Vấn đề 1: Hàm `parseNumber` bị định nghĩa trùng lặp và thiếu sót tại 3 Components
- **Vị trí quan sát**:
  - `src/components/DeliveryPlanView.tsx` (Dòng 31–37)
  - `src/components/DeliveryView.tsx` (Dòng 51–57)
  - `src/components/MasterCalendarView.tsx` (Dòng 40–46)
- **Mã nguồn hiện tại**:
  ```ts
  const parseNumber = (val: any): number => {
    if (val == null) return 0;
    if (typeof val === 'number') return val;
    const cleaned = String(val).replace(/,/g, '').trim();
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  };
  ```
- **Hậu quả**:
  Khi dữ liệu đầu vào sử dụng định dạng số Việt Nam (dấu chấm phân tách hàng nghìn, e.g. `"1.800"`, `"1.440"`, `"718.062.120"`), `parseFloat("1.800")` trả về `1.8` thay vì `1800`! Làm sai lệch 1000 lần số lượng hoặc doanh thu khi lập kế hoạch giao hàng và điều độ lịch.
- **Giải pháp đề xuất**:
  Xóa bỏ 3 định nghĩa cục bộ này; nhập trực tiếp `parseNumber` từ `src/lib/business-logic.ts` (nơi đã có bộ phân tích thông minh xử lý cả chuẩn VN và US).

---

#### 🔴 Vấn đề 2: Lỗi Tra cứu Giá vốn `getBuyPriceFromRecord` khi `Đơn giá mua` rỗng
- **Vị trí quan sát**:
  - `src/lib/business-logic.ts` (Dòng 241–244)
  - `src/data.ts` (Dòng 130, 160, 161 đối với `Gsp_094`, `Gsp_142`, `Gsp_148`)
- **Mã nguồn hiện tại**:
  ```ts
  export const getBuyPriceFromRecord = (record: any): number => {
    if (!record) return 0;
    return parseNumber(record['Đơn giá mua']) || parseNumber(record['Giá nhập']) || parseNumber(record['Đơn giá mua mới']) || 0;
  };
  ```
- **Hậu quả**:
  Trong `PRICING_DATA`, các mã giá như `Gsp_094` (Lưỡi gà 96.5), `Gsp_142` (Lưỡi gà 75), `Gsp_148` (Lưỡi gà 78) có cột `Đơn giá mua` bị để trống (`,,`), nhưng có cột `Giá AVP` (e.g. `99,000.00`, `77,313.60`, `80,381.60`). Hàm hiện tại không kiểm tra `Giá AVP` hay `Giá vốn`, dẫn đến giá mua bị trả về `0`, làm lợi nhuận tính thành 100% doanh thu (sai lệch nghiêm trọng báo cáo tài chính).
- **Giải pháp đề xuất**:
  Nâng cấp `getBuyPriceFromRecord`:
  ```ts
  export const getBuyPriceFromRecord = (record: any): number => {
    if (!record) return 0;
    return parseNumber(record['Đơn giá mua']) || 
           parseNumber(record['Giá nhập']) || 
           parseNumber(record['Đơn giá mua mới']) || 
           parseNumber(record['Giá AVP']) || 
           parseNumber(record['Giá vốn']) || 
           parseNumber(record['Giá mua']) || 
           0;
  };
  ```

---

#### 🔴 Vấn đề 3: `findPriceRecord` không kiểm tra `Mã giá bán` (`Gsp_XXX`)
- **Vị trí quan sát**:
  - `src/lib/business-logic.ts` (Dòng 127–195)
  - `src/data.ts` (Bảng `DELIVERY_DATA` L220–268: cột `Mã sản phẩm` chứa `Gsp_117`, `Gsp_123`, `Gsp_093`...)
- **Mã nguồn hiện tại**:
  `findPriceRecord` chỉ kiểm tra `p["Mã sản phẩm"] || p["Mã hàng"]`.
- **Hậu quả**:
  Trong bảng `DELIVERY_DATA`, cột `Mã sản phẩm` thực chất lưu mã giá (`Gsp_117`, `Gsp_093`, `Gsp_090`). Khi `calculateDeliveryFinances` gọi `findPriceRecord(pricingData, { sku: "Gsp_117" })`, việc so khớp mã sản phẩm thất bại (do trong bảng giá `Mã sản phẩm` là `PS-15-I`, còn `Mã giá bán` mới là `Gsp_117`). Hệ thống phải rơi vào cơ chế so khớp mờ theo tên (fuzzy text match), dễ gây sai lệch nếu tên hàng có sự khác biệt nhỏ.
- **Giải pháp đề xuất**:
  Bổ sung bước so khớp trực tiếp `Mã giá bán` / `Mã giá` / `id` ngay ở đầu hàm `findPriceRecord`:
  ```ts
  // Priority 0: Exact Price Code match (Gsp_XXX)
  if (sku) {
    const normSku = normalizeString(sku);
    const exactPriceCode = candidates.find(p => {
      const pPriceCode = normalizeString(p["Mã giá bán"] || p["Mã giá"] || p.id || "");
      return pPriceCode && pPriceCode === normSku;
    });
    if (exactPriceCode) return exactPriceCode;
  }
  ```

---

#### 🔴 Vấn đề 4: Lỗi Logic `isNaN(qty || price)` trong `PODetailModal.tsx`
- **Vị trí quan sát**:
  - `src/components/PODetailModal.tsx` (Dòng 221–224)
- **Mã nguồn hiện tại**:
  ```ts
  relatedPoLines.forEach(line => {
    const qty = parseFloat(String(line['Số lượng'] || '0').replace(/,/g, ''));
    const price = parseFloat(String(line['Đơn giá bán'] || '0').replace(/,/g, ''));
    totalOrderedQty += isNaN(qty) ? 0 : qty;
    totalAmount += isNaN(qty || price) ? 0 : (qty * price);
  });
  ```
- **Hậu quả**:
  Biểu thức `isNaN(qty || price)` trong JavaScript bị lỗi logic:
  - Nếu `qty = 10` và `price = NaN`, `qty || price` cho ra `10`. `isNaN(10)` trả về `false`. Khi đó `qty * price = 10 * NaN = NaN`, dẫn đến `totalAmount` bị nhiễm `NaN` toàn bộ modal!
- **Giải pháp đề xuất**:
  Sử dụng `parseNumber` chuẩn hóa:
  ```ts
  relatedPoLines.forEach(line => {
    const qty = parseNumber(line['Số lượng']);
    const price = parseNumber(line['Đơn giá bán']);
    totalOrderedQty += qty;
    totalAmount += (qty * price);
  });
  ```

---

#### 🔴 Vấn đề 5: Khoảng trắng đầu chuỗi trong Mã PO gây đứt gãy liên kết (Foreign Key Mismatch)
- **Vị trí quan sát**:
  - `src/data.ts`:
    - `PO_LINES_DATA` L191–194: `" 26/KHVT/0547"`, `" 26/KHVT/0600"` (có dấu cách đầu chuỗi `" "`)
    - `PO_HEADER_DATA` L216–217: `" 26/KHVT/0547"`, `" 26/KHVT/0600"`
    - `DELIVERY_DATA` L221, L264–267: `" 26/KHVT/0600"`, `" 26/KHVT/0547"`
- **Hậu quả**:
  Nếu các hàm so khớp sử dụng `===` mà không gọi `.trim()` hoặc `normalizeString()`, các đơn hàng này sẽ không liên kết được với PO Header, không hiển thị trong danh sách giao hàng hoặc bị tính thiếu tiến độ hoàn thành.
- **Giải pháp đề xuất**:
  1. Chuẩn hóa dữ liệu gốc trong `src/data.ts`, loại bỏ khoảng trắng dư thừa trong mã đơn hàng.
  2. Bọc `.trim()` và `.toLowerCase()` trên toàn bộ các phép so khớp mã PO giữa các bảng.

---

#### 🔴 Vấn đề 6: Cảnh báo Fallback khi `sellPrice = 0` trong `calculatePOLineFinances`
- **Vị trí quan sát**:
  - `src/lib/business-logic.ts` (Dòng 298–327)
- **Hiện trạng**:
  Khi `sellPrice` không tìm thấy trong Bảng giá và `Đơn giá bán` trên dòng PO bị trống, nhưng dòng PO đã có sẵn cột `Thành tiền dòng` (được trích xuất từ OCR chứng từ), hệ thống hiện tính `revenue = 0 * qty = 0`.
- **Giải pháp đề xuất**:
  Bổ sung cơ chế fallback ngược: Nếu `sellPrice === 0` nhưng `Thành tiền dòng > 0` và `qty > 0`, tự động suy ra `sellPrice = Thành tiền dòng / qty`.

---

## 3. BẢNG TỔNG HỢP KIỂM TOÁN CÁC FILE & ĐỀ XUẤT KHẮC PHỤC

| File | Dòng | Vấn đề phát hiện | Mức độ | Đề xuất sửa đổi |
|:---|:---|:---|:---|:---|
| `src/lib/business-logic.ts` | L241-244 | `getBuyPriceFromRecord` bỏ sót `Giá AVP`, `Giá vốn`, `Giá mua` | 🔴 Cao | Mở rộng danh sách trường fallback sang `Giá AVP`, `Giá vốn`, `Giá mua` |
| `src/lib/business-logic.ts` | L127-195 | `findPriceRecord` không kiểm tra trực tiếp mã giá `Gsp_XXX` | 🔴 Cao | Ưu tiên so khớp chính xác `Mã giá bán` / `Mã giá` trước khi so khớp mã sản phẩm |
| `src/lib/business-logic.ts` | L298-327 | Thiếu fallback `Thành tiền dòng / Số lượng` khi giá bán = 0 | 🟡 Trung bình | Bổ sung fallback suy diễn đơn giá từ thành tiền |
| `src/components/DeliveryPlanView.tsx` | L31-37 | Định nghĩa hàm `parseNumber` cục bộ bị lỗi với số tiếng Việt | 🔴 Cao | Xóa hàm cục bộ, import `parseNumber` từ `../lib/business-logic` |
| `src/components/DeliveryView.tsx` | L51-57 | Định nghĩa hàm `parseNumber` cục bộ bị lỗi với số tiếng Việt | 🔴 Cao | Xóa hàm cục bộ, import `parseNumber` từ `../lib/business-logic` |
| `src/components/MasterCalendarView.tsx` | L40-46 | Định nghĩa hàm `parseNumber` cục bộ bị lỗi với số tiếng Việt | 🔴 Cao | Xóa hàm cục bộ, import `parseNumber` từ `../lib/business-logic` |
| `src/components/PODetailModal.tsx` | L221-224 | Lỗi biểu thức `isNaN(qty \|\| price)` gây ra `totalAmount = NaN` | 🔴 Cao | Dùng `parseNumber` chuẩn hóa và tính tổng an toàn |
| `src/data.ts` | L191-194, 216-217, 221, 264-267 | Dấu cách thừa `" 26/KHVT/0547"`, `" 26/KHVT/0600"` | 🟡 Trung bình | Xóa dấu cách thừa trong mã đơn hàng của `PO_LINES_DATA`, `PO_HEADER_DATA`, `DELIVERY_DATA` |
| `src/components/WorkflowView.tsx` | L310-311, 350-351 | Hardcode giá mặc định (2700, 2100, 3200) trong các mẫu thử PO | 🟢 Nhẹ | Sử dụng giá thực tế từ `findPriceRecord` hoặc `0` thay vì giá cứng |

---

## 4. KẾT LUẬN & KIẾN NGHỊ THỰC THI (ACTIONABLE RECOMMENDATIONS)

1. **Khắc phục triệt để tầng lõi `business-logic.ts`**:
   - Mở rộng hàm `findPriceRecord` hỗ trợ tra cứu trực tiếp theo `Mã giá bán` (`Gsp_XXX`).
   - Chuẩn hóa `getBuyPriceFromRecord` để hỗ trợ `Giá AVP` và các biến thể trường giá vốn.
2. **Loại bỏ hoàn toàn các hàm `parseNumber` cục bộ**:
   - Thống nhất 100% việc phân tích số thực qua hàm `parseNumber` của `src/lib/business-logic.ts`.
3. **Chuẩn hóa dữ liệu nguồn `src/data.ts`**:
   - Trim sạch toàn bộ mã đơn hàng và mã sản phẩm.
4. **Bảo vệ toàn vẹn dữ liệu tài chính (Zero-NaN Guarantee)**:
   - Áp dụng kiểm tra an toàn `isFinite()` và `> 0` trên tất cả phép chia tính Margin % để triệt tiêu vĩnh viễn lỗi chia cho 0 hoặc hiển thị `NaN%`.
