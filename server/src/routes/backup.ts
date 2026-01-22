import express, { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import multer from 'multer';
import { authenticate } from '../middleware/auth';
import { requirePermission, RESOURCES, ACTIONS } from '../middleware/permissions';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { exec } from 'child_process';
import {
  BACKUP_DIR,
  formatFileSize,
  getBackupConfig,
  saveBackupConfig,
  createBackup as createBackupService,
  cleanupOldBackups
} from '../services/backup-service';
import { getBrasiliaTimestamp } from '../database';
import { restartBackupScheduler } from '../services/backup-scheduler';
import { sendBackupEmail, EmailConfig } from '../services/email-service';

const execAsync = promisify(exec);
const router = express.Router();

// Configuração do multer para upload de backups
const backupStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
    cb(null, BACKUP_DIR);
  },
  filename: (req, file, cb) => {
    // Manter o nome original ou gerar um nome baseado na data/hora atual
    const originalName = file.originalname;
    const ext = path.extname(originalName);
    const baseName = path.basename(originalName, ext);
    
    // Se o nome já segue o padrão backup-YYYY-MM-DD-HHmmss, manter
    if (baseName.match(/^backup-\d{4}-\d{2}-\d{2}-\d{6}$/)) {
      cb(null, originalName);
    } else {
      // Gerar novo nome com timestamp de Brasília
      const brasiliaStr = getBrasiliaTimestamp();
      const [datePart, timePart] = brasiliaStr.split(' ');
      const [year, month, day] = datePart.split('-');
      const [hour, minute, second] = timePart.split(':');
      const newName = `backup-${year}-${month}-${day}-${hour}${minute}${second}${ext}`;
      cb(null, newName);
    }
  }
});

const backupUpload = multer({
  storage: backupStorage,
  fileFilter: (req, file, cb) => {
    // Aceitar apenas arquivos .db e .sql
    const allowedExts = ['.db', '.sql'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos .db e .sql são permitidos'));
    }
  },
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB máximo
  }
});

interface AuthRequest extends Request {
  userId?: number;
  userRole?: string;
}

// Garantir que o diretório de backups existe
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// ----- Configuração (antes de /:filename) -----

router.get(
  '/config',
  authenticate,
  requirePermission(RESOURCES.CONFIG, ACTIONS.VIEW),
  (req: AuthRequest, res: Response) => {
    try {
      const config = getBackupConfig();
      res.json(config);
    } catch (error) {
      console.error('Erro ao ler configuração de backup:', error);
      res.status(500).json({ error: 'Erro ao ler configuração' });
    }
  }
);

router.put(
  '/config',
  authenticate,
  requirePermission(RESOURCES.CONFIG, ACTIONS.EDIT),
  [
    body('enabled').optional().isBoolean(),
    body('intervalHours').optional().isInt({ min: 1, max: 168 }),
    body('retentionDays').optional().isInt({ min: 1, max: 365 }),
    body('emailEnabled').optional().isBoolean(),
    body('emailTo').optional().isArray()
  ],
  (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const config = saveBackupConfig(req.body);
      restartBackupScheduler();
      res.json(config);
    } catch (error) {
      console.error('Erro ao salvar configuração de backup:', error);
      res.status(500).json({ error: 'Erro ao salvar configuração' });
    }
  }
);

// ----- Listar backups -----

router.get(
  '/',
  authenticate,
  requirePermission(RESOURCES.CONFIG, ACTIONS.VIEW),
  async (req: AuthRequest, res: Response) => {
    try {
      const files = fs.readdirSync(BACKUP_DIR);
      const backups = files
        .filter((file) => file.endsWith('.db') || file.endsWith('.sql'))
        .map((file) => {
          const filePath = path.join(BACKUP_DIR, file);
          const stats = fs.statSync(filePath);
          const size = stats.size;

          const match = file.match(/backup-(\d{4}-\d{2}-\d{2})-(\d{6})\.(db|sql)/);
          let date = '';
          let type = 'Completo';

          if (match) {
            const [, datePart, timePart] = match;
            const year = datePart!.substring(0, 4);
            const month = datePart!.substring(5, 7);
            const day = datePart!.substring(8, 10);
            const hour = timePart!.substring(0, 2);
            const minute = timePart!.substring(2, 4);
            const second = timePart!.substring(4, 6);
            // O nome do arquivo já está em horário de Brasília, então usamos diretamente
            date = `${year}-${month}-${day} ${hour}:${minute}:${second}`;
          } else {
            // Se não conseguir extrair do nome, converter mtime para horário de Brasília
            const mtime = new Date(stats.mtime);
            const formatter = new Intl.DateTimeFormat('en-US', {
              timeZone: 'America/Sao_Paulo',
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: false
            });
            const parts = formatter.formatToParts(mtime);
            const year = parts.find(p => p.type === 'year')?.value || '';
            const month = parts.find(p => p.type === 'month')?.value || '';
            const day = parts.find(p => p.type === 'day')?.value || '';
            const hour = parts.find(p => p.type === 'hour')?.value || '';
            const minute = parts.find(p => p.type === 'minute')?.value || '';
            const second = parts.find(p => p.type === 'second')?.value || '';
            date = `${year}-${month}-${day} ${hour}:${minute}:${second}`;
          }

          if (file.includes('incremental')) type = 'Incremental';

          return {
            id: file,
            name: file.replace(/\.(db|sql)$/, ''),
            filename: file,
            date,
            size: formatFileSize(size),
            sizeBytes: size,
            type,
            status: 'Concluído'
          };
        })
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      res.json(backups);
    } catch (error) {
      console.error('Erro ao listar backups:', error);
      res.status(500).json({ error: 'Erro ao buscar backups' });
    }
  }
);

