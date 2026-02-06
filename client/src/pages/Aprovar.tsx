import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { CheckCircle, XCircle, Search, Clock, User, FileText } from 'lucide-react';
import { formatDateBR, formatTicketTitle } from '../utils/dateUtils';

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

export default function Aprovar() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [approvals, setApprovals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPendingApprovals();
  }, []);

  const fetchPendingApprovals = async () => {
    try {
      setLoading(true);
      console.log('[Aprovar] Buscando tickets pendentes de aprovação...');
      const response = await axios.get('/api/tickets/pending-approval');
      console.log('[Aprovar] Resposta recebida:', response.data);
      console.log('[Aprovar] Total de tickets:', response.data.length);
      
      const tickets = response.data.map((ticket: any) => {
        // Determinar a quem está vinculado
        let linkedTo = undefined;
        if (ticket.linked_user_name) {
          linkedTo = `Usuário: ${ticket.linked_user_name}`;
        } else if (ticket.linked_group_name) {
          linkedTo = `Grupo: ${ticket.linked_group_name}`;
        } else if (ticket.linked_user_id || ticket.linked_group_id) {
          linkedTo = ticket.linked_user_id ? 'Usuário vinculado' : 'Grupo vinculado';
        }

        console.log(`[Aprovar] Processando ticket #${ticket.id}: status=${ticket.status}, needs_approval=${ticket.needs_approval}, linkedTo=${linkedTo}`);

        // Formatar ID do ticket para exibição (com barras)
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
          type: ticket.form_id ? 'Formulário' : 'Ticket',
          requester: ticket.user_name || 'Usuário Anônimo',
          date: ticket.created_at,
          status: ticket.status === 'pending_approval' ? 'Pendente' : 'Aprovado',
          priority: ticket.priority === 'high' || ticket.priority === 'urgent' ? 'Alta' : ticket.priority === 'medium' ? 'Média' : 'Baixa',
          formName: ticket.form_name,
          linkedTo: linkedTo
        };
      });
      
      console.log('[Aprovar] Tickets processados:', tickets.length);
      setApprovals(tickets);
    } catch (error: any) {
      console.error('[Aprovar] Erro ao buscar aprovações:', error);
      console.error('[Aprovar] Detalhes do erro:', error.response?.data || error.message);
      alert('Erro ao buscar tickets pendentes de aprovação. Verifique o console para mais detalhes.');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: number) => {
    try {
      await axios.post(`/api/tickets/${id}/approve`);
      alert('Ticket aprovado com sucesso!');
      fetchPendingApprovals(); // Recarregar lista
    } catch (error: any) {
      console.error('Erro ao aprovar ticket:', error);
      alert(error.response?.data?.error || 'Erro ao aprovar ticket');
    }
  };

  const handleReject = async (id: number) => {
    if (!window.confirm('Tem certeza que deseja rejeitar este ticket?')) {
      return;
    }

    try {
      await axios.post(`/api/tickets/${id}/reject`);
      alert('Ticket rejeitado');
      fetchPendingApprovals(); // Recarregar lista
    } catch (error: any) {
      console.error('Erro ao rejeitar ticket:', error);
      alert(error.response?.data?.error || 'Erro ao rejeitar ticket');
    }
  };

  const filteredApprovals = approvals.filter(approval =>
    approval.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    approval.requester.toLowerCase().includes(searchTerm.toLowerCase())
  );


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
          Aprovar
        </h1>
        <p style={{
          color: 'var(--text-secondary)',
          fontSize: '1rem',
          fontWeight: '400'
        }}>
          Gerencie solicitações pendentes de aprovação
        </p>
      </div>

      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: 'var(--spacing-lg)',
        gap: 'var(--spacing-md)',
        flexWrap: 'wrap'
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
            placeholder="Buscar aprovações..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '2.75rem' }}
          />
        </div>
      </div>

      {loading ? (
        <div className="card" style={{ 
          textAlign: 'center', 
          padding: 'var(--spacing-2xl)',
          border: '1px solid var(--border-primary)'
        }}>
          <p style={{ color: 'var(--text-secondary)' }}>Carregando aprovações...</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          {filteredApprovals.length === 0 ? (
          <div className="card" style={{ 
            textAlign: 'center', 
            padding: 'var(--spacing-2xl)',
            border: '1px solid var(--border-primary)'
          }}>
            <CheckCircle size={48} color="var(--text-tertiary)" style={{ marginBottom: 'var(--spacing-md)' }} />
            <p style={{ 
              color: 'var(--text-secondary)',
              fontSize: '1rem',
              marginBottom: 'var(--spacing-sm)'
            }}>
              {searchTerm ? 'Nenhuma aprovação encontrada' : 'Nenhuma aprovação pendente'}
            </p>
          </div>
        ) : (
          filteredApprovals.map((approval) => (
            <div key={approval.id} className="card" style={{ 
              border: '1px solid var(--border-primary)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              transition: 'all var(--transition-base)',
              cursor: 'pointer'
            }}
            onClick={() => navigate(`/tickets/${approval.fullId || approval.id}`)}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-secondary)';
              e.currentTarget.style.boxShadow = 'var(--shadow-md)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-primary)';
              e.currentTarget.style.boxShadow = 'var(--shadow)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 'var(--spacing-md)',
                  marginBottom: 'var(--spacing-xs)'
                }}>
                  <CheckCircle 
                    size={20} 
                    color={approval.status === 'Aprovado' ? 'var(--green)' : 'var(--orange)'} 
                  />
                  <h3 style={{ 
                    fontSize: '1.125rem', 
                    fontWeight: '600',
                    color: 'var(--text-primary)'
                  }}>
                    {approval.title}
                  </h3>
                  <span style={{
                    fontSize: '0.75rem',
                    padding: '0.25rem 0.5rem',
                    borderRadius: 'var(--radius-full)',
                    background: approval.priority === 'Alta' 
                      ? 'var(--red-light)' 
                      : approval.priority === 'Média'
                      ? 'var(--orange-light)'
                      : 'var(--blue-light)',
                    color: approval.priority === 'Alta' 
                      ? 'var(--red)' 
                      : approval.priority === 'Média'
                      ? 'var(--orange)'
                      : 'var(--blue)',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    {approval.priority}
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
                    {approval.requester}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <FileText size={14} />
                    {approval.type}
                  </span>
                  {approval.ticketId && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <span style={{ fontWeight: '600' }}>Ticket:</span> {approval.ticketId}
                    </span>
                  )}
                  {approval.formName && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--purple)' }}>
                      <span style={{ fontWeight: '600' }}>Formulário:</span> {approval.formName}
                    </span>
                  )}
                  {approval.linkedTo && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--blue)' }}>
                      <span style={{ fontWeight: '600' }}>Vinculado a:</span> {approval.linkedTo}
                    </span>
                  )}
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Clock size={14} />
                    {formatDateBR(approval.date, { includeTime: true })}
                  </span>
                  <span style={{
                    fontSize: '0.75rem',
                    padding: '0.25rem 0.5rem',
                    borderRadius: 'var(--radius-full)',
                    background: approval.status === 'Aprovado' 
                      ? 'var(--green-light)' 
                      : 'var(--orange-light)',
                    color: approval.status === 'Aprovado' 
                      ? 'var(--green)' 
                      : 'var(--orange)',
                    fontWeight: '600'
                  }}>
                    {approval.status}
                  </span>
                </div>
              </div>
              {approval.status === 'Pendente' && (
                <div style={{ 
                  display: 'flex', 
                  gap: 'var(--spacing-sm)'
                }}
                onClick={(e) => e.stopPropagation()}
                >
                  <button 
                    className="btn btn-success btn-sm"
                    onClick={() => handleApprove(approval.id)}
                  >
                    <CheckCircle size={16} />
                    Aprovar
                  </button>
                  <button 
                    className="btn btn-danger btn-sm"
                    onClick={() => handleReject(approval.id)}
                  >
                    <XCircle size={16} />
                    Rejeitar
                  </button>
                </div>
              )}
            </div>
          ))
          )}
        </div>
      )}
    </div>
  );
}
