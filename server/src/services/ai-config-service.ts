import fs from 'fs';
import path from 'path';

export type AiProviderName = 'groq' | 'openrouter' | 'gemini';

export interface AiProviderConfig {
  apiKey: string;
  enabled: boolean;
}

export interface AiConfig {
  groq: AiProviderConfig;
  openrouter: AiProviderConfig;
  gemini: AiProviderConfig;
}

const CONFIG_DIR = path.join(process.cwd(), 'config');
const CONFIG_FILE = path.join(CONFIG_DIR, 'ai-config.json');

function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

function normalizeProvider(value: unknown, envKey: string | undefined): AiProviderConfig {
  const partial = (value || {}) as Partial<AiProviderConfig>;
  return {
    apiKey: typeof partial.apiKey === 'string' ? partial.apiKey : (envKey || ''),
    enabled: typeof partial.enabled === 'boolean' ? partial.enabled : true
  };
}

export function getAiConfig(): AiConfig {
  ensureConfigDir();
  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<AiConfig>;
    return {
      groq: normalizeProvider(parsed.groq, undefined),
      openrouter: normalizeProvider(parsed.openrouter, undefined),
      gemini: normalizeProvider(parsed.gemini, undefined)
    };
  } catch {
    // Sem arquivo salvo ainda: usa as chaves do .env como valor inicial
    return {
      groq: { apiKey: process.env.GROQ_API_KEY || '', enabled: true },
      openrouter: { apiKey: process.env.OPENROUTER_API_KEY || '', enabled: true },
      gemini: { apiKey: process.env.GEMINI_API_KEY || '', enabled: true }
    };
  }
}

function mergeProvider(current: AiProviderConfig, update: Partial<AiProviderConfig> | undefined): AiProviderConfig {
  if (!update) return current;
  return {
    apiKey: typeof update.apiKey === 'string' ? update.apiKey.trim() : current.apiKey,
    enabled: typeof update.enabled === 'boolean' ? update.enabled : current.enabled
  };
}

export function saveAiConfig(config: Partial<AiConfig>): AiConfig {
  ensureConfigDir();
  const current = getAiConfig();
  const next: AiConfig = {
    groq: mergeProvider(current.groq, config.groq),
    openrouter: mergeProvider(current.openrouter, config.openrouter),
    gemini: mergeProvider(current.gemini, config.gemini)
  };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(next, null, 2), 'utf-8');
  return next;
}
