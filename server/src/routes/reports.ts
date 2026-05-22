import express from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requirePermission, RESOURCES, ACTIONS } from '../middleware/permissions';
import { dbGet, dbAll } from '../database';
import {
  getReportDateRange,
  activeResolutionHoursExpr,
  toNumber,
  round2,
  type ReportPeriodQuery,
} from '../utils/report-period';

const DB_TYPE = process.env.DB_TYPE || 'sqlite';

const router = express.Router();

router.use(authenticate);

function resolveRange(query: ReportPeriodQuery) {
  return getReportDateRange(query);
}

const ACTIVE_HOURS = activeResolutionHoursExpr(DB_TYPE);

// Estatísticas gerais
router.get('/overview', requirePermission(RESOURCES.REPORTS, ACTIONS.VIEW), async (req: AuthRequest, res) => {
  try {
    const { start, end, period } = resolveRange(req.query as ReportPeriodQuery);

    const totalTickets = await dbGet(
      `SELECT COUNT(*) as count FROM tickets WHERE created_at >= ? AND created_at <= ?`,
      [start, end]
    );

    const ticketsByStatus = await dbAll(
      `SELECT status, COUNT(*) as count FROM tickets
       WHERE created_at >= ? AND created_at <= ?
       GROUP BY status ORDER BY count DESC`,
      [start, end]
    );

    const ticketsByPriority = await dbAll(
      `SELECT priority, COUNT(*) as count FROM tickets
       WHERE created_at >= ? AND created_at <= ?
       GROUP BY priority ORDER BY count DESC`,
      [start, end]
    );

    // Resolvidos no período (data de conclusão = updated_at)
    const resolvedInPeriod = await dbGet(
      `SELECT COUNT(*) as count FROM tickets
       WHERE status IN ('resolved', 'closed')
         AND updated_at >= ? AND updated_at <= ?`,
      [start, end]
    );

    // Do lote criado no período, quantos já estão resolvidos/fechados (taxa de conclusão do lote)
    const cohortResolved = await dbGet(
      `SELECT COUNT(*) as count FROM tickets
       WHERE created_at >= ? AND created_at <= ?
         AND status IN ('resolved', 'closed')`,
      [start, end]
    );

    const avgResolutionTime = await dbGet(
      `SELECT AVG(active_hours) as avg_hours FROM (
        SELECT ${ACTIVE_HOURS} AS active_hours
        FROM tickets t
        WHERE t.status IN ('resolved', 'closed')
          AND t.updated_at >= ? AND t.updated_at <= ?
      ) x WHERE active_hours IS NOT NULL`,
      [start, end]
    );

    const total = toNumber((totalTickets as any)?.count);
    const resolvedInPeriodCount = toNumber((resolvedInPeriod as any)?.count);
    const cohortResolvedCount = toNumber((cohortResolved as any)?.count);
    const resolutionRate = total > 0 ? (cohortResolvedCount / total) * 100 : 0;

    res.json({
      period,
      dateRange: { start, end },
      totalTickets: total,
      resolvedTickets: resolvedInPeriodCount,
      resolvedInPeriod: resolvedInPeriodCount,
      cohortResolved: cohortResolvedCount,
      resolutionRate: round2(resolutionRate),
      avgResolutionTimeHours: round2(toNumber((avgResolutionTime as any)?.avg_hours)),
      ticketsByStatus: (ticketsByStatus || []).map((r: any) => ({
        status: r.status,
        count: toNumber(r.count),
      })),
      ticketsByPriority: (ticketsByPriority || []).map((r: any) => ({
        priority: r.priority,
        count: toNumber(r.count),
      })),
    });
  } catch (error) {
    console.error('Erro ao buscar estatísticas gerais:', error);
    res.status(500).json({ error: 'Erro ao buscar estatísticas' });
  }
});

// Tickets por formulário
router.get('/by-form', requirePermission(RESOURCES.REPORTS, ACTIONS.VIEW), async (req: AuthRequest, res) => {
  try {
    const { start, end } = resolveRange(req.query as ReportPeriodQuery);

    const ticketsByForm = await dbAll(
      `SELECT
        f.id,
        f.name,
        COUNT(t.id) as ticket_count,
        COUNT(CASE WHEN t.status IN ('resolved', 'closed') THEN 1 END) as resolved_count,
        AVG(
          CASE WHEN t.status IN ('resolved', 'closed')
            AND t.updated_at >= ? AND t.updated_at <= ?
          THEN ${ACTIVE_HOURS}
          ELSE NULL END
        ) as avg_resolution_hours
      FROM forms f
      INNER JOIN tickets t ON f.id = t.form_id
        AND t.created_at >= ? AND t.created_at <= ?
      GROUP BY f.id, f.name
      ORDER BY ticket_count DESC`,
      [start, end, start, end]
    );

    res.json(
      (ticketsByForm || []).map((r: any) => ({
        id: r.id,
        name: r.name,
        ticket_count: toNumber(r.ticket_count),
        resolved_count: toNumber(r.resolved_count),
        avg_resolution_hours:
          r.avg_resolution_hours != null ? round2(toNumber(r.avg_resolution_hours)) : null,
      }))
    );
  } catch (error) {
    console.error('Erro ao buscar tickets por formulário:', error);
    res.status(500).json({ error: 'Erro ao buscar tickets por formulário' });
  }
});

