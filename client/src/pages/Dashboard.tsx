import { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
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

const PRIORITY_LABELS: Record<string, string> = { urgent: 'Urgente', high: 'Alta', medium: 'Média', low: 'Baixa' };
const PRIORITY_COLORS: Record<string, string> = { urgent: 'var(--red)', high: 'var(--red)', medium: 'var(--orange)', low: 'var(--blue)' };
const STATUS_LABELS: Record<string, string> = {
  open: 'Aberto',
  in_progress: 'Em progresso',
  resolved: 'Resolvido',
  closed: 'Fechado',
  pending_approval: 'Pend. aprovação',
};
const TYPE_LABELS: Record<string, string> = { event: 'Evento', work: 'Trabalho', ticket: 'Ticket', shift: 'Plantão' };
const TYPE_COLORS: Record<string, string> = {
  event: 'var(--purple)',
  work: 'var(--blue)',
  ticket: 'var(--orange)',
  shift: 'var(--green)',
};

// ——— Loading skeleton ———
function DashboardSkeleton() {
  return (
    <div className="dashboard" data-dashboard>
      <header className="dashboard__header">
        <div className="dashboard__skeleton dashboard__skeleton--title" style={{ width: 200, height: 28 }} />
        <div className="dashboard__skeleton dashboard__skeleton--subtitle" style={{ width: 280, height: 18 }} />
      </header>
      <div className="dashboard__kpis">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="dashboard__card dashboard__kpi">
            <div className="dashboard__skeleton" style={{ width: 40, height: 40, borderRadius: 10 }} />
            <div className="dashboard__kpi-content">
              <div className="dashboard__skeleton" style={{ width: 80, height: 12, marginBottom: 8 }} />
              <div className="dashboard__skeleton" style={{ width: 48, height: 28 }} />
            </div>
          </div>
        ))}
      </div>
      <div className="dashboard__grid dashboard__grid--main">
        <div className="dashboard__card dashboard__skeleton" style={{ minHeight: 240 }} />
        <div className="dashboard__card dashboard__skeleton" style={{ minHeight: 240 }} />
      </div>
      <div className="dashboard__skeleton dashboard__skeleton--chart" style={{ height: 160, borderRadius: 12 }} />
    </div>
  );
}

