import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Calendar, 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  Users, 
  Edit, 
  Trash2,
  X,
  Ticket
} from 'lucide-react';
import { usePermissions, RESOURCES, ACTIONS } from '../hooks/usePermissions';
import { getHolidayName } from '../utils/brazilianHolidays';

interface CalendarEvent {
  id: number;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  type: 'event' | 'ticket' | 'work';
  color: string | null;
  created_by: number;
  created_by_name: string;
  user_ids: number[];
  user_names: string[];
  ticket_number?: number;
  priority?: string;
  assigned_name?: string;
}

type ViewMode = 'month' | 'week' | 'day';

export default function ServiceCalendar() {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [tickets, setTickets] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEventModal, setShowEventModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  
  const canCreate = hasPermission(RESOURCES.AGENDA, ACTIONS.CREATE);
  const canEdit = hasPermission(RESOURCES.AGENDA, ACTIONS.EDIT);
  const canDelete = hasPermission(RESOURCES.AGENDA, ACTIONS.DELETE);
  const canViewUsers = hasPermission(RESOURCES.USERS, ACTIONS.VIEW);

  // Formulário de evento
  const [eventTitle, setEventTitle] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [eventStartDate, setEventStartDate] = useState('');
  const [eventStartTime, setEventStartTime] = useState('');
  const [eventEndDate, setEventEndDate] = useState('');
  const [eventEndTime, setEventEndTime] = useState('');
  const [eventType, setEventType] = useState<'event' | 'work'>('event');
  const [eventColor, setEventColor] = useState('#8a2be2');
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);

  // Obter início e fim do período atual
  const getPeriodRange = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    if (viewMode === 'month') {
      const start = new Date(year, month, 1);
      const end = new Date(year, month + 1, 0, 23, 59, 59);
      return {
        start: start.toISOString().split('T')[0] + 'T00:00:00',
        end: end.toISOString().split('T')[0] + 'T23:59:59'
      };
    } else if (viewMode === 'week') {
      const day = currentDate.getDay();
      const diff = currentDate.getDate() - day;
      const start = new Date(currentDate);
      start.setDate(diff);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59, 59);
      return {
        start: start.toISOString(),
        end: end.toISOString()
      };
    } else {
      // Visualização diária - buscar eventos do dia atual
      const start = new Date(currentDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(currentDate);
      end.setHours(23, 59, 59, 59);
      return {
        start: start.toISOString(),
        end: end.toISOString()
      };
    }
  };

  // Buscar eventos e tickets (usuários só se tiver users:view)
  const fetchData = async () => {
    try {
      setLoading(true);
      const { start, end } = getPeriodRange();

      if (canViewUsers) {
        const [eventsRes, ticketsRes, usersRes] = await Promise.all([
          axios.get(`/api/calendar?start=${start}&end=${end}`),
          axios.get(`/api/calendar/tickets?start=${start}&end=${end}`),
          axios.get('/api/users')
        ]);
        setEvents(eventsRes.data);
        setTickets(ticketsRes.data);
        setAllUsers(usersRes.data);
      } else {
        const [eventsRes, ticketsRes] = await Promise.all([
          axios.get(`/api/calendar?start=${start}&end=${end}`),
          axios.get(`/api/calendar/tickets?start=${start}&end=${end}`)
        ]);
        setEvents(eventsRes.data);
        setTickets(ticketsRes.data);
        setAllUsers([]);
      }
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentDate, viewMode, canViewUsers]);

  // Navegação do calendário
  const goToPrevious = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() - 7);
    } else {
      newDate.setDate(newDate.getDate() - 1);
    }
    setCurrentDate(newDate);
  };

  const goToNext = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() + 1);
    } else if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() + 7);
    } else {
      newDate.setDate(newDate.getDate() + 1);
    }
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Abrir modal para criar evento
  const openCreateModal = (date?: Date) => {
    const targetDate = date || new Date();
    const dateStr = targetDate.toISOString().split('T')[0];
    const timeStr = targetDate.toTimeString().slice(0, 5);
    
    setSelectedEvent(null);
    setSelectedDate(targetDate);
    setEventTitle('');
    setEventDescription('');
    setEventStartDate(dateStr);
    setEventStartTime(timeStr);
    setEventEndDate(dateStr);
    setEventEndTime(timeStr);
    setEventType('event');
    setEventColor('#8a2be2');
    setSelectedUserIds([]);
    setShowEventModal(true);
  };

  // Abrir modal para editar evento
  const openEditModal = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setSelectedDate(null);
    
    const start = new Date(event.start_time);
    const end = new Date(event.end_time);
    
    setEventTitle(event.title);
    setEventDescription(event.description || '');
    setEventStartDate(start.toISOString().split('T')[0]);
    setEventStartTime(start.toTimeString().slice(0, 5));
    setEventEndDate(end.toISOString().split('T')[0]);
    setEventEndTime(end.toTimeString().slice(0, 5));
    setEventType(event.type as 'event' | 'work');
    setEventColor(event.color || '#8a2be2');
    setSelectedUserIds(event.user_ids || []);
    setShowEventModal(true);
  };

  // Salvar evento
  const saveEvent = async () => {
    try {
      const startDateTime = `${eventStartDate}T${eventStartTime}:00`;
      const endDateTime = `${eventEndDate}T${eventEndTime}:00`;
      
      const eventData = {
        title: eventTitle,
        description: eventDescription,
        start_time: startDateTime,
        end_time: endDateTime,
        type: eventType,
        color: eventColor,
        user_ids: selectedUserIds
      };
      
      if (selectedEvent) {
        await axios.put(`/api/calendar/${selectedEvent.id}`, eventData);
      } else {
        await axios.post('/api/calendar', eventData);
      }
      
      setShowEventModal(false);
      fetchData();
    } catch (error) {
      console.error('Erro ao salvar evento:', error);
      alert('Erro ao salvar evento');
    }
  };

  // Deletar evento
  const deleteEvent = async (eventId: number) => {
    if (!confirm('Tem certeza que deseja excluir este evento?')) return;
    
    try {
      await axios.delete(`/api/calendar/${eventId}`);
      fetchData();
    } catch (error) {
      console.error('Erro ao deletar evento:', error);
      alert('Erro ao deletar evento');
    }
  };

  // Obter eventos para um dia específico
  const getEventsForDay = (date: Date) => {
    // Normalizar a data para início do dia (00:00:00)
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    // Fim do dia (23:59:59)
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    const allItems = [...events, ...tickets];
    
    return allItems.filter(item => {
      if (!item.start_time) return false;
      
      const eventStart = new Date(item.start_time);
      const eventEnd = item.end_time ? new Date(item.end_time) : eventStart;
      
      // Incluir eventos que:
      // 1. Começam no dia (entre início e fim do dia)
      // 2. Terminam no dia (entre início e fim do dia)
      // 3. Passam pelo dia (começam antes e terminam depois)
      return (eventStart >= startOfDay && eventStart <= endOfDay) ||
             (eventEnd >= startOfDay && eventEnd <= endOfDay) ||
             (eventStart <= startOfDay && eventEnd >= endOfDay);
    });
  };

  // Renderizar calendário mensal
  const renderMonthView = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    const days = [];
    const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    
    // Dias do mês anterior (para preencher primeira semana)
    // Corrigido: calcular corretamente o último dia do mês anterior
    const prevMonthLastDay = new Date(year, month, 0); // Último dia do mês anterior
    const prevMonthDaysCount = prevMonthLastDay.getDate();
    
    // Preencher dias do mês anterior começando do último dia
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const dayNumber = prevMonthDaysCount - i;
      days.push({
        date: new Date(year, month - 1, dayNumber),
        isCurrentMonth: false
      });
    }
    
    // Dias do mês atual
    for (let day = 1; day <= daysInMonth; day++) {
      days.push({
        date: new Date(year, month, day),
        isCurrentMonth: true
      });
    }
    
    // Dias do próximo mês (para completar última semana)
    const remainingDays = 42 - days.length;
    for (let day = 1; day <= remainingDays; day++) {
      days.push({
        date: new Date(year, month + 1, day),
        isCurrentMonth: false
      });
    }
    
    return (
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(7, 1fr)', 
        gap: '2px', 
        backgroundColor: 'var(--border-primary)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        border: '1px solid var(--border-primary)'
      }}>
        {weekDays.map(day => (
          <div key={day} style={{
            padding: 'var(--spacing-md)',
            backgroundColor: 'var(--bg-secondary)',
            fontWeight: '600',
            fontSize: '0.875rem',
            textAlign: 'center',
            color: 'var(--text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            {day}
          </div>
        ))}
        {days.map((day, index) => {
          const dayEvents = getEventsForDay(day.date);
          const isToday = day.date.toDateString() === new Date().toDateString();
          const holidayName = getHolidayName(day.date);
          const isWeekend = day.date.getDay() === 0 || day.date.getDay() === 6;
          
          return (
            <div
              key={index}
              onClick={() => canCreate && openCreateModal(day.date)}
              style={{
                cursor: canCreate ? 'pointer' : 'default',
                minHeight: '140px',
                padding: 'var(--spacing-sm)',
                backgroundColor: day.isCurrentMonth ? 'var(--bg-primary)' : 'var(--bg-tertiary)',
                border: isToday ? '2px solid var(--purple)' : '1px solid transparent',
                borderRadius: isToday ? 'var(--radius-sm)' : '0',
                position: 'relative',
                opacity: day.isCurrentMonth ? 1 : 0.35,
                transition: 'all var(--transition-base)',
                display: 'flex',
                flexDirection: 'column'
              }}
              onMouseEnter={(e) => {
                if (canCreate && day.isCurrentMonth) {
                  e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                  e.currentTarget.style.transform = 'scale(1.02)';
                }
              }}
              onMouseLeave={(e) => {
                if (day.isCurrentMonth) {
                  e.currentTarget.style.backgroundColor = 'var(--bg-primary)';
                  e.currentTarget.style.transform = 'scale(1)';
                }
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 'var(--spacing-xs)'
              }}>
                <div style={{
                  fontWeight: isToday ? '700' : '600',
                  fontSize: isToday ? '1rem' : '0.875rem',
                  color: isToday 
                    ? 'var(--purple)' 
                    : isWeekend && day.isCurrentMonth
                    ? 'var(--text-secondary)'
                    : 'var(--text-primary)',
                  backgroundColor: isToday ? 'var(--purple-light)' : 'transparent',
                  borderRadius: 'var(--radius-full)',
                  width: isToday ? '28px' : '24px',
                  height: isToday ? '28px' : '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {day.date.getDate()}
                </div>
                {dayEvents.length > 0 && (
                  <div style={{
                    fontSize: '0.7rem',
                    color: 'var(--text-tertiary)',
                    backgroundColor: 'var(--bg-secondary)',
                    borderRadius: 'var(--radius-full)',
                    padding: '2px 6px',
                    fontWeight: '600'
                  }}>
                    {dayEvents.length}
                  </div>
                )}
              </div>
              {holidayName && day.isCurrentMonth && (
                <div style={{
                  fontSize: '0.65rem',
                  color: 'var(--purple)',
                  fontStyle: 'italic',
                  marginBottom: '4px',
                  lineHeight: '1.2',
                  fontWeight: '500'
                }}>
                  {holidayName}
                </div>
              )}
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '3px',
                flex: 1,
                overflow: 'hidden'
              }}>
                {dayEvents.slice(0, 3).map(event => (
                  <div
                    key={event.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (event.type === 'ticket') {
                        navigate(`/tickets/${event.ticket_number || event.id}`);
                      } else {
                        openEditModal(event);
                      }
                    }}
                    style={{
                      fontSize: '0.7rem',
                      padding: '4px 6px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: event.color || '#8a2be2',
                      color: 'white',
                      cursor: 'pointer',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontWeight: '500',
                      transition: 'all var(--transition-base)',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.3)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateX(2px)';
                      e.currentTarget.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.4)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateX(0)';
                      e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.3)';
                    }}
                    title={event.title}
                  >
                    {event.type === 'ticket' && <Ticket size={10} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />}
                    {event.title}
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <div style={{
                    fontSize: '0.7rem',
                    color: 'var(--text-secondary)',
                    padding: '4px 6px',
                    fontStyle: 'italic',
                    textAlign: 'center'
                  }}>
                    +{dayEvents.length - 3} mais
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Obter nome do mês/semana/dia
  const getPeriodName = () => {
    if (viewMode === 'month') {
      return currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    } else if (viewMode === 'week') {
      const day = currentDate.getDay();
      const diff = currentDate.getDate() - day;
      const start = new Date(currentDate);
      start.setDate(diff);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return `${start.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} - ${end.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}`;
    } else {
      return currentDate.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    }
  };

  // Renderizar visualização semanal
  const renderWeekView = () => {
    const day = currentDate.getDay();
    const diff = currentDate.getDate() - day;
    const start = new Date(currentDate);
    start.setDate(diff);
    
    const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const days = [];
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      days.push(date);
    }
    
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px', backgroundColor: 'var(--border-primary)', minHeight: '600px' }}>
        {days.map((date, index) => {
          const dayEvents = getEventsForDay(date);
          const isToday = date.toDateString() === new Date().toDateString();
          const dayName = weekDays[index];
          const dayNumber = date.getDate();
          const isWeekend = index === 0 || index === 6;
          const holidayName = getHolidayName(date);
          
          return (
            <div
              key={index}
              style={{
                backgroundColor: 'var(--bg-primary)',
                padding: 'var(--spacing-sm)',
                border: isToday ? '2px solid var(--purple)' : 'none',
                minHeight: '100%'
              }}
            >
              <div
                onClick={() => canCreate && openCreateModal(date)}
                style={{
                  cursor: canCreate ? 'pointer' : 'default',
                  padding: 'var(--spacing-xs)',
                  marginBottom: 'var(--spacing-sm)',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: isToday ? 'var(--purple-light)' : 'transparent'
                }}
              >
                <div style={{
                  fontSize: '0.75rem',
                  color: isWeekend ? 'var(--text-secondary)' : 'var(--text-primary)',
                  fontWeight: '500',
                  marginBottom: '2px'
                }}>
                  {dayName}
                </div>
                <div style={{
                  fontSize: '1.25rem',
                  fontWeight: isToday ? '700' : '600',
                  color: isToday ? 'var(--purple)' : 'var(--text-primary)'
                }}>
                  {dayNumber}
                </div>
                {holidayName && (
                  <div style={{
                    fontSize: '0.65rem',
                    color: 'var(--text-tertiary)',
                    fontStyle: 'italic',
                    marginTop: '2px',
                    opacity: 0.7,
                    lineHeight: '1.2'
                  }}>
                    {holidayName}
                  </div>
                )}
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {dayEvents.map(event => (
                  <div
                    key={event.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (event.type === 'ticket') {
                        navigate(`/tickets/${event.ticket_number || event.id}`);
                      } else {
                        openEditModal(event);
                      }
                    }}
                    style={{
                      fontSize: '0.75rem',
                      padding: '6px 8px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: event.color || '#8a2be2',
                      color: 'white',
                      cursor: 'pointer',
                      transition: 'all var(--transition-base)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.opacity = '0.9';
                      e.currentTarget.style.transform = 'scale(1.02)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = '1';
                      e.currentTarget.style.transform = 'scale(1)';
                    }}
                    title={event.title}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                      {event.type === 'ticket' && <Ticket size={12} />}
                      <span style={{ fontWeight: '600' }}>{event.title}</span>
                    </div>
                    {event.start_time && (
                      <div style={{ fontSize: '0.7rem', opacity: 0.9 }}>
                        {new Date(event.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                  </div>
                ))}
                {dayEvents.length === 0 && canCreate && (
                  <div
                    onClick={() => openCreateModal(date)}
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-tertiary)',
                      padding: 'var(--spacing-xs)',
                      textAlign: 'center',
                      cursor: 'pointer',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px dashed var(--border-primary)'
                    }}
                  >
                    Clique para adicionar
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Renderizar visualização diária
  const renderDayView = () => {
    const dayEvents = getEventsForDay(currentDate);
    const isToday = currentDate.toDateString() === new Date().toDateString();
    const holidayName = getHolidayName(currentDate);
    
    // Ordenar eventos por hora
    const sortedEvents = [...dayEvents].sort((a, b) => {
      const timeA = new Date(a.start_time).getTime();
      const timeB = new Date(b.start_time).getTime();
      return timeA - timeB;
    });
    
    return (
      <div style={{ padding: 'var(--spacing-lg)' }}>
        <div style={{
          marginBottom: 'var(--spacing-lg)',
          padding: 'var(--spacing-md)',
          backgroundColor: isToday ? 'var(--purple-light)' : 'var(--bg-secondary)',
          borderRadius: 'var(--radius-md)',
          border: isToday ? '2px solid var(--purple)' : '1px solid var(--border-primary)'
        }}>
          <div style={{
            fontSize: '1.5rem',
            fontWeight: '700',
            color: 'var(--text-primary)',
            marginBottom: 'var(--spacing-xs)'
          }}>
            {currentDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
          <div style={{
            fontSize: '0.875rem',
            color: 'var(--text-secondary)'
          }}>
            {sortedEvents.length} {sortedEvents.length === 1 ? 'evento' : 'eventos'} agendado{sortedEvents.length !== 1 ? 's' : ''}
          </div>
          {holidayName && (
            <div style={{
              fontSize: '0.75rem',
              color: 'var(--text-tertiary)',
              fontStyle: 'italic',
              marginTop: 'var(--spacing-xs)',
              opacity: 0.8
            }}>
              🎉 {holidayName}
            </div>
          )}
        </div>
        
        {sortedEvents.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: 'var(--spacing-2xl)',
            color: 'var(--text-secondary)'
          }}>
            <Calendar size={48} style={{ marginBottom: 'var(--spacing-md)', opacity: 0.5 }} />
            <p style={{ marginBottom: 'var(--spacing-md)' }}>
              Nenhum evento agendado para este dia
            </p>
            {canCreate && (
              <button
                onClick={() => openCreateModal(currentDate)}
                className="btn btn-primary"
              >
                <Plus size={18} />
                Criar Evento
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
            {sortedEvents.map(event => {
              const startTime = new Date(event.start_time);
              const endTime = new Date(event.end_time);
              
              return (
                <div
                  key={event.id}
                  onClick={() => {
                    if (event.type === 'ticket') {
                      navigate(`/tickets/${event.ticket_number || event.id}`);
                    } else if (canEdit) {
                      openEditModal(event);
                    }
                  }}
                  className="card"
                  style={{
                    padding: 'var(--spacing-md)',
                    cursor: 'pointer',
                    borderLeft: `4px solid ${event.color || '#8a2be2'}`,
                    transition: 'all var(--transition-base)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateX(4px)';
                    e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateX(0)';
                    e.currentTarget.style.boxShadow = 'var(--shadow)';
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--spacing-md)' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-xs)' }}>
                        {event.type === 'ticket' && <Ticket size={18} color={event.color || '#8a2be2'} />}
                        <h3 style={{
                          fontSize: '1.125rem',
                          fontWeight: '600',
                          color: 'var(--text-primary)',
                          margin: 0
                        }}>
                          {event.title}
                        </h3>
                        {event.type === 'ticket' && (
                          <span style={{
                            fontSize: '0.75rem',
                            padding: '2px 6px',
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: 'var(--bg-secondary)',
                            color: 'var(--text-secondary)'
                          }}>
                            Ticket #{event.ticket_number || event.id}
                          </span>
                        )}
                      </div>
                      
                      {event.description && (
                        <p style={{
                          fontSize: '0.875rem',
                          color: 'var(--text-secondary)',
                          marginBottom: 'var(--spacing-xs)',
                          lineHeight: '1.5'
                        }}>
                          {event.description}
                        </p>
                      )}
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', flexWrap: 'wrap', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={14} />
                          {startTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          {startTime.toDateString() !== endTime.toDateString() && (
                            <> até {endTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</>
                          )}
                          {startTime.toDateString() === endTime.toDateString() && startTime.getTime() !== endTime.getTime() && (
                            <> - {endTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</>
                          )}
                        </span>
                        
                        {event.user_names && event.user_names.length > 0 && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Users size={14} />
                            {event.user_names.join(', ')}
                          </span>
                        )}
                        
                        {event.type === 'ticket' && event.assigned_name && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Users size={14} />
                            Atribuído a: {event.assigned_name}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {event.type !== 'ticket' && (canEdit || canDelete) && (
                      <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
                        {canEdit && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditModal(event);
                            }}
                            className="btn btn-secondary btn-sm"
                          >
                            <Edit size={16} />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteEvent(event.id);
                            }}
                            className="btn btn-danger btn-sm"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ padding: 'var(--spacing-lg)' }}>
      {/* Controles */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: 'var(--spacing-lg)',
        flexWrap: 'wrap',
        gap: 'var(--spacing-md)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
          <button
            onClick={goToPrevious}
            className="btn btn-secondary"
            style={{ padding: 'var(--spacing-xs) var(--spacing-sm)' }}
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={goToToday}
            className="btn btn-secondary"
            style={{ padding: 'var(--spacing-xs) var(--spacing-md)' }}
          >
            Hoje
          </button>
          <button
            onClick={goToNext}
            className="btn btn-secondary"
            style={{ padding: 'var(--spacing-xs) var(--spacing-sm)' }}
          >
            <ChevronRight size={20} />
          </button>
          <h2 style={{
            margin: 0,
            marginLeft: 'var(--spacing-md)',
            fontSize: '1.25rem',
            fontWeight: '600',
            color: 'var(--text-primary)',
            textTransform: 'capitalize'
          }}>
            {getPeriodName()}
          </h2>
        </div>
        
        <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
          <button
            onClick={() => setViewMode('month')}
            className={viewMode === 'month' ? 'btn btn-primary' : 'btn btn-secondary'}
            style={{ padding: 'var(--spacing-xs) var(--spacing-md)' }}
          >
            Mês
          </button>
          <button
            onClick={() => setViewMode('week')}
            className={viewMode === 'week' ? 'btn btn-primary' : 'btn btn-secondary'}
            style={{ padding: 'var(--spacing-xs) var(--spacing-md)' }}
          >
            Semana
          </button>
          <button
            onClick={() => setViewMode('day')}
            className={viewMode === 'day' ? 'btn btn-primary' : 'btn btn-secondary'}
            style={{ padding: 'var(--spacing-xs) var(--spacing-md)' }}
          >
            Dia
          </button>
          {canCreate && (
            <button
              onClick={() => openCreateModal()}
              className="btn btn-primary"
              style={{ padding: 'var(--spacing-xs) var(--spacing-md)' }}
            >
              <Plus size={18} />
              Novo Evento
            </button>
          )}
        </div>
      </div>

      {/* Calendário */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 'var(--spacing-2xl)' }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: '4px solid var(--border-primary)',
            borderTopColor: 'var(--purple)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto'
          }} />
          <p style={{ marginTop: 'var(--spacing-md)', color: 'var(--text-secondary)' }}>
            Carregando calendário...
          </p>
        </div>
      ) : (
        <>
          {viewMode === 'day' ? (
            renderDayView()
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {viewMode === 'month' && renderMonthView()}
              {viewMode === 'week' && renderWeekView()}
            </div>
          )}
        </>
      )}

      {/* Modal de Evento */}
      {showEventModal && (
        <div style={{ 
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="card" style={{
            width: '90%',
            maxWidth: '600px',
            maxHeight: '90vh',
            overflow: 'auto',
            position: 'relative'
          }}>
            <button
              onClick={() => setShowEventModal(false)}
            style={{ 
              position: 'absolute', 
                top: 'var(--spacing-md)',
                right: 'var(--spacing-md)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 'var(--spacing-xs)',
                color: 'var(--text-secondary)'
              }}
            >
              <X size={24} />
            </button>
            
            <h2 style={{ marginBottom: 'var(--spacing-lg)' }}>
              {selectedEvent ? 'Editar Evento' : 'Novo Evento'}
            </h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
              <div>
                <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontWeight: '500' }}>
                  Título *
                </label>
          <input
            type="text"
            className="input"
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  placeholder="Nome do evento"
                />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontWeight: '500' }}>
                  Descrição
                </label>
                <textarea
                  className="input"
                  value={eventDescription}
                  onChange={(e) => setEventDescription(e.target.value)}
                  placeholder="Descrição do evento"
                  rows={3}
                />
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontWeight: '500' }}>
                    Data Início *
                  </label>
                  <input
                    type="date"
                    className="input"
                    value={eventStartDate}
                    onChange={(e) => setEventStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontWeight: '500' }}>
                    Hora Início *
                  </label>
                  <input
                    type="time"
                    className="input"
                    value={eventStartTime}
                    onChange={(e) => setEventStartTime(e.target.value)}
          />
        </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontWeight: '500' }}>
                    Data Término *
                  </label>
          <input
            type="date"
            className="input"
                    value={eventEndDate}
                    onChange={(e) => setEventEndDate(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontWeight: '500' }}>
                    Hora Término *
                  </label>
                  <input
                    type="time"
                    className="input"
                    value={eventEndTime}
                    onChange={(e) => setEventEndTime(e.target.value)}
                  />
        </div>
      </div>

              <div>
                <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontWeight: '500' }}>
                  Tipo
                </label>
                <select
                  className="input"
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value as 'event' | 'work')}
                >
                  <option value="event">Evento</option>
                  <option value="work">Trabalho</option>
                </select>
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontWeight: '500' }}>
                  Cor
                </label>
                <input
                  type="color"
                  value={eventColor}
                  onChange={(e) => setEventColor(e.target.value)}
                  style={{ width: '100%', height: '40px', borderRadius: 'var(--radius-md)' }}
                />
          </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontWeight: '500' }}>
                  Participantes
                </label>
                <div style={{
                border: '1px solid var(--border-primary)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--spacing-sm)',
                  maxHeight: '200px',
                  overflow: 'auto'
                }}>
                  {allUsers.map(userItem => (
                    <label
                      key={userItem.id}
                      style={{
                display: 'flex',
                alignItems: 'center',
                        gap: 'var(--spacing-sm)',
                        padding: 'var(--spacing-xs)',
                        cursor: 'pointer'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedUserIds.includes(userItem.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedUserIds([...selectedUserIds, userItem.id]);
                          } else {
                            setSelectedUserIds(selectedUserIds.filter(id => id !== userItem.id));
                          }
                        }}
                      />
                      <span>{userItem.name} ({userItem.email})</span>
                    </label>
                  ))}
                  </div>
                </div>
              
              <div style={{ display: 'flex', gap: 'var(--spacing-sm)', justifyContent: 'flex-end', marginTop: 'var(--spacing-md)' }}>
                <button
                  onClick={() => setShowEventModal(false)}
                  className="btn btn-secondary"
                >
                  Cancelar
                  </button>
                {selectedEvent && canDelete && (
                  <button
                    onClick={() => deleteEvent(selectedEvent.id)}
                    className="btn btn-danger"
                  >
                    <Trash2 size={18} />
                    Excluir
                  </button>
                )}
                <button
                  onClick={saveEvent}
                  className="btn btn-primary"
                  disabled={!eventTitle || !eventStartDate || !eventEndDate}
                >
                  Salvar
                </button>
              </div>
            </div>
                </div>
              </div>
        )}
    </div>
  );
}
