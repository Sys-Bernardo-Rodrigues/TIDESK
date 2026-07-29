import { useState, useEffect } from 'react';
import axios from 'axios';
import type { LucideIcon } from 'lucide-react';
import {
  TrendingUp,
  Clock,
  Users,
  Ticket,
  CheckCircle,
  PieChart,
  BarChart3,
  FileDown,
  Webhook,
  FolderKanban,
  FileText,
  Layers,
  UserCheck,
  RefreshCw,
  AlertCircle,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// ——— Tooltip de informação ———
function InfoTooltip({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Info size={13} className="shrink-0 cursor-help align-[-2px] text-muted-foreground/60" />
      </TooltipTrigger>
      <TooltipContent className="max-w-[260px] text-xs">{text}</TooltipContent>
    </Tooltip>
  );
}

// ——— Tipos ———
interface OverviewData {
  period: string;
  dateRange: { start: string; end: string };
  totalTickets: number;
  resolvedTickets: number;
  resolvedInPeriod?: number;
  cohortResolved?: number;
  resolutionRate: number;
  avgResolutionTimeHours: number;
  ticketsByStatus: Array<{ status: string; count: number }>;
  ticketsByPriority: Array<{ priority: string; count: number }>;
}

interface FormData {
  id: number;
  name: string;
  ticket_count: number;
  resolved_count: number;
  avg_resolution_hours: number | null;
}

interface AgentPerformance {
  id: number;
  name: string;
  email: string;
  total_tickets: number;
  resolved_tickets: number;
  avg_resolution_hours: number | null;
  min_resolution_hours: number | null;
  max_resolution_hours: number | null;
}

interface ResponseTimeData {
  priority: string;
  total_tickets: number;
  avg_hours: number;
  min_hours: number;
  max_hours: number;
}

interface TimelineItem {
  period: string;
  total: number;
  open: number;
  in_progress: number;
  resolved: number;
}

interface SystemData {
  users: number;
  forms: number;
  pages: number;
  groups: number;
  projects: number;
  projectTasks: number;
  projectTasksOpen: number;
  ticketsPendingApproval: number;
}

interface CategoryData {
  id: number;
  name: string;
  ticket_count: number;
  resolved_count: number;
}

interface WebhooksData {
  totalWebhooks: number;
  activeWebhooks: number;
  totalCalls: number;
  successCalls: number;
  errorCalls: number;
  ticketsCreated: number;
  successRate: number;
  topWebhooks: Array<{
    id: number;
    name: string;
    total_calls: number;
    success_calls: number;
    error_calls: number;
    tickets_created?: number;
  }>;
}

interface DetailedTicket {
  id: number;
  ticketNumber: number | null;
  title: string;
  description: string;
  status: string;
  priority: string;
  needsApproval: boolean;
  createdAt: string;
  updatedAt: string;
  assignedAt: string | null;
  scheduledAt: string | null;
  requesterName: string | null;
  requesterEmail: string | null;
  agentName: string | null;
  agentEmail: string | null;
  categoryName: string | null;
  formName: string | null;
  isPaused: boolean;
  totalPauseSeconds: number;
}

// ——— Helpers ———
function formatHours(hours: number | null | undefined): string {
  if (hours == null || isNaN(hours) || hours < 0) return '—';
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 24) return `${Math.round(hours * 10) / 10} h`;
  const d = Math.floor(hours / 24);
  const h = Math.round((hours % 24) * 10) / 10;
  return `${d}d ${h}h`;
}

const STATUS_LABELS: Record<string, string> = {
  open: 'Aberto',
  in_progress: 'Em progresso',
  resolved: 'Resolvido',
  closed: 'Fechado',
  scheduled: 'Agendado',
  pending_approval: 'Pend. aprovação',
  rejected: 'Rejeitado',
};

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  urgent: 'Urgente',
};

const PERIOD_LABELS: Record<string, string> = {
  today: 'Hoje',
  week: 'Semana',
  month: 'Mês',
  quarter: 'Trimestre',
  year: 'Ano',
  custom: 'Personalizado',
};

type Accent = 'purple' | 'red' | 'green' | 'blue' | 'orange';

const STATUS_ACCENT: Record<string, Accent> = {
  open: 'red',
  in_progress: 'blue',
  resolved: 'green',
  closed: 'purple',
  scheduled: 'orange',
  pending_approval: 'orange',
  rejected: 'red',
};

const PRIORITY_ACCENT: Record<string, Accent> = { urgent: 'red', high: 'red', medium: 'orange', low: 'blue' };

const ACCENT: Record<Accent, { text: string; solid: string; soft: string; softText: string }> = {
  purple: { text: 'text-[var(--purple)]', solid: 'bg-[var(--purple)]', soft: 'bg-[var(--purple-light)]', softText: 'text-[var(--purple)]' },
  red: { text: 'text-[var(--red)]', solid: 'bg-[var(--red)]', soft: 'bg-[var(--red-light)]', softText: 'text-[var(--red)]' },
  green: { text: 'text-[var(--green)]', solid: 'bg-[var(--green)]', soft: 'bg-[var(--green-light)]', softText: 'text-[var(--green)]' },
  blue: { text: 'text-[var(--blue)]', solid: 'bg-[var(--blue)]', soft: 'bg-[var(--blue-light)]', softText: 'text-[var(--blue)]' },
  orange: { text: 'text-[var(--orange)]', solid: 'bg-[var(--orange)]', soft: 'bg-[var(--orange-light)]', softText: 'text-[var(--orange)]' },
};

const SECTION_HEAD = 'mb-3.5 flex items-center gap-1.5';
const SECTION_TITLE = 'text-sm font-semibold text-foreground';

function buildPeriodParam(period: string, customStart: string, customEnd: string): string {
  if (period === 'custom' && customStart && customEnd) {
    return `custom&start=${customStart}&end=${customEnd}`;
  }
  return period;
}

