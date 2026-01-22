import express from 'express';
import { authenticate, AuthRequest, requireAdmin } from '../middleware/auth';
import { dbGet, dbAll } from '../database';

const DB_TYPE = process.env.DB_TYPE || 'sqlite';

const router = express.Router();

// Todas as rotas requerem autenticação e permissão de admin
router.use(authenticate);
router.use(requireAdmin);

// Função auxiliar para calcular período
function getDateRange(period: string): { start: string; end: string } {
  const now = new Date();
  const end = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  let start = new Date(end);

  switch (period) {
    case 'today':
      start.setHours(0, 0, 0, 0);
      break;
    case 'week':
      start.setDate(start.getDate() - 7);
      break;
    case 'month':
      start.setMonth(start.getMonth() - 1);
      break;
    case 'quarter':
      start.setMonth(start.getMonth() - 3);
      break;
    case 'year':
      start.setFullYear(start.getFullYear() - 1);
      break;
    default:
      start.setMonth(start.getMonth() - 1);
  }

  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  };

  return {
    start: formatDate(start),
    end: formatDate(end)
  };
}

// Estatísticas gerais
router.get('/overview', async (req: AuthRequest, res) => {
  try {
    const { period = 'month', start: customStart, end: customEnd } = req.query;
    
    let start: string, end: string;
    if (period === 'custom' && customStart && customEnd) {
      // Usar datas customizadas
      start = `${customStart} 00:00:00`;
      end = `${customEnd} 23:59:59`;
    } else {
      const dateRange = getDateRange(period as string);
      start = dateRange.start;
      end = dateRange.end;
    }

    // Total de tickets
    const totalTickets = await dbGet(
      `SELECT COUNT(*) as count FROM tickets WHERE created_at >= ? AND created_at <= ?`,
      [start, end]
    );

    // Tickets por status
    const ticketsByStatus = await dbAll(`
      SELECT status, COUNT(*) as count
      FROM tickets
      WHERE created_at >= ? AND created_at <= ?
      GROUP BY status
    `, [start, end]);

    // Tickets por prioridade
    const ticketsByPriority = await dbAll(`
      SELECT priority, COUNT(*) as count
      FROM tickets
      WHERE created_at >= ? AND created_at <= ?
      GROUP BY priority
    `, [start, end]);

    // Tempo médio de resolução (apenas tickets resolvidos/fechados)
    const timeDiffExpr = DB_TYPE === 'sqlite' 
      ? '(julianday(updated_at) - julianday(created_at)) * 24'
      : 'EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600';
    
    const avgResolutionTimeQuery = `
      SELECT 
        AVG(${timeDiffExpr}) as avg_hours
      FROM tickets
      WHERE status IN ('resolved', 'closed')
        AND created_at >= ? AND created_at <= ?
    `;
    
    const avgResolutionTime = await dbGet(avgResolutionTimeQuery, [start, end]);

    // Tickets resolvidos
    const resolvedTickets = await dbGet(
      `SELECT COUNT(*) as count FROM tickets 
       WHERE status IN ('resolved', 'closed') 
       AND created_at >= ? AND created_at <= ?`,
      [start, end]
    );

    // Taxa de resolução
    const total = (totalTickets as any)?.count || 0;
    const resolved = (resolvedTickets as any)?.count || 0;
    const resolutionRate = total > 0 ? (resolved / total) * 100 : 0;

    res.json({
      period,
      dateRange: { start, end },
      totalTickets: total,
      resolvedTickets: resolved,
      resolutionRate: Math.round(resolutionRate * 100) / 100,
      avgResolutionTimeHours: Math.round(((avgResolutionTime as any)?.avg_hours || 0) * 100) / 100,
      ticketsByStatus: ticketsByStatus || [],
      ticketsByPriority: ticketsByPriority || []
    });
  } catch (error) {
    console.error('Erro ao buscar estatísticas gerais:', error);
    res.status(500).json({ error: 'Erro ao buscar estatísticas' });
  }
});

