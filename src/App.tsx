import * as XLSX from 'xlsx';
import HelpGuideModal from "./components/HelpGuideModal";
import HelpGuideView from "./components/HelpGuideView";
import { Toaster, toast } from 'react-hot-toast';
import React, { useState, useRef, useEffect, useMemo } from "react";
import { Send, Upload, FileText, CheckCircle, CalendarDays, Calendar, Database, Package, Truck, CreditCard, ChevronRight, ChevronDown, ChevronUp, Sparkles, ChevronLeft, Menu, Loader2, Bot, PlusCircle, Users, BookUser, LayoutDashboard, Search, Camera, Settings, HelpCircle, Download, Columns, GripVertical, Eye, EyeOff, X, Filter, AlertTriangle, TrendingUp, Edit, Trash2, Check, HardDrive, ShieldCheck, Printer, Scale, Percent, Layers, DollarSign, ArrowUpRight } from "lucide-react";
import { motion } from "motion/react";
import clsx from "clsx";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Papa from "papaparse";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { parse, isBefore, startOfDay } from "date-fns";
import { db, auth } from "./firebase";
import { collection, query, where, getDocs, addDoc, doc, setDoc, deleteDoc, writeBatch } from "firebase/firestore";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { ensureGoogleToken, openGoogleAuthTab } from "./lib/auth";
import { useFirestoreCollection, getItemKey } from "./hooks/useFirestoreCollection";
import dbEngine from "./lib/dbEngine";
import { calculateDeliveryFinances, parseNumber, calculatePOLineFinances, parseDateToISO, formatDateForDisplay } from './lib/business-logic';
import { SYSTEM_PROMPT } from "./prompt";
import { sendGeminiPrompt } from "./lib/gemini";
import { PRICING_DATA, PO_LINES_DATA, PO_HEADER_DATA, DELIVERY_DATA, CUSTOMER_DATA, SUPPLIER_DATA, CONTACT_DATA, PRODUCT_DATA, DELIVERY_PLAN_DATA, INITIAL_SPECS_DATA } from "./data";
import { 
  DashboardView, CustomerView, SupplierView, SettingsView, ContactView, 
  OCRView, TasksView, WorkflowView, DeliveryView, DeliveryPlanView, MasterCalendarView, LogisticsHubView, MemoryStorageModal, 
  StorageView, SpecsView, ContractsView, CommissionView, ProductsView, ProductDetailModal, PODetailModal, 
  ProductHoverCard, ProductCombobox, PricingCombobox, MacTrafficLights
} from "./components";
import { exportGenericTableToPDF } from './lib/pdf-exporter';
import { uploadFileDirectToGoogleDrive } from './lib/driveSync';

interface NavItemConfig {
  id: string;
  label: string;
  icon: React.ReactNode;
  iconBg?: string;
  badge?: string | number;
}

interface NavGroupConfig {
  id: string;
  title: string;
  badge?: string;
  items: NavItemConfig[];
}

const FULL_SYSTEM_PROMPT = `${SYSTEM_PROMPT}

=== DỮ LIỆU HỆ THỐNG HIỆN TẠI ===
[BẢNG GIÁ 2026]
${PRICING_DATA}

[PO HEADER]
${PO_HEADER_DATA}

[PO LINES]
${PO_LINES_DATA}

[GIAO HÀNG]
${DELIVERY_DATA}
=== KẾT THÚC ===`;

function parseCSV(csvText: string) {
  return Papa.parse(csvText.trim(), { header: true, skipEmptyLines: true }).data;
}

