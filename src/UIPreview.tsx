import React, { useState } from 'react';
import { 
  Button, 
  IconButton, 
  Modal, 
  Drawer, 
  Field, 
  Input, 
  Select, 
  Textarea, 
  StatusBadge, 
  PageHeader, 
  DataTable, 
  Toolbar,
  Column
} from './components/ui';
import { Plus, Download, Edit2, Trash2, CheckCircle2, AlertTriangle, FileText, Settings, Shield } from 'lucide-react';

export default function UIPreview() {
  const [modalOpen, setModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');

  const sampleData = [
    { id: 'PO-2026-001', customer: 'Công ty Cổ phần Bao Bì Á Châu', amount: 154200000, status: 'ok', statusText: 'Đã hoàn thành', date: '04/10/2026' },
    { id: 'PO-2026-002', customer: 'Tập đoàn Nhựa Tiền Phong', amount: 89500000, status: 'warn', statusText: 'Chờ giao hàng', date: '03/10/2026' },
    { id: 'PO-2026-003', customer: 'Công ty TNHH Song Long Plastic', amount: 312000000, status: 'info', statusText: 'Đang gia công', date: '02/10/2026' },
    { id: 'PO-2026-004', customer: 'Công ty CP Nhựa Duy Tân', amount: 45000000, status: 'bad', statusText: 'Chậm thanh toán', date: '01/10/2026' },
  ];

  const columns: Column<typeof sampleData[0]>[] = [
    { key: 'id', header: 'Mã Đơn Hàng', render: (r) => <span className="font-mono font-bold text-brand">{r.id}</span> },
    { key: 'customer', header: 'Khách Hàng', render: (r) => <span className="font-semibold text-ink">{r.customer}</span> },
    { key: 'amount', header: 'Giá Trị (VNĐ)', align: 'right', render: (r) => r.amount.toLocaleString('vi-VN') + ' đ' },
    { 
      key: 'status', 
      header: 'Trạng Thái', 
      render: (r) => <StatusBadge tone={r.status as any}>{r.statusText}</StatusBadge> 
    },
    { key: 'date', header: 'Ngày Lập', align: 'center', render: (r) => <span className="text-ink-3">{r.date}</span> },
    {
      key: 'actions',
      header: 'Thao Tác',
      align: 'right',
      render: () => (
        <div className="flex items-center justify-end gap-1">
          <IconButton icon={<Edit2 size={13} />} label="Sửa" size="sm" />
          <IconButton icon={<Trash2 size={13} />} label="Xóa" size="sm" variant="danger" />
        </div>
      )
    }
  ];

  return (
    <div className="min-h-screen bg-canvas p-6 lg:p-10 space-y-8 font-sans text-ink">
      {/* Page Header */}
      <PageHeader
        title="Ledger Pro — Design System Showcase"
        description="Bản đối chiếu kiểm chuẩn hệ thống Design Tokens & Bộ Component dùng chung"
        badge={<StatusBadge tone="ok">v2.0 Verified</StatusBadge>}
        actions={
          <>
            <Button variant="secondary" icon={<Download size={14} />}>Xuất Bản Vẽ</Button>
            <Button variant="primary" icon={<Plus size={14} />} onClick={() => setModalOpen(true)}>Thử Nghiệm Modal</Button>
          </>
        }
      />

      {/* Section 1: Buttons & IconButtons */}
      <div className="bg-surface p-6 rounded-card border border-line shadow-card space-y-4">
        <h2 className="text-sm font-bold text-ink uppercase tracking-wider font-display">1. Buttons & Icon Buttons</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary">Primary Button</Button>
          <Button variant="secondary">Secondary Button</Button>
          <Button variant="subtle">Subtle Button</Button>
          <Button variant="ghost">Ghost Button</Button>
          <Button variant="danger">Danger Button</Button>
          <Button variant="primary" loading>Loading...</Button>
          <Button variant="primary" icon={<Plus size={14} />}>With Icon</Button>
          <div className="h-5 w-px bg-line" />
          <IconButton icon={<Plus size={15} />} label="Thêm mới" variant="secondary" />
          <IconButton icon={<Settings size={15} />} label="Cài đặt" variant="ghost" />
          <IconButton icon={<Trash2 size={15} />} label="Xóa" variant="danger" />
        </div>
      </div>

      {/* Section 2: Status Badges */}
      <div className="bg-surface p-6 rounded-card border border-line shadow-card space-y-4">
        <h2 className="text-sm font-bold text-ink uppercase tracking-wider font-display">2. Semantic Status Badges (Ledger Pro)</h2>
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge tone="ok">Hoàn tất / Đạt chuẩn</StatusBadge>
          <StatusBadge tone="warn">Chờ duyệt / Cảnh báo</StatusBadge>
          <StatusBadge tone="bad">Quá hạn / Từ chối</StatusBadge>
          <StatusBadge tone="info">Đang xử lý / Thông tin</StatusBadge>
          <StatusBadge tone="neutral">Chưa phân loại</StatusBadge>
          <StatusBadge tone="ok" icon={<CheckCircle2 size={12} />}>Có Icon Riêng</StatusBadge>
        </div>
      </div>

      {/* Section 3: Forms */}
      <div className="bg-surface p-6 rounded-card border border-line shadow-card space-y-4">
        <h2 className="text-sm font-bold text-ink uppercase tracking-wider font-display">3. Form Fields & Inputs</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Tên công ty / Khách hàng" required hint="Tên pháp lý đầy đủ trên giấy phép kinh doanh">
            <Input placeholder="VD: Công ty TNHH Nhựa Quốc Tế..." />
          </Field>
          <Field label="Nhóm phân loại">
            <Select>
              <option>Khách hàng chiến lược (VIP)</option>
              <option>Khách hàng thường xuyên</option>
              <option>Đối tác tiềm năng</option>
            </Select>
          </Field>
          <Field label="Trường báo lỗi kiểm tra" error="Vui lòng nhập định dạng số hợp lệ">
            <Input error defaultValue="abc-invalid" />
          </Field>
        </div>
      </div>

      {/* Section 4: Toolbar & DataTable */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-ink uppercase tracking-wider font-display">4. Toolbar & Data Table</h2>
        <Toolbar
          searchQuery={search}
          onSearchChange={setSearch}
          searchPlaceholder="Tìm kiếm mã PO, đối tác..."
          tabs={[
            { id: 'all', label: 'Tất cả đơn hàng', count: 124 },
            { id: 'active', label: 'Đang thực hiện', count: 18 },
            { id: 'done', label: 'Đã hoàn tất', count: 98 },
            { id: 'pending', label: 'Quá hạn', count: 8 },
          ]}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          actions={
            <Button variant="secondary" size="sm" onClick={() => setDrawerOpen(true)}>
              Mở Drawer Tra Cứu
            </Button>
          }
        />

        <DataTable
          columns={columns}
          data={sampleData}
          onRowClick={(row) => alert(`Click row: ${row.id}`)}
        />
      </div>

      {/* Test Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Tạo Đơn Hàng PO Mới"
        subtitle="Khởi tạo phiếu đặt hàng với nhà cung cấp hoặc khách hàng"
        icon={<FileText size={16} />}
        size="md"
        maximizable
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Hủy Bỏ</Button>
            <Button variant="primary" onClick={() => setModalOpen(false)}>Lưu & Xác Nhận</Button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          <Field label="Khách hàng" required>
            <Input placeholder="Chọn khách hàng..." defaultValue="Công ty Cổ phần Bao Bì Á Châu" />
          </Field>
          <Field label="Ghi chú điều khoản">
            <Textarea rows={3} placeholder="Ghi chú thanh toán, địa điểm giao nhận..." />
          </Field>
        </div>
      </Modal>

      {/* Test Drawer */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Hồ Sơ Đơn Hàng Chi Tiết"
        subtitle="Tra cứu nhanh thông số & chứng từ đi kèm"
        icon={<Shield size={16} />}
        width="md"
        footer={
          <Button variant="secondary" onClick={() => setDrawerOpen(false)} className="w-full">
            Đóng Panel
          </Button>
        }
      >
        <div className="space-y-3 text-xs">
          <div className="p-3 bg-subtle rounded-control">
            <span className="font-semibold text-ink block">Mã PO: PO-2026-001</span>
            <span className="text-ink-3">Khách hàng: Công ty Cổ phần Bao Bì Á Châu</span>
          </div>
          <p className="text-ink-3">
            Toàn bộ các Drawer và Modal trong Ledger Pro tuân thủ chuẩn: đóng bằng ESC, click backdrop, hoặc nút [✕] duy nhất góc phải.
          </p>
        </div>
      </Drawer>
    </div>
  );
}
