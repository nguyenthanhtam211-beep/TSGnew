import React, { useState, useEffect, useMemo } from 'react';
import { auth, db } from '../firebase';
import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { 
  CheckSquare, Calendar as CalendarIcon, Plus, Loader2, LogOut, Trash2, 
  Truck, User, CalendarDays, Server, LayoutGrid, CheckCircle2, 
  Kanban, Clock, ArrowRight, Activity, Circle, CheckCircle, ChevronRight, Briefcase, Edit2, X, Check, Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import UnifiedCalendar from './UnifiedCalendar';

export default function TasksView({ deliveryPlanData = [], poLinesData = [], contacts = [] }: { deliveryPlanData?: any[], poLinesData?: any[], contacts?: any[] }) {
  const [user, setUser] = useState<any>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState<'crm-board' | 'delivery-timeline' | 'google-sync' | 'unified-calendar'>('crm-board');
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [editForm, setEditForm] = useState({
    date: '',
    qty: '',
    status: '',
    customer: '',
    product: '',
    po: ''
  });

  // CRM Task Creation State
  const [showAddTask, setShowAddTask] = useState<string | null>(null); // 'todo' or null
  const [newCrmTask, setNewCrmTask] = useState({
    title: '',
    contactId: '',
    dueDate: ''
  });


  // Google Workspace States
  const [taskLists, setTaskLists] = useState<any[]>([]);
  const [selectedList, setSelectedList] = useState<string | null>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  // Internal CRM States
  const [internalTasksRaw, setInternalTasksRaw] = useState<{ [contactId: string]: any[] }>({});

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => {
      setUser(u);
      if (!u) {
        setAccessToken(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Load internal tasks
    try {
      const stored = localStorage.getItem('tsg_contact_tasks');
      if (stored) {
        setInternalTasksRaw(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Error reading internal tasks:', e);
    }
  }, []);

  const internalTasks = useMemo(() => {
    const flattened: any[] = [];
    Object.entries(internalTasksRaw).forEach(([contactId, tList]) => {
      const contact = contacts.find(c => c.ID === contactId || `${c["Tên"]}-${c["Công ty"]}` === contactId);
      tList.forEach((t: any) => {
        flattened.push({
          ...t,
          contactId,
          contactName: contact ? contact["Tên"] : contactId.split('-')[0],
          companyName: contact ? contact["Công ty"] : contactId.split('-')[1] || ''
        });
      });
    });
    return flattened;
  }, [internalTasksRaw, contacts]);

  const toggleInternalTask = (contactId: string, taskId: string) => {
    const newTasks = { ...internalTasksRaw };
    if (newTasks[contactId]) {
      newTasks[contactId] = newTasks[contactId].map(t => 
        t.id === taskId ? { ...t, status: t.status === 'done' ? 'todo' : 'done' } : t
      );
      setInternalTasksRaw(newTasks);
      localStorage.setItem('tsg_contact_tasks', JSON.stringify(newTasks));
    }
  };

  const deleteInternalTask = (contactId: string, taskId: string) => {
     
    const newTasks = { ...internalTasksRaw };
    if (newTasks[contactId]) {
      newTasks[contactId] = newTasks[contactId].filter(t => t.id !== taskId);
      setInternalTasksRaw(newTasks);
      localStorage.setItem('tsg_contact_tasks', JSON.stringify(newTasks));
    }
  };

  const sortedDeliveryPlans = useMemo(() => {
    return deliveryPlanData
      .filter(p => !p.isDeleted)
      .filter(p => {
        const matchesSearch = searchQuery === '' || 
          (p['Khách hàng']?.toLowerCase().includes(searchQuery.toLowerCase()) ||
           p['Sản phẩm']?.toLowerCase().includes(searchQuery.toLowerCase()) ||
           p['Tên sản phẩm']?.toLowerCase().includes(searchQuery.toLowerCase()) ||
           p['Đơn hàng']?.toLowerCase().includes(searchQuery.toLowerCase()) ||
           p['Số PO']?.toLowerCase().includes(searchQuery.toLowerCase()));
        
        const matchesStatus = statusFilter === 'All' || p['Trạng thái'] === statusFilter;
        
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        const dateAStr = a['Ngày giao kế hoạch'] || a['Ngày dự kiến'] || a['Thời gian bắt đầu'];
        const dateBStr = b['Ngày giao kế hoạch'] || b['Ngày dự kiến'] || b['Thời gian bắt đầu'];
        const parseDateStr = (dateStr: string) => {
          if (!dateStr) return 0;
          if (dateStr.includes('/')) {
              const parts = dateStr.split('/');
              if (parts.length === 3) {
                  return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`).getTime();
              }
          }
          return new Date(dateStr).getTime();
        }
        return parseDateStr(dateAStr) - parseDateStr(dateBStr);
      });
  }, [deliveryPlanData, searchQuery, statusFilter]);

  const handleUpdatePlan = async (id: string) => {
    try {
      const planDoc = doc(db, 'delivery_plans', id);
      const plan = deliveryPlanData.find(p => (p.id || p['Kế hoạch ID']) === id);
      
      const updateData: any = {
        'Ngày giao kế hoạch': editForm.date,
        'Số lượng kế hoạch': Number(editForm.qty),
        'Trạng thái': editForm.status,
        'Khách hàng': editForm.customer,
        'Sản phẩm': editForm.product,
        'Đơn hàng': editForm.po
      };

      // Also update legacy fields if they exist to keep data clean
      if (plan) {
        if ('Ngày dự kiến' in plan) updateData['Ngày dự kiến'] = editForm.date;
        if ('Số lượng cần giao' in plan) updateData['Số lượng cần giao'] = Number(editForm.qty);
        if ('Số PO' in plan) updateData['Số PO'] = editForm.po;
        if ('Tên sản phẩm' in plan) updateData['Tên sản phẩm'] = editForm.product;
      }

      await updateDoc(planDoc, updateData);
      setEditingPlanId(null);
    } catch (error) {
      console.error('Error updating plan:', error);
      alert('Không thể cập nhật kế hoạch.');
    }
  };

  const handleDeletePlan = async (id: string) => {
     
    try {
      const planDoc = doc(db, 'delivery_plans', id);
      await updateDoc(planDoc, { isDeleted: true });
    } catch (error) {
      console.error('Error deleting plan:', error);
      alert('Không thể xóa kế hoạch.');
    }
  };

  const handleAddCrmTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCrmTask.title || !newCrmTask.contactId) return;

    const newTask = {
      id: Math.random().toString(36).substr(2, 9),
      title: newCrmTask.title,
      dueDate: newCrmTask.dueDate,
      status: 'todo',
      createdAt: new Date().toISOString()
    };

    const newTasksRaw = { ...internalTasksRaw };
    if (!newTasksRaw[newCrmTask.contactId]) {
      newTasksRaw[newCrmTask.contactId] = [];
    }
    newTasksRaw[newCrmTask.contactId].push(newTask);
    
    setInternalTasksRaw(newTasksRaw);
    localStorage.setItem('tsg_contact_tasks', JSON.stringify(newTasksRaw));
    setNewCrmTask({ title: '', contactId: '', dueDate: '' });
    setShowAddTask(null);
  };

  const startEditing = (plan: any) => {
    setEditingPlanId(plan.id || plan['Kế hoạch ID']);
    setEditForm({
      date: plan['Ngày giao kế hoạch'] || plan['Ngày dự kiến'] || plan['Thời gian bắt đầu'] || '',
      qty: String(plan['Số lượng kế hoạch'] || plan['Số lượng cần giao'] || plan['Số lượng'] || ''),
      status: plan['Trạng thái'] || '',
      customer: plan['Khách hàng'] || '',
      product: plan['Sản phẩm'] || plan['Tên sản phẩm'] || '',
      po: plan['Đơn hàng'] || plan['Số PO'] || ''
    });
  };

  // Google Workspace Functions
  const handleSignIn = async () => {
    try {
      setLoading(true);
      const provider = new GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/tasks');
      provider.addScope('https://www.googleapis.com/auth/calendar');
      
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setAccessToken(credential.accessToken);
        fetchTaskLists(credential.accessToken);
        fetchEvents(credential.accessToken);
      }
    } catch (error) {
      console.error('Error signing in:', error);
      alert('Không thể đăng nhập Google. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    setAccessToken(null);
  };

  const fetchTaskLists = async (token: string) => {
    try {
      const res = await fetch('https://tasks.googleapis.com/tasks/v1/users/@me/lists', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.items) {
        setTaskLists(data.items);
        if (data.items.length > 0) {
          setSelectedList(data.items[0].id);
          fetchTasks(token, data.items[0].id);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchTasks = async (token: string, listId: string) => {
    try {
      const res = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setTasks(data.items || []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchEvents = async (token: string) => {
    try {
      const timeMin = new Date().toISOString();
      const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&maxResults=10&orderBy=startTime&singleEvents=true`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setEvents(data.items || []);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !accessToken || !selectedList) return;
    
    try {
      const res = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${selectedList}/tasks`, {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ title: newTaskTitle })
      });
      const newTask = await res.json();
      setTasks([newTask, ...tasks]);
      setNewTaskTitle('');
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleGoogleTask = async (task: any) => {
    if (!accessToken || !selectedList) return;
    const newStatus = task.status === 'completed' ? 'needsAction' : 'completed';
    
    setTasks(tasks.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
    
    try {
      await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${selectedList}/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ...task, status: newStatus })
      });
    } catch (e) {
      console.error(e);
      setTasks(tasks.map(t => t.id === task.id ? task : t));
    }
  };

  const handleDeleteGoogleTask = async (taskId: string) => {
    if (!accessToken || !selectedList) return;
     
    
    const previousTasks = [...tasks];
    setTasks(tasks.filter(t => t.id !== taskId));
    
    try {
      await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${selectedList}/tasks/${taskId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` }
      });
    } catch (e) {
      console.error(e);
      setTasks(previousTasks);
    }
  };

  useEffect(() => {
    if (selectedList && accessToken) {
      fetchTasks(accessToken, selectedList);
    }
  }, [selectedList]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50 h-full">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  const todoTasks = internalTasks.filter(t => t.status === 'todo');
  const doneTasks = internalTasks.filter(t => t.status === 'done');

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden">
      {/* Header */}
      <div className="px-8 py-6 bg-white border-b border-slate-200 shrink-0 flex justify-between items-center z-10">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <LayoutGrid className="text-blue-600" size={28} />
            <span>Trung tâm Điều hành & Lịch trình</span>
          </h2>
          <p className="text-sm font-medium text-slate-500 mt-1">TSG Operations Control Center</p>
        </div>
        
        <div className="flex items-center gap-1 bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200 shadow-sm backdrop-blur-md">
          <button 
            onClick={() => setActiveTab('crm-board')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
              activeTab === 'crm-board' ? 'bg-white text-blue-700 shadow-sm scale-100' : 'text-slate-500 hover:text-slate-700 scale-95 hover:scale-100'
            }`}
          >
            <Kanban size={18} />
            Bảng CRM
          </button>
          <button 
            onClick={() => setActiveTab('delivery-timeline')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
              activeTab === 'delivery-timeline' ? 'bg-white text-emerald-700 shadow-sm scale-100' : 'text-slate-500 hover:text-slate-700 scale-95 hover:scale-100'
            }`}
          >
            <Clock size={18} />
            Lịch Giao hàng
          </button>
          <button 
            onClick={() => setActiveTab('unified-calendar')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
              activeTab === 'unified-calendar' ? 'bg-white text-indigo-700 shadow-sm scale-100' : 'text-slate-500 hover:text-slate-700 scale-95 hover:scale-100'
            }`}
          >
            <CalendarIcon size={18} />
            Lịch Tổng Hợp
          </button>
          <button 
            onClick={() => setActiveTab('google-sync')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
              activeTab === 'google-sync' ? 'bg-white text-slate-900 shadow-sm scale-100' : 'text-slate-500 hover:text-slate-700 scale-95 hover:scale-100'
            }`}
          >
            <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-5 h-5">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
              <path fill="none" d="M0 0h48v48H0z"></path>
            </svg>
            Google Sync
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative bg-slate-50/50">
        <AnimatePresence mode="wait">
          {activeTab === 'crm-board' && (
            <motion.div 
              key="crm-board"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 flex p-8 gap-8 overflow-x-auto overflow-y-hidden"
            >
              {/* TODO Column */}
              <div className="flex-1 min-w-[320px] max-w-md flex flex-col bg-slate-100/50 rounded-3xl border border-slate-200">
                <div className="p-5 flex items-center justify-between border-b border-slate-200/60 shrink-0">
                  <div className="flex items-center gap-3">
                    <Circle className="text-amber-500" size={20} />
                    <h3 className="font-black text-slate-800 tracking-wide uppercase text-sm">Cần thực hiện</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setShowAddTask(showAddTask === 'todo' ? null : 'todo')}
                      className={`p-1.5 rounded-lg transition-all ${showAddTask === 'todo' ? 'bg-amber-100 text-amber-600 rotate-45' : 'bg-white text-slate-400 hover:text-amber-600 border border-slate-200'}`}
                    >
                      <Plus size={18} />
                    </button>
                    <span className="bg-white text-slate-700 text-xs font-bold px-3 py-1 rounded-full shadow-sm border border-slate-200">{todoTasks.length}</span>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                  <AnimatePresence>
                    {showAddTask === 'todo' && (
                      <motion.form 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        onSubmit={handleAddCrmTask}
                        className="bg-amber-50 p-4 rounded-2xl border border-amber-200 space-y-3 overflow-hidden"
                      >
                        <input 
                          autoFocus
                          type="text" 
                          placeholder="Tên nhiệm vụ..."
                          value={newCrmTask.title}
                          onChange={e => setNewCrmTask({...newCrmTask, title: e.target.value})}
                          className="w-full bg-white border border-amber-200 px-3 py-2 rounded-xl text-sm font-bold placeholder:font-medium"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <select 
                            value={newCrmTask.contactId}
                            onChange={e => setNewCrmTask({...newCrmTask, contactId: e.target.value})}
                            className="bg-white border border-amber-200 px-2 py-2 rounded-xl text-xs font-bold"
                          >
                            <option value="">Chọn khách...</option>
                            {contacts.map(c => (
                              <option key={c.ID || `${c["Tên"]}-${c["Công ty"]}`} value={c.ID || `${c["Tên"]}-${c["Công ty"]}`}>
                                {c["Tên"]} ({c["Công ty"]})
                              </option>
                            ))}
                          </select>
                          <input 
                            type="date"
                            value={newCrmTask.dueDate}
                            onChange={e => setNewCrmTask({...newCrmTask, dueDate: e.target.value})}
                            className="bg-white border border-amber-200 px-2 py-2 rounded-xl text-xs font-bold"
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <button 
                            type="button"
                            onClick={() => setShowAddTask(null)}
                            className="px-3 py-1.5 text-[10px] font-black uppercase text-slate-500 hover:bg-white rounded-lg"
                          >
                            Hủy
                          </button>
                          <button 
                            type="submit"
                            disabled={!newCrmTask.title || !newCrmTask.contactId}
                            className="px-3 py-1.5 text-[10px] font-black uppercase bg-amber-500 text-white rounded-lg disabled:opacity-50"
                          >
                            Thêm
                          </button>
                        </div>
                      </motion.form>
                    )}
                  </AnimatePresence>

                  {todoTasks.map(task => (
                    <motion.div 
                      layoutId={`task-${task.id}`}
                      key={task.id} 
                      className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all group cursor-pointer"
                      onClick={() => toggleInternalTask(task.contactId, task.id)}
                    >
                      <div className="flex items-start justify-between mb-3 gap-2">
                        <h4 className="font-bold text-slate-900 leading-snug">{task.title}</h4>
                        <button 
                          onClick={(e) => { e.stopPropagation(); deleteInternalTask(task.contactId, task.id); }}
                          className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 p-1 -mt-1 -mr-1 rounded-lg hover:bg-red-50 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-blue-50 text-blue-700 text-[10px] font-bold uppercase tracking-widest rounded-lg">
                          <User size={12} />
                          {task.contactName}
                        </span>
                        {task.companyName && (
                          <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-bold uppercase tracking-widest rounded-lg">
                            <Briefcase size={12} />
                            {task.companyName}
                          </span>
                        )}
                        {task.dueDate && (
                          <span className={`inline-flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold uppercase tracking-widest rounded-lg ${
                            new Date(task.dueDate) < new Date() ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-600'
                          }`}>
                            <CalendarDays size={12} />
                            {task.dueDate}
                          </span>
                        )}
                      </div>
                    </motion.div>
                  ))}
                  {todoTasks.length === 0 && (
                    <div className="h-32 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl">
                      <p className="text-sm font-medium">Không có công việc cần làm</p>
                    </div>
                  )}
                </div>
              </div>

              {/* DONE Column */}
              <div className="flex-1 min-w-[320px] max-w-md flex flex-col bg-slate-100/50 rounded-3xl border border-slate-200">
                <div className="p-5 flex items-center justify-between border-b border-slate-200/60 shrink-0">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="text-emerald-500" size={20} />
                    <h3 className="font-black text-slate-800 tracking-wide uppercase text-sm">Đã hoàn thành</h3>
                  </div>
                  <span className="bg-white text-slate-700 text-xs font-bold px-3 py-1 rounded-full shadow-sm border border-slate-200">{doneTasks.length}</span>
                </div>
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                  {doneTasks.map(task => (
                    <motion.div 
                      layoutId={`task-${task.id}`}
                      key={task.id} 
                      className="bg-white/60 p-5 rounded-2xl border border-slate-200 hover:border-slate-300 transition-all group cursor-pointer"
                      onClick={() => toggleInternalTask(task.contactId, task.id)}
                    >
                      <div className="flex items-start justify-between mb-3 gap-2">
                        <h4 className="font-bold text-slate-500 line-through leading-snug">{task.title}</h4>
                        <button 
                          onClick={(e) => { e.stopPropagation(); deleteInternalTask(task.contactId, task.id); }}
                          className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 p-1 -mt-1 -mr-1 rounded-lg hover:bg-red-50 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-2 opacity-70">
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-widest rounded-lg">
                          <User size={12} />
                          {task.contactName}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'delivery-timeline' && (
            <motion.div 
              key="delivery-timeline"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 p-8 overflow-y-auto flex justify-center"
            >
              <div className="w-full max-w-4xl">
                <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-8">
                  <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-100 pb-8">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center shrink-0">
                        <Truck size={24} />
                      </div>
                      <div>
                        <h3 className="text-xl font-black text-slate-900">Timeline Giao hàng</h3>
                        <p className="text-sm font-medium text-slate-500">Kế hoạch xuất hàng & Vận chuyển</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                          type="text" 
                          placeholder="Tìm kiếm khách hàng, sản phẩm..."
                          value={searchQuery}
                          onChange={e => setSearchQuery(e.target.value)}
                          className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold w-56 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                        />
                      </div>
                      <select 
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                        className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-emerald-500/20 outline-none"
                      >
                        <option value="All">Tất cả</option>
                        <option value="Chờ giao hàng">Chờ giao</option>
                        <option value="Đang xử lý">Đang xử lý</option>
                        <option value="Hoàn thành">Hoàn thành</option>
                        <option value="Đã giao">Đã giao</option>
                      </select>
                      <div className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        {sortedDeliveryPlans.length}
                      </div>
                    </div>
                  </div>

                  <div className="relative before:absolute before:inset-0 before:ml-6 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-emerald-200 before:via-slate-200 before:to-transparent space-y-8">
                    {sortedDeliveryPlans.map((plan, idx) => {
                      const isDone = plan['Trạng thái'] === 'Hoàn thành' || plan['Trạng thái'] === 'Đã giao';
                      const planId = plan.id || plan['Kế hoạch ID'];
                      const isEditing = editingPlanId === planId;

                      return (
                        <motion.div 
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          key={idx} 
                          className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group"
                        >
                          <div className={`flex items-center justify-center w-12 h-12 rounded-2xl border-[3px] border-white shadow-sm shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 ${
                            isDone ? 'bg-emerald-50 text-emerald-500' : 'bg-blue-500 text-white'
                          }`}>
                            {isDone ? <CheckCircle2 size={20} /> : <Truck size={20} />}
                          </div>
                          
                          <div className={`w-[calc(100%-5rem)] md:w-[calc(50%-3rem)] bg-white p-6 rounded-3xl shadow-sm border transition-all ${
                            isDone ? 'border-emerald-100 bg-emerald-50/20' : 'border-slate-200 hover:border-blue-300 hover:shadow-md'
                          }`}>
                            <div className="flex items-center justify-between mb-4">
                              <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg ${
                                isDone ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'
                              }`}>
                                {plan['Khách hàng']}
                              </span>
                              
                              <div className="flex items-center gap-2">
                                {!isEditing && (
                                  <div className="flex items-center gap-1">
                                    <button 
                                      onClick={() => startEditing(plan)}
                                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-100"
                                    >
                                      <Edit2 size={16} />
                                    </button>
                                    <button 
                                      onClick={() => handleDeletePlan(planId)}
                                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </div>
                                )}
                                <span className="text-xs font-bold text-slate-500 bg-white border border-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                                  <Clock size={12} />
                                  {plan['Ngày giao kế hoạch'] || plan['Ngày dự kiến'] || plan['Thời gian bắt đầu']}
                                </span>
                              </div>
                            </div>
                            
                            {isEditing ? (
                              <div className="space-y-4 bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Khách hàng</label>
                                    <input 
                                      type="text" 
                                      value={editForm.customer}
                                      onChange={(e) => setEditForm({...editForm, customer: e.target.value})}
                                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Số PO / Đơn hàng</label>
                                    <input 
                                      type="text" 
                                      value={editForm.po}
                                      onChange={(e) => setEditForm({...editForm, po: e.target.value})}
                                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold"
                                    />
                                  </div>
                                </div>
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Sản phẩm</label>
                                  <input 
                                    type="text" 
                                    value={editForm.product}
                                    onChange={(e) => setEditForm({...editForm, product: e.target.value})}
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold"
                                  />
                                </div>
                                <div className="grid grid-cols-3 gap-4">
                                  <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Ngày giao</label>
                                    <input 
                                      type="date" 
                                      value={editForm.date ? (editForm.date.includes('/') ? editForm.date.split('/').reverse().join('-') : editForm.date) : ''}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        const formattedDate = val ? val.split('-').reverse().join('/') : '';
                                        setEditForm({...editForm, date: formattedDate});
                                      }}
                                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Số lượng</label>
                                    <input 
                                      type="number" 
                                      value={editForm.qty}
                                      onChange={(e) => setEditForm({...editForm, qty: e.target.value})}
                                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Trạng thái</label>
                                    <select 
                                      value={editForm.status}
                                      onChange={(e) => setEditForm({...editForm, status: e.target.value})}
                                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold"
                                    >
                                      <option value="Chờ giao hàng">Chờ giao hàng</option>
                                      <option value="Đang xử lý">Đang xử lý</option>
                                      <option value="Hoàn thành">Hoàn thành</option>
                                      <option value="Đã giao">Đã giao</option>
                                    </select>
                                  </div>
                                </div>
                                <div className="flex justify-end gap-2 pt-2 border-t border-blue-100">
                                  <button 
                                    onClick={() => setEditingPlanId(null)}
                                    className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-white rounded-xl transition-colors flex items-center gap-2 border border-transparent hover:border-slate-200"
                                  >
                                    <X size={14} /> Hủy
                                  </button>
                                  <button 
                                    onClick={() => handleUpdatePlan(planId)}
                                    className="px-4 py-2 text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 rounded-xl shadow-md shadow-blue-600/20 transition-all flex items-center gap-2"
                                  >
                                    <Check size={14} /> Lưu thay đổi
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <h4 className="text-lg font-black text-slate-900 leading-tight mb-2">{plan['Đơn hàng'] || plan['Số PO']}</h4>
                                <p className="text-sm font-medium text-slate-600 line-clamp-2">{plan['Sản phẩm'] || plan['Tên sản phẩm']}</p>
                                
                                <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-6 text-sm">
                                  <div>
                                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Số lượng</span>
                                    <span className="font-bold text-slate-900">{plan['Số lượng kế hoạch'] || plan['Số lượng cần giao'] || plan['Số lượng đặt hàng']}</span>
                                  </div>
                                  <div>
                                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Trạng thái</span>
                                    <span className={`font-bold ${isDone ? 'text-emerald-600' : 'text-amber-600'}`}>
                                      {plan['Trạng thái']}
                                    </span>
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                    
                    {sortedDeliveryPlans.length === 0 && (
                      <div className="py-20 flex flex-col items-center justify-center text-slate-400 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 relative z-10">
                        <Truck size={48} className="mb-4 text-slate-300" />
                        <p className="font-bold text-slate-500">Chưa có lịch giao hàng</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'unified-calendar' && (
            <motion.div 
              key="unified-calendar"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 z-0"
            >
              <UnifiedCalendar 
                deliveryPlans={sortedDeliveryPlans}
                poLinesData={poLinesData}
                internalTasks={internalTasks}
                googleEvents={events}
                googleTasks={tasks}
              />
            </motion.div>
          )}

          {activeTab === 'google-sync' && (
            <motion.div 
              key="google-sync"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 flex"
            >
              {!user || !accessToken ? (
                <div className="flex-1 flex flex-col items-center justify-center h-full p-8 text-center bg-white m-8 rounded-[3rem] border border-slate-200 shadow-sm">
                  <div className="w-24 h-24 bg-slate-50 text-blue-600 rounded-[2.5rem] shadow-sm border border-slate-100 flex items-center justify-center mb-8">
                    <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-12 h-12">
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                      <path fill="none" d="M0 0h48v48H0z"></path>
                    </svg>
                  </div>
                  <h2 className="text-3xl font-black text-slate-900 mb-4">Kết nối Google Workspace</h2>
                  <p className="text-slate-500 mb-10 max-w-md mx-auto text-base">
                    Đồng bộ 2 chiều các công việc và sự kiện giao hàng, lịch hẹn khách hàng với Google Tasks và Google Calendar của bạn.
                  </p>
                  <button onClick={handleSignIn} className="flex justify-center items-center py-4 px-10 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl shadow-lg shadow-blue-600/20 transition-all font-bold text-lg">
                    Kết nối tài khoản ngay
                  </button>
                </div>
              ) : (
                <div className="flex-1 flex p-8 gap-8">
                  {/* Google Tasks */}
                  <div className="w-1/2 flex flex-col bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                      <div>
                        <h3 className="text-xl font-black text-slate-800 flex items-center gap-3">
                          <CheckSquare className="text-blue-500" size={24} />
                          Google Tasks
                        </h3>
                        <p className="text-sm text-slate-500 mt-1 font-medium">Danh sách việc cần làm</p>
                      </div>
                      {taskLists.length > 0 && (
                        <select 
                          value={selectedList || ''} 
                          onChange={(e) => setSelectedList(e.target.value)}
                          className="bg-white border-2 border-slate-200 font-bold text-sm rounded-xl px-4 py-2 outline-none focus:border-blue-500 hover:border-blue-300 transition-colors"
                        >
                          {taskLists.map(list => (
                            <option key={list.id} value={list.id}>{list.title}</option>
                          ))}
                        </select>
                      )}
                    </div>

                    <div className="p-8 flex-1 overflow-y-auto">
                      <form onSubmit={handleCreateTask} className="mb-8 relative">
                        <input 
                          type="text"
                          value={newTaskTitle}
                          onChange={(e) => setNewTaskTitle(e.target.value)}
                          placeholder="Nhập và nhấn Enter để thêm..."
                          className="w-full pl-6 pr-14 py-4 bg-slate-50 border-0 rounded-2xl focus:bg-blue-50 focus:ring-2 focus:ring-blue-500/20 outline-none text-base font-medium transition-all"
                        />
                        <button type="submit" disabled={!newTaskTitle.trim()} className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm">
                          <Plus size={20} />
                        </button>
                      </form>

                      <div className="space-y-3">
                        {tasks.map((task) => (
                          <div 
                            key={task.id} 
                            className={`flex items-center justify-between p-5 rounded-2xl border transition-all group ${
                              task.status === 'completed' ? 'opacity-50 bg-slate-50 border-transparent' : 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-md shadow-sm'
                            }`}
                          >
                            <div className="flex items-center gap-4">
                              <button 
                                onClick={() => handleToggleGoogleTask(task)}
                                className={`h-6 w-6 rounded-lg flex items-center justify-center border-[2px] transition-colors shrink-0 ${
                                  task.status === 'completed' 
                                    ? 'bg-emerald-500 border-emerald-500 text-white' 
                                    : 'border-slate-300 hover:border-blue-500 text-transparent hover:text-blue-500'
                                }`}
                              >
                                <CheckSquare size={16} className={task.status === 'completed' ? 'text-white' : 'currentColor'} />
                              </button>
                              <span className={`text-base font-semibold ${task.status === 'completed' ? 'text-slate-500 line-through' : 'text-slate-800'}`}>
                                {task.title}
                              </span>
                            </div>
                            <button 
                              onClick={() => handleDeleteGoogleTask(task.id)}
                              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        ))}
                        
                        {tasks.length === 0 && (
                          <div className="py-16 flex flex-col items-center text-slate-400 border-2 border-dashed border-slate-200 rounded-3xl">
                            <CheckCircle2 size={32} className="mb-3 text-slate-300" />
                            <span className="font-medium">Chưa có công việc nào</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Google Calendar */}
                  <div className="w-1/2 flex flex-col bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-8 border-b border-slate-100 flex justify-between items-start bg-slate-50/50">
                      <div>
                        <h3 className="text-xl font-black text-slate-800 flex items-center gap-3">
                          <CalendarIcon className="text-emerald-500" size={24} />
                          Google Calendar
                        </h3>
                        <p className="text-sm font-medium text-slate-500 mt-2 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> {user.email}
                        </p>
                      </div>
                      <button onClick={handleSignOut} className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-red-600 bg-white hover:bg-red-50 border border-slate-200 hover:border-red-200 rounded-xl transition-colors flex items-center gap-2">
                        <LogOut size={16} /> Đăng xuất
                      </button>
                    </div>

                    <div className="p-8 flex-1 overflow-y-auto">
                      <div className="space-y-4">
                        {events.map((event) => {
                          const startDate = event.start.dateTime || event.start.date;
                          const formattedDate = new Date(startDate).toLocaleString('vi-VN', {
                            weekday: 'long', 
                            day: '2-digit', 
                            month: '2-digit', 
                            hour: '2-digit', 
                            minute: '2-digit'
                          });
                          
                          return (
                            <div key={event.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:border-emerald-300 transition-colors border-l-4 border-l-emerald-500 group relative overflow-hidden">
                              <div className="font-black text-slate-900 mb-2 text-lg relative z-10">{event.summary || '(Không có tiêu đề)'}</div>
                              <div className="text-sm font-semibold text-slate-500 flex items-center gap-2 relative z-10">
                                <CalendarDays size={16} className="text-emerald-400" />
                                {formattedDate}
                              </div>
                              {event.location && (
                                <div className="text-sm font-medium text-slate-600 mt-4 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-100 flex items-start gap-2 relative z-10">
                                  <span>📍</span> <span>{event.location}</span>
                                </div>
                              )}
                              
                              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                <CalendarIcon size={64} />
                              </div>
                            </div>
                          );
                        })}
                        
                        {events.length === 0 && (
                          <div className="py-20 flex flex-col items-center text-slate-400 bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl">
                            <CalendarDays size={40} className="mb-4 text-slate-300" />
                            <span className="font-medium">Không có sự kiện nào sắp tới</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
