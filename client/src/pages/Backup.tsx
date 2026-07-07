import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Database, Download, Clock, HardDrive, Trash2, RefreshCw, AlertCircle, Settings2, Save, Mail, X, Upload } from 'lucide-react';
import { formatDateBR } from '../utils/dateUtils';
import { usePermissions, RESOURCES, ACTIONS } from '../hooks/usePermissions';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { useConfirm } from '@/components/ui/confirm-dialog';

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
  const confirm = useConfirm();
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
    emailTo: [],
  });
  const [emailInput, setEmailInput] = useState('');
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const { hasPermission } = usePermissions();

  const canCreate = hasPermission(RESOURCES.CONFIG, ACTIONS.CREATE);
  const canEdit = hasPermission(RESOURCES.CONFIG, ACTIONS.EDIT);
  const canDelete = hasPermission(RESOURCES.CONFIG, ACTIONS.DELETE);

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

  const createBackup = async () => {
    if (!canCreate) {
      toast.error('Você não tem permissão para criar backups');
      return;
    }
    const ok = await confirm({
      title: 'Criar backup',
      description: 'Deseja criar um novo backup do banco de dados?',
    });
    if (!ok) return;

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

  const downloadBackup = async (filename: string) => {
    try {
      const response = await axios.get(`/api/backup/${filename}/download`, { responseType: 'blob' });
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
      toast.error('Erro ao fazer download do backup');
    }
  };

  const restoreBackup = async (filename: string) => {
    if (!canEdit) {
      toast.error('Você não tem permissão para restaurar backups');
      return;
    }

    const ok1 = await confirm({
      title: 'Restaurar backup',
      description:
        'ATENÇÃO: Esta ação irá substituir todos os dados atuais pelos dados do backup. Esta operação não pode ser desfeita. Deseja continuar?',
      confirmLabel: 'Continuar',
      variant: 'destructive',
    });
    if (!ok1) return;

    const ok2 = await confirm({
      title: 'Confirmar restauração',
      description: 'Tem certeza? Todos os dados atuais serão perdidos!',
      confirmLabel: 'Restaurar',
      variant: 'destructive',
    });
    if (!ok2) return;

    try {
      setError(null);
      setSuccess(null);
      const response = await axios.post(`/api/backup/${filename}/restore`);
      const message = response.data.message + (response.data.note ? ' ' + response.data.note : '');
      setSuccess(message);
      toast.success(message);
    } catch (err: any) {
      console.error('Erro ao restaurar backup:', err);
      setError(err.response?.data?.error || 'Erro ao restaurar backup');
      toast.error('Erro ao restaurar backup: ' + (err.response?.data?.error || 'Erro desconhecido'));
    }
  };

  const sendBackupByEmail = async (filename: string) => {
    if (!canEdit) {
      toast.error('Você não tem permissão para enviar backups por email');
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

  const addEmail = () => {
    const email = emailInput.trim();
    if (!email || !email.includes('@')) {
      toast.error('Digite um email válido');
      return;
    }
    if (configForm.emailTo.includes(email)) {
      toast.error('Este email já está na lista');
      return;
    }
    setConfigForm((c) => ({ ...c, emailTo: [...c.emailTo, email] }));
    setEmailInput('');
  };

  const removeEmail = (email: string) => {
    setConfigForm((c) => ({ ...c, emailTo: c.emailTo.filter((e) => e !== email) }));
  };

  const handleUploadBackup = async () => {
    if (!canCreate) {
      toast.error('Você não tem permissão para fazer upload de backups');
      return;
    }
    if (!uploadFile) {
      toast.error('Selecione um arquivo para fazer upload');
      return;
    }

    const ext = uploadFile.name.toLowerCase().split('.').pop();
    if (ext !== 'db' && ext !== 'sql') {
      toast.error('Apenas arquivos .db e .sql são permitidos');
      return;
    }
    if (uploadFile.size > 500 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Tamanho máximo: 500MB');
      return;
    }

    try {
      setUploading(true);
      setError(null);
      setSuccess(null);

      const formData = new FormData();
      formData.append('backupFile', uploadFile);
      await axios.post('/api/backup/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setSuccess('Backup enviado com sucesso!');
      setUploadFile(null);
      const fileInput = document.getElementById('backup-upload-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      await fetchBackups();
    } catch (err: any) {
      console.error('Erro ao fazer upload:', err);
      setError(err.response?.data?.error || 'Erro ao fazer upload do backup');
    } finally {
      setUploading(false);
    }
  };

  const deleteBackup = async (filename: string) => {
    if (!canDelete) {
      toast.error('Você não tem permissão para deletar backups');
      return;
    }
    const ok = await confirm({
      title: 'Excluir backup',
      description: 'Deseja realmente deletar este backup?',
      confirmLabel: 'Excluir',
      variant: 'destructive',
    });
    if (!ok) return;

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

  const filteredBackups = backups.filter(
    (backup) =>
      backup.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      backup.filename.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Backup</h1>
        <p className="mt-1 text-muted-foreground">Gerencie os backups do sistema e restaure dados quando necessário</p>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-destructive bg-destructive/10 p-3 text-destructive">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="mb-4 rounded-lg border p-3" style={{ borderColor: 'var(--green)', background: 'var(--green-light)', color: 'var(--green)' }}>
          {success}
        </div>
      )}

      {canEdit && (
        <Card className="mb-5 p-5">
          <div className="mb-3 flex items-center gap-2">
            <Settings2 size={20} className="text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Backup automático</h2>
          </div>
          {configLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : (
            <div className="flex flex-wrap items-end gap-5">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                <Checkbox
                  checked={configForm.enabled}
                  onCheckedChange={(checked) => setConfigForm((c) => ({ ...c, enabled: checked === true }))}
                />
                Ativar backup automático
              </label>
              <div className="flex flex-col gap-1">
                <Label className="text-xs text-muted-foreground">Intervalo (horas)</Label>
                <Input
                  type="number"
                  min={1}
                  max={168}
                  value={configForm.intervalHours}
                  onChange={(e) =>
                    setConfigForm((c) => ({ ...c, intervalHours: Math.min(168, Math.max(1, parseInt(e.target.value) || 1)) }))
                  }
                  className="w-[90px]"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs text-muted-foreground">Manter backups por (dias)</Label>
                <Input
                  type="number"
                  min={1}
                  max={365}
                  value={configForm.retentionDays}
                  onChange={(e) =>
                    setConfigForm((c) => ({ ...c, retentionDays: Math.min(365, Math.max(1, parseInt(e.target.value) || 1)) }))
                  }
                  className="w-[90px]"
                />
              </div>
              <Button onClick={saveConfig} disabled={configSaving}>
                <Save size={17} />
                {configSaving ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          )}

          {config && !configLoading && (
            <>
              <div className="mt-4 border-t border-border pt-4">
                <label className="mb-2 flex cursor-pointer items-center gap-2 text-sm text-foreground">
                  <Checkbox
                    checked={configForm.emailEnabled}
                    onCheckedChange={(checked) => setConfigForm((c) => ({ ...c, emailEnabled: checked === true }))}
                  />
                  Enviar backups por email automaticamente
                </label>
                {configForm.emailEnabled && (
                  <div className="mt-3">
                    <div className="mb-2 flex gap-2">
                      <Input
                        type="email"
                        placeholder="Digite o email de destino"
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addEmail()}
                        className="flex-1"
                      />
                      <Button variant="secondary" onClick={addEmail}>
                        Adicionar
                      </Button>
                    </div>
                    {configForm.emailTo.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {configForm.emailTo.map((email) => (
                          <span
                            key={email}
                            className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs"
                          >
                            {email}
                            <button onClick={() => removeEmail(email)} className="text-muted-foreground hover:text-foreground">
                              <X size={13} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="mt-2 text-xs text-muted-foreground">
                      Configure as variáveis de ambiente SMTP_HOST, SMTP_USER, SMTP_PASSWORD no servidor.
                    </p>
                  </div>
                )}
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                {config.enabled
                  ? `Backup a cada ${config.intervalHours}h. Backups com mais de ${config.retentionDays} dias são removidos automaticamente.`
                  : 'Backup automático desativado. Ative e salve para agendar.'}
              </p>
            </>
          )}
        </Card>
      )}

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="max-w-[500px] min-w-[280px] flex-1">
          <Input placeholder="Buscar backups..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={fetchBackups} disabled={loading}>
            <RefreshCw size={17} className={cn(loading && 'animate-spin')} />
            Atualizar
          </Button>
          {canCreate && (
            <>
              <label>
                <Button variant="secondary" disabled={uploading} asChild>
                  <span>
                    <Upload size={17} />
                    {uploading ? 'Enviando...' : 'Upload Backup'}
                  </span>
                </Button>
                <input
                  id="backup-upload-input"
                  type="file"
                  accept=".db,.sql"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setUploadFile(file);
                  }}
                />
              </label>
              {uploadFile && (
                <div className="flex items-center gap-2 rounded-md bg-muted px-2.5 py-1.5 text-sm">
                  <span>{uploadFile.name}</span>
                  <span className="text-muted-foreground">({(uploadFile.size / (1024 * 1024)).toFixed(2)} MB)</span>
                  <button
                    onClick={() => {
                      setUploadFile(null);
                      const fileInput = document.getElementById('backup-upload-input') as HTMLInputElement;
                      if (fileInput) fileInput.value = '';
                    }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X size={15} />
                  </button>
                  <Button size="sm" onClick={handleUploadBackup} disabled={uploading}>
                    {uploading ? 'Enviando...' : 'Enviar'}
                  </Button>
                </div>
              )}
              <Button onClick={createBackup} disabled={creating}>
                <Database size={18} />
                {creating ? 'Criando...' : 'Novo Backup'}
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {loading ? (
          <>
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </>
        ) : filteredBackups.length === 0 ? (
          <Card className="items-center p-10 text-center">
            <Database size={40} className="mx-auto mb-3 text-muted-foreground" />
            <p className="mb-3 text-muted-foreground">{searchTerm ? 'Nenhum backup encontrado' : 'Nenhum backup criado ainda'}</p>
            {!searchTerm && canCreate && (
              <Button onClick={createBackup} disabled={creating} className="mx-auto">
                <Database size={18} />
                {creating ? 'Criando...' : 'Criar Primeiro Backup'}
              </Button>
            )}
          </Card>
        ) : (
          filteredBackups.map((backup) => (
            <Card key={backup.id} className="flex-row flex-wrap items-center justify-between gap-3 px-4 py-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Database size={18} className="text-[var(--blue)]" />
                  <h3 className="text-base font-semibold text-foreground">{backup.name}</h3>
                </div>
                <div className="mt-1 ml-6 flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock size={13} />
                    {formatDateBR(backup.date, { includeTime: true })}
                  </span>
                  <span className="flex items-center gap-1">
                    <HardDrive size={13} />
                    {backup.size}
                  </span>
                  <span>
                    <strong className="text-foreground">Tipo:</strong> {backup.type}
                  </span>
                  <span>
                    <strong className="text-foreground">Status:</strong> {backup.status}
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                {canEdit && (
                  <Button variant="secondary" size="sm" onClick={() => restoreBackup(backup.filename)} title="Restaurar este backup">
                    <RefreshCw size={14} />
                    Restaurar
                  </Button>
                )}
                <Button variant="secondary" size="sm" onClick={() => downloadBackup(backup.filename)} title="Baixar este backup">
                  <Download size={14} />
                  Download
                </Button>
                {canEdit && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => sendBackupByEmail(backup.filename)}
                    title="Enviar este backup por email"
                    disabled={sendingEmail === backup.filename}
                  >
                    <Mail size={14} />
                    {sendingEmail === backup.filename ? 'Enviando...' : 'Email'}
                  </Button>
                )}
                {canDelete && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => deleteBackup(backup.filename)}
                    title="Deletar este backup"
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 size={15} />
                  </Button>
                )}
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
