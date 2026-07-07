import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import TicketDetail from './TicketDetail';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions, RESOURCES, ACTIONS } from '../hooks/usePermissions';
import { formatDateList, formatTicketTitle } from '../utils/dateUtils';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
    icon: Inbox,
  },
  {
    id: 'in_progress',
    title: 'Em progresso',
    subtitle: 'Sendo trabalhado',
    status: ['in_progress'],
    color: 'var(--blue)',
    bgColor: 'var(--blue-light)',
    icon: LayoutGrid,
  },
  {
    id: 'scheduled',
    title: 'Agendados',
    subtitle: 'Retorno programado',
    status: ['scheduled'],
    color: 'var(--purple)',
    bgColor: 'var(--purple-light)',
    icon: CalendarClock,
  },
  {
    id: 'closed',
    title: 'Finalizados',
    subtitle: 'Concluídos',
    status: ['closed'],
    color: 'var(--green)',
    bgColor: 'var(--green-light)',
    icon: CheckCircle,
  },
];

const PRIORITY_META: Record<Ticket['priority'], { label: string; color: string }> = {
  low: { label: 'Baixa', color: 'var(--text-tertiary)' },
  medium: { label: 'Média', color: 'var(--blue)' },
  high: { label: 'Alta', color: 'var(--orange)' },
  urgent: { label: 'Urgente', color: 'var(--red)' },
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const closeTicketDialog = () => {
    setSelectedTicketId(null);
    fetchTickets();
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {COLUMNS.map((col) => (
            <div key={col.id} className="flex flex-col gap-3">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkles size={18} />
          </div>
          <h1 className="text-xl font-semibold text-foreground">Tickets</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <StatChip label="Abertos" value={stats.open} colorVar="var(--red)" />
          <StatChip label="Progresso" value={stats.inProgress} colorVar="var(--blue)" />
          <StatChip label="Agend." value={stats.scheduled} colorVar="var(--purple)" />
          <StatChip label="Fim" value={stats.closed} colorVar="var(--green)" />
          {stats.urgent > 0 && (
            <span
              className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold"
              style={{ background: 'var(--red-light)', color: 'var(--red)' }}
            >
              <Zap size={12} />
              {stats.urgent}
            </span>
          )}
          <Button variant="outline" size="icon-sm" onClick={() => fetchTickets()} title="Atualizar agora">
            <RefreshCw size={14} />
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search size={16} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar título, ID, formulário ou solicitante…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {PRIORITY_FILTERS.map((p) => (
            <Button
              key={p.id}
              type="button"
              variant={priorityFilter === p.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPriorityFilter(p.id)}
            >
              {p.id === 'urgent' && <Zap size={12} />}
              {p.label}
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Select value={autoRefresh} onValueChange={setAutoRefresh}>
            <SelectTrigger size="sm" className="w-[90px]">
              <RefreshCw size={13} />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">0s</SelectItem>
              <SelectItem value="10">10s</SelectItem>
              <SelectItem value="30">30s</SelectItem>
              <SelectItem value="60">1 min</SelectItem>
              <SelectItem value="120">2 min</SelectItem>
            </SelectContent>
          </Select>
          {canEditTickets && (
            <Button
              type="button"
              variant={onlyMyTickets ? 'default' : 'outline'}
              size="sm"
              onClick={() => setOnlyMyTickets((v) => !v)}
            >
              <User size={14} />
              Meus tickets
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => {
          const list = getTicketsForColumn(col);
          const isOver = draggedOverColumn === col.id;
          const Icon = col.icon;

          return (
            <Card
              key={col.id}
              className={cn(
                'gap-3 py-3 transition-colors',
                isOver && 'ring-2 ring-primary/50'
              )}
              onDragOver={canEditTickets ? (e) => handleDragOver(e, col.id) : undefined}
              onDragLeave={canEditTickets ? handleDragLeave : undefined}
              onDrop={canEditTickets ? (e) => handleDrop(e, col) : undefined}
            >
              <header className="flex items-center justify-between px-4">
                <div className="flex items-center gap-2">
                  <span style={{ color: col.color }}>
                    <Icon size={17} />
                  </span>
                  <h2 className="text-sm font-semibold text-foreground">{col.title}</h2>
                </div>
                <span
                  className="flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold"
                  style={{ background: col.bgColor, color: col.color }}
                >
                  {list.length}
                </span>
              </header>

              <div className="flex flex-col gap-2 px-3">
                {list.length === 0 ? (
                  <div
                    className={cn(
                      'flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-10 text-xs text-muted-foreground',
                      isOver && 'border-primary/50 bg-primary/5 text-primary'
                    )}
                  >
                    {isOver ? (
                      <>
                        <ArrowUpRight size={26} />
                        <span>Solte o ticket aqui</span>
                      </>
                    ) : (
                      <>
                        <Icon size={28} strokeWidth={1.25} />
                        <span>Nenhum ticket</span>
                      </>
                    )}
                  </div>
                ) : (
                  list.map((ticket) => {
                    const hours = getHoursSince(ticket);
                    const overdue = isScheduledOverdue(ticket);
                    const ageAlert = col.id === 'open' || col.id === 'in_progress';
                    const stale = overdue || (ageAlert && hours >= 24);
                    const staleCritical = ageAlert && hours >= 48;
                    const priority = PRIORITY_META[ticket.priority];

                    return (
                      <article
                        key={ticket.id}
                        className={cn(
                          'group relative flex cursor-pointer flex-col gap-2 overflow-hidden rounded-lg border border-border bg-background/50 p-3 pl-3.5 transition-shadow hover:shadow-md',
                          draggedTicket?.id === ticket.id && 'opacity-50',
                          overdue && 'ring-1 ring-destructive/40',
                          staleCritical && 'ring-1 ring-destructive/30',
                          !staleCritical && stale && 'ring-1 ring-amber-500/30'
                        )}
                        draggable={canEditTickets}
                        onClick={() => handleTicketClick(ticket.id)}
                        onDragStart={canEditTickets ? (e) => handleDragStart(e, ticket) : undefined}
                      >
                        <span
                          className="absolute top-0 left-0 h-full w-1"
                          style={{ background: priority.color }}
                        />

                        <div className="flex items-center justify-between gap-2">
                          <span
                            className="flex items-center gap-1 text-[11px] font-semibold"
                            style={{ color: priority.color }}
                          >
                            {ticket.priority === 'urgent' && <Zap size={10} />}
                            {priority.label}
                          </span>
                          {ticket.ticket_number && ticket.created_at && (
                            <code className="text-[11px] text-muted-foreground">{formatTicketId(ticket)}</code>
                          )}
                          <span className="ml-auto text-[11px] text-muted-foreground">
                            {formatRelativeAge(ticket.created_at)}
                          </span>
                        </div>

                        <h3 className="text-sm font-medium text-foreground">{formatTicketTitle(ticket.title)}</h3>
                        {ticket.description?.trim() && (
                          <p className="line-clamp-2 text-xs text-muted-foreground">{ticket.description}</p>
                        )}

                        {(ticket.status === 'in_progress' && ticket.is_paused) || overdue || ticket.form_name ? (
                          <div className="flex flex-wrap gap-1.5">
                            {ticket.status === 'in_progress' && !!ticket.is_paused && (
                              <MiniTag icon={Pause} label="Pausado" colorVar="var(--orange)" />
                            )}
                            {overdue && <MiniTag icon={Clock} label="Atrasado" colorVar="var(--red)" />}
                            {ticket.form_name && (
                              <MiniTag icon={FileText} label={ticket.form_name} colorVar="var(--blue)" />
                            )}
                          </div>
                        ) : null}

                        <footer className="flex items-center justify-between gap-2 border-t border-border/60 pt-2">
                          {ticket.assigned_name ? (
                            <div className="flex min-w-0 items-center gap-1.5" title={ticket.assigned_name}>
                              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[9px] font-semibold text-primary">
                                {getInitials(ticket.assigned_name)}
                              </span>
                              <span className="truncate text-xs text-muted-foreground">{ticket.assigned_name}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground/70 italic">Sem agente</span>
                          )}
                          <time className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                            <Clock size={11} />
                            {ticket.status === 'scheduled' && ticket.scheduled_at
                              ? formatScheduledDate(ticket.scheduled_at)
                              : formatDate(ticket.created_at)}
                          </time>
                        </footer>
                      </article>
                    );
                  })
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <Dialog
        open={!!selectedTicketId}
        onOpenChange={(open) => {
          if (!open) closeTicketDialog();
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="h-[90vh] max-w-6xl overflow-hidden p-0 sm:max-w-6xl"
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          {selectedTicketId && (
            <TicketDetail ticketId={selectedTicketId} onClose={closeTicketDialog} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatChip({ label, value, colorVar }: { label: string; value: number; colorVar: string }) {
  return (
    <span
      className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground"
    >
      <span className="font-semibold" style={{ color: colorVar }}>
        {value}
      </span>
      {label}
    </span>
  );
}

function MiniTag({ icon: Icon, label, colorVar }: { icon: typeof Clock; label: string; colorVar: string }) {
  return (
    <span
      className="flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
      style={{ background: `color-mix(in srgb, ${colorVar} 15%, transparent)`, color: colorVar }}
    >
      <Icon size={10} />
      {label}
    </span>
  );
}
