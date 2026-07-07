import { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Plus,
  MoreHorizontal,
  Trash2,
  User,
  Edit2,
  Settings,
  Calendar,
  Target,
  ListTodo,
  CheckSquare,
  Square,
  ClipboardCheck,
  MessageSquare,
  Clock,
  LayoutGrid,
  List,
  GripVertical,
  Paperclip,
  Link2,
} from 'lucide-react';
import React from 'react';
import { usePermissions, RESOURCES, ACTIONS } from '../hooks/usePermissions';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useConfirm } from '@/components/ui/confirm-dialog';

const parseProjectDate = (dateStr: string) => {
  if (!dateStr) return new Date(NaN);
  // Datas de projeto vêm geralmente como 'YYYY-MM-DD' (sem timezone) ou ISO completo
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    // Forçar interpretação como horário local para evitar voltar 1 dia no fuso
    return new Date(`${dateStr}T00:00:00`);
  }
  return new Date(dateStr);
};

function processMentions(str: string): React.ReactNode {
  const parts = str.split(/(@[\wáéíóúãõâêôç]+)/gi);
  return parts.map((part, i) =>
    part.startsWith('@') ? (
      <span key={i} className="font-semibold text-[var(--purple)]">
        {part}
      </span>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    )
  );
}

function CommentBody({ message }: { message: string }) {
  const processChildren = (children: React.ReactNode): React.ReactNode => {
    if (typeof children === 'string') return processMentions(children);
    if (Array.isArray(children)) return children.map((c, i) => <React.Fragment key={i}>{processChildren(c)}</React.Fragment>);
    return children;
  };
  return (
    <ReactMarkdown
      components={{
        p: ({ children }) => <p style={{ margin: 0 }}>{processChildren(children)}</p>,
        li: ({ children }) => <li>{processChildren(children)}</li>,
      }}
    >
      {message}
    </ReactMarkdown>
  );
}

interface ProjectColumn {
  id: number;
  project_id: number;
  name: string;
  order_index: number;
}

interface ProjectSprint {
  id: number;
  project_id: number;
  name: string;
  start_date: string | null;
  end_date: string | null;
  order_index: number;
}

interface ProjectTask {
  id: number;
  project_id: number;
  column_id: number;
  title: string;
  description: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  order_index: number;
  assigned_to: number | null;
  assigned_to_name: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
  sprint_id?: number | null;
  sprint_name?: string | null;
  story_points?: number | null;
  due_date?: string | null;
  completed_at?: string | null;
  started_at?: string | null;
  task_type?: 'feature' | 'bug' | 'tech_debt' | 'chore';
}

interface Project {
  id: number;
  name: string;
  description: string | null;
  created_by: number;
  created_by_name: string | null;
  columns: ProjectColumn[];
  sprints?: ProjectSprint[];
  tasks: ProjectTask[];
}

interface UserOption {
  id: number;
  name: string;
  email: string;
}

interface Subtask {
  id: number;
  task_id: number;
  title: string;
  completed: number;
  order_index: number;
}

interface DodItem {
  id: number;
  task_id: number;
  label: string;
  checked: number;
  order_index: number;
}

interface TaskComment {
  id: number;
  task_id: number;
  user_id: number;
  message: string;
  created_at: string;
  user_name: string;
}

interface TimeEntry {
  id: number;
  task_id: number;
  user_id: number;
  hours: number;
  entry_date: string;
  note: string | null;
  created_at: string;
  user_name: string;
}

interface TaskAttachment {
  id: number;
  task_id: number;
  user_id: number;
  file_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
  user_name: string;
}

const PRIORITY_LABEL: Record<string, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  urgent: 'Urgente',
};
const PRIORITY_COLOR: Record<string, string> = {
  low: 'var(--text-tertiary)',
  medium: 'var(--blue)',
  high: 'var(--orange)',
  urgent: 'var(--red)',
};

const TASK_TYPE_LABEL: Record<string, string> = {
  feature: 'Funcionalidade',
  bug: 'Bug',
  tech_debt: 'Dívida técnica',
  chore: 'Tarefa',
};
const TASK_TYPE_COLOR: Record<string, string> = {
  feature: 'var(--blue)',
  bug: 'var(--red)',
  tech_debt: 'var(--orange)',
  chore: 'var(--text-tertiary)',
};

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-0.5 text-[0.6875rem] font-semibold tracking-wide text-muted-foreground uppercase">{children}</div>;
}

function MetricCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="min-w-[260px] flex-1 gap-2 px-4 py-4">
      <div className="text-sm font-semibold text-foreground">{title}</div>
      {children}
    </Card>
  );
}

