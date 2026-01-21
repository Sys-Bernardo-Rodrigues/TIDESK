import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, AuthRequest, requireAgent } from '../middleware/auth';
import { dbGet, dbAll, dbRun } from '../database';

const router = express.Router();

// Todas as rotas requerem autenticação
router.use(authenticate);

// Listar tickets
router.get('/', async (req: AuthRequest, res) => {
  try {
    let query = `
      SELECT t.*, 
             u.name as user_name, 
             u.email as user_email,
             a.name as assigned_name,
             c.name as category_name
      FROM tickets t
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN users a ON t.assigned_to = a.id
      LEFT JOIN categories c ON t.category_id = c.id
    `;
    const params: any[] = [];

    // Filtros baseados no papel do usuário
    if (req.userRole === 'user') {
      query += ' WHERE t.user_id = ?';
      params.push(req.userId);
    }

    query += ' ORDER BY t.created_at DESC';

    const tickets = await dbAll(query, params);
    res.json(tickets);
  } catch (error) {
    console.error('Erro ao listar tickets:', error);
    res.status(500).json({ error: 'Erro ao buscar tickets' });
  }
});

// Obter ticket específico
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    let query = `
      SELECT t.*, 
             u.name as user_name, 
             u.email as user_email,
             a.name as assigned_name,
             c.name as category_name
      FROM tickets t
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN users a ON t.assigned_to = a.id
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.id = ?
    `;
    const params: any[] = [req.params.id];

    // Verificar permissão
    if (req.userRole === 'user') {
      query += ' AND t.user_id = ?';
      params.push(req.userId);
    }

    const ticket = await dbGet(query, params);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket não encontrado' });
    }
    res.json(ticket);
  } catch (error) {
    console.error('Erro ao buscar ticket:', error);
    res.status(500).json({ error: 'Erro ao buscar ticket' });
  }
});

// Criar ticket
router.post('/', [
  body('title').notEmpty().withMessage('Título é obrigatório'),
  body('description').notEmpty().withMessage('Descrição é obrigatória'),
  body('priority').isIn(['low', 'medium', 'high', 'urgent']).withMessage('Prioridade inválida')
], async (req: AuthRequest, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, description, priority = 'medium', category_id } = req.body;

    const result = await dbRun(
      `INSERT INTO tickets (title, description, status, priority, category_id, user_id) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [title, description, 'open', priority, category_id || null, req.userId]
    );

    const ticketId = (result as any).lastID;
    const ticket = await dbGet(
      `SELECT t.*, 
              u.name as user_name, 
              u.email as user_email,
              c.name as category_name
       FROM tickets t
       LEFT JOIN users u ON t.user_id = u.id
       LEFT JOIN categories c ON t.category_id = c.id
       WHERE t.id = ?`,
      [ticketId]
    );

    res.status(201).json(ticket);
  } catch (error) {
    console.error('Erro ao criar ticket:', error);
    res.status(500).json({ error: 'Erro ao criar ticket' });
  }
});

// Atualizar ticket
router.put('/:id', [
  body('status').optional().isIn(['open', 'in_progress', 'resolved', 'closed']),
  body('priority').optional().isIn(['low', 'medium', 'high', 'urgent'])
], async (req: AuthRequest, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const ticketId = req.params.id;
    
    // Verificar se ticket existe e permissão
    const existingTicket = await dbGet('SELECT * FROM tickets WHERE id = ?', [ticketId]) as any;
    if (!existingTicket) {
      return res.status(404).json({ error: 'Ticket não encontrado' });
    }

    if (req.userRole === 'user' && existingTicket.user_id !== req.userId) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    // Construir query de atualização
    const updates: string[] = [];
    const values: any[] = [];

    if (req.body.title) {
      updates.push('title = ?');
      values.push(req.body.title);
    }
    if (req.body.description) {
      updates.push('description = ?');
      values.push(req.body.description);
    }
    if (req.body.status && (req.userRole === 'admin' || req.userRole === 'agent')) {
      updates.push('status = ?');
      values.push(req.body.status);
    }
    if (req.body.priority) {
      updates.push('priority = ?');
      values.push(req.body.priority);
    }
    if (req.body.category_id) {
      updates.push('category_id = ?');
      values.push(req.body.category_id);
    }
    if (req.body.assigned_to && (req.userRole === 'admin' || req.userRole === 'agent')) {
      updates.push('assigned_to = ?');
      values.push(req.body.assigned_to);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(ticketId);

    await dbRun(
      `UPDATE tickets SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    const updatedTicket = await dbGet(
      `SELECT t.*, 
              u.name as user_name, 
              u.email as user_email,
              a.name as assigned_name,
              c.name as category_name
       FROM tickets t
       LEFT JOIN users u ON t.user_id = u.id
       LEFT JOIN users a ON t.assigned_to = a.id
       LEFT JOIN categories c ON t.category_id = c.id
       WHERE t.id = ?`,
      [ticketId]
    );

    res.json(updatedTicket);
  } catch (error) {
    console.error('Erro ao atualizar ticket:', error);
    res.status(500).json({ error: 'Erro ao atualizar ticket' });
  }
});

// Deletar ticket (apenas admin)
router.delete('/:id', requireAgent, async (req: AuthRequest, res) => {
  try {
    const ticketId = req.params.id;
    
    const ticket = await dbGet('SELECT id FROM tickets WHERE id = ?', [ticketId]);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket não encontrado' });
    }

    await dbRun('DELETE FROM tickets WHERE id = ?', [ticketId]);
    res.json({ message: 'Ticket deletado com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar ticket:', error);
    res.status(500).json({ error: 'Erro ao deletar ticket' });
  }
});

export default router;
