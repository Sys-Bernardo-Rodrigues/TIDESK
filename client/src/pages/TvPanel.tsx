import { useEffect, useState } from 'react';
import axios from 'axios';

interface TvTicket {
  ticketNumber: number | null;
  createdAt: string | null;
  status: string;
  priority: string;
  isPaused: boolean;
}

interface TvScheduledTicket {
  ticketNumber: number | null;
  createdAt: string | null;
  scheduledAt: string | null;
  priority: string;
  isPaused: boolean;
  isLate: boolean;
}

interface TvRankingEntry {
  name: string;
  resolvedToday: number;
  openNow: number;
}

interface TvStats {
  generatedAt: string;
  kpis: {
    open: number;
    inProgress: number;
    resolvedToday: number;
  };
  queue: TvTicket[];
  latest: TvTicket[];
  scheduled: TvScheduledTicket[];
  ranking: TvRankingEntry[];
}

const REFRESH_MS = 15000;

const PRIORITY_LABELS: Record<string, { label: string; color: string }> = {
  low: { label: 'Baixa', color: 'var(--text-tertiary)' },
  medium: { label: 'Média', color: 'var(--blue)' },
  high: { label: 'Alta', color: 'var(--orange)' },
  urgent: { label: 'Urgente', color: 'var(--red)' },
};

const STATUS_LABELS: Record<string, string> = {
  open: 'Aberto',
  in_progress: 'Em Atendimento',
  resolved: 'Resolvido',
  closed: 'Fechado',
  pending_approval: 'Aguardando Aprovação',
  scheduled: 'Agendado',
  rejected: 'Rejeitado',
};

function formatProtocolo(ticket: { ticketNumber: number | null; createdAt: string | null }): string {
  if (!ticket.ticketNumber || !ticket.createdAt) return '—';
  const date = new Date(ticket.createdAt);
  const year = date.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo', year: 'numeric' });
  const month = date.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo', month: '2-digit' });
  const day = date.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo', day: '2-digit' });
  const number = String(ticket.ticketNumber).padStart(3, '0');
  return `${year}/${month}/${day}/${number}`;
}

function timeAgo(createdAt: string | null, now: number): string {
  if (!createdAt) return '—';
  const created = new Date(createdAt).getTime();
  const diffMin = Math.max(0, Math.floor((now - created) / 60000));
  if (diffMin < 60) return `${diffMin}min`;
  const hours = Math.floor(diffMin / 60);
  const minutes = diffMin % 60;
  if (hours < 24) return `${hours}h ${minutes}min`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

function formatScheduledFor(scheduledAt: string | null): string {
  if (!scheduledAt) return '—';
  const date = new Date(scheduledAt);
  return date.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatClock(date: Date): string {
  return date.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour12: false });
}

