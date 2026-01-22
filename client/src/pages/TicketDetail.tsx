import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { 
  ArrowLeft, 
  Send, 
  User, 
  Edit2, 
  Trash2,
  FileText,
  Settings
} from 'lucide-react';

interface Ticket {
  id: number;
  ticket_number: number | null;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed' | 'pending_approval' | 'scheduled';
  priority: string;
  category_name: string;
  user_name: string;
  user_email: string;
  assigned_name: string | null;
  form_name: string | null;
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

export default function TicketDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [agents, setAgents] = useState<Array<{ id: number; name: string; email: string }>>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [updating, setUpdating] = useState(false);

  // Determinar para onde voltar baseado no status do ticket
  const getBackPath = (): string => {
    if (ticket && ticket.status === 'pending_approval') {
      return '/acompanhar/aprovar';
    }
    return '/tickets';
  };

  useEffect(() => {
    if (id) {
      fetchTicket();
      fetchMessages();
      if (user?.role === 'admin' || user?.role === 'agent') {
        fetchAgents();
      }
    }
  }, [id, user]);

  useEffect(() => {
    // Auto-scroll para a última mensagem
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchTicket = async () => {
    try {
      const response = await axios.get(`/api/tickets/${id}`);
      setTicket(response.data);
    } catch (err: any) {
      console.error('Erro ao buscar ticket:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async () => {
    try {
      const response = await axios.get(`/api/ticket-messages/ticket/${id}`);
      setMessages(response.data);
    } catch (err: any) {
      console.error('Erro ao buscar mensagens:', err);
    }
  };

  const fetchAgents = async () => {
    try {
      const response = await axios.get('/api/users/agents');
      setAgents(response.data);
    } catch (err: any) {
      console.error('Erro ao buscar agentes:', err);
      // Fallback: tentar buscar todos os usuários e filtrar
      try {
        const allUsers = await axios.get('/api/users');
        const agentsList = allUsers.data.filter((u: any) => 
          u.role === 'agent' || u.role === 'admin'
        );
        setAgents(agentsList);
      } catch (fallbackErr) {
        console.error('Erro ao buscar usuários como fallback:', fallbackErr);
      }
    }
  };

  const handleUpdateTicket = async (field: string, value: any) => {
    setUpdating(true);
    try {
      const response = await axios.put(`/api/tickets/${id}`, {
        [field]: value
      });
      setTicket(response.data);
      // Adicionar mensagem automática sobre a mudança
      const statusLabels: Record<string, string> = {
        open: 'Aberto',
        in_progress: 'Em Progresso',
        resolved: 'Resolvido',
        closed: 'Fechado',
        scheduled: 'Agendado',
        pending_approval: 'Pendente Aprovação'
      };
      const priorityLabels: Record<string, string> = {
        low: 'Baixa',
        medium: 'Média',
        high: 'Alta',
        urgent: 'Urgente'
      };
      
      let messageText = '';
      if (field === 'status') {
        messageText = `Status alterado para: ${statusLabels[value] || value}`;
      } else if (field === 'priority') {
        messageText = `Prioridade alterada para: ${priorityLabels[value] || value}`;
      } else if (field === 'assigned_to') {
        const assignedAgent = agents.find(a => a.id === value);
        messageText = value 
          ? `Ticket atribuído a: ${assignedAgent?.name || 'Usuário'}`
          : 'Atribuição removida';
      }
      
      if (messageText) {
        await axios.post(`/api/ticket-messages/ticket/${id}`, {
          message: messageText
        });
        await fetchMessages();
      }
    } catch (err: any) {
      console.error('Erro ao atualizar ticket:', err);
      alert(err.response?.data?.error || 'Erro ao atualizar ticket');
    } finally {
      setUpdating(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      const response = await axios.post(`/api/ticket-messages/ticket/${id}`, {
        message: newMessage
      });
      setMessages([...messages, response.data]);
      setNewMessage('');
      await fetchTicket(); // Atualizar timestamp do ticket
    } catch (err: any) {
      console.error('Erro ao enviar mensagem:', err);
      alert(err.response?.data?.error || 'Erro ao enviar mensagem');
    } finally {
      setSending(false);
    }
  };

  const handleEditMessage = async (messageId: number) => {
    if (!editText.trim()) return;

    try {
      const response = await axios.put(`/api/ticket-messages/${messageId}`, {
        message: editText
      });
      setMessages(messages.map(msg => msg.id === messageId ? response.data : msg));
      setEditingMessageId(null);
      setEditText('');
    } catch (err: any) {
      console.error('Erro ao editar mensagem:', err);
      alert(err.response?.data?.error || 'Erro ao editar mensagem');
    }
  };

  const handleDeleteMessage = async (messageId: number) => {
    if (!window.confirm('Tem certeza que deseja excluir esta mensagem?')) return;

    try {
      await axios.delete(`/api/ticket-messages/${messageId}`);
      setMessages(messages.filter(msg => msg.id !== messageId));
    } catch (err: any) {
      console.error('Erro ao excluir mensagem:', err);
      alert(err.response?.data?.error || 'Erro ao excluir mensagem');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Agora';
    if (diffMins < 60) return `${diffMins} min atrás`;
    if (diffHours < 24) return `${diffHours}h atrás`;
    if (diffDays === 1) return 'Ontem';
    if (diffDays < 7) return `${diffDays} dias atrás`;
    return date.toLocaleDateString('pt-BR', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const canEditMessage = (message: TicketMessage) => {
    return message.user_id === user?.id || user?.role === 'admin' || user?.role === 'agent';
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
          <p>Carregando ticket...</p>
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div style={{ padding: 'var(--spacing-xl)', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--spacing-lg)' }}>
          Ticket não encontrado
        </p>
        <button className="btn btn-secondary" onClick={() => navigate('/tickets')}>
          <ArrowLeft size={18} />
          Voltar
        </button>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100vh - 80px)',
      backgroundColor: 'var(--bg-primary)'
    }}>
      {/* Header */}
      <div style={{
        padding: 'var(--spacing-lg) var(--spacing-xl)',
        borderBottom: '1px solid var(--border-primary)',
        backgroundColor: 'var(--bg-secondary)',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--spacing-md)' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-xs)' }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => navigate(getBackPath())}
                style={{ padding: 'var(--spacing-xs) var(--spacing-sm)' }}
              >
                <ArrowLeft size={18} />
              </button>
              <h1 style={{
                fontSize: '1.5rem',
                fontWeight: '700',
                color: 'var(--text-primary)',
                margin: 0
              }}>
                {ticket.title}
              </h1>
            </div>
            <div style={{
              display: 'flex',
              gap: 'var(--spacing-md)',
              fontSize: '0.8125rem',
              color: 'var(--text-secondary)',
              marginLeft: '2.5rem',
              flexWrap: 'wrap',
              alignItems: 'center'
            }}>
              <span><strong>ID:</strong> {formatTicketId(ticket)}</span>
              <span><strong>Criado por:</strong> {ticket.user_name}</span>
              {ticket.assigned_name && <span><strong>Atribuído a:</strong> {ticket.assigned_name}</span>}
              {ticket.form_name && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <FileText size={12} />
                  <strong>Formulário:</strong> {ticket.form_name}
                </span>
              )}
            </div>
          </div>
          {/* Mostrar botão de configurações apenas se o ticket NÃO estiver pendente de aprovação */}
          {(user?.role === 'admin' || user?.role === 'agent') && ticket.status !== 'pending_approval' && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setShowSettings(!showSettings)}
              style={{ padding: 'var(--spacing-xs) var(--spacing-sm)' }}
            >
              <Settings size={18} />
            </button>
          )}
        </div>

        {/* Painel de Configurações - Não mostrar se ticket estiver pendente de aprovação */}
        {showSettings && (user?.role === 'admin' || user?.role === 'agent') && ticket.status !== 'pending_approval' && (
          <div style={{
            marginTop: 'var(--spacing-md)',
            padding: 'var(--spacing-md)',
            backgroundColor: 'var(--bg-tertiary)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-primary)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 'var(--spacing-md)'
          }}>
            <div>
              <label style={{
                display: 'block',
                marginBottom: 'var(--spacing-xs)',
                fontSize: '0.875rem',
                fontWeight: '500',
                color: 'var(--text-secondary)'
              }}>
                Status
              </label>
              <select
                className="select"
                value={ticket.status}
                onChange={(e) => handleUpdateTicket('status', e.target.value)}
                disabled={updating}
                style={{ width: '100%' }}
              >
                <option value="open">Aberto</option>
                <option value="in_progress">Em Progresso</option>
                <option value="scheduled">Agendado</option>
                <option value="resolved">Resolvido</option>
                <option value="closed">Fechado</option>
                <option value="pending_approval">Pendente Aprovação</option>
              </select>
            </div>

            <div>
              <label style={{
                display: 'block',
                marginBottom: 'var(--spacing-xs)',
                fontSize: '0.875rem',
                fontWeight: '500',
                color: 'var(--text-secondary)'
              }}>
                Prioridade
              </label>
              <select
                className="select"
                value={ticket.priority}
                onChange={(e) => handleUpdateTicket('priority', e.target.value)}
                disabled={updating}
                style={{ width: '100%' }}
              >
                <option value="low">Baixa</option>
                <option value="medium">Média</option>
                <option value="high">Alta</option>
                <option value="urgent">Urgente</option>
              </select>
            </div>

            <div>
              <label style={{
                display: 'block',
                marginBottom: 'var(--spacing-xs)',
                fontSize: '0.875rem',
                fontWeight: '500',
                color: 'var(--text-secondary)'
              }}>
                Atribuir a
              </label>
              <select
                className="select"
                value={agents.find(a => a.name === ticket.assigned_name)?.id || ''}
                onChange={(e) => handleUpdateTicket('assigned_to', e.target.value ? parseInt(e.target.value) : null)}
                disabled={updating}
                style={{ width: '100%' }}
              >
                <option value="">Não atribuído</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Chat Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: 'var(--spacing-lg)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--spacing-md)'
      }}>
        {/* Mensagem inicial (descrição do ticket) */}
        <div style={{
          display: 'flex',
          gap: 'var(--spacing-md)',
          marginBottom: 'var(--spacing-sm)'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            backgroundColor: 'var(--purple-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <User size={20} color="var(--purple)" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-sm)',
              marginBottom: 'var(--spacing-xs)'
            }}>
              <strong style={{ color: 'var(--text-primary)' }}>{ticket.user_name}</strong>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                {formatDate(ticket.created_at)}
              </span>
            </div>
            <div style={{
              backgroundColor: 'var(--bg-secondary)',
              padding: 'var(--spacing-md)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-primary)',
              whiteSpace: 'pre-wrap',
              lineHeight: '1.6',
              color: 'var(--text-primary)'
            }}>
              {ticket.description}
            </div>
          </div>
        </div>

        {/* Mensagens do chat */}
        {messages.map((message) => (
          <div key={message.id} style={{
            display: 'flex',
            gap: 'var(--spacing-md)',
            marginBottom: 'var(--spacing-sm)'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: message.user_id === user?.id ? 'var(--purple-light)' : 'var(--bg-tertiary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <User size={20} color={message.user_id === user?.id ? 'var(--purple)' : 'var(--text-secondary)'} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-sm)',
                marginBottom: 'var(--spacing-xs)',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>{message.user_name}</strong>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                    {formatDate(message.created_at)}
                  </span>
                  {message.updated_at !== message.created_at && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                      (editado)
                    </span>
                  )}
                </div>
                {canEditMessage(message) && !editingMessageId && (
                  <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setEditingMessageId(message.id);
                        setEditText(message.message);
                      }}
                      style={{ padding: '0.25rem 0.5rem' }}
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDeleteMessage(message.id)}
                      style={{ padding: '0.25rem 0.5rem' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
              {editingMessageId === message.id ? (
                <div style={{
                  backgroundColor: 'var(--bg-secondary)',
                  padding: 'var(--spacing-md)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-primary)'
                }}>
                  <textarea
                    className="textarea"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={3}
                    style={{ marginBottom: 'var(--spacing-sm)' }}
                  />
                  <div style={{ display: 'flex', gap: 'var(--spacing-sm)', justifyContent: 'flex-end' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setEditingMessageId(null);
                        setEditText('');
                      }}
                    >
                      Cancelar
                    </button>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleEditMessage(message.id)}
                    >
                      Salvar
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{
                  backgroundColor: message.user_id === user?.id ? 'var(--purple-light)' : 'var(--bg-secondary)',
                  padding: 'var(--spacing-md)',
                  borderRadius: 'var(--radius-md)',
                  border: `1px solid ${message.user_id === user?.id ? 'var(--purple)' : 'var(--border-primary)'}`,
                  whiteSpace: 'pre-wrap',
                  lineHeight: '1.6',
                  color: 'var(--text-primary)'
                }}>
                  {message.message}
                </div>
              )}
            </div>
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Input de mensagem */}
      <div style={{
        padding: 'var(--spacing-lg)',
        borderTop: '1px solid var(--border-primary)',
        backgroundColor: 'var(--bg-secondary)',
        flexShrink: 0
      }}>
        <div style={{
          display: 'flex',
          gap: 'var(--spacing-sm)',
          alignItems: 'flex-end'
        }}>
          <textarea
            className="input"
            placeholder="Digite sua mensagem..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            rows={3}
            style={{
              flex: 1,
              resize: 'none',
              fontFamily: 'inherit'
            }}
          />
          <button
            className="btn btn-primary"
            onClick={handleSendMessage}
            disabled={!newMessage.trim() || sending}
            style={{
              padding: 'var(--spacing-md)',
              height: 'fit-content'
            }}
          >
            <Send size={20} />
          </button>
        </div>
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
