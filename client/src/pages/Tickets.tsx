import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { formatDateList } from '../utils/dateUtils';
import { 
  Search, 
  Filter, 
  Clock, 
  User, 
  FileText, 
  AlertCircle, 
  CheckCircle, 
  XCircle,
  MoreVertical,
  Eye,
  Edit
} from 'lucide-react';

interface Ticket {
  id: number;
  ticket_number: number | null;
  title: string;
  description: string;
  status: 'pending_approval' | 'open' | 'in_progress' | 'resolved' | 'closed' | 'scheduled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category_name: string | null;
  user_name: string;
  user_email: string;
  assigned_name: string | null;
  form_name: string | null;
  form_url: string | null;
  form_id: number | null;
  created_at: string;
  updated_at: string;
}

// Função para gerar ID completo do ticket (sem barras) - usado em URLs
function getTicketFullId(ticket: Ticket): string {
  if (!ticket.ticket_number || !ticket.created_at) {
    return ticket.id.toString();
  }
  
  const date = new Date(ticket.created_at);
  // Usar timezone de Brasília para extrair ano, mês e dia
  const year = parseInt(date.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo', year: 'numeric' }));
  const month = parseInt(date.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo', month: '2-digit' }));
  const day = parseInt(date.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo', day: '2-digit' }));
  const number = String(ticket.ticket_number).padStart(3, '0');
  
  return `${year}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}${number}`;
}

// Função para formatar ID do ticket para exibição (com barras)
function formatTicketId(ticket: Ticket): string {
  if (!ticket.ticket_number || !ticket.created_at) {
    return `#${ticket.id}`;
  }
  
  const date = new Date(ticket.created_at);
  // Usar timezone de Brasília para extrair ano, mês e dia
  const year = parseInt(date.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo', year: 'numeric' }));
  const month = parseInt(date.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo', month: '2-digit' }));
  const day = parseInt(date.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo', day: '2-digit' }));
  const number = String(ticket.ticket_number).padStart(3, '0');
  
  return `${year}/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}/${number}`;
}

interface Column {
  id: string;
  title: string;
  status: Ticket['status'][];
  color: string;
  bgColor: string;
}

const columns: Column[] = [
  {
    id: 'open',
    title: 'Aberto',
    status: ['open'],
    color: 'var(--red)',
    bgColor: 'rgba(239, 68, 68, 0.1)'
  },
  {
    id: 'in_progress',
    title: 'Em Progresso',
    status: ['in_progress'],
    color: 'var(--blue)',
    bgColor: 'rgba(59, 130, 246, 0.1)'
  },
  {
    id: 'scheduled',
    title: 'Agendados',
    status: ['scheduled'],
    color: 'var(--purple)',
    bgColor: 'rgba(147, 51, 234, 0.1)'
  },
  {
    id: 'closed',
    title: 'Finalizados',
    status: ['closed'],
    color: 'var(--green)',
    bgColor: 'rgba(34, 197, 94, 0.1)'
  }
];

export default function Tickets() {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [draggedTicket, setDraggedTicket] = useState<Ticket | null>(null);
  const [draggedOverColumn, setDraggedOverColumn] = useState<string | null>(null);
  const [viewedTickets, setViewedTickets] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetchTickets();
    // Carregar tickets visualizados do localStorage
    const savedViewed = localStorage.getItem('viewedTickets');
    if (savedViewed) {
      try {
        setViewedTickets(new Set(JSON.parse(savedViewed)));
      } catch (error) {
        console.error('Erro ao carregar tickets visualizados:', error);
      }
    }
  }, []);

  const fetchTickets = async () => {
    try {
      const response = await axios.get('/api/tickets');
      // Filtrar tickets pendentes de aprovação - eles devem aparecer apenas em /acompanhar/aprovar
      const filteredTickets = response.data.filter((ticket: Ticket) => 
        ticket.status !== 'pending_approval'
      );
      setTickets(filteredTickets);
    } catch (error) {
      console.error('Erro ao buscar tickets:', error);
      alert('Erro ao buscar tickets');
    } finally {
      setLoading(false);
    }
  };

  const updateTicketStatus = async (ticketId: number, newStatus: Ticket['status']) => {
    try {
      await axios.put(`/api/tickets/${ticketId}`, { status: newStatus });
      await fetchTickets();
    } catch (error: any) {
      console.error('Erro ao atualizar status:', error);
      alert(error.response?.data?.error || 'Erro ao atualizar status do ticket');
      await fetchTickets(); // Recarregar para reverter visualmente
    }
  };

  const handleDragStart = (e: React.DragEvent, ticket: Ticket) => {
    setDraggedTicket(ticket);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', ticket.id.toString());
  };

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDraggedOverColumn(columnId);
  };

  const handleDragLeave = () => {
    setDraggedOverColumn(null);
  };

  const handleDrop = async (e: React.DragEvent, column: Column) => {
    e.preventDefault();
    setDraggedOverColumn(null);

    if (!draggedTicket) return;

    // Lógica especial para coluna "Aberto"
    if (column.id === 'open') {
      // Mover para "Aberto" = mudar status para 'open'
      if (draggedTicket.status !== 'open') {
        await updateTicketStatus(draggedTicket.id, 'open');
      }
      
      setDraggedTicket(null);
      await fetchTickets(); // Recarregar para atualizar a visualização
      return;
    }

    // Para outras colunas, usar a lógica normal de mudança de status
    const newStatus = column.status[0];
    if (draggedTicket.status === newStatus) {
      setDraggedTicket(null);
      return;
    }

    // Não permitir mover para pending_approval via drag-and-drop
    if (newStatus === 'pending_approval') {
      setDraggedTicket(null);
      return;
    }

    // Atualizar status otimisticamente
    setTickets(prevTickets =>
      prevTickets.map(ticket =>
        ticket.id === draggedTicket.id ? { ...ticket, status: newStatus } : ticket
      )
    );

    // Atualizar no backend
    await updateTicketStatus(draggedTicket.id, newStatus);
    setDraggedTicket(null);
  };

  const getPriorityColor = (priority: Ticket['priority']) => {
    const colors: Record<Ticket['priority'], string> = {
      low: 'var(--text-tertiary)',
      medium: 'var(--blue)',
      high: 'var(--orange)',
      urgent: 'var(--red)'
    };
    return colors[priority] || colors.medium;
  };

  const getPriorityLabel = (priority: Ticket['priority']) => {
    const labels: Record<Ticket['priority'], string> = {
      low: 'Baixa',
      medium: 'Média',
      high: 'Alta',
      urgent: 'Urgente'
    };
    return labels[priority] || priority;
  };

  // Função para calcular horas desde a criação do ticket
  const getHoursSinceCreation = (ticket: Ticket): number => {
    const now = new Date();
    const ticketDate = new Date(ticket.created_at);
    const diffMs = now.getTime() - ticketDate.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    return diffHours;
  };

  // Função para obter cor do card baseado no tempo aberto
  const getCardColor = (ticket: Ticket, columnId: string): string => {
    // Aplicar apenas nas colunas "Aberto" e "Em Progresso"
    if (columnId !== 'open' && columnId !== 'in_progress') {
      return 'var(--bg-primary)';
    }

    const hours = getHoursSinceCreation(ticket);
    
    // 48 horas ou mais = vermelho
    if (hours >= 48) {
      return 'rgba(239, 68, 68, 0.15)'; // Vermelho claro
    }
    
    // 24 horas ou mais = amarelo
    if (hours >= 24) {
      return 'rgba(234, 179, 8, 0.15)'; // Amarelo claro
    }
    
    // Menos de 24 horas = cor padrão
    return 'var(--bg-primary)';
  };

  // Função para obter cor da borda baseado no tempo aberto
  const getCardBorderColor = (ticket: Ticket, columnId: string): string => {
    // Aplicar apenas nas colunas "Aberto" e "Em Progresso"
    if (columnId !== 'open' && columnId !== 'in_progress') {
      return 'var(--border-primary)';
    }

    const hours = getHoursSinceCreation(ticket);
    
    // 48 horas ou mais = vermelho
    if (hours >= 48) {
      return 'rgba(239, 68, 68, 0.5)'; // Vermelho
    }
    
    // 24 horas ou mais = amarelo
    if (hours >= 24) {
      return 'rgba(234, 179, 8, 0.5)'; // Amarelo
    }
    
    // Menos de 24 horas = cor padrão
    return 'var(--border-primary)';
  };

  const getTicketsForColumn = (column: Column): Ticket[] => {
    let filtered = tickets.filter(ticket => {
      // Verificar se o ticket tem o status correto
      if (!column.status.includes(ticket.status)) return false;
      
      return true;
    });

    // Aplicar filtro de busca
    if (searchTerm) {
      filtered = filtered.filter(ticket =>
        ticket.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ticket.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (ticket.form_name && ticket.form_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (ticket.user_name && ticket.user_name.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Aplicar filtro de prioridade
    if (priorityFilter !== 'all') {
      filtered = filtered.filter(ticket => ticket.priority === priorityFilter);
    }

    // Ordenar por prioridade e data
    return filtered.sort((a, b) => {
      const priorityOrder: Record<Ticket['priority'], number> = {
        urgent: 4,
        high: 3,
        medium: 2,
        low: 1
      };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  };

  const handleTicketClick = (ticketId: number) => {
    // Marcar ticket como visualizado
    setViewedTickets(prev => {
      const newSet = new Set(prev);
      newSet.add(ticketId);
      // Salvar no localStorage para persistir entre sessões
      localStorage.setItem('viewedTickets', JSON.stringify(Array.from(newSet)));
      return newSet;
    });
    // Navegar para a página de detalhes usando ID completo formatado
    const ticket = tickets.find(t => t.id === ticketId);
    if (ticket) {
      const fullId = getTicketFullId(ticket);
      console.log(`[Tickets] Navegando para ticket - ID numérico: ${ticketId}, ID completo: ${fullId}`);
      navigate(`/tickets/${fullId}`);
    } else {
      console.log(`[Tickets] Ticket não encontrado na lista, usando ID numérico: ${ticketId}`);
      navigate(`/tickets/${ticketId}`);
    }
  };

  const formatDate = formatDateList;

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
          <p>Carregando tickets...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 'var(--spacing-xl)' }}>

      {/* Filtros */}
      <div style={{
        display: 'flex',
        gap: 'var(--spacing-md)',
        marginBottom: 'var(--spacing-xl)',
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
            placeholder="Buscar tickets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '2.75rem' }}
          />
        </div>
        <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center' }}>
          <Filter size={18} color="var(--text-secondary)" />
          <select
            className="input"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            style={{
              minWidth: '150px',
              cursor: 'pointer'
            }}
          >
            <option value="all">Todas as prioridades</option>
            <option value="urgent">Urgente</option>
            <option value="high">Alta</option>
            <option value="medium">Média</option>
            <option value="low">Baixa</option>
          </select>
        </div>
      </div>

      {/* Kanban Board */}
      <div style={{
        display: 'flex',
        gap: '0.75rem',
        overflowX: 'auto',
        paddingBottom: 'var(--spacing-md)',
        minHeight: 'calc(100vh - 300px)'
      }}>
          {columns.map((column) => {
            const columnTickets = getTicketsForColumn(column);
            const isDraggedOver = draggedOverColumn === column.id;

          return (
            <div
              key={column.id}
              style={{
                flex: '1',
                minWidth: '240px',
                maxWidth: '280px',
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-md)',
                border: `2px solid ${isDraggedOver ? column.color : 'var(--border-primary)'}`,
                padding: '0.75rem',
                transition: 'all var(--transition-base)',
                boxShadow: isDraggedOver ? `0 0 0 3px ${column.bgColor}` : 'var(--shadow)'
              }}
              onDragOver={(e) => handleDragOver(e, column.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, column)}
            >
              {/* Column Header - Compacto */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.625rem',
                paddingBottom: '0.5rem',
                borderBottom: `2px solid ${column.color}`
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: column.color
                  }} />
                  <h3 style={{
                    fontSize: '0.8125rem',
                    fontWeight: '700',
                    color: 'var(--text-primary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    lineHeight: '1.2'
                  }}>
                    {column.title}
                  </h3>
                </div>
                <span style={{
                  fontSize: '0.75rem',
                  fontWeight: '700',
                  color: 'var(--text-secondary)',
                  backgroundColor: column.bgColor,
                  padding: '0.125rem 0.5rem',
                  borderRadius: 'var(--radius-full)',
                  minWidth: '24px',
                  textAlign: 'center',
                  lineHeight: '1.4'
                }}>
                  {columnTickets.length}
                </span>
              </div>

              {/* Tickets */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                minHeight: '150px'
              }}>
                {columnTickets.length === 0 ? (
                  <div style={{
                    textAlign: 'center',
                    padding: 'var(--spacing-md)',
                    color: 'var(--text-tertiary)',
                    fontSize: '0.75rem'
                  }}>
                    Nenhum ticket
                  </div>
                ) : (
                  columnTickets.map((ticket) => {
                    const cardBgColor = getCardColor(ticket, column.id);
                    const cardBorderColor = getCardBorderColor(ticket, column.id);
                    
                    return (
                    <div
                      key={ticket.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, ticket)}
                      onClick={() => handleTicketClick(ticket.id)}
                      style={{
                        backgroundColor: cardBgColor,
                        border: `1px solid ${cardBorderColor}`,
                        borderRadius: 'var(--radius-sm)',
                        padding: '0.625rem',
                        cursor: 'pointer',
                        transition: 'all var(--transition-base)',
                        position: 'relative',
                        opacity: draggedTicket?.id === ticket.id ? 0.5 : 1,
                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = column.color;
                        e.currentTarget.style.boxShadow = `0 2px 8px ${column.bgColor}`;
                        e.currentTarget.style.transform = 'translateY(-1px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = cardBorderColor;
                        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                    >
                      {/* Header: Priority + Form Badge */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '0.375rem',
                        gap: '0.375rem'
                      }}>
                        <span style={{
                          fontSize: '0.625rem',
                          fontWeight: '700',
                          color: getPriorityColor(ticket.priority),
                          backgroundColor: `${getPriorityColor(ticket.priority)}15`,
                          padding: '0.125rem 0.375rem',
                          borderRadius: 'var(--radius-sm)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          lineHeight: '1.2'
                        }}>
                          {getPriorityLabel(ticket.priority)}
                        </span>
                        {ticket.form_name && (
                          <span style={{
                            fontSize: '0.625rem',
                            color: 'var(--purple)',
                            backgroundColor: 'var(--purple-light)',
                            padding: '0.125rem 0.375rem',
                            borderRadius: 'var(--radius-sm)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.125rem',
                            lineHeight: '1.2'
                          }}>
                            <FileText size={8} />
                            Form
                          </span>
                        )}
                      </div>

                      {/* Ticket ID - Compacto */}
                      {ticket.ticket_number && ticket.created_at && (
                        <div style={{
                          fontSize: '0.6875rem',
                          color: 'var(--text-tertiary)',
                          marginBottom: '0.25rem',
                          fontFamily: 'monospace',
                          fontWeight: '600',
                          lineHeight: '1.2'
                        }}>
                          {formatTicketId(ticket)}
                        </div>
                      )}
                      
                      {/* Title - Menor */}
                      <h4 style={{
                        fontSize: '0.8125rem',
                        fontWeight: '600',
                        color: 'var(--text-primary)',
                        marginBottom: '0.25rem',
                        lineHeight: '1.3',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}>
                        {ticket.title}
                      </h4>

                      {/* Description - Mais compacta */}
                      <p style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-secondary)',
                        marginBottom: '0.375rem',
                        lineHeight: '1.4',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}>
                        {ticket.description}
                      </p>

                      {/* Meta Info - Compacto em linha única */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.5rem',
                        marginTop: '0.375rem',
                        paddingTop: '0.375rem',
                        borderTop: '1px solid var(--border-primary)',
                        fontSize: '0.6875rem',
                        color: 'var(--text-tertiary)',
                        flexWrap: 'wrap'
                      }}>
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '0.25rem',
                          flex: '1',
                          minWidth: '0',
                          overflow: 'hidden'
                        }}>
                          <User size={10} />
                          <span style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {ticket.user_name}
                          </span>
                        </div>
                        {ticket.assigned_name && (
                          <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '0.25rem',
                            flex: '1',
                            minWidth: '0',
                            overflow: 'hidden'
                          }}>
                            <CheckCircle size={10} />
                            <span style={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}>
                              {ticket.assigned_name}
                            </span>
                          </div>
                        )}
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '0.25rem',
                          flexShrink: 0
                        }}>
                          <Clock size={10} />
                          <span>{formatDate(ticket.created_at)}</span>
                        </div>
                      </div>
                    </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* CSS Animation */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
