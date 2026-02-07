import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions, RESOURCES, ACTIONS } from '../hooks/usePermissions';
import { formatDateChat, formatTicketTitle } from '../utils/dateUtils';
import { 
  ArrowLeft, 
  Send, 
  User, 
  Edit2, 
  Trash2,
  FileText,
  Settings,
  Download,
  Paperclip,
  X,
  Calendar,
  Clock,
  Pause,
  Play
} from 'lucide-react';

interface Ticket {
  id: number;
  ticket_number: number | null;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed' | 'pending_approval' | 'scheduled' | 'rejected';
  priority: string;
  category_name: string;
  user_name: string;
  user_email: string;
  assigned_name: string | null;
  form_name: string | null;
  form_submission_id: number | null;
  scheduled_at: string | null;
  created_at: string;
  updated_at: string;
  is_paused?: boolean;
  paused_at?: string | null;
}

interface FormAttachment {
  id: number;
  field_id: number;
  field_label: string;
  field_type: string;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
}

// Função para gerar ID completo do ticket (sem barras) - usado em URLs
// eslint-disable-next-line @typescript-eslint/no-unused-vars
// function getTicketFullId(ticket: Ticket): string {
//   if (!ticket.ticket_number || !ticket.created_at) {
//     return ticket.id.toString();
//   }
//   
//   const date = new Date(ticket.created_at);
//   const year = date.getFullYear();
//   const month = String(date.getMonth() + 1).padStart(2, '0');
//   const day = String(date.getDate()).padStart(2, '0');
//   const number = String(ticket.ticket_number).padStart(3, '0');
//   
//   return `${year}${month}${day}${number}`;
// }

// Função para formatar ID do ticket para exibição (com barras)
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

interface TicketDetailProps {
  /** Quando informado, usa este ID em vez da rota (modo modal) */
  ticketId?: string;
  /** Callback para fechar o modal; quando definido, o botão Voltar fecha em vez de navegar */
  onClose?: () => void;
}

