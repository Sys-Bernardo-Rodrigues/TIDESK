import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, AuthRequest } from '../middleware/auth';
import { dbGet, dbAll, dbRun } from '../database';

const router = express.Router();

// Todas as rotas requerem autenticação
router.use(authenticate);

// Listar mensagens de um ticket
router.get('/ticket/:ticketId', async (req: AuthRequest, res) => {
  try {
    // Verificar se o ticket existe e se o usuário tem permissão
    const ticket = await dbGet('SELECT * FROM tickets WHERE id = ?', [req.params.ticketId]);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket não encontrado' });
    }

    // Verificar permissão (usuário só pode ver mensagens de seus próprios tickets)
    if (req.userRole === 'user' && (ticket as any).user_id !== req.userId) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    // Buscar mensagens
    const messages = await dbAll(`
      SELECT tm.*, u.name as user_name, u.email as user_email
      FROM ticket_messages tm
      JOIN users u ON tm.user_id = u.id
      WHERE tm.ticket_id = ?
      ORDER BY tm.created_at ASC
    `, [req.params.ticketId]);

    res.json(messages);
  } catch (error) {
    console.error('Erro ao buscar mensagens:', error);
    res.status(500).json({ error: 'Erro ao buscar mensagens' });
  }
});

// Criar mensagem em um ticket
router.post('/ticket/:ticketId', [
  body('message').notEmpty().withMessage('Mensagem é obrigatória')
], async (req: AuthRequest, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Verificar se o ticket existe e se o usuário tem permissão
    const ticket = await dbGet('SELECT * FROM tickets WHERE id = ?', [req.params.ticketId]);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket não encontrado' });
    }

    // Verificar permissão (usuário só pode enviar mensagens em seus próprios tickets)
    if (req.userRole === 'user' && (ticket as any).user_id !== req.userId) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    // Criar mensagem
    const result = await dbRun(`
      INSERT INTO ticket_messages (ticket_id, user_id, message)
      VALUES (?, ?, ?)
    `, [req.params.ticketId, req.userId, req.body.message]);

    const messageId = (result as any).lastID || (result as any).id;

    // Buscar mensagem criada
    const message = await dbGet(`
      SELECT tm.*, u.name as user_name, u.email as user_email
      FROM ticket_messages tm
      JOIN users u ON tm.user_id = u.id
      WHERE tm.id = ?
    `, [messageId]);

    // Atualizar timestamp do ticket
    await dbRun(`
      UPDATE tickets 
      SET updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `, [req.params.ticketId]);

    res.status(201).json(message);
  } catch (error) {
    console.error('Erro ao criar mensagem:', error);
    res.status(500).json({ error: 'Erro ao criar mensagem' });
  }
});

// Atualizar mensagem
router.put('/:id', [
  body('message').notEmpty().withMessage('Mensagem é obrigatória')
], async (req: AuthRequest, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Verificar se a mensagem existe e se pertence ao usuário
    const message = await dbGet('SELECT * FROM ticket_messages WHERE id = ?', [req.params.id]);
    if (!message) {
      return res.status(404).json({ error: 'Mensagem não encontrada' });
    }

    // Apenas o autor pode editar (ou admin/agent)
    if ((message as any).user_id !== req.userId && req.userRole !== 'admin' && req.userRole !== 'agent') {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    // Atualizar mensagem
    await dbRun(`
      UPDATE ticket_messages
      SET message = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [req.body.message, req.params.id]);

    // Buscar mensagem atualizada
    const updatedMessage = await dbGet(`
      SELECT tm.*, u.name as user_name, u.email as user_email
      FROM ticket_messages tm
      JOIN users u ON tm.user_id = u.id
      WHERE tm.id = ?
    `, [req.params.id]);

    res.json(updatedMessage);
  } catch (error) {
    console.error('Erro ao atualizar mensagem:', error);
    res.status(500).json({ error: 'Erro ao atualizar mensagem' });
  }
});

// Deletar mensagem
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    // Verificar se a mensagem existe e se pertence ao usuário
    const message = await dbGet('SELECT * FROM ticket_messages WHERE id = ?', [req.params.id]);
    if (!message) {
      return res.status(404).json({ error: 'Mensagem não encontrada' });
    }

    // Apenas o autor pode deletar (ou admin/agent)
    if ((message as any).user_id !== req.userId && req.userRole !== 'admin' && req.userRole !== 'agent') {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    // Deletar mensagem
    await dbRun('DELETE FROM ticket_messages WHERE id = ?', [req.params.id]);

    res.json({ message: 'Mensagem excluída com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar mensagem:', error);
    res.status(500).json({ error: 'Erro ao deletar mensagem' });
  }
});

export default router;
