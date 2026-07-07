import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { User, Plus, Search, Edit, Trash2, Mail, Shield, Link as LinkIcon, Unlink, Save } from 'lucide-react';
import { formatDateBR } from '../utils/dateUtils';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { useConfirm } from '@/components/ui/confirm-dialog';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface AccessProfile {
  id: number;
  name: string;
  description: string | null;
}

interface UserData {
  id: number;
  name: string;
  email: string;
  role: string;
  created_at: string;
  access_profiles?: AccessProfile[];
}

export default function Users() {
  const confirm = useConfirm();
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [availableProfiles, setAvailableProfiles] = useState<AccessProfile[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    access_profile_ids: [] as number[],
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await axios.get('/api/users');
      setUsers(response.data);
    } catch (error) {
      console.error('Erro ao buscar usuários:', error);
      toast.error('Erro ao buscar usuários');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableProfiles = async () => {
    setLoadingProfiles(true);
    try {
      const response = await axios.get('/api/access-profiles');
      setAvailableProfiles(response.data);
    } catch (error) {
      console.error('Erro ao buscar perfis:', error);
      toast.error('Erro ao buscar perfis de acesso');
    } finally {
      setLoadingProfiles(false);
    }
  };

  const handleManageProfiles = async (user: UserData) => {
    setSelectedUser(user);
    await fetchAvailableProfiles();
    setShowProfileModal(true);
  };

  const handleLinkProfile = async (profileId: number) => {
    if (!selectedUser) return;
    try {
      await axios.post(`/api/users/${selectedUser.id}/access-profiles`, { access_profile_id: profileId });
      toast.success('Perfil vinculado com sucesso!');
      const response = await axios.get(`/api/users/${selectedUser.id}`);
      setSelectedUser(response.data);
      await fetchUsers();
    } catch (error: any) {
      console.error('Erro ao vincular perfil:', error);
      toast.error(error.response?.data?.error || 'Erro ao vincular perfil');
    }
  };

  const handleUnlinkProfile = async (profileId: number) => {
    if (!selectedUser) return;
    const ok = await confirm({
      title: 'Desvincular perfil',
      description: 'Tem certeza que deseja desvincular este perfil?',
      confirmLabel: 'Desvincular',
      variant: 'destructive',
    });
    if (!ok) return;

    try {
      await axios.delete(`/api/users/${selectedUser.id}/access-profiles/${profileId}`);
      toast.success('Perfil desvinculado com sucesso!');
      const response = await axios.get(`/api/users/${selectedUser.id}`);
      setSelectedUser(response.data);
      await fetchUsers();
    } catch (error: any) {
      console.error('Erro ao desvincular perfil:', error);
      toast.error(error.response?.data?.error || 'Erro ao desvincular perfil');
    }
  };

  const filteredUsers = users.filter(
    (user) =>
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isProfileLinked = (profileId: number): boolean => {
    if (!selectedUser || !selectedUser.access_profiles) return false;
    return selectedUser.access_profiles.some((p) => p.id === profileId);
  };

  const handleCreate = async () => {
    setFormData({ name: '', email: '', password: '', access_profile_ids: [] });
    setEditingUser(null);
    await fetchAvailableProfiles();
    setShowUserModal(true);
  };

  const handleEdit = async (user: UserData) => {
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      access_profile_ids: user.access_profiles?.map((p) => p.id) || [],
    });
    setEditingUser(user);
    await fetchAvailableProfiles();
    setShowUserModal(true);
  };

  const handleDelete = async (userId: number) => {
    const ok = await confirm({
      title: 'Excluir usuário',
      description: 'Tem certeza que deseja excluir este usuário? Esta ação não pode ser desfeita.',
      confirmLabel: 'Excluir',
      variant: 'destructive',
    });
    if (!ok) return;

    try {
      await axios.delete(`/api/users/${userId}`);
      setUsers(users.filter((u) => u.id !== userId));
      toast.success('Usuário excluído com sucesso!');
    } catch (error: any) {
      console.error('Erro ao excluir usuário:', error);
      toast.error(error.response?.data?.error || 'Erro ao excluir usuário');
    }
  };

  const handleSaveUser = async () => {
    if (!formData.name.trim() || !formData.email.trim()) {
      toast.error('Nome e email são obrigatórios');
      return;
    }
    if (!editingUser && !formData.password) {
      toast.error('Senha é obrigatória para novos usuários');
      return;
    }
    if (formData.access_profile_ids.length === 0) {
      toast.error('Selecione pelo menos um perfil de acesso');
      return;
    }

    try {
      const payload: any = {
        name: formData.name,
        email: formData.email,
        access_profile_ids: formData.access_profile_ids,
      };
      if (formData.password) payload.password = formData.password;

      if (editingUser) {
        await axios.put(`/api/users/${editingUser.id}`, payload);
        toast.success('Usuário atualizado com sucesso!');
      } else {
        await axios.post('/api/users', payload);
        toast.success('Usuário criado com sucesso!');
      }

      setShowUserModal(false);
      setEditingUser(null);
      fetchUsers();
    } catch (error: any) {
      console.error('Erro ao salvar usuário:', error);
      toast.error(error.response?.data?.error || 'Erro ao salvar usuário');
    }
  };

  const toggleProfileId = (id: number, checked: boolean) => {
    setFormData((prev) => ({
      ...prev,
      access_profile_ids: checked
        ? [...prev.access_profile_ids, id]
        : prev.access_profile_ids.filter((pid) => pid !== id),
    }));
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Usuários</h1>
        <p className="mt-1 text-muted-foreground">Gerencie os usuários e seus perfis de acesso do sistema</p>
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="relative max-w-[500px] min-w-[280px] flex-1">
          <Search size={18} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar usuários..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={handleCreate}>
          <Plus size={18} />
          Novo Usuário
        </Button>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : filteredUsers.length === 0 ? (
        <Card className="items-center p-10 text-center">
          <User size={40} className="mx-auto mb-3 text-muted-foreground" />
          <p className="mb-3 text-muted-foreground">
            {searchTerm ? 'Nenhum usuário encontrado' : 'Nenhum usuário cadastrado ainda'}
          </p>
          {!searchTerm && (
            <Button onClick={handleCreate} className="mx-auto">
              <Plus size={18} />
              Cadastrar Primeiro Usuário
            </Button>
          )}
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredUsers.map((user) => (
            <Card key={user.id} className="flex-row flex-wrap items-center justify-between gap-3 px-4 py-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <User size={18} className="text-[var(--blue)]" />
                  <h3 className="text-base font-semibold text-foreground">{user.name}</h3>
                </div>
                <div className="mt-1 ml-6 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Mail size={13} />
                    {user.email}
                  </span>
                  {!!user.access_profiles?.length && (
                    <span className="flex items-center gap-1">
                      <Shield size={13} className="text-[var(--orange)]" />
                      <strong className="text-foreground">{user.access_profiles.length}</strong> perfil
                      {user.access_profiles.length > 1 ? 's' : ''}
                    </span>
                  )}
                  <span>
                    <strong className="text-foreground">Criado:</strong> {formatDateBR(user.created_at)}
                  </span>
                </div>
                {!!user.access_profiles?.length && (
                  <div className="mt-2 ml-6 flex flex-wrap gap-1.5">
                    {user.access_profiles.map((profile) => (
                      <span
                        key={profile.id}
                        className="rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{ background: 'var(--orange-light)', color: 'var(--orange)' }}
                      >
                        {profile.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex shrink-0 gap-2">
                <Button variant="outline" size="sm" onClick={() => handleManageProfiles(user)}>
                  <Shield size={15} />
                  Perfis
                </Button>
                <Button variant="secondary" size="sm" onClick={() => handleEdit(user)}>
                  <Edit size={15} />
                  Editar
                </Button>
                <Button variant="destructive" size="sm" onClick={() => handleDelete(user.id)}>
                  <Trash2 size={15} />
                  Excluir
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal de Gerenciamento de Perfis */}
      <Dialog
        open={showProfileModal}
        onOpenChange={(open) => {
          setShowProfileModal(open);
          if (!open) setSelectedUser(null);
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Perfis de Acesso</DialogTitle>
            {selectedUser && (
              <DialogDescription>
                {selectedUser.name} ({selectedUser.email})
              </DialogDescription>
            )}
          </DialogHeader>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-foreground">Perfis Vinculados</h3>
            {selectedUser?.access_profiles?.length ? (
              <div className="flex flex-col gap-2">
                {selectedUser.access_profiles.map((profile) => (
                  <Card key={profile.id} className="flex-row items-center justify-between gap-3 px-3 py-3">
                    <div>
                      <div className="font-medium text-foreground">{profile.name}</div>
                      {profile.description && (
                        <div className="text-sm text-muted-foreground">{profile.description}</div>
                      )}
                    </div>
                    <Button variant="destructive" size="sm" onClick={() => handleUnlinkProfile(profile.id)}>
                      <Unlink size={14} />
                      Desvincular
                    </Button>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">Nenhum perfil vinculado</p>
            )}
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-foreground">Perfis Disponíveis</h3>
            {loadingProfiles ? (
              <p className="text-sm text-muted-foreground">Carregando perfis...</p>
            ) : availableProfiles.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Nenhum perfil disponível</p>
            ) : (
              <div className="flex flex-col gap-2">
                {availableProfiles.map((profile) => {
                  const isLinked = isProfileLinked(profile.id);
                  return (
                    <Card key={profile.id} className={cn('flex-row items-center justify-between gap-3 px-3 py-3', isLinked && 'opacity-60')}>
                      <div>
                        <div className="font-medium text-foreground">
                          {profile.name}
                          {isLinked && <span className="ml-2 text-xs font-medium text-[var(--green)]">(Vinculado)</span>}
                        </div>
                        {profile.description && (
                          <div className="text-sm text-muted-foreground">{profile.description}</div>
                        )}
                      </div>
                      <Button size="sm" onClick={() => handleLinkProfile(profile.id)} disabled={isLinked}>
                        <LinkIcon size={14} />
                        {isLinked ? 'Vinculado' : 'Vincular'}
                      </Button>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Criar/Editar Usuário */}
      <Dialog
        open={showUserModal}
        onOpenChange={(open) => {
          setShowUserModal(open);
          if (!open) setEditingUser(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingUser ? 'Editar Usuário' : 'Novo Usuário'}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div>
              <Label className="mb-1.5">Nome *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nome completo"
              />
            </div>

            <div>
              <Label className="mb-1.5">Email *</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="email@exemplo.com"
              />
            </div>

            <div>
              <Label className="mb-1.5">
                Senha {!editingUser && '*'}
                {editingUser && <span className="font-normal text-muted-foreground"> (deixe em branco para não alterar)</span>}
              </Label>
              <Input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder={editingUser ? 'Nova senha (opcional)' : 'Mínimo 6 caracteres'}
              />
            </div>

            <div>
              <Label className="mb-1.5">Perfis de Acesso *</Label>
              {loadingProfiles ? (
                <p className="text-sm text-muted-foreground">Carregando perfis...</p>
              ) : (
                <div className="flex max-h-[200px] flex-col gap-1 overflow-y-auto rounded-lg border border-border p-2">
                  {availableProfiles.map((profile) => {
                    const isSelected = formData.access_profile_ids.includes(profile.id);
                    return (
                      <label
                        key={profile.id}
                        className={cn(
                          'flex cursor-pointer items-center gap-2 rounded-md p-2 transition-colors',
                          isSelected && 'bg-primary/10'
                        )}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => toggleProfileId(profile.id, checked === true)}
                        />
                        <div className="flex-1">
                          <div className="text-sm font-medium text-foreground">{profile.name}</div>
                          {profile.description && (
                            <div className="text-xs text-muted-foreground">{profile.description}</div>
                          )}
                        </div>
                      </label>
                    );
                  })}
                  {availableProfiles.length === 0 && (
                    <p className="p-3 text-center text-sm text-muted-foreground">
                      Nenhum perfil de acesso disponível. Crie perfis em /config/perfil-de-acesso
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => {
                setShowUserModal(false);
                setEditingUser(null);
              }}
            >
              Cancelar
            </Button>
            <Button onClick={handleSaveUser}>
              <Save size={18} />
              {editingUser ? 'Atualizar' : 'Criar'} Usuário
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
