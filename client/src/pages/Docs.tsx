import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { HardDrive, Search, Plus, FileText, Users, Lock, ChevronRight, Trash2, ChevronLeft, Globe } from 'lucide-react';
import { usePermissions, RESOURCES, ACTIONS } from '../hooks/usePermissions';
import type { DocRepository, DocVisibility } from './docs/docsData';
import { formatDate } from './docs/docsData';
import DocsUserAccessPicker, { type AccessMember, type UserOption } from './docs/DocsUserAccessPicker';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useConfirm } from '@/components/ui/confirm-dialog';

const PAGE_SIZE = 8;

const VISIBILITY_LABEL: Record<DocVisibility, string> = {
  private: 'Privado',
  team: 'Equipe',
};

function RepoRowSkeleton() {
  return (
    <div className="flex items-center gap-3 border-b border-border px-4 py-3.5 last:border-0">
      <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
      <div className="min-w-0 flex-1">
        <Skeleton className="mb-1.5 h-4 w-1/3" />
        <Skeleton className="h-3.5 w-1/2" />
      </div>
    </div>
  );
}

export default function Docs() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const confirm = useConfirm();
  const canCreate = hasPermission(RESOURCES.DOCS, ACTIONS.CREATE);

  const [search, setSearch] = useState('');
  const [repos, setRepos] = useState<DocRepository[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showNewRepoModal, setShowNewRepoModal] = useState(false);
  const [newRepoName, setNewRepoName] = useState('');
  const [newRepoDesc, setNewRepoDesc] = useState('');
  const [newRepoVisibility, setNewRepoVisibility] = useState<DocVisibility>('private');
  const [accessMembers, setAccessMembers] = useState<AccessMember[]>([]);
  const [allUsers, setAllUsers] = useState<UserOption[]>([]);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (!showNewRepoModal) return;
    axios
      .get<UserOption[]>('/api/docs/share-users')
      .then((res) => setAllUsers(res.data))
      .catch(() => setAllUsers([]));
  }, [showNewRepoModal]);

  const loadRepos = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get<DocRepository[]>('/api/docs/repositories');
      setRepos(res.data);
    } catch {
      setError('Não foi possível carregar os repositórios.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRepos();
  }, []);

  const filteredRepos = repos.filter(
    (r) =>
      r.name.toLowerCase().includes(search.trim().toLowerCase()) ||
      r.description.toLowerCase().includes(search.trim().toLowerCase()) ||
      r.slug.toLowerCase().includes(search.trim().toLowerCase())
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const totalPages = Math.max(1, Math.ceil(filteredRepos.length / PAGE_SIZE));
  const paginatedRepos = filteredRepos.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleOpenRepo = (repo: DocRepository) => navigate(`/docs/${repo.id}`);

  const handleDeleteRepo = async (e: React.MouseEvent, repo: DocRepository) => {
    e.stopPropagation();
    if (repo.access !== 'owner') {
      toast.error('Apenas o proprietário pode excluir este repositório.');
      return;
    }
    const ok = await confirm({
      title: 'Excluir repositório',
      description: `Excluir o repositório "${repo.name}" e todos os arquivos?`,
      confirmLabel: 'Excluir',
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      await axios.delete(`/api/docs/repositories/${repo.id}`);
      setRepos((prev) => prev.filter((r) => r.id !== repo.id));
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : 'Erro ao excluir';
      toast.error(msg || 'Erro ao excluir');
    }
  };

  const handleCreateRepo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRepoName.trim()) return;
    try {
      const res = await axios.post<DocRepository>('/api/docs/repositories', {
        name: newRepoName.trim(),
        description: newRepoDesc.trim(),
        visibility: newRepoVisibility,
        members: newRepoVisibility === 'private' ? accessMembers.map((m) => ({ user_id: m.user_id, permission: m.permission })) : [],
      });
      setShowNewRepoModal(false);
      setNewRepoName('');
      setNewRepoDesc('');
      setNewRepoVisibility('private');
      setAccessMembers([]);
      navigate(`/docs/${res.data.id}`);
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : 'Erro ao criar';
      toast.error(msg || 'Erro ao criar repositório');
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="mb-1.5 bg-gradient-to-br from-foreground to-muted-foreground bg-clip-text text-[2.5rem] font-extrabold tracking-tight text-transparent">
          Arquivos
        </h1>
        <p className="text-base text-muted-foreground">
          Repositório de arquivos da equipe — envie documentos, organize em pastas e compartilhe com colegas.
        </p>
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="relative min-w-[300px] max-w-[500px] flex-1">
          <Search size={18} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar repositórios..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        {canCreate && (
          <Button onClick={() => setShowNewRepoModal(true)}>
            <Plus size={18} /> Novo repositório
          </Button>
        )}
      </div>

      {error && (
        <div role="alert" className="mb-6 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <Card className="gap-0 overflow-hidden p-0">
          {[1, 2, 3, 4].map((i) => (
            <RepoRowSkeleton key={i} />
          ))}
        </Card>
      ) : filteredRepos.length === 0 ? (
        <Card className="flex flex-col items-center px-4 py-16 text-center">
          <HardDrive size={48} strokeWidth={1.5} className="mb-4 text-muted-foreground opacity-50" />
          <h3 className="mb-1.5 text-lg font-bold text-foreground">{search ? 'Nenhum repositório encontrado' : 'Nenhum repositório ainda'}</h3>
          <p className="mb-4 max-w-[420px] text-sm text-muted-foreground">
            {search ? 'Tente outro termo de busca.' : 'Crie um repositório para armazenar e compartilhar arquivos com a equipe.'}
          </p>
          {!search && canCreate && (
            <Button onClick={() => setShowNewRepoModal(true)}>
              <Plus size={18} /> Criar repositório
            </Button>
          )}
        </Card>
      ) : (
        <Card className="gap-0 overflow-hidden p-0">
          <ul role="list">
            {paginatedRepos.map((repo, index) => (
              <li
                key={repo.id}
                onClick={() => handleOpenRepo(repo)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && handleOpenRepo(repo)}
                className="group flex cursor-pointer items-center gap-3.5 border-b border-border px-4 py-3.5 outline-none last:border-0 hover:bg-muted/60 focus:bg-muted/60"
              >
                <span className="w-5 shrink-0 text-right font-mono text-xs text-muted-foreground/60 tabular-nums">
                  {String((currentPage - 1) * PAGE_SIZE + index + 1).padStart(2, '0')}
                </span>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--purple-light)] text-[var(--purple)]">
                  <HardDrive size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-[0.9375rem] font-semibold text-foreground">{repo.name}</span>
                  <span className="block truncate text-sm text-muted-foreground">{repo.description || 'Sem descrição'}</span>
                </div>
                <div className="hidden shrink-0 items-center gap-4 text-xs text-muted-foreground sm:flex">
                  <Badge
                    variant="outline"
                    className={cn(
                      'gap-1 border-0 font-semibold',
                      repo.visibility === 'team' ? 'bg-[var(--blue-light)] text-[var(--blue)]' : 'bg-[var(--purple-light)] text-[var(--purple)]'
                    )}
                  >
                    {repo.visibility === 'team' ? <Users size={12} /> : <Lock size={12} />}
                    {VISIBILITY_LABEL[repo.visibility]}
                  </Badge>
                  <span className="flex items-center gap-1">
                    <FileText size={12} />
                    {repo.item_count} {repo.item_count === 1 ? 'item' : 'itens'}
                  </span>
                  <span>{formatDate(repo.updated_at)}</span>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {repo.access === 'owner' && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={(e) => handleDeleteRepo(e, repo)}
                      title="Excluir repositório"
                      aria-label="Excluir repositório"
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 size={14} />
                    </Button>
                  )}
                  <ChevronRight size={18} className="text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
                </div>
              </li>
            ))}
          </ul>
          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
              <Button variant="secondary" size="sm" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>
                <ChevronLeft size={16} /> Anterior
              </Button>
              <span className="text-xs text-muted-foreground">
                Página {currentPage} de {totalPages} · {filteredRepos.length} repositórios
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              >
                Próxima <ChevronRight size={16} />
              </Button>
            </div>
          )}
        </Card>
      )}

      <Dialog open={showNewRepoModal} onOpenChange={setShowNewRepoModal}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo repositório</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Espaço para arquivos, pastas e notas. Compartilhe com usuários específicos ou com toda a equipe.
            </p>
          </DialogHeader>
          <form onSubmit={handleCreateRepo} className="flex flex-col gap-4">
            <div>
              <Label className="mb-1.5">Nome</Label>
              <Input required value={newRepoName} onChange={(e) => setNewRepoName(e.target.value)} placeholder="Ex: Documentos da equipe" autoFocus />
            </div>
            <div>
              <Label className="mb-1.5">Descrição</Label>
              <Textarea rows={3} value={newRepoDesc} onChange={(e) => setNewRepoDesc(e.target.value)} placeholder="Para que serve este repositório?" />
            </div>
            <div>
              <Label className="mb-1.5">Quem pode acessar</Label>
              <Select value={newRepoVisibility} onValueChange={(v) => setNewRepoVisibility(v as DocVisibility)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">Usuários selecionados (+ você como dono)</SelectItem>
                  <SelectItem value="team">Toda a equipe (quem tem permissão Arquivos)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {newRepoVisibility === 'private' && (
              <DocsUserAccessPicker users={allUsers} value={accessMembers} onChange={setAccessMembers} excludeUserIds={user?.id ? [user.id] : []} />
            )}
            <DialogFooter className="flex-col items-stretch gap-3 sm:flex-col sm:items-stretch">
              <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <Globe size={14} className="mt-0.5 shrink-0" />
                <span>
                  {newRepoVisibility === 'private'
                    ? 'Somente os usuários marcados e você terão acesso.'
                    : 'Todos com permissão de Arquivos no sistema poderão ver.'}
                </span>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowNewRepoModal(false)}>
                  Cancelar
                </Button>
                <Button type="submit">Criar repositório</Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
