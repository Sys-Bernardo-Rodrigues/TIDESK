import { useEffect, useState } from 'react';
import axios from 'axios';
import { 
  Ticket, AlertCircle, CheckCircle, Clock, Users, FileText, 
  FolderOpen, Layers, UserCheck, TrendingUp, Activity, 
  BarChart3, PieChart, ArrowUp, ArrowDown, Webhook
} from 'lucide-react';
import { Link } from 'react-router-dom';
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
  users: {
    total: number;
    active: number;
  };
  forms: {
    total: number;
    active: number;
  };
  pages: {
    total: number;
  };
  groups: {
    total: number;
  };
  topForms: Array<{ name: string; ticket_count: number }>;
  timeline: Array<{ date: string; count: number }>;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
    // Atualizar a cada 30 segundos
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    try {
      const response = await axios.get('/api/dashboard/stats');
      setStats(response.data);
      setError(null);
    } catch (err: any) {
      console.error('Erro ao buscar estatísticas:', err);
      setError(err.response?.data?.error || 'Erro ao carregar dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Carregando dashboard...</div>;
  }

  if (error || !stats) {
    return (
      <div style={{ 
        padding: 'var(--spacing-2xl)', 
        textAlign: 'center',
        color: 'var(--text-secondary)'
      }}>
        <AlertCircle size={48} style={{ marginBottom: 'var(--spacing-md)', opacity: 0.5 }} />
        <p>{error || 'Erro ao carregar dados do dashboard'}</p>
        {error && (
          <button 
            className="btn btn-primary"
            onClick={fetchStats}
            style={{ marginTop: 'var(--spacing-md)' }}
          >
            Tentar Novamente
          </button>
        )}
        <button 
          className="btn btn-primary" 
          onClick={fetchStats}
          style={{ marginTop: 'var(--spacing-md)' }}
        >
          Tentar Novamente
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

  // Preparar dados para gráfico de barras simples
  const maxTimelineCount = Math.max(...stats.timeline.map(t => t.count), 1);

  return (
    <div>
      <div style={{ marginBottom: 'var(--spacing-2xl)' }}>
        <h1 style={{ 
          fontSize: '2.5rem', 
          fontWeight: '800', 
          marginBottom: 'var(--spacing-sm)',
          background: 'linear-gradient(135deg, var(--text-primary) 0%, var(--text-secondary) 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          letterSpacing: '-0.03em'
        }}>
          Dashboard Geral
        </h1>
        <p style={{
          color: 'var(--text-secondary)',
          fontSize: '1rem',
          fontWeight: '400'
        }}>
          Visão geral completa do sistema TIDESK
        </p>
      </div>

      {/* Cards de Métricas Principais - Tickets */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 'var(--spacing-lg)',
        marginBottom: 'var(--spacing-xl)'
      }}>
        <Link to="/tickets" style={{ textDecoration: 'none' }}>
          <div className="card slide-in" style={{ 
            border: '1px solid var(--border-primary)',
            cursor: 'pointer',
            transition: 'all var(--transition-base)',
            animationDelay: '0ms'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
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
                <Ticket size={24} color="var(--purple)" strokeWidth={2} />
              </div>
              <span style={{ 
                fontSize: '0.75rem',
                color: 'var(--text-tertiary)',
                fontWeight: '600'
              }}>
                {openRate}% abertos
              </span>
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
              color: 'var(--text-primary)',
              lineHeight: '1',
              marginBottom: 'var(--spacing-xs)'
            }}>
              {stats.tickets.total}
            </div>
            <div style={{ 
              fontSize: '0.75rem',
              color: 'var(--text-tertiary)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-xs)'
            }}>
              <Activity size={12} />
              {stats.tickets.recent} nos últimos 7 dias
            </div>
          </div>
        </Link>

        <Link to="/tickets" style={{ textDecoration: 'none' }}>
          <div className="card slide-in" style={{ 
            border: '1px solid var(--border-primary)',
            cursor: 'pointer',
            transition: 'all var(--transition-base)',
            animationDelay: '100ms'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              marginBottom: 'var(--spacing-md)' 
            }}>
              <div style={{
                padding: 'var(--spacing-md)',
                background: 'var(--red-light)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid rgba(239, 68, 68, 0.2)'
              }}>
                <AlertCircle size={24} color="var(--red)" strokeWidth={2} />
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
              Tickets Abertos
            </h3>
            <div style={{ 
              fontSize: '2.5rem', 
              fontWeight: '800', 
              color: 'var(--red)',
              lineHeight: '1',
              marginBottom: 'var(--spacing-xs)'
            }}>
              {stats.tickets.open}
            </div>
            <div style={{ 
              fontSize: '0.75rem',
              color: 'var(--text-tertiary)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-xs)'
            }}>
              <Clock size={12} />
              {stats.tickets.inProgress} em progresso
            </div>
          </div>
        </Link>

        <div className="card slide-in" style={{ 
          border: '1px solid var(--border-primary)',
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
              background: 'var(--green-light)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(16, 185, 129, 0.2)'
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
            lineHeight: '1',
            marginBottom: 'var(--spacing-xs)'
          }}>
            {resolutionRate}%
          </div>
          <div style={{ 
            fontSize: '0.75rem',
            color: 'var(--text-tertiary)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-xs)'
            }}>
            <TrendingUp size={12} />
            {stats.tickets.resolvedToday} resolvidos hoje
          </div>
        </div>

        <div className="card slide-in" style={{ 
          border: '1px solid var(--border-primary)',
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
              background: 'var(--blue-light)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(59, 130, 246, 0.2)'
            }}>
              <Clock size={24} color="var(--blue)" strokeWidth={2} />
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
            color: 'var(--blue)',
            lineHeight: '1',
            marginBottom: 'var(--spacing-xs)'
          }}>
            {stats.tickets.avgResolutionHours.toFixed(1)}h
          </div>
          <div style={{ 
            fontSize: '0.75rem',
            color: 'var(--text-tertiary)'
          }}>
            Tempo médio de resolução
          </div>
        </div>

        {stats.tickets.pendingApproval > 0 && (
          <Link to="/acompanhar/aprovar" style={{ textDecoration: 'none' }}>
            <div className="card slide-in" style={{ 
              border: '1px solid var(--border-primary)',
              cursor: 'pointer',
              transition: 'all var(--transition-base)',
              animationDelay: '400ms',
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(245, 158, 11, 0.05) 100%)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
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
                  border: '1px solid rgba(245, 158, 11, 0.3)'
                }}>
                  <AlertCircle size={24} color="var(--orange)" strokeWidth={2} />
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
                Pendentes Aprovação
              </h3>
              <div style={{ 
                fontSize: '2.5rem', 
                fontWeight: '800', 
                color: 'var(--orange)',
                lineHeight: '1',
                marginBottom: 'var(--spacing-xs)'
              }}>
                {stats.tickets.pendingApproval}
              </div>
              <div style={{ 
                fontSize: '0.75rem',
                color: 'var(--text-tertiary)'
              }}>
                Requerem atenção
              </div>
            </div>
          </Link>
        )}
      </div>

      {/* Segunda Linha - Métricas do Sistema */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 'var(--spacing-lg)',
        marginBottom: 'var(--spacing-2xl)'
      }}>
        <Link to="/config/usuarios" style={{ textDecoration: 'none' }}>
          <div className="card" style={{ 
            border: '1px solid var(--border-primary)',
            cursor: 'pointer',
            transition: 'all var(--transition-base)',
            padding: 'var(--spacing-lg)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = 'var(--shadow)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-sm)' }}>
              <Users size={20} color="var(--purple)" />
              <h4 style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                Usuários
              </h4>
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: '700', color: 'var(--text-primary)' }}>
              {stats.users.total}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 'var(--spacing-xs)' }}>
              {stats.users.active} ativos
            </div>
          </div>
        </Link>

        <Link to="/create/forms" style={{ textDecoration: 'none' }}>
          <div className="card" style={{ 
            border: '1px solid var(--border-primary)',
            cursor: 'pointer',
            transition: 'all var(--transition-base)',
            padding: 'var(--spacing-lg)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = 'var(--shadow)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-sm)' }}>
              <FileText size={20} color="var(--blue)" />
              <h4 style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                Formulários
              </h4>
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: '700', color: 'var(--text-primary)' }}>
              {stats.forms.total}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 'var(--spacing-xs)' }}>
              {stats.forms.active} ativos
            </div>
          </div>
        </Link>

        <Link to="/create/pages" style={{ textDecoration: 'none' }}>
          <div className="card" style={{ 
            border: '1px solid var(--border-primary)',
            cursor: 'pointer',
            transition: 'all var(--transition-base)',
            padding: 'var(--spacing-lg)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = 'var(--shadow)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-sm)' }}>
              <Layers size={20} color="var(--green)" />
              <h4 style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                Páginas
              </h4>
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: '700', color: 'var(--text-primary)' }}>
              {stats.pages.total}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 'var(--spacing-xs)' }}>
              Páginas públicas
            </div>
          </div>
        </Link>


        <Link to="/config/grupos" style={{ textDecoration: 'none' }}>
          <div className="card" style={{ 
            border: '1px solid var(--border-primary)',
            cursor: 'pointer',
            transition: 'all var(--transition-base)',
            padding: 'var(--spacing-lg)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = 'var(--shadow)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-sm)' }}>
              <UserCheck size={20} color="var(--purple)" />
              <h4 style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                Grupos
              </h4>
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: '700', color: 'var(--text-primary)' }}>
              {stats.groups.total}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 'var(--spacing-xs)' }}>
              Grupos de usuários
            </div>
          </div>
        </Link>

        <Link to="/create/webhooks" style={{ textDecoration: 'none' }}>
          <div className="card" style={{ 
            border: '1px solid var(--border-primary)',
            cursor: 'pointer',
            transition: 'all var(--transition-base)',
            padding: 'var(--spacing-lg)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = 'var(--shadow)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-sm)' }}>
              <Webhook size={20} color="var(--purple)" />
              <h4 style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                Webhooks
              </h4>
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: '700', color: 'var(--text-primary)' }}>
              {stats.webhooks?.total || 0}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 'var(--spacing-xs)' }}>
              {stats.webhooks?.active || 0} ativos • {stats.webhooks?.callsToday || 0} chamadas hoje
            </div>
          </div>
        </Link>
      </div>

      {/* Gráficos e Visualizações */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
        gap: 'var(--spacing-lg)',
        marginBottom: 'var(--spacing-2xl)'
      }}>
        {/* Gráfico de Tickets por Prioridade */}
        <div className="card" style={{ 
          border: '1px solid var(--border-primary)',
          padding: 'var(--spacing-xl)'
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 'var(--spacing-md)',
            marginBottom: 'var(--spacing-lg)'
          }}>
            <PieChart size={24} color="var(--purple)" />
            <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: 'var(--text-primary)' }}>
              Tickets por Prioridade
            </h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
            {stats.tickets.byPriority.map((item, index) => {
              const total = stats.tickets.byPriority.reduce((sum, p) => sum + p.count, 0);
              const percentage = total > 0 ? (item.count / total) * 100 : 0;
              const colors: Record<string, string> = {
                'urgent': 'var(--red)',
                'high': 'var(--red)',
                'medium': 'var(--orange)',
                'low': 'var(--blue)'
              };
              const labels: Record<string, string> = {
                'urgent': 'Urgente',
                'high': 'Alta',
                'medium': 'Média',
                'low': 'Baixa'
              };
              return (
                <div key={index}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    marginBottom: 'var(--spacing-xs)'
                  }}>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)', fontWeight: '500' }}>
                      {labels[item.priority] || item.priority}
                    </span>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: '600' }}>
                      {item.count} ({percentage.toFixed(1)}%)
                    </span>
                  </div>
                  <div style={{
                    width: '100%',
                    height: '8px',
                    background: 'var(--bg-tertiary)',
                    borderRadius: 'var(--radius-full)',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${percentage}%`,
                      height: '100%',
                      background: colors[item.priority] || 'var(--purple)',
                      transition: 'width 0.3s ease'
                    }} />
                  </div>
                </div>
              );
            })}
            {stats.tickets.byPriority.length === 0 && (
              <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem', fontStyle: 'italic' }}>
                Nenhum ticket com prioridade definida
              </p>
            )}
          </div>
        </div>

        {/* Top Formulários */}
        <div className="card" style={{ 
          border: '1px solid var(--border-primary)',
          padding: 'var(--spacing-xl)'
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 'var(--spacing-md)',
            marginBottom: 'var(--spacing-lg)'
          }}>
            <FileText size={24} color="var(--blue)" />
            <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: 'var(--text-primary)' }}>
              Top Formulários
            </h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
            {stats.topForms && stats.topForms.length > 0 ? (
              stats.topForms.map((form, index) => {
                const maxCount = Math.max(...stats.topForms.map(f => f.ticket_count), 1);
                const percentage = (form.ticket_count / maxCount) * 100;
                return (
                  <div key={index}>
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      marginBottom: 'var(--spacing-xs)'
                    }}>
                      <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)', fontWeight: '500' }}>
                        {form.name}
                      </span>
                      <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: '600' }}>
                        {form.ticket_count}
                      </span>
                    </div>
                    <div style={{
                      width: '100%',
                      height: '8px',
                      background: 'var(--bg-tertiary)',
                      borderRadius: 'var(--radius-full)',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        width: `${percentage}%`,
                        height: '100%',
                        background: `linear-gradient(90deg, var(--blue) 0%, var(--blue-hover) 100%)`,
                        transition: 'width 0.3s ease'
                      }} />
                    </div>
                  </div>
                );
              })
            ) : (
              <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem', fontStyle: 'italic' }}>
                Nenhum formulário com tickets
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Timeline de Tickets (últimos 30 dias) */}
      {stats.timeline && stats.timeline.length > 0 && (
        <div className="card" style={{ 
          border: '1px solid var(--border-primary)',
          padding: 'var(--spacing-xl)',
          marginBottom: 'var(--spacing-2xl)'
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            marginBottom: 'var(--spacing-lg)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
              <Activity size={24} color="var(--green)" />
              <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                Evolução de Tickets (Últimos 30 dias)
              </h3>
            </div>
            <div style={{ 
              fontSize: '0.75rem', 
              color: 'var(--text-tertiary)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-xs)'
            }}>
              <TrendingUp size={14} />
              Total: {stats.timeline.reduce((sum, item) => sum + item.count, 0)} tickets
            </div>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: '3px',
            height: '220px',
            padding: 'var(--spacing-md)',
            background: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-primary)',
            position: 'relative'
          }}>
            {/* Linha de referência */}
            <div style={{
              position: 'absolute',
              top: '50%',
              left: 0,
              right: 0,
              height: '1px',
              background: 'var(--border-primary)',
              opacity: 0.3,
              zIndex: 0
            }} />
            {stats.timeline.map((item, index) => {
              const height = maxTimelineCount > 0 ? (item.count / maxTimelineCount) * 100 : 0;
              const isToday = index === stats.timeline.length - 1;
              return (
                <div 
                  key={index}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 'var(--spacing-xs)',
                    height: '100%',
                    position: 'relative',
                    zIndex: 1
                  }}
                >
                  <div style={{
                    width: '100%',
                    height: `${height}%`,
                    minHeight: item.count > 0 ? '4px' : '0',
                    background: isToday 
                      ? 'linear-gradient(180deg, var(--green) 0%, var(--green-hover) 100%)'
                      : 'linear-gradient(180deg, var(--purple) 0%, var(--purple-hover) 100%)',
                    borderRadius: '4px 4px 0 0',
                    transition: 'height 0.3s ease',
                    cursor: 'pointer',
                    border: isToday ? '2px solid var(--green)' : 'none',
                    boxShadow: isToday ? '0 0 8px rgba(16, 185, 129, 0.3)' : 'none'
                  }}
                  title={`${item.count} tickets em ${formatDateBR(item.date)}`}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = '0.8';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = '1';
                  }}
                  />
                  {(index % Math.ceil(stats.timeline.length / 6) === 0 || isToday) && (
                    <span style={{
                      fontSize: '0.625rem',
                      color: 'var(--text-tertiary)',
                      marginTop: 'auto',
                      textAlign: 'center',
                      lineHeight: '1.2'
                    }}>
                      {formatDateBR(item.date).split('/')[0]}/{formatDateBR(item.date).split('/')[1]}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <div style={{
            marginTop: 'var(--spacing-md)',
            display: 'flex',
            justifyContent: 'center',
            gap: 'var(--spacing-lg)',
            fontSize: '0.75rem',
            color: 'var(--text-tertiary)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
              <div style={{
                width: '12px',
                height: '12px',
                background: 'var(--purple)',
                borderRadius: '2px'
              }} />
              <span>Histórico</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
              <div style={{
                width: '12px',
                height: '12px',
                background: 'var(--green)',
                borderRadius: '2px',
                border: '2px solid var(--green)'
              }} />
              <span>Hoje</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
