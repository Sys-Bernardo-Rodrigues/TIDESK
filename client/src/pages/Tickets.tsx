import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
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
  Filter,
  User,
  Inbox,
  Pause,
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
  return `${time} e ${dayDate}`;
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

interface Column {
  id: string;
  title: string;
  status: Ticket['status'][];
  color: string;
  bgColor: string;
  icon: typeof Inbox;
}

const COLUMNS: Column[] = [
  { id: 'open', title: 'Aberto', status: ['open'], color: 'var(--red)', bgColor: 'var(--red-light)', icon: Inbox },
  { id: 'in_progress', title: 'Em progresso', status: ['in_progress'], color: 'var(--blue)', bgColor: 'var(--blue-light)', icon: LayoutGrid },
  { id: 'scheduled', title: 'Agendados', status: ['scheduled'], color: 'var(--purple)', bgColor: 'var(--purple-light)', icon: Clock },
  { id: 'closed', title: 'Finalizados', status: ['closed'], color: 'var(--green)', bgColor: 'var(--green-light)', icon: CheckCircle },
];

const PRIORITY_COLORS: Record<Ticket['priority'], string> = {
  low: 'var(--text-tertiary)',
  medium: 'var(--blue)',
  high: 'var(--orange)',
  urgent: 'var(--red)',
};

const PRIORITY_LABELS: Record<Ticket['priority'], string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  urgent: 'Urgente',
};

