import express, { Response } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requirePermission, RESOURCES, ACTIONS } from '../middleware/permissions';
import { dbGet, dbAll, dbRun, getBrasiliaTimestamp } from '../database';
import crypto from 'crypto';

const router = express.Router();

// Função para obter data atual no timezone de Brasília
function getBrasiliaDate(): { year: number; month: number; day: number } {
  const now = new Date();
  const brasiliaDateStr = now.toLocaleString('en-US', { 
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const [month, day, year] = brasiliaDateStr.split('/').map(Number);
  return { year, month, day };
}

// Função para gerar número do ticket do dia
async function generateTicketNumber(): Promise<number> {
  const { year, month, day } = getBrasiliaDate();
  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const DB_TYPE = process.env.DB_TYPE || 'sqlite';
  const dateFilter = DB_TYPE === 'sqlite'
    ? `DATE(created_at) = ?`
    : `DATE(created_at) = ?::date`;
  const countResult = await dbGet(
    `SELECT COUNT(*) as count FROM tickets WHERE ${dateFilter}`,
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

// Gerar URL única para webhook
const generateWebhookUrl = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

// Listar webhooks
router.get(
  '/',
  authenticate,
  requirePermission(RESOURCES.WEBHOOKS, ACTIONS.VIEW),
  async (req: AuthRequest, res: Response) => {
    try {
      const webhooks = await dbAll(`
        SELECT w.*,
               u.name as created_by_name,
               ua.name as assigned_to_name,
               c.name as category_name,
               (SELECT COUNT(*) FROM webhook_logs wl WHERE wl.webhook_id = w.id) as total_calls,
               (SELECT COUNT(*) FROM webhook_logs wl WHERE wl.webhook_id = w.id AND wl.status = 'success') as success_calls,
               (SELECT COUNT(*) FROM webhook_logs wl WHERE wl.webhook_id = w.id AND wl.status = 'error') as error_calls
        FROM webhooks w
        LEFT JOIN users u ON w.created_by = u.id
        LEFT JOIN users ua ON w.assigned_to = ua.id
        LEFT JOIN categories c ON w.category_id = c.id
        WHERE w.created_by = ?
        ORDER BY w.created_at DESC
      `, [req.userId]);

      console.log(`[Webhook List] Usuário ${req.userId} - Encontrados ${webhooks.length} webhooks`);
      res.json(webhooks || []);
    } catch (error) {
      console.error('Erro ao listar webhooks:', error);
      res.status(500).json({ error: 'Erro ao buscar webhooks' });
    }
  }
);

// Obter webhook específico
router.get(
  '/:id',
  authenticate,
  requirePermission(RESOURCES.WEBHOOKS, ACTIONS.VIEW),
  async (req: AuthRequest, res: Response) => {
    try {
      const webhook = await dbGet(`
        SELECT w.*,
               u.name as created_by_name,
               ua.name as assigned_to_name,
               c.name as category_name
        FROM webhooks w
        LEFT JOIN users u ON w.created_by = u.id
        LEFT JOIN users ua ON w.assigned_to = ua.id
        LEFT JOIN categories c ON w.category_id = c.id
        WHERE w.id = ? AND w.created_by = ?
      `, [req.params.id, req.userId]);

      if (!webhook) {
        return res.status(404).json({ error: 'Webhook não encontrado' });
      }

      res.json(webhook);
    } catch (error) {
      console.error('Erro ao buscar webhook:', error);
      res.status(500).json({ error: 'Erro ao buscar webhook' });
    }
  }
);

// Criar webhook
router.post(
  '/',
  authenticate,
  requirePermission(RESOURCES.WEBHOOKS, ACTIONS.CREATE),
  [
    body('name').notEmpty().withMessage('Nome é obrigatório'),
    body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
    body('category_id').optional().isInt(),
    body('assigned_to').optional().isInt()
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, description, priority, category_id, assigned_to, active } = req.body;
      const webhookUrl = generateWebhookUrl();
      const secretKey = crypto.randomBytes(32).toString('hex');

      console.log(`[Webhook Create] Criando webhook: ${name}, usuário: ${req.userId}`);

      const result = await dbRun(`
        INSERT INTO webhooks (name, description, webhook_url, secret_key, priority, category_id, assigned_to, created_by, active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        name,
        description || null,
        webhookUrl,
        secretKey,
        priority || 'medium',
        category_id || null,
        assigned_to || null,
        req.userId,
        active !== undefined ? (active ? 1 : 0) : 1,
        getBrasiliaTimestamp(),
        getBrasiliaTimestamp()
      ]);

      const webhookId = (result as any).lastID || (result as any).insertId || (result as any).id;
      console.log(`[Webhook Create] Webhook criado com ID: ${webhookId}`);
      
      // Buscar webhook com dados completos (incluindo joins)
      const webhook = await dbGet(`
        SELECT w.*,
               u.name as created_by_name,
               ua.name as assigned_to_name,
               c.name as category_name,
               (SELECT COUNT(*) FROM webhook_logs wl WHERE wl.webhook_id = w.id) as total_calls,
               (SELECT COUNT(*) FROM webhook_logs wl WHERE wl.webhook_id = w.id AND wl.status = 'success') as success_calls,
               (SELECT COUNT(*) FROM webhook_logs wl WHERE wl.webhook_id = w.id AND wl.status = 'error') as error_calls
        FROM webhooks w
        LEFT JOIN users u ON w.created_by = u.id
        LEFT JOIN users ua ON w.assigned_to = ua.id
        LEFT JOIN categories c ON w.category_id = c.id
        WHERE w.id = ?
      `, [webhookId]);
      
      if (!webhook) {
        throw new Error('Webhook criado mas não foi possível recuperá-lo');
      }
      
      res.status(201).json(webhook);
    } catch (error: any) {
      console.error('[Webhook Create] Erro ao criar webhook:', error);
      console.error('[Webhook Create] Stack trace:', error.stack);
      res.status(500).json({ 
        error: 'Erro ao criar webhook: ' + (error.message || 'Erro desconhecido'),
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }
);

// Atualizar webhook
router.put(
  '/:id',
  authenticate,
  requirePermission(RESOURCES.WEBHOOKS, ACTIONS.EDIT),
  [
    body('name').optional().notEmpty(),
    body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
    body('active').optional()
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const webhook = await dbGet('SELECT * FROM webhooks WHERE id = ? AND created_by = ?', [req.params.id, req.userId]);
      if (!webhook) {
        return res.status(404).json({ error: 'Webhook não encontrado' });
      }

      const { name, description, priority, category_id, assigned_to, active } = req.body;
      
      // Construir query dinamicamente baseado nos campos fornecidos
      const updates: string[] = [];
      const values: any[] = [];
      
      if (name !== undefined) {
        updates.push('name = ?');
        values.push(name);
      }
      if (description !== undefined) {
        updates.push('description = ?');
        values.push(description || null);
      }
      if (priority !== undefined) {
        updates.push('priority = ?');
        values.push(priority);
      }
      if (category_id !== undefined) {
        updates.push('category_id = ?');
        values.push(category_id || null);
      }
      if (assigned_to !== undefined) {
        updates.push('assigned_to = ?');
        values.push(assigned_to || null);
      }
      if (active !== undefined) {
        updates.push('active = ?');
        // Aceitar tanto boolean quanto número (0/1)
        const activeValue = typeof active === 'boolean' ? (active ? 1 : 0) : (active === 1 || active === '1' ? 1 : 0);
        values.push(activeValue);
      }
      
      updates.push('updated_at = ?');
      values.push(getBrasiliaTimestamp());
      values.push(req.params.id);
      
      if (updates.length > 1) { // Mais que apenas updated_at
        await dbRun(`
          UPDATE webhooks
          SET ${updates.join(', ')}
          WHERE id = ?
        `, values);
      }

      // Buscar webhook atualizado com dados completos
      const updated = await dbGet(`
        SELECT w.*,
               u.name as created_by_name,
               ua.name as assigned_to_name,
               c.name as category_name,
               (SELECT COUNT(*) FROM webhook_logs wl WHERE wl.webhook_id = w.id) as total_calls,
               (SELECT COUNT(*) FROM webhook_logs wl WHERE wl.webhook_id = w.id AND wl.status = 'success') as success_calls,
               (SELECT COUNT(*) FROM webhook_logs wl WHERE wl.webhook_id = w.id AND wl.status = 'error') as error_calls
        FROM webhooks w
        LEFT JOIN users u ON w.created_by = u.id
        LEFT JOIN users ua ON w.assigned_to = ua.id
        LEFT JOIN categories c ON w.category_id = c.id
        WHERE w.id = ?
      `, [req.params.id]);
      
      if (!updated) {
        return res.status(404).json({ error: 'Webhook não encontrado após atualização' });
      }
      
      res.json(updated);
    } catch (error: any) {
      console.error('Erro ao atualizar webhook:', error);
      res.status(500).json({ error: 'Erro ao atualizar webhook: ' + (error.message || 'Erro desconhecido') });
    }
  }
);

// Deletar webhook
router.delete(
  '/:id',
  authenticate,
  requirePermission(RESOURCES.WEBHOOKS, ACTIONS.DELETE),
  async (req: AuthRequest, res: Response) => {
    try {
      const webhook = await dbGet('SELECT * FROM webhooks WHERE id = ? AND created_by = ?', [req.params.id, req.userId]);
      if (!webhook) {
        return res.status(404).json({ error: 'Webhook não encontrado' });
      }

      await dbRun('DELETE FROM webhooks WHERE id = ?', [req.params.id]);
      res.json({ message: 'Webhook deletado com sucesso' });
    } catch (error) {
      console.error('Erro ao deletar webhook:', error);
      res.status(500).json({ error: 'Erro ao deletar webhook' });
    }
  }
);

// Rota pública para receber webhooks
// NOTA: O middleware express.raw() já foi aplicado no server.ts antes dos middlewares globais
router.post(
  '/receive/:webhookUrl',
  async (req: express.Request, res: Response) => {
    try {
      const { webhookUrl } = req.params;
      
      // Log detalhado da requisição recebida
      console.log(`[Webhook Receive] ========================================`);
      console.log(`[Webhook Receive] URL recebida: ${webhookUrl}`);
      console.log(`[Webhook Receive] Método: ${req.method}`);
      console.log(`[Webhook Receive] Content-Type: ${req.headers['content-type'] || 'não especificado'}`);
      console.log(`[Webhook Receive] Headers:`, JSON.stringify(req.headers, null, 2));
      console.log(`[Webhook Receive] IP origem: ${req.ip || req.socket.remoteAddress}`);
      
      // Parse do payload baseado no Content-Type
      let payload: any = {};
      const contentType = req.headers['content-type'] || '';
      const rawBodyBuffer = req.body as Buffer;
      
      try {
        if (contentType.includes('application/json')) {
          // Tentar parsear como JSON
          const bodyStr = rawBodyBuffer.toString('utf8');
          try {
            payload = JSON.parse(bodyStr);
          } catch {
            // Se falhar, tentar usar como objeto se já estiver parseado
            payload = typeof rawBodyBuffer === 'object' && !Buffer.isBuffer(rawBodyBuffer) 
              ? rawBodyBuffer 
              : { raw_content: bodyStr };
          }
        } else if (contentType.includes('application/x-www-form-urlencoded')) {
          // Form data - tentar parsear manualmente
          const bodyStr = rawBodyBuffer.toString('utf8');
          const params = new URLSearchParams(bodyStr);
          payload = Object.fromEntries(params);
        } else if (contentType.includes('text/plain') || contentType.includes('text/xml') || contentType.includes('application/xml')) {
          // Raw text/XML - tentar parsear como JSON primeiro, senão usar como string
          const bodyStr = rawBodyBuffer.toString('utf8');
          try {
            payload = JSON.parse(bodyStr);
          } catch {
            // Se não for JSON válido, tratar como string
            payload = { raw_content: bodyStr, content_type: contentType };
          }
        } else {
          // Tipo desconhecido - tentar parsear como JSON primeiro
          const bodyStr = rawBodyBuffer.toString('utf8');
          if (bodyStr.trim().startsWith('{') || bodyStr.trim().startsWith('[')) {
            try {
              payload = JSON.parse(bodyStr);
            } catch {
              payload = { raw_content: bodyStr, content_type: contentType };
            }
          } else {
            payload = { raw_content: bodyStr, content_type: contentType };
          }
        }
        
        console.log(`[Webhook Receive] Payload parseado (${Object.keys(payload).length} campos):`, JSON.stringify(payload, null, 2).substring(0, 1000));
      } catch (parseError: any) {
        console.error(`[Webhook Receive] Erro ao fazer parse do payload:`, parseError);
        const bodyStr = rawBodyBuffer ? rawBodyBuffer.toString('utf8') : 'N/A';
        payload = { 
          parse_error: parseError.message,
          raw_body: bodyStr.substring(0, 500)
        };
      }

      // Buscar webhook
      const webhook = await dbGet('SELECT * FROM webhooks WHERE webhook_url = ? AND active = 1', [webhookUrl]);
      if (!webhook) {
        console.log(`[Webhook Receive] ❌ Webhook não encontrado ou inativo: ${webhookUrl}`);
        return res.status(404).json({ 
          error: 'Webhook não encontrado ou inativo',
          webhook_url: webhookUrl
        });
      }

      const webhookData = webhook as any;
      
      console.log(`[Webhook Receive] ✅ Webhook encontrado: ${webhookData.name} (ID: ${webhookData.id})`);
      console.log(`[Webhook Receive] ℹ️ Processando webhook sem validação de autenticação`);

      // Extrair informações do payload (suporta diferentes formatos)
      let title = 'Webhook: ' + webhookData.name;
      let description = JSON.stringify(payload, null, 2);
      let priority = webhookData.priority || 'medium';

      // Tentar extrair informações comuns de diferentes sistemas
      
      // Formato Zabbix
      if (payload.alert && payload.alert.name) {
        title = payload.alert.name;
        description = payload.alert.message || description;
        priority = payload.alert.severity === 'High' || payload.alert.severity === 'Disaster' ? 'high' : 
                   payload.alert.severity === 'Average' ? 'medium' : 'low';
      }
      // Formato genérico de eventos
      else if (payload.event && payload.event.name) {
        title = payload.event.name;
        description = payload.event.description || payload.event.message || description;
        if (payload.event.priority || payload.event.severity) {
          const eventPriority = (payload.event.priority || payload.event.severity).toLowerCase();
          if (eventPriority.includes('high') || eventPriority.includes('critical') || eventPriority.includes('urgent')) {
            priority = 'high';
          } else if (eventPriority.includes('medium') || eventPriority.includes('warning')) {
            priority = 'medium';
          } else {
            priority = 'low';
          }
        }
      }
      // Formato simples com title/description
      else if (payload.title) {
        title = payload.title;
        description = payload.description || payload.message || payload.body || description;
        if (payload.priority) {
          const p = String(payload.priority).toLowerCase();
          if (p.includes('high') || p.includes('critical') || p.includes('urgent')) priority = 'high';
          else if (p.includes('medium') || p.includes('warning')) priority = 'medium';
          else priority = 'low';
        }
      }
      // Formato com message
      else if (payload.message) {
        title = payload.message.substring(0, 100);
        description = JSON.stringify(payload, null, 2);
      }
      // Formato com subject
      else if (payload.subject) {
        title = payload.subject;
        description = payload.body || payload.content || payload.text || description;
      }
      // Formato com name
      else if (payload.name) {
        title = payload.name;
        description = payload.description || payload.details || description;
      }
      // Formato com raw_content (quando não foi possível parsear)
      else if (payload.raw_content) {
        title = `Webhook recebido: ${webhookData.name}`;
        description = `Tipo: ${payload.content_type || 'desconhecido'}\n\nConteúdo:\n${payload.raw_content}`;
      }
      
      // Limitar tamanho do título (máximo 255 caracteres)
      if (title.length > 255) {
        title = title.substring(0, 252) + '...';
      }
      
      console.log(`[Webhook Receive] Informações extraídas - Título: "${title}", Prioridade: ${priority}`);

      // Criar ticket
      let ticketId: number | null = null;
      try {
        // Gerar número e ID do ticket
        const ticketNumber = await generateTicketNumber();
        const ticketIdStr = await generateTicketId();

        const nowTs = getBrasiliaTimestamp();
        const assignedTo = webhookData.assigned_to || null;
        const ticketResult = await dbRun(`
          INSERT INTO tickets (ticket_number, title, description, status, priority, category_id, user_id, assigned_to, assigned_at, created_at, updated_at)
          VALUES (?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, ?)
        `, [
          ticketNumber,
          title,
          description,
          priority,
          webhookData.category_id || null,
          webhookData.created_by, // Usar o criador do webhook como usuário
          assignedTo,
          assignedTo ? nowTs : null, // assigned_at: quando atribuído na criação, registrar momento
          nowTs,
          nowTs
        ]);

        ticketId = (ticketResult as any).lastID || (ticketResult as any).insertId || (ticketResult as any).id;

        console.log(`[Webhook Receive] Ticket criado com sucesso: ID ${ticketId}, número ${ticketNumber}, ID completo ${ticketIdStr}`);

        // Registrar log de sucesso
        await dbRun(`
          INSERT INTO webhook_logs (webhook_id, status, response_code, payload, ticket_id, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [
          webhookData.id,
          'success',
          200,
          JSON.stringify(payload),
          ticketId,
          getBrasiliaTimestamp()
        ]);

        res.status(200).json({
          success: true,
          message: 'Webhook recebido e ticket criado com sucesso',
          ticket_id: ticketIdStr,
          ticket_number: ticketNumber
        });
      } catch (ticketError: any) {
        // Registrar log de erro
        await dbRun(`
          INSERT INTO webhook_logs (webhook_id, status, response_code, payload, error_message, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [
          webhookData.id,
          'error',
          500,
          JSON.stringify(payload),
          ticketError.message || 'Erro ao criar ticket',
          getBrasiliaTimestamp()
        ]);

        console.error('[Webhook Receive] Erro ao criar ticket do webhook:', ticketError);
        console.error('[Webhook Receive] Stack trace:', ticketError.stack);
        res.status(500).json({
          success: false,
          error: 'Erro ao criar ticket: ' + (ticketError.message || 'Erro desconhecido')
        });
      }
    } catch (error: any) {
      console.error('Erro ao processar webhook:', error);
      res.status(500).json({ error: 'Erro ao processar webhook: ' + (error.message || 'Erro desconhecido') });
    }
  }
);

// Rota de teste para webhook (não requer autenticação)
// NOTA: O middleware express.raw() já foi aplicado no server.ts antes dos middlewares globais
router.post(
  '/test/:webhookUrl',
  async (req: express.Request, res: Response) => {
    try {
      const { webhookUrl } = req.params;
      const contentType = req.headers['content-type'] || 'não especificado';
      const rawBody = req.body as Buffer;
      
      console.log(`[Webhook Test] Teste recebido para: ${webhookUrl}`);
      console.log(`[Webhook Test] Content-Type: ${contentType}`);
      console.log(`[Webhook Test] Body size: ${rawBody ? rawBody.length : 0} bytes`);
      
      // Verificar se webhook existe
      const webhook = await dbGet('SELECT * FROM webhooks WHERE webhook_url = ?', [webhookUrl]);
      
      if (!webhook) {
        return res.status(404).json({ 
          error: 'Webhook não encontrado',
          webhook_url: webhookUrl,
          message: 'Verifique se a URL do webhook está correta'
        });
      }
      
      const webhookData = webhook as any;
      
      // Tentar parsear o body
      let parsedBody: any = {};
      try {
        const bodyStr = rawBody.toString('utf8');
        if (contentType.includes('application/json')) {
          parsedBody = JSON.parse(bodyStr);
        } else {
          parsedBody = { raw_content: bodyStr.substring(0, 500) };
        }
      } catch (e) {
        parsedBody = { parse_error: 'Não foi possível fazer parse do body' };
      }
      
      res.json({
        success: true,
        message: 'Webhook de teste recebido com sucesso',
        webhook: {
          id: webhookData.id,
          name: webhookData.name,
          active: webhookData.active === 1,
          requires_secret: !!webhookData.secret_key
        },
        request_info: {
          content_type: contentType,
          body_size: rawBody ? rawBody.length : 0,
          headers: Object.keys(req.headers),
          parsed_body: parsedBody
        },
        instructions: {
          endpoint: `/api/webhooks/receive/${webhookUrl}`,
          method: 'POST',
          content_types_supported: [
            'application/json',
            'application/x-www-form-urlencoded',
            'text/plain',
            'text/xml',
            'application/xml'
          ],
          authentication: 'Este webhook não requer autenticação (secret key desabilitado)'
        }
      });
    } catch (error: any) {
      console.error('[Webhook Test] Erro:', error);
      res.status(500).json({ 
        error: 'Erro ao processar teste',
        message: error.message 
      });
    }
  }
);

// Obter logs de um webhook
router.get(
  '/:id/logs',
  authenticate,
  requirePermission(RESOURCES.WEBHOOKS, ACTIONS.VIEW),
  async (req: AuthRequest, res: Response) => {
    try {
      const webhook = await dbGet('SELECT * FROM webhooks WHERE id = ? AND created_by = ?', [req.params.id, req.userId]);
      if (!webhook) {
        return res.status(404).json({ error: 'Webhook não encontrado' });
      }

      const limit = parseInt(req.query.limit as string) || 50;
      const logs = await dbAll(`
        SELECT wl.*, t.ticket_number
        FROM webhook_logs wl
        LEFT JOIN tickets t ON wl.ticket_id = t.id
        WHERE wl.webhook_id = ?
        ORDER BY wl.created_at DESC
        LIMIT ?
      `, [req.params.id, limit]);

      res.json(logs);
    } catch (error) {
      console.error('Erro ao buscar logs do webhook:', error);
      res.status(500).json({ error: 'Erro ao buscar logs' });
    }
  }
);

export default router;
