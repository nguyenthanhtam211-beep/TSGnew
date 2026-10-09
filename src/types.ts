export type ProductLine = {
  id: string;
  sku: string;
  name: string;
  spec: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  supplier: string;
  purchasePrice?: number;
};

export type POHeader = {
  id: string;
  poNumber: string;
  customer: string;
  receiveDate: string;
  deliveryAddress: string;
  deliveryFrom: string;
  deliveryTo: string;
  totalValue: number;
  status: "Mới nhận" | "Đang xử lý" | "Đang giao" | "Hoàn tất" | "Hủy";
  lines: ProductLine[];
};

export type DeliveryRecord = {
  id: string;
  pxkNumber: string;
  poNumber: string;
  deliveryDate: string;
  deliverer: string;
  receiver: string;
  lines: {
    sku: string;
    name: string;
    deliveredQuantity: number;
    receivedQuantity: number;
  }[];
  status: "Chờ phê duyệt" | "Đã phê duyệt" | "Có sai lệch" | "Từ chối";
};

export type PODItemRow = {
  index?: number;
  code?: string;
  name: string;
  unit: string;
  dispatchedQty: number;   // Số lượng xuất / giao
  receivedQty: number;     // Số lượng thực nhận
  discrepancyQty?: number; // Số lượng chênh lệch (thiếu / thừa)
  notes?: string;
  matchedPoLineStt?: string; // Khớp với dòng PO STT nào
  matchedPoLine?: any;       // Đối tượng PO line tương ứng
  matchedPoLineName?: string;
  matchConfidence?: number;  // % độ khớp
};

export type PODOCRResult = {
  documentType: "PXK" | "PO" | "Invoice" | "Unknown";
  documentTypeName: string;
  documentNumber: string;       // Số PXK / Số BBGH
  documentReference?: string;   // Số PO tham chiếu (căn cứ theo PO...)
  documentDate: string;        // Ngày lập phiếu (DD/MM/YYYY)
  deliveryDate?: string;       // Ngày giao hàng
  buyerName: string;           // Khách hàng nhận
  buyerTaxCode?: string;
  buyerAddress?: string;
  sellerName: string;          // Đơn vị giao / Nhà máy
  sellerTaxCode?: string;
  sellerAddress?: string;
  receiverName?: string;       // Người nhận hàng / Thủ kho
  hasReceiverSignature: boolean; // Có chữ ký bên nhận hay không
  hasBuyerStamp: boolean;      // Có dấu mộc đỏ công ty bên mua hay không
  hasShipperSignature: boolean;// Có chữ ký lái xe / người giao hay không
  carrierName?: string;        // Đơn vị vận chuyển / Tên lái xe
  licensePlate?: string;       // Biển số xe giao hàng
  handwrittenNotes?: string;   // Bút phê viết tay, ghi chú phát sinh
  items: PODItemRow[];
  driveFileUrl?: string;       // Đường link file PDF/Ảnh scan trên Google Drive
  driveFileId?: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "model";
  content: string;
  timestamp: string;
};

