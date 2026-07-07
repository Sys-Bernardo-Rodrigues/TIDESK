import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Eye, Search, Clock, User, Ticket, TrendingUp, FileText, MessageSquare, Download, CheckCircle, XCircle } from 'lucide-react';
import { formatDateBR, formatTicketTitle } from '../utils/dateUtils';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';

interface TicketDetail {
  id: number;
  ticket_number: number | null;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed' | 'pending_approval' | 'scheduled' | 'rejected';
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

// Função para formatar ID do ticket para exibição (com barras)
function formatTicketId(ticket: TicketDetail): string {
  if (!ticket.ticket_number || !ticket.created_at) {
    return `#${ticket.id}`;
  }
  const date = new Date(ticket.created_at);
  const year = parseInt(date.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo', year: 'numeric' }));
  const month = parseInt(date.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo', month: '2-digit' }));
  const day = parseInt(date.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo', day: '2-digit' }));
  const number = String(ticket.ticket_number).padStart(3, '0');
  return `${year}/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}/${number}`;
}

const PRIORITY_STYLE: Record<string, string> = {
  Alta: 'bg-[var(--red-light)] text-[var(--red)]',
  Média: 'bg-[var(--orange-light)] text-[var(--orange)]',
  Baixa: 'bg-[var(--blue-light)] text-[var(--blue)]',
};

const STATUS_STYLE: Record<string, string> = {
  'Em Tratamento': 'bg-[var(--orange-light)] text-[var(--orange)]',
  Aberto: 'bg-[var(--red-light)] text-[var(--red)]',
  Finalizado: 'bg-[var(--green-light)] text-[var(--green)]',
  Rejeitado: 'bg-[var(--red-light)] text-[var(--red)]',
};

function StatCard({ icon: Icon, accent, label, value }: { icon: typeof Eye; accent: 'blue' | 'orange' | 'green' | 'red'; label: string; value: number }) {
  const styles: Record<string, { chip: string; text: string }> = {
    blue: { chip: 'bg-[var(--blue)]', text: 'text-[var(--blue)]' },
    orange: { chip: 'bg-[var(--orange)]', text: 'text-[var(--orange)]' },
    green: { chip: 'bg-[var(--green)]', text: 'text-[var(--green)]' },
    red: { chip: 'bg-[var(--red)]', text: 'text-[var(--red)]' },
  };
  return (
    <Card className="gap-0 px-5 py-5">
      <div className={cn('mb-4 flex h-11 w-11 items-center justify-center rounded-lg text-white', styles[accent].chip)}>
        <Icon size={22} strokeWidth={2} />
      </div>
      <h3 className="mb-1.5 text-[0.8125rem] font-medium tracking-wide text-muted-foreground uppercase">{label}</h3>
      <div className={cn('text-4xl leading-none font-extrabold', styles[accent].text)}>{value}</div>
    </Card>
  );
}

function AttachmentCard({ fileName, fileSize, onDownload }: { fileName: string; fileSize: number; onDownload: () => void }) {
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };
  return (
    <div className="flex items-center gap-2 rounded-md bg-muted p-2">
      <FileText size={18} className="shrink-0 text-[var(--purple)]" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[0.8125rem] font-medium text-foreground">{fileName}</div>
        <div className="text-xs text-muted-foreground">{formatFileSize(fileSize)}</div>
      </div>
      <Button size="icon-sm" onClick={onDownload} className="shrink-0 bg-[var(--purple)] text-white hover:bg-[var(--purple)]/90">
        <Download size={14} />
      </Button>
    </div>
  );
}

function ChatBubble({ children, time }: { children: React.ReactNode; time: string }) {
  return (
    <div className="ticket-chat__row">
      <div className="ticket-chat__row-inner">
        <div className="ticket-chat__avatar">
          <FileText size={16} color="#FFFFFF" />
        </div>
        <div>
          <div className="ticket-chat__bubble ticket-chat__bubble--other">{children}</div>
          <div className="ticket-chat__time" style={{ paddingLeft: '0.5rem', marginTop: '0.25rem' }}>
            {time}
          </div>
        </div>
      </div>
    </div>
  );
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
          title: formatTicketTitle(ticket.title),
          agent: ticket.assigned_name || 'Não atribuído',
          status:
            ticket.status === 'in_progress'
              ? 'Em Tratamento'
              : ticket.status === 'open'
                ? 'Aberto'
                : ticket.status === 'closed'
                  ? 'Finalizado'
                  : ticket.status === 'rejected'
                    ? 'Rejeitado'
                    : ticket.status,
          priority: ticket.priority === 'high' || ticket.priority === 'urgent' ? 'Alta' : ticket.priority === 'medium' ? 'Média' : 'Baixa',
          createdAt: ticket.created_at,
          lastUpdate: ticket.updated_at,
          timeElapsed: calculateTimeElapsed(ticket.assigned_at || ticket.created_at, ticket.total_pause_seconds),
          source: ticket.form_id ? 'formulário' : undefined,
          formName: ticket.form_name,
          wasApproved: ticket.needs_approval === 1 && ticket.status === 'open',
          isClosed: ticket.status === 'closed' || ticket.status === 'rejected',
        };
      });
      setTreatments(tickets);
    } catch (error) {
      console.error('Erro ao buscar tratativas:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateTimeElapsed = (startAt: string, totalPauseSeconds?: number): string => {
    const now = new Date();
    const start = new Date(startAt);
    let diffMs = now.getTime() - start.getTime();
    if (totalPauseSeconds != null && totalPauseSeconds > 0) {
      diffMs -= totalPauseSeconds * 1000;
    }
    const diff = Math.max(0, diffMs);
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}h ${minutes}min`;
    return `${minutes}min`;
  };

  const handleViewDetails = async (ticketId: number) => {
    setLoadingDetails(true);
    try {
      const ticketResponse = await axios.get(`/api/tickets/${ticketId}`);
      const ticket = ticketResponse.data;
      setSelectedTicket(ticket);

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

      try {
        const messagesResponse = await axios.get(`/api/ticket-messages/ticket/${ticketId}`);
        setTicketMessages(messagesResponse.data);
      } catch (error) {
        console.error('Erro ao buscar mensagens:', error);
        setTicketMessages([]);
      }
    } catch (error) {
      console.error('Erro ao buscar detalhes do ticket:', error);
      toast.error('Erro ao carregar detalhes do ticket');
    } finally {
      setLoadingDetails(false);
    }
  };

  const formatDate = (dateString: string) => formatDateBR(dateString, { includeTime: true });

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
        if (trimmedLine.startsWith('- ')) attachmentsList.push(trimmedLine.substring(2));
        return;
      }

      const match = line.match(/\*\*(.+?):+?\*\*\s*(.+)/);
      if (match) {
        const label = match[1].trim();
        let value = match[2].trim();
        if (value.startsWith('[Arquivo]')) value = value.replace('[Arquivo]', '').trim();
        formData.push({ label, value });
      }
    });

    return { formData, attachmentsList };
  };

  const handleDownload = async (attachment: FormAttachment) => {
    try {
      const response = await axios.get(`/api/forms/attachments/${attachment.id}`, { responseType: 'blob' });
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
      toast.error('Erro ao baixar arquivo');
    }
  };

  const handleDownloadMessageAttachment = async (attachment: MessageAttachment) => {
    try {
      const response = await axios.get(`/api/ticket-messages/attachments/${attachment.id}`, { responseType: 'blob' });
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
      toast.error('Erro ao baixar arquivo');
    }
  };

  const filteredTreatments = treatments.filter((treatment) => {
    const matchesSearch =
      treatment.ticket.toLowerCase().includes(searchTerm.toLowerCase()) ||
      treatment.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      treatment.agent.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || treatment.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const closeModal = () => {
    setSelectedTicket(null);
    setTicketMessages([]);
    setAttachments([]);
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="mb-1.5 bg-gradient-to-br from-foreground to-muted-foreground bg-clip-text text-[2.5rem] font-extrabold tracking-tight text-transparent">
          Acompanhar Tratativa
        </h1>
        <p className="text-base text-muted-foreground">Acompanhe o progresso das tratativas de tickets em andamento</p>
      </div>

      {/* Filtros */}
      <Card className="mb-5 px-4 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[300px] max-w-[500px] flex-1">
            <Search size={18} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por ticket, título ou agente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Status</SelectItem>
              <SelectItem value="Em Tratamento">Em Tratamento</SelectItem>
              <SelectItem value="Aberto">Aberto</SelectItem>
              <SelectItem value="Finalizado">Finalizado</SelectItem>
              <SelectItem value="Rejeitado">Rejeitado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Cards de estatísticas */}
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Eye} accent="blue" label="Em Acompanhamento" value={treatments.length} />
        <StatCard icon={TrendingUp} accent="orange" label="Em Tratamento" value={treatments.filter((t) => t.status === 'Em Tratamento').length} />
        <StatCard icon={CheckCircle} accent="green" label="Finalizados" value={treatments.filter((t) => t.status === 'Finalizado').length} />
        <StatCard icon={XCircle} accent="red" label="Rejeitados" value={treatments.filter((t) => t.status === 'Rejeitado').length} />
      </div>

      {/* Lista de tratativas */}
      {loading ? (
        <Card className="px-4 py-16 text-center">
          <p className="text-sm text-muted-foreground">Carregando tratativas...</p>
        </Card>
      ) : filteredTreatments.length === 0 ? (
        <Card className="flex flex-col items-center px-4 py-16 text-center">
          <Eye size={48} strokeWidth={1.5} className="mb-4 text-muted-foreground opacity-50" />
          <p className="text-base text-muted-foreground">{searchTerm || filterStatus !== 'all' ? 'Nenhuma tratativa encontrada' : 'Nenhuma tratativa em acompanhamento'}</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredTreatments.map((treatment) => (
            <Card key={treatment.id} className="flex-row flex-wrap items-center justify-between gap-4 px-4 py-4 transition-all hover:-translate-y-0.5 hover:shadow-md">
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2.5">
                  <Ticket size={20} className="shrink-0 text-[var(--purple)]" />
                  <h3 className="text-[1.0625rem] font-semibold text-foreground">
                    {treatment.ticket} - {treatment.title}
                  </h3>
                  <Badge className={cn('border-0 font-semibold tracking-wide uppercase', PRIORITY_STYLE[treatment.priority])}>{treatment.priority}</Badge>
                </div>
                <div className="ml-9 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <User size={14} /> {treatment.agent}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={14} /> {treatment.timeElapsed}
                  </span>
                  <Badge className={cn('border-0 font-semibold', STATUS_STYLE[treatment.status] || 'bg-[var(--purple-light)] text-[var(--purple)]')}>
                    {treatment.status}
                  </Badge>
                  <span className="text-[0.8125rem]">Última atualização: {formatDateBR(treatment.lastUpdate, { includeTime: true })}</span>
                  {treatment.source === 'formulário' && (
                    <Badge className="gap-1 border-0 bg-[var(--purple-light)] text-[var(--purple)]">
                      <Ticket size={12} />
                      {treatment.formName}
                      {treatment.wasApproved && ' (Aprovado)'}
                    </Badge>
                  )}
                </div>
              </div>
              <Button size="sm" onClick={() => handleViewDetails(treatment.id)}>
                <Eye size={15} /> Ver Detalhes
              </Button>
            </Card>
          ))}
        </div>
      )}

      {/* Modal de detalhes do ticket */}
      <Dialog open={!!selectedTicket} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="flex h-[90vh] max-h-[90vh] w-full max-w-5xl! flex-col gap-0 overflow-hidden p-0">
          {selectedTicket && (
            <>
              <DialogHeader className="shrink-0 border-b border-border px-5 py-4">
                <div className="mb-1 text-sm text-muted-foreground">
                  <strong className="text-foreground">ID:</strong> {formatTicketId(selectedTicket)}
                </div>
                <h2 className="mb-1 text-xl font-bold text-foreground">{formatTicketTitle(selectedTicket.title)}</h2>
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <span>
                    <strong className="text-foreground">Criado por:</strong> {selectedTicket.user_name}
                  </span>
                  {selectedTicket.assigned_name && (
                    <span>
                      <strong className="text-foreground">Atribuído a:</strong> {selectedTicket.assigned_name}
                    </span>
                  )}
                  {selectedTicket.form_name && (
                    <span className="flex items-center gap-1">
                      <FileText size={12} />
                      <strong className="text-foreground">Formulário:</strong> {selectedTicket.form_name}
                    </span>
                  )}
                  <span>
                    <strong className="text-foreground">Status:</strong> {selectedTicket.status}
                  </span>
                  <span>
                    <strong className="text-foreground">Prioridade:</strong> {selectedTicket.priority}
                  </span>
                </div>
              </DialogHeader>

              <div className="ticket-chat">
                {loadingDetails ? (
                  <div className="py-16 text-center">
                    <p className="text-sm text-muted-foreground">Carregando detalhes...</p>
                  </div>
                ) : (
                  <>
                    {selectedTicket.form_name || attachments.length > 0 ? (
                      (() => {
                        const { formData } = parseFormDescription(selectedTicket.description);
                        return (
                          <>
                            <ChatBubble time={formatDate(selectedTicket.created_at)}>
                              <strong className="text-[var(--purple)]">
                                {selectedTicket.form_name ? `Formulário: ${selectedTicket.form_name}` : 'Dados do Formulário'}
                              </strong>
                              <p className="mt-1 text-muted-foreground">Olá! Recebemos sua submissão. Abaixo estão os detalhes:</p>
                            </ChatBubble>

                            {formData.map((item, index) => {
                              const fileNameMatch = item.value.match(/([^\s(]+\.(png|jpg|jpeg|gif|pdf|doc|docx|xls|xlsx|zip|rar|txt|mp4|mp3|avi|mov|webp|svg|bmp|ico|jfif|heic|heif))/i);
                              const fileName = fileNameMatch ? fileNameMatch[1] : null;

                              const attachment = attachments.find((att) => {
                                if (fileName && att.file_name === fileName) return true;
                                if (fileName && att.file_name.replace(/\.[^/.]+$/, '') === fileName.replace(/\.[^/.]+$/, '')) return true;
                                if (att.field_label === item.label) return true;
                                if (item.value.includes(att.file_name)) return true;
                                return false;
                              });

                              return (
                                <ChatBubble key={index} time={formatDate(selectedTicket.created_at)}>
                                  {attachment ? (
                                    <div>
                                      <div className="mb-2 text-[0.8125rem] font-semibold">{item.label}</div>
                                      <AttachmentCard fileName={attachment.file_name} fileSize={attachment.file_size} onDownload={() => handleDownload(attachment)} />
                                    </div>
                                  ) : (
                                    <div>
                                      <div className="mb-1 text-[0.8125rem] font-semibold text-[var(--purple)]">{item.label}</div>
                                      <div className="text-muted-foreground">{item.value}</div>
                                    </div>
                                  )}
                                </ChatBubble>
                              );
                            })}
                          </>
                        );
                      })()
                    ) : (
                      <ChatBubble time={formatDate(selectedTicket.created_at)}>{selectedTicket.description}</ChatBubble>
                    )}

                    {ticketMessages.map((message) => (
                      <div key={message.id} className="ticket-chat__row">
                        <div className="ticket-chat__row-inner">
                          <div className="ticket-chat__avatar">
                            <User size={16} color="#FFFFFF" />
                          </div>
                          <div className="flex-1">
                            <div className="ticket-chat__bubble ticket-chat__bubble--other">
                              {message.attachments && message.attachments.length > 0 && (
                                <div className={cn('flex flex-col gap-1', message.message && 'mb-2')}>
                                  {message.attachments.map((attachment) => (
                                    <AttachmentCard
                                      key={attachment.id}
                                      fileName={attachment.file_name}
                                      fileSize={attachment.file_size}
                                      onDownload={() => handleDownloadMessageAttachment(attachment)}
                                    />
                                  ))}
                                </div>
                              )}
                              {message.message && (
                                <div>
                                  {message.message}
                                  {message.updated_at !== message.created_at && <span className="ml-2 text-[0.6875rem] italic opacity-70">(editado)</span>}
                                </div>
                              )}
                            </div>
                            <div className="ticket-chat__time" style={{ paddingLeft: '0.5rem', marginTop: '0.25rem' }}>
                              <strong>{message.user_name}</strong> • {formatDate(message.created_at)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}

                    {ticketMessages.length === 0 && (
                      <div className="py-8 text-center text-muted-foreground">
                        <MessageSquare size={32} className="mx-auto mb-2 opacity-50" />
                        <p>Nenhuma mensagem adicional ainda</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
