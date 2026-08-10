import { getAiConfig, AiProviderName } from './ai-config-service';

export interface TicketExtraction {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  suggestedCategory: string | null;
}

export interface AiProviderResult {
  extraction: TicketExtraction;
  providerUsed: AiProviderName;
}

export class AiAllProvidersFailedError extends Error {
  attempts: { provider: AiProviderName; error: string }[];
  constructor(attempts: { provider: AiProviderName; error: string }[]) {
    super('Todos os provedores de IA falharam ao analisar o PDF');
    this.name = 'AiAllProvidersFailedError';
    this.attempts = attempts;
  }
}

// Nomes de modelo grátis mudam de disponibilidade com o tempo nos provedores —
// manter isolado aqui facilita trocar sem mexer no resto da lógica.
const MODELS = {
  groq: 'llama-3.1-8b-instant',
  openrouter: 'meta-llama/llama-3.1-8b-instruct:free',
  gemini: 'gemini-1.5-flash'
};

const SYSTEM_PROMPT = `Você é um assistente que extrai informações estruturadas de ordens de serviço (OS) para criar tickets de helpdesk. A partir do texto fornecido, responda APENAS com um JSON válido (sem markdown, sem texto adicional) no formato exato:
{"title": "...", "description": "...", "priority": "low|medium|high|urgent", "suggestedCategory": "..." ou null}
- title: título curto e descritivo (máx 120 caracteres)
- description: resumo claro do problema/serviço solicitado, reaproveitando trechos relevantes do texto original
- priority: avalie a urgência pelo conteúdo (use "medium" se não houver indício claro)
- suggestedCategory: nome da categoria de serviço mais provável (ex: "Rede", "Hardware", "Software", "Impressora") ou null se não for possível inferir`;

function buildUserPrompt(text: string): string {
  const truncated = text.length > 15000 ? text.slice(0, 15000) : text;
  return `Texto extraído do PDF da ordem de serviço:\n\n${truncated}`;
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 20000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function extractJson(raw: string): any {
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }
    throw new Error('Resposta não contém JSON válido');
  }
}

function normalizeExtraction(parsed: any): TicketExtraction {
  const title = typeof parsed?.title === 'string' ? parsed.title.trim() : '';
  const description = typeof parsed?.description === 'string' ? parsed.description.trim() : '';
  if (!title || !description) {
    throw new Error('Extração incompleta (título ou descrição vazios)');
  }
  const validPriorities = ['low', 'medium', 'high', 'urgent'];
  const priority = validPriorities.includes(parsed?.priority) ? parsed.priority : 'medium';
  const suggestedCategory = typeof parsed?.suggestedCategory === 'string' && parsed.suggestedCategory.trim()
    ? parsed.suggestedCategory.trim()
    : null;
  return { title, description, priority, suggestedCategory };
}

async function callOpenAiCompatible(
  url: string,
  apiKey: string,
  model: string,
  text: string,
  extraHeaders: Record<string, string> = {}
): Promise<TicketExtraction> {
  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      ...extraHeaders
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(text) }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2
    })
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`HTTP ${response.status}: ${body.slice(0, 200)}`);
  }

  const data: any = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') {
    throw new Error('Resposta sem conteúdo');
  }
  return normalizeExtraction(extractJson(content));
}

async function callGroq(text: string, apiKey: string): Promise<TicketExtraction> {
  return callOpenAiCompatible('https://api.groq.com/openai/v1/chat/completions', apiKey, MODELS.groq, text);
}

async function callOpenRouter(text: string, apiKey: string): Promise<TicketExtraction> {
  return callOpenAiCompatible('https://openrouter.ai/api/v1/chat/completions', apiKey, MODELS.openrouter, text, {
    'HTTP-Referer': 'https://tidesk.local',
    'X-Title': 'TIDESK'
  });
}

async function callGemini(text: string, apiKey: string): Promise<TicketExtraction> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODELS.gemini}:generateContent?key=${apiKey}`;
  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: `${SYSTEM_PROMPT}\n\n${buildUserPrompt(text)}` }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json'
      }
    })
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`HTTP ${response.status}: ${body.slice(0, 200)}`);
  }

  const data: any = await response.json();
  const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof content !== 'string') {
    throw new Error('Resposta sem conteúdo');
  }
  return normalizeExtraction(extractJson(content));
}

const PROVIDERS: { name: AiProviderName; call: (text: string, apiKey: string) => Promise<TicketExtraction> }[] = [
  { name: 'groq', call: callGroq },
  { name: 'openrouter', call: callOpenRouter },
  { name: 'gemini', call: callGemini }
];

export async function extractTicketFromText(text: string): Promise<AiProviderResult> {
  const config = getAiConfig();
  const attempts: { provider: AiProviderName; error: string }[] = [];

  for (const provider of PROVIDERS) {
    const providerConfig = config[provider.name];
    if (!providerConfig.enabled || !providerConfig.apiKey) {
      attempts.push({ provider: provider.name, error: 'Desabilitado ou sem chave configurada' });
      continue;
    }
    try {
      const extraction = await provider.call(text, providerConfig.apiKey);
      return { extraction, providerUsed: provider.name };
    } catch (error: any) {
      console.warn(`[AI Assistant] Falha no provedor ${provider.name}:`, error?.message || error);
      attempts.push({ provider: provider.name, error: error?.message || String(error) });
    }
  }

  throw new AiAllProvidersFailedError(attempts);
}
