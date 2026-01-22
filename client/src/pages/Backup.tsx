import { useState } from 'react';
import { Database, Download, Clock, HardDrive } from 'lucide-react';
import { formatDateBR } from '../utils/dateUtils';

export default function Backup() {
  const [searchTerm, setSearchTerm] = useState('');

  // Mock data - será substituído por dados reais
  const backups = [
    { id: 1, name: 'Backup Completo', date: '2024-01-20 14:30', size: '2.5 GB', type: 'Completo', status: 'Concluído' },
    { id: 2, name: 'Backup Incremental', date: '2024-01-19 10:15', size: '450 MB', type: 'Incremental', status: 'Concluído' },
    { id: 3, name: 'Backup Completo', date: '2024-01-18 14:30', size: '2.4 GB', type: 'Completo', status: 'Concluído' },
  ];

  const filteredBackups = backups.filter(backup =>
    backup.name.toLowerCase().includes(searchTerm.toLowerCase())
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
          Backup
        </h1>
        <p style={{
          color: 'var(--text-secondary)',
          fontSize: '1rem',
          fontWeight: '400'
        }}>
          Gerencie os backups do sistema e restaure dados quando necessário
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
          <input
            type="text"
            className="input"
            placeholder="Buscar backups..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: 'var(--spacing-md)' }}
          />
        </div>
        <button className="btn btn-primary">
          <Database size={20} />
          Novo Backup
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
        {filteredBackups.length === 0 ? (
          <div className="card" style={{ 
            textAlign: 'center', 
            padding: 'var(--spacing-2xl)',
            border: '1px solid var(--border-primary)'
          }}>
            <Database size={48} color="var(--text-tertiary)" style={{ marginBottom: 'var(--spacing-md)' }} />
            <p style={{ 
              color: 'var(--text-secondary)',
              fontSize: '1rem',
              marginBottom: 'var(--spacing-sm)'
            }}>
              {searchTerm ? 'Nenhum backup encontrado' : 'Nenhum backup criado ainda'}
            </p>
            {!searchTerm && (
              <button className="btn btn-primary" style={{ marginTop: 'var(--spacing-md)' }}>
                <Database size={20} />
                Criar Primeiro Backup
              </button>
            )}
          </div>
        ) : (
          filteredBackups.map((backup) => (
            <div key={backup.id} className="card" style={{ 
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
                  <Database size={20} color="var(--blue)" />
                  <h3 style={{ 
                    fontSize: '1.125rem', 
                    fontWeight: '600',
                    color: 'var(--text-primary)'
                  }}>
                    {backup.name}
                  </h3>
                </div>
                <div style={{ 
                  display: 'flex', 
                  gap: 'var(--spacing-lg)',
                  fontSize: '0.875rem',
                  color: 'var(--text-secondary)',
                  marginLeft: '2.25rem'
                }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Clock size={14} />
                    {formatDateBR(backup.date, { includeTime: true })}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <HardDrive size={14} />
                    {backup.size}
                  </span>
                  <span><strong>Tipo:</strong> {backup.type}</span>
                  <span><strong>Status:</strong> {backup.status}</span>
                </div>
              </div>
              <div style={{ 
                display: 'flex', 
                gap: 'var(--spacing-sm)'
              }}>
                <button className="btn btn-secondary btn-sm">
                  <Download size={16} />
                  Restaurar
                </button>
                <button className="btn btn-secondary btn-sm">
                  <Download size={16} />
                  Download
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
