import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Shield,
  Plus,
  Search,
  Edit,
  Trash2,
  Users,
  Save,
  Home,
  Ticket,
  FileEdit,
  FileText,
  User,
  Database,
  RefreshCw,
  CheckCircle,
  Eye,
  History,
  Calendar,
  CalendarDays,
  Webhook,
  BookOpen,
  Bell,
  Sparkles,
  BarChart3,
  Tv,
} from 'lucide-react';
import { RESOURCES, ACTIONS } from '../hooks/usePermissions';
import { formatDateBR } from '../utils/dateUtils';
import { applyPageToggle, applyPermissionToggle, normalizeProfileAccess } from '../utils/accessProfileSync';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Permission {
  resource: string;
  action: string;
}

interface AccessProfile {
  id: number;
  name: string;
  description: string | null;
  permissions: Permission[];
  users_count: number;
  permissions_count: number;
  created_at: string;
}

const RESOURCE_LABELS: Record<string, string> = {
  tickets: 'Tickets',
  forms: 'Formulários',
  pages: 'Páginas',
  users: 'Usuários',
  categories: 'Categorias',
  reports: 'Relatórios',
  history: 'Histórico',
  approve: 'Aprovar',
  track: 'Acompanhar Tratativa',
  config: 'Configurações',
  agenda: 'Agenda',
  webhooks: 'Webhooks',
  docs: 'Arquivos',
  ai_assistant: 'Assistente de IA (Tickets)',
  sigma: 'Consultar OS-SIGMA',
};

const ACTION_LABELS: Record<string, string> = {
  create: 'Criar',
  view: 'Visualizar',
  edit: 'Editar',
  delete: 'Excluir',
  approve: 'Aprovar',
  reject: 'Rejeitar',
};

const SYSTEM_PAGES = [
  { path: '/', label: 'Dashboard', Icon: Home },
  { path: '/tickets', label: 'Tickets', Icon: Ticket },
  { path: '/docs', label: 'Arquivos', Icon: BookOpen },
  { path: '/create/forms', label: 'Formulários', Icon: FileEdit },
  { path: '/create/pages', label: 'Páginas', Icon: FileText },
  { path: '/create/webhooks', label: 'Webhooks', Icon: Webhook },
  { path: '/config/perfil-de-acesso', label: 'Perfil de Acesso', Icon: Shield },
  { path: '/config/usuarios', label: 'Usuários', Icon: User },
  { path: '/config/backup', label: 'Backup', Icon: Database },
  { path: '/config/notificacoes', label: 'Notificações', Icon: Bell },
  { path: '/config/atualizar', label: 'Atualizar', Icon: RefreshCw },
  { path: '/config/grupos', label: 'Grupos', Icon: Users },
  { path: '/config/ia', label: 'Assistente de IA', Icon: Sparkles },
  { path: '/config/painel-tv', label: 'Painel de TV', Icon: Tv },
  { path: '/acompanhar/aprovar', label: 'Aprovar', Icon: CheckCircle },
  { path: '/acompanhar/acompanhar-tratativa', label: 'Acompanhar Tratativa', Icon: Eye },
  { path: '/relatorios', label: 'Relatórios', Icon: BarChart3 },
  { path: '/historico', label: 'Histórico', Icon: History },
  { path: '/consultar-os-sigma', label: 'Consultar OS-SIGMA', Icon: Search },
  { path: '/agenda/calendario-de-servico', label: 'Calendário de Serviço', Icon: Calendar },
  { path: '/agenda/calendario-de-plantoes', label: 'Calendário de Plantões', Icon: CalendarDays },
];

