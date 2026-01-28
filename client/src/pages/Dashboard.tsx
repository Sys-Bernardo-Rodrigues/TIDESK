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
} from 'lucide-react';
import { usePermissions, RESOURCES, ACTIONS } from '../hooks/usePermissions';
import { formatDateBR } from '../utils/dateUtils';

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
  topForms: Array<{ name: string; ticket_count: number }>;
  timeline: Array<{ date: string; count: number }>;
  webhooks?: { total: number; active: number; callsToday: number; callsLast7Days: number; successRate: number };
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
      console.error('Erro ao buscar estatísticas:', err);
      setError(err.response?.data?.error || 'Erro ao carregar dashboard');
    } finally {
      setLoading(false);
    }
  };

  const fetchAgendaToday = async () => {
    try {
      setAgendaLoading(true);
      const today = new Date();
      const start = new Date(today);
      start.setHours(0, 0, 0, 0);
      const end = new Date(today);
      end.setHours(23, 59, 59, 999);
      const startStr = start.toISOString();
      const endStr = end.toISOString();

      const [eventsRes, ticketsRes, shiftsRes] = await Promise.all([
        axios.get(`/api/calendar?start=${startStr}&end=${endStr}`),
        axios.get(`/api/calendar/tickets?start=${startStr}&end=${endStr}`),
        axios.get(`/api/shifts?start=${startStr}&end=${endStr}`),
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
        title: t.title || `Ticket #${t.ticket_number || t.id}`,
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
    } catch (err) {
      console.error('Erro ao buscar agenda do dia:', err);
      setAgendaToday([]);
    } finally {
      setAgendaLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="loading" style={{ minHeight: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid var(--border-primary)',
            borderTopColor: 'var(--purple)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 1rem',
          }} />
          <p style={{ color: 'var(--text-secondary)' }}>Carregando dashboard…</p>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div style={{ padding: 'var(--spacing-2xl)', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <AlertCircle size={48} style={{ marginBottom: 'var(--spacing-md)', opacity: 0.5 }} />
        <p style={{ marginBottom: 'var(--spacing-lg)' }}>{error || 'Erro ao carregar dados do dashboard'}</p>
        <button className="btn btn-primary" onClick={fetchStats}>
          Tentar novamente
        </button>
      </div>
    );
  }

  const resolutionRate = stats.tickets.total > 0
    ? Math.round((stats.tickets.resolved / stats.tickets.total) * 100)
    : 0;
  const openRate = stats.tickets.total > 0
    ? Math.round((stats.tickets.open / stats.tickets.total) * 100)
    : 0;
  const maxTimeline = Math.max(...stats.timeline.map((t) => t.count), 1);
  const todayStr = formatDateBR(new Date().toISOString().split('T')[0]);

  const metricCard = (
    label: string,
    value: string | number,
    sub: string,
    icon: React.ReactNode,
    iconBg: string,
    to?: string,
    opts?: { highlight?: boolean; badge?: string }
  ) => {
    const Wrapper = to && hasPageAccess(to) ? Link : 'div';
    const props = to && hasPageAccess(to) ? { to, style: { textDecoration: 'none' } } : {};
    const { highlight, badge } = opts || {};
    return (
      <Wrapper {...props}>
        <div
          className="card"
          style={{
            border: '1px solid var(--border-primary)',
            padding: 'var(--spacing-lg)',
            cursor: to && hasPageAccess(to) ? 'pointer' : 'default',
            transition: 'all var(--transition-base)',
            height: '100%',
            ...(highlight ? { background: 'linear-gradient(135deg, rgba(245,158,11,0.08) 0%, rgba(245,158,11,0.03) 100%)', borderColor: 'rgba(245,158,11,0.3)' } : {}),
          }}
          onMouseEnter={(e) => {
            if (to && hasPageAccess(to)) {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 'var(--spacing-sm)' }}>
            <div style={{ padding: 'var(--spacing-sm)', background: iconBg, borderRadius: 'var(--radius-md)' }}>
              {icon}
            </div>
            {badge && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: '600' }}>{badge}</span>
            )}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
            {label}
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-primary)', lineHeight: 1.2 }}>
            {value}
          </div>
          {sub && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Activity size={12} />
              {sub}
            </div>
          )}
        </div>
      </Wrapper>
    );
  };

  const sysCard = (label: string, value: number, sub: string, icon: React.ReactNode, to: string) => {
    if (!hasPageAccess(to)) return null;
    return (
      <Link key={label} to={to} style={{ textDecoration: 'none' }}>
        <div
          className="card"
          style={{
            border: '1px solid var(--border-primary)',
            padding: 'var(--spacing-md)',
            cursor: 'pointer',
            transition: 'all var(--transition-base)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-md)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = 'var(--shadow)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <div style={{ color: 'var(--purple)' }}>{icon}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: '500' }}>{label}</div>
            <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-primary)' }}>{value}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>{sub}</div>
          </div>
          <ChevronRight size={16} color="var(--text-tertiary)" />
        </div>
      </Link>
    );
  };

  const typeLabel: Record<string, string> = { event: 'Evento', work: 'Trabalho', ticket: 'Ticket', shift: 'Plantão' };
  const typeColor: Record<string, string> = {
    event: 'var(--purple)',
    work: 'var(--blue)',
    ticket: 'var(--orange)',
    shift: 'var(--green)',
  };

  return (
    <div style={{ paddingBottom: 'var(--spacing-2xl)' }}>
      <header style={{ marginBottom: 'var(--spacing-xl)' }}>
        <h1 style={{
          fontSize: '1.75rem',
          fontWeight: '800',
          color: 'var(--text-primary)',
          letterSpacing: '-0.02em',
          marginBottom: '0.25rem',
        }}>
          Dashboard
        </h1>
        <p style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)' }}>
          {todayStr} · Visão geral do TIDESK
        </p>
      </header>

      {/* Métricas principais – Tickets */}
      <section style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 'var(--spacing-md)',
        marginBottom: 'var(--spacing-xl)',
      }}>
        {hasPageAccess('/tickets') && metricCard(
          'Total de tickets',
          stats.tickets.total,
          `${stats.tickets.recent} nos últimos 7 dias`,
          <Ticket size={20} color="var(--purple)" strokeWidth={2} />,
          'var(--purple-light)',
          '/tickets',
          { badge: `${openRate}% abertos` }
        )}
        {hasPageAccess('/tickets') && metricCard(
          'Abertos',
          stats.tickets.open,
          `${stats.tickets.inProgress} em progresso`,
          <AlertCircle size={20} color="var(--red)" strokeWidth={2} />,
          'var(--red-light)',
          '/tickets'
        )}
        {metricCard(
          'Taxa de resolução',
          `${resolutionRate}%`,
          `${stats.tickets.resolvedToday} resolvidos hoje`,
          <CheckCircle size={20} color="var(--green)" strokeWidth={2} />,
          'var(--green-light)'
        )}
        {metricCard(
          'Tempo médio',
          `${stats.tickets.avgResolutionHours.toFixed(1)}h`,
          'Resolução (30 dias)',
          <Clock size={20} color="var(--blue)" strokeWidth={2} />,
          'var(--blue-light)'
        )}
        {stats.tickets.pendingApproval > 0 && hasPageAccess('/acompanhar/aprovar') && metricCard(
          'Pendentes aprovação',
          stats.tickets.pendingApproval,
          'Requerem atenção',
          <AlertCircle size={20} color="var(--orange)" strokeWidth={2} />,
          'var(--orange-light)',
          '/acompanhar/aprovar',
          { highlight: true }
        )}
      </section>

      {/* Métricas do sistema */}
      <section style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: 'var(--spacing-sm)',
        marginBottom: 'var(--spacing-xl)',
      }}>
        {canViewUsers && sysCard('Usuários', stats.users.total, `${stats.users.active} ativos`, <Users size={20} />, '/config/usuarios')}
        {hasPageAccess('/create/forms') && sysCard('Formulários', stats.forms.total, `${stats.forms.active} ativos`, <FileText size={20} />, '/create/forms')}
        {hasPageAccess('/create/pages') && sysCard('Páginas', stats.pages.total, 'Páginas públicas', <Layers size={20} />, '/create/pages')}
        {hasPageAccess('/config/grupos') && sysCard('Grupos', stats.groups.total, 'Grupos', <UserCheck size={20} />, '/config/grupos')}
        {hasPageAccess('/create/webhooks') && sysCard(
          'Webhooks',
          stats.webhooks?.total ?? 0,
          `${stats.webhooks?.active ?? 0} ativos · ${stats.webhooks?.callsToday ?? 0} hoje`,
          <Webhook size={20} />,
          '/create/webhooks'
        )}
      </section>

      {/* Grid: Prioridade + Top Forms + Agenda do dia */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: canViewAgenda ? '1fr 1fr' : '1fr',
        gap: 'var(--spacing-lg)',
        marginBottom: 'var(--spacing-xl)',
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-lg)', gridColumn: canViewAgenda ? 'span 1' : 'span 2' }}>
          {/* Prioridade */}
          <div className="card" style={{ border: '1px solid var(--border-primary)', padding: 'var(--spacing-lg)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-md)' }}>
              <PieChart size={20} color="var(--purple)" />
              <h3 style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--text-primary)' }}>Tickets por prioridade</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
              {stats.tickets.byPriority.length === 0 ? (
                <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem', fontStyle: 'italic' }}>Nenhum ticket com prioridade</p>
              ) : (
                stats.tickets.byPriority.map((item, i) => {
                  const total = stats.tickets.byPriority.reduce((s, p) => s + p.count, 0);
                  const pct = total > 0 ? (item.count / total) * 100 : 0;
                  const colors: Record<string, string> = { urgent: 'var(--red)', high: 'var(--red)', medium: 'var(--orange)', low: 'var(--blue)' };
                  const labels: Record<string, string> = { urgent: 'Urgente', high: 'Alta', medium: 'Média', low: 'Baixa' };
                  return (
                    <div key={i}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                        <span style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', fontWeight: '500' }}>{labels[item.priority] || item.priority}</span>
                        <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', fontWeight: '600' }}>{item.count} ({pct.toFixed(1)}%)</span>
                      </div>
                      <div style={{ height: 6, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: colors[item.priority] || 'var(--purple)', borderRadius: 'inherit', transition: 'width 0.2s ease' }} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Top formulários */}
          <div className="card" style={{ border: '1px solid var(--border-primary)', padding: 'var(--spacing-lg)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-md)' }}>
              <FileText size={20} color="var(--blue)" />
              <h3 style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--text-primary)' }}>Top formulários</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
              {(!stats.topForms || stats.topForms.length === 0) ? (
                <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem', fontStyle: 'italic' }}>Nenhum formulário com tickets</p>
              ) : (
                stats.topForms.map((f, i) => {
                  const max = Math.max(...stats.topForms!.map((x) => x.ticket_count), 1);
                  const pct = (f.ticket_count / max) * 100;
                  return (
                    <div key={i}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                        <span style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                        <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', fontWeight: '600', flexShrink: 0 }}>{f.ticket_count}</span>
                      </div>
                      <div style={{ height: 6, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, var(--blue), var(--blue-hover))', borderRadius: 'inherit', transition: 'width 0.2s ease' }} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Agenda do dia */}
        {canViewAgenda && (
          <div className="card" style={{ border: '1px solid var(--border-primary)', padding: 'var(--spacing-lg)', gridRow: 'span 2' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--spacing-md)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                <Calendar size={20} color="var(--purple)" />
                <h3 style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--text-primary)' }}>Agenda do dia</h3>
              </div>
              {hasPageAccess('/agenda/calendario-de-servico') && (
                <Link
                  to="/agenda/calendario-de-servico"
                  style={{ fontSize: '0.8125rem', color: 'var(--purple)', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                >
                  Calendário <ChevronRight size={14} />
                </Link>
              )}
            </div>
            {agendaLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 120, color: 'var(--text-tertiary)' }}>
                <div style={{ width: 24, height: 24, border: '2px solid var(--border-primary)', borderTopColor: 'var(--purple)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              </div>
            ) : agendaToday.length === 0 ? (
              <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem', fontStyle: 'italic', margin: 0 }}>Nenhum evento, ticket agendado ou plantão hoje.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)', maxHeight: 320, overflowY: 'auto' }}>
                {agendaToday.map((item) => {
                  const timeStr = formatTime(item.start_time);
                  const endStr = item.end_time && item.end_time !== item.start_time ? ` – ${formatTime(item.end_time)}` : '';
                  const typeColorVal = typeColor[item.type] || 'var(--purple)';
                  const content = (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 'var(--spacing-sm)',
                        padding: 'var(--spacing-sm)',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--bg-tertiary)',
                        borderLeft: `3px solid ${typeColorVal}`,
                      }}
                    >
                      <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-tertiary)', flexShrink: 0, minWidth: 36 }}>
                        {timeStr}{endStr}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                          <span style={{ fontSize: '0.7rem', color: typeColorVal, fontWeight: '600', textTransform: 'uppercase' }}>{typeLabel[item.type]}</span>
                          {item.user_names && item.user_names.length > 0 && (
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>{item.user_names.slice(0, 2).join(', ')}{item.user_names.length > 2 ? ` +${item.user_names.length - 2}` : ''}</span>
                          )}
                        </div>
                      </div>
                      {item.link && (
                        <Link
                          to={item.link}
                          style={{ flexShrink: 0, padding: '0.25rem', color: 'var(--purple)', display: 'flex', alignItems: 'center' }}
                          title="Ver"
                        >
                          <ChevronRight size={16} />
                        </Link>
                      )}
                    </div>
                  );
                  return content;
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Timeline 30 dias */}
      {stats.timeline && stats.timeline.length > 0 && (
        <div className="card" style={{ border: '1px solid var(--border-primary)', padding: 'var(--spacing-lg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--spacing-md)', flexWrap: 'wrap', gap: 'var(--spacing-sm)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
              <Activity size={20} color="var(--green)" />
              <h3 style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--text-primary)' }}>Evolução (últimos 30 dias)</h3>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <TrendingUp size={14} /> Total: {stats.timeline.reduce((s, t) => s + t.count, 0)} tickets
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 140, padding: 'var(--spacing-sm)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-primary)' }}>
            {stats.timeline.map((t, i) => {
              const h = maxTimeline > 0 ? (t.count / maxTimeline) * 100 : 0;
              const isToday = i === stats.timeline.length - 1;
              return (
                <div
                  key={i}
                  title={`${t.count} tickets · ${formatDateBR(t.date)}`}
                  style={{
                    flex: 1,
                    minWidth: 4,
                    height: `${h}%`,
                    minHeight: t.count > 0 ? 4 : 0,
                    background: isToday ? 'var(--green)' : 'var(--purple)',
                    borderRadius: '4px 4px 0 0',
                    transition: 'height 0.2s ease',
                    border: isToday ? '2px solid var(--green)' : 'none',
                    opacity: isToday ? 1 : 0.85,
                  }}
                />
              );
            })}
          </div>
          <div style={{ marginTop: 'var(--spacing-sm)', display: 'flex', justifyContent: 'center', gap: 'var(--spacing-lg)', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <div style={{ width: 10, height: 10, background: 'var(--purple)', borderRadius: 2 }} /> Histórico
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <div style={{ width: 10, height: 10, background: 'var(--green)', borderRadius: 2, border: '2px solid var(--green)' }} /> Hoje
            </span>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
