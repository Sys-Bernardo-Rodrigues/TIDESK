import { useState, useEffect } from 'react';
import axios from 'axios';
import { RefreshCw, Download, CheckCircle, AlertCircle, Clock, ExternalLink, GitBranch } from 'lucide-react';
import { formatDateBR } from '../utils/dateUtils';

interface UpdateInfo {
  currentVersion: string;
  latestVersion: string | null;
  hasUpdate: boolean;
  releaseNotes: string | null;
  releaseUrl: string | null;
  lastChecked: string | null;
}

interface Commit {
  hash: string;
  message: string;
}

export default function Atualizar() {
  const [isChecking, setIsChecking] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [commits, setCommits] = useState<Commit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [updateOutput, setUpdateOutput] = useState<string | null>(null);

  // Carregar versão atual ao montar
  useEffect(() => {
    fetchCurrentVersion();
    fetchCommits();
  }, []);

  const fetchCurrentVersion = async () => {
    try {
      const response = await axios.get('/api/updates/version');
      if (updateInfo) {
        setUpdateInfo({ ...updateInfo, currentVersion: response.data.version });
      }
    } catch (err) {
      console.error('Erro ao obter versão:', err);
    }
  };

  const fetchCommits = async () => {
    try {
      const response = await axios.get('/api/updates/commits?limit=10');
      setCommits(response.data);
    } catch (err) {
      console.error('Erro ao obter commits:', err);
    }
  };

  const handleCheckUpdates = async () => {
    setIsChecking(true);
    setError(null);
    setSuccess(null);
    
    try {
      const response = await axios.get('/api/updates/check');
      setUpdateInfo(response.data);
    } catch (err: any) {
      console.error('Erro ao verificar atualizações:', err);
      setError(err.response?.data?.error || 'Erro ao verificar atualizações');
    } finally {
      setIsChecking(false);
    }
  };

  const handleUpdate = async () => {
    if (!confirm('Tem certeza que deseja atualizar o sistema? Isso fará um git pull do repositório.')) {
      return;
    }

    setIsUpdating(true);
    setError(null);
    setSuccess(null);
    setUpdateOutput(null);
    
    try {
      const response = await axios.post('/api/updates/update', { branch: 'main' });
      if (response.data.success) {
        setSuccess(response.data.message);
        setUpdateOutput(response.data.output || null);
        // Atualizar informações após atualização
        await handleCheckUpdates();
        await fetchCommits();
      } else {
        setError(response.data.message || 'Erro ao atualizar');
      }
    } catch (err: any) {
      console.error('Erro ao atualizar:', err);
      setError(err.response?.data?.error || err.response?.data?.message || 'Erro ao atualizar o sistema');
    } finally {
      setIsUpdating(false);
    }
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
              Versão atual do sistema: <strong>{updateInfo?.currentVersion || 'Carregando...'}</strong>
            </p>

            {updateInfo?.lastChecked && (
              <p style={{ 
                color: 'var(--text-tertiary)',
                fontSize: '0.8125rem',
                marginBottom: 'var(--spacing-md)'
              }}>
                Última verificação: {formatDateBR(updateInfo.lastChecked, { includeTime: true })}
              </p>
            )}
            
            {isChecking && (
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

            {error && (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 'var(--spacing-sm)',
                color: 'var(--red)',
                marginBottom: 'var(--spacing-md)',
                padding: 'var(--spacing-md)',
                background: 'var(--red-light)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid rgba(255, 59, 48, 0.2)'
              }}>
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}

            {success && (
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
                <span>{success}</span>
              </div>
            )}

            {updateInfo?.hasUpdate && (
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column',
                gap: 'var(--spacing-sm)',
                color: 'var(--orange)',
                marginBottom: 'var(--spacing-md)',
                padding: 'var(--spacing-md)',
                background: 'var(--orange-light)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid rgba(255, 154, 0, 0.2)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                  <AlertCircle size={18} />
                  <span><strong>Nova versão disponível:</strong> {updateInfo.latestVersion}</span>
                </div>
                {updateInfo.releaseUrl && (
                  <a 
                    href={updateInfo.releaseUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 'var(--spacing-xs)',
                      color: 'var(--orange)',
                      textDecoration: 'none',
                      fontSize: '0.875rem',
                      marginTop: 'var(--spacing-xs)'
                    }}
                  >
                    Ver detalhes da release <ExternalLink size={14} />
                  </a>
                )}
              </div>
            )}

            {updateInfo && !updateInfo.hasUpdate && !isChecking && (
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

            {updateOutput && (
              <div style={{
                marginTop: 'var(--spacing-md)',
                padding: 'var(--spacing-md)',
                background: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-primary)',
                fontFamily: 'monospace',
                fontSize: '0.8125rem',
                color: 'var(--text-secondary)',
                whiteSpace: 'pre-wrap',
                maxHeight: '300px',
                overflow: 'auto'
              }}>
                {updateOutput}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 'var(--spacing-md)', flexWrap: 'wrap' }}>
            <button 
              className="btn btn-primary"
              onClick={handleCheckUpdates}
              disabled={isChecking || isUpdating}
              style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}
            >
              <RefreshCw size={20} style={{ animation: isChecking ? 'spin 1s linear infinite' : 'none' }} />
              {isChecking ? 'Verificando...' : 'Verificar Atualizações'}
            </button>
            
            {updateInfo?.hasUpdate && (
              <button 
                className="btn btn-secondary"
                onClick={handleUpdate}
                disabled={isUpdating || isChecking}
                style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}
              >
                <Download size={20} style={{ animation: isUpdating ? 'spin 1s linear infinite' : 'none' }} />
                {isUpdating ? 'Atualizando...' : 'Instalar Atualização'}
              </button>
            )}
          </div>
        </div>

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
            <GitBranch size={24} color="var(--purple)" />
            <h3 style={{ 
              fontSize: '1.125rem', 
              fontWeight: '600',
              color: 'var(--text-primary)'
            }}>
              Commits Recentes
            </h3>
          </div>
          
          {commits.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
              {commits.map((commit, index) => (
                <div 
                  key={index}
                  style={{ 
                    padding: 'var(--spacing-md)',
                    background: 'var(--bg-tertiary)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-primary)'
                  }}
                >
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 'var(--spacing-xs)'
                  }}>
                    <span style={{ 
                      fontFamily: 'monospace',
                      fontSize: '0.8125rem',
                      color: 'var(--text-secondary)',
                      fontWeight: '600'
                    }}>
                      {commit.hash}
                    </span>
                  </div>
                  <p style={{ 
                    fontSize: '0.875rem',
                    color: 'var(--text-primary)'
                  }}>
                    {commit.message}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ 
              color: 'var(--text-secondary)',
              fontSize: '0.875rem',
              fontStyle: 'italic'
            }}>
              Nenhum commit encontrado ou repositório não configurado
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
