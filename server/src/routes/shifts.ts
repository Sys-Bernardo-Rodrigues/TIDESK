import express, { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { dbRun, dbGet, dbAll, getBrasiliaTimestamp } from '../database';
import { authenticate } from '../middleware/auth';
import { requirePermission, RESOURCES, ACTIONS } from '../middleware/permissions';

const router = express.Router();

interface AuthRequest extends Request {
  userId?: number;
  userRole?: string;
}

// Listar plantões
router.get('/', authenticate, requirePermission(RESOURCES.AGENDA, ACTIONS.VIEW), async (req: AuthRequest, res: Response) => {
  try {
    const { start, end } = req.query;
    
    let query = `
      SELECT DISTINCT s.*, 
             u.name as created_by_name
      FROM shifts s
      LEFT JOIN users u ON s.created_by = u.id
    `;
    
    const params: any[] = [];
    const conditions: string[] = [];
    
    // Filtrar por período se fornecido
    if (start && end) {
      conditions.push('(s.start_time >= ? AND s.start_time <= ?) OR (s.end_time >= ? AND s.end_time <= ?)');
      params.push(start, end, start, end);
    }
    
    // Usuários só veem plantões onde estão vinculados ou que criaram
    if (req.userRole === 'user') {
      query += ` LEFT JOIN shift_users su ON s.id = su.shift_id`;
      conditions.push(`(s.created_by = ? OR su.user_id = ?)`);
      params.push(req.userId, req.userId);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY s.start_time ASC';
    
    const shifts = await dbAll(query, params);
    
    // Buscar usuários vinculados para cada plantão
    const formattedShifts = await Promise.all(shifts.map(async (shift: any) => {
      const shiftUsers = await dbAll(`
        SELECT su.user_id, u.name
        FROM shift_users su
        JOIN users u ON su.user_id = u.id
        WHERE su.shift_id = ?
      `, [shift.id]);
      
      return {
        ...shift,
        user_ids: shiftUsers.map((su: any) => su.user_id),
        user_names: shiftUsers.map((su: any) => su.name)
      };
    }));
    
    res.json(formattedShifts);
  } catch (error) {
    console.error('Erro ao listar plantões:', error);
    res.status(500).json({ error: 'Erro ao buscar plantões' });
  }
});

// Relatório de horas por mês (deve vir antes de /:id)
router.get('/report/monthly', authenticate, requirePermission(RESOURCES.AGENDA, ACTIONS.VIEW), async (req: AuthRequest, res: Response) => {
  try {
    const { year, month } = req.query;
    
    if (!year || !month) {
      return res.status(400).json({ error: 'Ano e mês são obrigatórios' });
    }
    
    const yearNum = parseInt(year as string);
    const monthNum = parseInt(month as string);
    
    // Calcular início e fim do mês
    const startDate = new Date(yearNum, monthNum - 1, 1);
    const endDate = new Date(yearNum, monthNum, 0, 23, 59, 59);
    
    const startStr = startDate.toISOString().split('T')[0] + 'T00:00:00';
    const endStr = endDate.toISOString().split('T')[0] + 'T23:59:59';
    
    // Buscar todos os plantões do mês
    let query = `
      SELECT s.*, 
             u.name as created_by_name
      FROM shifts s
      LEFT JOIN users u ON s.created_by = u.id
      WHERE (s.start_time >= ? AND s.start_time <= ?) 
         OR (s.end_time >= ? AND s.end_time <= ?)
         OR (s.start_time <= ? AND s.end_time >= ?)
    `;
    
    const params = [startStr, endStr, startStr, endStr, startStr, endStr];
    
    // Usuários só veem plantões onde estão vinculados ou que criaram
    if (req.userRole === 'user' && req.userId) {
      query += ` AND (s.created_by = ? OR EXISTS (
        SELECT 1 FROM shift_users su WHERE su.shift_id = s.id AND su.user_id = ?
      ))`;
      params.push(req.userId.toString(), req.userId.toString());
    }
    
    query += ' ORDER BY s.start_time ASC';
    
    const shifts = await dbAll(query, params);
    
    // Buscar usuários vinculados e calcular horas
    const userHoursMap = new Map<number, { name: string; email: string; totalHours: number; shifts: any[] }>();
    
    for (const shift of shifts) {
      const shiftUsers = await dbAll(`
        SELECT su.user_id, u.name, u.email
        FROM shift_users su
        JOIN users u ON su.user_id = u.id
        WHERE su.shift_id = ?
      `, [shift.id]);
      
      // Calcular horas do plantão
      const startTime = new Date(shift.start_time);
      const endTime = new Date(shift.end_time);
      const hoursDiff = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
      
      for (const shiftUser of shiftUsers) {
        const userId = shiftUser.user_id;
        
        if (!userHoursMap.has(userId)) {
          userHoursMap.set(userId, {
            name: shiftUser.name,
            email: shiftUser.email,
            totalHours: 0,
            shifts: []
          });
        }
        
        const userData = userHoursMap.get(userId)!;
        userData.totalHours += hoursDiff;
        userData.shifts.push({
          id: shift.id,
          title: shift.title,
          start_time: shift.start_time,
          end_time: shift.end_time,
          hours: hoursDiff
        });
      }
    }
    
    // Converter para array e ordenar por horas
    const reportData = Array.from(userHoursMap.values())
      .map(user => ({
        ...user,
        totalHours: Math.round(user.totalHours * 100) / 100, // Arredondar para 2 casas decimais
        shiftsCount: user.shifts.length
      }))
      .sort((a, b) => b.totalHours - a.totalHours);
    
    res.json({
      year: yearNum,
      month: monthNum,
      monthName: new Date(yearNum, monthNum - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
      totalShifts: shifts.length,
      users: reportData
    });
  } catch (error) {
    console.error('Erro ao gerar relatório:', error);
    res.status(500).json({ error: 'Erro ao gerar relatório' });
  }
});

// Criar plantão
router.post('/', authenticate, requirePermission(RESOURCES.AGENDA, ACTIONS.CREATE), [
  body('start_time').notEmpty().withMessage('Data/hora de início é obrigatória'),
  body('end_time').notEmpty().withMessage('Data/hora de término é obrigatória'),
  body('user_ids').notEmpty().withMessage('É necessário selecionar pelo menos um usuário'),
  body('user_ids').isArray().withMessage('IDs de usuários devem ser um array')
], async (req: AuthRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { title, start_time, end_time, user_ids } = req.body;
    
    // Validar que pelo menos um usuário foi selecionado
    if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
      return res.status(400).json({ error: 'É necessário selecionar pelo menos um usuário para o plantão' });
    }
    
    // Criar plantão
    const result = await dbRun(
      `INSERT INTO shifts (title, start_time, end_time, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        title || null,
        start_time,
        end_time,
        req.userId,
        getBrasiliaTimestamp(),
        getBrasiliaTimestamp()
      ]
    );
    
    const shiftId = (result as any).lastID || (result as any).id;
    
    // Vincular usuários ao plantão
    for (const userId of user_ids) {
      try {
        await dbRun(
          'INSERT INTO shift_users (shift_id, user_id, created_at) VALUES (?, ?, ?)',
          [shiftId, userId, getBrasiliaTimestamp()]
        );
      } catch (error) {
        // Ignorar erros de duplicata
      }
    }
    
    // Buscar plantão criado
    const shift = await dbGet(`
      SELECT s.*, 
             u.name as created_by_name
      FROM shifts s
      LEFT JOIN users u ON s.created_by = u.id
      WHERE s.id = ?
    `, [shiftId]);
    
    // Buscar usuários vinculados
    const shiftUsers = await dbAll(`
      SELECT su.user_id, u.name
      FROM shift_users su
      JOIN users u ON su.user_id = u.id
      WHERE su.shift_id = ?
    `, [shiftId]);
    
    const formattedShift = {
      ...shift,
      user_ids: shiftUsers.map((su: any) => su.user_id),
      user_names: shiftUsers.map((su: any) => su.name)
    };
    
    res.status(201).json(formattedShift);
  } catch (error) {
    console.error('Erro ao criar plantão:', error);
    res.status(500).json({ error: 'Erro ao criar plantão' });
  }
});

// Atualizar plantão
router.put('/:id', authenticate, requirePermission(RESOURCES.AGENDA, ACTIONS.EDIT), [
  body('start_time').optional().notEmpty().withMessage('Data/hora de início é obrigatória'),
  body('end_time').optional().notEmpty().withMessage('Data/hora de término é obrigatória'),
  body('user_ids').optional().isArray().withMessage('IDs de usuários devem ser um array')
], async (req: AuthRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const shiftId = parseInt(req.params.id);
    const { title, start_time, end_time, user_ids } = req.body;
    
    // Verificar se o plantão existe e se o usuário tem permissão
    const shift = await dbGet('SELECT * FROM shifts WHERE id = ?', [shiftId]);
    if (!shift) {
      return res.status(404).json({ error: 'Plantão não encontrado' });
    }
    
    // Verificar se o usuário criou o plantão ou é admin
    if (shift.created_by !== req.userId && req.userRole !== 'admin') {
      return res.status(403).json({ error: 'Sem permissão para editar este plantão' });
    }
    
    // Atualizar plantão
    const updateFields: string[] = [];
    const updateParams: any[] = [];
    
    if (title !== undefined) {
      updateFields.push('title = ?');
      updateParams.push(title);
    }
    if (start_time !== undefined) {
      updateFields.push('start_time = ?');
      updateParams.push(start_time);
    }
    if (end_time !== undefined) {
      updateFields.push('end_time = ?');
      updateParams.push(end_time);
    }
    
    updateFields.push('updated_at = ?');
    updateParams.push(getBrasiliaTimestamp());
    updateParams.push(shiftId);
    
    await dbRun(
      `UPDATE shifts SET ${updateFields.join(', ')} WHERE id = ?`,
      updateParams
    );
    
    // Atualizar usuários vinculados se fornecido
    if (user_ids !== undefined) {
      // Validar que pelo menos um usuário foi selecionado
      if (!Array.isArray(user_ids) || user_ids.length === 0) {
        return res.status(400).json({ error: 'É necessário selecionar pelo menos um usuário para o plantão' });
      }
      
      // Remover vínculos existentes
      await dbRun('DELETE FROM shift_users WHERE shift_id = ?', [shiftId]);
      
      // Adicionar novos vínculos
      for (const userId of user_ids) {
        try {
          await dbRun(
            'INSERT INTO shift_users (shift_id, user_id, created_at) VALUES (?, ?, ?)',
            [shiftId, userId, getBrasiliaTimestamp()]
          );
        } catch (error) {
          // Ignorar erros de duplicata
        }
      }
    }
    
    // Buscar plantão atualizado
    const updatedShift = await dbGet(`
      SELECT s.*, 
             u.name as created_by_name
      FROM shifts s
      LEFT JOIN users u ON s.created_by = u.id
      WHERE s.id = ?
    `, [shiftId]);
    
    // Buscar usuários vinculados
    const shiftUsers = await dbAll(`
      SELECT su.user_id, u.name
      FROM shift_users su
      JOIN users u ON su.user_id = u.id
      WHERE su.shift_id = ?
    `, [shiftId]);
    
    const formattedShift = {
      ...updatedShift,
      user_ids: shiftUsers.map((su: any) => su.user_id),
      user_names: shiftUsers.map((su: any) => su.name)
    };
    
    res.json(formattedShift);
  } catch (error) {
    console.error('Erro ao atualizar plantão:', error);
    res.status(500).json({ error: 'Erro ao atualizar plantão' });
  }
});

// Deletar plantão
router.delete('/:id', authenticate, requirePermission(RESOURCES.AGENDA, ACTIONS.DELETE), async (req: AuthRequest, res: Response) => {
  try {
    const shiftId = parseInt(req.params.id);
    
    // Verificar se o plantão existe e se o usuário tem permissão
    const shift = await dbGet('SELECT * FROM shifts WHERE id = ?', [shiftId]);
    if (!shift) {
      return res.status(404).json({ error: 'Plantão não encontrado' });
    }
    
    // Verificar se o usuário criou o plantão ou é admin
    if (shift.created_by !== req.userId && req.userRole !== 'admin') {
      return res.status(403).json({ error: 'Sem permissão para deletar este plantão' });
    }
    
    // Deletar plantão (cascade vai deletar shift_users automaticamente)
    await dbRun('DELETE FROM shifts WHERE id = ?', [shiftId]);
    
    res.json({ message: 'Plantão deletado com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar plantão:', error);
    res.status(500).json({ error: 'Erro ao deletar plantão' });
  }
});

export default router;