// Performance de agentes
router.get('/agents-performance', requirePermission(RESOURCES.REPORTS, ACTIONS.VIEW), async (req: AuthRequest, res) => {
  try {
    const { start, end } = resolveRange(req.query as ReportPeriodQuery);

    const agentPerformance = await dbAll(
      `SELECT
        u.id,
        u.name,
        u.email,
        COUNT(t.id) as total_tickets,
        COUNT(CASE WHEN t.status IN ('resolved', 'closed')
          AND t.updated_at >= ? AND t.updated_at <= ? THEN 1 END) as resolved_tickets,
        AVG(
          CASE WHEN t.status IN ('resolved', 'closed')
            AND t.updated_at >= ? AND t.updated_at <= ?
          THEN ${ACTIVE_HOURS}
          ELSE NULL END
        ) as avg_resolution_hours,
        MIN(
          CASE WHEN t.status IN ('resolved', 'closed')
            AND t.updated_at >= ? AND t.updated_at <= ?
          THEN ${ACTIVE_HOURS}
          ELSE NULL END
        ) as min_resolution_hours,
        MAX(
          CASE WHEN t.status IN ('resolved', 'closed')
            AND t.updated_at >= ? AND t.updated_at <= ?
          THEN ${ACTIVE_HOURS}
          ELSE NULL END
        ) as max_resolution_hours
      FROM users u
      INNER JOIN tickets t ON u.id = t.assigned_to
      WHERE COALESCE(t.assigned_at, t.created_at) >= ?
        AND COALESCE(t.assigned_at, t.created_at) <= ?
      GROUP BY u.id, u.name, u.email
      ORDER BY total_tickets DESC`,
      [start, end, start, end, start, end, start, end, start, end]
    );

    res.json(
      (agentPerformance || []).map((r: any) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        total_tickets: toNumber(r.total_tickets),
        resolved_tickets: toNumber(r.resolved_tickets),
        avg_resolution_hours:
          r.avg_resolution_hours != null ? round2(toNumber(r.avg_resolution_hours)) : null,
        min_resolution_hours:
          r.min_resolution_hours != null ? round2(toNumber(r.min_resolution_hours)) : null,
        max_resolution_hours:
          r.max_resolution_hours != null ? round2(toNumber(r.max_resolution_hours)) : null,
      }))
    );
  } catch (error) {
    console.error('Erro ao buscar performance de agentes:', error);
    res.status(500).json({ error: 'Erro ao buscar performance de agentes' });
  }
});

// Evolução: tickets criados e resolvidos por dia
router.get('/timeline', requirePermission(RESOURCES.REPORTS, ACTIONS.VIEW), async (req: AuthRequest, res) => {
  try {
    const { start, end, period } = resolveRange(req.query as ReportPeriodQuery);
    const groupBy = (req.query.groupBy as string) || 'day';

    let dateFormatCreated: string;
    let dateFormatUpdated: string;
    if (DB_TYPE === 'sqlite') {
      if (groupBy === 'week') {
        dateFormatCreated = "strftime('%Y-W%W', created_at)";
        dateFormatUpdated = "strftime('%Y-W%W', updated_at)";
      } else if (groupBy === 'month') {
        dateFormatCreated = "strftime('%Y-%m', created_at)";
        dateFormatUpdated = "strftime('%Y-%m', updated_at)";
      } else {
        dateFormatCreated = 'DATE(created_at)';
        dateFormatUpdated = 'DATE(updated_at)';
      }
    } else {
      if (groupBy === 'week') {
        dateFormatCreated = "TO_CHAR(created_at, 'IYYY-IW')";
        dateFormatUpdated = "TO_CHAR(updated_at, 'IYYY-IW')";
      } else if (groupBy === 'month') {
        dateFormatCreated = "TO_CHAR(created_at, 'YYYY-MM')";
        dateFormatUpdated = "TO_CHAR(updated_at, 'YYYY-MM')";
      } else {
        dateFormatCreated = 'DATE(created_at)';
        dateFormatUpdated = 'DATE(updated_at)';
      }
    }

    const created = await dbAll(
      `SELECT ${dateFormatCreated} as period, COUNT(*) as total
       FROM tickets WHERE created_at >= ? AND created_at <= ?
       GROUP BY ${dateFormatCreated}`,
      [start, end]
    );

    const resolved = await dbAll(
      `SELECT ${dateFormatUpdated} as period, COUNT(*) as resolved
       FROM tickets
       WHERE status IN ('resolved', 'closed')
         AND updated_at >= ? AND updated_at <= ?
       GROUP BY ${dateFormatUpdated}`,
      [start, end]
    );

    const map = new Map<string, { period: string; total: number; resolved: number; open: number; in_progress: number }>();

    for (const row of created as any[]) {
      const key = String(row.period);
      map.set(key, {
        period: key,
        total: toNumber(row.total),
        resolved: 0,
        open: 0,
        in_progress: 0,
      });
    }

    for (const row of resolved as any[]) {
      const key = String(row.period);
      const existing = map.get(key) || {
        period: key,
        total: 0,
        resolved: 0,
        open: 0,
        in_progress: 0,
      };
      existing.resolved = toNumber(row.resolved);
      map.set(key, existing);
    }

    const timeline = Array.from(map.values()).sort((a, b) =>
      a.period.localeCompare(b.period)
    );

    res.json(timeline);
  } catch (error) {
    console.error('Erro ao buscar timeline:', error);
    res.status(500).json({ error: 'Erro ao buscar timeline' });
  }
});

