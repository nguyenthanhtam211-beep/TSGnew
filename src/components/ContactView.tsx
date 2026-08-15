import * as XLSX from 'xlsx';
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, Building2, UserCircle, Briefcase, Phone, Mail, CheckCircle, 
  Plus, Eye, Edit2, Trash2, X, PlusCircle, Calendar, CheckSquare, 
  Clock, AlertCircle, Bookmark, Folder, ChevronRight, Activity, Tag,
  Download, MessageSquare, ClipboardList, Copy, Check,
  LayoutGrid, List, Users, Shield, Star, ExternalLink,
  PhoneCall, Send, FileSpreadsheet, Layers, MessageCircle,
  FileText, ArrowUpRight, Cloud, CloudUpload, Sparkles, Filter, ChevronLeft
} from 'lucide-react';
import CompanyLogo from './CompanyLogo';
import { db } from '../firebase';
import { collection, doc, setDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/errorHelper';
import { getItemKey } from '../hooks/useFirestoreCollection';
import { formatVietnamesePhone, formatContactFullName, getRawCallablePhone } from '../utils/formatters';
import GoogleDriveSyncModal from './GoogleDriveSyncModal';
import { toast } from 'react-hot-toast';

interface ContactViewProps {
  contacts: any[];
  customers?: any[];
  suppliers?: any[];
  products?: any[];
  poHeaders?: any[];
  deliveries?: any[];
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

// Apple Avatar Initials
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

function getContactSortKey(name: string): string {
  const clean = formatContactFullName(name);
  const parts = clean.split(' ').filter(Boolean);
  const primaryName = parts[parts.length - 1] || clean;
  return primaryName.charAt(0).toUpperCase();
}

export default function ContactView({ 
  contacts = [], 
  customers = [], 
  suppliers = [],
  products = [],
  poHeaders = [],
  deliveries = [],
  targetContactId = null,
  onClearTargetContact,
  onNavigateToCustomer,
  onNavigateToSupplier
}: ContactViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<'all' | 'customers' | 'suppliers' | 'executives' | 'starred'>('all');
  const [selectedContact, setSelectedContact] = useState<any | null>(null);
  const [detailTab, setDetailTab] = useState<'dossier' | 'tasks' | 'projects' | 'activities'>('dossier');
  const [showMobileDetail, setShowMobileDetail] = useState(false);

  // Google Drive 2-Way Sync Modal State
  const [isDriveModalOpen, setIsDriveModalOpen] = useState(false);

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
        setShowMobileDetail(true);
      }
      if (onClearTargetContact) onClearTargetContact();
    }
  }, [targetContactId, contacts, onClearTargetContact]);

  // Set default selected contact on desktop if none selected
  useEffect(() => {
    if (!selectedContact && contacts.length > 0) {
      setSelectedContact(contacts[0]);
    }
  }, [contacts]);

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

  // Load from local storage
  useEffect(() => {
    try {
      const savedTasks = localStorage.getItem('tsg_contact_tasks');
      const savedProjects = localStorage.getItem('tsg_contact_projects');
      const savedActivities = localStorage.getItem('tsg_contact_activities');
      if (savedTasks) setTasks(JSON.parse(savedTasks));
      if (savedProjects) setProjects(JSON.parse(savedProjects));
      if (savedActivities) setActivities(JSON.parse(savedActivities));
    } catch (e) {
      console.warn("Could not load contact extra data from localStorage", e);
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

  // Helper to determine if company is Customer or Supplier
  const getCompanyType = (companyName: string) => {
    if (!companyName) return 'Khách hàng';
    const compLower = companyName.toLowerCase();
    const isSupp = suppliers.some(s => 
      s["Mã nhà cung cấp"]?.toLowerCase() === compLower || 
      s["Tên Nhà Cung Cấp"]?.toLowerCase().includes(compLower)
    );
    if (isSupp) return 'Nhà cung cấp';

    const isCust = customers.some(c => 
      c["Customer_ID"]?.toLowerCase() === compLower || 
      c["Tên đầy đủ"]?.toLowerCase().includes(compLower)
    );
    if (isCust) return 'Khách hàng';

    if (compLower.includes('giấy') || compLower.includes('mực') || compLower.includes('nhựa') || compLower.includes('in ấn') || compLower.includes('vật tư')) {
      return 'Nhà cung cấp';
    }
    return 'Khách hàng';
  };

  // Filtered Contacts
  const filteredContacts = useMemo(() => {
    return contacts.filter(c => {
      const type = getCompanyType(c["Công ty"]);
      const isCust = type === 'Khách hàng';
      const isSupp = type === 'Nhà cung cấp';
      const exec = isExecutive(c["Chức vụ"]);
      const isStarred = Number(c["Mức độ quan hệ"] || 0) >= 4;

      if (selectedGroup === 'customers' && !isCust) return false;
      if (selectedGroup === 'suppliers' && !isSupp) return false;
      if (selectedGroup === 'executives' && !exec) return false;
      if (selectedGroup === 'starred' && !isStarred) return false;

      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchName = c["Tên"]?.toLowerCase().includes(search);
        const matchComp = c["Công ty"]?.toLowerCase().includes(search);
        const matchRole = c["Chức vụ"]?.toLowerCase().includes(search);
        const matchPhone = c["Điện thoại"]?.includes(search);
        const matchEmail = c["Email"]?.toLowerCase().includes(search);
        return matchName || matchComp || matchRole || matchPhone || matchEmail;
      }

      return true;
    });
  }, [contacts, selectedGroup, searchTerm, suppliers, customers]);

  // Group contacts alphabetically A-Z
  const groupedContacts = useMemo(() => {
    const groups: { [letter: string]: any[] } = {};
    const sorted = [...filteredContacts].sort((a, b) => {
      const nameA = formatContactFullName(a["Tên"] || "");
      const nameB = formatContactFullName(b["Tên"] || "");
      const lastA = nameA.split(' ').pop() || nameA;
      const lastB = nameB.split(' ').pop() || nameB;
      return lastA.localeCompare(lastB, 'vi');
    });

    sorted.forEach(c => {
      const letter = getContactSortKey(c["Tên"] || "") || '#';
      if (!groups[letter]) groups[letter] = [];
      groups[letter].push(c);
    });

    return groups;
  }, [filteredContacts]);

  // Letters array
  const letters = useMemo(() => Object.keys(groupedContacts).sort(), [groupedContacts]);

  // Modal handlers
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
      
      if (selectedContact && (selectedContact.id === docId || selectedContact.ID === docId)) {
        setSelectedContact({ ...selectedContact, ...payload });
      }
      toast.success(editingContact ? "Đã cập nhật hồ sơ liên hệ!" : "Đã thêm liên hệ mới!", { id: toastId });
      setIsContactModalOpen(false);
    } catch (error) {
      console.warn("Contact save error:", error);
      toast.error("Không thể lưu liên hệ! Vui lòng thử lại.", { id: toastId });
    }
  };

  const handleDeleteContact = async (contact: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm(`Bạn có chắc chắn muốn xóa liên hệ "${contact["Tên"]}" khỏi danh bạ?`)) return;
    const loadingToast = toast.loading("Đang xóa liên hệ...");
    try {
      const targetId = contact.id || getItemKey(contact, 'contacts') || contact.ID || `${contact["Tên"]}-${contact["Công ty"]}`;
      const docId = String(targetId).replace(/[/\\#?%[\]\s.]+/g, '_');
      
      await Promise.race([
        setDoc(doc(db, 'contacts', docId), { ...contact, isDeleted: true, deletedAt: new Date().toISOString() }, { merge: true }),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 7000))
      ]);
      
      if (selectedContact && (selectedContact.id === docId || selectedContact.ID === contact.ID)) {
        setSelectedContact(null);
        setShowMobileDetail(false);
      }
      toast.success("Đã xóa liên hệ thành công!", { id: loadingToast });
    } catch (error) {
      console.warn("Contact delete error:", error);
      toast.error("Không thể xóa liên hệ! Vui lòng thử lại.", { id: loadingToast });
    }
  };

  // Task Actions
  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskForm.title || !selectedContact) return;
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
    toast.success("Đã tạo công việc theo dõi!");
  };

  const handleToggleTask = (taskId: string) => {
    if (!selectedContact) return;
    const contactId = selectedContact.ID || `${selectedContact["Tên"]}-${selectedContact["Công ty"]}`;
    const newTasks = { ...tasks };
    if (newTasks[contactId]) {
      newTasks[contactId] = newTasks[contactId].map(t => 
        t.id === taskId ? { ...t, status: t.status === 'done' ? 'todo' : 'done' } : t
      );
      saveTasks(newTasks);
    }
  };

  const handleDeleteTask = (taskId: string) => {
    if (!selectedContact) return;
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
    if (!projectForm.name || !selectedContact) return;
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
    toast.success("Đã thêm dự án!");
  };

  const handleDeleteProject = (projectId: string) => {
    if (!selectedContact) return;
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
    if (!activityForm.content || !selectedContact) return;
    const contactId = selectedContact.ID || `${selectedContact["Tên"]}-${selectedContact["Công ty"]}`;
    const newAct: ActivityLog = {
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
    toast.success("Đã ghi nhật ký gặp gỡ!");
  };

  const handleDeleteActivity = (actId: string) => {
    if (!selectedContact) return;
    const contactId = selectedContact.ID || `${selectedContact["Tên"]}-${selectedContact["Công ty"]}`;
    const newActs = { ...activities };
    if (newActs[contactId]) {
      newActs[contactId] = newActs[contactId].filter(a => a.id !== actId);
      saveActivities(newActs);
    }
  };

  const handleExportExcel = () => {
    try {
      const exportData = filteredContacts.map(c => {
        const cleanName = formatContactFullName(c["Tên"] || "");
        const formattedPhone = formatVietnamesePhone(c["Điện thoại"]);
        return {
          "Danh xưng": c["Danh xưng"] || "Mr",
          "Họ và Tên": cleanName,
          "Chức vụ": c["Chức vụ"] || "",
          "Phòng ban": c["Phòng ban"] || "",
          "Công ty": c["Công ty"] || "",
          "Phân loại": getCompanyType(c["Công ty"]),
          "Số điện thoại": formattedPhone,
          "Email": c["Email"] || "",
          "Mức độ quan hệ": c["Mức độ quan hệ"] ? `${c["Mức độ quan hệ"]} sao` : "3 sao",
          "Phụ trách": c["Phụ trách"] || ""
        };
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Danh_Ba_Apple");
      XLSX.writeFile(wb, `TSG_Danh_Ba_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success("Đã xuất danh bạ thành công!");
    } catch (e: any) {
      toast.error("Lỗi xuất Excel: " + e.message);
    }
  };

  // Selected contact details
  const selectedContactId = selectedContact ? (selectedContact.ID || `${selectedContact["Tên"]}-${selectedContact["Công ty"]}`) : null;
  const currentTasks = selectedContactId ? (tasks[selectedContactId] || []) : [];
  const currentProjects = selectedContactId ? (projects[selectedContactId] || []) : [];
  const currentActivities = selectedContactId ? (activities[selectedContactId] || []) : [];

  const selectedCleanName = selectedContact ? formatContactFullName(selectedContact["Tên"] || "") : '';
  const selectedFullName = selectedContact ? `${selectedContact["Danh xưng"] ? selectedContact["Danh xưng"] + " " : ""}${selectedCleanName}` : '';
  const selectedInitials = selectedContact ? getAvatarInitials(selectedCleanName) : 'TS';
  const selectedCleanPhone = selectedContact ? getRawCallablePhone(selectedContact["Điện thoại"]) : '';
  const selectedFormattedPhone = selectedContact ? formatVietnamesePhone(selectedContact["Điện thoại"]) : '';
  const selectedCompType = selectedContact ? getCompanyType(selectedContact["Công ty"]) : 'Khách hàng';
  const selectedIsCustomer = selectedCompType === 'Khách hàng';
  const selectedIsExec = selectedContact ? isExecutive(selectedContact["Chức vụ"]) : false;

  return (
    <div className="space-y-4 max-w-[1400px] mx-auto animate-fade-in pb-12">
      
      {/* Top Header - Apple macOS Toolbar Style */}
      <div className="bg-white/80 backdrop-blur-xl border border-slate-200/80 rounded-3xl p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#0071E3] to-blue-700 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <UserCircle size={22} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                Danh Bạ Liên Hệ
                <span className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-100 px-2.5 py-0.5 rounded-full font-mono">
                  {contacts.length} nhân sự
                </span>
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Quản trị mạng lưới liên hệ doanh nghiệp chuẩn Apple Contacts • Đồng bộ Google Drive 2 chiều
              </p>
            </div>
          </div>
        </div>

        {/* Toolbar Action Buttons */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto flex-wrap">
          {/* Google Drive Master Sync Button */}
          <button
            onClick={() => setIsDriveModalOpen(true)}
            className="flex-1 sm:flex-none px-3.5 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/80 hover:border-blue-300 text-blue-900 font-semibold rounded-2xl text-xs flex items-center justify-center gap-1.5 shadow-2xs hover:shadow-xs transition-all active:scale-98"
            title="Kho Dữ Liệu Lưu Trữ & Đồng Bộ 2 Chiều Google Drive"
          >
            <Cloud size={15} className="text-[#0071E3]" />
            <span>Kho Google Drive</span>
          </button>

          {/* Export Excel */}
          <button
            onClick={handleExportExcel}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-2xl text-xs flex items-center gap-1.5 transition-all shadow-2xs"
            title="Xuất file Excel"
          >
            <FileSpreadsheet size={15} className="text-emerald-600" />
            <span className="hidden sm:inline">Xuất Excel</span>
          </button>

          {/* Add Contact */}
          <button
            onClick={() => handleOpenContactModal()}
            className="px-4 py-2 bg-[#0071E3] hover:bg-[#0066D6] text-white font-semibold rounded-2xl text-xs flex items-center gap-1.5 shadow-md shadow-blue-500/20 transition-all active:scale-98"
          >
            <Plus size={16} />
            <span>Thêm liên hệ</span>
          </button>
        </div>
      </div>

      {/* Main Apple 3-Column / Master-Detail Container */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-[720px]">
        
        {/* Pane 1: Group Filter Sidebar (Desktop 2 cols) */}
        <div className="lg:col-span-3 bg-white/70 backdrop-blur-xl border border-slate-200/80 rounded-3xl p-4 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-2">
              Nhóm Danh Bạ
            </div>

            <div className="space-y-1">
              {[
                { key: 'all', label: 'Tất cả liên hệ', count: contacts.length, icon: Users, color: 'text-slate-700' },
                { key: 'customers', label: 'Khách hàng', count: contacts.filter(c => getCompanyType(c["Công ty"]) === 'Khách hàng').length, icon: Building2, color: 'text-blue-600' },
                { key: 'suppliers', label: 'Nhà cung cấp', count: contacts.filter(c => getCompanyType(c["Công ty"]) === 'Nhà cung cấp').length, icon: Layers, color: 'text-purple-600' },
                { key: 'executives', label: 'Ban Lãnh đạo', count: contacts.filter(c => isExecutive(c["Chức vụ"])).length, icon: Shield, color: 'text-amber-600' },
                { key: 'starred', label: 'Đầu mối chiến lược (4-5★)', count: contacts.filter(c => Number(c["Mức độ quan hệ"] || 0) >= 4).length, icon: Star, color: 'text-orange-500' },
              ].map(group => {
                const Icon = group.icon;
                const active = selectedGroup === group.key;
                return (
                  <button
                    key={group.key}
                    onClick={() => {
                      setSelectedGroup(group.key as any);
                      setShowMobileDetail(false);
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all ${
                      active 
                        ? 'bg-[#0071E3] text-white shadow-md shadow-blue-500/20' 
                        : 'text-slate-700 hover:bg-slate-100/80'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon size={16} className={active ? 'text-white' : group.color} />
                      <span>{group.label}</span>
                    </div>
                    <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full ${
                      active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500 font-medium'
                    }`}>
                      {group.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Google Drive Status Widget in Sidebar */}
          <div className="p-3.5 bg-gradient-to-br from-blue-50/80 to-slate-50 rounded-2xl border border-blue-100/60 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
              <Cloud size={15} className="text-[#0071E3]" />
              <span>Google Drive Sync</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Dữ liệu được lưu trữ trên master spreadsheet. Bạn có thể mở trực tiếp hoặc tải .xlsx về máy.
            </p>
            <button
              onClick={() => setIsDriveModalOpen(true)}
              className="w-full py-1.5 bg-white hover:bg-blue-50 border border-slate-200 text-blue-700 font-semibold rounded-xl text-xs transition-colors flex items-center justify-center gap-1 shadow-2xs"
            >
              <span>Quản lý Kho Drive</span>
              <ArrowUpRight size={13} />
            </button>
          </div>
        </div>

        {/* Pane 2: Alphabetical Contact List (Desktop 4 cols) */}
        <div className={`lg:col-span-4 bg-white/80 backdrop-blur-xl border border-slate-200/80 rounded-3xl p-4 shadow-sm flex flex-col ${
          showMobileDetail ? 'hidden lg:flex' : 'flex'
        }`}>
          
          {/* Apple Spotlight Search Input */}
          <div className="relative mb-3">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo tên, công ty, SĐT..."
              className="w-full pl-10 pr-9 py-2.5 bg-slate-100/80 hover:bg-slate-100 focus:bg-white border border-transparent focus:border-blue-400 rounded-2xl text-xs sm:text-sm outline-none transition-all placeholder:text-slate-400"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* List grouped by Letter Index A-Z */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-1 mobile-scroll-x max-h-[640px]">
            {filteredContacts.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-xs">
                <UserCircle size={36} className="mx-auto mb-2 opacity-40 text-slate-400" />
                <p>Không tìm thấy liên hệ phù hợp</p>
              </div>
            ) : (
              letters.map(letter => (
                <div key={letter} className="space-y-1">
                  {/* Alphabet Letter Header */}
                  <div className="sticky top-0 bg-white/90 backdrop-blur-md px-3 py-1 text-[11px] font-black text-slate-400 font-mono tracking-wider border-b border-slate-100 z-10">
                    {letter}
                  </div>

                  {groupedContacts[letter].map(contact => {
                    const contactId = contact.ID || `${contact["Tên"]}-${contact["Công ty"]}`;
                    const isSelected = selectedContactId === contactId;
                    const cleanName = formatContactFullName(contact["Tên"] || "");
                    const fullName = `${contact["Danh xưng"] ? contact["Danh xưng"] + " " : ""}${cleanName}`;
                    const initials = getAvatarInitials(cleanName);
                    const exec = isExecutive(contact["Chức vụ"]);
                    const compType = getCompanyType(contact["Công ty"]);
                    const isCustomer = compType === 'Khách hàng';
                    const formattedPhone = formatVietnamesePhone(contact["Điện thoại"]);

                    return (
                      <div
                        key={contactId}
                        onClick={() => {
                          setSelectedContact(contact);
                          setShowMobileDetail(true);
                        }}
                        className={`p-3 rounded-2xl cursor-pointer transition-all flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'bg-[#0071E3] text-white shadow-md shadow-blue-500/20'
                            : 'hover:bg-slate-100/70 text-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Circular Apple Avatar */}
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 shadow-2xs ${
                            isSelected
                              ? 'bg-white/20 text-white'
                              : exec 
                              ? 'bg-amber-100 text-amber-900 border border-amber-300/60'
                              : isCustomer 
                              ? 'bg-blue-100 text-blue-900' 
                              : 'bg-purple-100 text-purple-900'
                          }`}>
                            {initials}
                          </div>

                          <div className="min-w-0">
                            <div className="font-bold text-xs sm:text-sm truncate flex items-center gap-1.5">
                              <span>{fullName}</span>
                              {exec && (
                                <span className={`text-[9px] px-1 rounded font-semibold ${
                                  isSelected ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
                                }`}>
                                  Lãnh đạo
                                </span>
                              )}
                            </div>
                            <div className={`text-[11px] truncate mt-0.5 ${
                              isSelected ? 'text-blue-100' : 'text-slate-500'
                            }`}>
                              {contact["Chức vụ"] || "Chức vụ chưa cập nhật"} • {contact["Công ty"]}
                            </div>
                          </div>
                        </div>

                        <ChevronRight size={15} className={`shrink-0 ${
                          isSelected ? 'text-white' : 'text-slate-300'
                        }`} />
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Pane 3: Full Apple Contact Dossier / Inspector (Desktop 5 cols) */}
        <div className={`lg:col-span-5 bg-white/80 backdrop-blur-xl border border-slate-200/80 rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col justify-between ${
          showMobileDetail ? 'flex' : 'hidden lg:flex'
        }`}>
          
          {selectedContact ? (
            <div className="space-y-6 flex-1 flex flex-col">
              
              {/* Mobile Back Button */}
              <div className="lg:hidden pb-2">
                <button
                  onClick={() => setShowMobileDetail(false)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline"
                >
                  <ChevronLeft size={16} /> Quay lại danh sách
                </button>
              </div>

              {/* Hero Header */}
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 pb-5 border-b border-slate-100">
                {/* Big Apple Avatar */}
                <div className={`w-20 h-20 rounded-3xl flex items-center justify-center text-2xl font-black shadow-lg shrink-0 ${
                  selectedIsExec 
                    ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-white ring-4 ring-amber-100' 
                    : selectedIsCustomer 
                    ? 'bg-gradient-to-br from-blue-500 to-blue-700 text-white ring-4 ring-blue-50' 
                    : 'bg-gradient-to-br from-purple-500 to-purple-700 text-white ring-4 ring-purple-50'
                }`}>
                  {selectedInitials}
                </div>

                <div className="text-center sm:text-left flex-1 min-w-0">
                  <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                    <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                      {selectedFullName}
                    </h2>
                    {selectedIsExec && (
                      <span className="text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full">
                        Ban Lãnh Đạo
                      </span>
                    )}
                  </div>

                  <p className="text-xs font-semibold text-slate-600 mt-1">
                    {selectedContact["Chức vụ"] || "Chức vụ chưa cập nhật"}
                    {selectedContact["Phòng ban"] ? ` • Phòng ${selectedContact["Phòng ban"]}` : ''}
                  </p>

                  {/* Clickable Linked Company with 2-way Cross Navigation */}
                  <div 
                    onClick={() => {
                      if (selectedIsCustomer && onNavigateToCustomer) {
                        onNavigateToCustomer(selectedContact["Công ty"]);
                      } else if (!selectedIsCustomer && onNavigateToSupplier) {
                        onNavigateToSupplier(selectedContact["Công ty"]);
                      }
                    }}
                    className="inline-flex items-center gap-2 mt-2 px-3 py-1 bg-slate-100/90 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 rounded-xl cursor-pointer transition-all group"
                    title={`Mở hồ sơ chi tiết ${selectedCompType}`}
                  >
                    <CompanyLogo name={selectedContact["Công ty"]} size="sm" className="rounded" />
                    <span className="text-xs font-bold text-slate-800 group-hover:text-blue-600 flex items-center gap-1">
                      {selectedContact["Công ty"]}
                      <ArrowUpRight size={12} className="text-slate-400 group-hover:text-blue-600" />
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                      selectedIsCustomer ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                    }`}>
                      {selectedCompType}
                    </span>
                  </div>
                </div>
              </div>

              {/* Apple Quick Action Pills */}
              <div className="grid grid-cols-4 gap-2">
                {/* Call Button */}
                {selectedCleanPhone ? (
                  <a
                    href={`tel:${selectedCleanPhone}`}
                    className="p-2.5 bg-slate-100/80 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200/60 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Phone size={15} />
                    </div>
                    <span className="text-[11px] font-bold">Gọi điện</span>
                  </a>
                ) : (
                  <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col items-center justify-center gap-1 opacity-40">
                    <Phone size={15} className="text-slate-400" />
                    <span className="text-[11px]">Gọi điện</span>
                  </div>
                )}

                {/* Zalo Button */}
                {selectedCleanPhone ? (
                  <a
                    href={`https://zalo.me/${selectedCleanPhone}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2.5 bg-slate-100/80 hover:bg-blue-50 hover:text-blue-700 border border-slate-200/60 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <MessageCircle size={15} />
                    </div>
                    <span className="text-[11px] font-bold">Zalo</span>
                  </a>
                ) : (
                  <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col items-center justify-center gap-1 opacity-40">
                    <MessageCircle size={15} className="text-slate-400" />
                    <span className="text-[11px]">Zalo</span>
                  </div>
                )}

                {/* Email Button */}
                {selectedContact["Email"] ? (
                  <a
                    href={`mailto:${selectedContact["Email"]}`}
                    className="p-2.5 bg-slate-100/80 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200/60 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Mail size={15} />
                    </div>
                    <span className="text-[11px] font-bold">Email</span>
                  </a>
                ) : (
                  <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col items-center justify-center gap-1 opacity-40">
                    <Mail size={15} className="text-slate-400" />
                    <span className="text-[11px]">Email</span>
                  </div>
                )}

                {/* Edit Button */}
                <button
                  onClick={() => handleOpenContactModal(selectedContact)}
                  className="p-2.5 bg-slate-100/80 hover:bg-slate-200 border border-slate-200/60 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all group"
                >
                  <div className="w-8 h-8 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Edit2 size={14} />
                  </div>
                  <span className="text-[11px] font-bold">Sửa hồ sơ</span>
                </button>
              </div>

              {/* Apple Segmented Control Tabs */}
              <div className="flex bg-slate-100 p-1 rounded-2xl gap-1">
                {[
                  { key: 'dossier', label: 'Hồ sơ', icon: UserCircle },
                  { key: 'tasks', label: `Việc (${currentTasks.length})`, icon: CheckSquare },
                  { key: 'projects', label: `Dự án (${currentProjects.length})`, icon: Folder },
                  { key: 'activities', label: `Nhật ký (${currentActivities.length})`, icon: Clock },
                ].map(tab => {
                  const Icon = tab.icon;
                  const active = detailTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setDetailTab(tab.key as any)}
                      className={`flex-1 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                        active 
                          ? 'bg-white text-slate-900 shadow-xs' 
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <Icon size={14} />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Tab Content Panels */}
              <div className="flex-1 overflow-y-auto space-y-4 max-h-[380px] pr-1">
                
                {/* 1. Dossier Tab */}
                {detailTab === 'dossier' && (
                  <div className="space-y-3 animate-fade-in text-xs">
                    <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 font-medium">Số điện thoại</span>
                        <div className="flex items-center gap-1.5 font-mono font-bold text-slate-800">
                          <span>{selectedFormattedPhone || "Chưa cập nhật"}</span>
                          {selectedContact["Điện thoại"] && (
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(selectedFormattedPhone);
                                toast.success("Đã sao chép SĐT: " + selectedFormattedPhone);
                              }}
                              className="text-slate-400 hover:text-slate-700 p-0.5"
                              title="Sao chép"
                            >
                              <Copy size={12} />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                        <span className="text-slate-400 font-medium">Hòm thư Email</span>
                        <span className="font-medium text-blue-600 truncate max-w-[200px]">
                          {selectedContact["Email"] || "Chưa cập nhật"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                        <span className="text-slate-400 font-medium">Nhân sự TSG phụ trách</span>
                        <span className="font-semibold text-slate-800">
                          {selectedContact["Phụ trách"] || "Chưa phân công"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                        <span className="text-slate-400 font-medium">Mức độ quan hệ</span>
                        <div className="flex items-center gap-1 text-amber-500 font-bold">
                          {Array.from({ length: Number(selectedContact["Mức độ quan hệ"] || 3) }).map((_, i) => (
                            <Star key={i} size={13} fill="currentColor" />
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        onClick={(e) => handleDeleteContact(selectedContact, e)}
                        className="text-xs font-semibold text-red-600 hover:text-red-700 hover:underline flex items-center gap-1"
                      >
                        <Trash2 size={13} /> Xóa liên hệ này
                      </button>
                    </div>
                  </div>
                )}

                {/* 2. Tasks Tab */}
                {detailTab === 'tasks' && (
                  <div className="space-y-3 animate-fade-in text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">Công việc theo dõi</span>
                      <button
                        onClick={() => setShowAddTaskForm(!showAddTaskForm)}
                        className="text-xs font-semibold text-[#0071E3] hover:underline flex items-center gap-1"
                      >
                        <PlusCircle size={13} /> {showAddTaskForm ? 'Hủy' : '+ Thêm việc'}
                      </button>
                    </div>

                    {showAddTaskForm && (
                      <form onSubmit={handleAddTask} className="p-3 bg-blue-50/60 border border-blue-100 rounded-2xl space-y-2.5">
                        <input
                          type="text"
                          required
                          value={taskForm.title}
                          onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                          placeholder="Nội dung công việc cần làm..."
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs outline-none"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="date"
                            value={taskForm.dueDate}
                            onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                            className="bg-white border border-slate-200 rounded-xl px-2.5 py-1 text-xs outline-none"
                          />
                          <select
                            value={taskForm.priority}
                            onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value as any })}
                            className="bg-white border border-slate-200 rounded-xl px-2.5 py-1 text-xs outline-none"
                          >
                            <option value="low">Ưu tiên thấp</option>
                            <option value="medium">Trung bình</option>
                            <option value="high">Gấp / Quan trọng</option>
                          </select>
                        </div>
                        <button type="submit" className="w-full py-1.5 bg-[#0071E3] text-white font-semibold rounded-xl text-xs shadow-xs">
                          Tạo công việc
                        </button>
                      </form>
                    )}

                    <div className="space-y-2">
                      {currentTasks.length === 0 ? (
                        <div className="py-8 text-center text-slate-400 bg-slate-50 rounded-2xl border border-slate-100">
                          Chưa có công việc nào cần xử lý với nhân sự này.
                        </div>
                      ) : (
                        currentTasks.map(t => (
                          <div 
                            key={t.id}
                            className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                              t.status === 'done' ? 'bg-slate-50 border-slate-200 opacity-60' : 'bg-white border-slate-200 shadow-2xs'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <input
                                type="checkbox"
                                checked={t.status === 'done'}
                                onChange={() => handleToggleTask(t.id)}
                                className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                              />
                              <div className="min-w-0">
                                <div className={`font-semibold truncate ${t.status === 'done' ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                                  {t.title}
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono">
                                  Hạn: {t.dueDate || "Không có hạn"}
                                </div>
                              </div>
                            </div>

                            <button onClick={() => handleDeleteTask(t.id)} className="text-slate-300 hover:text-red-500 p-1">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* 3. Projects Tab */}
                {detailTab === 'projects' && (
                  <div className="space-y-3 animate-fade-in text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">Dự án liên kết</span>
                      <button
                        onClick={() => setShowAddProjectForm(!showAddProjectForm)}
                        className="text-xs font-semibold text-[#0071E3] hover:underline flex items-center gap-1"
                      >
                        <PlusCircle size={13} /> {showAddProjectForm ? 'Hủy' : '+ Thêm dự án'}
                      </button>
                    </div>

                    {showAddProjectForm && (
                      <form onSubmit={handleAddProject} className="p-3 bg-purple-50/60 border border-purple-100 rounded-2xl space-y-2.5">
                        <input
                          type="text"
                          required
                          value={projectForm.name}
                          onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
                          placeholder="Tên dự án / Hợp đồng..."
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs outline-none"
                        />
                        <input
                          type="text"
                          value={projectForm.description}
                          onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
                          placeholder="Mô tả tóm tắt..."
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs outline-none"
                        />
                        <button type="submit" className="w-full py-1.5 bg-purple-600 text-white font-semibold rounded-xl text-xs shadow-xs">
                          Thêm dự án
                        </button>
                      </form>
                    )}

                    <div className="space-y-2">
                      {currentProjects.length === 0 ? (
                        <div className="py-8 text-center text-slate-400 bg-slate-50 rounded-2xl border border-slate-100">
                          Chưa có dự án nào gắn với nhân sự này.
                        </div>
                      ) : (
                        currentProjects.map(p => (
                          <div key={p.id} className="p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
                            <div>
                              <div className="font-bold text-slate-900">{p.name}</div>
                              <div className="text-[11px] text-slate-500">{p.description || `Mã: ${p.code}`}</div>
                            </div>
                            <button onClick={() => handleDeleteProject(p.id)} className="text-slate-300 hover:text-red-500 p-1">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* 4. Activities Tab */}
                {detailTab === 'activities' && (
                  <div className="space-y-3 animate-fade-in text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">Nhật ký gặp gỡ & tương tác</span>
                      <button
                        onClick={() => setShowAddActivityForm(!showAddActivityForm)}
                        className="text-xs font-semibold text-[#0071E3] hover:underline flex items-center gap-1"
                      >
                        <PlusCircle size={13} /> {showAddActivityForm ? 'Hủy' : '+ Ghi nhật ký'}
                      </button>
                    </div>

                    {showAddActivityForm && (
                      <form onSubmit={handleAddActivity} className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
                        <div className="grid grid-cols-2 gap-2">
                          <select
                            value={activityForm.type}
                            onChange={(e) => setActivityForm({ ...activityForm, type: e.target.value as any })}
                            className="bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs outline-none"
                          >
                            <option value="call">📞 Cuộc gọi</option>
                            <option value="meeting">🤝 Gặp mặt / Họp</option>
                            <option value="email">✉️ Trao đổi Email</option>
                            <option value="note">📝 Ghi chú nhanh</option>
                          </select>
                          <input
                            type="text"
                            value={activityForm.user}
                            onChange={(e) => setActivityForm({ ...activityForm, user: e.target.value })}
                            placeholder="Người thực hiện..."
                            className="bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs outline-none"
                          />
                        </div>
                        <textarea
                          required
                          value={activityForm.content}
                          onChange={(e) => setActivityForm({ ...activityForm, content: e.target.value })}
                          placeholder="Nội dung chi tiết buổi làm việc..."
                          rows={2}
                          className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs outline-none resize-none"
                        />
                        <button type="submit" className="w-full py-1.5 bg-slate-900 text-white font-semibold rounded-xl text-xs shadow-xs">
                          Lưu nhật ký
                        </button>
                      </form>
                    )}

                    <div className="space-y-2.5">
                      {currentActivities.length === 0 ? (
                        <div className="py-8 text-center text-slate-400 bg-slate-50 rounded-2xl border border-slate-100">
                          Chưa có nhật ký tương tác nào được ghi nhận.
                        </div>
                      ) : (
                        currentActivities.map(a => (
                          <div key={a.id} className="p-3 bg-white rounded-2xl border border-slate-100 shadow-2xs space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-bold text-slate-700 uppercase">
                                {a.type === 'call' ? '📞 Cuộc gọi' : a.type === 'meeting' ? '🤝 Gặp mặt' : a.type === 'email' ? '✉️ Email' : '📝 Ghi chú'}
                              </span>
                              <span className="text-slate-400 font-mono">{a.timestamp}</span>
                            </div>
                            <p className="text-slate-800 text-xs">{a.content}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

              </div>

            </div>
          ) : (
            <div className="py-32 text-center text-slate-400 space-y-2 my-auto">
              <UserCircle size={48} className="mx-auto text-slate-300" />
              <div className="font-bold text-slate-600 text-sm">Chưa chọn liên hệ</div>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                Chọn một liên hệ từ danh bạ bên trái để xem hồ sơ chi tiết và các tác vụ liên kết.
              </p>
            </div>
          )}

        </div>

      </div>

      {/* Google Drive Master Sync Modal */}
      <GoogleDriveSyncModal
        isOpen={isDriveModalOpen}
        onClose={() => setIsDriveModalOpen(false)}
        data={{
          contacts,
          customers,
          suppliers,
          products,
          po_headers: poHeaders,
          deliveries
        }}
      />

      {/* Contact Add/Edit Dialog */}
      {isContactModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg flex flex-col max-h-[90vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/80">
              <h3 className="text-base font-bold text-slate-900">
                {editingContact ? 'Chỉnh sửa hồ sơ liên hệ' : 'Thêm liên hệ mới'}
              </h3>
              <button onClick={() => setIsContactModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveContact} className="p-6 overflow-y-auto flex-1 space-y-4 text-xs sm:text-sm">
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
                  Khách hàng ({customers.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setContactType('supplier');
                    if (suppliers.length > 0) {
                      setContactFormData(prev => ({ ...prev, "Công ty": suppliers[0]["Mã nhà cung cấp"] }));
                    }
                  }}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${contactType === 'supplier' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-500'}`}
                >
                  Nhà cung cấp ({suppliers.length})
                </button>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">
                  {contactType === 'customer' ? 'Doanh nghiệp khách hàng liên kết *' : 'Nhà cung cấp liên kết *'}
                </label>
                <select
                  value={contactFormData["Công ty"]}
                  onChange={(e) => setContactFormData({ ...contactFormData, "Công ty": e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm outline-none font-medium"
                >
                  {contactType === 'customer' ? (
                    customers.map((c) => (
                      <option key={c["Customer_ID"]} value={c["Customer_ID"]}>
                        {c["Tên đầy đủ"]} ({c["Customer_ID"]})
                      </option>
                    ))
                  ) : (
                    suppliers.map((s) => (
                      <option key={s["Mã nhà cung cấp"]} value={s["Mã nhà cung cấp"]}>
                        {s["Tên Nhà Cung Cấp"]} ({s["Mã nhà cung cấp"]})
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
                  <label className="text-xs font-medium text-slate-600 block mb-1">Họ và Tên *</label>
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

              <div className="grid grid-cols-2 gap-3">
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
                    placeholder="VD: Kế hoạch / Thu mua"
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
                    placeholder="0987.713.899"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Hòm thư Email</label>
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
                  <label className="text-xs font-medium text-slate-600 block mb-1">Nhân sự TSG phụ trách</label>
                  <input
                    type="text"
                    value={contactFormData["Phụ trách"]}
                    onChange={(e) => setContactFormData({ ...contactFormData, "Phụ trách": e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm outline-none"
                    placeholder="Họ tên nhân viên"
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

    </div>
  );
}
