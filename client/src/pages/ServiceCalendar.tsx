import { useState, useEffect, type CSSProperties, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Calendar,
  Plus,
  ChevronLeft,
  ChevronRight,
  Clock,
  Users,
  Edit,
  Trash2,
  Ticket,
} from 'lucide-react';
import { usePermissions, RESOURCES, ACTIONS } from '../hooks/usePermissions';
import { getHolidayName } from '../utils/brazilianHolidays';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useConfirm } from '@/components/ui/confirm-dialog';

interface CalendarEvent {
  id: number | string;
  title: string;
  description?: string | null;
  start_time: string;
  end_time: string;
  type: 'event' | 'ticket' | 'work';
  color: string | null;
  created_by?: number;
  created_by_name?: string;
  user_ids?: number[];
  user_names?: string[];
  ticket_number?: number;
  priority?: string;
  assigned_name?: string;
}

type ViewMode = 'month' | 'week' | 'day';

const WEEK_DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function EventTypeIcon({
  type,
  size = 12,
  className,
  style,
}: {
  type: CalendarEvent['type'];
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  if (type === 'ticket') return <Ticket size={size} className={className} style={style} />;
  return null;
}

export default function ServiceCalendar() {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const confirm = useConfirm();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [tickets, setTickets] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEventModal, setShowEventModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [, setSelectedDate] = useState<Date | null>(null);
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
        end: end.toISOString().split('T')[0] + 'T23:59:59',
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
        end: end.toISOString(),
      };
    } else {
      const start = new Date(currentDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(currentDate);
      end.setHours(23, 59, 59, 59);
      return {
        start: start.toISOString(),
        end: end.toISOString(),
      };
    }
  };

  // Buscar eventos e tickets
  const fetchData = async () => {
    try {
      setLoading(true);
      const { start, end } = getPeriodRange();

      const promises: Promise<any>[] = [
        axios.get(`/api/calendar?${new URLSearchParams({ start, end }).toString()}`),
        axios.get(`/api/calendar/tickets?start=${start}&end=${end}`),
      ];
      if (canViewUsers) {
        promises.push(axios.get('/api/users'));
      }

      const results = await Promise.all(promises);
      setEvents(results[0].data);
      setTickets(results[1].data);
      if (canViewUsers) setAllUsers(results[2]?.data || []);
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
    if (viewMode === 'month') newDate.setMonth(newDate.getMonth() - 1);
    else if (viewMode === 'week') newDate.setDate(newDate.getDate() - 7);
    else newDate.setDate(newDate.getDate() - 1);
    setCurrentDate(newDate);
  };

  const goToNext = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'month') newDate.setMonth(newDate.getMonth() + 1);
    else if (viewMode === 'week') newDate.setDate(newDate.getDate() + 7);
    else newDate.setDate(newDate.getDate() + 1);
    setCurrentDate(newDate);
  };

  const goToToday = () => setCurrentDate(new Date());

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
        user_ids: selectedUserIds,
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
      toast.error('Erro ao salvar evento');
    }
  };

  // Deletar evento
  const deleteEvent = async (eventId: number | string) => {
    const ok = await confirm({
      title: 'Excluir evento',
      description: 'Tem certeza que deseja excluir este evento?',
      confirmLabel: 'Excluir',
      variant: 'destructive',
    });
    if (!ok) return;

    try {
      await axios.delete(`/api/calendar/${eventId}`);
      setShowEventModal(false);
      fetchData();
    } catch (error) {
      console.error('Erro ao deletar evento:', error);
      toast.error('Erro ao deletar evento');
    }
  };

  // Obter eventos para um dia específico
  const getEventsForDay = (date: Date) => {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const allItems: CalendarEvent[] = [...events, ...tickets];

    return allItems.filter((item) => {
      if (!item.start_time) return false;
      const eventStart = new Date(item.start_time);
      const eventEnd = item.end_time ? new Date(item.end_time) : eventStart;
      return (
        (eventStart >= startOfDay && eventStart <= endOfDay) ||
        (eventEnd >= startOfDay && eventEnd <= endOfDay) ||
        (eventStart <= startOfDay && eventEnd >= endOfDay)
      );
    });
  };

  const handleEventClick = (e: MouseEvent, event: CalendarEvent) => {
    e.stopPropagation();
    if (event.type === 'ticket') navigate(`/tickets/${event.ticket_number || event.id}`);
    else openEditModal(event);
  };

  // Renderizar calendário mensal
  const renderMonthView = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: { date: Date; isCurrentMonth: boolean }[] = [];
    const prevMonthLastDay = new Date(year, month, 0);
    const prevMonthDaysCount = prevMonthLastDay.getDate();

    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      days.push({ date: new Date(year, month - 1, prevMonthDaysCount - i), isCurrentMonth: false });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      days.push({ date: new Date(year, month, day), isCurrentMonth: true });
    }
    const remainingDays = 42 - days.length;
    for (let day = 1; day <= remainingDays; day++) {
      days.push({ date: new Date(year, month + 1, day), isCurrentMonth: false });
    }

    return (
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-border bg-border">
        {WEEK_DAYS.map((day) => (
          <div key={day} className="bg-muted px-2 py-2.5 text-center text-xs font-semibold tracking-wide text-muted-foreground uppercase">
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
              className={cn(
                'flex min-h-[140px] flex-col gap-1 bg-background p-1.5 transition-colors',
                canCreate && 'cursor-pointer hover:bg-muted/60',
                !day.isCurrentMonth && 'bg-muted/40 opacity-40',
                isToday && 'ring-2 ring-inset ring-[var(--purple)]'
              )}
            >
              <div className="flex items-center justify-between">
                <div
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-full text-[0.8125rem] font-semibold text-foreground',
                    isToday && 'h-7 w-7 bg-[var(--purple-light)] text-base font-bold text-[var(--purple)]',
                    !isToday && isWeekend && day.isCurrentMonth && 'text-muted-foreground'
                  )}
                >
                  {day.date.getDate()}
                </div>
                {dayEvents.length > 0 && (
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[0.7rem] font-semibold text-muted-foreground">
                    {dayEvents.length}
                  </span>
                )}
              </div>
              {holidayName && day.isCurrentMonth && (
                <div className="text-[0.65rem] leading-tight font-medium text-[var(--purple)] italic">{holidayName}</div>
              )}
              <div className="flex flex-1 flex-col gap-[3px] overflow-hidden">
                {dayEvents.slice(0, 3).map((event) => (
                  <div
                    key={event.id}
                    onClick={(e) => handleEventClick(e, event)}
                    className="flex items-center gap-1 truncate rounded px-1.5 py-0.5 text-[0.7rem] font-medium text-white shadow-sm transition-transform hover:translate-x-0.5"
                    style={{ backgroundColor: event.color || '#8a2be2' }}
                    title={event.title}
                  >
                    <EventTypeIcon type={event.type} size={10} className="shrink-0" />
                    <span className="truncate">{event.title}</span>
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-center text-[0.7rem] text-muted-foreground italic">+{dayEvents.length - 3} mais</div>
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

    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      days.push(date);
    }

    return (
      <div className="grid min-h-[600px] grid-cols-7 gap-px bg-border">
        {days.map((date, index) => {
          const dayEvents = getEventsForDay(date);
          const isToday = date.toDateString() === new Date().toDateString();
          const isWeekend = index === 0 || index === 6;
          const holidayName = getHolidayName(date);

          return (
            <div key={index} className={cn('min-h-full bg-background p-1.5', isToday && 'ring-2 ring-inset ring-[var(--purple)]')}>
              <div
                onClick={() => canCreate && openCreateModal(date)}
                className={cn('mb-2 rounded-md p-1.5', canCreate && 'cursor-pointer', isToday && 'bg-[var(--purple-light)]')}
              >
                <div className={cn('text-xs font-medium', isWeekend ? 'text-muted-foreground' : 'text-foreground')}>{WEEK_DAYS[index]}</div>
                <div className={cn('text-xl font-semibold text-foreground', isToday && 'font-bold text-[var(--purple)]')}>{date.getDate()}</div>
                {holidayName && <div className="mt-0.5 text-[0.65rem] leading-tight text-muted-foreground italic opacity-80">{holidayName}</div>}
              </div>

              <div className="flex flex-col gap-1">
                {dayEvents.map((event) => (
                  <div
                    key={event.id}
                    onClick={(e) => handleEventClick(e, event)}
                    className="cursor-pointer rounded-md px-2 py-1.5 text-white transition-[opacity,transform] hover:scale-[1.02] hover:opacity-90"
                    style={{ backgroundColor: event.color || '#8a2be2' }}
                    title={event.title}
                  >
                    <div className="mb-0.5 flex items-center gap-1">
                      <EventTypeIcon type={event.type} size={12} />
                      <span className="text-xs font-semibold">{event.title}</span>
                    </div>
                    {event.start_time && (
                      <div className="text-[0.7rem] opacity-90">
                        {new Date(event.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                  </div>
                ))}
                {dayEvents.length === 0 && canCreate && (
                  <div
                    onClick={() => openCreateModal(date)}
                    className="cursor-pointer rounded-md border border-dashed border-border p-1.5 text-center text-xs text-muted-foreground"
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

    const sortedEvents = [...dayEvents].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

    return (
      <div>
        <Card className={cn('mb-6 gap-1 px-4 py-3.5', isToday && 'bg-[var(--purple-light)] ring-1 ring-[var(--purple)]')}>
          <div className="text-xl font-bold text-foreground capitalize">
            {currentDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
          <div className="text-sm text-muted-foreground">
            {sortedEvents.length} {sortedEvents.length === 1 ? 'evento' : 'eventos'} agendado{sortedEvents.length !== 1 ? 's' : ''}
          </div>
          {holidayName && <div className="mt-0.5 text-xs text-muted-foreground italic opacity-80">🎉 {holidayName}</div>}
        </Card>

        {sortedEvents.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <Calendar size={48} strokeWidth={1.5} className="mx-auto mb-4 opacity-50" />
            <p className="mb-4">Nenhum evento agendado para este dia</p>
            {canCreate && (
              <Button onClick={() => openCreateModal(currentDate)}>
                <Plus size={18} /> Criar Evento
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {sortedEvents.map((event) => {
              const startTime = new Date(event.start_time);
              const endTime = new Date(event.end_time);

              return (
                <Card
                  key={event.id}
                  onClick={() => {
                    if (event.type === 'ticket') navigate(`/tickets/${event.ticket_number || event.id}`);
                    else if (canEdit) openEditModal(event);
                  }}
                  className="cursor-pointer gap-0 border-l-4 px-4 py-3.5 transition-transform hover:translate-x-1"
                  style={{ borderLeftColor: event.color || '#8a2be2' }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <EventTypeIcon type={event.type} size={18} className="shrink-0" style={{ color: event.color || '#8a2be2' }} />
                        <h3 className="text-[1.0625rem] font-semibold text-foreground">{event.title}</h3>
                        {event.type === 'ticket' && (
                          <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                            Ticket #{event.ticket_number || event.id}
                          </span>
                        )}
                      </div>

                      {event.description && <p className="mb-1 text-sm leading-relaxed text-muted-foreground">{event.description}</p>}

                      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
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
                          <span className="flex items-center gap-1">
                            <Users size={14} /> {event.user_names.join(', ')}
                          </span>
                        )}
                        {event.type === 'ticket' && event.assigned_name && (
                          <span className="flex items-center gap-1">
                            <Users size={14} /> Atribuído a: {event.assigned_name}
                          </span>
                        )}
                      </div>
                    </div>

                    {event.type !== 'ticket' && (canEdit || canDelete) && (
                      <div className="flex shrink-0 gap-1.5">
                        {canEdit && (
                          <Button
                            variant="secondary"
                            size="icon-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditModal(event);
                            }}
                          >
                            <Edit size={15} />
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            variant="destructive"
                            size="icon-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteEvent(event.id);
                            }}
                          >
                            <Trash2 size={15} />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      {/* Controles */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={goToPrevious}>
            <ChevronLeft size={18} />
          </Button>
          <Button variant="outline" onClick={goToToday}>
            Hoje
          </Button>
          <Button variant="outline" size="icon" onClick={goToNext}>
            <ChevronRight size={18} />
          </Button>
          <h2 className="ml-2 text-lg font-semibold text-foreground capitalize">{getPeriodName()}</h2>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Button variant={viewMode === 'month' ? 'default' : 'outline'} onClick={() => setViewMode('month')}>
            Mês
          </Button>
          <Button variant={viewMode === 'week' ? 'default' : 'outline'} onClick={() => setViewMode('week')}>
            Semana
          </Button>
          <Button variant={viewMode === 'day' ? 'default' : 'outline'} onClick={() => setViewMode('day')}>
            Dia
          </Button>
          {canCreate && (
            <Button onClick={() => openCreateModal()}>
              <Plus size={18} /> Novo Evento
            </Button>
          )}
        </div>
      </div>

      {/* Calendário */}
      {loading ? (
        <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-border border-t-[var(--purple)]" />
          <p>Carregando calendário…</p>
        </div>
      ) : viewMode === 'day' ? (
        renderDayView()
      ) : (
        <Card className="overflow-hidden p-0">
          {viewMode === 'month' && renderMonthView()}
          {viewMode === 'week' && renderWeekView()}
        </Card>
      )}

      {/* Modal de Evento */}
      <Dialog open={showEventModal} onOpenChange={setShowEventModal}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedEvent ? 'Editar Evento' : 'Novo Evento'}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div>
              <Label className="mb-1.5">Título *</Label>
              <Input value={eventTitle} onChange={(e) => setEventTitle(e.target.value)} placeholder="Nome do evento" />
            </div>

            <div>
              <Label className="mb-1.5">Descrição</Label>
              <Textarea value={eventDescription} onChange={(e) => setEventDescription(e.target.value)} placeholder="Descrição do evento" rows={3} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5">Data início *</Label>
                <Input type="date" value={eventStartDate} onChange={(e) => setEventStartDate(e.target.value)} />
              </div>
              <div>
                <Label className="mb-1.5">Hora início *</Label>
                <Input type="time" value={eventStartTime} onChange={(e) => setEventStartTime(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5">Data término *</Label>
                <Input type="date" value={eventEndDate} onChange={(e) => setEventEndDate(e.target.value)} />
              </div>
              <div>
                <Label className="mb-1.5">Hora término *</Label>
                <Input type="time" value={eventEndTime} onChange={(e) => setEventEndTime(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5">Tipo</Label>
                <Select value={eventType} onValueChange={(v) => setEventType(v as 'event' | 'work')}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="event">Evento</SelectItem>
                    <SelectItem value="work">Trabalho</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1.5">Cor</Label>
                <input
                  type="color"
                  value={eventColor}
                  onChange={(e) => setEventColor(e.target.value)}
                  className="h-8 w-full cursor-pointer rounded-lg border border-input bg-transparent p-0.5"
                />
              </div>
            </div>

            <div>
              <Label className="mb-1.5">Participantes</Label>
              <div className="flex max-h-[200px] flex-col gap-0.5 overflow-auto rounded-lg border border-input p-2">
                {allUsers.map((userItem) => (
                  <label key={userItem.id} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-muted">
                    <Checkbox
                      checked={selectedUserIds.includes(userItem.id)}
                      onCheckedChange={(checked) => {
                        if (checked) setSelectedUserIds([...selectedUserIds, userItem.id]);
                        else setSelectedUserIds(selectedUserIds.filter((id) => id !== userItem.id));
                      }}
                    />
                    <span className="text-foreground">
                      {userItem.name} <span className="text-muted-foreground">({userItem.email})</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEventModal(false)}>
              Cancelar
            </Button>
            {selectedEvent && canDelete && (
              <Button variant="destructive" onClick={() => deleteEvent(selectedEvent.id)}>
                <Trash2 size={16} /> Excluir
              </Button>
            )}
            <Button onClick={saveEvent} disabled={!eventTitle || !eventStartDate || !eventEndDate}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