// ----- Upload de backup (ANTES de criar backup para garantir ordem) -----

router.post(
  '/upload',
  authenticate,
  requirePermission(RESOURCES.CONFIG, ACTIONS.CREATE),
  backupUpload.single('backupFile'),
  async (req: AuthRequest, res: Response) => {
    console.log('[BACKUP UPLOAD] Rota chamada');
    try {
      if (!req.file) {
        console.log('[BACKUP UPLOAD] Nenhum arquivo recebido');
        return res.status(400).json({ error: 'Nenhum arquivo foi enviado' });
      }
      console.log('[BACKUP UPLOAD] Arquivo recebido:', req.file.filename);

      const filePath = req.file.path;
      const filename = req.file.filename;
      const stats = fs.statSync(filePath);

      // Extrair data do nome do arquivo ou usar data atual
      const match = filename.match(/backup-(\d{4}-\d{2}-\d{2})-(\d{6})\.(db|sql)/);
      let date = getBrasiliaTimestamp();

      if (match) {
        const [, datePart, timePart] = match;
        const year = datePart!.substring(0, 4);
        const month = datePart!.substring(5, 7);
        const day = datePart!.substring(8, 10);
        const hour = timePart!.substring(0, 2);
        const minute = timePart!.substring(2, 4);
        const second = timePart!.substring(4, 6);
        date = `${year}-${month}-${day} ${hour}:${minute}:${second}`;
      }

      res.status(201).json({
        id: filename,
        name: filename.replace(/\.(db|sql)$/, ''),
        filename: filename,
        date: date,
        size: formatFileSize(stats.size),
        sizeBytes: stats.size,
        type: 'Completo',
        status: 'Concluído'
      });
    } catch (error: any) {
      console.error('Erro ao fazer upload do backup:', error);
      
      // Limpar arquivo se foi criado
      if (req.file && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (unlinkError) {
          console.error('Erro ao remover arquivo após erro:', unlinkError);
        }
      }

      if (error.message === 'Apenas arquivos .db e .sql são permitidos') {
        return res.status(400).json({ error: error.message });
      }
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Arquivo muito grande. Tamanho máximo: 500MB' });
      }

      res.status(500).json({
        error: 'Erro ao fazer upload do backup: ' + (error.message || 'Erro desconhecido')
      });
    }
  }
);

// ----- Enviar backup por email -----

router.post(
  '/:filename/send',
  authenticate,
  requirePermission(RESOURCES.CONFIG, ACTIONS.VIEW),
  async (req: AuthRequest, res: Response) => {
    try {
      const { filename } = req.params;
      if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return res.status(400).json({ error: 'Nome de arquivo inválido' });
      }
      const filePath = path.join(BACKUP_DIR, filename);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Backup não encontrado' });
      }

      const stats = fs.statSync(filePath);
      const backupConfig = getBackupConfig();

      if (!backupConfig.emailEnabled || !backupConfig.emailTo || backupConfig.emailTo.length === 0) {
        return res.status(400).json({ error: 'Envio por email não está configurado. Configure os emails de destino nas configurações.' });
      }

      const emailConfig: EmailConfig = {
        enabled: true,
        smtpHost: process.env.SMTP_HOST || '',
        smtpPort: parseInt(process.env.SMTP_PORT || '587'),
        smtpSecure: process.env.SMTP_SECURE === 'true',
        smtpUser: process.env.SMTP_USER || '',
        smtpPassword: process.env.SMTP_PASSWORD || '',
        fromEmail: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || '',
        fromName: process.env.SMTP_FROM_NAME || 'TIDESK Backup',
        toEmails: backupConfig.emailTo
      };

      if (!emailConfig.smtpHost || !emailConfig.smtpUser || !emailConfig.smtpPassword) {
        return res.status(400).json({ error: 'Configuração SMTP incompleta. Configure as variáveis de ambiente SMTP_HOST, SMTP_USER e SMTP_PASSWORD.' });
      }

      await sendBackupEmail(emailConfig, filePath, filename, stats.size);
      res.json({ message: 'Backup enviado por email com sucesso' });
    } catch (error: any) {
      console.error('Erro ao enviar backup por email:', error);
      res.status(500).json({ error: 'Erro ao enviar backup por email: ' + (error.message || 'Erro desconhecido') });
    }
  }
);

