import express, { Response } from 'express';
import path from 'path';
import fs from 'fs';
import { body, param, validationResult } from 'express-validator';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requirePermission, RESOURCES, ACTIONS } from '../middleware/permissions';
import { dbGet, dbAll, dbRun, getBrasiliaTimestamp } from '../database';
import { uploadProjectTaskAttachment } from '../middleware/upload';

const router = express.Router();

const DEFAULT_COLUMNS = ['A fazer', 'Em progresso', 'Concluído'];

// Listar projetos
router.get(
  '/',
  authenticate,
  requirePermission(RESOURCES.PROJECTS, ACTIONS.VIEW),
  async (req: AuthRequest, res: Response) => {
    try {
      const projects = await dbAll(`
        SELECT p.*, u.name as created_by_name,
               (SELECT COUNT(*) FROM project_tasks pt WHERE pt.project_id = p.id) as tasks_count
        FROM projects p
        LEFT JOIN users u ON p.created_by = u.id
        ORDER BY p.updated_at DESC
      `);
      res.json(projects);
    } catch (error) {
      console.error('Erro ao listar projetos:', error);
      res.status(500).json({ error: 'Erro ao buscar projetos' });
    }
  }
);

// Obter projeto com colunas e tarefas
router.get(
  '/:id',
  authenticate,
  requirePermission(RESOURCES.PROJECTS, ACTIONS.VIEW),
  async (req: AuthRequest, res: Response) => {
    try {
      const project = await dbGet(
        `SELECT p.*, u.name as created_by_name FROM projects p
         LEFT JOIN users u ON p.created_by = u.id WHERE p.id = ?`,
        [req.params.id]
      );
      if (!project) {
        return res.status(404).json({ error: 'Projeto não encontrado' });
      }
      const columns = await dbAll(
        'SELECT * FROM project_columns WHERE project_id = ? ORDER BY order_index, id',
        [req.params.id]
      );
      const sprints = await dbAll(
        'SELECT * FROM project_sprints WHERE project_id = ? ORDER BY order_index, id',
        [req.params.id]
      );
      const tasks = await dbAll(
        `SELECT pt.*, u.name as assigned_to_name, cu.name as created_by_name, ps.name as sprint_name
         FROM project_tasks pt
         LEFT JOIN users u ON pt.assigned_to = u.id
         LEFT JOIN users cu ON pt.created_by = cu.id
         LEFT JOIN project_sprints ps ON pt.sprint_id = ps.id
         WHERE pt.project_id = ? ORDER BY pt.column_id, pt.order_index, pt.id`,
        [req.params.id]
      );
      res.json({
        ...project,
        columns,
        sprints,
        tasks,
      });
    } catch (error) {
      console.error('Erro ao buscar projeto:', error);
      res.status(500).json({ error: 'Erro ao buscar projeto' });
    }
  }
);

