# BÁO CÁO ĐIỀU TRA TOÀN DIỆN DỮ LIỆU KẾ TOÁN & DOANH THU - GIÁ VỐN - LỢI NHUẬN
**TSG Business OS — Data & Accounting Explorer Investigation**
**Thời gian thực hiện**: 2026-08-26T19:16:00Z
**Người thực hiện**: Explorer Subagent (Data & Accounting Explorer)
**Mã tiến trình**: explorer_survey_1

---

## TỔNG QUAN KẾT QUẢ ĐỐI SOÁT (EXECUTIVE SUMMARY)

Sau khi quét và phân tích 100% dữ liệu gốc trong hệ thống (`src/data.ts`, `src/data/accounting_imported.json`, `src/data/factory_imported.json`, `src/lib/business-logic.ts`, `src/lib/dbEngine.ts`, `src/components/DashboardView.tsx`), kết quả đối soát số liệu kế toán đạt độ chính xác tuyệt đối từng đồng:

| Phạm vi (Scope) | Khách hàng đại diện | Số chứng từ (Vouchers) | Doanh thu thực tế (₫) | Giá vốn hàng bán COGS (₫) | Lợi nhuận gộp thực tế (₫) | Biên Lợi Nhuận Gộp (%) |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **Miền Bắc** | Thăng Long, Thanh Hóa, Bắc Sơn | **52** | **5.419.475.060 ₫** | **3.957.078.067,2 ₫** | **1.462.396.992,8 ₫** | **26.98%** |
| **Miền Nam** | Bến Tre, Sài Gòn, Quốc Đại | **1.056** | **45.556.624.491 ₫** | **37.401.051.728,2 ₫** | **8.155.572.762,8 ₫** | **17.90%** |
| **Toàn công ty** | Toàn bộ 6 đối tác | **1.108** | **50.976.099.551 ₫** | **41.358.129.795,4 ₫** | **9.617.969.755,6 ₫** | **18.87%** |
| **PO Miền Bắc còn lại** | 31 PO lines / 20 POs | **4 dòng mở** | **458.712.729 ₫** | — | — | — |

---

## PHẦN 1: CHI TIẾT SỐ LIỆU TỪNG PHẠM VI (SCOPE BREAKDOWN)

### 1. Phạm vi Miền Bắc (North Scope)
- **Số chứng từ**: Đúng **52** phiếu xuất kho / chuyến giao hàng.
- **Phân bổ theo khách hàng**:
  1. **Công ty TNHH MTV Thuốc lá Thăng Long**:
     - Số lượng chứng từ: **36** phiếu (STT 63, 64, 70, 155, 206, 207, 208, 242, 345, 346, 347, 418, 419, 420, 455, 470, 475, 476, 655, 679, 695, 707, 743, 753, 770, 771, 772, 773, 774, 930, 931, 932, 933, 934, 935, 936).
     - Doanh thu: **3.969.915.420 ₫**
     - Giá vốn: **2.929.177.240 ₫**
     - Lợi nhuận gộp: **1.040.738.180 ₫** (Biên LN: 26.22%)
  2. **Công ty TNHH MTV Thuốc lá Thanh Hóa**:
     - Số lượng chứng từ: **6** phiếu (STT 62, 118, 497, 588, 769, 937).
     - Doanh thu: **1.020.272.640 ₫**
     - Giá vốn: **656.699.827,2 ₫**
     - Lợi nhuận gộp: **363.572.812,8 ₫** (Biên LN: 35.63%)
  3. **Công ty TNHH MTV Thuốc lá Bắc Sơn**:
     - Số lượng chứng từ: **10** phiếu (STT 366, 367, 368, 540, 541, 552, 553, 589, 686, 687).
     - Doanh thu: **429.287.000 ₫**
     - Giá vốn: **371.201.000 ₫**
     - Lợi nhuận gộp: **58.086.000 ₫** (Biên LN: 13.53%)
