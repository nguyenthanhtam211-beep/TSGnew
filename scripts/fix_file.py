import re

with open('src/components/WorkflowView.tsx', 'r') as f:
    content = f.read()

# We need to find `const financialSummary = useMemo(() => {` and everything down to `return (\n    <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">`
# and replace it with a clean version.

replacement = """  const financialSummary = useMemo(() => {
    let revenueSum = 0;
    let cogsSum = 0;
    deliveryData.filter(d => !d.isDeleted).forEach(d => {
      const qty = parseNumber(d["Số lượng giao"]);
      const buyPrice = parseNumber(d["Đơn giá nhập"]);
      const sellPrice = parseNumber(d["Đơn giá bán"]);
      revenueSum += sellPrice * qty;
      cogsSum += buyPrice * qty;
    });

    const profitSum = revenueSum - cogsSum;
    const marginAvg = revenueSum > 0 ? (profitSum / revenueSum) * 100 : 0;

    return { revenueSum, cogsSum, profitSum, marginAvg };
  }, [deliveryData]);

  const receivablesByCustomer = useMemo(() => {
    const map = new Map<string, number>();
    deliveryData.filter(d => !d.isDeleted && d["AccountingStatus"] !== "Đã thu tiền").forEach(d => {
      const rev = parseNumber(d["Doanh thu"] || (parseNumber(d["Đơn giá bán"]) * parseNumber(d["Số lượng giao"])));
      const cust = d["Khách hàng"] || "Khác";
      map.set(cust, (map.get(cust) || 0) + rev);
    });
    return Array.from(map.entries()).map(([name, val]) => ({ name, val }));
  }, [deliveryData]);

  const payablesBySupplier = useMemo(() => {
    const map = new Map<string, number>();
    deliveryData.filter(d => !d.isDeleted && d["AccountingStatus"] !== "Đã chi tiền").forEach(d => {
      const cost = parseNumber(d["Đơn giá nhập"]) * parseNumber(d["Số lượng giao"]);
      const supp = d["Nhà cung cấp"] || "Khác";
      map.set(supp, (map.get(supp) || 0) + cost);
    });
    return Array.from(map.entries()).map(([name, val]) => ({ name, val }));
  }, [deliveryData]);

  const handleUpdateAccountingStatus = async (deliveryId: string, statusType: "AccountingStatus" | "InvoiceStatus", value: string) => {
    const loadToast = toast.loading("Đang cập nhật chứng từ...");
    try {
      await updateDoc(doc(db, "deliveries", deliveryId), {
        [statusType]: value
      });
      toast.success("Đã cập nhật trạng thái kế toán thành công!", { id: loadToast });
    } catch (err) {
      console.error(err);
      toast.error("Không thể cập nhật trạng thái!", { id: loadToast });
    }
  };

  const handleExportAccountantExcel = () => {
    try {
      const wb = XLSX.utils.book_new();
      const activeDeliveries = deliveryData.filter(d => !d.isDeleted);
      
      let totalRev = 0;
      let totalCost = 0;
      let totalProfit = 0;

      const customerPnl: Record<string, { rev: number, cost: number, prof: number }> = {};
      const productPnl: Record<string, { rev: number, cost: number, prof: number }> = {};

      const deliveryRows = activeDeliveries.map((d, index) => {
        const qty = parseNumber(d["Số lượng giao"]);
        const buyPrice = parseNumber(d["Đơn giá nhập"]);
        const sellPrice = parseNumber(d["Đơn giá bán"]);
        const rev = sellPrice * qty;
        const cost = buyPrice * qty;
        const prof = rev - cost;

        totalRev += rev;
        totalCost += cost;
        totalProfit += prof;

        const cust = d["Khách hàng"] || "Chưa xác định";
        if (!customerPnl[cust]) customerPnl[cust] = { rev: 0, cost: 0, prof: 0 };
        customerPnl[cust].rev += rev;
        customerPnl[cust].cost += cost;
        customerPnl[cust].prof += prof;

        const prod = d["Tên sản phẩm"] || "Chưa xác định";
        if (!productPnl[prod]) productPnl[prod] = { rev: 0, cost: 0, prof: 0 };
        productPnl[prod].rev += rev;
        productPnl[prod].cost += cost;
        productPnl[prod].prof += prof;

        return {
          "STT": index + 1,
          "Mã PXK": d["Số PXK"] || "",
          "Mã Đơn hàng PO": d["Đơn hàng"] || "",
          "Khách hàng": cust,
          "Nhà cung cấp/Vận chuyển": d["Nhà cung cấp"] || "",
          "Sản phẩm": prod,
          "Số lượng": qty,
          "Đơn vị tính": d["ĐVT"] || "",
          "Đơn giá mua": buyPrice,
          "Đơn giá bán": sellPrice,
          "Doanh thu (VND)": rev,
          "Giá vốn mua (VND)": cost,
          "Lợi nhuận gộp (VND)": prof,
          "Ngày giao hàng": d["Ngày giao"] || "",
          "Trạng thái đối soát": d["AccountingStatus"] || "Đang xử lý",
          "Trạng thái hóa đơn": d["InvoiceStatus"] || "Chưa xuất"
        };
      });

      const pnlData = [
        ["BÁO CÁO KẾT QUẢ KINH DOANH"],
        [`Ngày xuất báo cáo: ${new Date().toLocaleDateString('vi-VN')}`],
        [],
        ["I. KẾT QUẢ TỔNG HỢP", "", "GIÁ TRỊ (VNĐ)"],
        ["1. Tổng doanh thu bán hàng", "", totalRev],
        ["2. Tổng giá vốn hàng bán", "", totalCost],
        ["3. Lợi nhuận gộp", "", totalProfit],
        ["4. Tỷ suất lợi nhuận / Doanh thu", "", totalRev > 0 ? `${((totalProfit / totalRev) * 100).toFixed(2)}%` : "0%"],
        [],
        ["II. CHI TIẾT THEO KHÁCH HÀNG", "DOANH THU", "GIÁ VỐN", "LỢI NHUẬN GỘP", "TỶ SUẤT LN"],
      ];

      Object.entries(customerPnl).sort((a, b) => b[1].prof - a[1].prof).forEach(([cName, cData]) => {
        pnlData.push([
          cName, 
          cData.rev, 
          cData.cost, 
          cData.prof,
          cData.rev > 0 ? `${((cData.prof / cData.rev) * 100).toFixed(2)}%` : "0%"
        ]);
      });

      pnlData.push([]);
      pnlData.push(["III. CHI TIẾT THEO SẢN PHẨM", "DOANH THU", "GIÁ VỐN", "LỢI NHUẬN GỘP", "TỶ SUẤT LN"]);

      Object.entries(productPnl).sort((a, b) => b[1].prof - a[1].prof).forEach(([pName, pData]) => {
        pnlData.push([
          pName, 
          pData.rev, 
          pData.cost, 
          pData.prof,
          pData.rev > 0 ? `${((pData.prof / pData.rev) * 100).toFixed(2)}%` : "0%"
        ]);
      });

      const wsPnL = XLSX.utils.aoa_to_sheet(pnlData);
      
      wsPnL['!cols'] = [
        { wch: 40 },
        { wch: 20 },
        { wch: 20 },
        { wch: 20 },
        { wch: 15 }
      ];

      XLSX.utils.book_append_sheet(wb, wsPnL, "KQ Kinh Doanh");

      const wsDeliveries = XLSX.utils.json_to_sheet(deliveryRows);
      XLSX.utils.book_append_sheet(wb, wsDeliveries, "Data Giao Hàng");

      const customerRows = receivablesByCustomer.map((c, idx) => ({
        "STT": idx + 1,
        "Tên Khách Hàng": c.name,
        "Công nợ phải thu (VND)": c.val
      }));
      const wsCustomers = XLSX.utils.json_to_sheet(customerRows);
      XLSX.utils.book_append_sheet(wb, wsCustomers, "Công nợ Phải Thu");

      const supplierRows = payablesBySupplier.map((s, idx) => ({
        "STT": idx + 1,
        "Nhà Cung Cấp / Vận Chuyển": s.name,
        "Công nợ phải trả (VND)": s.val
      }));
      const wsSuppliers = XLSX.utils.json_to_sheet(supplierRows);
      XLSX.utils.book_append_sheet(wb, wsSuppliers, "Công nợ Phải Trả");

      XLSX.writeFile(wb, `Bao_Cao_KQKD_TSG_${new Date().toISOString().split("T")[0]}.xlsx`);
      toast.success("Đã xuất báo cáo Excel thành công!");
    } catch (err) {
      console.error(err);
      toast.error("Gặp sự cố khi xuất tệp Excel!");
    }
  };
"""

start_str = 'const financialSummary = useMemo(() => {'
end_str = 'return (\n    <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">'

start_idx = content.find(start_str)
end_idx = content.find(end_str)

if start_idx != -1 and end_idx != -1:
    new_content = content[:start_idx] + replacement + "\n  " + content[end_idx:]
    with open('src/components/WorkflowView.tsx', 'w') as f:
        f.write(new_content)
    print("Success")
else:
    print(f"Failed to find indices. Start: {start_idx}, End: {end_idx}")

