import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  FileBarChart, 
  TrendingUp, 
  Clock, 
  Users, 
  Ticket, 
  CheckCircle,
  Calendar,
  BarChart3,
  PieChart,
  Zap,
  RefreshCw
} from 'lucide-react';

interface OverviewData {
  period: string;
  dateRange: { start: string; end: string };
  totalTickets: number;
  resolvedTickets: number;
  resolutionRate: number;
  avgResolutionTimeHours: number;
  ticketsByStatus: Array<{ status: string; count: number }>;
  ticketsByPriority: Array<{ priority: string; count: number }>;
}

interface FormData {
  id: number;
  name: string;
  ticket_count: number;
  resolved_count: number;
  avg_resolution_hours: number;
}

interface AgentPerformance {
  id: number;
  name: string;
  email: string;
  total_tickets: number;
  resolved_tickets: number;
  avg_resolution_hours: number;
  min_resolution_hours: number;
  max_resolution_hours: number;
}

interface TimelineData {
  period: string;
  total: number;
  open: number;
  in_progress: number;
  resolved: number;
}

interface ResponseTimeData {
  priority: string;
  total_tickets: number;
  avg_hours: number;
  min_hours: number;
  max_hours: number;
}

export default function Reports() {
  const [period, setPeriod] = useState('month');
  const [customDateStart, setCustomDateStart] = useState('');
  const [customDateEnd, setCustomDateEnd] = useState('');
  const [useCustomDates, setUseCustomDates] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState('0'); // 0 = desabilitado
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [formsData, setFormsData] = useState<FormData[]>([]);
  const [agentsData, setAgentsData] = useState<AgentPerformance[]>([]);
  const [timeline, setTimeline] = useState<TimelineData[]>([]);
  const [responseTime, setResponseTime] = useState<ResponseTimeData[]>([]);

  useEffect(() => {
    if (useCustomDates && customDateStart && customDateEnd) {
      fetchAllData();
    } else if (!useCustomDates) {
      fetchAllData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, useCustomDates, customDateStart, customDateEnd]);

  // Auto-refresh quando autoRefresh estiver ativo
  useEffect(() => {
    if (autoRefresh === '0') return;

    const intervalMs = parseInt(autoRefresh) * 1000;
    const refreshInterval = setInterval(() => {
      fetchAllData();
    }, intervalMs);

    return () => clearInterval(refreshInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, period, useCustomDates, customDateStart, customDateEnd]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const periodParam = useCustomDates && customDateStart && customDateEnd
        ? `custom&start=${customDateStart}&end=${customDateEnd}`
        : period;
      
      const [overviewRes, formsRes, agentsRes, timelineRes, responseTimeRes] = await Promise.all([
        axios.get(`/api/reports/overview?period=${periodParam}`),
        axios.get(`/api/reports/by-form?period=${periodParam}`),
        axios.get(`/api/reports/agents-performance?period=${periodParam}`),
        axios.get(`/api/reports/timeline?period=${periodParam}&groupBy=day`),
        axios.get(`/api/reports/response-time-by-priority?period=${periodParam}`)
      ]);

      setOverview(overviewRes.data);
      setFormsData(formsRes.data);
      setAgentsData(agentsRes.data);
      setTimeline(timelineRes.data);
      setResponseTime(responseTimeRes.data);
    } catch (error) {
      console.error('Erro ao buscar relatórios:', error);
      alert('Erro ao carregar relatórios');
    } finally {
      setLoading(false);
    }
  };

  const formatHours = (hours: number | null): string => {
    if (!hours || isNaN(hours)) return 'N/A';
    if (hours < 1) return `${Math.round(hours * 60)}min`;
    if (hours < 24) return `${Math.round(hours * 10) / 10}h`;
    const days = Math.floor(hours / 24);
    const remainingHours = Math.round((hours % 24) * 10) / 10;
    return `${days}d ${remainingHours}h`;
  };

  const getStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
      open: 'Aberto',
      in_progress: 'Em Progresso',
      resolved: 'Resolvido',
      closed: 'Fechado',
      scheduled: 'Agendado',
      pending_approval: 'Pendente Aprovação'
    };
    return labels[status] || status;
  };

  const getPriorityLabel = (priority: string): string => {
    const labels: Record<string, string> = {
      low: 'Baixa',
      medium: 'Média',
      high: 'Alta',
      urgent: 'Urgente'
    };
    return labels[priority] || priority;
  };

  const getPriorityColor = (priority: string): string => {
    const colors: Record<string, string> = {
      low: 'var(--blue)',
      medium: 'var(--yellow)',
      high: 'var(--orange)',
      urgent: 'var(--red)'
    };
    return colors[priority] || 'var(--text-secondary)';
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '60vh',
        color: 'var(--text-secondary)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: '4px solid var(--border-primary)',
            borderTopColor: 'var(--purple)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1rem'
          }} />
          <p>Carregando relatórios...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      padding: 'var(--spacing-lg)',
      maxWidth: '1920px',
      margin: '0 auto',
      position: 'relative'
    }}>
      {/* Filtros Fixos no Canto Superior Direito */}
      <div style={{ 
        position: 'fixed',
        top: 0,
        right: 0,
        display: 'flex',
        alignItems: 'stretch',
        gap: 'var(--spacing-xs)',
        zIndex: 1000,
        padding: 'var(--spacing-sm)',
        backgroundColor: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-primary)',
        borderLeft: '1px solid var(--border-primary)',
        borderBottomLeftRadius: 'var(--radius-md)',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        flexWrap: 'nowrap'
      }}>
        <select
          className="input"
          value={useCustomDates ? 'custom' : period}
          onChange={(e) => {
            if (e.target.value === 'custom') {
              setUseCustomDates(true);
            } else {
              setUseCustomDates(false);
              setPeriod(e.target.value);
            }
          }}
          style={{ 
            minWidth: '120px',
            padding: '0.375rem 0.75rem',
            fontSize: '0.8125rem',
            height: '32px',
            cursor: 'pointer',
            boxSizing: 'border-box',
            lineHeight: '1'
          }}
        >
          <option value="today">Hoje</option>
          <option value="week">Semana</option>
          <option value="month">Mês</option>
          <option value="quarter">Trimestre</option>
          <option value="year">Ano</option>
          <option value="custom">Personalizado</option>
        </select>
        
        {useCustomDates ? (
          <>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
              <Calendar size={14} color="var(--text-tertiary)" />
              <input
                type="date"
                className="input"
                value={customDateStart}
                onChange={(e) => setCustomDateStart(e.target.value)}
                style={{ 
                  minWidth: '130px',
                  padding: '0.375rem 0.75rem',
                  fontSize: '0.8125rem',
                  height: '32px',
                  boxSizing: 'border-box',
                  lineHeight: '1'
                }}
                placeholder="De"
              />
              <span style={{ color: 'var(--text-tertiary)', fontSize: '0.8125rem' }}>até</span>
              <input
                type="date"
                className="input"
                value={customDateEnd}
                onChange={(e) => setCustomDateEnd(e.target.value)}
                style={{ 
                  minWidth: '130px',
                  padding: '0.375rem 0.75rem',
                  fontSize: '0.8125rem',
                  height: '32px',
                  boxSizing: 'border-box',
                  lineHeight: '1'
                }}
                placeholder="Até"
              />
            </div>
          </>
        ) : null}
        
        {/* Auto-Refresh */}
        <div style={{ position: 'relative', height: '32px', flexShrink: 0 }}>
          <RefreshCw 
            size={14}
            style={{
              position: 'absolute',
              left: '0.5rem',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-tertiary)',
              pointerEvents: 'none',
              zIndex: 1
            }}
          />
          <select
            className="input"
            value={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.value)}
            style={{
              paddingLeft: '1.75rem',
              paddingRight: '0.75rem',
              paddingTop: '0.375rem',
              paddingBottom: '0.375rem',
              fontSize: '0.8125rem',
              cursor: 'pointer',
              height: '32px',
              minWidth: '90px',
              boxSizing: 'border-box',
              lineHeight: '1'
            }}
          >
            <option value="0">Manual</option>
            <option value="10">10s</option>
            <option value="30">30s</option>
            <option value="60">60s</option>
            <option value="90">90s</option>
            <option value="120">120s</option>
          </select>
        </div>
      </div>

      {/* Espaço para os filtros fixos */}
      <div style={{ height: '50px', marginBottom: 'var(--spacing-md)' }}></div>

      {/* Cards de Métricas Principais */}
      {overview && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: 'var(--spacing-lg)',
          marginBottom: 'var(--spacing-xl)'
        }}>
          <div className="card slide-in" style={{ 
            border: '1px solid var(--border-primary)',
            padding: 'var(--spacing-lg)',
            animationDelay: '0ms'
          }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              marginBottom: 'var(--spacing-md)' 
            }}>
              <div style={{
                padding: 'var(--spacing-md)',
                background: 'var(--blue-light)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid rgba(59, 130, 246, 0.2)'
              }}>
                <Ticket size={24} color="var(--blue)" strokeWidth={2} />
              </div>
            </div>
            <h3 style={{ 
              fontSize: '0.8125rem', 
              color: 'var(--text-secondary)',
              fontWeight: '500',
              marginBottom: 'var(--spacing-sm)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              Total de Tickets
            </h3>
            <div style={{ 
              fontSize: '2.5rem', 
              fontWeight: '800',
              color: 'var(--blue)',
              lineHeight: '1'
            }}>
              {overview.totalTickets}
            </div>
          </div>

          <div className="card slide-in" style={{ 
            border: '1px solid var(--border-primary)',
            padding: 'var(--spacing-lg)',
            animationDelay: '100ms'
          }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              marginBottom: 'var(--spacing-md)' 
            }}>
              <div style={{
                padding: 'var(--spacing-md)',
                background: 'var(--green-light)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid rgba(34, 197, 94, 0.2)'
              }}>
                <CheckCircle size={24} color="var(--green)" strokeWidth={2} />
              </div>
            </div>
            <h3 style={{ 
              fontSize: '0.8125rem', 
              color: 'var(--text-secondary)',
              fontWeight: '500',
              marginBottom: 'var(--spacing-sm)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              Taxa de Resolução
            </h3>
            <div style={{ 
              fontSize: '2.5rem', 
              fontWeight: '800',
              color: 'var(--green)',
              lineHeight: '1'
            }}>
              {overview.resolutionRate.toFixed(1)}%
            </div>
            <div style={{ 
              fontSize: '0.875rem',
              color: 'var(--text-tertiary)',
              marginTop: 'var(--spacing-xs)'
            }}>
              {overview.resolvedTickets} de {overview.totalTickets} resolvidos
            </div>
          </div>

          <div className="card slide-in" style={{ 
            border: '1px solid var(--border-primary)',
            padding: 'var(--spacing-lg)',
            animationDelay: '200ms'
          }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              marginBottom: 'var(--spacing-md)' 
            }}>
              <div style={{
                padding: 'var(--spacing-md)',
                background: 'var(--purple-light)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid rgba(145, 71, 255, 0.2)'
              }}>
                <Clock size={24} color="var(--purple)" strokeWidth={2} />
              </div>
            </div>
            <h3 style={{ 
              fontSize: '0.8125rem', 
              color: 'var(--text-secondary)',
              fontWeight: '500',
              marginBottom: 'var(--spacing-sm)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              Tempo Médio
            </h3>
            <div style={{ 
              fontSize: '2.5rem', 
              fontWeight: '800',
              color: 'var(--purple)',
              lineHeight: '1'
            }}>
              {formatHours(overview.avgResolutionTimeHours)}
            </div>
            <div style={{ 
              fontSize: '0.875rem',
              color: 'var(--text-tertiary)',
              marginTop: 'var(--spacing-xs)'
            }}>
              Tempo médio de resolução
            </div>
          </div>

          <div className="card slide-in" style={{ 
            border: '1px solid var(--border-primary)',
            padding: 'var(--spacing-lg)',
            animationDelay: '300ms'
          }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              marginBottom: 'var(--spacing-md)' 
            }}>
              <div style={{
                padding: 'var(--spacing-md)',
                background: 'var(--orange-light)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid rgba(249, 115, 22, 0.2)'
              }}>
                <TrendingUp size={24} color="var(--orange)" strokeWidth={2} />
              </div>
            </div>
            <h3 style={{ 
              fontSize: '0.8125rem', 
              color: 'var(--text-secondary)',
              fontWeight: '500',
              marginBottom: 'var(--spacing-sm)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              Tickets Resolvidos
            </h3>
            <div style={{ 
              fontSize: '2.5rem', 
              fontWeight: '800',
              color: 'var(--orange)',
              lineHeight: '1'
            }}>
              {overview.resolvedTickets}
            </div>
          </div>
        </div>
      )}

      {/* Gráficos e Tabelas */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))',
        gap: 'var(--spacing-xl)',
        marginBottom: 'var(--spacing-xl)'
      }}>
        {/* Tickets por Status */}
        {overview && (
          <div className="card" style={{ 
            border: '1px solid var(--border-primary)',
            padding: 'var(--spacing-lg)'
          }}>
            <h2 style={{ 
              fontSize: '1.25rem',
              fontWeight: '700',
              color: 'var(--text-primary)',
              marginBottom: 'var(--spacing-lg)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-sm)'
            }}>
              <PieChart size={20} color="var(--purple)" />
              Tickets por Status
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
              {overview.ticketsByStatus.map((item) => (
                <div key={item.status} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 'var(--spacing-sm)',
                  backgroundColor: 'var(--bg-tertiary)',
                  borderRadius: 'var(--radius-sm)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                    <div style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      backgroundColor: item.status === 'resolved' || item.status === 'closed' 
                        ? 'var(--green)' 
                        : item.status === 'in_progress' 
                        ? 'var(--blue)' 
                        : 'var(--orange)'
                    }} />
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                      {getStatusLabel(item.status)}
                    </span>
                  </div>
                  <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>
                    {item.count}
                  </strong>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tickets por Prioridade */}
        {overview && (
          <div className="card" style={{ 
            border: '1px solid var(--border-primary)',
            padding: 'var(--spacing-lg)'
          }}>
            <h2 style={{ 
              fontSize: '1.25rem',
              fontWeight: '700',
              color: 'var(--text-primary)',
              marginBottom: 'var(--spacing-lg)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-sm)'
            }}>
              <BarChart3 size={20} color="var(--purple)" />
              Tickets por Prioridade
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
              {overview.ticketsByPriority.map((item) => (
                <div key={item.priority} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 'var(--spacing-sm)',
                  backgroundColor: 'var(--bg-tertiary)',
                  borderRadius: 'var(--radius-sm)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                    <div style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      backgroundColor: getPriorityColor(item.priority)
                    }} />
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                      {getPriorityLabel(item.priority)}
                    </span>
                  </div>
                  <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>
                    {item.count}
                  </strong>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tickets por Formulário */}
      <div className="card" style={{ 
        border: '1px solid var(--border-primary)',
        padding: 'var(--spacing-lg)',
        marginBottom: 'var(--spacing-xl)'
      }}>
        <h2 style={{ 
          fontSize: '1.25rem',
          fontWeight: '700',
          color: 'var(--text-primary)',
          marginBottom: 'var(--spacing-lg)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-sm)'
        }}>
          <FileBarChart size={20} color="var(--purple)" />
          Tickets por Formulário
        </h2>
        {formsData.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: 'var(--spacing-xl)' }}>
            Nenhum ticket gerado por formulários no período selecionado
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-primary)' }}>
                  <th style={{ 
                    padding: 'var(--spacing-sm)',
                    textAlign: 'left',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    color: 'var(--text-secondary)'
                  }}>Formulário</th>
                  <th style={{ 
                    padding: 'var(--spacing-sm)',
                    textAlign: 'center',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    color: 'var(--text-secondary)'
                  }}>Total</th>
                  <th style={{ 
                    padding: 'var(--spacing-sm)',
                    textAlign: 'center',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    color: 'var(--text-secondary)'
                  }}>Resolvidos</th>
                  <th style={{ 
                    padding: 'var(--spacing-sm)',
                    textAlign: 'center',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    color: 'var(--text-secondary)'
                  }}>Taxa</th>
                  <th style={{ 
                    padding: 'var(--spacing-sm)',
                    textAlign: 'center',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    color: 'var(--text-secondary)'
                  }}>Tempo Médio</th>
                </tr>
              </thead>
              <tbody>
                {formsData.map((form) => {
                  const resolutionRate = form.ticket_count > 0 
                    ? (form.resolved_count / form.ticket_count) * 100 
                    : 0;
                  return (
                    <tr key={form.id} style={{ 
                      borderBottom: '1px solid var(--border-primary)',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <td style={{ padding: 'var(--spacing-sm)' }}>
                        <strong style={{ color: 'var(--text-primary)' }}>{form.name}</strong>
                      </td>
                      <td style={{ padding: 'var(--spacing-sm)', textAlign: 'center' }}>
                        {form.ticket_count}
                      </td>
                      <td style={{ padding: 'var(--spacing-sm)', textAlign: 'center' }}>
                        <span style={{ color: 'var(--green)' }}>{form.resolved_count}</span>
                      </td>
                      <td style={{ padding: 'var(--spacing-sm)', textAlign: 'center' }}>
                        {resolutionRate.toFixed(1)}%
                      </td>
                      <td style={{ padding: 'var(--spacing-sm)', textAlign: 'center' }}>
                        {formatHours(form.avg_resolution_hours)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Performance de Agentes */}
      {agentsData.length > 0 && (
        <div className="card" style={{ 
          border: '1px solid var(--border-primary)',
          padding: 'var(--spacing-lg)',
          marginBottom: 'var(--spacing-xl)'
        }}>
          <h2 style={{ 
            fontSize: '1.25rem',
            fontWeight: '700',
            color: 'var(--text-primary)',
            marginBottom: 'var(--spacing-lg)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-sm)'
          }}>
            <Users size={20} color="var(--purple)" />
            Performance de Agentes
          </h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-primary)' }}>
                  <th style={{ 
                    padding: 'var(--spacing-sm)',
                    textAlign: 'left',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    color: 'var(--text-secondary)'
                  }}>Agente</th>
                  <th style={{ 
                    padding: 'var(--spacing-sm)',
                    textAlign: 'center',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    color: 'var(--text-secondary)'
                  }}>Total</th>
                  <th style={{ 
                    padding: 'var(--spacing-sm)',
                    textAlign: 'center',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    color: 'var(--text-secondary)'
                  }}>Resolvidos</th>
                  <th style={{ 
                    padding: 'var(--spacing-sm)',
                    textAlign: 'center',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    color: 'var(--text-secondary)'
                  }}>Taxa</th>
                  <th style={{ 
                    padding: 'var(--spacing-sm)',
                    textAlign: 'center',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    color: 'var(--text-secondary)'
                  }}>Tempo Médio</th>
                  <th style={{ 
                    padding: 'var(--spacing-sm)',
                    textAlign: 'center',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    color: 'var(--text-secondary)'
                  }}>Min/Max</th>
                </tr>
              </thead>
              <tbody>
                {agentsData.map((agent) => {
                  const resolutionRate = agent.total_tickets > 0 
                    ? (agent.resolved_tickets / agent.total_tickets) * 100 
                    : 0;
                  return (
                    <tr key={agent.id} style={{ 
                      borderBottom: '1px solid var(--border-primary)',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <td style={{ padding: 'var(--spacing-sm)' }}>
                        <div>
                          <strong style={{ color: 'var(--text-primary)' }}>{agent.name}</strong>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                            {agent.email}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: 'var(--spacing-sm)', textAlign: 'center' }}>
                        {agent.total_tickets}
                      </td>
                      <td style={{ padding: 'var(--spacing-sm)', textAlign: 'center' }}>
                        <span style={{ color: 'var(--green)' }}>{agent.resolved_tickets}</span>
                      </td>
                      <td style={{ padding: 'var(--spacing-sm)', textAlign: 'center' }}>
                        {resolutionRate.toFixed(1)}%
                      </td>
                      <td style={{ padding: 'var(--spacing-sm)', textAlign: 'center' }}>
                        {formatHours(agent.avg_resolution_hours)}
                      </td>
                      <td style={{ padding: 'var(--spacing-sm)', textAlign: 'center', fontSize: '0.8125rem' }}>
                        {formatHours(agent.min_resolution_hours)} / {formatHours(agent.max_resolution_hours)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tempo de Resposta por Prioridade */}
      {responseTime.length > 0 && (
        <div className="card" style={{ 
          border: '1px solid var(--border-primary)',
          padding: 'var(--spacing-lg)'
        }}>
          <h2 style={{ 
            fontSize: '1.25rem',
            fontWeight: '700',
            color: 'var(--text-primary)',
            marginBottom: 'var(--spacing-lg)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-sm)'
          }}>
            <Zap size={20} color="var(--purple)" />
            Tempo de Resposta por Prioridade
          </h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-primary)' }}>
                  <th style={{ 
                    padding: 'var(--spacing-sm)',
                    textAlign: 'left',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    color: 'var(--text-secondary)'
                  }}>Prioridade</th>
                  <th style={{ 
                    padding: 'var(--spacing-sm)',
                    textAlign: 'center',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    color: 'var(--text-secondary)'
                  }}>Total</th>
                  <th style={{ 
                    padding: 'var(--spacing-sm)',
                    textAlign: 'center',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    color: 'var(--text-secondary)'
                  }}>Tempo Médio</th>
                  <th style={{ 
                    padding: 'var(--spacing-sm)',
                    textAlign: 'center',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    color: 'var(--text-secondary)'
                  }}>Mínimo</th>
                  <th style={{ 
                    padding: 'var(--spacing-sm)',
                    textAlign: 'center',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    color: 'var(--text-secondary)'
                  }}>Máximo</th>
                </tr>
              </thead>
              <tbody>
                {responseTime.map((item) => (
                  <tr key={item.priority} style={{ 
                    borderBottom: '1px solid var(--border-primary)',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <td style={{ padding: 'var(--spacing-sm)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                        <div style={{
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          backgroundColor: getPriorityColor(item.priority)
                        }} />
                        <strong style={{ color: 'var(--text-primary)' }}>
                          {getPriorityLabel(item.priority)}
                        </strong>
                      </div>
                    </td>
                    <td style={{ padding: 'var(--spacing-sm)', textAlign: 'center' }}>
                      {item.total_tickets}
                    </td>
                    <td style={{ padding: 'var(--spacing-sm)', textAlign: 'center' }}>
                      {formatHours(item.avg_hours)}
                    </td>
                    <td style={{ padding: 'var(--spacing-sm)', textAlign: 'center' }}>
                      {formatHours(item.min_hours)}
                    </td>
                    <td style={{ padding: 'var(--spacing-sm)', textAlign: 'center' }}>
                      {formatHours(item.max_hours)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CSS Animation */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