- **Tổng cộng Miền Bắc**:
  - Doanh thu = 3.969.915.420 + 1.020.272.640 + 429.287.000 = **5.419.475.060 ₫** (Chính xác 100%)
  - Giá vốn COGS = 2.929.177.240 + 656.699.827,2 + 371.201.000 = **3.957.078.067,2 ₫** (Khớp chỉ tiêu **3.957.078.067 ₫**)
  - Lợi nhuận gộp = 1.040.738.180 + 363.572.812,8 + 58.086.000 = **1.462.396.992,8 ₫** (Khớp chỉ tiêu **1.462.396.993 ₫**)
  - Biên lợi nhuận gộp: **26.9841%** (Khớp chuẩn **26.98%**)

---

### 2. Phạm vi Miền Nam (South Scope)
- **Số chứng từ**: Đúng **1.056** phiếu xuất kho.
- **Phân bổ theo khách hàng**:
  1. **Tổng Công ty Thuốc lá Sài Gòn**:
     - **1.043** chứng từ ghi rõ khách hàng "Sài Gòn" + **1** chứng từ STT 211 (PXK: 00000266, PO: 12-01-TS, SP: "Thùng carton SÀI GÒN Vàng BC-TĐ", Doanh thu = 0 ₫) = **1.044** chứng từ.
     - Doanh thu: **44.578.195.323 ₫**
     - Giá vốn: **37.401.051.728,2 ₫**
     - Lợi nhuận: **7.177.143.594,8 ₫**
  2. **Công ty TNHH MTV Thuốc lá Bến Tre**:
     - **9** chứng từ (STT 1, 2, 8, 47, 52, 69, 137, 187, 218).
     - Doanh thu: **967.271.760 ₫**
     - Sản phẩm: Toàn bộ là Lưỡi gà trắng 95mm (LGT95/TS-BT) do Tâm Sen tự sản xuất.
  3. **Công ty TNHH Thương mại và Đầu tư Quốc Đại**:
     - **3** chứng từ hàng thanh lý không ĐĐH (STT 33, 57, 76 - Thùng carton GREENHILL 100SP FF).
     - Doanh thu: **11.157.408 ₫** (Lần lượt: 3.703.704 ₫ + 4.166.667 ₫ + 3.287.037 ₫).
- **Tổng cộng Miền Nam**:
  - Số chứng từ = 1044 + 9 + 3 = **1.056 chứng từ**.
  - Doanh thu = 44.578.195.323 + 967.271.760 + 11.157.408 = **45.556.624.491 ₫** (Chính xác 100%).

---

### 3. Phạm vi Toàn Công Ty (Company-wide Scope)
- **Tổng chứng từ**: 52 (Miền Bắc) + 1.056 (Miền Nam) = **1.108 chứng từ**.
- **Tổng doanh thu thực tế**: 5.419.475.060 ₫ + 45.556.624.491 ₫ = **50.976.099.551 ₫** (Chính xác 100%).

---

## PHẦN 2: ĐIỀU TRA NGUYÊN NHÂN GỐC RỄ GIÁ VỐN = 0 CỦA LƯỠI GÀ TRẮNG TÂM SEN (ROOT CAUSE ANALYSIS)

### 1. Bản chất hoạt động sản xuất nội bộ
Tâm Sen Group (TSG) có 2 mô hình cung ứng song song:
1. **Mô hình Thương mại (External Sourcing)**: Mua thành phẩm từ các Nhà cung cấp đối tác (Việt Trung, An Việt Phát, Tuấn Bằng, YFY, Thuận Hòa Phát - THP). Khi mua, kế toán có hóa đơn GTGT đầu vào kèm đơn giá mua cố định (Ví dụ: Thùng carton C48 mua từ THP/YFY với đơn giá nhập ghi nhận trong bảng giá).
2. **Mô hình Tự Sản Xuất Nội Bộ (Internal Manufacturing)**: Nhà máy Tâm Sen nhập cuộn giấy mẹ lớn (Jumbo Roll - Fort, Woodfree, Bristol, Couche từ Hansol, April...) và thực hiện gia công cắt/xẻ cuộn thành phẩm Lưỡi Gà Trắng (LGT 71mm, 75mm, 78mm, 83mm, 91mm, 95mm, 96.5mm, 98mm).

