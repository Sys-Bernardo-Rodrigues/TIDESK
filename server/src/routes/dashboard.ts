import express from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requirePermission, RESOURCES, ACTIONS } from '../middleware/permissions';
import { dbGet, dbAll } from '../database';

const DB_TYPE = process.env.DB_TYPE || 'sqlite';

const router = express.Router();

// Estatísticas gerais do dashboard
router.get(
  '/stats',
  authenticate,
  requirePermission(RESOURCES.TICKETS, ACTIONS.VIEW),
  async (req: AuthRequest, res) => {
    try {
      // Tickets
      const totalTickets = await dbGet('SELECT COUNT(*) as count FROM tickets');
      const openTickets = await dbGet("SELECT COUNT(*) as count FROM tickets WHERE status = 'open'");
      const inProgressTickets = await dbGet("SELECT COUNT(*) as count FROM tickets WHERE status = 'in_progress'");
      const resolvedTickets = await dbGet("SELECT COUNT(*) as count FROM tickets WHERE status = 'resolved'");
      const closedTickets = await dbGet("SELECT COUNT(*) as count FROM tickets WHERE status = 'closed'");
      const pendingApproval = await dbGet("SELECT COUNT(*) as count FROM tickets WHERE status = 'pending_approval'");

      // Tickets por prioridade
      const ticketsByPriority = await dbAll(`
        SELECT priority, COUNT(*) as count
        FROM tickets
        WHERE status NOT IN ('resolved', 'closed')
        GROUP BY priority
      `);

      // Usuários
      const totalUsers = await dbGet('SELECT COUNT(*) as count FROM users');
      // Considerar todos os usuários como ativos (não há coluna status)
      const activeUsers = totalUsers;

      // Formulários
      const totalForms = await dbGet('SELECT COUNT(*) as count FROM forms');
      // Considerar todos os formulários como ativos (não há coluna status)
      const activeForms = totalForms;

      // Páginas
      const totalPages = await dbGet('SELECT COUNT(*) as count FROM pages');

      // Grupos
      const totalGroups = await dbGet('SELECT COUNT(*) as count FROM groups');

      // Calcular datas para filtros
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      const formatDate = (date: Date): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
      };

      const sevenDaysAgoStr = formatDate(sevenDaysAgo);
      const thirtyDaysAgoStr = formatDate(thirtyDaysAgo);
      const todayStartStr = formatDate(todayStart);
      const todayEndStr = formatDate(new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1));

      // Webhooks
      const totalWebhooks = await dbGet('SELECT COUNT(*) as count FROM webhooks');
      const activeWebhooks = await dbGet('SELECT COUNT(*) as count FROM webhooks WHERE active = 1');
      const webhookCallsToday = await dbGet(`
        SELECT COUNT(*) as count
        FROM webhook_logs
        WHERE DATE(created_at) = DATE('now')
      `);
      const webhookCallsLast7Days = await dbGet(
        'SELECT COUNT(*) as count FROM webhook_logs WHERE created_at >= ?',
        [sevenDaysAgoStr]
      );
      const webhookSuccessRate = await dbGet(`
        SELECT 
          COUNT(CASE WHEN status = 'success' THEN 1 END) * 100.0 / COUNT(*) as rate
        FROM webhook_logs
        WHERE created_at >= ?
      `, [sevenDaysAgoStr]);

      // Tickets recentes (últimos 7 dias)
      const recentTickets = await dbGet(
        'SELECT COUNT(*) as count FROM tickets WHERE created_at >= ?',
        [sevenDaysAgoStr]
      );

      // Tickets resolvidos hoje
      const resolvedToday = await dbGet(
        `SELECT COUNT(*) as count FROM tickets 
         WHERE status IN ('resolved', 'closed') 
         AND updated_at >= ? AND updated_at <= ?`,
        [todayStartStr, todayEndStr]
      );

      // Tempo médio de resolução (últimos 30 dias; exclui tempo em pausa)
      const activeHoursExpr = DB_TYPE === 'sqlite'
        ? `(julianday(t.updated_at) - julianday(t.created_at)) * 24 - COALESCE((SELECT SUM((julianday(p.resumed_at) - julianday(p.paused_at)) * 24) FROM ticket_pauses p WHERE p.ticket_id = t.id AND p.resumed_at IS NOT NULL), 0)`
        : `EXTRACT(EPOCH FROM (t.updated_at - t.created_at)) / 3600 - COALESCE((SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (p.resumed_at - p.paused_at))), 0) / 3600 FROM ticket_pauses p WHERE p.ticket_id = t.id AND p.resumed_at IS NOT NULL), 0)`;
      const avgResolutionTime = await dbGet(`
        SELECT AVG(active_hours) as avg_hours
        FROM (
          SELECT ${activeHoursExpr} AS active_hours
          FROM tickets t
          WHERE t.status IN ('resolved', 'closed')
          AND t.created_at >= ?
        ) x
      `, [thirtyDaysAgoStr]);

      // Top formulários (substituindo categorias)
      const topForms = await dbAll(`
        SELECT 
          f.name,
          COUNT(t.id) as ticket_count
        FROM forms f
        LEFT JOIN tickets t ON f.id = t.form_id
        GROUP BY f.id, f.name
        ORDER BY ticket_count DESC
        LIMIT 5
      `);

      // Tickets por status (últimos 30 dias)
      const dateFormat = DB_TYPE === 'sqlite'
        ? "DATE(created_at)"
        : "DATE(created_at)";
      const ticketsLast30Days = await dbAll(`
        SELECT 
          ${dateFormat} as date,
          COUNT(*) as count
        FROM tickets
        WHERE created_at >= ?
        GROUP BY ${dateFormat}
        ORDER BY date ASC
      `, [thirtyDaysAgoStr]);

      res.json({
        tickets: {
          total: (totalTickets as any)?.count || 0,
          open: (openTickets as any)?.count || 0,
          inProgress: (inProgressTickets as any)?.count || 0,
          resolved: (resolvedTickets as any)?.count || 0,
          closed: (closedTickets as any)?.count || 0,
          pendingApproval: (pendingApproval as any)?.count || 0,
          recent: (recentTickets as any)?.count || 0,
          resolvedToday: (resolvedToday as any)?.count || 0,
          avgResolutionHours: Math.round(((avgResolutionTime as any)?.avg_hours || 0) * 100) / 100,
          byPriority: ticketsByPriority || []
        },
        users: {
          total: (totalUsers as any)?.count || 0,
          active: (activeUsers as any)?.count || 0
        },
        forms: {
          total: (totalForms as any)?.count || 0,
          active: (activeForms as any)?.count || 0
        },
        pages: {
          total: (totalPages as any)?.count || 0
        },
        groups: {
          total: (totalGroups as any)?.count || 0
        },
        webhooks: {
          total: (totalWebhooks as any)?.count || 0,
          active: (activeWebhooks as any)?.count || 0,
          callsToday: (webhookCallsToday as any)?.count || 0,
          callsLast7Days: (webhookCallsLast7Days as any)?.count || 0,
          successRate: Math.round(((webhookSuccessRate as any)?.rate || 0) * 100) / 100
        },
        topForms: topForms || [],
        timeline: ticketsLast30Days || []
      });
    } catch (error) {
      console.error('Erro ao buscar estatísticas do dashboard:', error);
      res.status(500).json({ error: 'Erro ao buscar estatísticas' });
    }
  }
);

export default router;
