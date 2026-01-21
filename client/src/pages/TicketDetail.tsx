import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

interface Ticket {
  id: number;
  title: string;
  description: string;
  status: string;
  priority: string;
  category_name: string;
  user_name: string;
  assigned_name: string | null;
  created_at: string;
  updated_at: string;
}

interface Category {
  id: number;
  name: string;
}

interface Agent {
  id: number;
  name: string;
  email: string;
}

export default function TicketDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchTicket();
    fetchCategories();
    if (user?.role === 'admin' || user?.role === 'agent') {
      fetchAgents();
    }
  }, [id, user]);

  const fetchTicket = async () => {
    try {
      const response = await axios.get(`/api/tickets/${id}`);
      setTicket(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao buscar ticket');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await axios.get('/api/categories');
      setCategories(response.data);
    } catch (error) {
      console.error('Erro ao buscar categorias:', error);
    }
  };

  const fetchAgents = async () => {
    try {
      const response = await axios.get('/api/users/agents');
      setAgents(response.data);
    } catch (error) {
      console.error('Erro ao buscar agentes:', error);
    }
  };

  const handleUpdate = async (field: string, value: any) => {
    setUpdating(true);
    try {
      const response = await axios.put(`/api/tickets/${id}`, {
        [field]: value
      });
      setTicket(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao atualizar ticket');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return <div className="loading">Carregando...</div>;
  }

  if (!ticket) {
    return (
      <div>
        <p>Ticket não encontrado</p>
        <button className="btn btn-secondary" onClick={() => navigate('/tickets')}>
          Voltar
        </button>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      open: 'badge-danger',
      in_progress: 'badge-warning',
      resolved: 'badge-success',
      closed: 'badge-info'
    };
    return badges[status] || 'badge-info';
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      open: 'Aberto',
      in_progress: 'Em Progresso',
      resolved: 'Resolvido',
      closed: 'Fechado'
    };
    return labels[status] || status;
  };

  const getPriorityLabel = (priority: string) => {
    const labels: Record<string, string> = {
      low: 'Baixa',
      medium: 'Média',
      high: 'Alta',
      urgent: 'Urgente'
    };
    return labels[priority] || priority;
  };

  const canEdit = user?.role === 'admin' || user?.role === 'agent';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold' }}>Detalhes do Ticket</h1>
        <button className="btn btn-secondary" onClick={() => navigate('/tickets')}>
          Voltar
        </button>
      </div>

      {error && (
        <div style={{
          padding: '0.75rem',
          backgroundColor: '#fee2e2',
          color: '#991b1b',
          borderRadius: '0.375rem',
          marginBottom: '1rem',
          fontSize: '0.875rem'
        }}>
          {error}
        </div>
      )}

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>
            Título
          </label>
          {canEdit ? (
            <input
              type="text"
              className="input"
              value={ticket.title}
              onChange={(e) => handleUpdate('title', e.target.value)}
              disabled={updating}
            />
          ) : (
            <p style={{ fontSize: '1.125rem', fontWeight: '600' }}>{ticket.title}</p>
          )}
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>
            Descrição
          </label>
          {canEdit ? (
            <textarea
              className="input"
              value={ticket.description}
              onChange={(e) => handleUpdate('description', e.target.value)}
              rows={8}
              disabled={updating}
              style={{ resize: 'vertical', fontFamily: 'inherit' }}
            />
          ) : (
            <p style={{ whiteSpace: 'pre-wrap' }}>{ticket.description}</p>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>
              Status
            </label>
            {canEdit ? (
              <select
                className="select"
                value={ticket.status}
                onChange={(e) => handleUpdate('status', e.target.value)}
                disabled={updating}
              >
                <option value="open">Aberto</option>
                <option value="in_progress">Em Progresso</option>
                <option value="resolved">Resolvido</option>
                <option value="closed">Fechado</option>
              </select>
            ) : (
              <span className={`badge ${getStatusBadge(ticket.status)}`}>
                {getStatusLabel(ticket.status)}
              </span>
            )}
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>
              Prioridade
            </label>
            {canEdit ? (
              <select
                className="select"
                value={ticket.priority}
                onChange={(e) => handleUpdate('priority', e.target.value)}
                disabled={updating}
              >
                <option value="low">Baixa</option>
                <option value="medium">Média</option>
                <option value="high">Alta</option>
                <option value="urgent">Urgente</option>
              </select>
            ) : (
              <span>{getPriorityLabel(ticket.priority)}</span>
            )}
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>
              Categoria
            </label>
            {canEdit ? (
              <select
                className="select"
                value={categories.find(c => c.name === ticket.category_name)?.id || ''}
                onChange={(e) => handleUpdate('category_id', e.target.value ? parseInt(e.target.value) : null)}
                disabled={updating}
              >
                <option value="">Sem categoria</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            ) : (
              <span>{ticket.category_name || 'Sem categoria'}</span>
            )}
          </div>

          {canEdit && (
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>
                Atribuir a
              </label>
              <select
                className="select"
                value={agents.find(a => a.name === ticket.assigned_name)?.id || ''}
                onChange={(e) => handleUpdate('assigned_to', e.target.value ? parseInt(e.target.value) : null)}
                disabled={updating}
              >
                <option value="">Não atribuído</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)', fontSize: '0.875rem', color: 'var(--text-light)' }}>
          <p>Criado por: {ticket.user_name}</p>
          {ticket.assigned_name && <p>Atribuído a: {ticket.assigned_name}</p>}
          <p>Criado em: {new Date(ticket.created_at).toLocaleString('pt-BR')}</p>
          <p>Atualizado em: {new Date(ticket.updated_at).toLocaleString('pt-BR')}</p>
        </div>
      </div>
    </div>
  );
}
