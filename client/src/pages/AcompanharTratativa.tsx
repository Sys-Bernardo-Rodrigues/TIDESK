import { useState, useEffect } from 'react';
import axios from 'axios';
import { Eye, Search, Clock, User, Ticket, TrendingUp, X, FileText, MessageSquare, Download, CheckCircle } from 'lucide-react';
import { formatDateBR } from '../utils/dateUtils';

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
  form_submission_id: number | null;
  created_at: string;
  updated_at: string;
}

interface FormAttachment {
  id: number;
  form_submission_id: number;
  field_id: number;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  field_label?: string;
}

// Função para formatar ID do ticket para exibição (com barras)
function formatTicketId(ticket: TicketDetail): string {
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

interface TicketMessage {
  id: number;
  ticket_id: number;
  user_id: number;
  message: string;
  user_name: string;
  user_email: string;
  created_at: string;
  updated_at: string;
  attachments?: MessageAttachment[];
}

interface MessageAttachment {
  id: number;
  message_id: number;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
}

export default function AcompanharTratativa() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [treatments, setTreatments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<TicketDetail | null>(null);
  const [ticketMessages, setTicketMessages] = useState<TicketMessage[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [attachments, setAttachments] = useState<FormAttachment[]>([]);

  useEffect(() => {
    fetchTreatments();
  }, []);

  const fetchTreatments = async () => {
    try {
      const response = await axios.get('/api/tickets/in-treatment');
      const tickets = response.data.map((ticket: any) => {
        // Formatar ID do ticket usando timezone de Brasília
        let ticketId = `#${ticket.id}`;
        if (ticket.ticket_number && ticket.created_at) {
          const date = new Date(ticket.created_at);
          const year = parseInt(date.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo', year: 'numeric' }));
          const month = parseInt(date.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo', month: '2-digit' }));
          const day = parseInt(date.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo', day: '2-digit' }));
          const number = String(ticket.ticket_number).padStart(3, '0');
          ticketId = `${year}/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}/${number}`;
        }

        return {
          id: ticket.id,
          ticket: ticketId,
          title: ticket.title,
          agent: ticket.assigned_name || 'Não atribuído',
          status: ticket.status === 'in_progress' ? 'Em Tratamento' : 
                  ticket.status === 'open' ? 'Aberto' : 
                  ticket.status === 'closed' ? 'Finalizado' : 
                  ticket.status,
          priority: ticket.priority === 'high' || ticket.priority === 'urgent' ? 'Alta' : ticket.priority === 'medium' ? 'Média' : 'Baixa',
          createdAt: ticket.created_at,
          lastUpdate: ticket.updated_at,
          timeElapsed: calculateTimeElapsed(ticket.created_at),
          source: ticket.form_id ? 'formulário' : undefined,
          formName: ticket.form_name,
          wasApproved: ticket.needs_approval === 1 && ticket.status === 'open',
          isClosed: ticket.status === 'closed'
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
      const ticket = ticketResponse.data;
      setSelectedTicket(ticket);

      // Buscar anexos do formulário se houver
      if (ticket.form_submission_id) {
        try {
          const attachmentsResponse = await axios.get(`/api/tickets/${ticketId}/attachments`);
          setAttachments(attachmentsResponse.data);
        } catch (error) {
          console.error('Erro ao buscar anexos:', error);
          setAttachments([]);
        }
      } else {
        setAttachments([]);
      }

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
    return formatDateBR(dateString, { includeTime: true });
  };

  // Função para parsear descrição markdown e extrair dados do formulário
  const parseFormDescription = (description: string) => {
    const lines = description.split('\n');
    const formData: Array<{ label: string; value: string }> = [];
    const attachmentsList: string[] = [];
    let inAttachmentsSection = false;

    lines.forEach((line) => {
      const trimmedLine = line.trim();
      
      if (trimmedLine.includes('**Arquivos anexados:**') || trimmedLine.includes('**Arquivos anexados::**')) {
        inAttachmentsSection = true;
        return;
      }
      
      if (inAttachmentsSection) {
        if (trimmedLine.startsWith('- ')) {
          attachmentsList.push(trimmedLine.substring(2));
        }
        return;
      }

      const match = line.match(/\*\*(.+?):+?\*\*\s*(.+)/);
      if (match) {
        const label = match[1].trim();
        let value = match[2].trim();
        
        if (value.startsWith('[Arquivo]')) {
          value = value.replace('[Arquivo]', '').trim();
        }
        
        formData.push({ label, value });
      }
    });

    return { formData, attachmentsList };
  };

  // Formatar tamanho do arquivo
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  // Download de arquivo
  const handleDownload = async (attachment: FormAttachment) => {
    try {
      const response = await axios.get(`/api/forms/attachments/${attachment.id}`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', attachment.file_name);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Erro ao baixar arquivo:', err);
      alert('Erro ao baixar arquivo');
    }
  };

  // Download de anexo de mensagem
  const handleDownloadMessageAttachment = async (attachment: MessageAttachment) => {
    try {
      const response = await axios.get(`/api/ticket-messages/attachments/${attachment.id}`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', attachment.file_name);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Erro ao baixar arquivo:', err);
      alert('Erro ao baixar arquivo');
    }
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
              <option value="Aberto">Aberto</option>
              <option value="Finalizado">Finalizado</option>
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
              background: 'rgba(34, 197, 94, 0.15)',
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
            Finalizados
          </h3>
          <div style={{ 
            fontSize: '2.5rem', 
            fontWeight: '800',
            color: 'var(--green)',
            lineHeight: '1'
          }}>
            {treatments.filter(t => t.status === 'Finalizado').length}
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
                      : treatment.status === 'Aberto'
                      ? 'var(--red-light)'
                      : treatment.status === 'Finalizado'
                      ? 'rgba(34, 197, 94, 0.15)'
                      : 'var(--purple-light)',
                    color: treatment.status === 'Em Tratamento' 
                      ? 'var(--orange)' 
                      : treatment.status === 'Aberto'
                      ? 'var(--red)'
                      : treatment.status === 'Finalizado'
                      ? 'var(--green)'
                      : 'var(--purple)',
                    fontWeight: '600'
                  }}>
                    {treatment.status}
                  </span>
                  <span style={{ fontSize: '0.8125rem' }}>
                    Última atualização: {formatDateBR(treatment.lastUpdate, { includeTime: true })}
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
            maxWidth: '1200px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: 'var(--shadow-xl)',
            border: '1px solid var(--border-primary)',
            overflow: 'hidden'
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
                  setAttachments([]);
                }}
                style={{ padding: 'var(--spacing-xs) var(--spacing-sm)' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Conteúdo do Modal - Estilo WhatsApp */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              background: 'linear-gradient(180deg, var(--bg-primary) 0%, #0F0F11 100%)',
              backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(145, 71, 255, 0.03) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(145, 71, 255, 0.03) 0%, transparent 50%)',
              padding: 'var(--spacing-md)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--spacing-sm)'
            }}>
              {loadingDetails ? (
                <div style={{ textAlign: 'center', padding: 'var(--spacing-2xl)' }}>
                  <p style={{ color: 'var(--text-secondary)' }}>Carregando detalhes...</p>
                </div>
              ) : (
                <>
                  {/* Mensagem inicial (descrição do ticket) - Estilo WhatsApp */}
                  {selectedTicket.form_name || attachments.length > 0 ? (
                    (() => {
                      const { formData } = parseFormDescription(selectedTicket.description);
                      return (
                        <>
                          {/* Mensagem de boas-vindas do formulário */}
                  <div style={{
                            display: 'flex',
                            justifyContent: 'flex-start',
                            marginBottom: 'var(--spacing-xs)'
                  }}>
                    <div style={{
                              maxWidth: '75%',
                              display: 'flex',
                              gap: 'var(--spacing-xs)',
                              alignItems: 'flex-end'
                            }}>
                              <div style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                backgroundColor: 'var(--purple)',
                      display: 'flex',
                      alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                marginBottom: '2px'
                              }}>
                                <FileText size={16} color="#FFFFFF" />
                    </div>
                              <div>
                    <div style={{
                                  backgroundColor: '#1E1E22',
                                  padding: '0.5rem 0.75rem',
                                  borderRadius: '0.5rem 0.5rem 0.5rem 0.125rem',
                      color: 'var(--text-primary)',
                                  fontSize: '0.875rem',
                                  lineHeight: '1.4',
                                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.3)'
                                }}>
                                  <strong style={{ color: 'var(--purple)' }}>
                                    {selectedTicket.form_name ? `Formulário: ${selectedTicket.form_name}` : 'Dados do Formulário'}
                                  </strong>
                                  <p style={{ marginTop: '0.25rem', color: 'var(--text-secondary)' }}>
                                    Olá! Recebemos sua submissão. Abaixo estão os detalhes:
                                  </p>
                                </div>
                                <div style={{
                                  fontSize: '0.6875rem',
                                  color: 'var(--text-tertiary)',
                                  paddingLeft: '0.5rem',
                                  marginTop: '0.25rem'
                                }}>
                                  {formatDate(selectedTicket.created_at)}
                                </div>
                              </div>
                    </div>
                  </div>

                          {/* Dados do formulário em mensagens separadas */}
                          {formData.map((item, index) => {
                            const fileNameMatch = item.value.match(/([^\s(]+\.(png|jpg|jpeg|gif|pdf|doc|docx|xls|xlsx|zip|rar|txt|mp4|mp3|avi|mov|webp|svg|bmp|ico|jfif|heic|heif))/i);
                            const fileName = fileNameMatch ? fileNameMatch[1] : null;
                            
                            const attachment = attachments.find(att => {
                              if (fileName && att.file_name === fileName) return true;
                              if (fileName && att.file_name.replace(/\.[^/.]+$/, '') === fileName.replace(/\.[^/.]+$/, '')) return true;
                              if (att.field_label === item.label) return true;
                              if (item.value.includes(att.file_name)) return true;
                              return false;
                            });

                            return (
                              <div key={index} style={{
                                display: 'flex',
                                justifyContent: 'flex-start',
                                marginBottom: 'var(--spacing-xs)'
                              }}>
                                <div style={{
                                  maxWidth: '75%',
                                  display: 'flex',
                                  gap: 'var(--spacing-xs)',
                                  alignItems: 'flex-end'
                                }}>
                                  <div style={{ width: '32px', flexShrink: 0 }} />
                                  <div style={{ flex: 1 }}>
                                    {attachment ? (
                                      <div style={{
                                        backgroundColor: '#1E1E22',
                                        padding: '0.5rem 0.75rem',
                                        borderRadius: '0.5rem 0.5rem 0.5rem 0.125rem',
                                        color: 'var(--text-primary)',
                                        fontSize: '0.875rem',
                                        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.3)',
                                        overflow: 'hidden'
                                      }}>
                                        <div style={{
                                          fontSize: '0.8125rem',
                                          fontWeight: '600',
                                          marginBottom: '0.5rem',
                                          color: 'var(--text-primary)'
                                        }}>
                                          {item.label}
                                          <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.5rem',
                                            padding: '0.5rem',
                                            backgroundColor: 'var(--bg-tertiary)',
                                            borderRadius: '0.375rem',
                                            marginTop: '0.5rem'
                                          }}>
                                            <FileText size={18} color="var(--purple)" />
                                            <div style={{ flex: 1 }}>
                                              <div style={{
                                                fontSize: '0.8125rem',
                                                fontWeight: '500',
                                                color: 'var(--text-primary)'
                                              }}>
                                                {attachment.file_name}
                                              </div>
                                              <div style={{
                                                fontSize: '0.75rem',
                                                color: 'var(--text-tertiary)'
                                              }}>
                                                {formatFileSize(attachment.file_size)}
                                              </div>
                                            </div>
                                            <button
                                              onClick={() => handleDownload(attachment)}
                                              style={{
                                                padding: '0.375rem',
                                                backgroundColor: 'var(--purple)',
                                                border: 'none',
                                                borderRadius: '0.25rem',
                                                color: '#FFFFFF',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                transition: 'all 0.2s'
                                              }}
                                            >
                                              <Download size={14} />
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    ) : (
                                      <div style={{
                                        backgroundColor: '#1E1E22',
                                        padding: '0.5rem 0.75rem',
                                        borderRadius: '0.5rem 0.5rem 0.5rem 0.125rem',
                                        color: 'var(--text-primary)',
                                        fontSize: '0.875rem',
                                        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.3)'
                                      }}>
                                        <div style={{
                                          fontSize: '0.8125rem',
                                          fontWeight: '600',
                                          marginBottom: '0.25rem',
                                          color: 'var(--purple)'
                                        }}>
                                          {item.label}
                                        </div>
                                        <div style={{
                                          fontSize: '0.875rem',
                                          color: 'var(--text-secondary)',
                                          whiteSpace: 'pre-wrap',
                                          wordBreak: 'break-word'
                                        }}>
                                          {item.value}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </>
                      );
                    })()
                  ) : (
                    // Mensagem normal (não é formulário)
                    <div style={{
                      display: 'flex',
                      justifyContent: 'flex-start',
                      marginBottom: 'var(--spacing-sm)'
                    }}>
                      <div style={{
                        maxWidth: '75%',
                        display: 'flex',
                        gap: 'var(--spacing-xs)',
                        alignItems: 'flex-end'
                      }}>
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--purple)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          marginBottom: '2px'
                        }}>
                          <User size={16} color="#FFFFFF" />
                        </div>
                        <div>
                          <div style={{
                            backgroundColor: '#1E1E22',
                            padding: '0.5rem 0.75rem',
                            borderRadius: '0.5rem 0.5rem 0.5rem 0.125rem',
                            color: 'var(--text-primary)',
                            fontSize: '0.875rem',
                            lineHeight: '1.4',
                            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.3)',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word'
                          }}>
                            {selectedTicket.description}
                          </div>
                          <div style={{
                            fontSize: '0.6875rem',
                            color: 'var(--text-tertiary)',
                            paddingLeft: '0.5rem',
                            marginTop: '0.25rem'
                          }}>
                            {formatDate(selectedTicket.created_at)}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Mensagens do Chat - Estilo WhatsApp */}
                  {ticketMessages.map((message) => {
                    const isOwnMessage = false; // Sempre à esquerda no modal de visualização
                    
                    return (
                      <div key={message.id} style={{
                        display: 'flex',
                        justifyContent: 'flex-start',
                              marginBottom: 'var(--spacing-xs)'
                            }}>
                        <div style={{
                          maxWidth: '75%',
                          display: 'flex',
                          gap: 'var(--spacing-xs)',
                          alignItems: 'flex-end',
                          flexDirection: 'row'
                        }}>
                          {!isOwnMessage && (
                            <div style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              backgroundColor: 'var(--purple)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              marginBottom: '2px'
                            }}>
                              <User size={16} color="#FFFFFF" />
                            </div>
                          )}
                          <div style={{ flex: 1 }}>
                            <div style={{
                              backgroundColor: '#1E1E22',
                              padding: '0.5rem 0.75rem',
                              borderRadius: '0.5rem 0.5rem 0.5rem 0.125rem',
                              color: 'var(--text-primary)',
                              fontSize: '0.875rem',
                              lineHeight: '1.4',
                              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.3)',
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                              position: 'relative',
                              overflow: 'hidden'
                            }}>
                              {/* Preview de imagens anexadas */}
                              {message.attachments && message.attachments.length > 0 && (
                                <div style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '0.25rem',
                                  marginBottom: message.message ? '0.5rem' : '0'
                                }}>
                                  {message.attachments.map((attachment) => (
                                    <div key={attachment.id}>
                                      <div style={{
                                        padding: '0.5rem 0.75rem',
                                        backgroundColor: '#1E1E22',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        borderRadius: '0.375rem'
                                      }}>
                                        <FileText size={16} color="var(--purple)" />
                                        <div style={{ flex: 1 }}>
                                          <div style={{
                                            fontSize: '0.8125rem',
                                            fontWeight: '500',
                                            color: 'var(--text-primary)',
                                            marginBottom: '0.25rem'
                                          }}>
                                            {attachment.file_name}
                                          </div>
                                          <div style={{
                                            fontSize: '0.75rem',
                                            opacity: 0.8,
                                            color: 'var(--text-tertiary)'
                                          }}>
                                            {formatFileSize(attachment.file_size)}
                                          </div>
                                        </div>
                                        <button
                                          onClick={() => handleDownloadMessageAttachment(attachment)}
                                          style={{
                                            padding: '0.375rem',
                                            backgroundColor: 'rgba(255, 255, 255, 0.2)',
                                            border: 'none',
                                            borderRadius: '0.25rem',
                                            color: '#FFFFFF',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            transition: 'all 0.2s',
                                            flexShrink: 0
                                          }}
                                        >
                                          <Download size={14} />
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                              
                              {/* Texto da mensagem */}
                              {message.message && (
                                <div style={{
                                  padding: message.attachments && message.attachments.length > 0 ? '0.5rem 0.75rem' : '0',
                                  paddingTop: message.attachments && message.attachments.length > 0 ? '0.5rem' : '0'
                                }}>
                                  {message.message}
                              {message.updated_at !== message.created_at && (
                                    <span style={{
                                      fontSize: '0.6875rem',
                                      opacity: 0.7,
                                      marginLeft: '0.5rem',
                                      fontStyle: 'italic'
                                    }}>
                                  (editado)
                                </span>
                                  )}
                                </div>
                              )}
                            </div>
                            <div style={{
                              fontSize: '0.6875rem',
                              color: 'var(--text-tertiary)',
                              paddingLeft: '0.5rem',
                              marginTop: '0.25rem',
                              textAlign: 'left'
                            }}>
                              <strong>{message.user_name}</strong> • {formatDate(message.created_at)}
                            </div>
                          </div>
                      </div>
                    </div>
                    );
                  })}

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
