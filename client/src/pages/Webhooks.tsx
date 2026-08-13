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
  BookOpen,
  Activity,
  ShieldAlert,
  Flame,
  LayoutDashboard,
} from 'lucide-react';
import { formatDateBR } from '../utils/dateUtils';
import { usePermissions, RESOURCES, ACTIONS } from '../hooks/usePermissions';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

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

const TOOL_META = {
  zabbix: { icon: Activity, color: 'var(--red)', label: 'Zabbix' },
  wazuh: { icon: ShieldAlert, color: 'var(--blue)', label: 'Wazuh' },
  prometheus: { icon: Flame, color: 'var(--orange)', label: 'Prometheus' },
  grafana: { icon: LayoutDashboard, color: 'var(--purple)', label: 'Grafana' },
} as const;

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
  const [guideWebhook, setGuideWebhook] = useState<WebhookData | null>(null);
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);

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

  const copySnippet = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSnippet(key);
      setTimeout(() => setCopiedSnippet(null), 2000);
    } catch {
      toast.error('Erro ao copiar. Por favor, copie manualmente.');
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

  const totalCalls = webhooks.reduce((sum, w) => sum + (w.total_calls || 0), 0);
  const successCalls = webhooks.reduce((sum, w) => sum + (w.success_calls || 0), 0);
  const successRateAll = totalCalls > 0 ? Math.round((successCalls / totalCalls) * 100) : 0;

  return (
    <div>
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Webhook size={18} />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Webhooks</h1>
            <p className="text-xs text-muted-foreground">Receba alertas de outros sistemas e crie tickets automaticamente</p>
          </div>
        </div>
        {webhooks.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <StatChip label="Total" value={webhooks.length} colorVar="var(--text-tertiary)" />
            <StatChip label="Ativos" value={webhooks.filter((w) => w.active === 1).length} colorVar="var(--green)" />
            <StatChip label="Chamadas" value={totalCalls} colorVar="var(--blue)" />
            <StatChip label="Sucesso" value={`${successRateAll}%`} colorVar={successRateAll >= 80 ? 'var(--green)' : successRateAll >= 50 ? 'var(--orange)' : 'var(--red)'} />
          </div>
        )}
      </header>

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
                  <Card key={webhook.id} className="relative overflow-hidden p-5 pl-6">
                    <span className="absolute top-0 left-0 h-full w-1" style={{ background: priorityColors[webhook.priority] }} />
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <Webhook size={20} className={webhook.active ? 'text-[var(--green)]' : 'text-muted-foreground'} />
                          <h3 className="text-lg font-semibold text-foreground">{webhook.name}</h3>
                          <Badge
                            className={cn(
                              'border-0 text-[0.625rem] font-semibold tracking-wide uppercase',
                              webhook.active ? 'bg-[var(--green-light)] text-[var(--green)]' : 'bg-muted text-muted-foreground'
                            )}
                          >
                            {webhook.active ? 'Ativo' : 'Inativo'}
                          </Badge>
                          <Badge
                            variant="outline"
                            className="text-[0.625rem] font-semibold tracking-wide uppercase"
                            style={{ color: priorityColors[webhook.priority] }}
                          >
                            {priorityLabels[webhook.priority]}
                          </Badge>
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

                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <div className="flex items-center gap-1.5">
                          <Button variant="secondary" size="icon-sm" onClick={() => setGuideWebhook(webhook)} title="Guia de integração">
                            <BookOpen size={14} />
                          </Button>
                          <Button variant="secondary" size="icon-sm" onClick={() => testWebhook(webhook)} title="Testar">
                            <Send size={14} />
                          </Button>
                          <Button variant="secondary" size="icon-sm" onClick={() => handleViewLogs(webhook)} title="Logs">
                            <Eye size={14} />
                          </Button>
                          {canEdit && (
                            <Button variant="secondary" size="icon-sm" onClick={() => handleEdit(webhook)} title="Editar">
                              <Edit size={14} />
                            </Button>
                          )}
                          {canDelete && (
                            <Button variant="destructive" size="icon-sm" onClick={() => handleDelete(webhook.id)} title="Deletar">
                              <Trash2 size={14} />
                            </Button>
                          )}
                        </div>
                        <Button variant="secondary" size="sm" onClick={() => toggleActive(webhook)} disabled={!canEdit}>
                          {webhook.active ? 'Desativar' : 'Ativar'}
                        </Button>
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

      {/* Modal de Guia de Integração */}
      <Dialog open={!!guideWebhook} onOpenChange={(open) => !open && setGuideWebhook(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto p-0 sm:max-w-3xl">
          <div className="flex items-center gap-3 border-b border-border bg-muted/30 px-6 py-3.5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <BookOpen size={18} />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base">Guia de integração</DialogTitle>
              <DialogDescription className="truncate">
                Conecte <strong className="text-foreground">{guideWebhook?.name}</strong> a uma dessas ferramentas
              </DialogDescription>
            </div>
          </div>

          <div className="px-6 pb-5">
            {guideWebhook && (() => {
              const fullUrl = `${window.location.origin}/api/webhooks/receive/${guideWebhook.webhook_url}`;
              return (
                <Tabs defaultValue="zabbix">
                  <TabsList className="h-auto flex-wrap gap-1 bg-muted/60 p-1">
                    {(Object.keys(TOOL_META) as Array<keyof typeof TOOL_META>).map((key) => {
                      const meta = TOOL_META[key];
                      const Icon = meta.icon;
                      return (
                        <TabsTrigger key={key} value={key} className="gap-1.5 px-3 py-1.5">
                          <Icon size={14} style={{ color: meta.color }} />
                          {meta.label}
                        </TabsTrigger>
                      );
                    })}
                  </TabsList>

                  <TabsContent value="zabbix" className="flex flex-col gap-3 pt-3">
                    <ToolBanner meta={TOOL_META.zabbix} description="Crie um meio de notificação Webhook no Zabbix e cada alerta vira ticket automaticamente." />
                    <GuideStep n={1}>
                      <p className="text-sm text-foreground">
                        Em <strong>Alertas → Meios de notificação → Criar meio</strong>, escolha o tipo <strong>Webhook</strong> e
                        adicione estes parâmetros:
                      </p>
                      <CopyBlock
                        id="zabbix-params"
                        label="Parâmetros"
                        copiedKey={copiedSnippet}
                        onCopy={copySnippet}
                        text={'event_name = {EVENT.NAME}\nseverity = {EVENT.SEVERITY}\nhost = {HOST.NAME}\nstatus = {EVENT.STATUS}\nurl = {TRIGGER.URL}'}
                      />
                    </GuideStep>
                    <GuideStep n={2}>
                      <p className="text-sm text-foreground">Cole este script no campo "Script":</p>
                      <CopyBlock
                        id="zabbix-script"
                        label="script.js"
                        copiedKey={copiedSnippet}
                        onCopy={copySnippet}
                        text={`var params = JSON.parse(value);\nvar req = new HttpRequest();\nreq.addHeader('Content-Type: application/json');\nreq.post('${fullUrl}', JSON.stringify({\n  source: 'zabbix',\n  event_name: params.event_name,\n  severity: params.severity,\n  host: params.host,\n  status: params.status,\n  url: params.url\n}));\nreturn 'OK';`}
                      />
                    </GuideStep>
                  </TabsContent>

                  <TabsContent value="wazuh" className="flex flex-col gap-3 pt-3">
                    <ToolBanner meta={TOOL_META.wazuh} description="O manager encaminha o alerta bruto direto pro TIDESK via integração HTTP custom." />
                    <GuideStep n={1}>
                      <p className="text-sm text-foreground">
                        Adicione este bloco no <code className="rounded bg-muted px-1 py-0.5 text-xs">ossec.conf</code> do manager
                        (ajuste o <code className="rounded bg-muted px-1 py-0.5 text-xs">level</code> mínimo se quiser filtrar
                        alertas de baixa severidade):
                      </p>
                      <CopyBlock
                        id="wazuh"
                        label="ossec.conf"
                        copiedKey={copiedSnippet}
                        onCopy={copySnippet}
                        text={`<ossec_config>\n  <integration>\n    <name>custom-http</name>\n    <hook_url>${fullUrl}</hook_url>\n    <alert_format>json</alert_format>\n    <level>7</level>\n  </integration>\n</ossec_config>`}
                      />
                    </GuideStep>
                    <GuideStep n={2}>
                      <p className="text-sm text-foreground">Reinicie o manager pra aplicar:</p>
                      <CopyBlock id="wazuh-restart" label="shell" copiedKey={copiedSnippet} onCopy={copySnippet} text={'systemctl restart wazuh-manager'} />
                    </GuideStep>
                  </TabsContent>

                  <TabsContent value="prometheus" className="flex flex-col gap-3 pt-3">
                    <ToolBanner meta={TOOL_META.prometheus} description="O Alertmanager dispara pro TIDESK sempre que um alerta entra em firing ou é resolvido." />
                    <GuideStep n={1}>
                      <p className="text-sm text-foreground">
                        Adicione um receiver no seu <code className="rounded bg-muted px-1 py-0.5 text-xs">alertmanager.yml</code>:
                      </p>
                      <CopyBlock
                        id="prometheus"
                        label="alertmanager.yml"
                        copiedKey={copiedSnippet}
                        onCopy={copySnippet}
                        text={`receivers:\n  - name: 'tidesk'\n    webhook_configs:\n      - url: '${fullUrl}'\n        send_resolved: true\n\nroute:\n  receiver: 'tidesk'`}
                      />
                    </GuideStep>
                  </TabsContent>

                  <TabsContent value="grafana" className="flex flex-col gap-3 pt-3">
                    <ToolBanner meta={TOOL_META.grafana} description="Grafana Alerting usa o mesmo formato do Alertmanager — basta um contact point." />
                    <GuideStep n={1}>
                      <p className="text-sm text-foreground">
                        Em <strong>Alerting → Contact points → New contact point</strong>, escolha a integração{' '}
                        <strong>Webhook</strong> e cole a URL abaixo:
                      </p>
                      <CopyBlock id="grafana" label="URL" copiedKey={copiedSnippet} onCopy={copySnippet} text={fullUrl} />
                    </GuideStep>
                  </TabsContent>
                </Tabs>
              );
            })()}
          </div>

          <DialogFooter className="mx-0 mb-0 rounded-b-none border-t border-border bg-transparent px-6 py-3">
            <Button variant="outline" onClick={() => setGuideWebhook(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatChip({ label, value, colorVar }: { label: string; value: number | string; colorVar: string }) {
  return (
    <span className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
      <span className="font-semibold" style={{ color: colorVar }}>
        {value}
      </span>
      {label}
    </span>
  );
}

function ToolBanner({ meta, description }: { meta: { icon: typeof Activity; color: string; label: string }; description: string }) {
  const Icon = meta.icon;
  return (
    <div
      className="flex items-center gap-3 rounded-lg border border-border p-3"
      style={{ background: `color-mix(in srgb, ${meta.color} 8%, transparent)` }}
    >
      <div
        className="flex size-9 shrink-0 items-center justify-center rounded-lg"
        style={{ background: `color-mix(in srgb, ${meta.color} 18%, transparent)`, color: meta.color }}
      >
        <Icon size={18} />
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function GuideStep({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
        {n}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">{children}</div>
    </div>
  );
}

function CopyBlock({
  id,
  text,
  label,
  copiedKey,
  onCopy,
}: {
  id: string;
  text: string;
  label?: string;
  copiedKey: string | null;
  onCopy: (id: string, text: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-black/20 shadow-sm">
      {label && (
        <div className="flex items-center gap-1.5 border-b border-white/10 bg-[#161b22] px-3 py-1.5">
          <span className="size-2 rounded-full bg-[#ff5f57]" />
          <span className="size-2 rounded-full bg-[#febc2e]" />
          <span className="size-2 rounded-full bg-[#28c840]" />
          <span className="ml-1.5 font-mono text-[0.6875rem] text-white/50">{label}</span>
        </div>
      )}
      <div className="relative bg-[#0d1117]">
        <pre className="p-3 pr-11 font-mono text-[0.75rem] leading-snug whitespace-pre-wrap text-[#c9d1d9]">
          {text}
        </pre>
        <Button
          variant="secondary"
          size="icon-sm"
          className={cn(
            'absolute top-2 right-2 border border-white/10 bg-white/10 text-white/70 hover:bg-white/20 hover:text-white',
            copiedKey === id && 'bg-[var(--green)]/25 text-[var(--green)]'
          )}
          onClick={() => onCopy(id, text)}
          title={copiedKey === id ? 'Copiado!' : 'Copiar'}
        >
          {copiedKey === id ? <CheckCircle size={13} /> : <Copy size={13} />}
        </Button>
      </div>
    </div>
  );
}