// Criar projeto
router.post(
  '/',
  [
    authenticate,
    requirePermission(RESOURCES.PROJECTS, ACTIONS.CREATE),
    body('name').notEmpty().withMessage('Nome é obrigatório'),
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const { name, description } = req.body;
      const now = getBrasiliaTimestamp();
      const result = await dbRun(
        `INSERT INTO projects (name, description, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
        [name, description || null, req.userId, now, now]
      );
      const projectId = (result as any).lastID;
      for (let i = 0; i < DEFAULT_COLUMNS.length; i++) {
        await dbRun(
          'INSERT INTO project_columns (project_id, name, order_index) VALUES (?, ?, ?)',
          [projectId, DEFAULT_COLUMNS[i], i]
        );
      }
      const project = await dbGet('SELECT * FROM projects WHERE id = ?', [projectId]);
      const columns = await dbAll('SELECT * FROM project_columns WHERE project_id = ? ORDER BY order_index', [projectId]);
      res.status(201).json({ ...project, columns });
    } catch (error) {
      console.error('Erro ao criar projeto:', error);
      res.status(500).json({ error: 'Erro ao criar projeto' });
    }
  }
);

// Atualizar projeto
router.put(
  '/:id',
  [
    authenticate,
    requirePermission(RESOURCES.PROJECTS, ACTIONS.EDIT),
    param('id').isInt(),
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const existing = await dbGet('SELECT id, name, description FROM projects WHERE id = ?', [req.params.id]);
      if (!existing) {
        return res.status(404).json({ error: 'Projeto não encontrado' });
      }
      const { name, description } = req.body;
      const newName = name !== undefined ? name : (existing as any).name;
      const newDesc = description !== undefined ? description : (existing as any).description;
      const now = getBrasiliaTimestamp();
      await dbRun(
        `UPDATE projects SET name = ?, description = ?, updated_at = ? WHERE id = ?`,
        [newName, newDesc, now, req.params.id]
      );
      const project = await dbGet('SELECT * FROM projects WHERE id = ?', [req.params.id]);
      res.json(project);
    } catch (error) {
      console.error('Erro ao atualizar projeto:', error);
      res.status(500).json({ error: 'Erro ao atualizar projeto' });
    }
  }
);

// Excluir projeto
router.delete(
  '/:id',
  authenticate,
  requirePermission(RESOURCES.PROJECTS, ACTIONS.DELETE),
  async (req: AuthRequest, res: Response) => {
    try {
      const existing = await dbGet('SELECT id FROM projects WHERE id = ?', [req.params.id]);
      if (!existing) {
        return res.status(404).json({ error: 'Projeto não encontrado' });
      }
      await dbRun('DELETE FROM projects WHERE id = ?', [req.params.id]);
      res.status(204).send();
    } catch (error) {
      console.error('Erro ao excluir projeto:', error);
      res.status(500).json({ error: 'Erro ao excluir projeto' });
    }
  }
);

// --- Colunas (sub-recurso do projeto) ---

// Adicionar coluna
router.post(
  '/:id/columns',
  [
    authenticate,
    requirePermission(RESOURCES.PROJECTS, ACTIONS.EDIT),
    param('id').isInt(),
    body('name').notEmpty().withMessage('Nome é obrigatório'),
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const project = await dbGet('SELECT id FROM projects WHERE id = ?', [req.params.id]);
      if (!project) {
        return res.status(404).json({ error: 'Projeto não encontrado' });
      }
      const maxOrder = await dbGet(
        'SELECT COALESCE(MAX(order_index), -1) + 1 as next_index FROM project_columns WHERE project_id = ?',
        [req.params.id]
      );
      const orderIndex = (maxOrder as any)?.next_index ?? 0;
      const result = await dbRun(
        'INSERT INTO project_columns (project_id, name, order_index) VALUES (?, ?, ?)',
        [req.params.id, req.body.name, orderIndex]
      );
      const col = await dbGet('SELECT * FROM project_columns WHERE id = ?', [(result as any).lastID]);
      res.status(201).json(col);
    } catch (error) {
      console.error('Erro ao criar coluna:', error);
      res.status(500).json({ error: 'Erro ao criar coluna' });
    }
  }
);

// Editar coluna (nome)
router.put(
  '/:id/columns/:columnId',
  [
    authenticate,
    requirePermission(RESOURCES.PROJECTS, ACTIONS.EDIT),
    param('id').isInt(),
    param('columnId').isInt(),
    body('name').notEmpty().withMessage('Nome é obrigatório'),
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const col = await dbGet(
        'SELECT id FROM project_columns WHERE id = ? AND project_id = ?',
        [req.params.columnId, req.params.id]
      );
      if (!col) {
        return res.status(404).json({ error: 'Coluna não encontrada' });
      }
      await dbRun('UPDATE project_columns SET name = ? WHERE id = ?', [req.body.name.trim(), req.params.columnId]);
      const updated = await dbGet('SELECT * FROM project_columns WHERE id = ?', [req.params.columnId]);
      res.json(updated);
    } catch (error) {
      console.error('Erro ao atualizar coluna:', error);
      res.status(500).json({ error: 'Erro ao atualizar coluna' });
    }
  }
);

// Excluir coluna (tarefas da coluna são excluídas em cascata)
router.delete(
  '/:id/columns/:columnId',
  authenticate,
  requirePermission(RESOURCES.PROJECTS, ACTIONS.DELETE),
  async (req: AuthRequest, res: Response) => {
    try {
      const col = await dbGet(
        'SELECT id FROM project_columns WHERE id = ? AND project_id = ?',
        [req.params.columnId, req.params.id]
      );
      if (!col) {
        return res.status(404).json({ error: 'Coluna não encontrada' });
      }
      const columnsCount = await dbGet(
        'SELECT COUNT(*) as total FROM project_columns WHERE project_id = ?',
        [req.params.id]
      );
      if ((columnsCount as any)?.total <= 1) {
        return res.status(400).json({ error: 'O projeto deve ter pelo menos uma coluna' });
      }
      await dbRun('DELETE FROM project_columns WHERE id = ?', [req.params.columnId]);
      res.status(204).send();
    } catch (error) {
      console.error('Erro ao excluir coluna:', error);
      res.status(500).json({ error: 'Erro ao excluir coluna' });
    }
  }
);

// --- Sprints ---

router.get(
  '/:id/sprints',
  authenticate,
  requirePermission(RESOURCES.PROJECTS, ACTIONS.VIEW),
  async (req: AuthRequest, res: Response) => {
    try {
      const project = await dbGet('SELECT id FROM projects WHERE id = ?', [req.params.id]);
      if (!project) return res.status(404).json({ error: 'Projeto não encontrado' });
      const sprints = await dbAll(
        'SELECT * FROM project_sprints WHERE project_id = ? ORDER BY order_index, id',
        [req.params.id]
      );
      res.json(sprints);
    } catch (error) {
      console.error('Erro ao listar sprints:', error);
      res.status(500).json({ error: 'Erro ao buscar sprints' });
    }
  }
);

router.post(
  '/:id/sprints',
  [
    authenticate,
    requirePermission(RESOURCES.PROJECTS, ACTIONS.CREATE),
    param('id').isInt(),
    body('name').notEmpty().withMessage('Nome é obrigatório'),
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
      const project = await dbGet('SELECT id FROM projects WHERE id = ?', [req.params.id]);
      if (!project) return res.status(404).json({ error: 'Projeto não encontrado' });
      const maxOrder = await dbGet(
        'SELECT COALESCE(MAX(order_index), -1) + 1 as next_index FROM project_sprints WHERE project_id = ?',
        [req.params.id]
      );
      const orderIndex = (maxOrder as any)?.next_index ?? 0;
      const result = await dbRun(
        'INSERT INTO project_sprints (project_id, name, start_date, end_date, order_index) VALUES (?, ?, ?, ?, ?)',
        [req.params.id, req.body.name.trim(), req.body.start_date || null, req.body.end_date || null, orderIndex]
      );
      const sprint = await dbGet('SELECT * FROM project_sprints WHERE id = ?', [(result as any).lastID]);
      res.status(201).json(sprint);
    } catch (error) {
      console.error('Erro ao criar sprint:', error);
      res.status(500).json({ error: 'Erro ao criar sprint' });
    }
  }
);

router.put(
  '/:id/sprints/:sprintId',
  [
    authenticate,
    requirePermission(RESOURCES.PROJECTS, ACTIONS.EDIT),
    param('id').isInt(),
    param('sprintId').isInt(),
    body('name').optional().notEmpty(),
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
      const sprint = await dbGet(
        'SELECT id, name, start_date, end_date FROM project_sprints WHERE id = ? AND project_id = ?',
        [req.params.sprintId, req.params.id]
      );
      if (!sprint) return res.status(404).json({ error: 'Sprint não encontrada' });
      const name = req.body.name !== undefined ? req.body.name.trim() : (sprint as any).name;
      const startDate = req.body.start_date !== undefined ? req.body.start_date || null : (sprint as any).start_date;
      const endDate = req.body.end_date !== undefined ? req.body.end_date || null : (sprint as any).end_date;
      await dbRun(
        'UPDATE project_sprints SET name = ?, start_date = ?, end_date = ? WHERE id = ?',
        [name, startDate, endDate, req.params.sprintId]
      );
      const updated = await dbGet('SELECT * FROM project_sprints WHERE id = ?', [req.params.sprintId]);
      res.json(updated);
    } catch (error) {
      console.error('Erro ao atualizar sprint:', error);
      res.status(500).json({ error: 'Erro ao atualizar sprint' });
    }
  }
);

router.delete(
  '/:id/sprints/:sprintId',
  authenticate,
  requirePermission(RESOURCES.PROJECTS, ACTIONS.DELETE),
  async (req: AuthRequest, res: Response) => {
    try {
      const sprint = await dbGet(
        'SELECT id FROM project_sprints WHERE id = ? AND project_id = ?',
        [req.params.sprintId, req.params.id]
      );
      if (!sprint) return res.status(404).json({ error: 'Sprint não encontrada' });
      await dbRun('UPDATE project_tasks SET sprint_id = NULL WHERE sprint_id = ?', [req.params.sprintId]);
      await dbRun('DELETE FROM project_sprints WHERE id = ?', [req.params.sprintId]);
      res.status(204).send();
    } catch (error) {
      console.error('Erro ao excluir sprint:', error);
      res.status(500).json({ error: 'Erro ao excluir sprint' });
    }
  }
);

// --- Tarefas ---

// Criar tarefa
router.post(
  '/:id/tasks',
  [
    authenticate,
    requirePermission(RESOURCES.PROJECTS, ACTIONS.CREATE),
    param('id').isInt(),
    body('title').notEmpty().withMessage('Título é obrigatório'),
    body('column_id').isInt().withMessage('Coluna é obrigatória'),
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const project = await dbGet('SELECT id FROM projects WHERE id = ?', [req.params.id]);
      if (!project) {
        return res.status(404).json({ error: 'Projeto não encontrado' });
      }
      const column = await dbGet(
        'SELECT id FROM project_columns WHERE id = ? AND project_id = ?',
        [req.body.column_id, req.params.id]
      );
      if (!column) {
        return res.status(400).json({ error: 'Coluna inválida' });
      }
      const maxOrder = await dbGet(
        'SELECT COALESCE(MAX(order_index), -1) + 1 as next_index FROM project_tasks WHERE column_id = ?',
        [req.body.column_id]
      );
      const orderIndex = (maxOrder as any)?.next_index ?? 0;
      const now = getBrasiliaTimestamp();
      const priority = ['low', 'medium', 'high', 'urgent'].includes(req.body.priority) ? req.body.priority : 'medium';
      const taskType = ['feature', 'bug', 'tech_debt', 'chore'].includes(req.body.task_type) ? req.body.task_type : 'feature';
      let sprintId = req.body.sprint_id && Number(req.body.sprint_id) > 0 ? req.body.sprint_id : null;
      if (sprintId) {
        const sprintBelongs = await dbGet(
          'SELECT id FROM project_sprints WHERE id = ? AND project_id = ?',
          [sprintId, req.params.id]
        );
        if (!sprintBelongs) sprintId = null;
      }
      const storyPoints = req.body.story_points != null ? (Number(req.body.story_points) || null) : null;
      const dueDate = req.body.due_date || null;
      const result = await dbRun(
        `INSERT INTO project_tasks (project_id, column_id, title, description, priority, order_index, assigned_to, created_by, created_at, updated_at, sprint_id, story_points, due_date, task_type)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          req.params.id,
          req.body.column_id,
          req.body.title,
          req.body.description || null,
          priority,
          orderIndex,
          req.body.assigned_to || null,
          req.userId,
          now,
          now,
          sprintId,
          storyPoints,
          dueDate,
          taskType,
        ]
      );
      const taskId = (result as any).lastID;
      const task = await dbGet(
        `SELECT pt.*, u.name as assigned_to_name, cu.name as created_by_name, ps.name as sprint_name
         FROM project_tasks pt
         LEFT JOIN users u ON pt.assigned_to = u.id
         LEFT JOIN users cu ON pt.created_by = cu.id
         LEFT JOIN project_sprints ps ON pt.sprint_id = ps.id
         WHERE pt.id = ?`,
        [taskId]
      );
      res.status(201).json(task);
    } catch (error) {
      console.error('Erro ao criar tarefa:', error);
      res.status(500).json({ error: 'Erro ao criar tarefa' });
    }
  }
);