// Tickets por formulário
router.get('/by-form', async (req: AuthRequest, res) => {
  try {
    const { period = 'month', start: customStart, end: customEnd } = req.query;
    
    let start: string, end: string;
    if (period === 'custom' && customStart && customEnd) {
      start = `${customStart} 00:00:00`;
      end = `${customEnd} 23:59:59`;
    } else {
      const dateRange = getDateRange(period as string);
      start = dateRange.start;
      end = dateRange.end;
    }

    const timeDiffFormExpr = DB_TYPE === 'sqlite' 
      ? '(julianday(t.updated_at) - julianday(t.created_at)) * 24'
      : 'EXTRACT(EPOCH FROM (t.updated_at - t.created_at)) / 3600';
    
    const ticketsByFormQuery = `
      SELECT 
        f.id,
        f.name,
        COUNT(t.id) as ticket_count,
        COUNT(CASE WHEN t.status IN ('resolved', 'closed') THEN 1 END) as resolved_count,
        AVG(
          CASE 
            WHEN t.status IN ('resolved', 'closed') 
            THEN ${timeDiffFormExpr}
            ELSE NULL
          END
        ) as avg_resolution_hours
      FROM forms f
      LEFT JOIN tickets t ON f.id = t.form_id 
        AND t.created_at >= ? AND t.created_at <= ?
      GROUP BY f.id, f.name
      HAVING ticket_count > 0
      ORDER BY ticket_count DESC
    `;
    
    const ticketsByForm = await dbAll(ticketsByFormQuery, [start, end]);

    res.json(ticketsByForm || []);
  } catch (error) {
    console.error('Erro ao buscar tickets por formulário:', error);
    res.status(500).json({ error: 'Erro ao buscar tickets por formulário' });
  }
});

// Performance de agentes
router.get('/agents-performance', async (req: AuthRequest, res) => {
  try {
    const { period = 'month', start: customStart, end: customEnd } = req.query;
    
    let start: string, end: string;
    if (period === 'custom' && customStart && customEnd) {
      start = `${customStart} 00:00:00`;
      end = `${customEnd} 23:59:59`;
    } else {
      const dateRange = getDateRange(period as string);
      start = dateRange.start;
      end = dateRange.end;
    }

    const timeDiffAgentExpr = DB_TYPE === 'sqlite' 
      ? '(julianday(t.updated_at) - julianday(t.created_at)) * 24'
      : 'EXTRACT(EPOCH FROM (t.updated_at - t.created_at)) / 3600';
    
    const agentPerformanceQuery = `
      SELECT 
        u.id,
        u.name,
        u.email,
        COUNT(t.id) as total_tickets,
        COUNT(CASE WHEN t.status IN ('resolved', 'closed') THEN 1 END) as resolved_tickets,
        AVG(
          CASE 
            WHEN t.status IN ('resolved', 'closed') 
            THEN ${timeDiffAgentExpr}
            ELSE NULL
          END
        ) as avg_resolution_hours,
        MIN(
          CASE 
            WHEN t.status IN ('resolved', 'closed') 
            THEN ${timeDiffAgentExpr}
            ELSE NULL
          END
        ) as min_resolution_hours,
        MAX(
          CASE 
            WHEN t.status IN ('resolved', 'closed') 
            THEN ${timeDiffAgentExpr}
            ELSE NULL
          END
        ) as max_resolution_hours
      FROM users u
      INNER JOIN tickets t ON u.id = t.assigned_to
      WHERE t.created_at >= ? AND t.created_at <= ?
        AND u.role IN ('agent', 'admin')
      GROUP BY u.id, u.name, u.email
      ORDER BY total_tickets DESC
    `;
    
    const agentPerformance = await dbAll(agentPerformanceQuery, [start, end]);

    res.json(agentPerformance || []);
  } catch (error) {
    console.error('Erro ao buscar performance de agentes:', error);
    res.status(500).json({ error: 'Erro ao buscar performance de agentes' });
  }
});