// Tempo médio de resolução por prioridade (tickets concluídos no período)
router.get('/response-time-by-priority', requirePermission(RESOURCES.REPORTS, ACTIONS.VIEW), async (req: AuthRequest, res) => {
  try {
    const { start, end } = resolveRange(req.query as ReportPeriodQuery);

    const responseTime = await dbAll(
      `SELECT
        t.priority,
        COUNT(*) as total_tickets,
        AVG(${ACTIVE_HOURS}) as avg_hours,
        MIN(${ACTIVE_HOURS}) as min_hours,
        MAX(${ACTIVE_HOURS}) as max_hours
      FROM tickets t
      WHERE t.status IN ('resolved', 'closed')
        AND t.updated_at >= ? AND t.updated_at <= ?
      GROUP BY t.priority
      ORDER BY CASE t.priority
        WHEN 'urgent' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        WHEN 'low' THEN 4
        ELSE 5
      END`,
      [start, end]
    );

    res.json(
      (responseTime || []).map((r: any) => ({
        priority: r.priority,
        total_tickets: toNumber(r.total_tickets),
        avg_hours: round2(toNumber(r.avg_hours)),
        min_hours: round2(toNumber(r.min_hours)),
        max_hours: round2(toNumber(r.max_hours)),
      }))
    );
  } catch (error) {
    console.error('Erro ao buscar tempo de resposta por prioridade:', error);
    res.status(500).json({ error: 'Erro ao buscar tempo de resposta' });
  }
});

// Métricas gerais do sistema (contagens atuais)
router.get('/system', requirePermission(RESOURCES.REPORTS, ACTIONS.VIEW), async (_req: AuthRequest, res) => {
  try {
    const [users, forms, pages, groups, projects, projectTasks, projectTasksOpen, pendingApproval] =
      await Promise.all([
        dbGet('SELECT COUNT(*) as count FROM users'),
        dbGet('SELECT COUNT(*) as count FROM forms'),
        dbGet('SELECT COUNT(*) as count FROM pages'),
        dbGet('SELECT COUNT(*) as count FROM groups'),
        dbGet('SELECT COUNT(*) as count FROM projects'),
        dbGet('SELECT COUNT(*) as count FROM project_tasks'),
        dbGet('SELECT COUNT(*) as count FROM project_tasks WHERE completed_at IS NULL'),
        dbGet("SELECT COUNT(*) as count FROM tickets WHERE status = 'pending_approval'"),
      ]);

    res.json({
      users: toNumber((users as any)?.count),
      forms: toNumber((forms as any)?.count),
      pages: toNumber((pages as any)?.count),
      groups: toNumber((groups as any)?.count),
      projects: toNumber((projects as any)?.count),
      projectTasks: toNumber((projectTasks as any)?.count),
      projectTasksOpen: toNumber((projectTasksOpen as any)?.count),
      ticketsPendingApproval: toNumber((pendingApproval as any)?.count),
    });
  } catch (error) {
    console.error('Erro ao buscar métricas do sistema:', error);
    res.status(500).json({ error: 'Erro ao buscar métricas do sistema' });
  }
});