// Mover tarefa (atualizar coluna e/ou ordem)
router.patch(
  '/:id/tasks/:taskId',
  [
    authenticate,
    requirePermission(RESOURCES.PROJECTS, ACTIONS.EDIT),
    param('id').isInt(),
    param('taskId').isInt(),
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const task = await dbGet(
        'SELECT id, column_id, order_index, started_at, completed_at FROM project_tasks WHERE id = ? AND project_id = ?',
        [req.params.taskId, req.params.id]
      );
      if (!task) {
        return res.status(404).json({ error: 'Tarefa não encontrada' });
      }
      const { column_id, order_index } = req.body;
      const now = getBrasiliaTimestamp();
      if (column_id !== undefined) {
        const col = await dbGet(
          'SELECT id FROM project_columns WHERE id = ? AND project_id = ?',
          [column_id, req.params.id]
        );
        if (!col) {
          return res.status(400).json({ error: 'Coluna inválida' });
        }
        const columns = await dbAll(
          'SELECT id, order_index FROM project_columns WHERE project_id = ? ORDER BY order_index',
          [req.params.id]
        );
        const orderIndexes = (columns as any[]).map((c) => c.order_index);
        const lastOrder = orderIndexes.length ? Math.max(...orderIndexes) : 0;
        const firstOrder = orderIndexes.length ? Math.min(...orderIndexes) : 0;
        const lastColumn = (columns as any[]).find((c) => c.order_index === lastOrder);
        const firstColumn = (columns as any[]).find((c) => c.order_index === firstOrder);
        const isMovingToLastColumn = lastColumn && column_id === lastColumn.id;
        const isMovingOutOfLastColumn = lastColumn && (task as any).column_id === lastColumn.id && column_id !== lastColumn.id;
        const isMovingToNonFirstColumn = firstColumn && column_id !== firstColumn.id;
        let completedAt: string | null = undefined as any;
        let startedAt: string | null = undefined as any;
        if (isMovingToLastColumn) completedAt = now;
        else if (isMovingOutOfLastColumn) completedAt = null;
        if (isMovingToNonFirstColumn && !(task as any).started_at) startedAt = now;
        const updates = ['column_id = ?', 'order_index = COALESCE(?, order_index)', 'updated_at = ?'];
        const params: any[] = [column_id, order_index, now];
        if (completedAt !== undefined) {
          updates.push('completed_at = ?');
          params.push(completedAt);
        }
        if (startedAt !== undefined) {
          updates.push('started_at = ?');
          params.push(startedAt);
        }
        params.push(req.params.taskId);
        await dbRun(
          `UPDATE project_tasks SET ${updates.join(', ')} WHERE id = ?`,
          params
        );
      } else if (order_index !== undefined) {
        await dbRun(
          'UPDATE project_tasks SET order_index = ?, updated_at = ? WHERE id = ?',
          [order_index, now, req.params.taskId]
        );
      } else {
        return res.status(400).json({ error: 'Informe column_id e/ou order_index' });
      }
      const updated = await dbGet(
        `SELECT pt.*, u.name as assigned_to_name, cu.name as created_by_name
         FROM project_tasks pt
         LEFT JOIN users u ON pt.assigned_to = u.id
         LEFT JOIN users cu ON pt.created_by = cu.id
         WHERE pt.id = ?`,
        [req.params.taskId]
      );
      res.json(updated);
    } catch (error) {
      console.error('Erro ao mover tarefa:', error);
      res.status(500).json({ error: 'Erro ao mover tarefa' });
    }
  }
);