// Evolução de tickets ao longo do tempo
router.get('/timeline', async (req: AuthRequest, res) => {
  try {
    const { period = 'month', groupBy = 'day', start: customStart, end: customEnd } = req.query;
    
    let start: string, end: string;
    if (period === 'custom' && customStart && customEnd) {
      start = `${customStart} 00:00:00`;
      end = `${customEnd} 23:59:59`;
    } else {
      const dateRange = getDateRange(period as string);
      start = dateRange.start;
      end = dateRange.end;
    }

    let dateFormat: string;
    if (DB_TYPE === 'sqlite') {
      if (groupBy === 'day') {
        dateFormat = "DATE(created_at)";
      } else if (groupBy === 'week') {
        dateFormat = "strftime('%Y-W%W', created_at)";
      } else {
        dateFormat = "strftime('%Y-%m', created_at)";
      }
    } else {
      if (groupBy === 'day') {
        dateFormat = "DATE(created_at)";
      } else if (groupBy === 'week') {
        dateFormat = "TO_CHAR(created_at, 'IYYY-IW')";
      } else {
        dateFormat = "TO_CHAR(created_at, 'YYYY-MM')";
      }
    }

    const timeline = await dbAll(`
      SELECT 
        ${dateFormat} as period,
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'open' THEN 1 END) as open,
        COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress,
        COUNT(CASE WHEN status IN ('resolved', 'closed') THEN 1 END) as resolved
      FROM tickets
      WHERE created_at >= ? AND created_at <= ?
      GROUP BY ${dateFormat}
      ORDER BY period ASC
    `, [start, end]);

    res.json(timeline || []);
  } catch (error) {
    console.error('Erro ao buscar timeline:', error);
    res.status(500).json({ error: 'Erro ao buscar timeline' });
  }
});

// Tempo médio de resposta por prioridade
router.get('/response-time-by-priority', async (req: AuthRequest, res) => {
  try {
    const { period = 'month', start: customStart, end: customEnd } = req.query;
    
    let start: string, end: string;
    if (period === 'custom' && customStart && customEnd) {
      start = `${customStart} 00:00:00`;
      end = `${customEnd} 23:59:59`;
    } else {
      const dateRange = getDateRange(period as string);
      start = dateRange.start;
      end = dateRange.end;
    }

    const timeDiffPriorityExpr = DB_TYPE === 'sqlite' 
      ? '(julianday(updated_at) - julianday(created_at)) * 24'
      : 'EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600';
    
    const responseTimeQuery = `
      SELECT 
        priority,
        COUNT(*) as total_tickets,
        AVG(
          CASE 
            WHEN status IN ('resolved', 'closed') 
            THEN ${timeDiffPriorityExpr}
            ELSE NULL
          END
        ) as avg_hours,
        MIN(
          CASE 
            WHEN status IN ('resolved', 'closed') 
            THEN ${timeDiffPriorityExpr}
            ELSE NULL
          END
        ) as min_hours,
        MAX(
          CASE 
            WHEN status IN ('resolved', 'closed') 
            THEN ${timeDiffPriorityExpr}
            ELSE NULL
          END
        ) as max_hours
      FROM tickets
      WHERE created_at >= ? AND created_at <= ?
        AND status IN ('resolved', 'closed')
      GROUP BY priority
      ORDER BY 
        CASE priority
          WHEN 'urgent' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
        END
    `;
    
    const responseTime = await dbAll(responseTimeQuery, [start, end]);

    res.json(responseTime || []);
  } catch (error) {
    console.error('Erro ao buscar tempo de resposta por prioridade:', error);
    res.status(500).json({ error: 'Erro ao buscar tempo de resposta' });
  }
});

// Categorias mais utilizadas
router.get('/by-category', async (req: AuthRequest, res) => {
  try {
    const { period = 'month' } = req.query;
    const { start, end } = getDateRange(period as string);

    const byCategory = await dbAll(`
      SELECT 
        c.id,
        c.name,
        COUNT(t.id) as ticket_count,
        COUNT(CASE WHEN t.status IN ('resolved', 'closed') THEN 1 END) as resolved_count
      FROM categories c
      LEFT JOIN tickets t ON c.id = t.category_id 
        AND t.created_at >= ? AND t.created_at <= ?
      GROUP BY c.id, c.name
      HAVING ticket_count > 0
      ORDER BY ticket_count DESC
    `, [start, end]);

    res.json(byCategory || []);
  } catch (error) {
    console.error('Erro ao buscar tickets por categoria:', error);
    res.status(500).json({ error: 'Erro ao buscar tickets por categoria' });
  }
});

export default router;
