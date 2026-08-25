import React, { useMemo, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { CalendarDays, X, Clock, MapPin, Truck, CheckCircle2, User, Briefcase, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface UnifiedCalendarProps {
  deliveryPlans: any[];
  poLinesData: any[];
  internalTasks: any[];
  googleEvents: any[];
  googleTasks: any[];
}

export default function UnifiedCalendar({
  deliveryPlans,
  poLinesData,
  internalTasks,
  googleEvents,
  googleTasks,
}: UnifiedCalendarProps) {
  const [selectedEvent, setSelectedEvent] = useState<any>(null);

  const allEvents = useMemo(() => {
    const events: any[] = [];

    // 1. Delivery Plans
    deliveryPlans.filter(p => !p.isDeleted).forEach((plan, idx) => {
      const dateStrRaw = plan['Ngày giao kế hoạch'] || plan['Ngày dự kiến'] || plan['Thời gian bắt đầu'];
      if (dateStrRaw) {
        // Parse dd/mm/yyyy or yyyy-mm-dd
        let dateStr = dateStrRaw;
        let parsedDate = new Date(dateStr);
        if (isNaN(parsedDate.getTime()) && dateStr.includes('/')) {
            const parts = dateStr.split('/');
            if (parts.length === 3) {
                // assume dd/mm/yyyy
                parsedDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
            }
        }

        if (!isNaN(parsedDate.getTime())) {
          events.push({
            id: `delivery-${plan['Đơn hàng'] || plan['Số PO']}-${idx}`,
            title: `🚚 ${plan['Khách hàng']} - ${plan['Sản phẩm'] || plan['Tên sản phẩm']}`,
            start: parsedDate.toISOString().split('T')[0],
            allDay: true,
            backgroundColor: (plan['Trạng thái'] === 'Hoàn thành' || plan['Trạng thái'] === 'Đã giao') ? '#10b981' : '#3b82f6', // emerald or blue
            borderColor: 'transparent',
            extendedProps: {
              type: 'delivery',
              status: plan['Trạng thái'],
              po: plan['Đơn hàng'] || plan['Số PO'],
              customer: plan['Khách hàng'],
              product: plan['Sản phẩm'] || plan['Tên sản phẩm'],
              qty: plan['Số lượng kế hoạch'] || plan['Số lượng cần giao'] || plan['Số lượng']
            }
          });
        }
      }
    });

    // 1.5 PO Deadlines
    poLinesData.forEach((po, idx) => {
      const dateStrRaw = po['Ngày giao'];
      if (dateStrRaw && !po.isDeleted) {
        let dateStr = dateStrRaw;
        let parsedDate = new Date(dateStr);
        if (isNaN(parsedDate.getTime()) && dateStr.includes('/')) {
            const parts = dateStr.split('/');
            if (parts.length === 3) {
                parsedDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
            }
        }
        if (!isNaN(parsedDate.getTime())) {
          events.push({
            id: `po-deadline-${po['STT']}-${idx}`,
            title: `⏰ DL: ${po['Số đơn hàng']} - ${po['Tên sản phẩm']}`,
            start: parsedDate.toISOString().split('T')[0],
            allDay: true,
            backgroundColor: '#ef4444', // red
            borderColor: 'transparent',
            extendedProps: {
              type: 'po-deadline',
              po: po['Số đơn hàng'],
              product: po['Tên sản phẩm'],
              customer: po['Khách hàng']
            }
          });
        }
      }
    });

    // 2. Internal Tasks
    internalTasks.forEach(task => {
      if (task.dueDate) {
        events.push({
          id: `task-${task.id}`,
          title: `📋 ${task.title} (${task.contactName})`,
          start: task.dueDate,
          allDay: true,
          backgroundColor: task.status === 'done' ? '#64748b' : '#f59e0b', // slate or amber
          borderColor: 'transparent',
          extendedProps: {
            type: 'internal-task',
            contact: task.contactName,
            company: task.companyName,
            status: task.status,
            title: task.title
          }
        });
      }
    });

    // 3. Google Events
    googleEvents.forEach(event => {
      const start = event.start.dateTime || event.start.date;
      const end = event.end.dateTime || event.end.date;
      events.push({
        id: `gevent-${event.id}`,
        title: `🗓️ ${event.summary || 'Sự kiện'}`,
        start,
        end,
        backgroundColor: '#8b5cf6', // violet
        borderColor: 'transparent',
        extendedProps: {
          type: 'google-event',
          location: event.location,
          description: event.description
        }
      });
    });

    // 4. Google Tasks
    googleTasks.forEach(task => {
      if (task.due) {
        events.push({
          id: `gtask-${task.id}`,
          title: `☑️ ${task.title}`,
          start: task.due,
          allDay: true,
          backgroundColor: task.status === 'completed' ? '#94a3b8' : '#0ea5e9', // slate or sky
          borderColor: 'transparent',
          extendedProps: {
            type: 'google-task',
            status: task.status
          }
        });
      }
    });

    return events;
  }, [deliveryPlans, poLinesData, internalTasks, googleEvents, googleTasks]);

  const handleEventClick = (info: any) => {
    setSelectedEvent({
      id: info.event.id,
      title: info.event.title,
      start: info.event.start,
      end: info.event.end,
      ...info.event.extendedProps
    });
  };

  return (
    <div className="absolute inset-0 p-8 flex flex-col h-full overflow-hidden bg-slate-50">
      <div className="flex-1 bg-white rounded-[2rem] border border-slate-200 shadow-sm p-6 overflow-hidden flex flex-col h-full relative">
        <div className="mb-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0">
              <CalendarDays size={24} />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900">Lịch Tổng Hợp</h3>
              <p className="text-sm font-medium text-slate-500">Tất cả lịch trình và công việc</p>
            </div>
          </div>
          <div className="flex gap-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
             <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> Chờ giao</div>
             <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Đã giao</div>
             <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500"></span> Deadline PO</div>
             <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Việc CRM</div>
             <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-violet-500"></span> Google</div>
          </div>
        </div>
        
        <div className="flex-1 min-h-0 custom-calendar overflow-y-auto pr-2">
            <FullCalendar
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              headerToolbar={{
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay'
              }}
              events={allEvents}
              height="100%"
              eventContent={renderEventContent}
              eventClick={handleEventClick}
              buttonText={{
                today: 'Hôm nay',
                month: 'Tháng',
                week: 'Tuần',
                day: 'Ngày',
                list: 'Danh sách'
              }}
              locale="vi"
            />
        </div>

        {/* Event Detail Modal */}
        <AnimatePresence>
          {selectedEvent && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-8"
              onClick={() => setSelectedEvent(null)}
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-200"
                onClick={e => e.stopPropagation()}
              >
                <div className="p-8 pb-0 flex justify-between items-start">
                  <div className={`p-4 rounded-2xl ${
                    selectedEvent.type === 'delivery' ? 'bg-blue-100 text-blue-600' :
                    selectedEvent.type === 'po-deadline' ? 'bg-red-100 text-red-600' :
                    selectedEvent.type === 'internal-task' ? 'bg-amber-100 text-amber-600' :
                    'bg-violet-100 text-violet-600'
                  }`}>
                    {selectedEvent.type === 'delivery' ? <Truck size={32} /> :
                     selectedEvent.type === 'po-deadline' ? <FileText size={32} /> :
                     selectedEvent.type === 'internal-task' ? <User size={32} /> :
                     <CalendarDays size={32} />}
                  </div>
                  <button onClick={() => setSelectedEvent(null)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400">
                    <X size={24} />
                  </button>
                </div>

                <div className="p-8 space-y-6">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 block mb-2">
                      {selectedEvent.type === 'delivery' ? 'Kế hoạch giao hàng' :
                       selectedEvent.type === 'po-deadline' ? 'Hạn cuối đơn hàng' :
                       selectedEvent.type === 'internal-task' ? 'Nhiệm vụ CRM' : 'Sự kiện'}
                    </span>
                    <h4 className="text-2xl font-black text-slate-900 leading-tight">
                      {selectedEvent.title.replace(/🚚|📋|🗓️|☑️|⏰ DL: /g, '')}
                    </h4>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-4 text-slate-600">
                      <Clock className="shrink-0 text-slate-400" size={20} />
                      <div className="font-bold">
                        {new Date(selectedEvent.start).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </div>
                    </div>

                    {(selectedEvent.customer || selectedEvent.contact) && (
                      <div className="flex items-center gap-4 text-slate-600">
                        <Briefcase className="shrink-0 text-slate-400" size={20} />
                        <div className="font-bold">{selectedEvent.customer || selectedEvent.contact}</div>
                      </div>
                    )}

                    {selectedEvent.location && (
                      <div className="flex items-center gap-4 text-slate-600">
                        <MapPin className="shrink-0 text-slate-400" size={20} />
                        <div className="font-bold">{selectedEvent.location}</div>
                      </div>
                    )}

                    {selectedEvent.type === 'delivery' && (
                      <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Số lượng</span>
                          <span className="font-black text-slate-900">{selectedEvent.qty}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Trạng thái</span>
                          <span className={`font-black px-2 py-1 rounded-lg text-[10px] uppercase ${
                            selectedEvent.status === 'Hoàn thành' || selectedEvent.status === 'Đã giao' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                          }`}>{selectedEvent.status}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t border-slate-100">
                    <button 
                      onClick={() => setSelectedEvent(null)}
                      className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl shadow-slate-900/20 hover:scale-[1.02] active:scale-95 transition-all"
                    >
                      Đóng
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        .custom-calendar .fc {
          --fc-border-color: #e2e8f0;
          --fc-button-text-color: #475569;
          --fc-button-bg-color: #f8fafc;
          --fc-button-border-color: #e2e8f0;
          --fc-button-hover-bg-color: #f1f5f9;
          --fc-button-hover-border-color: #cbd5e1;
          --fc-button-active-bg-color: #e2e8f0;
          --fc-button-active-border-color: #cbd5e1;
          --fc-today-bg-color: #f0fdf4;
          font-family: inherit;
        }
        .custom-calendar .fc-toolbar-title {
          font-weight: 900;
          color: #0f172a;
          font-size: 1.5rem !important;
        }
        .custom-calendar .fc-button {
          font-weight: 700 !important;
          text-transform: capitalize;
          border-radius: 0.75rem !important;
          padding: 0.5rem 1rem !important;
          box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
          transition: all 0.2s;
        }
        .custom-calendar .fc-button-primary:not(:disabled).fc-button-active,
        .custom-calendar .fc-button-primary:not(:disabled):active {
            background-color: #0f172a !important;
            border-color: #0f172a !important;
            color: white !important;
        }
        .custom-calendar .fc-daygrid-day-number {
          font-weight: 700;
          color: #475569;
          padding: 8px !important;
        }
        .custom-calendar .fc-col-header-cell-cushion {
          font-weight: 800;
          color: #334155;
          padding: 12px 8px !important;
        }
        .custom-calendar .fc-event {
          border-radius: 6px;
          padding: 2px 4px;
          font-size: 0.75rem;
          font-weight: 600;
          margin-bottom: 2px;
          cursor: pointer;
          transition: opacity 0.2s;
        }
        .custom-calendar .fc-event:hover {
          opacity: 0.9;
        }
        .custom-calendar .fc-day-today .fc-daygrid-day-number {
            background-color: #10b981;
            color: white;
            border-radius: 9999px;
            width: 28px;
            height: 28px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            margin: 4px;
        }
      `}} />
    </div>
  );
}

function renderEventContent(eventInfo: any) {
  return (
    <div className="overflow-hidden text-ellipsis whitespace-nowrap">
      <span className="font-bold text-white">{eventInfo.event.title}</span>
    </div>
  );
}