// Atualizar tarefa (título, descrição, prioridade, responsável)
router.put(
  '/:id/tasks/:taskId',
  [
    authenticate,
    requirePermission(RESOURCES.PROJECTS, ACTIONS.EDIT),
    param('id').isInt(),
    param('taskId').isInt(),
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const task = await dbGet(
        'SELECT id FROM project_tasks WHERE id = ? AND project_id = ?',
        [req.params.taskId, req.params.id]
      );
      if (!task) {
        return res.status(404).json({ error: 'Tarefa não encontrada' });
      }
      const { title, description, priority, assigned_to, sprint_id, story_points, due_date, task_type } = req.body;
      const now = getBrasiliaTimestamp();
      const updates: string[] = ['updated_at = ?'];
      const params: any[] = [now];
      if (title !== undefined) {
        updates.push('title = ?');
        params.push(title);
      }
      if (description !== undefined) {
        updates.push('description = ?');
        params.push(description);
      }
      if (priority !== undefined && ['low', 'medium', 'high', 'urgent'].includes(priority)) {
        updates.push('priority = ?');
        params.push(priority);
      }
      if (task_type !== undefined && ['feature', 'bug', 'tech_debt', 'chore'].includes(task_type)) {
        updates.push('task_type = ?');
        params.push(task_type);
      }
      if (assigned_to !== undefined) {
        updates.push('assigned_to = ?');
        params.push(assigned_to || null);
      }
      if (sprint_id !== undefined) {
        let sid = sprint_id && Number(sprint_id) > 0 ? sprint_id : null;
        if (sid) {
          const sprintBelongs = await dbGet(
            'SELECT id FROM project_sprints WHERE id = ? AND project_id = ?',
            [sid, req.params.id]
          );
          if (!sprintBelongs) sid = null;
        }
        updates.push('sprint_id = ?');
        params.push(sid);
      }
      if (story_points !== undefined) {
        updates.push('story_points = ?');
        params.push(story_points === '' || story_points == null ? null : Number(story_points));
      }
      if (due_date !== undefined) {
        updates.push('due_date = ?');
        params.push(due_date || null);
      }
      params.push(req.params.taskId);
      await dbRun(
        `UPDATE project_tasks SET ${updates.join(', ')} WHERE id = ?`,
        params
      );
      const updated = await dbGet(
        `SELECT pt.*, u.name as assigned_to_name, cu.name as created_by_name, ps.name as sprint_name
         FROM project_tasks pt
         LEFT JOIN users u ON pt.assigned_to = u.id
         LEFT JOIN users cu ON pt.created_by = cu.id
         LEFT JOIN project_sprints ps ON pt.sprint_id = ps.id
         WHERE pt.id = ?`,
        [req.params.taskId]
      );
      res.json(updated);
    } catch (error) {
      console.error('Erro ao atualizar tarefa:', error);
      res.status(500).json({ error: 'Erro ao atualizar tarefa' });
    }
  }
);

// Excluir tarefa
router.delete(
  '/:id/tasks/:taskId',
  authenticate,
  requirePermission(RESOURCES.PROJECTS, ACTIONS.DELETE),
  async (req: AuthRequest, res: Response) => {
    try {
      const task = await dbGet(
        'SELECT id FROM project_tasks WHERE id = ? AND project_id = ?',
        [req.params.taskId, req.params.id]
      );
      if (!task) {
        return res.status(404).json({ error: 'Tarefa não encontrada' });
      }
      await dbRun('DELETE FROM project_tasks WHERE id = ?', [req.params.taskId]);
      res.status(204).send();
    } catch (error) {
      console.error('Erro ao excluir tarefa:', error);
      res.status(500).json({ error: 'Erro ao excluir tarefa' });
    }
  }
);

