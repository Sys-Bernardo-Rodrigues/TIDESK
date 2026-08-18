import fs from 'fs';
import path from 'path';

export interface TvConfig {
  dashboardDurationSeconds: number;
}

const CONFIG_DIR = path.join(process.cwd(), 'config');
const CONFIG_FILE = path.join(CONFIG_DIR, 'tv-config.json');

function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

export function getTvConfig(): TvConfig {
  ensureConfigDir();
  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<TvConfig>;
    return {
      dashboardDurationSeconds: typeof parsed.dashboardDurationSeconds === 'number' && parsed.dashboardDurationSeconds > 0
        ? parsed.dashboardDurationSeconds
        : 60
    };
  } catch {
    return { dashboardDurationSeconds: 60 };
  }
}

export function saveTvConfig(config: Partial<TvConfig>): TvConfig {
  ensureConfigDir();
  const current = getTvConfig();
  const next: TvConfig = {
    dashboardDurationSeconds: typeof config.dashboardDurationSeconds === 'number' && config.dashboardDurationSeconds > 0
      ? Math.floor(config.dashboardDurationSeconds)
      : current.dashboardDurationSeconds
  };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(next, null, 2), 'utf-8');
  return next;
}
