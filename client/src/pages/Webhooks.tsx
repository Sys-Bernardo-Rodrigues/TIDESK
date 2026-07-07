import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Webhook,
  Plus,
  Search,
  Edit,
  Trash2,
  Copy,
  Link as LinkIcon,
  Eye,
  CheckCircle,
  XCircle,
  Filter,
  Send,
  RefreshCw,
} from 'lucide-react';
import { formatDateBR } from '../utils/dateUtils';
import { usePermissions, RESOURCES, ACTIONS } from '../hooks/usePermissions';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useConfirm } from '@/components/ui/confirm-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

interface WebhookData {
  id: number;
  name: string;
  description: string;
  webhook_url: string;
  secret_key: string;
  active: number;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category_id?: number;
  category_name?: string;
  assigned_to?: number;
  assigned_to_name?: string;
  created_by: number;
  created_by_name: string;
  created_at: string;
  updated_at: string;
  total_calls: number;
  success_calls: number;
  error_calls: number;
}

interface Category {
  id: number;
  name: string;
}

interface User {
  id: number;
  name: string;
  email: string;
}

export default function Webhooks() {
  const confirm = useConfirm();
  const [searchTerm, setSearchTerm] = useState('');
  const [webhooks, setWebhooks] = useState<WebhookData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedWebhook, setSelectedWebhook] = useState<WebhookData | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<WebhookData | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [filterActive, setFilterActive] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
    category_id: '',
    assigned_to: '',
    active: true,
  });

  const { hasPermission } = usePermissions();
  const canCreate = hasPermission(RESOURCES.WEBHOOKS, ACTIONS.CREATE);
  const canEdit = hasPermission(RESOURCES.WEBHOOKS, ACTIONS.EDIT);
  const canDelete = hasPermission(RESOURCES.WEBHOOKS, ACTIONS.DELETE);
  const canView = hasPermission(RESOURCES.WEBHOOKS, ACTIONS.VIEW);

  useEffect(() => {
    if (canView) {
      fetchWebhooks();
      fetchCategories();
      fetchUsers();
    }
  }, [canView]);

  const fetchWebhooks = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get('/api/webhooks');
      setWebhooks(response.data || []);
    } catch (err: any) {
      console.error('Erro ao buscar webhooks:', err);
      const errorMessage = err.response?.data?.error || err.message || 'Erro ao buscar webhooks';
      setError(err.response?.status === 403 ? 'Você não tem permissão para visualizar webhooks' : errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await axios.get('/api/categories');
      setCategories(response.data);
    } catch (err) {
      console.error('Erro ao buscar categorias:', err);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await axios.get('/api/users/agents');
      setUsers(response.data);
    } catch (err: any) {
      try {
        const meResponse = await axios.get('/api/users/me');
        if (meResponse.data) setUsers([meResponse.data]);
      } catch (meErr: any) {
        console.error('Erro ao buscar usuários:', meErr);
      }
    }
  };

  const fetchLogs = async (webhookId: number) => {
    try {
      setLogsLoading(true);
      const response = await axios.get(`/api/webhooks/${webhookId}/logs`);
      setLogs(response.data);
    } catch (err: any) {
      console.error('Erro ao buscar logs:', err);
      toast.error(err.response?.data?.error || 'Erro ao buscar logs');
    } finally {
      setLogsLoading(false);
    }
  };

  const handleDelete = async (webhookId: number) => {
    if (!canDelete) {
      toast.error('Você não tem permissão para deletar webhooks');
      return;
    }
    const ok = await confirm({
      title: 'Excluir webhook',
      description: 'Tem certeza que deseja excluir este webhook?',
      confirmLabel: 'Excluir',
      variant: 'destructive',
    });
    if (!ok) return;

    try {
      await axios.delete(`/api/webhooks/${webhookId}`);
      setWebhooks(webhooks.filter((w) => w.id !== webhookId));
      if (selectedWebhook?.id === webhookId) {
        setSelectedWebhook(null);
        setShowLogs(false);
      }
    } catch (err: any) {
      console.error('Erro ao excluir webhook:', err);
      toast.error(err.response?.data?.error || 'Erro ao excluir webhook');
    }
  };

  const copyWebhookUrl = async (webhookUrl: string) => {
    const fullUrl = `${window.location.origin}/api/webhooks/receive/${webhookUrl}`;
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopiedUrl(webhookUrl);
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = fullUrl;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopiedUrl(webhookUrl);
        setTimeout(() => setCopiedUrl(null), 2000);
      } catch {
        toast.error('Erro ao copiar URL. Por favor, copie manualmente.');
      }
      document.body.removeChild(textArea);
    }
  };

  const toggleActive = async (webhook: WebhookData) => {
    if (!canEdit) {
      toast.error('Você não tem permissão para editar webhooks');
      return;
    }
    try {
      await axios.put(`/api/webhooks/${webhook.id}`, { active: webhook.active ? 0 : 1 });
      await fetchWebhooks();
    } catch (err: any) {
      console.error('Erro ao atualizar webhook:', err);
      toast.error(err.response?.data?.error || 'Erro ao atualizar webhook');
    }
  };

  const handleViewLogs = async (webhook: WebhookData) => {
    setSelectedWebhook(webhook);
    setShowLogs(true);
    await fetchLogs(webhook.id);
  };

  const handleCreate = () => {
    setEditingWebhook(null);
    setFormData({ name: '', description: '', priority: 'medium', category_id: '', assigned_to: '', active: true });
    setShowForm(true);
  };

  const handleEdit = (webhook: WebhookData) => {
    setEditingWebhook(webhook);
    setFormData({
      name: webhook.name,
      description: webhook.description || '',
      priority: webhook.priority,
      category_id: webhook.category_id?.toString() || '',
      assigned_to: webhook.assigned_to?.toString() || '',
      active: webhook.active === 1,
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        name: formData.name,
        description: formData.description,
        priority: formData.priority,
        active: formData.active,
      };
      if (formData.category_id) payload.category_id = parseInt(formData.category_id);
      if (formData.assigned_to) payload.assigned_to = parseInt(formData.assigned_to);

      if (editingWebhook) {
        await axios.put(`/api/webhooks/${editingWebhook.id}`, payload);
        toast.success('Webhook atualizado com sucesso!');
      } else {
        await axios.post('/api/webhooks', payload);
        toast.success('Webhook criado com sucesso!');
      }

      setShowForm(false);
      setEditingWebhook(null);
      await fetchWebhooks();
    } catch (err: any) {
      console.error('Erro ao salvar webhook:', err);
      toast.error(err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || err.message || 'Erro ao salvar webhook');
    }
  };

  const testWebhook = async (webhook: WebhookData) => {
    const ok = await confirm({
      title: 'Testar webhook',
      description: 'Deseja enviar um teste para este webhook?',
    });
    if (!ok) return;

    try {
      const testPayload = { test: true, message: 'Teste de webhook do TIDESK', timestamp: new Date().toISOString() };
      const response = await axios.post(`/api/webhooks/receive/${webhook.webhook_url}`, testPayload, {
        headers: { 'Content-Type': 'application/json' },
      });
      toast.success('Teste enviado com sucesso! Ticket criado: ' + (response.data.ticket_id || 'N/A'));
      await fetchWebhooks();
    } catch (err: any) {
      console.error('Erro ao testar webhook:', err);
      toast.error(err.response?.data?.error || 'Erro ao testar webhook');
    }
  };

  const filteredWebhooks = webhooks.filter((webhook) => {
    const matchesSearch =
      webhook.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (webhook.description && webhook.description.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesActive =
      filterActive === 'all' ||
      (filterActive === 'active' && webhook.active === 1) ||
      (filterActive === 'inactive' && webhook.active === 0);
    const matchesPriority = filterPriority === 'all' || webhook.priority === filterPriority;
    return matchesSearch && matchesActive && matchesPriority;
  });

  const priorityColors: Record<string, string> = {
    urgent: 'var(--red)',
    high: 'var(--red)',
    medium: 'var(--orange)',
    low: 'var(--blue)',
  };
  const priorityLabels: Record<string, string> = { urgent: 'Urgente', high: 'Alta', medium: 'Média', low: 'Baixa' };

  if (!canView) {
    return <p className="p-10 text-center text-muted-foreground">Você não tem permissão para visualizar webhooks.</p>;
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Webhooks</h1>
        <p className="mt-1 text-muted-foreground">
          Gerencie webhooks para receber notificações de outros sistemas e criar tickets automaticamente
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-[var(--red)] bg-[var(--red-light)] p-3 text-sm text-[var(--red)]">
          {error}
        </div>
      )}

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <div className="relative min-w-[260px] max-w-[500px] flex-1">
            <Search size={18} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar webhooks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter size={16} className="text-muted-foreground" />
            <Select value={filterActive} onValueChange={setFilterActive}>
              <SelectTrigger className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Ativos</SelectItem>
                <SelectItem value="inactive">Inativos</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterPriority} onValueChange={setFilterPriority}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas Prioridades</SelectItem>
                <SelectItem value="urgent">Urgente</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
                <SelectItem value="medium">Média</SelectItem>
                <SelectItem value="low">Baixa</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {canCreate && (
          <Button onClick={handleCreate}>
            <Plus size={18} />
            Novo Webhook
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <>
          {webhooks.length > 0 && (
            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Card className="px-4 py-3">
                <div className="text-xs text-muted-foreground">Total de Webhooks</div>
                <div className="text-2xl font-bold text-foreground">{webhooks.length}</div>
              </Card>
              <Card className="px-4 py-3">
                <div className="text-xs text-muted-foreground">Ativos</div>
                <div className="text-2xl font-bold text-[var(--green)]">
                  {webhooks.filter((w) => w.active === 1).length}
                </div>
              </Card>
              <Card className="px-4 py-3">
                <div className="text-xs text-muted-foreground">Total de Chamadas</div>
                <div className="text-2xl font-bold text-foreground">
                  {webhooks.reduce((sum, w) => sum + (w.total_calls || 0), 0)}
                </div>
              </Card>
              <Card className="px-4 py-3">
                <div className="text-xs text-muted-foreground">Taxa de Sucesso</div>
                <div className="text-2xl font-bold text-[var(--green)]">
                  {(() => {
                    const total = webhooks.reduce((sum, w) => sum + (w.total_calls || 0), 0);
                    const success = webhooks.reduce((sum, w) => sum + (w.success_calls || 0), 0);
                    return total > 0 ? `${Math.round((success / total) * 100)}%` : '0%';
                  })()}
                </div>
              </Card>
            </div>
          )}

          {filteredWebhooks.length === 0 ? (
            <Card className="items-center p-10 text-center">
              <Webhook size={40} className="mx-auto mb-3 text-muted-foreground" />
              <p className="text-muted-foreground">
                {searchTerm || filterActive !== 'all' || filterPriority !== 'all'
                  ? 'Nenhum webhook encontrado com os filtros aplicados'
                  : 'Nenhum webhook criado ainda'}
              </p>
            </Card>
          ) : (
            <div className="flex flex-col gap-4">
              {filteredWebhooks.map((webhook) => {
                const successRate = webhook.total_calls > 0 ? Math.round((webhook.success_calls / webhook.total_calls) * 100) : 0;

                return (
                  <Card key={webhook.id} className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <Webhook size={20} className={webhook.active ? 'text-[var(--green)]' : 'text-muted-foreground'} />
                          <h3 className="text-lg font-semibold text-foreground">{webhook.name}</h3>
                          <span
                            className="rounded px-2 py-0.5 text-xs font-semibold"
                            style={{
                              background: webhook.active ? 'var(--green-light)' : 'var(--bg-tertiary)',
                              color: webhook.active ? 'var(--green)' : 'var(--text-tertiary)',
                            }}
                          >
                            {webhook.active ? 'Ativo' : 'Inativo'}
                          </span>
                          <span
                            className="rounded px-2 py-0.5 text-xs font-semibold"
                            style={{
                              background: `color-mix(in srgb, ${priorityColors[webhook.priority]} 15%, transparent)`,
                              color: priorityColors[webhook.priority],
                            }}
                          >
                            {priorityLabels[webhook.priority]}
                          </span>
                        </div>
                        {webhook.description && <p className="mb-3 text-muted-foreground">{webhook.description}</p>}

                        <div className="mb-3 flex items-center gap-2 rounded-md border border-border bg-muted/40 p-2">
                          <LinkIcon size={15} className="shrink-0 text-muted-foreground" />
                          <code className="flex-1 text-xs break-all text-foreground">
                            {window.location.origin}/api/webhooks/receive/{webhook.webhook_url}
                          </code>
                          <Button
                            variant="secondary"
                            size="icon-sm"
                            onClick={() => copyWebhookUrl(webhook.webhook_url)}
                            title={copiedUrl === webhook.webhook_url ? 'Copiado!' : 'Copiar URL'}
                            className={cn(copiedUrl === webhook.webhook_url && 'bg-[var(--green-light)] text-[var(--green)]')}
                          >
                            {copiedUrl === webhook.webhook_url ? <CheckCircle size={14} /> : <Copy size={14} />}
                          </Button>
                        </div>

                        <div className="mb-3 grid grid-cols-3 gap-3">
                          <div className="rounded-md border border-border bg-muted/40 p-2">
                            <div className="text-xs text-muted-foreground">Chamadas</div>
                            <div className="text-lg font-bold text-foreground">{webhook.total_calls || 0}</div>
                          </div>
                          <div className="rounded-md border border-border bg-muted/40 p-2">
                            <div className="text-xs text-muted-foreground">Sucessos</div>
                            <div className="text-lg font-bold text-[var(--green)]">{webhook.success_calls || 0}</div>
                          </div>
                          <div className="rounded-md border border-border bg-muted/40 p-2">
                            <div className="text-xs text-muted-foreground">Taxa de Sucesso</div>
                            <div
                              className="text-lg font-bold"
                              style={{ color: successRate >= 80 ? 'var(--green)' : successRate >= 50 ? 'var(--orange)' : 'var(--red)' }}
                            >
                              {successRate}%
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                          {webhook.category_name && (
                            <span>
                              Categoria: <strong className="text-foreground">{webhook.category_name}</strong>
                            </span>
                          )}
                          {webhook.assigned_to_name && (
                            <span>
                              Atribuído a: <strong className="text-foreground">{webhook.assigned_to_name}</strong>
                            </span>
                          )}
                          <span>
                            Criado em: <strong className="text-foreground">{formatDateBR(webhook.created_at)}</strong>
                          </span>
                        </div>
                      </div>

                      <div className="flex min-w-[120px] shrink-0 flex-col gap-2">
                        <Button variant="secondary" size="sm" onClick={() => toggleActive(webhook)} disabled={!canEdit}>
                          {webhook.active ? 'Desativar' : 'Ativar'}
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => testWebhook(webhook)}>
                          <Send size={14} />
                          Testar
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => handleViewLogs(webhook)}>
                          <Eye size={14} />
                          Logs
                        </Button>
                        {canEdit && (
                          <Button variant="secondary" size="sm" onClick={() => handleEdit(webhook)}>
                            <Edit size={14} />
                            Editar
                          </Button>
                        )}
                        {canDelete && (
                          <Button variant="destructive" size="sm" onClick={() => handleDelete(webhook.id)}>
                            <Trash2 size={14} />
                            Deletar
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Modal de Formulário */}
      <Dialog
        open={showForm}
        onOpenChange={(open) => {
          setShowForm(open);
          if (!open) setEditingWebhook(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingWebhook ? 'Editar Webhook' : 'Novo Webhook'}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <Label className="mb-1.5">Nome *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="Ex: Zabbix Alerts"
              />
            </div>

            <div>
              <Label className="mb-1.5">Descrição</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descrição do webhook..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5">Prioridade *</Label>
                <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v as any })}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baixa</SelectItem>
                    <SelectItem value="medium">Média</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="urgent">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="mb-1.5">Status</Label>
                <Select value={formData.active ? '1' : '0'} onValueChange={(v) => setFormData({ ...formData, active: v === '1' })}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Ativo</SelectItem>
                    <SelectItem value="0">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="mb-1.5">Categoria</Label>
              <Select
                value={formData.category_id || '__none'}
                onValueChange={(v) => setFormData({ ...formData, category_id: v === '__none' ? '' : v })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Nenhuma categoria</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id.toString()}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="mb-1.5">Atribuir a</Label>
              <Select
                value={formData.assigned_to || '__none'}
                onValueChange={(v) => setFormData({ ...formData, assigned_to: v === '__none' ? '' : v })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Nenhum usuário</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id.toString()}>
                      {user.name} ({user.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setShowForm(false);
                  setEditingWebhook(null);
                }}
              >
                Cancelar
              </Button>
              <Button type="submit">{editingWebhook ? 'Atualizar' : 'Criar'} Webhook</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de Logs */}
      <Dialog
        open={showLogs}
        onOpenChange={(open) => {
          setShowLogs(open);
          if (!open) setSelectedWebhook(null);
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <div className="flex items-start justify-between gap-2">
              <div>
                <DialogTitle>Logs - {selectedWebhook?.name}</DialogTitle>
                {selectedWebhook && (
                  <DialogDescription>
                    {selectedWebhook.total_calls || 0} chamadas • {selectedWebhook.success_calls || 0} sucessos •{' '}
                    {selectedWebhook.error_calls || 0} erros
                  </DialogDescription>
                )}
              </div>
              <Button
                variant="secondary"
                size="icon-sm"
                onClick={() => selectedWebhook && fetchLogs(selectedWebhook.id)}
                title="Atualizar logs"
              >
                <RefreshCw size={16} />
              </Button>
            </div>
          </DialogHeader>

          {logsLoading ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : logs.length === 0 ? (
            <p className="p-6 text-center text-muted-foreground">Nenhum log encontrado</p>
          ) : (
            <div className="flex flex-col gap-3">
              {logs.map((log) => (
                <div key={log.id} className="rounded-lg border border-border bg-muted/40 p-3">
                  <div className="mb-1.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {log.status === 'success' ? (
                        <CheckCircle size={17} className="text-[var(--green)]" />
                      ) : (
                        <XCircle size={17} className="text-[var(--red)]" />
                      )}
                      <span className={cn('font-semibold', log.status === 'success' ? 'text-[var(--green)]' : 'text-[var(--red)]')}>
                        {log.status === 'success' ? 'Sucesso' : 'Erro'}
                      </span>
                      {log.response_code && (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{log.response_code}</span>
                      )}
                      {log.ticket_number && (
                        <span className="rounded px-1.5 py-0.5 text-xs" style={{ background: 'var(--blue-light)', color: 'var(--blue)' }}>
                          Ticket #{log.ticket_number}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">{formatDateBR(log.created_at, { includeTime: true })}</span>
                  </div>
                  {log.error_message && (
                    <p className="mb-1.5 rounded bg-[var(--red-light)] p-1.5 text-sm text-[var(--red)]">{log.error_message}</p>
                  )}
                  {log.payload && (
                    <details className="mt-1.5">
                      <summary className="cursor-pointer text-sm font-medium text-muted-foreground">Ver payload</summary>
                      <pre className="mt-1.5 max-h-[300px] overflow-auto rounded border border-border bg-muted p-2 text-xs">
                        {JSON.stringify(JSON.parse(log.payload), null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
