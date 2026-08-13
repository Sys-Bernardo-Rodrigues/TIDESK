import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Calendar,
  Plus,
  ChevronLeft,
  ChevronRight,
  Clock,
  Users,
  Edit,
  Trash2,
  FileBarChart,
  FileText,
} from 'lucide-react';
import { usePermissions, RESOURCES, ACTIONS } from '../hooks/usePermissions';
import { getHolidayName } from '../utils/brazilianHolidays';
import jsPDF from 'jspdf';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableHeader, TableBody, TableFooter, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { useConfirm } from '@/components/ui/confirm-dialog';

interface Shift {
  id: number;
  title: string | null;
  start_time: string;
  end_time: string;
  created_by: number;
  created_by_name: string;
  user_ids: number[];
  user_names: string[];
}

type ViewMode = 'month' | 'week' | 'day';
type TabMode = 'calendar' | 'report';

interface ReportData {
  year: number;
  month: number;
  monthName: string;
  totalShifts: number;
  users: Array<{
    name: string;
    email: string;
    totalHours: number;
    shiftsCount: number;
    shifts: Array<{
      id: number;
      title: string | null;
      start_time: string;
      end_time: string;
      hours: number;
    }>;
  }>;
}

const WEEK_DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// Paleta de cores para usuários (cores vibrantes e distintas)
const USER_COLORS = [
  '#f97316', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444', '#f59e0b', '#06b6d4', '#ec4899',
  '#14b8a6', '#f43f5e', '#6366f1', '#84cc16', '#f97316', '#06b6d4', '#8b5cf6',
];

function getUserColor(userId: number): string {
  return USER_COLORS[userId % USER_COLORS.length];
}

function getShiftColor(shift: Shift): string {
  if (shift.user_ids && shift.user_ids.length > 0) return getUserColor(shift.user_ids[0]);
  return '#f97316';
}

function SpinnerBlock({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-border border-t-[var(--purple)]" />
      <p>{text}</p>
    </div>
  );
}

