import { useState, useEffect } from 'react';
import axios from 'axios';
import { Database, Download, Clock, HardDrive, Trash2, RefreshCw, AlertCircle, Settings2, Save, Mail, X, Upload } from 'lucide-react';
import { formatDateBR } from '../utils/dateUtils';
import { usePermissions, RESOURCES, ACTIONS } from '../hooks/usePermissions';

interface Backup {
  id: string;
  name: string;
  filename: string;
  date: string;
  size: string;
  sizeBytes: number;
  type: string;
  status: string;
}

interface BackupConfig {
  enabled: boolean;
  intervalHours: number;
  retentionDays: number;
  emailEnabled: boolean;
  emailTo: string[];
}

export default function Backup() {
  const [searchTerm, setSearchTerm] = useState('');
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [config, setConfig] = useState<BackupConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [configSaving, setConfigSaving] = useState(false);
  const [configForm, setConfigForm] = useState<BackupConfig>({
    enabled: false,
    intervalHours: 24,
    retentionDays: 30,
    emailEnabled: false,
    emailTo: []
  });
  const [emailInput, setEmailInput] = useState('');
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const { hasPermission } = usePermissions();

  const canCreate = hasPermission(RESOURCES.CONFIG, ACTIONS.CREATE);
  const canEdit = hasPermission(RESOURCES.CONFIG, ACTIONS.EDIT);
  const canDelete = hasPermission(RESOURCES.CONFIG, ACTIONS.DELETE);

  // Buscar configuração de backup automático
  const fetchConfig = async () => {
    try {
      setConfigLoading(true);
      const response = await axios.get<BackupConfig>('/api/backup/config');
      setConfig(response.data);
      setConfigForm(response.data);
    } catch (err) {
      console.error('Erro ao buscar configuração:', err);
    } finally {
      setConfigLoading(false);
    }
  };

  // Salvar configuração
  const saveConfig = async () => {
    if (!canEdit) return;
    try {
      setConfigSaving(true);
      setError(null);
      setSuccess(null);
      const response = await axios.put<BackupConfig>('/api/backup/config', configForm);
      setConfig(response.data);
      setConfigForm(response.data);
      setSuccess('Configuração do backup automático salva com sucesso!');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao salvar configuração');
    } finally {
      setConfigSaving(false);
    }
  };

  // Buscar backups
  const fetchBackups = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get('/api/backup');
      setBackups(response.data);
    } catch (err: any) {
      console.error('Erro ao buscar backups:', err);
      setError('Erro ao carregar backups. Verifique se o servidor está rodando.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBackups();
    fetchConfig();
  }, []);

  // Criar backup
  const createBackup = async () => {
    if (!canCreate) {
      alert('Você não tem permissão para criar backups');
      return;
    }

    if (!confirm('Deseja criar um novo backup do banco de dados?')) {
      return;
    }

    try {
      setCreating(true);
      setError(null);
      setSuccess(null);
      
      await axios.post('/api/backup');
      setSuccess('Backup criado com sucesso!');
      await fetchBackups();
    } catch (err: any) {
      console.error('Erro ao criar backup:', err);
      setError(err.response?.data?.error || 'Erro ao criar backup. Verifique se o banco de dados está acessível.');
    } finally {
      setCreating(false);
    }
  };

  // Download de backup
  const downloadBackup = async (filename: string) => {
    try {
      const response = await axios.get(`/api/backup/${filename}/download`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Erro ao fazer download:', err);
      alert('Erro ao fazer download do backup');
    }
  };

  // Restaurar backup
  const restoreBackup = async (filename: string) => {
    if (!canEdit) {
      alert('Você não tem permissão para restaurar backups');
      return;
    }

    if (!confirm('ATENÇÃO: Esta ação irá substituir todos os dados atuais pelos dados do backup. Esta operação não pode ser desfeita. Deseja continuar?')) {
      return;
    }

    if (!confirm('Tem certeza? Todos os dados atuais serão perdidos!')) {
      return;
    }

    try {
      setError(null);
      setSuccess(null);
      
      const response = await axios.post(`/api/backup/${filename}/restore`);
      setSuccess(response.data.message + (response.data.note ? ' ' + response.data.note : ''));
      alert(response.data.message + '\n\n' + (response.data.note || ''));
    } catch (err: any) {
      console.error('Erro ao restaurar backup:', err);
      setError(err.response?.data?.error || 'Erro ao restaurar backup');
      alert('Erro ao restaurar backup: ' + (err.response?.data?.error || 'Erro desconhecido'));
    }
  };

  // Enviar backup por email
  const sendBackupByEmail = async (filename: string) => {
    if (!canEdit) {
      alert('Você não tem permissão para enviar backups por email');
      return;
    }

    try {
      setSendingEmail(filename);
      setError(null);
      setSuccess(null);
      
      await axios.post(`/api/backup/${filename}/send`);
      setSuccess('Backup enviado por email com sucesso!');
    } catch (err: any) {
      console.error('Erro ao enviar backup:', err);
      setError(err.response?.data?.error || 'Erro ao enviar backup por email');
    } finally {
      setSendingEmail(null);
    }
  };

  // Adicionar email à lista
  const addEmail = () => {
    const email = emailInput.trim();
    if (!email || !email.includes('@')) {
      alert('Digite um email válido');
      return;
    }
    if (configForm.emailTo.includes(email)) {
      alert('Este email já está na lista');
      return;
    }
    setConfigForm((c) => ({ ...c, emailTo: [...c.emailTo, email] }));
    setEmailInput('');
  };

  // Remover email da lista
  const removeEmail = (email: string) => {
    setConfigForm((c) => ({ ...c, emailTo: c.emailTo.filter((e) => e !== email) }));
  };

  // Upload de backup
  const handleUploadBackup = async () => {
    if (!canCreate) {
      alert('Você não tem permissão para fazer upload de backups');
      return;
    }

    if (!uploadFile) {
      alert('Selecione um arquivo para fazer upload');
      return;
    }

    // Validar extensão
    const ext = uploadFile.name.toLowerCase().split('.').pop();
    if (ext !== 'db' && ext !== 'sql') {
      alert('Apenas arquivos .db e .sql são permitidos');
      return;
    }

    // Validar tamanho (500MB)
    if (uploadFile.size > 500 * 1024 * 1024) {
      alert('Arquivo muito grande. Tamanho máximo: 500MB');
      return;
    }

    try {
      setUploading(true);
      setError(null);
      setSuccess(null);

      const formData = new FormData();
      formData.append('backupFile', uploadFile);

      await axios.post('/api/backup/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      setSuccess('Backup enviado com sucesso!');
      setUploadFile(null);
      // Resetar input de arquivo
      const fileInput = document.getElementById('backup-upload-input') as HTMLInputElement;
      if (fileInput) {
        fileInput.value = '';
      }
      await fetchBackups();
    } catch (err: any) {
      console.error('Erro ao fazer upload:', err);
      setError(err.response?.data?.error || 'Erro ao fazer upload do backup');
    } finally {
      setUploading(false);
    }
  };

  // Deletar backup
  const deleteBackup = async (filename: string) => {
    if (!canDelete) {
      alert('Você não tem permissão para deletar backups');
      return;
    }

    if (!confirm('Deseja realmente deletar este backup?')) {
      return;
    }

    try {
      setError(null);
      setSuccess(null);
      
      await axios.delete(`/api/backup/${filename}`);
      setSuccess('Backup deletado com sucesso!');
      await fetchBackups();
    } catch (err: any) {
      console.error('Erro ao deletar backup:', err);
      setError(err.response?.data?.error || 'Erro ao deletar backup');
    }
  };

  const filteredBackups = backups.filter(backup =>
    backup.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    backup.filename.toLowerCase().includes(searchTerm.toLowerCase())
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

      {/* Mensagens de erro e sucesso */}
      {error && (
        <div className="card" style={{
          marginBottom: 'var(--spacing-lg)',
          padding: 'var(--spacing-md)',
          backgroundColor: 'var(--danger-light)',
          border: '1px solid var(--danger)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-sm)'
        }}>
          <AlertCircle size={20} color="var(--danger)" />
          <span style={{ color: 'var(--danger)' }}>{error}</span>
        </div>
      )}

      {success && (
        <div className="card" style={{
          marginBottom: 'var(--spacing-lg)',
          padding: 'var(--spacing-md)',
          backgroundColor: 'var(--success-light)',
          border: '1px solid var(--success)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-sm)'
        }}>
          <span style={{ color: 'var(--success)' }}>{success}</span>
        </div>
      )}

      {/* Configuração do backup automático */}
      {canEdit && (
        <div className="card" style={{
          marginBottom: 'var(--spacing-lg)',
          padding: 'var(--spacing-lg)',
          border: '1px solid var(--border-primary)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-sm)',
            marginBottom: 'var(--spacing-md)'
          }}>
            <Settings2 size={22} color="var(--purple)" />
            <h2 style={{
              fontSize: '1.25rem',
              fontWeight: '600',
              color: 'var(--text-primary)',
              margin: 0
            }}>
              Backup automático
            </h2>
          </div>
          {configLoading ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Carregando...</p>
          ) : (
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 'var(--spacing-lg)',
              alignItems: 'flex-end'
            }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-sm)',
                cursor: 'pointer',
                fontSize: '0.9375rem',
                color: 'var(--text-primary)'
              }}>
                <input
                  type="checkbox"
                  checked={configForm.enabled}
                  onChange={(e) => setConfigForm((c) => ({ ...c, enabled: e.target.checked }))}
                />
                Ativar backup automático
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                  Intervalo (horas)
                </label>
                <input
                  type="number"
                  className="input"
                  min={1}
                  max={168}
                  value={configForm.intervalHours}
                  onChange={(e) =>
                    setConfigForm((c) => ({
                      ...c,
                      intervalHours: Math.min(168, Math.max(1, parseInt(e.target.value) || 1))
                    }))
                  }
                  style={{ width: '90px' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                  Manter backups por (dias)
                </label>
                <input
                  type="number"
                  className="input"
                  min={1}
                  max={365}
                  value={configForm.retentionDays}
                  onChange={(e) =>
                    setConfigForm((c) => ({
                      ...c,
                      retentionDays: Math.min(365, Math.max(1, parseInt(e.target.value) || 1))
                    }))
                  }
                  style={{ width: '90px' }}
                />
              </div>
              <button
                className="btn btn-primary"
                onClick={saveConfig}
                disabled={configSaving}
                style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}
              >
                <Save size={18} />
                {configSaving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          )}
          {config && !configLoading && (
            <>
              <div style={{ marginTop: 'var(--spacing-md)', paddingTop: 'var(--spacing-md)', borderTop: '1px solid var(--border-primary)' }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-sm)',
                  cursor: 'pointer',
                  fontSize: '0.9375rem',
                  color: 'var(--text-primary)',
                  marginBottom: 'var(--spacing-sm)'
                }}>
                  <input
                    type="checkbox"
                    checked={configForm.emailEnabled}
                    onChange={(e) => setConfigForm((c) => ({ ...c, emailEnabled: e.target.checked }))}
                  />
                  Enviar backups por email automaticamente
                </label>
                {configForm.emailEnabled && (
                  <div style={{ marginTop: 'var(--spacing-md)' }}>
                    <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-sm)' }}>
                      <input
                        type="email"
                        className="input"
                        placeholder="Digite o email de destino"
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && addEmail()}
                        style={{ flex: 1 }}
                      />
                      <button className="btn btn-secondary" onClick={addEmail}>
                        Adicionar
                      </button>
                    </div>
                    {configForm.emailTo.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-xs)' }}>
                        {configForm.emailTo.map((email) => (
                          <span
                            key={email}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 'var(--spacing-xs)',
                              padding: '4px 8px',
                              backgroundColor: 'var(--bg-secondary)',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: '0.8125rem'
                            }}
                          >
                            {email}
                            <button
                              onClick={() => removeEmail(email)}
                              style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                color: 'var(--text-secondary)',
                                padding: 0,
                                display: 'flex',
                                alignItems: 'center'
                              }}
                            >
                              <X size={14} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    <p style={{
                      marginTop: 'var(--spacing-sm)',
                      marginBottom: 0,
                      fontSize: '0.75rem',
                      color: 'var(--text-tertiary)'
                    }}>
                      Configure as variáveis de ambiente SMTP_HOST, SMTP_USER, SMTP_PASSWORD no servidor.
                    </p>
                  </div>
                )}
              </div>
              <p style={{
                marginTop: 'var(--spacing-md)',
                marginBottom: 0,
                fontSize: '0.8125rem',
                color: 'var(--text-secondary)'
              }}>
                {config.enabled
                  ? `Backup a cada ${config.intervalHours}h. Backups com mais de ${config.retentionDays} dias são removidos automaticamente.`
                  : 'Backup automático desativado. Ative e salve para agendar.'}
              </p>
            </>
          )}
        </div>
      )}

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
        <div style={{ display: 'flex', gap: 'var(--spacing-sm)', flexWrap: 'wrap' }}>
          <button 
            className="btn btn-secondary"
            onClick={fetchBackups}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}
          >
            <RefreshCw size={18} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            Atualizar
          </button>
          {canCreate && (
            <>
              <label
                className="btn btn-secondary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 'var(--spacing-xs)',
                  cursor: uploading ? 'not-allowed' : 'pointer',
                  opacity: uploading ? 0.6 : 1,
                  margin: 0,
                  marginBottom: 0,
                  padding: '0.625rem 1.25rem',
                  border: '1px solid var(--border-primary)',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  userSelect: 'none'
                }}
              >
                <Upload size={18} />
                {uploading ? 'Enviando...' : 'Upload Backup'}
                <input
                  id="backup-upload-input"
                  type="file"
                  accept=".db,.sql"
                  style={{ display: 'none' }}
                  disabled={uploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setUploadFile(file);
                    }
                  }}
                />
              </label>
              {uploadFile && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-xs)',
                  padding: 'var(--spacing-xs) var(--spacing-sm)',
                  backgroundColor: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.875rem'
                }}>
                  <span>{uploadFile.name}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    ({(uploadFile.size / (1024 * 1024)).toFixed(2)} MB)
                  </span>
                  <button
                    onClick={() => {
                      setUploadFile(null);
                      const fileInput = document.getElementById('backup-upload-input') as HTMLInputElement;
                      if (fileInput) fileInput.value = '';
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                      color: 'var(--text-secondary)'
                    }}
                  >
                    <X size={16} />
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={handleUploadBackup}
                    disabled={uploading}
                    style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}
                  >
                    {uploading ? 'Enviando...' : 'Enviar'}
                  </button>
                </div>
              )}
              <button 
                className="btn btn-primary"
                onClick={createBackup}
                disabled={creating}
                style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}
              >
                <Database size={20} />
                {creating ? 'Criando...' : 'Novo Backup'}
              </button>
            </>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
        {loading ? (
          <div className="card" style={{ 
            textAlign: 'center', 
            padding: 'var(--spacing-2xl)',
            border: '1px solid var(--border-primary)'
          }}>
            <RefreshCw size={48} style={{ 
              marginBottom: 'var(--spacing-md)',
              animation: 'spin 1s linear infinite',
              color: 'var(--text-tertiary)'
            }} />
            <p style={{ 
              color: 'var(--text-secondary)',
              fontSize: '1rem'
            }}>
              Carregando backups...
            </p>
          </div>
        ) : filteredBackups.length === 0 ? (
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
            {!searchTerm && canCreate && (
              <button 
                className="btn btn-primary" 
                style={{ marginTop: 'var(--spacing-md)' }}
                onClick={createBackup}
                disabled={creating}
              >
                <Database size={20} />
                {creating ? 'Criando...' : 'Criar Primeiro Backup'}
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
                {canEdit && (
                  <button 
                    className="btn btn-secondary btn-sm"
                    onClick={() => restoreBackup(backup.filename)}
                    title="Restaurar este backup"
                  >
                    <RefreshCw size={16} />
                    Restaurar
                  </button>
                )}
                <button 
                  className="btn btn-secondary btn-sm"
                  onClick={() => downloadBackup(backup.filename)}
                  title="Baixar este backup"
                >
                  <Download size={16} />
                  Download
                </button>
                {canEdit && (
                  <button 
                    className="btn btn-secondary btn-sm"
                    onClick={() => sendBackupByEmail(backup.filename)}
                    title="Enviar este backup por email"
                    disabled={sendingEmail === backup.filename}
                  >
                    <Mail size={16} />
                    {sendingEmail === backup.filename ? 'Enviando...' : 'Email'}
                  </button>
                )}
                {canDelete && (
                  <button 
                    className="btn btn-secondary btn-sm"
                    onClick={() => deleteBackup(backup.filename)}
                    title="Deletar este backup"
                    style={{ color: 'var(--danger)' }}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
