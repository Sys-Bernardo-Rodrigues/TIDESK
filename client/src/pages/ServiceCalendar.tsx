import { useState } from 'react';
import { Calendar, Plus, Search, Edit, Trash2, Clock, User } from 'lucide-react';

export default function ServiceCalendar() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // Mock data - será substituído por dados reais
  const services = [
    { id: 1, title: 'Manutenção Preventiva', date: '2024-01-25', time: '09:00', technician: 'João Silva', status: 'scheduled' },
    { id: 2, title: 'Instalação de Sistema', date: '2024-01-26', time: '14:00', technician: 'Maria Santos', status: 'confirmed' },
    { id: 3, title: 'Suporte Técnico', date: '2024-01-27', time: '10:00', technician: 'Pedro Costa', status: 'pending' },
  ];

  const filteredServices = services.filter(service =>
    service.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    service.technician.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { class: string; label: string }> = {
      scheduled: { class: 'badge-info', label: 'Agendado' },
      confirmed: { class: 'badge-success', label: 'Confirmado' },
      pending: { class: 'badge-warning', label: 'Pendente' },
      cancelled: { class: 'badge-danger', label: 'Cancelado' }
    };
    return badges[status] || { class: 'badge-secondary', label: status };
  };

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
          Calendário de Serviço
        </h1>
        <p style={{
          color: 'var(--text-secondary)',
          fontSize: '1rem',
          fontWeight: '400'
        }}>
          Gerencie os agendamentos de serviços
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
            placeholder="Buscar serviços..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '2.75rem' }}
          />
        </div>
        <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
          <input
            type="date"
            className="input"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{ width: 'auto', minWidth: '180px' }}
          />
          <button className="btn btn-primary">
            <Plus size={20} />
            Novo Agendamento
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
        {filteredServices.length === 0 ? (
          <div className="card" style={{ 
            textAlign: 'center', 
            padding: 'var(--spacing-2xl)',
            border: '1px solid var(--border-primary)'
          }}>
            <Calendar size={48} color="var(--text-tertiary)" style={{ marginBottom: 'var(--spacing-md)' }} />
            <p style={{ 
              color: 'var(--text-secondary)',
              fontSize: '1rem',
              marginBottom: 'var(--spacing-sm)'
            }}>
              {searchTerm ? 'Nenhum serviço encontrado' : 'Nenhum serviço agendado ainda'}
            </p>
            {!searchTerm && (
              <button className="btn btn-primary" style={{ marginTop: 'var(--spacing-md)' }}>
                <Plus size={20} />
                Agendar Primeiro Serviço
              </button>
            )}
          </div>
        ) : (
          filteredServices.map((service) => {
            const statusBadge = getStatusBadge(service.status);
            return (
              <div key={service.id} className="card" style={{ 
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
                    <Calendar size={20} color="var(--green)" />
                    <h3 style={{ 
                      fontSize: '1.125rem', 
                      fontWeight: '600',
                      color: 'var(--text-primary)'
                    }}>
                      {service.title}
                    </h3>
                    <span className={`badge ${statusBadge.class}`} style={{
                      fontSize: '0.6875rem',
                      padding: '0.25rem 0.5rem'
                    }}>
                      {statusBadge.label}
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
                      <Calendar size={14} />
                      {new Date(service.date).toLocaleDateString('pt-BR')}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Clock size={14} />
                      {service.time}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <User size={14} />
                      {service.technician}
                    </span>
                  </div>
                </div>
                <div style={{ 
                  display: 'flex', 
                  gap: 'var(--spacing-sm)'
                }}>
                  <button className="btn btn-secondary btn-sm">
                    <Edit size={16} />
                    Editar
                  </button>
                  <button className="btn btn-danger btn-sm">
                    <Trash2 size={16} />
                    Excluir
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
