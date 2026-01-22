import { useState, useEffect } from 'react';
import axios from 'axios';
import { Webhook, Plus, Search, Edit, Trash2, Copy, Link as LinkIcon, Eye, CheckCircle, XCircle, Activity, Settings, Filter, X, Send, RefreshCw } from 'lucide-react';
import { formatDateBR } from '../utils/dateUtils';
import { usePermissions, RESOURCES, ACTIONS } from '../hooks/usePermissions';

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
  const [filterActive, setFilterActive] = useState<string>('all'); // all, active, inactive
  const [filterPriority, setFilterPriority] = useState<string>('all'); // all, low, medium, high, urgent
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
    category_id: '',
    assigned_to: '',
    active: true
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
      const response = await axios.get('/api/webhooks');
      setWebhooks(response.data);
      setError(null);
    } catch (err: any) {
      console.error('Erro ao buscar webhooks:', err);
      setError(err.response?.data?.error || 'Erro ao buscar webhooks');
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
      const response = await axios.get('/api/users');
      setUsers(response.data);
    } catch (err: any) {
      // Se não tiver permissão (não é admin), apenas logar o erro
      if (err.response?.status !== 403) {
        console.error('Erro ao buscar usuários:', err);
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
      alert(err.response?.data?.error || 'Erro ao buscar logs');
    } finally {
      setLogsLoading(false);
    }
  };

  const handleDelete = async (webhookId: number) => {
    if (!canDelete) {
      alert('Você não tem permissão para deletar webhooks');
      return;
    }

    if (!window.confirm('Tem certeza que deseja excluir este webhook?')) {
      return;
    }

    try {
      await axios.delete(`/api/webhooks/${webhookId}`);
      setWebhooks(webhooks.filter(w => w.id !== webhookId));
      if (selectedWebhook?.id === webhookId) {
        setSelectedWebhook(null);
        setShowLogs(false);
      }
    } catch (err: any) {
      console.error('Erro ao excluir webhook:', err);
      alert(err.response?.data?.error || 'Erro ao excluir webhook');
    }
  };

  const copyWebhookUrl = (webhookUrl: string) => {
    const fullUrl = `${window.location.origin}/api/webhooks/receive/${webhookUrl}`;
    navigator.clipboard.writeText(fullUrl);
    alert('URL do webhook copiada para a área de transferência!');
  };

  const copySecretKey = (secretKey: string) => {
    navigator.clipboard.writeText(secretKey);
    alert('Secret key copiada para a área de transferência!');
  };

  const toggleActive = async (webhook: WebhookData) => {
    if (!canEdit) {
      alert('Você não tem permissão para editar webhooks');
      return;
    }

    try {
      await axios.put(`/api/webhooks/${webhook.id}`, {
        active: webhook.active ? 0 : 1
      });
      await fetchWebhooks();
    } catch (err: any) {
      console.error('Erro ao atualizar webhook:', err);
      alert(err.response?.data?.error || 'Erro ao atualizar webhook');
    }
  };

  const handleViewLogs = async (webhook: WebhookData) => {
    setSelectedWebhook(webhook);
    setShowLogs(true);
    await fetchLogs(webhook.id);
  };

  const handleCreate = () => {
    setEditingWebhook(null);
    setFormData({
      name: '',
      description: '',
      priority: 'medium',
      category_id: '',
      assigned_to: '',
      active: true
    });
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
      active: webhook.active === 1
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
        active: formData.active ? 1 : 0
      };

      if (formData.category_id) {
        payload.category_id = parseInt(formData.category_id);
      }
      if (formData.assigned_to) {
        payload.assigned_to = parseInt(formData.assigned_to);
      }

      if (editingWebhook) {
        await axios.put(`/api/webhooks/${editingWebhook.id}`, payload);
        alert('Webhook atualizado com sucesso!');
      } else {
        await axios.post('/api/webhooks', payload);
        alert('Webhook criado com sucesso!');
      }

      setShowForm(false);
      setEditingWebhook(null);
      await fetchWebhooks();
    } catch (err: any) {
      console.error('Erro ao salvar webhook:', err);
      alert(err.response?.data?.error || 'Erro ao salvar webhook');
    }
  };

  const testWebhook = async (webhook: WebhookData) => {
    if (!window.confirm('Deseja enviar um teste para este webhook?')) {
      return;
    }

    try {
      const testPayload = {
        test: true,
        message: 'Teste de webhook do TIDESK',
        timestamp: new Date().toISOString()
      };

      const headers: any = {
        'Content-Type': 'application/json'
      };

      if (webhook.secret_key) {
        headers['x-webhook-secret'] = webhook.secret_key;
      }

      const response = await axios.post(
        `/api/webhooks/receive/${webhook.webhook_url}`,
        testPayload,
        { headers }
      );

      alert('Teste enviado com sucesso! Ticket criado: ' + (response.data.ticket_id || 'N/A'));
      await fetchWebhooks();
    } catch (err: any) {
      console.error('Erro ao testar webhook:', err);
      alert(err.response?.data?.error || 'Erro ao testar webhook');
    }
  };

  const filteredWebhooks = webhooks.filter(webhook => {
    const matchesSearch = webhook.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (webhook.description && webhook.description.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesActive = filterActive === 'all' || 
      (filterActive === 'active' && webhook.active === 1) ||
      (filterActive === 'inactive' && webhook.active === 0);
    
    const matchesPriority = filterPriority === 'all' || webhook.priority === filterPriority;

    return matchesSearch && matchesActive && matchesPriority;
  });

  const priorityColors: Record<string, string> = {
    urgent: 'var(--red)',
    high: 'var(--red)',
    medium: 'var(--orange)',
    low: 'var(--blue)'
  };

  const priorityLabels: Record<string, string> = {
    urgent: 'Urgente',
    high: 'Alta',
    medium: 'Média',
    low: 'Baixa'
  };

  if (!canView) {
    return (
      <div style={{ padding: 'var(--spacing-2xl)', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Você não tem permissão para visualizar webhooks.</p>
      </div>
    );
  }

  if (loading) {
    return <div className="loading">Carregando webhooks...</div>;
  }

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
          Webhooks
        </h1>
        <p style={{
          color: 'var(--text-secondary)',
          fontSize: '1rem',
          fontWeight: '400'
        }}>
          Gerencie webhooks para receber notificações de outros sistemas e criar tickets automaticamente
        </p>
      </div>

      {error && (
        <div style={{
          padding: 'var(--spacing-md)',
          background: 'var(--red-light)',
          border: '1px solid var(--red)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--red)',
          marginBottom: 'var(--spacing-lg)'
        }}>
          {error}
        </div>
      )}

      {/* Filtros e Busca */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: 'var(--spacing-lg)',
        gap: 'var(--spacing-md)',
        flexWrap: 'wrap'
      }}>
        <div style={{ 
          display: 'flex',
          gap: 'var(--spacing-md)',
          flex: 1,
          flexWrap: 'wrap',
          alignItems: 'center'
        }}>
          <div style={{ 
            position: 'relative',
            flex: '1',
            minWidth: '300px',
            maxWidth: '500px'
          }}>
            <Search 
              size={20} 
              style={{ 
                position: 'absolute', 
                left: 'var(--spacing-md)', 
                top: '50%', 
                transform: 'translateY(-50%)',
                color: 'var(--text-tertiary)',
                pointerEvents: 'none'
              }} 
            />
            <input
              type="text"
              className="input"
              placeholder="Buscar webhooks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingLeft: 'calc(var(--spacing-md) + 24px + var(--spacing-sm))' }}
            />
          </div>

          <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center' }}>
            <Filter size={18} color="var(--text-secondary)" />
            <select
              className="input"
              value={filterActive}
              onChange={(e) => setFilterActive(e.target.value)}
              style={{ 
                padding: 'var(--spacing-sm) var(--spacing-md)',
                minWidth: '120px'
              }}
            >
              <option value="all">Todos</option>
              <option value="active">Ativos</option>
              <option value="inactive">Inativos</option>
            </select>

            <select
              className="input"
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              style={{ 
                padding: 'var(--spacing-sm) var(--spacing-md)',
                minWidth: '140px'
              }}
            >
              <option value="all">Todas Prioridades</option>
              <option value="urgent">Urgente</option>
              <option value="high">Alta</option>
              <option value="medium">Média</option>
              <option value="low">Baixa</option>
            </select>
          </div>
        </div>

        {canCreate && (
          <button 
            className="btn btn-primary"
            onClick={handleCreate}
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}
          >
            <Plus size={20} />
            Novo Webhook
          </button>
        )}
      </div>

      {/* Estatísticas Rápidas */}
      {webhooks.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 'var(--spacing-md)',
          marginBottom: 'var(--spacing-lg)'
        }}>
          <div className="card" style={{ 
            border: '1px solid var(--border-primary)',
            padding: 'var(--spacing-md)'
          }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 'var(--spacing-xs)' }}>
              Total de Webhooks
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--text-primary)' }}>
              {webhooks.length}
            </div>
          </div>
          <div className="card" style={{ 
            border: '1px solid var(--border-primary)',
            padding: 'var(--spacing-md)'
          }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 'var(--spacing-xs)' }}>
              Ativos
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--green)' }}>
              {webhooks.filter(w => w.active === 1).length}
            </div>
          </div>
          <div className="card" style={{ 
            border: '1px solid var(--border-primary)',
            padding: 'var(--spacing-md)'
          }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 'var(--spacing-xs)' }}>
              Total de Chamadas
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--text-primary)' }}>
              {webhooks.reduce((sum, w) => sum + (w.total_calls || 0), 0)}
            </div>
          </div>
          <div className="card" style={{ 
            border: '1px solid var(--border-primary)',
            padding: 'var(--spacing-md)'
          }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 'var(--spacing-xs)' }}>
              Taxa de Sucesso
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--green)' }}>
              {(() => {
                const total = webhooks.reduce((sum, w) => sum + (w.total_calls || 0), 0);
                const success = webhooks.reduce((sum, w) => sum + (w.success_calls || 0), 0);
                return total > 0 ? `${Math.round((success / total) * 100)}%` : '0%';
              })()}
            </div>
          </div>
        </div>
      )}

      {filteredWebhooks.length === 0 ? (
        <div className="card" style={{ 
          padding: 'var(--spacing-2xl)',
          textAlign: 'center',
          border: '1px solid var(--border-primary)'
        }}>
          <Webhook size={48} style={{ marginBottom: 'var(--spacing-md)', opacity: 0.5 }} />
          <p style={{ color: 'var(--text-secondary)' }}>
            {searchTerm || filterActive !== 'all' || filterPriority !== 'all' 
              ? 'Nenhum webhook encontrado com os filtros aplicados' 
              : 'Nenhum webhook criado ainda'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
          {filteredWebhooks.map((webhook) => {
            const successRate = webhook.total_calls > 0 
              ? Math.round((webhook.success_calls / webhook.total_calls) * 100) 
              : 0;

            return (
              <div key={webhook.id} className="card" style={{ 
                border: '1px solid var(--border-primary)',
                padding: 'var(--spacing-xl)'
              }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: 'var(--spacing-md)'
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 'var(--spacing-md)',
                      marginBottom: 'var(--spacing-sm)',
                      flexWrap: 'wrap'
                    }}>
                      <Webhook size={24} color={webhook.active ? 'var(--green)' : 'var(--text-tertiary)'} />
                      <h3 style={{ 
                        fontSize: '1.25rem', 
                        fontWeight: '600',
                        color: 'var(--text-primary)'
                      }}>
                        {webhook.name}
                      </h3>
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        backgroundColor: webhook.active ? 'var(--green-light)' : 'var(--bg-tertiary)',
                        color: webhook.active ? 'var(--green)' : 'var(--text-tertiary)'
                      }}>
                        {webhook.active ? 'Ativo' : 'Inativo'}
                      </span>
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        backgroundColor: priorityColors[webhook.priority] + '20',
                        color: priorityColors[webhook.priority]
                      }}>
                        {priorityLabels[webhook.priority]}
                      </span>
                    </div>
                    {webhook.description && (
                      <p style={{ 
                        color: 'var(--text-secondary)',
                        marginBottom: 'var(--spacing-md)'
                      }}>
                        {webhook.description}
                      </p>
                    )}
                    
                    {/* URL e Secret Key */}
                    <div style={{ 
                      display: 'flex', 
                      flexDirection: 'column',
                      gap: 'var(--spacing-sm)',
                      marginBottom: 'var(--spacing-md)'
                    }}>
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 'var(--spacing-sm)',
                        padding: 'var(--spacing-sm)',
                        background: 'var(--bg-secondary)',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-primary)'
                      }}>
                        <LinkIcon size={16} color="var(--text-secondary)" />
                        <code style={{ 
                          fontSize: '0.8125rem',
                          color: 'var(--text-primary)',
                          flex: 1,
                          wordBreak: 'break-all'
                        }}>
                          {window.location.origin}/api/webhooks/receive/{webhook.webhook_url}
                        </code>
                        <button
                          onClick={() => copyWebhookUrl(webhook.webhook_url)}
                          className="btn btn-secondary btn-sm"
                          title="Copiar URL"
                        >
                          <Copy size={14} />
                        </button>
                      </div>

                      {webhook.secret_key && (
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: 'var(--spacing-sm)',
                          padding: 'var(--spacing-sm)',
                          background: 'var(--bg-secondary)',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border-primary)'
                        }}>
                          <Settings size={16} color="var(--text-secondary)" />
                          <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                            Secret Key:
                          </span>
                          <code style={{ 
                            fontSize: '0.8125rem',
                            color: 'var(--text-primary)',
                            flex: 1,
                            wordBreak: 'break-all'
                          }}>
                            {webhook.secret_key.substring(0, 20)}...
                          </code>
                          <button
                            onClick={() => copySecretKey(webhook.secret_key)}
                            className="btn btn-secondary btn-sm"
                            title="Copiar Secret Key"
                          >
                            <Copy size={14} />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Estatísticas */}
                    <div style={{ 
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                      gap: 'var(--spacing-md)',
                      marginBottom: 'var(--spacing-md)'
                    }}>
                      <div style={{
                        padding: 'var(--spacing-sm)',
                        background: 'var(--bg-secondary)',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-primary)'
                      }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 'var(--spacing-xs)' }}>
                          Chamadas
                        </div>
                        <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                          {webhook.total_calls || 0}
                        </div>
                      </div>
                      <div style={{
                        padding: 'var(--spacing-sm)',
                        background: 'var(--bg-secondary)',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-primary)'
                      }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 'var(--spacing-xs)' }}>
                          Sucessos
                        </div>
                        <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--green)' }}>
                          {webhook.success_calls || 0}
                        </div>
                      </div>
                      <div style={{
                        padding: 'var(--spacing-sm)',
                        background: 'var(--bg-secondary)',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-primary)'
                      }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 'var(--spacing-xs)' }}>
                          Taxa de Sucesso
                        </div>
                        <div style={{ fontSize: '1.25rem', fontWeight: '700', color: successRate >= 80 ? 'var(--green)' : successRate >= 50 ? 'var(--orange)' : 'var(--red)' }}>
                          {successRate}%
                        </div>
                      </div>
                    </div>

                    {/* Informações Adicionais */}
                    <div style={{ 
                      display: 'flex', 
                      gap: 'var(--spacing-md)',
                      flexWrap: 'wrap',
                      fontSize: '0.875rem',
                      color: 'var(--text-secondary)'
                    }}>
                      {webhook.category_name && (
                        <span>Categoria: <strong>{webhook.category_name}</strong></span>
                      )}
                      {webhook.assigned_to_name && (
                        <span>Atribuído a: <strong>{webhook.assigned_to_name}</strong></span>
                      )}
                      <span>Criado em: <strong>{formatDateBR(webhook.created_at)}</strong></span>
                    </div>
                  </div>

                  {/* Ações */}
                  <div style={{ 
                    display: 'flex', 
                    gap: 'var(--spacing-sm)',
                    flexDirection: 'column',
                    minWidth: '120px'
                  }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => toggleActive(webhook)}
                      disabled={!canEdit}
                      style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', justifyContent: 'center' }}
                    >
                      {webhook.active ? 'Desativar' : 'Ativar'}
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => testWebhook(webhook)}
                      style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', justifyContent: 'center' }}
                    >
                      <Send size={14} />
                      Testar
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleViewLogs(webhook)}
                      style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', justifyContent: 'center' }}
                    >
                      <Eye size={14} />
                      Logs
                    </button>
                    {canEdit && (
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleEdit(webhook)}
                        style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', justifyContent: 'center' }}
                      >
                        <Edit size={14} />
                        Editar
                      </button>
                    )}
                    {canDelete && (
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(webhook.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', justifyContent: 'center' }}
                      >
                        <Trash2 size={14} />
                        Deletar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Formulário */}
      {showForm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: 'var(--spacing-lg)'
        }}
        onClick={() => {
          setShowForm(false);
          setEditingWebhook(null);
        }}
        >
          <div className="card" style={{
            maxWidth: '600px',
            width: '100%',
            maxHeight: '90vh',
            overflow: 'auto',
            border: '1px solid var(--border-primary)',
            padding: 'var(--spacing-xl)'
          }}
          onClick={(e) => e.stopPropagation()}
          >
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 'var(--spacing-lg)'
            }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                {editingWebhook ? 'Editar Webhook' : 'Novo Webhook'}
              </h3>
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingWebhook(null);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                  fontSize: '1.5rem',
                  padding: 'var(--spacing-xs)'
                }}
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                <div>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: 'var(--spacing-xs)',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    color: 'var(--text-primary)'
                  }}>
                    Nome *
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    placeholder="Ex: Zabbix Alerts"
                  />
                </div>

                <div>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: 'var(--spacing-xs)',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    color: 'var(--text-primary)'
                  }}>
                    Descrição
                  </label>
                  <textarea
                    className="input"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Descrição do webhook..."
                    rows={3}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)' }}>
                  <div>
                    <label style={{ 
                      display: 'block', 
                      marginBottom: 'var(--spacing-xs)',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      color: 'var(--text-primary)'
                    }}>
                      Prioridade *
                    </label>
                    <select
                      className="input"
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                      required
                    >
                      <option value="low">Baixa</option>
                      <option value="medium">Média</option>
                      <option value="high">Alta</option>
                      <option value="urgent">Urgente</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ 
                      display: 'block', 
                      marginBottom: 'var(--spacing-xs)',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      color: 'var(--text-primary)'
                    }}>
                      Status
                    </label>
                    <select
                      className="input"
                      value={formData.active ? '1' : '0'}
                      onChange={(e) => setFormData({ ...formData, active: e.target.value === '1' })}
                    >
                      <option value="1">Ativo</option>
                      <option value="0">Inativo</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: 'var(--spacing-xs)',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    color: 'var(--text-primary)'
                  }}>
                    Categoria
                  </label>
                  <select
                    className="input"
                    value={formData.category_id}
                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                  >
                    <option value="">Nenhuma categoria</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id.toString()}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: 'var(--spacing-xs)',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    color: 'var(--text-primary)'
                  }}>
                    Atribuir a
                  </label>
                  <select
                    className="input"
                    value={formData.assigned_to}
                    onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                  >
                    <option value="">Nenhum usuário</option>
                    {users.map(user => (
                      <option key={user.id} value={user.id.toString()}>
                        {user.name} ({user.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ 
                  display: 'flex', 
                  gap: 'var(--spacing-md)',
                  marginTop: 'var(--spacing-md)'
                }}>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                  >
                    {editingWebhook ? 'Atualizar' : 'Criar'} Webhook
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setShowForm(false);
                      setEditingWebhook(null);
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Logs */}
      {showLogs && selectedWebhook && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: 'var(--spacing-lg)'
        }}
        onClick={() => {
          setShowLogs(false);
          setSelectedWebhook(null);
        }}
        >
          <div className="card" style={{
            maxWidth: '900px',
            width: '100%',
            maxHeight: '85vh',
            overflow: 'auto',
            border: '1px solid var(--border-primary)',
            padding: 'var(--spacing-xl)'
          }}
          onClick={(e) => e.stopPropagation()}
          >
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 'var(--spacing-lg)'
            }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: 'var(--spacing-xs)' }}>
                  Logs - {selectedWebhook.name}
                </h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  {selectedWebhook.total_calls || 0} chamadas • {selectedWebhook.success_calls || 0} sucessos • {selectedWebhook.error_calls || 0} erros
                </p>
              </div>
              <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                <button
                  onClick={async () => {
                    await fetchLogs(selectedWebhook.id);
                  }}
                  className="btn btn-secondary btn-sm"
                  title="Atualizar logs"
                >
                  <RefreshCw size={16} />
                </button>
                <button
                  onClick={() => {
                    setShowLogs(false);
                    setSelectedWebhook(null);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-secondary)',
                    fontSize: '1.5rem',
                    padding: 'var(--spacing-xs)'
                  }}
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            {logsLoading ? (
              <div className="loading">Carregando logs...</div>
            ) : logs.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: 'var(--spacing-xl)' }}>
                Nenhum log encontrado
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                {logs.map((log) => (
                  <div key={log.id} style={{
                    padding: 'var(--spacing-md)',
                    background: 'var(--bg-secondary)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-primary)'
                  }}>
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 'var(--spacing-sm)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                        {log.status === 'success' ? (
                          <CheckCircle size={18} color="var(--green)" />
                        ) : (
                          <XCircle size={18} color="var(--red)" />
                        )}
                        <span style={{ 
                          fontWeight: '600',
                          color: log.status === 'success' ? 'var(--green)' : 'var(--red)'
                        }}>
                          {log.status === 'success' ? 'Sucesso' : 'Erro'}
                        </span>
                        {log.response_code && (
                          <span style={{ 
                            fontSize: '0.75rem',
                            color: 'var(--text-tertiary)',
                            padding: '2px 6px',
                            background: 'var(--bg-tertiary)',
                            borderRadius: 'var(--radius-sm)'
                          }}>
                            {log.response_code}
                          </span>
                        )}
                        {log.ticket_number && (
                          <span style={{ 
                            fontSize: '0.75rem',
                            color: 'var(--text-secondary)',
                            padding: '2px 6px',
                            background: 'var(--blue-light)',
                            borderRadius: 'var(--radius-sm)'
                          }}>
                            Ticket #{log.ticket_number}
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                        {formatDateBR(log.created_at, { includeTime: true })}
                      </span>
                    </div>
                    {log.error_message && (
                      <p style={{ 
                        color: 'var(--red)',
                        fontSize: '0.875rem',
                        marginBottom: 'var(--spacing-xs)',
                        padding: 'var(--spacing-xs)',
                        background: 'var(--red-light)',
                        borderRadius: 'var(--radius-sm)'
                      }}>
                        {log.error_message}
                      </p>
                    )}
                    {log.payload && (
                      <details style={{ marginTop: 'var(--spacing-xs)' }}>
                        <summary style={{ 
                          cursor: 'pointer',
                          color: 'var(--text-secondary)',
                          fontSize: '0.875rem',
                          fontWeight: '500'
                        }}>
                          Ver payload
                        </summary>
                        <pre style={{
                          marginTop: 'var(--spacing-xs)',
                          padding: 'var(--spacing-sm)',
                          background: 'var(--bg-tertiary)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.75rem',
                          overflow: 'auto',
                          maxHeight: '300px',
                          border: '1px solid var(--border-primary)'
                        }}>
                          {JSON.stringify(JSON.parse(log.payload), null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