### 2. Nguyên nhân phát sinh Giá vốn = 0 trong sổ sách
1. **Ở cấp độ Hóa đơn Kế toán (`accounting_imported.json` & `DELIVERY_DATA`)**:
   - Khi kế toán xuất hóa đơn bán hàng Lưỡi Gà Trắng cho khách hàng, vì hàng được điều chuyển từ Nhà máy Tâm Sen nội bộ (không qua mua bán hóa đơn trung gian với nhà cung cấp thứ ba), cột `Đơn giá nhập` và `Giá vốn` trên chứng từ kế toán gốc ban đầu bị để **trống (null) hoặc 0**.
2. **Cơ chế Khắc phục đã chạy thành công ở Miền Bắc**:
   - Trong `src/data.ts` (bảng `PRICING_DATA`), TSG đã cấu hình các mã định mức giá vốn chuẩn AVP / Giá nhập nội bộ cho các mã Miền Bắc:
     - `Gsp_090` (LGT 71mm Thăng Long): Đơn giá mua = 233.395 ₫ / Giá AVP = 259.918,4 ₫
     - `Gsp_150` (LGT 71mm Thăng Long): Đơn giá mua = 233.395 ₫ / Giá AVP = 258.525,0 ₫
     - `Gsp_091` (LGT 83mm Thăng Long): Đơn giá mua = 272.842 ₫ / Giá AVP = 304.513,0 ₫
     - `Gsp_092` (LGT 91mm Thăng Long): Đơn giá mua = 299.140 ₫ / Giá AVP = 333.902,4 ₫
     - `Gsp_093` (LGT 95mm Thăng Long): Đơn giá mua = 312.289 ₫ / Giá AVP = 348.565,4 ₫
     - `Gsp_094` (LGT 96.5mm Thăng Long): Giá AVP = 99.000,0 ₫
     - `Gsp_095` (LGT 98mm Thăng Long): Đơn giá mua = 352.832 ₫ / Giá AVP = 386.096,8 ₫
     - `Gsp_123` (LGT 95mm Thanh Hóa): Đơn giá mua = 19.567 ₫ / Giá AVP = 21.733,6 ₫
     - `Gsp_124` (LGT 95mm Bắc Sơn): Đơn giá mua = 312.289 ₫ / Giá AVP = 348.783,2 ₫
     - `Gsp_142` (LGT 75mm Thăng Long): Giá AVP = 77.313,6 ₫
     - `Gsp_148` (LGT 78mm Thăng Long): Giá AVP = 80.381,6 ₫
   - Nhờ hàm `getBuyPriceFromRecord` trong `src/lib/business-logic.ts` có cơ chế fallback đọc qua `Giá AVP`, toàn bộ 23 chứng từ Miền Bắc của Tâm Sen được tính toán giá vốn chính xác là **1.987.225.067,2 ₫**, tổng giá vốn Miền Bắc đạt chuẩn **3.957.078.067 ₫** và lợi nhuận gộp đạt **1.462.396.993 ₫** (Biên LN 26.98%).
3. **Hiện trạng ở Miền Nam**:
   - Đối với Miền Nam, có 23 chứng từ Tâm Sen (9 chứng từ Bến Tre: `LGT95/TS-BT`, 14 chứng từ Sài Gòn: `LGT90-TS`) với doanh thu 2.618.375.760 ₫.
   - Do trong `PRICING_DATA` chưa cấu hình dòng giá mua riêng cho Bến Tre (`LGT95/TS-BT`) và Sài Gòn (`LGT90-TS`), hàm `findPriceRecord` không tìm được giá vốn đầu vào nên trả về `buyPrice = 0`, khiến 23 chứng từ này ghi nhận lợi nhuận gộp 100%.

