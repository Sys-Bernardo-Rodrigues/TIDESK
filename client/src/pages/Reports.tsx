import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  BarChart3,
  Calendar,
  MessageSquare,
  Clock3,
  Users2,
  Zap,
  Ticket,
  CheckCircle2,
  Layers,
  Tag,
  FileText,
  TrendingUp,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

interface AgentMetrics {
  user_id: number;
  name: string;
  email: string;
  role: 'admin' | 'agent' | 'user';
  backlog: { open: number; in_progress: number; scheduled: number; pending_approval: number; overdue: number };
  resolved: { resolved: number; closed: number; rejected: number; total: number; by_priority: Record<string, number> };
  resolution_time: { avg_hours: number; fastest_hours: number | null; slowest_hours: number | null };
  activity: { messages_sent: number };
  collaboration: { time_seconds: number; tickets_collaborated: number };
  shifts: { count: number; hours: number };
}

interface OverviewData {
  created: { total: number; by_priority: Record<string, number> };
  resolved: { total: number; resolved: number; closed: number; rejected: number; avg_resolution_hours: number };
  backlog: { open: number; in_progress: number; scheduled: number; pending_approval: number; overdue: number };
  top_categories: Array<{ name: string; count: number }>;
  top_forms: Array<{ name: string; count: number }>;
  timeline: Array<{ date: string; count: number }>;
}

type Preset = '7' | '30' | '90' | 'month' | 'all';
type SortKey = 'resolved' | 'avg_time' | 'backlog' | 'collab';

function formatHours(h: number): string {
  if (!h) return '0min';
  const totalMin = Math.round(h * 60);
  const hh = Math.floor(totalMin / 60);
  const mm = totalMin % 60;
  if (hh > 0) return `${hh}h ${String(mm).padStart(2, '0')}min`;
  return `${mm}min`;
}

const formatSeconds = (s: number) => formatHours(s / 3600);

const ROLE_LABELS: Record<string, string> = { admin: 'Admin', agent: 'Agente', user: 'Usuário' };
const ROLE_STYLE: Record<string, string> = {
  admin: 'bg-[var(--purple-light)] text-[var(--purple)]',
  agent: 'bg-[var(--blue-light)] text-[var(--blue)]',
  user: 'bg-muted text-muted-foreground',
};

const PRIORITY_LABELS: Record<string, string> = { urgent: 'Urgente', high: 'Alta', medium: 'Média', low: 'Baixa' };
const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'var(--red)',
  high: 'var(--orange)',
  medium: 'var(--blue)',
  low: 'var(--text-tertiary)',
};

function StatChip({ label, value, colorVar }: { label: string; value: number | string; colorVar: string }) {
  return (
    <span className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
      <span className="font-semibold" style={{ color: colorVar }}>
        {value}
      </span>
      {label}
    </span>
  );
}

function MiniStat({ label, value, colorVar }: { label: string; value: number | string; colorVar?: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/40 p-2">
      <div className="text-[0.6875rem] text-muted-foreground">{label}</div>
      <div className="text-base font-bold text-foreground" style={colorVar ? { color: colorVar } : undefined}>
        {value}
      </div>
    </div>
  );
}

