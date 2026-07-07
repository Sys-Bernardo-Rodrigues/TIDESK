import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { CheckCircle, XCircle, Search, Clock, User, FileText } from 'lucide-react';
import { formatDateBR, formatTicketTitle } from '../utils/dateUtils';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useConfirm } from '@/components/ui/confirm-dialog';

// Função para gerar ID completo do ticket (sem barras) - usado em URLs
function getTicketFullId(ticket: any): string {
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

const PRIORITY_STYLE: Record<string, string> = {
  Alta: 'bg-[var(--red-light)] text-[var(--red)]',
  Média: 'bg-[var(--orange-light)] text-[var(--orange)]',
  Baixa: 'bg-[var(--blue-light)] text-[var(--blue)]',
};

function ApprovalRowSkeleton() {
  return (
    <Card className="flex-row items-center justify-between gap-4 px-4 py-4">
      <div className="min-w-0 flex-1">
        <Skeleton className="mb-2 h-5 w-1/3" />
        <div className="flex gap-4">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="h-3.5 w-28" />
        </div>
      </div>
      <Skeleton className="h-8 w-[180px] shrink-0" />
    </Card>
  );
}

export default function Aprovar() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [searchTerm, setSearchTerm] = useState('');
  const [approvals, setApprovals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPendingApprovals();
  }, []);

  const fetchPendingApprovals = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/tickets/pending-approval');

      const tickets = response.data.map((ticket: any) => {
        let linkedTo = undefined;
        if (ticket.linked_user_name) {
          linkedTo = `Usuário: ${ticket.linked_user_name}`;
        } else if (ticket.linked_group_name) {
          linkedTo = `Grupo: ${ticket.linked_group_name}`;
        } else if (ticket.linked_user_id || ticket.linked_group_id) {
          linkedTo = ticket.linked_user_id ? 'Usuário vinculado' : 'Grupo vinculado';
        }

        let ticketIdDisplay = `#${ticket.id}`;
        if (ticket.ticket_number && ticket.created_at) {
          const date = new Date(ticket.created_at);
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          const number = String(ticket.ticket_number).padStart(3, '0');
          ticketIdDisplay = `${year}/${month}/${day}/${number}`;
        }

        return {
          id: ticket.id,
          ticketId: ticketIdDisplay,
          fullId: getTicketFullId(ticket),
          title: formatTicketTitle(ticket.title),
          type: ticket.webhook_name ? 'Webhook' : ticket.form_id ? 'Formulário' : 'Ticket',
          requester: ticket.user_name || 'Usuário Anônimo',
          date: ticket.created_at,
          status: ticket.status === 'pending_approval' ? 'Pendente' : 'Aprovado',
          priority: ticket.priority === 'high' || ticket.priority === 'urgent' ? 'Alta' : ticket.priority === 'medium' ? 'Média' : 'Baixa',
          formName: ticket.webhook_name || ticket.form_name,
          linkedTo: linkedTo,
        };
      });

      setApprovals(tickets);
    } catch (error: any) {
      console.error('[Aprovar] Erro ao buscar aprovações:', error.response?.data || error.message);
      toast.error('Erro ao buscar tickets pendentes de aprovação.');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: number) => {
    try {
      await axios.post(`/api/tickets/${id}/approve`);
      toast.success('Ticket aprovado com sucesso!');
      fetchPendingApprovals();
    } catch (error: any) {
      console.error('Erro ao aprovar ticket:', error);
      toast.error(error.response?.data?.error || 'Erro ao aprovar ticket');
    }
  };

  const handleReject = async (id: number) => {
    const ok = await confirm({
      title: 'Rejeitar ticket',
      description: 'Tem certeza que deseja rejeitar este ticket?',
      confirmLabel: 'Rejeitar',
      variant: 'destructive',
    });
    if (!ok) return;

    try {
      await axios.post(`/api/tickets/${id}/reject`);
      toast.success('Ticket rejeitado');
      fetchPendingApprovals();
    } catch (error: any) {
      console.error('Erro ao rejeitar ticket:', error);
      toast.error(error.response?.data?.error || 'Erro ao rejeitar ticket');
    }
  };

  const filteredApprovals = approvals.filter(
    (approval) =>
      approval.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      approval.requester.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <div className="mb-8">
        <h1 className="mb-1.5 bg-gradient-to-br from-foreground to-muted-foreground bg-clip-text text-[2.5rem] font-extrabold tracking-tight text-transparent">
          Aprovar
        </h1>
        <p className="text-base text-muted-foreground">Gerencie solicitações pendentes de aprovação</p>
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="relative min-w-[300px] max-w-[500px] flex-1">
          <Search size={18} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar aprovações..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <ApprovalRowSkeleton key={i} />
          ))}
        </div>
      ) : filteredApprovals.length === 0 ? (
        <Card className="flex flex-col items-center px-4 py-16 text-center">
          <CheckCircle size={48} strokeWidth={1.5} className="mb-4 text-muted-foreground opacity-50" />
          <p className="text-base text-muted-foreground">{searchTerm ? 'Nenhuma aprovação encontrada' : 'Nenhuma aprovação pendente'}</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredApprovals.map((approval) => (
            <Card
              key={approval.id}
              onClick={() => navigate(`/tickets/${approval.fullId || approval.id}`)}
              className="flex-row flex-wrap items-center justify-between gap-4 px-4 py-4 transition-all hover:-translate-y-0.5 hover:shadow-md cursor-pointer"
            >
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2.5">
                  <CheckCircle size={20} className={cn('shrink-0', approval.status === 'Aprovado' ? 'text-[var(--green)]' : 'text-[var(--orange)]')} />
                  <h3 className="text-[1.0625rem] font-semibold text-foreground">{approval.title}</h3>
                  <Badge className={cn('border-0 font-semibold tracking-wide uppercase', PRIORITY_STYLE[approval.priority])}>
                    {approval.priority}
                  </Badge>
                </div>
                <div className="ml-9 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <User size={14} /> {approval.requester}
                  </span>
                  <span className="flex items-center gap-1">
                    <FileText size={14} /> {approval.type}
                  </span>
                  {approval.ticketId && (
                    <span>
                      <strong className="text-foreground">Ticket:</strong> {approval.ticketId}
                    </span>
                  )}
                  {approval.formName && (
                    <span className="text-[var(--purple)]">
                      <strong className="font-semibold">Formulário:</strong> {approval.formName}
                    </span>
                  )}
                  {approval.linkedTo && (
                    <span className="text-[var(--blue)]">
                      <strong className="font-semibold">Vinculado a:</strong> {approval.linkedTo}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock size={14} /> {formatDateBR(approval.date, { includeTime: true })}
                  </span>
                  <Badge
                    className={cn(
                      'border-0 font-semibold',
                      approval.status === 'Aprovado' ? 'bg-[var(--green-light)] text-[var(--green)]' : 'bg-[var(--orange-light)] text-[var(--orange)]'
                    )}
                  >
                    {approval.status}
                  </Badge>
                </div>
              </div>
              {approval.status === 'Pendente' && (
                <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <Button size="sm" className="bg-[var(--green)] text-white hover:bg-[var(--green)]/90" onClick={() => handleApprove(approval.id)}>
                    <CheckCircle size={15} /> Aprovar
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => handleReject(approval.id)}>
                    <XCircle size={15} /> Rejeitar
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
