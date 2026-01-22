import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, AuthRequest, requireAgent } from '../middleware/auth';
import { requirePermission, RESOURCES, ACTIONS } from '../middleware/permissions';
import { dbGet, dbAll, dbRun } from '../database';

const router = express.Router();

// Todas as rotas requerem autenticação
router.use(authenticate);

// IMPORTANTE: Rotas específicas devem vir ANTES das rotas com parâmetros dinâmicos
// Listar tickets pendentes de aprovação (ANTES de /:id)
router.get('/pending-approval', requirePermission(RESOURCES.APPROVE, ACTIONS.VIEW), async (req: AuthRequest, res) => {
  try {
    // Buscar apenas tickets com status pending_approval
    // Tickets aprovados mudam para status 'open', então não devem aparecer aqui
    const tickets = await dbAll(`
      SELECT t.*, 
             u.name as user_name, 
             u.email as user_email,
             f.name as form_name,
             f.public_url as form_url,
             f.linked_user_id,
             f.linked_group_id,
             lu.name as linked_user_name,
             lg.name as linked_group_name
      FROM tickets t
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN forms f ON t.form_id = f.id
      LEFT JOIN users lu ON f.linked_user_id = lu.id
      LEFT JOIN groups lg ON f.linked_group_id = lg.id
      WHERE t.status = 'pending_approval'
      ORDER BY t.created_at DESC
    `);

    console.log(`[Pending Approval] Encontrados ${tickets.length} tickets pendentes de aprovação`);
    
    // Log detalhado para debug
    tickets.forEach((ticket: any) => {
      console.log(`[Pending Approval] Ticket #${ticket.id}: status=${ticket.status}, needs_approval=${ticket.needs_approval}, form_id=${ticket.form_id}, linked_user_id=${ticket.linked_user_id}, linked_group_id=${ticket.linked_group_id}`);
    });

    res.json(tickets);
  } catch (error) {
    console.error('Erro ao buscar tickets pendentes:', error);
    res.status(500).json({ error: 'Erro ao buscar tickets pendentes' });
  }
});

// Listar tickets em tratamento (ANTES de /:id)
router.get('/in-treatment', async (req: AuthRequest, res) => {
  try {
    let query = `
      SELECT t.*, 
             u.name as user_name, 
             u.email as user_email,
             a.name as assigned_name,
             c.name as category_name,
             f.name as form_name,
             f.public_url as form_url
      FROM tickets t
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN users a ON t.assigned_to = a.id
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN forms f ON t.form_id = f.id
      WHERE t.status IN ('open', 'in_progress')
    `;
    const params: any[] = [];

    // Filtros baseados no papel do usuário
    if (req.userRole === 'user') {
      query += ' AND t.user_id = ?';
      params.push(req.userId);
    }

    query += ' ORDER BY t.created_at DESC';

    const tickets = await dbAll(query, params);
    res.json(tickets);
  } catch (error) {
    console.error('Erro ao buscar tickets em tratamento:', error);
    res.status(500).json({ error: 'Erro ao buscar tickets em tratamento' });
  }
});

// Listar tickets
router.get('/', async (req: AuthRequest, res) => {
  try {
    let query = `
      SELECT t.*, 
             u.name as user_name, 
             u.email as user_email,
             a.name as assigned_name,
             a.email as assigned_email,
             c.name as category_name,
             f.name as form_name,
             f.public_url as form_url,
             f.id as form_id
      FROM tickets t
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN users a ON t.assigned_to = a.id
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN forms f ON t.form_id = f.id
    `;
    const params: any[] = [];
    const conditions: string[] = [];

    // Filtros baseados no papel do usuário
    if (req.userRole === 'user') {
      conditions.push('t.user_id = ?');
      params.push(req.userId);
    }

    // Excluir tickets pendentes de aprovação - eles devem aparecer apenas em /pending-approval
    conditions.push("t.status != 'pending_approval'");

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
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

// Aprovar ticket
router.post('/:id/approve', authenticate, requirePermission(RESOURCES.APPROVE, ACTIONS.APPROVE), async (req: AuthRequest, res) => {
  try {
    const ticketId = req.params.id;
    
    const ticket = await dbGet('SELECT * FROM tickets WHERE id = ?', [ticketId]) as any;
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket não encontrado' });
    }

    if (ticket.status !== 'pending_approval') {
      return res.status(400).json({ error: 'Ticket não está pendente de aprovação' });
    }

    // Atualizar status para 'open' (ticket aprovado)
    await dbRun(
      'UPDATE tickets SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['open', ticketId]
    );

    const updatedTicket = await dbGet(`
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
    `, [ticketId]);

    res.json({ message: 'Ticket aprovado com sucesso', ticket: updatedTicket });
  } catch (error) {
    console.error('Erro ao aprovar ticket:', error);
    res.status(500).json({ error: 'Erro ao aprovar ticket' });
  }
});

// Rejeitar ticket
router.post('/:id/reject', authenticate, requirePermission(RESOURCES.APPROVE, ACTIONS.REJECT), async (req: AuthRequest, res) => {
  try {
    const ticketId = req.params.id;
    
    const ticket = await dbGet('SELECT * FROM tickets WHERE id = ?', [ticketId]) as any;
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket não encontrado' });
    }

    if (ticket.status !== 'pending_approval') {
      return res.status(400).json({ error: 'Ticket não está pendente de aprovação' });
    }

    // Atualizar status para 'closed'
    await dbRun(
      'UPDATE tickets SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['closed', ticketId]
    );

    res.json({ message: 'Ticket rejeitado com sucesso' });
  } catch (error) {
    console.error('Erro ao rejeitar ticket:', error);
    res.status(500).json({ error: 'Erro ao rejeitar ticket' });
  }
});

// Atualizar ticket
router.put('/:id', [
  body('status').optional().isIn(['open', 'in_progress', 'resolved', 'closed', 'pending_approval', 'scheduled']),
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
