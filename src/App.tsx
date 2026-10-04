import * as XLSX from 'xlsx';
import HelpGuideModal from "./components/HelpGuideModal";
import { Toaster, toast } from 'react-hot-toast';
import React, { useState, useRef, useEffect, useMemo, Suspense } from "react";
import { Send, Upload, FileText, CheckCircle, CalendarDays, Calendar, Database, Package, Truck, CreditCard, ChevronRight, ChevronDown, ChevronUp, Sparkles, ChevronLeft, Menu, Loader2, Bot, PlusCircle, Users, BookUser, LayoutDashboard, Search, Camera, Settings, HelpCircle, Download, Columns, GripVertical, Eye, EyeOff, X, Filter, AlertTriangle, TrendingUp, Edit, Trash2, Check, HardDrive, ShieldCheck, Printer, Scale, Percent, Layers, DollarSign, ArrowUpRight, Tag, Building2, Factory, UploadCloud, Share2, Copy, RefreshCw, ExternalLink, Image as ImageIcon } from "lucide-react";
import { motion } from "motion/react";
import clsx from "clsx";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Papa from "papaparse";
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
import { PRICING_DATA, PO_LINES_DATA, PO_HEADER_DATA, DELIVERY_DATA, CUSTOMER_DATA, SUPPLIER_DATA, CONTACT_DATA, PRODUCT_DATA, DELIVERY_PLAN_DATA, INITIAL_SPECS_DATA, INITIAL_CONTRACTS_DATA } from "./data";
import { 
  DashboardView, MemoryStorageModal, 
  ProductDetailModal, PODetailModal, POFileUploadModal, 
  ProductHoverCard, ProductCombobox, PricingCombobox,
  Header, Breadcrumbs, MobileBottomNav
} from "./components";
import { uploadFileDirectToGoogleDrive } from './lib/driveSync';

// Code-split heavy views with React.lazy for instant initial bundle loading
const CustomerView = React.lazy(() => import("./components/CustomerView"));
const SupplierView = React.lazy(() => import("./components/SupplierView"));
const SettingsView = React.lazy(() => import("./components/SettingsView"));
const ContactView = React.lazy(() => import("./components/ContactView"));
const OCRView = React.lazy(() => import("./components/OCRView"));
const TasksView = React.lazy(() => import("./components/TasksView"));
const WorkflowView = React.lazy(() => import("./components/WorkflowView"));
const LogisticsHubView = React.lazy(() => import("./components/LogisticsHubView"));
const StorageView = React.lazy(() => import("./components/StorageView"));
const SpecsView = React.lazy(() => import("./components/SpecsView"));
const ContractsView = React.lazy(() => import("./components/ContractsView"));
const CommissionView = React.lazy(() => import("./components/CommissionView"));
const ProductsView = React.lazy(() => import("./components/ProductsView"));
const FactoryManagementView = React.lazy(() => import("./components/FactoryManagementView"));
const TableView = React.lazy(() => import("./components/TableView"));
const AssistantView = React.lazy(() => import("./components/AssistantView"));
const HelpGuideView = React.lazy(() => import("./components/HelpGuideView"));
const UIPreview = React.lazy(() => import("./UIPreview"));

function ViewLoadingFallback() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-12 min-h-[400px]">
      <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/80 dark:border-slate-800/80 shadow-lg animate-pulse">
        <Loader2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400 animate-spin" />
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Đang tải mô-đun...</span>
      </div>
    </div>
  );
}

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

function parseCSV(csvText: string) {
  return Papa.parse(csvText.trim(), { header: true, skipEmptyLines: true }).data;
}

