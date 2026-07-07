import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Users, Plus, Search, Edit, Trash2, UserPlus, UserMinus, Save } from 'lucide-react';
import { formatDateBR } from '../utils/dateUtils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
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

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

interface Group {
  id: number;
  name: string;
  description: string | null;
  users: User[];
  users_count: number;
  created_by_name: string;
  created_at: string;
}

export default function Grupos() {
  const confirm = useConfirm();
  const [searchTerm, setSearchTerm] = useState('');
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showUsersModal, setShowUsersModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });

  useEffect(() => {
    fetchGroups();
    fetchUsers();
  }, []);

  const fetchGroups = async () => {
    try {
      const response = await axios.get('/api/groups');
      setGroups(response.data);
    } catch (error) {
      console.error('Erro ao buscar grupos:', error);
      toast.error('Erro ao buscar grupos');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await axios.get('/api/users');
      setAllUsers(response.data);
    } catch (error) {
      console.error('Erro ao buscar usuários:', error);
    }
  };

  const handleCreate = () => {
    setFormData({ name: '', description: '' });
    setSelectedGroup(null);
    setShowCreateModal(true);
  };

  const handleEdit = (group: Group) => {
    setFormData({ name: group.name, description: group.description || '' });
    setSelectedGroup(group);
    setShowEditModal(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Nome do grupo é obrigatório');
      return;
    }

    try {
      if (selectedGroup) {
        await axios.put(`/api/groups/${selectedGroup.id}`, formData);
        toast.success('Grupo atualizado com sucesso!');
        setShowEditModal(false);
      } else {
        await axios.post('/api/groups', formData);
        toast.success('Grupo criado com sucesso!');
        setShowCreateModal(false);
      }
      setSelectedGroup(null);
      fetchGroups();
    } catch (error: any) {
      console.error('Erro ao salvar grupo:', error);
      toast.error(error.response?.data?.error || 'Erro ao salvar grupo');
    }
  };

  const handleDelete = async (groupId: number) => {
    const ok = await confirm({
      title: 'Excluir grupo',
      description: 'Tem certeza que deseja excluir este grupo? Os usuários serão desvinculados automaticamente.',
      confirmLabel: 'Excluir',
      variant: 'destructive',
    });
    if (!ok) return;

    try {
      await axios.delete(`/api/groups/${groupId}`);
      setGroups(groups.filter((g) => g.id !== groupId));
      toast.success('Grupo excluído com sucesso!');
    } catch (error: any) {
      console.error('Erro ao excluir grupo:', error);
      toast.error(error.response?.data?.error || 'Erro ao excluir grupo');
    }
  };

  const handleManageUsers = async (group: Group) => {
    setSelectedGroup(group);
    setShowUsersModal(true);
  };

  const handleAddUser = async (userId: number) => {
    if (!selectedGroup) return;
    try {
      await axios.post(`/api/groups/${selectedGroup.id}/users`, { userId });
      const response = await axios.get(`/api/groups/${selectedGroup.id}`);
      setSelectedGroup(response.data);
      await fetchGroups();
    } catch (error: any) {
      console.error('Erro ao vincular usuário:', error);
      toast.error(error.response?.data?.error || 'Erro ao vincular usuário');
    }
  };

  const handleRemoveUser = async (userId: number) => {
    if (!selectedGroup) return;
    try {
      await axios.delete(`/api/groups/${selectedGroup.id}/users/${userId}`);
      const response = await axios.get(`/api/groups/${selectedGroup.id}`);
      setSelectedGroup(response.data);
      await fetchGroups();
    } catch (error: any) {
      console.error('Erro ao desvincular usuário:', error);
      toast.error(error.response?.data?.error || 'Erro ao desvincular usuário');
    }
  };

  const filteredGroups = groups.filter(
    (group) =>
      group.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (group.description && group.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getAvailableUsers = (): User[] => {
    if (!selectedGroup) return allUsers;
    const groupUserIds = selectedGroup.users.map((u) => u.id);
    return allUsers.filter((user) => !groupUserIds.includes(user.id));
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Grupos</h1>
        <p className="mt-1 text-muted-foreground">Crie grupos e vincule usuários para facilitar o gerenciamento</p>
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="relative max-w-[500px] min-w-[280px] flex-1">
          <Search size={18} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar grupos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={handleCreate}>
          <Plus size={18} />
          Novo Grupo
        </Button>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : filteredGroups.length === 0 ? (
        <Card className="items-center p-10 text-center">
          <Users size={40} className="mx-auto mb-3 text-muted-foreground" />
          <p className="mb-3 text-muted-foreground">
            {searchTerm ? 'Nenhum grupo encontrado' : 'Nenhum grupo criado ainda'}
          </p>
          {!searchTerm && (
            <Button onClick={handleCreate} className="mx-auto">
              <Plus size={18} />
              Criar Primeiro Grupo
            </Button>
          )}
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredGroups.map((group) => (
            <Card key={group.id} className="px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Users size={18} className="text-primary" />
                    <h3 className="text-base font-semibold text-foreground">{group.name}</h3>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                      {group.users_count || 0} {group.users_count === 1 ? 'usuário' : 'usuários'}
                    </span>
                  </div>
                  {group.description && (
                    <p className="mt-1 ml-6 text-sm text-muted-foreground">{group.description}</p>
                  )}
                  <div className="mt-1 ml-6 text-xs text-muted-foreground">
                    <strong className="text-foreground">Criado por:</strong> {group.created_by_name} •{' '}
                    <strong className="text-foreground">Data:</strong> {formatDateBR(group.created_at)}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleManageUsers(group)}>
                    <UserPlus size={15} />
                    Usuários
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => handleEdit(group)}>
                    <Edit size={15} />
                    Editar
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(group.id)}>
                    <Trash2 size={15} />
                    Excluir
                  </Button>
                </div>
              </div>

              {!!group.users?.length && (
                <div className="mt-4 border-t border-border pt-4">
                  <h4 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    Usuários do Grupo
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {group.users.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center gap-1.5 rounded-md border border-border bg-muted/50 px-2.5 py-1 text-xs"
                      >
                        <span className="font-medium text-foreground">{user.name}</span>
                        <span className="text-muted-foreground">({user.email})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Modal de Criar/Editar Grupo */}
      <Dialog
        open={showCreateModal || showEditModal}
        onOpenChange={(open) => {
          if (!open) {
            setShowCreateModal(false);
            setShowEditModal(false);
            setSelectedGroup(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedGroup ? 'Editar Grupo' : 'Criar Novo Grupo'}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div>
              <Label className="mb-1.5">Nome do Grupo *</Label>
              <Input
                placeholder="Digite o nome do grupo"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div>
              <Label className="mb-1.5">Descrição</Label>
              <Textarea
                placeholder="Digite uma descrição para o grupo"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => {
                setShowCreateModal(false);
                setShowEditModal(false);
                setSelectedGroup(null);
              }}
            >
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={!formData.name.trim()}>
              <Save size={18} />
              {selectedGroup ? 'Atualizar' : 'Criar'} Grupo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Gerenciar Usuários */}
      <Dialog
        open={showUsersModal}
        onOpenChange={(open) => {
          setShowUsersModal(open);
          if (!open) setSelectedGroup(null);
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Gerenciar Usuários</DialogTitle>
            {selectedGroup && <DialogDescription>{selectedGroup.name}</DialogDescription>}
          </DialogHeader>

          {selectedGroup && (
            <>
              {!!selectedGroup.users?.length && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-foreground">
                    Usuários no Grupo ({selectedGroup.users.length})
                  </h3>
                  <div className="flex flex-col gap-2">
                    {selectedGroup.users.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center justify-between rounded-lg border border-border bg-muted/40 p-3"
                      >
                        <div>
                          <div className="font-medium text-foreground">{user.name}</div>
                          <div className="text-sm text-muted-foreground">{user.email}</div>
                        </div>
                        <Button variant="destructive" size="sm" onClick={() => handleRemoveUser(user.id)}>
                          <UserMinus size={14} />
                          Remover
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {getAvailableUsers().length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-foreground">
                    Usuários Disponíveis ({getAvailableUsers().length})
                  </h3>
                  <div className="flex flex-col gap-2">
                    {getAvailableUsers().map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center justify-between rounded-lg border border-border bg-muted/40 p-3"
                      >
                        <div>
                          <div className="font-medium text-foreground">{user.name}</div>
                          <div className="text-sm text-muted-foreground">{user.email}</div>
                        </div>
                        <Button size="sm" onClick={() => handleAddUser(user.id)}>
                          <UserPlus size={14} />
                          Adicionar
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {getAvailableUsers().length === 0 && !selectedGroup.users?.length && (
                <p className="p-6 text-center text-muted-foreground">Nenhum usuário disponível</p>
              )}
              {getAvailableUsers().length === 0 && !!selectedGroup.users?.length && (
                <p className="p-6 text-center text-muted-foreground">Todos os usuários já estão neste grupo</p>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
