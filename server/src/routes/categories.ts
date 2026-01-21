import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, AuthRequest, requireAdmin } from '../middleware/auth';
import { dbAll, dbGet, dbRun } from '../database';

const router = express.Router();

// Todas as rotas requerem autenticação
router.use(authenticate);

// Listar categorias
router.get('/', async (req: AuthRequest, res) => {
  try {
    const categories = await dbAll('SELECT * FROM categories ORDER BY name');
    res.json(categories);
  } catch (error) {
    console.error('Erro ao listar categorias:', error);
    res.status(500).json({ error: 'Erro ao buscar categorias' });
  }
});

// Criar categoria (apenas admin)
router.post('/', requireAdmin, [
  body('name').notEmpty().withMessage('Nome é obrigatório')
], async (req: AuthRequest, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description } = req.body;

    const result = await dbRun(
      'INSERT INTO categories (name, description) VALUES (?, ?)',
      [name, description || null]
    );

    const categoryId = (result as any).lastID;
    const category = await dbGet('SELECT * FROM categories WHERE id = ?', [categoryId]);
    res.status(201).json(category);
  } catch (error) {
    console.error('Erro ao criar categoria:', error);
    res.status(500).json({ error: 'Erro ao criar categoria' });
  }
});

// Atualizar categoria (apenas admin)
router.put('/:id', requireAdmin, [
  body('name').notEmpty().withMessage('Nome é obrigatório')
], async (req: AuthRequest, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description } = req.body;
    const categoryId = req.params.id;

    await dbRun(
      'UPDATE categories SET name = ?, description = ? WHERE id = ?',
      [name, description || null, categoryId]
    );

    const category = await dbGet('SELECT * FROM categories WHERE id = ?', [categoryId]);
    if (!category) {
      return res.status(404).json({ error: 'Categoria não encontrada' });
    }

    res.json(category);
  } catch (error) {
    console.error('Erro ao atualizar categoria:', error);
    res.status(500).json({ error: 'Erro ao atualizar categoria' });
  }
});

// Deletar categoria (apenas admin)
router.delete('/:id', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const categoryId = req.params.id;
    
    const category = await dbGet('SELECT id FROM categories WHERE id = ?', [categoryId]);
    if (!category) {
      return res.status(404).json({ error: 'Categoria não encontrada' });
    }

    await dbRun('DELETE FROM categories WHERE id = ?', [categoryId]);
    res.json({ message: 'Categoria deletada com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar categoria:', error);
    res.status(500).json({ error: 'Erro ao deletar categoria' });
  }
});

export default router;
