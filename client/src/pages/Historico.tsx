import { useState, useEffect } from 'react';
import axios from 'axios';
import { History, Search, Calendar, User, Clock, ChevronLeft, ChevronRight, Tag, X } from 'lucide-react';
import TicketDetail from './TicketDetail';
import { formatDateBR, formatTicketTitle } from '../utils/dateUtils';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Ticket {
  id: number;
  ticket_number: number | null;
  title: string;
  description: string;
  status: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category_name: string;
  user_name: string;
  assigned_to: number | null;
  assigned_name: string | null;
  assigned_at: string | null; // Momento em que o agente pegou o ticket (para tempo de resolução correto)
  created_at: string;
  updated_at: string;
  total_collab_seconds?: number; // Soma do tempo de colaboração (cronômetro) no ticket
  form_name?: string;
}

// Função para gerar ID completo do ticket (sem barras) - usado em URLs
function getTicketFullId(ticket: Ticket): string {
  if (!ticket.ticket_number || !ticket.created_at) {
    return ticket.id.toString();
  }

  const date = new Date(ticket.created_at);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const number = String(ticket.ticket_number).padStart(3, '0');

  return `${year}${month}${day}${number}`;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const STATUS_LABEL: Record<string, string> = { resolved: 'Resolvido', closed: 'Fechado', rejected: 'Rejeitado' };
const STATUS_STYLE: Record<string, string> = {
  resolved: 'bg-[var(--green-light)] text-[var(--green)]',
  closed: 'bg-muted text-muted-foreground',
  rejected: 'bg-[var(--red-light)] text-[var(--red)]',
};

const PRIORITY_META: Record<Ticket['priority'], { label: string; color: string }> = {
  low: { label: 'Baixa', color: 'var(--text-tertiary)' },
  medium: { label: 'Média', color: 'var(--blue)' },
  high: { label: 'Alta', color: 'var(--orange)' },
  urgent: { label: 'Urgente', color: 'var(--red)' },
};

function StatChip({ label, value, colorVar }: { label: string; value: number; colorVar: string }) {
  return (
    <span className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
      <span className="font-semibold" style={{ color: colorVar }}>
        {value}
      </span>
      {label}
    </span>
  );
}

function TicketRowSkeleton() {
  return (
    <Card className="gap-1.5 px-4 py-3.5">
      <Skeleton className="h-4 w-2/5" />
      <div className="flex gap-4">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-24" />
      </div>
    </Card>
  );
}

export default function Historico() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterUser, setFilterUser] = useState('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const ticketsPerPage = 20;

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const response = await axios.get('/api/tickets');
      const historyTickets = response.data.filter(
        (ticket: Ticket) => ticket.status === 'resolved' || ticket.status === 'closed' || ticket.status === 'rejected'
      );
      setTickets(historyTickets);
    } catch (error) {
      console.error('Erro ao buscar histórico:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => formatDateBR(dateString, { includeTime: true });

  const calculateTimeToResolve = (totalCollabSeconds?: number) => {
    const diff = Math.max(0, (totalCollabSeconds || 0) * 1000);
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}min`;
    return `${minutes}min`;
  };

  const operators = Array.from(
    new Map(
      tickets
        .filter((t) => t.assigned_to != null && t.assigned_name)
        .map((t) => [t.assigned_to as number, t.assigned_name as string])
    ).entries()
  ).sort((a, b) => a[1].localeCompare(b[1]));

  const filteredTickets = tickets.filter((ticket) => {
    const matchesSearch =
      ticket.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (ticket.assigned_name && ticket.assigned_name.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = filterStatus === 'all' || ticket.status === filterStatus;
    const matchesPriority = filterPriority === 'all' || ticket.priority === filterPriority;
    const matchesUser = filterUser === 'all' || String(ticket.assigned_to) === filterUser;

    let matchesDate = true;
    if (filterDateFrom || filterDateTo) {
      const ticketDate = new Date(ticket.updated_at);
      ticketDate.setHours(0, 0, 0, 0);

      if (filterDateFrom) {
        const fromDate = new Date(filterDateFrom);
        fromDate.setHours(0, 0, 0, 0);
        if (ticketDate < fromDate) matchesDate = false;
      }

      if (filterDateTo) {
        const toDate = new Date(filterDateTo);
        toDate.setHours(23, 59, 59, 999);
        if (ticketDate > toDate) matchesDate = false;
      }
    }

    return matchesSearch && matchesStatus && matchesPriority && matchesUser && matchesDate;
  });

  const totalPages = Math.ceil(filteredTickets.length / ticketsPerPage);
  const startIndex = (currentPage - 1) * ticketsPerPage;
  const endIndex = startIndex + ticketsPerPage;
  const paginatedTickets = filteredTickets.slice(startIndex, endIndex);

  const hasActiveFilters =
    !!searchTerm || filterStatus !== 'all' || filterPriority !== 'all' || filterUser !== 'all' || !!filterDateFrom || !!filterDateTo;

  const clearFilters = () => {
    setSearchTerm('');
    setFilterStatus('all');
    setFilterPriority('all');
    setFilterUser('all');
    setFilterDateFrom('');
    setFilterDateTo('');
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus, filterPriority, filterUser, filterDateFrom, filterDateTo]);

  const stats = {
    resolved: tickets.filter((t) => t.status === 'resolved').length,
    closed: tickets.filter((t) => t.status === 'closed').length,
    rejected: tickets.filter((t) => t.status === 'rejected').length,
  };

  const openTicket = (ticket: Ticket) => setSelectedTicketId(getTicketFullId(ticket));

  const closeTicketDialog = () => {
    setSelectedTicketId(null);
    fetchHistory();
  };

  return (
    <div className="mx-auto max-w-[1400px]">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <History size={18} />
          </div>
          <h1 className="text-xl font-semibold text-foreground">Histórico</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatChip label="Resolvidos" value={stats.resolved} colorVar="var(--green)" />
          <StatChip label="Fechados" value={stats.closed} colorVar="var(--text-tertiary)" />
          {stats.rejected > 0 && <StatChip label="Rejeitados" value={stats.rejected} colorVar="var(--red)" />}
        </div>
      </header>

      {/* Barra de filtros — gruda no topo ao rolar */}
      <div className="sticky top-0 z-20 -mx-4 mb-4 flex flex-col gap-2.5 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-sm md:-mx-6 md:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search size={14} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar título, descrição, solicitante ou operador…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 pl-8 text-[0.8125rem]"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger size="sm" className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Status</SelectItem>
              <SelectItem value="resolved">Resolvido</SelectItem>
              <SelectItem value="closed">Fechado</SelectItem>
              <SelectItem value="rejected">Rejeitado</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterPriority} onValueChange={setFilterPriority}>
            <SelectTrigger size="sm" className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Prioridade</SelectItem>
              <SelectItem value="urgent">Urgente</SelectItem>
              <SelectItem value="high">Alta</SelectItem>
              <SelectItem value="medium">Média</SelectItem>
              <SelectItem value="low">Baixa</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterUser} onValueChange={setFilterUser}>
            <SelectTrigger size="sm" className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Operador</SelectItem>
              {operators.map(([id, name]) => (
                <SelectItem key={id} value={String(id)}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Calendar size={14} className="shrink-0 text-muted-foreground" />
            <Input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className="h-8 w-[140px] text-[0.8125rem]" />
            <span className="text-[0.8125rem] text-muted-foreground">até</span>
            <Input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className="h-8 w-[140px] text-[0.8125rem]" />
          </div>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 gap-1 text-muted-foreground">
              <X size={13} /> Limpar filtros
            </Button>
          )}
        </div>
      </div>

      {/* Lista de tickets */}
      <div className="flex flex-col gap-2.5">
        {loading ? (
          [1, 2, 3, 4, 5].map((i) => <TicketRowSkeleton key={i} />)
        ) : filteredTickets.length === 0 ? (
          <Card className="flex flex-col items-center px-4 py-16 text-center">
            <History size={48} strokeWidth={1.5} className="mb-4 text-muted-foreground opacity-50" />
            <p className="text-sm text-muted-foreground">
              {hasActiveFilters ? 'Nenhum ticket encontrado com os filtros aplicados' : 'Nenhum ticket no histórico ainda'}
            </p>
          </Card>
        ) : (
          <>
            {paginatedTickets.map((ticket) => {
              const priority = PRIORITY_META[ticket.priority] ?? PRIORITY_META.low;
              return (
                <article
                  key={ticket.id}
                  onClick={() => openTicket(ticket)}
                  className="group relative flex cursor-pointer flex-col gap-2 overflow-hidden rounded-lg border border-border bg-background/50 p-3.5 pl-4 transition-shadow hover:shadow-md"
                >
                  <span className="absolute top-0 left-0 h-full w-1" style={{ background: priority.color }} />

                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{formatTicketTitle(ticket.title)}</h3>
                    <Badge className={cn('border-0 text-[0.625rem] font-semibold tracking-wide uppercase', STATUS_STYLE[ticket.status])}>
                      {STATUS_LABEL[ticket.status] || ticket.status}
                    </Badge>
                    <Badge variant="outline" className="text-[0.625rem] font-semibold tracking-wide uppercase" style={{ color: priority.color }}>
                      {priority.label}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {ticket.category_name && (
                      <span className="flex items-center gap-1">
                        <Tag size={12} /> {ticket.category_name}
                      </span>
                    )}
                    {ticket.assigned_name ? (
                      <span className="flex items-center gap-1.5">
                        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[9px] font-semibold text-primary">
                          {getInitials(ticket.assigned_name)}
                        </span>
                        {ticket.assigned_name}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <User size={12} /> Sem agente
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock size={12} /> {calculateTimeToResolve(ticket.total_collab_seconds)}
                    </span>
                    <span className="ml-auto flex items-center gap-1">
                      <Calendar size={12} /> {formatDate(ticket.updated_at)}
                    </span>
                  </div>
                </article>
              );
            })}

            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-center gap-2">
                <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>
                  <ChevronLeft size={16} /> Anterior
                </Button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) pageNum = i + 1;
                    else if (currentPage <= 3) pageNum = i + 1;
                    else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                    else pageNum = currentPage - 2 + i;

                    return (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? 'default' : 'outline'}
                        size="sm"
                        className="w-9"
                        onClick={() => setCurrentPage(pageNum)}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>

                <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}>
                  Próxima <ChevronRight size={16} />
                </Button>
              </div>
            )}

            {filteredTickets.length > 0 && (
              <p className="mt-2 text-center text-sm text-muted-foreground">
                Mostrando {startIndex + 1} - {Math.min(endIndex, filteredTickets.length)} de {filteredTickets.length} tickets
              </p>
            )}
          </>
        )}
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
          {selectedTicketId && <TicketDetail ticketId={selectedTicketId} onClose={closeTicketDialog} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
