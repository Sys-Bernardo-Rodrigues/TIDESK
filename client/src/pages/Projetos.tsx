import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import {
  FolderKanban,
  Plus,
  MoreHorizontal,
  Trash2,
  LayoutList,
  ArrowRight,
  Calendar,
} from 'lucide-react';
import { usePermissions, RESOURCES, ACTIONS } from '../hooks/usePermissions';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useConfirm } from '@/components/ui/confirm-dialog';

interface Project {
  id: number;
  name: string;
  description: string | null;
  created_by: number;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
  tasks_count: number;
}

type Accent = 'purple' | 'blue' | 'green' | 'orange' | 'red' | 'yellow';

const ACCENTS: Accent[] = ['purple', 'blue', 'green', 'orange', 'red', 'yellow'];

const ACCENT: Record<Accent, { bar: string; soft: string; softText: string }> = {
  purple: { bar: 'bg-[var(--purple)]', soft: 'bg-[var(--purple-light)]', softText: 'text-[var(--purple)]' },
  blue: { bar: 'bg-[var(--blue)]', soft: 'bg-[var(--blue-light)]', softText: 'text-[var(--blue)]' },
  green: { bar: 'bg-[var(--green)]', soft: 'bg-[var(--green-light)]', softText: 'text-[var(--green)]' },
  orange: { bar: 'bg-[var(--orange)]', soft: 'bg-[var(--orange-light)]', softText: 'text-[var(--orange)]' },
  red: { bar: 'bg-[var(--red)]', soft: 'bg-[var(--red-light)]', softText: 'text-[var(--red)]' },
  yellow: { bar: 'bg-[var(--yellow)]', soft: 'bg-[rgba(251,191,36,0.1)]', softText: 'text-[var(--yellow-hover)]' },
};

function ProjectCardSkeleton() {
  return (
    <Card className="gap-0 overflow-hidden p-0">
      <Skeleton className="h-1.5 w-full rounded-none" />
      <div className="flex flex-col gap-3 p-4">
        <Skeleton className="h-5 w-3/4" />
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-4/5" />
        </div>
        <div className="mt-1.5 flex items-center justify-between">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-3.5 w-20" />
        </div>
      </div>
    </Card>
  );
}

export default function Projetos() {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const confirm = useConfirm();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canCreate = hasPermission(RESOURCES.PROJECTS, ACTIONS.CREATE);
  const canEdit = hasPermission(RESOURCES.PROJECTS, ACTIONS.EDIT);
  const canDelete = hasPermission(RESOURCES.PROJECTS, ACTIONS.DELETE);

  const fetchProjects = async () => {
    try {
      setError(null);
      const res = await axios.get<Project[]>('/api/projects');
      setProjects(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao carregar projetos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;
    setSubmitting(true);
    try {
      const res = await axios.post<Project>('/api/projects', {
        name: formName.trim(),
        description: formDescription.trim() || null,
      });
      setShowModal(false);
      setFormName('');
      setFormDescription('');
      navigate(`/projetos/${res.data.id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao criar projeto');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    const ok = await confirm({
      title: 'Excluir projeto',
      description: `Excluir o projeto "${name}"? Esta ação não pode ser desfeita.`,
      confirmLabel: 'Excluir',
      variant: 'destructive',
    });
    if (!ok) return;

    try {
      await axios.delete(`/api/projects/${id}`);
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao excluir');
    }
  };

  const formatDate = (s: string) => {
    const d = new Date(s);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div className="mx-auto max-w-[1200px]">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--purple)] to-[var(--blue)] text-white">
            <FolderKanban size={28} strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Projetos</h1>
            <p className="text-sm text-muted-foreground">Gestão de projetos e quadros Kanban</p>
          </div>
        </div>
        {canCreate && (
          <Button onClick={() => setShowModal(true)}>
            <Plus size={18} /> Novo projeto
          </Button>
        )}
      </header>

      {error && (
        <div role="alert" className="mb-6 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <ProjectCardSkeleton key={i} />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center px-6 py-20 text-center">
          <LayoutList size={56} strokeWidth={1.2} className="mb-5 text-muted-foreground opacity-50" />
          <h2 className="mb-2 text-lg font-bold text-foreground">Nenhum projeto ainda</h2>
          <p className="mb-6 max-w-[420px] text-sm leading-relaxed text-muted-foreground">
            Crie o primeiro projeto para começar a organizar tarefas em quadros Kanban, sprints e métricas.
          </p>
          {canCreate && (
            <Button onClick={() => setShowModal(true)}>
              <Plus size={18} /> Criar primeiro projeto
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project, i) => {
            const accent = ACCENTS[i % ACCENTS.length];
            return (
              <Card key={project.id} className="group relative gap-0 overflow-hidden p-0 transition-all hover:-translate-y-0.5 hover:shadow-md">
                <div className={cn('h-1.5 w-full', ACCENT[accent].bar)} />
                <div className="p-4">
                  {(canEdit || canDelete) && (
                    <div className="absolute top-3 right-3 z-10">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={(e) => e.preventDefault()}
                            aria-label="Mais opções"
                          >
                            <MoreHorizontal size={18} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {canDelete && (
                            <DropdownMenuItem variant="destructive" onClick={() => handleDelete(project.id, project.name)}>
                              <Trash2 size={14} /> Excluir
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                  <Link to={`/projetos/${project.id}`} className="block">
                    <h3 className="mb-1.5 truncate pr-8 text-lg font-semibold text-foreground">{project.name}</h3>
                    <p className={cn('mb-4 line-clamp-2 text-sm leading-relaxed', project.description ? 'text-muted-foreground' : 'text-muted-foreground/60 italic')}>
                      {project.description || 'Sem descrição'}
                    </p>
                    <div className="flex items-center justify-between">
                      <Badge className={cn('border-0', ACCENT[accent].soft, ACCENT[accent].softText)}>
                        {project.tasks_count ?? 0} {project.tasks_count === 1 ? 'tarefa' : 'tarefas'}
                      </Badge>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar size={13} /> {formatDate(project.updated_at)}
                      </span>
                    </div>
                    <span className="mt-3 flex items-center gap-1 text-sm font-semibold text-primary opacity-0 transition-opacity group-hover:opacity-100">
                      Abrir quadro <ArrowRight size={15} />
                    </span>
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showModal} onOpenChange={(open) => !submitting && setShowModal(open)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo projeto</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            <div>
              <Label htmlFor="project-name" className="mb-1.5">
                Nome *
              </Label>
              <Input
                id="project-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Ex: App Mobile"
                required
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="project-desc" className="mb-1.5">
                Descrição
              </Label>
              <Textarea
                id="project-desc"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Breve descrição do projeto"
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => !submitting && setShowModal(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting || !formName.trim()}>
                {submitting ? 'Criando...' : 'Criar projeto'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
