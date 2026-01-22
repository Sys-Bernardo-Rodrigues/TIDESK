import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Calendar, 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  Users, 
  Edit, 
  Trash2,
  X,
  FileBarChart,
  FileText
} from 'lucide-react';
import { usePermissions, RESOURCES, ACTIONS } from '../hooks/usePermissions';
import jsPDF from 'jspdf';

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

export default function ShiftCalendar() {
  const { hasPermission } = usePermissions();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [tabMode, setTabMode] = useState<TabMode>('calendar');
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  
  const canCreate = hasPermission(RESOURCES.AGENDA, ACTIONS.CREATE);
  const canEdit = hasPermission(RESOURCES.AGENDA, ACTIONS.EDIT);
  const canDelete = hasPermission(RESOURCES.AGENDA, ACTIONS.DELETE);
  
  // Formulário de plantão
  const [shiftTitle, setShiftTitle] = useState('');
  const [shiftStartDate, setShiftStartDate] = useState('');
  const [shiftStartTime, setShiftStartTime] = useState('');
  const [shiftEndDate, setShiftEndDate] = useState('');
  const [shiftEndTime, setShiftEndTime] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);

  // Obter início e fim do período atual
  const getPeriodRange = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    if (viewMode === 'month') {
      const start = new Date(year, month, 1);
      const end = new Date(year, month + 1, 0, 23, 59, 59);
      return {
        start: start.toISOString().split('T')[0] + 'T00:00:00',
        end: end.toISOString().split('T')[0] + 'T23:59:59'
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
      return {
        start: start.toISOString(),
        end: end.toISOString()
      };
    } else {
      // Visualização diária - buscar plantões do dia atual
      const start = new Date(currentDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(currentDate);
      end.setHours(23, 59, 59, 59);
      return {
        start: start.toISOString(),
        end: end.toISOString()
      };
    }
  };

  // Buscar plantões
  const fetchData = async () => {
    try {
      setLoading(true);
      const { start, end } = getPeriodRange();
      
      const [shiftsRes, usersRes] = await Promise.all([
        axios.get(`/api/shifts?start=${start}&end=${end}`),
        axios.get('/api/users')
      ]);
      
      setShifts(shiftsRes.data);
      setAllUsers(usersRes.data);
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tabMode === 'calendar') {
      fetchData();
    } else {
      fetchReportData();
    }
  }, [currentDate, viewMode, tabMode]);

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

  // Gerar PDF do relatório
  const generatePDF = () => {
    if (!reportData) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - (margin * 2);
    let yPos = 15;

    // Cores do tema
    const primaryColor = [138, 43, 226]; // Roxo
    const secondaryColor = [59, 130, 246]; // Azul
    const successColor = [34, 197, 94]; // Verde
    const warningColor = [245, 158, 11]; // Amarelo
    const dangerColor = [239, 68, 68]; // Vermelho
    const textColor = [30, 30, 30];
    const textSecondary = [100, 100, 100];
    const borderColor = [220, 220, 230];
    const bgLight = [250, 250, 255];
    const shiftColor = [249, 115, 22]; // Laranja para plantões

    // Função para nova página
    const addPageIfNeeded = (space: number) => {
      if (yPos + space > pageHeight - 20) {
        doc.addPage();
        yPos = 15;
        drawHeader();
      }
    };

    // Função para desenhar cabeçalho
    const drawHeader = () => {
      // Barra superior
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(0, 0, pageWidth, 30, 'F');

      // Título
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('TIDESK', margin, 18);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('Relatório de Plantões', margin + 45, 18);

      // Data
      const now = new Date();
      const dateStr = now.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      doc.setFontSize(8);
      doc.text(`Gerado em: ${dateStr}`, pageWidth - margin, 18, { align: 'right' });

      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
      yPos = 40;
    };

    // Desenhar cabeçalho inicial
    drawHeader();

    // Período
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(textSecondary[0], textSecondary[1], textSecondary[2]);
    doc.text(`Período: ${reportData.monthName}`, margin, yPos);
    yPos += 8;

    // Linha divisória
    doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
    doc.setLineWidth(0.5);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 10;

    // Métricas principais
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
      const totalShifts = reportData.users.reduce((sum, user) => sum + user.shiftsCount, 0);
      const avgHours = reportData.users.length > 0 ? totalHours / reportData.users.length : 0;

      const metrics = [
        { label: 'Total Plantões', value: reportData.totalShifts.toString(), color: primaryColor },
        { label: 'Usuários', value: reportData.users.length.toString(), color: secondaryColor },
        { label: 'Total Horas', value: totalHours.toFixed(1) + 'h', color: successColor },
        { label: 'Média/Usuário', value: avgHours.toFixed(1) + 'h', color: warningColor }
      ];

      metrics.forEach((metric, index) => {
        const x = margin + (index * (boxWidth + 3));

        // Box
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
        doc.setLineWidth(0.5);
        doc.roundedRect(x, yPos, boxWidth, boxHeight, 2, 2, 'FD');

        // Barra superior colorida
        doc.setFillColor(metric.color[0], metric.color[1], metric.color[2]);
        doc.roundedRect(x, yPos, boxWidth, 3, 2, 2, 'F');

        // Label
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(textSecondary[0], textSecondary[1], textSecondary[2]);
        doc.text(metric.label, x + 4, yPos + 10);

        // Valor
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(textColor[0], textColor[1], textColor[2]);
        doc.text(metric.value, x + 4, yPos + 22);
      });

      yPos += boxHeight + 15;
    }

    // Tabela de Usuários e Horas
    if (reportData.users.length > 0) {
      addPageIfNeeded(40);

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
      doc.text('Resumo por Usuário', margin, yPos);
      yPos += 10;

      // Cabeçalho da tabela
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.roundedRect(margin, yPos, contentWidth, 8, 1, 1, 'F');
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text('Usuário', margin + 4, yPos + 5.5);
      doc.text('Plantões', margin + contentWidth - 50, yPos + 5.5, { align: 'right' });
      doc.text('Total Horas', margin + contentWidth - 4, yPos + 5.5, { align: 'right' });
      yPos += 10;

      // Linhas da tabela
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      const totalShifts = reportData.users.reduce((sum, user) => sum + user.shiftsCount, 0);
      const totalHours = reportData.users.reduce((sum, user) => sum + user.totalHours, 0);

      reportData.users.forEach((user, index) => {
        addPageIfNeeded(10);

        // Linha alternada
        if (index % 2 === 0) {
          doc.setFillColor(bgLight[0], bgLight[1], bgLight[2]);
          doc.rect(margin, yPos - 1, contentWidth, 8, 'F');
        }

        // Indicador colorido
        doc.setFillColor(shiftColor[0], shiftColor[1], shiftColor[2]);
        doc.circle(margin + 4, yPos + 3, 2, 'F');

        doc.setTextColor(textColor[0], textColor[1], textColor[2]);
        doc.text(user.name, margin + 9, yPos + 5);
        doc.setFont('helvetica', 'bold');
        doc.text(user.shiftsCount.toString(), margin + contentWidth - 50, yPos + 5, { align: 'right' });
        doc.text(`${user.totalHours.toFixed(2)}h`, margin + contentWidth - 4, yPos + 5, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        yPos += 9;
      });

      // Rodapé da tabela
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

    // Detalhamento por Usuário
    if (reportData.users.length > 0) {
      reportData.users.forEach((user) => {
        addPageIfNeeded(50);

        // Título da seção
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(textColor[0], textColor[1], textColor[2]);
        doc.text(user.name, margin, yPos);

        yPos += 7;
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(textSecondary[0], textSecondary[1], textSecondary[2]);
        doc.text(user.email, margin, yPos);

        yPos += 6;
        doc.setFontSize(9);
        doc.setTextColor(textColor[0], textColor[1], textColor[2]);
        doc.text(
          `Total: ${user.totalHours.toFixed(2)}h em ${user.shiftsCount} plantão${user.shiftsCount !== 1 ? 'ões' : ''}`,
          margin,
          yPos
        );

        yPos += 8;
        doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
        doc.setLineWidth(0.3);
        doc.line(margin, yPos, pageWidth - margin, yPos);
        yPos += 6;

        // Lista de plantões
        user.shifts.forEach((shift) => {
          addPageIfNeeded(25);

          const startDate = new Date(shift.start_time);
          const endDate = new Date(shift.end_time);

          // Box do plantão
          doc.setFillColor(255, 255, 255);
          doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
          doc.setLineWidth(0.3);
          doc.roundedRect(margin, yPos - 3, contentWidth, 20, 2, 2, 'FD');

          // Barra lateral colorida
          doc.setFillColor(shiftColor[0], shiftColor[1], shiftColor[2]);
          doc.rect(margin, yPos - 3, 3, 20, 'F');

          // Título do plantão
          doc.setFontSize(9);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(textColor[0], textColor[1], textColor[2]);
          const title = shift.title || 'Plantão';
          doc.text(title, margin + 6, yPos + 3);

          // Datas
          doc.setFontSize(7);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(textSecondary[0], textSecondary[1], textSecondary[2]);
          doc.text(
            `Início: ${startDate.toLocaleDateString('pt-BR')} ${startDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
            margin + 6,
            yPos + 8
          );
          doc.text(
            `Término: ${endDate.toLocaleDateString('pt-BR')} ${endDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
            margin + 6,
            yPos + 12
          );

          // Duração
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(shiftColor[0], shiftColor[1], shiftColor[2]);
          doc.text(
            `Duração: ${shift.hours.toFixed(2)}h`,
            margin + contentWidth - 4,
            yPos + 10,
            { align: 'right' }
          );

          yPos += 22;
        });

        yPos += 5;
      });
    }

    // Salvar PDF
    const fileName = `relatorio-plantoes-${reportData.year}-${String(reportData.month).padStart(2, '0')}.pdf`;
    doc.save(fileName);
  };

  // Navegação do calendário
  const goToPrevious = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() - 7);
    } else {
      newDate.setDate(newDate.getDate() - 1);
    }
    setCurrentDate(newDate);
  };

  const goToNext = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() + 1);
    } else if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() + 7);
    } else {
      newDate.setDate(newDate.getDate() + 1);
    }
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

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
        alert('Selecione pelo menos um usuário para o plantão');
        return;
      }

      const startDateTime = `${shiftStartDate}T${shiftStartTime}:00`;
      const endDateTime = `${shiftEndDate}T${shiftEndTime}:00`;
      
      const shiftData = {
        title: shiftTitle || null,
        start_time: startDateTime,
        end_time: endDateTime,
        user_ids: selectedUserIds
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
      alert(error.response?.data?.error || 'Erro ao salvar plantão');
    }
  };

  // Deletar plantão
  const deleteShift = async (shiftId: number) => {
    if (!confirm('Tem certeza que deseja excluir este plantão?')) return;
    
    try {
      await axios.delete(`/api/shifts/${shiftId}`);
      fetchData();
    } catch (error) {
      console.error('Erro ao deletar plantão:', error);
      alert('Erro ao deletar plantão');
    }
  };

  // Obter plantões para um dia específico
  const getShiftsForDay = (date: Date) => {
    // Normalizar a data para início do dia (00:00:00)
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    // Fim do dia (23:59:59)
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    return shifts.filter(shift => {
      if (!shift.start_time) return false;
      
      const shiftStart = new Date(shift.start_time);
      const shiftEnd = shift.end_time ? new Date(shift.end_time) : shiftStart;
      
      // Incluir plantões que:
      // 1. Começam no dia (entre início e fim do dia)
      // 2. Terminam no dia (entre início e fim do dia)
      // 3. Passam pelo dia (começam antes e terminam depois)
      return (shiftStart >= startOfDay && shiftStart <= endOfDay) ||
             (shiftEnd >= startOfDay && shiftEnd <= endOfDay) ||
             (shiftStart <= startOfDay && shiftEnd >= endOfDay);
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
    
    const days = [];
    const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    
    // Dias do mês anterior (para preencher primeira semana)
    const prevMonth = new Date(year, month - 1, 0);
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonth.getDate() - i),
        isCurrentMonth: false
      });
    }
    
    // Dias do mês atual
    for (let day = 1; day <= daysInMonth; day++) {
      days.push({
        date: new Date(year, month, day),
        isCurrentMonth: true
      });
    }
    
    // Dias do próximo mês (para completar última semana)
    const remainingDays = 42 - days.length;
    for (let day = 1; day <= remainingDays; day++) {
      days.push({
        date: new Date(year, month + 1, day),
        isCurrentMonth: false
      });
    }
    
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px', backgroundColor: 'var(--border-primary)' }}>
        {weekDays.map(day => (
          <div key={day} style={{
            padding: 'var(--spacing-sm)',
            backgroundColor: 'var(--bg-secondary)',
            fontWeight: '600',
            fontSize: '0.875rem',
            textAlign: 'center',
            color: 'var(--text-secondary)'
          }}>
            {day}
          </div>
        ))}
        {days.map((day, index) => {
          const dayShifts = getShiftsForDay(day.date);
          const isToday = day.date.toDateString() === new Date().toDateString();
          
          return (
            <div
              key={index}
              onClick={() => canCreate && openCreateModal(day.date)}
              style={{
                cursor: canCreate ? 'pointer' : 'default',
                minHeight: '120px',
                padding: 'var(--spacing-xs)',
                backgroundColor: 'var(--bg-primary)',
                border: isToday ? '2px solid var(--purple)' : 'none',
                position: 'relative',
                opacity: day.isCurrentMonth ? 1 : 0.4
              }}
            >
              <div style={{
                fontWeight: isToday ? '700' : '500',
                fontSize: '0.875rem',
                marginBottom: 'var(--spacing-xs)',
                color: isToday ? 'var(--purple)' : 'var(--text-primary)'
              }}>
                {day.date.getDate()}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {dayShifts.slice(0, 3).map(shift => (
                  <div
                    key={shift.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (canEdit) {
                        openEditModal(shift);
                      }
                    }}
                    style={{
                      fontSize: '0.75rem',
                      padding: '2px 4px',
                      borderRadius: '2px',
                      backgroundColor: '#f97316',
                      color: 'white',
                      cursor: 'pointer',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                    title={shift.title || `Plantão - ${shift.user_names.join(', ')}`}
                  >
                    {shift.title || `Plantão: ${shift.user_names.slice(0, 2).join(', ')}${shift.user_names.length > 2 ? '...' : ''}`}
                  </div>
                ))}
                {dayShifts.length > 3 && (
                  <div style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-secondary)',
                    padding: '2px 4px'
                  }}>
                    +{dayShifts.length - 3} mais
                  </div>
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
    
    const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const days = [];
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      days.push(date);
    }
    
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px', backgroundColor: 'var(--border-primary)', minHeight: '600px' }}>
        {days.map((date, index) => {
          const dayShifts = getShiftsForDay(date);
          const isToday = date.toDateString() === new Date().toDateString();
          const dayName = weekDays[index];
          const dayNumber = date.getDate();
          const isWeekend = index === 0 || index === 6;
          
          return (
            <div
              key={index}
              style={{
                backgroundColor: 'var(--bg-primary)',
                padding: 'var(--spacing-sm)',
                border: isToday ? '2px solid var(--purple)' : 'none',
                minHeight: '100%'
              }}
            >
              <div
                onClick={() => canCreate && openCreateModal(date)}
                style={{
                  cursor: canCreate ? 'pointer' : 'default',
                  padding: 'var(--spacing-xs)',
                  marginBottom: 'var(--spacing-sm)',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: isToday ? 'var(--purple-light)' : 'transparent'
                }}
              >
                <div style={{
                  fontSize: '0.75rem',
                  color: isWeekend ? 'var(--text-secondary)' : 'var(--text-primary)',
                  fontWeight: '500',
                  marginBottom: '2px'
                }}>
                  {dayName}
                </div>
                <div style={{
                  fontSize: '1.25rem',
                  fontWeight: isToday ? '700' : '600',
                  color: isToday ? 'var(--purple)' : 'var(--text-primary)'
                }}>
                  {dayNumber}
                </div>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {dayShifts.map(shift => (
                  <div
                    key={shift.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (canEdit) {
                        openEditModal(shift);
                      }
                    }}
                    style={{
                      fontSize: '0.75rem',
                      padding: '6px 8px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: '#f97316',
                      color: 'white',
                      cursor: 'pointer',
                      transition: 'all var(--transition-base)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.opacity = '0.9';
                      e.currentTarget.style.transform = 'scale(1.02)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = '1';
                      e.currentTarget.style.transform = 'scale(1)';
                    }}
                    title={shift.title || `Plantão - ${shift.user_names.join(', ')}`}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                      <span style={{ fontWeight: '600' }}>{shift.title || 'Plantão'}</span>
                    </div>
                    {shift.start_time && (
                      <div style={{ fontSize: '0.7rem', opacity: 0.9 }}>
                        {new Date(shift.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} - {new Date(shift.end_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                    {shift.user_names && shift.user_names.length > 0 && (
                      <div style={{ fontSize: '0.7rem', opacity: 0.9, marginTop: '2px' }}>
                        {shift.user_names.slice(0, 2).join(', ')}{shift.user_names.length > 2 ? ` +${shift.user_names.length - 2}` : ''}
                      </div>
                    )}
                  </div>
                ))}
                {dayShifts.length === 0 && canCreate && (
                  <div
                    onClick={() => openCreateModal(date)}
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-tertiary)',
                      padding: 'var(--spacing-xs)',
                      textAlign: 'center',
                      cursor: 'pointer',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px dashed var(--border-primary)'
                    }}
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
    
    // Ordenar plantões por hora
    const sortedShifts = [...dayShifts].sort((a, b) => {
      const timeA = new Date(a.start_time).getTime();
      const timeB = new Date(b.start_time).getTime();
      return timeA - timeB;
    });
    
    return (
      <div style={{ padding: 'var(--spacing-lg)' }}>
        <div style={{
          marginBottom: 'var(--spacing-lg)',
          padding: 'var(--spacing-md)',
          backgroundColor: isToday ? 'var(--purple-light)' : 'var(--bg-secondary)',
          borderRadius: 'var(--radius-md)',
          border: isToday ? '2px solid var(--purple)' : '1px solid var(--border-primary)'
        }}>
          <div style={{
            fontSize: '1.5rem',
            fontWeight: '700',
            color: 'var(--text-primary)',
            marginBottom: 'var(--spacing-xs)'
          }}>
            {currentDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
          <div style={{
            fontSize: '0.875rem',
            color: 'var(--text-secondary)'
          }}>
            {sortedShifts.length} {sortedShifts.length === 1 ? 'plantão' : 'plantões'} agendado{sortedShifts.length !== 1 ? 's' : ''}
          </div>
        </div>
        
        {sortedShifts.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: 'var(--spacing-2xl)',
            color: 'var(--text-secondary)'
          }}>
            <Calendar size={48} style={{ marginBottom: 'var(--spacing-md)', opacity: 0.5 }} />
            <p style={{ marginBottom: 'var(--spacing-md)' }}>
              Nenhum plantão agendado para este dia
            </p>
            {canCreate && (
              <button
                onClick={() => openCreateModal(currentDate)}
                className="btn btn-primary"
              >
                <Plus size={18} />
                Criar Plantão
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
            {sortedShifts.map(shift => {
              const startTime = new Date(shift.start_time);
              const endTime = new Date(shift.end_time);
              
              return (
                <div
                  key={shift.id}
                  onClick={() => canEdit && openEditModal(shift)}
                  className="card"
                  style={{
                    padding: 'var(--spacing-md)',
                    cursor: canEdit ? 'pointer' : 'default',
                    borderLeft: '4px solid #f97316',
                    transition: 'all var(--transition-base)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateX(4px)';
                    e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateX(0)';
                    e.currentTarget.style.boxShadow = 'var(--shadow)';
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--spacing-md)' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-xs)' }}>
                        <h3 style={{
                          fontSize: '1.125rem',
                          fontWeight: '600',
                          color: 'var(--text-primary)',
                          margin: 0
                        }}>
                          {shift.title || 'Plantão'}
                        </h3>
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', flexWrap: 'wrap', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
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
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Users size={14} />
                            {shift.user_names.join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {(canEdit || canDelete) && (
                      <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
                        {canEdit && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditModal(shift);
                            }}
                            className="btn btn-secondary btn-sm"
                          >
                            <Edit size={16} />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteShift(shift.id);
                            }}
                            className="btn btn-danger btn-sm"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // Renderizar visualização de relatório
  const renderReportView = () => {
    if (reportLoading) {
      return (
        <div style={{ textAlign: 'center', padding: 'var(--spacing-2xl)' }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: '4px solid var(--border-primary)',
            borderTopColor: 'var(--purple)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto'
          }} />
          <p style={{ marginTop: 'var(--spacing-md)', color: 'var(--text-secondary)' }}>
            Carregando relatório...
          </p>
        </div>
      );
    }

    if (!reportData) {
      return (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--spacing-2xl)' }}>
          <FileBarChart size={48} style={{ marginBottom: 'var(--spacing-md)', opacity: 0.5 }} />
          <p style={{ color: 'var(--text-secondary)' }}>
            Nenhum dado disponível para o período selecionado
          </p>
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
        {/* Cabeçalho do Relatório */}
        <div className="card" style={{ padding: 'var(--spacing-lg)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--spacing-md)' }}>
            <div>
              <h2 style={{ margin: 0, marginBottom: 'var(--spacing-xs)', fontSize: '1.5rem', fontWeight: '700' }}>
                Relatório de Plantões - {reportData.monthName}
              </h2>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                Total de {reportData.totalShifts} plantão{reportData.totalShifts !== 1 ? 'ões' : ''} registrado{reportData.totalShifts !== 1 ? 's' : ''}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center' }}>
              <button
                onClick={generatePDF}
                className="btn btn-primary"
                style={{ 
                  padding: 'var(--spacing-xs) var(--spacing-md)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-xs)'
                }}
                disabled={!reportData || reportData.users.length === 0}
              >
                <FileText size={18} />
                Exportar PDF
              </button>
              <button
                onClick={goToPrevious}
                className="btn btn-secondary"
                style={{ padding: 'var(--spacing-xs) var(--spacing-sm)' }}
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={goToToday}
                className="btn btn-secondary"
                style={{ padding: 'var(--spacing-xs) var(--spacing-md)' }}
              >
                Hoje
              </button>
              <button
                onClick={goToNext}
                className="btn btn-secondary"
                style={{ padding: 'var(--spacing-xs) var(--spacing-sm)' }}
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* Tabela de Usuários e Horas */}
        {reportData.users.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 'var(--spacing-2xl)' }}>
            <Users size={48} style={{ marginBottom: 'var(--spacing-md)', opacity: 0.5 }} />
            <p style={{ color: 'var(--text-secondary)' }}>
              Nenhum usuário com plantões registrados neste mês
            </p>
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '2px solid var(--border-primary)' }}>
                    <th style={{ 
                      padding: 'var(--spacing-md)', 
                      textAlign: 'left', 
                      fontWeight: '600',
                      fontSize: '0.875rem',
                      color: 'var(--text-primary)'
                    }}>
                      Usuário
                    </th>
                    <th style={{ 
                      padding: 'var(--spacing-md)', 
                      textAlign: 'center', 
                      fontWeight: '600',
                      fontSize: '0.875rem',
                      color: 'var(--text-primary)'
                    }}>
                      Plantões
                    </th>
                    <th style={{ 
                      padding: 'var(--spacing-md)', 
                      textAlign: 'right', 
                      fontWeight: '600',
                      fontSize: '0.875rem',
                      color: 'var(--text-primary)'
                    }}>
                      Total de Horas
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.users.map((user, index) => (
                    <tr 
                      key={index}
                      style={{ 
                        borderBottom: '1px solid var(--border-primary)',
                        transition: 'background-color var(--transition-base)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <td style={{ padding: 'var(--spacing-md)' }}>
                        <div>
                          <div style={{ fontWeight: '600', color: 'var(--text-primary)', marginBottom: '2px' }}>
                            {user.name}
                          </div>
                          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                            {user.email}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: 'var(--spacing-md)', textAlign: 'center' }}>
                        <span style={{ 
                          display: 'inline-block',
                          padding: '4px 12px',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: 'var(--purple-light)',
                          color: 'var(--purple)',
                          fontWeight: '600',
                          fontSize: '0.875rem'
                        }}>
                          {user.shiftsCount}
                        </span>
                      </td>
                      <td style={{ padding: 'var(--spacing-md)', textAlign: 'right' }}>
                        <div style={{ 
                          fontWeight: '700', 
                          fontSize: '1.125rem',
                          color: 'var(--text-primary)'
                        }}>
                          {user.totalHours.toFixed(2)}h
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ backgroundColor: 'var(--bg-secondary)', borderTop: '2px solid var(--border-primary)' }}>
                    <td style={{ padding: 'var(--spacing-md)', fontWeight: '700', color: 'var(--text-primary)' }}>
                      Total
                    </td>
                    <td style={{ padding: 'var(--spacing-md)', textAlign: 'center', fontWeight: '700', color: 'var(--text-primary)' }}>
                      {reportData.users.reduce((sum, user) => sum + user.shiftsCount, 0)}
                    </td>
                    <td style={{ padding: 'var(--spacing-md)', textAlign: 'right', fontWeight: '700', fontSize: '1.125rem', color: 'var(--text-primary)' }}>
                      {reportData.users.reduce((sum, user) => sum + user.totalHours, 0).toFixed(2)}h
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Detalhamento por Usuário */}
        {reportData.users.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>
              Detalhamento por Usuário
            </h3>
            {reportData.users.map((user, index) => (
              <div key={index} className="card" style={{ padding: 'var(--spacing-lg)' }}>
                <div style={{ marginBottom: 'var(--spacing-md)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-xs)' }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                        {user.name}
                      </h4>
                      <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        {user.email}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                        Total de Horas
                      </div>
                      <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--purple)' }}>
                        {user.totalHours.toFixed(2)}h
                      </div>
                    </div>
                  </div>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                  {user.shifts.map((shift, shiftIndex) => {
                    const startDate = new Date(shift.start_time);
                    const endDate = new Date(shift.end_time);
                    
                    return (
                      <div 
                        key={shiftIndex}
                        style={{
                          padding: 'var(--spacing-sm)',
                          backgroundColor: 'var(--bg-secondary)',
                          borderRadius: 'var(--radius-sm)',
                          borderLeft: '4px solid #f97316'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--spacing-sm)' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: '600', color: 'var(--text-primary)', marginBottom: '4px' }}>
                              {shift.title || 'Plantão'}
                            </div>
                            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', display: 'flex', gap: 'var(--spacing-md)', flexWrap: 'wrap' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Clock size={14} />
                                {startDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} 
                                {' '}
                                {startDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                {' - '}
                                {endDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>
                          <div style={{ 
                            padding: '4px 12px',
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: '#f97316',
                            color: 'white',
                            fontWeight: '600',
                            fontSize: '0.875rem'
                          }}>
                            {shift.hours.toFixed(2)}h
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ padding: 'var(--spacing-lg)' }}>
      {/* Controles */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: 'var(--spacing-lg)',
        flexWrap: 'wrap',
        gap: 'var(--spacing-md)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
          <button
            onClick={goToPrevious}
            className="btn btn-secondary"
            style={{ padding: 'var(--spacing-xs) var(--spacing-sm)' }}
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={goToToday}
            className="btn btn-secondary"
            style={{ padding: 'var(--spacing-xs) var(--spacing-md)' }}
          >
            Hoje
          </button>
          <button
            onClick={goToNext}
            className="btn btn-secondary"
            style={{ padding: 'var(--spacing-xs) var(--spacing-sm)' }}
          >
            <ChevronRight size={20} />
          </button>
          <h2 style={{
            margin: 0,
            marginLeft: 'var(--spacing-md)',
            fontSize: '1.25rem',
            fontWeight: '600',
            color: 'var(--text-primary)',
            textTransform: 'capitalize'
          }}>
            {tabMode === 'report' 
              ? currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
              : getPeriodName()}
          </h2>
        </div>
        
        <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 'var(--spacing-xs)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-md)', padding: '2px' }}>
            <button
              onClick={() => setTabMode('calendar')}
              className={tabMode === 'calendar' ? 'btn btn-primary' : 'btn btn-secondary'}
              style={{ 
                padding: 'var(--spacing-xs) var(--spacing-md)',
                border: 'none',
                borderRadius: 'var(--radius-sm)'
              }}
            >
              <Calendar size={18} style={{ marginRight: 'var(--spacing-xs)' }} />
              Calendário
            </button>
            <button
              onClick={() => setTabMode('report')}
              className={tabMode === 'report' ? 'btn btn-primary' : 'btn btn-secondary'}
              style={{ 
                padding: 'var(--spacing-xs) var(--spacing-md)',
                border: 'none',
                borderRadius: 'var(--radius-sm)'
              }}
            >
              <FileBarChart size={18} style={{ marginRight: 'var(--spacing-xs)' }} />
              Relatório
            </button>
          </div>
          
          {tabMode === 'calendar' && (
            <>
              <button
                onClick={() => setViewMode('month')}
                className={viewMode === 'month' ? 'btn btn-primary' : 'btn btn-secondary'}
                style={{ padding: 'var(--spacing-xs) var(--spacing-md)' }}
              >
                Mês
              </button>
              <button
                onClick={() => setViewMode('week')}
                className={viewMode === 'week' ? 'btn btn-primary' : 'btn btn-secondary'}
                style={{ padding: 'var(--spacing-xs) var(--spacing-md)' }}
              >
                Semana
              </button>
              <button
                onClick={() => setViewMode('day')}
                className={viewMode === 'day' ? 'btn btn-primary' : 'btn btn-secondary'}
                style={{ padding: 'var(--spacing-xs) var(--spacing-md)' }}
              >
                Dia
              </button>
              {canCreate && (
                <button
                  onClick={() => openCreateModal()}
                  className="btn btn-primary"
                  style={{ padding: 'var(--spacing-xs) var(--spacing-md)' }}
                >
                  <Plus size={18} />
                  Novo Plantão
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Conteúdo */}
      {tabMode === 'calendar' ? (
        <>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 'var(--spacing-2xl)' }}>
              <div style={{
                width: '48px',
                height: '48px',
                border: '4px solid var(--border-primary)',
                borderTopColor: 'var(--purple)',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto'
              }} />
              <p style={{ marginTop: 'var(--spacing-md)', color: 'var(--text-secondary)' }}>
                Carregando calendário...
              </p>
            </div>
          ) : (
            <>
              {viewMode === 'day' ? (
                renderDayView()
              ) : (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  {viewMode === 'month' && renderMonthView()}
                  {viewMode === 'week' && renderWeekView()}
                </div>
              )}
            </>
          )}
        </>
      ) : (
        renderReportView()
      )}

      {/* Modal de Plantão */}
      {showShiftModal && (
        <div style={{ 
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="card" style={{
            width: '90%',
            maxWidth: '600px',
            maxHeight: '90vh',
            overflow: 'auto',
            position: 'relative'
          }}>
            <button
              onClick={() => setShowShiftModal(false)}
              style={{ 
                position: 'absolute', 
                top: 'var(--spacing-md)',
                right: 'var(--spacing-md)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 'var(--spacing-xs)',
                color: 'var(--text-secondary)'
              }}
            >
              <X size={24} />
            </button>
            
            <h2 style={{ marginBottom: 'var(--spacing-lg)' }}>
              {selectedShift ? 'Editar Plantão' : 'Novo Plantão'}
            </h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
              <div>
                <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontWeight: '500' }}>
                  Título (opcional)
                </label>
                <input
                  type="text"
                  className="input"
                  value={shiftTitle}
                  onChange={(e) => setShiftTitle(e.target.value)}
                  placeholder="Ex: Plantão Manhã"
                />
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontWeight: '500' }}>
                    Data Início *
                  </label>
                  <input
                    type="date"
                    className="input"
                    value={shiftStartDate}
                    onChange={(e) => setShiftStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontWeight: '500' }}>
                    Hora Início *
                  </label>
                  <input
                    type="time"
                    className="input"
                    value={shiftStartTime}
                    onChange={(e) => setShiftStartTime(e.target.value)}
                  />
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontWeight: '500' }}>
                    Data Término *
                  </label>
                  <input
                    type="date"
                    className="input"
                    value={shiftEndDate}
                    onChange={(e) => setShiftEndDate(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontWeight: '500' }}>
                    Hora Término *
                  </label>
                  <input
                    type="time"
                    className="input"
                    value={shiftEndTime}
                    onChange={(e) => setShiftEndTime(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontWeight: '500' }}>
                  Usuários de Plantão *
                </label>
                <div style={{
                  border: '1px solid var(--border-primary)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--spacing-sm)',
                  maxHeight: '200px',
                  overflow: 'auto'
                }}>
                  {allUsers.map(userItem => (
                    <label
                      key={userItem.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--spacing-sm)',
                        padding: 'var(--spacing-xs)',
                        cursor: 'pointer'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedUserIds.includes(userItem.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedUserIds([...selectedUserIds, userItem.id]);
                          } else {
                            setSelectedUserIds(selectedUserIds.filter(id => id !== userItem.id));
                          }
                        }}
                      />
                      <span>{userItem.name} ({userItem.email})</span>
                    </label>
                  ))}
                </div>
                {selectedUserIds.length === 0 && (
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-danger)', marginTop: 'var(--spacing-xs)' }}>
                    Selecione pelo menos um usuário
                  </p>
                )}
              </div>
              
              <div style={{ display: 'flex', gap: 'var(--spacing-sm)', justifyContent: 'flex-end', marginTop: 'var(--spacing-md)' }}>
                <button
                  onClick={() => setShowShiftModal(false)}
                  className="btn btn-secondary"
                >
                  Cancelar
                </button>
                {selectedShift && canDelete && (
                  <button
                    onClick={() => deleteShift(selectedShift.id)}
                    className="btn btn-danger"
                  >
                    <Trash2 size={18} />
                    Excluir
                  </button>
                )}
                <button
                  onClick={saveShift}
                  className="btn btn-primary"
                  disabled={!shiftStartDate || !shiftEndDate || selectedUserIds.length === 0}
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
