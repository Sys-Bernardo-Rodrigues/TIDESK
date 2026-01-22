import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { exec } from 'child_process';
import { getBrasiliaTimestamp } from '../database';

const execAsync = promisify(exec);

// Função para obter timestamp de Brasília no formato do nome do arquivo (YYYY-MM-DD-HHmmss)
function getBrasiliaTimestampForFilename(): { dateStr: string; timeStr: string } {
  // Usar getBrasiliaTimestamp que já está funcionando corretamente
  const brasiliaStr = getBrasiliaTimestamp();
  // Formato: "YYYY-MM-DD HH:mm:ss"
  const [datePart, timePart] = brasiliaStr.split(' ');
  const [year, month, day] = datePart.split('-');
  const [hour, minute, second] = timePart.split(':');
  
  return {
    dateStr: `${year}-${month}-${day}`,
    timeStr: `${hour}${minute}${second}`
  };
}

export const BACKUP_DIR = path.join(process.cwd(), 'backups');
const CONFIG_FILE = path.join(BACKUP_DIR, 'backup-config.json');

export interface BackupConfig {
  enabled: boolean;
  intervalHours: number;
  retentionDays: number;
  emailEnabled: boolean;
  emailTo: string[];
}

const DEFAULT_CONFIG: BackupConfig = {
  enabled: false,
  intervalHours: 24,
  retentionDays: 30,
  emailEnabled: false,
  emailTo: []
};

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

export function getBackupConfig(): BackupConfig {
  ensureBackupDir();
  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<BackupConfig>;
    return {
      enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : DEFAULT_CONFIG.enabled,
      intervalHours: typeof parsed.intervalHours === 'number' && parsed.intervalHours >= 1
        ? Math.min(168, parsed.intervalHours)
        : DEFAULT_CONFIG.intervalHours,
      retentionDays: typeof parsed.retentionDays === 'number' && parsed.retentionDays >= 1
        ? Math.min(365, parsed.retentionDays)
        : DEFAULT_CONFIG.retentionDays,
      emailEnabled: typeof parsed.emailEnabled === 'boolean' ? parsed.emailEnabled : DEFAULT_CONFIG.emailEnabled,
      emailTo: Array.isArray(parsed.emailTo) ? parsed.emailTo : DEFAULT_CONFIG.emailTo
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveBackupConfig(config: Partial<BackupConfig>): BackupConfig {
  ensureBackupDir();
  const current = getBackupConfig();
  const next: BackupConfig = {
    enabled: typeof config.enabled === 'boolean' ? config.enabled : current.enabled,
    intervalHours: typeof config.intervalHours === 'number' && config.intervalHours >= 1
      ? Math.min(168, config.intervalHours)
      : current.intervalHours,
    retentionDays: typeof config.retentionDays === 'number' && config.retentionDays >= 1
      ? Math.min(365, config.retentionDays)
      : current.retentionDays,
    emailEnabled: typeof config.emailEnabled === 'boolean' ? config.emailEnabled : current.emailEnabled,
    emailTo: Array.isArray(config.emailTo) ? config.emailTo : current.emailTo
  };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(next, null, 2), 'utf-8');
  return next;
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

export interface CreateBackupResult {
  filename: string;
  size: number;
  date: string;
}

export async function createBackup(): Promise<CreateBackupResult> {
  ensureBackupDir();
  const DB_TYPE = process.env.DB_TYPE || 'sqlite';
  const { dateStr, timeStr } = getBrasiliaTimestampForFilename();

  let backupPath: string;
  let backupFilename: string;

  if (DB_TYPE === 'sqlite') {
    const dbPath = process.env.SQLITE_DB_PATH || './tidesk.db';
    const absoluteDbPath = path.isAbsolute(dbPath) ? dbPath : path.join(process.cwd(), dbPath);
    if (!fs.existsSync(absoluteDbPath)) {
      throw new Error('Arquivo de banco de dados não encontrado');
    }
    backupFilename = `backup-${dateStr}-${timeStr}.db`;
    backupPath = path.join(BACKUP_DIR, backupFilename);
    fs.copyFileSync(absoluteDbPath, backupPath);
  } else if (DB_TYPE === 'postgresql') {
    const dbName = process.env.POSTGRES_DB || 'tidesk';
    const dbUser = process.env.POSTGRES_USER || 'postgres';
    const dbHost = process.env.POSTGRES_HOST || 'localhost';
    const dbPort = process.env.POSTGRES_PORT || '5432';
    const dbPassword = process.env.POSTGRES_PASSWORD || 'postgres';
    backupFilename = `backup-${dateStr}-${timeStr}.sql`;
    backupPath = path.join(BACKUP_DIR, backupFilename);
    try {
      await execAsync(
        `PGPASSWORD="${dbPassword}" pg_dump -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbName} -F c -f "${backupPath}"`
      );
    } catch {
      await execAsync(
        `PGPASSWORD="${dbPassword}" pg_dump -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbName} > "${backupPath}"`
      );
    }
  } else {
    throw new Error('Tipo de banco de dados não suportado');
  }

  if (!fs.existsSync(backupPath)) {
    throw new Error('Falha ao criar backup');
  }
  const stats = fs.statSync(backupPath);
  return {
    filename: backupFilename,
    size: stats.size,
    date: getBrasiliaTimestamp()
  };
}

export interface CleanupResult {
  deleted: string[];
  kept: number;
}

export function cleanupOldBackups(retentionDays: number): CleanupResult {
  ensureBackupDir();
  const files = fs.readdirSync(BACKUP_DIR);
  const backupFiles = files.filter(
    (f) => (f.endsWith('.db') || f.endsWith('.sql')) && f.startsWith('backup-')
  );
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const deleted: string[] = [];
  let kept = 0;

  for (const file of backupFiles) {
    const filePath = path.join(BACKUP_DIR, file);
    const stats = fs.statSync(filePath);
    if (stats.mtime.getTime() < cutoff) {
      fs.unlinkSync(filePath);
      deleted.push(file);
    } else {
      kept++;
    }
  }
  return { deleted, kept };
}