const ensureTaskBelongsToProject = async (projectId: string, taskId: string) => {
  const task = await dbGet(
    'SELECT id FROM project_tasks WHERE id = ? AND project_id = ?',
    [taskId, projectId]
  );
  return task;
};

// --- Subtarefas ---
router.get(
  '/:id/tasks/:taskId/subtasks',
  authenticate,
  requirePermission(RESOURCES.PROJECTS, ACTIONS.VIEW),
  async (req: AuthRequest, res: Response) => {
    try {
      const task = await ensureTaskBelongsToProject(req.params.id, req.params.taskId);
      if (!task) return res.status(404).json({ error: 'Tarefa não encontrada' });
      const rows = await dbAll(
        'SELECT * FROM project_task_subtasks WHERE task_id = ? ORDER BY order_index, id',
        [req.params.taskId]
      );
      res.json(rows);
    } catch (error) {
      console.error('Erro ao listar subtarefas:', error);
      res.status(500).json({ error: 'Erro ao buscar subtarefas' });
    }
  }
);

router.post(
  '/:id/tasks/:taskId/subtasks',
  [
    authenticate,
    requirePermission(RESOURCES.PROJECTS, ACTIONS.CREATE),
    param('id').isInt(),
    param('taskId').isInt(),
    body('title').notEmpty().withMessage('Título é obrigatório'),
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
      const task = await ensureTaskBelongsToProject(req.params.id, req.params.taskId);
      if (!task) return res.status(404).json({ error: 'Tarefa não encontrada' });
      const maxOrder = await dbGet(
        'SELECT COALESCE(MAX(order_index), -1) + 1 as next_index FROM project_task_subtasks WHERE task_id = ?',
        [req.params.taskId]
      );
      const orderIndex = (maxOrder as any)?.next_index ?? 0;
      const result = await dbRun(
        'INSERT INTO project_task_subtasks (task_id, title, completed, order_index) VALUES (?, ?, 0, ?)',
        [req.params.taskId, req.body.title.trim(), orderIndex]
      );
      const row = await dbGet('SELECT * FROM project_task_subtasks WHERE id = ?', [(result as any).lastID]);
      res.status(201).json(row);
    } catch (error) {
      console.error('Erro ao criar subtarefa:', error);
      res.status(500).json({ error: 'Erro ao criar subtarefa' });
    }
  }
);

router.patch(
  '/:id/tasks/:taskId/subtasks/:subtaskId',
  [
    authenticate,
    requirePermission(RESOURCES.PROJECTS, ACTIONS.EDIT),
    param('id').isInt(),
    param('taskId').isInt(),
    param('subtaskId').isInt(),
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const task = await ensureTaskBelongsToProject(req.params.id, req.params.taskId);
      if (!task) return res.status(404).json({ error: 'Tarefa não encontrada' });
      const subtask = await dbGet(
        'SELECT id FROM project_task_subtasks WHERE id = ? AND task_id = ?',
        [req.params.subtaskId, req.params.taskId]
      );
      if (!subtask) return res.status(404).json({ error: 'Subtarefa não encontrada' });
      const { title, completed } = req.body;
      const updates: string[] = [];
      const params: any[] = [];
      if (title !== undefined) {
        updates.push('title = ?');
        params.push(title.trim());
      }
      if (completed !== undefined) {
        updates.push('completed = ?');
        params.push(completed ? 1 : 0);
      }
      if (updates.length === 0) return res.status(400).json({ error: 'Nenhum campo para atualizar' });
      params.push(req.params.subtaskId);
      await dbRun(`UPDATE project_task_subtasks SET ${updates.join(', ')} WHERE id = ?`, params);
      const row = await dbGet('SELECT * FROM project_task_subtasks WHERE id = ?', [req.params.subtaskId]);
      res.json(row);
    } catch (error) {
      console.error('Erro ao atualizar subtarefa:', error);
      res.status(500).json({ error: 'Erro ao atualizar subtarefa' });
    }
  }
);

router.delete(
  '/:id/tasks/:taskId/subtasks/:subtaskId',
  authenticate,
  requirePermission(RESOURCES.PROJECTS, ACTIONS.DELETE),
  async (req: AuthRequest, res: Response) => {
    try {
      const task = await ensureTaskBelongsToProject(req.params.id, req.params.taskId);
      if (!task) return res.status(404).json({ error: 'Tarefa não encontrada' });
      const subtask = await dbGet(
        'SELECT id FROM project_task_subtasks WHERE id = ? AND task_id = ?',
        [req.params.subtaskId, req.params.taskId]
      );
      if (!subtask) return res.status(404).json({ error: 'Subtarefa não encontrada' });
      await dbRun('DELETE FROM project_task_subtasks WHERE id = ?', [req.params.subtaskId]);
      res.status(204).send();
    } catch (error) {
      console.error('Erro ao excluir subtarefa:', error);
      res.status(500).json({ error: 'Erro ao excluir subtarefa' });
    }
  }
);

// --- Definição de Pronto (DoD) ---
router.get(
  '/:id/tasks/:taskId/dod',
  authenticate,
  requirePermission(RESOURCES.PROJECTS, ACTIONS.VIEW),
  async (req: AuthRequest, res: Response) => {
    try {
      const task = await ensureTaskBelongsToProject(req.params.id, req.params.taskId);
      if (!task) return res.status(404).json({ error: 'Tarefa não encontrada' });
      const rows = await dbAll(
        'SELECT * FROM project_task_dod WHERE task_id = ? ORDER BY order_index, id',
        [req.params.taskId]
      );
      res.json(rows);
    } catch (error) {
      console.error('Erro ao listar DoD:', error);
      res.status(500).json({ error: 'Erro ao buscar definição de pronto' });
    }
  }
);

