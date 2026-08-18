import express from 'express';
import { dbGet, dbAll, getBrasiliaTimestamp } from '../database';
import { getTvConfig } from '../services/tv-config-service';

const router = express.Router();

function rowCount(row: any): number {
  const n = Number(row?.count);
  return isNaN(n) ? 0 : Math.max(0, Math.floor(n));
}

// Painel público (sem autenticação) para exibição em TVs.
// Não expõe título/descrição/solicitante dos tickets — apenas protocolo, prioridade, status e datas.
router.get('/stats', async (req, res) => {
  try {
    const nowStr = getBrasiliaTimestamp();
    const todayStartStr = nowStr.slice(0, 10) + ' 00:00:00';
    const todayEndStr = nowStr.slice(0, 10) + ' 23:59:59';

    const [openCount, inProgressCount, resolvedTodayCount] = await Promise.all([
      dbGet("SELECT COUNT(*) as count FROM tickets WHERE status = 'open'"),
      dbGet("SELECT COUNT(*) as count FROM tickets WHERE status = 'in_progress'"),
      dbGet(
        `SELECT COUNT(*) as count FROM tickets WHERE status IN ('resolved', 'closed') AND updated_at >= ? AND updated_at <= ?`,
        [todayStartStr, todayEndStr]
      )
    ]);

    // "Pausado" é derivado do cronômetro de colaboração: em progresso sem ninguém com o tempo rodando
    const IS_PAUSED_EXPR = `(CASE WHEN t.status = 'in_progress' AND NOT EXISTS (
      SELECT 1 FROM ticket_time_entries te WHERE te.ticket_id = t.id AND te.ended_at IS NULL
    ) THEN 1 ELSE 0 END)`;

    const queue = await dbAll(`
      SELECT t.ticket_number, t.created_at, t.status, t.priority,
             ${IS_PAUSED_EXPR} AS is_paused
      FROM tickets t
      WHERE t.status IN ('open', 'in_progress')
      ORDER BY
        CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
        t.created_at ASC
      LIMIT 30
    `);

    const latest = await dbAll(`
      SELECT t.ticket_number, t.created_at, t.status, t.priority,
             ${IS_PAUSED_EXPR} AS is_paused
      FROM tickets t
      ORDER BY t.created_at DESC
      LIMIT 10
    `);

    const scheduled = await dbAll(`
      SELECT t.ticket_number, t.created_at, t.scheduled_at, t.priority
      FROM tickets t
      WHERE t.status = 'scheduled'
      ORDER BY t.scheduled_at ASC
      LIMIT 30
    `);

    const rankingRaw = await dbAll(`
      SELECT
        a.id,
        a.name,
        COUNT(CASE WHEN t.status IN ('resolved', 'closed') AND t.updated_at >= ? AND t.updated_at <= ? THEN 1 END) as resolved_today,
        COUNT(CASE WHEN t.status IN ('open', 'in_progress') THEN 1 END) as open_now
      FROM users a
      LEFT JOIN tickets t ON t.assigned_to = a.id
      WHERE a.role IN ('agent', 'admin')
      GROUP BY a.id, a.name
    `, [todayStartStr, todayEndStr]);

    const ranking = (rankingRaw as any[])
      .map((r) => ({
        name: r.name,
        resolvedToday: rowCount({ count: r.resolved_today }),
        openNow: rowCount({ count: r.open_now })
      }))
      .filter((r) => r.resolvedToday > 0 || r.openNow > 0)
      .sort((a, b) => b.resolvedToday - a.resolvedToday || b.openNow - a.openNow)
      .slice(0, 10);

    res.json({
      generatedAt: nowStr,
      kpis: {
        open: rowCount(openCount),
        inProgress: rowCount(inProgressCount),
        resolvedToday: rowCount(resolvedTodayCount)
      },
      queue: (queue as any[]).map((t) => ({
        ticketNumber: t.ticket_number,
        createdAt: t.created_at,
        status: t.status,
        priority: t.priority,
        isPaused: Boolean(t.is_paused)
      })),
      latest: (latest as any[]).map((t) => ({
        ticketNumber: t.ticket_number,
        createdAt: t.created_at,
        status: t.status,
        priority: t.priority,
        isPaused: Boolean(t.is_paused)
      })),
      scheduled: (scheduled as any[]).map((t) => ({
        ticketNumber: t.ticket_number,
        createdAt: t.created_at,
        scheduledAt: t.scheduled_at,
        priority: t.priority,
        isLate: Boolean(t.scheduled_at) && new Date(t.scheduled_at).getTime() < Date.now()
      })),
      ranking
    });
  } catch (error) {
    console.error('Erro ao buscar estatísticas do painel TV:', error);
    res.status(500).json({ error: 'Erro ao buscar estatísticas' });
  }
});

// Painel público (sem autenticação): tempo do dashboard + slides ativos pra rotação na tela /tv.
router.get('/panel-config', async (req, res) => {
  try {
    const tvConfig = getTvConfig();
    const slides = await dbAll(`
      SELECT id, title, url, duration_seconds FROM tv_slides
      WHERE active = 1
      ORDER BY sort_order ASC, id ASC
    `);

    res.json({
      dashboardDurationSeconds: tvConfig.dashboardDurationSeconds,
      slides: (slides as any[]).map((s) => ({
        id: s.id,
        title: s.title,
        url: s.url,
        durationSeconds: s.duration_seconds
      }))
    });
  } catch (error) {
    console.error('Erro ao buscar configuração do painel de TV:', error);
    res.status(500).json({ error: 'Erro ao buscar configuração' });
  }
});

export default router;