export default function TvPanel() {
  const [stats, setStats] = useState<TvStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;

    const fetchStats = async () => {
      try {
        const response = await axios.get<TvStats>('/api/tv/stats');
        if (!cancelled) {
          setStats(response.data);
          setError(null);
        }
      } catch (err) {
        console.error('Erro ao buscar painel TV:', err);
        if (!cancelled) setError('Não foi possível carregar os dados. Tentando novamente...');
      }
    };

    fetchStats();
    const dataInterval = setInterval(fetchStats, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(dataInterval);
    };
  }, []);

  useEffect(() => {
    const clockInterval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(clockInterval);
  }, []);

  return (
    <div
      data-theme="dark"
      style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
      className="min-h-screen w-full overflow-hidden p-8"
    >
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight">TIDESK</h1>
          <p className="text-lg text-[color:var(--text-secondary)]">Painel de Atendimento</p>
        </div>
        <div className="text-right">
          <div className="text-5xl font-bold tabular-nums">{formatClock(new Date(now))}</div>
          {error && <div className="mt-1 text-sm" style={{ color: 'var(--red)' }}>{error}</div>}
        </div>
      </header>

      <section className="mb-6 grid grid-cols-3 gap-5">
        <KpiCard label="Abertos" value={stats?.kpis.open} color="var(--red)" />
        <KpiCard label="Em Atendimento" value={stats?.kpis.inProgress} color="var(--blue)" />
        <KpiCard label="Resolvidos Hoje" value={stats?.kpis.resolvedToday} color="var(--green)" />
      </section>

      <section className="grid grid-cols-4 gap-5" style={{ height: 'calc(100vh - 260px)' }}>
        <div
          className="col-span-2 flex flex-col overflow-hidden rounded-xl border p-5"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}
        >
          <h2 className="mb-3 text-2xl font-bold">Fila de Atendimento</h2>
          <div className="overflow-y-auto">
            <table className="w-full text-left text-lg">
              <thead>
                <tr className="text-[color:var(--text-tertiary)]" style={{ fontSize: '0.85rem' }}>
                  <th className="pb-2">Protocolo</th>
                  <th className="pb-2">Prioridade</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2 text-right">Tempo Aberto</th>
                </tr>
              </thead>
              <tbody>
                {(stats?.queue || []).map((t, i) => (
                  <tr key={i} className="border-t" style={{ borderColor: 'var(--border-primary)' }}>
                    <td className="py-2.5 font-mono">{formatProtocolo(t)}</td>
                    <td className="py-2.5">
                      <span style={{ color: PRIORITY_LABELS[t.priority]?.color || 'var(--text-secondary)' }} className="font-semibold">
                        {PRIORITY_LABELS[t.priority]?.label || t.priority}
                      </span>
                    </td>
                    <td className="py-2.5 text-[color:var(--text-secondary)]">
                      {STATUS_LABELS[t.status] || t.status}
                      {t.isPaused && <PauseBadge />}
                    </td>
                    <td className="py-2.5 text-right tabular-nums text-[color:var(--text-secondary)]">{timeAgo(t.createdAt, now)}</td>
                  </tr>
                ))}
                {stats && stats.queue.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-[color:var(--text-tertiary)]">
                      Nenhum ticket na fila 🎉
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div
          className="col-span-1 flex flex-col overflow-hidden rounded-xl border p-5"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}
        >
          <h2 className="mb-3 text-xl font-bold">Agendados</h2>
          <div className="flex flex-col gap-2 overflow-y-auto">
            {(stats?.scheduled || []).map((t, i) => (
              <div
                key={i}
                className="flex flex-col rounded-lg px-3 py-2"
                style={{ background: 'var(--bg-tertiary)', boxShadow: t.isLate ? 'inset 0 0 0 2px var(--red)' : undefined }}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm">{formatProtocolo(t)}</span>
                  <span style={{ color: PRIORITY_LABELS[t.priority]?.color || 'var(--text-secondary)' }} className="text-sm font-semibold">
                    {PRIORITY_LABELS[t.priority]?.label || t.priority}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[color:var(--text-secondary)]">{formatScheduledFor(t.scheduledAt)}</span>
                  <div className="flex items-center gap-1">
                    {t.isPaused && <PauseBadge />}
                    {t.isLate && (
                      <span className="rounded px-1.5 py-0.5 text-xs font-bold" style={{ background: 'var(--red)', color: 'white' }}>
                        ATRASADO
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {stats && stats.scheduled.length === 0 && (
              <p className="text-sm text-[color:var(--text-tertiary)]">Nenhum ticket agendado.</p>
            )}
          </div>
        </div>

        <div className="col-span-1 flex flex-col gap-5 overflow-hidden">
          <div
            className="flex-1 overflow-hidden rounded-xl border p-5"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}
          >
            <h2 className="mb-3 text-xl font-bold">Ranking de Agentes</h2>
            <div className="flex flex-col gap-2 overflow-y-auto">
              {(stats?.ranking || []).map((r, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: 'var(--bg-tertiary)' }}>
                  <div className="flex items-center gap-2">
                    <span className="text-[color:var(--text-tertiary)]">{i + 1}º</span>
                    <span className="font-semibold">{r.name}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span style={{ color: 'var(--green)' }}>{r.resolvedToday} resolvidos</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{r.openNow} abertos</span>
                  </div>
                </div>
              ))}
              {stats && stats.ranking.length === 0 && (
                <p className="text-sm text-[color:var(--text-tertiary)]">Sem atividade de agentes ainda hoje.</p>
              )}
            </div>
          </div>

          <div
            className="flex-1 overflow-hidden rounded-xl border p-5"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}
          >
            <h2 className="mb-3 text-xl font-bold">Últimos Tickets</h2>
            <div className="flex flex-col gap-2 overflow-y-auto">
              {(stats?.latest || []).map((t, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: 'var(--bg-tertiary)' }}>
                  <div className="flex flex-col">
                    <span className="font-mono text-sm">{formatProtocolo(t)}</span>
                    <span className="text-sm text-[color:var(--text-secondary)]">
                      {STATUS_LABELS[t.status] || t.status}
                      {t.isPaused && <PauseBadge />}
                    </span>
                  </div>
                  <span style={{ color: PRIORITY_LABELS[t.priority]?.color || 'var(--text-secondary)' }} className="text-sm font-semibold">
                    {PRIORITY_LABELS[t.priority]?.label || t.priority}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function PauseBadge() {
  return (
    <span
      className="ml-2 rounded px-1.5 py-0.5 text-xs font-bold"
      style={{ background: 'var(--orange)', color: 'white' }}
    >
      PAUSADO
    </span>
  );
}

function KpiCard({ label, value, color }: { label: string; value: number | undefined; color: string }) {
  return (
    <div className="rounded-xl border p-5" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
      <div className="text-lg text-[color:var(--text-secondary)]">{label}</div>
      <div className="text-6xl font-extrabold tabular-nums" style={{ color }}>
        {value ?? '—'}
      </div>
    </div>
  );
}