router.post(
  '/:id/tasks/:taskId/dod',
  [
    authenticate,
    requirePermission(RESOURCES.PROJECTS, ACTIONS.CREATE),
    param('id').isInt(),
    param('taskId').isInt(),
    body('label').notEmpty().withMessage('Item é obrigatório'),
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
      const task = await ensureTaskBelongsToProject(req.params.id, req.params.taskId);
      if (!task) return res.status(404).json({ error: 'Tarefa não encontrada' });
      const maxOrder = await dbGet(
        'SELECT COALESCE(MAX(order_index), -1) + 1 as next_index FROM project_task_dod WHERE task_id = ?',
        [req.params.taskId]
      );
      const orderIndex = (maxOrder as any)?.next_index ?? 0;
      const result = await dbRun(
        'INSERT INTO project_task_dod (task_id, label, checked, order_index) VALUES (?, ?, 0, ?)',
        [req.params.taskId, req.body.label.trim(), orderIndex]
      );
      const row = await dbGet('SELECT * FROM project_task_dod WHERE id = ?', [(result as any).lastID]);
      res.status(201).json(row);
    } catch (error) {
      console.error('Erro ao criar item DoD:', error);
      res.status(500).json({ error: 'Erro ao criar item' });
    }
  }
);

router.patch(
  '/:id/tasks/:taskId/dod/:dodId',
  [
    authenticate,
    requirePermission(RESOURCES.PROJECTS, ACTIONS.EDIT),
    param('id').isInt(),
    param('taskId').isInt(),
    param('dodId').isInt(),
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const task = await ensureTaskBelongsToProject(req.params.id, req.params.taskId);
      if (!task) return res.status(404).json({ error: 'Tarefa não encontrada' });
      const dod = await dbGet(
        'SELECT id FROM project_task_dod WHERE id = ? AND task_id = ?',
        [req.params.dodId, req.params.taskId]
      );
      if (!dod) return res.status(404).json({ error: 'Item não encontrado' });
      const { label, checked } = req.body;
      const updates: string[] = [];
      const params: any[] = [];
      if (label !== undefined) {
        updates.push('label = ?');
        params.push(label.trim());
      }
      if (checked !== undefined) {
        updates.push('checked = ?');
        params.push(checked ? 1 : 0);
      }
      if (updates.length === 0) return res.status(400).json({ error: 'Nenhum campo para atualizar' });
      params.push(req.params.dodId);
      await dbRun(`UPDATE project_task_dod SET ${updates.join(', ')} WHERE id = ?`, params);
      const row = await dbGet('SELECT * FROM project_task_dod WHERE id = ?', [req.params.dodId]);
      res.json(row);
    } catch (error) {
      console.error('Erro ao atualizar DoD:', error);
      res.status(500).json({ error: 'Erro ao atualizar item' });
    }
  }
);

router.delete(
  '/:id/tasks/:taskId/dod/:dodId',
  authenticate,
  requirePermission(RESOURCES.PROJECTS, ACTIONS.DELETE),
  async (req: AuthRequest, res: Response) => {
    try {
      const task = await ensureTaskBelongsToProject(req.params.id, req.params.taskId);
      if (!task) return res.status(404).json({ error: 'Tarefa não encontrada' });
      const dod = await dbGet(
        'SELECT id FROM project_task_dod WHERE id = ? AND task_id = ?',
        [req.params.dodId, req.params.taskId]
      );
      if (!dod) return res.status(404).json({ error: 'Item não encontrado' });
      await dbRun('DELETE FROM project_task_dod WHERE id = ?', [req.params.dodId]);
      res.status(204).send();
    } catch (error) {
      console.error('Erro ao excluir item DoD:', error);
      res.status(500).json({ error: 'Erro ao excluir item' });
    }
  }
);

// --- Comentários na tarefa ---
router.get(
  '/:id/tasks/:taskId/comments',
  authenticate,
  requirePermission(RESOURCES.PROJECTS, ACTIONS.VIEW),
  async (req: AuthRequest, res: Response) => {
    try {
      const task = await ensureTaskBelongsToProject(req.params.id, req.params.taskId);
      if (!task) return res.status(404).json({ error: 'Tarefa não encontrada' });
      const rows = await dbAll(
        `SELECT c.*, u.name as user_name FROM project_task_comments c
         JOIN users u ON c.user_id = u.id WHERE c.task_id = ? ORDER BY c.created_at ASC`,
        [req.params.taskId]
      );
      res.json(rows);
    } catch (error) {
      console.error('Erro ao listar comentários:', error);
      res.status(500).json({ error: 'Erro ao buscar comentários' });
    }
  }
);

router.post(
  '/:id/tasks/:taskId/comments',
  [
    authenticate,
    requirePermission(RESOURCES.PROJECTS, ACTIONS.CREATE),
    param('id').isInt(),
    param('taskId').isInt(),
    body('message').notEmpty().withMessage('Mensagem é obrigatória'),
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
      const task = await ensureTaskBelongsToProject(req.params.id, req.params.taskId);
      if (!task) return res.status(404).json({ error: 'Tarefa não encontrada' });
      const result = await dbRun(
        'INSERT INTO project_task_comments (task_id, user_id, message) VALUES (?, ?, ?)',
        [req.params.taskId, req.userId, req.body.message.trim()]
      );
      const row = await dbGet(
        `SELECT c.*, u.name as user_name FROM project_task_comments c
         JOIN users u ON c.user_id = u.id WHERE c.id = ?`,
        [(result as any).lastID]
      );
      res.status(201).json(row);
    } catch (error) {
      console.error('Erro ao criar comentário:', error);
      res.status(500).json({ error: 'Erro ao criar comentário' });
    }
  }
);