// ——— Error state ———
function DashboardError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="dashboard dashboard--error" data-dashboard>
      <div className="dashboard__error-content">
        <div className="dashboard__error-icon">
          <AlertCircle size={48} strokeWidth={1.5} />
        </div>
        <h2 className="dashboard__error-title">Não foi possível carregar o dashboard</h2>
        <p className="dashboard__error-message">{message}</p>
        <button type="button" className="btn btn-primary" onClick={onRetry}>
          Tentar novamente
        </button>
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

  const resourceLinks = [
    { to: '/projetos', label: 'Projetos', value: stats.projects?.total ?? 0, sub: `${stats.projects?.tasksOpen ?? 0} tarefas abertas`, icon: FolderKanban, show: hasPageAccess('/projetos') },
    { to: '/config/usuarios', label: 'Usuários', value: stats.users.total, sub: `${stats.users.active} ativos`, icon: Users, show: canViewUsers },
    { to: '/create/forms', label: 'Formulários', value: stats.forms.total, sub: `${stats.forms.active} ativos`, icon: FileText, show: hasPageAccess('/create/forms') },
    { to: '/create/pages', label: 'Páginas', value: stats.pages.total, sub: 'Páginas públicas', icon: Layers, show: hasPageAccess('/create/pages') },
    { to: '/config/grupos', label: 'Grupos', value: stats.groups.total, sub: 'Grupos', icon: UserCheck, show: hasPageAccess('/config/grupos') },
    { to: '/create/webhooks', label: 'Webhooks', value: stats.webhooks?.total ?? 0, sub: `${stats.webhooks?.active ?? 0} ativos`, icon: Webhook, show: hasPageAccess('/create/webhooks') },
  ].filter((r) => r.show);

  return (
    <div className="dashboard" data-dashboard>
      {/* Header */}
      <header className="dashboard__header">
        <div className="dashboard__header-top">
          <h1 className="dashboard__title">Visão geral</h1>
          <div className="dashboard__meta">
            <time className="dashboard__date">{todayStr}</time>
            {hasPageAccess('/config/backup') && lastBackupStr && (
              <span className="dashboard__backup" title="Último backup">
                <Database size={14} /> {lastBackupStr}
              </span>
            )}
          </div>
        </div>
        <p className="dashboard__subtitle">Resumo do sistema TIDESK</p>
      </header>

      {/* KPIs */}
      <section className="dashboard__kpis" aria-label="Indicadores principais">
        {hasPageAccess('/tickets') && (
          <>
            <Link to="/tickets" className="dashboard__card dashboard__kpi dashboard__kpi--link">
              <div className="dashboard__kpi-icon dashboard__kpi-icon--purple">
                <Ticket size={22} strokeWidth={2} />
              </div>
              <div className="dashboard__kpi-content">
                <span className="dashboard__kpi-label">Total de tickets</span>
                <span className="dashboard__kpi-value">{stats.tickets.total}</span>
                <span className="dashboard__kpi-sub">{stats.tickets.recent} nos últimos 7 dias</span>
              </div>
              <ChevronRight className="dashboard__kpi-arrow" size={18} />
            </Link>
            <Link to="/tickets" className="dashboard__card dashboard__kpi dashboard__kpi--link">
              <div className="dashboard__kpi-icon dashboard__kpi-icon--red">
                <AlertCircle size={22} strokeWidth={2} />
              </div>
              <div className="dashboard__kpi-content">
                <span className="dashboard__kpi-label">Abertos</span>
                <span className="dashboard__kpi-value">{stats.tickets.open}</span>
                <span className="dashboard__kpi-sub">{stats.tickets.inProgress} em progresso</span>
              </div>
              <ChevronRight className="dashboard__kpi-arrow" size={18} />
            </Link>
          </>
        )}
        <div className="dashboard__card dashboard__kpi">
          <div className="dashboard__kpi-icon dashboard__kpi-icon--green">
            <CheckCircle size={22} strokeWidth={2} />
          </div>
          <div className="dashboard__kpi-content">
            <span className="dashboard__kpi-label">Taxa de resolução</span>
            <span className="dashboard__kpi-value">{resolutionRate}%</span>
            <span className="dashboard__kpi-sub">{stats.tickets.resolvedToday} resolvidos hoje</span>
          </div>
        </div>
        <div className="dashboard__card dashboard__kpi">
          <div className="dashboard__kpi-icon dashboard__kpi-icon--blue">
            <Clock size={22} strokeWidth={2} />
          </div>
          <div className="dashboard__kpi-content">
            <span className="dashboard__kpi-label">Tempo médio</span>
            <span className="dashboard__kpi-value">{stats.tickets.avgResolutionHours.toFixed(1)}h</span>
            <span className="dashboard__kpi-sub">Resolução (30 dias)</span>
          </div>
        </div>
        {stats.tickets.pendingApproval > 0 && hasPageAccess('/acompanhar/aprovar') && (
          <Link to="/acompanhar/aprovar" className="dashboard__card dashboard__kpi dashboard__kpi--link dashboard__kpi--alert">
            <div className="dashboard__kpi-icon dashboard__kpi-icon--orange">
              <Zap size={22} strokeWidth={2} />
            </div>
            <div className="dashboard__kpi-content">
              <span className="dashboard__kpi-label">Pendentes aprovação</span>
              <span className="dashboard__kpi-value">{stats.tickets.pendingApproval}</span>
              <span className="dashboard__kpi-sub">Requerem atenção</span>
            </div>
            <ChevronRight className="dashboard__kpi-arrow" size={18} />
          </Link>
        )}
      </section>

      {/* Main grid: Left column + Agenda */}
      <div className="dashboard__grid dashboard__grid--main">
        <div className="dashboard__col">
          {/* Prioridade */}
          <div className="dashboard__card dashboard__block">
            <div className="dashboard__block-head">
              <PieChart size={20} className="dashboard__block-icon" />
              <h3 className="dashboard__block-title">Tickets por prioridade</h3>
            </div>
            <div className="dashboard__block-body">
              {!stats.tickets.byPriority.length ? (
                <p className="dashboard__empty">Nenhum ticket com prioridade</p>
              ) : (
                <div className="dashboard__bars">
                  {stats.tickets.byPriority.map((item, i) => {
                    const total = stats.tickets.byPriority.reduce((s, p) => s + p.count, 0);
                    const pct = total > 0 ? (item.count / total) * 100 : 0;
                    return (
                      <div key={i} className="dashboard__bar-row">
                        <div className="dashboard__bar-labels">
                          <span>{PRIORITY_LABELS[item.priority] || item.priority}</span>
                          <span>{item.count} ({pct.toFixed(0)}%)</span>
                        </div>
                        <div className="dashboard__bar-track">
                          <div
                            className="dashboard__bar-fill"
                            style={{ width: `${pct}%`, backgroundColor: PRIORITY_COLORS[item.priority] || 'var(--purple)' }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Top formulários */}
          <div className="dashboard__card dashboard__block">
            <div className="dashboard__block-head">
              <FileText size={20} className="dashboard__block-icon" />
              <h3 className="dashboard__block-title">Top formulários</h3>
            </div>
            <div className="dashboard__block-body">
              {(!stats.topForms || !stats.topForms.length) ? (
                <p className="dashboard__empty">Nenhum formulário com tickets</p>
              ) : (
                <div className="dashboard__bars">
                  {stats.topForms.map((f, i) => {
                    const max = Math.max(...stats.topForms!.map((x) => x.ticket_count), 1);
                    const pct = (f.ticket_count / max) * 100;
                    return (
                      <div key={i} className="dashboard__bar-row">
                        <div className="dashboard__bar-labels">
                          <span className="dashboard__bar-label-truncate" title={f.name}>{f.name}</span>
                          <span>{f.ticket_count}</span>
                        </div>
                        <div className="dashboard__bar-track">
                          <div className="dashboard__bar-fill dashboard__bar-fill--blue" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Hoje (Agenda do dia) */}
          {canViewAgenda && (
            <div className="dashboard__card dashboard__block dashboard__block--agenda">
              <div className="dashboard__block-head dashboard__block-head--action">
                <div className="dashboard__block-head-inner">
                  <Calendar size={20} className="dashboard__block-icon" />
                  <h3 className="dashboard__block-title">Hoje</h3>
                </div>
                {hasPageAccess('/agenda/calendario-de-servico') && (
                  <Link to="/agenda/calendario-de-servico" className="dashboard__block-link">
                    Calendário <ChevronRight size={14} />
                  </Link>
                )}
              </div>
              <div className="dashboard__block-body dashboard__block-body--scroll">
                {agendaLoading ? (
                  <div className="dashboard__agenda-loading">
                    <div className="dashboard__spinner" />
                    <span>Carregando agenda…</span>
                  </div>
                ) : agendaToday.length === 0 ? (
                  <p className="dashboard__empty">Nenhum evento ou plantão hoje.</p>
                ) : (
                  <ul className="dashboard__agenda-list">
                    {agendaToday.map((item) => {
                      const timeStr = formatTime(item.start_time);
                      const endStr = item.end_time && item.end_time !== item.start_time ? ` – ${formatTime(item.end_time)}` : '';
                      const typeColorVal = TYPE_COLORS[item.type] || 'var(--purple)';
                      const inner = (
                        <>
                          <span className="dashboard__agenda-time">{timeStr}{endStr}</span>
                          <div className="dashboard__agenda-info">
                            <span className="dashboard__agenda-title">{item.title}</span>
                            <span className="dashboard__agenda-type" style={{ color: typeColorVal }}>
                              {TYPE_LABELS[item.type]}
                              {item.user_names?.length ? ` · ${item.user_names.slice(0, 2).join(', ')}${item.user_names.length > 2 ? ` +${item.user_names.length - 2}` : ''}` : ''}
                            </span>
                          </div>
                          {item.link && <ChevronRight size={16} className="dashboard__agenda-go" />}
                        </>
                      );
                      return (
                        <li key={item.id} className="dashboard__agenda-item" style={{ borderLeftColor: typeColorVal }}>
                          {item.link ? (
                            <Link to={item.link} className="dashboard__agenda-item-link">
                              {inner}
                            </Link>
                          ) : (
                            <div className="dashboard__agenda-item-inner">{inner}</div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Atividade recente */}
        {stats.recentTickets && stats.recentTickets.length > 0 && hasPageAccess('/tickets') && (
          <div className="dashboard__card dashboard__block">
            <div className="dashboard__block-head dashboard__block-head--action">
              <div className="dashboard__block-head-inner">
                <Activity size={20} className="dashboard__block-icon" />
                <h3 className="dashboard__block-title">Atividade recente</h3>
              </div>
              <Link to="/tickets" className="dashboard__block-link">
                Ver todos <ChevronRight size={14} />
              </Link>
            </div>
            <div className="dashboard__block-body dashboard__block-body--list">
              {stats.recentTickets.map((t) => (
                <Link key={t.id} to={`/tickets/${t.id}`} className="dashboard__activity-item">
                  <div className="dashboard__activity-content">
                    <span className="dashboard__activity-title">
                      #{t.ticket_number} · {formatTicketTitle(t.title) || 'Sem título'}
                    </span>
                    <span className="dashboard__activity-meta">
                      {STATUS_LABELS[t.status] || t.status} · {formatDateBR(t.updated_at.split('T')[0])}
                    </span>
                  </div>
                  <ChevronRight size={16} className="dashboard__activity-arrow" />
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Evolução 30 dias */}
      {stats.timeline && stats.timeline.length > 0 && (
        <section className="dashboard__card dashboard__chart">
          <div className="dashboard__chart-head">
            <div className="dashboard__chart-title-wrap">
              <TrendingUp size={20} className="dashboard__block-icon" />
              <h3 className="dashboard__block-title">Evolução · últimos 30 dias</h3>
            </div>
            <span className="dashboard__chart-total">
              Total: {stats.timeline.reduce((s, t) => s + t.count, 0)} tickets
            </span>
          </div>
          <div className="dashboard__chart-bars">
            <div className="dashboard__chart-bars-inner">
              {stats.timeline.map((t, i) => {
                const pct = maxTimeline > 0 ? (t.count / maxTimeline) * 100 : 0;
                const isToday = i === stats.timeline.length - 1;
                return (
                  <div
                    key={i}
                    className={`dashboard__chart-bar ${isToday ? 'dashboard__chart-bar--today' : ''}`}
                    style={{ height: `${Math.max(pct, t.count > 0 ? 6 : 0)}%` }}
                    title={`${t.count} tickets · ${formatDateBR(t.date)}`}
                  >
                    {t.count > 0 && (
                      <span className={`dashboard__chart-bar-label ${isToday ? 'dashboard__chart-bar-label--today' : ''}`}>{t.count}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="dashboard__chart-axis">
            <span>{formatDateBR(stats.timeline[0].date)}</span>
            <span>Hoje</span>
          </div>
        </section>
      )}

      {/* Recursos do sistema */}
      {resourceLinks.length > 0 && (
        <section className="dashboard__resources" aria-label="Recursos do sistema">
          <h3 className="dashboard__resources-title">Recursos</h3>
          <div className="dashboard__resources-grid">
            {resourceLinks.map(({ to, label, value, sub, icon: Icon }) => (
              <Link key={to} to={to} className="dashboard__card dashboard__resource">
                <Icon size={20} className="dashboard__resource-icon" />
                <div className="dashboard__resource-content">
                  <span className="dashboard__resource-label">{label}</span>
                  <span className="dashboard__resource-value">{value}</span>
                  <span className="dashboard__resource-sub">{sub}</span>
                </div>
                <ChevronRight size={16} className="dashboard__resource-arrow" />
              </Link>
            ))}
          </div>
        </section>
      )}

      <style>{`
        .dashboard__skeleton { background: var(--bg-tertiary); border-radius: var(--radius-md); animation: dashboard-pulse 1.5s ease-in-out infinite; }
        .dashboard__skeleton--title { border-radius: var(--radius-sm); }
        .dashboard__skeleton--subtitle { margin-top: 0.5rem; border-radius: var(--radius-sm); }
        .dashboard__skeleton--chart { margin-top: var(--spacing-lg); }
        @keyframes dashboard-pulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; } }
        @keyframes dashboard-spin { to { transform: rotate(360deg); } }
        .dashboard__spinner {
          width: 24px; height: 24px;
          border: 2px solid var(--border-primary);
          border-top-color: var(--purple);
          border-radius: 50%;
          animation: dashboard-spin 0.7s linear infinite;
        }
      `}</style>
    </div>
  );
}
