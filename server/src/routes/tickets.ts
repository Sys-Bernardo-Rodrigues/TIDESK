import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, AuthRequest, requireAgent } from '../middleware/auth';
import { requirePermission, RESOURCES, ACTIONS } from '../middleware/permissions';
import { dbGet, dbAll, dbRun, getBrasiliaTimestamp } from '../database';

const router = express.Router();

// Função para obter data atual no timezone de Brasília
function getBrasiliaDate(): { year: number; month: number; day: number } {
  const now = new Date();
  // Usar toLocaleString para obter data no timezone de Brasília
  const brasiliaDateStr = now.toLocaleString('en-US', { 
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  // Formato: "MM/DD/YYYY"
  const [month, day, year] = brasiliaDateStr.split('/').map(Number);
  
  return { year, month, day };
}

// Função para gerar número do ticket do dia
async function generateTicketNumber(): Promise<number> {
  const { year, month, day } = getBrasiliaDate();
  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  
  // Contar quantos tickets foram criados hoje
  // Usar CAST para garantir compatibilidade com SQLite e PostgreSQL
  const countResult = await dbGet(
    `SELECT COUNT(*) as count FROM tickets WHERE DATE(created_at) = ?`,
    [dateStr]
  );
  
  const count = (countResult as any)?.count || 0;
  return count + 1;
}

// Função para gerar ID do ticket no formato ano/mês/dia/número
async function generateTicketId(): Promise<string> {
  const { year, month, day } = getBrasiliaDate();
  const ticketNumber = await generateTicketNumber();
  const numberStr = String(ticketNumber).padStart(3, '0');
  
  return `${year}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}${numberStr}`;
}

// Função para converter ID completo formatado (ex: 20260122003) para ID numérico
async function getTicketIdFromFullId(fullId: string): Promise<number | null> {
  console.log(`[getTicketIdFromFullId] Processando ID: ${fullId}, length: ${fullId.length}`);
  
  // Se for um número simples, retornar direto
  if (!isNaN(Number(fullId)) && fullId.length < 11) {
    console.log(`[getTicketIdFromFullId] ID numérico simples: ${fullId}`);
    return parseInt(fullId);
  }
  
  // Se for um ID completo formatado (11 dígitos: YYYYMMDDNNN)
  if (fullId.length >= 11 && !isNaN(Number(fullId))) {
    const year = parseInt(fullId.substring(0, 4));
    const month = parseInt(fullId.substring(4, 6));
    const day = parseInt(fullId.substring(6, 8));
    // Pegar os últimos 3 dígitos para o ticket_number
    const ticketNumber = parseInt(fullId.substring(fullId.length - 3));
    
    console.log(`[getTicketIdFromFullId] Extraído - year: ${year}, month: ${month}, day: ${day}, ticketNumber: ${ticketNumber}`);
    
    // Buscar todos os tickets com esse número e verificar a data manualmente
    // Isso é mais confiável que usar DATE() que pode ter problemas de formato
    const allTickets = await dbAll(
      `SELECT id, ticket_number, created_at FROM tickets WHERE ticket_number = ? ORDER BY created_at DESC`,
      [ticketNumber]
    );
    
    console.log(`[getTicketIdFromFullId] Encontrados ${allTickets.length} tickets com número ${ticketNumber}`);
    
    if (allTickets && allTickets.length > 0) {
      for (const t of allTickets as any[]) {
        try {
          const ticketDate = new Date(t.created_at);
          const ticketYear = ticketDate.getFullYear();
          const ticketMonth = ticketDate.getMonth() + 1;
          const ticketDay = ticketDate.getDate();
          
          console.log(`[getTicketIdFromFullId] Comparando - Ticket ID ${t.id} (ticket_number: ${t.ticket_number}): ${ticketYear}-${String(ticketMonth).padStart(2, '0')}-${String(ticketDay).padStart(2, '0')} vs ${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
          
          if (ticketYear === year && ticketMonth === month && ticketDay === day) {
            console.log(`[getTicketIdFromFullId] ✅ Ticket encontrado: ID ${t.id}`);
            return t.id;
          }
        } catch (error) {
          console.error(`[getTicketIdFromFullId] Erro ao processar ticket ID ${t.id}:`, error);
        }
      }
      
      // Se não encontrou exato, retornar o primeiro ticket com esse número (fallback)
      if (allTickets.length === 1) {
        console.log(`[getTicketIdFromFullId] ⚠️ Usando fallback - apenas um ticket com número ${ticketNumber}: ID ${allTickets[0].id}`);
        return allTickets[0].id;
      }
    }
    
    console.log(`[getTicketIdFromFullId] ❌ Ticket não encontrado com número ${ticketNumber} e data ${year}-${month}-${day}`);
  }
  
  console.log(`[getTicketIdFromFullId] ❌ Não foi possível converter o ID: ${fullId}`);
  return null;
}

// Todas as rotas requerem autenticação
router.use(authenticate);

// IMPORTANTE: Rotas específicas devem vir ANTES das rotas com parâmetros dinâmicos
// Listar tickets pendentes de aprovação (ANTES de /:id)
router.get('/pending-approval', requirePermission(RESOURCES.APPROVE, ACTIONS.VIEW), async (req: AuthRequest, res) => {
  try {
    // Buscar grupos do usuário atual
    let userGroupIds: number[] = [];
    const userGroups = await dbAll(`
      SELECT group_id 
      FROM group_users 
      WHERE user_id = ?
    `, [req.userId]);
    userGroupIds = (userGroups as any[]).map(g => g.group_id);

    // Buscar apenas tickets com status pending_approval
    // Onde o formulário está vinculado ao usuário atual ou a um grupo do qual ele faz parte
    let query = `
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
        AND f.id IS NOT NULL
        AND (
          f.linked_user_id = ?
          ${userGroupIds.length > 0 ? `OR f.linked_group_id IN (${userGroupIds.map(() => '?').join(',')})` : 'OR 1=0'}
        )
      ORDER BY t.created_at DESC
    `;

    const params: any[] = [req.userId];
    if (userGroupIds.length > 0) {
      params.push(...userGroupIds);
    }

    const tickets = await dbAll(query, params);

    console.log(`[Pending Approval] Usuário ${req.userId} - Encontrados ${tickets.length} tickets pendentes de aprovação vinculados ao usuário/grupo`);
    
    // Log detalhado para debug
    tickets.forEach((ticket: any) => {
      console.log(`[Pending Approval] Ticket #${ticket.id}: status=${ticket.status}, form_id=${ticket.form_id}, linked_user_id=${ticket.linked_user_id}, linked_group_id=${ticket.linked_group_id}`);
    });

    res.json(tickets);
  } catch (error) {
    console.error('Erro ao buscar tickets pendentes:', error);
    res.status(500).json({ error: 'Erro ao buscar tickets pendentes' });
  }
});

// Listar tickets em tratamento (ANTES de /:id)
router.get('/in-treatment', requirePermission(RESOURCES.TRACK, ACTIONS.VIEW), async (req: AuthRequest, res) => {
  try {
    // Buscar grupos do usuário atual
    let userGroupIds: number[] = [];
    const userGroups = await dbAll(`
      SELECT group_id 
      FROM group_users 
      WHERE user_id = ?
    `, [req.userId]);
    userGroupIds = (userGroups as any[]).map(g => g.group_id);

    // Construir condição de vinculação (usuário ou grupo)
    const linkedCondition = `(
      f.linked_user_id = ?
      ${userGroupIds.length > 0 ? `OR f.linked_group_id IN (${userGroupIds.map(() => '?').join(',')})` : 'OR 1=0'}
    )`;

    let query = `
      SELECT DISTINCT t.*, 
             u.name as user_name, 
             u.email as user_email,
             a.name as assigned_name,
             c.name as category_name,
             f.name as form_name,
             f.public_url as form_url,
             f.linked_user_id,
             f.linked_group_id
      FROM tickets t
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN users a ON t.assigned_to = a.id
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN forms f ON t.form_id = f.id
      WHERE t.status IN ('open', 'in_progress', 'closed', 'rejected')
        AND f.id IS NOT NULL
        AND ${linkedCondition}
    `;
    
    const params: any[] = [req.userId];
    if (userGroupIds.length > 0) {
      params.push(...userGroupIds);
    }

    query += ' ORDER BY t.created_at DESC';

    const tickets = await dbAll(query, params);
    
    console.log(`[In Treatment] Usuário ${req.userId} - Grupos: [${userGroupIds.join(', ')}] - Encontrados ${tickets.length} tickets vinculados ao usuário/grupo`);
    
    res.json(tickets);
  } catch (error) {
    console.error('Erro ao buscar tickets em tratamento:', error);
    res.status(500).json({ error: 'Erro ao buscar tickets em tratamento' });
  }
});

// Listar tickets
router.get('/', requirePermission(RESOURCES.TICKETS, ACTIONS.VIEW), async (req: AuthRequest, res) => {
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
             f.id as form_id,
             t.scheduled_at
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
router.get('/:id', requirePermission(RESOURCES.TICKETS, ACTIONS.VIEW), async (req: AuthRequest, res) => {
  try {
    console.log(`[GET /:id] Recebido ID: ${req.params.id}, length: ${req.params.id.length}, isNaN: ${isNaN(Number(req.params.id))}`);
    
    // Tentar converter ID completo para ID numérico
    let ticketId: number | null = null;
    
    // Se for um número simples (menos de 11 dígitos), usar direto
    if (!isNaN(Number(req.params.id)) && req.params.id.length < 11) {
      // ID numérico simples
      ticketId = parseInt(req.params.id);
      console.log(`[GET /:id] ✅ ID numérico simples: ${ticketId}`);
    } else if (!isNaN(Number(req.params.id)) && req.params.id.length >= 11) {
      // ID completo formatado - converter
      console.log(`[GET /:id] 🔄 Tentando converter ID completo: ${req.params.id}`);
      ticketId = await getTicketIdFromFullId(req.params.id);
      if (!ticketId) {
        console.log(`[GET /:id] ❌ Não foi possível converter o ID: ${req.params.id}`);
        return res.status(404).json({ error: 'Ticket não encontrado' });
      }
      console.log(`[GET /:id] ✅ ID convertido: ${ticketId}`);
    } else {
      console.log(`[GET /:id] ❌ ID inválido: ${req.params.id}`);
      return res.status(404).json({ error: 'Ticket não encontrado' });
    }
    
    // Verificar permissões do usuário
    const { getUserPermissions } = await import('../middleware/permissions');
    const userPermissions = await getUserPermissions(req.userId!);
    
    const hasTicketsView = userPermissions.has('tickets:view');
    const hasApproveView = userPermissions.has('approve:view');
    const hasTrackView = userPermissions.has('track:view');
    
    let query = `
      SELECT t.*, 
             u.name as user_name, 
             u.email as user_email,
             a.name as assigned_name,
             c.name as category_name,
             f.name as form_name,
             f.id as form_id
      FROM tickets t
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN users a ON t.assigned_to = a.id
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN forms f ON t.form_id = f.id
      WHERE t.id = ?
    `;
    const params: any[] = [ticketId];

    // Verificar permissão baseado no papel e permissões do usuário
    // Se o usuário tem permissão de tickets:view, approve:view ou track:view, pode acessar
    // Caso contrário, só pode ver seus próprios tickets
    if (req.userRole === 'user' && !hasTicketsView && !hasApproveView && !hasTrackView) {
      // Usuário sem permissões especiais só pode ver seus próprios tickets
      query += ' AND t.user_id = ?';
      params.push(req.userId);
    }
    // Se tem approve:view ou track:view, pode acessar qualquer ticket (sem restrição adicional)

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
  authenticate,
  requirePermission(RESOURCES.TICKETS, ACTIONS.CREATE),
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

    // Gerar número do ticket do dia
    const ticketNumber = await generateTicketNumber();

    const result = await dbRun(
      `INSERT INTO tickets (title, description, status, priority, category_id, user_id, ticket_number, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, description, 'open', priority, category_id || null, req.userId, ticketNumber, getBrasiliaTimestamp(), getBrasiliaTimestamp()]
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
    const ticketId = await getTicketIdFromFullId(req.params.id);
    if (!ticketId) {
      return res.status(404).json({ error: 'Ticket não encontrado' });
    }
    
    const ticket = await dbGet('SELECT * FROM tickets WHERE id = ?', [ticketId]) as any;
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket não encontrado' });
    }

    if (ticket.status !== 'pending_approval') {
      return res.status(400).json({ error: 'Ticket não está pendente de aprovação' });
    }

    // Atualizar status para 'open' (ticket aprovado)
    await dbRun(
      'UPDATE tickets SET status = ?, updated_at = ? WHERE id = ?',
      ['open', getBrasiliaTimestamp(), ticketId]
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
    const ticketId = await getTicketIdFromFullId(req.params.id);
    if (!ticketId) {
      return res.status(404).json({ error: 'Ticket não encontrado' });
    }
    
    const ticket = await dbGet('SELECT * FROM tickets WHERE id = ?', [ticketId]) as any;
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket não encontrado' });
    }

    if (ticket.status !== 'pending_approval') {
      return res.status(400).json({ error: 'Ticket não está pendente de aprovação' });
    }

    // Atualizar status para 'rejected'
    await dbRun(
      'UPDATE tickets SET status = ?, updated_at = ? WHERE id = ?',
      ['rejected', getBrasiliaTimestamp(), ticketId]
    );

    res.json({ message: 'Ticket rejeitado com sucesso' });
  } catch (error) {
    console.error('Erro ao rejeitar ticket:', error);
    res.status(500).json({ error: 'Erro ao rejeitar ticket' });
  }
});

// Atualizar ticket
router.put('/:id', [
  authenticate,
  requirePermission(RESOURCES.TICKETS, ACTIONS.EDIT),
  body('status').optional().isIn(['open', 'in_progress', 'resolved', 'closed', 'pending_approval', 'scheduled', 'rejected']),
  body('priority').optional().isIn(['low', 'medium', 'high', 'urgent'])
], async (req: AuthRequest, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const ticketId = await getTicketIdFromFullId(req.params.id);
    if (!ticketId) {
      return res.status(404).json({ error: 'Ticket não encontrado' });
    }
    
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

    updates.push('updated_at = ?');
    values.push(getBrasiliaTimestamp());
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

// Buscar anexos de um ticket
router.get('/:id/attachments', requirePermission(RESOURCES.TICKETS, ACTIONS.VIEW), async (req: AuthRequest, res) => {
  try {
    const ticketId = await getTicketIdFromFullId(req.params.id);
    if (!ticketId) {
      return res.status(404).json({ error: 'Ticket não encontrado' });
    }
    
    // Verificar se ticket existe e permissão
    const ticket = await dbGet('SELECT form_submission_id FROM tickets WHERE id = ?', [ticketId]) as any;
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket não encontrado' });
    }

    // Verificar permissão
    if (req.userRole === 'user') {
      const ticketCheck = await dbGet('SELECT user_id FROM tickets WHERE id = ?', [ticketId]) as any;
      if (ticketCheck && ticketCheck.user_id !== req.userId) {
        return res.status(403).json({ error: 'Acesso negado' });
      }
    }

    if (!ticket.form_submission_id) {
      return res.json([]);
    }

    // Buscar anexos
    const attachments = await dbAll(`
      SELECT fa.*, ff.label as field_label, ff.type as field_type
      FROM form_attachments fa
      LEFT JOIN form_fields ff ON fa.field_id = ff.id
      WHERE fa.form_submission_id = ?
      ORDER BY fa.created_at ASC
    `, [ticket.form_submission_id]);

    res.json(attachments);
  } catch (error) {
    console.error('Erro ao buscar anexos:', error);
    res.status(500).json({ error: 'Erro ao buscar anexos' });
  }
});

// Deletar ticket (apenas admin)
// Agendar ticket
router.post('/:id/schedule', [
  authenticate,
  requirePermission(RESOURCES.TICKETS, ACTIONS.EDIT),
  body('scheduled_at').notEmpty().withMessage('Data e horário de agendamento são obrigatórios'),
  body('scheduled_at').isISO8601().withMessage('Data e horário devem estar no formato ISO 8601')
], async (req: AuthRequest, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const ticketId = await getTicketIdFromFullId(req.params.id);
    if (!ticketId) {
      return res.status(404).json({ error: 'Ticket não encontrado' });
    }

    const { scheduled_at } = req.body;

    // Atualizar ticket com agendamento e mudar status para scheduled
    await dbRun(
      'UPDATE tickets SET scheduled_at = ?, status = ?, updated_at = ? WHERE id = ?',
      [scheduled_at, 'scheduled', getBrasiliaTimestamp(), ticketId]
    );

    // Buscar ticket atualizado
    const ticket = await dbGet(`
      SELECT t.*, 
             u.name as user_name, 
             u.email as user_email,
             a.name as assigned_name,
             c.name as category_name,
             f.name as form_name,
             f.public_url as form_url,
             f.linked_user_id,
             f.linked_group_id
      FROM tickets t
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN users a ON t.assigned_to = a.id
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN forms f ON t.form_id = f.id
      WHERE t.id = ?
    `, [ticketId]);

    res.json(ticket);
  } catch (error) {
    console.error('Erro ao agendar ticket:', error);
    res.status(500).json({ error: 'Erro ao agendar ticket' });
  }
});

// Cancelar agendamento de ticket
router.post('/:id/unschedule', authenticate, requirePermission(RESOURCES.TICKETS, ACTIONS.EDIT), async (req: AuthRequest, res) => {
  try {
    const ticketId = await getTicketIdFromFullId(req.params.id);
    if (!ticketId) {
      return res.status(404).json({ error: 'Ticket não encontrado' });
    }

    // Remover agendamento e voltar status para open
    await dbRun(
      'UPDATE tickets SET scheduled_at = NULL, status = ?, updated_at = ? WHERE id = ?',
      ['open', getBrasiliaTimestamp(), ticketId]
    );

    // Buscar ticket atualizado
    const ticket = await dbGet(`
      SELECT t.*, 
             u.name as user_name, 
             u.email as user_email,
             a.name as assigned_name,
             c.name as category_name,
             f.name as form_name,
             f.public_url as form_url,
             f.linked_user_id,
             f.linked_group_id
      FROM tickets t
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN users a ON t.assigned_to = a.id
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN forms f ON t.form_id = f.id
      WHERE t.id = ?
    `, [ticketId]);

    res.json(ticket);
  } catch (error) {
    console.error('Erro ao cancelar agendamento:', error);
    res.status(500).json({ error: 'Erro ao cancelar agendamento' });
  }
});

router.delete('/:id', authenticate, requirePermission(RESOURCES.TICKETS, ACTIONS.DELETE), async (req: AuthRequest, res) => {
  try {
    const ticketId = await getTicketIdFromFullId(req.params.id);
    if (!ticketId) {
      return res.status(404).json({ error: 'Ticket não encontrado' });
    }
    
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

// Função para calcular timestamp de 24 horas atrás em horário de Brasília
function getBrasiliaTimestamp24HoursAgo(): string {
  const now = new Date();
  
  // Obter componentes da data/hora atual no timezone de Brasília
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  const parts = formatter.formatToParts(now);
  const year = parseInt(parts.find(p => p.type === 'year')?.value || '0');
  const month = parseInt(parts.find(p => p.type === 'month')?.value || '0') - 1; // getMonth() retorna 0-11
  const day = parseInt(parts.find(p => p.type === 'day')?.value || '0');
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
  const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
  const second = parseInt(parts.find(p => p.type === 'second')?.value || '0');
  
  // Criar data em Brasília
  const brasiliaNow = new Date(year, month, day, hour, minute, second);
  
  // Subtrair 24 horas
  const twentyFourHoursAgo = new Date(brasiliaNow.getTime() - (24 * 60 * 60 * 1000));
  
  // Formatar como YYYY-MM-DD HH:mm:ss
  const agoYear = twentyFourHoursAgo.getFullYear();
  const agoMonth = String(twentyFourHoursAgo.getMonth() + 1).padStart(2, '0');
  const agoDay = String(twentyFourHoursAgo.getDate()).padStart(2, '0');
  const agoHour = String(twentyFourHoursAgo.getHours()).padStart(2, '0');
  const agoMinute = String(twentyFourHoursAgo.getMinutes()).padStart(2, '0');
  const agoSecond = String(twentyFourHoursAgo.getSeconds()).padStart(2, '0');
  
  return `${agoYear}-${agoMonth}-${agoDay} ${agoHour}:${agoMinute}:${agoSecond}`;
}

// Função para atualizar tickets finalizados há mais de 24 horas
export async function updateClosedTicketsToResolved() {
  try {
    // Buscar tickets com status 'closed' que foram atualizados há mais de 24 horas
    // Usar timezone de Brasília para calcular 24 horas
    const dateStr = getBrasiliaTimestamp24HoursAgo();
    
    console.log(`[updateClosedTicketsToResolved] Buscando tickets fechados antes de: ${dateStr}`);
    
    // Buscar tickets fechados há mais de 24 horas
    // Usar datetime() para SQLite
    const closedTickets = await dbAll(`
      SELECT id, updated_at, status 
      FROM tickets 
      WHERE status = 'closed' 
      AND datetime(updated_at) < datetime(?)
    `, [dateStr]);
    
    if (closedTickets && closedTickets.length > 0) {
      console.log(`[updateClosedTicketsToResolved] Encontrados ${closedTickets.length} tickets para atualizar`);
      
      // Atualizar cada ticket para 'resolved'
      for (const ticket of closedTickets as any[]) {
        await dbRun(
          `UPDATE tickets SET status = 'resolved', updated_at = ? WHERE id = ?`,
          [getBrasiliaTimestamp(), ticket.id]
        );
        console.log(`[updateClosedTicketsToResolved] Ticket ${ticket.id} atualizado para 'resolved'`);
      }
      
      return { updated: closedTickets.length };
    }
    
    return { updated: 0 };
  } catch (error) {
    console.error('[updateClosedTicketsToResolved] Erro ao atualizar tickets:', error);
    throw error;
  }
}

// Endpoint para atualizar tickets finalizados (pode ser chamado manualmente ou por cron)
router.post('/update-closed-tickets', authenticate, requirePermission(RESOURCES.TICKETS, ACTIONS.EDIT), async (req: AuthRequest, res) => {
  try {
    const result = await updateClosedTicketsToResolved();
    res.json({ 
      message: `${result.updated} ticket(s) atualizado(s) para 'resolved'`,
      updated: result.updated 
    });
  } catch (error) {
    console.error('Erro ao atualizar tickets finalizados:', error);
    res.status(500).json({ error: 'Erro ao atualizar tickets finalizados' });
  }
});

export default router;
