import Papa from 'papaparse';
import fs from 'fs';

const CUSTOMER_DATA = `Customer_ID,Phân loại,Tình trạng,Ngày hoạt động,Địa chỉ,PO,PO_Details,Logo,Project,Sản phẩm 2026,Hợp đồng,Tên đầy đủ,Công nợ phải thu,Ghi chú quan hệ,Giá 2026,Thời gian
Thăng Long,Thuốc lá - Nhà sản xuất,Đang đàm phán,2006/01/06,"Lô CN01, KCN Thạch Thất - Quốc Oai, TP. Hà Nội",,,,,,,Công ty TNHH MTV Thuốc lá Thăng Long,,,
`;

console.log(Papa.parse(CUSTOMER_DATA.trim(), { header: true, skipEmptyLines: true }).data);
