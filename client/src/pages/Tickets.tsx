import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Plus } from 'lucide-react';

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
}

export default function Tickets() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      const response = await axios.get('/api/tickets');
      setTickets(response.data);
    } catch (error) {
      console.error('Erro ao buscar tickets:', error);
    } finally {
      setLoading(false);
    }
  };

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

  const filteredTickets = filter === 'all' 
    ? tickets 
    : tickets.filter(t => t.status === filter);

  if (loading) {
    return <div className="loading">Carregando...</div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold' }}>Tickets</h1>
        <Link to="/tickets/new" className="btn btn-primary">
          <Plus size={18} />
          Novo Ticket
        </Link>
      </div>

      <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.5rem' }}>
        <button
          className={`btn ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setFilter('all')}
        >
          Todos
        </button>
        <button
          className={`btn ${filter === 'open' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setFilter('open')}
        >
          Abertos
        </button>
        <button
          className={`btn ${filter === 'in_progress' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setFilter('in_progress')}
        >
          Em Progresso
        </button>
        <button
          className={`btn ${filter === 'resolved' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setFilter('resolved')}
        >
          Resolvidos
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {filteredTickets.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
            <p style={{ color: 'var(--text-light)' }}>Nenhum ticket encontrado</p>
          </div>
        ) : (
          filteredTickets.map((ticket) => (
            <Link
              key={ticket.id}
              to={`/tickets/${ticket.id}`}
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <div className="card" style={{
                cursor: 'pointer',
                transition: 'transform 0.2s, box-shadow 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'var(--shadow)';
              }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.75rem' }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                      {ticket.title}
                    </h3>
                    <p style={{ color: 'var(--text-light)', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                      {ticket.description.substring(0, 150)}
                      {ticket.description.length > 150 ? '...' : ''}
                    </p>
                  </div>
                  <span className={`badge ${getStatusBadge(ticket.status)}`}>
                    {getStatusLabel(ticket.status)}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.875rem', color: 'var(--text-light)' }}>
                  <span>Categoria: {ticket.category_name || 'Sem categoria'}</span>
                  <span>Prioridade: {getPriorityLabel(ticket.priority)}</span>
                  <span>Criado por: {ticket.user_name}</span>
                  {ticket.assigned_name && <span>Atribuído a: {ticket.assigned_name}</span>}
                  <span>{new Date(ticket.created_at).toLocaleDateString('pt-BR')}</span>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