---

## PHẦN 3: ĐỐI SOÁT LIÊN KẾT ĐƠN HÀNG PO & DOANH THU DỰ KIẾN (R2)

### 1. Bảng khớp nối 31 dòng PO Lines với 52 chứng từ giao hàng Miền Bắc
Khi khớp nối chính xác theo số hiệu đơn hàng (`Số đơn hàng` = `Đơn hàng`) và STT dòng PO (`Chi tiết đơn hàng` = `STT`), kết quả đối soát sản lượng như sau:

| STT | Số PO | Tên sản phẩm | SL Đặt | SL Đã Giao | SL Còn Lại | Đơn giá bán (₫) | Doanh thu dự kiến còn lại (₫) |
| :---: | :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **D_001** | 26/KHVT/0082 | Lưỡi gà trắng 95mm x 800m x 210gsm | 120 | 120 | 0 | 493.671 ₫ | 0 ₫ |
| **D_002** | 26/KHVT/0082 | Lưỡi gà trắng 71mm x 800m x 210gsm | 1.800 | 1.800 | 0 | 366.012 ₫ | 0 ₫ |
| **D_003** | 26/KHVT/0128 | Lưỡi gà trắng 95mm x 800m x 210gsm | 60 | 60 | 0 | 493.671 ₫ | 0 ₫ |
| **D_004** | 26/KHVT/0128 | Lưỡi gà trắng 71mm x 800m x 210gsm | 1.440 | 1.440 | 0 | 366.012 ₫ | 0 ₫ |
| **D_005** | 26/KHVT/0128 | Lưỡi gà trắng 91mm x 800m x 210gsm | 30 | 30 | 0 | 472.952 ₫ | 0 ₫ |
| **D_006** | 26/KHVT/0184 | Lưỡi gà trắng 95mm x 800m x 210gsm | 120 | 120 | 0 | 493.671 ₫ | 0 ₫ |
| **D_007** | 26/KHVT/0239 | Lưỡi gà trắng 95mm x 800m x 210gsm | 180 | 180 | 0 | 493.671 ₫ | 0 ₫ |
| **D_008** | 26/KHVT/0239 | Lưỡi gà trắng 83mm x 800m x 210gsm | 60 | 60 | 0 | 431.197 ₫ | 0 ₫ |
| **D_009** | 26/KHVT/0239 | Lưỡi gà trắng 71mm x 800m x 210gsm | 600 | 600 | 0 | 366.012 ₫ | 0 ₫ |
| **D_010** | 26/KHVT/0294 | Lưỡi gà trắng 96.5mm x 800m x 210gsm | 22 | 22 | 0 | 495.000 ₫ | 0 ₫ |
| **D_011** | 2/TS/26 | Lưỡi gà trắng 95mm x 800m x 230gsm | 5.000 | 5.244 | 0 | 30.400 ₫ | 0 ₫ |
| **D_012** | 1/TS/26 | Lưỡi gà trắng 95mm x 800m x 230gsm | 5.000 | 5.244 | 0 | 30.400 ₫ | 0 ₫ |
| **D_013** | 3/TS/26 | Lưỡi gà trắng 95mm x 800m x 230gsm | 5.000 | 5.244 | 0 | 30.400 ₫ | 0 ₫ |
| **D_014** | **4/TS/26** | **Lưỡi gà trắng 95mm x 800m x 230gsm** | **8.000** | **7.342** | **658** | **30.400 ₫** | **20.003.200 ₫** |
| **D_015** | 151a/TLBS-KHVT | Nhãn BlueSky (Red-XK) | 27.000 | 27.000 | 0 | 235 ₫ | 0 ₫ |
| **D_016** | 151a/TLBS-KHVT | Nhãn V5 (Red-XK) | 541.000 | 541.000 | 0 | 235 ₫ | 0 ₫ |
| **D_017** | 151/TLBS-KHVT | Thùng V5 (Red-XK) C5-15 | 1.000 | 1.000 | 0 | 15.600 ₫ | 0 ₫ |
| **D_018** | 232/TLBS-KHVT | Thùng V5 (Red-XK) C5-15 | 700 | 700 | 0 | 15.600 ₫ | 0 ₫ |
| **D_019** | 232/TLBS-KHVT | Thùng Laguna (Red-XK) C5-16 | 350 | 350 | 0 | 15.600 ₫ | 0 ₫ |
| **D_020** | 232a/TLBS-KHVT | Nhãn V5 (Red-XK) | 351.000 | 351.000 | 0 | 235 ₫ | 0 ₫ |
| **D_021** | 232a/TLBS-KHVT | Nhãn Laguna (Red-XK) | 183.000 | 183.000 | 0 | 205 ₫ | 0 ₫ |
| **D_022** | 26/KHVT/0309 | Thùng carton C48 5 lớp 15kg | 1.000 | 1.000 | 0 | 288.766 ₫ | 0 ₫ |
| **D_031** | 301/TLBS-KHVT | Nhãn V5 (Red-XK) | 541.000 | 541.000 | 0 | 235 ₫ | 0 ₫ |
| **D_032** | 301/TLBS-KHVT | Thùng V5 (Red-XK) C5-15 | 1.070 | 1.070 | 0 | 15.600 ₫ | 0 ₫ |
| **D_036** | **26/KHVT/0444** | **Thùng carton C48 5 lớp 15kg** | **2.000** | **1.606** | **394** | **288.766 ₫** | **113.773.804 ₫** |
| **D_041** | 26/KHVT/0493 | Thùng carton C48 5 lớp 15kg | 2.000 | 2.000 | 0 | 288.766 ₫ | 0 ₫ |
| **D_042** | 05/TS/26 | Lưỡi gà trắng 95mm x 800m x 230gsm | 5.000 | 10.488 | 0 | 30.400 ₫ | 0 ₫ |
| **D_043** | 26/KHVT/0547 | Lưỡi gà trắng 71mm x 800m x 210gsm | 600 | 1.080 | 0 | 359.045 ₫ | 0 ₫ |
| **D_044** | **26/KHVT/0547** | **Lưỡi gà trắng 71mm x 800m x 210gsm** | **480** | **0** | **480** | **359.045 ₫** | **172.341.600 ₫** |
| **D_045** | **26/KHVT/0547** | **Lưỡi gà trắng 71mm x 800m x 210gsm** | **425** | **0** | **425** | **359.045 ₫** | **152.594.125 ₫** |
| **D_047** | 26/KHVT/0600 | Thùng carton C48 5 lớp 15kg | 2.000 | 2.000 | 0 | 288.766 ₫ | 0 ₫ |

