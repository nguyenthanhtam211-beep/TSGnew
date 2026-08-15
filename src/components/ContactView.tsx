import * as XLSX from 'xlsx';
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, Building2, UserCircle, Briefcase, Phone, Mail, CheckCircle, 
  Plus, Eye, Edit2, Trash2, X, PlusCircle, Calendar, CheckSquare, 
  Clock, AlertCircle, Bookmark, Folder, ChevronRight, Activity, Tag,
  Download, MessageSquare, ClipboardList, Copy, Check,
  LayoutGrid, List, Users, Shield, Star, ExternalLink,
  PhoneCall, Send, FileSpreadsheet, Layers, MessageCircle,
  FileText, ArrowUpRight
} from 'lucide-react';
import CompanyLogo from './CompanyLogo';
import { db } from '../firebase';
import { collection, doc, setDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/errorHelper';
import { toast } from 'react-hot-toast';

interface ContactViewProps {
  contacts: any[];
  customers?: any[];
  suppliers?: any[];
  targetContactId?: string | null;
  onClearTargetContact?: () => void;
  onNavigateToCustomer?: (customerId: string) => void;
  onNavigateToSupplier?: (supplierId: string) => void;
}

interface Task {
  id: string;
  title: string;
  dueDate: string;
  priority: 'low' | 'medium' | 'high';
  status: 'todo' | 'doing' | 'done';
}

interface Project {
  id: string;
  name: string;
  code: string;
  description: string;
  status: 'planning' | 'active' | 'completed';
}

interface ActivityLog {
  id: string;
  type: 'call' | 'meeting' | 'email' | 'note';
  content: string;
  timestamp: string;
  user: string;
}

// Minimalist Avatar Initials
export const getAvatarInitials = (name: string) => {
  if (!name) return 'TS';
  const clean = name.replace(/^(Mr|Mrs|Ms|Anh|Chị|Bác|Cô|Chú)\s+/i, '').trim();
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
};

export const isExecutive = (role: string) => {
  const lower = (role || '').toLowerCase();
  return lower.includes('chủ tịch') || lower.includes('giám đốc') || lower.includes('hội đồng') || lower.includes('tổng giám đốc') || lower.includes('phó giám đốc');
};

export default function ContactView({ 
  contacts = [], 
  customers = [], 
  suppliers = [],
  targetContactId = null,
  onClearTargetContact,
  onNavigateToCustomer,
  onNavigateToSupplier
}: ContactViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all'); // all, customers, suppliers, executives
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  
  // Selected contact for detail drawer/modal
  const [selectedContact, setSelectedContact] = useState<any | null>(null);
  const [detailTab, setDetailTab] = useState<'tasks' | 'projects' | 'activities' | 'company'>('tasks');

  // Handle deep linking to contact
  useEffect(() => {
    if (targetContactId) {
      const found = contacts.find(c => 
        c.id === targetContactId || 
        c.ID === targetContactId || 
        c["Tên"]?.toLowerCase().includes(targetContactId.toLowerCase())
      );
      if (found) {
        setSelectedContact(found);
        setDetailTab('tasks');
      }
      if (onClearTargetContact) onClearTargetContact();
    }
  }, [targetContactId, contacts, onClearTargetContact]);

  // Local storage based state for tasks, projects, and activities per contact ID
  const [tasks, setTasks] = useState<{ [contactId: string]: Task[] }>({});
  const [projects, setProjects] = useState<{ [contactId: string]: Project[] }>({});
  const [activities, setActivities] = useState<{ [contactId: string]: ActivityLog[] }>({});

  // Add/Edit Contact Modal State
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<any | null>(null);
  const [contactType, setContactType] = useState<'customer' | 'supplier'>('customer');
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

  // Task / Project / Activity Form States
  const [showAddTaskForm, setShowAddTaskForm] = useState(false);
  const [taskForm, setTaskForm] = useState({
    title: '',
    dueDate: '',
    priority: 'medium' as 'low' | 'medium' | 'high',
    status: 'todo' as 'todo' | 'doing' | 'done'
  });

  const [showAddProjectForm, setShowAddProjectForm] = useState(false);
  const [projectForm, setProjectForm] = useState({
    name: '',
    code: '',
    description: '',
    status: 'active' as 'planning' | 'active' | 'completed'
  });

  const [showAddActivityForm, setShowAddActivityForm] = useState(false);
  const [activityForm, setActivityForm] = useState({
    type: 'call' as 'call' | 'meeting' | 'email' | 'note',
    content: '',
    user: 'Quản trị viên'
  });

  // Load tasks, projects, and activities from localStorage on mount
  useEffect(() => {
    try {
      const storedTasks = localStorage.getItem('tsg_contact_tasks');
      const storedProjects = localStorage.getItem('tsg_contact_projects');
      const storedActivities = localStorage.getItem('tsg_contact_activities');
      if (storedTasks) setTasks(JSON.parse(storedTasks));
      if (storedProjects) setProjects(JSON.parse(storedProjects));
      if (storedActivities) setActivities(JSON.parse(storedActivities));
    } catch (e) {
      console.error('Error reading tasks/projects/activities from local storage:', e);
    }
  }, []);

  const saveTasks = (newTasks: { [contactId: string]: Task[] }) => {
    setTasks(newTasks);
    localStorage.setItem('tsg_contact_tasks', JSON.stringify(newTasks));
  };

  const saveProjects = (newProjects: { [contactId: string]: Project[] }) => {
    setProjects(newProjects);
    localStorage.setItem('tsg_contact_projects', JSON.stringify(newProjects));
  };

  const saveActivities = (newActivities: { [contactId: string]: ActivityLog[] }) => {
    setActivities(newActivities);
    localStorage.setItem('tsg_contact_activities', JSON.stringify(newActivities));
  };

  // Helper to determine company type
  const getCompanyType = (companyName: string) => {
    if (!companyName) return 'Khác';
    const isCust = customers.some(c => 
      c["Customer_ID"]?.toLowerCase() === companyName.toLowerCase() ||
      c["Tên đầy đủ"]?.toLowerCase().includes(companyName.toLowerCase())
    );
    if (isCust) return 'Khách hàng';

    const isSupp = suppliers.some(s => 
      s["Mã nhà cung cấp"]?.toLowerCase() === companyName.toLowerCase() ||
      s["Tên Nhà Cung Cấp"]?.toLowerCase().includes(companyName.toLowerCase())
    );
    if (isSupp) return 'Nhà cung cấp';

    if (companyName.includes('Thăng Long') || companyName.includes('Thanh Hoá') || companyName.includes('Bắc Sơn') || companyName.includes('Tân Á Đại Thành')) {
      return 'Khách hàng';
    }
    return 'Nhà cung cấp';
  };

  // Helper to look up full company details
  const getCompanyDetails = (companyName: string) => {
    if (!companyName) return null;
    const type = getCompanyType(companyName);
    if (type === 'Khách hàng') {
      const matched = customers.find(c => 
        c["Customer_ID"]?.toLowerCase() === companyName.toLowerCase() ||
        c["Tên đầy đủ"]?.toLowerCase().includes(companyName.toLowerCase())
      );
      if (matched) {
        return {
          type: 'Khách hàng',
          name: matched["Tên đầy đủ"] || matched["Customer_ID"],
          code: matched["Customer_ID"],
          status: matched["Tình trạng"] || 'Đang mua',
          address: matched["Địa chỉ"] || 'Chưa cập nhật địa chỉ',
          factory: matched["Nhà máy"] || '',
          taxId: matched["Mã số thuế"] || '',
          category: matched["Phân loại"] || 'Bao bì'
        };
      }
    } else {
      const matched = suppliers.find(s => 
        s["Mã nhà cung cấp"]?.toLowerCase() === companyName.toLowerCase() ||
        s["Tên Nhà Cung Cấp"]?.toLowerCase().includes(companyName.toLowerCase())
      );
      if (matched) {
        return {
          type: 'Nhà cung cấp',
          name: matched["Tên Nhà Cung Cấp"] || matched["Mã nhà cung cấp"],
          code: matched["Mã nhà cung cấp"],
          status: matched["Tình trạng"] || 'Đang hoạt động',
          address: matched["Địa chỉ"] || 'Chưa cập nhật địa chỉ',
          factory: matched["Nhà máy"] || '',
          taxId: matched["Mã số thuế"] || '',
          category: matched["Nhóm hàng"] || 'Cung ứng'
        };
      }
    }

    return {
      type,
      name: companyName,
      code: companyName,
      status: 'Đang hoạt động',
      address: 'Chưa cập nhật địa chỉ đối tác',
      factory: '',
      taxId: '',
      category: 'Liên kết'
    };
  };

  // Filter Contacts
  const filteredContacts = useMemo(() => {
    return contacts.filter(c => {
      const matchesSearch = 
        c["Tên"]?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        c["Công ty"]?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c["Chức vụ"]?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c["Điện thoại"]?.includes(searchTerm) ||
        c["Email"]?.toLowerCase().includes(searchTerm.toLowerCase());
      
      if (!matchesSearch) return false;
      
      if (filterType === 'all') return true;
      if (filterType === 'executives') return isExecutive(c["Chức vụ"]);
      
      const type = getCompanyType(c["Công ty"]);
      if (filterType === 'customers' && type === 'Khách hàng') return true;
      if (filterType === 'suppliers' && type === 'Nhà cung cấp') return true;
      
      return false;
    });
  }, [contacts, searchTerm, filterType, customers, suppliers]);

  // Statistics
  const stats = useMemo(() => {
    const total = contacts.length;
    const custContacts = contacts.filter(c => getCompanyType(c["Công ty"]) === 'Khách hàng').length;
    const suppContacts = contacts.filter(c => getCompanyType(c["Công ty"]) === 'Nhà cung cấp').length;
    const execContacts = contacts.filter(c => isExecutive(c["Chức vụ"])).length;
    return { total, custContacts, suppContacts, execContacts };
  }, [contacts, customers, suppliers]);

  // Excel Export
  const handleExportToExcel = () => {
    try {
      const exportData = filteredContacts.map(c => {
        const contactId = c.ID || `${c["Tên"]}-${c["Công ty"]}`;
        const contactTasks = tasks[contactId] || [];
        const contactProjects = projects[contactId] || [];
        return {
          "Danh xưng": c["Danh xưng"] || "",
          "Họ và Tên": c["Tên"] || "",
          "Chức vụ": c["Chức vụ"] || "",
          "Phòng ban": c["Phòng ban"] || "",
          "Công ty": c["Công ty"] || "",
          "Phân loại đối tác": getCompanyType(c["Công ty"]),
          "Số điện thoại": c["Điện thoại"] || "",
          "Email": c["Email"] || "",
          "Mức độ quan hệ (1-5)": `${c["Mức độ quan hệ"] || "3"} sao`,
          "Phụ trách": c["Phụ trách"] || "",
          "Số lượng dự án": contactProjects.length,
          "Số lượng công việc": contactTasks.length,
          "Công việc hoàn thành": contactTasks.filter(t => t.status === 'done').length
        };
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Danh_Ba_TSG");
      XLSX.writeFile(wb, `Danh_Ba_Nhan_Su_TSG_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success("Đã xuất danh bạ ra file Excel thành công!");
    } catch (err: any) {
      toast.error("Lỗi xuất Excel: " + (err?.message || err));
    }
  };

  const copyToClipboard = (text: string, label: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(text);
    toast.success(`Đã sao chép ${label}: ${text}`);
  };

  // CRUD Contact
  const handleOpenContactModal = (contact: any = null) => {
    if (contact) {
      setEditingContact(contact);
      const isSupp = getCompanyType(contact["Công ty"]) === 'Nhà cung cấp';
      setContactType(isSupp ? 'supplier' : 'customer');
      setContactFormData({
        ID: contact.ID || `${contact["Tên"]}-${contact["Công ty"]}`,
        "Danh xưng": contact["Danh xưng"] || 'Mr',
        "Tên": contact["Tên"] || '',
        "Chức vụ": contact["Chức vụ"] || '',
        "Phòng ban": contact["Phòng ban"] || '',
        "Công ty": contact["Công ty"] || '',
        "Điện thoại": contact["Điện thoại"] || '',
        "Email": contact["Email"] || '',
        "Mức độ quan hệ": contact["Mức độ quan hệ"] || '3',
        "Phụ trách": contact["Phụ trách"] || ''
      });
    } else {
      setEditingContact(null);
      setContactType('customer');
      setContactFormData({
        ID: `contact_${Date.now()}`,
        "Danh xưng": 'Mr',
        "Tên": '',
        "Chức vụ": '',
        "Phòng ban": '',
        "Công ty": customers[0]?.["Customer_ID"] || '',
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
      toast.error("Vui lòng nhập tên liên hệ và chọn công ty liên kết.");
      return;
    }

    const toastId = toast.loading("Đang lưu thông tin...");
    try {
      const docId = editingContact?.id || editingContact?.ID || contactFormData.ID || doc(collection(db, 'contacts')).id;
      await setDoc(doc(db, 'contacts', docId), { ...contactFormData, id: docId, ID: contactFormData.ID || docId }, { merge: true });
      
      if (selectedContact && (selectedContact.id === docId || selectedContact.ID === docId)) {
        setSelectedContact({ ...selectedContact, ...contactFormData, id: docId });
      }
      toast.success(editingContact ? "Đã cập nhật hồ sơ liên hệ!" : "Đã thêm liên hệ mới!", { id: toastId });
      setIsContactModalOpen(false);
    } catch (error) {
      toast.error("Không thể lưu liên hệ!", { id: toastId });
      handleFirestoreError(error, OperationType.WRITE, 'contacts');
    }
  };

  const handleDeleteContact = async (contact: any, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Bạn có chắc chắn muốn xóa liên hệ "${contact["Tên"]}"?`)) return;
    const loadingToast = toast.loading("Đang xóa liên hệ...");
    try {
      const docId = contact.id || contact.ID || `${contact["Tên"]}-${contact["Công ty"]}`;
      await setDoc(doc(db, 'contacts', docId), { isDeleted: true }, { merge: true });
      
      if (selectedContact && (selectedContact.id === docId || selectedContact.ID === contact.ID)) {
        setSelectedContact(null);
      }
      toast.success("Đã xóa liên hệ!", { id: loadingToast });
    } catch (error) {
      toast.error("Không thể xóa liên hệ!", { id: loadingToast });
      handleFirestoreError(error, OperationType.DELETE, 'contacts');
    }
  };

  // Task Actions
  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskForm.title) return;
    const contactId = selectedContact.ID || `${selectedContact["Tên"]}-${selectedContact["Công ty"]}`;
    const newTask: Task = {
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
    const contactId = selectedContact.ID || `${selectedContact["Tên"]}-${selectedContact["Công ty"]}`;
    const newTasks = { ...tasks };
    if (newTasks[contactId]) {
      newTasks[contactId] = newTasks[contactId].map(t => {
        if (t.id === taskId) {
          const nextStatus: 'todo' | 'doing' | 'done' = t.status === 'todo' ? 'doing' : t.status === 'doing' ? 'done' : 'todo';
          return { ...t, status: nextStatus };
        }
        return t;
      });
      saveTasks(newTasks);
    }
  };

  const handleDeleteTask = (taskId: string) => {
    const contactId = selectedContact.ID || `${selectedContact["Tên"]}-${selectedContact["Công ty"]}`;
    const newTasks = { ...tasks };
    if (newTasks[contactId]) {
      newTasks[contactId] = newTasks[contactId].filter(t => t.id !== taskId);
      saveTasks(newTasks);
      toast.success("Đã xóa công việc!");
    }
  };

  // Project Actions
  const handleAddProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectForm.name) return;
    const contactId = selectedContact.ID || `${selectedContact["Tên"]}-${selectedContact["Công ty"]}`;
    const newProject: Project = {
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
    toast.success("Đã tạo dự án mới!");
  };

  const handleDeleteProject = (projectId: string) => {
    const contactId = selectedContact.ID || `${selectedContact["Tên"]}-${selectedContact["Công ty"]}`;
    const newProjects = { ...projects };
    if (newProjects[contactId]) {
      newProjects[contactId] = newProjects[contactId].filter(p => p.id !== projectId);
      saveProjects(newProjects);
      toast.success("Đã xóa dự án!");
    }
  };

  // Activity Actions
  const handleAddActivity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activityForm.content) return;
    const contactId = selectedContact.ID || `${selectedContact["Tên"]}-${selectedContact["Công ty"]}`;
    const newActivity: ActivityLog = {
      id: `act_${Date.now()}`,
      type: activityForm.type,
      content: activityForm.content,
      timestamp: new Date().toLocaleString('vi-VN'),
      user: activityForm.user
    };
    const newActivities = { ...activities, [contactId]: [newActivity, ...(activities[contactId] || [])] };
    saveActivities(newActivities);
    setActivityForm({ type: 'call', content: '', user: 'Quản trị viên' });
    setShowAddActivityForm(false);
    toast.success("Đã ghi nhận nhật ký trao đổi!");
  };

  const handleDeleteActivity = (activityId: string) => {
    const contactId = selectedContact.ID || `${selectedContact["Tên"]}-${selectedContact["Công ty"]}`;
    const newActivities = { ...activities };
    if (newActivities[contactId]) {
      newActivities[contactId] = newActivities[contactId].filter(a => a.id !== activityId);
      saveActivities(newActivities);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-white min-h-screen text-slate-900 font-sans">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-5 pb-24 lg:pb-12">
        
        {/* Apple macOS Clean Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                Danh bạ Đối tác & Trực thuộc
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                {contacts.length} nhân sự
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Quản lý hồ sơ nhân sự, kênh liên lạc, dự án triển khai và công việc kết nối đối tác.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={handleExportToExcel}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-xs"
              title="Xuất toàn bộ danh bạ ra file Excel"
            >
              <FileSpreadsheet size={15} className="text-emerald-600" />
              <span>Xuất Excel</span>
            </button>

            <button 
              onClick={() => handleOpenContactModal()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#0071E3] hover:bg-[#0066D6] transition-all shadow-xs"
            >
              <Plus size={16} />
              <span>Thêm liên hệ</span>
            </button>
          </div>
        </div>

        {/* Apple Metrics Bar (Subtle & Clean) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-100 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-medium text-slate-400 block">Khách hàng</span>
              <span className="text-lg font-bold text-blue-600 mt-0.5 block">{stats.custContacts}</span>
            </div>
            <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
              🏢
            </div>
          </div>

          <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-100 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-medium text-slate-400 block">Nhà cung cấp</span>
              <span className="text-lg font-bold text-purple-600 mt-0.5 block">{stats.suppContacts}</span>
            </div>
            <div className="h-8 w-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold">
              🏭
            </div>
          </div>

          <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-100 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-medium text-slate-400 block">Ban Lãnh đạo</span>
              <span className="text-lg font-bold text-amber-600 mt-0.5 block">{stats.execContacts}</span>
            </div>
            <div className="h-8 w-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold">
              👑
            </div>
          </div>

          <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-100 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-medium text-slate-400 block">Tổng nhân sự</span>
              <span className="text-lg font-bold text-slate-800 mt-0.5 block">{stats.total}</span>
            </div>
            <div className="h-8 w-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-bold">
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
              placeholder="Tìm theo tên, công ty, chức vụ, SĐT..."
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
                { key: 'customers', label: `Khách hàng (${stats.custContacts})` },
                { key: 'suppliers', label: `Nhà cung cấp (${stats.suppContacts})` },
                { key: 'executives', label: `Lãnh đạo (${stats.execContacts})` },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setFilterType(tab.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                    filterType === tab.key
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

        {/* Content View */}
        {filteredContacts.length > 0 ? (
          
          /* MODE 1: APPLE CLEAN TABLE (WITH FULL METRICS, PROJECTS & TASKS) */
          viewMode === 'table' ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs sm:text-sm text-left border-collapse">
                  <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200 text-xs">
                    <tr>
                      <th className="px-5 py-3.5">Họ và Tên</th>
                      <th className="px-5 py-3.5">Công ty liên kết</th>
                      <th className="px-5 py-3.5">Chức vụ / Phòng ban</th>
                      <th className="px-5 py-3.5">Phân loại</th>
                      <th className="px-5 py-3.5">Kênh liên lạc</th>
                      <th className="px-5 py-3.5">Dự án & Công việc</th>
                      <th className="px-5 py-3.5 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredContacts.map((contact) => {
                      const companyType = getCompanyType(contact["Công ty"]);
                      const isCustomer = companyType === 'Khách hàng';
                      const contactId = contact.ID || `${contact["Tên"]}-${contact["Công ty"]}`;
                      const fullName = `${contact["Danh xưng"] ? contact["Danh xưng"] + " " : ""}${contact["Tên"] || ""}`;
                      const initials = getAvatarInitials(contact["Tên"] || "");
                      const exec = isExecutive(contact["Chức vụ"]);
                      const cleanPhone = (contact["Điện thoại"] || "").replace(/[^0-9+]/g, '');

                      const contactTasks = tasks[contactId] || [];
                      const doneTasks = contactTasks.filter(t => t.status === 'done').length;
                      const contactProjects = projects[contactId] || [];
                      const contactActs = activities[contactId] || [];

                      return (
                        <tr 
                          key={contactId}
                          onClick={() => {
                            setSelectedContact(contact);
                            setDetailTab('tasks');
                          }}
                          className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                        >
                          {/* Name & Initials */}
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-3">
                              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                                exec 
                                  ? 'bg-amber-100 text-amber-800 ring-1 ring-amber-300' 
                                  : isCustomer 
                                  ? 'bg-blue-100 text-blue-800' 
                                  : 'bg-purple-100 text-purple-800'
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

                          {/* Company with 2-way cross navigation */}
                          <td className="px-5 py-3" onClick={(e) => {
                            e.stopPropagation();
                            if (isCustomer && onNavigateToCustomer) {
                              onNavigateToCustomer(contact["Công ty"]);
                            } else if (!isCustomer && onNavigateToSupplier) {
                              onNavigateToSupplier(contact["Công ty"]);
                            }
                          }}>
                            <div className="flex items-center gap-2 group/comp cursor-pointer" title={`Mở hồ sơ ${companyType}`}>
                              <CompanyLogo name={contact["Công ty"]} size="sm" className="rounded shadow-2xs" />
                              <span className="font-medium text-slate-800 group-hover/comp:text-[#0071E3] group-hover/comp:underline flex items-center gap-1">
                                {contact["Công ty"]}
                                <ArrowUpRight size={11} className="text-slate-400 group-hover/comp:text-[#0071E3]" />
                              </span>
                            </div>
                          </td>

                          {/* Role / Dept */}
                          <td className="px-5 py-3 text-slate-600">
                            <div className="font-medium text-slate-800">{contact["Chức vụ"] || "—"}</div>
                            {contact["Phòng ban"] && (
                              <div className="text-xs text-slate-400">{contact["Phòng ban"]}</div>
                            )}
                          </td>

                          {/* Category Badge */}
                          <td className="px-5 py-3">
                            <span className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-medium ${
                              isCustomer 
                                ? 'bg-blue-50 text-blue-700' 
                                : 'bg-purple-50 text-purple-700'
                            }`}>
                              {companyType}
                            </span>
                          </td>

                          {/* Contact Info (Clickable Phone, Zalo, Email) */}
                          <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                            <div className="space-y-0.5 text-xs">
                              {contact["Điện thoại"] ? (
                                <div className="flex items-center gap-1.5 font-mono">
                                  <a 
                                    href={`tel:${cleanPhone}`} 
                                    className="font-medium text-slate-700 hover:text-blue-600 transition-colors"
                                  >
                                    {contact["Điện thoại"]}
                                  </a>
                                  {cleanPhone && (
                                    <a 
                                      href={`https://zalo.me/${cleanPhone}`} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="px-1 text-[9px] bg-blue-100 text-blue-700 hover:bg-blue-200 rounded font-sans font-semibold"
                                      title="Mở Zalo chat"
                                    >
                                      Zalo
                                    </a>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                              {contact["Email"] && (
                                <a 
                                  href={`mailto:${contact["Email"]}`} 
                                  className="text-slate-400 hover:text-slate-700 truncate block max-w-[170px]"
                                >
                                  {contact["Email"]}
                                </a>
                              )}
                            </div>
                          </td>

                          {/* Projects & Tasks Metrics */}
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
                              {contactActs.length > 0 && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-400" title="Nhật ký tương tác">
                                  • {contactActs.length} ghi chú
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="px-5 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => {
                                  setSelectedContact(contact);
                                  setDetailTab('tasks');
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
            
            /* MODE 2: APPLE CLEAN CARDS (WITH TASKS & PROJECTS BADGES) */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredContacts.map((contact) => {
                const companyType = getCompanyType(contact["Công ty"]);
                const isCustomer = companyType === 'Khách hàng';
                const contactId = contact.ID || `${contact["Tên"]}-${contact["Công ty"]}`;
                const fullName = `${contact["Danh xưng"] ? contact["Danh xưng"] + " " : ""}${contact["Tên"] || ""}`;
                const initials = getAvatarInitials(contact["Tên"] || "");
                const exec = isExecutive(contact["Chức vụ"]);
                const cleanPhone = (contact["Điện thoại"] || "").replace(/[^0-9+]/g, '');

                const contactTasks = tasks[contactId] || [];
                const doneTasks = contactTasks.filter(t => t.status === 'done').length;
                const contactProjects = projects[contactId] || [];

                return (
                  <div 
                    key={contactId}
                    onClick={() => {
                      setSelectedContact(contact);
                      setDetailTab('tasks');
                    }}
                    className="bg-white rounded-2xl border border-slate-200 p-4 hover:border-slate-300 hover:shadow-xs transition-all cursor-pointer flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className={`h-10 w-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                            exec 
                              ? 'bg-amber-100 text-amber-800 ring-1 ring-amber-300' 
                              : isCustomer 
                              ? 'bg-blue-100 text-blue-800' 
                              : 'bg-purple-100 text-purple-800'
                          }`}>
                            {initials}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 text-sm">
                              {fullName}
                            </div>
                            <div className="text-xs text-slate-500 font-medium">
                              {contact["Chức vụ"] || "Chức vụ chưa cập nhật"}
                            </div>
                          </div>
                        </div>

                        <span className={`px-2 py-0.5 rounded text-[11px] font-medium shrink-0 ${
                          isCustomer ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'
                        }`}>
                          {companyType}
                        </span>
                      </div>

                      <div className="mt-3.5 pt-3 border-t border-slate-100 space-y-1.5 text-xs">
                        <div className="flex items-center gap-2 text-slate-700">
                          <Building2 size={13} className="text-slate-400 shrink-0" />
                          <span className="font-medium truncate">{contact["Công ty"]}</span>
                        </div>
                        {contact["Điện thoại"] && (
                          <div className="flex items-center gap-2 text-slate-700 font-mono">
                            <Phone size={13} className="text-slate-400 shrink-0" />
                            <span>{contact["Điện thoại"]}</span>
                          </div>
                        )}
                        {contact["Email"] && (
                          <div className="flex items-center gap-2 text-slate-500">
                            <Mail size={13} className="text-slate-400 shrink-0" />
                            <span className="truncate">{contact["Email"]}</span>
                          </div>
                        )}
                      </div>

                      {/* Project & Tasks Pills */}
                      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center gap-2 flex-wrap">
                        {contactProjects.length > 0 && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-purple-50 text-purple-700 px-2 py-0.5 rounded-md">
                            <Folder size={10} /> {contactProjects.length} dự án
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md">
                          <CheckSquare size={10} /> {contactTasks.length > 0 ? `${doneTasks}/${contactTasks.length} việc` : '0 việc'}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1 font-mono">
                        {cleanPhone && (
                          <a 
                            href={`tel:${cleanPhone}`} 
                            className="px-2.5 py-1 text-xs font-medium bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 transition-colors"
                          >
                            Gọi điện
                          </a>
                        )}
                        {cleanPhone && (
                          <a 
                            href={`https://zalo.me/${cleanPhone}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="px-2.5 py-1 text-xs font-medium bg-blue-50 hover:bg-blue-100 rounded-lg text-blue-700 transition-colors"
                          >
                            Zalo
                          </a>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => handleOpenContactModal(contact)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition-colors"
                          title="Chỉnh sửa"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button 
                          onClick={(e) => handleDeleteContact(contact, e)}
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
            <UserCircle size={36} className="mx-auto text-slate-300" />
            <div className="text-sm font-semibold text-slate-700">Không tìm thấy liên hệ</div>
            <p className="text-xs text-slate-400">Thử tìm kiếm với từ khóa khác.</p>
          </div>
        )}

      </div>

      {/* Dynamic Add/Edit Contact Modal */}
      {isContactModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg flex flex-col max-h-[90vh] overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/80">
              <h3 className="text-base font-bold text-slate-900">
                {editingContact ? 'Chỉnh sửa hồ sơ liên hệ' : 'Thêm liên hệ mới'}
              </h3>
              <button onClick={() => setIsContactModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveContact} className="p-5 overflow-y-auto flex-1 space-y-4 text-xs sm:text-sm">
              {/* Type Switcher */}
              <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => {
                    setContactType('customer');
                    if (customers.length > 0) {
                      setContactFormData(prev => ({ ...prev, "Công ty": customers[0]["Customer_ID"] }));
                    }
                  }}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${contactType === 'customer' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-500'}`}
                >
                  Khách hàng
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setContactType('supplier');
                    if (suppliers.length > 0) {
                      setContactFormData(prev => ({ ...prev, "Công ty": suppliers[0]["Tên Nhà Cung Cấp"] || suppliers[0]["Mã nhà cung cấp"] }));
                    }
                  }}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${contactType === 'supplier' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-500'}`}
                >
                  Nhà cung cấp
                </button>
              </div>

              {/* Dynamic Company dropdown */}
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Công ty liên kết</label>
                <select
                  value={contactFormData["Công ty"]}
                  onChange={(e) => setContactFormData({ ...contactFormData, "Công ty": e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                >
                  {contactType === 'customer' ? (
                    customers.map((c) => (
                      <option key={c["Customer_ID"]} value={c["Customer_ID"]}>{c["Tên đầy đủ"]} ({c["Customer_ID"]})</option>
                    ))
                  ) : (
                    suppliers.map((s) => (
                      <option key={s["Mã nhà cung cấp"] || s["Tên Nhà Cung Cấp"]} value={s["Tên Nhà Cung Cấp"] || s["Mã nhà cung cấp"]}>
                        {s["Tên Nhà Cung Cấp"] || s["Mã nhà cung cấp"]}
                      </option>
                    ))
                  )}
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
                    placeholder="Nguyễn Văn A"
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
                    placeholder="VD: Giám đốc / Trưởng phòng"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Phòng ban</label>
                  <input
                    type="text"
                    value={contactFormData["Phòng ban"]}
                    onChange={(e) => setContactFormData({ ...contactFormData, "Phòng ban": e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm outline-none"
                    placeholder="VD: Kế hoạch - Vật tư"
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
                    placeholder="name@company.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Mức độ quan hệ</label>
                  <select
                    value={contactFormData["Mức độ quan hệ"]}
                    onChange={(e) => setContactFormData({ ...contactFormData, "Mức độ quan hệ": e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm outline-none"
                  >
                    <option value="1">1 sao - Mới quen</option>
                    <option value="2">2 sao - Thường xuyên liên hệ</option>
                    <option value="3">3 sao - Tin cậy</option>
                    <option value="4">4 sao - Đối tác mật thiết</option>
                    <option value="5">5 sao - Trọng yếu chiến lược</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Ghi chú phụ trách</label>
                  <input
                    type="text"
                    value={contactFormData["Phụ trách"]}
                    onChange={(e) => setContactFormData({ ...contactFormData, "Phụ trách": e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm outline-none"
                    placeholder="Nhân sự TSG quản lý đối tác"
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

      {/* Complete Apple Inspector / Detail Modal with Tasks, Projects, Activities, and Company Details */}
      {selectedContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl h-[88vh] flex flex-col overflow-hidden">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/90">
              <div className="flex items-center gap-3.5">
                <div className="h-10 w-10 rounded-full bg-slate-200 text-slate-800 font-bold flex items-center justify-center text-sm shadow-2xs">
                  {getAvatarInitials(selectedContact["Tên"] || "")}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <span>{selectedContact["Danh xưng"] ? `${selectedContact["Danh xưng"]} ` : ''}{selectedContact["Tên"]}</span>
                    {isExecutive(selectedContact["Chức vụ"]) && (
                      <span className="text-[10px] bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.2 rounded font-semibold">
                        Lãnh đạo
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {selectedContact["Chức vụ"] || "Chức vụ chưa rõ"} • {selectedContact["Công ty"]}
                  </p>
                </div>
              </div>
              <button onClick={() => setSelectedContact(null)} className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg">
                <X size={18} />
              </button>
            </div>

            {/* Modal Body: Left Info Bar + Right Interactive Tabs */}
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
              
              {/* Left Column: Quick Profile */}
              <div className="w-full md:w-72 border-b md:border-b-0 md:border-r border-slate-100 p-5 overflow-y-auto space-y-4 bg-slate-50/50">
                
                {/* Contact channels */}
                <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 space-y-2.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Kênh kết nối</span>
                  
                  {selectedContact["Điện thoại"] && (
                    <div className="flex items-center justify-between gap-2 p-2 bg-slate-50 rounded-xl text-xs font-mono">
                      <a href={`tel:${selectedContact["Điện thoại"]}`} className="font-bold text-slate-800 hover:text-blue-600 truncate">
                        {selectedContact["Điện thoại"]}
                      </a>
                      <div className="flex items-center gap-1 shrink-0 font-sans">
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(selectedContact["Điện thoại"]);
                            toast.success("Đã sao chép SĐT!");
                          }}
                          className="p-1 text-slate-400 hover:text-slate-700"
                          title="Sao chép"
                        >
                          <Copy size={12} />
                        </button>
                      </div>
                    </div>
                  )}

                  {selectedContact["Email"] && (
                    <div className="flex items-center justify-between gap-2 p-2 bg-slate-50 rounded-xl text-xs">
                      <a href={`mailto:${selectedContact["Email"]}`} className="text-blue-600 hover:underline truncate">
                        {selectedContact["Email"]}
                      </a>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(selectedContact["Email"]);
                          toast.success("Đã sao chép Email!");
                        }}
                        className="p-1 text-slate-400 hover:text-slate-700 shrink-0"
                        title="Sao chép"
                      >
                        <Copy size={12} />
                      </button>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                    <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-[10px] text-slate-400 block">Phòng ban</span>
                      <div className="font-semibold text-slate-700 truncate mt-0.5">{selectedContact["Phòng ban"] || "—"}</div>
                    </div>
                    <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-[10px] text-slate-400 block">Quan hệ</span>
                      <div className="font-semibold text-slate-700 mt-0.5">{selectedContact["Mức độ quan hệ"] || "3"} Sao</div>
                    </div>
                  </div>
                </div>

                {/* Company Linkage with Direct 2-Way Navigation */}
                {(() => {
                  const comp = getCompanyDetails(selectedContact["Công ty"]);
                  if (!comp) return null;
                  return (
                    <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Doanh nghiệp</span>
                        <span className={`px-1.5 py-0.2 rounded text-[10px] font-medium ${comp.type === 'Khách hàng' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>
                          {comp.type}
                        </span>
                      </div>
                      <div className="font-bold text-slate-800 text-xs leading-tight">{comp.name}</div>
                      <div className="text-[11px] text-slate-500 space-y-0.5 pt-1 border-t border-slate-100">
                        {comp.taxId && <div><strong>MST:</strong> {comp.taxId}</div>}
                        <div className="line-clamp-2"><strong>Địa chỉ:</strong> {comp.address}</div>
                      </div>

                      {/* 2-Way Deep Linking Button */}
                      <button
                        type="button"
                        onClick={() => {
                          const targetName = comp.code || comp.name;
                          setSelectedContact(null);
                          if (comp.type === 'Khách hàng' && onNavigateToCustomer) {
                            onNavigateToCustomer(targetName);
                          } else if (comp.type === 'Nhà cung cấp' && onNavigateToSupplier) {
                            onNavigateToSupplier(targetName);
                          }
                        }}
                        className="w-full mt-2 py-2 px-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:text-[#0071E3] flex items-center justify-center gap-1.5 transition-all shadow-2xs"
                      >
                        <span>Mở hồ sơ {comp.type}</span>
                        <ArrowUpRight size={13} />
                      </button>
                    </div>
                  );
                })()}

              </div>

              {/* Right Column: Full Interactive Tabs (Tasks, Projects, Activities) */}
              <div className="flex-1 flex flex-col overflow-hidden">
                
                {/* Apple Segmented Tab Header */}
                <div className="flex border-b border-slate-100 bg-white px-5 pt-2 gap-3 text-xs">
                  <button
                    onClick={() => setDetailTab('tasks')}
                    className={`pb-2.5 font-bold transition-all border-b-2 flex items-center gap-1.5 ${
                      detailTab === 'tasks' ? 'border-[#0071E3] text-[#0071E3]' : 'border-transparent text-slate-400 hover:text-slate-700'
                    }`}
                  >
                    <CheckSquare size={14} />
                    <span>Công việc ({(tasks[selectedContact.ID || `${selectedContact["Tên"]}-${selectedContact["Công ty"]}`] || []).length})</span>
                  </button>
                  <button
                    onClick={() => setDetailTab('projects')}
                    className={`pb-2.5 font-bold transition-all border-b-2 flex items-center gap-1.5 ${
                      detailTab === 'projects' ? 'border-[#0071E3] text-[#0071E3]' : 'border-transparent text-slate-400 hover:text-slate-700'
                    }`}
                  >
                    <Folder size={14} />
                    <span>Dự án ({(projects[selectedContact.ID || `${selectedContact["Tên"]}-${selectedContact["Công ty"]}`] || []).length})</span>
                  </button>
                  <button
                    onClick={() => setDetailTab('activities')}
                    className={`pb-2.5 font-bold transition-all border-b-2 flex items-center gap-1.5 ${
                      detailTab === 'activities' ? 'border-[#0071E3] text-[#0071E3]' : 'border-transparent text-slate-400 hover:text-slate-700'
                    }`}
                  >
                    <Clock size={14} />
                    <span>Nhật ký ({(activities[selectedContact.ID || `${selectedContact["Tên"]}-${selectedContact["Công ty"]}`] || []).length})</span>
                  </button>
                </div>

                {/* Tab Content */}
                <div className="flex-1 p-5 overflow-y-auto">
                  
                  {/* 1. TASKS TAB */}
                  {detailTab === 'tasks' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-500">Danh sách việc cần theo dõi</span>
                        <button
                          onClick={() => setShowAddTaskForm(!showAddTaskForm)}
                          className="text-xs font-semibold text-[#0071E3] hover:underline"
                        >
                          + Thêm công việc
                        </button>
                      </div>

                      {showAddTaskForm && (
                        <form onSubmit={handleAddTask} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5 animate-fade-in">
                          <input 
                            type="text" 
                            required 
                            placeholder="Nội dung công việc (VD: Gửi báo giá, hẹn mẫu thử...)" 
                            value={taskForm.title}
                            onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-500/20"
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
                              onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value as any })}
                              className="bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs outline-none"
                            >
                              <option value="low">Ưu tiên thấp</option>
                              <option value="medium">Ưu tiên vừa</option>
                              <option value="high">Ưu tiên cao</option>
                            </select>
                            <button type="submit" className="bg-[#0071E3] text-white rounded-xl text-xs font-semibold hover:bg-[#0066D6] transition-colors">
                              Lưu việc
                            </button>
                          </div>
                        </form>
                      )}

                      <div className="space-y-2">
                        {(() => {
                          const contactId = selectedContact.ID || `${selectedContact["Tên"]}-${selectedContact["Công ty"]}`;
                          const contactTasks = tasks[contactId] || [];
                          if (contactTasks.length === 0) {
                            return <div className="text-slate-400 text-xs py-8 text-center italic">Chưa có công việc nào. Bấm "+ Thêm công việc" để tạo mới.</div>;
                          }
                          return contactTasks.map(task => (
                            <div key={task.id} className="flex items-center justify-between p-3 bg-slate-50/80 hover:bg-slate-50 rounded-xl border border-slate-100 transition-all">
                              <div className="flex items-center gap-3">
                                <input 
                                  type="checkbox" 
                                  checked={task.status === 'done'} 
                                  onChange={() => handleToggleTaskStatus(task.id)}
                                  className="h-4 w-4 rounded text-blue-600 cursor-pointer"
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

                  {/* 2. PROJECTS TAB */}
                  {detailTab === 'projects' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-500">Dự án liên kết đối tác</span>
                        <button
                          onClick={() => setShowAddProjectForm(!showAddProjectForm)}
                          className="text-xs font-semibold text-[#0071E3] hover:underline"
                        >
                          + Tạo dự án mới
                        </button>
                      </div>

                      {showAddProjectForm && (
                        <form onSubmit={handleAddProject} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5 animate-fade-in">
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
                            <button type="submit" className="bg-[#0071E3] text-white rounded-xl text-xs font-semibold hover:bg-[#0066D6]">
                              Lưu dự án
                            </button>
                          </div>
                        </form>
                      )}

                      <div className="space-y-2">
                        {(() => {
                          const contactId = selectedContact.ID || `${selectedContact["Tên"]}-${selectedContact["Công ty"]}`;
                          const contactProjects = projects[contactId] || [];
                          if (contactProjects.length === 0) {
                            return <div className="text-slate-400 text-xs py-8 text-center italic">Chưa có dự án nào. Bấm "+ Tạo dự án mới" để bắt đầu.</div>;
                          }
                          return contactProjects.map(proj => (
                            <div key={proj.id} className="flex items-center justify-between p-3 bg-slate-50/80 rounded-xl border border-slate-100">
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

                  {/* 3. ACTIVITIES TAB */}
                  {detailTab === 'activities' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-500">Nhật ký trao đổi & Ghi chú</span>
                        <button
                          onClick={() => setShowAddActivityForm(!showAddActivityForm)}
                          className="text-xs font-semibold text-[#0071E3] hover:underline"
                        >
                          + Thêm ghi chú
                        </button>
                      </div>

                      {showAddActivityForm && (
                        <form onSubmit={handleAddActivity} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5 animate-fade-in">
                          <textarea 
                            required 
                            rows={3}
                            placeholder="Nội dung cuộc gọi, họp bàn hoặc trao đổi..." 
                            value={activityForm.content}
                            onChange={(e) => setActivityForm({ ...activityForm, content: e.target.value })}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none"
                          />
                          <div className="flex justify-end gap-2">
                            <button type="submit" className="bg-[#0071E3] text-white px-3.5 py-1.5 rounded-xl text-xs font-semibold">
                              Lưu nhật ký
                            </button>
                          </div>
                        </form>
                      )}

                      <div className="space-y-2">
                        {(() => {
                          const contactId = selectedContact.ID || `${selectedContact["Tên"]}-${selectedContact["Công ty"]}`;
                          const contactActivities = activities[contactId] || [];
                          if (contactActivities.length === 0) {
                            return <div className="text-slate-400 text-xs py-8 text-center italic">Chưa có nhật ký trao đổi nào.</div>;
                          }
                          return contactActivities.map(act => (
                            <div key={act.id} className="p-3 bg-slate-50/80 rounded-xl border border-slate-100 space-y-1">
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
