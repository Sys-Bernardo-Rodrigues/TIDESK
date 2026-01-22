import { useState } from 'react';
import { RefreshCw, Download, CheckCircle, AlertCircle, Clock } from 'lucide-react';

export default function Atualizar() {
  const [isChecking, setIsChecking] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<'available' | 'up-to-date' | 'checking' | null>(null);

  const handleCheckUpdates = () => {
    setIsChecking(true);
    setUpdateStatus('checking');
    
    // Simular verificação de atualizações
    setTimeout(() => {
      setIsChecking(false);
      // Simular que há atualização disponível
      setUpdateStatus('available');
    }, 2000);
  };

  const handleUpdate = () => {
    // Lógica para atualizar o sistema
    alert('Funcionalidade de atualização será implementada em breve');
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
          Atualizar Sistema
        </h1>
        <p style={{
          color: 'var(--text-secondary)',
          fontSize: '1rem',
          fontWeight: '400'
        }}>
          Verifique e instale atualizações do sistema
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
        <div className="card" style={{ 
          border: '1px solid var(--border-primary)',
          padding: 'var(--spacing-xl)'
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 'var(--spacing-md)',
            marginBottom: 'var(--spacing-lg)'
          }}>
            <RefreshCw size={24} color="var(--blue)" />
            <h2 style={{ 
              fontSize: '1.5rem', 
              fontWeight: '600',
              color: 'var(--text-primary)'
            }}>
              Verificar Atualizações
            </h2>
          </div>

          <div style={{ marginBottom: 'var(--spacing-lg)' }}>
            <p style={{ 
              color: 'var(--text-secondary)',
              fontSize: '0.9375rem',
              marginBottom: 'var(--spacing-md)'
            }}>
              Versão atual do sistema: <strong>1.0.0</strong>
            </p>
            
            {updateStatus === 'checking' && (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 'var(--spacing-sm)',
                color: 'var(--blue)',
                marginBottom: 'var(--spacing-md)'
              }}>
                <Clock size={18} />
                <span>Verificando atualizações...</span>
              </div>
            )}

            {updateStatus === 'available' && (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 'var(--spacing-sm)',
                color: 'var(--orange)',
                marginBottom: 'var(--spacing-md)',
                padding: 'var(--spacing-md)',
                background: 'var(--orange-light)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid rgba(255, 154, 0, 0.2)'
              }}>
                <AlertCircle size={18} />
                <span><strong>Nova versão disponível:</strong> 1.1.0</span>
              </div>
            )}

            {updateStatus === 'up-to-date' && (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 'var(--spacing-sm)',
                color: 'var(--green)',
                marginBottom: 'var(--spacing-md)',
                padding: 'var(--spacing-md)',
                background: 'var(--green-light)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid rgba(0, 255, 135, 0.2)'
              }}>
                <CheckCircle size={18} />
                <span>Seu sistema está atualizado!</span>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
            <button 
              className="btn btn-primary"
              onClick={handleCheckUpdates}
              disabled={isChecking}
            >
              <RefreshCw size={20} />
              {isChecking ? 'Verificando...' : 'Verificar Atualizações'}
            </button>
            
            {updateStatus === 'available' && (
              <button 
                className="btn btn-secondary"
                onClick={handleUpdate}
              >
                <Download size={20} />
                Instalar Atualização
              </button>
            )}
          </div>
        </div>

        <div className="card" style={{ 
          border: '1px solid var(--border-primary)',
          padding: 'var(--spacing-xl)'
        }}>
          <h3 style={{ 
            fontSize: '1.125rem', 
            fontWeight: '600',
            color: 'var(--text-primary)',
            marginBottom: 'var(--spacing-md)'
          }}>
            Histórico de Atualizações
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
            <div style={{ 
              padding: 'var(--spacing-md)',
              background: 'var(--bg-tertiary)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-primary)'
            }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 'var(--spacing-xs)'
              }}>
                <span style={{ 
                  fontWeight: '600',
                  color: 'var(--text-primary)'
                }}>
                  Versão 1.0.0
                </span>
                <span style={{ 
                  fontSize: '0.875rem',
                  color: 'var(--text-tertiary)'
                }}>
                  15/01/2024
                </span>
              </div>
              <p style={{ 
                fontSize: '0.875rem',
                color: 'var(--text-secondary)'
              }}>
                Versão inicial do sistema
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