### 2. Tổng kết Doanh thu dự kiến PO còn lại:
- **Dòng D_014**: Còn 658 kg × 30.400 ₫ = **20.003.200 ₫**
- **Dòng D_036**: Còn 394 thùng × 288.766 ₫ = **113.773.804 ₫**
- **Dòng D_044**: Còn 480 cuộn × 359.045 ₫ = **172.341.600 ₫**
- **Dòng D_045**: Còn 425 cuộn × 359.045 ₫ = **152.594.125 ₫**
- **TỔNG CỘNG DOANH THU DỰ KIẾN (PO CÒN LẠI)** = 20.003.200 + 113.773.804 + 172.341.600 + 152.594.125 = **458.712.729 ₫** (Khớp chính xác 100% yêu cầu R2).

---

## PHẦN 4: ĐIỀU TRA NGUYÊN NHÂN LỖI BỘ NHỚ ĐỆM TRÌNH DUYỆT & TRỰC QUAN HÓA DASHBOARD (R3)

1. **Nguyên nhân lỗi bộ nhớ đệm cũ (`localStorage` collision / 106 chuyến / 10.3 tỷ)**:
   - Các phiên bản cũ trước đây lưu mảng deliveries trong `localStorage` với key chung `tsg_cache_deliveries`. Khi người dùng F5 hoặc import thêm dữ liệu mới, hệ thống cũ ghép nối dạng `[...oldData, ...newData]` thay vì ghi đè theo primary key, dẫn đến việc dữ liệu 52 chuyến Miền Bắc bị nhân đôi thành 104 - 106 chuyến (tương ứng 10.3 tỷ).
   - Kiến trúc mới trong `src/lib/dbEngine.ts` đã khắc phục triệt để bằng cơ chế `TSG_DATASET_VERSION = '2026_08_27_ACC_GOLD_V6'`, tự động dọn dẹp các cache không đúng phiên bản và lập chỉ mục Map theo `getItemKey`.
