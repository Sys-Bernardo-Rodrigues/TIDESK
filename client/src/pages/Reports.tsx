import { useState, useEffect } from 'react';
import axios from 'axios';
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

// ——— Tooltip de informação ———
function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="reports__info-wrap" title={text}>
      <Info size={14} className="reports__info-icon" aria-hidden />
      <span className="reports__info-tooltip">{text}</span>
    </span>
  );
}

// ——— Tipos ———
interface OverviewData {
  period: string;
  dateRange: { start: string; end: string };
  totalTickets: number;
  resolvedTickets: number;
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

// ——— Helpers ———
function formatHours(hours: number | null | undefined): string {
  if (hours == null || isNaN(hours)) return '—';
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

const PRIORITY_COLORS: Record<string, string> = {
  low: 'var(--blue)',
  medium: 'var(--orange)',
  high: 'var(--red)',
  urgent: 'var(--red)',
};

const PERIOD_LABELS: Record<string, string> = {
  today: 'Hoje',
  week: 'Semana',
  month: 'Mês',
  quarter: 'Trimestre',
  year: 'Ano',
  custom: 'Personalizado',
};

function buildPeriodParam(period: string, customStart: string, customEnd: string): string {
  if (period === 'custom' && customStart && customEnd) {
    return `custom&start=${customStart}&end=${customEnd}`;
  }
  return period;
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
      const red = [239, 68, 68] as [number, number, number];
      const dark = [26, 26, 31] as [number, number, number];
      const textPrimary = [245, 245, 247] as [number, number, number];
      const textSecondary = [184, 184, 192] as [number, number, number];
      const textDark = [26, 26, 31] as [number, number, number];
      const border = [42, 42, 46] as [number, number, number];
      const bgRow = [26, 26, 29] as [number, number, number];
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
      const resumoText = overview.totalTickets === 0
        ? 'Nenhum ticket criado no período selecionado.'
        : `No período foram criados ${overview.totalTickets} tickets. ${overview.resolvedTickets} foram resolvidos ou fechados (taxa de ${overview.resolutionRate.toFixed(1)}%). Tempo médio de resolução: ${formatHours(overview.avgResolutionTimeHours)}.`;
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

  if (loading && !overview) {
    return (
      <div className="reports reports--loading">
        <div className="reports__spinner" />
        <p>Carregando relatórios…</p>
      </div>
    );
  }

  if (error && !overview) {
    return (
      <div className="reports reports--error">
        <AlertCircle size={48} className="reports__error-icon" />
        <h2>Não foi possível carregar os relatórios</h2>
        <p>{error}</p>
        <button type="button" className="btn btn-primary" onClick={fetchAll}>Tentar novamente</button>
      </div>
    );
  }

  const maxTimeline = Math.max(...timeline.map((t) => t.total), 1);

  return (
    <div className="reports">
      <header className="reports__header">
        <div>
          <h1 className="reports__title">Relatórios</h1>
          <p className="reports__subtitle">Métricas do sistema · {periodLabel}</p>
        </div>
        <div className="reports__toolbar">
          <select
            className="reports__select"
            value={useCustomDates ? 'custom' : period}
            onChange={(e) => {
              if (e.target.value === 'custom') setUseCustomDates(true);
              else { setUseCustomDates(false); setPeriod(e.target.value); }
            }}
          >
            <option value="today">Hoje</option>
            <option value="week">Semana</option>
            <option value="month">Mês</option>
            <option value="quarter">Trimestre</option>
            <option value="year">Ano</option>
            <option value="custom">Personalizado</option>
          </select>
          {useCustomDates && (
            <div className="reports__dates">
              <input type="date" className="reports__input" value={customStart} onChange={(e) => setCustomDateStart(e.target.value)} />
              <span>até</span>
              <input type="date" className="reports__input" value={customEnd} onChange={(e) => setCustomDateEnd(e.target.value)} />
            </div>
          )}
          <select className="reports__select" value={autoRefresh} onChange={(e) => setAutoRefresh(e.target.value)}>
            <option value="0">Atualização manual</option>
            <option value="30">30 s</option>
            <option value="60">1 min</option>
            <option value="120">2 min</option>
          </select>
          <button type="button" className="btn" onClick={fetchAll} disabled={loading} title="Atualizar dados">
            <RefreshCw size={18} className={loading ? 'reports__spin' : ''} />
          </button>
          <button type="button" className="btn btn-primary reports__btn-pdf" onClick={generatePDF} disabled={!overview}>
            <FileDown size={18} /> Exportar PDF
          </button>
        </div>
      </header>

      {/* KPIs do período */}
      {overview && (
        <section className="reports__kpis">
          <div className="reports__kpi">
            <div className="reports__kpi-icon reports__kpi-icon--blue"><Ticket size={22} /></div>
            <div className="reports__kpi-body">
              <span className="reports__kpi-label">Total de tickets <InfoTooltip text="Quantidade total de tickets criados no período selecionado (hoje, semana, mês, etc.)." /></span>
              <span className="reports__kpi-value">{overview.totalTickets}</span>
            </div>
          </div>
          <div className="reports__kpi">
            <div className="reports__kpi-icon reports__kpi-icon--green"><CheckCircle size={22} /></div>
            <div className="reports__kpi-body">
              <span className="reports__kpi-label">Resolvidos <InfoTooltip text="Tickets finalizados com status Resolvido ou Fechado no período. Indica quantas demandas foram concluídas." /></span>
              <span className="reports__kpi-value">{overview.resolvedTickets}</span>
            </div>
          </div>
          <div className="reports__kpi">
            <div className="reports__kpi-icon reports__kpi-icon--purple"><TrendingUp size={22} /></div>
            <div className="reports__kpi-body">
              <span className="reports__kpi-label">Taxa de resolução <InfoTooltip text="Percentual de tickets resolvidos ou fechados em relação ao total criado no período. Quanto maior, maior a eficiência no fechamento das demandas." /></span>
              <span className="reports__kpi-value">{overview.resolutionRate.toFixed(1)}%</span>
            </div>
          </div>
          <div className="reports__kpi">
            <div className="reports__kpi-icon reports__kpi-icon--orange"><Clock size={22} /></div>
            <div className="reports__kpi-body">
              <span className="reports__kpi-label">Tempo médio <InfoTooltip text="Tempo médio entre o agente assumir o ticket e o fechamento. Pausas são descontadas. Baseado nos tickets resolvidos no período." /></span>
              <span className="reports__kpi-value">{formatHours(overview.avgResolutionTimeHours)}</span>
            </div>
          </div>
        </section>
      )}

      {/* Visão do sistema */}
      {systemData && (
        <section className="reports__section">
          <h2 className="reports__section-title">Visão do sistema <InfoTooltip text="Contagens atuais do sistema (não filtradas pelo período do relatório)." /></h2>
          <div className="reports__system-grid">
            <div className="reports__system-card">
              <Users size={20} className="reports__system-icon" />
              <span className="reports__system-label">Usuários <InfoTooltip text="Total de usuários cadastrados no sistema." /></span>
              <span className="reports__system-value">{systemData.users}</span>
            </div>
            <div className="reports__system-card">
              <FileText size={20} className="reports__system-icon" />
              <span className="reports__system-label">Formulários <InfoTooltip text="Formulários criados. São usados para captar demandas e gerar tickets." /></span>
              <span className="reports__system-value">{systemData.forms}</span>
            </div>
            <div className="reports__system-card">
              <Layers size={20} className="reports__system-icon" />
              <span className="reports__system-label">Páginas <InfoTooltip text="Páginas públicas publicadas no sistema." /></span>
              <span className="reports__system-value">{systemData.pages}</span>
            </div>
            <div className="reports__system-card">
              <UserCheck size={20} className="reports__system-icon" />
              <span className="reports__system-label">Grupos <InfoTooltip text="Grupos de usuários para organização e permissões." /></span>
              <span className="reports__system-value">{systemData.groups}</span>
            </div>
            <div className="reports__system-card">
              <FolderKanban size={20} className="reports__system-icon" />
              <span className="reports__system-label">Projetos <InfoTooltip text="Projetos ativos. O número entre parênteses são tarefas ainda não concluídas." /></span>
              <span className="reports__system-value">{systemData.projects}</span>
              <span className="reports__system-sub">{systemData.projectTasksOpen} tarefas em aberto</span>
            </div>
            {systemData.ticketsPendingApproval > 0 && (
              <div className="reports__system-card reports__system-card--alert">
                <AlertCircle size={20} className="reports__system-icon" />
                <span className="reports__system-label">Pendentes aprovação <InfoTooltip text="Tickets que aguardam aprovação antes de serem finalizados." /></span>
                <span className="reports__system-value">{systemData.ticketsPendingApproval}</span>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Grid: Status + Prioridade */}
      {overview && (
        <div className="reports__grid">
          <section className="reports__card">
            <h3 className="reports__card-title"><PieChart size={18} /> Por status <InfoTooltip text="Distribuição dos tickets do período por status atual (Aberto, Em progresso, Resolvido, Fechado, etc.)." /></h3>
            <ul className="reports__list">
              {overview.ticketsByStatus.map((s) => (
                <li key={s.status} className="reports__list-row">
                  <span>{STATUS_LABELS[s.status] || s.status}</span>
                  <strong>{s.count}</strong>
                </li>
              ))}
            </ul>
          </section>
          <section className="reports__card">
            <h3 className="reports__card-title"><BarChart3 size={18} /> Por prioridade <InfoTooltip text="Quantidade de tickets por nível de prioridade (Baixa, Média, Alta, Urgente) no período." /></h3>
            <ul className="reports__list">
              {overview.ticketsByPriority.map((p) => (
                <li key={p.priority} className="reports__list-row">
                  <span><i className="reports__dot" style={{ backgroundColor: PRIORITY_COLORS[p.priority] }} /> {PRIORITY_LABELS[p.priority] || p.priority}</span>
                  <strong>{p.count}</strong>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      {/* Por formulário */}
      <section className="reports__section">
        <h2 className="reports__section-title">Tickets por formulário <InfoTooltip text="Quantidade de tickets gerados por cada formulário no período, com totais resolvidos e tempo médio de resolução." /></h2>
        <div className="reports__card reports__table-wrap">
          {formsData.length === 0 ? (
            <p className="reports__empty">Nenhum ticket por formulário no período.</p>
          ) : (
            <table className="reports__table">
              <thead>
                <tr>
                  <th>Formulário</th>
                  <th>Total</th>
                  <th>Resolvidos</th>
                  <th>Taxa</th>
                  <th>Tempo médio</th>
                </tr>
              </thead>
              <tbody>
                {formsData.map((f) => {
                  const rate = f.ticket_count > 0 ? (f.resolved_count / f.ticket_count) * 100 : 0;
                  return (
                    <tr key={f.id}>
                      <td><strong>{f.name}</strong></td>
                      <td>{f.ticket_count}</td>
                      <td>{f.resolved_count}</td>
                      <td>{rate.toFixed(1)}%</td>
                      <td>{formatHours(f.avg_resolution_hours)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Por categoria */}
      {categoryData.length > 0 && (
        <section className="reports__section">
          <h2 className="reports__section-title">Tickets por categoria <InfoTooltip text="Tickets do período agrupados por categoria de atendimento." /></h2>
          <div className="reports__card reports__table-wrap">
            <table className="reports__table">
              <thead>
                <tr>
                  <th>Categoria</th>
                  <th>Total</th>
                  <th>Resolvidos</th>
                  <th>Taxa</th>
                </tr>
              </thead>
              <tbody>
                {categoryData.map((c) => {
                  const rate = c.ticket_count > 0 ? (c.resolved_count / c.ticket_count) * 100 : 0;
                  return (
                    <tr key={c.id}>
                      <td><strong>{c.name}</strong></td>
                      <td>{c.ticket_count}</td>
                      <td>{c.resolved_count}</td>
                      <td>{rate.toFixed(1)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Performance de agentes */}
      {agentsData.length > 0 && (
        <section className="reports__section">
          <h2 className="reports__section-title">Performance de agentes <InfoTooltip text="Métricas por agente: total de tickets atendidos, resolvidos, taxa de resolução e tempo médio (mínimo e máximo) no período." /></h2>
          <div className="reports__card reports__table-wrap">
            <table className="reports__table">
              <thead>
                <tr>
                  <th>Agente</th>
                  <th>Total</th>
                  <th>Resolvidos</th>
                  <th>Taxa</th>
                  <th>Tempo médio</th>
                  <th>Mín / Máx</th>
                </tr>
              </thead>
              <tbody>
                {agentsData.map((a) => {
                  const rate = a.total_tickets > 0 ? (a.resolved_tickets / a.total_tickets) * 100 : 0;
                  return (
                    <tr key={a.id}>
                      <td>
                        <strong>{a.name}</strong>
                        <div className="reports__meta">{a.email}</div>
                      </td>
                      <td>{a.total_tickets}</td>
                      <td>{a.resolved_tickets}</td>
                      <td>{rate.toFixed(1)}%</td>
                      <td>{formatHours(a.avg_resolution_hours)}</td>
                      <td>{formatHours(a.min_resolution_hours)} / {formatHours(a.max_resolution_hours)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Tempo por prioridade */}
      {responseTime.length > 0 && (
        <section className="reports__section">
          <h2 className="reports__section-title">Tempo de resolução por prioridade <InfoTooltip text="Tempo médio (e mínimo/máximo) para resolver tickets por nível de prioridade no período. Ajuda a ver se prioridades altas são atendidas mais rápido." /></h2>
          <div className="reports__card reports__table-wrap">
            <table className="reports__table">
              <thead>
                <tr>
                  <th>Prioridade</th>
                  <th>Total</th>
                  <th>Médio</th>
                  <th>Mín</th>
                  <th>Máx</th>
                </tr>
              </thead>
              <tbody>
                {responseTime.map((r) => (
                  <tr key={r.priority}>
                    <td><i className="reports__dot" style={{ backgroundColor: PRIORITY_COLORS[r.priority] }} /> {PRIORITY_LABELS[r.priority] || r.priority}</td>
                    <td>{r.total_tickets}</td>
                    <td>{formatHours(r.avg_hours)}</td>
                    <td>{formatHours(r.min_hours)}</td>
                    <td>{formatHours(r.max_hours)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Evolução (timeline) */}
      {timeline.length > 0 && (
        <section className="reports__section">
          <h2 className="reports__section-title">Evolução no período <InfoTooltip text="Quantidade de tickets criados ao longo do tempo (por dia ou agrupado conforme o período). Mostra a distribuição da demanda no tempo." /></h2>
          <div className="reports__card">
            <div className="reports__chart-bars">
              {timeline.map((t, i) => {
                const pct = (t.total / maxTimeline) * 100;
                return (
                  <div
                    key={t.period}
                    className="reports__chart-bar"
                    style={{ height: `${Math.max(pct, t.total > 0 ? 8 : 0)}%` }}
                    title={`${t.period}: ${t.total} tickets`}
                  >
                    {t.total > 0 && <span className="reports__chart-bar-label">{t.total}</span>}
                  </div>
                );
              })}
            </div>
            <div className="reports__chart-axis">
              <span>{timeline[0]?.period}</span>
              <span>{timeline[timeline.length - 1]?.period}</span>
            </div>
          </div>
        </section>
      )}

      {/* Webhooks */}
      {webhooksData && (
        <section className="reports__section">
          <h2 className="reports__section-title"><Webhook size={20} /> Webhooks <InfoTooltip text="Chamadas recebidas pelos webhooks no período, taxa de sucesso e quantos tickets foram criados a partir deles." /></h2>
          <div className="reports__kpis reports__kpis--compact">
            <div className="reports__kpi reports__kpi--small">
              <span className="reports__kpi-label">Webhooks <InfoTooltip text="Total de webhooks configurados e quantos estão ativos no momento." /></span>
              <span className="reports__kpi-value">{webhooksData.totalWebhooks}</span>
              <span className="reports__kpi-sub">{webhooksData.activeWebhooks} ativos</span>
            </div>
            <div className="reports__kpi reports__kpi--small">
              <span className="reports__kpi-label">Chamadas <InfoTooltip text="Número total de requisições recebidas pelos webhooks no período." /></span>
              <span className="reports__kpi-value">{webhooksData.totalCalls}</span>
            </div>
            <div className="reports__kpi reports__kpi--small">
              <span className="reports__kpi-label">Taxa sucesso <InfoTooltip text="Percentual de chamadas que foram processadas com sucesso (sem erro)." /></span>
              <span className="reports__kpi-value" style={{ color: 'var(--green)' }}>{webhooksData.successRate.toFixed(1)}%</span>
            </div>
            <div className="reports__kpi reports__kpi--small">
              <span className="reports__kpi-label">Tickets criados <InfoTooltip text="Quantidade de tickets criados a partir das chamadas de webhook no período." /></span>
              <span className="reports__kpi-value">{webhooksData.ticketsCreated}</span>
            </div>
          </div>
          {webhooksData.topWebhooks && webhooksData.topWebhooks.length > 0 && (
            <div className="reports__card reports__table-wrap" style={{ marginTop: 'var(--spacing-md)' }}>
              <h4 className="reports__card-title">Mais utilizados</h4>
              <table className="reports__table">
                <thead>
                  <tr>
                    <th>Webhook</th>
                    <th>Chamadas</th>
                    <th>Sucessos</th>
                    <th>Erros</th>
                    <th>Tickets</th>
                  </tr>
                </thead>
                <tbody>
                  {webhooksData.topWebhooks.map((w) => (
                    <tr key={w.id}>
                      <td><strong>{w.name}</strong></td>
                      <td>{w.total_calls}</td>
                      <td style={{ color: 'var(--green)' }}>{w.success_calls}</td>
                      <td style={{ color: 'var(--red)' }}>{w.error_calls}</td>
                      <td>{w.tickets_created ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <style>{`
        .reports__spinner {
          width: 48px; height: 48px;
          border: 3px solid var(--border-primary);
          border-top-color: var(--purple);
          border-radius: 50%;
          animation: reports-spin 0.8s linear infinite;
        }
        .reports__spin { animation: reports-spin 0.8s linear infinite; }
        @keyframes reports-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
