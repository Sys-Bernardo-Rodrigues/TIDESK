import express, { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { dbRun, dbGet, dbAll, getBrasiliaTimestamp } from '../database';
import { authenticate, requireAgent } from '../middleware/auth';

const DB_TYPE = process.env.DB_TYPE || 'sqlite';

const router = express.Router();

interface AuthRequest extends Request {
  userId?: number;
  userRole?: string;
}

// Listar eventos do calendário
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { start, end } = req.query;
    
    let query = `
      SELECT DISTINCT ce.*, 
             u.name as created_by_name
      FROM calendar_events ce
      LEFT JOIN users u ON ce.created_by = u.id
    `;
    
    const params: any[] = [];
    const conditions: string[] = [];
    
    // Filtrar por período se fornecido
    if (start && end) {
      conditions.push('(ce.start_time >= ? AND ce.start_time <= ?) OR (ce.end_time >= ? AND ce.end_time <= ?)');
      params.push(start, end, start, end);
    }
    
    // Usuários só veem eventos onde estão vinculados ou que criaram
    if (req.userRole === 'user') {
      query += ` LEFT JOIN event_users eu ON ce.id = eu.event_id`;
      conditions.push(`(ce.created_by = ? OR eu.user_id = ?)`);
      params.push(req.userId, req.userId);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY ce.start_time ASC';
    
    const events = await dbAll(query, params);
    
    // Buscar usuários vinculados para cada evento
    const formattedEvents = await Promise.all(events.map(async (event: any) => {
      const eventUsers = await dbAll(`
        SELECT eu.user_id, u.name
        FROM event_users eu
        JOIN users u ON eu.user_id = u.id
        WHERE eu.event_id = ?
      `, [event.id]);
      
      return {
        ...event,
        user_ids: eventUsers.map((eu: any) => eu.user_id),
        user_names: eventUsers.map((eu: any) => eu.name)
      };
    }));
    
    res.json(formattedEvents);
  } catch (error) {
    console.error('Erro ao listar eventos:', error);
    res.status(500).json({ error: 'Erro ao buscar eventos' });
  }
});

// Listar tickets agendados
router.get('/tickets', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { start, end } = req.query;
    
    let query = `
      SELECT t.id,
             t.ticket_number,
             t.title,
             t.description,
             t.status,
             t.priority,
             t.scheduled_at as start_time,
             t.scheduled_at as end_time,
             'ticket' as type,
             CASE 
               WHEN t.priority = 'urgent' THEN '#ef4444'
               WHEN t.priority = 'high' THEN '#f97316'
               WHEN t.priority = 'medium' THEN '#f59e0b'
               ELSE '#3b82f6'
             END as color,
             u.name as user_name,
             a.name as assigned_name
      FROM tickets t
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN users a ON t.assigned_to = a.id
      WHERE t.scheduled_at IS NOT NULL
    `;
    
    const params: any[] = [];
    const conditions: string[] = [];
    
    // Filtrar por período se fornecido
    if (start && end) {
      conditions.push('t.scheduled_at >= ? AND t.scheduled_at <= ?');
      params.push(start, end);
    }
    
    // Usuários só veem seus próprios tickets
    if (req.userRole === 'user') {
      conditions.push('t.user_id = ?');
      params.push(req.userId);
    }
    
    if (conditions.length > 0) {
      query += ' AND ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY t.scheduled_at ASC';
    
    const tickets = await dbAll(query, params);
    res.json(tickets);
  } catch (error) {
    console.error('Erro ao listar tickets agendados:', error);
    res.status(500).json({ error: 'Erro ao buscar tickets agendados' });
  }
});

