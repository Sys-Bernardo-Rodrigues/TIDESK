import fs from 'fs';
import path from 'path';

export interface SlackConfig {
  enabled: boolean;
  webhookUrl: string;
}

const CONFIG_DIR = path.join(process.cwd(), 'config');
const CONFIG_FILE = path.join(CONFIG_DIR, 'slack-config.json');

const DEFAULT_CONFIG: SlackConfig = {
  enabled: false,
  webhookUrl: ''
};

function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

export function getSlackConfig(): SlackConfig {
  ensureConfigDir();
  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<SlackConfig>;
    return {
      enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : DEFAULT_CONFIG.enabled,
      webhookUrl: typeof parsed.webhookUrl === 'string' ? parsed.webhookUrl : DEFAULT_CONFIG.webhookUrl
    };
  } catch {
    // Sem arquivo salvo ainda: usa SLACK_WEBHOOK_URL do .env como valor inicial
    if (process.env.SLACK_WEBHOOK_URL) {
      return { enabled: true, webhookUrl: process.env.SLACK_WEBHOOK_URL };
    }
    return { ...DEFAULT_CONFIG };
  }
}

export function saveSlackConfig(config: Partial<SlackConfig>): SlackConfig {
  ensureConfigDir();
  const current = getSlackConfig();
  const next: SlackConfig = {
    enabled: typeof config.enabled === 'boolean' ? config.enabled : current.enabled,
    webhookUrl: typeof config.webhookUrl === 'string' ? config.webhookUrl.trim() : current.webhookUrl
  };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(next, null, 2), 'utf-8');
  return next;
}

export interface SlackTicketPayload {
  ticketId: number;
  ticketNumber: number;
  title: string;
  description: string;
  priority: string;
  userName?: string | null;
  categoryName?: string | null;
}

const PRIORITY_EMOJI: Record<string, string> = {
  low: '🟢',
  medium: '🟡',
  high: '🟠',
  urgent: '🔴'
};

function buildMessage(payload: { title: string; description: string; priority: string; ticketNumber: number; categoryName?: string | null; userName?: string | null }) {
  const emoji = PRIORITY_EMOJI[payload.priority] || '⚪';
  const shortDescription = payload.description.length > 300
    ? payload.description.substring(0, 297) + '...'
    : payload.description;

  return {
    text: `${emoji} Novo ticket #${payload.ticketNumber}: ${payload.title}`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${emoji} *Novo ticket #${payload.ticketNumber}*\n*${payload.title}*`
        }
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Prioridade:*\n${payload.priority}` },
          { type: 'mrkdwn', text: `*Categoria:*\n${payload.categoryName || 'Sem categoria'}` },
          { type: 'mrkdwn', text: `*Solicitante:*\n${payload.userName || 'Desconhecido'}` }
        ]
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: shortDescription
        }
      }
    ]
  };
}

async function postToSlack(webhookUrl: string, body: unknown): Promise<{ ok: boolean; status: number; text: string }> {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return { ok: response.ok, status: response.status, text: response.ok ? '' : await response.text() };
}

export async function sendSlackNewTicketNotification(payload: SlackTicketPayload): Promise<void> {
  const config = getSlackConfig();
  if (!config.enabled || !config.webhookUrl) {
    return;
  }

  try {
    const result = await postToSlack(config.webhookUrl, buildMessage(payload));
    if (!result.ok) {
      console.error(`[Slack] Falha ao enviar notificação: ${result.status} ${result.text}`);
    }
  } catch (error) {
    console.error('[Slack] Erro ao enviar notificação:', error);
  }
}

export async function sendSlackTestMessage(webhookUrl: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const result = await postToSlack(webhookUrl, buildMessage({
      title: 'Mensagem de teste do TIDESK',
      description: 'Se você está vendo isso, a integração com o Slack está funcionando.',
      priority: 'medium',
      ticketNumber: 0,
      categoryName: 'Teste',
      userName: 'TIDESK'
    }));
    if (!result.ok) {
      return { ok: false, error: `${result.status} ${result.text}` };
    }
    return { ok: true };
  } catch (error: any) {
    return { ok: false, error: error.message || 'Erro desconhecido' };
  }
}