// ——— KPI card ———
function KpiCard({
  icon: Icon,
  accent,
  label,
  value,
  sub,
  tooltip,
}: {
  icon: LucideIcon;
  accent: Accent;
  label: string;
  value: string | number;
  sub?: string;
  tooltip?: string;
}) {
  return (
    <Card className={cn('gap-0 px-4 py-3.5', ACCENT[accent].soft)}>
      <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-white', ACCENT[accent].solid)}>
        <Icon size={16} strokeWidth={2.25} />
      </div>
      <span className="mt-2.5 flex items-center gap-1 text-[0.7rem] font-medium text-muted-foreground">
        {label}
        {tooltip && <InfoTooltip text={tooltip} />}
      </span>
      <span className="block text-3xl leading-tight font-bold text-foreground">{value}</span>
      {sub && <span className="mt-0.5 block truncate text-[0.7rem] text-muted-foreground">{sub}</span>}
    </Card>
  );
}

// ——— Card com tabela ———
function TableCard({
  title,
  tooltip,
  icon: Icon,
  accent,
  empty,
  children,
}: {
  title: string;
  tooltip?: string;
  icon?: LucideIcon;
  accent: Accent;
  empty?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="mb-6">
      <div className={SECTION_HEAD}>
        {Icon && <Icon size={16} className={cn('shrink-0', ACCENT[accent].text)} />}
        <h2 className={SECTION_TITLE}>{title}</h2>
        {tooltip && <InfoTooltip text={tooltip} />}
      </div>
      <Card className="px-4 py-4">
        {empty ? <p className="text-sm text-muted-foreground italic">{empty}</p> : <div className="-mx-4 -mb-4">{children}</div>}
      </Card>
    </section>
  );
}

// ——— Loading skeleton ———
function ReportsSkeleton() {
  return (
    <div className="mx-auto max-w-[1400px] pb-12">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Skeleton className="h-7 w-[160px]" />
          <Skeleton className="mt-2 h-[18px] w-[220px]" />
        </div>
        <Skeleton className="h-8 w-[420px]" />
      </div>
      <div className="mb-6 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-[104px]" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-52" />
        <Skeleton className="h-52" />
      </div>
    </div>
  );
}

// ——— Error state ———
function ReportsError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-12">
      <div className="max-w-[360px] text-center">
        <AlertCircle size={48} strokeWidth={1.5} className="mx-auto mb-6 text-muted-foreground opacity-60" />
        <h2 className="mb-2 text-lg font-bold text-foreground">Não foi possível carregar os relatórios</h2>
        <p className="mb-6 text-[0.9375rem] leading-relaxed text-muted-foreground">{message}</p>
        <Button onClick={onRetry}>Tentar novamente</Button>
      </div>
    </div>
  );
}