export default function ProjetoDetail() {
  const { id } = useParams<{ id: string }>();
  const { hasPermission } = usePermissions();
  const confirm = useConfirm();
  const [project, setProject] = useState<Project | null>(null);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [taskModalColumnId, setTaskModalColumnId] = useState<number | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    priority: 'medium' as ProjectTask['priority'],
    task_type: 'feature' as ProjectTask['task_type'],
    column_id: 0,
    assigned_to: null as number | null,
    sprint_id: null as number | null,
    story_points: null as number | null,
    due_date: null as string | null,
  });
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [sprintsModalOpen, setSprintsModalOpen] = useState(false);
  const [sprintForm, setSprintForm] = useState({ name: '', start_date: '', end_date: '' });
  const [editingSprintId, setEditingSprintId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [editColumnId, setEditColumnId] = useState<number | null>(null);
  const [editColumnName, setEditColumnName] = useState('');
  const [addColumnModal, setAddColumnModal] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [dragTaskId, setDragTaskId] = useState<number | null>(null);
  const [dragOverColumnId, setDragOverColumnId] = useState<number | null>(null);
  const [filterSprintId, setFilterSprintId] = useState<number | null>(null);
  const [filterTaskType, setFilterTaskType] = useState<ProjectTask['task_type'] | ''>('');
  const [subtasksByTaskId, setSubtasksByTaskId] = useState<Record<number, Subtask[]>>({});
  const [dodByTaskId, setDodByTaskId] = useState<Record<number, DodItem[]>>({});
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [newDodLabel, setNewDodLabel] = useState('');
  const [commentsByTaskId, setCommentsByTaskId] = useState<Record<number, TaskComment[]>>({});
  const [timeEntriesByTaskId, setTimeEntriesByTaskId] = useState<Record<number, TimeEntry[]>>({});
  const [newCommentMessage, setNewCommentMessage] = useState('');
  const [timeEntryForm, setTimeEntryForm] = useState({ hours: '', entry_date: new Date().toISOString().slice(0, 10), note: '' });
  const [attachmentsByTaskId, setAttachmentsByTaskId] = useState<Record<number, TaskAttachment[]>>({});
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [dependenciesByTaskId, setDependenciesByTaskId] = useState<Record<number, { depends_on: number[]; blocked_by: number[] }>>({});
  const [viewMode, setViewMode] = useState<'board' | 'backlog'>('board');
  const [backlogDragTaskId, setBacklogDragTaskId] = useState<number | null>(null);

  const canCreate = hasPermission(RESOURCES.PROJECTS, ACTIONS.CREATE);
  const canEdit = hasPermission(RESOURCES.PROJECTS, ACTIONS.EDIT);
  const canDelete = hasPermission(RESOURCES.PROJECTS, ACTIONS.DELETE);

  const fetchProject = async () => {
    if (!id) return;
    try {
      const res = await axios.get<Project>(`/api/projects/${id}`);
      setProject(res.data);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao carregar projeto');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProject();
  }, [id]);

  useEffect(() => {
    axios.get<UserOption[]>('/api/users').then((res) => setUsers(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!id || !selectedTaskId) {
      return;
    }
    setNewSubtaskTitle('');
    setNewDodLabel('');
    setNewCommentMessage('');
    Promise.all([
      axios.get<Subtask[]>(`/api/projects/${id}/tasks/${selectedTaskId}/subtasks`),
      axios.get<DodItem[]>(`/api/projects/${id}/tasks/${selectedTaskId}/dod`),
      axios.get<TaskComment[]>(`/api/projects/${id}/tasks/${selectedTaskId}/comments`),
      axios.get<TimeEntry[]>(`/api/projects/${id}/tasks/${selectedTaskId}/time-entries`),
      axios.get<TaskAttachment[]>(`/api/projects/${id}/tasks/${selectedTaskId}/attachments`),
      axios.get<{ depends_on: number[]; blocked_by: number[] }>(`/api/projects/${id}/tasks/${selectedTaskId}/dependencies`),
    ])
      .then(([subRes, dodRes, commentsRes, timeRes, attRes, depRes]) => {
        setSubtasksByTaskId((prev) => ({ ...prev, [selectedTaskId]: subRes.data }));
        setDodByTaskId((prev) => ({ ...prev, [selectedTaskId]: dodRes.data }));
        setCommentsByTaskId((prev) => ({ ...prev, [selectedTaskId]: commentsRes.data }));
        setTimeEntriesByTaskId((prev) => ({ ...prev, [selectedTaskId]: timeRes.data }));
        setAttachmentsByTaskId((prev) => ({ ...prev, [selectedTaskId]: attRes.data }));
        setDependenciesByTaskId((prev) => ({ ...prev, [selectedTaskId]: depRes.data }));
      })
      .catch(() => {});
  }, [id, selectedTaskId]);

  const openAddTask = (columnId: number) => {
    setTaskForm({
      title: '',
      description: '',
      priority: 'medium',
      task_type: 'feature',
      column_id: columnId,
      assigned_to: null,
      sprint_id: null,
      story_points: null,
      due_date: null,
    });
    setTaskModalColumnId(columnId);
    setEditingTaskId(null);
  };

  const openEditTask = (task: ProjectTask) => {
    setTaskForm({
      title: task.title,
      description: task.description || '',
      priority: task.priority,
      task_type: task.task_type ?? 'feature',
      column_id: task.column_id,
      assigned_to: task.assigned_to,
      sprint_id: task.sprint_id ?? null,
      story_points: task.story_points ?? null,
      due_date: task.due_date ?? null,
    });
    setEditingTaskId(task.id);
    setTaskModalColumnId(task.column_id);
    setSelectedTaskId(null);
  };

  const openTaskDrawer = (task: ProjectTask) => {
    setSelectedTaskId(task.id);
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !taskForm.title.trim()) return;
    setSubmitting(true);
    try {
      if (editingTaskId) {
        await axios.put(`/api/projects/${id}/tasks/${editingTaskId}`, {
          title: taskForm.title.trim(),
          description: taskForm.description.trim() || null,
          priority: taskForm.priority,
          task_type: taskForm.task_type,
          assigned_to: taskForm.assigned_to,
          sprint_id: taskForm.sprint_id,
          story_points: taskForm.story_points,
          due_date: taskForm.due_date || null,
        });
        setEditingTaskId(null);
      } else {
        await axios.post(`/api/projects/${id}/tasks`, {
          title: taskForm.title.trim(),
          description: taskForm.description.trim() || null,
          priority: taskForm.priority,
          task_type: taskForm.task_type,
          column_id: taskForm.column_id,
          assigned_to: taskForm.assigned_to,
          sprint_id: taskForm.sprint_id,
          story_points: taskForm.story_points,
          due_date: taskForm.due_date || null,
        });
      }
      setTaskModalColumnId(null);
      fetchProject();
    } catch (err: any) {
      toast.error(err.response?.data?.error || (editingTaskId ? 'Erro ao atualizar tarefa' : 'Erro ao criar tarefa'));
    } finally {
      setSubmitting(false);
    }
  };

  const moveTask = async (taskId: number, columnId: number, orderIndex?: number) => {
    if (!id) return;
    try {
      await axios.patch(`/api/projects/${id}/tasks/${taskId}`, {
        column_id: columnId,
        ...(orderIndex !== undefined && { order_index: orderIndex }),
      });
      fetchProject();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao mover tarefa');
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    if (!id) return;
    const ok = await confirm({ title: 'Excluir tarefa', description: 'Excluir esta tarefa?', confirmLabel: 'Excluir', variant: 'destructive' });
    if (!ok) return;
    try {
      await axios.delete(`/api/projects/${id}/tasks/${taskId}`);
      fetchProject();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao excluir tarefa');
    }
  };

  const openEditColumn = (col: ProjectColumn) => {
    setEditColumnName(col.name);
    setEditColumnId(col.id);
  };

  const handleSaveColumnName = async () => {
    if (!id || !editColumnId || !editColumnName.trim()) return;
    try {
      await axios.put(`/api/projects/${id}/columns/${editColumnId}`, { name: editColumnName.trim() });
      setEditColumnId(null);
      fetchProject();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao atualizar coluna');
    }
  };

  const handleDeleteColumn = async (columnId: number) => {
    if (!id) return;
    const ok = await confirm({
      title: 'Excluir coluna',
      description: 'Excluir esta coluna? As tarefas desta coluna serão excluídas.',
      confirmLabel: 'Excluir',
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      await axios.delete(`/api/projects/${id}/columns/${columnId}`);
      fetchProject();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao excluir coluna');
    }
  };

  const handleAddColumn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !newColumnName.trim()) return;
    setSubmitting(true);
    try {
      await axios.post(`/api/projects/${id}/columns`, { name: newColumnName.trim() });
      setAddColumnModal(false);
      setNewColumnName('');
      fetchProject();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao criar coluna');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveSprint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !sprintForm.name.trim()) return;
    setSubmitting(true);
    try {
      if (editingSprintId) {
        await axios.put(`/api/projects/${id}/sprints/${editingSprintId}`, {
          name: sprintForm.name.trim(),
          start_date: sprintForm.start_date || null,
          end_date: sprintForm.end_date || null,
        });
        setEditingSprintId(null);
      } else {
        await axios.post(`/api/projects/${id}/sprints`, {
          name: sprintForm.name.trim(),
          start_date: sprintForm.start_date || null,
          end_date: sprintForm.end_date || null,
        });
      }
      setSprintForm({ name: '', start_date: '', end_date: '' });
      fetchProject();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao salvar sprint');
    } finally {
      setSubmitting(false);
    }
  };

  const openEditSprint = (s: ProjectSprint) => {
    setSprintForm({ name: s.name, start_date: s.start_date || '', end_date: s.end_date || '' });
    setEditingSprintId(s.id);
  };

  const handleDeleteSprint = async (sprintId: number) => {
    if (!id) return;
    const ok = await confirm({
      title: 'Excluir sprint',
      description: 'Excluir esta sprint? As tarefas não serão excluídas, apenas desvinculadas.',
      confirmLabel: 'Excluir',
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      await axios.delete(`/api/projects/${id}/sprints/${sprintId}`);
      setEditingSprintId(null);
      setSprintForm({ name: '', start_date: '', end_date: '' });
      fetchProject();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao excluir sprint');
    }
  };

  const addSubtask = async (taskId: number) => {
    if (!id || !newSubtaskTitle.trim()) return;
    try {
      const res = await axios.post<Subtask>(`/api/projects/${id}/tasks/${taskId}/subtasks`, { title: newSubtaskTitle.trim() });
      setNewSubtaskTitle('');
      setSubtasksByTaskId((prev) => ({ ...prev, [taskId]: [...(prev[taskId] || []), res.data] }));
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao criar subtarefa');
    }
  };

  const toggleSubtask = async (taskId: number, subtaskId: number, completed: number) => {
    if (!id) return;
    try {
      const res = await axios.patch<Subtask>(`/api/projects/${id}/tasks/${taskId}/subtasks/${subtaskId}`, { completed: completed ? 0 : 1 });
      setSubtasksByTaskId((prev) => ({ ...prev, [taskId]: (prev[taskId] || []).map((s) => (s.id === subtaskId ? res.data : s)) }));
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao atualizar subtarefa');
    }
  };

  const deleteSubtask = async (taskId: number, subtaskId: number) => {
    if (!id) return;
    try {
      await axios.delete(`/api/projects/${id}/tasks/${taskId}/subtasks/${subtaskId}`);
      setSubtasksByTaskId((prev) => ({ ...prev, [taskId]: (prev[taskId] || []).filter((s) => s.id !== subtaskId) }));
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao excluir subtarefa');
    }
  };

  const addDod = async (taskId: number) => {
    if (!id || !newDodLabel.trim()) return;
    try {
      const res = await axios.post<DodItem>(`/api/projects/${id}/tasks/${taskId}/dod`, { label: newDodLabel.trim() });
      setNewDodLabel('');
      setDodByTaskId((prev) => ({ ...prev, [taskId]: [...(prev[taskId] || []), res.data] }));
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao criar item');
    }
  };

  const toggleDod = async (taskId: number, dodId: number, checked: number) => {
    if (!id) return;
    try {
      const res = await axios.patch<DodItem>(`/api/projects/${id}/tasks/${taskId}/dod/${dodId}`, { checked: checked ? 0 : 1 });
      setDodByTaskId((prev) => ({ ...prev, [taskId]: (prev[taskId] || []).map((d) => (d.id === dodId ? res.data : d)) }));
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao atualizar item');
    }
  };

  const deleteDod = async (taskId: number, dodId: number) => {
    if (!id) return;
    try {
      await axios.delete(`/api/projects/${id}/tasks/${taskId}/dod/${dodId}`);
      setDodByTaskId((prev) => ({ ...prev, [taskId]: (prev[taskId] || []).filter((d) => d.id !== dodId) }));
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao excluir item');
    }
  };

  const addComment = async (taskId: number) => {
    if (!id || !newCommentMessage.trim()) return;
    try {
      const res = await axios.post<TaskComment>(`/api/projects/${id}/tasks/${taskId}/comments`, { message: newCommentMessage.trim() });
      setNewCommentMessage('');
      setCommentsByTaskId((prev) => ({ ...prev, [taskId]: [...(prev[taskId] || []), res.data] }));
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao enviar comentário');
    }
  };

  const addTimeEntry = async (taskId: number) => {
    const hours = parseFloat(timeEntryForm.hours.replace(',', '.'));
    if (!id || !timeEntryForm.entry_date || isNaN(hours) || hours <= 0) return;
    try {
      const res = await axios.post<TimeEntry>(`/api/projects/${id}/tasks/${taskId}/time-entries`, {
        hours,
        entry_date: timeEntryForm.entry_date,
        note: timeEntryForm.note.trim() || null,
      });
      setTimeEntryForm((f) => ({ ...f, hours: '', note: '' }));
      setTimeEntriesByTaskId((prev) => ({ ...prev, [taskId]: [res.data, ...(prev[taskId] || [])] }));
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao registrar horas');
    }
  };

  const deleteTimeEntry = async (taskId: number, entryId: number) => {
    if (!id) return;
    try {
      await axios.delete(`/api/projects/${id}/tasks/${taskId}/time-entries/${entryId}`);
      setTimeEntriesByTaskId((prev) => ({ ...prev, [taskId]: (prev[taskId] || []).filter((e) => e.id !== entryId) }));
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao excluir registro');
    }
  };

  const downloadAttachment = async (taskId: number, attachmentId: number, fileName: string) => {
    if (!id) return;
    try {
      const res = await axios.get(`/api/projects/${id}/tasks/${taskId}/attachments/${attachmentId}/download`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao transferir ficheiro');
    }
  };

  const uploadAttachment = async (taskId: number, file: File) => {
    if (!id) return;
    setUploadingAttachment(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await axios.post<TaskAttachment>(`/api/projects/${id}/tasks/${taskId}/attachments`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setAttachmentsByTaskId((prev) => ({ ...prev, [taskId]: [res.data, ...(prev[taskId] || [])] }));
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao anexar ficheiro');
    } finally {
      setUploadingAttachment(false);
    }
  };

  const deleteAttachment = async (taskId: number, attachmentId: number) => {
    if (!id) return;
    try {
      await axios.delete(`/api/projects/${id}/tasks/${taskId}/attachments/${attachmentId}`);
      setAttachmentsByTaskId((prev) => ({ ...prev, [taskId]: (prev[taskId] || []).filter((a) => a.id !== attachmentId) }));
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao excluir anexo');
    }
  };

  const addDependency = async (taskId: number, dependsOnTaskId: number) => {
    if (!id) return;
    try {
      await axios.post(`/api/projects/${id}/tasks/${taskId}/dependencies`, { depends_on_task_id: dependsOnTaskId });
      setDependenciesByTaskId((prev) => ({
        ...prev,
        [taskId]: { depends_on: [...(prev[taskId]?.depends_on || []), dependsOnTaskId], blocked_by: prev[taskId]?.blocked_by || [] },
      }));
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao adicionar dependência');
    }
  };

  const removeDependency = async (taskId: number, dependsOnTaskId: number) => {
    if (!id) return;
    try {
      await axios.delete(`/api/projects/${id}/tasks/${taskId}/dependencies/${dependsOnTaskId}`);
      setDependenciesByTaskId((prev) => ({
        ...prev,
        [taskId]: { depends_on: (prev[taskId]?.depends_on || []).filter((did) => did !== dependsOnTaskId), blocked_by: prev[taskId]?.blocked_by || [] },
      }));
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao remover dependência');
    }
  };

  const handleDragStart = (e: React.DragEvent, taskId: number) => {
    setDragTaskId(taskId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(taskId));
  };

  const handleDragEnd = () => {
    setDragTaskId(null);
    setDragOverColumnId(null);
  };

  const handleDragOver = (e: React.DragEvent, columnId: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumnId(columnId);
  };

  const handleDragLeave = () => {
    setDragOverColumnId(null);
  };

  const handleDrop = (e: React.DragEvent, columnId: number) => {
    e.preventDefault();
    setDragOverColumnId(null);
    if (dragTaskId && project) {
      const task = project.tasks.find((t) => t.id === dragTaskId);
      if (task && task.column_id !== columnId) {
        moveTask(dragTaskId, columnId);
      }
    }
    setDragTaskId(null);
  };

  const filteredTasks = useMemo(() => {
    if (!project?.tasks) return [];
    let list = project.tasks;
    if (filterSprintId !== null) {
      if (filterSprintId === -1) list = list.filter((t) => !t.sprint_id);
      else list = list.filter((t) => t.sprint_id === filterSprintId);
    }
    if (filterTaskType) list = list.filter((t) => (t.task_type || 'feature') === filterTaskType);
    return list;
  }, [project?.tasks, filterSprintId, filterTaskType]);

  const getTasksByColumn = (columnId: number) => filteredTasks.filter((t) => t.column_id === columnId).sort((a, b) => a.order_index - b.order_index);

  const sprintProgress = useMemo(() => {
    if (!project || filterSprintId == null || filterSprintId <= 0) return null;
    const tasksInSprint = (project.tasks || []).filter((t) => t.sprint_id === filterSprintId);
    if (tasksInSprint.length === 0) return { total: 0, done: 0, sprintName: project.sprints?.find((s) => s.id === filterSprintId)?.name };
    const lastColumnOrder = Math.max(...(project.columns || []).map((c) => c.order_index), 0);
    const lastColumn = project.columns?.find((c) => c.order_index === lastColumnOrder);
    const total = tasksInSprint.reduce((s, t) => s + (t.story_points ?? 0), 0);
    const done = lastColumn ? tasksInSprint.filter((t) => t.column_id === lastColumn.id).reduce((s, t) => s + (t.story_points ?? 0), 0) : 0;
    return { total, done, sprintName: project.sprints?.find((s) => s.id === filterSprintId)?.name || 'Sprint' };
  }, [project, filterSprintId]);

  const burndownData = useMemo(() => {
    if (!project || filterSprintId == null || filterSprintId <= 0 || !sprintProgress) return null;
    const sprint = project.sprints?.find((s) => s.id === filterSprintId);
    if (!sprint?.start_date || !sprint?.end_date) return null;
    const start = parseProjectDate(sprint.start_date);
    const end = parseProjectDate(sprint.end_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)));
    const elapsed = Math.max(0, Math.min(totalDays, Math.ceil((today.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))));
    const total = sprintProgress.total;
    const done = sprintProgress.done;
    const remaining = Math.max(0, total - done);
    const todayRatio = totalDays > 0 ? elapsed / totalDays : 0;
    const idealRemaining = total * (1 - todayRatio);
    return { sprintName: sprintProgress.sprintName, start, end, total, done, remaining, totalDays, todayRatio: Math.min(1, todayRatio), idealRemaining };
  }, [project, filterSprintId, sprintProgress]);

  const flowByColumn = useMemo(() => {
    if (!project?.columns?.length || !filteredTasks.length) return null;
    const cols = [...project.columns].sort((a, b) => a.order_index - b.order_index);
    const maxCount = Math.max(1, ...cols.map((c) => filteredTasks.filter((t) => t.column_id === c.id).length));
    return cols.map((c) => {
      const tasks = filteredTasks.filter((t) => t.column_id === c.id);
      return { id: c.id, name: c.name, count: tasks.length, points: tasks.reduce((s, t) => s + (t.story_points ?? 0), 0), widthPct: (tasks.length / maxCount) * 100 };
    });
  }, [project?.columns, filteredTasks]);

  const bugRateMetrics = useMemo(() => {
    if (!filteredTasks.length) return null;
    const bugs = filteredTasks.filter((t) => (t.task_type || 'feature') === 'bug').length;
    const features = filteredTasks.filter((t) => (t.task_type || 'feature') === 'feature').length;
    const total = bugs + features;
    const ratePct = total > 0 ? (bugs / total) * 100 : 0;
    return { bugs, features, total, ratePct };
  }, [filteredTasks]);

  const leadTimeCycleTimeMetrics = useMemo(() => {
    if (!project || filterSprintId == null || filterSprintId <= 0) return null;
    const tasksInSprint = (project.tasks || []).filter((t) => t.sprint_id === filterSprintId && t.completed_at);
    if (tasksInSprint.length === 0) return { sprintName: project.sprints?.find((s) => s.id === filterSprintId)?.name || 'Sprint', count: 0, avgLeadTimeDays: null, avgCycleTimeDays: null };
    const msPerDay = 24 * 60 * 60 * 1000;
    const leadTimes = tasksInSprint.map((t) => (new Date(t.completed_at!).getTime() - new Date(t.created_at).getTime()) / msPerDay);
    const withStarted = tasksInSprint.filter((t) => t.started_at);
    const cycleTimes = withStarted.map((t) => (new Date(t.completed_at!).getTime() - new Date(t.started_at!).getTime()) / msPerDay);
    return {
      sprintName: project.sprints?.find((s) => s.id === filterSprintId)?.name || 'Sprint',
      count: tasksInSprint.length,
      avgLeadTimeDays: leadTimes.length ? leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length : null,
      avgCycleTimeDays: cycleTimes.length ? cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length : null,
    };
  }, [project, filterSprintId]);

  const handleBacklogDrop = (targetColumnId: number, targetIndex: number) => {
    if (!backlogDragTaskId || !project) return;
    const task = project.tasks.find((t) => t.id === backlogDragTaskId);
    if (!task) return;
    setBacklogDragTaskId(null);
    if (task.column_id === targetColumnId && getTasksByColumn(targetColumnId).findIndex((t) => t.id === task.id) === targetIndex) return;
    moveTask(task.id, targetColumnId, targetIndex);
  };

  if (loading || !project) {
    return <div className="text-muted-foreground">{loading ? 'Carregando...' : 'Projeto não encontrado.'}</div>;
  }

  const selectedTask = selectedTaskId ? project.tasks.find((t) => t.id === selectedTaskId) : null;
  const selectedTaskColumn = selectedTask ? project.columns.find((c) => c.id === selectedTask.column_id) : null;
  const formatDate = (s: string | null | undefined) => {
    if (!s) return '—';
    const d = parseProjectDate(s);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div className="mx-auto max-w-[1600px]">
      <header className="mb-5">
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <Link to="/projetos" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft size={18} /> Voltar aos projetos
          </Link>
          {id && (
            <Link to={`/agenda/calendario-de-servico?project=${id}`}>
              <Button variant="secondary" size="sm">
                <Calendar size={16} /> Ver na Agenda
              </Button>
            </Link>
          )}
        </div>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground">{project.name}</h1>
            {project.description && <p className="mt-1 text-sm text-muted-foreground">{project.description}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(project.sprints?.length ?? 0) > 0 && (
              <Select
                value={filterSprintId === null ? '__all' : filterSprintId === -1 ? 'none' : String(filterSprintId)}
                onValueChange={(v) => {
                  if (v === '__all') setFilterSprintId(null);
                  else if (v === 'none') setFilterSprintId(-1);
                  else setFilterSprintId(Number(v));
                }}
              >
                <SelectTrigger className="w-[170px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">Todas as tarefas</SelectItem>
                  <SelectItem value="none">Sem sprint</SelectItem>
                  {project.sprints?.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={filterTaskType || '__all'} onValueChange={(v) => setFilterTaskType(v === '__all' ? '' : (v as ProjectTask['task_type']))}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">Todos os tipos</SelectItem>
                <SelectItem value="feature">{TASK_TYPE_LABEL.feature}</SelectItem>
                <SelectItem value="bug">{TASK_TYPE_LABEL.bug}</SelectItem>
                <SelectItem value="tech_debt">{TASK_TYPE_LABEL.tech_debt}</SelectItem>
                <SelectItem value="chore">{TASK_TYPE_LABEL.chore}</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-1.5">
              <Button variant={viewMode === 'board' ? 'default' : 'outline'} onClick={() => setViewMode('board')}>
                <LayoutGrid size={18} /> Quadro
              </Button>
              <Button variant={viewMode === 'backlog' ? 'default' : 'outline'} onClick={() => setViewMode('backlog')}>
                <List size={18} /> Backlog
              </Button>
            </div>
            {canEdit && (
              <Button
                variant="secondary"
                onClick={() => {
                  setSprintsModalOpen(true);
                  setSprintForm({ name: '', start_date: '', end_date: '' });
                  setEditingSprintId(null);
                }}
              >
                <ListTodo size={18} /> Sprints
              </Button>
            )}
          </div>
        </div>
      </header>

      {(sprintProgress || burndownData || leadTimeCycleTimeMetrics || (flowByColumn && flowByColumn.length > 0) || (bugRateMetrics && bugRateMetrics.total > 0)) && (
        <div className="mb-5 flex flex-wrap gap-4">
          {sprintProgress && sprintProgress.total >= 0 && (
            <MetricCard title={`Progresso da sprint: ${sprintProgress.sprintName}`}>
              <div className="mb-1 flex items-center justify-between text-sm text-muted-foreground">
                <span />
                <span>
                  {sprintProgress.done} / {sprintProgress.total} pontos
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-[var(--purple)] transition-[width] duration-200"
                  style={{ width: sprintProgress.total === 0 ? '0%' : `${Math.min(100, (sprintProgress.done / sprintProgress.total) * 100)}%` }}
                />
              </div>
            </MetricCard>
          )}

          {burndownData && (
            <MetricCard title={`Burndown: ${burndownData.sprintName}`}>
              <div className="mb-1 flex gap-4 text-xs text-muted-foreground">
                <span>Ideal</span>
                <span>Atual: {burndownData.remaining} pts restantes</span>
              </div>
              <div className="relative h-[160px] w-full max-w-[480px]">
                <svg width="100%" height="160" viewBox="0 0 400 160" preserveAspectRatio="none" style={{ overflow: 'visible' }}>
                  <text x="8" y="14" fontSize="10" fill="var(--text-tertiary)">
                    pts
                  </text>
                  {burndownData.total > 0 && (
                    <>
                      <line x1="40" y1="120" x2="360" y2="0" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeDasharray="6,4" opacity={0.8} />
                      <circle
                        cx={40 + burndownData.todayRatio * 320}
                        cy={120 - (burndownData.remaining / Math.max(burndownData.total, 1)) * 120}
                        r="6"
                        fill="var(--purple)"
                        stroke="var(--bg-primary)"
                        strokeWidth="2"
                      />
                    </>
                  )}
                  <text x="40" y="140" fontSize="9" fill="var(--text-tertiary)" textAnchor="start">
                    {burndownData.start.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                  </text>
                  <text x="360" y="140" fontSize="9" fill="var(--text-tertiary)" textAnchor="end">
                    {burndownData.end.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                  </text>
                </svg>
              </div>
            </MetricCard>
          )}

          {leadTimeCycleTimeMetrics && (
            <MetricCard title={`Lead Time & Cycle Time: ${leadTimeCycleTimeMetrics.sprintName}`}>
              <div className="flex flex-wrap gap-4 text-[0.9375rem]">
                <div>
                  <span className="text-muted-foreground">Tarefas concluídas: </span>
                  <span className="text-foreground">{leadTimeCycleTimeMetrics.count}</span>
                </div>
                {leadTimeCycleTimeMetrics.avgLeadTimeDays != null && (
                  <div>
                    <span className="text-muted-foreground">Lead time médio: </span>
                    <span className="text-[var(--purple)]">{leadTimeCycleTimeMetrics.avgLeadTimeDays.toFixed(1)} dias</span>
                  </div>
                )}
                {leadTimeCycleTimeMetrics.avgCycleTimeDays != null && (
                  <div>
                    <span className="text-muted-foreground">Cycle time médio: </span>
                    <span className="text-[var(--green)]">{leadTimeCycleTimeMetrics.avgCycleTimeDays.toFixed(1)} dias</span>
                  </div>
                )}
                {leadTimeCycleTimeMetrics.count === 0 && <span className="text-sm text-muted-foreground">Mova tarefas para a última coluna para preencher as métricas.</span>}
              </div>
            </MetricCard>
          )}

          {flowByColumn && flowByColumn.length > 0 && (
            <MetricCard title="Fluxo por coluna">
              <div className="flex flex-col gap-2">
                {flowByColumn.map((col) => (
                  <div key={col.id} className="flex items-center gap-3">
                    <span className="w-[100px] shrink-0 truncate text-[0.8125rem] text-muted-foreground">{col.name}</span>
                    <div className="h-5 min-w-0 flex-1 overflow-hidden rounded-sm bg-muted">
                      <div className="h-full rounded-sm bg-[var(--purple)] transition-[width] duration-200" style={{ width: `${col.widthPct}%` }} />
                    </div>
                    <span className="shrink-0 text-[0.8125rem] text-muted-foreground">
                      {col.count} {col.count === 1 ? 'tarefa' : 'tarefas'}
                      {col.points > 0 && ` · ${col.points} pts`}
                    </span>
                  </div>
                ))}
              </div>
            </MetricCard>
          )}

          {bugRateMetrics && bugRateMetrics.total > 0 && (
            <MetricCard title="Bug rate (funcionalidades vs bugs)">
              <div className="flex flex-wrap items-center gap-4 text-[0.9375rem]">
                <span className="text-[var(--blue)]">{bugRateMetrics.features} funcionalidades</span>
                <span className="text-[var(--red)]">{bugRateMetrics.bugs} bugs</span>
                <span className="text-muted-foreground">
                  Taxa: <strong className={bugRateMetrics.ratePct > 30 ? 'text-[var(--red)]' : 'text-foreground'}>{bugRateMetrics.ratePct.toFixed(0)}%</strong> bugs
                </span>
              </div>
            </MetricCard>
          )}
        </div>
      )}

      {viewMode === 'backlog' ? (
        <Card className="px-5 py-5">
          <h3 className="mb-4 text-base font-semibold text-foreground">Backlog</h3>
          <div className="flex flex-col gap-5">
            {(project.columns || [])
              .sort((a, b) => a.order_index - b.order_index)
              .map((col) => {
                const tasks = getTasksByColumn(col.id);
                return (
                  <div key={col.id}>
                    <div className="mb-2 text-sm font-semibold text-muted-foreground">{col.name}</div>
                    <div
                      className="flex flex-col gap-1.5"
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (!backlogDragTaskId || !canEdit) return;
                        const task = project.tasks.find((t) => t.id === backlogDragTaskId);
                        if (!task) return;
                        handleBacklogDrop(col.id, getTasksByColumn(col.id).length);
                        setBacklogDragTaskId(null);
                      }}
                    >
                      {tasks.length === 0 && (
                        <div
                          className="rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground"
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            if (!backlogDragTaskId || !canEdit) return;
                            handleBacklogDrop(col.id, 0);
                            setBacklogDragTaskId(null);
                          }}
                        >
                          Arraste tarefas para cá
                        </div>
                      )}
                      {tasks.map((task) => (
                        <div
                          key={task.id}
                          className={cn(
                            'flex items-center gap-2.5 rounded-lg border border-border bg-muted/40 px-4 py-2.5 transition-shadow hover:shadow-sm',
                            canEdit ? 'cursor-grab active:cursor-grabbing' : 'cursor-default',
                            backlogDragTaskId === task.id && 'opacity-60'
                          )}
                          draggable={canEdit}
                          onDragStart={() => canEdit && setBacklogDragTaskId(task.id)}
                          onDragEnd={() => setBacklogDragTaskId(null)}
                        >
                          {canEdit && <GripVertical size={18} className="shrink-0 text-muted-foreground" />}
                          <div className="min-w-0 flex-1 cursor-pointer" onClick={() => setSelectedTaskId(task.id)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setSelectedTaskId(task.id)}>
                            <span className="font-medium text-foreground">{task.title}</span>
                            <div className="mt-0.5 flex flex-wrap gap-2.5">
                              {task.sprint_name && <span className="text-xs text-muted-foreground">{task.sprint_name}</span>}
                              {task.story_points != null && <span className="text-xs text-[var(--purple)]">{task.story_points} pts</span>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
          </div>
        </Card>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-3">
          {(project.columns || [])
            .sort((a, b) => a.order_index - b.order_index)
            .map((col) => (
              <div
                key={col.id}
                className={cn(
                  'flex max-h-[calc(100vh-220px)] w-[280px] shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-card transition-colors',
                  dragOverColumnId === col.id && 'bg-[var(--purple-light)] ring-2 ring-[var(--purple)]'
                )}
                onDragOver={(e) => canEdit && handleDragOver(e, col.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => canEdit && handleDrop(e, col.id)}
              >
                <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3 text-[0.9375rem] font-semibold text-foreground">
                  <span className="min-w-0 flex-1 truncate">{col.name}</span>
                  <span className="text-[0.8125rem] font-medium text-muted-foreground">{getTasksByColumn(col.id).length}</span>
                  {canEdit && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm">
                          <Settings size={16} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditColumn(col)}>
                          <Edit2 size={14} /> Editar nome
                        </DropdownMenuItem>
                        {project.columns.length > 1 && canDelete && (
                          <DropdownMenuItem variant="destructive" onClick={() => handleDeleteColumn(col.id)}>
                            <Trash2 size={14} /> Excluir coluna
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2">
                  {getTasksByColumn(col.id).map((task) => (
                    <div
                      key={task.id}
                      draggable={canEdit}
                      onDragStart={(e) => handleDragStart(e, task.id)}
                      onDragEnd={handleDragEnd}
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest('button')) return;
                        openTaskDrawer(task);
                      }}
                      className={cn(
                        'relative rounded-lg border border-border bg-muted/40 p-3.5 border-l-[3px] transition-all hover:border-[var(--border-hover)] hover:shadow-sm',
                        dragTaskId === task.id ? 'cursor-grabbing opacity-60 shadow-lg' : canEdit ? 'cursor-grab' : 'cursor-pointer'
                      )}
                      style={{ borderLeftColor: PRIORITY_COLOR[task.priority] || 'transparent' }}
                    >
                      {canEdit && (
                        <div className="absolute top-1.5 right-1.5">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon-sm">
                                <MoreHorizontal size={16} />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditTask(task)}>
                                <Edit2 size={14} /> Editar
                              </DropdownMenuItem>
                              {project.columns
                                .filter((c) => c.id !== task.column_id)
                                .map((c) => (
                                  <DropdownMenuItem key={c.id} onClick={() => moveTask(task.id, c.id)}>
                                    Mover para {c.name}
                                  </DropdownMenuItem>
                                ))}
                              {canDelete && (
                                <DropdownMenuItem variant="destructive" onClick={() => handleDeleteTask(task.id)}>
                                  <Trash2 size={14} /> Excluir
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      )}
                      <div className="mb-1.5 text-[0.6875rem] font-semibold tracking-wide uppercase" style={{ color: PRIORITY_COLOR[task.priority] || 'var(--text-tertiary)' }}>
                        {PRIORITY_LABEL[task.priority] || task.priority}
                      </div>
                      <div className="pr-6 text-[0.9375rem] leading-snug font-medium text-foreground">{task.title}</div>
                      {(task.assigned_to_name || task.sprint_name || task.story_points != null || (task.task_type && task.task_type !== 'feature')) && (
                        <div className="mt-2 flex flex-wrap items-center gap-2.5 text-xs text-muted-foreground">
                          {task.task_type && task.task_type !== 'feature' && <span style={{ color: TASK_TYPE_COLOR[task.task_type] }}>{TASK_TYPE_LABEL[task.task_type]}</span>}
                          {task.assigned_to_name && (
                            <span className="flex items-center gap-1">
                              <User size={12} /> {task.assigned_to_name}
                            </span>
                          )}
                          {task.sprint_name && <span>{task.sprint_name}</span>}
                          {task.story_points != null && <span>{task.story_points} pts</span>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {canCreate && (
                  <div className="border-t border-border p-2">
                    <button
                      type="button"
                      onClick={() => openAddTask(col.id)}
                      className="flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <Plus size={18} /> Adicionar tarefa
                    </button>
                  </div>
                )}
              </div>
            ))}
          {canEdit && (
            <div className="w-[280px] shrink-0">
              <button
                type="button"
                onClick={() => setAddColumnModal(true)}
                className="flex h-full min-h-[120px] w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border text-muted-foreground hover:border-[var(--purple)] hover:text-[var(--purple)]"
              >
                <Plus size={22} /> Nova coluna
              </button>
            </div>
          )}
        </div>
      )}

      {/* Drawer de detalhes da tarefa */}
      <Sheet open={!!selectedTask} onOpenChange={(open) => !open && setSelectedTaskId(null)}>
        <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-[440px]">
          {selectedTask && (
            <>
              <div className="h-1 shrink-0 bg-gradient-to-r from-[var(--purple)] to-[var(--blue)]" />
              <SheetHeader className="border-b border-border p-5">
                <SheetTitle className="pr-6 text-lg leading-snug">{selectedTask.title}</SheetTitle>
              </SheetHeader>
              <div className="p-5">
                <div className="mb-4">
                  <FieldLabel>Prioridade</FieldLabel>
                  <div className="text-[0.9375rem]" style={{ color: PRIORITY_COLOR[selectedTask.priority] }}>
                    {PRIORITY_LABEL[selectedTask.priority]}
                  </div>
                </div>
                <div className="mb-4">
                  <FieldLabel>Tipo</FieldLabel>
                  <div className="text-[0.9375rem]" style={{ color: TASK_TYPE_COLOR[selectedTask.task_type || 'feature'] }}>
                    {TASK_TYPE_LABEL[selectedTask.task_type || 'feature']}
                  </div>
                </div>
                {selectedTaskColumn && (
                  <div className="mb-4">
                    <FieldLabel>Coluna</FieldLabel>
                    <div className="text-[0.9375rem] text-foreground">{selectedTaskColumn.name}</div>
                  </div>
                )}
                {selectedTask.description && (
                  <div className="mb-4">
                    <FieldLabel>Descrição</FieldLabel>
                    <div className="markdown-body text-[0.9375rem] text-muted-foreground">
                      <ReactMarkdown>{selectedTask.description}</ReactMarkdown>
                    </div>
                  </div>
                )}
                {selectedTask.assigned_to_name && (
                  <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
                    <User size={16} className="shrink-0 text-muted-foreground/70" />
                    <span>{selectedTask.assigned_to_name}</span>
                  </div>
                )}
                {selectedTask.sprint_name && (
                  <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
                    <ListTodo size={16} className="shrink-0 text-muted-foreground/70" />
                    <span>{selectedTask.sprint_name}</span>
                  </div>
                )}
                {selectedTask.story_points != null && (
                  <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
                    <Target size={16} className="shrink-0 text-muted-foreground/70" />
                    <span>{selectedTask.story_points} pontos</span>
                  </div>
                )}
                {selectedTask.due_date && (
                  <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar size={16} className="shrink-0 text-muted-foreground/70" />
                    <span>Vencimento: {formatDate(selectedTask.due_date)}</span>
                  </div>
                )}
                <div className="mb-4 text-xs text-muted-foreground">
                  Criado em {formatDate(selectedTask.created_at)} · Atualizado em {formatDate(selectedTask.updated_at)}
                </div>

                {/* Subtarefas */}
                <div className="mt-5 border-t border-border pt-4">
                  <div className="mb-2 flex items-center gap-1.5 text-[0.8125rem] font-semibold text-foreground">
                    <ListTodo size={16} /> Subtarefas
                  </div>
                  <ul className="m-0 list-none p-0">
                    {(subtasksByTaskId[selectedTask.id] || []).map((s) => (
                      <li key={s.id} className="mb-1.5 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleSubtask(selectedTask.id, s.id, s.completed)}
                          className={cn('shrink-0', s.completed ? 'text-[var(--green)]' : 'text-muted-foreground')}
                        >
                          {s.completed ? <CheckSquare size={18} /> : <Square size={18} />}
                        </button>
                        <span className={cn('flex-1 text-sm', s.completed ? 'text-muted-foreground line-through' : 'text-foreground')}>{s.title}</span>
                        {canDelete && (
                          <button type="button" onClick={() => deleteSubtask(selectedTask.id, s.id)} className="shrink-0 text-muted-foreground hover:text-destructive">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                  {canCreate && (
                    <div className="mt-2 flex gap-2">
                      <Input
                        value={newSubtaskTitle}
                        onChange={(e) => setNewSubtaskTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addSubtask(selectedTask.id);
                          }
                        }}
                        placeholder="Nova subtarefa..."
                        className="flex-1"
                      />
                      <Button variant="secondary" size="icon" onClick={() => addSubtask(selectedTask.id)} disabled={!newSubtaskTitle.trim()}>
                        <Plus size={16} />
                      </Button>
                    </div>
                  )}
                </div>

                {/* DoD */}
                <div className="mt-5 border-t border-border pt-4">
                  <div className="mb-2 flex items-center gap-1.5 text-[0.8125rem] font-semibold text-foreground">
                    <ClipboardCheck size={16} /> Definição de Pronto (DoD)
                  </div>
                  <ul className="m-0 list-none p-0">
                    {(dodByTaskId[selectedTask.id] || []).map((d) => (
                      <li key={d.id} className="mb-1.5 flex items-center gap-2">
                        <button type="button" onClick={() => toggleDod(selectedTask.id, d.id, d.checked)} className={cn('shrink-0', d.checked ? 'text-[var(--green)]' : 'text-muted-foreground')}>
                          {d.checked ? <CheckSquare size={18} /> : <Square size={18} />}
                        </button>
                        <span className={cn('flex-1 text-sm', d.checked ? 'text-muted-foreground line-through' : 'text-foreground')}>{d.label}</span>
                        {canDelete && (
                          <button type="button" onClick={() => deleteDod(selectedTask.id, d.id)} className="shrink-0 text-muted-foreground hover:text-destructive">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                  {canCreate && (
                    <div className="mt-2 flex gap-2">
                      <Input
                        value={newDodLabel}
                        onChange={(e) => setNewDodLabel(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addDod(selectedTask.id);
                          }
                        }}
                        placeholder="Novo item DoD..."
                        className="flex-1"
                      />
                      <Button variant="secondary" size="icon" onClick={() => addDod(selectedTask.id)} disabled={!newDodLabel.trim()}>
                        <Plus size={16} />
                      </Button>
                    </div>
                  )}
                </div>

                {/* Comentários */}
                <div className="mt-5 border-t border-border pt-4">
                  <div className="mb-2 flex items-center gap-1.5 text-[0.8125rem] font-semibold text-foreground">
                    <MessageSquare size={16} /> Comentários
                  </div>
                  <div className="mb-2 max-h-[160px] overflow-y-auto">
                    {(commentsByTaskId[selectedTask.id] || []).map((c) => (
                      <div key={c.id} className="mb-2 rounded-lg bg-muted/60 p-2.5">
                        <div className="mb-0.5 text-xs text-muted-foreground">
                          {c.user_name} · {formatDate(c.created_at)}
                        </div>
                        <div className="markdown-body text-sm text-foreground">
                          <CommentBody message={c.message} />
                        </div>
                      </div>
                    ))}
                  </div>
                  {canCreate && (
                    <div className="flex gap-2">
                      <Textarea
                        value={newCommentMessage}
                        onChange={(e) => setNewCommentMessage(e.target.value)}
                        placeholder="Escrever comentário... (use @Nome para mencionar)"
                        rows={2}
                        className="min-h-[44px] flex-1"
                      />
                      <Button variant="secondary" className="self-end" onClick={() => addComment(selectedTask.id)} disabled={!newCommentMessage.trim()}>
                        Enviar
                      </Button>
                    </div>
                  )}
                </div>

                {/* Tempo registrado */}
                <div className="mt-5 border-t border-border pt-4">
                  <div className="mb-2 flex items-center gap-1.5 text-[0.8125rem] font-semibold text-foreground">
                    <Clock size={16} /> Tempo registrado
                    {(timeEntriesByTaskId[selectedTask.id] || []).length > 0 && (
                      <span className="font-medium text-muted-foreground">({(timeEntriesByTaskId[selectedTask.id] || []).reduce((sum, e) => sum + e.hours, 0).toFixed(1)} h)</span>
                    )}
                  </div>
                  <ul className="m-0 mb-2 list-none p-0">
                    {(timeEntriesByTaskId[selectedTask.id] || []).map((e) => (
                      <li key={e.id} className="flex items-center justify-between border-b border-border py-1.5 text-sm">
                        <span>
                          <strong>{e.hours}</strong> h · {formatDate(e.entry_date)} · {e.user_name}
                          {e.note ? ` · ${e.note}` : ''}
                        </span>
                        {canDelete && (
                          <button type="button" onClick={() => deleteTimeEntry(selectedTask.id, e.id)} className="shrink-0 text-muted-foreground hover:text-destructive">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                  {canCreate && (
                    <div className="flex flex-wrap items-end gap-2">
                      <Input
                        type="number"
                        min="0.25"
                        step="0.25"
                        placeholder="Horas"
                        value={timeEntryForm.hours}
                        onChange={(e) => setTimeEntryForm((f) => ({ ...f, hours: e.target.value }))}
                        className="w-[75px]"
                      />
                      <Input type="date" value={timeEntryForm.entry_date} onChange={(e) => setTimeEntryForm((f) => ({ ...f, entry_date: e.target.value }))} className="w-[135px]" />
                      <Input
                        placeholder="Nota (opcional)"
                        value={timeEntryForm.note}
                        onChange={(e) => setTimeEntryForm((f) => ({ ...f, note: e.target.value }))}
                        className="min-w-[100px] flex-1"
                      />
                      <Button
                        variant="secondary"
                        onClick={() => addTimeEntry(selectedTask.id)}
                        disabled={!timeEntryForm.hours || !timeEntryForm.entry_date || parseFloat(timeEntryForm.hours.replace(',', '.')) <= 0}
                      >
                        Adicionar
                      </Button>
                    </div>
                  )}
                </div>

                {/* Anexos */}
                <div className="mt-5 border-t border-border pt-4">
                  <div className="mb-2 flex items-center gap-1.5 text-[0.8125rem] font-semibold text-foreground">
                    <Paperclip size={16} /> Anexos
                  </div>
                  <ul className="m-0 mb-2 list-none p-0">
                    {(attachmentsByTaskId[selectedTask.id] || []).map((a) => (
                      <li key={a.id} className="flex items-center justify-between gap-2 border-b border-border py-1.5 text-sm">
                        <button
                          type="button"
                          onClick={() => downloadAttachment(selectedTask.id, a.id, a.file_name)}
                          className="min-w-0 flex-1 truncate text-left text-[var(--purple)] hover:underline"
                        >
                          {a.file_name}
                          {a.file_size != null && <span className="ml-1.5 font-normal text-muted-foreground">({(a.file_size / 1024).toFixed(1)} KB)</span>}
                        </button>
                        {canDelete && (
                          <button type="button" onClick={() => deleteAttachment(selectedTask.id, a.id)} className="shrink-0 text-muted-foreground hover:text-destructive">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                  {canEdit && (
                    <div>
                      <input
                        type="file"
                        id={`task-attachment-${selectedTask.id}`}
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) uploadAttachment(selectedTask.id, f);
                          e.target.value = '';
                        }}
                        disabled={uploadingAttachment}
                      />
                      <label
                        htmlFor={`task-attachment-${selectedTask.id}`}
                        className={cn(buttonVariants({ variant: 'secondary' }), 'cursor-pointer', uploadingAttachment && 'pointer-events-none opacity-50')}
                      >
                        <Plus size={16} /> {uploadingAttachment ? 'A enviar...' : 'Anexar ficheiro'}
                      </label>
                    </div>
                  )}
                </div>

                {/* Dependências */}
                <div className="mt-5 border-t border-border pt-4">
                  <div className="mb-2 flex items-center gap-1.5 text-[0.8125rem] font-semibold text-foreground">
                    <Link2 size={16} /> Dependências
                  </div>
                  {(() => {
                    const deps = dependenciesByTaskId[selectedTask.id] || { depends_on: [], blocked_by: [] };
                    const otherTasks = (project?.tasks || []).filter((t) => t.id !== selectedTask.id);
                    const canAdd = otherTasks.filter((t) => !deps.depends_on.includes(t.id));
                    return (
                      <>
                        {deps.depends_on.length > 0 && (
                          <div className="mb-2">
                            <div className="mb-1 text-xs text-muted-foreground">Depende de</div>
                            <ul className="m-0 list-none p-0">
                              {deps.depends_on.map((tid) => {
                                const t = project?.tasks.find((x) => x.id === tid);
                                return t ? (
                                  <li key={tid} className="flex items-center justify-between border-b border-border py-1.5 text-sm">
                                    <button type="button" onClick={() => setSelectedTaskId(tid)} className="min-w-0 flex-1 truncate text-left text-[var(--purple)] hover:underline">
                                      {t.title}
                                    </button>
                                    {canEdit && (
                                      <button type="button" onClick={() => removeDependency(selectedTask.id, tid)} className="shrink-0 text-muted-foreground hover:text-destructive">
                                        <Trash2 size={14} />
                                      </button>
                                    )}
                                  </li>
                                ) : null;
                              })}
                            </ul>
                          </div>
                        )}
                        {deps.blocked_by.length > 0 && (
                          <div className="mb-2">
                            <div className="mb-1 text-xs text-muted-foreground">Bloqueia</div>
                            <ul className="m-0 list-none p-0">
                              {deps.blocked_by.map((tid) => {
                                const t = project?.tasks.find((x) => x.id === tid);
                                return t ? (
                                  <li key={tid} className="border-b border-border py-1.5 text-sm">
                                    <button type="button" onClick={() => setSelectedTaskId(tid)} className="text-left text-[var(--purple)] hover:underline">
                                      {t.title}
                                    </button>
                                  </li>
                                ) : null;
                              })}
                            </ul>
                          </div>
                        )}
                        {canEdit && canAdd.length > 0 && (
                          <select
                            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                            onChange={(e) => {
                              const v = e.target.value;
                              if (v) {
                                addDependency(selectedTask.id, Number(v));
                                e.target.value = '';
                              }
                            }}
                            value=""
                          >
                            <option value="">Adicionar dependência...</option>
                            {canAdd.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.title}
                              </option>
                            ))}
                          </select>
                        )}
                        {deps.depends_on.length === 0 && deps.blocked_by.length === 0 && !canEdit && <span className="text-sm text-muted-foreground">Nenhuma dependência.</span>}
                      </>
                    );
                  })()}
                </div>

                {canEdit && (
                  <Button className="mt-5 w-full" onClick={() => openEditTask(selectedTask)}>
                    <Edit2 size={18} /> Editar tarefa
                  </Button>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Modal nova/editar tarefa */}
      <Dialog open={taskModalColumnId !== null} onOpenChange={(open) => !open && !submitting && (setTaskModalColumnId(null), setEditingTaskId(null))}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingTaskId ? 'Editar tarefa' : 'Nova tarefa'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveTask} className="flex flex-col gap-4">
            <div>
              <Label className="mb-1.5">Título *</Label>
              <Input value={taskForm.title} onChange={(e) => setTaskForm((f) => ({ ...f, title: e.target.value }))} placeholder="Título da tarefa" required />
            </div>
            <div>
              <Label className="mb-1.5">Descrição</Label>
              <Textarea value={taskForm.description} onChange={(e) => setTaskForm((f) => ({ ...f, description: e.target.value }))} placeholder="Descrição (opcional)" rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5">Prioridade</Label>
                <Select value={taskForm.priority} onValueChange={(v) => setTaskForm((f) => ({ ...f, priority: v as ProjectTask['priority'] }))}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(['low', 'medium', 'high', 'urgent'] as const).map((p) => (
                      <SelectItem key={p} value={p}>
                        {PRIORITY_LABEL[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1.5">Tipo</Label>
                <Select value={taskForm.task_type ?? 'feature'} onValueChange={(v) => setTaskForm((f) => ({ ...f, task_type: v as ProjectTask['task_type'] }))}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(['feature', 'bug', 'tech_debt', 'chore'] as const).map((t) => (
                      <SelectItem key={t} value={t}>
                        {TASK_TYPE_LABEL[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="mb-1.5">Responsável</Label>
              <Select value={taskForm.assigned_to ? String(taskForm.assigned_to) : '__none'} onValueChange={(v) => setTaskForm((f) => ({ ...f, assigned_to: v === '__none' ? null : Number(v) }))}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Ninguém</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(project.sprints?.length ?? 0) > 0 && (
              <div>
                <Label className="mb-1.5">Sprint</Label>
                <Select value={taskForm.sprint_id ? String(taskForm.sprint_id) : '__none'} onValueChange={(v) => setTaskForm((f) => ({ ...f, sprint_id: v === '__none' ? null : Number(v) }))}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Nenhuma</SelectItem>
                    {project.sprints?.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5">Story points</Label>
                <Input
                  type="number"
                  min={0}
                  value={taskForm.story_points ?? ''}
                  onChange={(e) => setTaskForm((f) => ({ ...f, story_points: e.target.value === '' ? null : parseInt(e.target.value, 10) || null }))}
                  placeholder="Ex: 3"
                />
              </div>
              <div>
                <Label className="mb-1.5">Vencimento</Label>
                <Input type="date" value={taskForm.due_date ?? ''} onChange={(e) => setTaskForm((f) => ({ ...f, due_date: e.target.value || null }))} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => !submitting && setTaskModalColumnId(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting || !taskForm.title.trim()}>
                {submitting ? (editingTaskId ? 'Salvando...' : 'Criando...') : editingTaskId ? 'Salvar' : 'Criar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Editar nome da coluna */}
      <Dialog open={editColumnId !== null} onOpenChange={(open) => !open && setEditColumnId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar nome da coluna</DialogTitle>
          </DialogHeader>
          <Input value={editColumnName} onChange={(e) => setEditColumnName(e.target.value)} placeholder="Nome da coluna" autoFocus />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditColumnId(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveColumnName} disabled={!editColumnName.trim()}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Nova coluna */}
      <Dialog open={addColumnModal} onOpenChange={(open) => !open && !submitting && setAddColumnModal(false)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Nova coluna</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddColumn} className="flex flex-col gap-4">
            <Input value={newColumnName} onChange={(e) => setNewColumnName(e.target.value)} placeholder="Ex: Em revisão" autoFocus />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => !submitting && setAddColumnModal(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting || !newColumnName.trim()}>
                {submitting ? 'Criando...' : 'Criar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Sprints */}
      <Dialog open={sprintsModalOpen} onOpenChange={(open) => !open && !submitting && (setSprintsModalOpen(false), setEditingSprintId(null))}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Sprints</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveSprint} className="mb-5 flex flex-col gap-3">
            <Input value={sprintForm.name} onChange={(e) => setSprintForm((f) => ({ ...f, name: e.target.value }))} placeholder="Nome da sprint" required />
            <div className="flex gap-2">
              <Input type="date" value={sprintForm.start_date} onChange={(e) => setSprintForm((f) => ({ ...f, start_date: e.target.value }))} className="flex-1" />
              <Input type="date" value={sprintForm.end_date} onChange={(e) => setSprintForm((f) => ({ ...f, end_date: e.target.value }))} className="flex-1" />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={submitting || !sprintForm.name.trim()}>
                {editingSprintId ? 'Salvar' : 'Criar sprint'}
              </Button>
              {editingSprintId && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditingSprintId(null);
                    setSprintForm({ name: '', start_date: '', end_date: '' });
                  }}
                >
                  Cancelar
                </Button>
              )}
            </div>
          </form>
          <div className="border-t border-border pt-4">
            {(project.sprints?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma sprint criada.</p>
            ) : (
              <ul className="m-0 list-none p-0">
                {project.sprints?.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2 border-b border-border py-2.5">
                    <div className="min-w-0">
                      <span className="font-medium text-foreground">{s.name}</span>
                      {(s.start_date || s.end_date) && (
                        <span className="ml-2 text-[0.8125rem] text-muted-foreground">
                          {s.start_date && parseProjectDate(s.start_date).toLocaleDateString('pt-BR')}
                          {s.start_date && s.end_date && ' – '}
                          {s.end_date && parseProjectDate(s.end_date).toLocaleDateString('pt-BR')}
                        </span>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <Button variant="secondary" size="sm" onClick={() => openEditSprint(s)}>
                        Editar
                      </Button>
                      {canDelete && (
                        <Button variant="destructive" size="sm" onClick={() => handleDeleteSprint(s.id)}>
                          Excluir
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
