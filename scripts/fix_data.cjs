const fs = require('fs');

let content = fs.readFileSync('src/data.ts', 'utf8');

const PRODUCT_DATA = `Mã sản phẩm,Tên sản phẩm,Nhóm hàng,Đơn Vị Tính,Thông Số Sản Phẩm,Mã Nhà Cung Cấp,Trọng lượng riêng,Quy đổi trọng lượng,Khách hàng,Thiết Kế,Tình trạng,Giá 2026,Mẫu thiết kế,Tiến độ sản phẩm,Trọng lượng,Bản sao Kích thước
TH130/07,Thùng Thăng Long Bao cứng TH130/07,Thùng carton,Cái,Spec-001,YFY,680 (±5%),,Thăng Long,,Sắp mở bán,"Gsp_082,Gsp_131",,TH130/07-Đang duyệt,,SW-001
YBS_001,Lưỡi gà trắng 95mm x 800m x 210gsm,Nguyên liệu,Kg,,,,,,,Sắp mở bán,Gsp_124,,,,
TH25/07,Thùng Thăng Long bao mềm TH25/07,Thùng carton,Cái,Spec-002,YFY,630 (±5%),,Thăng Long,,Sắp mở bán,"Gsp_083,Gsp_132",,TH25/07-Đang duyệt,,SW-002
TH211/05,Thùng Thăng Long Slim bao cứng TH211/05,Thùng carton,Cái,Spec-003,YFY,860 (±5%),,Thăng Long,,Sắp mở bán,"Gsp_084,Gsp_133",,TH211/05-Đã duyệt,,SW-003
TH13/05,Thùng Sapa bao cứng TH13/05,Thùng carton,Cái,Spec-004,YFY,570 (±5%),,Thăng Long,,,Gsp_138,,,,SW-004
TH38/05,Thùng Hà Nội bao cứng TH38/05,Thùng carton,Cái,Spec-005,YFY,560 (±25g),,Thăng Long,,,Gsp_137,,,,SW-005
TH10/05,Thùng Tam Đảo BC bao cứng TH10/05,Thùng carton,Cái,Spec-006,YFY,560 (±25g),,Thăng Long,,,Gsp_136,,,,SW-006
TH07/05,Thùng Phù Đổng BC bao cứng TH07/06,Thùng carton,Cái,Spec-007,YFY,560 (±25g),,Thăng Long,,,Gsp_135,,,,SW-007
TH12/05,Thùng Hoàn Kiếm bao cứng TH12/05,Thùng carton,Cái,Spec-008,YFY,570 (±25g),,Thăng Long,,,Gsp_134,,,,SW-008
TH427,Thùng carton John JGI - TH427 ,Thùng carton,Cái,Spec-009,YFY,1.040 (±5%),,Thăng Long,,,Gsp_096,,,,SW-009
LT427,Tấm lót trên - LT427,Thùng carton,Cái,Spec-010,YFY,,,Thăng Long,,,Gsp_097,,,,SW-010
LD427,Tấm lót dưới - LD427,Thùng carton,Cái,Spec-076,YFY,,,Thăng Long,,,Gsp_098,,,,SW-076
TH426/02,Thùng carton John JDB - TH426/02,Thùng carton,Cái,,,,,,,,Gsp_099,,,,
LT427,Tấm lót trên - LT427,Thùng carton,Cái,,,,,,,,Gsp_100,,,,
LD427,Tấm lót dưới - LD427,Thùng carton,Cái,,,,,,,,Gsp_101,,,,
TH42-2/03,Thùng Gold Seal (10's Red) không ly BCXK TH42-2/03,Thùng carton,Cái,Spec-077,YFY,1.000 (±5%),,Thăng Long,,,Gsp_102,,,,SW-077
TH64-5/03,Thùng Gold Seal (10’s Menthol) Ghana (Pictorial) BCXK - TH64-5/03,Thùng carton,Cái,Spec-078,YFY,900 (±5%),,Thăng Long,,,,,,,SW-078
TH42-5/03,Thùng Gold Seal (10's Red) Ghana (Pictorial) TH42-5/03,Thùng carton,Cái,Spec-079,YFY,900 (±5%),,Thăng Long,,,,,,,SW-079
TH173-2/02,Thùng Gold Seal (20's Red) Ghana (Pictorial) TH173-2/02,Thùng carton,Cái,Spec-080,YFY,830 (±5%) ,,Thăng Long,,,,,,,SW-080
TH146-1/02,Thùng Oris (20's slim Apple English) - TH146-1/02,Thùng carton,Cái,Spec-081,YFY,860 (±5%),,Thăng Long,,,Gsp_103,,,,SW-081
TH123-7,Thùng Oris (20’s Slim Menthol Spiral E-CN) - TH123-7,Thùng carton,Cái,Spec-082,YFY,860 (±5%),,Thăng Long,,,Gsp_104,,,,SW-082
TH114-1/02,Thùng Oris (20’s Slim Light) E-VN TH114-1/02,Thùng carton,Cái,Spec-083,YFY,860 (±5%),,Thăng Long,,,Gsp_105,,,,SW-083
TH156-1/02,Thùng Oris (20’s Slim Cherry English) - TH156-1/02,Thùng carton,Cái,Spec-084,YFY,860 (±5%),,Thăng Long,,,Gsp_106,,,,SW-084
TH197-1/02,Thùng Oris (20’s Slim Gummint English) - TH197-1/02,Thùng carton,Cái,Spec-085,YFY,860 (±5%),,Thăng Long,,,Gsp_107,,,,SW-085
TH189-1/02,Thùng Oris (20’s Slim Grape English) - TH189-1/02,Thùng carton,Cái,Spec-086,YFY,860 (±5%),,Thăng Long,,,Gsp_108,,,,SW-086
TH160-1/02,Thùng Oris (20’s Slim Chocolate English) - TH160-1/02,Thùng carton,Cái,Spec-087,YFY,860 (±5%),,Thăng Long,,,Gsp_109,,,,SW-087
TH124-1/03,Thùng Oris (20’s Slim Gold English) - TH124-1/03,Thùng carton,Cái,Spec-088,YFY,860 (±5%),,Thăng Long,,,Gsp_110,,,,SW-088
TH114-1/03," Thùng Oris (20's Slim Lights) -E-VN (TH114-1/03) ",Thùng carton,Cái,Spec-126,YFY,,,Thăng Long,,,,,,,SW-126
TH443-1," Thùng Giang Son (20’s Slim Blue) BCXK TH443-1 (100 tút)",Thùng carton,Cái,,,,,,,,Gsp_113,,,,
TH443," Thùng Giang Son (20’s Slim Blue) BCXK TH443 ",Thùng carton,Cái,,,,,,,,Gsp_114,,,,
TH505-1," Thùng GiangSon (20's Slim Red) BCXK TH505-1 (100 tút)",Thùng carton,Cái,,,,,,,,Gsp_111,,,,
TH505," Thùng GiangSon (20's Slim Red) BCXK TH505 ",Thùng carton,Cái,,,,,,,,Gsp_115,,,,
TH478-1,Thùng Capital (20’s Classic Menthol) - ENG HW-CBB TH478-1,Thùng carton,Cái,Spec-089,YFY,920 (±5%),,Thăng Long,,,Gsp_116,,,,SW-089
PS-15-I,Thùng C48 5 lớp - 15kg ,Thùng carton,Cái,Spec-094,THP,15 kg (±0.4kg),,Thăng Long,,Đang kinh doanh,Gsp_117,,,,SW-094
NH118/08,Nhãn bao Blue Seal Slim bao cứng (NH118/08),In ấn ,Tờ,Spec-099,Tuấn Bằng,,,Thăng Long,,,Gsp_120,,,,SW-099
TU118/08,Nhãn tút Blue Seal Slim bao cứng (TU118/08),In ấn ,Tờ,Spec-100,Tuấn Bằng,,,Thăng Long,,,Gsp_121,,,,SW-100
NH211/06,Nhãn Thăng Long Slim bao cứng (NH211/06),In ấn ,Tờ,Spec-103,MM Vidon,,,Thăng Long,,Tạm ngưng,,,,,SW-103
TU211/06,Tút Thăng Long Slim bao cứng (TU211/06),In ấn ,Tờ,Spec-104,MM Vidon,,,Thăng Long,,Tạm ngưng,,,,,SW-104
NH13/07,Nhãn bao Sapa bao cứng (NH13/07),In ấn ,Tờ,Spec-105,Tuấn Bằng,,,Thăng Long,,,Gsp_122,,,,SW-105
NH183/08,Nhãn bao Blue Seal Apple Slim bao cứng (NH118/08),In ấn ,Tờ,Spec-112,Tuấn Bằng,,,Thăng Long,,,Gsp_118,,,,SW-112
TU183/08,Nhãn tút Blue Seal Apple Slim bao cứng (TU118/08),In ấn ,Tờ,Spec-113,Tuấn Bằng,,,Thăng Long,,,Gsp_119,,,,SW-113
LGTPS - 002-71,Lưỡi gà trắng 71mm x 800m x 210gsm,Nguyên liệu,Cuộn,Spec-117,Tâm Sen,,,Thăng Long,,Đang kinh doanh,"Gsp_090,Gsp_150",,LGTPS - 002-71-Đã duyệt,,SW-117
LGTPS - 002-75,Lưỡi gà trắng 75mm x 800m x 210gsm,Nguyên liệu,Cuộn,,,,,Thăng Long,,R&D/ Báo giá,Gsp_142,,LGTPS - 002-75-Đã duyệt,,
LGTPS - 002-78,Lưỡi gà trắng 78mm x 800m x 210gsm,Nguyên liệu,Cuộn,,,,,Thăng Long,,R&D/ Báo giá,Gsp_148,,LGTPS - 002-78-Đã duyệt,,
LGTPS - 002-83,Lưỡi gà trắng 83mm x 800m x 210gsm,Nguyên liệu,Cuộn,Spec-118,Tâm Sen,,,Thăng Long,,Đang kinh doanh,Gsp_091,,LGTPS - 002-83-Đã duyệt,,SW-118
LGTPS - 002-91,Lưỡi gà trắng 91mm x 800m x 210gsm,Nguyên liệu,Cuộn,Spec-119,Tâm Sen,,,Thăng Long,,Đang kinh doanh,Gsp_092,,LGTPS - 002-91-Đã duyệt,,SW-119
LGTPS - 002-95,Lưỡi gà trắng 95mm x 800m x 210gsm,Nguyên liệu,Cuộn,Spec-120,Tâm Sen,,,Thăng Long,,Đang kinh doanh,Gsp_093,,LGTPS - 002-95-Đã duyệt,,SW-120
"LGTPS - 002-96,5","Lưỡi gà trắng 96,5mm x 800m x 230gsm",Nguyên liệu,Cuộn,Spec-148,,16.2,,Thăng Long,,Đang kinh doanh,Gsp_094,,"LGTPS - 002-96,5-Đã duyệt",,SW-148
LGT98-TS,Lưỡi gà trắng 98mm x 800m x 230gsm,Nguyên liệu,Cuộn,Spec-121,Tâm Sen,,,Thăng Long,,Đang kinh doanh,Gsp_095,,LGT98-TS-Đã duyệt,,SW-121
LGTTS-002-95,Lưỡi gà trắng 95mm x 800m x 230gsm,Nguyên liệu,Kg,Spec-122,Tâm Sen,,,Thanh Hoá,,Đang kinh doanh,Gsp_123,,,,SW-122
TSBS-0011-00," Nhãn Bluesky (Red-XK) ",In ấn ,Tờ,,,,,Bắc Sơn,,Đang kinh doanh,Gsp_085,,,,
TSBS-0010-00," Nhãn V5 (Red-XK) ",In ấn ,Tờ,,,,,Bắc Sơn,,Đang kinh doanh,Gsp_086,,,,
C5-15," Thùng V5 (Red-XK)",Thùng carton,Cái,,,,,Bắc Sơn,,Đang kinh doanh,Gsp_088,,,,
TSBS-0012-00," Nhãn Laguna (Red-XK) ",In ấn ,Tờ,,,,,Bắc Sơn,,Đang kinh doanh,Gsp_087,,,,
C5-16," Thùng Laguna (Red-XK) ",Thùng carton,Cái,,,,,Bắc Sơn,,Đang kinh doanh,Gsp_089,,,,
TP-LG00008-SG,Giấy lưỡi gà trắng - LGT90-TS 90mm x 800m x 250gsm,Nguyên liệu,Cuộn,,,,,,,,,,,,
HH-CT00072,Thùng carton SÀI GÒN Vàng BC-TĐ,Thùng carton,Cái,,,,,Sài Gòn,,,,,,,
HH-CT00052,Thùng carton SAIGON Virginia BC-RC,Thùng carton,Cái,,,,,Sài Gòn,,,,,,,
HH-CT00063,Thùng carton MELIA Tím,Thùng carton,Cái,,,,,Sài Gòn,,,,,,,
HH-CT00007,Thùng carton SAIGON Silver DS-TĐ,Thùng carton,Cái,,,,,Sài Gòn,,,,,,,
HH-CT00008,Thùng carton SAIGON Silver DS-B-TĐ,Thùng carton,Cái,,,,,Sài Gòn,,,,,,,
HH-CT00060,Thùng carton EMPIRE 20 FF (M.SP),Thùng carton,Cái,,,,,Sài Gòn,,,,,,,
HH-CT00064,Thùng carton GREENHILL 100SP MENTHOL,Thùng carton,Cái,,,,,Sài Gòn,,,,,,,
HH-CT00133,Thùng carton GREENHILL 100SP FF,Thùng carton,Cái,,,,,Sài Gòn,,,,,,,
HH-CT00027,Thùng carton Du lịch Ment BM-TĐ,Thùng carton,Cái,,,,,Sài Gòn,,,,,,,
,"Thùng carton DENVER BLUE lOOSP (ARB-S1)",Thùng carton,Cái,,,,,Sài Gòn,,,,,,,
HH-CT00036,Thùng carton COTAB BC-TĐ,Thùng carton,Cái,,,,,Sài Gòn,,,,,,,
HH-CT00099,Thùng carton GOLD SEAL 20 Red (C),Thùng carton,Cái,,,,,Sài Gòn,,,,,,,
HH-CT00083,Thùng carton ERA Ment BC-TĐ,Thùng carton,Cái,,,,,Sài Gòn,,,,,,,
HH-CT00090,Thùng carton ĐÀ LẠT Đỏ BC-TĐ,Thùng carton,Cái,,,,,Sài Gòn,,,,,,,
HH-CT00078,Thùng carton MELIA Ment BC-TĐ,Thùng carton,Cái,,,,,Sài Gòn,,,,,,,
HH-CT00077,Thùng carton VITAB Vàng BC-TĐ,Thùng carton,Cái,,,,,Sài Gòn,,,,,,,
HH-CT00081,Thùng carton ĐÀ LẠT Xanh BC-TĐ,Thùng carton,Cái,,,,,Sài Gòn,,,,,,,
HH-CT00091,Thùng carton SÀI GÒN Xanh BC-TĐ,Thùng carton,Cái,,,,,Sài Gòn,,,,,,,
HH-CT00089,Thùng carton FASOL Vàng BC-TĐ,Thùng carton,Cái,,,,,Sài Gòn,,,,,,,
HH-CT00034-SG,Thùng carton C48-7.3 kg,Thùng carton,Cái,,,,,Sài Gòn,,,,,,,
HH-CT00046,Thùng carton ERA Menthol – OD,Thùng carton,Cái,,,,,Sài Gòn,,,,,,,
HH-CT00011,Thùng carton ERA Tiger Tím BC,Thùng carton,Cái,,,,,Sài Gòn,,,,,,,
HH-CT00002,Thùng carton ERA Tím BC,Thùng carton,Cái,,,,,Sài Gòn,,,,,,,
HH-CT00103,Thùng carton MEMORY Classic RC,Thùng carton,Cái,,,,,Sài Gòn,,,,,,,
HH-CT00104,Thùng carton MEMORY Menthol RC,Thùng carton,Cái,,,,,Sài Gòn,,,,,,,
HH-CT00003,Thùng carton SOUVENIR NHŨ BC,Thùng carton,Cái,,,,,Sài Gòn,,,,,,,
HH-CT00025,Thùng carton ERA Premium - OD,Thùng carton,Cái,,,,,Sài Gòn,,,,,,,
HH-CT00031,Thùng carton ERA BLACK MENTHOL,Thùng carton,Cái,,,,,Sài Gòn,,,,,,,
HH-CT00054,Thùng carton ERA FF - OD,Thùng carton,Cái,,,,,Sài Gòn,,,,,,,
HH-CT00075,Thùng carton FASOL Nâu BC-TĐ,Thùng carton,Cái,,,,,Sài Gòn,,,,,,,
HH-CT00005,Thùng carton HÒA BÌNH BC-TĐ,Thùng carton,Cái,,,,,Sài Gòn,,,,,,,
HH-CT00028,Thùng carton Du lịch đỏ BM-TĐ,Thùng carton,Cái,,,,,Sài Gòn,,,,,,,
HH-CT00006,Thùng carton HÒA BÌNH BM-TĐ,Thùng carton,Cái,,,,,Sài Gòn,,,,,,,
HH-CT00041,Thùng carton GOLD SEAL 10 Red (VEG),Thùng carton,Cái,,,,,Sài Gòn,,,,,,,
HH-CT00095,Thùng carton GOLD SEAL 20 Ment (C),Thùng carton,Cái,,,,,Sài Gòn,,,,,,,
HH-CT00040,Thùng carton GOLD SEAL 10 Ment (VEG),Thùng carton,Cái,,,,,Sài Gòn,,,,,,,
HH-CT00073,Thùng carton ERA Đỏ BC-TĐ,Thùng carton,Cái,,,,,Sài Gòn,,,,,,,
HH-CT00055,Thùng carton FASOL Trắng BC,Thùng carton,Cái,,,,,Sài Gòn,,,,,,,
HH-CT00013,Thùng carton SOUVENIR Tím,Thùng carton,Cái,,,,,Sài Gòn,,,,,,,
HH-CT00038,Thùng carton FASOL BM-TĐ,Thùng carton,Cái,,,,,Sài Gòn,,,,,,,
HH-CT00061,Thùng carton ERA ICE PLUS RC,Thùng carton,Cái,,,,,Sài Gòn,,,,,,,
HH-CT00009,Thùng carton SAIGON Special,Thùng carton,Cái,,,,,Sài Gòn,,,,,,,
HH-CT00010,Thùng carton CAPITAL 10 Ment,Thùng carton,Cái,,,,,Sài Gòn,,,,,,,
HH-CT00065,Thùng carton GOLD SEAL 10 Blue (E),Thùng carton,Cái,,,,,Sài Gòn,,,,,,,
HH-CT00131,Thùng carton SAIGON Silver Capsule DS BC,Thùng carton,Cái,,,,,Sài Gòn,,,,,,,
HH-CT00132,Thùng carton C48 - 14kg,Thùng carton,Cái,,,,,Sài Gòn,,,,,,,
,Thùng Catus Double Switch,Thùng carton,Cái,,,,,Sài Gòn,,,,,,,
HH-CT00044,Thùng carton ASALI 84C-I,Thùng carton,Cái,,,,,Sài Gòn,,,,,,,
PE,Túi PE 37 x 92 cm ,Nguyên liệu,Kg,,,,,Sài Gòn,,,,,,,
PE,Túi PE 56 x 100 cm ,Nguyên liệu,Kg,,,,,Sài Gòn,,,,,,,
PE,Túi PE 49 x 97 cm ,Nguyên liệu,Kg,,,,,Sài Gòn,,,,,,,
PE,Túi PE 54 x 92 cm ,Nguyên liệu,Kg,,,,,Sài Gòn,,,,,,,
PE,Túi PE 58 x 102 cm ,Nguyên liệu,Kg,,,,,Sài Gòn,,,,,,,
PE,Túi PE 58 x 87 cm ,Nguyên liệu,Kg,,,,,Sài Gòn,,,,,,,
PE,Túi PE 85 x 70 cm,Nguyên liệu,Kg,,,,,Sài Gòn,,,,,,,
PE,Túi PE 88 x 98 cm,Nguyên liệu,Kg,,,,,Sài Gòn,,,,,,,
PE,Túi PE 52 x 100 cm ,Nguyên liệu,Kg,,,,,Sài Gòn,,,,,,,
HH-CT00112,Tút ĐÀ LẠT KĐL,In ấn ,Tờ,,,,,Sài Gòn,,,,,,,
HH-CT00111,Tút GLOBE KĐL,In ấn ,Tờ,,,,,Sài Gòn,,,,,,,
HH-CT00110,Tút Mai Đỏ KĐL,In ấn ,Tờ,,,,,Sài Gòn,,,,,,,
HH-NT00013,Nhãn Du lịch đỏ BM,In ấn ,Tờ,,,,,Sài Gòn,,,,,,,
HH-NT00014,Nhãn DU LỊCH Ment BM,In ấn ,Tờ,,,,,Sài Gòn,,,,,,,
HH-NT00012,Nhãn Fasol BM,In ấn ,Tờ,,,,,Sài Gòn,,,,,,,
HH-NT00011,Nhãn Hòa Bình BM,In ấn ,Tờ,,,,,Sài Gòn,,,,,,,
HH-CT00071,Thùng carton SAAT,Thùng carton,Cái,,,,,Sài Gòn,,,,,,,
,Thùng carton John FF - JW,Thùng carton,Cái,,,,,Sài Gòn,,,,,,,
,Thùng carton John FF - JGI,Thùng carton,Cái,,,,,Sài Gòn,,,,,,,
,Thùng carton GOLD SEAL 10 Ment (VEG-RCT),Thùng carton,Cái,,,,,Sài Gòn,,,,,,,
,Thùng carton GOLD SEAL 10 Red (VEG-RCT),Thùng carton,Cái,,,,,Sài Gòn,,,,,,,
,Thùng carton C48 - 9.3 kg,Thùng carton,Cái,,,,,Sài Gòn,,,,,,,
,Thùng carton GOLD SEAL 10 Blue (NIA) - 2012,Thùng carton,Cái,,,,,Sài Gòn,,,,,,,
,Thùng carton D&J 20 FF (SA),Thùng carton,Cái,,,,,Sài Gòn,,,,,,,
,Thùng carton John FF - JGI 10S,Thùng carton,Cái,,,,,Sài Gòn,,,,,,,
,Thùng carton DENVER 100SP Blue (ARB-S1),Thùng carton,Cái,,,,,Sài Gòn,,,,,,,
,Bìa carton lót thùng 20 điếu,Thùng carton,Cái,,,,,Sài Gòn,,,,,,,
TP-LG00015,Lưỡi gà trắng 88 - LGT88/TS-BT 88mm x 800m x 210gsm,Nguyên liệu,Cuộn,,,,,Bến Tre,,,,,,,
TP-LG00003-BT,Lưỡi gà trắng 95 - LGT95/TS-BT 95mm x 800m x 210gsm,Nguyên liệu,Cuộn,,,,,Bến Tre,,,,,,,
,Lưỡi gà trắng 90 - LGT90/TS-BT 90mm x 800m x 210gsm,Nguyên liệu,Cuộn,,,,,Bến Tre,,,,,,,`;

const DELIVERY_PLAN_DATA = `Mã kế hoạch,Đơn hàng,Sản phẩm,Khách hàng,Ngày dự kiến,Số lượng cần giao,Trạng thái
KP-001,26/KHVT/0082,Lưỡi gà trắng 95mm x 800m x 210gsm,Thăng Long,20/01/2026,120,Mới
KP-002,26/KHVT/0082,Lưỡi gà trắng 71mm x 800m x 210gsm,Thăng Long,21/01/2026,1800,Đang xử lý
KP-003,26/KHVT/0128,Lưỡi gà trắng 95mm x 800m x 210gsm,Thăng Long,12/02/2026,60,Mới
KP-004,26/KHVT/0128,Lưỡi gà trắng 71mm x 800m x 210gsm,Thăng Long,12/02/2026,1440,Mới`;

if (!content.includes('export const PRODUCT_DATA')) {
    content += '\nexport const PRODUCT_DATA = `' + PRODUCT_DATA + '`;\n';
}
if (!content.includes('export const DELIVERY_PLAN_DATA')) {
    content += '\nexport const DELIVERY_PLAN_DATA = `' + DELIVERY_PLAN_DATA + '`;\n';
}

fs.writeFileSync('src/data.ts', content);
