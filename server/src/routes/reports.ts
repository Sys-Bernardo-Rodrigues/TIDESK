import express, { Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requirePermission, RESOURCES, ACTIONS } from '../middleware/permissions';
import { dbAll } from '../database';

const DB_TYPE = process.env.DB_TYPE || 'sqlite';

const router = express.Router();

// Segundos totais em pausa de um ticket (mesmo padrão usado em routes/tickets.ts)
const TOTAL_PAUSE_SECONDS = DB_TYPE === 'sqlite'
  ? `(SELECT COALESCE(SUM((julianday(COALESCE(p.resumed_at, datetime('now', '-3 hours'))) - julianday(p.paused_at)) * 86400), 0) FROM ticket_pauses p WHERE p.ticket_id = t.id)`
  : `(SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(p.resumed_at, (NOW() AT TIME ZONE 'America/Sao_Paulo')) - p.paused_at))), 0)::bigint FROM ticket_pauses p WHERE p.ticket_id = t.id)`;

function inRange(dateStr: string | null | undefined, start: Date | null, end: Date | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (start && d < start) return false;
  if (end && d > end) return false;
  return true;
}

function hoursBetween(fromStr: string, toStr: string, pauseSeconds = 0): number {
  const from = new Date(fromStr).getTime();
  const to = new Date(toStr).getTime();
  const ms = Math.max(0, to - from - pauseSeconds * 1000);
  return ms / (1000 * 60 * 60);
}

