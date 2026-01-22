import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { History, Search, Filter, Calendar, User, CheckCircle, XCircle, Clock, FileText } from 'lucide-react';
import { formatDateBR } from '../utils/dateUtils';

interface Ticket {
  id: number;
  ticket_number: number | null;
  title: string;
  description: string;
  status: string;
  priority: string;
  category_name: string;
  user_name: string;
  assigned_name: string | null;
  created_at: string;
  updated_at: string;
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

export default function Historico() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const response = await axios.get('/api/tickets');
      // Filtrar apenas tickets resolvidos ou fechados
      const historyTickets = response.data.filter((ticket: Ticket) => 
        ticket.status === 'resolved' || ticket.status === 'closed'
      );
      setTickets(historyTickets);
    } catch (error) {
      console.error('Erro ao buscar histórico:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      resolved: 'Resolvido',
      closed: 'Fechado'
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      resolved: 'var(--green)',
      closed: 'var(--text-tertiary)'
    };
    return colors[status] || 'var(--text-secondary)';
  };

  const getStatusBg = (status: string) => {
    const bg: Record<string, string> = {
      resolved: 'var(--green-light)',
      closed: 'var(--bg-tertiary)'
    };
    return bg[status] || 'var(--bg-tertiary)';
  };

  const getPriorityLabel = (priority: string) => {
    const labels: Record<string, string> = {
      low: 'Baixa',
      medium: 'Média',
      high: 'Alta',
      urgent: 'Urgente'
    };
    return labels[priority] || priority;
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      low: 'var(--text-secondary)',
      medium: 'var(--blue)',
      high: 'var(--orange)',
      urgent: 'var(--red)'
    };
    return colors[priority] || 'var(--text-secondary)';
  };

  const formatDate = (dateString: string) => {
    return formatDateBR(dateString, { includeTime: true });
  };

  const calculateTimeToResolve = (createdAt: string, updatedAt: string) => {
    const created = new Date(createdAt);
    const updated = new Date(updatedAt);
    const diff = updated.getTime() - created.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) {
      return `${days}d ${hours}h`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}min`;
    }
    return `${minutes}min`;
  };

  const filteredTickets = tickets.filter(ticket => {
    const matchesSearch = 
      ticket.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (ticket.assigned_name && ticket.assigned_name.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = filterStatus === 'all' || ticket.status === filterStatus;
    const matchesPriority = filterPriority === 'all' || ticket.priority === filterPriority;

    return matchesSearch && matchesStatus && matchesPriority;
  });

  if (loading) {
    return (
      <div className="card" style={{ 
        textAlign: 'center', 
        padding: 'var(--spacing-2xl)',
        border: '1px solid var(--border-primary)'
      }}>
        <p style={{ color: 'var(--text-secondary)' }}>Carregando histórico...</p>
      </div>
    );
  }

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
          letterSpacing: '-0.03em',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-md)'
        }}>
          <History size={32} />
          Histórico
        </h1>
        <p style={{
          color: 'var(--text-secondary)',
          fontSize: '1rem',
          fontWeight: '400'
        }}>
          Visualize o histórico de tickets resolvidos e fechados
        </p>
      </div>

      {/* Filtros e Busca */}
      <div style={{ 
        display: 'flex', 
        gap: 'var(--spacing-md)',
        marginBottom: 'var(--spacing-lg)',
        flexWrap: 'wrap'
      }}>
        <div style={{ 
          position: 'relative',
          flex: '1',
          minWidth: '300px',
          maxWidth: '500px'
        }}>
          <Search 
            size={20} 
            style={{ 
              position: 'absolute', 
              left: 'var(--spacing-md)', 
              top: '50%', 
              transform: 'translateY(-50%)',
              color: 'var(--text-tertiary)',
              pointerEvents: 'none'
            }} 
          />
          <input
            type="text"
            className="input"
            placeholder="Buscar no histórico..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '2.75rem' }}
          />
        </div>
        <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
          <select
            className="select"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{ minWidth: '150px' }}
          >
            <option value="all">Todos os Status</option>
            <option value="resolved">Resolvido</option>
            <option value="closed">Fechado</option>
          </select>
          <select
            className="select"
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            style={{ minWidth: '150px' }}
          >
            <option value="all">Todas as Prioridades</option>
            <option value="low">Baixa</option>
            <option value="medium">Média</option>
            <option value="high">Alta</option>
            <option value="urgent">Urgente</option>
          </select>
        </div>
      </div>

      {/* Estatísticas */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 'var(--spacing-md)',
        marginBottom: 'var(--spacing-lg)'
      }}>
        <div className="card" style={{ 
          border: '1px solid var(--border-primary)',
          padding: 'var(--spacing-md)'
        }}>
          <div style={{ 
            fontSize: '0.875rem',
            color: 'var(--text-secondary)',
            marginBottom: 'var(--spacing-xs)'
          }}>
            Total
          </div>
          <div style={{ 
            fontSize: '2rem',
            fontWeight: '700',
            color: 'var(--text-primary)'
          }}>
            {tickets.length}
          </div>
        </div>
        <div className="card" style={{ 
          border: '1px solid var(--border-primary)',
          padding: 'var(--spacing-md)'
        }}>
          <div style={{ 
            fontSize: '0.875rem',
            color: 'var(--text-secondary)',
            marginBottom: 'var(--spacing-xs)'
          }}>
            Resolvidos
          </div>
          <div style={{ 
            fontSize: '2rem',
            fontWeight: '700',
            color: 'var(--green)'
          }}>
            {tickets.filter(t => t.status === 'resolved').length}
          </div>
        </div>
        <div className="card" style={{ 
          border: '1px solid var(--border-primary)',
          padding: 'var(--spacing-md)'
        }}>
          <div style={{ 
            fontSize: '0.875rem',
            color: 'var(--text-secondary)',
            marginBottom: 'var(--spacing-xs)'
          }}>
            Fechados
          </div>
          <div style={{ 
            fontSize: '2rem',
            fontWeight: '700',
            color: 'var(--text-tertiary)'
          }}>
            {tickets.filter(t => t.status === 'closed').length}
          </div>
        </div>
      </div>

      {/* Lista de Tickets */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
        {filteredTickets.length === 0 ? (
          <div className="card" style={{ 
            textAlign: 'center', 
            padding: 'var(--spacing-2xl)',
            border: '1px solid var(--border-primary)'
          }}>
            <History size={48} color="var(--text-tertiary)" style={{ marginBottom: 'var(--spacing-md)' }} />
            <p style={{ 
              color: 'var(--text-secondary)',
              fontSize: '1rem',
              marginBottom: 'var(--spacing-sm)'
            }}>
              {searchTerm || filterStatus !== 'all' || filterPriority !== 'all' 
                ? 'Nenhum ticket encontrado com os filtros aplicados' 
                : 'Nenhum ticket no histórico ainda'}
            </p>
          </div>
        ) : (
          filteredTickets.map((ticket) => (
            <Link
              key={ticket.id}
              to={`/tickets/${getTicketFullId(ticket)}`}
              style={{ textDecoration: 'none' }}
            >
              <div className="card" style={{ 
                border: '1px solid var(--border-primary)',
                padding: 'var(--spacing-lg)',
                transition: 'all var(--transition-base)',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-secondary)';
                e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-primary)';
                e.currentTarget.style.boxShadow = 'var(--shadow)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
              >
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: 'var(--spacing-md)',
                  gap: 'var(--spacing-md)'
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 'var(--spacing-md)',
                      marginBottom: 'var(--spacing-sm)',
                      flexWrap: 'wrap'
                    }}>
                      <h3 style={{ 
                        fontSize: '1.125rem', 
                        fontWeight: '600',
                        color: 'var(--text-primary)',
                        margin: 0
                      }}>
                        {ticket.title}
                      </h3>
                      <span style={{
                        fontSize: '0.75rem',
                        padding: '0.25rem 0.5rem',
                        borderRadius: 'var(--radius-full)',
                        background: getStatusBg(ticket.status),
                        color: getStatusColor(ticket.status),
                        fontWeight: '600',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem'
                      }}>
                        {ticket.status === 'resolved' ? <CheckCircle size={12} /> : <XCircle size={12} />}
                        {getStatusLabel(ticket.status)}
                      </span>
                      <span style={{
                        fontSize: '0.75rem',
                        padding: '0.25rem 0.5rem',
                        borderRadius: 'var(--radius-full)',
                        background: 'var(--bg-tertiary)',
                        color: getPriorityColor(ticket.priority),
                        fontWeight: '600'
                      }}>
                        {getPriorityLabel(ticket.priority)}
                      </span>
                      {ticket.form_name && (
                        <span style={{
                          fontSize: '0.75rem',
                          padding: '0.25rem 0.5rem',
                          borderRadius: 'var(--radius-full)',
                          background: 'var(--blue-light)',
                          color: 'var(--blue)',
                          fontWeight: '600',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem'
                        }}>
                          <FileText size={12} />
                          {ticket.form_name}
                        </span>
                      )}
                    </div>
                    <p style={{ 
                      fontSize: '0.875rem',
                      color: 'var(--text-secondary)',
                      marginBottom: 'var(--spacing-md)',
                      lineHeight: '1.5'
                    }}>
                      {ticket.description.length > 200 
                        ? `${ticket.description.substring(0, 200)}...` 
                        : ticket.description}
                    </p>
                    <div style={{ 
                      display: 'flex', 
                      gap: 'var(--spacing-lg)',
                      fontSize: '0.875rem',
                      color: 'var(--text-secondary)',
                      flexWrap: 'wrap'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
                        <User size={14} />
                        <span><strong>Criado por:</strong> {ticket.user_name}</span>
                      </div>
                      {ticket.assigned_name && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
                          <User size={14} />
                          <span><strong>Atribuído a:</strong> {ticket.assigned_name}</span>
                        </div>
                      )}
                      {ticket.category_name && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
                          <FileText size={14} />
                          <span><strong>Categoria:</strong> {ticket.category_name}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ 
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    gap: 'var(--spacing-xs)',
                    minWidth: '150px'
                  }}>
                    <div style={{ 
                      fontSize: '0.75rem',
                      color: 'var(--text-tertiary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--spacing-xs)'
                    }}>
                      <Calendar size={12} />
                      <span>Criado: {formatDate(ticket.created_at)}</span>
                    </div>
                    <div style={{ 
                      fontSize: '0.75rem',
                      color: 'var(--text-tertiary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--spacing-xs)'
                    }}>
                      <Clock size={12} />
                      <span>Finalizado: {formatDate(ticket.updated_at)}</span>
                    </div>
                    <div style={{ 
                      fontSize: '0.75rem',
                      color: 'var(--text-secondary)',
                      fontWeight: '600',
                      marginTop: 'var(--spacing-xs)',
                      padding: '0.25rem 0.5rem',
                      background: 'var(--bg-tertiary)',
                      borderRadius: 'var(--radius-md)'
                    }}>
                      Tempo: {calculateTimeToResolve(ticket.created_at, ticket.updated_at)}
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