export default function TicketDetail({ ticketId: ticketIdProp, onClose }: TicketDetailProps = {}) {
  const { id: idFromRoute } = useParams<{ id: string }>();
  const id = ticketIdProp ?? idFromRoute ?? undefined;
  const navigate = useNavigate();
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const canEditTicket = hasPermission(RESOURCES.TICKETS, ACTIONS.EDIT);
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
  const [attachments, setAttachments] = useState<FormAttachment[]>([]);
  const [messageFiles, setMessageFiles] = useState<File[]>([]);
  const [messagePreviewUrls, setMessagePreviewUrls] = useState<string[]>([]);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [scheduling, setScheduling] = useState(false);
  const [pausingResume, setPausingResume] = useState(false);
  const [showRawWebhookJson, setShowRawWebhookJson] = useState(false);

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
      if (canEditTicket) fetchAgents();
    } else {
      setLoading(false);
    }
  }, [id, canEditTicket]);

  // Buscar mensagens após o ticket ser carregado
  useEffect(() => {
    if (ticket?.id) {
      fetchMessages();
    }
  }, [ticket?.id]);

  useEffect(() => {
    if (ticket?.form_submission_id) {
      fetchAttachments();
    }
  }, [ticket?.form_submission_id]);

  useEffect(() => {
    // Auto-scroll para a última mensagem
    scrollToBottom();
  }, [messages]);

  // Limpar previews ao desmontar
  useEffect(() => {
    return () => {
      if (messagePreviewUrls && messagePreviewUrls.length > 0) {
        messagePreviewUrls.forEach(url => {
          try {
            URL.revokeObjectURL(url);
          } catch (error) {
            // Ignorar erros ao revogar URLs
          }
        });
      }
    };
  }, [messagePreviewUrls]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchTicket = async () => {
    try {
      const response = await axios.get(`/api/tickets/${id}`);
      console.log('[TicketDetail] Ticket carregado:', response.data);
      setTicket(response.data);
    } catch (err: any) {
      console.error('Erro ao buscar ticket:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async () => {
    if (!ticket) return; // Aguardar ticket ser carregado primeiro
    
    try {
      // Usar o ID numérico do ticket, não o ID completo
      const response = await axios.get(`/api/ticket-messages/ticket/${ticket.id}`);
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

  const fetchAttachments = async () => {
    if (!ticket?.form_submission_id) {
      console.log('[TicketDetail] Ticket sem form_submission_id:', ticket);
      return;
    }
    try {
      console.log('[TicketDetail] Buscando anexos para form_submission_id:', ticket.form_submission_id);
      const response = await axios.get(`/api/tickets/${id}/attachments`);
      console.log('[TicketDetail] Anexos encontrados:', response.data);
      setAttachments(response.data);
    } catch (err: any) {
      console.error('Erro ao buscar anexos:', err);
    }
  };

  // Função para parsear descrição markdown e extrair dados do formulário (suporta valores multilinha)
  const parseFormDescription = (description: string) => {
    const lines = description.split('\n');
    const formData: Array<{ label: string; value: string }> = [];
    const attachmentsList: string[] = [];
    let inAttachmentsSection = false;
    let currentLabel: string | null = null;
    let currentValueLines: string[] = [];

    const flushCurrentField = () => {
      if (currentLabel !== null) {
        let value = currentValueLines.join('\n').trim();
        if (value.startsWith('[Arquivo]')) {
          value = value.replace('[Arquivo]', '').trim();
        }
        formData.push({ label: currentLabel, value });
        currentLabel = null;
        currentValueLines = [];
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      
      if (trimmedLine.includes('**Arquivos anexados:**') || trimmedLine.includes('**Arquivos anexados::**')) {
        flushCurrentField();
        inAttachmentsSection = true;
        continue;
      }
      
      if (inAttachmentsSection) {
        if (trimmedLine.startsWith('- ')) {
          attachmentsList.push(trimmedLine.substring(2));
        }
        continue;
      }

      // Parsear linhas no formato **Label:** value ou **Label::** value
      const match = line.match(/\*\*(.+?):+?\*\*\s*(.*)/);
      if (match) {
        flushCurrentField();
        const label = match[1].trim();
        const valueStart = match[2]; // Pode ser vazio para valor que começa na próxima linha
        currentLabel = label;
        currentValueLines = valueStart ? [valueStart] : [];
      } else if (currentLabel !== null) {
        // Linha de continuação do valor anterior (preserva linhas em branco)
        currentValueLines.push(line);
      }
    }
    flushCurrentField();

    return { formData, attachmentsList };
  };

  // Verificar se um arquivo é uma imagem
  const isImage = (mimeType: string): boolean => {
    return mimeType?.startsWith('image/') || false;
  };

  // Tentar interpretar descrição como JSON (payload de webhook)
  const tryParseWebhookDescription = (description: string): object | null => {
    if (!description || typeof description !== 'string') return null;
    const trimmed = description.trim();
    if ((!trimmed.startsWith('{') && !trimmed.startsWith('[')) || trimmed.length < 2) return null;
    try {
      const parsed = JSON.parse(description);
      return typeof parsed === 'object' && parsed !== null ? parsed : null;
    } catch {
      return null;
    }
  };

  // Humanizar nome de chave para exibição (snake_case -> "Snake case")
  const humanizeKey = (key: string): string => {
    return key
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (s) => s.toUpperCase())
      .trim();
  };

  // Renderizar valor do payload (objeto/array vira bloco recuado)
  const renderWebhookValue = (value: unknown, keyLabel: string): React.ReactNode => {
    if (value === null || value === undefined) {
      return <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>—</span>;
    }
    if (typeof value === 'boolean') {
      return value ? 'Sim' : 'Não';
    }
    if (typeof value === 'number' || typeof value === 'string') {
      const str = String(value);
      if (str.length > 500) {
        return (
          <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {str.substring(0, 500)}
            <span style={{ color: 'var(--text-tertiary)' }}> … (+{str.length - 500} caracteres)</span>
          </span>
        );
      }
      return <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{str}</span>;
    }
    if (Array.isArray(value)) {
      return (
        <div style={{
          marginTop: '0.25rem',
          paddingLeft: '0.75rem',
          borderLeft: '2px solid var(--purple)',
          fontSize: '0.8125rem'
        }}>
          {value.length === 0 && <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>Lista vazia</span>}
          {value.map((item, i) => (
            <div key={i} style={{ marginBottom: '0.5rem' }}>
              {typeof item === 'object' && item !== null ? (
                renderWebhookValue(item, `${keyLabel}[${i}]`)
              ) : (
                <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{String(item)}</span>
              )}
            </div>
          ))}
        </div>
      );
    }
    if (typeof value === 'object') {
      return (
        <div style={{
          marginTop: '0.25rem',
          padding: '0.5rem 0.75rem',
          backgroundColor: 'var(--bg-tertiary)',
          borderRadius: '0.375rem',
          fontSize: '0.8125rem'
        }}>
          {Object.entries(value as Record<string, unknown>).map(([k, v]) => (
            <div key={k} style={{ marginBottom: '0.5rem' }}>
              <div style={{ fontWeight: '600', color: 'var(--purple)', marginBottom: '0.125rem' }}>
                {humanizeKey(k)}
              </div>
              <div style={{ color: 'var(--text-secondary)' }}>
                {renderWebhookValue(v, k)}
              </div>
            </div>
          ))}
        </div>
      );
    }
    return String(value);
  };

  // Formatar tamanho do arquivo
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  // Normalizar caminho do arquivo para garantir que comece com /uploads/
  const normalizeFilePath = (filePath: string): string => {
    if (filePath.startsWith('/uploads/') || filePath.startsWith('http://') || filePath.startsWith('https://')) {
      return filePath;
    }
    if (filePath.startsWith('/')) {
      return filePath;
    }
    if (filePath.startsWith('uploads/')) {
      return `/${filePath}`;
    }
    return `/uploads/${filePath}`;
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

  const handleScheduleTicket = async () => {
    if (!scheduleDate || !scheduleTime) {
      alert('Por favor, preencha data e horário');
      return;
    }

    setScheduling(true);
    try {
      // Combinar data e horário em formato ISO
      const scheduledDateTime = `${scheduleDate}T${scheduleTime}:00`;
      
      const response = await axios.post(`/api/tickets/${id}/schedule`, {
        scheduled_at: scheduledDateTime
      });
      
      setTicket(response.data);
      setShowScheduleModal(false);
      setScheduleDate('');
      setScheduleTime('');
      
      // Adicionar mensagem automática
      const scheduleDateFormatted = new Date(scheduledDateTime).toLocaleString('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short'
      });
      
      await axios.post(`/api/ticket-messages/ticket/${id}`, {
        message: `Ticket agendado para: ${scheduleDateFormatted}`
      });
      await fetchMessages();
    } catch (err: any) {
      console.error('Erro ao agendar ticket:', err);
      alert(err.response?.data?.error || 'Erro ao agendar ticket');
    } finally {
      setScheduling(false);
    }
  };

  const handleUnscheduleTicket = async () => {
    if (!confirm('Deseja realmente cancelar o agendamento deste ticket?')) {
      return;
    }

    setScheduling(true);
    try {
      const response = await axios.post(`/api/tickets/${id}/unschedule`);
      setTicket(response.data);
      
      // Adicionar mensagem automática
      await axios.post(`/api/ticket-messages/ticket/${id}`, {
        message: 'Agendamento cancelado'
      });
      await fetchMessages();
    } catch (err: any) {
      console.error('Erro ao cancelar agendamento:', err);
      alert(err.response?.data?.error || 'Erro ao cancelar agendamento');
    } finally {
      setScheduling(false);
    }
  };

  const handlePause = async () => {
    if (pausingResume || !ticket) return;
    setPausingResume(true);
    try {
      await axios.post(`/api/tickets/${id}/pause`);
      await fetchTicket();
    } catch (err: any) {
      console.error('Erro ao pausar ticket:', err);
      alert(err.response?.data?.error || 'Erro ao pausar ticket');
    } finally {
      setPausingResume(false);
    }
  };

  const handleResume = async () => {
    if (pausingResume || !ticket) return;
    setPausingResume(true);
    try {
      await axios.post(`/api/tickets/${id}/resume`);
      await fetchTicket();
    } catch (err: any) {
      console.error('Erro ao retomar ticket:', err);
      alert(err.response?.data?.error || 'Erro ao retomar ticket');
    } finally {
      setPausingResume(false);
    }
  };

  const handleSendMessage = async () => {
    if ((!newMessage.trim() && messageFiles.length === 0) || sending || !ticket) return;

    setSending(true);
    try {
      const formData = new FormData();
      formData.append('message', newMessage || '');
      
      // Adicionar arquivos
      messageFiles.forEach((file) => {
        formData.append('attachments', file);
      });

      // Usar o ID numérico do ticket, não o ID completo
      const response = await axios.post(`/api/ticket-messages/ticket/${ticket.id}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      setMessages([...messages, response.data]);
      setNewMessage('');
      setMessageFiles([]);
      setMessagePreviewUrls([]);
      await fetchTicket(); // Atualizar timestamp do ticket
    } catch (err: any) {
      console.error('Erro ao enviar mensagem:', err);
      alert(err.response?.data?.error || 'Erro ao enviar mensagem');
    } finally {
      setSending(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const imageFiles: File[] = [];
    const previewUrls: string[] = [];

    files.forEach((file) => {
      if (file.type.startsWith('image/')) {
        imageFiles.push(file);
        // Criar preview URL
        const url = URL.createObjectURL(file);
        previewUrls.push(url);
      } else {
        imageFiles.push(file);
      }
    });

    setMessageFiles([...messageFiles, ...imageFiles]);
    setMessagePreviewUrls([...messagePreviewUrls, ...previewUrls]);
  };

  const removeFile = (index: number) => {
    const newFiles = [...messageFiles];
    const newPreviews = [...messagePreviewUrls];
    
    // Revogar URL do preview se for imagem
    if (newPreviews[index]) {
      URL.revokeObjectURL(newPreviews[index]);
    }
    
    newFiles.splice(index, 1);
    newPreviews.splice(index, 1);
    
    setMessageFiles(newFiles);
    setMessagePreviewUrls(newPreviews);
  };

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

  const formatDate = formatDateChat;

  const canEditMessage = (_message: TicketMessage) => {
    return canEditTicket;
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

  if (!id) {
    return null;
  }

  if (!ticket) {
    return (
      <div style={{ padding: 'var(--spacing-xl)', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--spacing-lg)' }}>
          Ticket não encontrado
        </p>
        <button className="btn btn-secondary" onClick={() => (onClose ? onClose() : navigate('/tickets'))}>
          <ArrowLeft size={18} />
          Voltar
        </button>
      </div>
    );
  }

  const STATUS_LABELS: Record<string, string> = {
    open: 'Aberto',
    in_progress: 'Em Progresso',
    resolved: 'Resolvido',
    closed: 'Fechado',
    scheduled: 'Agendado',
    pending_approval: 'Pendente Aprovação',
    rejected: 'Rejeitado'
  };
  const PRIORITY_LABELS: Record<string, string> = {
    low: 'Baixa',
    medium: 'Média',
    high: 'Alta',
    urgent: 'Urgente'
  };

  return (
    <div className="ticket-detail">
      {/* Header */}
      <header className="ticket-detail__header">
        <div className="ticket-detail__header-top">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="ticket-detail__title-row">
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => (onClose ? onClose() : navigate(getBackPath()))}
                style={{ padding: 'var(--spacing-xs) var(--spacing-sm)', flexShrink: 0 }}
              >
                <ArrowLeft size={18} />
              </button>
              <h1 className="ticket-detail__title">{formatTicketTitle(ticket.title)}</h1>
            </div>
            <div className="ticket-detail__info">
              <div className="ticket-detail__info-item">
                <span className="ticket-detail__info-label">ID</span>
                <span className="ticket-detail__info-value">{formatTicketId(ticket)}</span>
              </div>
              <div className="ticket-detail__info-item">
                <span className="ticket-detail__info-label">Status</span>
                <span className={`ticket-detail__badge ticket-detail__badge--status-${ticket.status}`}>
                  {STATUS_LABELS[ticket.status] || ticket.status}
                </span>
              </div>
              <div className="ticket-detail__info-item">
                <span className="ticket-detail__info-label">Prioridade</span>
                <span className={`ticket-detail__badge ticket-detail__badge--priority-${ticket.priority}`}>
                  {PRIORITY_LABELS[ticket.priority] || ticket.priority}
                </span>
              </div>
              {ticket.category_name && (
                <div className="ticket-detail__info-item">
                  <span className="ticket-detail__info-label">Categoria</span>
                  <span className="ticket-detail__info-value">{ticket.category_name}</span>
                </div>
              )}
              <div className="ticket-detail__info-item">
                <span className="ticket-detail__info-label">Atribuído a</span>
                <span className="ticket-detail__info-value">{ticket.assigned_name || '—'}</span>
              </div>
              <div className="ticket-detail__info-item">
                <span className="ticket-detail__info-label">Formulário</span>
                <span className="ticket-detail__info-value">{ticket.form_name || '—'}</span>
              </div>
              <div className="ticket-detail__info-item">
                <span className="ticket-detail__info-label">Criado em</span>
                <span className="ticket-detail__info-value">{formatDate(ticket.created_at)}</span>
              </div>
              <div className="ticket-detail__info-item">
                <span className="ticket-detail__info-label">Atualizado em</span>
                <span className="ticket-detail__info-value">{formatDate(ticket.updated_at)}</span>
              </div>
              {ticket.scheduled_at && (
                <div className="ticket-detail__info-item">
                  <span className="ticket-detail__info-label">Agendado para</span>
                  <span className="ticket-detail__info-value">
                    {new Date(ticket.scheduled_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                </div>
              )}
              {ticket.status === 'in_progress' && ticket.is_paused && (
                <div className="ticket-detail__info-item">
                  <span className="ticket-detail__info-label">Tempo</span>
                  <span className="ticket-detail__badge ticket-detail__badge--paused">
                    <Pause size={12} />
                    Em pausa
                  </span>
                </div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', flexShrink: 0 }}>
            {canEditTicket && ticket.status === 'in_progress' && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={ticket.is_paused ? handleResume : handlePause}
                disabled={pausingResume}
                style={{ padding: 'var(--spacing-xs) var(--spacing-sm)' }}
                title={ticket.is_paused ? 'Retomar (tempo volta a contar)' : 'Pausar (tempo não conta no tempo médio)'}
              >
                {ticket.is_paused ? <Play size={18} /> : <Pause size={18} />}
                {pausingResume ? '…' : (ticket.is_paused ? ' Retomar' : ' Pausar')}
              </button>
            )}
            {canEditTicket && ticket.status !== 'pending_approval' && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowSettings(!showSettings)}
                style={{ padding: 'var(--spacing-xs) var(--spacing-sm)' }}
              >
                <Settings size={18} />
              </button>
            )}
            {onClose && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={onClose}
                style={{ padding: 'var(--spacing-xs) var(--spacing-sm)' }}
                title="Fechar"
              >
                <X size={18} />
              </button>
            )}
          </div>
        </div>

        {/* Painel de Configurações */}
        {showSettings && canEditTicket && ticket.status !== 'pending_approval' && (
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
              <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
              <select
                className="select"
                value={agents.find(a => a.name === ticket.assigned_name)?.id || ''}
                onChange={(e) => handleUpdateTicket('assigned_to', e.target.value ? parseInt(e.target.value) : null)}
                disabled={updating}
                  style={{ flex: 1 }}
              >
                <option value="">Não atribuído</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                  </option>
                ))}
              </select>
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowScheduleModal(true)}
                  disabled={updating || scheduling}
                  style={{
                    padding: 'var(--spacing-xs) var(--spacing-sm)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--spacing-xs)',
                    whiteSpace: 'nowrap'
                  }}
                  title={ticket.scheduled_at ? 'Editar agendamento' : 'Agendar ticket'}
                >
                  <Calendar size={16} />
                  {ticket.scheduled_at ? 'Agendado' : 'Agendar'}
                </button>
              </div>
              {ticket.scheduled_at && (
                <div style={{
                  marginTop: 'var(--spacing-xs)',
                  fontSize: '0.75rem',
                  color: 'var(--text-tertiary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-xs)'
                }}>
                  <Clock size={12} />
                  Agendado para: {new Date(ticket.scheduled_at).toLocaleString('pt-BR', {
                    dateStyle: 'short',
                    timeStyle: 'short'
                  })}
                  <button
                    onClick={handleUnscheduleTicket}
                    disabled={scheduling}
                    style={{
                      marginLeft: 'auto',
                      padding: '0.125rem 0.375rem',
                      fontSize: '0.75rem',
                      backgroundColor: 'transparent',
                      border: '1px solid var(--border-primary)',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer'
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Área do chat */}
      <div className="ticket-chat">
        {/* Mensagem inicial (descrição do ticket) - Estilo WhatsApp */}
        {ticket.form_name || attachments.length > 0 ? (
          (() => {
            const { formData } = parseFormDescription(ticket.description);
            return (
              <>
                {/* Mensagem de boas-vindas do formulário */}
        <div className="ticket-chat__row">
          <div className="ticket-chat__row-inner">
            <div className="ticket-chat__avatar">
              <User size={18} color="#FFFFFF" />
            </div>
            <div style={{ flex: 1 }}>
              <div className="ticket-chat__bubble ticket-chat__bubble--other">
                        {ticket.form_name && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
                            gap: '0.5rem',
                            marginBottom: '0.5rem',
                            paddingBottom: '0.5rem',
                            borderBottom: '1px solid var(--border-primary)'
                          }}>
                            <FileText size={14} color="var(--purple)" />
                            <strong style={{ fontSize: '0.8125rem', color: 'var(--purple)' }}>
                              {ticket.form_name}
                            </strong>
                          </div>
                        )}
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                  Olá! Recebi sua solicitação. Aqui estão os dados informados:
                </div>
              </div>
              <div className="ticket-chat__time" style={{ paddingLeft: '0.5rem', marginBottom: 'var(--spacing-xs)' }}>
                {formatDate(ticket.created_at)}
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
                              backgroundColor: 'var(--bg-card)',
                              padding: attachment && isImage(attachment.mime_type) ? '0' : '0.5rem 0.75rem',
                              borderRadius: '0.5rem 0.5rem 0.5rem 0.125rem',
                              color: 'var(--text-primary)',
                              fontSize: '0.875rem',
                              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.08)',
                              overflow: 'hidden'
                            }}>
                              {isImage(attachment.mime_type) ? (
                                <div>
                                  <img 
                                    src={`/${attachment.file_path}`}
                                    alt={attachment.file_name}
                                    style={{
                                      width: '100%',
                                      maxHeight: '300px',
                                      objectFit: 'cover',
                                      display: 'block'
                                    }}
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                  />
                                  <div style={{
                                    padding: '0.5rem 0.75rem',
                                    backgroundColor: 'var(--bg-card)'
                                  }}>
                                    <div style={{
                                      fontSize: '0.8125rem',
                                      fontWeight: '600',
                                      marginBottom: '0.25rem',
                                      color: 'var(--text-primary)'
                                    }}>
                                      {item.label}
                                    </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                                      justifyContent: 'space-between',
                                      gap: '0.5rem'
                                    }}>
                                      <span style={{
                                        fontSize: '0.75rem',
                                        color: 'var(--text-tertiary)',
                                        flex: 1
                                      }}>
                                        {attachment.file_name} • {formatFileSize(attachment.file_size)}
                  </span>
                    <button
                                        onClick={() => handleDownload(attachment)}
                                        style={{
                                          padding: '0.25rem 0.5rem',
                                          backgroundColor: 'var(--purple)',
                                          border: 'none',
                                          borderRadius: '0.25rem',
                                          color: '#FFFFFF',
                                          cursor: 'pointer',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '0.25rem',
                                          fontSize: '0.75rem',
                                          transition: 'all 0.2s'
                                        }}
                                        onMouseEnter={(e) => {
                                          e.currentTarget.style.backgroundColor = 'var(--purple-hover)';
                                        }}
                                        onMouseLeave={(e) => {
                                          e.currentTarget.style.backgroundColor = 'var(--purple)';
                                        }}
                                      >
                                        <Download size={12} />
                                        Baixar
                    </button>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div>
                                  <div style={{
                                    fontSize: '0.8125rem',
                                    fontWeight: '600',
                                    marginBottom: '0.5rem',
                                    color: 'var(--text-primary)'
                                  }}>
                                    {item.label}
                                  </div>
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
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.backgroundColor = 'var(--purple-hover)';
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.backgroundColor = 'var(--purple)';
                                      }}
                                    >
                                      <Download size={14} />
                    </button>
                                  </div>
                  </div>
                )}
              </div>
                          ) : (
                            <div style={{
                              backgroundColor: 'var(--bg-card)',
                              padding: '0.5rem 0.75rem',
                              borderRadius: '0.5rem 0.5rem 0.5rem 0.125rem',
                              color: 'var(--text-primary)',
                              fontSize: '0.875rem',
                              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.08)'
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

                {/* Mensagem com TODOS os anexos do formulário */}
              </>
            );
          })()
        ) : (() => {
          const webhookPayload = tryParseWebhookDescription(ticket.description);
          const isWebhookJson = webhookPayload !== null && typeof webhookPayload === 'object';

          return (
            <>
              {/* Mensagem inicial: webhook (JSON formatado) ou texto normal */}
              <div className="ticket-chat__row">
                <div className="ticket-chat__row-inner">
                  <div className="ticket-chat__avatar">
                    <User size={18} color="#FFFFFF" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="ticket-chat__bubble ticket-chat__bubble--other" style={{ padding: '0.75rem 1rem' }}>
                      {isWebhookJson ? (
                        <>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            marginBottom: '0.75rem',
                            paddingBottom: '0.5rem',
                            borderBottom: '1px solid var(--border-primary)'
                          }}>
                            <FileText size={16} color="var(--purple)" />
                            <strong style={{ fontSize: '0.8125rem', color: 'var(--purple)' }}>
                              Dados do webhook
                            </strong>
                            <button
                              type="button"
                              onClick={() => setShowRawWebhookJson((v) => !v)}
                              style={{
                                marginLeft: 'auto',
                                padding: '0.25rem 0.5rem',
                                fontSize: '0.75rem',
                                backgroundColor: 'var(--bg-tertiary)',
                                border: '1px solid var(--border-primary)',
                                borderRadius: '0.25rem',
                                color: 'var(--text-secondary)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.25rem'
                              }}
                            >
                              <FileText size={12} />
                              {showRawWebhookJson ? 'Ver resumo' : 'Ver JSON completo'}
                            </button>
                          </div>
                          {showRawWebhookJson ? (
                            <pre style={{
                              margin: 0,
                              padding: '0.75rem',
                              backgroundColor: 'var(--bg-tertiary)',
                              borderRadius: '0.375rem',
                              fontSize: '0.75rem',
                              lineHeight: '1.5',
                              overflow: 'auto',
                              maxHeight: '400px',
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                              color: 'var(--text-secondary)',
                              fontFamily: 'ui-monospace, monospace'
                            }}>
                              {JSON.stringify(webhookPayload, null, 2)}
                            </pre>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              {Object.entries(webhookPayload).map(([key, value]) => (
                                <div key={key}>
                                  <div style={{
                                    fontSize: '0.75rem',
                                    fontWeight: '600',
                                    color: 'var(--purple)',
                                    marginBottom: '0.125rem'
                                  }}>
                                    {humanizeKey(key)}
                                  </div>
                                  <div style={{
                                    fontSize: '0.8125rem',
                                    color: 'var(--text-secondary)',
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-word'
                                  }}>
                                    {renderWebhookValue(value, key)}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      ) : (
                        <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                          {ticket.description}
                        </span>
                      )}
                    </div>
                    <div className="ticket-chat__time" style={{ paddingLeft: '0.5rem', marginTop: '0.25rem' }}>
                      {formatDate(ticket.created_at)}
                    </div>
                  </div>
                </div>
              </div>
            </>
          );
        })()}

        {/* Mensagens do chat - Estilo WhatsApp */}
        {messages.map((message) => {
          const isOwnMessage = message.user_id === user?.id;
          return (
            <div key={message.id} className={`ticket-chat__row${isOwnMessage ? ' ticket-chat__row--own' : ''}`}>
              <div className="ticket-chat__row-inner">
                {!isOwnMessage && (
                  <div className="ticket-chat__avatar">
                    <User size={18} color="#FFFFFF" />
                  </div>
                )}
                <div style={{ flex: 1 }}>
              {editingMessageId === message.id ? (
                <div className={`ticket-chat__bubble ticket-chat__bubble--${isOwnMessage ? 'own' : 'other'}`} style={{ padding: '0.75rem' }}>
                  <textarea
                    className="textarea"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={3}
                        style={{
                          marginBottom: 'var(--spacing-sm)',
                          backgroundColor: 'var(--bg-tertiary)',
                          border: '1px solid var(--border-primary)',
                          color: 'var(--text-primary)',
                          borderRadius: '0.375rem',
                          padding: '0.5rem',
                          fontSize: '0.875rem',
                          width: '100%',
                          resize: 'none',
                          fontFamily: 'inherit'
                        }}
                  />
                  <div style={{ display: 'flex', gap: 'var(--spacing-sm)', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => {
                        setEditingMessageId(null);
                        setEditText('');
                      }}
                          style={{
                            padding: '0.375rem 0.75rem',
                            backgroundColor: 'var(--bg-tertiary)',
                            border: '1px solid var(--border-primary)',
                            borderRadius: '0.25rem',
                            color: 'var(--text-primary)',
                            cursor: 'pointer',
                            fontSize: '0.8125rem'
                          }}
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => handleEditMessage(message.id)}
                          style={{
                            padding: '0.375rem 0.75rem',
                            backgroundColor: 'var(--purple)',
                            border: 'none',
                            borderRadius: '0.25rem',
                            color: '#FFFFFF',
                            cursor: 'pointer',
                            fontSize: '0.8125rem'
                          }}
                    >
                      Salvar
                    </button>
                  </div>
                </div>
              ) : (
                    <>
                <div className="ticket-chat__meta">
                        {!isOwnMessage && (
                          <strong className="ticket-chat__sender">{message.user_name}</strong>
                        )}
                        {canEditMessage(message) && !editingMessageId && (
                          <div style={{ display: 'flex', gap: '0.25rem' }}>
                            <button
                              onClick={() => {
                                setEditingMessageId(message.id);
                                setEditText(message.message);
                              }}
                              style={{
                                padding: '0.25rem',
                                backgroundColor: 'transparent',
                                border: 'none',
                                borderRadius: '0.25rem',
                                color: 'var(--text-tertiary)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                transition: 'all 0.2s'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                                e.currentTarget.style.color = 'var(--text-primary)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                                e.currentTarget.style.color = 'var(--text-tertiary)';
                              }}
                            >
                              <Edit2 size={12} />
                            </button>
                            <button
                              onClick={() => handleDeleteMessage(message.id)}
                              style={{
                                padding: '0.25rem',
                                backgroundColor: 'transparent',
                                border: 'none',
                                borderRadius: '0.25rem',
                                color: 'var(--text-tertiary)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                transition: 'all 0.2s'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = 'var(--red-light)';
                                e.currentTarget.style.color = 'var(--red)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                                e.currentTarget.style.color = 'var(--text-tertiary)';
                              }}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        )}
                      </div>
                      <div
                        className={`ticket-chat__bubble ticket-chat__bubble--${isOwnMessage ? 'own' : 'other'}`}
                        style={{
                          padding: message.attachments && message.attachments.length > 0 && message.attachments.some(a => isImage(a.mime_type)) ? 0 : undefined
                        }}
                      >
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
                                {isImage(attachment.mime_type) ? (
                                  <div>
                                    <img 
                                      src={normalizeFilePath(attachment.file_path)}
                                      alt={attachment.file_name}
                                      style={{
                                        width: '100%',
                                        maxWidth: '300px',
                                        maxHeight: '300px',
                                        objectFit: 'cover',
                                        display: 'block',
                                        cursor: 'pointer',
                                        borderRadius: '0.375rem 0.375rem 0 0'
                                      }}
                                      onClick={() => {
                                        window.open(normalizeFilePath(attachment.file_path), '_blank');
                                      }}
                                      onError={(e) => {
                                        console.error('Erro ao carregar imagem:', attachment.file_path, 'Tentando:', normalizeFilePath(attachment.file_path));
                                        const img = e.target as HTMLImageElement;
                                        // Tentar caminho alternativo
                                        const currentSrc = img.src;
                                        const normalizedPath = normalizeFilePath(attachment.file_path);
                                        if (currentSrc !== normalizedPath) {
                                          img.src = normalizedPath;
                                        } else {
                                          img.style.display = 'none';
                                        }
                                      }}
                                    />
                                    <div style={{
                                      padding: '0.5rem 0.75rem',
                                      backgroundColor: isOwnMessage ? 'var(--purple)' : 'var(--bg-card)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      gap: '0.5rem'
                                    }}>
                                      <span style={{
                                        fontSize: '0.75rem',
                                        opacity: 0.8,
                                        flex: 1,
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap'
                                      }}>
                                        {attachment.file_name}
                                      </span>
                                      <button
                                        onClick={() => handleDownloadMessageAttachment(attachment)}
                                        style={{
                                          padding: '0.25rem 0.5rem',
                                          backgroundColor: 'rgba(255, 255, 255, 0.2)',
                                          border: 'none',
                                          borderRadius: '0.25rem',
                                          color: '#FFFFFF',
                                          cursor: 'pointer',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '0.25rem',
                                          fontSize: '0.75rem',
                                          transition: 'all 0.2s',
                                          flexShrink: 0
                                        }}
                                        onMouseEnter={(e) => {
                                          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
                                        }}
                                        onMouseLeave={(e) => {
                                          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
                                        }}
                                      >
                                        <Download size={12} />
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div style={{
                                    padding: '0.5rem 0.75rem',
                                    backgroundColor: isOwnMessage ? 'var(--purple)' : 'var(--bg-card)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    borderRadius: '0.375rem'
                                  }}>
                                    <FileText size={16} color={isOwnMessage ? '#FFFFFF' : 'var(--purple)'} />
                                    <div style={{ flex: 1 }}>
                                      <div style={{
                                        fontSize: '0.8125rem',
                                        fontWeight: '500',
                                        color: isOwnMessage ? '#FFFFFF' : 'var(--text-primary)',
                                        marginBottom: '0.25rem'
                                      }}>
                                        {attachment.file_name}
                                      </div>
                                      <div style={{
                                        fontSize: '0.75rem',
                                        opacity: 0.8,
                                        color: isOwnMessage ? '#FFFFFF' : 'var(--text-tertiary)'
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
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
                                      }}
                                    >
                                      <Download size={14} />
                                    </button>
                                  </div>
                                )}
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
                      <div
                        className="ticket-chat__time"
                        style={{
                          paddingLeft: isOwnMessage ? 0 : '0.5rem',
                          paddingRight: isOwnMessage ? '0.5rem' : 0,
                          marginTop: '0.25rem',
                          textAlign: isOwnMessage ? 'right' : 'left'
                        }}
                      >
                        {formatDate(message.created_at)}
                      </div>
                    </>
                  )}
                </div>
                {isOwnMessage && (
                  <div className="ticket-chat__avatar ticket-chat__avatar--own">
                    <User size={18} color="#FFFFFF" />
                  </div>
                )}
              </div>
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      {/* Input de mensagem */}
      {canEditTicket && (
      <div className="ticket-chat__input-bar">
        {/* Preview de arquivos antes de enviar */}
        {messagePreviewUrls.length > 0 && (
          <div style={{
            display: 'flex',
            gap: '0.5rem',
            marginBottom: 'var(--spacing-sm)',
            flexWrap: 'wrap',
            maxHeight: '200px',
            overflowY: 'auto'
          }}>
            {messagePreviewUrls.map((url, index) => {
              const file = messageFiles[index];
              const isImg = file?.type.startsWith('image/');
              
              return (
                <div key={index} style={{
                  position: 'relative',
                  width: isImg ? '100px' : 'auto',
                  height: isImg ? '100px' : 'auto'
                }}>
                  {isImg ? (
                    <img 
                      src={url}
                      alt={file.name}
                      style={{
                        width: '100px',
                        height: '100px',
                        objectFit: 'cover',
                        borderRadius: '0.5rem',
                        border: '1px solid var(--border-primary)'
                      }}
                    />
                  ) : (
                    <div style={{
                      padding: '0.5rem',
                      backgroundColor: 'var(--bg-tertiary)',
                      borderRadius: '0.5rem',
                      border: '1px solid var(--border-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      maxWidth: '200px'
                    }}>
                      <FileText size={16} color="var(--purple)" />
                      <span style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {file.name}
                      </span>
                    </div>
                  )}
                  <button
                    onClick={() => removeFile(index)}
                    style={{
                      position: 'absolute',
                      top: '-8px',
                      right: '-8px',
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--red)',
                      border: 'none',
                      color: '#FFFFFF',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0,
                      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)'
                    }}
                  >
                    <X size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
        
        <div className="ticket-chat__input-wrap">
          <input
            type="file"
            id="message-file-input"
            multiple
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          <label htmlFor="message-file-input" className="ticket-chat__btn-icon">
            <Paperclip size={18} />
          </label>
          <textarea
            className="ticket-chat__input"
            placeholder="Digite sua mensagem..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            rows={1}
          />
          <button
            type="button"
            onClick={handleSendMessage}
            disabled={(!newMessage.trim() && messageFiles.length === 0) || sending}
            className="ticket-chat__btn-send"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
      )}

      {/* Modal de Agendamento */}
      {showScheduleModal && (
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
          zIndex: 2000,
          padding: 'var(--spacing-xl)'
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            setShowScheduleModal(false);
          }
        }}
        >
          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--spacing-lg)',
            width: '100%',
            maxWidth: '500px',
            boxShadow: 'var(--shadow-xl)',
            border: '1px solid var(--border-primary)'
          }}
          onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 'var(--spacing-lg)'
            }}>
              <h2 style={{
                fontSize: '1.5rem',
                fontWeight: '700',
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-sm)'
              }}>
                <Calendar size={24} />
                Agendar Ticket
              </h2>
              <button
                onClick={() => setShowScheduleModal(false)}
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  padding: 'var(--spacing-xs)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{
              display: 'flex',
              flexDirection: 'column',
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
                  Data
                </label>
                <input
                  type="date"
                  className="input"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{
                  display: 'block',
                  marginBottom: 'var(--spacing-xs)',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: 'var(--text-secondary)'
                }}>
                  Horário
                </label>
                <input
                  type="time"
                  className="input"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              {ticket?.scheduled_at && (
                <div style={{
                  padding: 'var(--spacing-sm)',
                  backgroundColor: 'var(--bg-tertiary)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.875rem',
                  color: 'var(--text-secondary)'
                }}>
                  <strong>Agendamento atual:</strong> {new Date(ticket.scheduled_at).toLocaleString('pt-BR', {
                    dateStyle: 'short',
                    timeStyle: 'short'
                  })}
                </div>
              )}

              <div style={{
                display: 'flex',
                gap: 'var(--spacing-sm)',
                justifyContent: 'flex-end',
                marginTop: 'var(--spacing-md)'
              }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowScheduleModal(false);
                    setScheduleDate('');
                    setScheduleTime('');
                  }}
                  disabled={scheduling}
                >
                  Cancelar
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleScheduleTicket}
                  disabled={scheduling || !scheduleDate || !scheduleTime}
                >
                  {scheduling ? 'Agendando...' : 'Agendar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CSS Animation */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