export default function AccessProfile() {
  const confirm = useConfirm();
  const [searchTerm, setSearchTerm] = useState('');
  const [profiles, setProfiles] = useState<AccessProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingProfile, setEditingProfile] = useState<AccessProfile | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    permissions: [] as Permission[],
    pages: [] as string[],
  });

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    try {
      const response = await axios.get('/api/access-profiles');
      setProfiles(response.data);
    } catch (error) {
      console.error('Erro ao buscar perfis:', error);
      toast.error('Erro ao buscar perfis de acesso');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setFormData({ name: '', description: '', permissions: [], pages: [] });
    setEditingProfile(null);
    setShowModal(true);
  };

  const handleEdit = async (profileId: number) => {
    try {
      const response = await axios.get(`/api/access-profiles/${profileId}`);
      const profile = response.data;
      setFormData({
        name: profile.name,
        description: profile.description || '',
        permissions: profile.permissions || [],
        pages: profile.pages || [],
      });
      setEditingProfile(profile);
      setShowModal(true);
    } catch (error) {
      console.error('Erro ao buscar perfil:', error);
      toast.error('Erro ao carregar perfil');
    }
  };

  const handleDelete = async (profileId: number) => {
    const ok = await confirm({
      title: 'Excluir perfil de acesso',
      description: 'Tem certeza que deseja excluir este perfil de acesso?',
      confirmLabel: 'Excluir',
      variant: 'destructive',
    });
    if (!ok) return;

    try {
      await axios.delete(`/api/access-profiles/${profileId}`);
      setProfiles(profiles.filter((p) => p.id !== profileId));
      toast.success('Perfil excluído com sucesso!');
    } catch (error: any) {
      console.error('Erro ao excluir perfil:', error);
      toast.error(error.response?.data?.error || 'Erro ao excluir perfil');
    }
  };

  const togglePermission = (resource: string, action: string) => {
    const exists = formData.permissions.some((p) => p.resource === resource && p.action === action);
    const next = applyPermissionToggle(formData.permissions, formData.pages, resource, action, !exists);
    setFormData({ ...formData, permissions: next.permissions, pages: next.pages });
  };

  const hasPermission = (resource: string, action: string): boolean =>
    formData.permissions.some((p) => p.resource === resource && p.action === action);

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Nome do perfil é obrigatório');
      return;
    }

    try {
      const normalized = normalizeProfileAccess(formData.permissions, formData.pages);
      const payload = {
        name: formData.name,
        description: formData.description || null,
        permissions: normalized.permissions,
        pages: normalized.pages,
      };

      if (editingProfile) {
        await axios.put(`/api/access-profiles/${editingProfile.id}`, payload);
        toast.success('Perfil atualizado com sucesso!');
      } else {
        await axios.post('/api/access-profiles', payload);
        toast.success('Perfil criado com sucesso!');
      }

      setShowModal(false);
      fetchProfiles();
    } catch (error: any) {
      console.error('Erro ao salvar perfil:', error);
      toast.error(error.response?.data?.error || 'Erro ao salvar perfil');
    }
  };

  const filteredProfiles = profiles.filter(
    (profile) =>
      profile.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (profile.description && profile.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Perfil de Acesso</h1>
        <p className="mt-1 text-muted-foreground">Gerencie os perfis de acesso e permissões do sistema</p>
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="relative max-w-[500px] min-w-[280px] flex-1">
          <Search size={18} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar perfis..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={handleCreate}>
          <Plus size={18} />
          Novo Perfil
        </Button>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : filteredProfiles.length === 0 ? (
        <Card className="items-center p-10 text-center">
          <Shield size={40} className="mx-auto mb-3 text-muted-foreground" />
          <p className="mb-3 text-muted-foreground">
            {searchTerm ? 'Nenhum perfil encontrado' : 'Nenhum perfil criado ainda'}
          </p>
          {!searchTerm && (
            <Button onClick={handleCreate} className="mx-auto">
              <Plus size={18} />
              Criar perfil de acesso
            </Button>
          )}
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredProfiles.map((profile) => (
            <Card key={profile.id} className="flex-row flex-wrap items-center justify-between gap-3 px-4 py-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Shield size={18} className="text-[var(--orange)]" />
                  <h3 className="text-base font-semibold text-foreground">{profile.name}</h3>
                </div>
                {profile.description && (
                  <p className="mt-1 ml-6 text-sm text-muted-foreground">{profile.description}</p>
                )}
                <div className="mt-1 ml-6 flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users size={13} />
                    <strong className="text-foreground">{profile.users_count || 0}</strong> usuários
                  </span>
                  <span>
                    <strong className="text-foreground">{profile.permissions_count || 0}</strong> permissões
                  </span>
                  <span>
                    <strong className="text-foreground">Criado:</strong> {formatDateBR(profile.created_at)}
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button variant="secondary" size="sm" onClick={() => handleEdit(profile.id)}>
                  <Edit size={15} />
                  Editar
                </Button>
                <Button variant="destructive" size="sm" onClick={() => handleDelete(profile.id)}>
                  <Trash2 size={15} />
                  Excluir
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal de Edição/Criação */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingProfile ? 'Editar Perfil' : 'Novo Perfil'}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-5">
            <div>
              <Label className="mb-1.5">Nome do Perfil *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Agente de Suporte"
              />
            </div>

            <div>
              <Label className="mb-1.5">Descrição</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descrição do perfil de acesso..."
                rows={3}
              />
            </div>

            <div>
              <Label className="mb-1.5">Permissões</Label>
              <div className="max-h-[400px] overflow-y-auto rounded-lg border border-border p-4">
                {Object.entries(RESOURCES).map(([, resource]) => (
                  <div key={resource} className="mb-5 last:mb-0">
                    <h3 className="mb-2 text-sm font-semibold text-foreground">
                      {RESOURCE_LABELS[resource] || resource}
                    </h3>
                    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                      {Object.entries(ACTIONS).map(([, action]) => {
                        if (resource === 'approve' && action !== 'view' && action !== 'approve' && action !== 'reject') {
                          return null;
                        }
                        if (resource !== 'approve' && (action === 'approve' || action === 'reject')) {
                          return null;
                        }

                        const checked = hasPermission(resource, action);
                        return (
                          <label
                            key={`${resource}-${action}`}
                            className={cn(
                              'flex cursor-pointer items-center gap-2 rounded-md p-2 transition-colors hover:bg-accent',
                              checked && 'bg-primary/10 hover:bg-primary/10'
                            )}
                          >
                            <Checkbox checked={checked} onCheckedChange={() => togglePermission(resource, action)} />
                            <span className={cn('text-sm', checked ? 'font-medium text-foreground' : 'text-muted-foreground')}>
                              {ACTION_LABELS[action] || action}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label className="mb-1">Páginas Visíveis</Label>
              <p className="mb-2 text-sm text-muted-foreground">
                Selecione quais páginas este perfil tem direito de visualizar no menu
              </p>
              <div className="flex max-h-[300px] flex-col gap-1 overflow-y-auto rounded-lg border border-border p-3">
                {SYSTEM_PAGES.map((page) => {
                  const isSelected = formData.pages.includes(page.path);
                  return (
                    <label
                      key={page.path}
                      className={cn(
                        'flex cursor-pointer items-center gap-2 rounded-md p-2 transition-colors hover:bg-accent',
                        isSelected && 'bg-primary/10 hover:bg-primary/10'
                      )}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => {
                          const next = applyPageToggle(formData.permissions, formData.pages, page.path, !isSelected);
                          setFormData({ ...formData, permissions: next.permissions, pages: next.pages });
                        }}
                      />
                      <page.Icon size={16} className={isSelected ? 'text-primary' : 'text-muted-foreground'} />
                      <span className={cn('flex-1 text-sm', isSelected ? 'font-medium text-foreground' : 'text-muted-foreground')}>
                        {page.label}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">{page.path}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              <Save size={18} />
              {editingProfile ? 'Atualizar' : 'Criar'} Perfil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