// --- Registro de horas (Time tracking) ---
router.get(
  '/:id/tasks/:taskId/time-entries',
  authenticate,
  requirePermission(RESOURCES.PROJECTS, ACTIONS.VIEW),
  async (req: AuthRequest, res: Response) => {
    try {
      const task = await ensureTaskBelongsToProject(req.params.id, req.params.taskId);
      if (!task) return res.status(404).json({ error: 'Tarefa não encontrada' });
      const rows = await dbAll(
        `SELECT t.*, u.name as user_name FROM project_task_time_entries t
         JOIN users u ON t.user_id = u.id WHERE t.task_id = ? ORDER BY t.entry_date DESC, t.id DESC`,
        [req.params.taskId]
      );
      res.json(rows);
    } catch (error) {
      console.error('Erro ao listar registro de horas:', error);
      res.status(500).json({ error: 'Erro ao buscar registro de horas' });
    }
  }
);

router.post(
  '/:id/tasks/:taskId/time-entries',
  [
    authenticate,
    requirePermission(RESOURCES.PROJECTS, ACTIONS.CREATE),
    param('id').isInt(),
    param('taskId').isInt(),
    body('hours').isFloat({ min: 0.01 }).withMessage('Horas inválidas'),
    body('entry_date').notEmpty().withMessage('Data é obrigatória'),
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
      const task = await ensureTaskBelongsToProject(req.params.id, req.params.taskId);
      if (!task) return res.status(404).json({ error: 'Tarefa não encontrada' });
      const result = await dbRun(
        'INSERT INTO project_task_time_entries (task_id, user_id, hours, entry_date, note) VALUES (?, ?, ?, ?, ?)',
        [req.params.taskId, req.userId, Number(req.body.hours), req.body.entry_date, req.body.note?.trim() || null]
      );
      const row = await dbGet(
        `SELECT t.*, u.name as user_name FROM project_task_time_entries t
         JOIN users u ON t.user_id = u.id WHERE t.id = ?`,
        [(result as any).lastID]
      );
      res.status(201).json(row);
    } catch (error) {
      console.error('Erro ao registrar horas:', error);
      res.status(500).json({ error: 'Erro ao registrar horas' });
    }
  }
);

router.delete(
  '/:id/tasks/:taskId/time-entries/:entryId',
  authenticate,
  requirePermission(RESOURCES.PROJECTS, ACTIONS.DELETE),
  async (req: AuthRequest, res: Response) => {
    try {
      const task = await ensureTaskBelongsToProject(req.params.id, req.params.taskId);
      if (!task) return res.status(404).json({ error: 'Tarefa não encontrada' });
      const entry = await dbGet(
        'SELECT id FROM project_task_time_entries WHERE id = ? AND task_id = ?',
        [req.params.entryId, req.params.taskId]
      );
      if (!entry) return res.status(404).json({ error: 'Registro não encontrado' });
      await dbRun('DELETE FROM project_task_time_entries WHERE id = ?', [req.params.entryId]);
      res.status(204).send();
    } catch (error) {
      console.error('Erro ao excluir registro de horas:', error);
      res.status(500).json({ error: 'Erro ao excluir registro' });
    }
  }
);

// --- Anexos da tarefa ---
router.get(
  '/:id/tasks/:taskId/attachments',
  authenticate,
  requirePermission(RESOURCES.PROJECTS, ACTIONS.VIEW),
  async (req: AuthRequest, res: Response) => {
    try {
      const task = await ensureTaskBelongsToProject(req.params.id, req.params.taskId);
      if (!task) return res.status(404).json({ error: 'Tarefa não encontrada' });
      const rows = await dbAll(
        `SELECT a.*, u.name as user_name FROM project_task_attachments a
         JOIN users u ON a.user_id = u.id WHERE a.task_id = ? ORDER BY a.created_at DESC`,
        [req.params.taskId]
      );
      res.json(rows);
    } catch (error) {
      console.error('Erro ao listar anexos:', error);
      res.status(500).json({ error: 'Erro ao buscar anexos' });
    }
  }
);

router.post(
  '/:id/tasks/:taskId/attachments',
  authenticate,
  requirePermission(RESOURCES.PROJECTS, ACTIONS.EDIT),
  (req: AuthRequest, res: Response, next: express.NextFunction) => {
    uploadProjectTaskAttachment.single('file')(req, res, (err: any) => {
      if (err) return res.status(400).json({ error: err.message || 'Erro no upload' });
      next();
    });
  },
  async (req: AuthRequest, res: Response) => {
    try {
      const task = await ensureTaskBelongsToProject(req.params.id, req.params.taskId);
      if (!task) return res.status(404).json({ error: 'Tarefa não encontrada' });
      const file = req.file;
      if (!file) return res.status(400).json({ error: 'Nenhum ficheiro enviado' });
      const filePath = path.join('project-tasks', path.basename(file.path));
      const result = await dbRun(
        'INSERT INTO project_task_attachments (task_id, user_id, file_name, file_path, file_size, mime_type) VALUES (?, ?, ?, ?, ?, ?)',
        [req.params.taskId, req.userId, file.originalname, filePath, file.size, file.mimetype || null]
      );
      const row = await dbGet(
        `SELECT a.*, u.name as user_name FROM project_task_attachments a
         JOIN users u ON a.user_id = u.id WHERE a.id = ?`,
        [(result as any).lastID ?? (result as any).insertId]
      );
      res.status(201).json(row);
    } catch (error) {
      console.error('Erro ao anexar ficheiro:', error);
      res.status(500).json({ error: 'Erro ao anexar ficheiro' });
    }
  }
);

