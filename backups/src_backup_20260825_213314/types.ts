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

export type ChatMessage = {
  id: string;
  role: "user" | "model";
  content: string;
  timestamp: string;
};
