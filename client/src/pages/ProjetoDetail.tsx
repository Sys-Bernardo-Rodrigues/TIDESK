import { useEffect, useState, useRef, useLayoutEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import {
  ArrowLeft,
  Plus,
  MoreHorizontal,
  Trash2,
  User,
  X,
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

function processMentions(str: string): React.ReactNode {
  const parts = str.split(/(@[\wáéíóúãõâêôç]+)/gi);
  return parts.map((part, i) =>
    part.startsWith('@') ? (
      <span key={i} className="mention" style={{ color: 'var(--purple)', fontWeight: 600 }}>{part}</span>
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

export default function ProjetoDetail() {
  const { id } = useParams<{ id: string }>();
  const { hasPermission } = usePermissions();
  const [project, setProject] = useState<Project | null>(null);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [taskModalColumnId, setTaskModalColumnId] = useState<number | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [taskMenuId, setTaskMenuId] = useState<number | null>(null);
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
  const [columnMenuId, setColumnMenuId] = useState<number | null>(null);
  const [editColumnId, setEditColumnId] = useState<number | null>(null);
  const [editColumnName, setEditColumnName] = useState('');
  const [deleteColumnId, setDeleteColumnId] = useState<number | null>(null);
  const [addColumnModal, setAddColumnModal] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [dragTaskId, setDragTaskId] = useState<number | null>(null);
  const [dragOverColumnId, setDragOverColumnId] = useState<number | null>(null);
  const taskMenuButtonRef = useRef<HTMLButtonElement>(null);
  const [taskMenuPosition, setTaskMenuPosition] = useState<{ top: number; left: number } | null>(null);
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
      setError(null);
      const res = await axios.get<Project>(`/api/projects/${id}`);
      setProject(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao carregar projeto');
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

  useLayoutEffect(() => {
    if (!taskMenuId) {
      setTaskMenuPosition(null);
      return;
    }
    const rect = taskMenuButtonRef.current?.getBoundingClientRect();
    if (rect) {
      const menuWidth = 140;
      const left = Math.max(8, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8));
      const top = rect.bottom + 4;
      setTaskMenuPosition({ top, left });
    }
  }, [taskMenuId]);

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
    setTaskMenuId(null);
    setSelectedTaskId(null);
  };

  const openTaskDrawer = (task: ProjectTask) => {
    setSelectedTaskId(task.id);
    setTaskMenuId(null);
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
      setError(err.response?.data?.error || (editingTaskId ? 'Erro ao atualizar tarefa' : 'Erro ao criar tarefa'));
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
      setTaskMenuId(null);
      fetchProject();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao mover tarefa');
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    if (!id || !window.confirm('Excluir esta tarefa?')) return;
    try {
      await axios.delete(`/api/projects/${id}/tasks/${taskId}`);
      setTaskMenuId(null);
      fetchProject();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao excluir tarefa');
    }
  };

  const openEditColumn = (col: ProjectColumn) => {
    setEditColumnName(col.name);
    setEditColumnId(col.id);
    setColumnMenuId(null);
  };

  const handleSaveColumnName = async () => {
    if (!id || !editColumnId || !editColumnName.trim()) return;
    try {
      await axios.put(`/api/projects/${id}/columns/${editColumnId}`, { name: editColumnName.trim() });
      setEditColumnId(null);
      fetchProject();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao atualizar coluna');
    }
  };

  const handleDeleteColumn = async () => {
    if (!id || !deleteColumnId) return;
    try {
      await axios.delete(`/api/projects/${id}/columns/${deleteColumnId}`);
      setDeleteColumnId(null);
      fetchProject();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao excluir coluna');
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
      setError(err.response?.data?.error || 'Erro ao criar coluna');
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
      setError(err.response?.data?.error || 'Erro ao salvar sprint');
    } finally {
      setSubmitting(false);
    }
  };

  const openEditSprint = (s: ProjectSprint) => {
    setSprintForm({
      name: s.name,
      start_date: s.start_date || '',
      end_date: s.end_date || '',
    });
    setEditingSprintId(s.id);
  };

  const handleDeleteSprint = async (sprintId: number) => {
    if (!id || !window.confirm('Excluir esta sprint? As tarefas não serão excluídas, apenas desvinculadas.')) return;
    try {
      await axios.delete(`/api/projects/${id}/sprints/${sprintId}`);
      setEditingSprintId(null);
      setSprintForm({ name: '', start_date: '', end_date: '' });
      fetchProject();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao excluir sprint');
    }
  };

  const addSubtask = async (taskId: number) => {
    if (!id || !newSubtaskTitle.trim()) return;
    try {
      const res = await axios.post<Subtask>(`/api/projects/${id}/tasks/${taskId}/subtasks`, { title: newSubtaskTitle.trim() });
      setNewSubtaskTitle('');
      setSubtasksByTaskId((prev) => ({ ...prev, [taskId]: [...(prev[taskId] || []), res.data] }));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao criar subtarefa');
    }
  };

  const toggleSubtask = async (taskId: number, subtaskId: number, completed: number) => {
    if (!id) return;
    try {
      const res = await axios.patch<Subtask>(`/api/projects/${id}/tasks/${taskId}/subtasks/${subtaskId}`, { completed: completed ? 0 : 1 });
      setSubtasksByTaskId((prev) => ({
        ...prev,
        [taskId]: (prev[taskId] || []).map((s) => (s.id === subtaskId ? res.data : s)),
      }));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao atualizar subtarefa');
    }
  };

  const deleteSubtask = async (taskId: number, subtaskId: number) => {
    if (!id) return;
    try {
      await axios.delete(`/api/projects/${id}/tasks/${taskId}/subtasks/${subtaskId}`);
      setSubtasksByTaskId((prev) => ({ ...prev, [taskId]: (prev[taskId] || []).filter((s) => s.id !== subtaskId) }));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao excluir subtarefa');
    }
  };

  const addDod = async (taskId: number) => {
    if (!id || !newDodLabel.trim()) return;
    try {
      const res = await axios.post<DodItem>(`/api/projects/${id}/tasks/${taskId}/dod`, { label: newDodLabel.trim() });
      setNewDodLabel('');
      setDodByTaskId((prev) => ({ ...prev, [taskId]: [...(prev[taskId] || []), res.data] }));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao criar item');
    }
  };

  const toggleDod = async (taskId: number, dodId: number, checked: number) => {
    if (!id) return;
    try {
      const res = await axios.patch<DodItem>(`/api/projects/${id}/tasks/${taskId}/dod/${dodId}`, { checked: checked ? 0 : 1 });
      setDodByTaskId((prev) => ({
        ...prev,
        [taskId]: (prev[taskId] || []).map((d) => (d.id === dodId ? res.data : d)),
      }));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao atualizar item');
    }
  };

  const deleteDod = async (taskId: number, dodId: number) => {
    if (!id) return;
    try {
      await axios.delete(`/api/projects/${id}/tasks/${taskId}/dod/${dodId}`);
      setDodByTaskId((prev) => ({ ...prev, [taskId]: (prev[taskId] || []).filter((d) => d.id !== dodId) }));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao excluir item');
    }
  };

  const addComment = async (taskId: number) => {
    if (!id || !newCommentMessage.trim()) return;
    try {
      const res = await axios.post<TaskComment>(`/api/projects/${id}/tasks/${taskId}/comments`, { message: newCommentMessage.trim() });
      setNewCommentMessage('');
      setCommentsByTaskId((prev) => ({ ...prev, [taskId]: [...(prev[taskId] || []), res.data] }));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao enviar comentário');
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
      setError(err.response?.data?.error || 'Erro ao registrar horas');
    }
  };

  const deleteTimeEntry = async (taskId: number, entryId: number) => {
    if (!id) return;
    try {
      await axios.delete(`/api/projects/${id}/tasks/${taskId}/time-entries/${entryId}`);
      setTimeEntriesByTaskId((prev) => ({ ...prev, [taskId]: (prev[taskId] || []).filter((e) => e.id !== entryId) }));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao excluir registro');
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
      setError(err.response?.data?.error || 'Erro ao transferir ficheiro');
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
      setError(err.response?.data?.error || 'Erro ao anexar ficheiro');
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
      setError(err.response?.data?.error || 'Erro ao excluir anexo');
    }
  };

  const addDependency = async (taskId: number, dependsOnTaskId: number) => {
    if (!id) return;
    try {
      await axios.post(`/api/projects/${id}/tasks/${taskId}/dependencies`, { depends_on_task_id: dependsOnTaskId });
      setDependenciesByTaskId((prev) => ({
        ...prev,
        [taskId]: {
          depends_on: [...(prev[taskId]?.depends_on || []), dependsOnTaskId],
          blocked_by: prev[taskId]?.blocked_by || [],
        },
      }));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao adicionar dependência');
    }
  };

  const removeDependency = async (taskId: number, dependsOnTaskId: number) => {
    if (!id) return;
    try {
      await axios.delete(`/api/projects/${id}/tasks/${taskId}/dependencies/${dependsOnTaskId}`);
      setDependenciesByTaskId((prev) => ({
        ...prev,
        [taskId]: {
          depends_on: (prev[taskId]?.depends_on || []).filter((id) => id !== dependsOnTaskId),
          blocked_by: prev[taskId]?.blocked_by || [],
        },
      }));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao remover dependência');
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

  const getTasksByColumn = (columnId: number) =>
    filteredTasks.filter((t) => t.column_id === columnId).sort((a, b) => a.order_index - b.order_index);

  const sprintProgress = useMemo(() => {
    if (!project || filterSprintId == null || filterSprintId <= 0) return null;
    const tasksInSprint = (project.tasks || []).filter((t) => t.sprint_id === filterSprintId);
    if (tasksInSprint.length === 0) return { total: 0, done: 0, sprintName: project.sprints?.find((s) => s.id === filterSprintId)?.name };
    const lastColumnOrder = Math.max(...(project.columns || []).map((c) => c.order_index), 0);
    const lastColumn = project.columns?.find((c) => c.order_index === lastColumnOrder);
    const total = tasksInSprint.reduce((s, t) => s + (t.story_points ?? 0), 0);
    const done = lastColumn
      ? tasksInSprint.filter((t) => t.column_id === lastColumn.id).reduce((s, t) => s + (t.story_points ?? 0), 0)
      : 0;
    return {
      total,
      done,
      sprintName: project.sprints?.find((s) => s.id === filterSprintId)?.name || 'Sprint',
    };
  }, [project, filterSprintId]);

  const burndownData = useMemo(() => {
    if (!project || filterSprintId == null || filterSprintId <= 0 || !sprintProgress) return null;
    const sprint = project.sprints?.find((s) => s.id === filterSprintId);
    if (!sprint?.start_date || !sprint?.end_date) return null;
    const start = new Date(sprint.start_date);
    const end = new Date(sprint.end_date);
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
    return {
      sprintName: sprintProgress.sprintName,
      start,
      end,
      total,
      done,
      remaining,
      totalDays,
      todayRatio: Math.min(1, todayRatio),
      idealRemaining,
    };
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
    return (
      <div style={{ padding: 'var(--spacing-2xl)', color: 'var(--text-secondary)' }}>
        {loading ? 'Carregando...' : 'Projeto não encontrado.'}
      </div>
    );
  }

  return (
    <div className="projeto-detail">
      <header className="projeto-detail__header">
        <Link to="/projetos" className="projeto-detail__back">
          <ArrowLeft size={18} aria-hidden />
          Voltar aos projetos
        </Link>
        <div className="projeto-detail__title-row">
          <div>
            <h1 className="projeto-detail__title">{project.name}</h1>
            {project.description && (
              <p className="projeto-detail__description">{project.description}</p>
            )}
          </div>
          <div className="projeto-detail__toolbar">
            {(project.sprints?.length ?? 0) > 0 && (
              <select
                value={filterSprintId === null ? '' : filterSprintId === -1 ? 'none' : filterSprintId}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === '') setFilterSprintId(null);
                  else if (v === 'none') setFilterSprintId(-1);
                  else setFilterSprintId(Number(v));
                }}
                className="input projeto-toolbar__select"
              >
                <option value="">Todas as tarefas</option>
                <option value="none">Sem sprint</option>
                {project.sprints?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}
            <select
              value={filterTaskType}
              onChange={(e) => setFilterTaskType(e.target.value as ProjectTask['task_type'] | '')}
              className="input projeto-toolbar__select"
            >
              <option value="">Todos os tipos</option>
              <option value="feature">{TASK_TYPE_LABEL.feature}</option>
              <option value="bug">{TASK_TYPE_LABEL.bug}</option>
              <option value="tech_debt">{TASK_TYPE_LABEL.tech_debt}</option>
              <option value="chore">{TASK_TYPE_LABEL.chore}</option>
            </select>
            <div className="projeto-detail__view-toggle">
              <button
                type="button"
                className={viewMode === 'board' ? 'btn btn-primary' : 'btn btn-secondary'}
                style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}
                onClick={() => setViewMode('board')}
              >
                <LayoutGrid size={18} aria-hidden />
                Quadro
              </button>
              <button
                type="button"
                className={viewMode === 'backlog' ? 'btn btn-primary' : 'btn btn-secondary'}
                style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}
                onClick={() => setViewMode('backlog')}
              >
                <List size={18} aria-hidden />
                Backlog
              </button>
            </div>
            {canEdit && (
              <button
                type="button"
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}
                onClick={() => {
                  setSprintsModalOpen(true);
                  setSprintForm({ name: '', start_date: '', end_date: '' });
                  setEditingSprintId(null);
                }}
              >
                <ListTodo size={18} />
                Sprints
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="projeto-metrics">
      {sprintProgress && sprintProgress.total >= 0 && (
        <div className="projeto-metrics__card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-sm)' }}>
            <span className="projeto-metrics__card-title">
              Progresso da sprint: {sprintProgress.sprintName}
            </span>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              {sprintProgress.done} / {sprintProgress.total} pontos
            </span>
          </div>
          <div
            style={{
              height: '8px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--border-primary)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: sprintProgress.total === 0 ? '0%' : `${Math.min(100, (sprintProgress.done / sprintProgress.total) * 100)}%`,
                background: 'var(--purple)',
                borderRadius: 'var(--radius-sm)',
                transition: 'width 0.2s ease',
              }}
            />
          </div>
        </div>
      )}

      {burndownData && (
        <div className="projeto-metrics__card">
          <div className="projeto-metrics__card-title">
            Burndown: {burndownData.sprintName}
          </div>
          <div style={{ display: 'flex', gap: 'var(--spacing-md)', fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: 'var(--spacing-sm)' }}>
            <span>Ideal</span>
            <span>Atual: {burndownData.remaining} pts restantes</span>
          </div>
          <div style={{ width: '100%', maxWidth: '480px', height: '160px', position: 'relative' }}>
            <svg width="100%" height="160" viewBox="0 0 400 160" preserveAspectRatio="none" style={{ overflow: 'visible' }}>
              <defs>
                <line id="grid-y" x1="0" y1="0" x2="0" y2="120" stroke="var(--border-primary)" strokeWidth="0.5" strokeDasharray="4,2" />
              </defs>
              {/* Y axis label */}
              <text x="8" y="14" fontSize="10" fill="var(--text-tertiary)">pts</text>
              {/* Ideal line: from (0,0) in plot to (1,1) in data = (40, 120) to (360, 0) with y inverted */}
              {burndownData.total > 0 && (
                <>
                  <line
                    x1="40"
                    y1="120"
                    x2="360"
                    y2="0"
                    stroke="var(--text-tertiary)"
                    strokeWidth="1.5"
                    strokeDasharray="6,4"
                    opacity={0.8}
                  />
                  {/* Current point: x = 40 + todayRatio * 320, y = remaining/total * 120 (inverted so 0 at top) */}
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
              {/* X axis: start and end dates */}
              <text x="40" y="140" fontSize="9" fill="var(--text-tertiary)" textAnchor="start">
                {burndownData.start.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
              </text>
              <text x="360" y="140" fontSize="9" fill="var(--text-tertiary)" textAnchor="end">
                {burndownData.end.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
              </text>
            </svg>
          </div>
        </div>
      )}

      {leadTimeCycleTimeMetrics && (
        <div className="projeto-metrics__card">
          <div className="projeto-metrics__card-title">
            Lead Time & Cycle Time: {leadTimeCycleTimeMetrics.sprintName}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-lg)', fontSize: '0.9375rem' }}>
            <div>
              <span style={{ color: 'var(--text-tertiary)' }}>Tarefas concluídas: </span>
              <span style={{ color: 'var(--text-primary)' }}>{leadTimeCycleTimeMetrics.count}</span>
            </div>
            {leadTimeCycleTimeMetrics.avgLeadTimeDays != null && (
              <div>
                <span style={{ color: 'var(--text-tertiary)' }}>Lead time médio: </span>
                <span style={{ color: 'var(--purple)' }}>{leadTimeCycleTimeMetrics.avgLeadTimeDays.toFixed(1)} dias</span>
              </div>
            )}
            {leadTimeCycleTimeMetrics.avgCycleTimeDays != null && (
              <div>
                <span style={{ color: 'var(--text-tertiary)' }}>Cycle time médio: </span>
                <span style={{ color: 'var(--green)' }}>{leadTimeCycleTimeMetrics.avgCycleTimeDays.toFixed(1)} dias</span>
              </div>
            )}
            {leadTimeCycleTimeMetrics.count === 0 && (
              <span style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>Mova tarefas para a última coluna para preencher as métricas.</span>
            )}
          </div>
        </div>
      )}

      {flowByColumn && flowByColumn.length > 0 && (
        <div className="projeto-metrics__card">
          <div className="projeto-metrics__card-title">
            Fluxo por coluna
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
            {flowByColumn.map((col) => (
              <div key={col.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                <span style={{ width: '100px', fontSize: '0.8125rem', color: 'var(--text-secondary)', flexShrink: 0 }}>{col.name}</span>
                <div style={{ flex: 1, minWidth: 0, height: '20px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${col.widthPct}%`,
                      height: '100%',
                      background: 'var(--purple)',
                      borderRadius: 'var(--radius-sm)',
                      transition: 'width 0.2s ease',
                    }}
                  />
                </div>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', flexShrink: 0 }}>
                  {col.count} {col.count === 1 ? 'tarefa' : 'tarefas'}
                  {col.points > 0 && ` · ${col.points} pts`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {bugRateMetrics && (bugRateMetrics.total > 0) && (
        <div className="projeto-metrics__card">
          <div className="projeto-metrics__card-title">
            Bug rate (funcionalidades vs bugs)
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-lg)', alignItems: 'center', fontSize: '0.9375rem' }}>
            <span style={{ color: 'var(--blue)' }}>{bugRateMetrics.features} funcionalidades</span>
            <span style={{ color: 'var(--red)' }}>{bugRateMetrics.bugs} bugs</span>
            <span style={{ color: 'var(--text-tertiary)' }}>
              Taxa: <strong style={{ color: bugRateMetrics.ratePct > 30 ? 'var(--red)' : 'var(--text-primary)' }}>{bugRateMetrics.ratePct.toFixed(0)}%</strong> bugs
            </span>
          </div>
        </div>
      )}
      </div>

      {error && (
        <div
          style={{
            marginBottom: 'var(--spacing-lg)',
            padding: 'var(--spacing-md)',
            background: 'var(--red-light)',
            border: '1px solid var(--red)',
            color: 'var(--red)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          {error}
        </div>
      )}

      {viewMode === 'backlog' ? (
        <div className="projeto-backlog">
          <h3 className="projeto-backlog__title">Backlog</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
            {(project.columns || []).sort((a, b) => a.order_index - b.order_index).map((col) => {
              const tasks = getTasksByColumn(col.id);
              return (
                <div key={col.id} className="projeto-backlog__group">
                  <div className="projeto-backlog__group-name">
                    {col.name}
                  </div>
                  <div
                    style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (!backlogDragTaskId || !canEdit) return;
                      const task = project.tasks.find((t) => t.id === backlogDragTaskId);
                      if (!task) return;
                      const targetTasks = getTasksByColumn(col.id);
                      handleBacklogDrop(col.id, targetTasks.length);
                      setBacklogDragTaskId(null);
                    }}
                  >
                    {tasks.length === 0 && (
                      <div
                        className="projeto-backlog__drop-zone"
                        style={{
                          padding: 'var(--spacing-md)',
                          border: '1px dashed var(--border-primary)',
                          borderRadius: 'var(--radius-md)',
                          color: 'var(--text-tertiary)',
                          fontSize: '0.875rem',
                        }}
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
                    {tasks.map((task, idx) => (
                      <div
                        key={task.id}
                        className={`projeto-backlog__row ${backlogDragTaskId === task.id ? 'projeto-backlog__row--dragging' : ''} ${!canEdit ? 'projeto-backlog__row--readonly' : ''}`}
                        draggable={canEdit}
                        onDragStart={() => canEdit && setBacklogDragTaskId(task.id)}
                        onDragEnd={() => setBacklogDragTaskId(null)}
                      >
                        {canEdit && <GripVertical size={18} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />}
                        <div
                          style={{ flex: 1, minWidth: 0 }}
                          onClick={() => setSelectedTaskId(task.id)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => e.key === 'Enter' && setSelectedTaskId(task.id)}
                        >
                          <span style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{task.title}</span>
                          <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginTop: 'var(--spacing-xs)', flexWrap: 'wrap' }}>
                            {task.sprint_name && (
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{task.sprint_name}</span>
                            )}
                            {task.story_points != null && (
                              <span style={{ fontSize: '0.75rem', color: 'var(--purple)' }}>{task.story_points} pts</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
      <div className="projeto-board">
        {(project.columns || []).sort((a, b) => a.order_index - b.order_index).map((col) => (
          <div
            key={col.id}
            className={`projeto-board__column ${dragOverColumnId === col.id ? 'projeto-board__column--drag-over' : ''}`}
            onDragOver={(e) => canEdit && handleDragOver(e, col.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => canEdit && handleDrop(e, col.id)}
          >
            <div className="projeto-board__column-header">
              <span style={{ flex: 1, minWidth: 0 }}>{col.name}</span>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', fontWeight: '500' }}>
                {getTasksByColumn(col.id).length}
              </span>
              {canEdit && (
                <div style={{ position: 'relative' }}>
                  <button
                    type="button"
                    onClick={() => setColumnMenuId(columnMenuId === col.id ? null : col.id)}
                    style={{
                      padding: '4px',
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--text-tertiary)',
                      cursor: 'pointer',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    <Settings size={16} />
                  </button>
                  {columnMenuId === col.id && (
                    <div
                      className="card"
                      style={{
                        position: 'absolute',
                        right: 0,
                        top: '100%',
                        marginTop: '2px',
                        padding: '4px',
                        minWidth: '140px',
                        zIndex: 25,
                        border: '1px solid var(--border-primary)',
                      }}
                    >
                      <button
                        type="button"
                        style={{
                          width: '100%',
                          padding: '6px 8px',
                          border: 'none',
                          background: 'transparent',
                          color: 'var(--text-primary)',
                          cursor: 'pointer',
                          fontSize: '0.8125rem',
                          textAlign: 'left',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                        onClick={() => openEditColumn(col)}
                      >
                        <Edit2 size={14} />
                        Editar nome
                      </button>
                      {project.columns.length > 1 && canDelete && (
                        <button
                          type="button"
                          style={{
                            width: '100%',
                            padding: '6px 8px',
                            border: 'none',
                            background: 'transparent',
                            color: 'var(--red)',
                            cursor: 'pointer',
                            fontSize: '0.8125rem',
                            textAlign: 'left',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                          onClick={() => {
                            setDeleteColumnId(col.id);
                            setColumnMenuId(null);
                          }}
                        >
                          <Trash2 size={14} />
                          Excluir coluna
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="projeto-board__column-body">
              {getTasksByColumn(col.id).map((task) => (
                <div
                  key={task.id}
                  className={`projeto-task-card ${dragTaskId === task.id ? 'projeto-task-card--dragging' : ''}`}
                  draggable={canEdit}
                  onDragStart={(e) => handleDragStart(e, task.id)}
                  onDragEnd={handleDragEnd}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('button')) return;
                    openTaskDrawer(task);
                  }}
style={{
                    position: 'relative',
                    cursor: dragTaskId === task.id ? 'grabbing' : (canEdit ? 'grab' : 'pointer'),
                    borderLeftColor: PRIORITY_COLOR[task.priority] || 'transparent',
                  }}
                >
                  <div style={{ position: 'absolute', top: 'var(--spacing-xs)', right: 'var(--spacing-xs)' }}>
                    {canEdit && (
                      <button
                        ref={taskMenuId === task.id ? taskMenuButtonRef : null}
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setTaskMenuId(taskMenuId === task.id ? null : task.id); }}
                        className="projeto-drawer__close"
                        style={{ padding: '4px' }}
                      >
                        <MoreHorizontal size={16} aria-hidden />
                      </button>
                    )}
                  </div>
                  <div className="projeto-task-card__priority" style={{ color: PRIORITY_COLOR[task.priority] || 'var(--text-tertiary)' }}>
                    {PRIORITY_LABEL[task.priority] || task.priority}
                  </div>
                  <div className="projeto-task-card__title">{task.title}</div>
                  {(task.assigned_to_name || task.sprint_name || task.story_points != null || (task.task_type && task.task_type !== 'feature')) && (
                    <div className="projeto-task-card__meta">
                      {task.task_type && task.task_type !== 'feature' && (
                        <span style={{ color: TASK_TYPE_COLOR[task.task_type] }}>{TASK_TYPE_LABEL[task.task_type]}</span>
                      )}
                      {task.assigned_to_name && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <User size={12} aria-hidden />
                          {task.assigned_to_name}
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
              <div className="projeto-board__add-task">
                <button type="button" onClick={() => openAddTask(col.id)}>
                  <Plus size={18} aria-hidden />
                  Adicionar tarefa
                </button>
              </div>
            )}
          </div>
        ))}
        {canEdit && (
          <div className="projeto-board__new-column-wrap">
            <button type="button" className="projeto-board__new-column" onClick={() => setAddColumnModal(true)}>
              <Plus size={22} aria-hidden />
              Nova coluna
            </button>
          </div>
        )}
      </div>
      )}

      {selectedTaskId && project && (() => {
        const task = project.tasks.find((t) => t.id === selectedTaskId);
        if (!task) return null;
        const col = project.columns.find((c) => c.id === task.column_id);
        const formatDate = (s: string | null | undefined) => {
          if (!s) return '—';
          const d = new Date(s);
          return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
        };
        return (
          <>
            <div
              className="projeto-drawer-backdrop"
              onClick={() => setSelectedTaskId(null)}
              aria-hidden="true"
            />
            <div className="projeto-drawer" onClick={(e) => e.stopPropagation()}>
              <div className="projeto-drawer__accent" />
              <div className="projeto-drawer__header">
                <h2 className="projeto-drawer__title">{task.title}</h2>
                <button type="button" className="projeto-drawer__close" onClick={() => setSelectedTaskId(null)} aria-label="Fechar">
                  <X size={22} aria-hidden />
                </button>
              </div>
              <div className="projeto-drawer__body">
                <div className="projeto-drawer__field">
                  <div className="projeto-drawer__field-label">Prioridade</div>
                  <div className="projeto-drawer__field-value" style={{ color: PRIORITY_COLOR[task.priority] }}>{PRIORITY_LABEL[task.priority]}</div>
                </div>
                <div className="projeto-drawer__field">
                  <div className="projeto-drawer__field-label">Tipo</div>
                  <div className="projeto-drawer__field-value" style={{ color: TASK_TYPE_COLOR[task.task_type || 'feature'] }}>{TASK_TYPE_LABEL[task.task_type || 'feature']}</div>
                </div>
                {col && (
                  <div className="projeto-drawer__field">
                    <div className="projeto-drawer__field-label">Coluna</div>
                    <div className="projeto-drawer__field-value">{col.name}</div>
                  </div>
                )}
                {task.description && (
                  <div className="projeto-drawer__field">
                    <div className="projeto-drawer__field-label">Descrição</div>
                    <div className="markdown-body projeto-drawer__field-value" style={{ margin: 0, color: 'var(--text-secondary)' }}>
                      <ReactMarkdown>{task.description}</ReactMarkdown>
                    </div>
                  </div>
                )}
                {task.assigned_to_name && (
                  <div className="projeto-drawer__field">
                    <div className="projeto-drawer__meta-row">
                      <User size={16} aria-hidden />
                      <span>{task.assigned_to_name}</span>
                    </div>
                  </div>
                )}
                {task.sprint_name && (
                  <div className="projeto-drawer__field">
                    <div className="projeto-drawer__meta-row">
                      <ListTodo size={16} aria-hidden />
                      <span>{task.sprint_name}</span>
                    </div>
                  </div>
                )}
                {task.story_points != null && (
                  <div className="projeto-drawer__field">
                    <div className="projeto-drawer__meta-row">
                      <Target size={16} aria-hidden />
                      <span>{task.story_points} pontos</span>
                    </div>
                  </div>
                )}
                {task.due_date && (
                  <div className="projeto-drawer__field">
                    <div className="projeto-drawer__meta-row">
                      <Calendar size={16} aria-hidden />
                      <span>Vencimento: {formatDate(task.due_date)}</span>
                    </div>
                  </div>
                )}
                <div className="projeto-drawer__dates">
                  Criado em {formatDate(task.created_at)} · Atualizado em {formatDate(task.updated_at)}
                </div>

                <div className="projeto-drawer__section">
                  <div className="projeto-drawer__section-title">
                    <ListTodo size={16} aria-hidden />
                    Subtarefas
                  </div>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {(subtasksByTaskId[task.id] || []).map((s) => (
                      <li key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-xs)' }}>
                        <button type="button" onClick={() => toggleSubtask(task.id, s.id, s.completed)} style={{ padding: 0, border: 'none', background: 'transparent', color: s.completed ? 'var(--green)' : 'var(--text-tertiary)', cursor: 'pointer' }}>
                          {s.completed ? <CheckSquare size={18} /> : <Square size={18} />}
                        </button>
                        <span style={{ flex: 1, textDecoration: s.completed ? 'line-through' : 'none', color: s.completed ? 'var(--text-tertiary)' : 'var(--text-primary)', fontSize: '0.875rem' }}>{s.title}</span>
                        {canDelete && (
                          <button type="button" onClick={() => deleteSubtask(task.id, s.id)} style={{ padding: '2px', border: 'none', background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer' }}>
                            <Trash2 size={14} />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                  {canCreate && (
                    <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginTop: 'var(--spacing-sm)' }}>
                      <input
                        type="text"
                        value={selectedTaskId === task.id ? newSubtaskTitle : ''}
                        onChange={(e) => setNewSubtaskTitle(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSubtask(task.id); } }}
                        placeholder="Nova subtarefa..."
                        className="input"
                        style={{ flex: 1, padding: 'var(--spacing-sm)' }}
                      />
                      <button type="button" className="btn btn-secondary" style={{ padding: 'var(--spacing-sm)' }} onClick={() => addSubtask(task.id)} disabled={!newSubtaskTitle.trim()}>
                        <Plus size={16} />
                      </button>
                    </div>
                  )}
                </div>

                <div className="projeto-drawer__section">
                  <div className="projeto-drawer__section-title">
                    <ClipboardCheck size={16} aria-hidden />
                    Definição de Pronto (DoD)
                  </div>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {(dodByTaskId[task.id] || []).map((d) => (
                      <li key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-xs)' }}>
                        <button type="button" onClick={() => toggleDod(task.id, d.id, d.checked)} style={{ padding: 0, border: 'none', background: 'transparent', color: d.checked ? 'var(--green)' : 'var(--text-tertiary)', cursor: 'pointer' }}>
                          {d.checked ? <CheckSquare size={18} /> : <Square size={18} />}
                        </button>
                        <span style={{ flex: 1, textDecoration: d.checked ? 'line-through' : 'none', color: d.checked ? 'var(--text-tertiary)' : 'var(--text-primary)', fontSize: '0.875rem' }}>{d.label}</span>
                        {canDelete && (
                          <button type="button" onClick={() => deleteDod(task.id, d.id)} style={{ padding: '2px', border: 'none', background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer' }}>
                            <Trash2 size={14} />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                  {canCreate && (
                    <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginTop: 'var(--spacing-sm)' }}>
                      <input
                        type="text"
                        value={selectedTaskId === task.id ? newDodLabel : ''}
                        onChange={(e) => setNewDodLabel(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addDod(task.id); } }}
                        placeholder="Novo item DoD..."
                        className="input"
                        style={{ flex: 1, padding: 'var(--spacing-sm)' }}
                      />
                      <button type="button" className="btn btn-secondary" style={{ padding: 'var(--spacing-sm)' }} onClick={() => addDod(task.id)} disabled={!newDodLabel.trim()}>
                        <Plus size={16} />
                      </button>
                    </div>
                  )}
                </div>

                <div className="projeto-drawer__section">
                  <div className="projeto-drawer__section-title">
                    <MessageSquare size={16} aria-hidden />
                    Comentários
                  </div>
                  <div style={{ maxHeight: '160px', overflowY: 'auto', marginBottom: 'var(--spacing-sm)' }}>
                    {(commentsByTaskId[task.id] || []).map((c) => (
                      <div key={c.id} style={{ marginBottom: 'var(--spacing-sm)', padding: 'var(--spacing-sm)', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: '2px' }}>{c.user_name} · {formatDate(c.created_at)}</div>
                        <div className="markdown-body" style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                          <CommentBody message={c.message} />
                        </div>
                      </div>
                    ))}
                  </div>
                  {canCreate && (
                    <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                      <textarea
                        value={selectedTaskId === task.id ? newCommentMessage : ''}
                        onChange={(e) => setNewCommentMessage(e.target.value)}
                        placeholder="Escrever comentário... (use @Nome para mencionar)"
                        className="input"
                        rows={2}
                        style={{ flex: 1, resize: 'vertical', minHeight: '44px' }}
                      />
                      <button type="button" className="btn btn-secondary" style={{ alignSelf: 'flex-end', padding: 'var(--spacing-sm)' }} onClick={() => addComment(task.id)} disabled={!newCommentMessage.trim()}>
                        Enviar
                      </button>
                    </div>
                  )}
                </div>

                <div className="projeto-drawer__section">
                  <div className="projeto-drawer__section-title">
                    <Clock size={16} aria-hidden />
                    Tempo registrado
                    {(timeEntriesByTaskId[task.id] || []).length > 0 && (
                      <span style={{ fontWeight: '500', color: 'var(--text-tertiary)' }}>
                        ({(timeEntriesByTaskId[task.id] || []).reduce((sum, e) => sum + e.hours, 0).toFixed(1)} h)
                      </span>
                    )}
                  </div>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, marginBottom: 'var(--spacing-sm)' }}>
                    {(timeEntriesByTaskId[task.id] || []).map((e) => (
                      <li key={e.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--spacing-xs) 0', borderBottom: '1px solid var(--border-primary)', fontSize: '0.875rem' }}>
                        <span><strong>{e.hours}</strong> h · {formatDate(e.entry_date)} · {e.user_name}{e.note ? ` · ${e.note}` : ''}</span>
                        {canDelete && (
                          <button type="button" onClick={() => deleteTimeEntry(task.id, e.id)} style={{ padding: '2px', border: 'none', background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer' }}>
                            <Trash2 size={14} />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                  {canCreate && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-sm)', alignItems: 'flex-end' }}>
                      <input
                        type="number"
                        min="0.25"
                        step="0.25"
                        placeholder="Horas"
                        value={selectedTaskId === task.id ? timeEntryForm.hours : ''}
                        onChange={(e) => setTimeEntryForm((f) => ({ ...f, hours: e.target.value }))}
                        className="input"
                        style={{ width: '70px' }}
                      />
                      <input
                        type="date"
                        value={timeEntryForm.entry_date}
                        onChange={(e) => setTimeEntryForm((f) => ({ ...f, entry_date: e.target.value }))}
                        className="input"
                        style={{ width: '130px' }}
                      />
                      <input
                        type="text"
                        placeholder="Nota (opcional)"
                        value={selectedTaskId === task.id ? timeEntryForm.note : ''}
                        onChange={(e) => setTimeEntryForm((f) => ({ ...f, note: e.target.value }))}
                        className="input"
                        style={{ flex: 1, minWidth: '100px' }}
                      />
                      <button type="button" className="btn btn-secondary" onClick={() => addTimeEntry(task.id)} disabled={!timeEntryForm.hours || !timeEntryForm.entry_date || parseFloat(timeEntryForm.hours.replace(',', '.')) <= 0}>
                        Adicionar
                      </button>
                    </div>
                  )}
                </div>

                <div className="projeto-drawer__section">
                  <div className="projeto-drawer__section-title">
                    <Paperclip size={16} aria-hidden />
                    Anexos
                  </div>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, marginBottom: 'var(--spacing-sm)' }}>
                    {(attachmentsByTaskId[task.id] || []).map((a) => (
                      <li key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--spacing-xs) 0', borderBottom: '1px solid var(--border-primary)', fontSize: '0.875rem', gap: 'var(--spacing-sm)' }}>
                        <button
                          type="button"
                          onClick={() => downloadAttachment(task.id, a.id, a.file_name)}
                          style={{ flex: 1, minWidth: 0, textAlign: 'left', padding: 0, border: 'none', background: 'transparent', color: 'var(--purple)', cursor: 'pointer', textDecoration: 'none' }}
                        >
                          {a.file_name}
                          {a.file_size != null && (
                            <span style={{ color: 'var(--text-tertiary)', fontWeight: '400', marginLeft: 'var(--spacing-xs)' }}>
                              ({(a.file_size / 1024).toFixed(1)} KB)
                            </span>
                          )}
                        </button>
                        {canDelete && (
                          <button type="button" onClick={() => deleteAttachment(task.id, a.id)} style={{ padding: '2px', border: 'none', background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer', flexShrink: 0 }}>
                            <Trash2 size={14} />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                  {canEdit && (
                    <div style={{ marginTop: 'var(--spacing-sm)' }}>
                      <input
                        type="file"
                        id={`task-attachment-${task.id}`}
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) uploadAttachment(task.id, f);
                          e.target.value = '';
                        }}
                        disabled={uploadingAttachment}
                      />
                      <label htmlFor={`task-attachment-${task.id}`}>
                        <span className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--spacing-xs)', cursor: uploadingAttachment ? 'not-allowed' : 'pointer' }}>
                          <Plus size={16} />
                          {uploadingAttachment ? 'A enviar...' : 'Anexar ficheiro'}
                        </span>
                      </label>
                    </div>
                  )}
                </div>

                <div className="projeto-drawer__section">
                  <div className="projeto-drawer__section-title">
                    <Link2 size={16} aria-hidden />
                    Dependências
                  </div>
                  {(() => {
                    const deps = dependenciesByTaskId[task.id] || { depends_on: [], blocked_by: [] };
                    const otherTasks = (project?.tasks || []).filter((t) => t.id !== task.id);
                    const canAdd = otherTasks.filter((t) => !deps.depends_on.includes(t.id));
                    return (
                      <>
                        {deps.depends_on.length > 0 && (
                          <div style={{ marginBottom: 'var(--spacing-sm)' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: '4px' }}>Depende de</div>
                            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                              {deps.depends_on.map((tid) => {
                                const t = project?.tasks.find((x) => x.id === tid);
                                return t ? (
                                  <li key={tid} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--spacing-xs) 0', fontSize: '0.875rem', borderBottom: '1px solid var(--border-primary)' }}>
                                    <button type="button" onClick={() => setSelectedTaskId(tid)} style={{ flex: 1, minWidth: 0, textAlign: 'left', padding: 0, border: 'none', background: 'transparent', color: 'var(--purple)', cursor: 'pointer' }}>
                                      {t.title}
                                    </button>
                                    {canEdit && (
                                      <button type="button" onClick={() => removeDependency(task.id, tid)} style={{ padding: '2px', border: 'none', background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer' }}>
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
                          <div style={{ marginBottom: 'var(--spacing-sm)' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: '4px' }}>Bloqueia</div>
                            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                              {deps.blocked_by.map((tid) => {
                                const t = project?.tasks.find((x) => x.id === tid);
                                return t ? (
                                  <li key={tid} style={{ padding: 'var(--spacing-xs) 0', fontSize: '0.875rem', borderBottom: '1px solid var(--border-primary)' }}>
                                    <button type="button" onClick={() => setSelectedTaskId(tid)} style={{ padding: 0, border: 'none', background: 'transparent', color: 'var(--purple)', cursor: 'pointer', textAlign: 'left' }}>
                                      {t.title}
                                    </button>
                                  </li>
                                ) : null;
                              })}
                            </ul>
                          </div>
                        )}
                        {canEdit && canAdd.length > 0 && (
                          <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center', flexWrap: 'wrap' }}>
                            <select
                              id={`dep-${task.id}`}
                              className="input"
                              style={{ flex: 1, minWidth: '120px', fontSize: '0.875rem' }}
                              onChange={(e) => {
                                const v = e.target.value;
                                if (v) { addDependency(task.id, Number(v)); e.target.value = ''; }
                              }}
                              value=""
                            >
                              <option value="">Adicionar dependência...</option>
                              {canAdd.map((t) => (
                                <option key={t.id} value={t.id}>{t.title}</option>
                              ))}
                            </select>
                          </div>
                        )}
                        {deps.depends_on.length === 0 && deps.blocked_by.length === 0 && !canEdit && (
                          <span style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>Nenhuma dependência.</span>
                        )}
                      </>
                    );
                  })()}
                </div>

                {canEdit && (
                  <button
                    type="button"
                    className="btn"
                    style={{ marginTop: 'var(--spacing-lg)', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--spacing-sm)' }}
                    onClick={() => openEditTask(task)}
                  >
                    <Edit2 size={18} />
                    Editar tarefa
                  </button>
                )}
              </div>
            </div>
          </>
        );
      })()}

      {taskMenuId && taskMenuPosition && project && (() => {
        const task = project.tasks.find((t) => t.id === taskMenuId);
        if (!task) return null;
        return createPortal(
          <>
            <div
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 9999,
              }}
              onClick={() => setTaskMenuId(null)}
              aria-hidden="true"
            />
            <div
              role="menu"
              className="card"
              style={{
                position: 'fixed',
                top: taskMenuPosition.top,
                left: taskMenuPosition.left,
                minWidth: '140px',
                padding: '4px',
                zIndex: 10000,
                border: '1px solid var(--border-primary)',
                boxShadow: 'var(--shadow-lg)',
              }}
            >
            {canEdit && (
              <button
                type="button"
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  fontSize: '0.8125rem',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
                onClick={() => openEditTask(task)}
              >
                <Edit2 size={14} />
                Editar
              </button>
            )}
            {project.columns
              .filter((c) => c.id !== task.column_id)
              .map((c) => (
                <button
                  key={c.id}
                  type="button"
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    fontSize: '0.8125rem',
                    textAlign: 'left',
                  }}
                  onClick={() => moveTask(task.id, c.id)}
                >
                  Mover para {c.name}
                </button>
              ))}
            {canDelete && (
              <button
                type="button"
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--red)',
                  cursor: 'pointer',
                  fontSize: '0.8125rem',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
                onClick={() => handleDeleteTask(task.id)}
              >
                <Trash2 size={14} />
                Excluir
              </button>
            )}
          </div>
          </>,
          document.body
        );
      })()}

      {taskModalColumnId !== null && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => !submitting && (setTaskModalColumnId(null), setEditingTaskId(null))}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '420px',
              padding: 'var(--spacing-xl)',
              border: '1px solid var(--border-primary)',
              borderRadius: 'var(--radius-lg)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-lg)' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                {editingTaskId ? 'Editar tarefa' : 'Nova tarefa'}
              </h2>
              <button
                type="button"
                onClick={() => !submitting && (setTaskModalColumnId(null), setEditingTaskId(null))}
                style={{ padding: '4px', border: 'none', background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer' }}
              >
                <X size={22} />
              </button>
            </div>
            <form onSubmit={handleSaveTask}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                Título *
              </label>
              <input
                type="text"
                value={taskForm.title}
                onChange={(e) => setTaskForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Título da tarefa"
                required
                className="input"
                style={{ width: '100%', marginBottom: 'var(--spacing-md)' }}
              />
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                Descrição
              </label>
              <textarea
                value={taskForm.description}
                onChange={(e) => setTaskForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Descrição (opcional)"
                className="input"
                rows={2}
                style={{ width: '100%', marginBottom: 'var(--spacing-md)', resize: 'vertical' }}
              />
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                Prioridade
              </label>
              <select
                value={taskForm.priority}
                onChange={(e) => setTaskForm((f) => ({ ...f, priority: e.target.value as ProjectTask['priority'] }))}
                className="input"
                style={{ width: '100%', marginBottom: 'var(--spacing-md)' }}
              >
                {(['low', 'medium', 'high', 'urgent'] as const).map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABEL[p]}
                  </option>
                ))}
              </select>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                Tipo
              </label>
              <select
                value={taskForm.task_type ?? 'feature'}
                onChange={(e) => setTaskForm((f) => ({ ...f, task_type: e.target.value as ProjectTask['task_type'] }))}
                className="input"
                style={{ width: '100%', marginBottom: 'var(--spacing-md)' }}
              >
                {(['feature', 'bug', 'tech_debt', 'chore'] as const).map((t) => (
                  <option key={t} value={t}>
                    {TASK_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                Responsável
              </label>
              <select
                value={taskForm.assigned_to ?? ''}
                onChange={(e) => setTaskForm((f) => ({ ...f, assigned_to: e.target.value ? Number(e.target.value) : null }))}
                className="input"
                style={{ width: '100%', marginBottom: 'var(--spacing-lg)' }}
              >
                <option value="">Ninguém</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
              {(project.sprints?.length ?? 0) > 0 && (
                <>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                    Sprint
                  </label>
                  <select
                    value={taskForm.sprint_id ?? ''}
                    onChange={(e) => setTaskForm((f) => ({ ...f, sprint_id: e.target.value ? Number(e.target.value) : null }))}
                    className="input"
                    style={{ width: '100%', marginBottom: 'var(--spacing-md)' }}
                  >
                    <option value="">Nenhuma</option>
                    {project.sprints?.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </>
              )}
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                Story points
              </label>
              <input
                type="number"
                min={0}
                value={taskForm.story_points ?? ''}
                onChange={(e) => setTaskForm((f) => ({ ...f, story_points: e.target.value === '' ? null : parseInt(e.target.value, 10) || null }))}
                placeholder="Ex: 3"
                className="input"
                style={{ width: '100%', marginBottom: 'var(--spacing-md)' }}
              />
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                Data de vencimento
              </label>
              <input
                type="date"
                value={taskForm.due_date ?? ''}
                onChange={(e) => setTaskForm((f) => ({ ...f, due_date: e.target.value || null }))}
                className="input"
                style={{ width: '100%', marginBottom: 'var(--spacing-lg)' }}
              />
              <div style={{ display: 'flex', gap: 'var(--spacing-md)', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => !submitting && setTaskModalColumnId(null)}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn" disabled={submitting || !taskForm.title.trim()}>
                  {submitting ? (editingTaskId ? 'Salvando...' : 'Criando...') : (editingTaskId ? 'Salvar' : 'Criar')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editColumnId !== null && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setEditColumnId(null)}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '360px',
              padding: 'var(--spacing-xl)',
              border: '1px solid var(--border-primary)',
              borderRadius: 'var(--radius-lg)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: '1.125rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: 'var(--spacing-md)' }}>
              Editar nome da coluna
            </h2>
            <input
              type="text"
              value={editColumnName}
              onChange={(e) => setEditColumnName(e.target.value)}
              placeholder="Nome da coluna"
              className="input"
              style={{ width: '100%', marginBottom: 'var(--spacing-lg)' }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: 'var(--spacing-md)', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setEditColumnId(null)}>
                Cancelar
              </button>
              <button type="button" className="btn" onClick={handleSaveColumnName} disabled={!editColumnName.trim()}>
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteColumnId !== null && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setDeleteColumnId(null)}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '360px',
              padding: 'var(--spacing-xl)',
              border: '1px solid var(--border-primary)',
              borderRadius: 'var(--radius-lg)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <p style={{ color: 'var(--text-primary)', marginBottom: 'var(--spacing-lg)' }}>
              Excluir esta coluna? As tarefas desta coluna serão excluídas.
            </p>
            <div style={{ display: 'flex', gap: 'var(--spacing-md)', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setDeleteColumnId(null)}>
                Cancelar
              </button>
              <button type="button" className="btn" style={{ background: 'var(--red)' }} onClick={handleDeleteColumn}>
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {addColumnModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => !submitting && setAddColumnModal(false)}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '360px',
              padding: 'var(--spacing-xl)',
              border: '1px solid var(--border-primary)',
              borderRadius: 'var(--radius-lg)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: '1.125rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: 'var(--spacing-md)' }}>
              Nova coluna
            </h2>
            <form onSubmit={handleAddColumn}>
              <input
                type="text"
                value={newColumnName}
                onChange={(e) => setNewColumnName(e.target.value)}
                placeholder="Ex: Em revisão"
                className="input"
                style={{ width: '100%', marginBottom: 'var(--spacing-lg)' }}
                autoFocus
              />
              <div style={{ display: 'flex', gap: 'var(--spacing-md)', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => !submitting && setAddColumnModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn" disabled={submitting || !newColumnName.trim()}>
                  {submitting ? 'Criando...' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {sprintsModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => !submitting && (setSprintsModalOpen(false), setEditingSprintId(null))}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '480px',
              maxHeight: '90vh',
              overflow: 'auto',
              padding: 'var(--spacing-xl)',
              border: '1px solid var(--border-primary)',
              borderRadius: 'var(--radius-lg)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-lg)' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>
                Sprints
              </h2>
              <button type="button" onClick={() => !submitting && (setSprintsModalOpen(false), setEditingSprintId(null))} style={{ padding: '4px', border: 'none', background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer' }}>
                <X size={22} />
              </button>
            </div>
            <form onSubmit={handleSaveSprint} style={{ marginBottom: 'var(--spacing-lg)' }}>
              <input
                type="text"
                value={sprintForm.name}
                onChange={(e) => setSprintForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Nome da sprint"
                className="input"
                style={{ width: '100%', marginBottom: 'var(--spacing-sm)' }}
                required
              />
              <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-sm)' }}>
                <input
                  type="date"
                  value={sprintForm.start_date}
                  onChange={(e) => setSprintForm((f) => ({ ...f, start_date: e.target.value }))}
                  className="input"
                  style={{ flex: 1 }}
                />
                <input
                  type="date"
                  value={sprintForm.end_date}
                  onChange={(e) => setSprintForm((f) => ({ ...f, end_date: e.target.value }))}
                  className="input"
                  style={{ flex: 1 }}
                />
              </div>
              <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
              <button type="submit" className="btn" disabled={submitting || !sprintForm.name.trim()}>
                {editingSprintId ? 'Salvar' : 'Criar sprint'}
              </button>
              {editingSprintId && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setEditingSprintId(null);
                    setSprintForm({ name: '', start_date: '', end_date: '' });
                  }}
                >
                  Cancelar
                </button>
              )}
            </div>
            </form>
            <div style={{ borderTop: '1px solid var(--border-primary)', paddingTop: 'var(--spacing-md)' }}>
              {(project.sprints?.length ?? 0) === 0 ? (
                <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>Nenhuma sprint criada.</p>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {project.sprints?.map((s) => (
                    <li
                      key={s.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: 'var(--spacing-sm) 0',
                        borderBottom: '1px solid var(--border-primary)',
                      }}
                    >
                      <div>
                        <span style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{s.name}</span>
                        {(s.start_date || s.end_date) && (
                          <span style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', marginLeft: 'var(--spacing-sm)' }}>
                            {s.start_date && new Date(s.start_date).toLocaleDateString('pt-BR')}
                            {s.start_date && s.end_date && ' – '}
                            {s.end_date && new Date(s.end_date).toLocaleDateString('pt-BR')}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
                        <button type="button" className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.8125rem' }} onClick={() => openEditSprint(s)}>
                          Editar
                        </button>
                        {canDelete && (
                          <button type="button" style={{ padding: '4px 8px', fontSize: '0.8125rem', background: 'var(--red-light)', color: 'var(--red)', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer' }} onClick={() => handleDeleteSprint(s.id)}>
                            Excluir
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