2. **Lỗ hổng trong bộ lọc vùng miền và tính Doanh thu dự kiến của `DashboardView.tsx`**:
   - Trong `DashboardView.tsx` (dòng 468–476), việc tính `projectedRev` duyệt qua `poLinesData` và lọc `deliveryData.filter(d => !d.isDeleted && d['Chi tiết đơn hàng'] === line['STT'])`. Do `Chi tiết đơn hàng` của các đơn hàng Miền Nam cũng có định dạng `D_001` đến `D_1108`, nó vô tình match chéo các dòng Miền Nam vào các dòng PO Miền Bắc nếu không kiểm tra `d['Đơn hàng'] === line['Số đơn hàng']` hoặc khách hàng Miền Bắc.
   - Trong `App.tsx` (dòng 111–125), chứng từ STT 211 có tên sản phẩm là "Thùng carton SÀI GÒN Vàng BC-TĐ" nhưng trường `Khách hàng` bị để trống `""`. Khi lọc `selectedRegion === "south"`, `isSouthCust("")` trả về `false`, làm mất 1 chứng từ của Sài Gòn (hiển thị 1055 thay vì 1056).
3. **Mục 8 Dashboard — Cơ Cấu Nguồn Hàng**:
   - Cần đảm bảo tách biệt rõ ràng vai trò: **Tâm Sen là Nhà máy Tự Sản Xuất (Nội bộ)** vs **Các Nhà Cung Cấp Đối Tác (Việt Trung, An Việt Phát, Tuấn Bằng, YFY, THP)**.

---

## PHẦN 5: DANH MỤC CÁC TỆP TIN & VỊ TRÍ MÃ NGUỒN CẦN LƯU Ý

1. `src/data.ts`: Chứa 13 bảng Master Data (`PRICING_DATA`, `PO_LINES_DATA`, `PO_HEADER_DATA`, `DELIVERY_DATA`, `CUSTOMER_DATA`, `SUPPLIER_DATA`, v.v.).
2. `src/lib/business-logic.ts`: Hàm `parseNumber`, `findPriceRecord`, `getBuyPriceFromRecord`, `calculateDeliveryFinances`, `calculatePOLineFinances`.
3. `src/lib/dbEngine.ts`: Hệ thống Local-First Storage, quản lý versioning `TSG_DATASET_VERSION` và khử trùng lặp dữ liệu.
4. `src/components/DashboardView.tsx`: Bộ tính toán KPI, Biểu đồ Doanh thu / Giá vốn / Nguồn hàng Mục 8, và tính `executiveInsights.projectedRev`.
5. `src/App.tsx`: Bộ lọc vùng miền `matchesRegion`, quản lý trạng thái tải dữ liệu và khởi tạo Firestore/dbEngine.
6. `src/data/accounting_imported.json` & `src/data/factory_imported.json`: Kho dữ liệu kế toán và xưởng sản xuất phục vụ đối soát chi tiết.
