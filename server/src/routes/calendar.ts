import express, { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { dbRun, dbGet, dbAll, getBrasiliaTimestamp } from '../database';
import { authenticate } from '../middleware/auth';
import { requirePermission, RESOURCES, ACTIONS } from '../middleware/permissions';

const DB_TYPE = process.env.DB_TYPE || 'sqlite';

const router = express.Router();

interface AuthRequest extends Request {
  userId?: number;
  userRole?: string;
}

// Listar eventos do calendário
router.get('/', authenticate, requirePermission(RESOURCES.AGENDA, ACTIONS.VIEW), async (req: AuthRequest, res: Response) => {
  try {
    const { start, end } = req.query;
    
    const projectId = req.query.project_id;
    
    let query = `
      SELECT DISTINCT ce.*, 
             u.name as created_by_name,
             p.name as project_name
      FROM calendar_events ce
      LEFT JOIN users u ON ce.created_by = u.id
      LEFT JOIN projects p ON ce.project_id = p.id
    `;
    
    const params: any[] = [];
    const conditions: string[] = [];
    
    // Filtrar por período se fornecido
    if (start && end) {
      conditions.push('(ce.start_time >= ? AND ce.start_time <= ?) OR (ce.end_time >= ? AND ce.end_time <= ?)');
      params.push(start, end, start, end);
    }
    
    if (projectId) {
      conditions.push('ce.project_id = ?');
      params.push(projectId);
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

// Listar itens de projetos (tarefas com due_date e sprints) para exibir na agenda
router.get('/project-items', authenticate, requirePermission(RESOURCES.AGENDA, ACTIONS.VIEW), requirePermission(RESOURCES.PROJECTS, ACTIONS.VIEW), async (req: AuthRequest, res: Response) => {
  try {
    const { start, end, project_id } = req.query;
    if (!start || !end) {
      return res.status(400).json({ error: 'Parâmetros start e end são obrigatórios' });
    }
    const startStr = start as string;
    const endStr = end as string;

    const tasks: any[] = [];
    const sprints: any[] = [];

    // Tarefas com due_date no período
    let taskQuery = `
      SELECT pt.id, pt.project_id, pt.title, pt.due_date, pt.priority, p.name as project_name
      FROM project_tasks pt
      JOIN projects p ON pt.project_id = p.id
      WHERE pt.due_date IS NOT NULL
        AND (pt.due_date >= ? AND pt.due_date <= ?)
    `;
    const taskParams: any[] = [startStr.slice(0, 10), endStr.slice(0, 10)];
    if (project_id) {
      taskQuery += ' AND pt.project_id = ?';
      taskParams.push(project_id);
    }
    taskQuery += ' ORDER BY pt.due_date ASC';
    const taskRows = await dbAll(taskQuery, taskParams);
    for (const row of taskRows as any[]) {
      const d = row.due_date ? String(row.due_date).slice(0, 10) : '';
      tasks.push({
        id: `task-${row.id}`,
        task_id: row.id,
        title: row.title,
        start_time: d + 'T09:00:00',
        end_time: d + 'T09:00:00',
        type: 'project_task',
        priority: row.priority,
        project_id: row.project_id,
        project_name: row.project_name,
        color: '#6366f1'
        });
    }

    // Sprints que se sobrepõem ao período
    let sprintQuery = `
      SELECT ps.id, ps.project_id, ps.name, ps.start_date, ps.end_date, p.name as project_name
      FROM project_sprints ps
      JOIN projects p ON ps.project_id = p.id
      WHERE ps.start_date IS NOT NULL AND ps.end_date IS NOT NULL
        AND (
          (ps.start_date <= ? AND ps.end_date >= ?)
          OR (ps.start_date >= ? AND ps.start_date <= ?)
          OR (ps.end_date >= ? AND ps.end_date <= ?)
        )
    `;
    const sprintParams: any[] = [endStr.slice(0, 10), startStr.slice(0, 10), startStr.slice(0, 10), endStr.slice(0, 10), startStr.slice(0, 10), endStr.slice(0, 10)];
    if (project_id) {
      sprintQuery += ' AND ps.project_id = ?';
      sprintParams.push(project_id);
    }
    sprintQuery += ' ORDER BY ps.start_date ASC';
    const sprintRows = await dbAll(sprintQuery, sprintParams);
    for (const row of sprintRows as any[]) {
      const startDate = String(row.start_date).slice(0, 10);
      const endDate = String(row.end_date).slice(0, 10);
      sprints.push({
        id: `sprint-${row.id}`,
        sprint_id: row.id,
        title: row.name,
        start_time: startDate + 'T00:00:00',
        end_time: endDate + 'T23:59:59',
        type: 'project_sprint',
        project_id: row.project_id,
        project_name: row.project_name,
        color: '#10b981'
      });
    }

    res.json({ tasks, sprints });
  } catch (error) {
    console.error('Erro ao listar itens de projetos:', error);
    res.status(500).json({ error: 'Erro ao buscar itens de projetos' });
  }
});

// Listar tickets agendados
router.get('/tickets', authenticate, requirePermission(RESOURCES.AGENDA, ACTIONS.VIEW), async (req: AuthRequest, res: Response) => {
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
router.post('/', authenticate, requirePermission(RESOURCES.AGENDA, ACTIONS.CREATE), [
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
    
    const { title, description, start_time, end_time, type, color, user_ids, project_id } = req.body;
    
    // Criar evento
    const result = await dbRun(
      `INSERT INTO calendar_events (title, description, start_time, end_time, type, color, created_by, project_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title,
        description || null,
        start_time,
        end_time,
        type || 'event',
        color || null,
        req.userId,
        project_id || null,
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
router.put('/:id', authenticate, requirePermission(RESOURCES.AGENDA, ACTIONS.EDIT), [
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
    const { title, description, start_time, end_time, type, color, user_ids, project_id } = req.body;
    
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
    if (project_id !== undefined) {
      updateFields.push('project_id = ?');
      updateParams.push(project_id);
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
router.delete('/:id', authenticate, requirePermission(RESOURCES.AGENDA, ACTIONS.DELETE), async (req: AuthRequest, res: Response) => {
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
