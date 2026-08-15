import * as XLSX from 'xlsx';
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, Building2, UserCircle, Briefcase, Phone, Mail, CheckCircle, 
  Plus, Eye, Edit2, Trash2, X, PlusCircle, Calendar, CheckSquare, 
  Clock, AlertCircle, Bookmark, Folder, ChevronRight, Activity, Tag,
  Download, MessageSquare, ClipboardList, Copy, Check, Sparkles,
  LayoutGrid, List, Users, Shield, Star, ExternalLink, Award,
  PhoneCall, Send, FileSpreadsheet, ChevronDown, Layers
} from 'lucide-react';
import CompanyLogo from './CompanyLogo';
import { db } from '../firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/errorHelper';
import { toast } from 'react-hot-toast';

interface ContactViewProps {
  contacts: any[];
  customers?: any[];
  suppliers?: any[];
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

// Avatar Initials Helper
export const getAvatarInitials = (name: string, title?: string) => {
  if (!name) return 'TS';
  const clean = name.replace(/^(Mr|Mrs|Ms|Anh|Chị|Bác|Cô|Chú)\s+/i, '').trim();
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
};

// Avatar Color Palette
export const getAvatarGradient = (name: string) => {
  const gradients = [
    'from-blue-600 to-indigo-700 text-white',
    'from-purple-600 to-pink-600 text-white',
    'from-emerald-600 to-teal-700 text-white',
    'from-amber-500 to-orange-600 text-white',
    'from-rose-500 to-pink-600 text-white',
    'from-cyan-600 to-blue-700 text-white',
    'from-violet-600 to-purple-800 text-white',
  ];
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) {
    hash = (name || '').charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % gradients.length;
  return gradients[index];
};

export const isExecutive = (role: string) => {
  const lower = (role || '').toLowerCase();
  return lower.includes('chủ tịch') || lower.includes('giám đốc') || lower.includes('hội đồng') || lower.includes('tổng giám đốc') || lower.includes('phó giám đốc');
};

export default function ContactView({ contacts = [], customers = [], suppliers = [] }: ContactViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all'); // all, customers, suppliers, executives
  const [viewMode, setViewMode] = useState<'grid' | 'table' | 'company'>('grid');
  
  // Selected contact for detail drawer/modal
  const [selectedContact, setSelectedContact] = useState<any | null>(null);
  const [detailTab, setDetailTab] = useState<'tasks' | 'projects' | 'activities'>('tasks');

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

  // Task / Project Form States
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

  // Load tasks and projects from localStorage on mount
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

  // Save tasks and projects to localStorage whenever they change
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

  // Helper to determine if a company is a Customer or Supplier based on existing tables
  const getCompanyType = (companyName: string) => {
    if (!companyName) return 'Khác';
    
    // Check in Customer array
    const isCust = customers.some(c => 
      c["Customer_ID"]?.toLowerCase() === companyName.toLowerCase() ||
      c["Tên đầy đủ"]?.toLowerCase().includes(companyName.toLowerCase())
    );
    if (isCust) return 'Khách hàng';

    // Check in Supplier array
    const isSupp = suppliers.some(s => 
      s["Mã nhà cung cấp"]?.toLowerCase() === companyName.toLowerCase() ||
      s["Tên Nhà Cung Cấp"]?.toLowerCase().includes(companyName.toLowerCase())
    );
    if (isSupp) return 'Nhà cung cấp';

    // Fallback search
    if (companyName.includes('Thăng Long') || companyName.includes('Thanh Hoá') || companyName.includes('Bắc Sơn') || companyName.includes('Tân Á Đại Thành')) {
      return 'Khách hàng';
    }
    return 'Nhà cung cấp';
  };

  // Look up full company info (Customer or Supplier) for linked profile card
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
          status: matched["Tình trạng"] || 'Đang hợp tác',
          address: matched["Địa chỉ"] || 'Chưa cập nhật địa chỉ',
          category: matched["Phân loại"] || 'Bán hàng',
          balance: matched["Công nợ phải thu"] || '0 VND'
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
          status: matched["Tình trạng"] || 'Hoạt động',
          address: matched["Địa chỉ"] || 'Chưa cập nhật địa chỉ',
          category: matched["Nhóm hàng"] || 'Cung ứng',
          balance: matched["Công nợ phải trả"] || '0 VND'
        };
      }
    }

    return {
      type: type,
      name: companyName,
      code: companyName,
      status: 'Đang hoạt động',
      address: 'Chưa cập nhật địa chỉ đối tác',
      category: 'Liên kết',
      balance: '-'
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

  // Grouped by Company Map
  const groupedByCompany = useMemo(() => {
    const map = new Map<string, any[]>();
    filteredContacts.forEach(c => {
      const comp = c["Công ty"] || "Khác";
      if (!map.has(comp)) map.set(comp, []);
      map.get(comp)!.push(c);
    });
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [filteredContacts]);

  // Excel Export
  const handleExportToExcel = () => {
    try {
      const exportData = filteredContacts.map(c => ({
        "Danh xưng": c["Danh xưng"] || "",
        "Họ và Tên": c["Tên"] || "",
        "Chức vụ": c["Chức vụ"] || "",
        "Phòng ban": c["Phòng ban"] || "",
        "Công ty": c["Công ty"] || "",
        "Phân loại đối tác": getCompanyType(c["Công ty"]),
        "Số điện thoại": c["Điện thoại"] || "",
        "Email": c["Email"] || "",
        "Mức độ quan hệ (1-5)": c["Mức độ quan hệ"] || "3",
        "Phụ trách": c["Phụ trách"] || ""
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Danh_Ba_TSG");
      XLSX.writeFile(wb, `Danh_Ba_Nhan_Su_Doi_Tac_TSG_${new Date().toISOString().slice(0, 10)}.xlsx`);
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

  // Handle Contact CRUD
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

    const toastId = toast.loading("Đang lưu thông tin liên hệ...");
    try {
      const docId = editingContact?.id || editingContact?.ID || contactFormData.ID || doc(collection(db, 'contacts')).id;
      await setDoc(doc(db, 'contacts', docId), { ...contactFormData, id: docId, ID: contactFormData.ID || docId }, { merge: true });
      
      if (selectedContact && (selectedContact.id === docId || selectedContact.ID === docId)) {
        setSelectedContact({ ...selectedContact, ...contactFormData, id: docId });
      }
      toast.success(editingContact ? "Đã cập nhật liên hệ!" : "Đã thêm liên hệ mới!", { id: toastId });
      setIsContactModalOpen(false);
    } catch (error) {
      toast.error("Không thể lưu liên hệ!", { id: toastId });
      handleFirestoreError(error, OperationType.WRITE, 'contacts');
    }
  };

  const handleDeleteContact = async (contact: any, e: React.MouseEvent) => {
    e.stopPropagation();
    const loadingToast = toast.loading("Đang xóa liên hệ...");
    try {
      const docId = contact.id || contact.ID || `${contact["Tên"]}-${contact["Công ty"]}`;
      await setDoc(doc(db, 'contacts', docId), { isDeleted: true }, { merge: true });
      
      if (selectedContact && (selectedContact.id === contact.id || selectedContact.ID === contact.ID)) {
        setSelectedContact(null);
      }
      toast.success("Đã xóa liên hệ thành công!", { id: loadingToast });
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
    toast.success("Đã tạo công việc mới!");
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
    <div className="flex-1 overflow-y-auto bg-slate-50/70 min-h-screen">
      <div className="p-3 sm:p-5 lg:p-8 max-w-[1600px] mx-auto space-y-5 sm:space-y-6 pb-24 lg:pb-8">
        
        {/* Hero Header with Decorative Gradient Banner */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 p-5 sm:p-8 text-white shadow-xl shadow-indigo-950/20 border border-slate-800">
          <div className="absolute right-0 top-0 -mt-10 -mr-10 w-96 h-96 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
          <div className="absolute left-1/3 bottom-0 w-80 h-80 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5 sm:gap-6">
            <div className="space-y-1.5 sm:space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-semibold backdrop-blur-md">
                <Sparkles size={14} className="text-blue-400 animate-pulse" />
                <span>Mạng Lưới Nhân Sự & Ban Lãnh Đạo Đối Tác Chiến Lược</span>
              </div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2.5 sm:gap-3">
                <Users className="text-blue-400 shrink-0" size={30} />
                Danh Bạ Đối Tác & Trực Thuộc TSG
              </h1>
              <p className="text-slate-300 text-xs sm:text-sm max-w-2xl leading-relaxed">
                Tra cứu người liên hệ, cơ cấu nhân sự theo doanh nghiệp, gọi điện thoại/Zalo 1 chạm, và theo dõi tiến độ công việc kết nối.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-3 shrink-0">
              <button
                onClick={handleExportToExcel}
                className="inline-flex items-center justify-center gap-2 bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3.5 py-2.5 sm:py-3 rounded-2xl font-bold text-xs sm:text-sm transition-all duration-300 shadow-md hover:-translate-y-0.5"
                title="Xuất toàn bộ danh bạ ra file Excel"
              >
                <FileSpreadsheet size={16} className="text-emerald-400" />
                <span>Xuất Excel</span>
              </button>

              <button 
                onClick={() => handleOpenContactModal()}
                className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-2xl font-bold text-xs sm:text-sm transition-all duration-300 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5 active:translate-y-0 border border-blue-400/30"
              >
                <PlusCircle size={18} />
                <span>Thêm Liên Hệ Mới</span>
              </button>
            </div>
          </div>

          {/* Quick Filter Tabs inside Hero */}
          <div className="flex flex-wrap gap-2 mt-5 pt-5 border-t border-slate-800/80">
            {[
              { key: 'all', label: `Tất cả (${stats.total})` },
              { key: 'customers', label: `Khách hàng (${stats.custContacts})` },
              { key: 'suppliers', label: `Nhà cung cấp (${stats.suppContacts})` },
              { key: 'executives', label: `Ban Lãnh Đạo (${stats.execContacts})` },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilterType(tab.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                  filterType === tab.key
                    ? "bg-blue-600 border-blue-400 text-white shadow-md shadow-blue-600/30"
                    : "bg-slate-800/60 border-slate-700/60 text-slate-300 hover:text-white hover:bg-slate-800"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* KPIs Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3 sm:gap-4 hover:border-blue-200 transition-all">
            <div className="h-11 w-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Users size={20} />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tổng Nhân Sự Liên Hệ</p>
              <p className="text-xl sm:text-2xl font-extrabold text-slate-800 mt-0.5">{stats.total}</p>
            </div>
          </div>

          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3 sm:gap-4 hover:border-emerald-200 transition-all">
            <div className="h-11 w-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Building2 size={20} />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Trực Thuộc Khách Hàng</p>
              <p className="text-xl sm:text-2xl font-extrabold text-emerald-600 mt-0.5">{stats.custContacts}</p>
            </div>
          </div>

          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3 sm:gap-4 hover:border-purple-200 transition-all">
            <div className="h-11 w-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
              <Briefcase size={20} />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Trực Thuộc Nhà Cung Cấp</p>
              <p className="text-xl sm:text-2xl font-extrabold text-purple-600 mt-0.5">{stats.suppContacts}</p>
            </div>
          </div>

          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3 sm:gap-4 hover:border-amber-200 transition-all">
            <div className="h-11 w-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Award size={20} />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Cấp Lãnh Đạo / Quyết Định</p>
              <p className="text-xl sm:text-2xl font-extrabold text-amber-600 mt-0.5">{stats.execContacts}</p>
            </div>
          </div>
        </div>

        {/* Filters and View Mode Controls */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 sm:p-4 shadow-sm flex flex-col md:flex-row gap-3 sm:gap-4 items-center justify-between">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Tìm theo tên, công ty, chức vụ, SĐT, email..."
              className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm transition-all placeholder:text-slate-400"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 w-full md:w-auto justify-end">
            <span className="text-xs text-slate-500 font-medium">
              Hiển thị <strong>{filteredContacts.length}</strong> liên hệ
            </span>

            {/* View Mode Toggle: Grid, Table, Company */}
            <div className="flex bg-slate-100 p-1 rounded-xl gap-0.5 border border-slate-200/40">
              <button 
                onClick={() => setViewMode('grid')}
                className={`px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1 text-xs font-bold ${viewMode === 'grid' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                title="Dạng Danh Thiếp"
              >
                <LayoutGrid size={15} />
                <span className="hidden sm:inline">Danh thiếp</span>
              </button>
              <button 
                onClick={() => setViewMode('table')}
                className={`px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1 text-xs font-bold ${viewMode === 'table' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                title="Dạng Bảng"
              >
                <List size={15} />
                <span className="hidden sm:inline">Bảng</span>
              </button>
              <button 
                onClick={() => setViewMode('company')}
                className={`px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1 text-xs font-bold ${viewMode === 'company' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                title="Nhóm Theo Doanh Nghiệp"
              >
                <Layers size={15} />
                <span className="hidden sm:inline">Nhóm Cty</span>
              </button>
            </div>
          </div>
        </div>

        {/* Content Area */}
        {filteredContacts.length > 0 ? (
          
          /* MODE 1: MODERN GRID BUSINESS CARDS */
          viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {filteredContacts.map((contact, idx) => {
                const companyType = getCompanyType(contact["Công ty"]);
                const isCustomer = companyType === 'Khách hàng';
                const contactId = contact.ID || `${contact["Tên"]}-${contact["Công ty"]}`;
                const fullName = `${contact["Danh xưng"] ? contact["Danh xưng"] + " " : ""}${contact["Tên"] || ""}`;
                const initials = getAvatarInitials(contact["Tên"] || "");
                const gradientBg = getAvatarGradient(contact["Tên"] || "");
                const exec = isExecutive(contact["Chức vụ"]);
                const cleanPhone = (contact["Điện thoại"] || "").replace(/[^0-9+]/g, '');

                const contactTasks = tasks[contactId] || [];
                const doneTasks = contactTasks.filter(t => t.status === 'done').length;

                return (
                  <div 
                    key={contactId}
                    className="bg-white rounded-3xl border border-slate-200/80 shadow-sm hover:shadow-xl hover:border-blue-300 transition-all duration-300 p-5 flex flex-col justify-between group relative overflow-hidden"
                  >
                    {/* Top Executive Accent Bar */}
                    <div className={`absolute top-0 left-0 right-0 h-1.5 ${
                      exec 
                        ? "bg-gradient-to-r from-amber-400 via-orange-500 to-amber-600" 
                        : isCustomer 
                        ? "bg-gradient-to-r from-blue-500 to-indigo-500" 
                        : "bg-gradient-to-r from-purple-500 to-pink-500"
                    }`} />

                    <div>
                      {/* Header Row: Avatar, Name, Company Badge, Actions */}
                      <div className="flex items-start justify-between gap-3 pt-1">
                        <div className="flex items-center gap-3.5 min-w-0 flex-1">
                          
                          {/* Dynamic Gradient Avatar */}
                          <div className="relative shrink-0">
                            <div className={`h-12 w-12 rounded-2xl bg-gradient-to-br ${gradientBg} font-black text-sm flex items-center justify-center shadow-md shadow-slate-900/10 tracking-wider ${
                              exec ? "ring-2 ring-amber-400 ring-offset-2" : ""
                            }`}>
                              {initials}
                            </div>
                            {exec && (
                              <span className="absolute -top-1 -right-1 bg-amber-400 text-amber-950 p-0.5 rounded-full shadow" title="Cấp Lãnh Đạo / Quyết Định">
                                <Award size={10} className="fill-amber-950" />
                              </span>
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border uppercase tracking-wider ${
                                isCustomer 
                                  ? "bg-blue-50 text-blue-700 border-blue-200" 
                                  : "bg-purple-50 text-purple-700 border-purple-200"
                              }`}>
                                {companyType}
                              </span>
                              {exec && (
                                <span className="bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase">
                                  HĐQT / Ban Giám Đốc
                                </span>
                              )}
                            </div>

                            <h3 
                              className="font-extrabold text-slate-900 text-base mt-1 group-hover:text-blue-600 transition-colors line-clamp-1 cursor-pointer"
                              title={fullName}
                              onClick={() => {
                                setSelectedContact(contact);
                                setDetailTab('tasks');
                              }}
                            >
                              {fullName}
                            </h3>

                            <p className="text-xs font-semibold text-slate-600 line-clamp-1">
                              {contact["Chức vụ"] || "Chức vụ chưa cập nhật"}
                              {contact["Phòng ban"] && <span className="text-slate-400 font-normal"> • {contact["Phòng ban"]}</span>}
                            </p>
                          </div>
                        </div>

                        {/* Quick Edit/Delete */}
                        <div className="flex items-center gap-1 opacity-90 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => handleOpenContactModal(contact)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all border border-slate-100 bg-white shadow-xs"
                            title="Chỉnh sửa liên hệ"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button 
                            onClick={(e) => handleDeleteContact(contact, e)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all border border-slate-100 bg-white shadow-xs"
                            title="Xóa liên hệ"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Linked Company Row */}
                      <div className="mt-3.5 p-2.5 bg-slate-50/90 rounded-2xl border border-slate-100 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <CompanyLogo name={contact["Công ty"]} size="sm" className="rounded-xl shadow-xs" />
                          <div className="min-w-0">
                            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Công ty liên kết</span>
                            <span className="font-extrabold text-slate-800 text-xs truncate block" title={contact["Công ty"]}>
                              {contact["Công ty"]}
                            </span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-[10px] text-slate-400 block font-medium">Quan hệ</span>
                          <div className="flex items-center gap-0.5 justify-end mt-0.5">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star 
                                key={i} 
                                size={10} 
                                className={i < parseInt(contact["Mức độ quan hệ"] || "3") ? "fill-amber-400 text-amber-400" : "text-slate-200 fill-slate-100"} 
                              />
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Contact Info Pills */}
                      <div className="mt-3 space-y-1.5 text-xs font-mono">
                        {contact["Điện thoại"] ? (
                          <div className="flex items-center justify-between gap-2 p-2 bg-slate-50/50 rounded-xl border border-slate-100">
                            <div className="flex items-center gap-2 min-w-0">
                              <Phone size={13} className="text-emerald-500 shrink-0" />
                              <span className="font-bold text-slate-800 truncate">{contact["Điện thoại"]}</span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0 font-sans">
                              <a 
                                href={`tel:${cleanPhone}`} 
                                className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                title="Gọi điện"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <PhoneCall size={13} />
                              </a>
                              {cleanPhone && (
                                <a 
                                  href={`https://zalo.me/${cleanPhone}`} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="px-1.5 py-0.5 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-[10px] font-bold transition-colors"
                                  title="Mở Zalo chat"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  Zalo
                                </a>
                              )}
                              <button 
                                onClick={(e) => copyToClipboard(contact["Điện thoại"], "Số điện thoại", e)}
                                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg transition-colors"
                                title="Sao chép SĐT"
                              >
                                <Copy size={12} />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="text-[11px] text-slate-400 italic p-1.5">Chưa có số điện thoại</div>
                        )}

                        {contact["Email"] && (
                          <div className="flex items-center justify-between gap-2 p-2 bg-slate-50/50 rounded-xl border border-slate-100">
                            <div className="flex items-center gap-2 min-w-0">
                              <Mail size={13} className="text-blue-500 shrink-0" />
                              <span className="text-slate-700 truncate font-sans text-xs">{contact["Email"]}</span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <a 
                                href={`mailto:${contact["Email"]}`} 
                                className="p-1 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors font-sans"
                                title="Gửi email"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Send size={12} />
                              </a>
                              <button 
                                onClick={(e) => copyToClipboard(contact["Email"], "Email", e)}
                                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg transition-colors font-sans"
                                title="Sao chép Email"
                              >
                                <Copy size={12} />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Card Footer: Activity & Task Trigger */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <button
                        onClick={() => {
                          setSelectedContact(contact);
                          setDetailTab('tasks');
                        }}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors"
                      >
                        <CheckSquare size={13} className="text-blue-500" />
                        <span>{contactTasks.length > 0 ? `${doneTasks}/${contactTasks.length} công việc` : 'Thêm công việc'}</span>
                      </button>

                      <button
                        onClick={() => {
                          setSelectedContact(contact);
                          setDetailTab('tasks');
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 rounded-xl text-xs font-bold transition-all"
                      >
                        <Eye size={13} />
                        <span>Hồ sơ</span>
                        <ChevronRight size={13} />
                      </button>
                    </div>

                  </div>
                );
              })}
            </div>
          ) : viewMode === 'table' ? (
            
            /* MODE 2: MODERN CRISP TABLE */
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200/80 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-5 py-4">Nhân sự liên hệ</th>
                      <th className="px-5 py-4">Doanh nghiệp liên kết</th>
                      <th className="px-5 py-4">Chức vụ / Phòng ban</th>
                      <th className="px-5 py-4">Phân loại</th>
                      <th className="px-5 py-4">Thông tin liên lạc</th>
                      <th className="px-5 py-4 text-center">Công việc</th>
                      <th className="px-5 py-4 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredContacts.map((contact, idx) => {
                      const companyType = getCompanyType(contact["Công ty"]);
                      const isCustomer = companyType === 'Khách hàng';
                      const contactId = contact.ID || `${contact["Tên"]}-${contact["Công ty"]}`;
                      const fullName = `${contact["Danh xưng"] ? contact["Danh xưng"] + " " : ""}${contact["Tên"] || ""}`;
                      const initials = getAvatarInitials(contact["Tên"] || "");
                      const gradientBg = getAvatarGradient(contact["Tên"] || "");
                      const exec = isExecutive(contact["Chức vụ"]);
                      const cleanPhone = (contact["Điện thoại"] || "").replace(/[^0-9+]/g, '');

                      const contactTasks = tasks[contactId] || [];
                      const doneTasks = contactTasks.filter(t => t.status === 'done').length;

                      return (
                        <tr 
                          key={contactId}
                          onClick={() => {
                            setSelectedContact(contact);
                            setDetailTab('tasks');
                          }}
                          className={`cursor-pointer transition-colors group ${isCustomer ? 'hover:bg-blue-50/40' : 'hover:bg-purple-50/40'}`}
                        >
                          {/* Person Name & Dynamic Avatar */}
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className={`h-10 w-10 rounded-2xl bg-gradient-to-br ${gradientBg} font-black text-xs flex items-center justify-center shrink-0 shadow-sm ${
                                exec ? "ring-2 ring-amber-400 ring-offset-1" : ""
                              }`}>
                                {initials}
                              </div>
                              <div>
                                <div className="font-extrabold text-slate-900 group-hover:text-blue-700 transition-colors flex items-center gap-1.5">
                                  <span>{fullName}</span>
                                  {exec && (
                                    <span title="Cấp Lãnh Đạo">
                                      <Award size={13} className="text-amber-500 shrink-0" />
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                                  <span>Quan hệ: {contact["Mức độ quan hệ"] || "3"}★</span>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Linked Company */}
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2.5">
                              <CompanyLogo name={contact["Công ty"]} size="sm" className="rounded-xl shadow-xs" />
                              <div className="font-bold text-slate-800">{contact["Công ty"]}</div>
                            </div>
                          </td>

                          {/* Position / Dept */}
                          <td className="px-5 py-3.5">
                            <div className="font-bold text-slate-700">{contact["Chức vụ"] || "Chưa rõ"}</div>
                            <div className="text-xs text-slate-400">{contact["Phòng ban"]}</div>
                          </td>

                          {/* Partner Type Badge (No awkward line wraps) */}
                          <td className="px-5 py-3.5">
                            <span className={`inline-flex items-center px-2.5 py-1 text-xs font-extrabold rounded-lg border whitespace-nowrap ${
                              isCustomer 
                                ? 'bg-blue-50 text-blue-700 border-blue-200' 
                                : 'bg-purple-50 text-purple-700 border-purple-200'
                            }`}>
                              {companyType}
                            </span>
                          </td>

                          {/* Contact Info with Call/Zalo/Copy */}
                          <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                            <div className="space-y-1">
                              {contact["Điện thoại"] && (
                                <div className="flex items-center gap-2 text-xs font-mono">
                                  <a href={`tel:${cleanPhone}`} className="font-bold text-slate-800 hover:text-blue-600 transition-colors">
                                    {contact["Điện thoại"]}
                                  </a>
                                  {cleanPhone && (
                                    <a 
                                      href={`https://zalo.me/${cleanPhone}`} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="px-1.5 py-0.2 bg-blue-500 text-white rounded text-[9px] font-bold"
                                    >
                                      Zalo
                                    </a>
                                  )}
                                </div>
                              )}
                              {contact["Email"] && (
                                <a href={`mailto:${contact["Email"]}`} className="text-xs text-slate-500 hover:text-blue-600 block truncate max-w-[180px]">
                                  {contact["Email"]}
                                </a>
                              )}
                            </div>
                          </td>

                          {/* Tasks Status */}
                          <td className="px-5 py-3.5 text-center">
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100">
                              <CheckSquare size={12} className="text-blue-500" />
                              {contactTasks.length > 0 ? `${doneTasks}/${contactTasks.length}` : '0'} việc
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="px-5 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              <button 
                                onClick={() => {
                                  setSelectedContact(contact);
                                  setDetailTab('tasks');
                                }}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-xl transition-all border border-slate-200 shadow-xs"
                                title="Xem chi tiết & công việc"
                              >
                                <Activity size={15} />
                              </button>
                              <button 
                                onClick={() => handleOpenContactModal(contact)}
                                className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all border border-slate-200 shadow-xs"
                                title="Chỉnh sửa liên hệ"
                              >
                                <Edit2 size={15} />
                              </button>
                              <button 
                                onClick={(e) => handleDeleteContact(contact, e)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all border border-slate-200 shadow-xs"
                                title="Xóa liên hệ"
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

            /* MODE 3: GROUPED BY COMPANY */
            <div className="space-y-6">
              {groupedByCompany.map(([companyName, members]) => {
                const compType = getCompanyType(companyName);
                const isCust = compType === 'Khách hàng';

                return (
                  <div key={companyName} className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
                    
                    {/* Company Group Header */}
                    <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-50 to-slate-100/60 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3.5">
                        <CompanyLogo name={companyName} size="md" className="rounded-2xl shadow-sm border border-slate-200" />
                        <div>
                          <div className="flex items-center gap-2">
                            <h2 className="text-lg font-extrabold text-slate-900">{companyName}</h2>
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                              isCust ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-purple-50 text-purple-700 border-purple-200"
                            }`}>
                              {compType}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Mạng lưới gồm <strong>{members.length}</strong> nhân sự liên hệ
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-600 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-xs">
                          {members.filter(m => isExecutive(m["Chức vụ"])).length} Lãnh đạo cấp cao
                        </span>
                      </div>
                    </div>

                    {/* Member Cards Grid */}
                    <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {members.map(contact => {
                        const contactId = contact.ID || `${contact["Tên"]}-${contact["Công ty"]}`;
                        const fullName = `${contact["Danh xưng"] ? contact["Danh xưng"] + " " : ""}${contact["Tên"] || ""}`;
                        const initials = getAvatarInitials(contact["Tên"] || "");
                        const gradientBg = getAvatarGradient(contact["Tên"] || "");
                        const exec = isExecutive(contact["Chức vụ"]);
                        const cleanPhone = (contact["Điện thoại"] || "").replace(/[^0-9+]/g, '');

                        return (
                          <div 
                            key={contactId}
                            onClick={() => {
                              setSelectedContact(contact);
                              setDetailTab('tasks');
                            }}
                            className="bg-slate-50/70 hover:bg-white p-4 rounded-2xl border border-slate-200/70 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
                          >
                            <div className="flex items-start gap-3">
                              <div className={`h-11 w-11 rounded-2xl bg-gradient-to-br ${gradientBg} font-black text-xs flex items-center justify-center shrink-0 shadow-sm ${
                                exec ? "ring-2 ring-amber-400 ring-offset-1" : ""
                              }`}>
                                {initials}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="font-extrabold text-slate-900 text-sm truncate flex items-center gap-1">
                                  <span>{fullName}</span>
                                  {exec && <Award size={12} className="text-amber-500 shrink-0" />}
                                </div>
                                <p className="text-xs font-bold text-blue-700 truncate mt-0.5">
                                  {contact["Chức vụ"] || "Chưa rõ"}
                                </p>
                                <p className="text-[11px] text-slate-400 truncate">
                                  {contact["Phòng ban"] || "Chưa phân phòng ban"}
                                </p>
                              </div>
                            </div>

                            {contact["Điện thoại"] && (
                              <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-between text-xs font-mono">
                                <span className="font-bold text-slate-700">{contact["Điện thoại"]}</span>
                                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                  <a href={`tel:${cleanPhone}`} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-md">
                                    <PhoneCall size={12} />
                                  </a>
                                  {cleanPhone && (
                                    <a 
                                      href={`https://zalo.me/${cleanPhone}`} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="px-1.5 py-0.2 bg-blue-500 text-white rounded text-[9px] font-bold"
                                    >
                                      Zalo
                                    </a>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                  </div>
                );
              })}
            </div>
          )

        ) : (
          <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center space-y-3">
            <UserCircle size={44} className="mx-auto text-slate-300" />
            <h3 className="text-base font-extrabold text-slate-800">Không tìm thấy liên hệ nào</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Không có liên hệ phù hợp với từ khóa "{searchTerm}" hoặc bộ lọc hiện tại.
            </p>
          </div>
        )}

      </div>

      {/* 1. Dynamic Add/Edit Contact Modal */}
      {isContactModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-lg flex flex-col max-h-[90vh] overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-slate-900 to-indigo-950 text-white">
              <h3 className="text-lg font-extrabold flex items-center gap-2">
                <UserCircle className="text-blue-400" size={22} />
                <span>{editingContact ? 'Cập Nhật Hồ Sơ Liên Hệ' : 'Thêm Liên Hệ Mới'}</span>
              </h3>
              <button onClick={() => setIsContactModalOpen(false)} className="text-slate-400 hover:text-white transition-colors p-1.5 hover:bg-white/10 rounded-full">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveContact} className="p-6 overflow-y-auto flex-1 space-y-4">
              {/* Type Switcher */}
              <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl">
                <button
                  type="button"
                  onClick={() => {
                    setContactType('customer');
                    if (customers.length > 0) {
                      setContactFormData(prev => ({ ...prev, "Công ty": customers[0]["Customer_ID"] }));
                    }
                  }}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${contactType === 'customer' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  Trực thuộc Khách hàng
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setContactType('supplier');
                    if (suppliers.length > 0) {
                      setContactFormData(prev => ({ ...prev, "Công ty": suppliers[0]["Tên Nhà Cung Cấp"] || suppliers[0]["Mã nhà cung cấp"] }));
                    }
                  }}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${contactType === 'supplier' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  Trực thuộc Nhà cung cấp
                </button>
              </div>

              {/* Dynamic Company dropdown linkage */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                  {contactType === 'customer' ? 'Chọn Khách hàng liên kết' : 'Chọn Nhà cung cấp liên kết'}
                </label>
                <select
                  value={contactFormData["Công ty"]}
                  onChange={(e) => setContactFormData({ ...contactFormData, "Công ty": e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
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
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Danh xưng</label>
                  <select
                    value={contactFormData["Danh xưng"]}
                    onChange={(e) => setContactFormData({ ...contactFormData, "Danh xưng": e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                  >
                    <option value="Mr">Mr (Anh)</option>
                    <option value="Mrs">Mrs (Chị)</option>
                    <option value="Ms">Ms (Cô)</option>
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Họ và Tên</label>
                  <input
                    type="text"
                    required
                    value={contactFormData["Tên"]}
                    onChange={(e) => setContactFormData({ ...contactFormData, "Tên": e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                    placeholder="VD: Nguyễn Văn A"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Chức vụ</label>
                  <input
                    type="text"
                    value={contactFormData["Chức vụ"]}
                    onChange={(e) => setContactFormData({ ...contactFormData, "Chức vụ": e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                    placeholder="VD: Giám đốc / Trưởng phòng"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Phòng ban</label>
                  <input
                    type="text"
                    value={contactFormData["Phòng ban"]}
                    onChange={(e) => setContactFormData({ ...contactFormData, "Phòng ban": e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                    placeholder="VD: Kế hoạch - Vật tư"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Số điện thoại</label>
                  <input
                    type="tel"
                    value={contactFormData["Điện thoại"]}
                    onChange={(e) => setContactFormData({ ...contactFormData, "Điện thoại": e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none font-mono"
                    placeholder="VD: 0912..."
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Email</label>
                  <input
                    type="email"
                    value={contactFormData["Email"]}
                    onChange={(e) => setContactFormData({ ...contactFormData, "Email": e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                    placeholder="VD: name@company.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Mức độ quan hệ</label>
                  <select
                    value={contactFormData["Mức độ quan hệ"]}
                    onChange={(e) => setContactFormData({ ...contactFormData, "Mức độ quan hệ": e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                  >
                    <option value="1">1 sao - Mới quen</option>
                    <option value="2">2 sao - Thường xuyên liên hệ</option>
                    <option value="3">3 sao - Tin cậy</option>
                    <option value="4">4 sao - Đối tác mật thiết</option>
                    <option value="5">5 sao - Trọng yếu chiến lược</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Ghi chú phụ trách</label>
                  <input
                    type="text"
                    value={contactFormData["Phụ trách"]}
                    onChange={(e) => setContactFormData({ ...contactFormData, "Phụ trách": e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                    placeholder="Nhân viên TSG phụ trách"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsContactModalOpen(false)} 
                  className="px-4.5 py-2.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
                >
                  Hủy
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-500/25 transition-all"
                >
                  {editingContact ? 'Lưu cập nhật' : 'Thêm mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Interactive Contact Details Modal (Tasks & Projects Panel) */}
      {selectedContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden">
            
            {/* Modal Header */}
            <div className="px-6 py-4.5 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-slate-900 to-indigo-950 text-white">
              <div className="flex items-center gap-3.5">
                <CompanyLogo name={selectedContact["Công ty"]} size="sm" className="rounded-xl shadow-xs" />
                <div>
                  <h3 className="text-base sm:text-lg font-extrabold text-white flex items-center gap-2">
                    <span>{selectedContact["Danh xưng"] ? `${selectedContact["Danh xưng"]} ` : ''}{selectedContact["Tên"]}</span>
                    {isExecutive(selectedContact["Chức vụ"]) && (
                      <span className="bg-amber-400 text-amber-950 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase">
                        Lãnh đạo
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    {selectedContact["Chức vụ"]} • {selectedContact["Công ty"]}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedContact(null)} 
                className="text-slate-400 hover:text-white transition-colors p-1.5 hover:bg-white/10 rounded-full"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body Grid */}
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
              
              {/* Left Column: Linkage Profile Info */}
              <div className="w-full md:w-80 lg:w-96 border-b md:border-b-0 md:border-r border-slate-100 p-5 overflow-y-auto space-y-4 bg-slate-50/60">
                
                {/* Contact Card */}
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 space-y-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Kênh kết nối</span>
                  
                  <div className="space-y-2">
                    {selectedContact["Điện thoại"] && (
                      <div className="flex items-center justify-between gap-2 text-sm text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-100 font-mono">
                        <a 
                          href={`tel:${selectedContact["Điện thoại"]}`} 
                          className="flex items-center gap-2 hover:text-blue-600 transition-colors truncate font-bold"
                          title="Click để gọi điện"
                        >
                          <Phone size={14} className="text-emerald-500 shrink-0" />
                          <span className="truncate">{selectedContact["Điện thoại"]}</span>
                        </a>
                        <div className="flex items-center gap-1 shrink-0 font-sans">
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(selectedContact["Điện thoại"]);
                              toast.success("Đã sao chép số điện thoại!");
                            }}
                            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-all"
                            title="Sao chép SĐT"
                          >
                            <Copy size={13} />
                          </button>
                        </div>
                      </div>
                    )}
                    
                    {selectedContact["Email"] && (
                      <div className="flex items-center justify-between gap-2 text-xs text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <a 
                          href={`mailto:${selectedContact["Email"]}`} 
                          className="flex items-center gap-2 text-blue-600 hover:underline truncate font-medium"
                          title="Click để soạn email"
                        >
                          <Mail size={14} className="text-blue-500 shrink-0" />
                          <span className="truncate">{selectedContact["Email"]}</span>
                        </a>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(selectedContact["Email"]);
                            toast.success("Đã sao chép email!");
                          }}
                          className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-all shrink-0"
                          title="Sao chép email"
                        >
                          <Copy size={13} />
                        </button>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Phòng ban</span>
                        <div className="font-extrabold text-slate-700 mt-0.5">{selectedContact["Phòng ban"] || "Chưa rõ"}</div>
                      </div>
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Quan hệ</span>
                        <div className="font-extrabold text-slate-700 mt-0.5">{selectedContact["Mức độ quan hệ"] || "3"} Sao</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Connected corporate detail */}
                {(() => {
                  const compDetails = getCompanyDetails(selectedContact["Công ty"]);
                  if (!compDetails) return null;
                  return (
                    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Hồ sơ Doanh nghiệp</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${compDetails.type === 'Khách hàng' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>
                          {compDetails.type}
                        </span>
                      </div>
                      
                      <div className="font-extrabold text-slate-800 text-sm leading-tight">
                        {compDetails.name}
                      </div>

                      <div className="text-xs text-slate-500 space-y-1 pt-1 border-t border-slate-100">
                        <div><strong>Mã:</strong> {compDetails.code}</div>
                        <div className="line-clamp-2"><strong>Địa chỉ:</strong> {compDetails.address}</div>
                        <div><strong>Trạng thái:</strong> {compDetails.status}</div>
                      </div>
                    </div>
                  );
                })()}

              </div>

              {/* Right Column: Interactive Tabs for Tasks, Projects, and Activities */}
              <div className="flex-1 flex flex-col overflow-hidden">
                
                {/* Tabs Header */}
                <div className="flex border-b border-slate-200 bg-white px-5 pt-3 gap-2">
                  <button 
                    onClick={() => setDetailTab('tasks')}
                    className={`pb-3 px-3 text-xs font-extrabold border-b-2 transition-all flex items-center gap-1.5 ${
                      detailTab === 'tasks' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-700'
                    }`}
                  >
                    <CheckSquare size={15} />
                    <span>Công việc & Lịch hẹn ({(tasks[selectedContact.ID || `${selectedContact["Tên"]}-${selectedContact["Công ty"]}`] || []).length})</span>
                  </button>
                  <button 
                    onClick={() => setDetailTab('projects')}
                    className={`pb-3 px-3 text-xs font-extrabold border-b-2 transition-all flex items-center gap-1.5 ${
                      detailTab === 'projects' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-700'
                    }`}
                  >
                    <Folder size={15} />
                    <span>Dự án hợp tác ({(projects[selectedContact.ID || `${selectedContact["Tên"]}-${selectedContact["Công ty"]}`] || []).length})</span>
                  </button>
                  <button 
                    onClick={() => setDetailTab('activities')}
                    className={`pb-3 px-3 text-xs font-extrabold border-b-2 transition-all flex items-center gap-1.5 ${
                      detailTab === 'activities' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-700'
                    }`}
                  >
                    <Clock size={15} />
                    <span>Nhật ký tương tác ({(activities[selectedContact.ID || `${selectedContact["Tên"]}-${selectedContact["Công ty"]}`] || []).length})</span>
                  </button>
                </div>

                {/* Tab Content */}
                <div className="flex-1 p-6 overflow-y-auto">
                  
                  {/* 1. TASKS TAB */}
                  {detailTab === 'tasks' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Danh sách việc cần làm</span>
                        <button
                          onClick={() => setShowAddTaskForm(!showAddTaskForm)}
                          className="flex items-center gap-1.5 text-xs font-extrabold text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-200 transition-colors"
                        >
                          <Plus size={14} />
                          <span>Thêm việc mới</span>
                        </button>
                      </div>

                      {showAddTaskForm && (
                        <form onSubmit={handleAddTask} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 animate-fade-in">
                          <input 
                            type="text" 
                            required 
                            placeholder="Tiêu đề công việc (VD: Gửi báo giá mẫu thùng...)" 
                            value={taskForm.title}
                            onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs focus:ring-2 focus:ring-blue-500/20 outline-none"
                          />
                          <div className="grid grid-cols-3 gap-2">
                            <input 
                              type="date" 
                              value={taskForm.dueDate}
                              onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                              className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs outline-none"
                            />
                            <select
                              value={taskForm.priority}
                              onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value as any })}
                              className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs outline-none"
                            >
                              <option value="low">Ưu tiên thấp</option>
                              <option value="medium">Ưu tiên vừa</option>
                              <option value="high">Ưu tiên cao</option>
                            </select>
                            <button type="submit" className="bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors">
                              Lưu công việc
                            </button>
                          </div>
                        </form>
                      )}

                      <div className="space-y-2">
                        {(() => {
                          const contactId = selectedContact.ID || `${selectedContact["Tên"]}-${selectedContact["Công ty"]}`;
                          const contactTasks = tasks[contactId] || [];
                          if (contactTasks.length === 0) {
                            return <div className="text-center py-8 text-slate-400 text-xs italic">Chưa có công việc nào được gán cho liên hệ này.</div>;
                          }
                          return contactTasks.map(task => (
                            <div key={task.id} className="flex items-center justify-between p-3 bg-white rounded-2xl border border-slate-200 hover:border-blue-200 transition-all">
                              <div className="flex items-center gap-3">
                                <input 
                                  type="checkbox" 
                                  checked={task.status === 'done'} 
                                  onChange={() => handleToggleTaskStatus(task.id)}
                                  className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                                />
                                <div>
                                  <span className={`text-xs font-bold block ${task.status === 'done' ? 'line-through text-slate-400' : 'text-slate-800'}`}>
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
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Dự án triển khai cùng đối tác</span>
                        <button
                          onClick={() => setShowAddProjectForm(!showAddProjectForm)}
                          className="flex items-center gap-1.5 text-xs font-extrabold text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-200 transition-colors"
                        >
                          <Plus size={14} />
                          <span>Tạo dự án mới</span>
                        </button>
                      </div>

                      {showAddProjectForm && (
                        <form onSubmit={handleAddProject} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 animate-fade-in">
                          <input 
                            type="text" 
                            required 
                            placeholder="Tên dự án (VD: Phát triển dòng bao bì Johnnie Walker 2026...)" 
                            value={projectForm.name}
                            onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs focus:ring-2 focus:ring-blue-500/20 outline-none"
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <input 
                              type="text" 
                              placeholder="Mã dự án (Tùy chọn)" 
                              value={projectForm.code}
                              onChange={(e) => setProjectForm({ ...projectForm, code: e.target.value })}
                              className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs outline-none"
                            />
                            <button type="submit" className="bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors">
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
                            return <div className="text-center py-8 text-slate-400 text-xs italic">Chưa có dự án nào liên kết với đối tác này.</div>;
                          }
                          return contactProjects.map(proj => (
                            <div key={proj.id} className="flex items-center justify-between p-3 bg-white rounded-2xl border border-slate-200 hover:border-blue-200 transition-all">
                              <div>
                                <span className="text-xs font-extrabold text-slate-800 block">{proj.name}</span>
                                <span className="text-[10px] text-blue-600 font-mono font-bold">Mã: {proj.code}</span>
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
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Nhật ký trao đổi & Ghi chú</span>
                        <button
                          onClick={() => setShowAddActivityForm(!showAddActivityForm)}
                          className="flex items-center gap-1.5 text-xs font-extrabold text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-200 transition-colors"
                        >
                          <Plus size={14} />
                          <span>Thêm ghi chú</span>
                        </button>
                      </div>

                      {showAddActivityForm && (
                        <form onSubmit={handleAddActivity} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 animate-fade-in">
                          <textarea 
                            required 
                            rows={3}
                            placeholder="Nội dung cuộc gọi, cuộc họp hoặc thỏa thuận..." 
                            value={activityForm.content}
                            onChange={(e) => setActivityForm({ ...activityForm, content: e.target.value })}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs focus:ring-2 focus:ring-blue-500/20 outline-none"
                          />
                          <div className="flex justify-end gap-2">
                            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors">
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
                            return <div className="text-center py-8 text-slate-400 text-xs italic">Chưa có nhật ký trao đổi nào.</div>;
                          }
                          return contactActivities.map(act => (
                            <div key={act.id} className="p-3 bg-white rounded-2xl border border-slate-200 space-y-1">
                              <div className="flex items-center justify-between text-[10px] text-slate-400">
                                <span>{act.timestamp} • {act.user}</span>
                                <button onClick={() => handleDeleteActivity(act.id)} className="text-slate-300 hover:text-red-600 p-0.5">
                                  <Trash2 size={11} />
                                </button>
                              </div>
                              <p className="text-xs text-slate-700 font-medium">{act.content}</p>
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
