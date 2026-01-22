import {
  getBackupConfig,
  createBackup,
  cleanupOldBackups,
  formatFileSize
} from './backup-service';
import { sendBackupEmail, EmailConfig } from './email-service';
import path from 'path';
import { BACKUP_DIR } from './backup-service';
import fs from 'fs';

let intervalId: ReturnType<typeof setInterval> | null = null;

async function runScheduledBackup() {
  const config = getBackupConfig();
  if (!config.enabled) return;

  try {
    const result = await createBackup();
    console.log(
      `[Backup automático] Criado: ${result.filename} (${formatFileSize(result.size)})`
    );

    // Enviar por email se configurado
    if (config.emailEnabled && config.emailTo && config.emailTo.length > 0) {
      try {
        const emailConfig: EmailConfig = {
          enabled: true,
          smtpHost: process.env.SMTP_HOST || '',
          smtpPort: parseInt(process.env.SMTP_PORT || '587'),
          smtpSecure: process.env.SMTP_SECURE === 'true',
          smtpUser: process.env.SMTP_USER || '',
          smtpPassword: process.env.SMTP_PASSWORD || '',
          fromEmail: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || '',
          fromName: process.env.SMTP_FROM_NAME || 'TIDESK Backup',
          toEmails: config.emailTo
        };

        if (emailConfig.smtpHost && emailConfig.smtpUser && emailConfig.smtpPassword) {
          const backupPath = path.join(BACKUP_DIR, result.filename);
          await sendBackupEmail(emailConfig, backupPath, result.filename, result.size);
          console.log(`[Backup automático] Backup enviado por email para: ${config.emailTo.join(', ')}`);
        }
      } catch (emailErr) {
        console.error('[Backup automático] Erro ao enviar backup por email:', emailErr);
      }
    }
  } catch (err) {
    console.error('[Backup automático] Erro ao criar backup:', err);
  }

  try {
    const { deleted, kept } = cleanupOldBackups(config.retentionDays);
    if (deleted.length > 0) {
      console.log(
        `[Backup automático] Removidos ${deleted.length} backup(s) antigo(s). Mantidos: ${kept}`
      );
    }
  } catch (err) {
    console.error('[Backup automático] Erro ao limpar backups antigos:', err);
  }
}

export function startBackupScheduler() {
  const config = getBackupConfig();
  if (!config.enabled) {
    console.log('⏸️ Backup automático desativado');
    return;
  }

  const intervalMs = config.intervalHours * 60 * 60 * 1000;
  runScheduledBackup();
  intervalId = setInterval(runScheduledBackup, intervalMs);
  console.log(
    `✅ Backup automático ativo: a cada ${config.intervalHours}h, retenção ${config.retentionDays} dias`
  );
}

export function stopBackupScheduler() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('⏸️ Backup automático parado');
  }
}

export function restartBackupScheduler() {
  stopBackupScheduler();
  startBackupScheduler();
}
