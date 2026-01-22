import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { formatDateList } from '../utils/dateUtils';
import { 
  Search, 
  Clock, 
  User, 
  FileText, 
  CheckCircle,
  RefreshCw
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
  scheduled_at: string | null;
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
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [onlyMyTickets, setOnlyMyTickets] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState<string>('0'); // 0 = desabilitado
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

  // Auto-refresh quando autoRefresh estiver ativo
  useEffect(() => {
    if (autoRefresh === '0') return;

    const intervalMs = parseInt(autoRefresh) * 1000;
    const refreshInterval = setInterval(() => {
      fetchTickets();
    }, intervalMs);

    return () => clearInterval(refreshInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh]);

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

  // Função para verificar se ticket agendado está vencido
  const isScheduledOverdue = (ticket: Ticket): boolean => {
    if (!ticket.scheduled_at || ticket.status !== 'scheduled') {
      return false;
    }
    const scheduledDate = new Date(ticket.scheduled_at);
    const now = new Date();
    return scheduledDate < now;
  };

  // Função para obter cor do card baseado no tempo aberto ou agendamento vencido
  const getCardColor = (ticket: Ticket, columnId: string): string => {
    // Se for ticket agendado vencido, aplicar cor roxa
    if (isScheduledOverdue(ticket)) {
      return 'rgba(147, 51, 234, 0.2)'; // Roxo claro
    }

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

  // Função para obter cor da borda baseado no tempo aberto ou agendamento vencido
  const getCardBorderColor = (ticket: Ticket, columnId: string): string => {
    // Se for ticket agendado vencido, aplicar borda roxa
    if (isScheduledOverdue(ticket)) {
      return 'rgba(147, 51, 234, 0.6)'; // Roxo
    }

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

    // Aplicar filtro de "Apenas meus tickets"
    if (onlyMyTickets && user) {
      filtered = filtered.filter(ticket => 
        ticket.assigned_name && ticket.assigned_name.toLowerCase() === user.name.toLowerCase()
      );
    }

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
        alignItems: 'stretch',
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
    <div style={{ 
      padding: 'var(--spacing-lg)',
      maxWidth: '1920px',
      margin: '0 auto',
      position: 'relative'
    }}>
      {/* Filtros Minimalistas - Canto Superior Direito */}
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
        {/* Busca Compacta */}
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
              width: '180px',
              fontSize: '0.8125rem',
              height: '32px',
              boxSizing: 'border-box',
              lineHeight: '1'
            }}
          />
        </div>

        {/* Prioridade Compacta */}
        <select
          className="input"
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          style={{
            padding: '0.375rem 0.75rem',
            fontSize: '0.8125rem',
            cursor: 'pointer',
            height: '32px',
            minWidth: '100px',
            boxSizing: 'border-box',
            lineHeight: '1'
          }}
        >
          <option value="all">Todas</option>
          <option value="urgent">Urgente</option>
          <option value="high">Alta</option>
          <option value="medium">Média</option>
          <option value="low">Baixa</option>
        </select>

        {/* Atualização Compacta */}
        <div style={{ position: 'relative', height: '32px' }}>
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

        {/* Meus Tickets Compacto */}
        {(user?.role === 'admin' || user?.role === 'agent') && (
          <label style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.375rem',
            cursor: 'pointer',
            userSelect: 'none',
            padding: '0 0.75rem',
            backgroundColor: onlyMyTickets ? 'var(--purple-light)' : 'transparent',
            border: `1px solid ${onlyMyTickets ? 'var(--purple)' : 'var(--border-primary)'}`,
            borderRadius: 'var(--radius-sm)',
            transition: 'all var(--transition-base)',
            height: '32px',
            fontSize: '0.8125rem',
            whiteSpace: 'nowrap',
            boxSizing: 'border-box'
          }}>
            <input
              type="checkbox"
              checked={onlyMyTickets}
              onChange={(e) => setOnlyMyTickets(e.target.checked)}
              style={{
                cursor: 'pointer',
                width: '14px',
                height: '14px',
                accentColor: 'var(--purple)',
                margin: 0,
                padding: 0,
                flexShrink: 0
              }}
            />
            <span style={{
              color: 'var(--text-primary)',
              fontWeight: '500',
              lineHeight: '1',
              display: 'inline-block',
              verticalAlign: 'middle'
            }}>
              Meus
            </span>
          </label>
        )}
      </div>

      {/* Kanban Board */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 'var(--spacing-lg)',
        paddingBottom: 'var(--spacing-lg)'
      }}>
          {columns.map((column) => {
            const columnTickets = getTicketsForColumn(column);
            const isDraggedOver = draggedOverColumn === column.id;

          return (
            <div
              key={column.id}
              style={{
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-lg)',
                border: `2px solid ${isDraggedOver ? column.color : 'var(--border-primary)'}`,
                padding: 'var(--spacing-md)',
                transition: 'all var(--transition-base)',
                boxShadow: isDraggedOver 
                  ? `0 4px 12px ${column.bgColor}, 0 0 0 2px ${column.color}` 
                  : '0 2px 8px rgba(0, 0, 0, 0.08)',
                display: 'flex',
                flexDirection: 'column',
                height: 'fit-content',
                maxHeight: 'calc(100vh - 280px)'
              }}
              onDragOver={(e) => handleDragOver(e, column.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, column)}
            >
              {/* Column Header - Redesign */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'stretch',
                marginBottom: 'var(--spacing-md)',
                paddingBottom: 'var(--spacing-sm)',
                borderBottom: `2px solid ${column.color}`
              }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'stretch', 
                  gap: 'var(--spacing-sm)'
                }}>
                  <div style={{
                    width: '4px',
                    height: '20px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: column.color
                  }} />
                  <h3 style={{
                    fontSize: '0.9375rem',
                    fontWeight: '700',
                    color: 'var(--text-primary)',
                    letterSpacing: '0.02em'
                  }}>
                    {column.title}
                  </h3>
                </div>
                <span style={{
                  fontSize: '0.8125rem',
                  fontWeight: '700',
                  color: column.color,
                  backgroundColor: column.bgColor,
                  padding: '0.25rem 0.625rem',
                  borderRadius: 'var(--radius-full)',
                  minWidth: '28px',
                  textAlign: 'center'
                }}>
                  {columnTickets.length}
                </span>
              </div>

              {/* Tickets */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--spacing-sm)',
                overflowY: 'auto',
                flex: 1,
                paddingRight: 'var(--spacing-xs)'
              }}>
                {columnTickets.length === 0 ? (
                  <div style={{
                    textAlign: 'center',
                    padding: 'var(--spacing-xl)',
                    color: 'var(--text-tertiary)',
                    fontSize: '0.875rem',
                    fontStyle: 'italic'
                  }}>
                    Nenhum ticket nesta coluna
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
                        padding: 'var(--spacing-sm)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        position: 'relative',
                        opacity: draggedTicket?.id === ticket.id ? 0.4 : 1,
                        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.08)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = column.color;
                        e.currentTarget.style.boxShadow = `0 2px 8px ${column.bgColor}`;
                        e.currentTarget.style.transform = 'translateY(-1px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = cardBorderColor;
                        e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.08)';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                    >
                      {/* Header: Priority + Form Badge */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'stretch',
                        marginBottom: '0.375rem',
                        gap: '0.25rem'
                      }}>
                        <span style={{
                          fontSize: '0.625rem',
                          fontWeight: '700',
                          color: '#FFFFFF',
                          backgroundColor: getPriorityColor(ticket.priority),
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
                            alignItems: 'stretch',
                            gap: '0.125rem',
                            fontWeight: '500',
                            lineHeight: '1.2'
                          }}>
                            <FileText size={8} />
                            Form
                          </span>
                        )}
                      </div>

                      {/* Ticket ID */}
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
                      
                      {/* Title */}
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

                      {/* Description */}
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

                      {/* Meta Info - Compacto */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'stretch',
                        justifyContent: 'space-between',
                        gap: '0.375rem',
                        marginTop: '0.375rem',
                        paddingTop: '0.375rem',
                        borderTop: '1px solid var(--border-primary)',
                        fontSize: '0.6875rem',
                        color: 'var(--text-tertiary)',
                        flexWrap: 'wrap'
                      }}>
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'stretch', 
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
                            alignItems: 'stretch', 
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
                          alignItems: 'stretch', 
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
