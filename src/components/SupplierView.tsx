import React, { useState, useEffect, useMemo } from 'react';
import { db, storage } from '../firebase';
import { collection, onSnapshot, addDoc, updateDoc, doc, deleteDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { handleFirestoreError, OperationType } from '../lib/errorHelper';
import { 
  Building2, MapPin, Star, Globe, Plus, Search, Edit2, 
  Trash2, X, LayoutGrid, List, Award, Factory, AlertCircle, 
  CheckCircle2, ShieldAlert, ExternalLink, Phone, FileText, 
  UserCheck, FileSpreadsheet, Sparkles, Eye, Copy, Users,
  Folder, CheckSquare, Clock, Mail, CreditCard, Landmark, ArrowUpRight
} from 'lucide-react';
import * as XLSX from 'xlsx';
import CompanyLogo from './CompanyLogo';
import { getItemKey } from '../hooks/useFirestoreCollection';
import { toast } from 'react-hot-toast';
import { cleanCompanyName, isNameRepetitive } from '../lib/companyUtils';
import { getAvatarInitials, isExecutive } from './ContactView';
import { formatVietnamesePhone, formatContactFullName, getRawCallablePhone } from '../utils/formatters';

export const getSupplierLogo = (s: any) => {
  if (!s) return '';
  return s.logoUrl || s.LogoUrl || s.Logo || s.logo || s.Logo_URL || s.logo_url || '';
};

interface SupplierViewProps {
  initialData?: any[];
  contacts?: any[];
  targetSupplierId?: string | null;
  onClearTargetSupplier?: () => void;
  onNavigateToCustomer?: (customerId: string) => void;
  onNavigateToContact?: (contactId: string) => void;
}

export default function SupplierView({ 
  initialData: suppliers = [], 
  contacts = [],
  targetSupplierId = null,
  onClearTargetSupplier,
  onNavigateToCustomer,
  onNavigateToContact
}: SupplierViewProps) {
  // Main Sub-Tab: 'companies' | 'contacts'
  const [activeSubTab, setActiveSubTab] = useState<'companies' | 'contacts'>('companies');

  // Search & Filter for Companies
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  // Search & Filter for Contacts
  const [contactSearchTerm, setContactSearchTerm] = useState('');
  const [contactRoleFilter, setContactRoleFilter] = useState('all');

  // Supplier Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<any>(null);
  const [selectedSupplierDetail, setSelectedSupplierDetail] = useState<any>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  // Contact Modal & Tasks / Projects States
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<any | null>(null);
  const [selectedContactDetail, setSelectedContactDetail] = useState<any | null>(null);
  const [contactDetailTab, setContactDetailTab] = useState<'tasks' | 'projects' | 'activities'>('tasks');

  const [tasks, setTasks] = useState<{ [contactId: string]: any[] }>({});
  const [projects, setProjects] = useState<{ [contactId: string]: any[] }>({});
  const [activities, setActivities] = useState<{ [contactId: string]: any[] }>({});

  const [showAddTaskForm, setShowAddTaskForm] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: '', dueDate: '', priority: 'medium', status: 'todo' });

  const [showAddProjectForm, setShowAddProjectForm] = useState(false);
  const [projectForm, setProjectForm] = useState({ name: '', code: '', description: '', status: 'active' });

  const [showAddActivityForm, setShowAddActivityForm] = useState(false);
  const [activityForm, setActivityForm] = useState({ type: 'call', content: '', user: 'Quản trị viên' });

  // Handle Target Supplier Deep Linking
  useEffect(() => {
    if (targetSupplierId) {
      const found = suppliers.find(s => 
        s["Mã nhà cung cấp"]?.toLowerCase() === targetSupplierId.toLowerCase() ||
        s.id?.toLowerCase() === targetSupplierId.toLowerCase() ||
        s["Tên Nhà Cung Cấp"]?.toLowerCase().includes(targetSupplierId.toLowerCase())
      );
      if (found) {
        setSelectedSupplierDetail(found);
        setActiveSubTab('companies');
      }
      if (onClearTargetSupplier) onClearTargetSupplier();
    }
  }, [targetSupplierId, suppliers, onClearTargetSupplier]);

  // Load shared tasks & projects
  useEffect(() => {
    try {
      const storedTasks = localStorage.getItem('tsg_contact_tasks');
      const storedProjects = localStorage.getItem('tsg_contact_projects');
      const storedActivities = localStorage.getItem('tsg_contact_activities');
      if (storedTasks) setTasks(JSON.parse(storedTasks));
      if (storedProjects) setProjects(JSON.parse(storedProjects));
      if (storedActivities) setActivities(JSON.parse(storedActivities));
    } catch (e) {
      console.error('Error reading shared tasks/projects:', e);
    }
  }, []);

  const saveTasks = (newTasks: { [contactId: string]: any[] }) => {
    setTasks(newTasks);
    localStorage.setItem('tsg_contact_tasks', JSON.stringify(newTasks));
  };

  const saveProjects = (newProjects: { [contactId: string]: any[] }) => {
    setProjects(newProjects);
    localStorage.setItem('tsg_contact_projects', JSON.stringify(newProjects));
  };

  const saveActivities = (newActivities: { [contactId: string]: any[] }) => {
    setActivities(newActivities);
    localStorage.setItem('tsg_contact_activities', JSON.stringify(newActivities));
  };

  // Helper to resolve linked contacts for a supplier
  const getLinkedContacts = (supplier: any) => {
    if (!contacts || contacts.length === 0) return [];
    return contacts.filter(c => {
      const explicitIds = String(supplier["Liên hệ liên kết"] || "").split(',').map((id: string) => id.trim());
      if (explicitIds.includes(c.id) || explicitIds.includes(c.ID)) return true;
      
      const compName = String(c["Công ty"] || "").toLowerCase().trim();
      const suppName = String(supplier["Tên Nhà Cung Cấp"] || "").toLowerCase().trim();
      const suppCode = String(supplier["Mã nhà cung cấp"] || "").toLowerCase().trim();
      
      return compName && (compName === suppName || compName === suppCode || (suppName.length > 3 && suppName.includes(compName)));
    });
  };

  // All Supplier Contacts
  const supplierContacts = useMemo(() => {
    return contacts.filter(c => {
      const compName = String(c["Công ty"] || "").toLowerCase();
      const isSupp = suppliers.some(supp => 
        supp["Mã nhà cung cấp"]?.toLowerCase() === compName || 
        supp["Tên Nhà Cung Cấp"]?.toLowerCase().includes(compName)
      );
      if (isSupp) return true;
      return false;
    });
  }, [contacts, suppliers]);

  // Filtered Supplier Contacts
  const filteredSupplierContacts = useMemo(() => {
    return supplierContacts.filter(c => {
      const matchSearch = 
        c["Tên"]?.toLowerCase().includes(contactSearchTerm.toLowerCase()) ||
        c["Công ty"]?.toLowerCase().includes(contactSearchTerm.toLowerCase()) ||
        c["Chức vụ"]?.toLowerCase().includes(contactSearchTerm.toLowerCase()) ||
        c["Điện thoại"]?.includes(contactSearchTerm) ||
        c["Email"]?.toLowerCase().includes(contactSearchTerm.toLowerCase());

      if (!matchSearch) return false;

      if (contactRoleFilter === 'exec') return isExecutive(c["Chức vụ"]);
      if (contactRoleFilter === 'starred') return Number(c["Mức độ quan hệ"] || 0) >= 4;

      return true;
    });
  }, [supplierContacts, contactSearchTerm, contactRoleFilter]);

  // Total tasks & projects across supplier contacts
  const getSupplierTasksAndProjects = (supplier: any) => {
    const linked = getLinkedContacts(supplier);
    let allTasks: any[] = [];
    let allProjects: any[] = [];

    linked.forEach(c => {
      const contactId = c.ID || `${c["Tên"]}-${c["Công ty"]}`;
      if (tasks[contactId]) allTasks = [...allTasks, ...tasks[contactId]];
      if (projects[contactId]) allProjects = [...allProjects, ...projects[contactId]];
    });

    return { allTasks, allProjects, totalTasks: allTasks.length, totalProjects: allProjects.length };
  };

  const [formData, setFormData] = useState({
    "Mã nhà cung cấp": "",
    "Tên Nhà Cung Cấp": "",
    "Loại hình": "Nhà sản xuất trực tiếp",
    "Nhóm hàng": "",
    "Tình trạng": "Đang hoạt động",
    "Đánh giá": "5",
    "Địa chỉ": "",
    "Nhà máy": "",
    "Số điện thoại": "",
    "Email": "",
    "Mã số thuế": "",
    "Điều khoản thanh toán": "Công nợ 30 ngày",
    "Tài khoản ngân hàng": "",
    "Đại diện pháp luật": "",
    "logoUrl": "",
    "Liên hệ liên kết": "",
    "Website": "",
    "logoFit": "contain"
  });

  const [contactFormData, setContactFormData] = useState({
    ID: '',
    "Danh xưng": 'Mr',
    "Tên": '',
    "Chức vụ": '',
    "Phòng ban": '',
    "Công ty": '',
    "Điện thoại": '',
    "Email": '',
    "Mức độ quan hệ": '3',
    "Phụ trách": ''
  });

  const handleOpenModal = (supplier: any = null) => {
    if (supplier) {
      setEditingSupplier(supplier);
      const existingLogo = getSupplierLogo(supplier);
      setFormData({
        "Mã nhà cung cấp": supplier["Mã nhà cung cấp"] || "",
        "Tên Nhà Cung Cấp": supplier["Tên Nhà Cung Cấp"] || "",
        "Loại hình": supplier["Loại hình"] || "Nhà sản xuất trực tiếp",
        "Nhóm hàng": supplier["Nhóm hàng"] || "",
        "Tình trạng": supplier["Tình trạng"] || "Đang hoạt động",
        "Đánh giá": supplier["Đánh giá"] || "5",
        "Địa chỉ": supplier["Địa chỉ"] || "",
        "Nhà máy": supplier["Nhà máy"] || "",
        "Số điện thoại": supplier["Số điện thoại"] || "",
        "Email": supplier["Email"] || "",
        "Mã số thuế": supplier["Mã số thuế"] || "",
        "Điều khoản thanh toán": supplier["Điều khoản thanh toán"] || "Công nợ 30 ngày",
        "Tài khoản ngân hàng": supplier["Tài khoản ngân hàng"] || "",
        "Đại diện pháp luật": supplier["Đại diện pháp luật"] || "",
        "logoUrl": existingLogo,
        "Liên hệ liên kết": supplier["Liên hệ liên kết"] || "",
        "Website": supplier["Website"] || "",
        "logoFit": supplier["logoFit"] || "contain"
      });
      setLogoPreview(existingLogo || null);
    } else {
      setEditingSupplier(null);
      setFormData({
        "Mã nhà cung cấp": `SUPP_${Date.now().toString().slice(-4)}`,
        "Tên Nhà Cung Cấp": "",
        "Loại hình": "Nhà sản xuất trực tiếp",
        "Nhóm hàng": "",
        "Tình trạng": "Đang hoạt động",
        "Đánh giá": "5",
        "Địa chỉ": "",
        "Nhà máy": "",
        "Số điện thoại": "",
        "Email": "",
        "Mã số thuế": "",
        "Điều khoản thanh toán": "Công nợ 30 ngày",
        "Tài khoản ngân hàng": "",
        "Đại diện pháp luật": "",
        "logoUrl": "",
        "Liên hệ liên kết": "",
        "Website": "",
        "logoFit": "contain"
      });
      setLogoPreview(null);
    }
    setLogoFile(null);
    setIsModalOpen(true);
  };

  const handleOpenContactModal = (contact: any = null, defaultCompany: string = '') => {
    if (contact) {
      setEditingContact(contact);
      setContactFormData({
        ID: contact.ID || `${contact["Tên"]}-${contact["Công ty"]}`,
        "Danh xưng": contact["Danh xưng"] || 'Mr',
        "Tên": contact["Tên"] || '',
        "Chức vụ": contact["Chức vụ"] || '',
        "Phòng ban": contact["Phòng ban"] || '',
        "Công ty": contact["Công ty"] || (suppliers[0]?.["Tên Nhà Cung Cấp"] || suppliers[0]?.["Mã nhà cung cấp"] || ''),
        "Điện thoại": contact["Điện thoại"] || '',
        "Email": contact["Email"] || '',
        "Mức độ quan hệ": contact["Mức độ quan hệ"] || '3',
        "Phụ trách": contact["Phụ trách"] || ''
      });
    } else {
      const matchSupp = suppliers.find(s => 
        (defaultCompany && s["Mã nhà cung cấp"]?.toLowerCase() === defaultCompany.toLowerCase()) || 
        (defaultCompany && s["Tên Nhà Cung Cấp"]?.toLowerCase() === defaultCompany.toLowerCase()) ||
        (defaultCompany && s["Tên Nhà Cung Cấp"]?.toLowerCase().includes(defaultCompany.toLowerCase()))
      );
      const resolvedCompany = matchSupp ? (matchSupp["Tên Nhà Cung Cấp"] || matchSupp["Mã nhà cung cấp"]) : (defaultCompany || suppliers[0]?.["Tên Nhà Cung Cấp"] || suppliers[0]?.["Mã nhà cung cấp"] || '');

      setEditingContact(null);
      setContactFormData({
        ID: `contact_${Date.now()}`,
        "Danh xưng": 'Mr',
        "Tên": '',
        "Chức vụ": '',
        "Phòng ban": '',
        "Công ty": resolvedCompany,
        "Điện thoại": '',
        "Email": '',
        "Mức độ quan hệ": '3',
        "Phụ trách": ''
      });
    }
    setIsContactModalOpen(true);
  };

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactFormData["Tên"] || !contactFormData["Công ty"]) {
      toast.error("Vui lòng nhập họ tên và chọn nhà cung cấp liên kết.");
      return;
    }

    const toastId = toast.loading("Đang lưu thông tin nhân sự...");
    try {
      const targetId = editingContact?.id || editingContact?.ID || getItemKey(contactFormData, 'contacts') || contactFormData.ID || doc(collection(db, 'contacts')).id;
      const docId = String(targetId).replace(/[/\\#?%[\]\s.]+/g, '_');

      const payload = {
        ...contactFormData,
        id: docId,
        ID: contactFormData.ID || docId,
        updatedAt: new Date().toISOString()
      };

      await Promise.race([
        setDoc(doc(db, 'contacts', docId), payload, { merge: true }),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 7000))
      ]);
      
      if (selectedContactDetail && (selectedContactDetail.id === docId || selectedContactDetail.ID === docId)) {
        setSelectedContactDetail({ ...selectedContactDetail, ...payload });
      }
      toast.success(editingContact ? "Đã cập nhật nhân sự!" : "Đã thêm nhân sự vào danh bạ nhà cung cấp!", { id: toastId });
      setIsContactModalOpen(false);
    } catch (error) {
      console.warn("Supplier contact save error:", error);
      toast.error("Không thể lưu nhân sự! Vui lòng thử lại.", { id: toastId });
    }
  };

  const handleDeleteContact = async (contact: any, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Bạn có chắc chắn muốn xóa liên hệ "${contact["Tên"]}"?`)) return;
    const loadingToast = toast.loading("Đang xóa...");
    try {
      const targetId = contact.id || getItemKey(contact, 'contacts') || contact.ID || `${contact["Tên"]}-${contact["Công ty"]}`;
      const docId = String(targetId).replace(/[/\\#?%[\]\s.]+/g, '_');
      
      await Promise.race([
        setDoc(doc(db, 'contacts', docId), { ...contact, isDeleted: true, deletedAt: new Date().toISOString() }, { merge: true }),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 7000))
      ]);
      
      if (selectedContactDetail && (selectedContactDetail.id === docId || selectedContactDetail.ID === contact.ID)) {
        setSelectedContactDetail(null);
      }
      toast.success("Đã xóa nhân sự!", { id: loadingToast });
    } catch (error) {
      console.warn("Supplier contact delete error:", error);
      toast.error("Không thể xóa nhân sự! Vui lòng thử lại.", { id: loadingToast });
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const loadingToast = toast.loading("Đang lưu nhà cung cấp...");
    try {
      let finalLogoUrl = formData.logoUrl;

      if (logoFile) {
        try {
          const storageRef = ref(storage, `supplier_logos/${formData["Mã nhà cung cấp"]}_${Date.now()}`);
          const uploadRes = await uploadBytes(storageRef, logoFile);
          finalLogoUrl = await getDownloadURL(uploadRes.ref);
        } catch (uploadErr) {
          console.warn("Storage upload warning:", uploadErr);
        }
      }

      const payload = {
        ...formData,
        logoUrl: finalLogoUrl,
        updatedAt: new Date().toISOString()
      };

      const rawDocId = editingSupplier?.id || getItemKey(editingSupplier || payload, 'suppliers') || formData["Mã nhà cung cấp"];
      const docId = String(rawDocId).replace(/[/\\#?%[\]\s.]+/g, '_');

      await setDoc(doc(db, 'suppliers', docId), payload, { merge: true });

      toast.success(editingSupplier ? "Đã cập nhật nhà cung cấp!" : "Đã thêm nhà cung cấp mới!", { id: loadingToast });
      setIsModalOpen(false);
    } catch (error) {
      toast.error("Đã xảy ra lỗi khi lưu thông tin!", { id: loadingToast });
      handleFirestoreError(error, OperationType.WRITE, 'suppliers');
    }
  };

  const handleDelete = async (id: string, supplierId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Bạn có chắc chắn muốn xóa nhà cung cấp "${supplierId}"?`)) return;
    const loadingToast = toast.loading("Đang xoá nhà cung cấp...");
    try {
      const targetId = id || getItemKey({ "Mã nhà cung cấp": supplierId }, 'suppliers') || supplierId;
      const docId = String(targetId).replace(/[/\\#?%[\]\s.]+/g, '_');
      await setDoc(doc(db, 'suppliers', docId), { isDeleted: true }, { merge: true });

      toast.success("Đã xoá nhà cung cấp!", { id: loadingToast });
      if (selectedSupplierDetail?.id === docId || selectedSupplierDetail?.["Mã nhà cung cấp"] === supplierId) {
        setSelectedSupplierDetail(null);
      }
    } catch (error) {
      toast.error("Không thể xoá nhà cung cấp!", { id: loadingToast });
      handleFirestoreError(error, OperationType.DELETE, `suppliers/${id || supplierId}`);
    }
  };

  const copyToClipboard = (text: string, label: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(text);
    toast.success(`Đã sao chép ${label}: ${text}`);
  };

  // KPIs
  const stats = useMemo(() => {
    const total = suppliers.length;
    const active = suppliers.filter(s => s["Tình trạng"] === "Đang hoạt động").length;
    const fiveStar = suppliers.filter(s => String(s["Đánh giá"]) === "5").length;
    const totalContacts = supplierContacts.length;

    return { total, active, fiveStar, totalContacts };
  }, [suppliers, supplierContacts]);

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(s => {
      const matchSearch = 
        s["Mã nhà cung cấp"]?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s["Tên Nhà Cung Cấp"]?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s["Nhóm hàng"]?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s["Địa chỉ"]?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s["Email"]?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s["Loại hình"]?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s["Mã số thuế"]?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchStatus = statusFilter === 'all' 
        ? true 
        : statusFilter === '5star' 
        ? String(s["Đánh giá"]) === '5'
        : s["Tình trạng"] === statusFilter;

      return matchSearch && matchStatus;
    });
  }, [suppliers, searchTerm, statusFilter]);

  const handleExportToExcel = () => {
    try {
      if (activeSubTab === 'companies') {
        const exportData = filteredSuppliers.map(s => {
          const { totalProjects, totalTasks } = getSupplierTasksAndProjects(s);
          return {
            "Mã NCC": s["Mã nhà cung cấp"] || "",
            "Tên Nhà Cung Cấp": cleanCompanyName(s["Tên Nhà Cung Cấp"] || ""),
            "Loại hình": s["Loại hình"] || "Nhà sản xuất trực tiếp",
            "Nhóm hàng": s["Nhóm hàng"] || "",
            "Tình trạng": s["Tình trạng"] || "Đang hoạt động",
            "Đánh giá (Sao)": s["Đánh giá"] || "5",
            "Mã số thuế": s["Mã số thuế"] || "",
            "Số điện thoại": s["Số điện thoại"] || "",
            "Email": s["Email"] || "",
            "Địa chỉ": s["Địa chỉ"] || "",
            "Nhà máy": s["Nhà máy"] || "",
            "Điều khoản thanh toán": s["Điều khoản thanh toán"] || "Công nợ 30 ngày",
            "Tài khoản ngân hàng": s["Tài khoản ngân hàng"] || "",
            "Đại diện pháp luật": s["Đại diện pháp luật"] || "",
            "Số đầu mối liên hệ": getLinkedContacts(s).length,
            "Dự án": totalProjects,
            "Công việc": totalTasks
          };
        });

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Nha_Cung_Cap_TSG");
        XLSX.writeFile(wb, `Danh_Sach_Nha_Cung_Cap_${new Date().toISOString().slice(0, 10)}.xlsx`);
        toast.success("Đã xuất danh sách nhà cung cấp ra Excel!");
      } else {
        const exportData = filteredSupplierContacts.map(c => {
          const contactId = c.ID || `${c["Tên"]}-${c["Công ty"]}`;
          const contactTasks = tasks[contactId] || [];
          const contactProjects = projects[contactId] || [];
          return {
            "Danh xưng": c["Danh xưng"] || "",
            "Họ và Tên": c["Tên"] || "",
            "Chức vụ": c["Chức vụ"] || "",
            "Phòng ban": c["Phòng ban"] || "",
            "Nhà cung cấp": c["Công ty"] || "",
            "Số điện thoại": c["Điện thoại"] || "",
            "Email": c["Email"] || "",
            "Mức độ quan hệ": `${c["Mức độ quan hệ"] || "3"} sao`,
            "Phụ trách": c["Phụ trách"] || "",
            "Số dự án": contactProjects.length,
            "Số công việc": contactTasks.length
          };
        });

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Danh_Ba_Nha_Cung_Cap");
        XLSX.writeFile(wb, `Danh_Ba_Nhan_Su_NCC_${new Date().toISOString().slice(0, 10)}.xlsx`);
        toast.success("Đã xuất danh bạ nhân sự nhà cung cấp ra Excel!");
      }
    } catch (err: any) {
      toast.error("Lỗi xuất Excel: " + (err?.message || err));
    }
  };

  // Task & Project handlers for contact modal
  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskForm.title) return;
    const contactId = selectedContactDetail.ID || `${selectedContactDetail["Tên"]}-${selectedContactDetail["Công ty"]}`;
    const newTask = {
      id: `task_${Date.now()}`,
      title: taskForm.title,
      dueDate: taskForm.dueDate || new Date().toISOString().slice(0, 10),
      priority: taskForm.priority,
      status: taskForm.status
    };
    const newTasks = { ...tasks, [contactId]: [...(tasks[contactId] || []), newTask] };
    saveTasks(newTasks);
    setTaskForm({ title: '', dueDate: '', priority: 'medium', status: 'todo' });
    setShowAddTaskForm(false);
    toast.success("Đã thêm công việc!");
  };

  const handleToggleTaskStatus = (taskId: string) => {
    const contactId = selectedContactDetail.ID || `${selectedContactDetail["Tên"]}-${selectedContactDetail["Công ty"]}`;
    const newTasks = { ...tasks };
    if (newTasks[contactId]) {
      newTasks[contactId] = newTasks[contactId].map(t => {
        if (t.id === taskId) {
          return { ...t, status: t.status === 'done' ? 'todo' : 'done' };
        }
        return t;
      });
      saveTasks(newTasks);
    }
  };

  const handleDeleteTask = (taskId: string) => {
    const contactId = selectedContactDetail.ID || `${selectedContactDetail["Tên"]}-${selectedContactDetail["Công ty"]}`;
    const newTasks = { ...tasks };
    if (newTasks[contactId]) {
      newTasks[contactId] = newTasks[contactId].filter(t => t.id !== taskId);
      saveTasks(newTasks);
      toast.success("Đã xóa việc!");
    }
  };

  const handleAddProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectForm.name) return;
    const contactId = selectedContactDetail.ID || `${selectedContactDetail["Tên"]}-${selectedContactDetail["Công ty"]}`;
    const newProject = {
      id: `proj_${Date.now()}`,
      name: projectForm.name,
      code: projectForm.code || `PRJ-${Date.now().toString().slice(-4)}`,
      description: projectForm.description,
      status: projectForm.status
    };
    const newProjects = { ...projects, [contactId]: [...(projects[contactId] || []), newProject] };
    saveProjects(newProjects);
    setProjectForm({ name: '', code: '', description: '', status: 'active' });
    setShowAddProjectForm(false);
    toast.success("Đã tạo dự án!");
  };

  const handleDeleteProject = (projectId: string) => {
    const contactId = selectedContactDetail.ID || `${selectedContactDetail["Tên"]}-${selectedContactDetail["Công ty"]}`;
    const newProjects = { ...projects };
    if (newProjects[contactId]) {
      newProjects[contactId] = newProjects[contactId].filter(p => p.id !== projectId);
      saveProjects(newProjects);
      toast.success("Đã xóa dự án!");
    }
  };

  const handleAddActivity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activityForm.content) return;
    const contactId = selectedContactDetail.ID || `${selectedContactDetail["Tên"]}-${selectedContactDetail["Công ty"]}`;
    const newAct = {
      id: `act_${Date.now()}`,
      type: activityForm.type,
      content: activityForm.content,
      timestamp: new Date().toLocaleString('vi-VN'),
      user: activityForm.user
    };
    const newActs = { ...activities, [contactId]: [newAct, ...(activities[contactId] || [])] };
    saveActivities(newActs);
    setActivityForm({ type: 'call', content: '', user: 'Quản trị viên' });
    setShowAddActivityForm(false);
    toast.success("Đã ghi nhật ký!");
  };

  const handleDeleteActivity = (actId: string) => {
    const contactId = selectedContactDetail.ID || `${selectedContactDetail["Tên"]}-${selectedContactDetail["Công ty"]}`;
    const newActs = { ...activities };
    if (newActs[contactId]) {
      newActs[contactId] = newActs[contactId].filter(a => a.id !== actId);
      saveActivities(newActs);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-white min-h-screen text-slate-900 font-sans">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-5 pb-24 lg:pb-12">
        
        {/* Apple macOS Unified Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                Nhà Cung Cấp
              </h1>
              
              {/* Integrated Apple Sub-Segmented Control */}
              <div className="flex bg-slate-100 p-0.5 rounded-xl text-xs font-semibold">
                <button
                  onClick={() => setActiveSubTab('companies')}
                  className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 ${
                    activeSubTab === 'companies'
                      ? 'bg-white text-[#0071E3] shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Factory size={13} />
                  <span>Hồ sơ Nhà Cung Cấp ({suppliers.length})</span>
                </button>
                <button
                  onClick={() => setActiveSubTab('contacts')}
                  className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 ${
                    activeSubTab === 'contacts'
                      ? 'bg-white text-[#0071E3] shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Users size={13} />
                  <span>Danh bạ Đầu mối Cung ứng ({supplierContacts.length})</span>
                </button>
              </div>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              {activeSubTab === 'companies'
                ? 'Quản lý đối tác cung ứng, nhóm hàng, hạn mức thanh toán, ngân hàng và đầu mối.'
                : 'Tra cứu danh bạ nhân sự, phòng kinh doanh, kỹ thuật và quản lý của nhà cung cấp.'}
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={handleExportToExcel}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-xs"
              title="Xuất Excel"
            >
              <FileSpreadsheet size={15} className="text-emerald-600" />
              <span>Xuất Excel</span>
            </button>

            {activeSubTab === 'companies' ? (
              <button 
                onClick={() => handleOpenModal()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#0071E3] hover:bg-[#0066D6] transition-all shadow-xs"
              >
                <Plus size={16} />
                <span>Thêm nhà cung cấp</span>
              </button>
            ) : (
              <button 
                onClick={() => handleOpenContactModal()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#0071E3] hover:bg-[#0066D6] transition-all shadow-xs"
              >
                <Plus size={16} />
                <span>Thêm đầu mối</span>
              </button>
            )}
          </div>
        </div>

        {/* SUB-VIEW 1: SUPPLIER COMPANIES */}
        {activeSubTab === 'companies' ? (
          <>
            {/* Apple Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-medium text-slate-400 block">Đang hoạt động</span>
                  <span className="text-lg font-bold text-emerald-600 mt-0.5 block">{stats.active}</span>
                </div>
                <div className="h-8 w-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">
                  ✓
                </div>
              </div>

              <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-medium text-slate-400 block">Đánh giá 5 Sao</span>
                  <span className="text-lg font-bold text-amber-600 mt-0.5 block">{stats.fiveStar}</span>
                </div>
                <div className="h-8 w-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold">
                  ★
                </div>
              </div>

              <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-medium text-slate-400 block">Đầu mối nhân sự</span>
                  <span className="text-lg font-bold text-purple-600 mt-0.5 block">{stats.totalContacts}</span>
                </div>
                <div className="h-8 w-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold">
                  👥
                </div>
              </div>

              <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-medium text-slate-400 block">Tổng nhà cung cấp</span>
                  <span className="text-lg font-bold text-slate-800 mt-0.5 block">{stats.total}</span>
                </div>
                <div className="h-8 w-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-bold">
                  🏭
                </div>
              </div>
            </div>

            {/* Search & Apple Segmented Control */}
            <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
              <div className="relative w-full md:w-96">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  placeholder="Tìm theo mã, tên NCC, nhóm hàng, MST, email, loại hình..."
                  className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3] text-xs sm:text-sm transition-all placeholder:text-slate-400"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <X size={13} />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-between md:justify-end">
                <div className="flex bg-slate-100 p-1 rounded-xl gap-0.5 overflow-x-auto max-w-full">
                  {[
                    { key: 'all', label: `Tất cả (${stats.total})` },
                    { key: 'Đang hoạt động', label: `Đang hoạt động (${stats.active})` },
                    { key: '5star', label: `5 Sao (${stats.fiveStar})` },
                  ].map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => setStatusFilter(tab.key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                        statusFilter === tab.key
                          ? 'bg-white text-slate-900 shadow-xs font-semibold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="flex bg-slate-100 p-1 rounded-xl gap-0.5 shrink-0">
                  <button 
                    onClick={() => setViewMode('table')}
                    className={`p-1.5 rounded-lg text-xs transition-all ${viewMode === 'table' ? 'bg-white text-[#0071E3] shadow-xs' : 'text-slate-500'}`}
                    title="Dạng Bảng"
                  >
                    <List size={16} />
                  </button>
                  <button 
                    onClick={() => setViewMode('grid')}
                    className={`p-1.5 rounded-lg text-xs transition-all ${viewMode === 'grid' ? 'bg-white text-[#0071E3] shadow-xs' : 'text-slate-500'}`}
                    title="Dạng Thẻ"
                  >
                    <LayoutGrid size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* Supplier Table / Grid */}
            {filteredSuppliers.length > 0 ? (
              viewMode === 'table' ? (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs sm:text-sm text-left border-collapse">
                      <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200 text-xs">
                        <tr>
                          <th className="px-5 py-3.5">Mã & Nhà cung cấp</th>
                          <th className="px-5 py-3.5">Loại hình & Nhóm hàng</th>
                          <th className="px-5 py-3.5">Mã số thuế & Email</th>
                          <th className="px-5 py-3.5">Địa chỉ</th>
                          <th className="px-5 py-3.5">Điều khoản TT</th>
                          <th className="px-5 py-3.5">Đánh giá</th>
                          <th className="px-5 py-3.5">Đầu mối</th>
                          <th className="px-5 py-3.5 text-right">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredSuppliers.map((supplier, idx) => {
                          const cleanName = cleanCompanyName(supplier["Tên Nhà Cung Cấp"] || "");
                          const linkedContacts = getLinkedContacts(supplier);
                          const { totalProjects, totalTasks } = getSupplierTasksAndProjects(supplier);
                          const suppKey = supplier.id || supplier["Mã nhà cung cấp"] || `supp-row-${idx}`;

                          return (
                            <tr 
                              key={suppKey}
                              onClick={() => setSelectedSupplierDetail(supplier)}
                              className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                            >
                              <td className="px-5 py-3">
                                <div className="flex items-center gap-3">
                                  <CompanyLogo 
                                    name={supplier["Tên Nhà Cung Cấp"] || cleanName} 
                                    size="sm" 
                                    className="shrink-0 rounded-lg shadow-2xs" 
                                    logoUrl={getSupplierLogo(supplier)} 
                                    logoFit={supplier.logoFit} 
                                  />
                                  <div className="min-w-0">
                                    <span className="text-[10px] font-mono font-semibold text-slate-400 uppercase block">
                                      {supplier["Mã nhà cung cấp"]}
                                    </span>
                                    <div className="font-semibold text-slate-900 group-hover:text-[#0071E3] transition-colors truncate mt-0.5">
                                      {cleanName}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              <td className="px-5 py-3">
                                <div className="space-y-0.5">
                                  <span className="text-[11px] font-medium text-slate-700 block">
                                    {supplier["Loại hình"] || "Nhà sản xuất"}
                                  </span>
                                  <span className="inline-block text-[10px] text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded font-medium">
                                    {supplier["Nhóm hàng"] || "Cung ứng"}
                                  </span>
                                </div>
                              </td>

                              <td className="px-5 py-3 font-mono text-xs text-slate-700" onClick={(e) => e.stopPropagation()}>
                                <div className="space-y-0.5">
                                  {supplier["Mã số thuế"] ? (
                                    <button 
                                      onClick={(e) => copyToClipboard(supplier["Mã số thuế"], "Mã số thuế", e)}
                                      className="hover:text-blue-600 transition-colors font-medium block"
                                      title="Sao chép MST"
                                    >
                                      {supplier["Mã số thuế"]}
                                    </button>
                                  ) : <span className="text-slate-300">—</span>}
                                  {supplier["Email"] && (
                                    <a href={`mailto:${supplier["Email"]}`} className="text-[11px] text-blue-600 font-sans hover:underline block truncate max-w-[150px]">
                                      {supplier["Email"]}
                                    </a>
                                  )}
                                </div>
                              </td>

                              <td className="px-5 py-3 text-slate-600 max-w-xs">
                                <span className="line-clamp-1 text-xs" title={supplier["Địa chỉ"]}>
                                  {supplier["Địa chỉ"] || "—"}
                                </span>
                              </td>

                              <td className="px-5 py-3">
                                <span className="text-xs text-slate-700 font-medium">
                                  {supplier["Điều khoản thanh toán"] || "Công nợ 30 ngày"}
                                </span>
                              </td>

                              <td className="px-5 py-3">
                                <div className="flex items-center gap-1 text-amber-500 font-semibold text-xs">
                                  <span>{supplier["Đánh giá"] || "5"}</span>
                                  <Star size={12} fill="currentColor" />
                                </div>
                              </td>

                              <td className="px-5 py-3">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {linkedContacts.length > 0 ? (
                                    <span className="text-xs text-slate-700 font-semibold">
                                      {linkedContacts.length} đầu mối
                                    </span>
                                  ) : (
                                    <span className="text-xs text-slate-300">—</span>
                                  )}
                                  {totalTasks > 0 && (
                                    <span className="text-[10px] bg-blue-50 text-blue-700 font-medium px-1.5 py-0.2 rounded border border-blue-100">
                                      {totalTasks} việc
                                    </span>
                                  )}
                                </div>
                              </td>

                              <td className="px-5 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                                  <button 
                                    onClick={() => setSelectedSupplierDetail(supplier)}
                                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                    title="Xem hồ sơ"
                                  >
                                    <Eye size={15} />
                                  </button>
                                  <button 
                                    onClick={() => handleOpenModal(supplier)}
                                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                    title="Chỉnh sửa"
                                  >
                                    <Edit2 size={15} />
                                  </button>
                                  <button 
                                    onClick={(e) => handleDelete(supplier.id, supplier["Mã nhà cung cấp"], e)}
                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Xóa"
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </div>
                              </td>

                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredSuppliers.map((supplier, idx) => {
                    const cleanName = cleanCompanyName(supplier["Tên Nhà Cung Cấp"] || "");
                    const linkedContacts = getLinkedContacts(supplier);
                    const suppKey = supplier.id || supplier["Mã nhà cung cấp"] || `supp-card-${idx}`;

                    return (
                      <div 
                        key={suppKey}
                        onClick={() => setSelectedSupplierDetail(supplier)}
                        className="bg-white rounded-2xl border border-slate-200 p-4 hover:border-slate-300 hover:shadow-xs transition-all cursor-pointer flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 min-w-0">
                              <CompanyLogo 
                                name={supplier["Tên Nhà Cung Cấp"] || cleanName} 
                                size="md" 
                                className="shrink-0 rounded-xl shadow-2xs mt-0.5" 
                                logoUrl={getSupplierLogo(supplier)} 
                                logoFit={supplier.logoFit} 
                              />
                              <div className="min-w-0">
                                <span className="text-[10px] font-mono font-semibold text-slate-400 uppercase block">
                                  {supplier["Mã nhà cung cấp"]}
                                </span>
                                <h3 className="font-semibold text-slate-900 text-sm truncate mt-0.5" title={cleanName}>
                                  {cleanName}
                                </h3>
                                <div className="flex items-center gap-1.5 mt-1">
                                  <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-medium">
                                    {supplier["Loại hình"] || "Nhà sản xuất"}
                                  </span>
                                  <span className="text-[10px] bg-purple-50 text-purple-700 px-1.5 py-0.2 rounded font-medium">
                                    {supplier["Nhóm hàng"] || "Cung ứng"}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 text-amber-500 font-bold text-xs bg-amber-50 px-2 py-0.5 rounded-full">
                              <span>{supplier["Đánh giá"] || "5"}</span>
                              <Star size={11} fill="currentColor" />
                            </div>
                          </div>

                          <div className="mt-3.5 pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
                            {supplier["Mã số thuế"] && (
                              <div className="flex items-center gap-2 font-mono text-slate-500">
                                <FileText size={13} className="text-slate-400 shrink-0" />
                                <span>MST: {supplier["Mã số thuế"]}</span>
                              </div>
                            )}
                            {supplier["Email"] && (
                              <div className="flex items-center gap-2 text-blue-600">
                                <Mail size={13} className="text-slate-400 shrink-0" />
                                <span className="truncate">{supplier["Email"]}</span>
                              </div>
                            )}
                            {supplier["Địa chỉ"] && (
                              <div className="flex items-start gap-2">
                                <MapPin size={13} className="text-slate-400 shrink-0 mt-0.5" />
                                <span className="line-clamp-1 text-slate-700" title={supplier["Địa chỉ"]}>
                                  {supplier["Địa chỉ"]}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs" onClick={(e) => e.stopPropagation()}>
                          <div className="text-slate-500">
                            {linkedContacts.length > 0 ? (
                              <span className="font-semibold text-purple-600">{linkedContacts.length} đầu mối</span>
                            ) : (
                              <span className="text-slate-400 italic">Chưa có liên hệ</span>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            <button 
                              onClick={() => handleOpenModal(supplier)}
                              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition-colors"
                              title="Chỉnh sửa"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button 
                              onClick={(e) => handleDelete(supplier.id, supplier["Mã nhà cung cấp"], e)}
                              className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg transition-colors"
                              title="Xóa"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>
              )
            ) : (
              <div className="bg-slate-50 rounded-2xl border border-slate-200 p-10 text-center space-y-2">
                <Factory size={36} className="mx-auto text-slate-300" />
                <div className="text-sm font-semibold text-slate-700">Không tìm thấy nhà cung cấp</div>
                <p className="text-xs text-slate-400">Thử tìm kiếm với từ khóa khác.</p>
              </div>
            )}
          </>
        ) : (
          
          /* SUB-VIEW 2: INTEGRATED SUPPLIER CONTACT DIRECTORY */
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
              <div className="relative w-full md:w-96">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  placeholder="Tìm theo tên đầu mối, nhà cung cấp, SĐT..."
                  className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3] text-xs sm:text-sm transition-all"
                  value={contactSearchTerm}
                  onChange={(e) => setContactSearchTerm(e.target.value)}
                />
                {contactSearchTerm && (
                  <button onClick={() => setContactSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <X size={13} />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="flex bg-slate-100 p-1 rounded-xl gap-0.5">
                  {[
                    { key: 'all', label: `Tất cả (${supplierContacts.length})` },
                    { key: 'exec', label: 'Ban Lãnh đạo' },
                    { key: 'starred', label: 'Đầu mối thân thiết (4-5★)' },
                  ].map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => setContactRoleFilter(tab.key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        contactRoleFilter === tab.key ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Supplier Contacts Table */}
            {filteredSupplierContacts.length > 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs sm:text-sm text-left border-collapse">
                    <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200 text-xs">
                      <tr>
                        <th className="px-5 py-3.5">Họ và Tên</th>
                        <th className="px-5 py-3.5">Nhà cung cấp</th>
                        <th className="px-5 py-3.5">Chức vụ / Phòng ban</th>
                        <th className="px-5 py-3.5">Kênh liên lạc</th>
                        <th className="px-5 py-3.5">Dự án & Công việc</th>
                        <th className="px-5 py-3.5 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredSupplierContacts.map((contact) => {
                        const contactId = contact.ID || `${contact["Tên"]}-${contact["Công ty"]}`;
                        const cleanName = formatContactFullName(contact["Tên"] || "");
                        const fullName = `${contact["Danh xưng"] ? contact["Danh xưng"] + " " : ""}${cleanName}`;
                        const initials = getAvatarInitials(cleanName);
                        const exec = isExecutive(contact["Chức vụ"]);
                        const cleanPhone = getRawCallablePhone(contact["Điện thoại"]);
                        const formattedPhone = formatVietnamesePhone(contact["Điện thoại"]);

                        const contactTasks = tasks[contactId] || [];
                        const doneTasks = contactTasks.filter(t => t.status === 'done').length;
                        const contactProjects = projects[contactId] || [];

                        return (
                          <tr 
                            key={contactId}
                            onClick={() => {
                              setSelectedContactDetail(contact);
                              setContactDetailTab('tasks');
                            }}
                            className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                          >
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-3">
                                <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                                  exec ? 'bg-amber-100 text-amber-800 ring-1 ring-amber-300' : 'bg-purple-100 text-purple-800'
                                }`}>
                                  {initials}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-semibold text-slate-900 group-hover:text-[#0071E3] transition-colors flex items-center gap-1.5">
                                    <span>{fullName}</span>
                                    {exec && (
                                      <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1 rounded font-medium">
                                        Lãnh đạo
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-slate-400 mt-0.5">
                                    {contact["Phụ trách"] ? `Phụ trách: ${contact["Phụ trách"]}` : `Mức độ: ${contact["Mức độ quan hệ"] || "3"}★`}
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td className="px-5 py-3">
                              <div className="flex items-center gap-2">
                                <CompanyLogo name={contact["Công ty"]} size="sm" className="rounded shadow-2xs" />
                                <span className="font-medium text-slate-800">{contact["Công ty"]}</span>
                              </div>
                            </td>

                            <td className="px-5 py-3 text-slate-600">
                              <div className="font-medium text-slate-800">{contact["Chức vụ"] || "—"}</div>
                              {contact["Phòng ban"] && (
                                <div className="text-xs text-slate-400">{contact["Phòng ban"]}</div>
                              )}
                            </td>

                            <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                              <div className="space-y-0.5 text-xs">
                                {contact["Điện thoại"] ? (
                                  <div className="flex items-center gap-1.5 font-mono">
                                    <a href={`tel:${cleanPhone}`} className="font-medium text-slate-700 hover:text-purple-600 transition-colors">
                                      {formattedPhone}
                                    </a>
                                    {cleanPhone && (
                                      <a 
                                        href={`https://zalo.me/${cleanPhone}`} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="px-1 text-[9px] bg-purple-100 text-purple-700 hover:bg-purple-200 rounded font-sans font-semibold"
                                      >
                                        Zalo
                                      </a>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-slate-300">—</span>
                                )}
                                {contact["Email"] && (
                                  <a href={`mailto:${contact["Email"]}`} className="text-slate-400 hover:text-slate-700 truncate block max-w-[170px]">
                                    {contact["Email"]}
                                  </a>
                                )}
                              </div>
                            </td>

                            <td className="px-5 py-3">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {contactProjects.length > 0 && (
                                  <span className="inline-flex items-center gap-1 text-[11px] text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md font-medium border border-purple-100">
                                    <Folder size={11} className="text-purple-500" />
                                    {contactProjects.length} dự án
                                  </span>
                                )}
                                <span className="inline-flex items-center gap-1 text-[11px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md font-medium border border-blue-100">
                                  <CheckSquare size={11} className="text-blue-500" />
                                  {contactTasks.length > 0 ? `${doneTasks}/${contactTasks.length} việc` : '0 việc'}
                                </span>
                              </div>
                            </td>

                            <td className="px-5 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                                <button 
                                  onClick={() => {
                                    setSelectedContactDetail(contact);
                                    setContactDetailTab('tasks');
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-[#0071E3] hover:bg-blue-50 rounded-lg transition-colors"
                                  title="Xem hồ sơ & công việc"
                                >
                                  <Eye size={15} />
                                </button>
                                <button 
                                  onClick={() => handleOpenContactModal(contact)}
                                  className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                  title="Chỉnh sửa"
                                >
                                  <Edit2 size={15} />
                                </button>
                                <button 
                                  onClick={(e) => handleDeleteContact(contact, e)}
                                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Xóa"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </td>

                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 rounded-2xl border border-slate-200 p-10 text-center space-y-2">
                <Users size={36} className="mx-auto text-slate-300" />
                <div className="text-sm font-semibold text-slate-700">Chưa có đầu mối nhà cung cấp nào phù hợp</div>
                <p className="text-xs text-slate-400">Bấm "+ Thêm đầu mối" để liên kết nhân sự mới.</p>
              </div>
            )}

          </div>
        )}

      </div>

      {/* Supplier Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-2xl flex flex-col max-h-[92vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/80">
              <h3 className="text-base font-bold text-slate-900">
                {editingSupplier ? 'Chỉnh sửa nhà cung cấp' : 'Thêm nhà cung cấp mới'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 overflow-y-auto flex-1 space-y-4 text-xs sm:text-sm">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Mã nhà cung cấp *</label>
                  <input
                    type="text"
                    required
                    value={formData["Mã nhà cung cấp"]}
                    onChange={(e) => setFormData({ ...formData, "Mã nhà cung cấp": e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm outline-none font-mono uppercase"
                    placeholder="VD: SUPP_001"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Loại hình</label>
                  <select
                    value={formData["Loại hình"]}
                    onChange={(e) => setFormData({ ...formData, "Loại hình": e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm outline-none"
                  >
                    <option value="Nhà sản xuất trực tiếp">Nhà sản xuất trực tiếp</option>
                    <option value="Đại lý nhập khẩu cấp 1">Đại lý nhập khẩu cấp 1</option>
                    <option value="Doanh nghiệp FDI">Doanh nghiệp FDI</option>
                    <option value="Thương mại tổng hợp">Thương mại tổng hợp</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Nhóm hàng cung ứng</label>
                  <input
                    type="text"
                    value={formData["Nhóm hàng"]}
                    onChange={(e) => setFormData({ ...formData, "Nhóm hàng": e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm outline-none"
                    placeholder="VD: Giấy cuộn / Mực in"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Tên Nhà Cung Cấp (Tên pháp lý) *</label>
                <input
                  type="text"
                  required
                  value={formData["Tên Nhà Cung Cấp"]}
                  onChange={(e) => setFormData({ ...formData, "Tên Nhà Cung Cấp": e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm outline-none"
                  placeholder="Công ty TNHH..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Mã số thuế</label>
                  <input
                    type="text"
                    value={formData["Mã số thuế"]}
                    onChange={(e) => setFormData({ ...formData, "Mã số thuế": e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm outline-none font-mono"
                    placeholder="0101..."
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Đại diện pháp luật / Giám đốc</label>
                  <input
                    type="text"
                    value={formData["Đại diện pháp luật"]}
                    onChange={(e) => setFormData({ ...formData, "Đại diện pháp luật": e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm outline-none"
                    placeholder="Ông Trần Văn B"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Email đặt hàng / Báo giá</label>
                  <input
                    type="email"
                    value={formData["Email"]}
                    onChange={(e) => setFormData({ ...formData, "Email": e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm outline-none"
                    placeholder="sales@supplier.com"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Số điện thoại Hotline</label>
                  <input
                    type="text"
                    value={formData["Số điện thoại"]}
                    onChange={(e) => setFormData({ ...formData, "Số điện thoại": e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm outline-none font-mono"
                    placeholder="0243..."
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Địa chỉ văn phòng / Nhà máy</label>
                <input
                  type="text"
                  value={formData["Địa chỉ"]}
                  onChange={(e) => setFormData({ ...formData, "Địa chỉ": e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm outline-none"
                  placeholder="Số nhà, đường, tỉnh thành"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Điều khoản thanh toán</label>
                  <select
                    value={formData["Điều khoản thanh toán"]}
                    onChange={(e) => setFormData({ ...formData, "Điều khoản thanh toán": e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm outline-none"
                  >
                    <option value="Công nợ 30 ngày">Công nợ 30 ngày</option>
                    <option value="Công nợ 45 ngày">Công nợ 45 ngày</option>
                    <option value="Thanh toán ngay khi giao hàng">Thanh toán khi nhận hàng</option>
                    <option value="Đặt cọc 30% - Còn lại 70%">Đặt cọc 30%</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Đánh giá năng lực (Sao)</label>
                  <select
                    value={formData["Đánh giá"]}
                    onChange={(e) => setFormData({ ...formData, "Đánh giá": e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm outline-none"
                  >
                    <option value="5">5 Sao - Rất xuất sắc</option>
                    <option value="4">4 Sao - Tốt</option>
                    <option value="3">3 Sao - Đạt chuẩn</option>
                    <option value="2">2 Sao - Cần cải thiện</option>
                    <option value="1">1 Sao - Kém</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Trạng thái</label>
                  <select
                    value={formData["Tình trạng"]}
                    onChange={(e) => setFormData({ ...formData, "Tình trạng": e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm outline-none"
                  >
                    <option value="Đang hoạt động">Đang hoạt động</option>
                    <option value="Tạm dừng">Tạm dừng</option>
                    <option value="Nhà cung cấp dự phòng">Dự phòng</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Tài khoản ngân hàng thụ hưởng</label>
                <input
                  type="text"
                  value={formData["Tài khoản ngân hàng"]}
                  onChange={(e) => setFormData({ ...formData, "Tài khoản ngân hàng": e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm outline-none font-mono"
                  placeholder="STK: 987654321 - BIDV - CN Hà Nội"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2.5">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)} 
                  className="px-4 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
                >
                  Hủy
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2 text-xs font-semibold text-white bg-[#0071E3] hover:bg-[#0066D6] rounded-xl shadow-xs transition-all"
                >
                  {editingSupplier ? 'Lưu' : 'Thêm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Supplier Contact Modal */}
      {isContactModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg flex flex-col max-h-[90vh] overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/80">
              <h3 className="text-base font-bold text-slate-900">
                {editingContact ? 'Chỉnh sửa đầu mối nhà cung cấp' : 'Thêm đầu mối cung ứng'}
              </h3>
              <button onClick={() => setIsContactModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveContact} className="p-5 overflow-y-auto flex-1 space-y-4 text-xs sm:text-sm">
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Nhà cung cấp liên kết</label>
                <select
                  value={contactFormData["Công ty"]}
                  onChange={(e) => setContactFormData({ ...contactFormData, "Công ty": e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm outline-none"
                >
                  {suppliers.map((s) => (
                    <option key={s["Mã nhà cung cấp"] || s["Tên Nhà Cung Cấp"]} value={s["Tên Nhà Cung Cấp"] || s["Mã nhà cung cấp"]}>
                      {s["Tên Nhà Cung Cấp"]} ({s["Mã nhà cung cấp"]})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Danh xưng</label>
                  <select
                    value={contactFormData["Danh xưng"]}
                    onChange={(e) => setContactFormData({ ...contactFormData, "Danh xưng": e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm outline-none"
                  >
                    <option value="Mr">Mr (Anh)</option>
                    <option value="Mrs">Mrs (Chị)</option>
                    <option value="Ms">Ms (Cô)</option>
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="text-xs font-medium text-slate-600 block mb-1">Họ và Tên</label>
                  <input
                    type="text"
                    required
                    value={contactFormData["Tên"]}
                    onChange={(e) => setContactFormData({ ...contactFormData, "Tên": e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm outline-none"
                    placeholder="Nguyễn Văn B"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Chức vụ</label>
                  <input
                    type="text"
                    value={contactFormData["Chức vụ"]}
                    onChange={(e) => setContactFormData({ ...contactFormData, "Chức vụ": e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm outline-none"
                    placeholder="VD: Trưởng phòng kinh doanh"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Phòng ban</label>
                  <input
                    type="text"
                    value={contactFormData["Phòng ban"]}
                    onChange={(e) => setContactFormData({ ...contactFormData, "Phòng ban": e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm outline-none"
                    placeholder="VD: Kinh doanh / Kỹ thuật"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Số điện thoại</label>
                  <input
                    type="tel"
                    value={contactFormData["Điện thoại"]}
                    onChange={(e) => setContactFormData({ ...contactFormData, "Điện thoại": e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm outline-none font-mono"
                    placeholder="0912..."
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Email</label>
                  <input
                    type="email"
                    value={contactFormData["Email"]}
                    onChange={(e) => setContactFormData({ ...contactFormData, "Email": e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm outline-none"
                    placeholder="sales@supplier.com"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2.5">
                <button 
                  type="button" 
                  onClick={() => setIsContactModalOpen(false)} 
                  className="px-4 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
                >
                  Hủy
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2 text-xs font-semibold text-white bg-[#0071E3] hover:bg-[#0066D6] rounded-xl shadow-xs transition-all"
                >
                  {editingContact ? 'Lưu' : 'Thêm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Supplier Detail Modal */}
      {selectedSupplierDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[88vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/90">
              <div className="flex items-center gap-3.5">
                <CompanyLogo 
                  name={selectedSupplierDetail["Tên Nhà Cung Cấp"] || selectedSupplierDetail["Mã nhà cung cấp"]} 
                  size="md" 
                  className="rounded-2xl shadow-2xs" 
                  logoUrl={getSupplierLogo(selectedSupplierDetail)} 
                  logoFit={selectedSupplierDetail.logoFit} 
                />
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {cleanCompanyName(selectedSupplierDetail["Tên Nhà Cung Cấp"] || selectedSupplierDetail["Mã nhà cung cấp"])}
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    {selectedSupplierDetail["Mã nhà cung cấp"]} • {selectedSupplierDetail["Loại hình"] || "Nhà sản xuất"} • {selectedSupplierDetail["Nhóm hàng"] || "Cung ứng"}
                  </p>
                </div>
              </div>
              <button onClick={() => setSelectedSupplierDetail(null)} className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-xs sm:text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-100">
                  <span className="text-[11px] text-slate-400 font-medium block">Tên pháp lý</span>
                  <div className="font-semibold text-slate-800 mt-1">
                    {selectedSupplierDetail["Tên Nhà Cung Cấp"] || "—"}
                  </div>
                </div>
                <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-400 font-medium">Mã số thuế</span>
                    {selectedSupplierDetail["Mã số thuế"] && (
                      <button 
                        onClick={(e) => copyToClipboard(selectedSupplierDetail["Mã số thuế"], "Mã số thuế", e)}
                        className="text-[11px] text-blue-600 hover:underline"
                      >
                        Sao chép
                      </button>
                    )}
                  </div>
                  <div className="font-mono font-bold text-slate-800 mt-1">
                    {selectedSupplierDetail["Mã số thuế"] || "Chưa cập nhật"}
                  </div>
                </div>
              </div>

              {/* Financial & Terms */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-100">
                  <span className="text-[11px] text-slate-400 font-medium block">Điều khoản thanh toán</span>
                  <div className="font-semibold text-slate-800 mt-1">
                    {selectedSupplierDetail["Điều khoản thanh toán"] || "Công nợ 30 ngày"}
                  </div>
                </div>
                <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-100">
                  <span className="text-[11px] text-slate-400 font-medium block">Email đặt hàng</span>
                  <div className="text-blue-600 truncate mt-1">
                    {selectedSupplierDetail["Email"] || "Chưa cập nhật"}
                  </div>
                </div>
                <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-100">
                  <span className="text-[11px] text-slate-400 font-medium block">Đánh giá năng lực</span>
                  <div className="flex items-center gap-1 text-amber-500 font-bold mt-1">
                    <span>{selectedSupplierDetail["Đánh giá"] || "5"} Sao</span>
                    <Star size={12} fill="currentColor" />
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-100 space-y-2.5">
                <div>
                  <span className="text-[11px] text-slate-400 font-medium block">Địa chỉ</span>
                  <div className="text-slate-700 font-medium mt-0.5">
                    {selectedSupplierDetail["Địa chỉ"] || "Chưa cập nhật địa chỉ"}
                  </div>
                </div>
                {selectedSupplierDetail["Tài khoản ngân hàng"] && (
                  <div className="pt-2.5 border-t border-slate-200/60">
                    <span className="text-[11px] text-slate-400 font-medium block">Tài khoản ngân hàng thụ hưởng</span>
                    <div className="text-slate-700 font-medium mt-0.5 font-mono">
                      {selectedSupplierDetail["Tài khoản ngân hàng"]}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-bold text-slate-800 text-sm">
                    Đầu mối liên hệ ({getLinkedContacts(selectedSupplierDetail).length})
                  </span>
                  <button
                    onClick={() => handleOpenContactModal(null, selectedSupplierDetail["Tên Nhà Cung Cấp"] || selectedSupplierDetail["Mã nhà cung cấp"])}
                    className="text-xs font-semibold text-[#0071E3] hover:underline"
                  >
                    + Thêm đầu mối cho NCC này
                  </button>
                </div>

                <div className="space-y-2.5">
                  {getLinkedContacts(selectedSupplierDetail).length === 0 ? (
                    <div className="text-slate-400 text-xs py-5 text-center bg-slate-50 rounded-2xl border border-slate-100 italic">
                      Chưa có đầu mối liên hệ nào gắn với nhà cung cấp này.
                    </div>
                  ) : (
                    getLinkedContacts(selectedSupplierDetail).map((c: any, cidx: number) => {
                      const cleanPhone = getRawCallablePhone(c["Điện thoại"]);
                      const formattedPhone = formatVietnamesePhone(c["Điện thoại"]);
                      const cleanName = formatContactFullName(c["Tên"] || "");
                      return (
                        <div key={cidx} className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-100 flex items-center justify-between">
                          <div>
                            <div className="font-bold text-slate-900 text-sm">
                              {c["Danh xưng"] ? `${c["Danh xưng"]} ` : ''}{cleanName}
                            </div>
                            <div className="text-xs text-slate-500">
                              {c["Chức vụ"] || "Chức vụ chưa cập nhật"} {c["Phòng ban"] ? `• ${c["Phòng ban"]}` : ''}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {cleanPhone && (
                              <a href={`tel:${cleanPhone}`} className="px-2.5 py-1 text-xs font-semibold bg-white border border-slate-200 rounded-xl text-slate-700">
                                Gọi: {formattedPhone}
                              </a>
                            )}
                            {cleanPhone && (
                              <a href={`https://zalo.me/${cleanPhone}`} target="_blank" rel="noopener noreferrer" className="px-2.5 py-1 text-xs font-semibold bg-purple-50 rounded-xl text-purple-700">
                                Zalo
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Supplier Contact Detail Inspector Modal */}
      {selectedContactDetail && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl h-[88vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/90">
              <div className="flex items-center gap-3.5">
                <div className="h-10 w-10 rounded-full bg-purple-100 text-purple-800 font-bold flex items-center justify-center text-sm shadow-2xs">
                  {getAvatarInitials(selectedContactDetail["Tên"] || "")}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {selectedContactDetail["Danh xưng"] ? `${selectedContactDetail["Danh xưng"]} ` : ''}{formatContactFullName(selectedContactDetail["Tên"] || "")}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {selectedContactDetail["Chức vụ"] || "Chức vụ chưa rõ"} • {selectedContactDetail["Công ty"]}
                  </p>
                </div>
              </div>
              <button onClick={() => setSelectedContactDetail(null)} className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
              <div className="w-full md:w-72 border-b md:border-b-0 md:border-r border-slate-100 p-5 overflow-y-auto space-y-4 bg-slate-50/50">
                <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 space-y-2.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Kênh kết nối</span>
                  
                  {selectedContactDetail["Điện thoại"] && (
                    <div className="flex items-center justify-between gap-2 p-2 bg-slate-50 rounded-xl text-xs font-mono">
                      <a href={`tel:${getRawCallablePhone(selectedContactDetail["Điện thoại"])}`} className="font-bold text-slate-800 hover:text-purple-600 truncate">
                        {formatVietnamesePhone(selectedContactDetail["Điện thoại"])}
                      </a>
                    </div>
                  )}

                  {selectedContactDetail["Email"] && (
                    <div className="flex items-center justify-between gap-2 p-2 bg-slate-50 rounded-xl text-xs">
                      <a href={`mailto:${selectedContactDetail["Email"]}`} className="text-purple-600 hover:underline truncate">
                        {selectedContactDetail["Email"]}
                      </a>
                    </div>
                  )}

                  <div className="p-2 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                    <span className="text-[10px] text-slate-400 block">Nhà cung cấp</span>
                    <div className="font-semibold text-slate-800 mt-0.5">{selectedContactDetail["Công ty"]}</div>
                  </div>
                </div>
              </div>

              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex border-b border-slate-100 bg-white px-5 pt-2 gap-3 text-xs">
                  <button
                    onClick={() => setContactDetailTab('tasks')}
                    className={`pb-2.5 font-bold transition-all border-b-2 flex items-center gap-1.5 ${
                      contactDetailTab === 'tasks' ? 'border-[#0071E3] text-[#0071E3]' : 'border-transparent text-slate-400 hover:text-slate-700'
                    }`}
                  >
                    <CheckSquare size={14} />
                    <span>Công việc ({(tasks[selectedContactDetail.ID || `${selectedContactDetail["Tên"]}-${selectedContactDetail["Công ty"]}`] || []).length})</span>
                  </button>
                  <button
                    onClick={() => setContactDetailTab('projects')}
                    className={`pb-2.5 font-bold transition-all border-b-2 flex items-center gap-1.5 ${
                      contactDetailTab === 'projects' ? 'border-[#0071E3] text-[#0071E3]' : 'border-transparent text-slate-400 hover:text-slate-700'
                    }`}
                  >
                    <Folder size={14} />
                    <span>Dự án ({(projects[selectedContactDetail.ID || `${selectedContactDetail["Tên"]}-${selectedContactDetail["Công ty"]}`] || []).length})</span>
                  </button>
                  <button
                    onClick={() => setContactDetailTab('activities')}
                    className={`pb-2.5 font-bold transition-all border-b-2 flex items-center gap-1.5 ${
                      contactDetailTab === 'activities' ? 'border-[#0071E3] text-[#0071E3]' : 'border-transparent text-slate-400 hover:text-slate-700'
                    }`}
                  >
                    <Clock size={14} />
                    <span>Nhật ký ({(activities[selectedContactDetail.ID || `${selectedContactDetail["Tên"]}-${selectedContactDetail["Công ty"]}`] || []).length})</span>
                  </button>
                </div>

                <div className="flex-1 p-5 overflow-y-auto">
                  {contactDetailTab === 'tasks' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-500">Danh sách việc cần làm</span>
                        <button onClick={() => setShowAddTaskForm(!showAddTaskForm)} className="text-xs font-semibold text-[#0071E3] hover:underline">
                          + Thêm công việc
                        </button>
                      </div>

                      {showAddTaskForm && (
                        <form onSubmit={handleAddTask} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5">
                          <input 
                            type="text" 
                            required 
                            placeholder="Nội dung việc..." 
                            value={taskForm.title}
                            onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none"
                          />
                          <div className="grid grid-cols-3 gap-2">
                            <input 
                              type="date" 
                              value={taskForm.dueDate}
                              onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                              className="bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs outline-none"
                            />
                            <select
                              value={taskForm.priority}
                              onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
                              className="bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs outline-none"
                            >
                              <option value="low">Thấp</option>
                              <option value="medium">Vừa</option>
                              <option value="high">Cao</option>
                            </select>
                            <button type="submit" className="bg-[#0071E3] text-white rounded-xl text-xs font-semibold">Lưu việc</button>
                          </div>
                        </form>
                      )}

                      <div className="space-y-2">
                        {(() => {
                          const contactId = selectedContactDetail.ID || `${selectedContactDetail["Tên"]}-${selectedContactDetail["Công ty"]}`;
                          const contactTasks = tasks[contactId] || [];
                          if (contactTasks.length === 0) return <div className="text-slate-400 text-xs py-8 text-center italic">Chưa có công việc nào.</div>;
                          return contactTasks.map(task => (
                            <div key={task.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                              <div className="flex items-center gap-3">
                                <input 
                                  type="checkbox" 
                                  checked={task.status === 'done'} 
                                  onChange={() => handleToggleTaskStatus(task.id)}
                                  className="h-4 w-4 rounded text-purple-600"
                                />
                                <div>
                                  <span className={`text-xs font-medium block ${task.status === 'done' ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                                    {task.title}
                                  </span>
                                  <span className="text-[10px] text-slate-400">Hạn: {task.dueDate || 'Không thời hạn'}</span>
                                </div>
                              </div>
                              <button onClick={() => handleDeleteTask(task.id)} className="text-slate-300 hover:text-red-600 p-1">
                                <Trash2 size={13} />
                              </button>
                            </div>
                          ));
                        })()}
                      </div>
                    </div>
                  )}

                  {contactDetailTab === 'projects' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-500">Dự án cung ứng</span>
                        <button onClick={() => setShowAddProjectForm(!showAddProjectForm)} className="text-xs font-semibold text-[#0071E3] hover:underline">
                          + Tạo dự án
                        </button>
                      </div>

                      {showAddProjectForm && (
                        <form onSubmit={handleAddProject} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5">
                          <input 
                            type="text" 
                            required 
                            placeholder="Tên dự án..." 
                            value={projectForm.name}
                            onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none"
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <input 
                              type="text" 
                              placeholder="Mã dự án (Tùy chọn)" 
                              value={projectForm.code}
                              onChange={(e) => setProjectForm({ ...projectForm, code: e.target.value })}
                              className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs outline-none"
                            />
                            <button type="submit" className="bg-[#0071E3] text-white rounded-xl text-xs font-semibold">Lưu dự án</button>
                          </div>
                        </form>
                      )}

                      <div className="space-y-2">
                        {(() => {
                          const contactId = selectedContactDetail.ID || `${selectedContactDetail["Tên"]}-${selectedContactDetail["Công ty"]}`;
                          const contactProjects = projects[contactId] || [];
                          if (contactProjects.length === 0) return <div className="text-slate-400 text-xs py-8 text-center italic">Chưa có dự án nào.</div>;
                          return contactProjects.map(proj => (
                            <div key={proj.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                              <div>
                                <span className="text-xs font-bold text-slate-800 block">{proj.name}</span>
                                <span className="text-[10px] text-purple-600 font-mono font-semibold">Mã: {proj.code}</span>
                              </div>
                              <button onClick={() => handleDeleteProject(proj.id)} className="text-slate-300 hover:text-red-600 p-1">
                                <Trash2 size={13} />
                              </button>
                            </div>
                          ));
                        })()}
                      </div>
                    </div>
                  )}

                  {contactDetailTab === 'activities' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-500">Nhật ký trao đổi & Ghi chú</span>
                        <button onClick={() => setShowAddActivityForm(!showAddActivityForm)} className="text-xs font-semibold text-[#0071E3] hover:underline">
                          + Thêm ghi chú
                        </button>
                      </div>

                      {showAddActivityForm && (
                        <form onSubmit={handleAddActivity} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5">
                          <textarea 
                            required 
                            rows={3}
                            placeholder="Nội dung trao đổi..." 
                            value={activityForm.content}
                            onChange={(e) => setActivityForm({ ...activityForm, content: e.target.value })}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none"
                          />
                          <div className="flex justify-end">
                            <button type="submit" className="bg-[#0071E3] text-white px-3.5 py-1.5 rounded-xl text-xs font-semibold">Lưu</button>
                          </div>
                        </form>
                      )}

                      <div className="space-y-2">
                        {(() => {
                          const contactId = selectedContactDetail.ID || `${selectedContactDetail["Tên"]}-${selectedContactDetail["Công ty"]}`;
                          const contactActivities = activities[contactId] || [];
                          if (contactActivities.length === 0) return <div className="text-slate-400 text-xs py-8 text-center italic">Chưa có nhật ký trao đổi nào.</div>;
                          return contactActivities.map(act => (
                            <div key={act.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                              <div className="flex items-center justify-between text-[10px] text-slate-400">
                                <span>{act.timestamp} • {act.user}</span>
                                <button onClick={() => handleDeleteActivity(act.id)} className="text-slate-300 hover:text-red-600 p-0.5">
                                  <Trash2 size={11} />
                                </button>
                              </div>
                              <p className="text-xs text-slate-700">{act.content}</p>
                            </div>
                          ));
                        })()}
                      </div>
                    </div>
                  )}

                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
