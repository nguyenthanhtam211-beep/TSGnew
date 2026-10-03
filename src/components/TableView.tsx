import React, { useState, useMemo, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { 
  GripVertical, Search, Download, PlusCircle, Trash2, Columns, X, 
  Printer, UploadCloud, FileText, CheckCircle, Upload, Tag, 
  ChevronRight, AlertTriangle, ChevronLeft, ChevronsLeft, ChevronsRight, 
  Package, Scale, Percent, Users, Layers, Building2, ExternalLink, 
  Eye, Edit3, Clock, ArrowUpDown, Check, Plus,
  TrendingUp, DollarSign, Image as ImageIcon, Share2, RefreshCw, ArrowUpRight, Filter, Edit
} from 'lucide-react';
import { 
  DndContext, closestCenter, KeyboardSensor, PointerSensor, 
  useSensor, useSensors 
} from '@dnd-kit/core';
import { 
  SortableContext, sortableKeyboardCoordinates, 
  verticalListSortingStrategy, useSortable, arrayMove 
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { parse, isBefore, startOfDay } from 'date-fns';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';
import clsx from 'clsx';
import { 
  calculatePOLineFinances, calculateDeliveryFinances, parseNumber, 
  parseDateToISO, formatDateForDisplay 
} from '../lib/business-logic';
import { exportGenericTableToPDF } from '../lib/pdf-exporter';
import { uploadFileDirectToGoogleDrive } from '../lib/driveSync';
import { 
  ProductHoverCard, ProductCombobox, PricingCombobox, POFileUploadModal, MacTrafficLights 
} from './index';

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
  categories = ["Xuất khẩu", "Nội địa", "Đặt hàng mẫu", "Đơn hàng bù"],
  poLines = [],
  pricingData = [],
  specsData = [],
  poHeaders = [],
  suppliers = [],
  products = [],
  contractsData = [],
  fileStorageData = [],
  onNavigateTab
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
  contractsData?: any[],
  fileStorageData?: any[],
  onNavigateTab?: (tabId: string) => void
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [editingRow, setEditingRow] = useState<any>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [fileUploadModalPO, setFileUploadModalPO] = useState<any>(null);
  const [showPOFileUploadModal, setShowPOFileUploadModal] = useState(false);
  const addFileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  const [selectedPricingCustomer, setSelectedPricingCustomer] = useState<string>('all');
  const [selectedPricingGroup, setSelectedPricingGroup] = useState<string>('all');

  const isPOHeaderTable = useMemo(() => title.includes("Đơn hàng (PO_Header)"), [title]);
  const isPOLineTable = useMemo(() => title.includes("Chi tiết đơn (PO_Lines)") || title.includes("Báo cáo Lợi nhuận"), [title]);
  const isPOTable = useMemo(() => isPOHeaderTable || isPOLineTable, [isPOHeaderTable, isPOLineTable]);
  const isPricingTable = useMemo(() => title.includes("Bảng giá") || title.includes("Pricing"), [title]);

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
    
    const excludeCols = [
      'id', 'isDeleted', 'createdAt', 'updatedAt', 'deletedAt', 
      'Các mục mẹ 2', 'Tiến độ sản phẩm', 'Tiến độ đơn hàng', 'Đơn vị nhận hàng', 
      'Lợi nhuận (1)', 'Bản sao Kích thước',
      '_userModified', 'Drive_File_Id', 'File_Size', 'File_Type', 'File_Updated_At'
    ];
    if (isPOLineTable && title.includes("Chi tiết đơn")) {
      excludeCols.push('Đơn giá nhập', 'Lợi nhuận', 'Lợi nhuận dòng');
    }
    
    const validKeys = Array.from(allKeysSet).filter(h => {
      if (excludeCols.includes(h)) return false;
      if (h.startsWith('_')) return false; // Filter any internal system properties
      return true;
    });
    
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

  const pricingCustomers = useMemo(() => {
    if (!isPricingTable) return [];
    const custs = new Set<string>();
    data.forEach(r => {
      const c = r['Giao đến'] || r['RP_Khách hàng'] || r['Khách hàng'];
      if (c) custs.add(String(c).trim());
    });
    return Array.from(custs).sort();
  }, [isPricingTable, data]);

  const pricingGroups = useMemo(() => {
    if (!isPricingTable) return [];
    const groups = new Set<string>();
    data.forEach(r => {
      const g = r['Nhóm sản phẩm'] || r['Nhóm hàng'] || r['Phân loại'];
      if (g) groups.add(String(g).trim());
    });
    return Array.from(groups).sort();
  }, [isPricingTable, data]);

  const filteredData = useMemo(() => {
    return data.filter(row => {
      // Pricing Table Specific Filters (By Customer & Product Group)
      if (isPricingTable) {
        if (selectedPricingCustomer !== 'all') {
          const cust = String(row['Giao đến'] || row['RP_Khách hàng'] || row['Khách hàng'] || '').trim();
          if (cust !== selectedPricingCustomer) return false;
        }
        if (selectedPricingGroup !== 'all') {
          const grp = String(row['Nhóm sản phẩm'] || row['Nhóm hàng'] || row['Phân loại'] || '').trim();
          if (grp !== selectedPricingGroup) return false;
        }
      }

      // Column Filters match
      for (const [col, activeFilters] of Object.entries(columnFilters)) {
        if (activeFilters && activeFilters.size > 0) {
          const cellValue = row[col] != null ? String(row[col]) : "";
          if (!activeFilters.has(cellValue)) {
            return false;
          }
        }
      }

      // Safe search match (including resolved product name)
      const searchLower = searchTerm.trim().toLowerCase();
      if (!searchLower) return true;
      
      const inRow = Object.values(row).some(val => 
        val != null && String(val).toLowerCase().includes(searchLower)
      );
      if (inRow) return true;

      // Check resolved product name in products catalog
      const sku = row["Mã sản phẩm"] || row["Mã giá bán"] || row["Mã hàng"] || "";
      if (sku && products && products.length > 0) {
        const found = products.find(p => p["Mã sản phẩm"] === sku || p["Mã hàng"] === sku || p.id === sku);
        if (found) {
          const pName = String(found["Tên sản phẩm"] || found["Sản phẩm"] || "").toLowerCase();
          if (pName.includes(searchLower)) return true;
        }
      }
      return false;
    });
  }, [data, searchTerm, columnFilters, isPricingTable, selectedPricingCustomer, selectedPricingGroup, products]);

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
    
    // Custom KPIs for Pricing Catalog (No total profit summing)
    if (isPricingTable) {
      const uniqueProducts = new Set<string>();
      const currentCusts = new Set<string>();
      const currentGroups = new Set<string>();

      filteredData.forEach(r => {
        const prod = r['Tên sản phẩm'] || r['Sản phẩm'] || r['Mã sản phẩm'];
        if (prod) uniqueProducts.add(String(prod));
        const cust = r['Giao đến'] || r['RP_Khách hàng'] || r['Khách hàng'];
        if (cust) currentCusts.add(String(cust));
        const grp = r['Nhóm sản phẩm'] || r['Nhóm hàng'] || r['Phân loại'];
        if (grp) currentGroups.add(String(grp));
      });

      return [
        { 
          label: 'Tổng số sản phẩm / Đơn giá', 
          value: `${filteredData.length} đơn giá (${uniqueProducts.size} SKU)`,
          color: 'bg-blue-600',
          icon: <Package size={15} />
        },
        { 
          label: 'Phân loại nhóm hàng', 
          value: `${currentGroups.size > 0 ? currentGroups.size : pricingGroups.length} nhóm sản phẩm`,
          color: 'bg-indigo-600',
          icon: <Layers size={15} />
        },
        { 
          label: 'Khách hàng áp dụng', 
          value: `${currentCusts.size > 0 ? currentCusts.size : pricingCustomers.length} khách hàng`,
          color: 'bg-emerald-600',
          icon: <Users size={15} />
        }
      ];
    }

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
  }, [data, headers, filteredData, isPricingTable, pricingGroups.length, pricingCustomers.length]);



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

    // Files (PDF / Images / Google Drive Documents)
    if (header === 'Tệp đơn hàng' || header.includes('Tệp') || strVal.endsWith('.pdf') || strVal.endsWith('.jpg') || strVal.endsWith('.png')) {
      const directDriveUrl = row['Drive_File_Url'] || row['File_Link'] || '';
      const storageMatch = (fileStorageData || []).find((f: any) => 
        (row['Đơn hàng'] && f.documentNumber === row['Đơn hàng']) ||
        (strVal && f.fileName === strVal)
      );
      const driveUrl = directDriveUrl || storageMatch?.driveLink || '';
      const isPdf = strVal.toLowerCase().endsWith('.pdf');
      const isImg = /\.(jpg|jpeg|png|webp|gif)$/i.test(strVal);

      return (
        <div className="flex items-center gap-1.5 py-0.5" onClick={e => e.stopPropagation()}>
          {strVal ? (
            <div className="flex items-center gap-1.5 bg-blue-50/80 hover:bg-blue-100/80 border border-blue-200/70 px-2 py-1 rounded-lg transition-all">
              {isPdf ? (
                <FileText size={14} className="text-rose-600 shrink-0" />
              ) : (
                <ImageIcon size={14} className="text-blue-600 shrink-0" />
              )}
              <span className="truncate max-w-[130px] font-bold text-xs text-blue-900" title={strVal}>
                {strVal}
              </span>

              {driveUrl && (
                <>
                  <a
                    href={driveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 hover:bg-blue-200/70 text-blue-700 rounded transition-colors"
                    title="Mở file trên Google Drive"
                  >
                    <ExternalLink size={12} />
                  </a>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(driveUrl);
                        toast.success('Đã sao chép link chia sẻ Google Drive!');
                      } catch {
                        toast.error('Không thể tự động chép link');
                      }
                    }}
                    className="p-1 hover:bg-blue-200/70 text-blue-700 rounded transition-colors cursor-pointer"
                    title="Sao chép link chia sẻ Google Drive"
                  >
                    <Share2 size={12} />
                  </button>
                </>
              )}

              {isPOHeaderTable && (
                <button
                  type="button"
                  onClick={() => {
                    setFileUploadModalPO(row);
                    setShowPOFileUploadModal(true);
                  }}
                  className="p-1 hover:bg-blue-200/70 text-blue-600 rounded transition-colors cursor-pointer"
                  title="Cập nhật hoặc đổi file mới (PDF/Ảnh)"
                >
                  <RefreshCw size={11} />
                </button>
              )}
            </div>
          ) : isPOHeaderTable ? (
            <button
              type="button"
              onClick={() => {
                setFileUploadModalPO(row);
                setShowPOFileUploadModal(true);
              }}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-dashed border-blue-300 px-2 py-1 rounded-lg transition-all cursor-pointer"
            >
              <UploadCloud size={12} />
              <span>+ Đính kèm PDF/Ảnh</span>
            </button>
          ) : (
            <span className="text-gray-400 italic text-xs">-</span>
          )}
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
       return <span className="font-mono font-bold text-slate-900 tracking-tight">{strVal}</span>;
    }

    // Currencies and numbers
    if (header.includes('giá') || header.includes('tiền') || header.includes('Lợi nhuận') || header.includes('Doanh thu') || header.includes('Tổng') || header === 'Số lượng' || header === 'Số lượng giao' || header === 'Số lượng đặt' || header === 'Còn lại' || header === 'Đã giao') {
       if (strVal.match(/^-?[0-9,.]+$/)) {
         return <span className="font-mono font-semibold text-slate-900 tabular-nums">{strVal}</span>;
       }
    }

    // Date
    if (header.includes('Ngày') || header.includes('Thời gian')) {
       return <span className="font-mono text-xs text-slate-600 tabular-nums">{strVal}</span>;
    }

    // Default
    return <span className="text-slate-700 truncate max-w-xs block" title={strVal}>{strVal}</span>;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isPOTable && isDuplicatePO && !editingRow) {
      // Proceed without confirmation since window.confirm is blocked in iframes
    }

    let finalData = { ...formData };

    // Tự động tải tệp lên Google Drive & tạo link chia sẻ nếu có tệp đính kèm
    if (uploadedFile && isPOHeaderTable) {
      const uploadToast = toast.loading('Đang tải tệp lên Google Drive & tạo link chia sẻ...');
      try {
        const now = new Date();
        const year = now.getFullYear().toString();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const fileExt = uploadedFile.name.substring(uploadedFile.name.lastIndexOf('.'));
        const poNum = String(finalData['Đơn hàng'] || '').replace(/[/\\#?%[\]\s.]+/g, '_');
        const cust = String(finalData['Khách hàng'] || '').replace(/[/\\#?%[\]\s.]+/g, '_');
        const standardizedName = `PO_${poNum}_${cust}${fileExt}`;

        const uploadRes = await uploadFileDirectToGoogleDrive({
          file: uploadedFile,
          fileName: standardizedName,
          documentType: 'Don_Hang_PO',
          documentNumber: String(finalData['Đơn hàng'] || ''),
          year,
          month
        });

        const driveLink = uploadRes.shareLink || uploadRes.driveLink;
        finalData['Tệp đơn hàng'] = standardizedName;
        finalData['Drive_File_Url'] = driveLink;
        finalData['File_Link'] = driveLink;
        finalData['Drive_File_Id'] = uploadRes.driveFileId;
        finalData['File_Type'] = uploadedFile.type;
        finalData['File_Size'] = uploadedFile.size;
        finalData['File_Updated_At'] = now.toISOString();

        toast.success('🎉 Đã lưu trữ tệp lên Google Drive & tạo link chia sẻ!', { id: uploadToast });
      } catch (driveErr: any) {
        console.warn('Drive upload error:', driveErr);
        toast.error(driveErr.message || 'Lỗi tải lên Drive, đang lưu dữ liệu...', { id: uploadToast });
      }
    }

    if (editingRow) {
      if (onEdit) {
        const toastId = toast.loading('Đang cập nhật...');
        try {
          await onEdit(finalData);
          toast.success('Đã cập nhật dữ liệu!', { id: toastId });
          setIsEditModalOpen(false);
          setEditingRow(null);
          setFormData({});
          setUploadedFile(null);
        } catch (err) {
          toast.error('Có lỗi xảy ra khi cập nhật!', { id: toastId });
        }
      }
    } else {
      if (onAdd) {
        const toastId = toast.loading('Đang thêm mới...');
        try {
          await onAdd(finalData);
          toast.success('Đã thêm mới dữ liệu!', { id: toastId });
          setIsModalOpen(false);
          setFormData({});
          setUploadedFile(null);
        } catch (err) {
          toast.error('Có lỗi xảy ra khi thêm mới!', { id: toastId });
        }
      }
    }
  };

  return (
    <div className="flex-1 p-3 sm:p-6 lg:p-8 flex flex-col md:h-full md:overflow-hidden relative pb-28 md:pb-8 bg-[#F5F5F7] min-h-0">
      
      {/* Subtab Switcher: Pricing vs Contracts */}
      {isPricingTable && (
        <div className="flex items-center bg-slate-200/80 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold border border-slate-300/60 shadow-2xs w-fit mb-3">
          <button
            type="button"
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-2xs font-bold"
          >
            <Package size={14} className="text-emerald-600" />
            <span>Bảng Giá Niêm Yết 2026 ({filteredData.length})</span>
          </button>
          {onNavigateTab && (
            <button
              type="button"
              onClick={() => onNavigateTab('contracts')}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer"
            >
              <Scale size={14} className="text-blue-600" />
              <span>Hợp Đồng & Phụ Lục ({contractsData?.length || 0}) ↗</span>
            </button>
          )}
        </div>
      )}

      {/* Apple macOS Table Title & Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 flex-shrink-0 relative">
        <div className="flex items-center gap-3">
          <h2 className="text-base sm:text-lg lg:text-xl font-bold text-slate-900 tracking-tight font-display">{title}</h2>
          <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full font-mono border border-slate-200/80">
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
              onClick={() => {
                setUploadedFile(null);
                setFormData({
                  'Phân loại': categories[0] || 'Xuất khẩu',
                  'Khách hàng': customerList[0] || 'Thăng Long',
                  'Trạng Thái': 'Mới',
                  'Tổng giá trị đơn hàng': 0
                });
                setIsModalOpen(true);
              }} 
              className="flex items-center gap-1.5 bg-[#007AFF] text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-[#0062CC] active:bg-[#0051A8] transition-all shadow-xs"
            >
              <PlusCircle size={15} />
              <span>Thêm mới</span>
            </button>
          )}

          {isPOHeaderTable && (
            <button
              onClick={() => {
                setFileUploadModalPO(data[0] || null);
                setShowPOFileUploadModal(true);
              }}
              className="flex items-center gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-3.5 py-2 rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer"
              title="Cập nhật chứng từ PO bằng file PDF hoặc Hình ảnh lên Google Drive (kèm link chia sẻ)"
            >
              <UploadCloud size={15} />
              <span>⚡ Cập nhật file PO (PDF/Ảnh)</span>
            </button>
          )}
        </div>
      </div>
      
      {/* Spotlight Search Capsule & KPI Cards */}
      <div className="mb-4 space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text"
              placeholder="Tìm kiếm nhanh trong bảng (Spotlight ⌘K)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#F8FAFA] hover:bg-white focus:bg-white border border-slate-200/85 focus:border-[#0066FF] focus:ring-2 focus:ring-[#0066FF]/10 rounded-xl pl-9 pr-4 py-2 text-xs font-medium text-slate-900 outline-none transition-all placeholder:text-slate-400"
            />
          </div>
        </div>
        
        {summaries && summaries.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3">
            {summaries.map((s, idx) => (
              <div 
                key={s.label + idx} 
                className="bg-white border border-slate-200/85 hover:border-slate-300 transition-all rounded-xl p-3 sm:p-3.5 flex items-center gap-3 min-w-0"
              >
                <div className={clsx(
                  "w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center shrink-0 text-white shadow-2xs",
                  s.color || "bg-[#0066FF]"
                )}>
                  {s.icon || <Layers size={16} />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium text-slate-500 truncate" title={s.label}>
                    {s.label}
                  </p>
                  <p className="text-xs sm:text-sm font-bold font-display text-slate-900 tracking-tight tabular-nums truncate mt-0.5" title={String(s.value)}>
                    {s.value}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pricing Table Custom Filter Section (By Customer & By Product Group) */}
        {isPricingTable && (
          <div className="bg-[#F8FAFA] border border-slate-200/85 rounded-xl p-3 sm:p-4 space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-200/85">
              <div>
                <h4 className="text-xs font-bold font-display text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Package size={14} className="text-[#0066FF]" /> Phân Loại Danh Mục Đơn Giá & Khách Hàng
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Lọc nhanh theo Khách hàng và Nhóm sản phẩm để tra cứu đơn giá mua/bán chính xác
                </p>
              </div>

              {onNavigateTab && (
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => onNavigateTab('contracts')}
                    className="px-3 py-1.5 bg-[#0066FF] hover:bg-[#0052CC] text-white rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs active:scale-[0.98]"
                  >
                    <Scale size={13} />
                    <span>Hợp Đồng Mua / Bán ↗</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigateTab('commissions')}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs active:scale-[0.98]"
                  >
                    <Percent size={13} />
                    <span>Hoa Hồng (3 Cách) ↗</span>
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {/* Filter By Customer */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-600 flex items-center gap-1">
                  <Users size={12} className="text-[#0066FF]" /> Theo Khách hàng ({pricingCustomers.length}):
                </span>
                <div className="flex gap-1.5 overflow-x-auto pb-1.5 no-scrollbar sm:flex-wrap">
                  <button
                    type="button"
                    onClick={() => setSelectedPricingCustomer('all')}
                    className={clsx(
                      "px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer shrink-0 border",
                      selectedPricingCustomer === 'all'
                        ? "bg-[#0066FF] border-[#0066FF] text-white shadow-2xs"
                        : "bg-white border-slate-200/85 text-slate-600 hover:bg-slate-100"
                    )}
                  >
                    Tất cả ({data.length})
                  </button>
                  {pricingCustomers.map(c => {
                    const count = data.filter(r => (r['Giao đến'] || r['RP_Khách hàng'] || r['Khách hàng']) === c).length;
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setSelectedPricingCustomer(c)}
                        className={clsx(
                          "px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer shrink-0 border",
                          selectedPricingCustomer === c
                            ? "bg-[#0066FF] border-[#0066FF] text-white shadow-2xs"
                            : "bg-white border-slate-200/85 text-slate-600 hover:bg-slate-100"
                        )}
                      >
                        {c} ({count})
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Filter By Product Group */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-600 flex items-center gap-1">
                  <Layers size={12} className="text-indigo-600" /> Theo Nhóm hàng ({pricingGroups.length}):
                </span>
                <div className="flex gap-1.5 overflow-x-auto pb-1.5 no-scrollbar sm:flex-wrap">
                  <button
                    type="button"
                    onClick={() => setSelectedPricingGroup('all')}
                    className={clsx(
                      "px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer shrink-0 border",
                      selectedPricingGroup === 'all'
                        ? "bg-slate-900 border-slate-900 text-white shadow-2xs"
                        : "bg-white border-slate-200/85 text-slate-600 hover:bg-slate-100"
                    )}
                  >
                    Tất cả nhóm ({data.length})
                  </button>
                  {pricingGroups.map(g => {
                    const count = data.filter(r => (r['Nhóm sản phẩm'] || r['Nhóm hàng'] || r['Phân loại']) === g).length;
                    return (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setSelectedPricingGroup(g)}
                        className={clsx(
                          "px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer shrink-0 border",
                          selectedPricingGroup === g
                            ? "bg-slate-900 border-slate-900 text-white shadow-2xs"
                            : "bg-white border-slate-200/85 text-slate-600 hover:bg-slate-100"
                        )}
                      >
                        {g} ({count})
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Hallmark Enterprise Table Container */}
      <div className="bg-white rounded-xl border border-slate-200/85 md:flex-1 md:overflow-hidden flex flex-col md:min-h-[360px]">
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-auto flex-1">
          <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
            <thead className="bg-[#F8FAFA] text-slate-700 sticky top-0 border-b border-slate-200/85 z-10 font-display font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                {onDelete && (
                  <th className="px-4 py-3 font-semibold border-b border-slate-200/85 bg-[#F8FAFA] w-10 text-center">
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
                      className="rounded border-slate-300 text-[#0066FF] focus:ring-[#0066FF] w-4 h-4 cursor-pointer"
                    />
                  </th>
                )}
                {visibleColumns.map((h, idx) => (
                  <th key={h} className={`px-4 py-3 font-semibold font-display border-b border-slate-200/85 bg-[#F8FAFA] text-slate-700 tracking-wider text-[11px] uppercase ${idx === 0 ? 'sticky left-0 shadow-[1px_0_0_0_rgba(226,232,240,0.85)] z-[15]' : ''}`}>
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
                    ? 'bg-rose-50/60 hover:bg-rose-100/60' 
                    : (isHighlighted ? 'bg-amber-50/70 hover:bg-amber-100/70' : 'hover:bg-slate-50/80');

                return (
                  <tr 
                    key={rowId} 
                    onClick={() => {
                      setUploadedFile(null);
                      setEditingRow(row);
                      setFormData({ ...row });
                      setIsEditModalOpen(true);
                      setConfirmDelete(false);
                    }}
                    className={`transition-all duration-150 border-b border-slate-100 last:border-0 group/tr cursor-pointer ${rowClass}`}
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
                          className="rounded border-slate-300 text-[#0066FF] focus:ring-[#0066FF] w-4 h-4 cursor-pointer"
                        />
                      </td>
                    )}
                    {visibleColumns.map((h, idx) => (
                      <td 
                        key={h} 
                        className={`px-4 py-3 align-middle ${idx === 0 ? `sticky left-0 shadow-[1px_0_0_0_rgba(226,232,240,0.85)] z-[5] transition-colors ${isOverdue ? 'bg-rose-50/90 group-hover/tr:bg-rose-100/90' : isHighlighted ? 'bg-[#fef3c7]/70 group-hover/tr:bg-[#fef3c7]/90' : 'bg-white group-hover/tr:bg-slate-50/80'}` : ''}`}
                      >
                        <div className="flex items-center gap-2">
                           {renderCell(h, row[h], row)}
                           {h === 'Ngày giao' && isOverdue && (
                               <span title="Quá hạn giao hàng"><AlertTriangle size={15} className="text-rose-500" /></span>
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
        <div className="md:hidden space-y-2.5 p-2.5 bg-[#F5F5F7]">
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

              // 1. Resolve Product Name & SKU with intelligent lookup
              let resolvedProdName = row["Tên sản phẩm"] || row["Sản phẩm"] || row["Tên hàng"] || "";
              const skuCode = row["Mã sản phẩm"] || row["Mã giá bán"] || row["Mã hàng"] || row["Mã của khách"] || "";
              
              if (!resolvedProdName && products && products.length > 0 && skuCode) {
                const pMatch = products.find((p: any) => 
                  (p["Mã sản phẩm"] && p["Mã sản phẩm"] === skuCode) ||
                  (p["Mã hàng"] && p["Mã hàng"] === skuCode) ||
                  (p.id && p.id === skuCode) ||
                  (p["Mã giá bán"] && p["Mã giá bán"] === skuCode)
                );
                if (pMatch) {
                  resolvedProdName = pMatch["Tên sản phẩm"] || pMatch["Sản phẩm"] || "";
                }
              }

              if (!resolvedProdName && pricingData && pricingData.length > 0 && skuCode) {
                const prMatch = pricingData.find((p: any) => 
                  (p["Mã sản phẩm"] && p["Mã sản phẩm"] === skuCode) ||
                  (p["Mã giá bán"] && p["Mã giá bán"] === skuCode)
                );
                if (prMatch) {
                  resolvedProdName = prMatch["Tên sản phẩm"] || prMatch["Sản phẩm"] || "";
                }
              }

              // Customer / Partner name
              const customerName = row["Khách hàng"] || row["RP_Khách hàng"] || row["Nhà cung cấp"] || "";
              const contractNum = row["Số hợp đồng"] || row["Hợp đồng"] || "";

              // Determine Primary Display Title & Subtitle
              let primaryTitle = "";
              let secondaryTitle = "";

              if (isPricingTable) {
                primaryTitle = resolvedProdName || skuCode || "Sản phẩm";
                secondaryTitle = customerName;
              } else if (isPOHeaderTable) {
                primaryTitle = row["Số đơn hàng"] || row["Đơn hàng"] || "Đơn hàng";
                secondaryTitle = customerName;
              } else if (isPOLineTable) {
                primaryTitle = resolvedProdName || skuCode || row["Số đơn hàng"] || "Chi tiết đơn";
                secondaryTitle = row["Số đơn hàng"] ? `PO: ${row["Số đơn hàng"]}` : customerName;
              } else {
                primaryTitle = resolvedProdName || row["Số đơn hàng"] || row["Số PXK"] || row["Mã sản phẩm"] || String(row[visibleColumns[0]] || "Bản ghi");
                secondaryTitle = customerName;
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

              // Extract metrics (prioritize money, price, profit, qty)
              const excludeFromMetrics = ["id", "Tên sản phẩm", "Sản phẩm", "Khách hàng", "RP_Khách hàng", "Nhà cung cấp", "Trạng thái", "Trạng Thái", "Status", "Tình trạng", "Số hợp đồng", "Hợp đồng"];
              const metricCandidates = visibleColumns.filter(c => 
                !excludeFromMetrics.includes(c) && 
                row[c] != null && 
                String(row[c]).trim() !== ""
              );

              // Sort metrics logically
              metricCandidates.sort((a, b) => {
                const isPriceA = a.includes("giá bán") || a.includes("Giá bán");
                const isPriceB = b.includes("giá bán") || b.includes("Giá bán");
                if (isPriceA && !isPriceB) return -1;
                if (!isPriceA && isPriceB) return 1;
                const isBuyA = a.includes("giá mua") || a.includes("giá nhập") || a.includes("Giá AVP");
                const isBuyB = b.includes("giá mua") || b.includes("giá nhập") || b.includes("Giá AVP");
                if (isBuyA && !isBuyB) return -1;
                if (!isBuyA && isBuyB) return 1;
                const isQtyA = a.includes("Số lượng") || a.includes("ĐVT");
                const isQtyB = b.includes("Số lượng") || b.includes("ĐVT");
                if (isQtyA && !isQtyB) return -1;
                if (!isQtyA && isQtyB) return 1;
                return 0;
              });

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
                    "bg-white rounded-xl p-3.5 border border-slate-200/85 hover:border-slate-300 active:scale-[0.99] transition-all cursor-pointer space-y-2.5",
                    isOverdue ? "border-l-4 border-l-rose-500 bg-rose-50/20" : "",
                    isHighlighted ? "ring-2 ring-amber-400 bg-amber-50/30" : ""
                  )}
                >
                  {/* Card Header: Prominent Product Name & Badges */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-start gap-1.5 flex-wrap">
                        <span className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight leading-snug">
                          {isPricingTable || isPOLineTable ? (
                            <ProductHoverCard 
                              productName={resolvedProdName || primaryTitle}
                              productCode={skuCode}
                              pricingData={pricingData}
                              specsData={specsData}
                            >
                              <span className="text-slate-900 hover:text-blue-600 transition-colors">
                                {primaryTitle}
                              </span>
                            </ProductHoverCard>
                          ) : (
                            <span>{primaryTitle}</span>
                          )}
                        </span>

                        {isOverdue && (
                          <span className="inline-flex items-center gap-0.5 text-[9.5px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.2 rounded-full shrink-0">
                            <AlertTriangle size={10} /> Quá hạn
                          </span>
                        )}
                      </div>

                      {/* Subtitle / Badges row: SKU + Customer + Contract */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {skuCode && (
                          <span className="inline-flex items-center gap-1 text-[10.5px] font-mono font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200/60">
                            <Tag size={10} className="text-blue-500" />
                            <span>{skuCode}</span>
                          </span>
                        )}

                        {customerName && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200/80 truncate max-w-[170px]">
                            <Building2 size={10} className="text-slate-400 shrink-0" />
                            <span className="truncate">{customerName}</span>
                          </span>
                        )}

                        {contractNum && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onNavigateTab?.('contracts');
                            }}
                            className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 active:bg-indigo-200 px-2 py-0.5 rounded border border-indigo-200/60 transition-colors cursor-pointer"
                            title="Bấm để chuyển sang xem chi tiết Hợp đồng"
                          >
                            <FileText size={10} />
                            <span>HĐ: {contractNum} ↗</span>
                          </button>
                        )}

                        {(row["Thiếu chứng từ gốc"] || (!row.driveLink && !row["File chứng từ"] && !row["Ảnh BBGH"] && (row["Trạng thái"] === "Đã giao" || row["Trạng Thái"] === "Đã giao" || row["Số PXK"]))) && (
                          <span className="inline-flex items-center gap-1 text-[9.5px] font-bold text-amber-700 bg-amber-50 border border-amber-200/80 px-1.5 py-0.5 rounded" title="Chưa đính kèm file scan BBGH/PXK gốc">
                            <AlertTriangle size={10} className="text-amber-500 shrink-0" />
                            <span>Thiếu chứng từ gốc</span>
                          </span>
                        )}
                      </div>
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
        <div className="flex items-center justify-between bg-[#F8FAFA] px-4 py-3 border border-slate-200/85 border-t-0 rounded-b-xl flex-shrink-0">
          <div className="flex flex-1 justify-between sm:hidden">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="relative inline-flex items-center rounded-lg border border-slate-200/85 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-all cursor-pointer"
            >
              Trang trước
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="relative ml-3 inline-flex items-center rounded-lg border border-slate-200/85 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-all cursor-pointer"
            >
              Trang sau
            </button>
          </div>
          <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
            <div>
              <p className="text-xs text-slate-500 font-mono">
                Hiển thị <span className="font-bold text-slate-900 tabular-nums">{(currentPage - 1) * itemsPerPage + 1}</span> - <span className="font-bold text-slate-900 tabular-nums">{Math.min(currentPage * itemsPerPage, filteredData.length)}</span> / <span className="font-bold text-slate-900 tabular-nums">{filteredData.length}</span> bản ghi
              </p>
            </div>
            <div>
              <nav className="isolate inline-flex -space-x-px rounded-lg shadow-2xs" aria-label="Pagination">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center rounded-l-lg px-2.5 py-1.5 text-slate-500 ring-1 ring-inset ring-slate-200/85 bg-white hover:bg-slate-50 focus:z-20 focus:outline-offset-0 disabled:opacity-40 transition-colors cursor-pointer"
                >
                  <span className="sr-only">Previous</span>
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="relative inline-flex items-center rounded-r-lg px-2.5 py-1.5 text-slate-500 ring-1 ring-inset ring-slate-200/85 bg-white hover:bg-slate-50 focus:z-20 focus:outline-offset-0 disabled:opacity-40 transition-colors cursor-pointer"
                >
                  <span className="sr-only">Next</span>
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
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
                  if (h === 'STT' || h === 'id' || h === 'isDeleted' || h.startsWith('_')) return false;

                  // Technical metadata fields that are handled automatically in the background
                  const technicalFields = [
                    '_userModified', 'Drive_File_Id', 'Drive_File_Url', 'File_Link', 
                    'File_Size', 'File_Type', 'File_Updated_At', 'Drive_Folder_Id', 'Chi tiết đơn hàng'
                  ];
                  if (technicalFields.includes(h)) return false;

                  if (isPOLineTable) {
                    const allowedFields = [
                      'Số đơn hàng', 'Đơn hàng', 'Mã giá bán', 'Tên sản phẩm', 'Sản phẩm',
                      'Số lượng', 'Ngày đặt hàng', 'Ngày giao', 'Thời gian xử lý', 'Khách hàng'
                    ];
                    return allowedFields.includes(h);
                  }

                  if (isPOHeaderTable) {
                    const allowedHeaderFields = [
                      'Phân loại', 'Khách hàng', 'Đơn hàng', 'Ngày đặt hàng',
                      'Tổng giá trị đơn hàng', 'Trạng Thái', 'Tệp đơn hàng', 'Ghi chú'
                    ];
                    return allowedHeaderFields.includes(h);
                  }

                  return true;
                }).sort((a, b) => {
                  if (isPOHeaderTable) {
                    const order = ['Phân loại', 'Khách hàng', 'Đơn hàng', 'Ngày đặt hàng', 'Tổng giá trị đơn hàng', 'Trạng Thái', 'Tệp đơn hàng', 'Ghi chú'];
                    const ia = order.indexOf(a);
                    const ib = order.indexOf(b);
                    if (ia !== -1 && ib !== -1) return ia - ib;
                  }
                  return 0;
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

                  if (h === 'Tệp đơn hàng' || h === 'Tệp đính kèm' || h === 'File') {
                    const currentVal = formData[h] || '';
                    return (
                      <div key={h} className="flex flex-col gap-1.5 col-span-1 sm:col-span-2">
                        <label className="text-sm font-medium text-gray-700 flex items-center justify-between">
                          <span>{h}</span>
                          {uploadedFile && (
                            <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                              <CheckCircle size={13} /> Sẵn sàng đính kèm
                            </span>
                          )}
                        </label>
                        
                        <input
                          type="file"
                          ref={addFileInputRef}
                          className="hidden"
                          accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              const file = e.target.files[0];
                              setUploadedFile(file);
                              setFormData((prev: any) => ({
                                ...prev,
                                [h]: file.name
                              }));
                              toast.success(`Đã chọn tệp: ${file.name}`);
                            }
                          }}
                        />

                        {uploadedFile || currentVal ? (
                          <div className="flex items-center justify-between p-3 bg-blue-50/80 border border-blue-200 rounded-xl">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                                <FileText size={18} />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-blue-950 truncate" title={uploadedFile ? uploadedFile.name : currentVal}>
                                  {uploadedFile ? uploadedFile.name : currentVal}
                                </p>
                                <p className="text-[10px] text-blue-600 font-medium mt-0.5">
                                  {uploadedFile ? `${(uploadedFile.size / 1024).toFixed(1)} KB • Tệp tải lên` : 'Tệp chứng từ đính kèm'}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0 ml-2">
                              <button
                                type="button"
                                onClick={() => addFileInputRef.current?.click()}
                                className="px-2.5 py-1.5 bg-white border border-blue-200 hover:bg-blue-50 text-blue-700 text-xs font-bold rounded-lg shadow-2xs transition-all flex items-center gap-1"
                              >
                                <Upload size={13} />
                                Đổi tệp
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setUploadedFile(null);
                                  setFormData((prev: any) => ({ ...prev, [h]: '' }));
                                }}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                title="Xóa tệp"
                              >
                                <X size={15} />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div
                            onClick={() => addFileInputRef.current?.click()}
                            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                            onDrop={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                                const file = e.dataTransfer.files[0];
                                setUploadedFile(file);
                                setFormData((prev: any) => ({
                                  ...prev,
                                  [h]: file.name
                                }));
                                toast.success(`Đã chọn tệp: ${file.name}`);
                              }
                            }}
                            className="border-2 border-dashed border-gray-300 hover:border-blue-500 bg-gray-50/70 hover:bg-blue-50/40 rounded-xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 group"
                          >
                            <div className="w-10 h-10 rounded-full bg-white shadow-2xs border border-gray-200 flex items-center justify-center text-gray-500 group-hover:text-blue-600 group-hover:border-blue-300 transition-all">
                              <Upload size={18} />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-gray-700 group-hover:text-blue-700">
                                Nhấp để chọn tệp hoặc kéo thả vào đây
                              </p>
                              <p className="text-[11px] text-gray-400 mt-0.5">
                                Hỗ trợ PDF, Word (.docx), Excel (.xlsx), Hình ảnh scan (.png, .jpg)
                              </p>
                            </div>
                          </div>
                        )}
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
                  if (h === 'id' || h === 'isDeleted' || h === 'createdAt' || h === 'updatedAt' || h === 'deletedAt' || h === 'STT' || h.startsWith('_')) return false;

                  // Technical metadata fields that are handled automatically in the background
                  const technicalFields = [
                    '_userModified', 'Drive_File_Id', 'Drive_File_Url', 'File_Link', 
                    'File_Size', 'File_Type', 'File_Updated_At', 'Drive_Folder_Id', 'Chi tiết đơn hàng'
                  ];
                  if (technicalFields.includes(h)) return false;

                  if (isPOLineTable) {
                    const allowedFields = [
                      'Số đơn hàng', 'Đơn hàng', 'Mã giá bán', 'Tên sản phẩm', 'Sản phẩm',
                      'Số lượng', 'Ngày đặt hàng', 'Ngày giao', 'Thời gian xử lý', 'Khách hàng'
                    ];
                    return allowedFields.includes(h);
                  }

                  if (isPOHeaderTable) {
                    const allowedHeaderFields = [
                      'Phân loại', 'Khách hàng', 'Đơn hàng', 'Ngày đặt hàng',
                      'Tổng giá trị đơn hàng', 'Trạng Thái', 'Tệp đơn hàng', 'Ghi chú'
                    ];
                    return allowedHeaderFields.includes(h);
                  }

                  return true;
                }).sort((a, b) => {
                  if (isPOHeaderTable) {
                    const order = ['Phân loại', 'Khách hàng', 'Đơn hàng', 'Ngày đặt hàng', 'Tổng giá trị đơn hàng', 'Trạng Thái', 'Tệp đơn hàng', 'Ghi chú'];
                    const ia = order.indexOf(a);
                    const ib = order.indexOf(b);
                    if (ia !== -1 && ib !== -1) return ia - ib;
                  }
                  return 0;
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

                  if (h === 'Tệp đơn hàng' || h === 'Tệp đính kèm' || h === 'File') {
                    const currentVal = formData[h] || '';
                    return (
                      <div key={h} className="space-y-1.5 col-span-1 sm:col-span-2">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center justify-between">
                          <span>{h}</span>
                          {uploadedFile && (
                            <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                              <CheckCircle size={13} /> Sẵn sàng đính kèm
                            </span>
                          )}
                        </label>
                        
                        <input
                          type="file"
                          ref={editFileInputRef}
                          className="hidden"
                          accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              const file = e.target.files[0];
                              setUploadedFile(file);
                              setFormData((prev: any) => ({
                                ...prev,
                                [h]: file.name
                              }));
                              toast.success(`Đã chọn tệp: ${file.name}`);
                            }
                          }}
                        />

                        {uploadedFile || currentVal ? (
                          <div className="flex items-center justify-between p-3 bg-blue-50/80 border border-blue-200 rounded-xl">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                                <FileText size={18} />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-blue-950 truncate" title={uploadedFile ? uploadedFile.name : currentVal}>
                                  {uploadedFile ? uploadedFile.name : currentVal}
                                </p>
                                <p className="text-[10px] text-blue-600 font-medium mt-0.5">
                                  {uploadedFile ? `${(uploadedFile.size / 1024).toFixed(1)} KB • Tệp tải lên` : 'Tệp chứng từ đính kèm'}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0 ml-2">
                              <button
                                type="button"
                                onClick={() => editFileInputRef.current?.click()}
                                className="px-2.5 py-1.5 bg-white border border-blue-200 hover:bg-blue-50 text-blue-700 text-xs font-bold rounded-lg shadow-2xs transition-all flex items-center gap-1"
                              >
                                <Upload size={13} />
                                Đổi tệp
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setUploadedFile(null);
                                  setFormData((prev: any) => ({ ...prev, [h]: '' }));
                                }}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                title="Xóa tệp"
                              >
                                <X size={15} />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div
                            onClick={() => editFileInputRef.current?.click()}
                            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                            onDrop={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                                const file = e.dataTransfer.files[0];
                                setUploadedFile(file);
                                setFormData((prev: any) => ({
                                  ...prev,
                                  [h]: file.name
                                }));
                                toast.success(`Đã chọn tệp: ${file.name}`);
                              }
                            }}
                            className="border-2 border-dashed border-gray-300 hover:border-blue-500 bg-gray-50/70 hover:bg-blue-50/40 rounded-xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 group"
                          >
                            <div className="w-10 h-10 rounded-full bg-white shadow-2xs border border-gray-200 flex items-center justify-center text-gray-500 group-hover:text-blue-600 group-hover:border-blue-300 transition-all">
                              <Upload size={18} />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-gray-700 group-hover:text-blue-700">
                                Nhấp để chọn tệp hoặc kéo thả vào đây
                              </p>
                              <p className="text-[11px] text-gray-400 mt-0.5">
                                Hỗ trợ PDF, Word (.docx), Excel (.xlsx), Hình ảnh scan (.png, .jpg)
                              </p>
                            </div>
                          </div>
                        )}
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
                  className="px-6 py-3 border border-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-100 transition-all cursor-pointer"
                >
                  Hủy
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* PO File Upload & Drive Sync Modal */}
      {isPOHeaderTable && (
        <POFileUploadModal
          isOpen={showPOFileUploadModal}
          onClose={() => {
            setShowPOFileUploadModal(false);
            setFileUploadModalPO(null);
          }}
          poHeader={fileUploadModalPO || data[0] || null}
          allPOHeaders={data}
          onSelectPO={(po) => setFileUploadModalPO(po)}
          onUpdatePOHeader={async (updated) => {
            if (onEdit) {
              await onEdit(updated);
            }
          }}
        />
      )}
    </div>
  );
}

export default TableView;
export { TableView };
