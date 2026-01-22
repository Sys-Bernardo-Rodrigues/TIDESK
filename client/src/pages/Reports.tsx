import { useState } from 'react';
import { FileBarChart, Download, Calendar, Filter, TrendingUp, Users, Ticket, Clock } from 'lucide-react';
import { formatDateBR } from '../utils/dateUtils';

export default function Reports() {
  const [dateRange, setDateRange] = useState('month');
  const [reportType, setReportType] = useState('all');

  // Mock data - será substituído por dados reais
  const reports = [
    { 
      id: 1, 
      title: 'Relatório de Tickets por Status', 
      type: 'tickets',
      period: 'Último mês',
      generated: '2024-01-20',
      downloads: 5
    },
    { 
      id: 2, 
      title: 'Relatório de Performance de Agentes', 
      type: 'agents',
      period: 'Último mês',
      generated: '2024-01-19',
      downloads: 3
    },
    { 
      id: 3, 
      title: 'Relatório de Tempo Médio de Resolução', 
      type: 'performance',
      period: 'Última semana',
      generated: '2024-01-18',
      downloads: 8
    },
  ];

  const filteredReports = reportType === 'all' 
    ? reports 
    : reports.filter(r => r.type === reportType);

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
          Relatórios
        </h1>
        <p style={{
          color: 'var(--text-secondary)',
          fontSize: '1rem',
          fontWeight: '400'
        }}>
          Visualize e gere relatórios do sistema
        </p>
      </div>

      {/* Filtros */}
      <div className="card" style={{ 
        border: '1px solid var(--border-primary)',
        marginBottom: 'var(--spacing-lg)'
      }}>
        <div style={{ 
          display: 'flex', 
          gap: 'var(--spacing-md)',
          flexWrap: 'wrap',
          alignItems: 'center'
        }}>
          <div style={{ flex: '1', minWidth: '200px' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: 'var(--spacing-xs)',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: 'var(--text-secondary)'
            }}>
              Período
            </label>
            <select
              className="select"
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
            >
              <option value="week">Última semana</option>
              <option value="month">Último mês</option>
              <option value="quarter">Último trimestre</option>
              <option value="year">Último ano</option>
            </select>
          </div>
          <div style={{ flex: '1', minWidth: '200px' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: 'var(--spacing-xs)',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: 'var(--text-secondary)'
            }}>
              Tipo de Relatório
            </label>
            <select
              className="select"
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
            >
              <option value="all">Todos</option>
              <option value="tickets">Tickets</option>
              <option value="agents">Agentes</option>
              <option value="performance">Performance</option>
            </select>
          </div>
          <div style={{ 
            display: 'flex', 
            alignItems: 'flex-end',
            gap: 'var(--spacing-sm)'
          }}>
            <button className="btn btn-primary">
              <Filter size={18} />
              Aplicar Filtros
            </button>
            <button className="btn btn-success">
              <FileBarChart size={18} />
              Gerar Novo Relatório
            </button>
          </div>
        </div>
      </div>

      {/* Cards de Estatísticas Rápidas */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: 'var(--spacing-lg)',
        marginBottom: 'var(--spacing-lg)'
      }}>
        <div className="card slide-in" style={{ 
          border: '1px solid var(--border-primary)',
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
              background: 'var(--purple-light)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(145, 71, 255, 0.2)'
            }}>
              <FileBarChart size={24} color="var(--purple)" strokeWidth={2} />
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
            Total de Relatórios
          </h3>
          <div style={{ 
            fontSize: '2.5rem', 
            fontWeight: '800',
            color: 'var(--text-primary)',
            lineHeight: '1'
          }}>
            {reports.length}
          </div>
        </div>

        <div className="card slide-in" style={{ 
          border: '1px solid var(--border-primary)',
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
              border: '1px solid rgba(16, 185, 129, 0.2)'
            }}>
              <Download size={24} color="var(--green)" strokeWidth={2} />
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
            Downloads Totais
          </h3>
          <div style={{ 
            fontSize: '2.5rem', 
            fontWeight: '800',
            color: 'var(--green)',
            lineHeight: '1'
          }}>
            {reports.reduce((sum, r) => sum + r.downloads, 0)}
          </div>
        </div>

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
              background: 'var(--blue-light)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(59, 130, 246, 0.2)'
            }}>
              <TrendingUp size={24} color="var(--blue)" strokeWidth={2} />
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
            Relatórios Este Mês
          </h3>
          <div style={{ 
            fontSize: '2.5rem', 
            fontWeight: '800',
            color: 'var(--blue)',
            lineHeight: '1'
          }}>
            {reports.filter(r => r.period === 'Último mês').length}
          </div>
        </div>
      </div>

      {/* Lista de Relatórios */}
      <div style={{ marginBottom: 'var(--spacing-lg)' }}>
        <h2 style={{ 
          fontSize: '1.5rem', 
          fontWeight: '700',
          color: 'var(--text-primary)',
          marginBottom: 'var(--spacing-md)',
          letterSpacing: '-0.02em'
        }}>
          Relatórios Gerados
        </h2>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
        {filteredReports.length === 0 ? (
          <div className="card" style={{ 
            textAlign: 'center', 
            padding: 'var(--spacing-2xl)',
            border: '1px solid var(--border-primary)'
          }}>
            <FileBarChart size={48} color="var(--text-tertiary)" style={{ marginBottom: 'var(--spacing-md)' }} />
            <p style={{ 
              color: 'var(--text-secondary)',
              fontSize: '1rem',
              marginBottom: 'var(--spacing-sm)'
            }}>
              Nenhum relatório encontrado
            </p>
          </div>
        ) : (
          filteredReports.map((report) => (
            <div key={report.id} className="card" style={{ 
              border: '1px solid var(--border-primary)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              transition: 'all var(--transition-base)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-secondary)';
              e.currentTarget.style.boxShadow = 'var(--shadow-md)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-primary)';
              e.currentTarget.style.boxShadow = 'var(--shadow)';
            }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 'var(--spacing-md)',
                  marginBottom: 'var(--spacing-xs)'
                }}>
                  <FileBarChart size={20} color="var(--blue)" />
                  <h3 style={{ 
                    fontSize: '1.125rem', 
                    fontWeight: '600',
                    color: 'var(--text-primary)'
                  }}>
                    {report.title}
                  </h3>
                </div>
                <div style={{ 
                  display: 'flex', 
                  gap: 'var(--spacing-lg)',
                  fontSize: '0.875rem',
                  color: 'var(--text-secondary)',
                  marginLeft: '2.25rem',
                  flexWrap: 'wrap'
                }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Calendar size={14} />
                    {report.period}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Download size={14} />
                    <strong>{report.downloads}</strong> downloads
                  </span>
                  <span><strong>Gerado em:</strong> {formatDateBR(report.generated)}</span>
                </div>
              </div>
              <div style={{ 
                display: 'flex', 
                gap: 'var(--spacing-sm)'
              }}>
                <button className="btn btn-primary btn-sm">
                  <Download size={16} />
                  Baixar
                </button>
                <button className="btn btn-secondary btn-sm">
                  <FileBarChart size={16} />
                  Visualizar
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
