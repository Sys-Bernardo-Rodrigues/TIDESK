import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Sparkles, Save, AlertCircle } from 'lucide-react';
import { usePermissions, RESOURCES, ACTIONS } from '../hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';

interface AiProviderConfig {
  apiKey: string;
  enabled: boolean;
}

interface AiConfig {
  groq: AiProviderConfig;
  openrouter: AiProviderConfig;
  gemini: AiProviderConfig;
}

const EMPTY_CONFIG: AiConfig = {
  groq: { apiKey: '', enabled: true },
  openrouter: { apiKey: '', enabled: true },
  gemini: { apiKey: '', enabled: true }
};

const PROVIDERS: { key: keyof AiConfig; label: string; helpUrl: string; helpLabel: string }[] = [
  { key: 'groq', label: 'Groq', helpUrl: 'https://console.groq.com/keys', helpLabel: 'console.groq.com/keys' },
  { key: 'openrouter', label: 'OpenRouter', helpUrl: 'https://openrouter.ai/keys', helpLabel: 'openrouter.ai/keys' },
  { key: 'gemini', label: 'Google Gemini', helpUrl: 'https://aistudio.google.com/apikey', helpLabel: 'aistudio.google.com/apikey' }
];

export default function ConfigIa() {
  const [config, setConfig] = useState<AiConfig>(EMPTY_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { hasPermission } = usePermissions();

  const canEdit = hasPermission(RESOURCES.CONFIG, ACTIONS.EDIT);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const response = await axios.get<AiConfig>('/api/config/ia-config');
      setConfig(response.data);
    } catch (err) {
      console.error('Erro ao buscar configuração de IA:', err);
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
      const response = await axios.put<AiConfig>('/api/config/ia-config', config);
      setConfig(response.data);
      toast.success('Configuração salva com sucesso!');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao salvar configuração');
    } finally {
      setSaving(false);
    }
  };

  const updateProvider = (key: keyof AiConfig, patch: Partial<AiProviderConfig>) => {
    setConfig((c) => ({ ...c, [key]: { ...c[key], ...patch } }));
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Assistente de IA</h1>
        <p className="mt-1 text-muted-foreground">
          Configure as chaves de API dos provedores gratuitos usados pelo assistente de criação de tickets via PDF de ordem de serviço em /tickets.
          A ordem de tentativa é fixa: Groq → OpenRouter → Gemini — se um estiver sem quota ou desabilitado, o próximo é usado automaticamente.
        </p>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-destructive bg-destructive/10 p-3 text-destructive">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : (
        <>
          {PROVIDERS.map(({ key, label, helpUrl, helpLabel }) => (
            <Card key={key} className="mb-5 p-5">
              <div className="mb-3 flex items-center gap-2">
                <Sparkles size={20} className="text-primary" />
                <h2 className="text-lg font-semibold text-foreground">{label}</h2>
              </div>

              <div className="flex flex-col gap-4">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                  <Checkbox
                    checked={config[key].enabled}
                    disabled={!canEdit}
                    onCheckedChange={(checked) => updateProvider(key, { enabled: checked === true })}
                  />
                  Ativado
                </label>

                <div className="flex max-w-[560px] flex-col gap-1">
                  <Label className="text-xs text-muted-foreground">Chave de API</Label>
                  <Input
                    type="password"
                    placeholder={`Chave de API do ${label}`}
                    value={config[key].apiKey}
                    disabled={!canEdit}
                    onChange={(e) => updateProvider(key, { apiKey: e.target.value })}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Gere uma chave gratuita em{' '}
                    <a href={helpUrl} target="_blank" rel="noreferrer" className="underline">
                      {helpLabel}
                    </a>
                  </p>
                </div>
              </div>
            </Card>
          ))}

          {canEdit && (
            <Button onClick={saveConfig} disabled={saving}>
              <Save size={17} />
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
