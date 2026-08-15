import * as XLSX from 'xlsx';
import React, { useState, useEffect } from 'react';
import { 
  Search, Building2, UserCircle, Briefcase, Phone, Mail, CheckCircle, 
  Plus, Eye, Edit2, Trash2, X, PlusCircle, Calendar, CheckSquare, 
  Clock, AlertCircle, Bookmark, Folder, ChevronRight, Activity, Tag,
  Download, MessageSquare, ClipboardList, Copy, Check
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

export default function ContactView({ contacts, customers = [], suppliers = [] }: ContactViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all'); // all, customers, suppliers
  
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
  const filteredContacts = contacts.filter(c => {
    const matchesSearch = 
      c["Tên"]?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      c["Công ty"]?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c["Chức vụ"]?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c["Điện thoại"]?.includes(searchTerm) ||
      c["Email"]?.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!matchesSearch) return false;
    
    if (filterType === 'all') return true;
    const type = getCompanyType(c["Công ty"]);
    if (filterType === 'customers' && type === 'Khách hàng') return true;
    if (filterType === 'suppliers' && type === 'Nhà cung cấp') return true;
    
    return false;
  });

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
      alert("Vui lòng nhập tên liên hệ và chọn công ty liên kết.");
      return;
    }

    try {
      // Use setDoc to merge and save securely. If editing Contact has id or ID, use it.
      const docId = editingContact?.id || editingContact?.ID || contactFormData.ID || doc(collection(db, 'contacts')).id;
      await setDoc(doc(db, 'contacts', docId), { ...contactFormData, id: docId, ID: contactFormData.ID || docId }, { merge: true });
      
      if (selectedContact && (selectedContact.id === docId || selectedContact.ID === docId)) {
        setSelectedContact({ ...selectedContact, ...contactFormData, id: docId });
      }
      setIsContactModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'contacts');
    }
  };

  const handleDeleteContact = async (contact: any, e: React.MouseEvent) => {
    e.stopPropagation();
    if (true) {
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
    }
  };

  // Task Actions
  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskForm.title.trim()) return;

    const contactId = selectedContact.ID || `${selectedContact["Tên"]}-${selectedContact["Công ty"]}`;
    const newTasks = { ...tasks };
    if (!newTasks[contactId]) newTasks[contactId] = [];

    const newTask: Task = {
      id: Math.random().toString(),
      title: taskForm.title,
      dueDate: taskForm.dueDate || new Date().toISOString().split('T')[0],
      priority: taskForm.priority,
      status: taskForm.status
    };

    newTasks[contactId].push(newTask);
    saveTasks(newTasks);
    
    setTaskForm({ title: '', dueDate: '', priority: 'medium', status: 'todo' });
    setShowAddTaskForm(false);
  };

  const handleToggleTask = (taskId: string) => {
    const contactId = selectedContact.ID || `${selectedContact["Tên"]}-${selectedContact["Công ty"]}`;
    const newTasks = { ...tasks };
    if (newTasks[contactId]) {
      newTasks[contactId] = newTasks[contactId].map(t => 
        t.id === taskId ? { ...t, status: t.status === 'done' ? 'todo' : 'done' as 'todo' | 'done' } : t
      );
      saveTasks(newTasks);
    }
  };

  const handleDeleteTask = (taskId: string) => {
    const contactId = selectedContact.ID || `${selectedContact["Tên"]}-${selectedContact["Công ty"]}`;
    const newTasks = { ...tasks };
    if (newTasks[contactId]) {
      newTasks[contactId] = newTasks[contactId].filter(t => t.id !== taskId);
      saveTasks(newTasks);
    }
  };

  // Project Actions
  const handleAddProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectForm.name.trim()) return;

    const contactId = selectedContact.ID || `${selectedContact["Tên"]}-${selectedContact["Công ty"]}`;
    const newProjects = { ...projects };
    if (!newProjects[contactId]) newProjects[contactId] = [];

    const newProj: Project = {
      id: Math.random().toString(),
      name: projectForm.name,
      code: projectForm.code || `PRJ-${Math.floor(100 + Math.random() * 900)}`,
      description: projectForm.description,
      status: projectForm.status
    };

    newProjects[contactId].push(newProj);
    saveProjects(newProjects);

    setProjectForm({ name: '', code: '', description: '', status: 'active' });
    setShowAddProjectForm(false);
  };

  const handleDeleteProject = (projId: string) => {
    const contactId = selectedContact.ID || `${selectedContact["Tên"]}-${selectedContact["Công ty"]}`;
    const newProjects = { ...projects };
    if (newProjects[contactId]) {
      newProjects[contactId] = newProjects[contactId].filter(p => p.id !== projId);
      saveProjects(newProjects);
    }
  };

  // Activity Actions
  const handleAddActivity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activityForm.content.trim()) return;

    const contactId = selectedContact.ID || `${selectedContact["Tên"]}-${selectedContact["Công ty"]}`;
    const newActivities = { ...activities };
    if (!newActivities[contactId]) newActivities[contactId] = [];

    const newActivity: ActivityLog = {
      id: Math.random().toString(),
      type: activityForm.type,
      content: activityForm.content,
      timestamp: new Date().toLocaleString('vi-VN'),
      user: activityForm.user
    };

    newActivities[contactId].unshift(newActivity);
    saveActivities(newActivities);

    setActivityForm({ type: 'call', content: '', user: 'Quản trị viên' });
    setShowAddActivityForm(false);
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
    <div className="flex-1 p-8 overflow-y-auto bg-gray-50 flex flex-col h-full">
      <div className="max-w-7xl mx-auto w-full space-y-6 flex-1 flex flex-col">
        {/* Header Title */}
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <Building2 className="text-blue-600" size={26} />
              <span>Danh bạ Đối tác & Trực thuộc</span>
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Quản lý thông tin liên hệ và phân loại liên kết trực tiếp với bảng Khách hàng hoặc Nhà cung cấp
            </p>
          </div>
          <button 
            onClick={() => handleOpenContactModal()}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors shadow-sm"
          >
            <PlusCircle size={18} />
            <span>Thêm liên hệ mới</span>
          </button>
        </div>

        {/* Search & Tabs Filter */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Tìm kiếm theo tên liên hệ, công ty, chức vụ, SĐT, email..." 
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border-none rounded-lg focus:ring-2 focus:ring-blue-100 text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex gap-2 bg-gray-100 p-1 rounded-lg shrink-0 w-full md:w-auto overflow-x-auto">
            <button 
              onClick={() => setFilterType('all')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${filterType === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Tất cả ({contacts.length})
            </button>
            <button 
              onClick={() => setFilterType('customers')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${filterType === 'customers' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Khách hàng
            </button>
            <button 
              onClick={() => setFilterType('suppliers')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${filterType === 'suppliers' ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Nhà cung cấp
            </button>
          </div>
        </div>

        {/* Contacts Table List */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex-1 flex flex-col">
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-200 sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-4">Họ và Tên</th>
                  <th className="px-6 py-4">Công ty liên kết (Bản đồ dữ liệu)</th>
                  <th className="px-6 py-4">Chức vụ / Phòng ban</th>
                  <th className="px-6 py-4">Phân loại</th>
                  <th className="px-6 py-4">Tiến độ công việc</th>
                  <th className="px-6 py-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredContacts.map((contact, idx) => {
                  const companyType = getCompanyType(contact["Công ty"]);
                  const isCustomer = companyType === 'Khách hàng';
                  const contactId = contact.ID || `${contact["Tên"]}-${contact["Công ty"]}`;
                  
                  const contactTasks = tasks[contactId] || [];
                  const doneTasks = contactTasks.filter(t => t.status === 'done').length;
                  const contactProjects = projects[contactId] || [];

                  return (
                    <tr 
                      key={contactId} 
                      className={`cursor-pointer transition-colors group ${isCustomer ? 'hover:bg-blue-50/40' : 'hover:bg-purple-50/40'}`}
                      onClick={() => {
                        setSelectedContact(contact);
                        setDetailTab('tasks');
                        setShowAddTaskForm(false);
                        setShowAddProjectForm(false);
                      }}
                    >
                      {/* Name Card */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 bg-gray-100 text-gray-500 rounded-full flex items-center justify-center shrink-0 border border-gray-200">
                            <UserCircle size={22} />
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900 group-hover:text-blue-700 transition-colors">
                              {contact["Danh xưng"] ? `${contact["Danh xưng"]} ` : ''}{contact["Tên"]}
                            </div>
                            <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-2">
                              {contact["Điện thoại"] && <span>{contact["Điện thoại"]}</span>}
                              {contact["Điện thoại"] && contact["Email"] && <span>•</span>}
                              {contact["Email"] && <span className="truncate max-w-[120px]">{contact["Email"]}</span>}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Linked Company + Auto Logo */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <CompanyLogo name={contact["Công ty"]} size="sm" />
                          <div>
                            <div className="font-medium text-gray-800">{contact["Công ty"]}</div>
                            <div className="text-xs text-gray-400">Tự động kết xuất logo</div>
                          </div>
                        </div>
                      </td>

                      {/* Position / Dept */}
                      <td className="px-6 py-4 text-gray-600">
                        <div className="font-medium text-gray-700">{contact["Chức vụ"] || "Chưa rõ"}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{contact["Phòng ban"]}</div>
                      </td>

                      {/* Customer / Supplier Badge */}
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 text-xs font-semibold rounded-md border ${
                          isCustomer 
                            ? 'bg-blue-50 text-blue-700 border-blue-100' 
                            : 'bg-purple-50 text-purple-700 border-purple-100'
                        }`}>
                          {companyType}
                        </span>
                      </td>

                      {/* Tasks/Projects tracking badge */}
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          {contactProjects.length > 0 && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded w-fit">
                              <Folder size={10} className="text-gray-400" />
                              {contactProjects.length} dự án
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded w-fit">
                            <CheckSquare size={10} className="text-blue-500" />
                            {contactTasks.length > 0 ? `${doneTasks}/${contactTasks.length} công việc` : '0 công việc'}
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2 transition-opacity">
                          <button 
                            onClick={() => {
                              setSelectedContact(contact);
                              setDetailTab('tasks');
                            }} 
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-gray-200 shadow-sm" 
                            title="Quản lý Công việc & Dự án"
                          >
                            <Activity size={16} />
                          </button>
                          <button 
                            onClick={() => handleOpenContactModal(contact)} 
                            className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200 shadow-sm" 
                            title="Chỉnh sửa thông tin"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            onClick={(e) => handleDeleteContact(contact, e)} 
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-gray-200 shadow-sm" 
                            title="Xóa liên hệ"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredContacts.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      Không tìm thấy liên hệ nào phù hợp trong danh bạ.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 1. Dynamic Add/Edit Contact Modal */}
      {isContactModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 w-full max-w-lg flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-2xl">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <UserCircle className="text-blue-600" size={20} />
                <span>{editingContact ? 'Cập nhật liên hệ' : 'Thêm liên hệ mới'}</span>
              </h3>
              <button onClick={() => setIsContactModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-100 rounded-full">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveContact} className="p-6 overflow-y-auto flex-1 space-y-4">
              {/* Type Switcher */}
              <div className="flex gap-4 p-1 bg-gray-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => {
                    setContactType('customer');
                    // auto select first customer
                    if (customers.length > 0) {
                      setContactFormData(prev => ({ ...prev, "Công ty": customers[0]["Customer_ID"] }));
                    }
                  }}
                  className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${contactType === 'customer' ? 'bg-white text-blue-700 shadow-sm font-semibold' : 'text-gray-500'}`}
                >
                  Trực thuộc Khách hàng
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setContactType('supplier');
                    // auto select first supplier
                    if (suppliers.length > 0) {
                      setContactFormData(prev => ({ ...prev, "Công ty": suppliers[0]["Tên Nhà Cung Cấp"] || suppliers[0]["Mã nhà cung cấp"] }));
                    }
                  }}
                  className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${contactType === 'supplier' ? 'bg-white text-purple-700 shadow-sm font-semibold' : 'text-gray-500'}`}
                >
                  Trực thuộc Nhà cung cấp
                </button>
              </div>

              {/* Dynamic Company dropdown linkage */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
                  {contactType === 'customer' ? 'Chọn Khách hàng liên kết' : 'Chọn Nhà cung cấp liên kết'}
                </label>
                <select
                  value={contactFormData["Công ty"]}
                  onChange={(e) => setContactFormData({ ...contactFormData, "Công ty": e.target.value })}
                  className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-100 outline-none transition-shadow"
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Danh xưng</label>
                  <select
                    value={contactFormData["Danh xưng"]}
                    onChange={(e) => setContactFormData({ ...contactFormData, "Danh xưng": e.target.value })}
                    className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-100 outline-none"
                  >
                    <option value="Mr">Mr (Anh)</option>
                    <option value="Mrs">Mrs (Chị)</option>
                    <option value="Ms">Ms (Cô)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Họ và Tên</label>
                  <input
                    type="text"
                    required
                    value={contactFormData["Tên"]}
                    onChange={(e) => setContactFormData({ ...contactFormData, "Tên": e.target.value })}
                    className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-100 outline-none"
                    placeholder="VD: Nguyễn Văn A"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Chức vụ</label>
                  <input
                    type="text"
                    value={contactFormData["Chức vụ"]}
                    onChange={(e) => setContactFormData({ ...contactFormData, "Chức vụ": e.target.value })}
                    className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-100 outline-none"
                    placeholder="VD: Trưởng phòng"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Phòng ban</label>
                  <input
                    type="text"
                    value={contactFormData["Phòng ban"]}
                    onChange={(e) => setContactFormData({ ...contactFormData, "Phòng ban": e.target.value })}
                    className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-100 outline-none"
                    placeholder="VD: Kế hoạch - Vật tư"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Số điện thoại</label>
                  <input
                    type="tel"
                    value={contactFormData["Điện thoại"]}
                    onChange={(e) => setContactFormData({ ...contactFormData, "Điện thoại": e.target.value })}
                    className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-100 outline-none"
                    placeholder="VD: 0912..."
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Email</label>
                  <input
                    type="email"
                    value={contactFormData["Email"]}
                    onChange={(e) => setContactFormData({ ...contactFormData, "Email": e.target.value })}
                    className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-100 outline-none"
                    placeholder="VD: name@company.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Mức độ quan hệ (1-5 sao)</label>
                  <select
                    value={contactFormData["Mức độ quan hệ"]}
                    onChange={(e) => setContactFormData({ ...contactFormData, "Mức độ quan hệ": e.target.value })}
                    className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-100 outline-none"
                  >
                    <option value="1">1 sao - Mới quen</option>
                    <option value="2">2 sao - Thường xuyên liên hệ</option>
                    <option value="3">3 sao - Tin cậy</option>
                    <option value="4">4 sao - Đối tác mật thiết</option>
                    <option value="5">5 sao - Trọng yếu chiến lược</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Ghi chú phụ trách</label>
                  <input
                    type="text"
                    value={contactFormData["Phụ trách"]}
                    onChange={(e) => setContactFormData({ ...contactFormData, "Phụ trách": e.target.value })}
                    className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-100 outline-none"
                    placeholder="Ghi chú nhân sự quản lý đối tác"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50 -mx-6 -mb-6 p-4 rounded-b-2xl">
                <button 
                  type="button" 
                  onClick={() => setIsContactModalOpen(false)} 
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Hủy bỏ
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm"
                >
                  {editingContact ? 'Lưu thay đổi' : 'Tạo liên hệ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Interactive Contact Details Modal (Tasks & Projects Panel) */}
      {selectedContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/45 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <div className="flex items-center gap-3">
                <CompanyLogo name={selectedContact["Công ty"]} size="sm" />
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    {selectedContact["Danh xưng"] ? `${selectedContact["Danh xưng"]} ` : ''}{selectedContact["Tên"]}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {selectedContact["Chức vụ"]} • {selectedContact["Công ty"]}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedContact(null)} 
                className="text-gray-400 hover:text-gray-600 transition-colors p-1.5 hover:bg-gray-100 rounded-full"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body Grid */}
            <div className="flex-1 flex overflow-hidden">
              
              {/* Left Column: Linkage Profile Info & Connected Corporate details */}
              <div className="w-96 border-r border-gray-100 p-6 overflow-y-auto space-y-6 bg-gray-50/50">
                {/* Contact Card */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Thông tin liên hệ</h4>
                  
                  <div className="space-y-2">
                    {selectedContact["Điện thoại"] && (
                      <div className="flex items-center justify-between gap-2 text-sm text-gray-700 bg-gray-50 p-2.5 rounded-lg border border-gray-100 animate-fade-in">
                        <a 
                          href={`tel:${selectedContact["Điện thoại"]}`} 
                          className="flex items-center gap-2.5 hover:text-blue-600 transition-colors truncate font-medium"
                          title="Click để gọi điện"
                        >
                          <Phone size={15} className="text-blue-500 shrink-0" />
                          <span className="truncate">{selectedContact["Điện thoại"]}</span>
                        </a>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(selectedContact["Điện thoại"]);
                            toast.success("Đã sao chép số điện thoại!");
                          }}
                          className="p-1 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-200 transition-all shrink-0"
                          title="Sao chép số điện thoại"
                        >
                          <Copy size={13} />
                        </button>
                      </div>
                    )}
                    
                    {selectedContact["Email"] && (
                      <div className="flex items-center justify-between gap-2 text-sm text-gray-700 bg-gray-50 p-2.5 rounded-lg border border-gray-100 animate-fade-in">
                        <a 
                          href={`mailto:${selectedContact["Email"]}`} 
                          className="flex items-center gap-2.5 text-blue-600 hover:underline truncate font-medium"
                          title="Click để soạn email"
                        >
                          <Mail size={15} className="text-blue-500 shrink-0" />
                          <span className="truncate">{selectedContact["Email"]}</span>
                        </a>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(selectedContact["Email"]);
                            toast.success("Đã sao chép địa chỉ email!");
                          }}
                          className="p-1 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-200 transition-all shrink-0"
                          title="Sao chép địa chỉ email"
                        >
                          <Copy size={13} />
                        </button>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-gray-50 p-2 rounded border border-gray-100">
                        <div className="text-gray-400">Phòng ban</div>
                        <div className="font-semibold text-gray-700 mt-0.5">{selectedContact["Phòng ban"] || "Chưa rõ"}</div>
                      </div>
                      <div className="bg-gray-50 p-2 rounded border border-gray-100">
                        <div className="text-gray-400">Quan hệ</div>
                        <div className="font-semibold text-gray-700 mt-0.5">{selectedContact["Mức độ quan hệ"]} Sao</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Connected corporate detail (Automatically looked up from Database tables) */}
                {(() => {
                  const compDetails = getCompanyDetails(selectedContact["Công ty"]);
                  if (!compDetails) return null;
                  
                  return (
                    <div className="bg-white rounded-xl border border-blue-100 shadow-sm p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Đơn vị liên kết liên thuộc</h4>
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${compDetails.type === 'Khách hàng' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>
                          {compDetails.type}
                        </span>
                      </div>

                      <div className="flex gap-3 items-center">
                        <CompanyLogo name={selectedContact["Công ty"]} size="md" />
                        <div className="flex-1 overflow-hidden">
                          <h5 className="font-semibold text-gray-900 text-sm line-clamp-2 leading-snug">{compDetails.name}</h5>
                          <div className="text-[11px] text-gray-400 mt-0.5">Mã: {compDetails.code}</div>
                        </div>
                      </div>

                      <div className="border-t border-gray-100 pt-3 space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Trạng thái đối tác:</span>
                          <span className="font-semibold text-gray-700">{compDetails.status}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Nhóm ngành/vật tư:</span>
                          <span className="font-semibold text-gray-700">{compDetails.category}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Công nợ sổ sách:</span>
                          <span className="font-semibold text-rose-600">{compDetails.balance}</span>
                        </div>
                        <div className="flex flex-col pt-1.5 gap-1 text-gray-500">
                          <span className="text-gray-400 font-medium">Địa chỉ đăng ký kinh doanh:</span>
                          <span className="bg-gray-50 p-2 rounded text-[11px] text-gray-600 border border-gray-100 leading-relaxed max-h-[72px] overflow-y-auto">
                            {compDetails.address}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Right Column: Interactive Tasks & Projects Board */}
              <div className="flex-1 flex flex-col p-6 overflow-hidden">
                {/* Tab selectors for sub-actions */}
                <div className="flex border-b border-gray-200 mb-4 shrink-0">
                  <button
                    onClick={() => setDetailTab('tasks')}
                    className={`pb-3 px-4 font-semibold text-sm border-b-2 flex items-center gap-2 transition-all ${detailTab === 'tasks' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                  >
                    <CheckSquare size={16} />
                    <span>Nhiệm vụ & Công việc ({tasks[selectedContact.ID || `${selectedContact["Tên"]}-${selectedContact["Công ty"]}`]?.length || 0})</span>
                  </button>
                  <button
                    onClick={() => setDetailTab('projects')}
                    className={`pb-3 px-4 font-semibold text-sm border-b-2 flex items-center gap-2 transition-all ${detailTab === 'projects' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                  >
                    <Folder size={16} />
                    <span>Dự án đảm nhận ({projects[selectedContact.ID || `${selectedContact["Tên"]}-${selectedContact["Công ty"]}`]?.length || 0})</span>
                  </button>
                  <button
                    onClick={() => setDetailTab('activities')}
                    className={`pb-3 px-4 font-semibold text-sm border-b-2 flex items-center gap-2 transition-all ${detailTab === 'activities' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                  >
                    <MessageSquare size={16} />
                    <span>Lịch sử tương tác ({activities[selectedContact.ID || `${selectedContact["Tên"]}-${selectedContact["Công ty"]}`]?.length || 0})</span>
                  </button>
                </div>

                {/* Sub-tab views */}
                <div className="flex-1 overflow-y-auto min-h-0 pr-1">
                  
                  {/* --- A. TASKS VIEW --- */}
                  {detailTab === 'tasks' && (
                    <div className="space-y-4 h-full flex flex-col">
                      <div className="flex justify-between items-center shrink-0">
                        <h4 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                          <Activity size={15} className="text-blue-500" />
                          <span>Danh sách việc cần thực hiện</span>
                        </h4>
                        {!showAddTaskForm && (
                          <button 
                            onClick={() => setShowAddTaskForm(true)}
                            className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 px-2.5 py-1.5 rounded-lg border border-blue-200 transition-colors"
                          >
                            <Plus size={14} />
                            Thêm việc mới
                          </button>
                        )}
                      </div>

                      {/* Add Task Form inline */}
                      {showAddTaskForm && (
                        <form onSubmit={handleAddTask} className="bg-white p-4 rounded-xl border border-blue-200 shadow-sm space-y-3 shrink-0 animate-fade-in">
                          <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                            <span className="text-xs font-bold text-blue-700 uppercase">Tạo công việc hành động</span>
                            <button type="button" onClick={() => setShowAddTaskForm(false)} className="text-gray-400 hover:text-gray-600">×</button>
                          </div>
                          <div className="space-y-3 text-sm">
                            <div>
                              <label className="text-xs font-medium text-gray-500 block mb-1">Tiêu đề công việc</label>
                              <input
                                type="text"
                                required
                                value={taskForm.title}
                                onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-blue-100"
                                placeholder="Nhập tiêu đề (VD: Gửi báo giá, Đàm phán lại hợp đồng...)"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-xs font-medium text-gray-500 block mb-1">Hạn hoàn thành</label>
                                <input
                                  type="date"
                                  value={taskForm.dueDate}
                                  onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-blue-100 text-sm"
                                />
                              </div>
                              <div>
                                <label className="text-xs font-medium text-gray-500 block mb-1">Độ ưu tiên</label>
                                <select
                                  value={taskForm.priority}
                                  onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value as any })}
                                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-blue-100 text-sm"
                                >
                                  <option value="low">Thấp</option>
                                  <option value="medium">Trung bình</option>
                                  <option value="high">Cao</option>
                                </select>
                              </div>
                            </div>
                          </div>
                          <div className="flex justify-end gap-2 pt-2">
                            <button 
                              type="button" 
                              onClick={() => setShowAddTaskForm(false)} 
                              className="px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 rounded"
                            >
                              Hủy
                            </button>
                            <button 
                              type="submit" 
                              className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded shadow-sm"
                            >
                              Thêm việc
                            </button>
                          </div>
                        </form>
                      )}

                      {/* Tasks lists items */}
                      <div className="flex-1 overflow-y-auto space-y-2.5">
                        {(() => {
                          const contactId = selectedContact.ID || `${selectedContact["Tên"]}-${selectedContact["Công ty"]}`;
                          const contactTasks = tasks[contactId] || [];
                          
                          if (contactTasks.length === 0) {
                            return (
                              <div className="h-48 flex flex-col items-center justify-center text-gray-400 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                                <CheckSquare size={32} className="stroke-1 mb-2" />
                                <span className="text-sm">Chưa có công việc nào gán cho liên hệ này</span>
                              </div>
                            );
                          }

                          return contactTasks.map((task) => (
                            <div 
                              key={task.id} 
                              className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                                task.status === 'done' 
                                  ? 'bg-gray-50/80 border-gray-200 opacity-60' 
                                  : 'bg-white border-gray-200 shadow-sm hover:border-blue-300'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <button 
                                  onClick={() => handleToggleTask(task.id)}
                                  className={`h-5 w-5 rounded flex items-center justify-center border transition-colors ${
                                    task.status === 'done' 
                                      ? 'bg-green-600 border-green-600 text-white' 
                                      : 'border-gray-300 hover:border-blue-500 bg-white'
                                  }`}
                                >
                                  {task.status === 'done' && <CheckCircle size={14} className="fill-green-600" />}
                                </button>
                                <div>
                                  <span className={`text-sm font-semibold text-gray-800 ${task.status === 'done' ? 'line-through text-gray-400' : ''}`}>
                                    {task.title}
                                  </span>
                                  <div className="flex items-center gap-3 text-[11px] text-gray-400 mt-1">
                                    <span className="flex items-center gap-1">
                                      <Calendar size={11} />
                                      Hạn: {task.dueDate}
                                    </span>
                                    <span>•</span>
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                                      task.priority === 'high' ? 'bg-red-50 text-red-600' :
                                      task.priority === 'medium' ? 'bg-yellow-50 text-yellow-600' :
                                      'bg-gray-100 text-gray-600'
                                    }`}>
                                      Ưu tiên: {task.priority === 'high' ? 'Cao' : task.priority === 'medium' ? 'Trung bình' : 'Thấp'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              
                              <button 
                                onClick={() => handleDeleteTask(task.id)}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Xóa"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ));
                        })()}
                      </div>
                    </div>
                  )}

                  {/* --- B. PROJECTS VIEW --- */}
                  {detailTab === 'projects' && (
                    <div className="space-y-4 h-full flex flex-col">
                      <div className="flex justify-between items-center shrink-0">
                        <h4 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                          <Folder size={15} className="text-blue-500" />
                          <span>Dự án đảm nhiệm chung</span>
                        </h4>
                        {!showAddProjectForm && (
                          <button 
                            onClick={() => setShowAddProjectForm(true)}
                            className="flex items-center gap-1 text-xs font-semibold text-purple-600 hover:bg-purple-50 px-2.5 py-1.5 rounded-lg border border-purple-200 transition-colors"
                          >
                            <Plus size={14} />
                            Thêm dự án
                          </button>
                        )}
                      </div>

                      {/* Add Project Form inline */}
                      {showAddProjectForm && (
                        <form onSubmit={handleAddProject} className="bg-white p-4 rounded-xl border border-purple-200 shadow-sm space-y-3 shrink-0 animate-fade-in">
                          <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                            <span className="text-xs font-bold text-purple-700 uppercase">Tạo dự án hành động</span>
                            <button type="button" onClick={() => setShowAddProjectForm(false)} className="text-gray-400 hover:text-gray-600">×</button>
                          </div>
                          <div className="space-y-3 text-sm">
                            <div className="grid grid-cols-3 gap-3">
                              <div className="col-span-2">
                                <label className="text-xs font-medium text-gray-500 block mb-1">Tên dự án</label>
                                <input
                                  type="text"
                                  required
                                  value={projectForm.name}
                                  onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
                                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-purple-100 text-sm"
                                  placeholder="Nhập tên dự án..."
                                />
                              </div>
                              <div>
                                <label className="text-xs font-medium text-gray-500 block mb-1">Mã dự án</label>
                                <input
                                  type="text"
                                  value={projectForm.code}
                                  onChange={(e) => setProjectForm({ ...projectForm, code: e.target.value })}
                                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-purple-100 text-sm"
                                  placeholder="Mã dự án..."
                                />
                              </div>
                            </div>
                            <div>
                              <label className="text-xs font-medium text-gray-500 block mb-1">Mô tả chi tiết dự án</label>
                              <textarea
                                value={projectForm.description}
                                onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
                                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-purple-100 text-sm h-16 resize-none"
                                placeholder="Ghi chú kế hoạch, mục tiêu bàn giao sản phẩm..."
                              />
                            </div>
                          </div>
                          <div className="flex justify-end gap-2 pt-2">
                            <button 
                              type="button" 
                              onClick={() => setShowAddProjectForm(false)} 
                              className="px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 rounded"
                            >
                              Hủy
                            </button>
                            <button 
                              type="submit" 
                              className="px-3 py-1.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded shadow-sm"
                            >
                              Thêm dự án
                            </button>
                          </div>
                        </form>
                      )}

                      {/* Projects lists items */}
                      <div className="flex-1 overflow-y-auto space-y-2.5">
                        {(() => {
                          const contactId = selectedContact.ID || `${selectedContact["Tên"]}-${selectedContact["Công ty"]}`;
                          const contactProjects = projects[contactId] || [];
                          
                          if (contactProjects.length === 0) {
                            return (
                              <div className="h-48 flex flex-col items-center justify-center text-gray-400 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                                <Folder size={32} className="stroke-1 mb-2" />
                                <span className="text-sm">Chưa có dự án nào gán cho liên hệ này</span>
                              </div>
                            );
                          }

                          return contactProjects.map((proj) => (
                            <div 
                              key={proj.id} 
                              className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:border-purple-300 transition-all flex flex-col gap-2.5"
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex items-center gap-2">
                                  <Bookmark className="text-purple-600" size={16} />
                                  <span className="font-bold text-gray-900 text-sm">
                                    {proj.name}
                                  </span>
                                  <span className="text-[10px] font-mono bg-purple-50 text-purple-700 border border-purple-100 px-1.5 py-0.5 rounded">
                                    {proj.code}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="px-2 py-0.5 text-[10px] font-semibold bg-green-50 text-green-700 border border-green-100 rounded">
                                    Đang chạy
                                  </span>
                                  <button 
                                    onClick={() => handleDeleteProject(proj.id)}
                                    className="p-1 text-gray-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors"
                                    title="Xóa dự án"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </div>
                              {proj.description && (
                                <p className="text-xs text-gray-600 bg-gray-50 p-2.5 rounded-lg border border-gray-100 leading-relaxed">
                                  {proj.description}
                                </p>
                              )}
                            </div>
                          ));
                        })()}
                      </div>
                    </div>
                  )}

                  {/* --- C. ACTIVITIES TIMELINE VIEW --- */}
                  {detailTab === 'activities' && (
                    <div className="space-y-4 h-full flex flex-col">
                      <div className="flex justify-between items-center shrink-0">
                        <h4 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                          <MessageSquare size={15} className="text-blue-500" />
                          <span>Lịch sử ghi chú & tương tác liên hệ</span>
                        </h4>
                        {!showAddActivityForm && (
                          <button 
                            onClick={() => setShowAddActivityForm(true)}
                            className="flex items-center gap-1 text-xs font-semibold text-green-600 hover:bg-green-50 px-2.5 py-1.5 rounded-lg border border-green-200 transition-colors"
                          >
                            <Plus size={14} />
                            Thêm tương tác
                          </button>
                        )}
                      </div>

                      {/* Add Activity Form inline */}
                      {showAddActivityForm && (
                        <form onSubmit={handleAddActivity} className="bg-white p-4 rounded-xl border border-green-200 shadow-sm space-y-3 shrink-0 animate-fade-in">
                          <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                            <span className="text-xs font-bold text-green-700 uppercase">Ghi nhận hoạt động tương tác</span>
                            <button type="button" onClick={() => setShowAddActivityForm(false)} className="text-gray-400 hover:text-gray-600">×</button>
                          </div>
                          <div className="space-y-3 text-sm">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-xs font-medium text-gray-500 block mb-1">Loại tương tác</label>
                                <select
                                  value={activityForm.type}
                                  onChange={(e) => setActivityForm({ ...activityForm, type: e.target.value as any })}
                                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-green-100 text-sm"
                                >
                                  <option value="call">📞 Cuộc gọi điện thoại</option>
                                  <option value="meeting">🤝 Buổi gặp mặt trực tiếp / Họp</option>
                                  <option value="email">✉️ Gửi Email</option>
                                  <option value="note">📝 Ghi chú nội bộ</option>
                                </select>
                              </div>
                              <div>
                                <label className="text-xs font-medium text-gray-500 block mb-1">Người thực hiện</label>
                                <input
                                  type="text"
                                  required
                                  value={activityForm.user}
                                  onChange={(e) => setActivityForm({ ...activityForm, user: e.target.value })}
                                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-green-100 text-sm"
                                  placeholder="Nhập tên người thực hiện..."
                                />
                              </div>
                            </div>
                            <div>
                              <label className="text-xs font-medium text-gray-500 block mb-1">Chi tiết nội dung trao đổi</label>
                              <textarea
                                required
                                value={activityForm.content}
                                onChange={(e) => setActivityForm({ ...activityForm, content: e.target.value })}
                                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-green-100 text-sm h-20 resize-none"
                                placeholder="Ghi nhận nội dung thảo luận, yêu cầu báo giá hoặc phản hồi của đối tác..."
                              />
                            </div>
                          </div>
                          <div className="flex justify-end gap-2 pt-2">
                            <button 
                              type="button" 
                              onClick={() => setShowAddActivityForm(false)} 
                              className="px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 rounded"
                            >
                              Hủy
                            </button>
                            <button 
                              type="submit" 
                              className="px-3 py-1.5 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 rounded shadow-sm"
                            >
                              Lưu hoạt động
                            </button>
                          </div>
                        </form>
                      )}

                      {/* Activities Timeline items */}
                      <div className="flex-1 overflow-y-auto space-y-4 pr-1 relative pl-4 border-l-2 border-gray-100 ml-2">
                        {(() => {
                          const contactId = selectedContact.ID || `${selectedContact["Tên"]}-${selectedContact["Công ty"]}`;
                          const contactActivities = activities[contactId] || [];
                          
                          if (contactActivities.length === 0) {
                            return (
                              <div className="h-48 flex flex-col items-center justify-center text-gray-400 bg-gray-50/50 rounded-xl border border-dashed border-gray-200 -ml-4">
                                <MessageSquare size={32} className="stroke-1 mb-2" />
                                <span className="text-sm">Chưa ghi nhận hoạt động tương tác nào</span>
                              </div>
                            );
                          }

                          return contactActivities.map((act) => {
                            let icon = "📝";
                            let iconBg = "bg-gray-100 text-gray-600";
                            if (act.type === 'call') {
                              icon = "📞";
                              iconBg = "bg-blue-50 text-blue-600 border border-blue-100";
                            } else if (act.type === 'meeting') {
                              icon = "🤝";
                              iconBg = "bg-purple-50 text-purple-600 border border-purple-100";
                            } else if (act.type === 'email') {
                              icon = "✉️";
                              iconBg = "bg-yellow-50 text-yellow-600 border border-yellow-100";
                            } else if (act.type === 'note') {
                              icon = "📝";
                              iconBg = "bg-emerald-50 text-emerald-600 border border-emerald-100";
                            }

                            return (
                              <div key={act.id} className="relative group animate-fade-in">
                                {/* Bullet indicator on the left line */}
                                <div className="absolute -left-[25px] top-1 h-4 w-4 rounded-full bg-white border-2 border-blue-500 flex items-center justify-center shadow-sm z-10">
                                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                                </div>

                                <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm hover:shadow-md hover:border-gray-200 transition-all">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <span className={`px-2 py-0.5 rounded text-[11px] font-medium flex items-center gap-1 ${iconBg}`}>
                                        <span>{icon}</span>
                                        <span className="capitalize">
                                          {act.type === 'call' ? 'Cuộc gọi' :
                                           act.type === 'meeting' ? 'Gặp gỡ' :
                                           act.type === 'email' ? 'Email' : 'Ghi chú'}
                                        </span>
                                      </span>
                                      <span className="text-xs font-semibold text-gray-700">{act.user}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-[10px] text-gray-400 flex items-center gap-1">
                                        <Clock size={10} />
                                        {act.timestamp}
                                      </span>
                                      <button 
                                        onClick={() => handleDeleteActivity(act.id)}
                                        className="p-1 text-gray-300 hover:text-red-500 rounded opacity-0 group-hover:opacity-100 transition-all"
                                        title="Xóa ghi nhận"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    </div>
                                  </div>
                                  <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-line">
                                    {act.content}
                                  </p>
                                </div>
                              </div>
                            );
                          });
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
