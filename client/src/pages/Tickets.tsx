import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
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

// Função para formatar ID do ticket no formato ano/mês/dia/número
function formatTicketId(ticket: Ticket): string {
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
    // Navegar para a página de detalhes
    navigate(`/tickets/${ticketId}`);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Hoje';
    if (diffDays === 1) return 'Ontem';
    if (diffDays < 7) return `${diffDays} dias atrás`;
    return date.toLocaleDateString('pt-BR');
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
        gap: 'var(--spacing-md)',
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
                minWidth: '320px',
                maxWidth: '380px',
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-lg)',
                border: `2px solid ${isDraggedOver ? column.color : 'var(--border-primary)'}`,
                padding: 'var(--spacing-md)',
                transition: 'all var(--transition-base)',
                boxShadow: isDraggedOver ? `0 0 0 4px ${column.bgColor}` : 'var(--shadow)'
              }}
              onDragOver={(e) => handleDragOver(e, column.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, column)}
            >
              {/* Column Header */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 'var(--spacing-md)',
                paddingBottom: 'var(--spacing-sm)',
                borderBottom: `2px solid ${column.color}`
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                  <div style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    backgroundColor: column.color
                  }} />
                  <h3 style={{
                    fontSize: '0.9375rem',
                    fontWeight: '700',
                    color: 'var(--text-primary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    {column.title}
                  </h3>
                </div>
                <span style={{
                  fontSize: '0.8125rem',
                  fontWeight: '600',
                  color: 'var(--text-secondary)',
                  backgroundColor: column.bgColor,
                  padding: '0.25rem 0.5rem',
                  borderRadius: 'var(--radius-full)'
                }}>
                  {columnTickets.length}
                </span>
              </div>

              {/* Tickets */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--spacing-sm)',
                minHeight: '200px'
              }}>
                {columnTickets.length === 0 ? (
                  <div style={{
                    textAlign: 'center',
                    padding: 'var(--spacing-xl)',
                    color: 'var(--text-tertiary)',
                    fontSize: '0.875rem'
                  }}>
                    Nenhum ticket
                  </div>
                ) : (
                  columnTickets.map((ticket) => (
                    <div
                      key={ticket.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, ticket)}
                      onClick={() => handleTicketClick(ticket.id)}
                      style={{
                        backgroundColor: 'var(--bg-primary)',
                        border: '1px solid var(--border-primary)',
                        borderRadius: 'var(--radius-md)',
                        padding: 'var(--spacing-md)',
                        cursor: 'pointer',
                        transition: 'all var(--transition-base)',
                        position: 'relative',
                        opacity: draggedTicket?.id === ticket.id ? 0.5 : 1
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = column.color;
                        e.currentTarget.style.boxShadow = `0 4px 12px ${column.bgColor}`;
                        e.currentTarget.style.transform = 'translateY(-2px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border-primary)';
                        e.currentTarget.style.boxShadow = 'none';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                    >
                      {/* Priority Badge */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: 'var(--spacing-sm)'
                      }}>
                        <span style={{
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          color: getPriorityColor(ticket.priority),
                          backgroundColor: `${getPriorityColor(ticket.priority)}20`,
                          padding: '0.25rem 0.5rem',
                          borderRadius: 'var(--radius-sm)',
                          textTransform: 'uppercase'
                        }}>
                          {getPriorityLabel(ticket.priority)}
                        </span>
                        {ticket.form_name && (
                          <span style={{
                            fontSize: '0.6875rem',
                            color: 'var(--purple)',
                            backgroundColor: 'var(--purple-light)',
                            padding: '0.125rem 0.375rem',
                            borderRadius: 'var(--radius-sm)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem'
                          }}>
                            <FileText size={10} />
                            Formulário
                          </span>
                        )}
                      </div>

                      {/* Ticket ID */}
                      {ticket.ticket_number && ticket.created_at && (
                        <div style={{
                          fontSize: '0.75rem',
                          color: 'var(--text-tertiary)',
                          marginBottom: 'var(--spacing-xs)',
                          fontFamily: 'monospace',
                          fontWeight: '600'
                        }}>
                          {formatTicketId(ticket)}
                        </div>
                      )}
                      
                      {/* Title */}
                      <h4 style={{
                        fontSize: '0.9375rem',
                        fontWeight: '600',
                        color: 'var(--text-primary)',
                        marginBottom: 'var(--spacing-xs)',
                        lineHeight: '1.4'
                      }}>
                        {ticket.title}
                      </h4>

                      {/* Description */}
                      <p style={{
                        fontSize: '0.8125rem',
                        color: 'var(--text-secondary)',
                        marginBottom: 'var(--spacing-sm)',
                        lineHeight: '1.5',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}>
                        {ticket.description}
                      </p>

                      {/* Form Info */}
                      {ticket.form_name && (
                        <div style={{
                          fontSize: '0.75rem',
                          color: 'var(--text-tertiary)',
                          marginBottom: 'var(--spacing-xs)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem'
                        }}>
                          <FileText size={12} />
                          <span>{ticket.form_name}</span>
                        </div>
                      )}

                      {/* Meta Info */}
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.25rem',
                        marginTop: 'var(--spacing-sm)',
                        paddingTop: 'var(--spacing-sm)',
                        borderTop: '1px solid var(--border-primary)',
                        fontSize: '0.75rem',
                        color: 'var(--text-tertiary)'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                          <User size={12} />
                          <span>{ticket.user_name}</span>
                        </div>
                        {ticket.assigned_name && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                            <CheckCircle size={12} />
                            <span>Atribuído: {ticket.assigned_name}</span>
                          </div>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                          <Clock size={12} />
                          <span>{formatDate(ticket.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  ))
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