// Métricas completas por usuário (tickets, tempo colaborativo, mensagens, plantão) — todos os usuários, não só agent/admin
router.get('/agents', authenticate, requirePermission(RESOURCES.REPORTS, ACTIONS.VIEW), async (req: AuthRequest, res: Response) => {
  try {
    const startParam = req.query.start as string | undefined;
    const endParam = req.query.end as string | undefined;
    const start = startParam ? new Date(`${startParam}T00:00:00`) : null;
    const end = endParam ? new Date(`${endParam}T23:59:59`) : null;

    const agents = await dbAll(
      `SELECT id, name, email, role FROM users ORDER BY name`
    ) as Array<{ id: number; name: string; email: string; role: string }>;

    const tickets = await dbAll(`
      SELECT id, assigned_to, status, priority, created_at, assigned_at, updated_at,
             ${TOTAL_PAUSE_SECONDS} AS total_pause_seconds
      FROM tickets t
      WHERE t.assigned_to IS NOT NULL
    `) as Array<{
      id: number; assigned_to: number; status: string; priority: string;
      created_at: string; assigned_at: string | null; updated_at: string; total_pause_seconds: number;
    }>;

    const messages = await dbAll(`SELECT user_id, created_at FROM ticket_messages`) as Array<{ user_id: number; created_at: string }>;

    const timeEntries = await dbAll(`SELECT user_id, ticket_id, started_at, ended_at FROM ticket_time_entries`) as Array<{
      user_id: number; ticket_id: number; started_at: string; ended_at: string | null;
    }>;

    const shiftRows = await dbAll(`
      SELECT su.user_id, s.start_time, s.end_time
      FROM shift_users su
      JOIN shifts s ON su.shift_id = s.id
    `) as Array<{ user_id: number; start_time: string; end_time: string }>;

    const now = new Date();
    const nowMs = now.getTime();

    const result = agents.map((agent) => {
      const myTickets = tickets.filter((t) => t.assigned_to === agent.id);

      const backlog = myTickets.filter((t) => t.status === 'open' || t.status === 'in_progress' || t.status === 'scheduled');
      const pendingApproval = myTickets.filter((t) => t.status === 'pending_approval').length;

      const overdueOpen = backlog.filter((t) => {
        const ageHours = (nowMs - new Date(t.created_at).getTime()) / (1000 * 60 * 60);
        return (t.status === 'open' || t.status === 'in_progress') && ageHours >= 24;
      }).length;

      const resolvedPeriod = myTickets.filter(
        (t) => (t.status === 'resolved' || t.status === 'closed' || t.status === 'rejected') && inRange(t.updated_at, start, end)
      );

      const resolutionHours = resolvedPeriod
        .filter((t) => t.status === 'resolved' || t.status === 'closed')
        .map((t) => hoursBetween(t.assigned_at || t.created_at, t.updated_at, t.total_pause_seconds));

      const avgResolutionHours = resolutionHours.length
        ? resolutionHours.reduce((s, h) => s + h, 0) / resolutionHours.length
        : 0;
      const fastestResolutionHours = resolutionHours.length ? Math.min(...resolutionHours) : null;
      const slowestResolutionHours = resolutionHours.length ? Math.max(...resolutionHours) : null;

      const byPriority = { urgent: 0, high: 0, medium: 0, low: 0 } as Record<string, number>;
      resolvedPeriod.forEach((t) => {
        if (byPriority[t.priority] !== undefined) byPriority[t.priority]++;
      });

      const myMessages = messages.filter((m) => m.user_id === agent.id && inRange(m.created_at, start, end)).length;

      const myTimeEntries = timeEntries.filter((te) => te.user_id === agent.id && inRange(te.started_at, start, end));
      const collabSeconds = myTimeEntries.reduce((sum, te) => {
        const endedAt = te.ended_at || now.toISOString();
        return sum + Math.max(0, (new Date(endedAt).getTime() - new Date(te.started_at).getTime()) / 1000);
      }, 0);
      const ticketsCollaborated = new Set(myTimeEntries.map((te) => te.ticket_id)).size;

      const myShifts = shiftRows.filter((s) => s.user_id === agent.id && inRange(s.start_time, start, end));
      const shiftHours = myShifts.reduce((sum, s) => sum + hoursBetween(s.start_time, s.end_time), 0);

      return {
        user_id: agent.id,
        name: agent.name,
        email: agent.email,
        role: agent.role,
        backlog: {
          open: backlog.filter((t) => t.status === 'open').length,
          in_progress: backlog.filter((t) => t.status === 'in_progress').length,
          scheduled: backlog.filter((t) => t.status === 'scheduled').length,
          pending_approval: pendingApproval,
          overdue: overdueOpen,
        },
        resolved: {
          resolved: resolvedPeriod.filter((t) => t.status === 'resolved').length,
          closed: resolvedPeriod.filter((t) => t.status === 'closed').length,
          rejected: resolvedPeriod.filter((t) => t.status === 'rejected').length,
          total: resolvedPeriod.length,
          by_priority: byPriority,
        },
        resolution_time: {
          avg_hours: Math.round(avgResolutionHours * 100) / 100,
          fastest_hours: fastestResolutionHours != null ? Math.round(fastestResolutionHours * 100) / 100 : null,
          slowest_hours: slowestResolutionHours != null ? Math.round(slowestResolutionHours * 100) / 100 : null,
        },
        activity: {
          messages_sent: myMessages,
        },
        collaboration: {
          time_seconds: Math.round(collabSeconds),
          tickets_collaborated: ticketsCollaborated,
        },
        shifts: {
          count: myShifts.length,
          hours: Math.round(shiftHours * 100) / 100,
        },
      };
    });

    res.json({
      period: { start: startParam || null, end: endParam || null },
      agents: result,
    });
  } catch (error) {
    console.error('Erro ao buscar métricas de atendentes:', error);
    res.status(500).json({ error: 'Erro ao buscar métricas de atendentes' });
  }
});