// Categorias mais utilizadas
router.get('/by-category', requirePermission(RESOURCES.REPORTS, ACTIONS.VIEW), async (req: AuthRequest, res) => {
  try {
    const { start, end } = resolveRange(req.query as ReportPeriodQuery);

    const byCategory = await dbAll(
      `SELECT
        c.id,
        c.name,
        COUNT(t.id) as ticket_count,
        COUNT(CASE WHEN t.status IN ('resolved', 'closed') THEN 1 END) as resolved_count
      FROM categories c
      INNER JOIN tickets t ON c.id = t.category_id
        AND t.created_at >= ? AND t.created_at <= ?
      GROUP BY c.id, c.name
      ORDER BY ticket_count DESC`,
      [start, end]
    );

    res.json(
      (byCategory || []).map((r: any) => ({
        id: r.id,
        name: r.name,
        ticket_count: toNumber(r.ticket_count),
        resolved_count: toNumber(r.resolved_count),
      }))
    );
  } catch (error) {
    console.error('Erro ao buscar tickets por categoria:', error);
    res.status(500).json({ error: 'Erro ao buscar tickets por categoria' });
  }
});

// Estatísticas de webhooks
router.get('/webhooks', requirePermission(RESOURCES.REPORTS, ACTIONS.VIEW), async (req: AuthRequest, res) => {
  try {
    const { start, end, period } = resolveRange(req.query as ReportPeriodQuery);

    const totalWebhooks = await dbGet('SELECT COUNT(*) as count FROM webhooks');
    const activeWebhooks = await dbGet('SELECT COUNT(*) as count FROM webhooks WHERE active = 1');

    const totalCalls = await dbGet(
      'SELECT COUNT(*) as count FROM webhook_logs WHERE created_at >= ? AND created_at <= ?',
      [start, end]
    );

    const successCalls = await dbGet(
      `SELECT COUNT(*) as count FROM webhook_logs
       WHERE status = 'success' AND created_at >= ? AND created_at <= ?`,
      [start, end]
    );

    const errorCalls = await dbGet(
      `SELECT COUNT(*) as count FROM webhook_logs
       WHERE status = 'error' AND created_at >= ? AND created_at <= ?`,
      [start, end]
    );

    const ticketsFromWebhooks = await dbGet(
      `SELECT COUNT(DISTINCT wl.ticket_id) as count
       FROM webhook_logs wl
       WHERE wl.ticket_id IS NOT NULL
         AND wl.created_at >= ? AND wl.created_at <= ?`,
      [start, end]
    );

    const total = toNumber((totalCalls as any)?.count);
    const success = toNumber((successCalls as any)?.count);
    const successRate = total > 0 ? (success / total) * 100 : 0;

    const dateFormat = DB_TYPE === 'sqlite' ? 'DATE(created_at)' : 'DATE(created_at)';
    const topWebhooks = await dbAll(
      `SELECT
        w.id,
        w.name,
        COUNT(wl.id) as total_calls,
        COUNT(CASE WHEN wl.status = 'success' THEN 1 END) as success_calls,
        COUNT(CASE WHEN wl.status = 'error' THEN 1 END) as error_calls,
        COUNT(DISTINCT wl.ticket_id) as tickets_created
      FROM webhooks w
      LEFT JOIN webhook_logs wl ON w.id = wl.webhook_id
        AND wl.created_at >= ? AND wl.created_at <= ?
      GROUP BY w.id, w.name
      HAVING COUNT(wl.id) > 0
      ORDER BY total_calls DESC
      LIMIT 10`,
      [start, end]
    );

    const callsTimeline = await dbAll(
      `SELECT
        ${dateFormat} as date,
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'success' THEN 1 END) as success,
        COUNT(CASE WHEN status = 'error' THEN 1 END) as error
      FROM webhook_logs
      WHERE created_at >= ? AND created_at <= ?
      GROUP BY ${dateFormat}
      ORDER BY date ASC`,
      [start, end]
    );

    res.json({
      period,
      dateRange: { start, end },
      totalWebhooks: toNumber((totalWebhooks as any)?.count),
      activeWebhooks: toNumber((activeWebhooks as any)?.count),
      totalCalls: total,
      successCalls: success,
      errorCalls: toNumber((errorCalls as any)?.count),
      ticketsCreated: toNumber((ticketsFromWebhooks as any)?.count),
      successRate: round2(successRate),
      topWebhooks: (topWebhooks || []).map((w: any) => ({
        id: w.id,
        name: w.name,
        total_calls: toNumber(w.total_calls),
        success_calls: toNumber(w.success_calls),
        error_calls: toNumber(w.error_calls),
        tickets_created: toNumber(w.tickets_created),
      })),
      timeline: (callsTimeline || []).map((r: any) => ({
        date: r.date,
        total: toNumber(r.total),
        success: toNumber(r.success),
        error: toNumber(r.error),
      })),
    });
  } catch (error) {
    console.error('Erro ao buscar estatísticas de webhooks:', error);
    res.status(500).json({ error: 'Erro ao buscar estatísticas de webhooks' });
  }
});

export default router;
