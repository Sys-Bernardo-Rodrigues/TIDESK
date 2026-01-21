import { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { Ticket, AlertCircle, CheckCircle, Clock } from 'lucide-react';

interface TicketStats {
  total: number;
  open: number;
  in_progress: number;
  resolved: number;
  closed: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<TicketStats>({
    total: 0,
    open: 0,
    in_progress: 0,
    resolved: 0,
    closed: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await axios.get('/api/tickets');
      const tickets = response.data;

      const newStats: TicketStats = {
        total: tickets.length,
        open: tickets.filter((t: any) => t.status === 'open').length,
        in_progress: tickets.filter((t: any) => t.status === 'in_progress').length,
        resolved: tickets.filter((t: any) => t.status === 'resolved').length,
        closed: tickets.filter((t: any) => t.status === 'closed').length
      };

      setStats(newStats);
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Carregando...</div>;
  }

  return (
    <div>
      <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '2rem' }}>
        Dashboard
      </h1>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1.5rem',
        marginBottom: '2rem'
      }}>
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
            <Ticket size={24} color="var(--primary)" />
            <h3 style={{ fontSize: '0.875rem', color: 'var(--text-light)' }}>Total</h3>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{stats.total}</div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
            <AlertCircle size={24} color="var(--danger)" />
            <h3 style={{ fontSize: '0.875rem', color: 'var(--text-light)' }}>Abertos</h3>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--danger)' }}>{stats.open}</div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
            <Clock size={24} color="var(--warning)" />
            <h3 style={{ fontSize: '0.875rem', color: 'var(--text-light)' }}>Em Progresso</h3>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--warning)' }}>{stats.in_progress}</div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
            <CheckCircle size={24} color="var(--success)" />
            <h3 style={{ fontSize: '0.875rem', color: 'var(--text-light)' }}>Resolvidos</h3>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--success)' }}>{stats.resolved}</div>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Ações Rápidas</h2>
        </div>
        <Link to="/tickets/new" className="btn btn-primary">
          Criar Novo Ticket
        </Link>
      </div>
    </div>
  );
}
