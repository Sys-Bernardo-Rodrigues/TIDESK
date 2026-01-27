import express from 'express';
import type { Response } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requirePermission, RESOURCES, ACTIONS } from '../middleware/permissions';
import { dbGet, dbAll, dbRun, getBrasiliaTimestamp } from '../database';

const router = express.Router();

// Listar grupos
router.get('/', authenticate, requirePermission(RESOURCES.CONFIG, ACTIONS.VIEW), async (req: AuthRequest, res) => {
  try {
    const groups = await dbAll(`
      SELECT g.*,
             u.name as created_by_name,
             (SELECT COUNT(*) FROM group_users gu WHERE gu.group_id = g.id) as users_count
      FROM groups g
      LEFT JOIN users u ON g.created_by = u.id
      ORDER BY g.created_at DESC
    `);

    // Buscar usuários de cada grupo
    const groupsWithUsers = await Promise.all(groups.map(async (group: any) => {
      const users = await dbAll(`
        SELECT u.id, u.name, u.email, u.role
        FROM group_users gu
        JOIN users u ON gu.user_id = u.id
        WHERE gu.group_id = ?
        ORDER BY u.name
      `, [group.id]);

      return {
        ...group,
        users: users
      };
    }));

    res.json(groupsWithUsers);
  } catch (error) {
    console.error('Erro ao listar grupos:', error);
    res.status(500).json({ error: 'Erro ao buscar grupos' });
  }
});

// Obter grupo específico
router.get('/:id', authenticate, requirePermission(RESOURCES.CONFIG, ACTIONS.VIEW), async (req: AuthRequest, res) => {
  try {
    const group = await dbGet(`
      SELECT g.*, u.name as created_by_name
      FROM groups g
      LEFT JOIN users u ON g.created_by = u.id
      WHERE g.id = ?
    `, [req.params.id]);

    if (!group) {
      return res.status(404).json({ error: 'Grupo não encontrado' });
    }

    const users = await dbAll(`
      SELECT u.id, u.name, u.email, u.role
      FROM group_users gu
      JOIN users u ON gu.user_id = u.id
      WHERE gu.group_id = ?
      ORDER BY u.name
    `, [req.params.id]);

    res.json({
      ...group,
      users: users
    });
  } catch (error) {
    console.error('Erro ao buscar grupo:', error);
    res.status(500).json({ error: 'Erro ao buscar grupo' });
  }
});

// Criar grupo
router.post('/', [
  authenticate,
  requirePermission(RESOURCES.CONFIG, ACTIONS.CREATE),
  body('name').notEmpty().withMessage('Nome é obrigatório')
], async (req: AuthRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description } = req.body;

    // Verificar se nome já existe
    const existing = await dbGet('SELECT id FROM groups WHERE name = ?', [name]);
    if (existing) {
      return res.status(400).json({ error: 'Já existe um grupo com este nome' });
    }

    // Criar grupo
    const groupResult = await dbRun(`
      INSERT INTO groups (name, description, created_by)
      VALUES (?, ?, ?)
    `, [name, description || null, req.userId]);

    const groupId = (groupResult as any).lastID || (groupResult as any).id;

    // Buscar grupo criado
    const group = await dbGet('SELECT * FROM groups WHERE id = ?', [groupId]);
    res.status(201).json(group);
  } catch (error) {
    console.error('Erro ao criar grupo:', error);
    res.status(500).json({ error: 'Erro ao criar grupo' });
  }
});

// Atualizar grupo
router.put('/:id', [
  authenticate,
  requirePermission(RESOURCES.CONFIG, ACTIONS.EDIT),
  body('name').notEmpty().withMessage('Nome é obrigatório')
], async (req: AuthRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description } = req.body;

    // Verificar se grupo existe
    const existing = await dbGet('SELECT id FROM groups WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: 'Grupo não encontrado' });
    }

    // Verificar se nome já existe em outro grupo
    const nameExists = await dbGet('SELECT id FROM groups WHERE name = ? AND id != ?', [name, req.params.id]);
    if (nameExists) {
      return res.status(400).json({ error: 'Já existe um grupo com este nome' });
    }

    // Atualizar grupo
    await dbRun(`
      UPDATE groups
      SET name = ?, description = ?, updated_at = ?
      WHERE id = ?
    `, [name, description || null, getBrasiliaTimestamp(), req.params.id]);

    // Buscar grupo atualizado
    const group = await dbGet('SELECT * FROM groups WHERE id = ?', [req.params.id]);
    res.json(group);
  } catch (error) {
    console.error('Erro ao atualizar grupo:', error);
    res.status(500).json({ error: 'Erro ao atualizar grupo' });
  }
});

// Excluir grupo
router.delete('/:id', authenticate, requirePermission(RESOURCES.CONFIG, ACTIONS.DELETE), async (req: AuthRequest, res) => {
  try {
    const group = await dbGet('SELECT id FROM groups WHERE id = ?', [req.params.id]);
    if (!group) {
      return res.status(404).json({ error: 'Grupo não encontrado' });
    }

    // Excluir grupo (usuários serão desvinculados em cascata)
    await dbRun('DELETE FROM groups WHERE id = ?', [req.params.id]);

    res.json({ message: 'Grupo excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir grupo:', error);
    res.status(500).json({ error: 'Erro ao excluir grupo' });
  }
});

// Vincular usuário a grupo
router.post('/:id/users', [
  authenticate,
  requirePermission(RESOURCES.CONFIG, ACTIONS.EDIT),
  body('userId').isInt().withMessage('ID do usuário é obrigatório')
], async (req: AuthRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId } = req.body;

    // Verificar se grupo existe
    const group = await dbGet('SELECT id FROM groups WHERE id = ?', [req.params.id]);
    if (!group) {
      return res.status(404).json({ error: 'Grupo não encontrado' });
    }

    // Verificar se usuário existe
    const user = await dbGet('SELECT id FROM users WHERE id = ?', [userId]);
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Vincular
    try {
      await dbRun(`
        INSERT INTO group_users (group_id, user_id)
        VALUES (?, ?)
      `, [req.params.id, userId]);

      res.status(201).json({ message: 'Usuário vinculado ao grupo com sucesso' });
    } catch (error: any) {
      if (error.message?.includes('UNIQUE')) {
        return res.status(400).json({ error: 'Usuário já está vinculado a este grupo' });
      }
      throw error;
    }
  } catch (error) {
    console.error('Erro ao vincular usuário:', error);
    res.status(500).json({ error: 'Erro ao vincular usuário ao grupo' });
  }
});

// Desvincular usuário de grupo
router.delete('/:id/users/:userId', authenticate, requirePermission(RESOURCES.CONFIG, ACTIONS.EDIT), async (req: AuthRequest, res) => {
  try {
    await dbRun(`
      DELETE FROM group_users
      WHERE group_id = ? AND user_id = ?
    `, [req.params.id, req.params.userId]);

    res.json({ message: 'Usuário desvinculado do grupo com sucesso' });
  } catch (error) {
    console.error('Erro ao desvincular usuário:', error);
    res.status(500).json({ error: 'Erro ao desvincular usuário do grupo' });
  }
});

export default router;