// Criar evento
router.post('/', requireAgent, [
  body('title').notEmpty().withMessage('Título é obrigatório'),
  body('start_time').notEmpty().withMessage('Data/hora de início é obrigatória'),
  body('end_time').notEmpty().withMessage('Data/hora de término é obrigatória'),
  body('user_ids').optional().isArray().withMessage('IDs de usuários devem ser um array')
], async (req: AuthRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { title, description, start_time, end_time, type, color, user_ids } = req.body;
    
    // Criar evento
    const result = await dbRun(
      `INSERT INTO calendar_events (title, description, start_time, end_time, type, color, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title,
        description || null,
        start_time,
        end_time,
        type || 'event',
        color || null,
        req.userId,
        getBrasiliaTimestamp(),
        getBrasiliaTimestamp()
      ]
    );
    
    const eventId = (result as any).lastID || (result as any).id;
    
    // Vincular usuários ao evento
    if (user_ids && Array.isArray(user_ids) && user_ids.length > 0) {
      for (const userId of user_ids) {
        try {
          await dbRun(
            'INSERT INTO event_users (event_id, user_id, created_at) VALUES (?, ?, ?)',
            [eventId, userId, getBrasiliaTimestamp()]
          );
        } catch (error) {
          // Ignorar erros de duplicata
        }
      }
    }
    
    // Buscar evento criado
    const event = await dbGet(`
      SELECT ce.*, 
             u.name as created_by_name
      FROM calendar_events ce
      LEFT JOIN users u ON ce.created_by = u.id
      WHERE ce.id = ?
    `, [eventId]);
    
    // Buscar usuários vinculados
    const eventUsers = await dbAll(`
      SELECT eu.user_id, u.name
      FROM event_users eu
      JOIN users u ON eu.user_id = u.id
      WHERE eu.event_id = ?
    `, [eventId]);
    
    const formattedEvent = {
      ...event,
      user_ids: eventUsers.map((eu: any) => eu.user_id),
      user_names: eventUsers.map((eu: any) => eu.name)
    };
    
    res.status(201).json(formattedEvent);
  } catch (error) {
    console.error('Erro ao criar evento:', error);
    res.status(500).json({ error: 'Erro ao criar evento' });
  }
});

// Atualizar evento
router.put('/:id', requireAgent, [
  body('title').optional().notEmpty().withMessage('Título não pode ser vazio'),
  body('start_time').optional().notEmpty().withMessage('Data/hora de início é obrigatória'),
  body('end_time').optional().notEmpty().withMessage('Data/hora de término é obrigatória'),
  body('user_ids').optional().isArray().withMessage('IDs de usuários devem ser um array')
], async (req: AuthRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const eventId = parseInt(req.params.id);
    const { title, description, start_time, end_time, type, color, user_ids } = req.body;
    
    // Verificar se o evento existe e se o usuário tem permissão
    const event = await dbGet('SELECT * FROM calendar_events WHERE id = ?', [eventId]);
    if (!event) {
      return res.status(404).json({ error: 'Evento não encontrado' });
    }
    
    // Verificar se o usuário criou o evento ou é admin
    if (event.created_by !== req.userId && req.userRole !== 'admin') {
      return res.status(403).json({ error: 'Sem permissão para editar este evento' });
    }
    
    // Atualizar evento
    const updateFields: string[] = [];
    const updateParams: any[] = [];
    
    if (title !== undefined) {
      updateFields.push('title = ?');
      updateParams.push(title);
    }
    if (description !== undefined) {
      updateFields.push('description = ?');
      updateParams.push(description);
    }
    if (start_time !== undefined) {
      updateFields.push('start_time = ?');
      updateParams.push(start_time);
    }
    if (end_time !== undefined) {
      updateFields.push('end_time = ?');
      updateParams.push(end_time);
    }
    if (type !== undefined) {
      updateFields.push('type = ?');
      updateParams.push(type);
    }
    if (color !== undefined) {
      updateFields.push('color = ?');
      updateParams.push(color);
    }
    
    updateFields.push('updated_at = ?');
    updateParams.push(getBrasiliaTimestamp());
    updateParams.push(eventId);
    
    await dbRun(
      `UPDATE calendar_events SET ${updateFields.join(', ')} WHERE id = ?`,
      updateParams
    );
    
    // Atualizar usuários vinculados se fornecido
    if (user_ids !== undefined) {
      // Remover vínculos existentes
      await dbRun('DELETE FROM event_users WHERE event_id = ?', [eventId]);
      
      // Adicionar novos vínculos
      if (Array.isArray(user_ids) && user_ids.length > 0) {
        for (const userId of user_ids) {
          try {
            await dbRun(
              'INSERT INTO event_users (event_id, user_id, created_at) VALUES (?, ?, ?)',
              [eventId, userId, getBrasiliaTimestamp()]
            );
          } catch (error) {
            // Ignorar erros de duplicata
          }
        }
      }
    }
    
    // Buscar evento atualizado
    const updatedEvent = await dbGet(`
      SELECT ce.*, 
             u.name as created_by_name
      FROM calendar_events ce
      LEFT JOIN users u ON ce.created_by = u.id
      WHERE ce.id = ?
    `, [eventId]);
    
    // Buscar usuários vinculados
    const eventUsers = await dbAll(`
      SELECT eu.user_id, u.name
      FROM event_users eu
      JOIN users u ON eu.user_id = u.id
      WHERE eu.event_id = ?
    `, [eventId]);
    
    const formattedEvent = {
      ...updatedEvent,
      user_ids: eventUsers.map((eu: any) => eu.user_id),
      user_names: eventUsers.map((eu: any) => eu.name)
    };
    
    res.json(formattedEvent);
  } catch (error) {
    console.error('Erro ao atualizar evento:', error);
    res.status(500).json({ error: 'Erro ao atualizar evento' });
  }
});

// Deletar evento
router.delete('/:id', requireAgent, async (req: AuthRequest, res: Response) => {
  try {
    const eventId = parseInt(req.params.id);
    
    // Verificar se o evento existe e se o usuário tem permissão
    const event = await dbGet('SELECT * FROM calendar_events WHERE id = ?', [eventId]);
    if (!event) {
      return res.status(404).json({ error: 'Evento não encontrado' });
    }
    
    // Verificar se o usuário criou o evento ou é admin
    if (event.created_by !== req.userId && req.userRole !== 'admin') {
      return res.status(403).json({ error: 'Sem permissão para deletar este evento' });
    }
    
    // Deletar evento (cascade vai deletar event_users automaticamente)
    await dbRun('DELETE FROM calendar_events WHERE id = ?', [eventId]);
    
    res.json({ message: 'Evento deletado com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar evento:', error);
    res.status(500).json({ error: 'Erro ao deletar evento' });
  }
});

export default router;