router.get(
  '/:id/tasks/:taskId/attachments/:attachmentId/download',
  authenticate,
  requirePermission(RESOURCES.PROJECTS, ACTIONS.VIEW),
  async (req: AuthRequest, res: Response) => {
    try {
      const task = await ensureTaskBelongsToProject(req.params.id, req.params.taskId);
      if (!task) return res.status(404).json({ error: 'Tarefa não encontrada' });
      const att = await dbGet(
        'SELECT * FROM project_task_attachments WHERE id = ? AND task_id = ?',
        [req.params.attachmentId, req.params.taskId]
      );
      if (!att) return res.status(404).json({ error: 'Anexo não encontrado' });
      const fullPath = path.join(process.cwd(), 'uploads', (att as any).file_path);
      if (!fs.existsSync(fullPath)) return res.status(404).json({ error: 'Ficheiro não encontrado no servidor' });
      res.download(fullPath, (att as any).file_name);
    } catch (error) {
      console.error('Erro ao transferir anexo:', error);
      res.status(500).json({ error: 'Erro ao transferir ficheiro' });
    }
  }
);

router.delete(
  '/:id/tasks/:taskId/attachments/:attachmentId',
  authenticate,
  requirePermission(RESOURCES.PROJECTS, ACTIONS.DELETE),
  async (req: AuthRequest, res: Response) => {
    try {
      const task = await ensureTaskBelongsToProject(req.params.id, req.params.taskId);
      if (!task) return res.status(404).json({ error: 'Tarefa não encontrada' });
      const att = await dbGet(
        'SELECT * FROM project_task_attachments WHERE id = ? AND task_id = ?',
        [req.params.attachmentId, req.params.taskId]
      );
      if (!att) return res.status(404).json({ error: 'Anexo não encontrado' });
      const fullPath = path.join(process.cwd(), 'uploads', (att as any).file_path);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
      await dbRun('DELETE FROM project_task_attachments WHERE id = ?', [req.params.attachmentId]);
      res.status(204).send();
    } catch (error) {
      console.error('Erro ao excluir anexo:', error);
      res.status(500).json({ error: 'Erro ao excluir anexo' });
    }
  }
);

// --- Dependências entre tarefas ---
router.get(
  '/:id/tasks/:taskId/dependencies',
  authenticate,
  requirePermission(RESOURCES.PROJECTS, ACTIONS.VIEW),
  async (req: AuthRequest, res: Response) => {
    try {
      const task = await ensureTaskBelongsToProject(req.params.id, req.params.taskId);
      if (!task) return res.status(404).json({ error: 'Tarefa não encontrada' });
      const dependsOn = await dbAll(
        'SELECT depends_on_task_id FROM project_task_dependencies WHERE task_id = ?',
        [req.params.taskId]
      );
      const blockedBy = await dbAll(
        'SELECT task_id FROM project_task_dependencies WHERE depends_on_task_id = ?',
        [req.params.taskId]
      );
      res.json({
        depends_on: (dependsOn as any[]).map((r) => r.depends_on_task_id),
        blocked_by: (blockedBy as any[]).map((r) => r.task_id),
      });
    } catch (error) {
      console.error('Erro ao listar dependências:', error);
      res.status(500).json({ error: 'Erro ao buscar dependências' });
    }
  }
);

router.post(
  '/:id/tasks/:taskId/dependencies',
  authenticate,
  requirePermission(RESOURCES.PROJECTS, ACTIONS.EDIT),
  async (req: AuthRequest, res: Response) => {
    try {
      const task = await ensureTaskBelongsToProject(req.params.id, req.params.taskId);
      if (!task) return res.status(404).json({ error: 'Tarefa não encontrada' });
      const dependsOnTaskId = req.body.depends_on_task_id != null ? Number(req.body.depends_on_task_id) : null;
      if (!dependsOnTaskId || dependsOnTaskId === Number(req.params.taskId)) {
        return res.status(400).json({ error: 'Tarefa de dependência inválida' });
      }
      const other = await ensureTaskBelongsToProject(req.params.id, String(dependsOnTaskId));
      if (!other) return res.status(404).json({ error: 'Tarefa de dependência não encontrada' });
      const reverse = await dbGet(
        'SELECT 1 FROM project_task_dependencies WHERE task_id = ? AND depends_on_task_id = ?',
        [dependsOnTaskId, req.params.taskId]
      );
      if (reverse) return res.status(400).json({ error: 'Não é possível criar dependência circular' });
      const existing = await dbGet(
        'SELECT 1 FROM project_task_dependencies WHERE task_id = ? AND depends_on_task_id = ?',
        [req.params.taskId, dependsOnTaskId]
      );
      if (existing) return res.status(400).json({ error: 'Dependência já existe' });
      await dbRun(
        'INSERT INTO project_task_dependencies (task_id, depends_on_task_id) VALUES (?, ?)',
        [req.params.taskId, dependsOnTaskId]
      );
      res.status(201).json({ depends_on_task_id: dependsOnTaskId });
    } catch (error) {
      console.error('Erro ao criar dependência:', error);
      res.status(500).json({ error: 'Erro ao criar dependência' });
    }
  }
);

router.delete(
  '/:id/tasks/:taskId/dependencies/:dependsOnTaskId',
  authenticate,
  requirePermission(RESOURCES.PROJECTS, ACTIONS.EDIT),
  async (req: AuthRequest, res: Response) => {
    try {
      const task = await ensureTaskBelongsToProject(req.params.id, req.params.taskId);
      if (!task) return res.status(404).json({ error: 'Tarefa não encontrada' });
      await dbRun(
        'DELETE FROM project_task_dependencies WHERE task_id = ? AND depends_on_task_id = ?',
        [req.params.taskId, req.params.dependsOnTaskId]
      );
      res.status(204).send();
    } catch (error) {
      console.error('Erro ao remover dependência:', error);
      res.status(500).json({ error: 'Erro ao remover dependência' });
    }
  }
);

export default router;