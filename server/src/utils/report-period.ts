import { getBrasiliaTimestamp } from '../database';

export type ReportPeriodQuery = {
  period?: string;
  start?: string;
  end?: string;
};

/** Formata instante no fuso America/Sao_Paulo como YYYY-MM-DD HH:mm:ss */
export function formatBrasiliaDateTime(date: Date, endOfDay = false): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value || '';
  const y = get('year');
  const m = get('month');
  const d = get('day');
  if (endOfDay) return `${y}-${m}-${d} 23:59:59`;
  return `${y}-${m}-${d} ${get('hour')}:${get('minute')}:${get('second')}`;
}

export function getReportDateRange(query: ReportPeriodQuery): { start: string; end: string; period: string } {
  const period = (query.period as string) || 'month';

  if (period === 'custom' && query.start && query.end) {
    return {
      period: 'custom',
      start: `${query.start} 00:00:00`,
      end: `${query.end} 23:59:59`,
    };
  }

  const now = new Date();
  const todayKey = formatBrasiliaDateTime(now).slice(0, 10);
  let startDate = new Date(now.getTime());

  switch (period) {
    case 'today':
      return { period, start: `${todayKey} 00:00:00`, end: `${todayKey} 23:59:59` };
    case 'week':
      startDate.setTime(startDate.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'quarter':
      startDate.setMonth(startDate.getMonth() - 3);
      break;
    case 'year':
      startDate.setFullYear(startDate.getFullYear() - 1);
      break;
    case 'month':
    default:
      startDate.setMonth(startDate.getMonth() - 1);
      break;
  }

  return {
    period,
    start: formatBrasiliaDateTime(startDate),
    end: getBrasiliaTimestamp(),
  };
}

/** Tempo ativo (horas) entre assumir o ticket e resolver, descontando pausas concluídas */
export function activeResolutionHoursExpr(dbType: string): string {
  const pauseSqlite = `(SELECT COALESCE(SUM((julianday(p.resumed_at) - julianday(p.paused_at)) * 24), 0) FROM ticket_pauses p WHERE p.ticket_id = t.id AND p.resumed_at IS NOT NULL AND p.paused_at IS NOT NULL)`;
  const pausePg = `(SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (p.resumed_at - p.paused_at)) / 3600), 0) FROM ticket_pauses p WHERE p.ticket_id = t.id AND p.resumed_at IS NOT NULL AND p.paused_at IS NOT NULL)`;

  if (dbType === 'sqlite') {
    const raw = `(julianday(t.updated_at) - julianday(COALESCE(t.assigned_at, t.created_at))) * 24 - ${pauseSqlite}`;
    return `MAX(0, ${raw})`;
  }
  const raw = `EXTRACT(EPOCH FROM (t.updated_at - COALESCE(t.assigned_at, t.created_at))) / 3600 - ${pausePg}`;
  return `GREATEST(0, ${raw})`;
}

export function toNumber(value: unknown): number {
  if (value == null) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