export default function ShiftCalendar() {
  const { hasPermission } = usePermissions();
  const confirm = useConfirm();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [tabMode, setTabMode] = useState<TabMode>('calendar');
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [, setSelectedDate] = useState<Date | null>(null);
  const [allUsers, setAllUsers] = useState<any[]>([]);

  const canCreate = hasPermission(RESOURCES.AGENDA, ACTIONS.CREATE);
  const canEdit = hasPermission(RESOURCES.AGENDA, ACTIONS.EDIT);
  const canDelete = hasPermission(RESOURCES.AGENDA, ACTIONS.DELETE);
  const canViewUsers = hasPermission(RESOURCES.USERS, ACTIONS.VIEW);

  // Formulário de plantão
  const [shiftTitle, setShiftTitle] = useState('');
  const [shiftStartDate, setShiftStartDate] = useState('');
  const [shiftStartTime, setShiftStartTime] = useState('');
  const [shiftEndDate, setShiftEndDate] = useState('');
  const [shiftEndTime, setShiftEndTime] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);

  // Função para obter ID do usuário pelo email (para relatórios)
  const getUserIdByEmail = (email: string): number | null => {
    const user = allUsers.find((u) => u.email === email);
    return user ? user.id : null;
  };

  // Obter início e fim do período atual
  const getPeriodRange = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    if (viewMode === 'month') {
      const start = new Date(year, month, 1);
      const end = new Date(year, month + 1, 0, 23, 59, 59);
      return {
        start: start.toISOString().split('T')[0] + 'T00:00:00',
        end: end.toISOString().split('T')[0] + 'T23:59:59',
      };
    } else if (viewMode === 'week') {
      const day = currentDate.getDay();
      const diff = currentDate.getDate() - day;
      const start = new Date(currentDate);
      start.setDate(diff);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59, 59);
      return { start: start.toISOString(), end: end.toISOString() };
    } else {
      const start = new Date(currentDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(currentDate);
      end.setHours(23, 59, 59, 59);
      return { start: start.toISOString(), end: end.toISOString() };
    }
  };

  // Buscar plantões (usuários só se tiver users:view)
  const fetchData = async () => {
    try {
      setLoading(true);
      const { start, end } = getPeriodRange();
      const params = new URLSearchParams({ start, end });

      if (canViewUsers) {
        const [shiftsRes, usersRes] = await Promise.all([
          axios.get(`/api/shifts?${params.toString()}`),
          axios.get('/api/users'),
        ]);
        setShifts(shiftsRes.data);
        setAllUsers(usersRes.data);
      } else {
        const shiftsRes = await axios.get(`/api/shifts?${params.toString()}`);
        setShifts(shiftsRes.data);
        setAllUsers([]);
      }
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tabMode === 'calendar') fetchData();
    else fetchReportData();
  }, [currentDate, viewMode, tabMode, canViewUsers]);

  // Buscar dados do relatório
  const fetchReportData = async () => {
    try {
      setReportLoading(true);
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      const response = await axios.get(`/api/shifts/report/monthly?year=${year}&month=${month}`);
      setReportData(response.data);
    } catch (error) {
      console.error('Erro ao buscar relatório:', error);
    } finally {
      setReportLoading(false);
    }
  };

  // Função para converter hex para RGB
  const hexToRgb = (hex: string): [number, number, number] => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)] : [249, 115, 22];
  };

  // Gerar PDF do relatório
  const generatePDF = () => {
    if (!reportData) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - margin * 2;
    let yPos = 15;

    const primaryColor = [138, 43, 226];
    const secondaryColor = [59, 130, 246];
    const successColor = [34, 197, 94];
    const warningColor = [245, 158, 11];
    const textColor = [30, 30, 30];
    const textSecondary = [100, 100, 100];
    const borderColor = [220, 220, 230];
    const bgLight = [250, 250, 255];

    const addPageIfNeeded = (space: number) => {
      if (yPos + space > pageHeight - 20) {
        doc.addPage();
        yPos = 15;
        drawHeader();
      }
    };

    const drawHeader = () => {
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(0, 0, pageWidth, 30, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('TIDESK', margin, 18);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('Relatório de Plantões', margin + 45, 18);
      const now = new Date();
      const dateStr = now.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      doc.setFontSize(8);
      doc.text(`Gerado em: ${dateStr}`, pageWidth - margin, 18, { align: 'right' });
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
      yPos = 40;
    };

    drawHeader();

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(textSecondary[0], textSecondary[1], textSecondary[2]);
    doc.text(`Período: ${reportData.monthName}`, margin, yPos);
    yPos += 8;

    if (reportData.users.length > 0 && allUsers.length > 0) {
      const legendUsers = reportData.users.slice(0, 8);
      if (legendUsers.length > 0) {
        doc.setFontSize(7);
        doc.setTextColor(textSecondary[0], textSecondary[1], textSecondary[2]);
        doc.text('Legenda de Cores:', margin, yPos);
        yPos += 5;

        const legendItemWidth = contentWidth / Math.min(legendUsers.length, 4);
        let legendX = margin;

        legendUsers.forEach((user, idx) => {
          if (idx > 0 && idx % 4 === 0) {
            legendX = margin;
            yPos += 5;
          }
          const userId = getUserIdByEmail(user.email);
          const userColor = userId !== null ? hexToRgb(getUserColor(userId)) : [249, 115, 22];
          doc.setFillColor(userColor[0], userColor[1], userColor[2]);
          doc.circle(legendX + 2, yPos + 1.5, 1.5, 'F');
          doc.setFontSize(6);
          doc.setTextColor(textColor[0], textColor[1], textColor[2]);
          const userName = user.name.length > 15 ? user.name.substring(0, 12) + '...' : user.name;
          doc.text(userName, legendX + 5, yPos + 2);
          legendX += legendItemWidth;
        });

        yPos += 8;
      }
    }

    doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
    doc.setLineWidth(0.5);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 10;

    if (reportData.users.length > 0) {
      addPageIfNeeded(50);

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
      doc.text('Métricas Principais', margin, yPos);
      yPos += 12;

      const boxWidth = (contentWidth - 9) / 4;
      const boxHeight = 28;
      const totalHours = reportData.users.reduce((sum, user) => sum + user.totalHours, 0);
      const avgHours = reportData.users.length > 0 ? totalHours / reportData.users.length : 0;

      const metrics = [
        { label: 'Total Plantões', value: reportData.totalShifts.toString(), color: primaryColor },
        { label: 'Usuários', value: reportData.users.length.toString(), color: secondaryColor },
        { label: 'Total Horas', value: totalHours.toFixed(1) + 'h', color: successColor },
        { label: 'Média/Usuário', value: avgHours.toFixed(1) + 'h', color: warningColor },
      ];

      metrics.forEach((metric, index) => {
        const x = margin + index * (boxWidth + 3);
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
        doc.setLineWidth(0.5);
        doc.roundedRect(x, yPos, boxWidth, boxHeight, 2, 2, 'FD');
        doc.setFillColor(metric.color[0], metric.color[1], metric.color[2]);
        doc.roundedRect(x, yPos, boxWidth, 3, 2, 2, 'F');
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(textSecondary[0], textSecondary[1], textSecondary[2]);
        doc.text(metric.label, x + 4, yPos + 10);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(textColor[0], textColor[1], textColor[2]);
        doc.text(metric.value, x + 4, yPos + 22);
      });

      yPos += boxHeight + 15;
    }

    if (reportData.users.length > 0) {
      addPageIfNeeded(40);

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
      doc.text('Resumo por Usuário', margin, yPos);
      yPos += 10;

      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.roundedRect(margin, yPos, contentWidth, 8, 1, 1, 'F');
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text('Usuário', margin + 4, yPos + 5.5);
      doc.text('Plantões', margin + contentWidth - 50, yPos + 5.5, { align: 'right' });
      doc.text('Total Horas', margin + contentWidth - 4, yPos + 5.5, { align: 'right' });
      yPos += 10;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      const totalShifts = reportData.users.reduce((sum, user) => sum + user.shiftsCount, 0);
      const totalHours = reportData.users.reduce((sum, user) => sum + user.totalHours, 0);

      reportData.users.forEach((user, index) => {
        addPageIfNeeded(10);
        if (index % 2 === 0) {
          doc.setFillColor(bgLight[0], bgLight[1], bgLight[2]);
          doc.rect(margin, yPos - 1, contentWidth, 8, 'F');
        }
        const userId = getUserIdByEmail(user.email);
        const userColor = userId !== null ? hexToRgb(getUserColor(userId)) : [249, 115, 22];
        doc.setFillColor(userColor[0], userColor[1], userColor[2]);
        doc.circle(margin + 4, yPos + 3, 2, 'F');
        doc.setTextColor(textColor[0], textColor[1], textColor[2]);
        doc.text(user.name, margin + 9, yPos + 5);
        doc.setFont('helvetica', 'bold');
        doc.text(user.shiftsCount.toString(), margin + contentWidth - 50, yPos + 5, { align: 'right' });
        doc.text(`${user.totalHours.toFixed(2)}h`, margin + contentWidth - 4, yPos + 5, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        yPos += 9;
      });

      yPos += 2;
      doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
      doc.setLineWidth(0.5);
      doc.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 5;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
      doc.text('Total', margin + 4, yPos + 5);
      doc.text(totalShifts.toString(), margin + contentWidth - 50, yPos + 5, { align: 'right' });
      doc.text(`${totalHours.toFixed(2)}h`, margin + contentWidth - 4, yPos + 5, { align: 'right' });
      yPos += 12;
    }

    if (reportData.users.length > 0) {
      reportData.users.forEach((user) => {
        addPageIfNeeded(50);
        const userId = getUserIdByEmail(user.email);
        const userColor = userId !== null ? hexToRgb(getUserColor(userId)) : [249, 115, 22];

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(userColor[0], userColor[1], userColor[2]);
        doc.text(user.name, margin, yPos);

        yPos += 7;
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(textSecondary[0], textSecondary[1], textSecondary[2]);
        doc.text(user.email, margin, yPos);

        yPos += 6;
        doc.setFontSize(9);
        doc.setTextColor(textColor[0], textColor[1], textColor[2]);
        doc.text(`Total: ${user.totalHours.toFixed(2)}h em ${user.shiftsCount} ${user.shiftsCount === 1 ? 'plantão' : 'plantões'}`, margin, yPos);

        yPos += 8;
        doc.setDrawColor(userColor[0], userColor[1], userColor[2]);
        doc.setLineWidth(0.5);
        doc.line(margin, yPos, pageWidth - margin, yPos);
        yPos += 6;

        user.shifts.forEach((shift) => {
          addPageIfNeeded(25);
          const startDate = new Date(shift.start_time);
          const endDate = new Date(shift.end_time);

          doc.setFillColor(255, 255, 255);
          doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
          doc.setLineWidth(0.3);
          doc.roundedRect(margin, yPos - 3, contentWidth, 20, 2, 2, 'FD');
          doc.setFillColor(userColor[0], userColor[1], userColor[2]);
          doc.rect(margin, yPos - 3, 3, 20, 'F');

          doc.setFontSize(9);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(textColor[0], textColor[1], textColor[2]);
          const title = shift.title || 'Plantão';
          doc.text(title, margin + 6, yPos + 3);

          doc.setFontSize(7);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(textSecondary[0], textSecondary[1], textSecondary[2]);
          doc.text(`Início: ${startDate.toLocaleDateString('pt-BR')} ${startDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`, margin + 6, yPos + 8);
          doc.text(`Término: ${endDate.toLocaleDateString('pt-BR')} ${endDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`, margin + 6, yPos + 12);

          doc.setFont('helvetica', 'bold');
          doc.setTextColor(userColor[0], userColor[1], userColor[2]);
          doc.text(`Duração: ${shift.hours.toFixed(2)}h`, margin + contentWidth - 4, yPos + 10, { align: 'right' });

          yPos += 22;
        });

        yPos += 5;
      });
    }

    const fileName = `relatorio-plantoes-${reportData.year}-${String(reportData.month).padStart(2, '0')}.pdf`;
    doc.save(fileName);
  };

  // Gerar PDF simplificado: calendário do mês com o nome do plantonista em cada dia
  const generateShiftCalendarPDF = () => {
    if (!reportData) return;

    // Mapear cada dia do mês para os nomes (com cor do usuário) de quem está de plantão
    const dayNames: Record<string, Array<{ name: string; color: [number, number, number] }>> = {};
    reportData.users.forEach((user) => {
      const userId = getUserIdByEmail(user.email);
      const color = userId !== null ? hexToRgb(getUserColor(userId)) : ([249, 115, 22] as [number, number, number]);
      user.shifts.forEach((shift) => {
        const start = new Date(shift.start_time);
        const end = new Date(shift.end_time);
        const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
        const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
        while (cursor <= endDay) {
          const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
          if (!dayNames[key]) dayNames[key] = [];
          if (!dayNames[key].some((n) => n.name === user.name)) dayNames[key].push({ name: user.name, color });
          cursor.setDate(cursor.getDate() + 1);
        }
      });
    });

    const lighten = (rgb: [number, number, number], amt: number): [number, number, number] => [
      Math.round(rgb[0] + (255 - rgb[0]) * amt),
      Math.round(rgb[1] + (255 - rgb[1]) * amt),
      Math.round(rgb[2] + (255 - rgb[2]) * amt),
    ];

    const doc = new jsPDF({ orientation: 'landscape' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;

    const primaryColor: [number, number, number] = [138, 43, 226];
    const secondaryColor: [number, number, number] = [59, 130, 246];
    const textColor: [number, number, number] = [30, 30, 30];
    const textSecondary: [number, number, number] = [110, 110, 122];
    const borderColor: [number, number, number] = [224, 222, 235];
    const weekendBg: [number, number, number] = [249, 247, 253];

    // Cabeçalho
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 0, pageWidth, 26, 'F');
    doc.setFillColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.rect(0, 26, pageWidth, 1.2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(17);
    doc.setFont('helvetica', 'bold');
    doc.text('TIDESK', margin, 15);
    doc.setFontSize(10.5);
    doc.setFont('helvetica', 'normal');
    doc.text('Calendário de Plantões', margin + 33, 15);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(reportData.monthName.charAt(0).toUpperCase() + reportData.monthName.slice(1), margin, 22);
    const now = new Date();
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Gerado em ${now.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
      pageWidth - margin,
      15,
      { align: 'right' }
    );

    // Legenda de plantonistas
    let legendBottom = 32;
    const legendUsers = reportData.users.filter((u) => u.shiftsCount > 0);
    if (legendUsers.length > 0) {
      doc.setFontSize(8);
      let lx = margin;
      let ly = 32;
      legendUsers.forEach((user) => {
        const userId = getUserIdByEmail(user.email);
        const color = userId !== null ? hexToRgb(getUserColor(userId)) : ([249, 115, 22] as [number, number, number]);
        const label = user.name;
        const textWidth = doc.getTextWidth(label);
        const chipWidth = textWidth + 9;
        if (lx + chipWidth > pageWidth - margin) {
          lx = margin;
          ly += 6;
        }
        doc.setFillColor(color[0], color[1], color[2]);
        doc.circle(lx + 2.2, ly - 1.2, 1.6, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(textColor[0], textColor[1], textColor[2]);
        doc.text(label, lx + 6, ly, { maxWidth: 60 });
        lx += chipWidth + 4;
      });
      legendBottom = ly + 4;
    }

    const gridTop = legendBottom + 2;
    const gridWidth = pageWidth - margin * 2;
    const cols = 7;
    const cellWidth = gridWidth / cols;
    const weekDays = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.roundedRect(margin, gridTop, gridWidth, 8, 1.5, 1.5, 'F');
    doc.rect(margin, gridTop + 4, gridWidth, 4, 'F');
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    weekDays.forEach((label, i) => {
      doc.text(label, margin + i * cellWidth + cellWidth / 2, gridTop + 5.5, { align: 'center' });
    });

    const year = reportData.year;
    const month = reportData.month;
    const firstDay = new Date(year, month - 1, 1);
    const daysInMonth = new Date(year, month, 0).getDate();
    const startWeekday = firstDay.getDay();
    const rows = Math.ceil((startWeekday + daysInMonth) / 7);
    const rowHeight = (pageHeight - gridTop - 8 - margin - 6) / rows;

    let dayCounter = 1;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cellIndex = r * cols + c;
        const x = margin + c * cellWidth;
        const y = gridTop + 8 + r * rowHeight;
        const isWeekendCol = c === 0 || c === 6;

        doc.setFillColor(
          isWeekendCol ? weekendBg[0] : 255,
          isWeekendCol ? weekendBg[1] : 255,
          isWeekendCol ? weekendBg[2] : 255
        );
        doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
        doc.setLineWidth(0.25);
        doc.rect(x, y, cellWidth, rowHeight, 'FD');

        if (cellIndex >= startWeekday && dayCounter <= daysInMonth) {
          const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(dayCounter).padStart(2, '0')}`;

          // Número do dia — badge discreto no canto superior direito
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.setTextColor(textSecondary[0], textSecondary[1], textSecondary[2]);
          doc.text(String(dayCounter), x + cellWidth - 3, y + 5.5, { align: 'right' });

          // Nome do(s) plantonista(s) — destaque: pill colorida, negrito
          const names = dayNames[dateKey] || [];
          let ny = y + 6.5;
          const lineHeight = 6;
          const maxLines = Math.max(1, Math.floor((rowHeight - 9) / lineHeight));
          names.slice(0, maxLines).forEach((entry) => {
            const label = entry.name.length > 22 ? entry.name.slice(0, 20) + '…' : entry.name;
            const pillWidth = Math.min(doc.getTextWidth(label) + 5, cellWidth - 5);
            const pillBg = lighten(entry.color, 0.82);
            doc.setFillColor(pillBg[0], pillBg[1], pillBg[2]);
            doc.roundedRect(x + 2, ny - 3.6, pillWidth, 5, 1, 1, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8.5);
            doc.setTextColor(entry.color[0], entry.color[1], entry.color[2]);
            doc.text(label, x + 4, ny, { maxWidth: cellWidth - 8 });
            ny += lineHeight;
          });
          if (names.length > maxLines) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6.5);
            doc.setTextColor(textSecondary[0], textSecondary[1], textSecondary[2]);
            doc.text(`+${names.length - maxLines}`, x + 4, ny);
          }

          dayCounter++;
        }
      }
    }

    // Rodapé
    doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
    doc.setLineWidth(0.3);
    doc.line(margin, pageHeight - 8, pageWidth - margin, pageHeight - 8);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(textSecondary[0], textSecondary[1], textSecondary[2]);
    doc.text('TIDESK · Calendário de Plantões', margin, pageHeight - 4);
    doc.text('Página 1', pageWidth - margin, pageHeight - 4, { align: 'right' });

    const fileName = `calendario-plantoes-${reportData.year}-${String(reportData.month).padStart(2, '0')}.pdf`;
    doc.save(fileName);
  };

  // Navegação do calendário
  const goToPrevious = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'month') newDate.setMonth(newDate.getMonth() - 1);
    else if (viewMode === 'week') newDate.setDate(newDate.getDate() - 7);
    else newDate.setDate(newDate.getDate() - 1);
    setCurrentDate(newDate);
  };

  const goToNext = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'month') newDate.setMonth(newDate.getMonth() + 1);
    else if (viewMode === 'week') newDate.setDate(newDate.getDate() + 7);
    else newDate.setDate(newDate.getDate() + 1);
    setCurrentDate(newDate);
  };

  const goToToday = () => setCurrentDate(new Date());

  // Abrir modal para criar plantão
  const openCreateModal = (date?: Date) => {
    const targetDate = date || new Date();
    const dateStr = targetDate.toISOString().split('T')[0];
    const timeStr = targetDate.toTimeString().slice(0, 5);

    setSelectedShift(null);
    setSelectedDate(targetDate);
    setShiftTitle('');
    setShiftStartDate(dateStr);
    setShiftStartTime(timeStr);
    setShiftEndDate(dateStr);
    setShiftEndTime(timeStr);
    setSelectedUserIds([]);
    setShowShiftModal(true);
  };

  // Abrir modal para editar plantão
  const openEditModal = (shift: Shift) => {
    setSelectedShift(shift);
    setSelectedDate(null);

    const start = new Date(shift.start_time);
    const end = new Date(shift.end_time);

    setShiftTitle(shift.title || '');
    setShiftStartDate(start.toISOString().split('T')[0]);
    setShiftStartTime(start.toTimeString().slice(0, 5));
    setShiftEndDate(end.toISOString().split('T')[0]);
    setShiftEndTime(end.toTimeString().slice(0, 5));
    setSelectedUserIds(shift.user_ids || []);
    setShowShiftModal(true);
  };

  // Salvar plantão
  const saveShift = async () => {
    try {
      if (selectedUserIds.length === 0) {
        toast.error('Selecione pelo menos um usuário para o plantão');
        return;
      }

      const startDateTime = `${shiftStartDate}T${shiftStartTime}:00`;
      const endDateTime = `${shiftEndDate}T${shiftEndTime}:00`;

      const shiftData = {
        title: shiftTitle || null,
        start_time: startDateTime,
        end_time: endDateTime,
        user_ids: selectedUserIds,
      };

      if (selectedShift) {
        await axios.put(`/api/shifts/${selectedShift.id}`, shiftData);
      } else {
        await axios.post('/api/shifts', shiftData);
      }

      setShowShiftModal(false);
      fetchData();
    } catch (error: any) {
      console.error('Erro ao salvar plantão:', error);
      toast.error(error.response?.data?.error || 'Erro ao salvar plantão');
    }
  };

  // Deletar plantão
  const deleteShift = async (shiftId: number) => {
    const ok = await confirm({
      title: 'Excluir plantão',
      description: 'Tem certeza que deseja excluir este plantão?',
      confirmLabel: 'Excluir',
      variant: 'destructive',
    });
    if (!ok) return;

    try {
      await axios.delete(`/api/shifts/${shiftId}`);
      setShowShiftModal(false);
      setSelectedShift(null);
      if (tabMode === 'calendar') await fetchData();
      else await fetchReportData();
    } catch (error: any) {
      console.error('Erro ao deletar plantão:', error);
      toast.error(error.response?.data?.error || 'Erro ao deletar plantão');
      if (tabMode === 'calendar') await fetchData();
      else await fetchReportData();
    }
  };

  // Obter plantões para um dia específico
  const getShiftsForDay = (date: Date) => {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return shifts.filter((shift) => {
      if (!shift.start_time) return false;
      const shiftStart = new Date(shift.start_time);
      const shiftEnd = shift.end_time ? new Date(shift.end_time) : shiftStart;
      return (
        (shiftStart >= startOfDay && shiftStart <= endOfDay) ||
        (shiftEnd >= startOfDay && shiftEnd <= endOfDay) ||
        (shiftStart <= startOfDay && shiftEnd >= endOfDay)
      );
    });
  };

  // Renderizar calendário mensal
  const renderMonthView = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: { date: Date; isCurrentMonth: boolean }[] = [];
    const prevMonthLastDay = new Date(year, month, 0);
    const prevMonthDaysCount = prevMonthLastDay.getDate();

    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      days.push({ date: new Date(year, month - 1, prevMonthDaysCount - i), isCurrentMonth: false });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      days.push({ date: new Date(year, month, day), isCurrentMonth: true });
    }
    const remainingDays = 42 - days.length;
    for (let day = 1; day <= remainingDays; day++) {
      days.push({ date: new Date(year, month + 1, day), isCurrentMonth: false });
    }

    return (
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-border bg-border">
        {WEEK_DAYS.map((day) => (
          <div key={day} className="bg-muted px-2 py-2.5 text-center text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {day}
          </div>
        ))}
        {days.map((day, index) => {
          const dayShifts = getShiftsForDay(day.date);
          const isToday = day.date.toDateString() === new Date().toDateString();
          const holidayName = getHolidayName(day.date);
          const isWeekend = day.date.getDay() === 0 || day.date.getDay() === 6;

          return (
            <div
              key={index}
              onClick={() => canCreate && openCreateModal(day.date)}
              className={cn(
                'flex min-h-[140px] flex-col gap-1 bg-background p-1.5 transition-colors',
                canCreate && 'cursor-pointer hover:bg-muted/60',
                !day.isCurrentMonth && 'bg-muted/40 opacity-40',
                isToday && 'ring-2 ring-inset ring-[var(--purple)]'
              )}
            >
              <div className="flex items-center justify-between">
                <div
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-full text-[0.8125rem] font-semibold text-foreground',
                    isToday && 'h-7 w-7 bg-[var(--purple-light)] text-base font-bold text-[var(--purple)]',
                    !isToday && isWeekend && day.isCurrentMonth && 'text-muted-foreground'
                  )}
                >
                  {day.date.getDate()}
                </div>
                {dayShifts.length > 0 && (
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[0.7rem] font-semibold text-muted-foreground">{dayShifts.length}</span>
                )}
              </div>
              {holidayName && day.isCurrentMonth && (
                <div className="text-[0.65rem] leading-tight font-medium text-[var(--purple)] italic">{holidayName}</div>
              )}
              <div className="flex flex-1 flex-col gap-[3px] overflow-hidden">
                {dayShifts.slice(0, 3).map((shift) => {
                  const shiftColor = getShiftColor(shift);
                  return (
                    <div
                      key={shift.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (canEdit) openEditModal(shift);
                      }}
                      className="flex items-center gap-1 truncate rounded px-1.5 py-0.5 text-[0.7rem] font-medium text-white shadow-sm transition-transform hover:translate-x-0.5"
                      style={{ backgroundColor: shiftColor }}
                      title={shift.title || `Plantão - ${shift.user_names.join(', ')}`}
                    >
                      {shift.user_ids && shift.user_ids.length > 1 && <span className="shrink-0 opacity-90">👥</span>}
                      <span className="truncate">
                        {shift.title || `Plantão: ${shift.user_names.slice(0, 2).join(', ')}${shift.user_names.length > 2 ? '...' : ''}`}
                      </span>
                    </div>
                  );
                })}
                {dayShifts.length > 3 && (
                  <div className="text-center text-[0.7rem] text-muted-foreground italic">+{dayShifts.length - 3} mais</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Obter nome do mês/semana/dia
  const getPeriodName = () => {
    if (viewMode === 'month') {
      return currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    } else if (viewMode === 'week') {
      const day = currentDate.getDay();
      const diff = currentDate.getDate() - day;
      const start = new Date(currentDate);
      start.setDate(diff);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return `${start.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} - ${end.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}`;
    } else {
      return currentDate.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    }
  };

  // Renderizar visualização semanal
  const renderWeekView = () => {
    const day = currentDate.getDay();
    const diff = currentDate.getDate() - day;
    const start = new Date(currentDate);
    start.setDate(diff);

    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      days.push(date);
    }

    return (
      <div className="grid min-h-[600px] grid-cols-7 gap-px bg-border">
        {days.map((date, index) => {
          const dayShifts = getShiftsForDay(date);
          const isToday = date.toDateString() === new Date().toDateString();
          const isWeekend = index === 0 || index === 6;

          return (
            <div key={index} className={cn('min-h-full bg-background p-1.5', isToday && 'ring-2 ring-inset ring-[var(--purple)]')}>
              <div
                onClick={() => canCreate && openCreateModal(date)}
                className={cn('mb-2 rounded-md p-1.5', canCreate && 'cursor-pointer', isToday && 'bg-[var(--purple-light)]')}
              >
                <div className={cn('text-xs font-medium', isWeekend ? 'text-muted-foreground' : 'text-foreground')}>{WEEK_DAYS[index]}</div>
                <div className={cn('text-xl font-semibold text-foreground', isToday && 'font-bold text-[var(--purple)]')}>{date.getDate()}</div>
              </div>

              <div className="flex flex-col gap-1">
                {dayShifts.map((shift) => {
                  const shiftColor = getShiftColor(shift);
                  return (
                    <div
                      key={shift.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (canEdit) openEditModal(shift);
                      }}
                      className="cursor-pointer rounded-md px-2 py-1.5 text-white shadow-sm transition-[opacity,transform] hover:scale-[1.02] hover:opacity-90"
                      style={{ backgroundColor: shiftColor }}
                      title={shift.title || `Plantão - ${shift.user_names.join(', ')}`}
                    >
                      <div className="mb-0.5 flex items-center gap-1">
                        {shift.user_ids && shift.user_ids.length > 1 && <span className="text-xs opacity-90">👥</span>}
                        <span className="text-xs font-semibold">{shift.title || 'Plantão'}</span>
                      </div>
                      {shift.start_time && (
                        <div className="text-[0.7rem] opacity-90">
                          {new Date(shift.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} -{' '}
                          {new Date(shift.end_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      )}
                      {shift.user_names && shift.user_names.length > 0 && (
                        <div className="mt-0.5 text-[0.7rem] opacity-90">
                          {shift.user_names.slice(0, 2).join(', ')}
                          {shift.user_names.length > 2 ? ` +${shift.user_names.length - 2}` : ''}
                        </div>
                      )}
                    </div>
                  );
                })}
                {dayShifts.length === 0 && canCreate && (
                  <div
                    onClick={() => openCreateModal(date)}
                    className="cursor-pointer rounded-md border border-dashed border-border p-1.5 text-center text-xs text-muted-foreground"
                  >
                    Clique para adicionar
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Renderizar visualização diária
  const renderDayView = () => {
    const dayShifts = getShiftsForDay(currentDate);
    const isToday = currentDate.toDateString() === new Date().toDateString();
    const holidayName = getHolidayName(currentDate);

    const sortedShifts = [...dayShifts].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

    return (
      <div>
        <Card className={cn('mb-6 gap-1 px-4 py-3.5', isToday && 'bg-[var(--purple-light)] ring-1 ring-[var(--purple)]')}>
          <div className="text-xl font-bold text-foreground capitalize">
            {currentDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
          <div className="text-sm text-muted-foreground">
            {sortedShifts.length} {sortedShifts.length === 1 ? 'plantão' : 'plantões'} agendado{sortedShifts.length !== 1 ? 's' : ''}
          </div>
          {holidayName && <div className="mt-0.5 text-xs text-muted-foreground italic opacity-80">🎉 {holidayName}</div>}
        </Card>

        {sortedShifts.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <Calendar size={48} strokeWidth={1.5} className="mx-auto mb-4 opacity-50" />
            <p className="mb-4">Nenhum plantão agendado para este dia</p>
            {canCreate && (
              <Button onClick={() => openCreateModal(currentDate)}>
                <Plus size={18} /> Criar Plantão
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {sortedShifts.map((shift) => {
              const startTime = new Date(shift.start_time);
              const endTime = new Date(shift.end_time);
              const shiftColor = getShiftColor(shift);

              return (
                <Card
                  key={shift.id}
                  onClick={() => canEdit && openEditModal(shift)}
                  className={cn('gap-0 border-l-4 px-4 py-3.5 transition-transform', canEdit && 'cursor-pointer hover:translate-x-1')}
                  style={{ borderLeftColor: shiftColor }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <h3 className="text-[1.0625rem] font-semibold text-foreground">{shift.title || 'Plantão'}</h3>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock size={14} />
                          {startTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          {startTime.toDateString() !== endTime.toDateString() && (
                            <> até {endTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</>
                          )}
                          {startTime.toDateString() === endTime.toDateString() && startTime.getTime() !== endTime.getTime() && (
                            <> - {endTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</>
                          )}
                        </span>
                        {shift.user_names && shift.user_names.length > 0 && (
                          <span className="flex items-center gap-1">
                            <Users size={14} /> {shift.user_names.join(', ')}
                          </span>
                        )}
                      </div>
                    </div>

                    {(canEdit || canDelete) && (
                      <div className="flex shrink-0 gap-1.5">
                        {canEdit && (
                          <Button
                            variant="secondary"
                            size="icon-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditModal(shift);
                            }}
                          >
                            <Edit size={15} />
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            variant="destructive"
                            size="icon-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteShift(shift.id);
                            }}
                          >
                            <Trash2 size={15} />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // Renderizar visualização de relatório
  const renderReportView = () => {
    if (reportLoading) return <SpinnerBlock text="Carregando relatório…" />;

    if (!reportData) {
      return (
        <Card className="flex flex-col items-center gap-3 px-4 py-16 text-center text-muted-foreground">
          <FileBarChart size={48} strokeWidth={1.5} className="opacity-50" />
          <p>Nenhum dado disponível para o período selecionado</p>
        </Card>
      );
    }

    const totalShiftsSum = reportData.users.reduce((sum, user) => sum + user.shiftsCount, 0);
    const totalHoursSum = reportData.users.reduce((sum, user) => sum + user.totalHours, 0);

    return (
      <div className="flex flex-col gap-5">
        <p className="text-sm text-muted-foreground">
          Total de {reportData.totalShifts} {reportData.totalShifts === 1 ? 'plantão' : 'plantões'} registrado{reportData.totalShifts !== 1 ? 's' : ''} em{' '}
          {reportData.monthName}.
        </p>

        {reportData.users.length === 0 ? (
          <Card className="flex flex-col items-center gap-3 px-4 py-16 text-center text-muted-foreground">
            <Users size={48} strokeWidth={1.5} className="opacity-50" />
            <p>Nenhum usuário com plantões registrados neste mês</p>
          </Card>
        ) : (
          <Card className="px-4 py-4">
            <div className="-mx-4 -mb-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead className="text-center">Plantões</TableHead>
                    <TableHead className="text-right">Total de horas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportData.users.map((user, i) => (
                    <TableRow key={i}>
                      <TableCell className="whitespace-normal">
                        <span className="block font-semibold text-foreground">{user.name}</span>
                        <span className="block text-xs text-muted-foreground">{user.email}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="border-0 bg-[var(--purple-light)] text-[var(--purple)] tabular-nums">
                          {user.shiftsCount}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-base font-bold text-foreground tabular-nums">{user.totalHours.toFixed(2)}h</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell className="font-bold text-foreground">Total</TableCell>
                    <TableCell className="text-center font-bold text-foreground tabular-nums">{totalShiftsSum}</TableCell>
                    <TableCell className="text-right text-base font-bold text-foreground tabular-nums">{totalHoursSum.toFixed(2)}h</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          </Card>
        )}

        {reportData.users.length > 0 && (
          <div className="flex flex-col gap-3">
            <h3 className="text-base font-semibold text-foreground">Detalhamento por usuário</h3>
            {reportData.users.map((user, i) => (
              <Card key={i} className="gap-3 px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-[0.9375rem] font-semibold text-foreground">{user.name}</h4>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                  <div className="text-right">
                    <span className="block text-xs text-muted-foreground">Total de horas</span>
                    <span className="block text-xl font-bold text-[var(--purple)]">{user.totalHours.toFixed(2)}h</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  {user.shifts.map((shift, si) => {
                    const startDate = new Date(shift.start_time);
                    const endDate = new Date(shift.end_time);
                    const userId = getUserIdByEmail(user.email);
                    const userColor = userId !== null ? getUserColor(userId) : '#f97316';
                    return (
                      <div
                        key={si}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-md border-l-4 bg-muted/50 px-3 py-2"
                        style={{ borderLeftColor: userColor }}
                      >
                        <div>
                          <div className="text-sm font-semibold text-foreground">{shift.title || 'Plantão'}</div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock size={13} />
                            {startDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}{' '}
                            {startDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} -{' '}
                            {endDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                        <span className="rounded px-2 py-0.5 text-sm font-semibold text-white" style={{ backgroundColor: userColor }}>
                          {shift.hours.toFixed(2)}h
                        </span>
                      </div>
                    );
                  })}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      {/* Controles */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={goToPrevious}>
            <ChevronLeft size={18} />
          </Button>
          <Button variant="outline" onClick={goToToday}>
            Hoje
          </Button>
          <Button variant="outline" size="icon" onClick={goToNext}>
            <ChevronRight size={18} />
          </Button>
          <h2 className="ml-2 text-lg font-semibold text-foreground capitalize">
            {tabMode === 'report' ? currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) : getPeriodName()}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={tabMode} onValueChange={(v) => setTabMode(v as TabMode)}>
            <TabsList>
              <TabsTrigger value="calendar">
                <Calendar size={15} /> Calendário
              </TabsTrigger>
              <TabsTrigger value="report">
                <FileBarChart size={15} /> Relatório
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {tabMode === 'calendar' ? (
            <>
              <Button variant={viewMode === 'month' ? 'default' : 'outline'} onClick={() => setViewMode('month')}>
                Mês
              </Button>
              <Button variant={viewMode === 'week' ? 'default' : 'outline'} onClick={() => setViewMode('week')}>
                Semana
              </Button>
              <Button variant={viewMode === 'day' ? 'default' : 'outline'} onClick={() => setViewMode('day')}>
                Dia
              </Button>
              {canCreate && (
                <Button onClick={() => openCreateModal()}>
                  <Plus size={18} /> Novo Plantão
                </Button>
              )}
            </>
          ) : (
            <>
              <Button variant="outline" onClick={generateShiftCalendarPDF} disabled={!reportData || reportData.users.length === 0}>
                <Calendar size={16} /> Calendário PDF
              </Button>
              <Button onClick={generatePDF} disabled={!reportData || reportData.users.length === 0}>
                <FileText size={16} /> Exportar PDF
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Conteúdo */}
      {tabMode === 'calendar' ? (
        loading ? (
          <SpinnerBlock text="Carregando calendário…" />
        ) : viewMode === 'day' ? (
          renderDayView()
        ) : (
          <Card className="overflow-hidden p-0">
            {viewMode === 'month' && renderMonthView()}
            {viewMode === 'week' && renderWeekView()}
          </Card>
        )
      ) : (
        renderReportView()
      )}

      {/* Modal de Plantão */}
      <Dialog open={showShiftModal} onOpenChange={setShowShiftModal}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedShift ? 'Editar Plantão' : 'Novo Plantão'}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div>
              <Label className="mb-1.5">Título (opcional)</Label>
              <Input value={shiftTitle} onChange={(e) => setShiftTitle(e.target.value)} placeholder="Ex: Plantão Manhã" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5">Data início *</Label>
                <Input type="date" value={shiftStartDate} onChange={(e) => setShiftStartDate(e.target.value)} />
              </div>
              <div>
                <Label className="mb-1.5">Hora início *</Label>
                <Input type="time" value={shiftStartTime} onChange={(e) => setShiftStartTime(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5">Data término *</Label>
                <Input type="date" value={shiftEndDate} onChange={(e) => setShiftEndDate(e.target.value)} />
              </div>
              <div>
                <Label className="mb-1.5">Hora término *</Label>
                <Input type="time" value={shiftEndTime} onChange={(e) => setShiftEndTime(e.target.value)} />
              </div>
            </div>

            <div>
              <Label className="mb-1.5">Usuários de plantão *</Label>
              <div className="flex max-h-[200px] flex-col gap-0.5 overflow-auto rounded-lg border border-input p-2">
                {allUsers.map((userItem) => (
                  <label key={userItem.id} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-muted">
                    <Checkbox
                      checked={selectedUserIds.includes(userItem.id)}
                      onCheckedChange={(checked) => {
                        if (checked) setSelectedUserIds([...selectedUserIds, userItem.id]);
                        else setSelectedUserIds(selectedUserIds.filter((id) => id !== userItem.id));
                      }}
                    />
                    <span className="text-foreground">
                      {userItem.name} <span className="text-muted-foreground">({userItem.email})</span>
                    </span>
                  </label>
                ))}
              </div>
              {selectedUserIds.length === 0 && <p className="mt-1.5 text-xs text-destructive">Selecione pelo menos um usuário</p>}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowShiftModal(false)}>
              Cancelar
            </Button>
            {selectedShift && canDelete && (
              <Button variant="destructive" onClick={() => deleteShift(selectedShift.id)}>
                <Trash2 size={16} /> Excluir
              </Button>
            )}
            <Button onClick={saveShift} disabled={!shiftStartDate || !shiftEndDate || selectedUserIds.length === 0}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