export default function App() {
  const [selectedProductDetails, setSelectedProductDetails] = useState<string | null>(null);
  const [selectedPoDetails, setSelectedPoDetails] = useState<string | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<'north' | 'all' | 'south'>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("tsg_selected_region") as any) || "all";
    }
    return "all";
  });

  const handleRegionChange = (reg: 'north' | 'all' | 'south') => {
    setSelectedRegion(reg);
    if (typeof window !== "undefined") {
      localStorage.setItem("tsg_selected_region", reg);
    }
    toast.success(
      reg === "north" 
        ? "🌟 Đã lọc vùng: Miền Bắc (Thăng Long, Bắc Sơn, Thanh Hóa)" 
        : reg === "south" 
        ? "Đã lọc vùng: Miền Nam (Sài Gòn, Bến Tre, Quốc Đại)" 
        : "🏢 Đã chuyển chế độ: Toàn bộ công ty (Kế toán)"
    );
  };

  const normalizeText = (t: string) => {
    return String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  };

  const isNorthCust = (name: string) => {
    if (!name) return false;
    const n = normalizeText(name);
    return n.includes("thang long") || n.includes("bac son") || n.includes("thanh hoa");
  };

  const isSouthCust = (name: string) => {
    if (!name) return false;
    const n = normalizeText(name);
    return n.includes("sai gon") || n.includes("ben tre") || n.includes("quoc dai");
  };

  const matchesRegion = (item: any) => {
    if (selectedRegion === "all") return true;
    const regionField = String(item["Vùng miền"] || item.region || "").toLowerCase();
    const cust = String(item["Khách hàng"] || item["RP_Khách hàng"] || item["Tên khách hàng"] || item["Công ty"] || item.customer || item.partnerName || "");
    
    if (selectedRegion === "north") {
      if (regionField.includes("bắc") || regionField.includes("north") || regionField.includes("bac")) return true;
      return isNorthCust(cust);
    }
    if (selectedRegion === "south") {
      if (regionField.includes("nam") || regionField.includes("south")) return true;
      return isSouthCust(cust);
    }
    return true;
  };

  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("tab") || "dashboard";
  });
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
  const contractsData = useFirestoreCollection('contracts', INITIAL_CONTRACTS_DATA);
  const commissionData = useFirestoreCollection('commissions', []);
  const [googleToken, setGoogleToken] = useState<string | null>(() => {
    return localStorage.getItem('google_access_token');
  });

  useEffect(() => {
    try {
      const currentVersion = localStorage.getItem('tsg_system_dataset_version');
      if (currentVersion !== '2026_08_27_ACC_GOLD_V8') {
        const allKeys = Object.keys(localStorage);
        allKeys.forEach(k => {
          if (k.startsWith('tsg_cache_') || k.startsWith('tsg_user_mod_deliveries') || k.startsWith('tsg_dataset_')) {
            localStorage.removeItem(k);
          }
        });
        localStorage.setItem('tsg_system_dataset_version', '2026_08_27_ACC_GOLD_V8');
      }
    } catch (e) {
      // ignore
    }

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
      const remaining = ordered - totalDelivered;
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
      
      const remainingForLine = qtyOrdered - totalDeliveredForLine;
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

  const regionFilteredPoHeaders = useMemo(() => poHeaderData.filter(matchesRegion), [poHeaderData, selectedRegion]);
  const regionFilteredPoLines = useMemo(() => enrichedPoLinesData.filter(matchesRegion), [enrichedPoLinesData, selectedRegion]);
  const regionFilteredDeliveries = useMemo(() => enrichedDeliveryData.filter(matchesRegion), [enrichedDeliveryData, selectedRegion]);
  const regionFilteredDeliveryPlans = useMemo(() => enrichedDeliveryPlanData.filter(matchesRegion), [enrichedDeliveryPlanData, selectedRegion]);
  const regionFilteredCustomers = useMemo(() => customerData.filter(matchesRegion), [customerData, selectedRegion]);



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
        'id', 'Doanh thu dự kiến', 'Lợi nhuận dự kiến', 'Tiến độ', 'Số dòng',
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

  const handleRestoreDatabase = async (importedData: any) => {
    const toastId = toast.loading('Đang khôi phục toàn bộ cơ sở dữ liệu...');
    try {
      const res = await dbEngine.restoreDatabase(importedData);
      toast.success(`Đã khôi phục thành công ${res.totalRestored} bản ghi (${res.restoredCollections.length} danh mục)!`, { id: toastId });
    } catch (err: any) {
      console.error("Restore error:", err);
      toast.error("Lỗi khi khôi phục dữ liệu: " + (err?.message || err), { id: toastId });
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

      let driveData: { driveFileId?: string; driveLink?: string; downloadLink?: string; folderId?: string; folderLink?: string; folderPath?: string; fileName?: string } = {};

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

      const folderPath = driveData.folderPath || `TSG_Business_Documents/${year}/${metadata.documentType || 'Chung'}/Thang_${month}`;
      const folderLink = driveData.folderLink || (driveData.driveLink ? driveData.driveLink.substring(0, driveData.driveLink.lastIndexOf('/')) : '');

      return {
        ...driveData,
        fileId,
        fileName: fileNameToSave,
        folderPath,
        folderLink
      };
    } catch (error: any) {
      console.warn('Background handleUploadToDrive error:', error);
      return null;
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
      badge: "3",
      items: [
        { id: "po", label: "Quản Lý Đơn Hàng PO", icon: <FileText size={15} />, iconBg: "bg-teal-500", badge: poHeaderData.length },
        { id: "factory", label: "Nhà Máy & Sản Xuất LGT", icon: <Factory size={15} />, iconBg: "bg-amber-500", badge: "Mới" },
        { id: "logistics", label: "Kế Hoạch & Giao Hàng 360°", icon: <Truck size={15} />, iconBg: "bg-orange-500", badge: deliveryData.length },
      ]
    },
    {
      id: "commercial",
      title: "Thương Mại & Danh Mục",
      badge: "5",
      items: [
        { id: "customers", label: "Khách Hàng & Đối Tác", icon: <Users size={15} />, iconBg: "bg-sky-500", badge: customerData.length },
        { id: "pricing", label: "Bảng Giá 2026", icon: <Package size={15} />, iconBg: "bg-emerald-500", badge: pricingData.length },
        { id: "contracts", label: "Hợp Đồng Mua / Bán", icon: <Scale size={15} />, iconBg: "bg-blue-600", badge: contractsData.length },
        { id: "commissions", label: "Quản Lý Hoa Hồng (3 Cách)", icon: <Percent size={15} />, iconBg: "bg-purple-600", badge: commissionData.length || "Mới" },
        { id: "products", label: "Sản Phẩm & Tiêu Chuẩn Specs", icon: <Package size={15} />, iconBg: "bg-indigo-500", badge: productData.length },
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
  ], [poHeaderData.length, deliveryData.length, customerData.length, pricingData.length, contractsData.length, commissionData.length, productData.length, fileStorageData.length]);

  const TAB_TITLES: Record<string, string> = {
    dashboard: "Bảng Điều Hành",
    workflow: "Quy Trình Nghiệp Vụ",
    customers: "Quản Lý Khách Hàng",
    pricing: "Bảng Giá 2026",
    commissions: "Quản Lý Hoa Hồng (3 Phương Thức)",
    contracts: "Hợp Đồng Mua / Bán",
    po: "Đơn Hàng (PO)",
    factory: "Nhà Máy & Sản Xuất LGT",
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
    <div className="flex flex-col lg:flex-row min-h-[100dvh] h-[100dvh] bg-[#F8F9FB] dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans print:bg-white print:h-auto print:block overflow-hidden">
      <Toaster position="top-right" />

      {/* Mobile Navigation Drawer - Apple iOS Light Sheet */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div 
            className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity" 
            onClick={() => setMobileMenuOpen(false)} 
          />
          <div className="relative w-4/5 max-w-xs bg-[#F5F5F7] dark:bg-slate-900 flex flex-col text-slate-900 dark:text-slate-100 shadow-2xl h-full border-r border-slate-200/80 dark:border-slate-800 z-10 animate-in slide-in-from-left duration-200 pl-[max(env(safe-area-inset-left),0px)] pb-safe">
            <div className="p-4 border-b border-slate-200/60 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                <h2 className="text-xs font-black tracking-wider bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent uppercase font-display">TSG BUSINESS OS</h2>
              </div>
              <button 
                onClick={() => setMobileMenuOpen(false)} 
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Đóng menu"
              >
                <X size={16} />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-3 custom-scrollbar">
              {navGroups.map((group, groupIdx) => {
                const isGroupCollapsed = collapsedGroups[group.id];
                const hasActiveItem = group.items.some(it => it.id === activeTab);
                
                return (
                  <div key={group.id} className={clsx("space-y-1", groupIdx > 0 && "pt-2 border-t border-slate-200/60 dark:border-slate-800/60")}>
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.id)}
                      className="w-full flex items-center justify-between px-2.5 py-1 text-[10.5px] font-extrabold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 uppercase tracking-wider transition rounded-lg hover:bg-black/[0.03] dark:hover:bg-white/[0.03]"
                    >
                      <span className="flex items-center gap-1.5 truncate">
                        <span>{group.title}</span>
                      </span>
                      <div className="flex items-center gap-1">
                        {group.badge && (
                          <span className="text-[9.5px] font-mono px-1.5 py-0.2 rounded-full bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold tabular-nums">
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

            <div className="p-3 border-t border-slate-200/60 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 text-center">
              <p className="text-[10px] text-slate-400 font-medium">Tâm Sen Group • ERP Business OS</p>
            </div>
          </div>
        </div>
      )}

      {/* Desktop macOS Sequoia Sidebar */}
      <aside className={clsx(
        "hidden lg:flex bg-[#F5F5F7]/95 dark:bg-slate-900/95 backdrop-blur-2xl border-r border-slate-200/60 dark:border-slate-800/60 flex-col text-slate-900 dark:text-slate-100 shadow-[1px_0_10px_rgba(0,0,0,0.02)] print:hidden relative z-20 shrink-0 select-none transition-all duration-200",
        isSidebarCollapsed ? "w-16" : "w-64"
      )}>
        
        {/* macOS Window Controls & Title */}
        <div className="p-3.5 border-b border-slate-200/60 dark:border-slate-800/60 bg-white/40 dark:bg-slate-900/40">
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
                <h1 className="text-xs font-bold text-slate-900 dark:text-white tracking-[-0.015em] leading-tight">TSG Business OS</h1>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Tâm Sen Group • ERP 2026</p>
              </div>
            </div>
          )}

          {!isSidebarCollapsed && (
            <div className="mt-3 px-1">
              <button
                type="button"
                onClick={() => setIsMemoryModalOpen(true)}
                className="w-full flex items-center justify-between px-2.5 py-1.5 bg-emerald-50/90 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60 rounded-xl text-[11px] font-semibold transition active:scale-[0.98] shadow-2xs cursor-pointer"
                title="Xem trạng thái bộ nhớ lưu trữ và sao lưu dữ liệu"
              >
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Bộ nhớ: Đã lưu an toàn</span>
                </div>
                <span className="text-[9.5px] font-mono font-bold bg-white/90 dark:bg-slate-900 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 tabular-nums">13 CSDL</span>
              </button>
            </div>
          )}
        </div>

        {/* Apple Source List Navigation */}
        <nav className="flex-1 overflow-y-auto py-2 space-y-2.5 custom-scrollbar px-2">
          {!isSidebarCollapsed && (
            <div className="px-1 mb-1.5">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                <input
                  type="text"
                  value={menuSearchQuery}
                  onChange={(e) => setMenuSearchQuery(e.target.value)}
                  placeholder="Tìm nhanh tính năng..."
                  className="w-full pl-7 pr-7 py-1 bg-black/[0.03] dark:bg-white/[0.05] hover:bg-black/[0.05] dark:hover:bg-white/[0.08] focus:bg-white dark:focus:bg-slate-800 border border-transparent focus:border-blue-400 rounded-xl text-[11px] outline-none transition text-slate-900 dark:text-white placeholder:text-slate-400"
                />
                {menuSearchQuery && (
                  <button
                    onClick={() => setMenuSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
          )}

          {navGroups.map((group, groupIdx) => {
            const q = menuSearchQuery.toLowerCase().trim();
            const filteredItems = q 
              ? group.items.filter(it => it.label.toLowerCase().includes(q) || it.id.toLowerCase().includes(q))
              : group.items;

            if (q && filteredItems.length === 0) return null;

            const isGroupCollapsed = collapsedGroups[group.id];
            const hasActiveItem = group.items.some(it => it.id === activeTab);
            const shouldShowItems = isSidebarCollapsed || (!isGroupCollapsed || hasActiveItem || Boolean(q));

            return (
              <div key={group.id} className={clsx("space-y-0.5", groupIdx > 0 && "pt-2 border-t border-slate-200/60 dark:border-slate-800/60")}>
                {!isSidebarCollapsed && (
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    className="w-full flex items-center justify-between px-2.5 py-1 text-[10px] font-bold text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 uppercase tracking-wider transition rounded-lg hover:bg-black/[0.03] dark:hover:bg-white/[0.03] cursor-pointer select-none"
                  >
                    <span className="truncate">{group.title}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {group.badge && (
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-slate-200/70 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-semibold tabular-nums">
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
      </aside>

      {/* Main Content Area with Header */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Unified Glassmorphism Header */}
        <Header
          activeTab={activeTab}
          onNavigate={navItemClick}
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          subTab={
            activeTab === 'contracts' ? 'contracts' :
            activeTab === 'commissions' ? 'commissions' :
            activeTab === 'specs' ? 'specs' :
            activeTab === 'polines' ? 'polines' :
            activeTab === 'delivery_plan' ? 'plan' :
            activeTab === 'delivery' ? 'delivery' :
            activeTab === 'reconcile' ? 'reconcile' :
            undefined
          }
          itemContext={
            selectedPoDetails ? { label: `PO #${selectedPoDetails}`, id: selectedPoDetails, type: 'po' } :
            selectedProductDetails ? { label: selectedProductDetails, id: selectedProductDetails, type: 'product' } :
            targetCustomerId && activeTab === 'customers' ? { label: `Khách: ${targetCustomerId}`, id: targetCustomerId } :
            null
          }
          onOpenMemoryModal={() => setIsMemoryModalOpen(true)}
          onOpenHelpModal={() => setIsHelpModalOpen(true)}
          onToggleFullscreen={handleToggleFullScreen}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          dbCount={13}
          isSyncing={false}
          selectedRegion={selectedRegion}
          onRegionChange={handleRegionChange}
        />

        {/* Main Content Viewport */}
        <main className="flex-1 flex flex-col overflow-y-auto min-h-0 print:overflow-visible print:h-auto print:block relative pb-24 lg:pb-6 pl-[max(env(safe-area-inset-left),0px)] pr-[max(env(safe-area-inset-right),0px)]">
        <Suspense fallback={<ViewLoadingFallback />}>
        {activeTab === "dashboard" && (
          <DashboardView 
            poData={regionFilteredPoHeaders} 
            deliveryData={regionFilteredDeliveries} 
            poLinesData={regionFilteredPoLines} 
            customersData={regionFilteredCustomers} 
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
            onNavigateToPricing={() => setActiveTab('pricing')}
          />
        )}
        {activeTab === "commissions" && (
          <CommissionView
            commissionData={commissionData}
            customerData={customerData}
            contactData={contactData}
            poHeaderData={poHeaderData}
            poLinesData={enrichedPoLinesData}
            deliveryData={enrichedDeliveryData}
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
        {activeTab === "pricing" && (
          <TableView 
            pricingData={pricingData} 
            contractsData={contractsData} 
            products={productData} 
            suppliers={supplierData} 
            poHeaders={poHeaderData} 
            title="Bảng giá 2026 (Phân loại theo Khách hàng & Nhóm hàng)" 
            data={pricingData} 
            onEdit={(row) => handleUpdateToFirestore("pricing", row)} 
            onDelete={(row) => handleDeleteFromFirestore("pricing", row)} 
            onProductClick={(val) => setSelectedProductDetails(val)} 
            onPoClick={(val) => setSelectedPoDetails(val)} 
            specsData={specsData} 
            onNavigateTab={(tab) => setActiveTab(tab)}
          />
        )}
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
            fileStorageData={fileStorageData}
          />
        )}
        {activeTab === "factory" && (
          <FactoryManagementView 
            selectedRegion={selectedRegion}
            onNavigateTab={(tab) => setActiveTab(tab)}
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
              onRestoreData={handleRestoreDatabase}
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
        {activeTab === "ui-preview" && (
          <UIPreview />
        )}
        </Suspense>
        </main>
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
        onRestoreData={handleRestoreDatabase}
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
      <MobileBottomNav
        activeTab={activeTab}
        onNavigate={navItemClick}
        onOpenMenu={() => setMobileMenuOpen(true)}
        isMenuOpen={mobileMenuOpen}
        deliveryCount={deliveryData.length}
        poCount={poHeaderData.length}
      />

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
            onUpdatePOHeader={(row) => handleUpdateToFirestore("po_headers", row)}
            fileStorageData={fileStorageData}
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
      type="button"
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      title={isCollapsed ? `${label}${badge !== undefined && badge !== null ? ` (${badge})` : ''}` : undefined}
      className={clsx(
        "relative flex items-center rounded-xl text-xs transition-all duration-150 cursor-pointer group select-none text-left",
        isCollapsed 
          ? "w-10 h-10 mx-auto justify-center p-0 mb-1" 
          : "w-full gap-2.5 px-2.5 py-1.5",
        isActive 
          ? "text-[#007AFF] dark:text-blue-400 font-bold" 
          : "text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-black/[0.03] dark:hover:bg-white/[0.04] font-medium"
      )}
    >
      {/* Sliding Active Pill Background with Motion layoutId */}
      {isActive && (
        <motion.div
          layoutId="active-sidebar-pill"
          className="absolute inset-0 bg-blue-500/12 dark:bg-blue-500/25 border border-blue-500/25 dark:border-blue-400/30 rounded-xl shadow-2xs -z-0"
          transition={{ type: "spring", stiffness: 450, damping: 32 }}
        />
      )}

      {/* Icon */}
      <div className={clsx(
        "w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform duration-150 group-hover:scale-105 z-10",
        isActive 
          ? "bg-[#007AFF] text-white shadow-xs shadow-blue-500/30" 
          : `${iconBg} text-white shadow-2xs`
      )}>
        {icon}
      </div>

      {/* Expanded Label & Badges */}
      {!isCollapsed && (
        <div className="flex-1 flex items-center justify-between min-w-0 z-10">
          <span className="truncate tracking-[-0.012em] font-semibold">{label}</span>
          {badge !== undefined && badge !== null && (
            <span className={clsx(
              "text-[10px] font-bold font-mono px-1.5 py-0.5 rounded-full tabular-nums shrink-0 ml-1.5",
              isActive 
                ? "bg-blue-600 text-white shadow-2xs" 
                : badgeColor || "bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-400 group-hover:bg-slate-300/80"
            )}>
              {badge}
            </span>
          )}
        </div>
      )}

      {/* Collapsed Hover Tooltip */}
      {isCollapsed && (
        <div className="absolute left-full ml-3 px-2.5 py-1 bg-slate-900/95 dark:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-xl whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-150 z-50 flex items-center gap-1.5 backdrop-blur-md">
          <span>{label}</span>
          {badge !== undefined && badge !== null && (
            <span className="px-1.5 py-0.2 text-[9.5px] font-mono font-bold bg-blue-600 text-white rounded-full tabular-nums">
              {badge}
            </span>
          )}
        </div>
      )}
    </motion.button>
  );
}

