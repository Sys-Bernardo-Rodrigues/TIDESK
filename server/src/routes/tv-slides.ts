import express, { Response } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requirePermission, RESOURCES, ACTIONS } from '../middleware/permissions';
import { dbGet, dbAll, dbRun, getBrasiliaTimestamp } from '../database';

const router = express.Router();

// Listar slides (admin, inclui inativos)
router.get(
  '/',
  authenticate,
  requirePermission(RESOURCES.CONFIG, ACTIONS.VIEW),
  async (req: AuthRequest, res: Response) => {
    try {
      const slides = await dbAll(`
        SELECT * FROM tv_slides ORDER BY sort_order ASC, id ASC
      `);
      res.json(slides || []);
    } catch (error) {
      console.error('Erro ao listar slides do painel de TV:', error);
      res.status(500).json({ error: 'Erro ao buscar slides' });
    }
  }
);

// Criar slide
router.post(
  '/',
  authenticate,
  requirePermission(RESOURCES.CONFIG, ACTIONS.CREATE),
  [
    body('title').notEmpty().withMessage('Título é obrigatório'),
    body('url').isURL({ require_protocol: true }).withMessage('URL inválida'),
    body('duration_seconds').optional().isInt({ min: 5 }),
    body('sort_order').optional().isInt(),
    body('active').optional()
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { title, url, duration_seconds, sort_order, active } = req.body;
      const now = getBrasiliaTimestamp();

      const result = await dbRun(`
        INSERT INTO tv_slides (title, url, duration_seconds, sort_order, active, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        title,
        url,
        duration_seconds || 30,
        sort_order || 0,
        active !== undefined ? (active ? 1 : 0) : 1,
        req.userId,
        now,
        now
      ]);

      const slideId = (result as any).lastID || (result as any).insertId || (result as any).id;
      const slide = await dbGet('SELECT * FROM tv_slides WHERE id = ?', [slideId]);
      res.status(201).json(slide);
    } catch (error: any) {
      console.error('Erro ao criar slide do painel de TV:', error);
      res.status(500).json({ error: 'Erro ao criar slide: ' + (error.message || 'Erro desconhecido') });
    }
  }
);

// Atualizar slide
router.put(
  '/:id',
  authenticate,
  requirePermission(RESOURCES.CONFIG, ACTIONS.EDIT),
  [
    body('title').optional().notEmpty(),
    body('url').optional().isURL({ require_protocol: true }),
    body('duration_seconds').optional().isInt({ min: 5 }),
    body('sort_order').optional().isInt(),
    body('active').optional()
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const existing = await dbGet('SELECT * FROM tv_slides WHERE id = ?', [req.params.id]);
      if (!existing) {
        return res.status(404).json({ error: 'Slide não encontrado' });
      }

      const { title, url, duration_seconds, sort_order, active } = req.body;
      const updates: string[] = [];
      const values: any[] = [];

      if (title !== undefined) {
        updates.push('title = ?');
        values.push(title);
      }
      if (url !== undefined) {
        updates.push('url = ?');
        values.push(url);
      }
      if (duration_seconds !== undefined) {
        updates.push('duration_seconds = ?');
        values.push(duration_seconds);
      }
      if (sort_order !== undefined) {
        updates.push('sort_order = ?');
        values.push(sort_order);
      }
      if (active !== undefined) {
        updates.push('active = ?');
        values.push(typeof active === 'boolean' ? (active ? 1 : 0) : (active === 1 || active === '1' ? 1 : 0));
      }

      updates.push('updated_at = ?');
      values.push(getBrasiliaTimestamp());
      values.push(req.params.id);

      if (updates.length > 1) {
        await dbRun(`UPDATE tv_slides SET ${updates.join(', ')} WHERE id = ?`, values);
      }

      const updated = await dbGet('SELECT * FROM tv_slides WHERE id = ?', [req.params.id]);
      res.json(updated);
    } catch (error: any) {
      console.error('Erro ao atualizar slide do painel de TV:', error);
      res.status(500).json({ error: 'Erro ao atualizar slide: ' + (error.message || 'Erro desconhecido') });
    }
  }
);

// Deletar slide
router.delete(
  '/:id',
  authenticate,
  requirePermission(RESOURCES.CONFIG, ACTIONS.DELETE),
  async (req: AuthRequest, res: Response) => {
    try {
      const existing = await dbGet('SELECT * FROM tv_slides WHERE id = ?', [req.params.id]);
      if (!existing) {
        return res.status(404).json({ error: 'Slide não encontrado' });
      }
      await dbRun('DELETE FROM tv_slides WHERE id = ?', [req.params.id]);
      res.json({ message: 'Slide removido com sucesso' });
    } catch (error) {
      console.error('Erro ao remover slide do painel de TV:', error);
      res.status(500).json({ error: 'Erro ao remover slide' });
    }
  }
);

export default router;