// ----- Download (antes de /:filename genérico) -----

router.get(
  '/:filename/download',
  authenticate,
  requirePermission(RESOURCES.CONFIG, ACTIONS.VIEW),
  (req: AuthRequest, res: Response) => {
    try {
      const { filename } = req.params;
      if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return res.status(400).json({ error: 'Nome de arquivo inválido' });
      }
      const filePath = path.join(BACKUP_DIR, filename);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Backup não encontrado' });
      }
      res.download(filePath, filename, (err) => {
        if (err) {
          console.error('Erro ao fazer download do backup:', err);
          if (!res.headersSent) res.status(500).json({ error: 'Erro ao fazer download do backup' });
        }
      });
    } catch (error) {
      console.error('Erro ao fazer download do backup:', error);
      res.status(500).json({ error: 'Erro ao fazer download do backup' });
    }
  }
);

// ----- Restaurar -----

router.post(
  '/:filename/restore',
  authenticate,
  requirePermission(RESOURCES.CONFIG, ACTIONS.EDIT),
  async (req: AuthRequest, res: Response) => {
    try {
      const { filename } = req.params;
      if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return res.status(400).json({ error: 'Nome de arquivo inválido' });
      }
      const filePath = path.join(BACKUP_DIR, filename);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Backup não encontrado' });
      }

      const DB_TYPE = process.env.DB_TYPE || 'sqlite';

      if (DB_TYPE === 'sqlite') {
        const dbPath = process.env.SQLITE_DB_PATH || './tidesk.db';
        const absoluteDbPath = path.isAbsolute(dbPath)
          ? dbPath
          : path.join(process.cwd(), dbPath);
        const currentBackupPath = absoluteDbPath + '.pre-restore-' + Date.now();
        if (fs.existsSync(absoluteDbPath)) {
          fs.copyFileSync(absoluteDbPath, currentBackupPath);
        }
        fs.copyFileSync(filePath, absoluteDbPath);
        return res.json({
          message: 'Backup restaurado com sucesso',
          note: 'O servidor precisa ser reiniciado para aplicar as mudanças'
        });
      }

      if (DB_TYPE === 'postgresql') {
        const dbName = process.env.POSTGRES_DB || 'tidesk';
        const dbUser = process.env.POSTGRES_USER || 'postgres';
        const dbHost = process.env.POSTGRES_HOST || 'localhost';
        const dbPort = process.env.POSTGRES_PORT || '5432';
        const dbPassword = process.env.POSTGRES_PASSWORD || 'postgres';
        if (filename.endsWith('.sql')) {
          await execAsync(
            `PGPASSWORD="${dbPassword}" psql -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbName} < "${filePath}"`
          );
        } else {
          await execAsync(
            `PGPASSWORD="${dbPassword}" pg_restore -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbName} -c "${filePath}"`
          );
        }
        return res.json({
          message: 'Backup restaurado com sucesso',
          note: 'O servidor precisa ser reiniciado para aplicar as mudanças'
        });
      }

      res.status(400).json({ error: 'Tipo de banco de dados não suportado' });
    } catch (error: any) {
      console.error('Erro ao restaurar backup:', error);
      res.status(500).json({
        error: 'Erro ao restaurar backup: ' + (error.message || 'Erro desconhecido')
      });
    }
  }
);

// ----- Deletar -----

router.delete(
  '/:filename',
  authenticate,
  requirePermission(RESOURCES.CONFIG, ACTIONS.DELETE),
  (req: AuthRequest, res: Response) => {
    try {
      const { filename } = req.params;
      if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return res.status(400).json({ error: 'Nome de arquivo inválido' });
      }
      const filePath = path.join(BACKUP_DIR, filename);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Backup não encontrado' });
      }
      fs.unlinkSync(filePath);
      res.json({ message: 'Backup deletado com sucesso' });
    } catch (error) {
      console.error('Erro ao deletar backup:', error);
      res.status(500).json({ error: 'Erro ao deletar backup' });
    }
  }
);

export default router;
