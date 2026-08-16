import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, MapPin, Tag, Plus, Search, Edit2, Trash2, X, 
  Upload, LayoutGrid, List, Users, Briefcase, CheckCircle2, 
  Clock, AlertCircle, Phone, FileText, Factory, Globe, Copy, 
  ExternalLink, ChevronRight, Eye, Columns, Cloud, 
  DownloadCloud, FileSpreadsheet, PhoneCall, Send, Sparkles,
  Folder, CheckSquare, MessageCircle, Star, UserCheck, Check,
  CreditCard, Landmark, Mail, ArrowUpRight, ShieldCheck
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { db, storage } from '../firebase';
import { ensureGoogleToken, clearStoredGoogleToken, openGoogleAuthTab } from '../lib/auth';
import { collection, doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { handleFirestoreError, OperationType } from '../lib/errorHelper';
import { toast } from 'react-hot-toast';
import { cleanCompanyName, isNameRepetitive } from '../lib/companyUtils';
import CompanyLogo from './CompanyLogo';
import { getItemKey } from '../hooks/useFirestoreCollection';
import { getAvatarInitials, isExecutive } from './ContactView';
import { formatVietnamesePhone, formatContactFullName, getRawCallablePhone, formatShortCompanyName } from '../utils/formatters';
import GoogleDriveSyncModal from './GoogleDriveSyncModal';
import MacTrafficLights from './MacTrafficLights';
import clsx from 'clsx';

export const getCustomerLogo = (c: any) => {
  if (!c) return '';
  return c.logoUrl || c.LogoUrl || c.Logo || c.logo || c.Logo_URL || c.logo_url || '';
};

interface CustomerViewProps {
  initialData?: any[];
  contacts?: any[];
  targetCustomerId?: string | null;
  onClearTargetCustomer?: () => void;
  onNavigateToSupplier?: (supplierId: string) => void;
  onNavigateToContact?: (contactId: string) => void;
}

export default function CustomerView({ 
  initialData: customers = [], 
  contacts = [],
  targetCustomerId = null,
  onClearTargetCustomer,
  onNavigateToSupplier,
  onNavigateToContact
}: CustomerViewProps) {
  // Main Sub-Tab: 'companies' | 'contacts'
  const [activeSubTab, setActiveSubTab] = useState<'companies' | 'contacts'>('companies');
  
  // Search & Filter for Companies
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  // Search & Filter for Contacts
  const [contactSearchTerm, setContactSearchTerm] = useState('');
  const [contactRoleFilter, setContactRoleFilter] = useState('all');

  // Customer Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [selectedCustomerDetail, setSelectedCustomerDetail] = useState<any>(null);
  const [isCustomerModalMaximized, setIsCustomerModalMaximized] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isSyncingGoogle, setIsSyncingGoogle] = useState(false);
  const [isDriveModalOpen, setIsDriveModalOpen] = useState(false);

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

  // Handle Target Customer Deep Linking from other modules
  useEffect(() => {
    if (targetCustomerId) {
      const found = customers.find(c => 
        c["Customer_ID"]?.toLowerCase() === targetCustomerId.toLowerCase() ||
        c.id?.toLowerCase() === targetCustomerId.toLowerCase() ||
        c["Tên đầy đủ"]?.toLowerCase().includes(targetCustomerId.toLowerCase())
      );
      if (found) {
        setSelectedCustomerDetail(found);
        setActiveSubTab('companies');
      }
      if (onClearTargetCustomer) onClearTargetCustomer();
    }
  }, [targetCustomerId, customers, onClearTargetCustomer]);

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

  // Helper to resolve linked contacts for a customer
  const getLinkedContacts = (customer: any) => {
    if (!contacts || contacts.length === 0) return [];
    return contacts.filter(c => {
      const explicitIds = String(customer["Liên hệ liên kết"] || "").split(',').map((id: string) => id.trim());
      if (explicitIds.includes(c.id) || explicitIds.includes(c.ID)) return true;
      
      const compName = String(c["Công ty"] || "").toLowerCase().trim();
      const custName = String(customer["Tên đầy đủ"] || "").toLowerCase().trim();
      const custCode = String(customer["Customer_ID"] || "").toLowerCase().trim();
      
      return compName && (compName === custName || compName === custCode || (custName.length > 3 && custName.includes(compName)));
    });
  };

  // All Customer Contacts
  const customerContacts = useMemo(() => {
    return contacts.filter(c => {
      const compName = String(c["Công ty"] || "").toLowerCase();
      const isCust = customers.some(cust => 
        cust["Customer_ID"]?.toLowerCase() === compName || 
        cust["Tên đầy đủ"]?.toLowerCase().includes(compName)
      );
      if (isCust) return true;
      if (compName.includes('thăng long') || compName.includes('thanh hoá') || compName.includes('bắc sơn') || compName.includes('tân á đại thành')) return true;
      return false;
    });
  }, [contacts, customers]);

  // Filtered Customer Contacts
  const filteredCustomerContacts = useMemo(() => {
    return customerContacts.filter(c => {
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
  }, [customerContacts, contactSearchTerm, contactRoleFilter]);

  // Total tasks and projects across all contacts for a customer
  const getCustomerTasksAndProjects = (customer: any) => {
    const linked = getLinkedContacts(customer);
    let allTasks: any[] = [];
    let allProjects: any[] = [];

    linked.forEach(c => {
      const contactId = c.ID || `${c["Tên"]}-${c["Công ty"]}`;
      if (tasks[contactId]) allTasks = [...allTasks, ...tasks[contactId]];
      if (projects[contactId]) allProjects = [...allProjects, ...projects[contactId]];
    });

    return { allTasks, allProjects, totalTasks: allTasks.length, totalProjects: allProjects.length };
  };

  const handleSyncGoogle = async () => {
    setIsSyncingGoogle(true);
    const toastId = toast.loading("Đang đồng bộ tới Google Sheets & Drive...");
    try {
      let token = await ensureGoogleToken([
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive.file'
      ]);

      const savedSheetId = localStorage.getItem('google_spreadsheet_id') || '';

      let sheetsRes = await fetch('/api/sheets/sync', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          spreadsheetId: savedSheetId,
          customers: customers
        })
      });

      if (sheetsRes.status === 401) {
        clearStoredGoogleToken();
        token = await ensureGoogleToken([
          'https://www.googleapis.com/auth/spreadsheets',
          'https://www.googleapis.com/auth/drive.file'
        ], true);
        sheetsRes = await fetch('/api/sheets/sync', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            spreadsheetId: savedSheetId,
            customers: customers
          })
        });
      }

      const sheetsData = await sheetsRes.json();
      if (sheetsData.spreadsheetId) {
        localStorage.setItem('google_spreadsheet_id', sheetsData.spreadsheetId);
      }

      toast.success("Đã đồng bộ Google Sheets thành công!", { id: toastId });
    } catch (err: any) {
      toast.error(`Lỗi đồng bộ: ${err.message || err}`, { id: toastId });
    } finally {
      setIsSyncingGoogle(false);
    }
  };

  const [formData, setFormData] = useState({
    Customer_ID: '',
    "Tên đầy đủ": '',
    "Loại hình": 'Công ty Cổ phần',
    "Địa chỉ": '',
    "Nhà máy": '',
    "Mã số thuế": '',
    "Số điện thoại": '',
    "Email": '',
    "Website": '',
    "Phân loại": 'Bao bì Carton',
    "Tình trạng": 'Đang mua',
    "Hạn thanh toán": '30 ngày',
    "Hạn mức nợ": '500,000,000 đ',
    "Tài khoản ngân hàng": '',
    "Đại diện pháp luật": '',
    "Liên hệ liên kết": '',
    "Ghi chú": '',
    logoUrl: '',
    logoFit: 'contain'
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
    "Phụ trách": '',
    "Ghi chú": ''
  });

  const handleOpenModal = (customer: any = null) => {
    if (customer) {
      setEditingCustomer(customer);
      setFormData({
        Customer_ID: customer.Customer_ID || '',
        "Tên đầy đủ": customer["Tên đầy đủ"] || '',
        "Loại hình": customer["Loại hình"] || 'Công ty Cổ phần',
        "Địa chỉ": customer["Địa chỉ"] || '',
        "Nhà máy": customer["Nhà máy"] || '',
        "Mã số thuế": customer["Mã số thuế"] || '',
        "Số điện thoại": customer["Số điện thoại"] || '',
        "Email": customer["Email"] || '',
        "Website": customer["Website"] || '',
        "Phân loại": customer["Phân loại"] || 'Bao bì Carton',
        "Tình trạng": customer["Tình trạng"] || 'Đang mua',
        "Hạn thanh toán": customer["Hạn thanh toán"] || '30 ngày',
        "Hạn mức nợ": customer["Hạn mức nợ"] || '500,000,000 đ',
        "Tài khoản ngân hàng": customer["Tài khoản ngân hàng"] || '',
        "Đại diện pháp luật": customer["Đại diện pháp luật"] || '',
        "Liên hệ liên kết": customer["Liên hệ liên kết"] || '',
        "Ghi chú": customer["Ghi chú"] || '',
        logoUrl: getCustomerLogo(customer),
        logoFit: customer.logoFit || 'contain'
      });
      setLogoPreview(getCustomerLogo(customer));
    } else {
      setEditingCustomer(null);
      setFormData({
        Customer_ID: `CUST_${Date.now().toString().slice(-4)}`,
        "Tên đầy đủ": '',
        "Loại hình": 'Công ty Cổ phần',
        "Địa chỉ": '',
        "Nhà máy": '',
        "Mã số thuế": '',
        "Số điện thoại": '',
        "Email": '',
        "Website": '',
        "Phân loại": 'Bao bì Carton',
        "Tình trạng": 'Đang mua',
        "Hạn thanh toán": '30 ngày',
        "Hạn mức nợ": '500,000,000 đ',
        "Tài khoản ngân hàng": '',
        "Đại diện pháp luật": '',
        "Liên hệ liên kết": '',
        "Ghi chú": '',
        logoUrl: '',
        logoFit: 'contain'
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
        "Công ty": contact["Công ty"] || (customers[0]?.["Customer_ID"] || ''),
        "Điện thoại": contact["Điện thoại"] || '',
        "Email": contact["Email"] || '',
        "Mức độ quan hệ": contact["Mức độ quan hệ"] || '3',
        "Phụ trách": contact["Phụ trách"] || '',
        "Ghi chú": contact["Ghi chú"] || ''
      });
    } else {
      const matchCust = customers.find(c => 
        (defaultCompany && c["Customer_ID"]?.toLowerCase() === defaultCompany.toLowerCase()) || 
        (defaultCompany && c["Tên đầy đủ"]?.toLowerCase() === defaultCompany.toLowerCase()) ||
        (defaultCompany && c["Tên đầy đủ"]?.toLowerCase().includes(defaultCompany.toLowerCase()))
      );
      const resolvedCompany = matchCust ? matchCust["Customer_ID"] : (defaultCompany || customers[0]?.["Customer_ID"] || '');

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
        "Phụ trách": '',
        "Ghi chú": ''
      });
    }
    setIsContactModalOpen(true);
  };

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactFormData["Tên"] || !contactFormData["Công ty"]) {
      toast.error("Vui lòng nhập họ tên và chọn khách hàng liên kết.");
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
      toast.success(editingContact ? "Đã cập nhật nhân sự!" : "Đã thêm nhân sự vào danh bạ khách hàng!", { id: toastId });
      setIsContactModalOpen(false);
    } catch (error) {
      console.warn("Contact save error:", error);
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
      console.warn("Contact delete error:", error);
      toast.error("Không thể xóa nhân sự! Vui lòng thử lại.", { id: loadingToast });
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const loadingToast = toast.loading("Đang lưu khách hàng...");
    try {
      let finalLogoUrl = formData.logoUrl;

      if (logoFile) {
        try {
          const storageRef = ref(storage, `customer_logos/${formData.Customer_ID}_${Date.now()}`);
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

      const rawDocId = editingCustomer?.id || getItemKey(editingCustomer || payload, 'customers') || formData.Customer_ID;
      const docId = String(rawDocId).replace(/[/\\#?%[\]\s.]+/g, '_');

      await setDoc(doc(db, 'customers', docId), payload, { merge: true });

      toast.success(editingCustomer ? "Đã cập nhật hồ sơ khách hàng!" : "Đã thêm khách hàng mới!", { id: loadingToast });
      setIsModalOpen(false);
    } catch (error) {
      toast.error("Đã xảy ra lỗi khi lưu thông tin!", { id: loadingToast });
      handleFirestoreError(error, OperationType.WRITE, 'customers');
    }
  };

  const handleDelete = async (id: string, customerId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Bạn có chắc chắn muốn xóa khách hàng "${customerId}"?`)) return;
    const loadingToast = toast.loading("Đang xoá khách hàng...");
    try {
      const targetId = id || getItemKey({ Customer_ID: customerId }, 'customers') || customerId;
      const docId = String(targetId).replace(/[/\\#?%[\]\s.]+/g, '_');
      await setDoc(doc(db, 'customers', docId), { isDeleted: true }, { merge: true });

      toast.success("Đã xoá khách hàng thành công!", { id: loadingToast });
      if (selectedCustomerDetail?.id === docId || selectedCustomerDetail?.["Customer_ID"] === customerId) {
        setSelectedCustomerDetail(null);
      }
    } catch (error) {
      toast.error("Không thể xoá khách hàng!", { id: loadingToast });
      handleFirestoreError(error, OperationType.DELETE, `customers/${id || customerId}`);
    }
  };

  const copyToClipboard = (text: string, label: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(text);
    toast.success(`Đã sao chép ${label}: ${text}`);
  };

  // Task & Project handlers for contact inspector modal
  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskForm.title || !selectedContactDetail) return;
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
    if (!selectedContactDetail) return;
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
    if (!selectedContactDetail) return;
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
    if (!projectForm.name || !selectedContactDetail) return;
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
    if (!selectedContactDetail) return;
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
    if (!activityForm.content || !selectedContactDetail) return;
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
    if (!selectedContactDetail) return;
    const contactId = selectedContactDetail.ID || `${selectedContactDetail["Tên"]}-${selectedContactDetail["Công ty"]}`;
    const newActs = { ...activities };
    if (newActs[contactId]) {
      newActs[contactId] = newActs[contactId].filter(a => a.id !== actId);
      saveActivities(newActs);
    }
  };

  // KPIs
  const stats = useMemo(() => {
    const total = customers.length;
    const active = customers.filter(c => c["Tình trạng"] === "Đang mua").length;
    const negotiating = customers.filter(c => c["Tình trạng"] === "Đang đàm phán").length;
    const stopped = customers.filter(c => c["Tình trạng"] === "Ngừng mua").length;
    const totalContacts = customerContacts.length;

    return { total, active, negotiating, stopped, totalContacts };
  }, [customers, customerContacts]);

  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      const matchSearch = 
        c["Customer_ID"]?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c["Tên đầy đủ"]?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c["Địa chỉ"]?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c["Mã số thuế"]?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c["Số điện thoại"]?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c["Email"]?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c["Loại hình"]?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchStatus = statusFilter === 'all' || c["Tình trạng"] === statusFilter;
      const matchCategory = categoryFilter === 'all' || c["Phân loại"] === categoryFilter;
      
      return matchSearch && matchStatus && matchCategory;
    });
  }, [customers, searchTerm, statusFilter, categoryFilter]);

  const handleExportToExcel = () => {
    try {
      if (activeSubTab === 'companies') {
        const exportData = filteredCustomers.map(c => {
          const { totalProjects, totalTasks } = getCustomerTasksAndProjects(c);
          return {
            "Mã KH": c["Customer_ID"] || "",
            "Tên doanh nghiệp": cleanCompanyName(c["Tên đầy đủ"] || ""),
            "Tên pháp lý": c["Tên đầy đủ"] || "",
            "Loại hình doanh nghiệp": c["Loại hình"] || "Công ty Cổ phần",
            "Phân loại": c["Phân loại"] || "",
            "Tình trạng": c["Tình trạng"] || "Đang mua",
            "Mã số thuế": c["Mã số thuế"] || "",
            "Số điện thoại": c["Số điện thoại"] || "",
            "Email": c["Email"] || "",
            "Địa chỉ trụ sở": c["Địa chỉ"] || "",
            "Địa chỉ nhà máy": c["Nhà máy"] || "",
            "Hạn thanh toán": c["Hạn thanh toán"] || "30 ngày",
            "Hạn mức nợ": c["Hạn mức nợ"] || "",
            "Tài khoản ngân hàng": c["Tài khoản ngân hàng"] || "",
            "Đại diện pháp luật": c["Đại diện pháp luật"] || "",
            "Website": c["Website"] || "",
            "Số nhân sự liên hệ": getLinkedContacts(c).length,
            "Dự án liên kết": totalProjects,
            "Công việc đang theo dõi": totalTasks,
            "Ghi chú": c["Ghi chú"] || ""
          };
        });

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Khach_Hang_TSG");
        XLSX.writeFile(wb, `Danh_Sach_Khach_Hang_${new Date().toISOString().slice(0, 10)}.xlsx`);
        toast.success("Đã xuất file Excel thành công!");
      } else {
        const exportData = filteredCustomerContacts.map(c => {
          const contactId = c.ID || `${c["Tên"]}-${c["Công ty"]}`;
          const contactTasks = tasks[contactId] || [];
          const contactProjects = projects[contactId] || [];
          return {
            "Danh xưng": c["Danh xưng"] || "",
            "Họ và Tên": c["Tên"] || "",
            "Chức vụ": c["Chức vụ"] || "",
            "Phòng ban": c["Phòng ban"] || "",
            "Doanh nghiệp khách hàng": c["Công ty"] || "",
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
        XLSX.utils.book_append_sheet(wb, ws, "Danh_Ba_Khach_Hang");
        XLSX.writeFile(wb, `Danh_Ba_Nhan_Su_Khach_Hang_${new Date().toISOString().slice(0, 10)}.xlsx`);
        toast.success("Đã xuất danh bạ nhân sự khách hàng ra Excel!");
      }
    } catch (err: any) {
      toast.error("Lỗi xuất Excel: " + (err?.message || err));
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
                Khách Hàng
              </h1>
              
              {/* Integrated Apple Sub-Segmented Control: Companies vs Contacts */}
              <div className="flex bg-slate-100 p-0.5 rounded-xl text-xs font-semibold">
                <button
                  onClick={() => setActiveSubTab('companies')}
                  className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 ${
                    activeSubTab === 'companies'
                      ? 'bg-white text-[#0071E3] shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Building2 size={13} />
                  <span>Hồ sơ Doanh nghiệp ({customers.length})</span>
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
                  <span>Danh bạ Người liên hệ ({customerContacts.length})</span>
                </button>
              </div>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              {activeSubTab === 'companies' 
                ? 'Quản lý hồ sơ pháp lý, loại hình, hạn mức công nợ, ngân hàng và dự án khách hàng.'
                : 'Tra cứu danh bạ đầu mối liên hệ trực tiếp của các khách hàng, kèm theo dõi công việc và dự án.'}
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={handleExportToExcel}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-xs"
              title="Xuất file Excel"
            >
              <FileSpreadsheet size={15} className="text-emerald-600" />
              <span>Xuất Excel</span>
            </button>

            <button
              onClick={() => setIsDriveModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium text-blue-800 bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-all shadow-xs"
              title="Kho Dữ Liệu Đồng Bộ Google Drive 2 Chiều"
            >
              <Cloud size={15} className="text-blue-600" />
              <span>Kho Google Drive</span>
            </button>

            {activeSubTab === 'companies' ? (
              <button 
                onClick={() => handleOpenModal()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#0071E3] hover:bg-[#0066D6] transition-all shadow-xs"
              >
                <Plus size={16} />
                <span>Thêm khách hàng</span>
              </button>
            ) : (
              <button 
                onClick={() => handleOpenContactModal()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#0071E3] hover:bg-[#0066D6] transition-all shadow-xs"
              >
                <Plus size={16} />
                <span>Thêm nhân sự</span>
              </button>
            )}
          </div>
        </div>

        {/* SUB-VIEW 1: COMPANY PROFILES */}
        {activeSubTab === 'companies' ? (
          <>
            {/* Apple Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-medium text-slate-400 block">Đang mua hàng</span>
                  <span className="text-lg font-bold text-emerald-600 mt-0.5 block">{stats.active}</span>
                </div>
                <div className="h-8 w-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">
                  ✓
                </div>
              </div>

              <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-medium text-slate-400 block">Đang đàm phán</span>
                  <span className="text-lg font-bold text-amber-600 mt-0.5 block">{stats.negotiating}</span>
                </div>
                <div className="h-8 w-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold">
                  ⏳
                </div>
              </div>

              <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-medium text-slate-400 block">Tạm dừng</span>
                  <span className="text-lg font-bold text-slate-600 mt-0.5 block">{stats.stopped}</span>
                </div>
                <div className="h-8 w-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold">
                  —
                </div>
              </div>

              <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-medium text-slate-400 block">Nhân sự liên kết</span>
                  <span className="text-lg font-bold text-blue-600 mt-0.5 block">{stats.totalContacts}</span>
                </div>
                <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
                  👥
                </div>
              </div>
            </div>

            {/* Search & Apple Segmented Control Toolbar */}
            <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
              
              {/* Search Field */}
              <div className="relative w-full md:w-96">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  placeholder="Tìm theo mã, tên, địa chỉ, MST, email, loại hình..."
                  className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3] text-xs sm:text-sm transition-all placeholder:text-slate-400"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <button 
                    onClick={() => setSearchTerm('')} 
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-between md:justify-end">
                
                {/* Apple Segmented Pill Filter */}
                <div className="flex bg-slate-100 p-1 rounded-xl gap-0.5 overflow-x-auto max-w-full">
                  {[
                    { key: 'all', label: `Tất cả (${stats.total})` },
                    { key: 'Đang mua', label: `Đang mua (${stats.active})` },
                    { key: 'Đang đàm phán', label: `Đàm phán (${stats.negotiating})` },
                    { key: 'Ngừng mua', label: `Tạm dừng (${stats.stopped})` },
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

                {/* View Mode Toggle */}
                <div className="flex bg-slate-100 p-1 rounded-xl gap-0.5 shrink-0">
                  <button 
                    onClick={() => setViewMode('table')}
                    className={`p-1.5 rounded-lg text-xs transition-all ${viewMode === 'table' ? 'bg-white text-[#0071E3] shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                    title="Dạng Bảng"
                  >
                    <List size={16} />
                  </button>
                  <button 
                    onClick={() => setViewMode('grid')}
                    className={`p-1.5 rounded-lg text-xs transition-all ${viewMode === 'grid' ? 'bg-white text-[#0071E3] shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                    title="Dạng Thẻ"
                  >
                    <LayoutGrid size={16} />
                  </button>
                </div>

              </div>
            </div>

            {/* Companies List / Grid */}
            {filteredCustomers.length > 0 ? (
              viewMode === 'table' ? (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs sm:text-sm text-left border-collapse">
                      <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200 text-xs">
                        <tr>
                          <th className="px-5 py-3.5">Mã & Doanh nghiệp</th>
                          <th className="px-5 py-3.5">Loại hình & Phân loại</th>
                          <th className="px-5 py-3.5">Mã số thuế & Email</th>
                          <th className="px-5 py-3.5">Địa chỉ & Nhà máy</th>
                          <th className="px-5 py-3.5">Công nợ & Hạn trả</th>
                          <th className="px-5 py-3.5">Trạng thái</th>
                          <th className="px-5 py-3.5">Nhân sự</th>
                          <th className="px-5 py-3.5 text-right">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredCustomers.map((customer, idx) => {
                          const cleanName = cleanCompanyName(customer["Tên đầy đủ"] || "");
                          const cardStatus = customer["Tình trạng"] || "Đang mua";
                          const linkedContacts = getLinkedContacts(customer);
                          const { totalProjects, totalTasks } = getCustomerTasksAndProjects(customer);
                          const customerKey = customer.id || customer.Customer_ID || `cust-row-${idx}`;

                          return (
                            <tr 
                              key={customerKey}
                              onClick={() => setSelectedCustomerDetail(customer)}
                              className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                            >
                              {/* Company Name & Logo */}
                              <td className="px-5 py-3">
                                <div className="flex items-center gap-3">
                                  <CompanyLogo 
                                    name={customer["Tên đầy đủ"] || cleanName} 
                                    size="sm" 
                                    className="shrink-0 rounded-lg shadow-2xs" 
                                    logoUrl={getCustomerLogo(customer)} 
                                    logoFit={customer.logoFit} 
                                  />
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[10px] font-mono font-semibold text-slate-400 uppercase">
                                        {customer["Customer_ID"]}
                                      </span>
                                    </div>
                                    <div className="font-semibold text-slate-900 group-hover:text-[#0071E3] transition-colors truncate mt-0.5">
                                      {cleanName}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* Business Type & Category */}
                              <td className="px-5 py-3">
                                <div className="space-y-0.5">
                                  <span className="inline-block text-[11px] font-medium text-slate-700">
                                    {customer["Loại hình"] || "Công ty Cổ phần"}
                                  </span>
                                  {customer["Phân loại"] && (
                                    <span className="block text-[10px] text-slate-400 font-medium truncate max-w-[150px]">
                                      {customer["Phân loại"]}
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Tax Code & Email */}
                              <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                                <div className="space-y-0.5 text-xs">
                                  {customer["Mã số thuế"] ? (
                                    <button 
                                      onClick={(e) => copyToClipboard(customer["Mã số thuế"], "Mã số thuế", e)}
                                      className="font-mono text-slate-700 hover:text-blue-600 font-medium block"
                                      title="Sao chép MST"
                                    >
                                      {customer["Mã số thuế"]}
                                    </button>
                                  ) : <span className="text-slate-300">—</span>}
                                  {customer["Email"] && (
                                    <a 
                                      href={`mailto:${customer["Email"]}`} 
                                      className="text-[11px] text-blue-600 hover:underline truncate block max-w-[160px]"
                                    >
                                      {customer["Email"]}
                                    </a>
                                  )}
                                </div>
                              </td>

                              {/* Address */}
                              <td className="px-5 py-3 text-slate-600 max-w-xs">
                                <span className="line-clamp-1 text-xs" title={customer["Địa chỉ"]}>
                                  {customer["Địa chỉ"] || "—"}
                                </span>
                                {customer["Nhà máy"] && (
                                  <span className="line-clamp-1 text-[10px] text-slate-400 mt-0.5" title={customer["Nhà máy"]}>
                                    NM: {customer["Nhà máy"]}
                                  </span>
                                )}
                              </td>

                              {/* Credit & Terms */}
                              <td className="px-5 py-3">
                                <div className="text-xs">
                                  <span className="font-medium text-slate-800 block">
                                    {customer["Hạn thanh toán"] || "30 ngày"}
                                  </span>
                                  {customer["Hạn mức nợ"] && (
                                    <span className="text-[10px] text-slate-400 block font-mono">
                                      HM: {customer["Hạn mức nợ"]}
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Status */}
                              <td className="px-5 py-3">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium ${
                                  cardStatus === "Đang mua" 
                                    ? "bg-emerald-50 text-emerald-700" 
                                    : cardStatus === "Đang đàm phán" 
                                    ? "bg-amber-50 text-amber-700" 
                                    : "bg-slate-100 text-slate-600"
                                }`}>
                                  <span className={`h-1.5 w-1.5 rounded-full ${
                                    cardStatus === "Đang mua" ? "bg-emerald-500" : cardStatus === "Đang đàm phán" ? "bg-amber-500" : "bg-slate-400"
                                  }`} />
                                  {cardStatus}
                                </span>
                              </td>

                              {/* Contacts & Projects Metrics */}
                              <td className="px-5 py-3">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {linkedContacts.length > 0 ? (
                                    <span className="text-xs text-slate-700 font-semibold">
                                      {linkedContacts.length} nhân sự
                                    </span>
                                  ) : (
                                    <span className="text-xs text-slate-300">—</span>
                                  )}

                                  {totalProjects > 0 && (
                                    <span className="text-[10px] bg-purple-50 text-purple-700 font-medium px-1.5 py-0.2 rounded border border-purple-100">
                                      {totalProjects} dự án
                                    </span>
                                  )}
                                  {totalTasks > 0 && (
                                    <span className="text-[10px] bg-blue-50 text-blue-700 font-medium px-1.5 py-0.2 rounded border border-blue-100">
                                      {totalTasks} việc
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Actions */}
                              <td className="px-5 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                                  <button 
                                    onClick={() => setSelectedCustomerDetail(customer)}
                                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                    title="Xem hồ sơ & nhân sự"
                                  >
                                    <Eye size={15} />
                                  </button>
                                  <button 
                                    onClick={() => handleOpenModal(customer)}
                                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                    title="Chỉnh sửa"
                                  >
                                    <Edit2 size={15} />
                                  </button>
                                  <button 
                                    onClick={(e) => handleDelete(customer.id, customer.Customer_ID, e)}
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
                  {filteredCustomers.map((customer, idx) => {
                    const cleanName = cleanCompanyName(customer["Tên đầy đủ"] || "");
                    const cardStatus = customer["Tình trạng"] || "Đang mua";
                    const linkedContacts = getLinkedContacts(customer);
                    const { totalProjects, totalTasks } = getCustomerTasksAndProjects(customer);
                    const customerKey = customer.id || customer.Customer_ID || `cust-card-${idx}`;

                    return (
                      <div 
                        key={customerKey}
                        onClick={() => setSelectedCustomerDetail(customer)}
                        className="bg-white rounded-2xl border border-slate-200 p-4 hover:border-slate-300 hover:shadow-xs transition-all cursor-pointer flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 min-w-0">
                              <CompanyLogo 
                                name={customer["Tên đầy đủ"] || cleanName} 
                                size="md" 
                                className="shrink-0 rounded-xl shadow-2xs mt-0.5" 
                                logoUrl={getCustomerLogo(customer)} 
                                logoFit={customer.logoFit} 
                              />
                              <div className="min-w-0">
                                <span className="text-[10px] font-mono font-semibold text-slate-400 uppercase block">
                                  {customer["Customer_ID"]}
                                </span>
                                <h3 className="font-semibold text-slate-900 text-sm truncate mt-0.5" title={cleanName}>
                                  {cleanName}
                                </h3>
                                <div className="flex items-center gap-1.5 mt-1">
                                  <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-medium">
                                    {customer["Loại hình"] || "Công ty Cổ phần"}
                                  </span>
                                  {customer["Phân loại"] && (
                                    <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.2 rounded font-medium">
                                      {customer["Phân loại"]}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0 ${
                              cardStatus === "Đang mua" 
                                ? "bg-emerald-50 text-emerald-700" 
                                : cardStatus === "Đang đàm phán" 
                                ? "bg-amber-50 text-amber-700" 
                                : "bg-slate-100 text-slate-600"
                            }`}>
                              {cardStatus}
                            </span>
                          </div>

                          <div className="mt-3.5 pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
                            {customer["Mã số thuế"] && (
                              <div className="flex items-center gap-2 font-mono text-slate-600">
                                <FileText size={13} className="text-slate-400 shrink-0" />
                                <span>MST: {customer["Mã số thuế"]}</span>
                              </div>
                            )}
                            {customer["Email"] && (
                              <div className="flex items-center gap-2 text-blue-600">
                                <Mail size={13} className="text-slate-400 shrink-0" />
                                <span className="truncate">{customer["Email"]}</span>
                              </div>
                            )}
                            {customer["Địa chỉ"] && (
                              <div className="flex items-start gap-2">
                                <MapPin size={13} className="text-slate-400 shrink-0 mt-0.5" />
                                <span className="line-clamp-1 text-slate-700" title={customer["Địa chỉ"]}>
                                  {customer["Địa chỉ"]}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Personnel & Project Badges */}
                          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center gap-2 flex-wrap">
                            {totalProjects > 0 && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-purple-50 text-purple-700 px-2 py-0.5 rounded-md">
                                <Folder size={10} /> {totalProjects} dự án
                              </span>
                            )}
                            {totalTasks > 0 && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md">
                                <CheckSquare size={10} /> {totalTasks} việc
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs" onClick={(e) => e.stopPropagation()}>
                          <div className="text-slate-500">
                            {linkedContacts.length > 0 ? (
                              <span className="font-semibold text-blue-600">{linkedContacts.length} người liên hệ</span>
                            ) : (
                              <span className="text-slate-400 italic">Chưa có liên hệ</span>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            <button 
                              onClick={() => handleOpenModal(customer)}
                              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition-colors"
                              title="Chỉnh sửa"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button 
                              onClick={(e) => handleDelete(customer.id, customer.Customer_ID, e)}
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
                <Building2 size={36} className="mx-auto text-slate-300" />
                <div className="text-sm font-semibold text-slate-700">Không tìm thấy khách hàng</div>
                <p className="text-xs text-slate-400">Thử tìm kiếm với từ khóa khác.</p>
              </div>
            )}
          </>
        ) : (
          
          /* SUB-VIEW 2: INTEGRATED CUSTOMER CONTACT DIRECTORY */
          <div className="space-y-4">
            
            {/* Search & Filter for Customer Contacts */}
            <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
              <div className="relative w-full md:w-96">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  placeholder="Tìm theo tên nhân sự, công ty, chức vụ, SĐT..."
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
                    { key: 'all', label: `Tất cả (${customerContacts.length})` },
                    { key: 'exec', label: 'Ban Lãnh đạo' },
                    { key: 'starred', label: 'Đối tác chiến lược (4-5★)' },
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

            {/* Customer Contacts Table */}
            {filteredCustomerContacts.length > 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs sm:text-sm text-left border-collapse">
                    <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200 text-xs">
                      <tr>
                        <th className="px-5 py-3.5">Họ và Tên</th>
                        <th className="px-5 py-3.5">Doanh nghiệp khách hàng</th>
                        <th className="px-5 py-3.5">Chức vụ / Phòng ban</th>
                        <th className="px-5 py-3.5">Kênh liên lạc</th>
                        <th className="px-5 py-3.5">Dự án & Công việc</th>
                        <th className="px-5 py-3.5 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredCustomerContacts.map((contact) => {
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
                                  exec ? 'bg-amber-100 text-amber-800 ring-1 ring-amber-300' : 'bg-blue-100 text-blue-800'
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
                                    <a href={`tel:${cleanPhone}`} className="font-medium text-slate-700 hover:text-blue-600 transition-colors">
                                      {formattedPhone}
                                    </a>
                                    {cleanPhone && (
                                      <a 
                                        href={`https://zalo.me/${cleanPhone}`} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="px-1 text-[9px] bg-blue-100 text-blue-700 hover:bg-blue-200 rounded font-sans font-semibold"
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
                <div className="text-sm font-semibold text-slate-700">Chưa có liên hệ khách hàng nào phù hợp</div>
                <p className="text-xs text-slate-400">Bấm "+ Thêm nhân sự" để kết nối đầu mối mới.</p>
              </div>
            )}

          </div>
        )}

      </div>

      {/* Customer Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl border border-black/[0.06] w-full max-w-2xl flex flex-col max-h-[92vh] overflow-hidden">
            <div className="px-5 py-3.5 border-b border-black/[0.06] flex items-center justify-between bg-[#F5F5F7]">
              <div className="flex items-center gap-3.5">
                <MacTrafficLights onClose={() => setIsModalOpen(false)} />
                <div className="h-4 w-px bg-black/[0.08]" />
                <h3 className="text-xs font-bold text-[#1D1D1F]">
                  {editingCustomer ? 'Chỉnh sửa hồ sơ khách hàng' : 'Thêm khách hàng mới'}
                </h3>
              </div>
            </div>

            <form onSubmit={handleSave} className="p-6 overflow-y-auto flex-1 space-y-4 text-xs sm:text-sm">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Mã khách hàng *</label>
                  <input
                    type="text"
                    required
                    value={formData.Customer_ID}
                    onChange={(e) => setFormData({ ...formData, Customer_ID: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm outline-none font-mono uppercase"
                    placeholder="VD: CUST-TL"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Loại hình doanh nghiệp</label>
                  <select
                    value={formData["Loại hình"]}
                    onChange={(e) => setFormData({ ...formData, "Loại hình": e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm outline-none"
                  >
                    <option value="Công ty Cổ phần">Công ty Cổ phần</option>
                    <option value="Công ty TNHH">Công ty TNHH</option>
                    <option value="Doanh nghiệp FDI">Doanh nghiệp FDI</option>
                    <option value="Tập đoàn">Tập đoàn</option>
                    <option value="Hộ kinh doanh">Hộ kinh doanh</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Phân loại hàng hóa</label>
                  <input
                    type="text"
                    value={formData["Phân loại"]}
                    onChange={(e) => setFormData({ ...formData, "Phân loại": e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm outline-none"
                    placeholder="VD: Carton 5 lớp / Decal"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Tên pháp lý đầy đủ *</label>
                <input
                  type="text"
                  required
                  value={formData["Tên đầy đủ"]}
                  onChange={(e) => setFormData({ ...formData, "Tên đầy đủ": e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm outline-none"
                  placeholder="Công ty Cổ phần Bao bì..."
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
                  <label className="text-xs font-medium text-slate-600 block mb-1">Người đại diện pháp luật</label>
                  <input
                    type="text"
                    value={formData["Đại diện pháp luật"]}
                    onChange={(e) => setFormData({ ...formData, "Đại diện pháp luật": e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm outline-none"
                    placeholder="Ông Nguyễn Văn A - Tổng Giám đốc"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Email giao dịch / Kế toán</label>
                  <input
                    type="email"
                    value={formData["Email"]}
                    onChange={(e) => setFormData({ ...formData, "Email": e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm outline-none"
                    placeholder="ketoan@company.com"
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
                <label className="text-xs font-medium text-slate-600 block mb-1">Địa chỉ trụ sở pháp lý</label>
                <input
                  type="text"
                  value={formData["Địa chỉ"]}
                  onChange={(e) => setFormData({ ...formData, "Địa chỉ": e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm outline-none"
                  placeholder="Số nhà, đường, quận/huyện, tỉnh thành"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Địa chỉ nhà máy (Giao hàng)</label>
                <input
                  type="text"
                  value={formData["Nhà máy"]}
                  onChange={(e) => setFormData({ ...formData, "Nhà máy": e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm outline-none"
                  placeholder="Khu công nghiệp..."
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Hạn thanh toán</label>
                  <select
                    value={formData["Hạn thanh toán"]}
                    onChange={(e) => setFormData({ ...formData, "Hạn thanh toán": e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm outline-none"
                  >
                    <option value="Thanh toán ngay">Thanh toán ngay</option>
                    <option value="15 ngày">15 ngày</option>
                    <option value="30 ngày">30 ngày</option>
                    <option value="45 ngày">45 ngày</option>
                    <option value="60 ngày">60 ngày</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Hạn mức công nợ</label>
                  <input
                    type="text"
                    value={formData["Hạn mức nợ"]}
                    onChange={(e) => setFormData({ ...formData, "Hạn mức nợ": e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm outline-none font-mono"
                    placeholder="VD: 500,000,000 đ"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Trạng thái</label>
                  <select
                    value={formData["Tình trạng"]}
                    onChange={(e) => setFormData({ ...formData, "Tình trạng": e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm outline-none"
                  >
                    <option value="Đang mua">Đang mua</option>
                    <option value="Đang đàm phán">Đang đàm phán</option>
                    <option value="Ngừng mua">Ngừng mua</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Tài khoản ngân hàng thanh toán</label>
                <input
                  type="text"
                  value={formData["Tài khoản ngân hàng"]}
                  onChange={(e) => setFormData({ ...formData, "Tài khoản ngân hàng": e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm outline-none"
                  placeholder="STK: 123456789 - Vietcombank - CN Thăng Long"
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
                  {editingCustomer ? 'Lưu' : 'Thêm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Contact Add/Edit Modal */}
      {isContactModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl border border-black/[0.06] w-full max-w-lg flex flex-col max-h-[90vh] overflow-hidden">
            <div className="px-5 py-3.5 border-b border-black/[0.06] flex items-center justify-between bg-[#F5F5F7]">
              <div className="flex items-center gap-3.5">
                <MacTrafficLights onClose={() => setIsContactModalOpen(false)} />
                <div className="h-4 w-px bg-black/[0.08]" />
                <h3 className="text-xs font-bold text-[#1D1D1F]">
                  {editingContact ? 'Chỉnh sửa nhân sự khách hàng' : 'Thêm nhân sự vào danh bạ'}
                </h3>
              </div>
            </div>

            <form onSubmit={handleSaveContact} className="p-5 overflow-y-auto flex-1 space-y-4 text-xs sm:text-sm">
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Khách hàng liên kết</label>
                <select
                  value={contactFormData["Công ty"]}
                  onChange={(e) => setContactFormData({ ...contactFormData, "Công ty": e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm outline-none"
                >
                  {customers.map((c) => (
                    <option key={c["Customer_ID"]} value={c["Customer_ID"]}>
                      {c["Tên đầy đủ"]} ({c["Customer_ID"]})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Danh xưng</label>
                  <select
                    value={contactFormData["Danh xưng"]}
                    onChange={(e) => setContactFormData({ ...contactFormData, "Danh xưng": e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm outline-none"
                  >
                    <option value="Mr">Mr</option>
                    <option value="Ms">Ms</option>
                    <option value="Mrs">Mrs</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-slate-600 block mb-1">Họ và tên *</label>
                  <input
                    type="text"
                    required
                    value={contactFormData["Tên"]}
                    onChange={(e) => setContactFormData({ ...contactFormData, "Tên": e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm outline-none"
                    placeholder="VD: Nguyễn Văn A"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Chức vụ</label>
                  <input
                    type="text"
                    value={contactFormData["Chức vụ"]}
                    onChange={(e) => setContactFormData({ ...contactFormData, "Chức vụ": e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm outline-none"
                    placeholder="VD: Trưởng phòng Mua hàng"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Phòng ban</label>
                  <input
                    type="text"
                    value={contactFormData["Phòng ban"]}
                    onChange={(e) => setContactFormData({ ...contactFormData, "Phòng ban": e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm outline-none"
                    placeholder="VD: Mua hàng / Kế toán"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Số điện thoại</label>
                <input
                  type="text"
                  value={contactFormData["Điện thoại"]}
                  onChange={(e) => setContactFormData({ ...contactFormData, "Điện thoại": e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm outline-none font-mono"
                  placeholder="VD: 0987.654.321"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Ghi chú & Quan hệ</label>
                <textarea
                  rows={2}
                  value={contactFormData["Ghi chú"]}
                  onChange={(e) => setContactFormData({ ...contactFormData, "Ghi chú": e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm outline-none resize-none"
                  placeholder="VD: Liên hệ chính khi đặt hàng, thích tặng quà sinh nhật..."
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsContactModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-xs sm:text-sm font-medium"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#007AFF] hover:bg-[#0062CC] text-white rounded-xl text-xs sm:text-sm font-semibold shadow-xs"
                >
                  Lưu nhân sự
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer Detail Drawer / Modal */}
      {selectedCustomerDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
          <div className={clsx(
            "bg-white rounded-3xl shadow-2xl border border-black/[0.06] w-full flex flex-col overflow-hidden transition-all duration-200",
            isCustomerModalMaximized ? "max-w-6xl h-[94vh]" : "max-w-3xl max-h-[88vh]"
          )}>
            
            {/* Modal Header with Mac Traffic Lights */}
            <div className="px-6 py-3.5 border-b border-black/[0.06] flex justify-between items-center bg-[#F5F5F7]">
              <div className="flex items-center gap-4">
                <MacTrafficLights 
                  onClose={() => setSelectedCustomerDetail(null)} 
                  onMaximize={() => setIsCustomerModalMaximized(!isCustomerModalMaximized)}
                  isMaximized={isCustomerModalMaximized}
                />
                <div className="h-4 w-px bg-black/[0.08]" />
                <div className="flex items-center gap-3">
                  <CompanyLogo 
                    name={selectedCustomerDetail["Tên đầy đủ"] || selectedCustomerDetail["Customer_ID"]} 
                    size="md" 
                    className="rounded-xl shadow-2xs" 
                    logoUrl={getCustomerLogo(selectedCustomerDetail)} 
                    logoFit={selectedCustomerDetail.logoFit} 
                  />
                  <div>
                    <h3 className="text-sm font-bold text-[#1D1D1F]">
                      {cleanCompanyName(selectedCustomerDetail["Tên đầy đủ"] || selectedCustomerDetail["Customer_ID"])}
                    </h3>
                    <p className="text-[11px] text-slate-500 font-medium">
                      {selectedCustomerDetail["Customer_ID"]} • {selectedCustomerDetail["Loại hình"] || "Công ty Cổ phần"} • {selectedCustomerDetail["Phân loại"] || "Bao bì"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs sm:text-sm">
              
              {/* Legal & Factory Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-100">
                  <span className="text-[11px] text-slate-400 font-medium block">Tên pháp lý doanh nghiệp</span>
                  <div className="font-semibold text-slate-800 mt-1">
                    {selectedCustomerDetail["Tên đầy đủ"] || "—"}
                  </div>
                </div>
                <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-400 font-medium">Mã số thuế</span>
                    {selectedCustomerDetail["Mã số thuế"] && (
                      <button 
                        onClick={(e) => copyToClipboard(selectedCustomerDetail["Mã số thuế"], "Mã số thuế", e)}
                        className="text-[11px] text-blue-600 hover:underline"
                      >
                        Sao chép
                      </button>
                    )}
                  </div>
                  <div className="font-mono font-bold text-slate-800 mt-1">
                    {selectedCustomerDetail["Mã số thuế"] || "Chưa cập nhật"}
                  </div>
                </div>
              </div>

              {/* Financial & Terms */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-100">
                  <span className="text-[11px] text-slate-400 font-medium block">Hạn thanh toán</span>
                  <div className="font-semibold text-slate-800 mt-1">
                    {selectedCustomerDetail["Hạn thanh toán"] || "30 ngày"}
                  </div>
                </div>
                <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-100">
                  <span className="text-[11px] text-slate-400 font-medium block">Hạn mức công nợ</span>
                  <div className="font-mono font-semibold text-slate-800 mt-1">
                    {selectedCustomerDetail["Hạn mức nợ"] || "500,000,000 đ"}
                  </div>
                </div>
                <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-100">
                  <span className="text-[11px] text-slate-400 font-medium block">Nhà máy / Kho nhận</span>
                  <div className="text-slate-700 font-medium mt-0.5">
                    {selectedCustomerDetail["Nhà máy"] || "Chưa cập nhật"}
                  </div>
                </div>
                {selectedCustomerDetail["Tài khoản ngân hàng"] && (
                  <div className="pt-2.5 border-t border-slate-200/60">
                    <span className="text-[11px] text-slate-400 font-medium block">Tài khoản ngân hàng thanh toán</span>
                    <div className="text-slate-700 font-medium mt-0.5 font-mono">
                      {selectedCustomerDetail["Tài khoản ngân hàng"]}
                    </div>
                  </div>
                )}
              </div>

              {/* Linked Contacts Dossier with Tasks and Projects */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-bold text-slate-800 text-sm">
                    Mạng lưới nhân sự liên kết ({getLinkedContacts(selectedCustomerDetail).length})
                  </span>
                  <button
                    onClick={() => handleOpenContactModal(null, selectedCustomerDetail["Customer_ID"])}
                    className="text-xs font-semibold text-[#0071E3] hover:underline"
                  >
                    + Thêm nhân sự cho khách này
                  </button>
                </div>

                <div className="space-y-2.5">
                  {getLinkedContacts(selectedCustomerDetail).length === 0 ? (
                    <div className="text-slate-400 text-xs py-5 text-center bg-slate-50 rounded-2xl border border-slate-100 italic">
                      Chưa có nhân sự liên kết nào trong danh bạ gắn với khách hàng này.
                    </div>
                  ) : (
                    getLinkedContacts(selectedCustomerDetail).map((c: any, cidx: number) => {
                      const contactId = c.ID || `${c["Tên"]}-${c["Công ty"]}`;
                      const contactTasks = tasks[contactId] || [];
                      const contactProjects = projects[contactId] || [];
                      const cleanPhone = getRawCallablePhone(c["Điện thoại"]);
                      const formattedPhone = formatVietnamesePhone(c["Điện thoại"]);
                      const cleanName = formatContactFullName(c["Tên"] || "");

                      return (
                        <div key={cidx} className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-100 space-y-2.5">
                          <div className="flex items-center justify-between">
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
                                <a 
                                  href={`tel:${cleanPhone}`} 
                                  className="px-2.5 py-1 text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-100 rounded-xl text-slate-700 transition-colors"
                                >
                                  Gọi: {formattedPhone}
                                </a>
                              )}
                              {cleanPhone && (
                                <a 
                                  href={`https://zalo.me/${cleanPhone}`} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="px-2.5 py-1 text-xs font-semibold bg-blue-50 hover:bg-blue-100 rounded-xl text-blue-700 transition-colors"
                                >
                                  Zalo
                                </a>
                              )}
                            </div>
                          </div>

                          {/* Projects & Tasks for this Contact */}
                          {(contactProjects.length > 0 || contactTasks.length > 0) && (
                            <div className="pt-2 border-t border-slate-200/60 flex items-center gap-2 flex-wrap">
                              {contactProjects.map(p => (
                                <span key={p.id} className="inline-flex items-center gap-1 text-[11px] font-medium bg-purple-50 text-purple-700 px-2 py-0.5 rounded-lg border border-purple-100">
                                  <Folder size={11} /> {p.name} ({p.code})
                                </span>
                              ))}
                              {contactTasks.map(t => (
                                <span key={t.id} className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-lg border ${
                                  t.status === 'done' ? 'bg-emerald-50 text-emerald-700 border-emerald-100 line-through opacity-70' : 'bg-blue-50 text-blue-700 border-blue-100'
                                }`}>
                                  <CheckSquare size={11} /> {t.title}
                                </span>
                              ))}
                            </div>
                          )}
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

      {/* Contact Detail Inspector Modal */}
      {selectedContactDetail && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-black/[0.06] w-full max-w-4xl h-[88vh] flex flex-col overflow-hidden">
            <div className="px-6 py-3.5 border-b border-black/[0.06] flex items-center justify-between bg-[#F5F5F7]">
              <div className="flex items-center gap-4">
                <MacTrafficLights onClose={() => setSelectedContactDetail(null)} />
                <div className="h-4 w-px bg-black/[0.08]" />
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-blue-100 text-blue-800 font-bold flex items-center justify-center text-xs shadow-2xs">
                    {getAvatarInitials(selectedContactDetail["Tên"] || "")}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#1D1D1F]">
                      {selectedContactDetail["Danh xưng"] ? `${selectedContactDetail["Danh xưng"]} ` : ''}{selectedContactDetail["Tên"]}
                    </h3>
                    <p className="text-[11px] text-slate-500 font-medium">
                      {selectedContactDetail["Chức vụ"] || "Chức vụ chưa rõ"} • {selectedContactDetail["Công ty"]}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
              <div className="w-full md:w-72 border-b md:border-b-0 md:border-r border-slate-100 p-5 overflow-y-auto space-y-4 bg-slate-50/50">
                <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 space-y-2.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Kênh kết nối</span>
                  
                  {selectedContactDetail["Điện thoại"] && (
                    <div className="flex items-center justify-between gap-2 p-2 bg-slate-50 rounded-xl text-xs font-mono">
                      <a href={`tel:${getRawCallablePhone(selectedContactDetail["Điện thoại"])}`} className="font-bold text-slate-800 hover:text-blue-600 truncate">
                        {formatVietnamesePhone(selectedContactDetail["Điện thoại"])}
                      </a>
                    </div>
                  )}

                  {selectedContactDetail["Email"] && (
                    <div className="flex items-center justify-between gap-2 p-2 bg-slate-50 rounded-xl text-xs">
                      <a href={`mailto:${selectedContactDetail["Email"]}`} className="text-blue-600 hover:underline truncate">
                        {selectedContactDetail["Email"]}
                      </a>
                    </div>
                  )}

                  <div className="p-2 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                    <span className="text-[10px] text-slate-400 block">Doanh nghiệp</span>
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
                                  className="h-4 w-4 rounded text-blue-600"
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
                        <span className="text-xs font-semibold text-slate-500">Dự án triển khai</span>
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
                                <span className="text-[10px] text-blue-600 font-mono font-semibold">Mã: {proj.code}</span>
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

      {/* Google Drive Master Sync Modal */}
      <GoogleDriveSyncModal
        isOpen={isDriveModalOpen}
        onClose={() => setIsDriveModalOpen(false)}
        data={{
          contacts,
          customers
        }}
      />

    </div>
  );
}
