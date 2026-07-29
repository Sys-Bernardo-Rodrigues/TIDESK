import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Bell, Save, AlertCircle, Send } from 'lucide-react';
import { usePermissions, RESOURCES, ACTIONS } from '../hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';

interface SlackConfig {
  enabled: boolean;
  webhookUrl: string;
}

export default function Notificacoes() {
  const [config, setConfig] = useState<SlackConfig>({ enabled: false, webhookUrl: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { hasPermission } = usePermissions();

  const canEdit = hasPermission(RESOURCES.CONFIG, ACTIONS.EDIT);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const response = await axios.get<SlackConfig>('/api/notifications/slack-config');
      setConfig(response.data);
    } catch (err) {
      console.error('Erro ao buscar configuração do Slack:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const saveConfig = async () => {
    if (!canEdit) return;
    try {
      setSaving(true);
      setError(null);
      const response = await axios.put<SlackConfig>('/api/notifications/slack-config', config);
      setConfig(response.data);
      toast.success('Configuração salva com sucesso!');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao salvar configuração');
    } finally {
      setSaving(false);
    }
  };

  const testConfig = async () => {
    if (!canEdit) return;
    if (!config.webhookUrl) {
      toast.error('Informe a URL do webhook antes de testar');
      return;
    }
    try {
      setTesting(true);
      setError(null);
      await axios.post('/api/notifications/slack-config/test', { webhookUrl: config.webhookUrl });
      toast.success('Mensagem de teste enviada! Confira o canal no Slack.');
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Erro ao testar webhook';
      setError(msg);
      toast.error(msg);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Notificações</h1>
        <p className="mt-1 text-muted-foreground">Configure o envio de notificações para o Slack quando novos tickets forem criados</p>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-destructive bg-destructive/10 p-3 text-destructive">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      <Card className="mb-5 p-5">
        <div className="mb-3 flex items-center gap-2">
          <Bell size={20} className="text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Slack</h2>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : (
          <div className="flex flex-col gap-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
              <Checkbox
                checked={config.enabled}
                disabled={!canEdit}
                onCheckedChange={(checked) => setConfig((c) => ({ ...c, enabled: checked === true }))}
              />
              Notificar novo ticket no Slack
            </label>

            <div className="flex max-w-[560px] flex-col gap-1">
              <Label className="text-xs text-muted-foreground">URL do Incoming Webhook</Label>
              <Input
                type="text"
                placeholder="https://hooks.slack.com/services/XXX/YYY/ZZZ"
                value={config.webhookUrl}
                disabled={!canEdit}
                onChange={(e) => setConfig((c) => ({ ...c, webhookUrl: e.target.value }))}
              />
            </div>

            {canEdit && (
              <div className="flex gap-2">
                <Button onClick={saveConfig} disabled={saving}>
                  <Save size={17} />
                  {saving ? 'Salvando...' : 'Salvar'}
                </Button>
                <Button variant="secondary" onClick={testConfig} disabled={testing}>
                  <Send size={17} />
                  {testing ? 'Enviando...' : 'Testar'}
                </Button>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Tickets criados manualmente ou via formulário disparam a notificação. Tickets criados por Webhooks (integrações externas) não notificam.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