export default function Reports() {
  const [period, setPeriod] = useState('month');
  const [customStart, setCustomDateStart] = useState('');
  const [customEnd, setCustomDateEnd] = useState('');
  const [useCustomDates, setUseCustomDates] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState('0');
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [formsData, setFormsData] = useState<FormData[]>([]);
  const [agentsData, setAgentsData] = useState<AgentPerformance[]>([]);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [responseTime, setResponseTime] = useState<ResponseTimeData[]>([]);
  const [webhooksData, setWebhooksData] = useState<WebhooksData | null>(null);
  const [systemData, setSystemData] = useState<SystemData | null>(null);
  const [categoryData, setCategoryData] = useState<CategoryData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [generatingDetailed, setGeneratingDetailed] = useState(false);

  const periodParam = buildPeriodParam(period, customStart, customEnd);

  const fetchAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [
        overviewRes,
        formsRes,
        agentsRes,
        timelineRes,
        responseTimeRes,
        webhooksRes,
        systemRes,
        categoryRes,
      ] = await Promise.all([
        axios.get(`/api/reports/overview?period=${periodParam}`),
        axios.get(`/api/reports/by-form?period=${periodParam}`),
        axios.get(`/api/reports/agents-performance?period=${periodParam}`),
        axios.get(`/api/reports/timeline?period=${periodParam}&groupBy=day`),
        axios.get(`/api/reports/response-time-by-priority?period=${periodParam}`),
        axios.get(`/api/reports/webhooks?period=${periodParam}`).catch(() => ({ data: null })),
        axios.get('/api/reports/system'),
        axios.get(`/api/reports/by-category?period=${periodParam}`),
      ]);

      setOverview(overviewRes.data);
      setFormsData(formsRes.data || []);
      setAgentsData(agentsRes.data || []);
      setTimeline(timelineRes.data || []);
      setResponseTime(responseTimeRes.data || []);
      setWebhooksData(webhooksRes.data || null);
      setSystemData(systemRes.data || null);
      setCategoryData(categoryRes.data || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao carregar relatórios');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (useCustomDates && (!customStart || !customEnd)) return;
    fetchAll();
  }, [period, useCustomDates, customStart, customEnd]);

  useEffect(() => {
    if (autoRefresh === '0') return;
    const ms = parseInt(autoRefresh, 10) * 1000;
    const id = setInterval(fetchAll, ms);
    return () => clearInterval(id);
  }, [autoRefresh, period, useCustomDates, customStart, customEnd]);

  const periodLabel = useCustomDates && customStart && customEnd
    ? `${customStart} a ${customEnd}`
    : PERIOD_LABELS[period] || period;

  const generatePDF = async () => {
    if (!overview) return;
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      const margin = 16;
      const w = doc.internal.pageSize.getWidth();
      const h = doc.internal.pageSize.getHeight();
      let y = 0;

      // Cores do sistema TIDESK (RGB para jsPDF)
      const purple = [145, 71, 255] as [number, number, number];
      const green = [16, 185, 129] as [number, number, number];
      const blue = [59, 130, 246] as [number, number, number];
      const orange = [245, 158, 11] as [number, number, number];
      const dark = [26, 26, 31] as [number, number, number];
      const textSecondary = [184, 184, 192] as [number, number, number];
      const textDark = [26, 26, 31] as [number, number, number];
      const border = [42, 42, 46] as [number, number, number];
      const bgLight = [248, 248, 250] as [number, number, number];

      const addPageIfNeeded = (need: number) => {
        if (y + need > h - 22) {
          doc.addPage();
          y = 0;
        }
      };

      const drawPageFooter = (pageNum: number, totalPages: number) => {
        doc.setDrawColor(border[0], border[1], border[2]);
        doc.setLineWidth(0.3);
        doc.line(margin, h - 14, w - margin, h - 14);
        doc.setFontSize(8);
        doc.setTextColor(textSecondary[0], textSecondary[1], textSecondary[2]);
        doc.text('TIDESK · Relatório de métricas', margin, h - 8);
        doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, w - margin, h - 8, { align: 'right' });
        doc.text(`Página ${pageNum} de ${totalPages}`, w / 2, h - 8, { align: 'center' });
      };

      const sectionTitle = (title: string) => {
        addPageIfNeeded(20);
        doc.setFillColor(purple[0], purple[1], purple[2]);
        doc.rect(0, y, w, 8, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(title, margin + 2, y + 5.5);
        y += 12;
      };

      const tableHeader = (cols: string[], colWidths: number[]) => {
        addPageIfNeeded(10);
        const rowH = 7;
        let x = margin;
        doc.setFillColor(purple[0], purple[1], purple[2]);
        doc.rect(margin, y, w - 2 * margin, rowH, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        cols.forEach((col, i) => {
          doc.text(col, x + 2, y + 4.5);
          x += colWidths[i];
        });
        y += rowH;
        return rowH;
      };

      const tableRow = (cells: string[], colWidths: number[], alt?: boolean) => {
        addPageIfNeeded(7);
        const rowH = 6;
        if (alt) {
          doc.setFillColor(bgLight[0], bgLight[1], bgLight[2]);
          doc.rect(margin, y, w - 2 * margin, rowH, 'F');
        }
        doc.setTextColor(textDark[0], textDark[1], textDark[2]);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        let x = margin;
        cells.forEach((cell, i) => {
          doc.text(cell.length > 35 ? cell.substring(0, 32) + '...' : cell, x + 2, y + 4);
          x += colWidths[i];
        });
        y += rowH;
        return rowH;
      };

      // ——— Capa / Cabeçalho ———
      doc.setFillColor(dark[0], dark[1], dark[2]);
      doc.rect(0, 0, w, 36, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.text('TIDESK', margin, 16);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(textSecondary[0], textSecondary[1], textSecondary[2]);
      doc.text('Relatório de métricas', margin, 24);
      doc.text(periodLabel, w - margin, 16, { align: 'right' });
      doc.setFontSize(9);
      doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, w - margin, 24, { align: 'right' });
      y = 44;

      // ——— Resumo executivo ———
      sectionTitle('Resumo do período');
      doc.setTextColor(textDark[0], textDark[1], textDark[2]);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      const cohort = overview.cohortResolved ?? overview.resolvedTickets;
      const resumoText = overview.totalTickets === 0
        ? 'Nenhum ticket criado no período selecionado.'
        : `No período foram criados ${overview.totalTickets} tickets. ${overview.resolvedTickets} foram concluídos no período. Dos criados no período, ${cohort} já estão resolvidos ou fechados (${overview.resolutionRate.toFixed(1)}%). Tempo médio de resolução (conclusões no período): ${formatHours(overview.avgResolutionTimeHours)}.`;
      doc.text(resumoText, margin, y, { maxWidth: w - 2 * margin });
      y += 12;

      // ——— KPIs em caixas ———
      addPageIfNeeded(36);
      const kpiW = (w - 2 * margin - 9) / 4;
      const kpiH = 28;
      const kpis = [
        { label: 'Total', value: String(overview.totalTickets), color: blue },
        { label: 'Resolvidos', value: String(overview.resolvedTickets), color: green },
        { label: 'Taxa', value: `${overview.resolutionRate.toFixed(1)}%`, color: purple },
        { label: 'Tempo médio', value: formatHours(overview.avgResolutionTimeHours), color: orange },
      ];
      kpis.forEach((k, i) => {
        const x = margin + i * (kpiW + 3);
        doc.setDrawColor(border[0], border[1], border[2]);
        doc.setFillColor(250, 250, 252);
        doc.roundedRect(x, y, kpiW, kpiH, 1.5, 1.5, 'FD');
        doc.setFillColor(k.color[0], k.color[1], k.color[2]);
        doc.roundedRect(x, y, kpiW, 3, 1.5, 1.5, 'F');
        doc.setTextColor(100, 100, 110);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(k.label.toUpperCase(), x + 3, y + 10);
        doc.setTextColor(26, 26, 31);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(k.value, x + 3, y + 22);
      });
      y += kpiH + 14;

      // ——— Visão do sistema ———
      if (systemData) {
        sectionTitle('Visão do sistema');
        const sysItems = [
          ['Usuários', String(systemData.users)],
          ['Formulários', String(systemData.forms)],
          ['Páginas', String(systemData.pages)],
          ['Grupos', String(systemData.groups)],
          ['Projetos', String(systemData.projects), `${systemData.projectTasksOpen} tarefas em aberto`],
        ];
        if (systemData.ticketsPendingApproval > 0) {
          sysItems.push(['Pendentes aprovação', String(systemData.ticketsPendingApproval)]);
        }
        sysItems.forEach((row, i) => {
          addPageIfNeeded(6);
          if (i % 2 === 0) {
            doc.setFillColor(bgLight[0], bgLight[1], bgLight[2]);
            doc.rect(margin, y, w - 2 * margin, 6, 'F');
          }
          doc.setTextColor(textDark[0], textDark[1], textDark[2]);
          doc.setFontSize(9);
          doc.text(row[0], margin + 3, y + 4);
          const valueText = row[2] ? `${row[1]} (${row[2]})` : row[1];
          doc.text(valueText, w - margin - 3, y + 4, { align: 'right' });
          y += 6;
        });
        y += 6;
      }

      // ——— Por status ———
      if (overview.ticketsByStatus.length > 0) {
        sectionTitle('Tickets por status');
        const colWidths = [w - 2 * margin - 25, 25];
        tableHeader(['Status', 'Qtd'], colWidths);
        overview.ticketsByStatus.forEach((s, i) => {
          tableRow([STATUS_LABELS[s.status] || s.status, String(s.count)], colWidths, i % 2 === 0);
        });
        y += 4;
      }

      // ——— Por prioridade ———
      if (overview.ticketsByPriority.length > 0) {
        sectionTitle('Tickets por prioridade');
        const colWidths = [w - 2 * margin - 25, 25];
        tableHeader(['Prioridade', 'Qtd'], colWidths);
        overview.ticketsByPriority.forEach((p, i) => {
          tableRow([PRIORITY_LABELS[p.priority] || p.priority, String(p.count)], colWidths, i % 2 === 0);
        });
        y += 4;
      }

      // ——— Por formulário ———
      if (formsData.length > 0) {
        sectionTitle('Tickets por formulário');
        const fw = (w - 2 * margin - 8) / 5;
        const colWidths = [fw * 2, fw * 0.8, fw * 0.8, fw * 0.7, fw * 0.7];
        tableHeader(['Formulário', 'Total', 'Resolv.', 'Taxa', 'Tempo'], colWidths);
        formsData.forEach((f, i) => {
          const rate = f.ticket_count > 0 ? (f.resolved_count / f.ticket_count) * 100 : 0;
          tableRow([f.name, String(f.ticket_count), String(f.resolved_count), `${rate.toFixed(1)}%`, formatHours(f.avg_resolution_hours)], colWidths, i % 2 === 0);
        });
        y += 4;
      }

      // ——— Por categoria ———
      if (categoryData.length > 0) {
        sectionTitle('Tickets por categoria');
        const cw = (w - 2 * margin - 8) / 4;
        const colWidths = [cw * 2, cw, cw, cw];
        tableHeader(['Categoria', 'Total', 'Resolv.', 'Taxa'], colWidths);
        categoryData.forEach((c, i) => {
          const rate = c.ticket_count > 0 ? (c.resolved_count / c.ticket_count) * 100 : 0;
          tableRow([c.name, String(c.ticket_count), String(c.resolved_count), `${rate.toFixed(1)}%`], colWidths, i % 2 === 0);
        });
        y += 4;
      }

      // ——— Performance de agentes ———
      if (agentsData.length > 0) {
        sectionTitle('Performance de agentes');
        const aw = (w - 2 * margin - 8) / 6;
        const colWidths = [aw * 1.8, aw * 0.6, aw * 0.6, aw * 0.5, aw * 0.8, aw * 1.2];
        tableHeader(['Agente', 'Total', 'Resolv.', 'Taxa', 'Tempo médio', 'Mín / Máx'], colWidths);
        agentsData.forEach((a, i) => {
          const rate = a.total_tickets > 0 ? (a.resolved_tickets / a.total_tickets) * 100 : 0;
          tableRow([
            a.name,
            String(a.total_tickets),
            String(a.resolved_tickets),
            `${rate.toFixed(1)}%`,
            formatHours(a.avg_resolution_hours),
            `${formatHours(a.min_resolution_hours)} / ${formatHours(a.max_resolution_hours)}`,
          ], colWidths, i % 2 === 0);
        });
        y += 4;
      }

      // ——— Tempo por prioridade ———
      if (responseTime.length > 0) {
        sectionTitle('Tempo de resolução por prioridade');
        const rw = (w - 2 * margin - 8) / 5;
        const colWidths = [rw * 1.2, rw, rw, rw, rw];
        tableHeader(['Prioridade', 'Total', 'Médio', 'Mín', 'Máx'], colWidths);
        responseTime.forEach((r, i) => {
          tableRow([
            PRIORITY_LABELS[r.priority] || r.priority,
            String(r.total_tickets),
            formatHours(r.avg_hours),
            formatHours(r.min_hours),
            formatHours(r.max_hours),
          ], colWidths, i % 2 === 0);
        });
        y += 4;
      }

      // ——— Webhooks ———
      if (webhooksData) {
        sectionTitle('Webhooks');
        addPageIfNeeded(30);
        const whKpiW = (w - 2 * margin - 9) / 4;
        const whKpis = [
          ['Webhooks', String(webhooksData.totalWebhooks), `${webhooksData.activeWebhooks} ativos`],
          ['Chamadas', String(webhooksData.totalCalls), ''],
          ['Taxa sucesso', `${webhooksData.successRate.toFixed(1)}%`, ''],
          ['Tickets criados', String(webhooksData.ticketsCreated), ''],
        ];
        whKpis.forEach((row, i) => {
          const x = margin + i * (whKpiW + 3);
          doc.setDrawColor(border[0], border[1], border[2]);
          doc.setFillColor(250, 250, 252);
          doc.roundedRect(x, y, whKpiW, 22, 1.5, 1.5, 'FD');
          doc.setFillColor(purple[0], purple[1], purple[2]);
          doc.roundedRect(x, y, whKpiW, 2.5, 1.5, 1.5, 'F');
          doc.setTextColor(100, 100, 110);
          doc.setFontSize(7);
          doc.setFont('helvetica', 'normal');
          doc.text(row[0].toUpperCase(), x + 3, y + 8);
          doc.setTextColor(26, 26, 31);
          doc.setFontSize(12);
          doc.setFont('helvetica', 'bold');
          doc.text(row[1], x + 3, y + 16);
          if (row[2]) {
            doc.setFontSize(7);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100, 100, 110);
            doc.text(row[2], x + 3, y + 20);
          }
        });
        y += 26;

        if (webhooksData.topWebhooks && webhooksData.topWebhooks.length > 0) {
          addPageIfNeeded(20);
          doc.setFontSize(10);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(textDark[0], textDark[1], textDark[2]);
          doc.text('Webhooks mais utilizados', margin, y);
          y += 8;
          const tw = (w - 2 * margin - 8) / 5;
          const colWidths = [tw * 1.5, tw, tw, tw, tw];
          tableHeader(['Webhook', 'Chamadas', 'Sucessos', 'Erros', 'Tickets'], colWidths);
          webhooksData.topWebhooks.slice(0, 10).forEach((wh, i) => {
            tableRow([
              wh.name,
              String(wh.total_calls),
              String(wh.success_calls),
              String(wh.error_calls),
              String(wh.tickets_created ?? 0),
            ], colWidths, i % 2 === 0);
          });
        }
      }

      const totalPages = (doc as any).internal.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        drawPageFooter(p, totalPages);
      }
      doc.save(`relatorio-tidesk-${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error(err);
      alert('Erro ao gerar PDF.');
    }
  };

  const generateDetailedTicketsPDF = async () => {
    setGeneratingDetailed(true);
    try {
      const { data } = await axios.get(`/api/reports/tickets-detailed?period=${periodParam}`);
      const tickets: DetailedTicket[] = data.tickets || [];

      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      const margin = 16;
      const w = doc.internal.pageSize.getWidth();
      const h = doc.internal.pageSize.getHeight();
      let y = 0;

      const purple = [145, 71, 255] as [number, number, number];
      const dark = [26, 26, 31] as [number, number, number];
      const textSecondary = [184, 184, 192] as [number, number, number];
      const textDark = [26, 26, 31] as [number, number, number];
      const border = [42, 42, 46] as [number, number, number];
      const bgLight = [248, 248, 250] as [number, number, number];

      const addPageIfNeeded = (need: number) => {
        if (y + need > h - 22) {
          doc.addPage();
          y = 12;
        }
      };

      const drawPageFooter = (pageNum: number, totalPages: number) => {
        doc.setDrawColor(border[0], border[1], border[2]);
        doc.setLineWidth(0.3);
        doc.line(margin, h - 14, w - margin, h - 14);
        doc.setFontSize(8);
        doc.setTextColor(textSecondary[0], textSecondary[1], textSecondary[2]);
        doc.text('TIDESK · Relatório detalhado de tickets', margin, h - 8);
        doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, w - margin, h - 8, { align: 'right' });
        doc.text(`Página ${pageNum} de ${totalPages}`, w / 2, h - 8, { align: 'center' });
      };

      const formatDate = (v: string | null) => (v ? new Date(v).toLocaleString('pt-BR') : '—');
      const formatPause = (seconds: number) => {
        if (!seconds) return '—';
        const hours = seconds / 3600;
        return formatHours(hours);
      };

      // ——— Capa ———
      doc.setFillColor(dark[0], dark[1], dark[2]);
      doc.rect(0, 0, w, 36, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.text('TIDESK', margin, 16);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(textSecondary[0], textSecondary[1], textSecondary[2]);
      doc.text('Relatório detalhado de tickets', margin, 24);
      doc.text(periodLabel, w - margin, 16, { align: 'right' });
      doc.setFontSize(9);
      doc.text(`${tickets.length} ticket(s) · Gerado em ${new Date().toLocaleString('pt-BR')}`, w - margin, 24, { align: 'right' });
      y = 44;

      if (tickets.length === 0) {
        doc.setTextColor(textDark[0], textDark[1], textDark[2]);
        doc.setFontSize(11);
        doc.text('Nenhum ticket criado no período selecionado.', margin, y);
      }

      tickets.forEach((t, idx) => {
        addPageIfNeeded(30);

        // Cabeçalho do card
        doc.setFillColor(purple[0], purple[1], purple[2]);
        doc.rect(margin, y, w - 2 * margin, 8, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(`#${t.ticketNumber ?? t.id} · ${t.title}`, margin + 2, y + 5.5, { maxWidth: w - 2 * margin - 60 });
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(
          `${STATUS_LABELS[t.status] || t.status} · ${PRIORITY_LABELS[t.priority] || t.priority}${t.isPaused ? ' · PAUSADO' : ''}`,
          w - margin - 2,
          y + 5.5,
          { align: 'right' }
        );
        y += 11;

        const fields: [string, string][] = [
          ['Solicitante', t.requesterName ? `${t.requesterName}${t.requesterEmail ? ` (${t.requesterEmail})` : ''}` : '—'],
          ['Agente', t.agentName ? `${t.agentName}${t.agentEmail ? ` (${t.agentEmail})` : ''}` : '—'],
          ['Categoria', t.categoryName || '—'],
          ['Formulário', t.formName || '—'],
          ['Criado em', formatDate(t.createdAt)],
          ['Atualizado em', formatDate(t.updatedAt)],
          ['Atribuído em', formatDate(t.assignedAt)],
          ['Agendado para', formatDate(t.scheduledAt)],
          ['Tempo pausado', formatPause(t.totalPauseSeconds)],
          ['Aguarda aprovação', t.needsApproval ? 'Sim' : 'Não'],
        ];

        doc.setFontSize(8.5);
        for (let i = 0; i < fields.length; i += 2) {
          addPageIfNeeded(6);
          const colW = (w - 2 * margin) / 2;
          if ((i / 2) % 2 === 0) {
            doc.setFillColor(bgLight[0], bgLight[1], bgLight[2]);
            doc.rect(margin, y, w - 2 * margin, 5.5, 'F');
          }
          doc.setTextColor(100, 100, 110);
          doc.setFont('helvetica', 'bold');
          [0, 1].forEach((col) => {
            const field = fields[i + col];
            if (!field) return;
            const x = margin + col * colW;
            doc.setTextColor(100, 100, 110);
            doc.setFont('helvetica', 'bold');
            doc.text(`${field[0]}:`, x + 2, y + 4);
            doc.setTextColor(textDark[0], textDark[1], textDark[2]);
            doc.setFont('helvetica', 'normal');
            doc.text(field[1], x + 32, y + 4, { maxWidth: colW - 34 });
          });
          y += 5.5;
        }
        y += 2;

        // Descrição completa (inclui respostas de formulário, já formatadas)
        if (t.description) {
          addPageIfNeeded(8);
          doc.setFontSize(8.5);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(100, 100, 110);
          doc.text('DESCRIÇÃO', margin + 2, y + 4);
          y += 6;

          const cleanDescription = t.description.replace(/\*\*/g, '');
          const lines = doc.setFont('helvetica', 'normal').setFontSize(8.5).splitTextToSize(cleanDescription, w - 2 * margin - 4);
          doc.setTextColor(textDark[0], textDark[1], textDark[2]);
          lines.forEach((line: string) => {
            addPageIfNeeded(4.5);
            doc.text(line, margin + 2, y + 3.5);
            y += 4.5;
          });
          y += 2;
        }

        doc.setDrawColor(border[0], border[1], border[2]);
        doc.setLineWidth(0.2);
        addPageIfNeeded(4);
        doc.line(margin, y, w - margin, y);
        y += 6;

        void idx;
      });

      const totalPages = (doc as any).internal.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        drawPageFooter(p, totalPages);
      }
      doc.save(`relatorio-detalhado-tickets-${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error(err);
      alert('Erro ao gerar PDF detalhado.');
    } finally {
      setGeneratingDetailed(false);
    }
  };

  if (loading && !overview) return <ReportsSkeleton />;
  if (error && !overview) return <ReportsError message={error} onRetry={fetchAll} />;

  const maxTimeline = Math.max(...timeline.map((t) => t.total), 1);
  const totalStatus = overview ? overview.ticketsByStatus.reduce((s, x) => s + x.count, 0) : 0;
  const totalPriority = overview ? overview.ticketsByPriority.reduce((s, x) => s + x.count, 0) : 0;

  return (
    <div className="mx-auto max-w-[1400px] pb-12">
      {/* Header */}
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[1.65rem] font-extrabold tracking-tight text-foreground">Relatórios</h1>
          <p className="text-sm text-muted-foreground">Métricas do sistema · {periodLabel}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={useCustomDates ? 'custom' : period}
            onValueChange={(v) => {
              if (v === 'custom') setUseCustomDates(true);
              else { setUseCustomDates(false); setPeriod(v); }
            }}
          >
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="week">Semana</SelectItem>
              <SelectItem value="month">Mês</SelectItem>
              <SelectItem value="quarter">Trimestre</SelectItem>
              <SelectItem value="year">Ano</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>
          {useCustomDates && (
            <div className="flex items-center gap-1.5">
              <Input type="date" className="w-[145px]" value={customStart} onChange={(e) => setCustomDateStart(e.target.value)} />
              <span className="text-xs text-muted-foreground">até</span>
              <Input type="date" className="w-[145px]" value={customEnd} onChange={(e) => setCustomDateEnd(e.target.value)} />
            </div>
          )}
          <Select value={autoRefresh} onValueChange={setAutoRefresh}>
            <SelectTrigger className="w-[168px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Atualização manual</SelectItem>
              <SelectItem value="30">30 s</SelectItem>
              <SelectItem value="60">1 min</SelectItem>
              <SelectItem value="120">2 min</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={fetchAll} disabled={loading} title="Atualizar dados">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </Button>
          <Button onClick={generatePDF} disabled={!overview}>
            <FileDown size={16} /> Exportar PDF
          </Button>
          <Button variant="outline" onClick={generateDetailedTicketsPDF} disabled={generatingDetailed}>
            <FileDown size={16} /> {generatingDetailed ? 'Gerando...' : 'Relatório detalhado'}
          </Button>
        </div>
      </header>

      {/* KPIs do período */}
      {overview && (
        <section className="mb-6 grid grid-cols-2 gap-3.5 lg:grid-cols-4" aria-label="Indicadores do período">
          <KpiCard
            icon={Ticket}
            accent="blue"
            label="Total de tickets"
            value={overview.totalTickets}
            tooltip="Quantidade total de tickets criados no período selecionado (hoje, semana, mês, etc.)."
          />
          <KpiCard
            icon={CheckCircle}
            accent="green"
            label="Resolvidos no período"
            value={overview.resolvedTickets}
            tooltip="Tickets marcados como Resolvido ou Fechado cuja última atualização (conclusão) ocorreu dentro do período selecionado."
          />
          <KpiCard
            icon={TrendingUp}
            accent="purple"
            label="Taxa do lote"
            value={`${overview.resolutionRate.toFixed(1)}%`}
            tooltip="Entre os tickets criados no período, qual percentual já está Resolvido ou Fechado hoje. Não usa o total de conclusões do período (que pode incluir tickets antigos)."
          />
          <KpiCard
            icon={Clock}
            accent="orange"
            label="Tempo médio"
            value={formatHours(overview.avgResolutionTimeHours)}
            tooltip="Média de horas entre o agente assumir o ticket e a conclusão, descontando pausas. Considera apenas tickets concluídos no período (data de conclusão)."
          />
        </section>
      )}

      {/* Visão do sistema */}
      {systemData && (
        <section className="mb-6">
          <div className={SECTION_HEAD}>
            <h2 className={SECTION_TITLE}>Visão do sistema</h2>
            <InfoTooltip text="Contagens atuais do sistema (não filtradas pelo período do relatório)." />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Card className="flex-row items-center gap-3 px-4 py-3">
              <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-md', ACCENT.blue.soft, ACCENT.blue.softText)}>
                <Users size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <span className="block truncate text-[0.7rem] font-medium text-muted-foreground">Usuários</span>
                <span className="block text-base leading-tight font-bold text-foreground">{systemData.users}</span>
              </div>
            </Card>
            <Card className="flex-row items-center gap-3 px-4 py-3">
              <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-md', ACCENT.purple.soft, ACCENT.purple.softText)}>
                <FileText size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <span className="block truncate text-[0.7rem] font-medium text-muted-foreground">Formulários</span>
                <span className="block text-base leading-tight font-bold text-foreground">{systemData.forms}</span>
              </div>
            </Card>
            <Card className="flex-row items-center gap-3 px-4 py-3">
              <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-md', ACCENT.green.soft, ACCENT.green.softText)}>
                <Layers size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <span className="block truncate text-[0.7rem] font-medium text-muted-foreground">Páginas</span>
                <span className="block text-base leading-tight font-bold text-foreground">{systemData.pages}</span>
              </div>
            </Card>
            <Card className="flex-row items-center gap-3 px-4 py-3">
              <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-md', ACCENT.orange.soft, ACCENT.orange.softText)}>
                <UserCheck size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <span className="block truncate text-[0.7rem] font-medium text-muted-foreground">Grupos</span>
                <span className="block text-base leading-tight font-bold text-foreground">{systemData.groups}</span>
              </div>
            </Card>
            <Card className="flex-row items-center gap-3 px-4 py-3">
              <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-md', ACCENT.red.soft, ACCENT.red.softText)}>
                <FolderKanban size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <span className="block truncate text-[0.7rem] font-medium text-muted-foreground">Projetos</span>
                <span className="block text-base leading-tight font-bold text-foreground">{systemData.projects}</span>
                <span className="block truncate text-[0.65rem] text-muted-foreground">{systemData.projectTasksOpen} tarefas em aberto</span>
              </div>
            </Card>
            {systemData.ticketsPendingApproval > 0 && (
              <Card className={cn('flex-row items-center gap-3 px-4 py-3 ring-1 ring-[rgba(245,158,11,0.45)]')}>
                <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-white', ACCENT.orange.solid)}>
                  <AlertCircle size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-[0.7rem] font-medium text-muted-foreground">Pendentes aprovação</span>
                  <span className="block text-base leading-tight font-bold text-foreground">{systemData.ticketsPendingApproval}</span>
                </div>
              </Card>
            )}
          </div>
        </section>
      )}

      {/* Grid: Status + Prioridade */}
      {overview && (
        <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="gap-3 px-4 py-4">
            <div className={SECTION_HEAD}>
              <PieChart size={16} className={cn('shrink-0', ACCENT.purple.text)} />
              <h3 className={SECTION_TITLE}>Por status</h3>
              <InfoTooltip text="Distribuição dos tickets do período por status atual (Aberto, Em progresso, Resolvido, Fechado, etc.)." />
            </div>
            {overview.ticketsByStatus.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Nenhum ticket no período</p>
            ) : (
              <div className="flex flex-col gap-3">
                {overview.ticketsByStatus.map((s) => {
                  const pct = totalStatus > 0 ? (s.count / totalStatus) * 100 : 0;
                  const accent = STATUS_ACCENT[s.status] || 'purple';
                  return (
                    <div key={s.status} className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-[0.8125rem]">
                        <span className="flex items-center gap-1.5 font-medium text-foreground">
                          <span className={cn('h-1.5 w-1.5 rounded-full', ACCENT[accent].solid)} />
                          {STATUS_LABELS[s.status] || s.status}
                        </span>
                        <span className="font-semibold text-foreground tabular-nums">{s.count} <span className="font-normal text-muted-foreground">({pct.toFixed(0)}%)</span></span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className={cn('h-full rounded-full transition-[width] duration-300', ACCENT[accent].solid)} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
          <Card className="gap-3 px-4 py-4">
            <div className={SECTION_HEAD}>
              <BarChart3 size={16} className={cn('shrink-0', ACCENT.blue.text)} />
              <h3 className={SECTION_TITLE}>Por prioridade</h3>
              <InfoTooltip text="Quantidade de tickets por nível de prioridade (Baixa, Média, Alta, Urgente) no período." />
            </div>
            {overview.ticketsByPriority.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Nenhum ticket no período</p>
            ) : (
              <div className="flex flex-col gap-3">
                {overview.ticketsByPriority.map((p) => {
                  const pct = totalPriority > 0 ? (p.count / totalPriority) * 100 : 0;
                  const accent = PRIORITY_ACCENT[p.priority] || 'purple';
                  return (
                    <div key={p.priority} className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-[0.8125rem]">
                        <span className="flex items-center gap-1.5 font-medium text-foreground">
                          <span className={cn('h-1.5 w-1.5 rounded-full', ACCENT[accent].solid)} />
                          {PRIORITY_LABELS[p.priority] || p.priority}
                        </span>
                        <span className="font-semibold text-foreground tabular-nums">{p.count} <span className="font-normal text-muted-foreground">({pct.toFixed(0)}%)</span></span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className={cn('h-full rounded-full transition-[width] duration-300', ACCENT[accent].solid)} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Por formulário */}
      <TableCard
        title="Tickets por formulário"
        tooltip="Quantidade de tickets gerados por cada formulário no período, com totais resolvidos e tempo médio de resolução."
        accent="purple"
        empty={formsData.length === 0 ? 'Nenhum ticket por formulário no período.' : undefined}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Formulário</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Resolvidos</TableHead>
              <TableHead>Taxa</TableHead>
              <TableHead>Tempo médio</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {formsData.map((f) => {
              const rate = f.ticket_count > 0 ? (f.resolved_count / f.ticket_count) * 100 : 0;
              return (
                <TableRow key={f.id}>
                  <TableCell className="font-semibold whitespace-normal">{f.name}</TableCell>
                  <TableCell className="tabular-nums">{f.ticket_count}</TableCell>
                  <TableCell className="tabular-nums">{f.resolved_count}</TableCell>
                  <TableCell className="tabular-nums">{rate.toFixed(1)}%</TableCell>
                  <TableCell className="tabular-nums">{formatHours(f.avg_resolution_hours)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableCard>

      {/* Por categoria */}
      {categoryData.length > 0 && (
        <TableCard
          title="Tickets por categoria"
          tooltip="Tickets do período agrupados por categoria de atendimento."
          accent="blue"
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Categoria</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Resolvidos</TableHead>
                <TableHead>Taxa</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categoryData.map((c) => {
                const rate = c.ticket_count > 0 ? (c.resolved_count / c.ticket_count) * 100 : 0;
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-semibold whitespace-normal">{c.name}</TableCell>
                    <TableCell className="tabular-nums">{c.ticket_count}</TableCell>
                    <TableCell className="tabular-nums">{c.resolved_count}</TableCell>
                    <TableCell className="tabular-nums">{rate.toFixed(1)}%</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableCard>
      )}

      {/* Performance de agentes */}
      {agentsData.length > 0 && (
        <TableCard
          title="Performance de agentes"
          tooltip="Tickets atribuídos ao agente no período (data de atribuição ou criação). Resolvidos = concluídos no período. Taxa = resolvidos no período ÷ atribuídos no período."
          accent="green"
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agente</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Resolvidos</TableHead>
                <TableHead>Taxa</TableHead>
                <TableHead>Tempo médio</TableHead>
                <TableHead>Mín / Máx</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agentsData.map((a) => {
                const rate = a.total_tickets > 0 ? (a.resolved_tickets / a.total_tickets) * 100 : 0;
                return (
                  <TableRow key={a.id}>
                    <TableCell className="whitespace-normal">
                      <span className="block font-semibold text-foreground">{a.name}</span>
                      <span className="block text-xs text-muted-foreground">{a.email}</span>
                    </TableCell>
                    <TableCell className="tabular-nums">{a.total_tickets}</TableCell>
                    <TableCell className="tabular-nums">{a.resolved_tickets}</TableCell>
                    <TableCell className="tabular-nums">{rate.toFixed(1)}%</TableCell>
                    <TableCell className="tabular-nums">{formatHours(a.avg_resolution_hours)}</TableCell>
                    <TableCell className="tabular-nums">{formatHours(a.min_resolution_hours)} / {formatHours(a.max_resolution_hours)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableCard>
      )}

      {/* Tempo por prioridade */}
      {responseTime.length > 0 && (
        <TableCard
          title="Tempo de resolução por prioridade"
          tooltip="Tempo médio (e mínimo/máximo) para resolver tickets por nível de prioridade no período. Ajuda a ver se prioridades altas são atendidas mais rápido."
          accent="orange"
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Prioridade</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Médio</TableHead>
                <TableHead>Mín</TableHead>
                <TableHead>Máx</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {responseTime.map((r) => {
                const accent = PRIORITY_ACCENT[r.priority] || 'purple';
                return (
                  <TableRow key={r.priority}>
                    <TableCell>
                      <span className="flex items-center gap-1.5 font-semibold text-foreground">
                        <span className={cn('h-1.5 w-1.5 rounded-full', ACCENT[accent].solid)} />
                        {PRIORITY_LABELS[r.priority] || r.priority}
                      </span>
                    </TableCell>
                    <TableCell className="tabular-nums">{r.total_tickets}</TableCell>
                    <TableCell className="tabular-nums">{formatHours(r.avg_hours)}</TableCell>
                    <TableCell className="tabular-nums">{formatHours(r.min_hours)}</TableCell>
                    <TableCell className="tabular-nums">{formatHours(r.max_hours)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableCard>
      )}

      {/* Evolução (timeline) */}
      {timeline.length > 0 && (
        <section className="mb-6">
          <div className={SECTION_HEAD}>
            <TrendingUp size={16} className={cn('shrink-0', ACCENT.green.text)} />
            <h2 className={SECTION_TITLE}>Evolução no período</h2>
            <InfoTooltip text="Barras = tickets criados em cada dia/semana. O rótulo mostra criados / resolvidos naquele intervalo (resolvidos usam data de conclusão)." />
          </div>
          <Card className="gap-2 px-4 py-4">
            <div className="flex h-[160px] items-end justify-between gap-[3px]">
              {timeline.map((t) => {
                const pct = (t.total / maxTimeline) * 100;
                return (
                  <div
                    key={t.period}
                    className={cn('relative mx-auto max-w-[26px] min-w-[4px] flex-1 rounded-t transition-[height] duration-300', ACCENT.purple.solid)}
                    style={{ height: `${Math.max(pct, t.total > 0 ? 8 : 0)}%` }}
                    title={`${t.period}: ${t.total} criados, ${t.resolved} resolvidos`}
                  >
                    {t.total > 0 && (
                      <span className="pointer-events-none absolute -top-4 left-1/2 -translate-x-1/2 text-[0.625rem] font-bold whitespace-nowrap text-muted-foreground">
                        {t.total}{t.resolved > 0 ? ` / ${t.resolved}` : ''}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-[0.7rem] text-muted-foreground">
              <span>{timeline[0]?.period}</span>
              <span>{timeline[timeline.length - 1]?.period}</span>
            </div>
          </Card>
        </section>
      )}

      {/* Webhooks */}
      {webhooksData && (
        <section className="mb-6">
          <div className={SECTION_HEAD}>
            <Webhook size={16} className={cn('shrink-0', ACCENT.purple.text)} />
            <h2 className={SECTION_TITLE}>Webhooks</h2>
            <InfoTooltip text="Chamadas recebidas pelos webhooks no período, taxa de sucesso e quantos tickets foram criados a partir deles." />
          </div>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card className="gap-0 px-4 py-3">
              <span className="block text-[0.7rem] font-medium text-muted-foreground">Webhooks</span>
              <span className="block text-xl font-bold text-foreground">{webhooksData.totalWebhooks}</span>
              <span className="block text-[0.7rem] text-muted-foreground">{webhooksData.activeWebhooks} ativos</span>
            </Card>
            <Card className="gap-0 px-4 py-3">
              <span className="block text-[0.7rem] font-medium text-muted-foreground">Chamadas</span>
              <span className="block text-xl font-bold text-foreground">{webhooksData.totalCalls}</span>
            </Card>
            <Card className="gap-0 px-4 py-3">
              <span className="block text-[0.7rem] font-medium text-muted-foreground">Taxa sucesso</span>
              <span className={cn('block text-xl font-bold', ACCENT.green.text)}>{webhooksData.successRate.toFixed(1)}%</span>
            </Card>
            <Card className="gap-0 px-4 py-3">
              <span className="block text-[0.7rem] font-medium text-muted-foreground">Tickets criados</span>
              <span className="block text-xl font-bold text-foreground">{webhooksData.ticketsCreated}</span>
            </Card>
          </div>
          {webhooksData.topWebhooks && webhooksData.topWebhooks.length > 0 && (
            <Card className="px-4 py-4">
              <h4 className="mb-3 text-sm font-semibold text-foreground">Mais utilizados</h4>
              <div className="-mx-4 -mb-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Webhook</TableHead>
                      <TableHead>Chamadas</TableHead>
                      <TableHead>Sucessos</TableHead>
                      <TableHead>Erros</TableHead>
                      <TableHead>Tickets</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {webhooksData.topWebhooks.map((wh) => (
                      <TableRow key={wh.id}>
                        <TableCell className="font-semibold whitespace-normal">{wh.name}</TableCell>
                        <TableCell className="tabular-nums">{wh.total_calls}</TableCell>
                        <TableCell className={cn('tabular-nums', ACCENT.green.text)}>{wh.success_calls}</TableCell>
                        <TableCell className={cn('tabular-nums', ACCENT.red.text)}>{wh.error_calls}</TableCell>
                        <TableCell className="tabular-nums">{wh.tickets_created ?? 0}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}
        </section>
      )}
    </div>
  );
}