export default function Tickets() {
  const navigate = useNavigate();
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
    } catch (err: any) {
      console.error('Erro ao atualizar status:', err);
      alert(err.response?.data?.error || 'Erro ao atualizar status');
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

  const getTicketsForColumn = (col: Column): Ticket[] => {
    let list = tickets.filter((t) => col.status.includes(t.status));
    if (onlyMyTickets && user) {
      list = list.filter((t) => t.assigned_name?.toLowerCase() === user.name?.toLowerCase());
    }
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.form_name?.toLowerCase().includes(q) ||
          t.user_name?.toLowerCase().includes(q)
      );
    }
    if (priorityFilter !== 'all') list = list.filter((t) => t.priority === priorityFilter);

    const order: Record<Ticket['priority'], number> = { urgent: 4, high: 3, medium: 2, low: 1 };
    return list.sort((a, b) => {
      const d = order[b.priority] - order[a.priority];
      return d !== 0 ? d : new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  };

  const handleTicketClick = (id: number) => {
    setViewedTickets((prev) => {
      const next = new Set(prev);
      next.add(id);
      localStorage.setItem('viewedTickets', JSON.stringify([...next]));
      return next;
    });
    const t = tickets.find((x) => x.id === id);
    if (t) navigate(`/tickets/${getTicketFullId(t)}`);
    else navigate(`/tickets/${id}`);
  };

  const formatDate = formatDateList;

  if (loading) {
    return (
      <div className="tickets-loading">
        <div className="tickets-loading-spinner" />
        <p>Carregando tickets…</p>
      </div>
    );
  }

  return (
    <div className="tickets-kanban">
      <div className="tickets-toolbar">
        <div className="tickets-toolbar-search">
          <Search size={16} />
          <input
            type="text"
            className="input"
            placeholder="Buscar por título, descrição, formulário…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="tickets-toolbar-filters">
          <div className="tickets-toolbar-group">
            <Filter size={14} />
            <select
              className="input"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
            >
              <option value="all">Todas prioridades</option>
              <option value="urgent">Urgente</option>
              <option value="high">Alta</option>
              <option value="medium">Média</option>
              <option value="low">Baixa</option>
            </select>
          </div>
          <div className="tickets-toolbar-group">
            <RefreshCw size={14} />
            <select
              className="input"
              value={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.value)}
            >
              <option value="0">Atualizar manual</option>
              <option value="10">10 s</option>
              <option value="30">30 s</option>
              <option value="60">1 min</option>
              <option value="120">2 min</option>
            </select>
          </div>
          {canEditTickets && (
            <div className="tickets-toolbar-group">
              <label className="tickets-toolbar-my">
                <input
                  type="checkbox"
                  checked={onlyMyTickets}
                  onChange={(e) => setOnlyMyTickets(e.target.checked)}
                />
                <User size={14} />
                <span>Meus tickets</span>
              </label>
            </div>
          )}
        </div>
      </div>

      <div className="tickets-board">
        {COLUMNS.map((col) => {
          const list = getTicketsForColumn(col);
          const isOver = draggedOverColumn === col.id;
          const Icon = col.icon;

          return (
            <div
              key={col.id}
              className={`tickets-column ${canEditTickets && isOver ? 'tickets-column--over' : ''}`}
              style={{
                borderColor: canEditTickets && isOver ? col.color : undefined,
                '--col-color': col.color,
                '--col-bg': col.bgColor,
              } as React.CSSProperties}
              onDragOver={canEditTickets ? (e) => handleDragOver(e, col.id) : undefined}
              onDragLeave={canEditTickets ? handleDragLeave : undefined}
              onDrop={canEditTickets ? (e) => handleDrop(e, col) : undefined}
            >
              <div className="tickets-column-header">
                <div className="tickets-column-title">
                  <span className="tickets-column-dot" style={{ background: col.color }} />
                  <Icon size={16} style={{ color: col.color }} />
                  <span>{col.title}</span>
                </div>
                <span className="tickets-column-count" style={{ background: col.bgColor, color: col.color }}>
                  {list.length}
                </span>
              </div>

              <div className="tickets-column-cards">
                {list.length === 0 ? (
                  <div className="tickets-empty">
                    {canEditTickets && isOver ? (
                      <>
                        <div className="tickets-empty-icon">Solte aqui</div>
                        <span>Solte o ticket nesta coluna</span>
                      </>
                    ) : (
                      <>
                        <Inbox size={32} />
                        <span>Nenhum ticket</span>
                      </>
                    )}
                  </div>
                ) : (
                  list.map((ticket) => {
                    const hours = getHoursSince(ticket);
                    const overdue = isScheduledOverdue(ticket);
                    const ageAlert = col.id === 'open' || col.id === 'in_progress';
                    const borderHint =
                      overdue
                        ? 'var(--purple)'
                        : ageAlert && hours >= 48
                        ? 'var(--red)'
                        : ageAlert && hours >= 24
                        ? 'var(--orange)'
                        : undefined;

                    return (
                      <div
                        key={ticket.id}
                        className={`tickets-card ${draggedTicket?.id === ticket.id ? 'tickets-card--dragging' : ''}`}
                        style={{ borderColor: borderHint }}
                        draggable={canEditTickets}
                        onClick={() => handleTicketClick(ticket.id)}
                        onDragStart={canEditTickets ? (e) => handleDragStart(e, ticket) : undefined}
                      >
                        <div className="tickets-card-top">
                          <span
                            className="tickets-card-priority"
                            style={{ background: PRIORITY_COLORS[ticket.priority] }}
                          >
                            {PRIORITY_LABELS[ticket.priority]}
                          </span>
                          {ticket.status === 'in_progress' && !!ticket.is_paused && (
                            <span className="tickets-card-paused" title="Em pausa (tempo não conta no tempo médio)">
                              <Pause size={10} />
                              Em pausa
                            </span>
                          )}
                          {ticket.ticket_number && ticket.created_at && (
                            <span className="tickets-card-id">{formatTicketId(ticket)}</span>
                          )}
                          {ticket.form_name && (
                            <span className="tickets-card-form">
                              <FileText size={10} />
                              Form
                            </span>
                          )}
                        </div>
                        <h4 className="tickets-card-title">{formatTicketTitle(ticket.title)}</h4>
                        <p className="tickets-card-desc">{ticket.description}</p>
                        <div className="tickets-card-meta">
                          {ticket.assigned_name && (
                            <span className="tickets-card-assignee">
                              <User size={10} />
                              {ticket.assigned_name}
                            </span>
                          )}
                          <span className="tickets-card-date">
                            {ticket.status === 'scheduled' && ticket.scheduled_at ? (
                              <>
                                <Clock size={10} />
                                Agendado: {formatScheduledDate(ticket.scheduled_at)}
                              </>
                            ) : (
                              <>
                                <Clock size={10} />
                                {formatDate(ticket.created_at)}
                              </>
                            )}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        .tickets-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 50vh;
          color: var(--text-secondary);
          gap: 1rem;
        }
        .tickets-loading-spinner {
          width: 40px;
          height: 40px;
          border: 3px solid var(--border-primary);
          border-top-color: var(--purple);
          border-radius: 50%;
          animation: tickets-spin 0.8s linear infinite;
        }
        @keyframes tickets-spin { to { transform: rotate(360deg); } }

        .tickets-kanban {
          padding: var(--spacing-lg);
          max-width: 1600px;
          margin: 0 auto;
        }

        .tickets-toolbar {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: var(--spacing-md);
          margin-bottom: var(--spacing-lg);
          padding: var(--spacing-md);
          background: var(--bg-secondary);
          border: 1px solid var(--border-primary);
          border-radius: var(--radius-md);
        }
        .tickets-toolbar-search {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex: 1;
          min-width: 200px;
        }
        .tickets-toolbar-search .input {
          flex: 1;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          height: 36px;
        }
        .tickets-toolbar-search svg {
          color: var(--text-tertiary);
          flex-shrink: 0;
        }
        .tickets-toolbar-filters {
          display: grid;
          grid-auto-flow: column;
          grid-auto-columns: max-content;
          align-items: center;
          gap: var(--spacing-sm);
        }
        .tickets-toolbar-group {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          height: 36px;
          margin: 0;
        }
        .tickets-toolbar-group .input {
          padding: 0.5rem 0.75rem;
          font-size: 0.8125rem;
          height: 36px;
          min-width: 140px;
          box-sizing: border-box;
        }
        .tickets-toolbar-group svg {
          color: var(--text-tertiary);
          flex-shrink: 0;
          display: block;
        }
        .tickets-toolbar-my {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          height: 36px;
          padding: 0 0.75rem;
          margin: 0;
          box-sizing: border-box;
          border-radius: var(--radius-sm);
          border: 1px solid var(--border-primary);
          background: var(--bg-tertiary);
          font-size: 0.8125rem;
          line-height: 1;
          color: var(--text-secondary);
          cursor: pointer;
          user-select: none;
          transition: var(--transition-base);
        }
        .tickets-toolbar-my:hover { background: var(--bg-hover); color: var(--text-primary); }
        .tickets-toolbar-my input[type="checkbox"] {
          width: 14px;
          height: 14px;
          margin: 0;
          padding: 0;
          display: block;
          cursor: pointer;
          accent-color: var(--purple);
          flex-shrink: 0;
          vertical-align: middle;
        }
        .tickets-toolbar-my span {
          line-height: 1;
          display: block;
        }
        .tickets-toolbar-my:has(input:checked) {
          background: var(--purple-light);
          border-color: var(--purple);
          color: var(--purple);
        }

        .tickets-board {
          display: grid;
          grid-template-columns: repeat(4, minmax(280px, 1fr));
          gap: var(--spacing-lg);
          align-items: start;
        }
        @media (max-width: 1280px) {
          .tickets-board { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 768px) {
          .tickets-board { grid-template-columns: 1fr; }
        }

        .tickets-column {
          display: flex;
          flex-direction: column;
          background: var(--bg-secondary);
          border: 2px solid var(--border-primary);
          border-radius: var(--radius-lg);
          padding: var(--spacing-md);
          min-height: 400px;
          max-height: calc(100vh - 320px);
          transition: border-color var(--transition-base), box-shadow var(--transition-base);
        }
        .tickets-column--over {
          border-style: dashed;
          box-shadow: 0 0 0 2px var(--col-color);
          background: rgba(145, 71, 255, 0.06);
        }

        .tickets-column-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: var(--spacing-md);
          padding-bottom: var(--spacing-sm);
          border-bottom: 2px solid var(--col-color, var(--border-primary));
        }
        .tickets-column-title {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.9375rem;
          font-weight: 600;
          color: var(--text-primary);
        }
        .tickets-column-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
        }
        .tickets-column-count {
          font-size: 0.75rem;
          font-weight: 700;
          padding: 0.2rem 0.5rem;
          border-radius: var(--radius-full);
        }

        .tickets-column-cards {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-sm);
          overflow-y: auto;
          flex: 1;
          padding-right: 2px;
        }
        .tickets-column-cards::-webkit-scrollbar {
          width: 6px;
        }
        .tickets-column-cards::-webkit-scrollbar-track {
          background: var(--bg-tertiary);
          border-radius: 3px;
        }
        .tickets-column-cards::-webkit-scrollbar-thumb {
          background: var(--border-secondary);
          border-radius: 3px;
        }

        .tickets-empty {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: var(--spacing-xl);
          color: var(--text-tertiary);
          font-size: 0.875rem;
          text-align: center;
        }
        .tickets-empty-icon {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--col-color, var(--purple));
        }

        .tickets-card {
          padding: var(--spacing-md);
          background: var(--bg-tertiary);
          border: 1px solid var(--border-primary);
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: border-color var(--transition-base), box-shadow var(--transition-base), transform var(--transition-base);
        }
        .tickets-card:hover {
          border-color: var(--border-secondary);
          box-shadow: var(--shadow-md);
          transform: translateY(-1px);
        }
        .tickets-card--dragging {
          opacity: 0.5;
          cursor: grabbing;
        }
        .tickets-card:active { cursor: grab; }

        .tickets-card-top {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          flex-wrap: wrap;
          margin-bottom: 0.5rem;
        }
        .tickets-card-priority {
          font-size: 0.625rem;
          font-weight: 700;
          color: #fff;
          padding: 0.15rem 0.4rem;
          border-radius: var(--radius-sm);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .tickets-card-paused {
          display: inline-flex;
          align-items: center;
          gap: 0.2rem;
          font-size: 0.6rem;
          font-weight: 600;
          color: var(--bg-primary);
          background: var(--warning);
          padding: 0.15rem 0.35rem;
          border-radius: var(--radius-sm);
        }
        .tickets-card-id {
          font-size: 0.7rem;
          font-family: ui-monospace, monospace;
          color: var(--text-tertiary);
        }
        .tickets-card-form {
          display: inline-flex;
          align-items: center;
          gap: 0.2rem;
          font-size: 0.65rem;
          color: var(--purple);
          background: var(--purple-light);
          padding: 0.15rem 0.35rem;
          border-radius: var(--radius-sm);
          margin-left: auto;
        }
        .tickets-card-title {
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--text-primary);
          line-height: 1.3;
          margin-bottom: 0.25rem;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .tickets-card-desc {
          font-size: 0.75rem;
          color: var(--text-secondary);
          line-height: 1.4;
          margin-bottom: 0.5rem;
          display: -webkit-box;
          -webkit-line-clamp: 4;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .tickets-card-meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
          padding-top: 0.5rem;
          border-top: 1px solid var(--border-primary);
          font-size: 0.7rem;
          color: var(--text-tertiary);
        }
        .tickets-card-assignee {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .tickets-card-date {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          flex-shrink: 0;
        }
      `}</style>
    </div>
  );
}
