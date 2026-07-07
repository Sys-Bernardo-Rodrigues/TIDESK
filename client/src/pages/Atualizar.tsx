import { useState, useEffect } from 'react';
import axios from 'axios';
import { RefreshCw, Download, CheckCircle, AlertCircle, Clock, ExternalLink, GitBranch } from 'lucide-react';
import { formatDateBR } from '../utils/dateUtils';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm-dialog';

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

function Banner({ tone, icon: Icon, children }: { tone: 'blue' | 'red' | 'green' | 'orange'; icon: typeof AlertCircle; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        'mb-4 flex items-start gap-2 rounded-lg border px-4 py-3 text-sm',
        tone === 'blue' && 'border-[var(--blue)]/20 bg-[var(--blue-light)] text-[var(--blue)]',
        tone === 'red' && 'border-[var(--red)]/20 bg-[var(--red-light)] text-[var(--red)]',
        tone === 'green' && 'border-[var(--green)]/20 bg-[var(--green-light)] text-[var(--green)]',
        tone === 'orange' && 'border-[var(--orange)]/20 bg-[var(--orange-light)] text-[var(--orange)]'
      )}
    >
      <Icon size={18} className="mt-0.5 shrink-0" />
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
}

export default function Atualizar() {
  const confirm = useConfirm();
  const [isChecking, setIsChecking] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [commits, setCommits] = useState<Commit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [updateOutput, setUpdateOutput] = useState<string | null>(null);

  useEffect(() => {
    fetchCurrentVersion();
    fetchCommits();
  }, []);

  const fetchCurrentVersion = async () => {
    try {
      const response = await axios.get('/api/updates/version');
      setUpdateInfo((prev) =>
        prev
          ? { ...prev, currentVersion: response.data.version }
          : { currentVersion: response.data.version, latestVersion: null, hasUpdate: false, releaseNotes: null, releaseUrl: null, lastChecked: null }
      );
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
    const ok = await confirm({
      title: 'Atualizar sistema',
      description: 'Tem certeza que deseja atualizar o sistema? Isso fará um git pull do repositório.',
      confirmLabel: 'Atualizar',
      variant: 'destructive',
    });
    if (!ok) return;

    setIsUpdating(true);
    setError(null);
    setSuccess(null);
    setUpdateOutput(null);

    try {
      const response = await axios.post('/api/updates/update', { branch: 'main' });
      if (response.data.success) {
        setSuccess(response.data.message);
        setUpdateOutput(response.data.output || null);
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
      <div className="mb-8">
        <h1 className="mb-1.5 bg-gradient-to-br from-foreground to-muted-foreground bg-clip-text text-[2.5rem] font-extrabold tracking-tight text-transparent">
          Atualizar Sistema
        </h1>
        <p className="text-base text-muted-foreground">Verifique e instale atualizações do sistema</p>
      </div>

      <div className="flex flex-col gap-5">
        <Card className="px-6 py-6">
          <div className="mb-5 flex items-center gap-3">
            <RefreshCw size={24} className="text-[var(--blue)]" />
            <h2 className="text-2xl font-semibold text-foreground">Verificar Atualizações</h2>
          </div>

          <div className="mb-5">
            <p className="mb-3 text-[0.9375rem] text-muted-foreground">
              Versão atual do sistema: <strong className="text-foreground">{updateInfo?.currentVersion || 'Carregando...'}</strong>
            </p>

            {updateInfo?.lastChecked && (
              <p className="mb-3 text-[0.8125rem] text-muted-foreground/80">
                Última verificação: {formatDateBR(updateInfo.lastChecked, { includeTime: true })}
              </p>
            )}

            {isChecking && (
              <div className="mb-3 flex items-center gap-2 text-[var(--blue)]">
                <Clock size={18} />
                <span>Verificando atualizações...</span>
              </div>
            )}

            {error && (
              <Banner tone="red" icon={AlertCircle}>
                <span>{error}</span>
              </Banner>
            )}

            {success && (
              <Banner tone="green" icon={CheckCircle}>
                <span>{success}</span>
              </Banner>
            )}

            {updateInfo?.hasUpdate && (
              <Banner tone="orange" icon={AlertCircle}>
                <span>
                  <strong>Nova versão disponível:</strong> {updateInfo.latestVersion}
                </span>
                {updateInfo.releaseUrl && (
                  <a
                    href={updateInfo.releaseUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[0.875rem] font-medium underline-offset-2 hover:underline"
                  >
                    Ver detalhes da release <ExternalLink size={14} />
                  </a>
                )}
              </Banner>
            )}

            {updateInfo && !updateInfo.hasUpdate && !isChecking && (
              <Banner tone="green" icon={CheckCircle}>
                <span>Seu sistema está atualizado!</span>
              </Banner>
            )}

            {updateOutput && (
              <pre className="mt-3 max-h-[300px] overflow-auto rounded-lg border border-border bg-muted p-3 font-mono text-[0.8125rem] whitespace-pre-wrap text-muted-foreground">
                {updateOutput}
              </pre>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={handleCheckUpdates} disabled={isChecking || isUpdating}>
              <RefreshCw size={18} className={isChecking ? 'animate-spin' : ''} />
              {isChecking ? 'Verificando...' : 'Verificar Atualizações'}
            </Button>

            {updateInfo?.hasUpdate && (
              <Button variant="secondary" onClick={handleUpdate} disabled={isUpdating || isChecking}>
                <Download size={18} className={isUpdating ? 'animate-spin' : ''} />
                {isUpdating ? 'Atualizando...' : 'Instalar Atualização'}
              </Button>
            )}
          </div>
        </Card>

        <Card className="px-6 py-6">
          <div className="mb-5 flex items-center gap-3">
            <GitBranch size={24} className="text-[var(--purple)]" />
            <h3 className="text-lg font-semibold text-foreground">Commits Recentes</h3>
          </div>

          {commits.length > 0 ? (
            <div className="flex flex-col gap-3">
              {commits.map((commit, index) => (
                <div key={index} className="rounded-lg border border-border bg-muted/50 px-4 py-3">
                  <span className="mb-1 block font-mono text-[0.8125rem] font-semibold text-muted-foreground">{commit.hash}</span>
                  <p className="text-sm text-foreground">{commit.message}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">Nenhum commit encontrado ou repositório não configurado</p>
          )}
        </Card>
      </div>
    </div>
  );
}
