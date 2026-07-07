import { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  Ticket,
  AlertCircle,
  CheckCircle,
  Clock,
  Users,
  FileText,
  Layers,
  UserCheck,
  TrendingUp,
  Activity,
  PieChart,
  Webhook,
  Calendar,
  ChevronRight,
  FolderKanban,
  Zap,
  Database,
} from 'lucide-react';
import { usePermissions, RESOURCES, ACTIONS } from '../hooks/usePermissions';
import { formatDateBR, formatTicketTitle } from '../utils/dateUtils';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface RecentTicketItem {
  id: number;
  ticket_number: string | number;
  title: string | null;
  updated_at: string;
  status: string;
}

interface DashboardStats {
  tickets: {
    total: number;
    open: number;
    inProgress: number;
    resolved: number;
    closed: number;
    pendingApproval: number;
    recent: number;
    resolvedToday: number;
    avgResolutionHours: number;
    byPriority: Array<{ priority: string; count: number }>;
  };
  users: { total: number; active: number };
  forms: { total: number; active: number };
  pages: { total: number };
  groups: { total: number };
  projects?: { total: number; tasksTotal: number; tasksOpen: number };
  topForms: Array<{ name: string; ticket_count: number }>;
  timeline: Array<{ date: string; count: number }>;
  webhooks?: { total: number; active: number; callsToday: number; callsLast7Days: number; successRate: number };
  recentTickets?: RecentTicketItem[];
  lastBackup?: string | null;
}

interface AgendaItem {
  id: number | string;
  start_time: string;
  end_time?: string;
  title: string;
  type: 'event' | 'work' | 'ticket' | 'shift';
  link?: string;
  color?: string;
  user_names?: string[];
  priority?: string;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '--:--';
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false });
}

type Accent = 'purple' | 'red' | 'green' | 'blue' | 'orange' | 'yellow';

const PRIORITY_LABELS: Record<string, string> = { urgent: 'Urgente', high: 'Alta', medium: 'Média', low: 'Baixa' };
const PRIORITY_ACCENT: Record<string, Accent> = { urgent: 'red', high: 'red', medium: 'orange', low: 'blue' };
const STATUS_LABELS: Record<string, string> = {
  open: 'Aberto',
  in_progress: 'Em progresso',
  resolved: 'Resolvido',
  closed: 'Fechado',
  pending_approval: 'Pend. aprovação',
};
const STATUS_ACCENT: Record<string, Accent> = {
  open: 'red',
  in_progress: 'blue',
  resolved: 'green',
  closed: 'purple',
  pending_approval: 'orange',
};
const TYPE_LABELS: Record<string, string> = { event: 'Evento', work: 'Trabalho', ticket: 'Ticket', shift: 'Plantão' };
const TYPE_ACCENT: Record<string, Accent> = { event: 'purple', work: 'blue', ticket: 'orange', shift: 'green' };

const ACCENT: Record<Accent, { text: string; solid: string; soft: string; softText: string; border: string }> = {
  purple: { text: 'text-[var(--purple)]', solid: 'bg-[var(--purple)]', soft: 'bg-[var(--purple-light)]', softText: 'text-[var(--purple)]', border: 'border-l-[var(--purple)]' },
  red: { text: 'text-[var(--red)]', solid: 'bg-[var(--red)]', soft: 'bg-[var(--red-light)]', softText: 'text-[var(--red)]', border: 'border-l-[var(--red)]' },
  green: { text: 'text-[var(--green)]', solid: 'bg-[var(--green)]', soft: 'bg-[var(--green-light)]', softText: 'text-[var(--green)]', border: 'border-l-[var(--green)]' },
  blue: { text: 'text-[var(--blue)]', solid: 'bg-[var(--blue)]', soft: 'bg-[var(--blue-light)]', softText: 'text-[var(--blue)]', border: 'border-l-[var(--blue)]' },
  orange: { text: 'text-[var(--orange)]', solid: 'bg-[var(--orange)]', soft: 'bg-[var(--orange-light)]', softText: 'text-[var(--orange)]', border: 'border-l-[var(--orange)]' },
  yellow: { text: 'text-[var(--yellow)]', solid: 'bg-[var(--yellow)]', soft: 'bg-[rgba(251,191,36,0.1)]', softText: 'text-[var(--yellow-hover)]', border: 'border-l-[var(--yellow)]' },
};

