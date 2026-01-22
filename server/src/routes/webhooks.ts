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

      res.json(webhooks);
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

      const { name, description, priority, category_id, assigned_to } = req.body;
      const webhookUrl = generateWebhookUrl();
      const secretKey = crypto.randomBytes(32).toString('hex');

      const result = await dbRun(`
        INSERT INTO webhooks (name, description, webhook_url, secret_key, priority, category_id, assigned_to, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        name,
        description || null,
        webhookUrl,
        secretKey,
        priority || 'medium',
        category_id || null,
        assigned_to || null,
        req.userId,
        getBrasiliaTimestamp(),
        getBrasiliaTimestamp()
      ]);

      const webhook = await dbGet('SELECT * FROM webhooks WHERE id = ?', [result.lastID || result.insertId]);
      res.status(201).json(webhook);
    } catch (error: any) {
      console.error('Erro ao criar webhook:', error);
      res.status(500).json({ error: 'Erro ao criar webhook: ' + (error.message || 'Erro desconhecido') });
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
    body('active').optional().isBoolean()
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
      
      await dbRun(`
        UPDATE webhooks
        SET name = COALESCE(?, name),
            description = COALESCE(?, description),
            priority = COALESCE(?, priority),
            category_id = ?,
            assigned_to = ?,
            active = COALESCE(?, active),
            updated_at = ?
        WHERE id = ?
      `, [
        name,
        description,
        priority,
        category_id !== undefined ? category_id : null,
        assigned_to !== undefined ? assigned_to : null,
        active !== undefined ? (active ? 1 : 0) : null,
        getBrasiliaTimestamp(),
        req.params.id
      ]);

      const updated = await dbGet('SELECT * FROM webhooks WHERE id = ?', [req.params.id]);
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
router.post(
  '/receive/:webhookUrl',
  async (req: express.Request, res: Response) => {
    try {
      const { webhookUrl } = req.params;
      const payload = req.body;

      // Buscar webhook
      const webhook = await dbGet('SELECT * FROM webhooks WHERE webhook_url = ? AND active = 1', [webhookUrl]);
      if (!webhook) {
        return res.status(404).json({ error: 'Webhook não encontrado ou inativo' });
      }

      const webhookData = webhook as any;

      // Validar secret key se fornecido
      const providedSecret = req.headers['x-webhook-secret'] || req.headers['x-secret-key'];
      if (webhookData.secret_key && providedSecret !== webhookData.secret_key) {
        await dbRun(`
          INSERT INTO webhook_logs (webhook_id, status, response_code, payload, error_message, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [
          webhookData.id,
          'error',
          401,
          JSON.stringify(payload),
          'Secret key inválida',
          getBrasiliaTimestamp()
        ]);
        return res.status(401).json({ error: 'Secret key inválida' });
      }

      // Extrair informações do payload (suporta diferentes formatos)
      let title = 'Webhook: ' + webhookData.name;
      let description = JSON.stringify(payload, null, 2);
      let priority = webhookData.priority || 'medium';

      // Tentar extrair informações comuns de sistemas como Zabbix
      if (payload.alert && payload.alert.name) {
        title = payload.alert.name;
        description = payload.alert.message || description;
        priority = payload.alert.severity === 'High' || payload.alert.severity === 'Disaster' ? 'high' : 
                   payload.alert.severity === 'Average' ? 'medium' : 'low';
      } else if (payload.event && payload.event.name) {
        title = payload.event.name;
        description = payload.event.description || description;
      } else if (payload.title) {
        title = payload.title;
        description = payload.description || payload.message || description;
      } else if (payload.message) {
        title = payload.message.substring(0, 100);
        description = JSON.stringify(payload, null, 2);
      }

      // Criar ticket
      let ticketId: number | null = null;
      try {
        // Gerar número e ID do ticket
        const ticketNumber = await generateTicketNumber();
        const ticketIdStr = await generateTicketId();

        const ticketResult = await dbRun(`
          INSERT INTO tickets (ticket_number, title, description, status, priority, category_id, user_id, assigned_to, created_at, updated_at)
          VALUES (?, ?, ?, 'open', ?, ?, ?, ?, ?, ?)
        `, [
          ticketNumber,
          title,
          description,
          priority,
          webhookData.category_id || null,
          webhookData.created_by, // Usar o criador do webhook como usuário
          webhookData.assigned_to || null,
          getBrasiliaTimestamp(),
          getBrasiliaTimestamp()
        ]);

        ticketId = (ticketResult as any).lastID;

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
          ticket_id: ticketIdStr
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

        console.error('Erro ao criar ticket do webhook:', ticketError);
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