export default function App() {
  const [selectedProductDetails, setSelectedProductDetails] = useState<string | null>(null);
  const [selectedPoDetails, setSelectedPoDetails] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMemoryModalOpen, setIsMemoryModalOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  
  // 2-Way Deep Linking Cross-Module Navigation States
  const [targetCustomerId, setTargetCustomerId] = useState<string | null>(null);
  const [targetSupplierId, setTargetSupplierId] = useState<string | null>(null);
  const [targetContactId, setTargetContactId] = useState<string | null>(null);
  
  // Apple macOS Window & Sidebar States
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [menuSearchQuery, setMenuSearchQuery] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem("tsg_nav_collapsed_groups");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups(prev => {
      const next = { ...prev, [groupId]: !prev[groupId] };
      localStorage.setItem("tsg_nav_collapsed_groups", JSON.stringify(next));
      return next;
    });
  };

  const handleToggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.warn("Fullscreen request error:", err);
      });
    } else {
      document.exitFullscreen().catch(err => {
        console.warn("Exit fullscreen error:", err);
      });
    }
  };

  const handleNavigateToCustomer = (customerId: string) => {
    setTargetCustomerId(customerId);
    setActiveTab("customers");
  };

  const handleNavigateToSupplier = (supplierId: string) => {
    setTargetSupplierId(supplierId);
    setActiveTab("suppliers");
  };

  const handleNavigateToContact = (contactId: string) => {
    setTargetContactId(contactId);
    setActiveTab("contacts");
  };
  
  
  const initialPricing = useMemo(() => parseCSV(PRICING_DATA), []);
  const initialPOHeader = useMemo(() => parseCSV(PO_HEADER_DATA), []);
  const initialPOLines = useMemo(() => parseCSV(PO_LINES_DATA), []);
  const initialDelivery = useMemo(() => parseCSV(DELIVERY_DATA), []);
  const initialCustomer = useMemo(() => parseCSV(CUSTOMER_DATA), []);
  const initialSupplier = useMemo(() => parseCSV(SUPPLIER_DATA), []);
  const initialContact = useMemo(() => parseCSV(CONTACT_DATA), []);
  const initialProducts = useMemo(() => parseCSV(PRODUCT_DATA), []);
  const initialDeliveryPlan = useMemo(() => parseCSV(DELIVERY_PLAN_DATA), []);

  const pricingData = useFirestoreCollection('pricing', initialPricing);
  const poHeaderData = useFirestoreCollection('po_headers', initialPOHeader);
  const poLinesData = useFirestoreCollection('po_lines', initialPOLines);
  const deliveryData = useFirestoreCollection('deliveries', initialDelivery);
  const customerData = useFirestoreCollection('customers', initialCustomer);
  const supplierData = useFirestoreCollection('suppliers', initialSupplier);
  const contactData = useFirestoreCollection('contacts', initialContact);
  const productData = useFirestoreCollection('products', initialProducts);
  const deliveryPlanData = useFirestoreCollection('delivery_plans', initialDeliveryPlan);
  const specsData = useFirestoreCollection('specs', INITIAL_SPECS_DATA);
  const fileStorageData = useFirestoreCollection('file_storage', []);
  const contractsData = useFirestoreCollection('contracts', []);
  const commissionData = useFirestoreCollection('commissions', []);
  const [googleToken, setGoogleToken] = useState<string | null>(() => {
    return localStorage.getItem('google_access_token');
  });

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'google_access_token') {
        setGoogleToken(e.newValue);
        if (e.newValue) {
          toast.success('Đã đồng bộ Google Access Token từ Tab khác thành công!');
        }
      }
    };
    window.addEventListener('storage', handleStorage);

    const params = new URLSearchParams(window.location.search);
    if (params.get('action') === 'connect_google') {
      ensureGoogleToken([
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/spreadsheets'
      ], true).then((newToken) => {
        if (newToken) {
          setGoogleToken(newToken);
          toast.success('🎉 Đã kết nối Google thành công trong Tab mới! Bạn có thể đóng tab này.', { duration: 10000 });
        }
      }).catch((err) => {
        console.error('Auto connect error:', err);
      });
    }

    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const handleSignInGoogle = async (force: boolean = false) => {
    try {
      const token = await ensureGoogleToken([
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/spreadsheets'
      ], force);
      if (token) {
        setGoogleToken(token);
        if (force) {
          toast.success('Đã kết nối tài khoản Google thành công!');
        }
        return token;
      }
    } catch (error: any) {
      console.error('Google Sign-In Error:', error);
      if (force) {
        toast.error('Không thể kết nối Google: ' + (error.message || error));
      }
    }
    return null;
  };

  const handleCreateCalendarEvent = async (eventData: { summary: string, description: string, start: string, end: string, location?: string }) => {
    let token = googleToken;
    if (!token) {
      token = await handleSignInGoogle();
    }
    
    if (!token) return;

    try {
      const response = await fetch('/api/calendar/events', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(eventData)
      });

      const resText = await response.text();
      let errorData: any = null;
      try {
        errorData = JSON.parse(resText);
      } catch (e) {
        // Not JSON
      }

      if (!response.ok) {
        if (resText.includes('<!doctype') || resText.includes('<html')) {
          throw new Error('Xác thực Google bị gián đoạn trong khung iframe. Vui lòng Mở ứng dụng trong Tab mới.');
        }
        throw new Error(errorData?.error || 'Failed to create calendar event');
      }

      toast.success('Đã thêm sự kiện vào Google Calendar!');
    } catch (error) {
      console.error('Calendar Event Error:', error);
      toast.error('Lỗi khi thêm sự kiện vào Calendar.');
    }
  };

  const enrichedPricingData = useMemo(() => {
    return pricingData.map(row => {
      const product = productData.find(p => p['Mã sản phẩm'] === row['Mã sản phẩm']);
      if (product) {
        return {
          ...row,
          'Tên sản phẩm': product['Tên sản phẩm'] || row['Tên sản phẩm'],
          'ĐVT': product['Đơn Vị Tính'] || row['ĐVT'],
          'Nhóm sản phẩm': product['Nhóm hàng'] || row['Nhóm sản phẩm'],
        };
      }
      return row;
    });
  }, [pricingData, productData]);

  const enrichedPoLinesData = useMemo(() => {
    return poLinesData.map(row => {
      let productCode = row['Mã của khách']?.split(',')[0];
      const priceRow = pricingData.find(p => p['Mã giá bán'] === row['Mã giá bán']);
      if (priceRow && priceRow['Mã sản phẩm']) {
          productCode = priceRow['Mã sản phẩm'];
      }
      
      const product = productData.find(p => p['Mã sản phẩm'] === productCode || p['Mã sản phẩm'] === row['Mã của khách']);
      
      const lineFinances = calculatePOLineFinances(row, pricingData);

      // Calculate real-time delivery metrics dynamically from delivery slips
      const lineId = row['STT'];
      const associatedDeliveries = deliveryData.filter(d => !d.isDeleted && d['Chi tiết đơn hàng'] === lineId);
      const totalDelivered = associatedDeliveries.reduce((sum, d) => sum + parseNumber(d['Số lượng giao']), 0);
      const ordered = parseNumber(row['Số lượng']);
      const remaining = Math.max(0, ordered - totalDelivered);
      const progressPercent = ordered > 0 ? (totalDelivered / ordered) * 100 : 0;
      const progressString = `${progressPercent.toFixed(1).replace('.0', '')}%`;
      const isCompleted = totalDelivered >= ordered ? "1" : "0";

      const enrichedRow = {
        ...row,
        'Số lượng': (ordered || 0).toLocaleString('en-US'),
        'Đã giao': (totalDelivered || 0).toLocaleString('en-US'),
        'Còn lại': (remaining || 0).toLocaleString('en-US'),
        'Tiến độ sản phẩm': progressString,
        'Tiến độ giao': progressString,
        'Hoàn thành': isCompleted,
        'Doanh thu': (lineFinances.revenue || 0).toLocaleString('en-US'),
        'Đơn giá bán': (lineFinances.sellPrice || 0).toLocaleString('en-US'),
      };

      if (product) {
        enrichedRow['Tên sản phẩm'] = product['Tên sản phẩm'] || row['Tên sản phẩm'];
        enrichedRow['ĐVT'] = product['Đơn Vị Tính'] || row['ĐVT'];
        enrichedRow['Nhóm hàng'] = product['Nhóm hàng'] || row['Nhóm hàng'];
      }
      return enrichedRow;
    });
  }, [poLinesData, pricingData, productData, deliveryData]);

  const enrichedDeliveryPlanData = useMemo(() => {
    return deliveryPlanData.map(row => {
      const product = productData.find(p => p['Tên sản phẩm'] === row['Sản phẩm'] || p['Mã sản phẩm'] === row['Sản phẩm']);
      if (product) {
        return {
          ...row,
          'Sản phẩm': product['Tên sản phẩm'] || row['Sản phẩm']
        };
      }
      return row;
    });
  }, [deliveryPlanData, productData]);

  const enrichedDeliveryData = useMemo(() => {
    return deliveryData.map(row => {
      const finances = calculateDeliveryFinances(row, pricingData, poLinesData);
      const poLine = poLinesData.find(l => !l.isDeleted && l['STT'] === row['Chi tiết đơn hàng']);
      
      let productCode = finances.priceCode !== 'N/A' ? finances.priceCode : (row['Mã sản phẩm'] || (poLine ? poLine['Mã của khách'] : ''));
      const product = productData.find(p => p['Mã sản phẩm'] === productCode);

      const qtyDeliveredThisSlip = parseNumber(row['Số lượng giao']);
      const associatedDeliveries = deliveryData.filter(d => !d.isDeleted && d['Chi tiết đơn hàng'] === row['Chi tiết đơn hàng']);
      const totalDeliveredForLine = associatedDeliveries.reduce((sum, d) => sum + parseNumber(d['Số lượng giao']), 0);
      const qtyOrdered = poLine ? parseNumber(poLine['Số lượng']) : parseNumber(row['Số lượng đặt']);
      
      const remainingForLine = Math.max(0, qtyOrdered - totalDeliveredForLine);
      const progressPercent = qtyOrdered > 0 ? (totalDeliveredForLine / qtyOrdered) * 100 : 0;
      const progressString = `${progressPercent.toFixed(1).replace('.0', '')}%`;

      const enrichedRow = {
        ...row,
        'Số lượng đặt': (qtyOrdered || 0).toLocaleString('en-US'),
        'Đã giao': (totalDeliveredForLine || 0).toLocaleString('en-US'),
        'Còn lại': (remainingForLine || 0).toLocaleString('en-US'),
        'Tiến độ giao': progressString,
        'Đơn giá bán': (finances.sellPrice || 0).toLocaleString('en-US'),
        'Đơn giá nhập': (finances.buyPrice || 0).toLocaleString('en-US'),
        'Doanh thu': (finances.revenue || 0).toLocaleString('en-US'),
        'Lợi nhuận gộp': (finances.profit || 0).toLocaleString('en-US'),
        '% Lợi nhuận': `${(finances.margin || 0).toFixed(2)}%`,
      };

      if (product) {
        enrichedRow['Tên sản phẩm'] = product['Tên sản phẩm'] || row['Tên sản phẩm'];
        enrichedRow['ĐVT'] = product['Đơn Vị Tính'] || row['ĐVT'];
        enrichedRow['Nhóm hàng'] = product['Nhóm hàng'] || row['Nhóm hàng'];
      }
      return enrichedRow;
    });
  }, [deliveryData, pricingData, productData, poLinesData]);

  const enrichedPoHeaderData = useMemo(() => {
    return poHeaderData.map((row, idx) => {
      const poNum = row['Đơn hàng'];
      const lines = enrichedPoLinesData.filter(l => !l.isDeleted && l['Số đơn hàng'] === poNum);
      
      const totalValue = lines.reduce((sum, l) => sum + parseNumber(l['Doanh thu']), 0);
      
      // Calculate overall status
      const totalLines = lines.length;
      const completedLines = lines.filter(l => l['Hoàn thành'] === "1").length;
      
      let status = row['Trạng Thái'] || 'Mới';
      if (totalLines > 0) {
        if (completedLines === totalLines) {
          status = 'Hoàn thành';
        } else if (completedLines > 0) {
          status = 'Đang giao';
        } else {
          // Check if any delivery exists
          const hasDeliveries = deliveryData.some(d => !d.isDeleted && lines.some(l => l['STT'] === d['Chi tiết đơn hàng']));
          if (hasDeliveries) {
            status = 'Đang xử lý';
          }
        }
      }

      return {
        'STT': idx + 1,
        ...row,
        'Tổng giá trị đơn hàng': (totalValue || 0).toLocaleString('en-US'),
        'Trạng Thái': status
      };
    });
  }, [poHeaderData, enrichedPoLinesData, deliveryData]);


  const handleAddToFirestore = async (colName: string, row: any) => {
    try {
      const cleanedRow: any = {};
      Object.keys(row || {}).forEach(k => {
        if (row[k] !== undefined) cleanedRow[k] = row[k];
      });

      await dbEngine.save(colName as any, cleanedRow);
    } catch (err) {
      console.error(`Failed to add to ${colName}`, err);
    }
  };

  const handleBatchAddToFirestore = async (colName: string, rows: any[]) => {
    if (!rows || rows.length === 0) return;
    try {
      for (const row of rows) {
        const cleanedRow: any = {};
        Object.keys(row || {}).forEach(k => {
          if (row[k] !== undefined) cleanedRow[k] = row[k];
        });
        await dbEngine.save(colName as any, cleanedRow);
      }
    } catch (err) {
      console.error(`Failed to batch add to ${colName}`, err);
    }
  };

  const handleUpdateToFirestore = async (colName: string, row: any) => {
    try {
      const rawId = row.id || getItemKey(row, colName) || row['Mã sản phẩm'] || row['SKU'] || row['Mã hàng'];
      if (!rawId) {
        throw new Error("Không thể xác định ID của dòng dữ liệu");
      }
      
      // Clean data: remove only transient summary/analytics calculations before saving
      const dataToSave = { ...row };
      
      // Remove temporary runtime UI calculations, but NEVER delete Tên sản phẩm, ĐVT, or business keys
      const transientFields = [
        'id', 'Doanh thu dự kiến', 'Lợi nhuận dự kiến', 'Tiến độ', 'Số dòng', 'Status',
        'Doanh thu', 'Lợi nhuận gộp', 'Tiến độ giao', 'isOverdue', 'qtyOrdered', 
        'qtyDelivered', 'remainingQty', 'currentRevenue', 'currentProfit', 'margin', 
        'isDelayed', 'isReconciled'
      ];
      transientFields.forEach(field => delete dataToSave[field]);
      
      // Explicitly protect core product fields
      if (row['Tên sản phẩm']) dataToSave['Tên sản phẩm'] = row['Tên sản phẩm'];
      if (row['Mã sản phẩm']) dataToSave['Mã sản phẩm'] = row['Mã sản phẩm'];
      if (row['Đơn Vị Tính']) dataToSave['Đơn Vị Tính'] = row['Đơn Vị Tính'];
      
      await dbEngine.save(colName as any, dataToSave);
    } catch (err) {
      console.error(`Failed to update ${colName}`, err);
      throw err;
    }
  };

  const handleDeleteFromFirestore = async (colName: string, row: any) => {
    try {
      const targetId = row.id || getItemKey(row, colName) || row['Mã sản phẩm'] || row['Mã hàng'] || row.Customer_ID || row['Mã nhà cung cấp'];
      if (targetId) {
        await dbEngine.delete(colName as any, targetId);
      }
      toast.success("Xóa thành công!");
    } catch (err) {
      console.error(`Failed to delete from ${colName}`, err);
      toast.error("Lỗi khi xóa!");
    }
  };

  const handleUploadToDrive = async (file: File, metadata: { documentType: string, documentNumber: string, fileName?: string }) => {
    try {
      const now = new Date();
      const year = now.getFullYear().toString();
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      const fileId = `file_${Date.now()}`;
      const fileNameToSave = metadata.fileName || file.name;

      // 1. Kiểm tra mã token Google hiện tại mà KHÔNG ép mở popup
      let token = googleToken || localStorage.getItem('google_access_token');

      let driveData: { driveFileId?: string; driveLink?: string; downloadLink?: string } = {};

      if (token) {
        try {
          // Tải trực tiếp lên Google Drive nếu đã có token
          const uploadRes = await uploadFileDirectToGoogleDrive({
            file,
            fileName: fileNameToSave,
            documentType: metadata.documentType,
            documentNumber: metadata.documentNumber,
            year,
            month,
            token
          });
          driveData = uploadRes;
          toast.success('🎉 Đã lưu trữ bản scan vào Google Drive!');
        } catch (driveErr: any) {
          console.warn('Google Drive background upload skipped:', driveErr?.message || driveErr);
          // Nếu token hết hạn thực sự, xóa để không gọi lại
          if (driveErr?.message?.includes('hết hạn') || driveErr?.message?.includes('401') || driveErr?.message?.includes('403')) {
            localStorage.removeItem('google_access_token');
            setGoogleToken(null);
          }
        }
      }

      // 2. Luôn lưu thông tin tài liệu vào cơ sở dữ liệu hệ thống (Local Cache + Firestore)
      await handleAddToFirestore('file_storage', {
        id: fileId,
        fileId,
        driveFileId: driveData.driveFileId || `local_${fileId}`,
        fileName: fileNameToSave,
        mimeType: file.type,
        documentType: metadata.documentType,
        documentNumber: metadata.documentNumber,
        uploadDate: now.toISOString(),
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        driveLink: driveData.driveLink || '',
        downloadLink: driveData.downloadLink || '',
        syncedToDrive: Boolean(driveData.driveFileId)
      });

    } catch (error: any) {
      console.warn('Background handleUploadToDrive error:', error);
    }
  };

  const navGroups: NavGroupConfig[] = useMemo(() => [
    {
      id: "executive",
      title: "Tổng Quan & Điều Hành",
      badge: "2",
      items: [
        { id: "dashboard", label: "Bàn Làm Việc & Báo Cáo", icon: <LayoutDashboard size={15} />, iconBg: "bg-blue-500" },
        { id: "workflow", label: "Quy Trình Nghiệp Vụ 5 Bước", icon: <TrendingUp size={15} />, iconBg: "bg-indigo-500" },
      ]
    },
    {
      id: "logistics",
      title: "Kinh Doanh & Logistics",
      badge: "2",
      items: [
        { id: "po", label: "Quản Lý Đơn Hàng PO", icon: <FileText size={15} />, iconBg: "bg-teal-500", badge: poHeaderData.length },
        { id: "logistics", label: "Kế Hoạch & Giao Hàng 360°", icon: <Truck size={15} />, iconBg: "bg-orange-500", badge: deliveryData.length },
      ]
    },
    {
      id: "commercial",
      title: "Thương Mại & Danh Mục",
      badge: "3",
      items: [
        { id: "customers", label: "Khách Hàng & Đối Tác", icon: <Users size={15} />, iconBg: "bg-sky-500", badge: customerData.length },
        { id: "pricing", label: "Bảng Giá, Hợp Đồng & Hoa Hồng", icon: <Package size={15} />, iconBg: "bg-emerald-500", badge: pricingData.length },
        { id: "products", label: "Sản Phẩm & Tiêu Chuẩn Specs", icon: <Package size={15} />, iconBg: "bg-purple-500", badge: productData.length },
      ]
    },
    {
      id: "ai_storage",
      title: "AI & Trung Tâm Lưu Trữ",
      badge: "4",
      items: [
        { id: "ocr", label: "Quét OCR & Định Giá", icon: <Camera size={15} />, iconBg: "bg-indigo-600" },
        { id: "assistant", label: "Trợ Lý AI Gemini", icon: <Bot size={15} />, iconBg: "bg-gradient-to-tr from-purple-500 to-indigo-500" },
        { id: "storage", label: "Kho Tệp & Sổ Đối Soát", icon: <HardDrive size={15} />, iconBg: "bg-slate-500", badge: fileStorageData.length },
        { id: "tasks", label: "Công Việc & Lịch Hạn", icon: <CheckCircle size={15} />, iconBg: "bg-green-600" },
      ]
    },
    {
      id: "system",
      title: "Hệ Thống",
      items: [
        { id: "help", label: "Trợ Giúp & Hướng Dẫn", icon: <HelpCircle size={15} />, iconBg: "bg-blue-600", badge: "Cẩm nang" },
        { id: "settings", label: "Cài Đặt Hệ Thống", icon: <Settings size={15} />, iconBg: "bg-slate-600" }
      ]
    }
  ], [poHeaderData.length, deliveryData.length, customerData.length, pricingData.length, productData.length, fileStorageData.length]);

  const TAB_TITLES: Record<string, string> = {
    dashboard: "Bảng Điều Hành",
    workflow: "Quy Trình Nghiệp Vụ",
    customers: "Quản Lý Khách Hàng",
    pricing: "Bảng Giá 2026",
    po: "Đơn Hàng (PO)",
    polines: "Chi Tiết Đơn Hàng",
    delivery_plan: "Kế Hoạch Giao",
    delivery: "Giao Hàng (PXK)",
    profit_report: "Báo Cáo Lợi Nhuận",
    products: "Sản Phẩm",
    specs: "Tiêu Chuẩn Specs",
    suppliers: "Nhà Cung Cấp",
    contacts: "Danh Bạ",
    assistant: "Trợ Lý AI",
    ocr: "Quét OCR",
    tasks: "Công Việc & Lịch",
    storage: "Kho Lưu Trữ",
    help: "Trợ Giúp & Hướng Dẫn",
    settings: "Cài Đặt"
  };

  const navItemClick = (tab: string) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-gray-50 text-gray-900 font-sans print:bg-white print:h-auto print:block overflow-hidden">
      <Toaster position="top-right" />

      {/* Mobile Top Header - Apple iOS Style */}
      <div className="lg:hidden flex items-center justify-between pl-[max(env(safe-area-inset-left),16px)] pr-[max(env(safe-area-inset-right),16px)] py-2 landscape:py-1.5 ios-glass text-[#1D1D1F] border-b border-black/[0.06] shrink-0 z-40 shadow-2xs pt-[max(env(safe-area-inset-top),8px)] select-none">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 -ml-1 text-slate-700 hover:text-slate-900 rounded-xl hover:bg-black/[0.04] active:scale-95 transition-all"
            aria-label="Mở menu"
          >
            <Menu size={20} />
          </button>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#007AFF] shadow-[0_0_8px_rgba(0,122,255,0.4)]" />
              <h1 className="text-sm font-bold text-[#1D1D1F] tracking-tight">TSG BUSINESS OS</h1>
            </div>
            <p className="text-[11px] text-slate-500 font-medium truncate max-w-[160px]">{TAB_TITLES[activeTab] || activeTab}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button 
            onClick={() => setIsMemoryModalOpen(true)} 
            className="p-2 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl active:scale-95 transition-all flex items-center gap-1 text-xs font-semibold" 
            title="Trung tâm bộ nhớ & lưu trữ dữ liệu"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <Database size={15} />
          </button>
          <button 
            onClick={() => navItemClick("assistant")} 
            className={clsx(
              "p-2 rounded-xl transition-all flex items-center gap-1 text-xs font-semibold active:scale-95",
              activeTab === "assistant" 
                ? "bg-[#007AFF] text-white shadow-sm shadow-blue-500/20" 
                : "bg-black/[0.04] text-slate-700 hover:bg-black/[0.08]"
            )}
          >
            <Bot size={16} />
            <span className="font-bold">AI</span>
          </button>
          <button 
            type="button"
            onClick={() => setIsHelpModalOpen(true)} 
            className="p-2 text-slate-600 hover:text-blue-600 rounded-xl hover:bg-black/[0.04] active:scale-95 transition-all"
            title="Trợ Giúp & Cẩm Nang Sử Dụng"
          >
            <HelpCircle size={18} />
          </button>
          <button 
            onClick={() => navItemClick("settings")} 
            className="p-2 text-slate-600 hover:text-slate-900 rounded-xl hover:bg-black/[0.04] active:scale-95 transition-all"
          >
            <Settings size={18} />
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer - Apple iOS Light Sheet */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div 
            className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity" 
            onClick={() => setMobileMenuOpen(false)} 
          />
          <div className="relative w-4/5 max-w-xs bg-[#F5F5F7] flex flex-col text-[#1D1D1F] shadow-2xl h-full border-r border-black/[0.08] z-10 animate-in slide-in-from-left duration-200 pl-[max(env(safe-area-inset-left),0px)] pb-safe">
            <div className="p-4 border-b border-black/[0.06] flex items-center justify-between bg-white/70 backdrop-blur-md">
              <div className="flex items-center gap-2.5">
                <MacTrafficLights onClose={() => setMobileMenuOpen(false)} />
                <div className="h-4 w-px bg-black/[0.08]" />
                <h2 className="text-sm font-bold text-[#1D1D1F] tracking-tight">TSG BUSINESS OS</h2>
              </div>
              <button 
                onClick={() => setMobileMenuOpen(false)} 
                className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-black/[0.04]"
              >
                <X size={18} />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-3 custom-scrollbar">
              {navGroups.map(group => {
                const isGroupCollapsed = collapsedGroups[group.id];
                const hasActiveItem = group.items.some(it => it.id === activeTab);
                
                return (
                  <div key={group.id} className="space-y-1">
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.id)}
                      className="w-full flex items-center justify-between px-2.5 py-1 text-[10.5px] font-extrabold text-slate-500 hover:text-slate-800 uppercase tracking-wider transition rounded-lg hover:bg-black/[0.03]"
                    >
                      <span className="flex items-center gap-1.5 truncate">
                        <span>{group.title}</span>
                      </span>
                      <div className="flex items-center gap-1">
                        {group.badge && (
                          <span className="text-[9.5px] font-mono px-1.5 py-0.2 rounded-full bg-slate-200/80 text-slate-600">
                            {group.badge}
                          </span>
                        )}
                        {isGroupCollapsed && !hasActiveItem ? <ChevronRight size={13} className="text-slate-400" /> : <ChevronDown size={13} className="text-slate-400" />}
                      </div>
                    </button>

                    {(!isGroupCollapsed || hasActiveItem) && (
                      <div className="space-y-0.5 pl-0.5 animate-in fade-in duration-150">
                        {group.items.map(item => (
                          <NavItem
                            key={item.id}
                            icon={item.icon}
                            iconBg={item.iconBg}
                            label={item.label}
                            badge={item.badge}
                            isActive={activeTab === item.id}
                            onClick={() => navItemClick(item.id)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>

            <div className="p-3 border-t border-black/[0.06] bg-white/50 text-center">
              <p className="text-[10px] text-slate-400 font-medium">Tâm Sen Group • ERP Business OS</p>
            </div>
          </div>
        </div>
      )}

      {/* Desktop macOS Sequoia Sidebar */}
      <div className={clsx(
        "hidden lg:flex bg-[#F5F5F7]/95 backdrop-blur-2xl border-r border-black/[0.06] flex-col text-[#1D1D1F] shadow-[1px_0_10px_rgba(0,0,0,0.02)] print:hidden relative z-20 shrink-0 select-none transition-all duration-200",
        isSidebarCollapsed ? "w-16" : "w-64"
      )}>
        
        {/* macOS Window Controls & Title */}
        <div className="p-3.5 border-b border-black/[0.06] bg-white/40">
          {/* Functional Apple Traffic Lights */}
          <div className="flex items-center gap-2 mb-3">
            <button
              type="button"
              onClick={() => {
                if (selectedProductDetails || selectedPoDetails) {
                  setSelectedProductDetails(null);
                  setSelectedPoDetails(null);
                  toast.success("Đã đóng cửa sổ chi tiết", { icon: "🔴" });
                } else if (activeTab !== "dashboard") {
                  setActiveTab("dashboard");
                  toast("Đã trở về Bảng Điều Hành", { icon: "🔴" });
                }
              }}
              title="Đóng / Trở về Bảng Điều Hành (⌘W)"
              className="w-3 h-3 rounded-full bg-[#FF5F56] hover:bg-[#FF3B30] active:bg-[#E0443E] border border-[#E0443E]/60 shadow-2xs flex items-center justify-center text-[9px] text-red-950/0 hover:text-red-950 font-bold transition-all cursor-pointer"
            >
              ×
            </button>
            <button
              type="button"
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              title="Thu gọn / Mở rộng Sidebar (⌘M)"
              className="w-3 h-3 rounded-full bg-[#FFBD2E] hover:bg-[#FF9500] active:bg-[#DEA123] border border-[#DEA123]/60 shadow-2xs flex items-center justify-center text-[9px] text-amber-950/0 hover:text-amber-950 font-bold transition-all cursor-pointer"
            >
              –
            </button>
            <button
              type="button"
              onClick={handleToggleFullScreen}
              title="Toàn màn hình / Thu phóng (⌃⌘F)"
              className="w-3 h-3 rounded-full bg-[#27C93F] hover:bg-[#34C759] active:bg-[#1AAB29] border border-[#1AAB29]/60 shadow-2xs flex items-center justify-center text-[8px] text-green-950/0 hover:text-green-950 font-bold transition-all cursor-pointer"
            >
              ⤢
            </button>
          </div>

          {!isSidebarCollapsed && (
            <div className="flex items-center gap-2.5 animate-in fade-in duration-150">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#007AFF] to-[#5856D6] text-white flex items-center justify-center font-black text-xs shadow-sm shadow-blue-500/20">
                TSG
              </div>
              <div>
                <h1 className="text-xs font-bold text-[#1D1D1F] tracking-[-0.015em] leading-tight">TSG Business OS</h1>
                <p className="text-[10px] text-slate-500 font-medium">Tâm Sen Group • ERP 2026</p>
              </div>
            </div>
          )}

          {!isSidebarCollapsed && (
            <div className="mt-3 px-1">
              <button
                type="button"
                onClick={() => setIsMemoryModalOpen(true)}
                className="w-full flex items-center justify-between px-2.5 py-1.5 bg-emerald-50/90 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80 rounded-xl text-[11px] font-semibold transition active:scale-[0.98] shadow-2xs"
                title="Xem trạng thái bộ nhớ lưu trữ và sao lưu dữ liệu"
              >
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Bộ nhớ: Đã lưu an toàn</span>
                </div>
                <span className="text-[9.5px] font-mono font-bold bg-white/90 px-1.5 py-0.5 rounded border border-emerald-200 text-emerald-700">13 CSDL</span>
              </button>
            </div>
          )}
        </div>

        {/* Apple Source List Navigation */}
        <nav className="flex-1 overflow-y-auto py-2 space-y-3 custom-scrollbar px-2">
          {!isSidebarCollapsed && (
            <div className="px-1 mb-1.5">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                <input
                  type="text"
                  value={menuSearchQuery}
                  onChange={(e) => setMenuSearchQuery(e.target.value)}
                  placeholder="Tìm nhanh tính năng..."
                  className="w-full pl-7 pr-2 py-1 bg-black/[0.03] hover:bg-black/[0.05] focus:bg-white border border-transparent focus:border-blue-400 rounded-xl text-[11px] outline-none transition"
                />
                {menuSearchQuery && (
                  <button
                    onClick={() => setMenuSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
          )}

          {navGroups.map(group => {
            const q = menuSearchQuery.toLowerCase().trim();
            const filteredItems = q 
              ? group.items.filter(it => it.label.toLowerCase().includes(q) || it.id.toLowerCase().includes(q))
              : group.items;

            if (q && filteredItems.length === 0) return null;

            const isGroupCollapsed = collapsedGroups[group.id];
            const hasActiveItem = group.items.some(it => it.id === activeTab);
            const shouldShowItems = isSidebarCollapsed || (!isGroupCollapsed || hasActiveItem || Boolean(q));

            return (
              <div key={group.id} className="space-y-0.5">
                {!isSidebarCollapsed && (
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    className="w-full flex items-center justify-between px-2.5 py-1 text-[10px] font-bold text-slate-400 hover:text-slate-700 uppercase tracking-wider transition rounded-lg hover:bg-black/[0.03] cursor-pointer select-none"
                  >
                    <span className="truncate">{group.title}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {group.badge && (
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-slate-200/70 text-slate-500 font-semibold">
                          {group.badge}
                        </span>
                      )}
                      {isGroupCollapsed && !hasActiveItem && !q ? (
                        <ChevronRight size={12} className="text-slate-400" />
                      ) : (
                        <ChevronDown size={12} className="text-slate-400" />
                      )}
                    </div>
                  </button>
                )}

                {shouldShowItems && (
                  <div className="space-y-0.5">
                    {filteredItems.map(item => (
                      <NavItem
                        key={item.id}
                        icon={item.icon}
                        iconBg={item.iconBg}
                        label={item.label}
                        badge={item.badge}
                        isCollapsed={isSidebarCollapsed}
                        isActive={activeTab === item.id}
                        onClick={() => setActiveTab(item.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col overflow-y-auto min-h-0 print:overflow-visible print:h-auto print:block relative pb-20 lg:pb-0">
        {activeTab === "dashboard" && (
          <DashboardView 
            poData={poHeaderData} 
            deliveryData={enrichedDeliveryData} 
            poLinesData={enrichedPoLinesData} 
            customersData={customerData} 
            commissionData={commissionData}
          />
        )}
        {activeTab === "contracts" && (
          <ContractsView
            contractsData={contractsData}
            pricingData={pricingData}
            customerData={customerData}
            supplierData={supplierData}
            onAddContract={async (c) => await handleAddToFirestore("contracts", c)}
            onUpdateContract={async (c) => await handleUpdateToFirestore("contracts", c)}
            onDeleteContract={async (c) => await handleDeleteFromFirestore("contracts", c)}
          />
        )}
        {activeTab === "commissions" && (
          <CommissionView
            commissionData={commissionData}
            customerData={customerData}
            contactData={contactData}
            poHeaderData={poHeaderData}
            onAddCommission={async (c) => await handleAddToFirestore("commissions", c)}
            onUpdateCommission={async (c) => await handleUpdateToFirestore("commissions", c)}
            onDeleteCommission={async (c) => await handleDeleteFromFirestore("commissions", c)}
          />
        )}
        {activeTab === "workflow" && (
          <WorkflowView 
            pricingData={pricingData}
            poHeaderData={poHeaderData}
            poLinesData={enrichedPoLinesData}
            deliveryData={enrichedDeliveryData}
            customerData={customerData}
            supplierData={supplierData}
            productData={productData}
            deliveryPlanData={enrichedDeliveryPlanData}
            onProductClick={(val) => setSelectedProductDetails(val)}
            onPoClick={(val) => setSelectedPoDetails(val)}
          />
        )}
        {activeTab === "assistant" && <AssistantView />}
        {activeTab === "tasks" && <TasksView deliveryPlanData={enrichedDeliveryPlanData} poLinesData={enrichedPoLinesData} contacts={contactData} />}
        {activeTab === "ocr" && (
          <OCRView 
            pricingData={pricingData}
            contractsData={contractsData}
            productData={productData}
            poHeaders={poHeaderData}
            poLines={enrichedPoLinesData}
            deliveryPlans={enrichedDeliveryPlanData}
            onAddPOHeader={async (row) => await handleAddToFirestore("po_headers", row)}
            onAddPOLines={async (rows) => { await handleBatchAddToFirestore("po_lines", rows); }}
            onAddDelivery={async (rows) => { await handleBatchAddToFirestore("deliveries", rows); }}
            onUpdatePOLines={async (rows) => { for (const r of rows) await handleUpdateToFirestore("po_lines", r); }}
            onUpdateDeliveryPlan={async (rows) => { for (const r of rows) await handleUpdateToFirestore("delivery_plans", r); }}
            onUploadToDrive={handleUploadToDrive}
          />
        )}
        {activeTab === "customers" && (
          <CustomerView 
            initialData={customerData} 
            contacts={contactData} 
            targetCustomerId={targetCustomerId}
            onClearTargetCustomer={() => setTargetCustomerId(null)}
            onNavigateToSupplier={handleNavigateToSupplier}
            onNavigateToContact={handleNavigateToContact}
          />
        )}
        {activeTab === "suppliers" && (
          <SupplierView 
            initialData={supplierData} 
            contacts={contactData} 
            targetSupplierId={targetSupplierId}
            onClearTargetSupplier={() => setTargetSupplierId(null)}
            onNavigateToCustomer={handleNavigateToCustomer}
            onNavigateToContact={handleNavigateToContact}
          />
        )}
        {activeTab === "contacts" && (
          <ContactView 
            contacts={contactData} 
            customers={customerData} 
            suppliers={supplierData} 
            products={productData}
            poHeaders={poHeaderData}
            deliveries={deliveryData}
            targetContactId={targetContactId}
            onClearTargetContact={() => setTargetContactId(null)}
            onNavigateToCustomer={handleNavigateToCustomer}
            onNavigateToSupplier={handleNavigateToSupplier}
          />
        )}
        {activeTab === "pricing" && <TableView pricingData={pricingData} contractsData={contractsData} products={productData} suppliers={supplierData} poHeaders={poHeaderData} title="Bảng giá 2026 (Đối chiếu từ Hợp đồng)" data={pricingData} onEdit={(row) => handleUpdateToFirestore("pricing", row)} onDelete={(row) => handleDeleteFromFirestore("pricing", row)} onProductClick={(val) => setSelectedProductDetails(val)} onPoClick={(val) => setSelectedPoDetails(val)} specsData={specsData} />}
        {activeTab === "po" && (
          <TableView pricingData={pricingData} products={productData} suppliers={supplierData} poHeaders={poHeaderData} 
            title="Đơn hàng (PO_Header)" 
            data={enrichedPoHeaderData} 
            showAddButton={true} 
            onAdd={(row) => handleAddToFirestore("po_headers", row)} 
            onEdit={(row) => handleUpdateToFirestore("po_headers", row)} 
            onDelete={(row) => handleDeleteFromFirestore("po_headers", row)} 
            onProductClick={(val) => setSelectedProductDetails(val)} 
            onPoClick={(val) => setSelectedPoDetails(val)} 
            customers={customerData}
            poLines={poLinesData}
           
          />
        )}
        {activeTab === "polines" && (
          <TableView pricingData={pricingData} products={productData} suppliers={supplierData} poHeaders={poHeaderData} 
            title="Chi tiết đơn (PO_Lines)" 
            data={enrichedPoLinesData} 
            showAddButton={true} 
            onAdd={(row) => handleAddToFirestore("po_lines", row)} 
            onEdit={(row) => handleUpdateToFirestore("po_lines", row)} 
            onDelete={(row) => handleDeleteFromFirestore("po_lines", row)} 
            onProductClick={(val) => setSelectedProductDetails(val)} 
            onPoClick={(val) => setSelectedPoDetails(val)} 
            poLines={poLinesData}
            customers={customerData}
          />
        )}
        {activeTab === "profit_report" && (
          <TableView pricingData={pricingData} products={productData} suppliers={supplierData} poHeaders={poHeaderData} 
            title="Báo cáo Lợi nhuận (Profit lines)" 
            data={enrichedPoLinesData} 
            showAddButton={false} 
            onProductClick={(val) => setSelectedProductDetails(val)} 
            onPoClick={(val) => setSelectedPoDetails(val)} 
            poLines={poLinesData}
            customers={customerData}
          />
        )}
        {(activeTab === "logistics" || activeTab === "calendar" || activeTab === "delivery_plan" || activeTab === "delivery" || activeTab === "reconcile") && (
          <LogisticsHubView 
            initialSubTab={
              activeTab === "delivery_plan" ? "plan" :
              activeTab === "delivery" ? "delivery" :
              activeTab === "reconcile" ? "reconcile" : "calendar"
            }
            deliveryPlans={enrichedDeliveryPlanData}
            poLines={enrichedPoLinesData}
            poHeaders={poHeaderData}
            deliveries={enrichedDeliveryData}
            products={productData}
            customers={customerData}
            suppliers={supplierData}
            pricingData={pricingData}
            onAddPlan={async (row) => await handleAddToFirestore("delivery_plans", row)}
            onUpdatePlan={async (row) => await handleUpdateToFirestore("delivery_plans", row)}
            onDeletePlan={async (row) => await handleDeleteFromFirestore("delivery_plans", row)}
            onAddDelivery={async (row) => await handleAddToFirestore("deliveries", row)}
            onEditDelivery={async (row) => await handleUpdateToFirestore("deliveries", row)}
            onDeleteDelivery={async (row) => await handleDeleteFromFirestore("deliveries", row)}
            onPoClick={(val) => setSelectedPoDetails(val)}
            onProductClick={(val) => setSelectedProductDetails(val)}
            onCreateCalendarEvent={handleCreateCalendarEvent}
          />
        )}
        {activeTab === "products" && (
          <ProductsView 
            productData={productData}
            pricingData={pricingData}
            poLinesData={enrichedPoLinesData}
            poHeaderData={poHeaderData}
            deliveryData={enrichedDeliveryData}
            deliveryPlanData={enrichedDeliveryPlanData}
            specsData={specsData}
            contractsData={contractsData}
            customerData={customerData}
            supplierData={supplierData}
            onAddProduct={async (row) => await handleAddToFirestore("products", row)}
            onEditProduct={async (row) => await handleUpdateToFirestore("products", row)}
            onDeleteProduct={async (row) => await handleDeleteFromFirestore("products", row)}
            onSelectProductDetails={(val) => setSelectedProductDetails(val)}
            onSelectPoDetails={(val) => setSelectedPoDetails(val)}
          />
        )}
        {activeTab === "specs" && (
          <div className="p-3 sm:p-5 lg:p-8">
            <SpecsView 
              specsData={specsData}
              productData={productData}
              customerData={customerData}
              onAdd={(row) => handleAddToFirestore("specs", row)}
              onEdit={(row) => handleUpdateToFirestore("specs", row)}
              onDelete={(row) => handleDeleteFromFirestore("specs", row)}
            />
          </div>
        )}
        {activeTab === "storage" && (
          <div className="p-3 sm:p-5 lg:p-8">
            <StorageView 
              files={fileStorageData}
              allData={{
                pricingData,
                poHeaderData,
                poLinesData,
                deliveryData: enrichedDeliveryData,
                customerData,
                supplierData,
                contactData,
                productData,
                deliveryPlanData: enrichedDeliveryPlanData,
                specsData,
                contractsData,
                commissionData,
                fileStorageData
              }}
              onUpload={handleUploadToDrive}
              onDelete={(id) => handleDeleteFromFirestore("file_storage", { fileId: id })}
              onUpdateFile={(file) => handleUpdateToFirestore("file_storage", file)}
              onPoClick={(val) => setSelectedPoDetails(val)}
              onProductClick={(val) => setSelectedProductDetails(val)}
            />
          </div>
        )}
        {activeTab === "help" && (
          <div className="w-full flex-1">
            <HelpGuideView onNavigateTab={(tab) => setActiveTab(tab)} />
          </div>
        )}
        {activeTab === "settings" && (
          <div className="p-3 sm:p-5 lg:p-8">
            <SettingsView />
          </div>
        )}
      </div>

      {/* Help Guide Modal */}
      <HelpGuideModal
        isOpen={isHelpModalOpen}
        onClose={() => setIsHelpModalOpen(false)}
        onNavigateTab={(tab) => {
          setActiveTab(tab);
          setIsHelpModalOpen(false);
        }}
      />

      {/* Memory & Storage Manager Modal */}
      <MemoryStorageModal
        isOpen={isMemoryModalOpen}
        onClose={() => setIsMemoryModalOpen(false)}
        allData={{
          pricingData,
          poHeaderData,
          poLinesData,
          deliveryData: enrichedDeliveryData,
          customerData,
          supplierData,
          contactData,
          productData,
          deliveryPlanData: enrichedDeliveryPlanData,
          specsData,
          contractsData,
          commissionData,
          fileStorageData
        }}
      />

      {/* Mobile Floating Bottom Dock (Thumb-friendly Apple iOS Navigation) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-[100] ios-glass border-t border-black/[0.06] pl-[max(env(safe-area-inset-left),12px)] pr-[max(env(safe-area-inset-right),12px)] py-1 landscape:py-0.5 flex items-center justify-around text-slate-500 pb-[max(env(safe-area-inset-bottom),8px)] shadow-[0_-4px_25px_rgba(0,0,0,0.08)] pointer-events-auto select-none">
        <button 
          onClick={() => navItemClick("dashboard")}
          className={clsx("flex flex-col items-center justify-center py-1 px-2 rounded-2xl transition-all min-w-[48px] min-h-[44px] landscape:min-h-[38px] ios-touch-active touch-manipulation cursor-pointer", activeTab === "dashboard" ? "text-[#007AFF] font-bold" : "text-slate-500 hover:text-slate-900")}
        >
          <div className={clsx("w-8 h-8 rounded-xl flex items-center justify-center transition-all", activeTab === "dashboard" ? "bg-blue-50 text-[#007AFF]" : "")}>
            <LayoutDashboard size={20} className={activeTab === "dashboard" ? "stroke-[2.5]" : "stroke-[1.75]"} />
          </div>
          <span className="text-[10px] tracking-tight font-medium">Tổng quan</span>
        </button>

        <button 
          onClick={() => navItemClick("logistics")}
          className={clsx("flex flex-col items-center justify-center py-1 px-2 rounded-2xl transition-all min-w-[48px] min-h-[44px] landscape:min-h-[38px] ios-touch-active touch-manipulation relative cursor-pointer", activeTab === "logistics" ? "text-[#007AFF] font-bold" : "text-slate-500 hover:text-slate-900")}
        >
          <div className={clsx("w-8 h-8 rounded-xl flex items-center justify-center transition-all", activeTab === "logistics" ? "bg-blue-50 text-[#007AFF]" : "")}>
            <Truck size={20} className={activeTab === "logistics" ? "stroke-[2.5]" : "stroke-[1.75]"} />
          </div>
          {deliveryData.length > 0 && (
            <span className="absolute top-1 right-2 px-1.5 py-0.2 bg-orange-500 text-white rounded-full text-[9px] font-bold font-mono">
              {deliveryData.length}
            </span>
          )}
          <span className="text-[10px] tracking-tight font-medium">Giao hàng</span>
        </button>

        <button 
          onClick={() => navItemClick("po")}
          className={clsx("flex flex-col items-center justify-center py-1 px-2 rounded-2xl transition-all min-w-[48px] min-h-[44px] landscape:min-h-[38px] ios-touch-active touch-manipulation relative cursor-pointer", activeTab === "po" ? "text-[#007AFF] font-bold" : "text-slate-500 hover:text-slate-900")}
        >
          <div className={clsx("w-8 h-8 rounded-xl flex items-center justify-center transition-all", activeTab === "po" ? "bg-blue-50 text-[#007AFF]" : "")}>
            <FileText size={20} className={activeTab === "po" ? "stroke-[2.5]" : "stroke-[1.75]"} />
          </div>
          {poHeaderData.length > 0 && (
            <span className="absolute top-1 right-2 px-1.5 py-0.2 bg-blue-600 text-white rounded-full text-[9px] font-bold font-mono">
              {poHeaderData.length}
            </span>
          )}
          <span className="text-[10px] tracking-tight font-medium">Đơn PO</span>
        </button>

        <button 
          onClick={() => navItemClick("ocr")}
          className={clsx("flex flex-col items-center justify-center py-1 px-2 rounded-2xl transition-all min-w-[48px] min-h-[44px] landscape:min-h-[38px] ios-touch-active touch-manipulation cursor-pointer", activeTab === "ocr" ? "text-[#007AFF] font-bold" : "text-slate-500 hover:text-slate-900")}
        >
          <div className={clsx("w-8 h-8 rounded-xl flex items-center justify-center transition-all", activeTab === "ocr" ? "bg-indigo-50 text-indigo-600" : "")}>
            <Camera size={20} className={activeTab === "ocr" ? "stroke-[2.5]" : "stroke-[1.75]"} />
          </div>
          <span className="text-[10px] tracking-tight font-medium">Quét OCR</span>
        </button>

        <button 
          onClick={() => navItemClick("assistant")}
          className={clsx("flex flex-col items-center justify-center py-1 px-2 rounded-2xl transition-all min-w-[48px] min-h-[44px] landscape:min-h-[38px] ios-touch-active touch-manipulation cursor-pointer", activeTab === "assistant" ? "text-[#007AFF] font-bold" : "text-slate-500 hover:text-slate-900")}
        >
          <div className={clsx("w-8 h-8 rounded-xl flex items-center justify-center transition-all", activeTab === "assistant" ? "bg-purple-50 text-purple-600" : "")}>
            <Bot size={20} className={activeTab === "assistant" ? "stroke-[2.5]" : "stroke-[1.75]"} />
          </div>
          <span className="text-[10px] tracking-tight font-medium">Trợ lý AI</span>
        </button>

        <button 
          onClick={() => setMobileMenuOpen(true)}
          className={clsx("flex flex-col items-center justify-center py-1 px-2 rounded-2xl transition-all min-w-[48px] min-h-[44px] landscape:min-h-[38px] ios-touch-active touch-manipulation cursor-pointer", mobileMenuOpen ? "text-[#007AFF] font-bold" : "text-slate-500 hover:text-slate-900")}
        >
          <div className={clsx("w-8 h-8 rounded-xl flex items-center justify-center transition-all", mobileMenuOpen ? "bg-blue-50 text-[#007AFF]" : "")}>
            <Menu size={20} className={mobileMenuOpen ? "stroke-[2.5]" : "stroke-[1.75]"} />
          </div>
          <span className="text-[10px] tracking-tight font-medium">Thêm</span>
        </button>
      </div>

      {selectedProductDetails && (
        <ProductDetailModal 
            pricingData={pricingData}
            productNameOrId={selectedProductDetails} 
            onClose={() => setSelectedProductDetails(null)} 
            productData={productData}
            poLinesData={enrichedPoLinesData}
            deliveryPlanData={enrichedDeliveryPlanData}
            deliveryData={enrichedDeliveryData}
            specsData={specsData}
            contractsData={contractsData}
            customerData={customerData}
            supplierData={supplierData}
            onPoClick={(val) => setSelectedPoDetails(val)}
        />
      )}

      {selectedPoDetails && (
        <PODetailModal
            poNumber={selectedPoDetails}
            onClose={() => setSelectedPoDetails(null)}
            poHeaderData={poHeaderData}
            poLinesData={enrichedPoLinesData}
            deliveryData={enrichedDeliveryData}
            deliveryPlanData={enrichedDeliveryPlanData}
            productData={productData}
            pricingData={pricingData}
            onProductClick={(val) => setSelectedProductDetails(val)}
            onAddPOLine={(row) => handleAddToFirestore("po_lines", row)}
        />
      )}
    </div>
  );
}

function NavItem({ 
  icon, 
  iconBg = "bg-blue-500", 
  label, 
  isActive, 
  isCollapsed = false,
  badge,
  badgeColor,
  onClick 
}: { 
  icon: React.ReactNode, 
  iconBg?: string, 
  label: string, 
  isActive: boolean, 
  isCollapsed?: boolean,
  badge?: string | number,
  badgeColor?: string,
  onClick: () => void 
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      title={isCollapsed ? label : undefined}
      className={clsx(
        "relative flex items-center rounded-xl text-xs transition-all duration-150 cursor-pointer overflow-hidden group select-none text-left",
        isCollapsed 
          ? "w-9 h-9 mx-auto justify-center p-0 mb-1" 
          : "w-full gap-2.5 px-2.5 py-1.5",
        isActive 
          ? "bg-[#007AFF] text-white shadow-xs font-semibold" 
          : "text-[#1D1D1F] hover:bg-black/[0.04] font-medium"
      )}
    >
      <div className={clsx(
        "w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform duration-150 group-hover:scale-105",
        isActive ? "bg-white/20 text-white" : `${iconBg} text-white shadow-2xs`
      )}>
        {icon}
      </div>
      {!isCollapsed && (
        <>
          <span className="truncate flex-1 tracking-[-0.012em]">{label}</span>
          {badge !== undefined && badge !== null && (
            <span className={clsx(
              "text-[9.5px] font-bold font-mono px-1.5 py-0.2 rounded-full",
              isActive 
                ? "bg-white/25 text-white" 
                : badgeColor || "bg-black/[0.05] text-slate-500 group-hover:bg-black/[0.08]"
            )}>
              {badge}
            </span>
          )}
          {isActive && (
            <span className="w-1.5 h-1.5 rounded-full bg-white/90 shrink-0" />
          )}
        </>
      )}
    </motion.button>
  );
}


function SortableColumnItem({ id, label, isVisible, onToggleVisibility }: { id: string; label: string; isVisible: boolean; onToggleVisibility: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center justify-between p-2 hover:bg-gray-50 border-b border-gray-100 last:border-0 group">
      <div className="flex items-center gap-3 flex-1 overflow-hidden">
        <button type="button" {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 p-1 rounded">
          <GripVertical size={16} />
        </button>
        <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
          <input 
            type="checkbox" 
            checked={isVisible} 
            onChange={() => onToggleVisibility(id)} 
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
          />
          <span className="text-sm font-medium text-gray-700 select-none truncate" title={label}>{label}</span>
        </label>
      </div>
    </div>
  );
}

function TableView({ 
  title, 
  data, 
  showAddButton, 
  onAdd, 
  onEdit, 
  onDelete, 
  onProductClick, 
  onPoClick,
  customers = [],
  categories = ["Nội địa", "Xuất khẩu", "Gia công", "FOC", "Khác"],
  poLines = [],
  pricingData = [],
  specsData = [],
  poHeaders = [],
  suppliers = [],
  products = [],
  contractsData = []
}: { 
  title: string, 
  data: any[], 
  showAddButton?: boolean, 
  onAdd?: (row: any) => Promise<void> | void, 
  onEdit?: (row: any) => Promise<void> | void, 
  onDelete?: (row: any) => Promise<void> | void, 
  onProductClick?: (val: string) => void, 
  onPoClick?: (val: string) => void,
  customers?: any[],
  categories?: string[],
  poLines?: any[],
  pricingData?: any[],
  specsData?: any[],
  poHeaders?: any[],
  suppliers?: any[],
  products?: any[],
  contractsData?: any[]
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [editingRow, setEditingRow] = useState<any>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());

  const isPOHeaderTable = useMemo(() => title.includes("Đơn hàng (PO_Header)"), [title]);
  const isPOLineTable = useMemo(() => title.includes("Chi tiết đơn (PO_Lines)") || title.includes("Báo cáo Lợi nhuận"), [title]);
  const isPOTable = useMemo(() => isPOHeaderTable || isPOLineTable, [isPOHeaderTable, isPOLineTable]);

  const isDuplicatePO = useMemo(() => {
    if (!isPOHeaderTable) return false;
    const poValue = String(formData['Đơn hàng'] || '').trim().toLowerCase();
    if (!poValue) return false;
    return data.some(row => String(row['Đơn hàng'] || '').trim().toLowerCase() === poValue);
  }, [formData, data, isPOHeaderTable]);

  const uniquePOs = useMemo(() => {
    const pos = new Set<string>();
    if (poHeaders && poHeaders.length > 0) {
      poHeaders.forEach(r => {
        if (r['Đơn hàng']) pos.add(r['Đơn hàng']);
      });
    } else {
      data.forEach(r => {
        if (r['Đơn hàng']) pos.add(r['Đơn hàng']);
      });
    }
    return Array.from(pos).sort();
  }, [data, poHeaders]);

  const customerList = useMemo(() => {
    const list = new Set<string>();
    if (customers && customers.length > 0) {
      customers.forEach(c => {
        const val = c['Customer_ID'] || c['Tên khách hàng'] || c.name;
        if (val) list.add(String(val).trim());
      });
    }
    if (poHeaders && poHeaders.length > 0) {
      poHeaders.forEach(r => {
        const val = r['Khách hàng'];
        if (val) list.add(String(val).trim());
      });
    }
    if (pricingData && pricingData.length > 0) {
      pricingData.forEach(p => {
        const val = p['RP_Khách hàng'];
        if (val) list.add(String(val).trim());
      });
    }
    ["Thăng Long", "Thanh Hoá", "Bắc Sơn", "Ngân Sơn", "Sài Gòn", "Bến Tre"].forEach(val => {
      list.add(val);
    });
    return Array.from(list).sort();
  }, [customers, poHeaders, pricingData]);


  const handleTextChange = (e: any, h: string) => {
    const val = typeof e === 'string' ? e : e.target.value;
    const updates: any = { [h]: val };

    if (isPOLineTable) {
        if (h === 'Số đơn hàng' || h === 'Đơn hàng') {
            const poNum = val;
            if (poNum && poHeaders && poHeaders.length > 0) {
                const poHeader = poHeaders.find(r => (r['Đơn hàng'] === poNum) || (r['Số đơn hàng'] === poNum));
                if (poHeader) {
                    updates['Khách hàng'] = poHeader['Khách hàng'] || '';
                    
                    // Auto-update pricing for selected product based on new customer if product already exists in form
                    const currentProductVal = formData['Tên sản phẩm'] || formData['Sản phẩm'] || '';
                    if (currentProductVal) {
                        const product = products.find(p => p['Mã hàng'] === currentProductVal || p['Mã sản phẩm'] === currentProductVal || p['Sản phẩm'] === currentProductVal || p['Tên sản phẩm'] === currentProductVal || p.id === currentProductVal);
                        if (product) {
                            const productVal = product['Mã hàng'] || product['Mã sản phẩm'] || product['Sản phẩm'] || product.id;
                            const pricingList = pricingData.filter(p => p['Mã sản phẩm'] === productVal);
                            if (pricingList.length > 0) {
                                let pricing = pricingList.find(p => p['RP_Khách hàng'] === poHeader['Khách hàng']);
                                if (!pricing) pricing = pricingList[0];
                                if (pricing) {
                                    updates['Mã của khách'] = product['Mã của khách'] || pricing['Mã sản phẩm'] || '';
                                    updates['Mã giá bán'] = pricing['Mã giá bán'] || '';
                                    updates['Đơn giá bán'] = pricing['Đơn giá bán'] || '';
                                    updates['Đơn giá nhập'] = pricing['Đơn giá mua'] || pricing['Đơn giá nhập'] || '';
                                    updates['Lợi nhuận'] = pricing['Lợi nhuận'] || '';
                                    
                                    const qty = parseNumber(formData['Số lượng'] || 0);
                                    const price = parseNumber(pricing['Đơn giá bán'] || 0);
                                    if (qty && price) {
                                        updates['Thành tiền dòng'] = (qty * price).toLocaleString('vi-VN');
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        if (h === 'Mã giá bán') {
           const pricing = pricingData.find(p => p['Mã giá bán'] === val);
           if (pricing) {
               updates['Mã của khách'] = pricing['Mã sản phẩm'] || '';
               updates['Đơn giá bán'] = pricing['Đơn giá bán'] || '';
               updates['Đơn giá nhập'] = pricing['Đơn giá mua'] || pricing['Đơn giá nhập'] || '';
               updates['Lợi nhuận'] = pricing['Lợi nhuận'] || '';
               
               const product = products.find(p => p['Mã sản phẩm'] === pricing['Mã sản phẩm']);
               if (product) {
                   updates['ĐVT'] = product['ĐVT'] || product['Đơn vị tính'] || product['Đơn Vị Tính'] || 'Cái';
                   updates['Nhóm hàng'] = product['Nhóm hàng'] || product['Phân loại'] || '';
                   updates['Tên sản phẩm'] = product['Tên sản phẩm'] || product['Sản phẩm'] || pricing['Tên sản phẩm'] || '';
               } else {
                   updates['Tên sản phẩm'] = pricing['Tên sản phẩm'] || '';
               }
               
               const qty = parseNumber(formData['Số lượng'] || 0);
               const price = parseNumber(pricing['Đơn giá bán'] || 0);
               if (qty && price) {
                   updates['Thành tiền dòng'] = (qty * price).toLocaleString('vi-VN');
               }
           }
        }
        if (h === 'Số lượng') {
           const price = parseNumber(formData['Đơn giá bán'] || 0);
           const qty = parseNumber(val);
           if (qty && price) {
               updates['Thành tiền dòng'] = (qty * price).toLocaleString('vi-VN');
           }
        }
    }
    setFormData((prev: any) => ({ ...prev, ...updates }));
  };

  const handleProductChange = (e: any, h: string) => {
    const val = typeof e === 'string' ? e : e.target.value;
    const updates: any = { [h]: val };
    
    if (isPOLineTable) {
      const searchStr = val.toLowerCase().trim();
      let product = products.find(p => p['Mã hàng'] === val || p['Mã sản phẩm'] === val || p['Sản phẩm'] === val || p['Tên sản phẩm'] === val || p.id === val);
      
      // Look up with fuzzy matching
      if (!product && searchStr) {
          product = products.find(p => {
              const code = (p['Mã hàng'] || p['Mã sản phẩm'] || p['Sản phẩm'] || p.id || '').toLowerCase();
              const name = (p['Tên sản phẩm'] || '').toLowerCase();
              return code.includes(searchStr) || name.includes(searchStr);
          });
      }

      if (product) {
        const productVal = product['Mã hàng'] || product['Mã sản phẩm'] || product['Sản phẩm'] || product.id;
        if (h === 'Tên sản phẩm') {
          updates['Tên sản phẩm'] = product['Tên sản phẩm'] || product['Sản phẩm'] || '';
        } else {
          updates[h] = productVal;
        }
        updates['ĐVT'] = product['ĐVT'] || product['Đơn vị tính'] || product['Đơn Vị Tính'] || 'Cái';
        updates['Nhóm hàng'] = product['Nhóm hàng'] || product['Phân loại'] || '';
        
        // Find matching pricing lists for this product
        const pricingList = pricingData.filter(p => p['Mã sản phẩm'] === productVal);
        if (pricingList.length > 0) {
           const poNum = formData['Số đơn hàng'] || formData['Đơn hàng'];
           let customerName = '';
           if (poNum && poHeaders && poHeaders.length > 0) {
              const poHeader = poHeaders.find(r => (r['Đơn hàng'] === poNum) || (r['Số đơn hàng'] === poNum));
              if (poHeader) customerName = poHeader['Khách hàng'] || '';
           }
           
           let pricing = pricingList.find(p => p['RP_Khách hàng'] === customerName);
           if (!pricing) pricing = pricingList[0];
           
           if (pricing) {
               updates['Mã của khách'] = product['Mã của khách'] || pricing['Mã sản phẩm'] || '';
               updates['Mã giá bán'] = pricing['Mã giá bán'] || '';
               updates['Đơn giá bán'] = pricing['Đơn giá bán'] || '';
               updates['Đơn giá nhập'] = pricing['Đơn giá mua'] || pricing['Đơn giá nhập'] || '';
               updates['Lợi nhuận'] = pricing['Lợi nhuận'] || '';
               
               const qty = parseNumber(formData['Số lượng'] || 0);
               const price = parseNumber(pricing['Đơn giá bán'] || 0);
               if (qty && price) {
                   updates['Thành tiền dòng'] = (qty * price).toLocaleString('vi-VN');
               }
           }
        } else {
           updates['Mã của khách'] = product['Mã của khách'] || '';
        }
      }
    }
    setFormData((prev: any) => ({ ...prev, ...updates }));
  };
  
  useEffect(() => {
    setSearchTerm("");
  }, [title]);
  
  if (!data || data.length === 0) {
    return (
      <div className="flex-1 p-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">{title}</h2>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center text-gray-500">
          Không có dữ liệu.
        </div>
      </div>
    );
  }
  

  const headers = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    // Collect ALL unique keys across all records in the table
    const allKeysSet = new Set<string>();
    data.forEach(item => {
      if (item && typeof item === 'object') {
        Object.keys(item).forEach(k => allKeysSet.add(k));
      }
    });
    
    // Explicit priority order for logical, user-friendly columns
    const priorityOrder = [
      'Mã sản phẩm', 'Tên sản phẩm', 'Sản phẩm', 'Mã hàng', 'SKU', 
      'Nhóm hàng', 'Phân loại', 'Đơn Vị Tính', 'ĐVT', 
      'Khách hàng', 'Mã Nhà Cung Cấp', 'Nhà cung cấp', 'Đơn giá mua', 'Đơn giá nhập',
      'Đơn giá bán', 'Giá AVP', 'Giá 2026', 'Lợi nhuận', 'Biên lợi nhuận',
      'Thông Số Sản Phẩm', 'Trọng lượng riêng', 'Tình trạng', 'Mẫu thiết kế',
      'Đơn hàng', 'Số đơn hàng', 'Ngày đặt hàng', 'Ngày đặt', 'Ngày giao hàng', 'Ngày giao',
      'Số lượng', 'Số lượng đặt', 'Số lượng giao', 'Thành tiền dòng', 'Thành tiền'
    ];
    
    const excludeCols = ['id', 'isDeleted', 'createdAt', 'updatedAt', 'deletedAt', 'Các mục mẹ 2', 'Tiến độ sản phẩm', 'Tiến độ đơn hàng', 'Đơn vị nhận hàng', 'Lợi nhuận (1)', 'Bản sao Kích thước'];
    if (isPOLineTable && title.includes("Chi tiết đơn")) {
      excludeCols.push('Đơn giá nhập', 'Lợi nhuận', 'Lợi nhuận dòng');
    }
    
    const validKeys = Array.from(allKeysSet).filter(h => !excludeCols.includes(h));
    
    // Sort so priority keys come first in logical order
    validKeys.sort((a, b) => {
      const idxA = priorityOrder.indexOf(a);
      const idxB = priorityOrder.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });
    
    return validKeys;
  }, [data, isPOLineTable, title]);


  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [showColSettings, setShowColSettings] = useState(false);
  const [columnFilters, setColumnFilters] = useState<Record<string, Set<string>>>({});


  const [activeFilterColumn, setActiveFilterColumn] = useState<string | null>(null);

  const prevDataRef = useRef<any[]>(data);
  const [highlightedRowIds, setHighlightedRowIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const prevData = prevDataRef.current;
    if (prevData !== data) {
      if (prevData && prevData.length > 0) {
        const newHighlighted = new Set<string>();
        const prevMap = new Map(prevData.map((r, i) => [r.id || JSON.stringify(r), r]));
        
        data.forEach((row, i) => {
           const id = row.id || JSON.stringify(row);
           const prevRow = prevMap.get(id);
           
           if (!prevRow) {
              newHighlighted.add(id);
           } else {
              if (JSON.stringify(prevRow) !== JSON.stringify(row)) {
                 newHighlighted.add(id);
              }
           }
        });
        
        if (newHighlighted.size > 0) {
           setHighlightedRowIds(prev => {
              const next = new Set(prev);
              newHighlighted.forEach(id => next.add(id));
              return next;
           });
           setTimeout(() => {
              setHighlightedRowIds(prev => {
                 const next = new Set(prev);
                 newHighlighted.forEach(id => next.delete(id));
                 return next;
              });
           }, 10000);
        }
      }
      prevDataRef.current = data;
    }
  }, [data]);


  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Close filter dropdown when clicking outside
  const filterRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setActiveFilterColumn(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleFilterValue = (column: string, value: string) => {
    setColumnFilters(prev => {
      const next = { ...prev };
      if (!next[column]) {
        next[column] = new Set([value]);
      } else {
        const nextSet = new Set(next[column]);
        if (nextSet.has(value)) {
          nextSet.delete(value);
          if (nextSet.size === 0) {
            delete next[column];
          } else {
            next[column] = nextSet;
          }
        } else {
          nextSet.add(value);
          next[column] = nextSet;
        }
      }
      return next;
    });
  };

  const clearColumnFilter = (column: string) => {
    setColumnFilters(prev => {
      const next = { ...prev };
      delete next[column];
      return next;
    });
  };


  useEffect(() => {
    if (headers.length > 0) {
      setColumnOrder(prev => {
        const prevSet = new Set(prev);
        const newCols = headers.filter(h => !prevSet.has(h));
        // Remove columns that no longer exist in headers
        const headerSet = new Set(headers);
        const validPrev = prev.filter(h => headerSet.has(h));
        return [...validPrev, ...newCols];
      });
    }
  }, [headers]);

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      setColumnOrder((items) => {
        const oldIndex = items.indexOf(active.id);
        const newIndex = items.indexOf(over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const toggleColumnVisibility = (colId: string) => {
    setHiddenColumns(prev => {
      const next = new Set(prev);
      if (next.has(colId)) {
        next.delete(colId);
      } else {
        next.add(colId);
      }
      return next;
    });
  };

  const visibleColumns = useMemo(() => {
    return columnOrder.filter(col => !hiddenColumns.has(col) && headers.includes(col));
  }, [columnOrder, hiddenColumns, headers]);

  const filteredData = useMemo(() => {
    return data.filter(row => {
      // Column Filters match
      for (const [col, activeFilters] of Object.entries(columnFilters)) {
        if (activeFilters && activeFilters.size > 0) {
          const cellValue = row[col] != null ? String(row[col]) : "";
          if (!activeFilters.has(cellValue)) {
            return false;
          }
        }
      }

      // Safe search match
      const searchLower = searchTerm.trim().toLowerCase();
      if (!searchLower) return true;
      
      return Object.values(row).some(val => 
        val != null && String(val).toLowerCase().includes(searchLower)
      );
    });
  }, [data, searchTerm, columnFilters]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredData, currentPage]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  // Reset to page 1 if filteredData length changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filteredData.length]);
  
  const getUniqueValuesForColumn = (column: string) => {
    const values = new Set<string>();
    data.forEach(row => {
      if (row[column] != null) {
        values.add(String(row[column]));
      } else {
        values.add(""); // handle empty/null
      }
    });
    return Array.from(values).sort();
  };

  const summaries = useMemo(() => {
    if (!data || data.length === 0) return null;
    
    const moneyCols = headers.filter(h => h.includes('Tổng giá trị') || h.includes('Doanh thu') || h.includes('Thành tiền') || h.includes('Lợi nhuận'));
    const statusCols = headers.filter(h => h === 'Trạng Thái' || h === 'Status' || h === 'Trạng thái');

    const metrics: { label: string; value: string | number; color: string; icon: React.ReactNode }[] = [];
    
    metrics.push({ 
      label: 'Tổng số bản ghi', 
      value: `${filteredData.length} bản ghi`,
      color: 'bg-blue-500',
      icon: <Layers size={15} />
    });

    moneyCols.forEach(col => {
       const sum = filteredData.reduce((acc, row) => {
         const val = row[col];
         if (val != null) {
            const num = parseFloat(String(val).replace(/,/g, ''));
            if (!isNaN(num)) return acc + num;
         }
         return acc;
       }, 0);
       
       if (sum > 0) {
         const isProfit = col.includes('Lợi nhuận');
         const cleanLabel = col.startsWith('Tổng') ? col : `Tổng ${col}`;
         metrics.push({ 
           label: cleanLabel, 
           value: new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(sum),
           color: isProfit ? 'bg-indigo-500' : 'bg-emerald-500',
           icon: isProfit ? <TrendingUp size={15} /> : <DollarSign size={15} />
         });
       }
    });

    statusCols.forEach(col => {
       let completed = 0;
       filteredData.forEach(row => {
          const val = String(row[col] || '');
          if (val === 'Hoàn thành' || val === 'Đã giao' || val === 'Hoàn tất' || val === 'Đã duyệt' || val === 'Đã thanh toán') completed++;
       });
       if (completed > 0) {
          metrics.push({ 
            label: 'Đã hoàn tất', 
            value: `${completed} / ${filteredData.length}`,
            color: 'bg-teal-500',
            icon: <CheckCircle size={15} />
          });
       }
    });

    return metrics.slice(0, 4);
  }, [data, headers, filteredData]);



  const renderCell = (header: string, value: any, row: any) => {
    if (value == null || value === '') return <span className="text-gray-400">-</span>;
    const strVal = String(value);

    // Clickable Product Link
    if (header === 'Tên sản phẩm' || header === 'Mã sản phẩm' || header === 'Sản phẩm') {
        return (
            <ProductHoverCard 
                productName={header === 'Tên sản phẩm' ? strVal : (row['Tên sản phẩm'] || strVal)}
                productCode={header === 'Mã sản phẩm' ? strVal : (row['Mã sản phẩm'] || row['Mã giá bán'] || '')}
                pricingData={pricingData}
                specsData={specsData}
            >
                <span 
                    className="text-blue-600 font-medium hover:text-blue-800 hover:underline cursor-pointer transition-colors"
                    onClick={(e) => {
                        e.stopPropagation();
                        if (onProductClick) onProductClick(strVal);
                    }}
                >
                    {strVal}
                </span>
            </ProductHoverCard>
        );
    }

    // Clickable PO Link or "Chi tiết đơn hàng"
    if (header === 'Đơn hàng' || header === 'Số đơn hàng' || header === 'Số PO' || header === 'Đơn hàng liên kết' || header === 'Chi tiết đơn hàng') {
        const poNum = (header === 'Chi tiết đơn hàng' && row['Đơn hàng']) ? row['Đơn hàng'] : strVal;
        const displayVal = header === 'Chi tiết đơn hàng' ? 'Xem chi tiết' : strVal;
        
        return (
            <span 
                className="text-emerald-600 font-semibold hover:text-emerald-800 hover:underline cursor-pointer transition-colors"
                onClick={(e) => {
                    e.stopPropagation();
                    if (onPoClick) onPoClick(String(poNum).trim());
                }}
            >
                {displayVal}
            </span>
        );
    }

    // Status badges
    if (header === 'Trạng Thái' || header === 'Status' || header === 'Trạng thái') {
      if (strVal === 'Hoàn thành' || strVal === 'Đã giao' || strVal === 'Hoàn tất') {
        return <span className="px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium border border-green-200">{strVal}</span>;
      }
      if (strVal === 'Đang tiến hành' || strVal === 'Đang xử lý') {
        return <span className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium border border-blue-200">{strVal}</span>;
      }
      if (strVal === 'Hủy' || strVal === 'Đã hủy' || strVal.toLowerCase().includes('hư hỏng')) {
        return <span className="px-2.5 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium border border-red-200">{strVal}</span>;
      }
      return <span className="px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium border border-gray-200">{strVal}</span>;
    }

    // Progress percentage
    if (header === 'Tiến độ' || header === 'Tiến độ giao' || header === 'Tiến độ sản phẩm' || header.includes('% Lợi nhuận')) {
      const isPercent = strVal.includes('%');
      const num = parseFloat(strVal.replace(/,/g, '').replace(/%/g, ''));
      if (!isNaN(num)) {
         return (
            <div className="flex items-center gap-2">
              <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                 <div className={`h-full ${num >= 100 ? 'bg-green-500' : 'bg-orange-500'}`} style={{ width: `${Math.min(100, num)}%` }}></div>
              </div>
              <span className="text-xs font-medium text-gray-700">{strVal}</span>
            </div>
         );
      }
    }

    // Files
    if (header === 'Tệp đơn hàng' || header.includes('Tệp') || strVal.endsWith('.pdf') || strVal.endsWith('.jpg') || strVal.endsWith('.png')) {
      return (
         <div className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800 cursor-pointer w-max">
           <FileText size={14} />
           <span className="truncate max-w-[150px] font-medium" title={strVal}>{strVal}</span>
         </div>
      );
    }

    // Contract Cross-Reference with Google Drive Original PDF Link
    if (header === 'Số hợp đồng' || header === 'Hợp đồng' || header.includes('hợp đồng') || header.includes('Hợp đồng') || header === 'Đối chiếu từ hợp đồng') {
      const matchingContract = (contractsData || []).find((c: any) => 
        (c.contractNumber && c.contractNumber.trim().toLowerCase() === strVal.trim().toLowerCase()) ||
        (c.contractNumber && strVal.includes(c.contractNumber)) ||
        (c.partnerName && row['RP_Khách hàng'] && c.partnerName.includes(row['RP_Khách hàng']))
      );

      const driveSearchUrl = matchingContract?.attachmentUrl || `https://drive.google.com/drive/search?q=${encodeURIComponent(strVal)}`;

      return (
        <div className="flex items-center gap-1.5 py-0.5">
          <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200/60 text-[11px]">
            {strVal}
          </span>
          <a 
            href={driveSearchUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-1.5 py-0.5 rounded transition-all shadow-2xs group"
            title="Đối chiếu & xem File Hợp đồng gốc PDF trên Google Drive"
          >
            <FileText size={11} className="text-rose-600" />
            <span>PDF Gốc</span>
            <ArrowUpRight size={10} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </a>
        </div>
      );
    }

    // Bold identifiers
    if (header === 'Đơn hàng' || header === 'Số đơn hàng' || header === 'Mã sản phẩm' || header === 'Chi tiết đơn hàng' || header === 'Số PXK') {
       return <span className="font-semibold text-gray-900">{strVal}</span>;
    }

    // Currencies and numbers
    if (header.includes('giá') || header.includes('tiền') || header.includes('Lợi nhuận') || header.includes('Doanh thu') || header.includes('Tổng') || header === 'Số lượng' || header === 'Số lượng giao' || header === 'Số lượng đặt' || header === 'Còn lại' || header === 'Đã giao') {
       if (strVal.match(/^-?[0-9,.]+$/)) {
         return <span className="font-medium text-gray-900">{strVal}</span>;
       }
    }

    // Date
    if (header.includes('Ngày') || header.includes('Thời gian')) {
       return <span className="text-gray-600">{strVal}</span>;
    }

    // Default
    return <span className="text-gray-600 truncate max-w-xs block" title={strVal}>{strVal}</span>;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isPOTable && isDuplicatePO && !editingRow) {
      // Proceed without confirmation since window.confirm is blocked in iframes
    }

    if (editingRow) {
      if (onEdit) {
        const toastId = toast.loading('Đang cập nhật...');
        try {
          await onEdit(formData);
          toast.success('Đã cập nhật dữ liệu!', { id: toastId });
          setIsEditModalOpen(false);
          setEditingRow(null);
          setFormData({});
        } catch (err) {
          toast.error('Có lỗi xảy ra khi cập nhật!', { id: toastId });
        }
      }
    } else {
      if (onAdd) {
        const toastId = toast.loading('Đang thêm mới...');
        try {
          await onAdd(formData);
          toast.success('Đã thêm mới dữ liệu!', { id: toastId });
          setIsModalOpen(false);
          setFormData({});
        } catch (err) {
          toast.error('Có lỗi xảy ra khi thêm mới!', { id: toastId });
        }
      }
    }
  };

  return (
    <div className="flex-1 p-4 sm:p-6 lg:p-8 flex flex-col h-full overflow-hidden relative pb-24 lg:pb-8 bg-[#F5F5F7]">
      
      {/* Apple macOS Table Title & Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 flex-shrink-0 relative">
        <div className="flex items-center gap-3">
          <h2 className="text-base sm:text-lg lg:text-xl font-bold text-[#1D1D1F] tracking-[-0.015em]">{title}</h2>
          <span className="text-[11px] font-semibold text-slate-500 bg-[#E5E5EA]/80 px-2.5 py-0.5 rounded-full">
            {filteredData.length} bản ghi
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap relative">
          {title.includes("Báo cáo") && (
            <button
              onClick={() => {
                alert("Vui lòng chọn khổ giấy A4 ngang (Landscape) và Tỷ lệ (Scale) phù hợp khi hộp thoại in hiện ra để báo cáo hiển thị đầy đủ nhất.");
                window.print();
              }}
              className="flex items-center gap-1.5 bg-[#007AFF] text-white px-3.5 py-2 rounded-xl text-xs font-semibold hover:bg-[#0062CC] transition-all shadow-xs"
              title="In báo cáo"
            >
              <Printer size={15} /> In báo cáo
            </button>
          )}

          <button 
            onClick={() => setShowColSettings(!showColSettings)}
            className="flex items-center gap-1.5 bg-white text-slate-700 border border-black/[0.08] px-3 py-2 rounded-xl text-xs font-medium hover:bg-slate-50 transition-all shadow-2xs"
            title="Tuỳ chỉnh cột"
          >
            <Columns size={15} />
            <span className="hidden sm:inline">Cột</span>
          </button>

          {showColSettings && (
            <div className="absolute top-12 right-0 z-50 w-72 bg-white border border-black/[0.08] shadow-2xl rounded-2xl max-h-[70vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
              <div className="flex justify-between items-center p-3.5 border-b border-black/[0.06] bg-[#F5F5F7]">
                <h3 className="font-semibold text-[#1D1D1F] text-xs">Hiển thị & Sắp xếp cột</h3>
                <button onClick={() => setShowColSettings(false)} className="text-slate-400 hover:text-slate-700">
                  <X size={15} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={columnOrder} strategy={verticalListSortingStrategy}>
                    {columnOrder.map(col => (
                      <SortableColumnItem 
                        key={col} 
                        id={col} 
                        label={col} 
                        isVisible={!hiddenColumns.has(col)} 
                        onToggleVisibility={toggleColumnVisibility} 
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              </div>
            </div>
          )}

          <button 
            onClick={() => {
              const exportData = filteredData.map(row => {
                const newRow: any = {};
                visibleColumns.forEach(col => {
                  newRow[col] = row[col];
                });
                return newRow;
              });
              const ws = XLSX.utils.json_to_sheet(exportData);
              const wb = XLSX.utils.book_new();
              XLSX.utils.book_append_sheet(wb, ws, "Data");
              XLSX.writeFile(wb, `${title}.xlsx`);
            }}
            className="flex items-center gap-1.5 bg-white text-slate-700 border border-black/[0.08] px-3.5 py-2 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-all shadow-2xs"
            title="Xuất Bảng Excel"
          >
            <Download size={15} />
            <span className="hidden sm:inline">Excel</span>
          </button>

          <button 
            onClick={() => {
              try {
                const exportData = filteredData.map(row => {
                  const newRow: any = {};
                  visibleColumns.forEach(col => {
                    newRow[col] = row[col];
                  });
                  return newRow;
                });
                exportGenericTableToPDF({
                  title: title || 'Báo Cáo Bảng Dữ Liệu',
                  columns: visibleColumns,
                  data: exportData,
                  filename: `${title || 'Bao_Cao'}_${new Date().toISOString().slice(0, 10)}.pdf`
                });
                toast.success('Đã xuất file PDF thành công!');
              } catch (err: any) {
                toast.error('Lỗi xuất PDF: ' + (err?.message || err));
              }
            }}
            className="flex items-center gap-1.5 bg-white text-slate-700 border border-black/[0.08] px-3.5 py-2 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-all shadow-2xs"
            title="Xuất Bảng PDF Chuyên Nghiệp"
          >
            <FileText size={15} />
            <span className="hidden sm:inline">PDF</span>
          </button>
          
          {selectedRowIds.size > 0 && onDelete && (
            <button 
              onClick={() => {
                if (window.confirm(`Bạn có chắc chắn muốn xoá ${selectedRowIds.size} bản ghi đã chọn?`)) {
                  Array.from(selectedRowIds).forEach(id => {
                    const row = data.find(r => (r.id || JSON.stringify(r)) === id);
                    if (row) onDelete(row);
                  });
                  setSelectedRowIds(new Set());
                }
              }}
              className="flex items-center gap-1.5 bg-red-600 text-white px-3.5 py-2 rounded-xl text-xs font-semibold hover:bg-red-700 transition-all shadow-xs"
            >
              <Trash2 size={15} />
              <span>Xóa ({selectedRowIds.size})</span>
            </button>
          )}

          {showAddButton && (
            <button 
              onClick={() => setIsModalOpen(true)} 
              className="flex items-center gap-1.5 bg-[#007AFF] text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-[#0062CC] active:bg-[#0051A8] transition-all shadow-xs"
            >
              <PlusCircle size={15} />
              <span>Thêm mới</span>
            </button>
          )}
        </div>
      </div>
      
      {/* Apple Spotlight Search Capsule & KPI Cards */}
      <div className="mb-4 space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text"
              placeholder="Tìm kiếm nhanh trong bảng (Spotlight ⌘K)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#E5E5EA]/60 hover:bg-[#E5E5EA] focus:bg-white border border-black/[0.06] rounded-full pl-9 pr-4 py-2 text-xs font-medium text-[#1D1D1F] focus:border-[#007AFF] outline-none transition-all"
            />
          </div>
        </div>
        
        {summaries && summaries.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3">
            {summaries.map((s, idx) => (
              <div 
                key={s.label + idx} 
                className="bg-white border border-black/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:shadow-md transition-all rounded-2xl p-3 sm:p-3.5 flex items-center gap-3 min-w-0"
              >
                <div className={clsx(
                  "w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0 text-white shadow-2xs",
                  s.color || "bg-blue-500"
                )}>
                  {s.icon || <Layers size={16} />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold text-slate-500 truncate" title={s.label}>
                    {s.label}
                  </p>
                  <p className="text-xs sm:text-sm font-extrabold text-[#1D1D1F] tracking-tight truncate mt-0.5" title={String(s.value)}>
                    {s.value}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Apple Inset-Grouped Table Container */}
      <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-black/[0.06] flex-1 overflow-hidden flex flex-col min-h-[360px]">
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-auto flex-1">
          <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
            <thead className="bg-[#F5F5F7] text-slate-600 sticky top-0 border-b border-black/[0.06] z-10 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                {onDelete && (
                  <th className="px-4 py-3 font-semibold border-b border-gray-200 bg-gray-50 w-10 text-center">
                    <input 
                      type="checkbox"
                      checked={paginatedData.length > 0 && paginatedData.every(r => selectedRowIds.has(r.id || JSON.stringify(r)))}
                      onChange={(e) => {
                        if (e.target.checked) {
                          const newSet = new Set(selectedRowIds);
                          paginatedData.forEach(r => newSet.add(r.id || JSON.stringify(r)));
                          setSelectedRowIds(newSet);
                        } else {
                          const newSet = new Set(selectedRowIds);
                          paginatedData.forEach(r => newSet.delete(r.id || JSON.stringify(r)));
                          setSelectedRowIds(newSet);
                        }
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                    />
                  </th>
                )}
                {visibleColumns.map((h, idx) => (
                  <th key={h} className={`px-4 py-3 font-semibold border-b border-gray-200 bg-gray-50 ${idx === 0 ? 'sticky left-0 shadow-[1px_0_0_0_#e5e7eb] z-[15]' : ''}`}>
                    <div className="flex items-center justify-between relative gap-2">
                      <span className="truncate">{h}</span>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setActiveFilterColumn(activeFilterColumn === h ? null : h); }}
                        className={`p-1.5 rounded-md transition-colors flex-shrink-0 ${columnFilters[h] && columnFilters[h].size > 0 ? 'text-blue-600 bg-blue-50' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-200'}`}
                        title="Lọc dữ liệu"
                      >
                        <Filter size={14} className={columnFilters[h] && columnFilters[h].size > 0 ? "fill-blue-100" : ""} />
                      </button>
                      
                      {activeFilterColumn === h && (
                        <div ref={filterRef} className="absolute top-full right-0 mt-1 z-50 w-64 bg-white border border-gray-200 shadow-xl rounded-lg p-3 max-h-72 flex flex-col font-normal text-sm">
                          <div className="flex justify-between items-center mb-2 pb-2 border-b border-gray-100">
                            <span className="font-semibold text-gray-800">Lọc: {h}</span>
                            <button onClick={() => clearColumnFilter(h)} className="text-xs text-blue-600 hover:text-blue-800">Xoá lọc</button>
                          </div>
                          <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-1.5">
                            {getUniqueValuesForColumn(h).map(val => (
                              <label key={val} className="flex items-start gap-2 cursor-pointer group/label">
                                <input 
                                  type="checkbox" 
                                  checked={columnFilters[h]?.has(val) || false}
                                  onChange={() => toggleFilterValue(h, val)}
                                  className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4 flex-shrink-0"
                                />
                                <span className="text-gray-700 break-words group-hover/label:text-blue-600 transition-colors">{val || "(Trống)"}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((row, i) => {
                const rowId = row.id || JSON.stringify(row);
                const isHighlighted = highlightedRowIds.has(rowId);
                
                // Overdue check
                let isOverdue = false;
                if (row['Ngày giao']) {
                    try {
                        const dateStr = String(row['Ngày giao']);
                        // Parse dd/MM/yyyy
                        const parsedDate = parse(dateStr.split(' ')[0], 'dd/MM/yyyy', new Date());
                        if (!isNaN(parsedDate.getTime())) {
                            if (isBefore(parsedDate, startOfDay(new Date()))) {
                                const status = String(row['Trạng Thái'] || row['Status'] || row['Trạng thái'] || '');
                                const completedStatuses = ['Hoàn thành', 'Đã giao', 'Hoàn tất', 'Hủy', 'Đã hủy'];
                                if (!completedStatuses.includes(status)) {
                                    isOverdue = true;
                                }
                            }
                        }
                    } catch (e) {}
                }
                
                const rowClass = isOverdue 
                    ? 'bg-red-50 hover:bg-red-100' 
                    : (isHighlighted ? 'bg-amber-100/50 hover:bg-amber-100/70' : 'hover:bg-gray-50');

                return (
                  <tr 
                    key={rowId} 
                    onClick={() => {
                      setEditingRow(row);
                      setFormData({ ...row });
                      setIsEditModalOpen(true);
                      setConfirmDelete(false);
                    }}
                    className={`transition-all duration-200 border-b border-gray-100 last:border-0 group/tr cursor-pointer ${rowClass}`}
                  >
                    {onDelete && (
                      <td className="px-4 py-3 align-middle text-center" onClick={(e) => e.stopPropagation()}>
                        <input 
                          type="checkbox"
                          checked={selectedRowIds.has(rowId)}
                          onChange={(e) => {
                            const newSet = new Set(selectedRowIds);
                            if (e.target.checked) newSet.add(rowId);
                            else newSet.delete(rowId);
                            setSelectedRowIds(newSet);
                          }}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                        />
                      </td>
                    )}
                    {visibleColumns.map((h, idx) => (
                      <td 
                        key={h} 
                        className={`px-4 py-3 align-middle ${idx === 0 ? `sticky left-0 shadow-[1px_0_0_0_#f3f4f6] z-[5] transition-colors ${isOverdue ? 'bg-red-50 group-hover/tr:bg-red-100' : isHighlighted ? 'bg-[#fef3c7]/50 group-hover/tr:bg-[#fef3c7]/70' : 'bg-white group-hover/tr:bg-gray-50'}` : ''}`}
                      >
                        <div className="flex items-center gap-2">
                           {renderCell(h, row[h], row)}
                           {h === 'Ngày giao' && isOverdue && (
                               <span title="Quá hạn giao hàng"><AlertTriangle size={16} className="text-red-500" /></span>
                           )}
                        </div>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile Apple Inset-Grouped Card Feed */}
        <div className="md:hidden overflow-y-auto flex-1 space-y-2.5 p-2.5 bg-[#F5F5F7]">
          {paginatedData.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center text-slate-400 border border-black/[0.06] text-xs">
              Không có dữ liệu phù hợp với bộ lọc.
            </div>
          ) : (
            paginatedData.map((row) => {
              const rowId = row.id || JSON.stringify(row);
              const isHighlighted = highlightedRowIds.has(rowId);
              
              // Overdue check
              let isOverdue = false;
              if (row["Ngày giao"]) {
                try {
                  const dateStr = String(row["Ngày giao"]);
                  const parsedDate = parse(dateStr.split(" ")[0], "dd/MM/yyyy", new Date());
                  if (!isNaN(parsedDate.getTime()) && isBefore(parsedDate, startOfDay(new Date()))) {
                    const status = String(row["Trạng Thái"] || row["Status"] || row["Trạng thái"] || "");
                    if (!["Hoàn thành", "Đã giao", "Hoàn tất", "Hủy", "Đã hủy"].includes(status)) {
                      isOverdue = true;
                    }
                  }
                } catch (e) {}
              }

              // Extract title
              let cardTitle = "";
              const titleKeys = ["Số đơn hàng", "Đơn hàng", "Số PXK", "Mã sản phẩm", "Mã giá bán", "Mã hợp đồng", "Số hợp đồng", "Tên sản phẩm", "Sản phẩm", "Mã hàng"];
              for (const k of titleKeys) {
                if (row[k]) {
                  cardTitle = String(row[k]);
                  break;
                }
              }
              if (!cardTitle) cardTitle = String(row[visibleColumns[0]] || "Bản ghi");

              // Extract subtitle
              let cardSubtitle = "";
              const subKeys = ["Khách hàng", "RP_Khách hàng", "Nhà cung cấp", "Tên sản phẩm", "Nhóm hàng", "Người liên hệ", "Công ty"];
              for (const k of subKeys) {
                if (row[k] && String(row[k]) !== cardTitle) {
                  cardSubtitle = String(row[k]);
                  break;
                }
              }

              // Extract status
              let statusKey = "";
              let statusVal = "";
              const statusKeys = ["Trạng thái", "Trạng Thái", "Status", "Tình trạng"];
              for (const k of statusKeys) {
                if (row[k]) {
                  statusKey = k;
                  statusVal = String(row[k]);
                  break;
                }
              }

              // Extract metrics
              const metricCandidates = visibleColumns.filter(c => 
                !titleKeys.includes(c) && 
                !subKeys.includes(c) && 
                !statusKeys.includes(c) && 
                row[c] != null && 
                String(row[c]).trim() !== ""
              );

              const metrics = metricCandidates.slice(0, 4).map(c => ({
                label: c,
                value: row[c]
              }));

              return (
                <div
                  key={rowId}
                  onClick={() => {
                    setEditingRow(row);
                    setFormData({ ...row });
                    setIsEditModalOpen(true);
                    setConfirmDelete(false);
                  }}
                  className={clsx(
                    "bg-white rounded-2xl p-3.5 border border-black/[0.06] shadow-xs active:scale-[0.98] transition-all cursor-pointer space-y-2.5",
                    isOverdue ? "border-l-4 border-l-rose-500 bg-rose-50/20" : "",
                    isHighlighted ? "ring-2 ring-amber-400 bg-amber-50/30" : ""
                  )}
                >
                  {/* Card Top */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight">
                          {renderCell(titleKeys.find(k => row[k]) || visibleColumns[0], cardTitle, row)}
                        </span>
                        {isOverdue && (
                          <span className="inline-flex items-center gap-0.5 text-[9.5px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.2 rounded-full">
                            <AlertTriangle size={10} /> Quá hạn
                          </span>
                        )}
                      </div>
                      {cardSubtitle && (
                        <p className="text-[11.5px] text-slate-500 font-medium truncate mt-0.5">
                          {cardSubtitle}
                        </p>
                      )}
                    </div>
                    {statusVal && (
                      <div className="shrink-0">
                        {renderCell(statusKey, statusVal, row)}
                      </div>
                    )}
                  </div>

                  {/* Card Metrics */}
                  {metrics.length > 0 && (
                    <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-slate-100">
                      {metrics.map((m, mIdx) => (
                        <div key={mIdx} className="bg-slate-50/80 rounded-xl p-2 border border-slate-100">
                          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block truncate">
                            {m.label}
                          </span>
                          <div className="text-xs font-bold text-slate-800 mt-0.5 truncate">
                            {renderCell(m.label, m.value, row)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Card Bottom */}
                  <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 text-xs font-medium text-slate-500">
                    <span className="text-[10.5px] text-slate-400 font-medium flex items-center gap-1">
                      <span>Chạm để sửa chi tiết</span>
                    </span>
                    <div className="flex items-center gap-1 text-blue-600 font-bold text-xs">
                      <span>Chi tiết</span>
                      <ChevronRight size={14} />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white px-4 py-3 border border-gray-200 border-t-0 rounded-b-lg flex-shrink-0">
          <div className="flex flex-1 justify-between sm:hidden">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Trang trước
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Trang sau
            </button>
          </div>
          <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Hiển thị <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> đến <span className="font-medium">{Math.min(currentPage * itemsPerPage, filteredData.length)}</span> trong số <span className="font-medium">{filteredData.length}</span> kết quả
              </p>
            </div>
            <div>
              <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
                >
                  <span className="sr-only">Previous</span>
                  <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
                >
                  <span className="sr-only">Next</span>
                  <ChevronRight className="h-5 w-5" aria-hidden="true" />
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-[28px] sm:rounded-2xl shadow-2xl border border-black/[0.08] w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden pb-safe sm:pb-0">
            <div className="px-6 py-3.5 border-b border-black/[0.06] flex items-center gap-3 bg-[#F5F5F7]">
              <MacTrafficLights onClose={() => setIsModalOpen(false)} />
              <div className="h-4 w-px bg-black/[0.08]" />
              <h3 className="text-sm font-bold text-[#1D1D1F]">Thêm mới {title}</h3>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <form id="add-form" onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {headers.filter(h => {
                  if (h === 'STT' || h === 'id') return false;
                  if (isPOLineTable) {
                    const allowedFields = [
                      'Số đơn hàng', 'Đơn hàng', 'Mã giá bán', 'Tên sản phẩm', 'Sản phẩm',
                      'Số lượng', 'Ngày đặt hàng', 'Ngày giao', 'Thời gian xử lý', 'Khách hàng'
                    ];
                    return allowedFields.includes(h);
                  }
                  return true;
                }).map(h => {
                  // Common inputs based on field names
                  if (h === 'Ngày đặt hàng' || h === 'Ngày giao' || h.includes('Ngày')) {
                    return (
                      <div key={h} className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-gray-700">{h}</label>
                        <input 
                          type="date" 
                          required
                          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                          value={parseDateToISO(formData[h]) || ''}
                          onChange={(e) => handleTextChange(e, h)}
                        />
                      </div>
                    );
                  }

                  if (h === 'Khách hàng') {
                    if (isPOLineTable) {
                      return (
                        <div key={h} className="flex flex-col gap-1.5 opacity-80">
                          <label className="text-sm font-medium text-gray-700">{h} (Tự động)</label>
                          <input 
                            type="text" 
                            readOnly
                            required
                            placeholder="Chọn Số đơn hàng để tự động điền"
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-50 cursor-not-allowed outline-none"
                            value={formData[h] || ''}
                          />
                        </div>
                      );
                    }
                    return (
                      <div key={h} className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-gray-700">{h}</label>
                        <select
                          required
                          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                          value={formData[h] || ''}
                          onChange={(e) => handleTextChange(e, h)}
                        >
                          <option value="">Chọn khách hàng</option>
                          {customerList.map(custName => (
                            <option key={custName} value={custName}>
                              {custName}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  }

                  if (h === 'Nhà cung cấp' || h === 'Nhà Cung Cấp' || h === 'Mã Nhà Cung Cấp' || h === 'Mã NCC') {
                    return (
                      <div key={h} className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-gray-700">{h}</label>
                        <select
                          required
                          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                          value={formData[h] || ''}
                          onChange={(e) => handleTextChange(e, h)}
                        >
                          <option value="">Chọn nhà cung cấp</option>
                          {suppliers.map(s => {
                            const val = s['Supplier_ID'] || s['Nhà Cung Cấp'] || s['Mã NCC'] || s.name;
                            return (
                              <option key={s.id || val} value={val}>
                                {val}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    );
                  }

                  if (h === 'Sản phẩm' || h === 'Mã sản phẩm' || h === 'Mã hàng' || (isPOLineTable && h === 'Tên sản phẩm')) {
                    return (
                      <ProductCombobox 
                        key={h}
                        label={h}
                        value={formData[h] || ''}
                        onChange={(val) => handleProductChange(val, h)}
                        products={products}
                      />
                    );
                  }

                  if (isPOLineTable && h === 'Mã giá bán') {
                    return (
                      <PricingCombobox 
                        key={h}
                        label={h}
                        value={formData[h] || ''}
                        onChange={(val) => handleTextChange(val, h)}
                        pricingData={pricingData}
                      />
                    );
                  }

                  if (h === 'Phân loại') {
                    return (
                      <div key={h} className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-gray-700">{h}</label>
                        <select
                          required
                          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                          value={formData[h] || ''}
                          onChange={(e) => handleTextChange(e, h)}
                        >
                          <option value="">Chọn phân loại</option>
                          {categories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>
                    );
                  }

                  if (h === 'Trạng Thái' && isPOHeaderTable) {
                    return (
                      <div key={h} className="flex flex-col gap-1.5 opacity-60">
                        <label className="text-sm font-medium text-gray-700">{h}</label>
                        <input 
                          type="text" 
                          readOnly
                          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-50 cursor-not-allowed"
                          value={formData[h] || 'Mới'}
                        />
                      </div>
                    );
                  }

                  if (h === 'Tổng giá trị đơn hàng' && isPOHeaderTable) {
                    return (
                      <div key={h} className="flex flex-col gap-1.5 opacity-60">
                        <label className="text-sm font-medium text-gray-700">{h}</label>
                        <input 
                          type="text" 
                          readOnly
                          placeholder="Tự động tính từ PO Lines"
                          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-50 cursor-not-allowed"
                          value={formData[h] || '0'}
                        />
                      </div>
                    );
                  }

                  if (h === 'Tệp đơn hàng') {
                    return (
                      <div key={h} className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-gray-700">{h}</label>
                        <div className="relative group">
                          <input 
                            type="text" 
                            placeholder="Tên tệp đính kèm..."
                            className="border border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all w-full"
                            value={formData[h] || ''}
                            onChange={(e) => handleTextChange(e, h)}
                          />
                          <div className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
                             <Upload size={16} />
                          </div>
                        </div>
                      </div>
                    );
                  }

                  if ((h === 'Số đơn hàng' || h === 'Đơn hàng') && isPOLineTable) {
                    return (
                      <div key={h} className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-gray-700">Số đơn hàng (PO) *</label>
                        <select
                          required
                          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                          value={formData[h] || ''}
                          onChange={(e) => handleTextChange(e, h)}
                        >
                          <option value="">Chọn PO liên kết</option>
                          {uniquePOs.map(po => (
                            <option key={po} value={po}>{po}</option>
                          ))}
                        </select>
                      </div>
                    );
                  }

                  return (
                    <div key={h} className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-gray-700">{h}</label>
                      <input 
                        type="text" 
                        required={h === 'Đơn hàng'}
                        className={`border rounded-lg px-3 py-2 text-sm focus:ring-2 outline-none transition-all ${
                          h === 'Đơn hàng' && isDuplicatePO 
                            ? 'border-red-300 focus:ring-red-500 focus:border-red-500 bg-red-50 text-red-900' 
                            : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                        }`}
                        value={formData[h] || ''}
                        onChange={(e) => handleTextChange(e, h)}
                      />
                      {h === 'Đơn hàng' && isDuplicatePO && (
                        <span className="text-xs text-red-600 font-medium flex items-center gap-1 mt-1">
                          <AlertTriangle size={12} className="shrink-0" /> Số đơn hàng này đã tồn tại!
                        </span>
                      )}
                    </div>
                  );
                })}
              </form>

              {isPOLineTable && (formData['Tên sản phẩm'] || formData['Mã giá bán']) && (
                <div className="mt-4 bg-blue-50 border border-blue-200 text-blue-900 rounded-lg p-4 text-sm animate-in fade-in duration-200">
                  <div className="font-semibold text-blue-800 mb-2.5 flex items-center gap-1.5">
                    <CheckCircle size={16} className="text-blue-600" /> Thông tin đối chiếu sản phẩm & đơn giá
                  </div>
                  <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs">
                    <div className="col-span-2 border-b border-blue-100 pb-1.5 mb-1">
                      <strong>Tên sản phẩm:</strong> <span className="text-gray-900 font-medium block mt-0.5">{formData['Tên sản phẩm'] || 'N/A'}</span>
                    </div>
                    <div><strong>Mã giá bán:</strong> <span className="text-gray-900 font-medium">{formData['Mã giá bán'] || 'N/A'}</span></div>
                    <div><strong>Đơn vị tính:</strong> <span className="text-gray-900 font-medium">{formData['ĐVT'] || 'Cái'}</span></div>
                    <div><strong>Nhóm hàng:</strong> <span className="text-gray-900 font-medium">{formData['Nhóm hàng'] || 'N/A'}</span></div>
                    <div><strong>Mã của khách:</strong> <span className="text-gray-900 font-medium">{formData['Mã của khách'] || 'N/A'}</span></div>
                    <div><strong>Đơn giá bán:</strong> <span className="text-green-600 font-semibold">{formData['Đơn giá bán'] ? `${Number(parseNumber(formData['Đơn giá bán'])).toLocaleString('vi-VN')}đ` : '0đ'}</span></div>
                    <div><strong>Đơn giá nhập:</strong> <span className="text-amber-600 font-semibold">{formData['Đơn giá nhập'] ? `${Number(parseNumber(formData['Đơn giá nhập'])).toLocaleString('vi-VN')}đ` : '0đ'}</span></div>
                    <div><strong>Lợi nhuận dự kiến:</strong> <span className="text-blue-600 font-semibold">{formData['Lợi nhuận'] ? `${Number(parseNumber(formData['Lợi nhuận'])).toLocaleString('vi-VN')}đ` : '0đ'}</span></div>
                    <div><strong>Số lượng đặt:</strong> <span className="text-gray-950 font-bold">{formData['Số lượng'] || 0}</span></div>
                    <div className="col-span-2 border-t border-blue-100 pt-2 mt-1">
                      <div className="text-sm font-bold text-blue-900 flex justify-between">
                        <span>Thành tiền dòng dự kiến:</span>
                        <span>{formData['Thành tiền dòng'] ? `${formData['Thành tiền dòng']}đ` : '0đ'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {isDuplicatePO && (
                <div className="mt-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-3 text-sm flex items-start gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                  <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-sm">Cảnh báo trùng lặp đơn hàng</p>
                    <p className="text-xs text-amber-700 mt-0.5">Mã đơn hàng <strong className="font-bold">"{formData['Đơn hàng']}"</strong> đã tồn tại trong danh sách. Hệ thống vẫn cho phép lưu nhưng hãy kiểm tra kỹ để tránh nhầm lẫn dữ liệu.</p>
                  </div>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50 rounded-b-xl">
              <button onClick={() => setIsModalOpen(false)} type="button" className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                Hủy
              </button>
              <button type="submit" form="add-form" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-md">
                Lưu dữ liệu
              </button>
            </div>
          </div>
        </div>
      )}

      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200] flex items-end sm:items-center justify-end">
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            className="w-full sm:max-w-md bg-white max-h-[90vh] sm:h-full rounded-t-[28px] sm:rounded-none shadow-2xl flex flex-col border-t sm:border-t-0 sm:border-l border-black/[0.08] pb-safe sm:pb-0 overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-black/[0.06] flex items-center gap-3 bg-[#F5F5F7]">
              <MacTrafficLights onClose={() => {
                setIsEditModalOpen(false);
                setEditingRow(null);
                setFormData({});
              }} />
              <div className="h-4 w-px bg-black/[0.08]" />
              <div>
                <h3 className="text-sm font-bold text-[#1D1D1F] flex items-center gap-2">
                  <Edit size={16} className="text-blue-600" />
                  Chi tiết & Chỉnh sửa
                </h3>
                <p className="text-[11px] text-slate-500 font-medium">Cập nhật thông tin cho bản ghi này</p>
              </div>
            </div>
            
            <div className="flex-1 overflow-auto p-6 space-y-4">
              <form id="edit-form-side" onSubmit={handleSubmit} className="space-y-4">
                {headers.filter(h => {
                  if (h === 'id' || h === 'isDeleted' || h === 'createdAt' || h === 'updatedAt' || h === 'deletedAt' || h === 'STT') return false;
                  if (isPOLineTable) {
                    const allowedFields = [
                      'Số đơn hàng', 'Đơn hàng', 'Mã giá bán', 'Tên sản phẩm', 'Sản phẩm',
                      'Số lượng', 'Ngày đặt hàng', 'Ngày giao', 'Thời gian xử lý', 'Khách hàng'
                    ];
                    return allowedFields.includes(h);
                  }
                  return true;
                }).map(h => {
                  // Reuse logic for edit form
                  if (h === 'Ngày đặt hàng' || h === 'Ngày giao' || h.includes('Ngày')) {
                    return (
                      <div key={h} className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">{h}</label>
                        <input 
                          type="date" 
                          className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all"
                          value={parseDateToISO(formData[h]) || ""}
                          onChange={(e) => handleTextChange(e, h)}
                        />
                      </div>
                    );
                  }

                  if (h === 'Khách hàng') {
                    if (isPOLineTable) {
                      return (
                        <div key={h} className="space-y-1.5 opacity-80">
                          <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">{h} (Tự động)</label>
                          <input 
                            type="text" 
                            readOnly
                            className="w-full px-4 py-2.5 bg-gray-100 border border-gray-200 rounded-xl text-sm cursor-not-allowed outline-none"
                            value={formData[h] || ""}
                            placeholder="Chọn Số đơn hàng để tự động điền"
                          />
                        </div>
                      );
                    }
                    return (
                      <div key={h} className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">{h}</label>
                        <select
                          className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all"
                          value={formData[h] || ""}
                          onChange={(e) => handleTextChange(e, h)}
                        >
                          <option value="">Chọn khách hàng</option>
                          {customerList.map(custName => (
                            <option key={custName} value={custName}>
                              {custName}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  }

                  if (h === 'Nhà cung cấp' || h === 'Nhà Cung Cấp' || h === 'Mã Nhà Cung Cấp' || h === 'Mã NCC') {
                    return (
                      <div key={h} className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">{h}</label>
                        <select
                          className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all"
                          value={formData[h] || ""}
                          onChange={(e) => handleTextChange(e, h)}
                        >
                          <option value="">Chọn nhà cung cấp</option>
                          {suppliers.map(s => {
                            const val = s['Supplier_ID'] || s['Nhà Cung Cấp'] || s['Mã NCC'] || s.name;
                            return (
                              <option key={s.id || val} value={val}>
                                {val}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    );
                  }

                  if (h === 'Sản phẩm' || h === 'Mã sản phẩm' || h === 'Mã hàng' || (isPOLineTable && h === 'Tên sản phẩm')) {
                    return (
                      <ProductCombobox 
                        key={h}
                        label={h}
                        value={formData[h] || ''}
                        onChange={(val) => handleProductChange(val, h)}
                        products={products}
                        labelClassName="text-xs font-bold text-gray-500 uppercase tracking-wide"
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all w-full"
                      />
                    );
                  }

                  if (isPOLineTable && h === 'Mã giá bán') {
                    return (
                      <PricingCombobox 
                        key={h}
                        label={h}
                        value={formData[h] || ''}
                        onChange={(val) => handleTextChange(val, h)}
                        pricingData={pricingData}
                        labelClassName="text-xs font-bold text-gray-500 uppercase tracking-wide"
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all w-full"
                      />
                    );
                  }

                  if ((h === 'Số đơn hàng' || h === 'Đơn hàng') && isPOLineTable) {
                    return (
                      <div key={h} className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Số đơn hàng (PO)</label>
                        <select
                          className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all"
                          value={formData[h] || ""}
                          onChange={(e) => handleTextChange(e, h)}
                        >
                          <option value="">Chọn PO liên kết</option>
                          {uniquePOs.map(po => (
                            <option key={po} value={po}>{po}</option>
                          ))}
                        </select>
                      </div>
                    );
                  }

                  if (h === 'Phân loại') {
                    return (
                      <div key={h} className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">{h}</label>
                        <select
                          className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all"
                          value={formData[h] || ""}
                          onChange={(e) => handleTextChange(e, h)}
                        >
                          <option value="">Chọn phân loại</option>
                          {categories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>
                    );
                  }

                  if (h === 'Trạng Thái' && isPOHeaderTable) {
                    return (
                      <div key={h} className="space-y-1.5 opacity-60">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">{h}</label>
                        <input 
                          type="text" 
                          readOnly
                          className="w-full px-4 py-2.5 bg-gray-100 border border-gray-200 rounded-xl text-sm cursor-not-allowed"
                          value={formData[h] || ""}
                        />
                      </div>
                    );
                  }

                  if (h === 'Tổng giá trị đơn hàng' && isPOHeaderTable) {
                    return (
                      <div key={h} className="space-y-1.5 opacity-60">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">{h}</label>
                        <input 
                          type="text" 
                          readOnly
                          className="w-full px-4 py-2.5 bg-gray-100 border border-gray-200 rounded-xl text-sm cursor-not-allowed"
                          value={formData[h] || ""}
                        />
                      </div>
                    );
                  }

                  return (
                    <div key={h} className="space-y-1.5">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">{h}</label>
                      <input 
                        type="text" 
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all"
                        value={formData[h] || ""}
                        onChange={(e) => handleTextChange(e, h)}
                        disabled={h === 'STT'}
                      />
                    </div>
                  );
                })}
              </form>

              {isPOLineTable && (formData['Tên sản phẩm'] || formData['Mã giá bán']) && (
                <div className="mt-4 bg-blue-50 border border-blue-200 text-blue-900 rounded-xl p-4 text-sm animate-in fade-in duration-200">
                  <div className="font-semibold text-blue-800 mb-2.5 flex items-center gap-1.5">
                    <CheckCircle size={16} className="text-blue-600" /> Thông tin đối chiếu sản phẩm & đơn giá
                  </div>
                  <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs">
                    <div className="col-span-2 border-b border-blue-100 pb-1.5 mb-1">
                      <strong>Tên sản phẩm:</strong> <span className="text-gray-900 font-medium block mt-0.5">{formData['Tên sản phẩm'] || 'N/A'}</span>
                    </div>
                    <div><strong>Mã giá bán:</strong> <span className="text-gray-900 font-medium">{formData['Mã giá bán'] || 'N/A'}</span></div>
                    <div><strong>Đơn vị tính:</strong> <span className="text-gray-900 font-medium">{formData['ĐVT'] || 'Cái'}</span></div>
                    <div><strong>Nhóm hàng:</strong> <span className="text-gray-900 font-medium">{formData['Nhóm hàng'] || 'N/A'}</span></div>
                    <div><strong>Mã của khách:</strong> <span className="text-gray-900 font-medium">{formData['Mã của khách'] || 'N/A'}</span></div>
                    <div><strong>Đơn giá bán:</strong> <span className="text-green-600 font-semibold">{formData['Đơn giá bán'] ? `${Number(parseNumber(formData['Đơn giá bán'])).toLocaleString('vi-VN')}đ` : '0đ'}</span></div>
                    <div><strong>Đơn giá nhập:</strong> <span className="text-amber-600 font-semibold">{formData['Đơn giá nhập'] ? `${Number(parseNumber(formData['Đơn giá nhập'])).toLocaleString('vi-VN')}đ` : '0đ'}</span></div>
                    <div><strong>Lợi nhuận dự kiến:</strong> <span className="text-blue-600 font-semibold">{formData['Lợi nhuận'] ? `${Number(parseNumber(formData['Lợi nhuận'])).toLocaleString('vi-VN')}đ` : '0đ'}</span></div>
                    <div><strong>Số lượng đặt:</strong> <span className="text-gray-950 font-bold">{formData['Số lượng'] || 0}</span></div>
                    <div className="col-span-2 border-t border-blue-100 pt-2 mt-1">
                      <div className="text-sm font-bold text-blue-900 flex justify-between">
                        <span>Thành tiền dòng dự kiến:</span>
                        <span>{formData['Thành tiền dòng'] ? `${formData['Thành tiền dòng']}đ` : '0đ'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-100 bg-gray-50 flex flex-col gap-3">
              <div className="flex gap-3">
                <button 
                  type="submit"
                  form="edit-form-side"
                  className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-md shadow-blue-100 flex items-center justify-center gap-2"
                >
                  <Check size={18} />
                  Lưu thay đổi
                </button>
                <button 
                  onClick={() => { setIsEditModalOpen(false); setEditingRow(null); }}
                  className="px-6 py-3 border border-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-100 transition-all"
                >
                  Hủy
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function AssistantView() {
  const INITIAL_MESSAGE = { role: "model", content: "Xin chào! Tôi là TSG Business Assistant. Bạn có thể tra cứu giá, xem báo cáo tổng quan, phân tích lợi nhuận hoặc gửi ảnh/PDF Đơn hàng PO, Phiếu xuất kho để tôi xử lý giúp bạn." };
  
  const [messages, setMessages] = useState<{role: string, content: string, file?: File}[]>([
    INITIAL_MESSAGE
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSendPrompt = async (promptText: string, fileAttachment?: File) => {
    if ((!promptText.trim() && !fileAttachment) || isLoading) return;

    const newMessages = [...messages, { role: "user", content: promptText, file: fileAttachment || undefined }];
    setMessages(newMessages);
    setInput("");
    const fileToSend = fileAttachment || selectedFile;
    setSelectedFile(null);
    setIsLoading(true);

    try {
      const responseText = await sendGeminiPrompt({
        prompt: promptText,
        systemInstruction: FULL_SYSTEM_PROMPT,
        history: newMessages.slice(0, -1).map(m => ({ role: m.role, content: m.content })),
        file: fileToSend || undefined
      });
      
      setMessages(prev => [...prev, { role: "model", content: responseText }]);
    } catch (err: any) {
      setMessages(prev => [...prev, { role: "model", content: `❌ Lỗi xử lý Trợ lý AI: ${err.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendPrompt(input, selectedFile || undefined);
  };

  const handleClearChat = () => {
    setMessages([INITIAL_MESSAGE]);
    setSelectedFile(null);
    setInput("");
  };

  const quickPrompts = [
    "📊 Báo cáo tổng quan",
    "💰 Tra giá TH130/07 cho Thăng Long",
    "📦 Trạng thái đơn 26/KHVT/0600",
    "⚠️ Sự cố giao hàng",
    "💰 Phân tích lợi nhuận theo NCC"
  ];

  return (
    <div className="flex flex-col h-full bg-slate-50 relative">
      {/* Header */}
      <div className="p-4 bg-white border-b border-slate-200 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
            <Bot size={20} />
          </div>
          <div>
            <h2 className="font-semibold text-slate-800 text-base leading-tight">Trợ lý Vận hành TSG</h2>
            <p className="text-xs text-slate-500">Được hỗ trợ bởi Gemini 3.6 Flash</p>
          </div>
        </div>
        <button
          onClick={handleClearChat}
          className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200 transition-all font-medium"
          title="Xóa lịch sử trò chuyện"
        >
          Xóa trò chuyện
        </button>
      </div>
      
      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        {messages.map((msg, idx) => (
          <div key={idx} className={clsx("flex gap-3 md:gap-4 max-w-4xl mx-auto", msg.role === "user" ? "flex-row-reverse" : "")}>
            <div className={clsx("w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold shadow-xs", msg.role === "user" ? "bg-blue-600 text-white" : "bg-slate-800 text-white")}>
              {msg.role === "user" ? "BẠN" : <Bot size={18} />}
            </div>
            <div className={clsx("flex flex-col gap-2 max-w-[85%] md:max-w-[80%]", msg.role === "user" ? "items-end" : "items-start")}>
              {msg.file && (
                <div className="bg-slate-100 text-slate-700 rounded-lg p-2.5 text-xs flex items-center gap-2 border border-slate-200 shadow-2xs">
                  <FileText size={15} className="text-blue-600" />
                  <span className="truncate max-w-xs font-medium">{msg.file.name}</span>
                </div>
              )}
              {msg.content && (
                <div className={clsx("rounded-2xl px-5 py-3.5 text-[14.5px] leading-relaxed shadow-xs transition-all duration-200", msg.role === "user" ? "bg-blue-600 text-white rounded-tr-xs" : "bg-white border border-slate-200 text-slate-800 rounded-tl-xs shadow-2xs")}>
                  {msg.role === "user" ? (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  ) : (
                    <div className="markdown-body prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2 prose-strong:text-slate-900 prose-table:text-xs">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-4 max-w-4xl mx-auto">
            <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
              <Bot size={18} />
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl px-5 py-3.5 text-slate-600 flex items-center gap-2.5 shadow-2xs text-sm">
              <Loader2 size={16} className="animate-spin text-blue-600" />
              <span>Đang truy xuất dữ liệu & suy luận...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Action Chips & Input Area */}
      <div className="p-3 md:p-4 bg-white border-t border-slate-200 space-y-3">
        {/* Quick Prompts */}
        <div className="max-w-4xl mx-auto flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs">
          <span className="text-slate-400 font-medium flex-shrink-0">Gợi ý nhanh:</span>
          {quickPrompts.map((qp, qpIdx) => (
            <button
              key={qpIdx}
              type="button"
              onClick={() => handleSendPrompt(qp)}
              disabled={isLoading}
              className="px-3 py-1.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 border border-slate-200 rounded-full font-medium transition-all whitespace-nowrap flex-shrink-0 disabled:opacity-50 cursor-pointer"
            >
              {qp}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto flex items-end gap-2.5 relative">
          <label className="cursor-pointer p-3 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors flex-shrink-0 border border-slate-200 bg-slate-50" title="Tải lên tài liệu (PO, PXK, Ảnh/PDF)">
            <input type="file" className="hidden" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} accept="image/*,application/pdf" />
            <Upload size={18} />
          </label>
          <div className="flex-1 relative">
             {selectedFile && (
               <div className="absolute bottom-full mb-2 left-0 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 border border-blue-200 shadow-xs">
                 <FileText size={14} />
                 <span className="truncate max-w-[200px]">{selectedFile.name}</span>
                 <button type="button" onClick={() => setSelectedFile(null)} className="ml-1 hover:text-blue-900 text-sm font-bold">&times;</button>
               </div>
             )}
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Nhập câu hỏi hoặc yêu cầu cho Trợ lý TSG (VD: Báo cáo tổng quan, Tra giá...)..."
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none min-h-[48px] max-h-32 text-slate-800 placeholder-slate-400"
              rows={input.split('\n').length > 1 ? Math.min(input.split('\n').length, 4) : 1}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />
          </div>
          <button
            type="submit"
            disabled={(!input.trim() && !selectedFile) || isLoading}
            className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0 shadow-xs flex items-center justify-center cursor-pointer"
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}