function BarList({ items, colorVar }: { items: Array<{ name: string; count: number }>; colorVar: string }) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <div className="flex flex-col gap-1.5">
      {items.map((item) => (
        <div key={item.name} className="flex items-center gap-2">
          <span className="w-28 shrink-0 truncate text-[0.6875rem] text-muted-foreground" title={item.name}>
            {item.name}
          </span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${(item.count / max) * 100}%`, background: colorVar }} />
          </div>
          <span className="w-5 shrink-0 text-right text-[0.6875rem] font-semibold text-foreground tabular-nums">{item.count}</span>
        </div>
      ))}
    </div>
  );
}

function Timeline({ data }: { data: Array<{ date: string; count: number }> }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="h-[110px] w-full rounded-lg bg-muted px-3 pt-4 pb-2">
      <div className="flex h-full items-end justify-between gap-[2px]">
        {data.map((d) => (
          <div
            key={d.date}
            className="relative mx-auto max-w-[10px] min-w-[2px] flex-1 rounded-t bg-[var(--purple)] transition-[height] duration-300"
            style={{ height: `${Math.max((d.count / max) * 100, d.count > 0 ? 8 : 0)}%`, opacity: 0.75 }}
            title={`${d.count} em ${d.date}`}
          />
        ))}
      </div>
    </div>
  );
}

function SectionSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

export default function Reports() {
  const [preset, setPreset] = useState<Preset>('30');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [loadingOverview, setLoadingOverview] = useState(true);
  const [overview, setOverview] = useState<OverviewData | null>(null);

  const [loadingAgents, setLoadingAgents] = useState(true);
  const [agents, setAgents] = useState<AgentMetrics[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>('resolved');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'agent' | 'user'>('all');

  const applyPreset = (p: Preset) => {
    setPreset(p);
    const today = new Date();
    const endStr = today.toISOString().split('T')[0];
    if (p === 'all') {
      setStartDate('');
      setEndDate('');
      return;
    }
    let start = new Date(today);
    if (p === '7') start.setDate(today.getDate() - 6);
    else if (p === '30') start.setDate(today.getDate() - 29);
    else if (p === '90') start.setDate(today.getDate() - 89);
    else if (p === 'month') start = new Date(today.getFullYear(), today.getMonth(), 1);
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(endStr);
  };

  useEffect(() => {
    applyPreset('30');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchOverview();
    fetchAgents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  const fetchOverview = async () => {
    try {
      setLoadingOverview(true);
      const params = new URLSearchParams();
      if (startDate) params.set('start', startDate);
      if (endDate) params.set('end', endDate);
      const response = await axios.get(`/api/reports/overview?${params.toString()}`);
      setOverview(response.data);
    } catch (error) {
      console.error('Erro ao buscar visão geral de tickets:', error);
    } finally {
      setLoadingOverview(false);
    }
  };

  const fetchAgents = async () => {
    try {
      setLoadingAgents(true);
      const params = new URLSearchParams();
      if (startDate) params.set('start', startDate);
      if (endDate) params.set('end', endDate);
      const response = await axios.get(`/api/reports/agents?${params.toString()}`);
      setAgents(response.data.agents || []);
    } catch (error) {
      console.error('Erro ao buscar métricas de atendentes:', error);
    } finally {
      setLoadingAgents(false);
    }
  };

  const filteredAgents = roleFilter === 'all' ? agents : agents.filter((a) => a.role === roleFilter);

  const sortedAgents = [...filteredAgents].sort((a, b) => {
    if (sortKey === 'resolved') return b.resolved.total - a.resolved.total;
    if (sortKey === 'avg_time') {
      if (!a.resolution_time.avg_hours) return 1;
      if (!b.resolution_time.avg_hours) return -1;
      return a.resolution_time.avg_hours - b.resolution_time.avg_hours;
    }
    if (sortKey === 'backlog') return (b.backlog.open + b.backlog.in_progress) - (a.backlog.open + a.backlog.in_progress);
    return b.collaboration.time_seconds - a.collaboration.time_seconds;
  });

  const totalCollabSeconds = filteredAgents.reduce((s, a) => s + a.collaboration.time_seconds, 0);

  return (
    <div className="mx-auto max-w-[1400px]">
      <header className="mb-5 flex items-center gap-2.5">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <BarChart3 size={18} />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Relatórios</h1>
          <p className="text-xs text-muted-foreground">Visão geral de tickets e desempenho por usuário</p>
        </div>
      </header>

      <div className="mb-5 flex flex-wrap items-center gap-1.5">
        {([
          ['7', '7 dias'],
          ['30', '30 dias'],
          ['90', '90 dias'],
          ['month', 'Este mês'],
          ['all', 'Tudo'],
        ] as [Preset, string][]).map(([id, label]) => (
          <Button key={id} type="button" variant={preset === id ? 'default' : 'outline'} size="sm" onClick={() => applyPreset(id)}>
            {label}
          </Button>
        ))}
        <div className="ml-1 flex items-center gap-1.5">
          <Calendar size={14} className="shrink-0 text-muted-foreground" />
          <Input
            type="date"
            value={startDate}
            onChange={(e) => {
              setPreset('all');
              setStartDate(e.target.value);
            }}
            className="h-8 w-[140px] text-[0.8125rem]"
          />
          <span className="text-[0.8125rem] text-muted-foreground">até</span>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => {
              setPreset('all');
              setEndDate(e.target.value);
            }}
            className="h-8 w-[140px] text-[0.8125rem]"
          />
        </div>
      </div>

      <Tabs defaultValue="tickets">
        <TabsList>
          <TabsTrigger value="tickets">
            <Ticket size={14} /> Tickets
          </TabsTrigger>
          <TabsTrigger value="agents">
            <Users2 size={14} /> Atendentes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tickets" className="flex flex-col gap-5 pt-4">
          {loadingOverview ? (
            <SectionSkeleton />
          ) : !overview ? (
            <Card className="flex flex-col items-center px-4 py-16 text-center">
              <BarChart3 size={48} strokeWidth={1.5} className="mb-4 text-muted-foreground opacity-50" />
              <p className="text-sm text-muted-foreground">Nenhum dado encontrado.</p>
            </Card>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <StatChip label="Criados" value={overview.created.total} colorVar="var(--blue)" />
                <StatChip label="Resolvidos" value={overview.resolved.total} colorVar="var(--green)" />
                <StatChip label="Tempo médio" value={formatHours(overview.resolved.avg_resolution_hours)} colorVar="var(--purple)" />
                <StatChip label="Em atendimento" value={overview.backlog.open + overview.backlog.in_progress} colorVar="var(--orange)" />
                {overview.backlog.overdue > 0 && <StatChip label="Atrasados" value={overview.backlog.overdue} colorVar="var(--red)" />}
              </div>

              <Card className="gap-3 px-4 py-4">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <TrendingUp size={15} className="text-[var(--purple)]" /> Tickets criados no período
                </div>
                {overview.timeline.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">Nenhum ticket criado no período</p>
                ) : (
                  <Timeline data={overview.timeline} />
                )}
              </Card>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card className="gap-3 px-4 py-4">
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                    <Layers size={15} className="text-[var(--blue)]" /> Backlog atual
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    <MiniStat label="Abertos" value={overview.backlog.open} />
                    <MiniStat label="Em progresso" value={overview.backlog.in_progress} />
                    <MiniStat label="Agendados" value={overview.backlog.scheduled} />
                    <MiniStat label="Pend. aprovação" value={overview.backlog.pending_approval} />
                    <MiniStat label="Atrasados" value={overview.backlog.overdue} colorVar={overview.backlog.overdue > 0 ? 'var(--red)' : undefined} />
                  </div>
                </Card>

                <Card className="gap-3 px-4 py-4">
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                    <CheckCircle2 size={15} className="text-[var(--green)]" /> Resolvidos no período
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <MiniStat label="Resolvidos" value={overview.resolved.resolved} />
                    <MiniStat label="Fechados" value={overview.resolved.closed} />
                    <MiniStat label="Rejeitados" value={overview.resolved.rejected} />
                  </div>
                </Card>

                <Card className="gap-3 px-4 py-4">
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                    <Zap size={15} className="text-[var(--orange)]" /> Criados por prioridade
                  </div>
                  {overview.created.total === 0 ? (
                    <p className="text-sm text-muted-foreground italic">Nenhum ticket criado no período</p>
                  ) : (
                    <BarList
                      items={(['urgent', 'high', 'medium', 'low'] as const).map((p) => ({
                        name: PRIORITY_LABELS[p],
                        count: overview.created.by_priority[p] || 0,
                      }))}
                      colorVar="var(--orange)"
                    />
                  )}
                </Card>

                <Card className="gap-3 px-4 py-4">
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                    <Tag size={15} className="text-[var(--blue)]" /> Top categorias
                  </div>
                  {overview.top_categories.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">Nenhuma categoria no período</p>
                  ) : (
                    <BarList items={overview.top_categories} colorVar="var(--blue)" />
                  )}
                </Card>

                <Card className="gap-3 px-4 py-4 lg:col-span-2">
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                    <FileText size={15} className="text-[var(--purple)]" /> Top formulários
                  </div>
                  {overview.top_forms.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">Nenhum formulário no período</p>
                  ) : (
                    <BarList items={overview.top_forms} colorVar="var(--purple)" />
                  )}
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="agents" className="flex flex-col gap-5 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {!loadingAgents && filteredAgents.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <StatChip label="Usuários" value={filteredAgents.length} colorVar="var(--text-tertiary)" />
                <StatChip label="Tempo colaborativo" value={formatSeconds(totalCollabSeconds)} colorVar="var(--purple)" />
              </div>
            )}
            <div className="ml-auto flex items-center gap-1.5">
              <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as typeof roleFilter)}>
                <SelectTrigger size="sm" className="w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os papéis</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="agent">Agente</SelectItem>
                  <SelectItem value="user">Usuário</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
                <SelectTrigger size="sm" className="w-[190px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="resolved">Ordenar: Resolvidos</SelectItem>
                  <SelectItem value="avg_time">Ordenar: Tempo médio</SelectItem>
                  <SelectItem value="backlog">Ordenar: Backlog</SelectItem>
                  <SelectItem value="collab">Ordenar: Tempo colaborativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {loadingAgents ? (
            <SectionSkeleton />
          ) : filteredAgents.length === 0 ? (
            <Card className="flex flex-col items-center px-4 py-16 text-center">
              <Users2 size={48} strokeWidth={1.5} className="mb-4 text-muted-foreground opacity-50" />
              <p className="text-sm text-muted-foreground">
                {agents.length === 0 ? 'Nenhum usuário encontrado.' : 'Nenhum usuário encontrado com esse filtro de papel.'}
              </p>
            </Card>
          ) : (
            <>
              <Card className="px-4 py-4">
                <div className="-mx-4 -mb-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Usuário</TableHead>
                        <TableHead className="text-center">Resolvidos</TableHead>
                        <TableHead className="text-center">Tempo médio</TableHead>
                        <TableHead className="text-center">Backlog</TableHead>
                        <TableHead className="text-center">Atrasados</TableHead>
                        <TableHead className="text-right">Tempo colaborativo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedAgents.map((a) => (
                        <TableRow key={a.user_id}>
                          <TableCell className="whitespace-normal">
                            <span className="flex items-center gap-1.5">
                              <span className="font-semibold text-foreground">{a.name}</span>
                              <Badge className={cn('border-0 text-[0.625rem] font-semibold', ROLE_STYLE[a.role])}>{ROLE_LABELS[a.role]}</Badge>
                            </span>
                            <span className="block text-xs text-muted-foreground">{a.email}</span>
                          </TableCell>
                          <TableCell className="text-center font-semibold tabular-nums text-foreground">{a.resolved.total}</TableCell>
                          <TableCell className="text-center tabular-nums text-foreground">
                            {a.resolution_time.avg_hours ? formatHours(a.resolution_time.avg_hours) : '—'}
                          </TableCell>
                          <TableCell className="text-center tabular-nums text-foreground">{a.backlog.open + a.backlog.in_progress}</TableCell>
                          <TableCell className="text-center tabular-nums">
                            <span className={cn('font-semibold', a.backlog.overdue > 0 ? 'text-[var(--red)]' : 'text-muted-foreground')}>
                              {a.backlog.overdue}
                            </span>
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-foreground">{formatSeconds(a.collaboration.time_seconds)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>

              <div className="flex flex-col gap-3">
                <h3 className="text-base font-semibold text-foreground">Detalhamento por usuário</h3>
                {sortedAgents.map((a) => {
                  const maxPriority = Math.max(1, ...Object.values(a.resolved.by_priority));
                  return (
                    <Card key={a.user_id} className="gap-3 px-4 py-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h4 className="text-[0.9375rem] font-semibold text-foreground">{a.name}</h4>
                            <Badge className={cn('border-0 text-[0.625rem] font-semibold', ROLE_STYLE[a.role])}>{ROLE_LABELS[a.role]}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{a.email}</p>
                        </div>
                        <div className="text-right">
                          <span className="block text-xs text-muted-foreground">Resolvidos no período</span>
                          <span className="block text-xl font-bold text-[var(--purple)]">{a.resolved.total}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                        <MiniStat label="Abertos" value={a.backlog.open} />
                        <MiniStat label="Em progresso" value={a.backlog.in_progress} />
                        <MiniStat label="Agendados" value={a.backlog.scheduled} />
                        <MiniStat label="Pend. aprovação" value={a.backlog.pending_approval} />
                        <MiniStat label="Atrasados" value={a.backlog.overdue} colorVar={a.backlog.overdue > 0 ? 'var(--red)' : undefined} />
                      </div>

                      <div className="grid grid-cols-3 gap-3 border-t border-border pt-3 text-sm">
                        <div>
                          <span className="block text-xs text-muted-foreground">Tempo médio</span>
                          <span className="font-semibold text-foreground">
                            {a.resolution_time.avg_hours ? formatHours(a.resolution_time.avg_hours) : '—'}
                          </span>
                        </div>
                        <div>
                          <span className="block text-xs text-muted-foreground">Mais rápido</span>
                          <span className="font-semibold text-[var(--green)]">
                            {a.resolution_time.fastest_hours != null ? formatHours(a.resolution_time.fastest_hours) : '—'}
                          </span>
                        </div>
                        <div>
                          <span className="block text-xs text-muted-foreground">Mais lento</span>
                          <span className="font-semibold text-[var(--red)]">
                            {a.resolution_time.slowest_hours != null ? formatHours(a.resolution_time.slowest_hours) : '—'}
                          </span>
                        </div>
                      </div>

                      {a.resolved.total > 0 && (
                        <div className="border-t border-border pt-3">
                          <span className="mb-1.5 block text-xs text-muted-foreground">Resolvidos por prioridade</span>
                          <div className="flex flex-col gap-1.5">
                            {(['urgent', 'high', 'medium', 'low'] as const).map((p) => {
                              const count = a.resolved.by_priority[p] || 0;
                              const pct = (count / maxPriority) * 100;
                              return (
                                <div key={p} className="flex items-center gap-2">
                                  <span className="w-14 shrink-0 text-[0.6875rem] text-muted-foreground">{PRIORITY_LABELS[p]}</span>
                                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                                    <div
                                      className="h-full rounded-full transition-[width] duration-300"
                                      style={{ width: `${pct}%`, background: PRIORITY_COLORS[p] }}
                                    />
                                  </div>
                                  <span className="w-5 shrink-0 text-right text-[0.6875rem] font-semibold text-foreground tabular-nums">{count}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-4 border-t border-border pt-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <MessageSquare size={13} /> {a.activity.messages_sent} mensagens
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Clock3 size={13} /> {formatSeconds(a.collaboration.time_seconds)} em {a.collaboration.tickets_collaborated} ticket
                          {a.collaboration.tickets_collaborated !== 1 ? 's' : ''}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Users2 size={13} /> {a.shifts.count} plantõe{a.shifts.count !== 1 ? 's' : ''} ({formatHours(a.shifts.hours)})
                        </span>
                        {a.backlog.overdue > 0 && (
                          <span className="ml-auto flex items-center gap-1.5 font-semibold text-[var(--red)]">
                            <Zap size={13} /> {a.backlog.overdue} atrasado{a.backlog.overdue !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