const RESOURCE_ACCENTS: Accent[] = ['purple', 'blue', 'green', 'orange', 'red', 'yellow'];

const BENTO_CARD = 'gap-3 px-4 py-4';
const SECTION_HEAD = 'mb-3.5 flex items-center gap-2';
const SECTION_TITLE = 'text-sm font-semibold text-foreground';
const SECTION_LINK = 'inline-flex items-center gap-0.5 text-xs font-semibold text-primary hover:text-[var(--purple-hover)]';

// ——— KPI card ———
function KpiCard({
  icon: Icon,
  accent,
  label,
  value,
  sub,
  to,
  highlight,
}: {
  icon: LucideIcon;
  accent: Accent;
  label: string;
  value: string | number;
  sub: string;
  to?: string;
  highlight?: boolean;
}) {
  const body = (
    <Card
      className={cn(
        'h-full gap-0 px-4 py-3.5 transition-all',
        ACCENT[accent].soft,
        to && 'hover:-translate-y-0.5 hover:shadow-md',
        highlight && 'ring-1 ring-[rgba(245,158,11,0.45)]'
      )}
    >
      <div className="flex items-start justify-between">
        <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-white', ACCENT[accent].solid)}>
          <Icon size={16} strokeWidth={2.25} />
        </div>
        {to && <ChevronRight className="mt-1 shrink-0 text-muted-foreground/50" size={15} />}
      </div>
      <span className="mt-2.5 block text-[0.7rem] font-medium text-muted-foreground">{label}</span>
      <span className="block text-3xl leading-tight font-bold text-foreground">{value}</span>
      <span className="mt-0.5 block truncate text-[0.7rem] text-muted-foreground">{sub}</span>
    </Card>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}

// ——— Loading skeleton ———
function DashboardSkeleton() {
  return (
    <div className="mx-auto max-w-[1400px] pb-12">
      <div className="mb-7">
        <Skeleton className="h-7 w-[200px]" />
        <Skeleton className="mt-2 h-[18px] w-[280px]" />
      </div>
      <div className="mb-6 grid grid-cols-2 gap-3.5 lg:grid-cols-5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i} className="flex-row items-center gap-3.5 py-3.5">
            <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1">
              <Skeleton className="mb-2 h-3 w-16" />
              <Skeleton className="h-6 w-10" />
            </div>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Skeleton className="h-52" />
        <Skeleton className="h-52" />
        <Skeleton className="h-full min-h-[420px] lg:row-span-2" />
        <Skeleton className="h-52" />
        <Skeleton className="h-52" />
      </div>
    </div>
  );
}

// ——— Error state ———
function DashboardError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-12">
      <div className="max-w-[360px] text-center">
        <AlertCircle size={48} strokeWidth={1.5} className="mx-auto mb-6 text-muted-foreground opacity-60" />
        <h2 className="mb-2 text-lg font-bold text-foreground">Não foi possível carregar o dashboard</h2>
        <p className="mb-6 text-[0.9375rem] leading-relaxed text-muted-foreground">{message}</p>
        <Button onClick={onRetry}>Tentar novamente</Button>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { hasPermission, hasPageAccess } = usePermissions();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [agendaToday, setAgendaToday] = useState<AgendaItem[]>([]);
  const [agendaLoading, setAgendaLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canViewAgenda = hasPermission(RESOURCES.AGENDA, ACTIONS.VIEW);
  const canViewUsers = hasPermission(RESOURCES.USERS, ACTIONS.VIEW);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!canViewAgenda) return;
    fetchAgendaToday();
  }, [canViewAgenda]);

  const fetchStats = async () => {
    try {
      const res = await axios.get<DashboardStats>('/api/dashboard/stats');
      setStats(res.data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const fetchAgendaToday = async () => {
    try {
      setAgendaLoading(true);
      const today = new Date();
      const start = new Date(today); start.setHours(0, 0, 0, 0);
      const end = new Date(today); end.setHours(23, 59, 59, 999);
      const [eventsRes, ticketsRes, shiftsRes] = await Promise.all([
        axios.get(`/api/calendar?start=${start.toISOString()}&end=${end.toISOString()}`),
        axios.get(`/api/calendar/tickets?start=${start.toISOString()}&end=${end.toISOString()}`),
        axios.get(`/api/shifts?start=${start.toISOString()}&end=${end.toISOString()}`),
      ]);
      const events: AgendaItem[] = (eventsRes.data || []).map((e: any) => ({
        id: `ev-${e.id}`,
        start_time: e.start_time,
        end_time: e.end_time,
        title: e.title || 'Sem título',
        type: e.type === 'work' ? 'work' : 'event',
        link: hasPageAccess('/agenda/calendario-de-servico') ? '/agenda/calendario-de-servico' : undefined,
        color: e.color || null,
        user_names: e.user_names,
      }));
      const tickets: AgendaItem[] = (ticketsRes.data || []).map((t: any) => ({
        id: `tk-${t.id}`,
        start_time: t.start_time,
        end_time: t.start_time,
        title: formatTicketTitle(t.title) || `Ticket #${t.ticket_number || t.id}`,
        type: 'ticket',
        link: hasPageAccess('/tickets') ? `/tickets/${t.id}` : undefined,
        color: t.color || null,
        priority: t.priority,
      }));
      const shifts: AgendaItem[] = (shiftsRes.data || []).map((s: any) => ({
        id: `sh-${s.id}`,
        start_time: s.start_time,
        end_time: s.end_time,
        title: s.title || 'Plantão',
        type: 'shift',
        link: hasPageAccess('/agenda/calendario-de-plantoes') ? '/agenda/calendario-de-plantoes' : undefined,
        color: s.color || null,
        user_names: s.user_names,
      }));
      const merged = [...events, ...tickets, ...shifts].sort(
        (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      );
      setAgendaToday(merged);
    } catch {
      setAgendaToday([]);
    } finally {
      setAgendaLoading(false);
    }
  };

  if (loading) return <DashboardSkeleton />;
  if (error || !stats) return <DashboardError message={error || 'Dados não disponíveis'} onRetry={fetchStats} />;

  const resolutionRate = stats.tickets.total > 0 ? Math.round((stats.tickets.resolved / stats.tickets.total) * 100) : 0;
  const maxTimeline = Math.max(...stats.timeline.map((t) => t.count), 1);
  const todayStr = formatDateBR(new Date().toISOString().split('T')[0]);
  const lastBackupStr = stats.lastBackup && stats.lastBackup.length >= 16
    ? formatDateBR(stats.lastBackup.slice(0, 10)) + ' ' + stats.lastBackup.slice(11, 16)
    : stats.lastBackup || null;
  const totalPriority = stats.tickets.byPriority.reduce((s, p) => s + p.count, 0);
  const maxTopForm = Math.max(...(stats.topForms || []).map((x) => x.ticket_count), 1);

  const resourceLinks = [
    { to: '/projetos', label: 'Projetos', value: stats.projects?.total ?? 0, sub: `${stats.projects?.tasksOpen ?? 0} tarefas abertas`, icon: FolderKanban, show: hasPageAccess('/projetos') },
    { to: '/config/usuarios', label: 'Usuários', value: stats.users.total, sub: `${stats.users.active} ativos`, icon: Users, show: canViewUsers },
    { to: '/create/forms', label: 'Formulários', value: stats.forms.total, sub: `${stats.forms.active} ativos`, icon: FileText, show: hasPageAccess('/create/forms') },
    { to: '/create/pages', label: 'Páginas', value: stats.pages.total, sub: 'Páginas públicas', icon: Layers, show: hasPageAccess('/create/pages') },
    { to: '/config/grupos', label: 'Grupos', value: stats.groups.total, sub: 'Grupos', icon: UserCheck, show: hasPageAccess('/config/grupos') },
    { to: '/create/webhooks', label: 'Webhooks', value: stats.webhooks?.total ?? 0, sub: `${stats.webhooks?.active ?? 0} ativos`, icon: Webhook, show: hasPageAccess('/create/webhooks') },
  ].filter((r) => r.show);

  return (
    <div className="mx-auto max-w-[1400px] pb-12">
      {/* Header */}
      <header className="mb-6">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-[1.65rem] font-extrabold tracking-tight text-foreground">Visão geral</h1>
          <div className="flex items-center gap-2.5">
            <Badge variant="outline" className="h-6 gap-1.5 px-2.5 text-[0.7rem] font-medium text-muted-foreground tabular-nums">
              {todayStr}
            </Badge>
            {hasPageAccess('/config/backup') && lastBackupStr && (
              <Badge variant="outline" className="h-6 gap-1.5 px-2.5 text-[0.7rem] font-medium text-muted-foreground" title="Último backup">
                <Database size={12} /> {lastBackupStr}
              </Badge>
            )}
          </div>
        </div>
        <p className="text-sm text-muted-foreground">Resumo do sistema TIDESK</p>
      </header>

      {/* KPIs */}
      <section className="mb-6 grid grid-cols-2 gap-3.5 lg:grid-cols-5" aria-label="Indicadores principais">
        {hasPageAccess('/tickets') && (
          <>
            <KpiCard icon={Ticket} accent="purple" label="TOTAL DE TICKETS" value={stats.tickets.total} sub={`${stats.tickets.recent} nos últimos 7 dias`} to="/tickets" />
            <KpiCard icon={AlertCircle} accent="red" label="ABERTOS" value={stats.tickets.open} sub={`${stats.tickets.inProgress} em progresso`} to="/tickets" />
          </>
        )}
        <KpiCard icon={CheckCircle} accent="green" label="TAXA DE RESOLUÇÃO" value={`${resolutionRate}%`} sub={`${stats.tickets.resolvedToday} resolvidos hoje`} />
        <KpiCard icon={Clock} accent="blue" label="TEMPO MÉDIO" value={`${stats.tickets.avgResolutionHours.toFixed(1)}h`} sub="Resolução (30 dias)" />
        {stats.tickets.pendingApproval > 0 && hasPageAccess('/acompanhar/aprovar') && (
          <KpiCard icon={Zap} accent="orange" label="PENDENTES APROVAÇÃO" value={stats.tickets.pendingApproval} sub="Requerem atenção" to="/acompanhar/aprovar" highlight />
        )}
      </section>

      {/* Bento grid */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Prioridade */}
        <Card className={BENTO_CARD}>
          <div className={SECTION_HEAD}>
            <PieChart size={16} className={cn('shrink-0', ACCENT.purple.text)} />
            <h3 className={SECTION_TITLE}>Tickets por prioridade</h3>
          </div>
          {!stats.tickets.byPriority.length ? (
            <p className="text-sm text-muted-foreground italic">Nenhum ticket com prioridade</p>
          ) : (
            <div className="flex flex-col gap-3">
              {stats.tickets.byPriority.map((item, i) => {
                const pct = totalPriority > 0 ? (item.count / totalPriority) * 100 : 0;
                const accent = PRIORITY_ACCENT[item.priority] || 'purple';
                return (
                  <div key={i} className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-[0.8125rem]">
                      <span className="flex items-center gap-1.5 font-medium text-foreground">
                        <span className={cn('h-1.5 w-1.5 rounded-full', ACCENT[accent].solid)} />
                        {PRIORITY_LABELS[item.priority] || item.priority}
                      </span>
                      <span className="font-semibold tabular-nums text-foreground">{item.count} <span className="font-normal text-muted-foreground">({pct.toFixed(0)}%)</span></span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className={cn('h-full rounded-full transition-[width] duration-300', ACCENT[accent].solid)} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Top formulários */}
        <Card className={BENTO_CARD}>
          <div className={SECTION_HEAD}>
            <FileText size={16} className={cn('shrink-0', ACCENT.blue.text)} />
            <h3 className={SECTION_TITLE}>Top formulários</h3>
          </div>
          {(!stats.topForms || !stats.topForms.length) ? (
            <p className="text-sm text-muted-foreground italic">Nenhum formulário com tickets</p>
          ) : (
            <div className="flex flex-col gap-3">
              {stats.topForms.map((f, i) => {
                const pct = (f.ticket_count / maxTopForm) * 100;
                return (
                  <div key={i} className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-[0.8125rem] font-medium text-foreground">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-muted text-[0.625rem] font-bold text-muted-foreground">{i + 1}</span>
                        <span className="truncate" title={f.name}>{f.name}</span>
                      </span>
                      <span className="shrink-0 tabular-nums">{f.ticket_count}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-[var(--blue)] transition-[width] duration-300" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Hoje (Agenda do dia) */}
        {canViewAgenda && (
          <Card className={BENTO_CARD}>
            <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Calendar size={16} className={cn('shrink-0', ACCENT.orange.text)} />
                <h3 className={SECTION_TITLE}>Hoje</h3>
              </div>
              {hasPageAccess('/agenda/calendario-de-servico') && (
                <Link to="/agenda/calendario-de-servico" className={SECTION_LINK}>
                  Calendário <ChevronRight size={13} />
                </Link>
              )}
            </div>
            <div className="-mx-4 -mb-4 max-h-[260px] min-h-[80px] flex-1 overflow-y-auto">
              {agendaLoading ? (
                <div className="flex min-h-[160px] flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-[var(--purple)]" />
                  <span>Carregando agenda…</span>
                </div>
              ) : agendaToday.length === 0 ? (
                <p className="px-4 py-2 text-sm text-muted-foreground italic">Nenhum evento ou plantão hoje.</p>
              ) : (
                <ul className="m-0 list-none p-0">
                  {agendaToday.map((item) => {
                    const timeStr = formatTime(item.start_time);
                    const endStr = item.end_time && item.end_time !== item.start_time ? ` – ${formatTime(item.end_time)}` : '';
                    const accent = TYPE_ACCENT[item.type] || 'purple';
                    const inner = (
                      <>
                        <span className="min-w-[40px] shrink-0 text-[0.7rem] font-bold tabular-nums text-muted-foreground">{timeStr}{endStr}</span>
                        <div className="min-w-0 flex-1">
                          <span className="block truncate text-[0.8125rem] font-semibold text-foreground">{item.title}</span>
                          <span className={cn('mt-0.5 inline-flex items-center gap-1 text-[0.65rem] font-semibold tracking-wide uppercase', ACCENT[accent].text)}>
                            {TYPE_LABELS[item.type]}
                            {item.user_names?.length ? ` · ${item.user_names.slice(0, 2).join(', ')}${item.user_names.length > 2 ? ` +${item.user_names.length - 2}` : ''}` : ''}
                          </span>
                        </div>
                        {item.link && <ChevronRight size={14} className={cn('mt-0.5 shrink-0', ACCENT.purple.text)} />}
                      </>
                    );
                    return (
                      <li key={item.id} className={cn('flex items-start gap-2 border-b border-l-2 border-border last:border-b-0 hover:bg-muted/60', ACCENT[accent].border)}>
                        {item.link ? (
                          <Link to={item.link} className="flex min-w-0 flex-1 items-start gap-2 px-4 py-2.5">
                            {inner}
                          </Link>
                        ) : (
                          <div className="flex min-w-0 flex-1 items-start gap-2 px-4 py-2.5">{inner}</div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </Card>
        )}

        {/* Atividade recente */}
        {stats.recentTickets && stats.recentTickets.length > 0 && hasPageAccess('/tickets') && (
          <Card className={BENTO_CARD}>
            <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Activity size={16} className={cn('shrink-0', ACCENT.red.text)} />
                <h3 className={SECTION_TITLE}>Atividade recente</h3>
              </div>
              <Link to="/tickets" className={SECTION_LINK}>
                Ver todos <ChevronRight size={13} />
              </Link>
            </div>
            <div className="-mx-4 -mb-4">
              {stats.recentTickets.map((t) => {
                const accent = STATUS_ACCENT[t.status] || 'purple';
                return (
                  <Link
                    key={t.id}
                    to={`/tickets/${t.id}`}
                    className="flex items-center gap-2.5 px-4 py-2.5 last:pb-4 hover:bg-muted/60"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-[0.8125rem] font-semibold text-foreground">
                        #{t.ticket_number} · {formatTicketTitle(t.title) || 'Sem título'}
                      </span>
                      <div className="mt-1 flex items-center gap-1.5">
                        <Badge className={cn('h-4 border-0 px-1.5 text-[0.625rem] font-semibold', ACCENT[accent].soft, ACCENT[accent].softText)}>
                          {STATUS_LABELS[t.status] || t.status}
                        </Badge>
                        <span className="text-[0.7rem] text-muted-foreground">{formatDateBR(t.updated_at.split('T')[0])}</span>
                      </div>
                    </div>
                    <ChevronRight size={15} className="shrink-0 text-muted-foreground/60" />
                  </Link>
                );
              })}
            </div>
          </Card>
        )}

        {/* Evolução 30 dias */}
        {stats.timeline && stats.timeline.length > 0 && (
          <Card className={cn(BENTO_CARD, 'lg:col-span-2')}>
            <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <TrendingUp size={16} className={cn('shrink-0', ACCENT.green.text)} />
                <h3 className={SECTION_TITLE}>Evolução · 30 dias</h3>
              </div>
              <span className="text-[0.7rem] tabular-nums text-muted-foreground">
                {stats.timeline.reduce((s, t) => s + t.count, 0)} tickets
              </span>
            </div>
            <div className="h-[140px] w-full rounded-lg bg-muted px-3 pt-5 pb-2">
              <div className="flex h-full items-end justify-between gap-[3px]">
                {stats.timeline.map((t, i) => {
                  const pct = maxTimeline > 0 ? (t.count / maxTimeline) * 100 : 0;
                  const isToday = i === stats.timeline.length - 1;
                  return (
                    <div
                      key={i}
                      className={cn('relative mx-auto max-w-[10px] min-w-[3px] flex-1 rounded-t transition-[height,opacity] duration-300', isToday ? ACCENT.green.solid : ACCENT.purple.solid)}
                      style={{
                        height: `${Math.max(pct, t.count > 0 ? 8 : 0)}%`,
                        opacity: isToday ? 1 : 0.7,
                      }}
                      title={`${t.count} tickets · ${formatDateBR(t.date)}`}
                    >
                      {t.count > 0 && (
                        <span
                          className={cn('pointer-events-none absolute -top-4 left-1/2 -translate-x-1/2 text-[0.625rem] font-bold whitespace-nowrap', isToday ? ACCENT.green.text : ACCENT.purple.text)}
                        >
                          {t.count}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="flex justify-between text-[0.65rem] tabular-nums text-muted-foreground">
              <span>{formatDateBR(stats.timeline[0].date)}</span>
              <span>Hoje</span>
            </div>
          </Card>
        )}
      </div>

      {/* Recursos do sistema */}
      {resourceLinks.length > 0 && (
        <section aria-label="Recursos do sistema">
          <h3 className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Recursos</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {resourceLinks.map(({ to, label, value, sub, icon: Icon }, i) => {
              const accent = RESOURCE_ACCENTS[i % RESOURCE_ACCENTS.length];
              return (
                <Link key={to} to={to}>
                  <Card className="h-full flex-row items-center gap-3 px-4 py-3 transition-all hover:-translate-y-0.5 hover:shadow-md">
                    <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-md', ACCENT[accent].soft, ACCENT[accent].softText)}>
                      <Icon size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-[0.7rem] font-medium text-muted-foreground">{label}</span>
                      <span className="block text-base leading-tight font-bold text-foreground">{value}</span>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
