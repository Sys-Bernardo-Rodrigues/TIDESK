import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { History, Search, Calendar, User, CheckCircle, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
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
  assigned_at: string | null; // Momento em que o agente pegou o ticket (para tempo de resolução correto)
  created_at: string;
  updated_at: string;
  total_pause_seconds?: number; // Tempo em pausa (não contabilizado)
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
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ticketsPerPage = 20;

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const response = await axios.get('/api/tickets');
      // Filtrar apenas tickets resolvidos, fechados ou rejeitados
      const historyTickets = response.data.filter((ticket: Ticket) => 
        ticket.status === 'resolved' || ticket.status === 'closed' || ticket.status === 'rejected'
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
      closed: 'Fechado',
      rejected: 'Rejeitado'
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      resolved: 'var(--green)',
      closed: 'var(--text-tertiary)',
      rejected: 'var(--red)'
    };
    return colors[status] || 'var(--text-secondary)';
  };

  const getStatusBg = (status: string) => {
    const bg: Record<string, string> = {
      resolved: 'var(--green-light)',
      closed: 'var(--bg-tertiary)',
      rejected: 'var(--red-light)'
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

  const calculateTimeToResolve = (createdAt: string, updatedAt: string, assignedAt?: string | null, totalPauseSeconds?: number) => {
    // Usar assigned_at quando disponível (tempo que o agente pegou até fechar), senão created_at
    const start = assignedAt || createdAt;
    const startDate = new Date(start);
    const updated = new Date(updatedAt);
    let diffMs = updated.getTime() - startDate.getTime();
    // Subtrair tempo em pausa (não contabilizado)
    if (totalPauseSeconds != null && totalPauseSeconds > 0) {
      diffMs -= totalPauseSeconds * 1000;
    }
    const diff = Math.max(0, diffMs);
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

    // Filtro de data
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

    return matchesSearch && matchesStatus && matchesPriority && matchesDate;
  });

  // Paginação
  const totalPages = Math.ceil(filteredTickets.length / ticketsPerPage);
  const startIndex = (currentPage - 1) * ticketsPerPage;
  const endIndex = startIndex + ticketsPerPage;
  const paginatedTickets = filteredTickets.slice(startIndex, endIndex);

  // Resetar página quando filtros mudarem
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus, filterPriority, filterDateFrom, filterDateTo]);

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
    <div style={{ 
      padding: 'var(--spacing-lg)',
      maxWidth: '1920px',
      margin: '0 auto'
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
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{ position: 'relative', height: '32px' }}>
          <Search 
            size={14}
            style={{ 
              position: 'absolute', 
              left: '0.5rem', 
              top: '50%', 
              transform: 'translateY(-50%)',
              color: 'var(--text-tertiary)',
              pointerEvents: 'none'
            }} 
          />
          <input
            type="text"
            className="input"
            placeholder="Buscar..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ 
              paddingLeft: '1.75rem', 
              paddingRight: '0.75rem',
              paddingTop: '0.375rem',
              paddingBottom: '0.375rem',
              fontSize: '0.8125rem',
              height: '32px',
              width: '180px',
              boxSizing: 'border-box',
              lineHeight: '1'
            }}
          />
        </div>
          <select
          className="input"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          style={{ 
            minWidth: '100px',
            padding: '0.375rem 0.75rem',
            fontSize: '0.8125rem',
            height: '32px',
            cursor: 'pointer',
            boxSizing: 'border-box',
            lineHeight: '1'
          }}
          >
          <option value="all">Status</option>
            <option value="resolved">Resolvido</option>
            <option value="closed">Fechado</option>
            <option value="rejected">Rejeitado</option>
          </select>
          <select
          className="input"
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
          style={{ 
            minWidth: '100px',
            padding: '0.375rem 0.75rem',
            fontSize: '0.8125rem',
            height: '32px',
            cursor: 'pointer',
            boxSizing: 'border-box',
            lineHeight: '1'
          }}
          >
          <option value="all">Prioridade</option>
          <option value="urgent">Urgente</option>
          <option value="high">Alta</option>
          <option value="medium">Média</option>
            <option value="low">Baixa</option>
          </select>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
          <Calendar size={14} color="var(--text-tertiary)" />
          <input
            type="date"
            className="input"
            value={filterDateFrom}
            onChange={(e) => setFilterDateFrom(e.target.value)}
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
            value={filterDateTo}
            onChange={(e) => setFilterDateTo(e.target.value)}
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
      </div>

      {/* Espaço para os filtros fixos */}
      <div style={{ height: '50px', marginBottom: 'var(--spacing-md)' }}></div>

      {/* Lista de Tickets */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
        {filteredTickets.length === 0 ? (
          <div className="card" style={{ 
            textAlign: 'center', 
            padding: 'var(--spacing-2xl)',
            border: '1px solid var(--border-primary)'
          }}>
            <History size={48} color="var(--text-tertiary)" style={{ marginBottom: 'var(--spacing-md)', opacity: 0.5 }} />
            <p style={{ 
              color: 'var(--text-secondary)',
              fontSize: '0.875rem'
            }}>
              {searchTerm || filterStatus !== 'all' || filterPriority !== 'all' || filterDateFrom || filterDateTo
                ? 'Nenhum ticket encontrado com os filtros aplicados' 
                : 'Nenhum ticket no histórico ainda'}
            </p>
          </div>
        ) : (
          <>
            {paginatedTickets.map((ticket) => (
            <Link
              key={ticket.id}
              to={`/tickets/${getTicketFullId(ticket)}`}
              style={{ textDecoration: 'none' }}
            >
              <div className="card" style={{ 
                border: '1px solid var(--border-primary)',
                padding: 'var(--spacing-sm) var(--spacing-md)',
                transition: 'all var(--transition-base)',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--purple)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(145, 71, 255, 0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-primary)';
                e.currentTarget.style.boxShadow = 'none';
              }}
              >
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 'var(--spacing-md)'
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 'var(--spacing-sm)',
                      marginBottom: 'var(--spacing-xs)',
                      flexWrap: 'wrap'
                    }}>
                      <h3 style={{ 
                        fontSize: '0.875rem', 
                        fontWeight: '600',
                        color: 'var(--text-primary)',
                        margin: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        flex: 1,
                        minWidth: 0
                      }}>
                        {ticket.title}
                      </h3>
                      <span style={{
                        fontSize: '0.625rem',
                        padding: '0.125rem 0.375rem',
                        borderRadius: 'var(--radius-sm)',
                        background: getStatusBg(ticket.status),
                        color: getStatusColor(ticket.status),
                        fontWeight: '600',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                      }}>
                        {getStatusLabel(ticket.status)}
                      </span>
                      <span style={{
                        fontSize: '0.625rem',
                        padding: '0.125rem 0.375rem',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--bg-tertiary)',
                        color: getPriorityColor(ticket.priority),
                        fontWeight: '600',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                      }}>
                        {getPriorityLabel(ticket.priority)}
                      </span>
                    </div>
                    <div style={{ 
                      display: 'flex', 
                      gap: 'var(--spacing-md)',
                      fontSize: '0.75rem',
                      color: 'var(--text-tertiary)',
                      flexWrap: 'wrap',
                      alignItems: 'center'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <User size={12} />
                        <span>{ticket.user_name}</span>
                      </div>
                      {ticket.assigned_name && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <CheckCircle size={12} />
                          <span>{ticket.assigned_name}</span>
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Clock size={12} />
                        <span>{calculateTimeToResolve(ticket.created_at, ticket.updated_at, ticket.assigned_at, ticket.total_pause_seconds)}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Calendar size={12} />
                        <span>{formatDate(ticket.updated_at)}</span>
                      </div>
                    </div>
                        </div>
                    </div>
                  </div>
            </Link>
            ))}
            
            {/* Paginação */}
            {totalPages > 1 && (
                  <div style={{ 
                    display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 'var(--spacing-sm)',
                marginTop: 'var(--spacing-lg)',
                padding: 'var(--spacing-md)'
                  }}>
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  style={{
                    padding: 'var(--spacing-xs) var(--spacing-sm)',
                    backgroundColor: currentPage === 1 ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                    border: '1px solid var(--border-primary)',
                    borderRadius: 'var(--radius-sm)',
                    color: currentPage === 1 ? 'var(--text-tertiary)' : 'var(--text-primary)',
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                    gap: 'var(--spacing-xs)',
                    fontSize: '0.875rem',
                    transition: 'all var(--transition-base)'
                  }}
                  onMouseEnter={(e) => {
                    if (currentPage !== 1) {
                      e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (currentPage !== 1) {
                      e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                    }
                  }}
                >
                  <ChevronLeft size={16} />
                  Anterior
                </button>
                
                <div style={{
                  display: 'flex',
                  gap: 'var(--spacing-xs)',
                  alignItems: 'center'
                }}>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        style={{
                          padding: 'var(--spacing-xs) var(--spacing-sm)',
                          backgroundColor: currentPage === pageNum ? 'var(--purple)' : 'var(--bg-secondary)',
                          border: `1px solid ${currentPage === pageNum ? 'var(--purple)' : 'var(--border-primary)'}`,
                          borderRadius: 'var(--radius-sm)',
                          color: currentPage === pageNum ? '#FFFFFF' : 'var(--text-primary)',
                          cursor: 'pointer',
                          fontSize: '0.875rem',
                          minWidth: '36px',
                          transition: 'all var(--transition-base)'
                        }}
                        onMouseEnter={(e) => {
                          if (currentPage !== pageNum) {
                            e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (currentPage !== pageNum) {
                            e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                          }
                        }}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                    </div>
                
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  style={{
                    padding: 'var(--spacing-xs) var(--spacing-sm)',
                    backgroundColor: currentPage === totalPages ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                    border: '1px solid var(--border-primary)',
                    borderRadius: 'var(--radius-sm)',
                    color: currentPage === totalPages ? 'var(--text-tertiary)' : 'var(--text-primary)',
                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                    gap: 'var(--spacing-xs)',
                    fontSize: '0.875rem',
                    transition: 'all var(--transition-base)'
                  }}
                  onMouseEnter={(e) => {
                    if (currentPage !== totalPages) {
                      e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (currentPage !== totalPages) {
                      e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                    }
                  }}
                >
                  Próxima
                  <ChevronRight size={16} />
                </button>
                    </div>
            )}
            
            {/* Info de paginação */}
            {filteredTickets.length > 0 && (
                    <div style={{ 
                textAlign: 'center',
                fontSize: '0.875rem',
                      color: 'var(--text-secondary)',
                marginTop: 'var(--spacing-md)'
                    }}>
                Mostrando {startIndex + 1} - {Math.min(endIndex, filteredTickets.length)} de {filteredTickets.length} tickets
                    </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
