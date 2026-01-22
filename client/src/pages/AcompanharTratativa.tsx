import { useState, useEffect } from 'react';
import axios from 'axios';
import { Eye, Search, Clock, User, Ticket, Filter, TrendingUp, X, FileText, MessageSquare } from 'lucide-react';

interface TicketDetail {
  id: number;
  ticket_number: number | null;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed' | 'pending_approval' | 'scheduled';
  priority: string;
  user_name: string;
  user_email: string;
  assigned_name: string | null;
  form_name: string | null;
  created_at: string;
  updated_at: string;
}

// Função para formatar ID do ticket no formato ano/mês/dia/número
function formatTicketId(ticket: TicketDetail): string {
  if (!ticket.ticket_number || !ticket.created_at) {
    return `#${ticket.id}`;
  }
  
  const date = new Date(ticket.created_at);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const number = String(ticket.ticket_number).padStart(3, '0');
  
  return `${year}/${month}/${day}/${number}`;
}

interface TicketMessage {
  id: number;
  ticket_id: number;
  user_id: number;
  message: string;
  user_name: string;
  user_email: string;
  created_at: string;
  updated_at: string;
}

export default function AcompanharTratativa() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [treatments, setTreatments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<TicketDetail | null>(null);
  const [ticketMessages, setTicketMessages] = useState<TicketMessage[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    fetchTreatments();
  }, []);

  const fetchTreatments = async () => {
    try {
      const response = await axios.get('/api/tickets/in-treatment');
      const tickets = response.data.map((ticket: any) => {
        // Formatar ID do ticket
        let ticketId = `#${ticket.id}`;
        if (ticket.ticket_number && ticket.created_at) {
          const date = new Date(ticket.created_at);
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          const number = String(ticket.ticket_number).padStart(3, '0');
          ticketId = `${year}/${month}/${day}/${number}`;
        }

        return {
          id: ticket.id,
          ticket: ticketId,
          title: ticket.title,
          agent: ticket.assigned_name || 'Não atribuído',
          status: ticket.status === 'in_progress' ? 'Em Tratamento' : ticket.status === 'open' ? 'Aberto' : ticket.status,
          priority: ticket.priority === 'high' || ticket.priority === 'urgent' ? 'Alta' : ticket.priority === 'medium' ? 'Média' : 'Baixa',
          createdAt: ticket.created_at,
          lastUpdate: ticket.updated_at,
          timeElapsed: calculateTimeElapsed(ticket.created_at),
          source: ticket.form_id ? 'formulário' : undefined,
          formName: ticket.form_name,
          wasApproved: ticket.needs_approval === 1 && ticket.status === 'open'
        };
      });
      setTreatments(tickets);
    } catch (error) {
      console.error('Erro ao buscar tratativas:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateTimeElapsed = (createdAt: string): string => {
    const now = new Date();
    const created = new Date(createdAt);
    const diff = now.getTime() - created.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}min`;
    }
    return `${minutes}min`;
  };

  const handleViewDetails = async (ticketId: number) => {
    setLoadingDetails(true);
    try {
      // Buscar detalhes do ticket
      const ticketResponse = await axios.get(`/api/tickets/${ticketId}`);
      setSelectedTicket(ticketResponse.data);

      // Buscar mensagens do ticket
      try {
        const messagesResponse = await axios.get(`/api/ticket-messages/ticket/${ticketId}`);
        setTicketMessages(messagesResponse.data);
      } catch (error) {
        console.error('Erro ao buscar mensagens:', error);
        setTicketMessages([]);
      }
    } catch (error) {
      console.error('Erro ao buscar detalhes do ticket:', error);
      alert('Erro ao carregar detalhes do ticket');
    } finally {
      setLoadingDetails(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredTreatments = treatments.filter(treatment => {
    const matchesSearch = 
      treatment.ticket.toLowerCase().includes(searchTerm.toLowerCase()) ||
      treatment.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      treatment.agent.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = filterStatus === 'all' || treatment.status === filterStatus;
    
    return matchesSearch && matchesFilter;
  });

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
          Acompanhar Tratativa
        </h1>
        <p style={{
          color: 'var(--text-secondary)',
          fontSize: '1rem',
          fontWeight: '400'
        }}>
          Acompanhe o progresso das tratativas de tickets em andamento
        </p>
      </div>

      {/* Filtros */}
      <div className="card" style={{ 
        border: '1px solid var(--border-primary)',
        marginBottom: 'var(--spacing-lg)',
        padding: 'var(--spacing-md)'
      }}>
        <div style={{ 
          display: 'flex', 
          gap: 'var(--spacing-md)',
          flexWrap: 'wrap',
          alignItems: 'center'
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
            placeholder="Buscar por ticket, título ou agente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '2.75rem' }}
          />
        </div>
          <div style={{ minWidth: '200px' }}>
            <select
              className="select"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">Todos os Status</option>
              <option value="Em Tratamento">Em Tratamento</option>
              <option value="Aguardando Cliente">Aguardando Cliente</option>
              <option value="Pausado">Pausado</option>
            </select>
          </div>
        </div>
      </div>

      {/* Cards de Estatísticas */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
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
              background: 'var(--blue-light)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(59, 130, 246, 0.2)'
            }}>
              <Eye size={24} color="var(--blue)" strokeWidth={2} />
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
            Em Acompanhamento
          </h3>
          <div style={{ 
            fontSize: '2.5rem', 
            fontWeight: '800',
            color: 'var(--blue)',
            lineHeight: '1'
          }}>
            {treatments.length}
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
              background: 'var(--orange-light)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(245, 158, 11, 0.2)'
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
            Em Tratamento
          </h3>
          <div style={{ 
            fontSize: '2.5rem', 
            fontWeight: '800',
            color: 'var(--orange)',
            lineHeight: '1'
          }}>
            {treatments.filter(t => t.status === 'Em Tratamento').length}
          </div>
        </div>
      </div>

      {/* Lista de Tratativas */}
      {loading ? (
        <div className="card" style={{ 
          textAlign: 'center', 
          padding: 'var(--spacing-2xl)',
          border: '1px solid var(--border-primary)'
        }}>
          <p style={{ color: 'var(--text-secondary)' }}>Carregando tratativas...</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          {filteredTreatments.length === 0 ? (
          <div className="card" style={{ 
            textAlign: 'center', 
            padding: 'var(--spacing-2xl)',
            border: '1px solid var(--border-primary)'
          }}>
            <Eye size={48} color="var(--text-tertiary)" style={{ marginBottom: 'var(--spacing-md)' }} />
            <p style={{ 
              color: 'var(--text-secondary)',
              fontSize: '1rem',
              marginBottom: 'var(--spacing-sm)'
            }}>
              {searchTerm || filterStatus !== 'all' 
                ? 'Nenhuma tratativa encontrada' 
                : 'Nenhuma tratativa em acompanhamento'}
            </p>
          </div>
        ) : (
          filteredTreatments.map((treatment) => (
            <div key={treatment.id} className="card" style={{ 
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
                  <Ticket size={20} color="var(--purple)" />
                  <h3 style={{ 
                    fontSize: '1.125rem', 
                    fontWeight: '600',
                    color: 'var(--text-primary)'
                  }}>
                    {treatment.ticket} - {treatment.title}
                  </h3>
                  <span style={{
                    fontSize: '0.75rem',
                    padding: '0.25rem 0.5rem',
                    borderRadius: 'var(--radius-full)',
                    background: treatment.priority === 'Alta' 
                      ? 'var(--red-light)' 
                      : treatment.priority === 'Média'
                      ? 'var(--orange-light)'
                      : 'var(--blue-light)',
                    color: treatment.priority === 'Alta' 
                      ? 'var(--red)' 
                      : treatment.priority === 'Média'
                      ? 'var(--orange)'
                      : 'var(--blue)',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    {treatment.priority}
                  </span>
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
                    <User size={14} />
                    {treatment.agent}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Clock size={14} />
                    {treatment.timeElapsed}
                  </span>
                  <span style={{
                    fontSize: '0.75rem',
                    padding: '0.25rem 0.5rem',
                    borderRadius: 'var(--radius-full)',
                    background: treatment.status === 'Em Tratamento' 
                      ? 'var(--orange-light)' 
                      : treatment.status === 'Aguardando Cliente'
                      ? 'var(--blue-light)'
                      : 'var(--purple-light)',
                    color: treatment.status === 'Em Tratamento' 
                      ? 'var(--orange)' 
                      : treatment.status === 'Aguardando Cliente'
                      ? 'var(--blue)'
                      : 'var(--purple)',
                    fontWeight: '600'
                  }}>
                    {treatment.status}
                  </span>
                  <span style={{ fontSize: '0.8125rem' }}>
                    Última atualização: {new Date(treatment.lastUpdate).toLocaleString('pt-BR')}
                  </span>
                  {treatment.source === 'formulário' && (
                    <span style={{
                      fontSize: '0.75rem',
                      padding: '0.25rem 0.5rem',
                      borderRadius: 'var(--radius-full)',
                      background: 'var(--purple-light)',
                      color: 'var(--purple)',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem'
                    }}>
                      <Ticket size={12} />
                      {treatment.formName}
                      {treatment.wasApproved && ' (Aprovado)'}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ 
                display: 'flex', 
                gap: 'var(--spacing-sm)'
              }}>
                <button 
                  className="btn btn-primary btn-sm"
                  onClick={() => handleViewDetails(treatment.id)}
                >
                  <Eye size={16} />
                  Ver Detalhes
                </button>
              </div>
            </div>
          ))
          )}
        </div>
      )}

      {/* Modal de Detalhes do Ticket */}
      {selectedTicket && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: 'var(--spacing-xl)',
          overflowY: 'auto'
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            setSelectedTicket(null);
            setTicketMessages([]);
          }
        }}
        >
          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-lg)',
            width: '100%',
            maxWidth: '900px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: 'var(--shadow-xl)',
            border: '1px solid var(--border-primary)'
          }}
          onClick={(e) => e.stopPropagation()}
          >
            {/* Header do Modal */}
            <div style={{
              padding: 'var(--spacing-lg)',
              borderBottom: '1px solid var(--border-primary)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexShrink: 0
            }}>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: '0.875rem',
                  color: 'var(--text-secondary)',
                  marginBottom: 'var(--spacing-xs)'
                }}>
                  <strong>ID:</strong> {formatTicketId(selectedTicket)}
                </div>
                <h2 style={{
                  fontSize: '1.5rem',
                  fontWeight: '700',
                  color: 'var(--text-primary)',
                  marginBottom: 'var(--spacing-xs)'
                }}>
                  {selectedTicket.title}
                </h2>
                <div style={{
                  display: 'flex',
                  gap: 'var(--spacing-md)',
                  fontSize: '0.875rem',
                  color: 'var(--text-secondary)',
                  flexWrap: 'wrap'
                }}>
                  <span><strong>Criado por:</strong> {selectedTicket.user_name}</span>
                  {selectedTicket.assigned_name && <span><strong>Atribuído a:</strong> {selectedTicket.assigned_name}</span>}
                  {selectedTicket.form_name && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <FileText size={12} />
                      <strong>Formulário:</strong> {selectedTicket.form_name}
                    </span>
                  )}
                  <span><strong>Status:</strong> {selectedTicket.status}</span>
                  <span><strong>Prioridade:</strong> {selectedTicket.priority}</span>
                </div>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setSelectedTicket(null);
                  setTicketMessages([]);
                }}
                style={{ padding: 'var(--spacing-xs) var(--spacing-sm)' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Conteúdo do Modal */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: 'var(--spacing-lg)'
            }}>
              {loadingDetails ? (
                <div style={{ textAlign: 'center', padding: 'var(--spacing-2xl)' }}>
                  <p style={{ color: 'var(--text-secondary)' }}>Carregando detalhes...</p>
                </div>
              ) : (
                <>
                  {/* Descrição Inicial */}
                  <div style={{
                    marginBottom: 'var(--spacing-xl)',
                    padding: 'var(--spacing-md)',
                    backgroundColor: 'var(--bg-tertiary)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-primary)'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--spacing-sm)',
                      marginBottom: 'var(--spacing-sm)'
                    }}>
                      <User size={16} color="var(--text-secondary)" />
                      <strong style={{ color: 'var(--text-primary)' }}>{selectedTicket.user_name}</strong>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                        {formatDate(selectedTicket.created_at)}
                      </span>
                    </div>
                    <div style={{
                      color: 'var(--text-primary)',
                      whiteSpace: 'pre-wrap',
                      lineHeight: '1.6'
                    }}>
                      {selectedTicket.description}
                    </div>
                  </div>

                  {/* Mensagens do Chat */}
                  {ticketMessages.length > 0 && (
                    <div>
                      <h3 style={{
                        fontSize: '1rem',
                        fontWeight: '600',
                        color: 'var(--text-primary)',
                        marginBottom: 'var(--spacing-md)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--spacing-sm)'
                      }}>
                        <MessageSquare size={18} />
                        Mensagens ({ticketMessages.length})
                      </h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                        {ticketMessages.map((message) => (
                          <div key={message.id} style={{
                            padding: 'var(--spacing-md)',
                            backgroundColor: 'var(--bg-tertiary)',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--border-primary)'
                          }}>
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 'var(--spacing-sm)',
                              marginBottom: 'var(--spacing-xs)'
                            }}>
                              <User size={14} color="var(--text-secondary)" />
                              <strong style={{ color: 'var(--text-primary)', fontSize: '0.875rem' }}>
                                {message.user_name}
                              </strong>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                                {formatDate(message.created_at)}
                              </span>
                              {message.updated_at !== message.created_at && (
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                                  (editado)
                                </span>
                              )}
                            </div>
                            <div style={{
                              color: 'var(--text-primary)',
                              whiteSpace: 'pre-wrap',
                              lineHeight: '1.6',
                              fontSize: '0.875rem'
                            }}>
                              {message.message}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {ticketMessages.length === 0 && (
                    <div style={{
                      textAlign: 'center',
                      padding: 'var(--spacing-xl)',
                      color: 'var(--text-secondary)'
                    }}>
                      <MessageSquare size={32} style={{ marginBottom: 'var(--spacing-sm)', opacity: 0.5 }} />
                      <p>Nenhuma mensagem adicional ainda</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
