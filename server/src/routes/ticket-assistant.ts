import express, { Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import fs from 'fs';
import path from 'path';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requirePermission, RESOURCES, ACTIONS } from '../middleware/permissions';
import { uploadTicketAssistant, TICKET_ASSISTANT_UPLOAD_DIR } from '../middleware/upload';
import { dbGet, dbAll, dbRun } from '../database';
import { extractFileSearchText } from '../utils/doc-text-index';
import { extractTicketFromText, AiAllProvidersFailedError } from '../services/ai-provider-service';
import { findBestCategoryMatch } from '../utils/category-match';
import { createTicketRecord } from '../services/ticket-service';

const router = express.Router();

function handleUpload(req: AuthRequest, res: Response, next: NextFunction) {
  uploadTicketAssistant.single('file')(req, res, (err: any) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Erro ao enviar arquivo' });
    }
    next();
  });
}

// Extrai texto do PDF e pede pra IA sugerir os campos do ticket
router.post(
  '/analyze',
  authenticate,
  requirePermission(RESOURCES.AI_ASSISTANT, ACTIONS.CREATE),
  handleUpload,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado' });
      }

      const text = await extractFileSearchText(req.file.path, req.file.mimetype, req.file.originalname);

      if (!text || text.trim().length < 20) {
        return res.status(422).json({
          error: 'Não foi possível extrair texto do PDF. Pode ser um PDF escaneado/imagem, sem suporte a OCR nesta versão.'
        });
      }

      const { extraction, providerUsed } = await extractTicketFromText(text);

      const categories = await dbAll('SELECT id, name FROM categories ORDER BY name') as { id: number; name: string }[];
      const matchedCategory = findBestCategoryMatch(extraction.suggestedCategory, categories);

      res.json({
        extraction,
        matchedCategory,
        categories,
        providerUsed,
        tempFile: {
          path: path.relative(process.cwd(), req.file.path),
          originalName: req.file.originalname,
          size: req.file.size
        }
      });
    } catch (error: any) {
      if (error instanceof AiAllProvidersFailedError) {
        console.error('[ticket-assistant] Todos os provedores de IA falharam:', error.attempts);
        return res.status(503).json({
          error: 'Não foi possível analisar o PDF no momento — todos os provedores de IA configurados falharam ou estão sem quota.'
        });
      }
      console.error('Erro ao analisar PDF de OS:', error);
      res.status(500).json({ error: 'Erro ao analisar PDF' });
    }
  }
);

// Cria o ticket a partir dos dados revisados e anexa o PDF original
router.post(
  '/confirm',
  authenticate,
  requirePermission(RESOURCES.AI_ASSISTANT, ACTIONS.CREATE),
  requirePermission(RESOURCES.TICKETS, ACTIONS.CREATE),
  [
    body('title').notEmpty().withMessage('Título é obrigatório'),
    body('description').notEmpty().withMessage('Descrição é obrigatória'),
    body('priority').isIn(['low', 'medium', 'high', 'urgent']).withMessage('Prioridade inválida'),
    body('tempFilePath').notEmpty().withMessage('Arquivo temporário não informado'),
    body('originalFileName').notEmpty().withMessage('Nome do arquivo original não informado')
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { title, description, priority, category_id, tempFilePath, originalFileName } = req.body;

      const resolvedDir = path.resolve(TICKET_ASSISTANT_UPLOAD_DIR);
      const resolvedFile = path.resolve(process.cwd(), tempFilePath);
      if (!resolvedFile.startsWith(resolvedDir + path.sep)) {
        return res.status(400).json({ error: 'Caminho de arquivo inválido' });
      }
      if (!fs.existsSync(resolvedFile)) {
        return res.status(400).json({ error: 'Arquivo temporário não encontrado — reenvie o PDF' });
      }

      const ticket = await createTicketRecord({
        title,
        description,
        priority,
        category_id: category_id || null,
        user_id: req.userId!
      });

      const stat = fs.statSync(resolvedFile);
      await dbRun(
        `INSERT INTO ticket_attachments (ticket_id, file_name, file_path, file_size, mime_type, source, uploaded_by, created_at)
         VALUES (?, ?, ?, ?, ?, 'ai_assistant', ?, CURRENT_TIMESTAMP)`,
        [(ticket as any).id, originalFileName, path.relative(process.cwd(), resolvedFile), stat.size, 'application/pdf', req.userId]
      );

      res.status(201).json(ticket);
    } catch (error) {
      console.error('Erro ao confirmar criação de ticket via assistente:', error);
      res.status(500).json({ error: 'Erro ao criar ticket' });
    }
  }
);

// Download de anexo criado pelo assistente
router.get('/attachments/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const attachment = await dbGet('SELECT * FROM ticket_attachments WHERE id = ?', [req.params.id]) as any;

    if (!attachment) {
      return res.status(404).json({ error: 'Arquivo não encontrado' });
    }

    let filePath = attachment.file_path;
    if (!path.isAbsolute(filePath)) {
      filePath = path.join(process.cwd(), filePath);
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Arquivo não encontrado no servidor' });
    }

    res.setHeader('Content-Disposition', `attachment; filename="${attachment.file_name}"`);
    res.setHeader('Content-Type', attachment.mime_type || 'application/octet-stream');
    res.sendFile(path.resolve(filePath));
  } catch (error) {
    console.error('Erro ao buscar arquivo:', error);
    res.status(500).json({ error: 'Erro ao buscar arquivo' });
  }
});

export default router;
