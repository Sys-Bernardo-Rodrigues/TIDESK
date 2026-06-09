import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import TicketDetail from './TicketDetail';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions, RESOURCES, ACTIONS } from '../hooks/usePermissions';
import { formatDateList, formatTicketTitle } from '../utils/dateUtils';
import {
  Search,
  Clock,
  FileText,
  CheckCircle,
  RefreshCw,
  LayoutGrid,
  User,
  Inbox,
  Pause,
  Zap,
  CalendarClock,
  Sparkles,
  ArrowUpRight,
} from 'lucide-react';

interface Ticket {
  id: number;
  ticket_number: number | null;
  title: string;
  description: string;
  status: 'pending_approval' | 'open' | 'in_progress' | 'resolved' | 'closed' | 'scheduled' | 'rejected';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category_name: string | null;
  user_name: string;
  user_email: string;
  assigned_name: string | null;
  form_name: string | null;
  form_url: string | null;
  form_id: number | null;
  scheduled_at: string | null;
  created_at: string;
  updated_at: string;
  is_paused?: boolean;
}

function formatScheduledDate(dateString: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  const time = date.toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const dayDate = date.toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
  return `${time} · ${dayDate}`;
}

function getTicketFullId(ticket: Ticket): string {
  if (!ticket.ticket_number || !ticket.created_at) return ticket.id.toString();
  const date = new Date(ticket.created_at);
  const year = parseInt(date.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo', year: 'numeric' }));
  const month = parseInt(date.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo', month: '2-digit' }));
  const day = parseInt(date.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo', day: '2-digit' }));
  const number = String(ticket.ticket_number).padStart(3, '0');
  return `${year}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}${number}`;
}

function formatTicketId(ticket: Ticket): string {
  if (!ticket.ticket_number || !ticket.created_at) return `#${ticket.id}`;
  const date = new Date(ticket.created_at);
  const year = parseInt(date.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo', year: 'numeric' }));
  const month = parseInt(date.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo', month: '2-digit' }));
  const day = parseInt(date.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo', day: '2-digit' }));
  const number = String(ticket.ticket_number).padStart(3, '0');
  return `${year}/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}/${number}`;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatRelativeAge(createdAt: string): string {
  const hours = Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60));
  if (hours < 1) return 'agora';
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}sem`;
}

interface Column {
  id: string;
  title: string;
  subtitle: string;
  status: Ticket['status'][];
  color: string;
  bgColor: string;
  accent: string;
  icon: typeof Inbox;
}

const COLUMNS: Column[] = [
  {
    id: 'open',
    title: 'Aberto',
    subtitle: 'Aguardando atendimento',
    status: ['open'],
    color: 'var(--red)',
    bgColor: 'var(--red-light)',
    accent: '#EF4444',
    icon: Inbox,
  },
  {
    id: 'in_progress',
    title: 'Em progresso',
    subtitle: 'Sendo trabalhado',
    status: ['in_progress'],
    color: 'var(--blue)',
    bgColor: 'var(--blue-light)',
    accent: '#3B82F6',
    icon: LayoutGrid,
  },
  {
    id: 'scheduled',
    title: 'Agendados',
    subtitle: 'Retorno programado',
    status: ['scheduled'],
    color: 'var(--purple)',
    bgColor: 'var(--purple-light)',
    accent: '#9147FF',
    icon: CalendarClock,
  },
  {
    id: 'closed',
    title: 'Finalizados',
    subtitle: 'Concluídos',
    status: ['closed'],
    color: 'var(--green)',
    bgColor: 'var(--green-light)',
    accent: '#10B981',
    icon: CheckCircle,
  },
];

const PRIORITY_META: Record<
  Ticket['priority'],
  { label: string; color: string; class: string }
> = {
  low: { label: 'Baixa', color: 'var(--text-tertiary)', class: 'tickets-priority--low' },
  medium: { label: 'Média', color: 'var(--blue)', class: 'tickets-priority--medium' },
  high: { label: 'Alta', color: 'var(--orange)', class: 'tickets-priority--high' },
  urgent: { label: 'Urgente', color: 'var(--red)', class: 'tickets-priority--urgent' },
};

const PRIORITY_FILTERS = [
  { id: 'all', label: 'Todas' },
  { id: 'urgent', label: 'Urgente' },
  { id: 'high', label: 'Alta' },
  { id: 'medium', label: 'Média' },
  { id: 'low', label: 'Baixa' },
] as const;

export default function Tickets() {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const canEditTickets = hasPermission(RESOURCES.TICKETS, ACTIONS.EDIT);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [onlyMyTickets, setOnlyMyTickets] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState<string>('0');
  const [draggedTicket, setDraggedTicket] = useState<Ticket | null>(null);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [draggedOverColumn, setDraggedOverColumn] = useState<string | null>(null);
  const [, setViewedTickets] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetchTickets();
    const saved = localStorage.getItem('viewedTickets');
    if (saved) {
      try {
        setViewedTickets(new Set(JSON.parse(saved)));
      } catch {
        /* ignore */
      }
    }
  }, []);

  useEffect(() => {
    if (autoRefresh === '0') return;
    const ms = parseInt(autoRefresh) * 1000;
    const id = setInterval(fetchTickets, ms);
    return () => clearInterval(id);
  }, [autoRefresh]);

  const fetchTickets = async () => {
    try {
      const res = await axios.get<Ticket[]>('/api/tickets');
      setTickets((res.data || []).filter((t) => t.status !== 'pending_approval'));
    } catch (e) {
      console.error('Erro ao buscar tickets:', e);
      alert('Erro ao carregar tickets');
    } finally {
      setLoading(false);
    }
  };

  const updateTicketStatus = async (id: number, status: Ticket['status'], assignToUserId?: number) => {
    try {
      const payload: { status: Ticket['status']; assigned_to?: number } = { status };
      if (assignToUserId != null) payload.assigned_to = assignToUserId;
      await axios.put(`/api/tickets/${id}`, payload);
      await fetchTickets();
    } catch (err: unknown) {
      console.error('Erro ao atualizar status:', err);
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : 'Erro ao atualizar status';
      alert(msg || 'Erro ao atualizar status');
      await fetchTickets();
    }
  };

  const handleDragStart = (e: React.DragEvent, t: Ticket) => {
    setDraggedTicket(t);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(t.id));
  };

  const handleDragOver = (e: React.DragEvent, colId: string) => {
    if (!canEditTickets) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDraggedOverColumn(colId);
  };

  const handleDragLeave = () => setDraggedOverColumn(null);

  const handleDrop = async (e: React.DragEvent, col: Column) => {
    e.preventDefault();
    setDraggedOverColumn(null);
    if (!canEditTickets || !draggedTicket) return;

    if (col.id === 'open') {
      if (draggedTicket.status !== 'open') await updateTicketStatus(draggedTicket.id, 'open');
      setDraggedTicket(null);
      await fetchTickets();
      return;
    }

    const newStatus = col.status[0];
    if (draggedTicket.status === newStatus || newStatus === 'pending_approval') {
      setDraggedTicket(null);
      return;
    }

    const assignToSelf = newStatus === 'in_progress' && draggedTicket.status === 'open' && user?.id;
    setTickets((prev) =>
      prev.map((t) => (t.id === draggedTicket.id ? { ...t, status: newStatus } : t))
    );
    await updateTicketStatus(draggedTicket.id, newStatus, assignToSelf ? user!.id : undefined);
    setDraggedTicket(null);
  };

  const getHoursSince = (t: Ticket) =>
    Math.floor((Date.now() - new Date(t.created_at).getTime()) / (1000 * 60 * 60));

  const isScheduledOverdue = (t: Ticket) =>
    !!t.scheduled_at && t.status === 'scheduled' && new Date(t.scheduled_at) < new Date();

  const filterTicketList = (list: Ticket[]) => {
    let filtered = list;
    if (onlyMyTickets && user) {
      filtered = filtered.filter((t) => t.assigned_name?.toLowerCase() === user.name?.toLowerCase());
    }
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.form_name?.toLowerCase().includes(q) ||
          t.user_name?.toLowerCase().includes(q) ||
          formatTicketId(t).toLowerCase().includes(q)
      );
    }
    if (priorityFilter !== 'all') filtered = filtered.filter((t) => t.priority === priorityFilter);
    return filtered;
  };

  const getTicketsForColumn = (col: Column): Ticket[] => {
    const list = filterTicketList(tickets.filter((t) => col.status.includes(t.status)));
    const order: Record<Ticket['priority'], number> = { urgent: 4, high: 3, medium: 2, low: 1 };
    return list.sort((a, b) => {
      const d = order[b.priority] - order[a.priority];
      return d !== 0 ? d : new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  };

  const stats = useMemo(() => {
    const base = filterTicketList(tickets);
    return {
      total: base.length,
      open: base.filter((t) => t.status === 'open').length,
      inProgress: base.filter((t) => t.status === 'in_progress').length,
      scheduled: base.filter((t) => t.status === 'scheduled').length,
      closed: base.filter((t) => t.status === 'closed').length,
      urgent: base.filter((t) => t.priority === 'urgent' && t.status !== 'closed').length,
    };
  }, [tickets, searchTerm, priorityFilter, onlyMyTickets, user]);

  const handleTicketClick = (id: number) => {
    setViewedTickets((prev) => {
      const next = new Set(prev);
      next.add(id);
      localStorage.setItem('viewedTickets', JSON.stringify([...next]));
      return next;
    });
    const t = tickets.find((x) => x.id === id);
    setSelectedTicketId(t ? getTicketFullId(t) : String(id));
  };

  const formatDate = formatDateList;

  if (loading) {
    return (
      <div className="tickets-page">
        <div className="tickets-loading">
          <div className="tickets-loading__orb" />
          <p>Carregando fila de atendimento…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="tickets-page">
      <header className="tickets-hero">
        <div className="tickets-hero__glow" aria-hidden />
        <div className="tickets-hero__row">
          <div className="tickets-hero__title-row">
            <div className="tickets-hero__icon">
              <Sparkles size={18} />
            </div>
            <h1 className="tickets-hero__title">Tickets</h1>
          </div>

          <div className="tickets-stats">
            <div className="tickets-stat tickets-stat--open" title="Abertos">
              <span className="tickets-stat__value">{stats.open}</span>
              <span className="tickets-stat__label">Abertos</span>
            </div>
            <div className="tickets-stat tickets-stat--progress" title="Em progresso">
              <span className="tickets-stat__value">{stats.inProgress}</span>
              <span className="tickets-stat__label">Progresso</span>
            </div>
            <div className="tickets-stat tickets-stat--scheduled" title="Agendados">
              <span className="tickets-stat__value">{stats.scheduled}</span>
              <span className="tickets-stat__label">Agend.</span>
            </div>
            <div className="tickets-stat tickets-stat--closed" title="Finalizados">
              <span className="tickets-stat__value">{stats.closed}</span>
              <span className="tickets-stat__label">Fim</span>
            </div>
            {stats.urgent > 0 && (
              <div className="tickets-stat tickets-stat--urgent" title="Urgentes">
                <Zap size={12} />
                <span className="tickets-stat__value">{stats.urgent}</span>
              </div>
            )}
          </div>

          <button
            type="button"
            className="tickets-hero__refresh"
            onClick={() => fetchTickets()}
            title="Atualizar agora"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </header>

      <div className="tickets-toolbar">
        <div className="tickets-toolbar__search">
          <Search size={18} />
          <input
            type="text"
            placeholder="Buscar título, ID, formulário ou solicitante…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="tickets-toolbar__priority">
          {PRIORITY_FILTERS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`tickets-priority-pill ${priorityFilter === p.id ? 'tickets-priority-pill--active' : ''} ${p.id !== 'all' ? `tickets-priority-pill--${p.id}` : ''}`}
              onClick={() => setPriorityFilter(p.id)}
            >
              {p.id === 'urgent' && <Zap size={12} />}
              {p.label}
            </button>
          ))}
        </div>

        <div className="tickets-toolbar__actions">
          <div className="tickets-toolbar__select-wrap">
            <RefreshCw size={14} />
            <select value={autoRefresh} onChange={(e) => setAutoRefresh(e.target.value)}>
              <option value="0">0s</option>
              <option value="10">10s</option>
              <option value="30">30s</option>
              <option value="60">1 min</option>
              <option value="120">2 min</option>
            </select>
          </div>
          {canEditTickets && (
            <button
              type="button"
              className={`tickets-toolbar__mine ${onlyMyTickets ? 'tickets-toolbar__mine--on' : ''}`}
              onClick={() => setOnlyMyTickets((v) => !v)}
            >
              <User size={14} />
              Meus tickets
            </button>
          )}
        </div>
      </div>

      <div className="tickets-board">
        {COLUMNS.map((col) => {
          const list = getTicketsForColumn(col);
          const isOver = draggedOverColumn === col.id;
          const Icon = col.icon;

          return (
            <section
              key={col.id}
              className={`tickets-column ${isOver ? 'tickets-column--over' : ''}`}
              style={{ '--col-accent': col.accent } as React.CSSProperties}
              onDragOver={canEditTickets ? (e) => handleDragOver(e, col.id) : undefined}
              onDragLeave={canEditTickets ? handleDragLeave : undefined}
              onDrop={canEditTickets ? (e) => handleDrop(e, col) : undefined}
            >
              <header className="tickets-column__head">
                <div className="tickets-column__head-left">
                  <span className="tickets-column__icon" style={{ color: col.color }}>
                    <Icon size={18} />
                  </span>
                  <h2 className="tickets-column__title">{col.title}</h2>
                </div>
                <span className="tickets-column__count" style={{ background: col.bgColor, color: col.color }}>
                  {list.length}
                </span>
              </header>

              <div className="tickets-column__cards">
                {list.length === 0 ? (
                  <div className={`tickets-empty ${isOver ? 'tickets-empty--drop' : ''}`}>
                    {isOver ? (
                      <>
                        <ArrowUpRight size={28} />
                        <span>Solte o ticket aqui</span>
                      </>
                    ) : (
                      <>
                        <Icon size={32} strokeWidth={1.25} />
                        <span>Nenhum ticket</span>
                      </>
                    )}
                  </div>
                ) : (
                  list.map((ticket, idx) => {
                    const hours = getHoursSince(ticket);
                    const overdue = isScheduledOverdue(ticket);
                    const ageAlert = col.id === 'open' || col.id === 'in_progress';
                    const ageClass =
                      overdue
                        ? 'tickets-card--overdue'
                        : ageAlert && hours >= 48
                          ? 'tickets-card--stale-critical'
                          : ageAlert && hours >= 24
                            ? 'tickets-card--stale-warn'
                            : '';
                    const priority = PRIORITY_META[ticket.priority];

                    return (
                      <article
                        key={ticket.id}
                        className={`tickets-card ${priority.class} ${ageClass} ${draggedTicket?.id === ticket.id ? 'tickets-card--dragging' : ''}`}
                        style={{ animationDelay: `${Math.min(idx, 8) * 40}ms` }}
                        draggable={canEditTickets}
                        onClick={() => handleTicketClick(ticket.id)}
                        onDragStart={canEditTickets ? (e) => handleDragStart(e, ticket) : undefined}
                      >
                        <div className="tickets-card__stripe" style={{ background: priority.color }} />

                        <div className="tickets-card__body">
                          <div className="tickets-card__top">
                            <span className={`tickets-card__priority ${priority.class}`}>
                              {ticket.priority === 'urgent' && <Zap size={10} />}
                              {priority.label}
                            </span>
                            {ticket.ticket_number && ticket.created_at && (
                              <code className="tickets-card__id">{formatTicketId(ticket)}</code>
                            )}
                            <span className="tickets-card__age">{formatRelativeAge(ticket.created_at)}</span>
                          </div>

                          <h3 className="tickets-card__title">{formatTicketTitle(ticket.title)}</h3>
                          {ticket.description?.trim() && (
                            <p className="tickets-card__desc">{ticket.description}</p>
                          )}

                          <div className="tickets-card__tags">
                            {ticket.status === 'in_progress' && !!ticket.is_paused && (
                              <span className="tickets-card__tag tickets-card__tag--pause">
                                <Pause size={10} />
                                Pausado
                              </span>
                            )}
                            {overdue && (
                              <span className="tickets-card__tag tickets-card__tag--overdue">
                                <Clock size={10} />
                                Atrasado
                              </span>
                            )}
                            {ticket.form_name && (
                              <span className="tickets-card__tag tickets-card__tag--form">
                                <FileText size={10} />
                                {ticket.form_name}
                              </span>
                            )}
                          </div>

                          <footer className="tickets-card__foot">
                            {ticket.assigned_name ? (
                              <div className="tickets-card__assignee" title={ticket.assigned_name}>
                                <span className="tickets-card__avatar">{getInitials(ticket.assigned_name)}</span>
                                <span className="tickets-card__assignee-name">{ticket.assigned_name}</span>
                              </div>
                            ) : (
                              <span className="tickets-card__unassigned">Sem agente</span>
                            )}
                            <time className="tickets-card__time">
                              <Clock size={11} />
                              {ticket.status === 'scheduled' && ticket.scheduled_at
                                ? formatScheduledDate(ticket.scheduled_at)
                                : formatDate(ticket.created_at)}
                            </time>
                          </footer>
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </section>
          );
        })}
      </div>

      {selectedTicketId && (
        <div
          className="tickets-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedTicketId(null);
              fetchTickets();
            }
          }}
        >
          <div className="tickets-modal-content">
            <TicketDetail
              ticketId={selectedTicketId}
              onClose={() => {
                setSelectedTicketId(null);
                fetchTickets();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