// Visão geral de tickets no período (status, prioridade, categorias, formulários, linha do tempo)
router.get('/overview', authenticate, requirePermission(RESOURCES.REPORTS, ACTIONS.VIEW), async (req: AuthRequest, res: Response) => {
  try {
    const startParam = req.query.start as string | undefined;
    const endParam = req.query.end as string | undefined;
    const start = startParam ? new Date(`${startParam}T00:00:00`) : null;
    const end = endParam ? new Date(`${endParam}T23:59:59`) : null;

    const tickets = await dbAll(`
      SELECT t.id, t.status, t.priority, t.created_at, t.assigned_at, t.updated_at,
             ${TOTAL_PAUSE_SECONDS} AS total_pause_seconds,
             c.name as category_name, f.name as form_name
      FROM tickets t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN forms f ON t.form_id = f.id
    `) as Array<{
      id: number; status: string; priority: string; created_at: string; assigned_at: string | null;
      updated_at: string; total_pause_seconds: number; category_name: string | null; form_name: string | null;
    }>;

    const nowMs = Date.now();

    const createdPeriod = tickets.filter((t) => inRange(t.created_at, start, end));
    const resolvedPeriod = tickets.filter(
      (t) => (t.status === 'resolved' || t.status === 'closed' || t.status === 'rejected') && inRange(t.updated_at, start, end)
    );

    const priorityCount = { urgent: 0, high: 0, medium: 0, low: 0 } as Record<string, number>;
    createdPeriod.forEach((t) => {
      if (priorityCount[t.priority] !== undefined) priorityCount[t.priority]++;
    });

    const resolutionHours = resolvedPeriod
      .filter((t) => t.status === 'resolved' || t.status === 'closed')
      .map((t) => hoursBetween(t.assigned_at || t.created_at, t.updated_at, t.total_pause_seconds));
    const avgResolutionHours = resolutionHours.length ? resolutionHours.reduce((s, h) => s + h, 0) / resolutionHours.length : 0;

    const backlogOpen = tickets.filter((t) => t.status === 'open').length;
    const backlogInProgress = tickets.filter((t) => t.status === 'in_progress').length;
    const backlogScheduled = tickets.filter((t) => t.status === 'scheduled').length;
    const backlogPendingApproval = tickets.filter((t) => t.status === 'pending_approval').length;
    const overdueCount = tickets.filter((t) => {
      if (t.status !== 'open' && t.status !== 'in_progress') return false;
      const ageHours = (nowMs - new Date(t.created_at).getTime()) / (1000 * 60 * 60);
      return ageHours >= 24;
    }).length;

    const countBy = (key: 'category_name' | 'form_name') => {
      const map = new Map<string, number>();
      createdPeriod.forEach((t) => {
        const label = t[key];
        if (!label) return;
        map.set(label, (map.get(label) || 0) + 1);
      });
      return Array.from(map.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);
    };

    // Linha do tempo: tickets criados por dia dentro do período (limitado a 60 dias pra não pesar o gráfico)
    const timelineMap = new Map<string, number>();
    createdPeriod.forEach((t) => {
      const day = String(t.created_at).slice(0, 10);
      timelineMap.set(day, (timelineMap.get(day) || 0) + 1);
    });
    const timeline = Array.from(timelineMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-60);

    res.json({
      period: { start: startParam || null, end: endParam || null },
      created: {
        total: createdPeriod.length,
        by_priority: priorityCount,
      },
      resolved: {
        total: resolvedPeriod.length,
        resolved: resolvedPeriod.filter((t) => t.status === 'resolved').length,
        closed: resolvedPeriod.filter((t) => t.status === 'closed').length,
        rejected: resolvedPeriod.filter((t) => t.status === 'rejected').length,
        avg_resolution_hours: Math.round(avgResolutionHours * 100) / 100,
      },
      backlog: {
        open: backlogOpen,
        in_progress: backlogInProgress,
        scheduled: backlogScheduled,
        pending_approval: backlogPendingApproval,
        overdue: overdueCount,
      },
      top_categories: countBy('category_name'),
      top_forms: countBy('form_name'),
      timeline,
    });
  } catch (error) {
    console.error('Erro ao buscar visão geral de tickets:', error);
    res.status(500).json({ error: 'Erro ao buscar visão geral de tickets' });
  }
});

export default router;
