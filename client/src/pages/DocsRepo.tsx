import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import {
  HardDrive,
  Folder,
  File,
  FileText,
  StickyNote,
  Search,
  X,
  ArrowLeft,
  Upload,
  Download,
  Trash2,
  Pencil,
  Share2,
  Users,
  Lock,
  FolderPlus,
  ChevronRight,
  Home,
  Eye,
  FileType,
  Image as ImageIcon,
} from 'lucide-react';
import type { DocRepository, DocEntry, DocSearchResult, DocRepositoryShare, DocVisibility } from './docs/docsData';
import { formatDate, formatFileSize, isPdfEntry, canPreviewInBrowser, getFilePreviewKind } from './docs/docsData';
import type { FilePreviewKind } from './docs/previewUtils';
import { HighlightedText, highlightTextInElement, goToMatchInRoot, countMarksInRoot } from './docs/searchHighlight';
import DocsUserAccessPicker, { type AccessMember, type UserOption } from './docs/DocsUserAccessPicker';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useConfirm } from '@/components/ui/confirm-dialog';

type BreadcrumbItem = { id: number | null; name: string };

function sharedToMembers(shared: DocRepositoryShare[]): AccessMember[] {
  return shared.map((s) => ({ user_id: s.user_id, name: s.user_name, email: s.user_email, permission: s.permission }));
}

const ENTRY_ICON_STYLE: Record<string, string> = {
  folder: 'text-[#f59e0b]',
  note: 'text-[var(--green)]',
  file: 'text-muted-foreground',
};

export default function DocsRepo() {
  const { repoId } = useParams<{ repoId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const confirm = useConfirm();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [repo, setRepo] = useState<DocRepository | null>(null);
  const [entries, setEntries] = useState<DocEntry[]>([]);
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbItem[]>([{ id: null, name: 'Raiz' }]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const [showFolderModal, setShowFolderModal] = useState(false);
  const [folderName, setFolderName] = useState('');

  const [showNoteModal, setShowNoteModal] = useState(false);
  const [viewingNote, setViewingNote] = useState<DocEntry | null>(null);
  const [noteHighlightQuery, setNoteHighlightQuery] = useState('');
  const [noteName, setNoteName] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [editingNote, setEditingNote] = useState<DocEntry | null>(null);

  const [showEditRepoModal, setShowEditRepoModal] = useState(false);
  const [editRepoName, setEditRepoName] = useState('');
  const [editRepoDesc, setEditRepoDesc] = useState('');
  const [editRepoVisibility, setEditRepoVisibility] = useState<DocVisibility>('private');

  const [showAccessModal, setShowAccessModal] = useState(false);
  const [accessMembers, setAccessMembers] = useState<AccessMember[]>([]);
  const [allUsers, setAllUsers] = useState<UserOption[]>([]);
  const [savingAccess, setSavingAccess] = useState(false);
  const [searchResults, setSearchResults] = useState<DocSearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [filePreview, setFilePreview] = useState<{
    entry: DocEntry;
    kind: FilePreviewKind;
    url?: string;
    textContent?: string;
    htmlContent?: string;
    highlightQuery?: string;
    extractedText?: string;
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const htmlPreviewRef = useRef<HTMLDivElement>(null);
  const previewBodyRef = useRef<HTMLDivElement>(null);
  const matchNavIndex = useRef(0);
  const [previewMatchCount, setPreviewMatchCount] = useState(0);

  useEffect(() => {
    if (!filePreview?.htmlContent || !filePreview.highlightQuery || !htmlPreviewRef.current) return;
    const t = setTimeout(() => {
      const root = htmlPreviewRef.current!;
      highlightTextInElement(root, filePreview.highlightQuery!);
      matchNavIndex.current = 0;
      const first = root.querySelector('mark.docs-search-highlight');
      first?.classList.add('docs-search-highlight--active');
      first?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      setPreviewMatchCount(countMarksInRoot(previewBodyRef.current));
    }, 80);
    return () => clearTimeout(t);
  }, [filePreview?.htmlContent, filePreview?.highlightQuery]);

  useEffect(() => {
    if (!filePreview?.highlightQuery) {
      setPreviewMatchCount(0);
      return;
    }
    const t = setTimeout(() => {
      setPreviewMatchCount(countMarksInRoot(previewBodyRef.current));
    }, 120);
    return () => clearTimeout(t);
  }, [filePreview?.textContent, filePreview?.extractedText, filePreview?.highlightQuery, previewLoading]);

  const goToPreviewMatch = (delta: number) => {
    goToMatchInRoot(previewBodyRef.current, delta, matchNavIndex);
  };

  const currentFolderId = breadcrumb[breadcrumb.length - 1]?.id ?? null;
  const canEdit = repo?.access === 'owner' || repo?.access === 'edit';
  const isOwner = repo?.access === 'owner';

  const loadRepo = async () => {
    const res = await axios.get<DocRepository>(`/api/docs/repositories/${repoId}`);
    setRepo(res.data);
  };

  const loadEntries = async (parentId: number | null) => {
    const params = parentId != null ? { parent_id: parentId } : {};
    const res = await axios.get<DocEntry[]>(`/api/docs/repositories/${repoId}/entries`, { params });
    setEntries(res.data);
  };

  const refresh = async (parentId: number | null) => {
    await Promise.all([loadRepo(), loadEntries(parentId)]);
  };

  useEffect(() => {
    if (!repoId) return;
    setLoading(true);
    refresh(null)
      .catch(() => setRepo(null))
      .finally(() => setLoading(false));
  }, [repoId]);

  useEffect(() => {
    if (!repoId || loading) return;
    loadEntries(currentFolderId).catch(() => setEntries([]));
  }, [currentFolderId, repoId, loading]);

  const searchTerm = search.trim();
  const isSearchMode = searchTerm.length >= 2;

  useEffect(() => {
    if (!repoId || !isSearchMode) {
      setSearchResults(null);
      setSearching(false);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await axios.get<DocSearchResult[]>(`/api/docs/repositories/${repoId}/search`, { params: { q: searchTerm } });
        setSearchResults(res.data);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [repoId, searchTerm, isSearchMode]);

  const filteredEntries = entries.filter((e) => {
    if (isSearchMode) return false;
    const term = searchTerm.toLowerCase();
    if (!term) return true;
    return e.name.toLowerCase().includes(term) || (e.description ?? '').toLowerCase().includes(term) || e.tags.some((t) => t.toLowerCase().includes(term));
  });

  const displayEntries: (DocEntry | DocSearchResult)[] = isSearchMode ? (searchResults ?? []) : filteredEntries;

  const handleBack = () => navigate('/docs');

  const openFolder = (entry: DocEntry) => {
    setBreadcrumb((prev) => [...prev, { id: entry.id, name: entry.name }]);
    setSearch('');
  };

  const goToBreadcrumb = (index: number) => {
    setBreadcrumb((prev) => prev.slice(0, index + 1));
    setSearch('');
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length || !canEdit) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append('file', file);
        if (currentFolderId != null) form.append('parent_id', String(currentFolderId));
        await axios.post(`/api/docs/repositories/${repoId}/upload`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      }
      await refresh(currentFolderId);
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : 'Erro no upload';
      toast.error(msg || 'Erro ao enviar arquivo');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderName.trim()) return;
    try {
      await axios.post(`/api/docs/repositories/${repoId}/folders`, { name: folderName.trim(), parent_id: currentFolderId });
      setShowFolderModal(false);
      setFolderName('');
      await refresh(currentFolderId);
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : 'Erro';
      toast.error(msg || 'Erro ao criar pasta');
    }
  };

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteName.trim()) return;
    try {
      if (editingNote) {
        await axios.put(`/api/docs/entries/${editingNote.id}`, { name: noteName.trim(), content: noteContent });
      } else {
        await axios.post(`/api/docs/repositories/${repoId}/notes`, { name: noteName.trim(), content: noteContent, parent_id: currentFolderId });
      }
      closeNoteModal();
      await refresh(currentFolderId);
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : 'Erro';
      toast.error(msg || 'Erro ao salvar nota');
    }
  };

  const fetchPreviewBlob = async (entry: DocEntry) => {
    const res = await axios.get(`/api/docs/entries/${entry.id}/preview`, { responseType: 'blob' });
    return res.data instanceof Blob ? res.data : new Blob([res.data], { type: entry.mime_type || 'application/octet-stream' });
  };

  const fetchFileBlob = async (entry: DocEntry) => {
    const res = await axios.get(`/api/docs/entries/${entry.id}/download`, { responseType: 'blob' });
    return res.data instanceof Blob ? res.data : new Blob([res.data], { type: entry.mime_type || 'application/octet-stream' });
  };

  const handleDownload = async (entry: DocEntry) => {
    try {
      const blob = await fetchFileBlob(entry);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = entry.name;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Erro ao baixar arquivo');
    }
  };

  const closeFilePreview = useCallback(() => {
    setFilePreview((prev) => {
      if (prev?.url) window.URL.revokeObjectURL(prev.url);
      return null;
    });
    setPreviewLoading(false);
  }, []);

  const openFilePreview = async (entry: DocEntry, highlightQuery?: string) => {
    const kind = getFilePreviewKind(entry);
    if (kind === 'none') {
      handleDownload(entry);
      return;
    }

    const highlight = highlightQuery?.trim() || (isSearchMode ? searchTerm : undefined);

    setFilePreview((prev) => {
      if (prev?.url) window.URL.revokeObjectURL(prev.url);
      return { entry, kind, highlightQuery: highlight };
    });
    setPreviewLoading(true);

    try {
      let extractedText: string | undefined;
      if (highlight && (kind === 'pdf' || kind === 'html')) {
        try {
          const tr = await axios.get<{ text: string }>(`/api/docs/entries/${entry.id}/text-content`);
          extractedText = tr.data.text || '';
        } catch {
          extractedText = '';
        }
      }

      if (kind === 'html') {
        const res = await axios.get<{ html: string }>(`/api/docs/entries/${entry.id}/preview-html`);
        setFilePreview({ entry, kind, htmlContent: res.data.html, highlightQuery: highlight, extractedText });
      } else if (kind === 'text' && entry.entry_type === 'note') {
        setFilePreview({ entry, kind, textContent: entry.content || '', highlightQuery: highlight });
      } else if (kind === 'text') {
        const blob = await fetchPreviewBlob(entry);
        const text = await blob.text();
        setFilePreview({ entry, kind, textContent: text, highlightQuery: highlight });
      } else {
        const blob = await fetchPreviewBlob(entry);
        const mime = entry.mime_type || (kind === 'pdf' ? 'application/pdf' : blob.type || 'application/octet-stream');
        const typed = blob.type ? blob : new Blob([blob], { type: mime });
        const url = window.URL.createObjectURL(typed);
        setFilePreview({ entry, kind, url, highlightQuery: highlight, extractedText });
      }
    } catch {
      closeFilePreview();
      toast.error('Não foi possível abrir o arquivo no navegador.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleOpenFile = (entry: DocEntry) => {
    if (canPreviewInBrowser(entry)) openFilePreview(entry, isSearchMode ? searchTerm : undefined);
    else handleDownload(entry);
  };

  const openViewNote = (entry: DocEntry, highlight?: string) => {
    setViewingNote(entry);
    setNoteHighlightQuery(highlight?.trim() || (isSearchMode ? searchTerm : ''));
  };
  const closeViewNote = () => {
    setViewingNote(null);
    setNoteHighlightQuery('');
  };

  const closeNoteModal = () => {
    setShowNoteModal(false);
    setEditingNote(null);
    setNoteName('');
    setNoteContent('');
  };

  const openNewNoteModal = () => {
    setEditingNote(null);
    setNoteName('');
    setNoteContent('');
    setShowNoteModal(true);
  };

  const handleOpenEntry = (entry: DocEntry) => {
    if (entry.entry_type === 'folder') openFolder(entry);
    else if (entry.entry_type === 'note') openViewNote(entry, isSearchMode ? searchTerm : undefined);
    else if (entry.entry_type === 'file') handleOpenFile(entry);
  };

  const openEditNoteFromView = () => {
    if (!viewingNote) return;
    const entry = viewingNote;
    closeViewNote();
    openEditNote(entry);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (filePreview) closeFilePreview();
      else if (viewingNote) closeViewNote();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [filePreview, viewingNote, closeFilePreview]);

  const handleDeleteEntry = async (entry: DocEntry) => {
    const ok = await confirm({ title: 'Excluir item', description: `Excluir "${entry.name}"?`, confirmLabel: 'Excluir', variant: 'destructive' });
    if (!ok) return;
    try {
      await axios.delete(`/api/docs/entries/${entry.id}`);
      await refresh(currentFolderId);
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : 'Erro';
      toast.error(msg || 'Erro ao excluir');
    }
  };

  const handleDeleteRepo = async () => {
    if (!repo) return;
    const ok = await confirm({
      title: 'Excluir repositório',
      description: `Excluir "${repo.name}" e todo o conteúdo?`,
      confirmLabel: 'Excluir',
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      await axios.delete(`/api/docs/repositories/${repo.id}`);
      navigate('/docs');
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : 'Erro';
      toast.error(msg || 'Erro ao excluir repositório');
    }
  };

  const loadUsersForAccess = async () => {
    try {
      const res = await axios.get<UserOption[]>('/api/docs/share-users');
      setAllUsers(res.data);
    } catch {
      setAllUsers([]);
    }
  };

  const openAccessModal = async () => {
    setAccessMembers(sharedToMembers(repo?.shared_with ?? []));
    await loadUsersForAccess();
    setShowAccessModal(true);
  };

  const openEditRepoModal = async () => {
    if (!repo) return;
    setEditRepoName(repo.name);
    setEditRepoDesc(repo.description);
    setEditRepoVisibility(repo.visibility);
    setAccessMembers(sharedToMembers(repo.shared_with ?? []));
    if (isOwner) await loadUsersForAccess();
    setShowEditRepoModal(true);
  };

  const handleSaveEditRepo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repo) return;
    try {
      const payload: Record<string, unknown> = { name: editRepoName.trim(), description: editRepoDesc.trim(), visibility: editRepoVisibility };
      if (isOwner && editRepoVisibility === 'private') {
        payload.members = accessMembers.map((m) => ({ user_id: m.user_id, permission: m.permission }));
      } else if (isOwner && editRepoVisibility === 'team') {
        payload.members = [];
      }
      const res = await axios.put<DocRepository>(`/api/docs/repositories/${repo.id}`, payload);
      setRepo(res.data);
      setShowEditRepoModal(false);
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : 'Erro';
      toast.error(msg || 'Erro ao salvar');
    }
  };

  const handleSaveAccess = async () => {
    if (!repoId) return;
    setSavingAccess(true);
    try {
      const res = await axios.put<{ shared_with: DocRepositoryShare[] }>(`/api/docs/repositories/${repoId}/access`, {
        members: accessMembers.map((m) => ({ user_id: m.user_id, permission: m.permission })),
      });
      setRepo((prev) => (prev ? { ...prev, shared_with: res.data.shared_with } : prev));
      setShowAccessModal(false);
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : 'Erro';
      toast.error(msg || 'Erro ao salvar acessos');
    } finally {
      setSavingAccess(false);
    }
  };

  const openEditNote = (entry: DocEntry) => {
    setEditingNote(entry);
    setNoteName(entry.name);
    setNoteContent(entry.content || '');
    setShowNoteModal(true);
  };

  const entryIcon = (entry: DocEntry) => {
    if (entry.entry_type === 'folder') return Folder;
    if (entry.entry_type === 'note') return StickyNote;
    if (isPdfEntry(entry)) return FileType;
    if (entry.entry_type === 'file' && entry.mime_type?.startsWith('image/')) return ImageIcon;
    return File;
  };

  const openSearchResult = (item: DocSearchResult) => {
    if (item.entry_type === 'note') openViewNote(item, searchTerm);
    else if (item.entry_type === 'file') openFilePreview(item, searchTerm);
  };

  if (loading) {
    return (
      <div>
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (!repo) {
    return (
      <div>
        <Button variant="secondary" onClick={handleBack}>
          <ArrowLeft size={16} /> Voltar
        </Button>
        <p className="mt-4 text-sm text-muted-foreground">Repositório não encontrado ou sem acesso.</p>
      </div>
    );
  }

  return (
    <div>
      <Button variant="secondary" onClick={handleBack} className="mb-4">
        <ArrowLeft size={18} /> Voltar para Arquivos
      </Button>

      <nav className="mb-5 flex flex-wrap items-center gap-1.5 text-sm">
        <button type="button" onClick={handleBack} className="text-muted-foreground hover:text-foreground hover:underline">
          Arquivos
        </button>
        <ChevronRight size={14} className="text-muted-foreground/50" />
        <button type="button" onClick={() => goToBreadcrumb(0)} className="text-muted-foreground hover:text-foreground hover:underline">
          {repo.name}
        </button>
        {breadcrumb.slice(1).map((crumb, i) => (
          <span key={crumb.id ?? i} className="flex items-center gap-1.5">
            <ChevronRight size={14} className="text-muted-foreground/50" />
            {i === breadcrumb.length - 2 ? (
              <span className="font-semibold text-foreground">{crumb.name}</span>
            ) : (
              <button type="button" onClick={() => goToBreadcrumb(i + 1)} className="text-muted-foreground hover:text-foreground hover:underline">
                {crumb.name}
              </button>
            )}
          </span>
        ))}
      </nav>

      <header className="mb-6 flex flex-wrap items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--purple)] to-[var(--blue)] text-white">
          <HardDrive size={28} />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">{repo.name}</h1>
          <p className="mb-1.5 text-sm text-muted-foreground">{repo.description || 'Sem descrição'}</p>
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              {repo.visibility === 'team' ? <Users size={13} /> : <Lock size={13} />}
              {repo.visibility === 'team' ? 'Equipe' : 'Privado'}
            </span>
            <span className="flex items-center gap-1">
              <FileText size={13} />
              {repo.item_count} itens no total
            </span>
            <span>Por {repo.owner_name}</span>
            {repo.visibility === 'private' && isOwner && (
              <span className="flex items-center gap-1">
                <Users size={13} />
                {(repo.shared_with?.length ?? 0) === 0 ? 'Só você' : `${repo.shared_with!.length} usuário(s) com acesso`}
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          {isOwner && repo.visibility === 'private' && (
            <Button variant="secondary" onClick={openAccessModal}>
              <Share2 size={16} /> Gerenciar acesso
            </Button>
          )}
          {canEdit && (
            <Button variant="secondary" onClick={openEditRepoModal}>
              <Pencil size={16} /> Editar
            </Button>
          )}
          {isOwner && (
            <Button variant="destructive" onClick={handleDeleteRepo}>
              <Trash2 size={16} /> Excluir
            </Button>
          )}
        </div>
      </header>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="relative min-w-[300px] max-w-[560px] flex-1">
          <Search size={18} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar em todo o repositório (nome, notas, PDF, DOCX, TXT…)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setShowFolderModal(true)}>
              <FolderPlus size={18} /> Nova pasta
            </Button>
            <Button variant="secondary" onClick={openNewNoteModal}>
              <StickyNote size={18} /> Nova nota
            </Button>
            <Button disabled={uploading} onClick={() => fileInputRef.current?.click()}>
              <Upload size={18} /> {uploading ? 'Enviando...' : 'Enviar arquivo'}
            </Button>
            <input ref={fileInputRef} type="file" multiple hidden onChange={(e) => handleUpload(e.target.files)} />
          </div>
        )}
      </div>

      <Card className="gap-0 px-0 py-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3.5">
          <div className="flex items-center gap-2 font-semibold text-foreground">
            <Home size={18} />
            <span>{breadcrumb[breadcrumb.length - 1]?.name || 'Raiz'}</span>
          </div>
          <div className="text-sm text-muted-foreground">
            {isSearchMode
              ? searching
                ? 'Buscando...'
                : `${displayEntries.length} resultado${displayEntries.length === 1 ? '' : 's'} no repositório`
              : `${displayEntries.length} ${displayEntries.length === 1 ? 'item' : 'itens'} nesta pasta`}
            {!canEdit && ' · Somente leitura'}
          </div>
        </div>
        <div className="px-5 py-5">
          {displayEntries.length === 0 ? (
            <div className="flex flex-col items-center px-4 py-12 text-center">
              <Folder size={40} strokeWidth={1.5} className="mb-3 text-muted-foreground opacity-50" />
              <h3 className="mb-1.5 text-base font-bold text-foreground">{isSearchMode ? 'Nenhum resultado' : 'Pasta vazia'}</h3>
              <p className="max-w-[420px] text-sm text-muted-foreground">
                {isSearchMode
                  ? 'Tente outras palavras. A busca inclui PDF, DOCX, TXT e notas (mínimo 2 caracteres).'
                  : canEdit
                    ? 'Envie arquivos, crie pastas ou adicione notas de texto.'
                    : 'Não há arquivos nesta pasta.'}
              </p>
            </div>
          ) : isSearchMode ? (
            <ul className="flex flex-col gap-2" role="list">
              {(displayEntries as DocSearchResult[]).map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => openSearchResult(item)}
                    className="flex w-full flex-col gap-1 rounded-lg border border-border px-4 py-3 text-left transition-colors hover:border-[var(--purple)] hover:bg-muted/40"
                  >
                    <span className="font-semibold text-foreground">{item.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {(item.path?.length ? item.path.join(' / ') : 'Raiz') + ` · ${item.entry_type === 'note' ? 'Nota' : 'Arquivo'}`}
                    </span>
                    {item.snippet && (
                      <span className="text-sm text-muted-foreground">
                        <HighlightedText text={item.snippet} query={searchTerm} />
                      </span>
                    )}
                    {item.match_count != null && item.match_count > 0 && (
                      <Badge variant="outline" className="w-fit text-[0.65rem]">
                        {item.match_count} ocorrência{item.match_count === 1 ? '' : 's'}
                      </Badge>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {displayEntries.map((entry) => {
                const Icon = entryIcon(entry as DocEntry);
                return (
                  <div
                    key={entry.id}
                    onClick={() => handleOpenEntry(entry as DocEntry)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleOpenEntry(entry as DocEntry);
                    }}
                    className="group flex cursor-pointer flex-col items-center rounded-lg border border-border bg-muted/30 px-3 py-5 text-center transition-all hover:border-[var(--purple)] hover:shadow-md"
                  >
                    <Icon size={32} className={cn('mb-2', ENTRY_ICON_STYLE[entry.entry_type])} />
                    <div className="w-full truncate text-sm font-medium text-foreground" title={entry.name}>
                      {entry.name}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {entry.entry_type === 'file' && isPdfEntry(entry as DocEntry) && 'PDF · '}
                      {entry.entry_type === 'file' && formatFileSize((entry as DocEntry).size_bytes)}
                      {entry.entry_type === 'folder' && 'Pasta'}
                      {entry.entry_type === 'note' && 'Nota'}
                      {' · '}
                      {formatDate(entry.updated_at)}
                    </div>
                    <div className="mt-2.5 flex gap-1.5 opacity-0 transition-opacity group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
                      {entry.entry_type === 'file' && canPreviewInBrowser(entry as DocEntry) && (
                        <Button variant="secondary" size="icon-sm" title="Visualizar no navegador" onClick={() => openFilePreview(entry as DocEntry)}>
                          <Eye size={14} />
                        </Button>
                      )}
                      {entry.entry_type === 'file' && (
                        <Button variant="secondary" size="icon-sm" title="Download" onClick={() => handleDownload(entry as DocEntry)}>
                          <Download size={14} />
                        </Button>
                      )}
                      {entry.entry_type === 'note' && canEdit && (
                        <Button variant="secondary" size="icon-sm" title="Editar nota" onClick={() => openEditNote(entry as DocEntry)}>
                          <Pencil size={14} />
                        </Button>
                      )}
                      {canEdit && (
                        <Button
                          variant="secondary"
                          size="icon-sm"
                          title="Excluir"
                          onClick={() => handleDeleteEntry(entry as DocEntry)}
                          className="hover:bg-destructive/15 hover:text-destructive"
                        >
                          <Trash2 size={14} />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      {/* Visualizador de arquivo */}
      <Dialog open={!!filePreview} onOpenChange={(open) => !open && closeFilePreview()}>
        <DialogContent className="flex h-[90vh] max-h-[90vh] w-full max-w-6xl! flex-col gap-0 overflow-hidden p-0">
          {filePreview && (
            <>
              <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-3.5">
                <div className="flex min-w-0 items-center gap-2 font-semibold text-foreground">
                  <FileType size={20} className="shrink-0" />
                  <span className="truncate" title={filePreview.entry.name}>
                    {filePreview.entry.name}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {filePreview.highlightQuery && previewMatchCount > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">
                        {previewMatchCount} ocorrência{previewMatchCount === 1 ? '' : 's'}
                      </span>
                      <Button variant="secondary" size="icon-sm" onClick={() => goToPreviewMatch(-1)} title="Ocorrência anterior">
                        ↑
                      </Button>
                      <Button variant="secondary" size="icon-sm" onClick={() => goToPreviewMatch(1)} title="Próxima ocorrência">
                        ↓
                      </Button>
                    </div>
                  )}
                  {filePreview.entry.entry_type === 'file' && (
                    <Button variant="secondary" size="sm" onClick={() => handleDownload(filePreview.entry)}>
                      <Download size={16} /> Baixar
                    </Button>
                  )}
                </div>
              </header>
              <div
                ref={previewBodyRef}
                className={cn('flex-1 overflow-auto', filePreview.kind === 'pdf' && filePreview.highlightQuery && filePreview.extractedText != null && 'grid grid-cols-2')}
              >
                {previewLoading ? (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Carregando...</div>
                ) : filePreview.kind === 'pdf' && filePreview.url ? (
                  <>
                    <iframe src={filePreview.url} title={`Visualização: ${filePreview.entry.name}`} className="h-full w-full border-0" />
                    {filePreview.highlightQuery && filePreview.extractedText != null && (
                      <div className="overflow-auto border-l border-border p-4">
                        <p className="mb-2 text-xs font-medium text-muted-foreground">Texto do documento (termo pesquisado destacado)</p>
                        <HighlightedText text={filePreview.extractedText} query={filePreview.highlightQuery} className="text-sm whitespace-pre-wrap text-foreground" as="pre" />
                      </div>
                    )}
                  </>
                ) : filePreview.kind === 'image' && filePreview.url ? (
                  <div className="flex h-full items-center justify-center p-4">
                    <img src={filePreview.url} alt={filePreview.entry.name} className="max-h-full max-w-full object-contain" />
                  </div>
                ) : filePreview.kind === 'html' && filePreview.htmlContent ? (
                  <div ref={htmlPreviewRef} className="p-5" dangerouslySetInnerHTML={{ __html: filePreview.htmlContent }} />
                ) : filePreview.kind === 'text' && filePreview.textContent != null ? (
                  filePreview.highlightQuery ? (
                    <HighlightedText text={filePreview.textContent} query={filePreview.highlightQuery} className="p-5 text-sm whitespace-pre-wrap text-foreground" as="pre" />
                  ) : (
                    <pre className="p-5 text-sm whitespace-pre-wrap text-foreground">{filePreview.textContent}</pre>
                  )
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Não foi possível exibir o arquivo.</div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Visualizar nota */}
      <Dialog open={!!viewingNote} onOpenChange={(open) => !open && closeViewNote()}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          {viewingNote && (
            <>
              <DialogHeader>
                <span className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  <StickyNote size={15} /> Nota
                </span>
                <DialogTitle>{viewingNote.name}</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-4">
                {viewingNote.description && (
                  <div>
                    <Label className="mb-1">Descrição</Label>
                    <p className="text-sm text-muted-foreground">{viewingNote.description}</p>
                  </div>
                )}
                <div>
                  <Label className="mb-1">Conteúdo</Label>
                  <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm whitespace-pre-wrap text-foreground">
                    {noteHighlightQuery && viewingNote.content?.trim() ? (
                      <HighlightedText text={viewingNote.content} query={noteHighlightQuery} as="p" />
                    ) : (
                      viewingNote.content?.trim() || '(Nota vazia)'
                    )}
                  </div>
                </div>
                {viewingNote.tags.length > 0 && (
                  <div>
                    <Label className="mb-1.5">Tags</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {viewingNote.tags.map((t) => (
                        <Badge key={t} variant="outline">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                <div className="text-xs text-muted-foreground">
                  Criado em {formatDate(viewingNote.created_at)}
                  {viewingNote.updated_at !== viewingNote.created_at && ` · Atualizado em ${formatDate(viewingNote.updated_at)}`}
                  {viewingNote.created_by_name && ` · Por ${viewingNote.created_by_name}`}
                </div>
              </div>
              <DialogFooter>
                {canEdit && (
                  <Button variant="secondary" onClick={openEditNoteFromView}>
                    <Pencil size={16} /> Editar
                  </Button>
                )}
                <Button variant="outline" onClick={closeViewNote}>
                  Fechar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Nova pasta */}
      <Dialog open={showFolderModal} onOpenChange={setShowFolderModal}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Nova pasta</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateFolder} className="flex flex-col gap-4">
            <div>
              <Label className="mb-1.5">Nome da pasta</Label>
              <Input required value={folderName} onChange={(e) => setFolderName(e.target.value)} autoFocus />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowFolderModal(false)}>
                Cancelar
              </Button>
              <Button type="submit">Criar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Nova/editar nota */}
      <Dialog open={showNoteModal} onOpenChange={(open) => !open && closeNoteModal()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingNote ? 'Editar nota' : 'Nova nota'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveNote} className="flex flex-col gap-4">
            <div>
              <Label className="mb-1.5">Título</Label>
              <Input required value={noteName} onChange={(e) => setNoteName(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1.5">Conteúdo</Label>
              <Textarea rows={8} value={noteContent} onChange={(e) => setNoteContent(e.target.value)} placeholder="Texto, instruções, links..." />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeNoteModal}>
                Cancelar
              </Button>
              <Button type="submit">Salvar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Editar repositório */}
      <Dialog open={showEditRepoModal} onOpenChange={setShowEditRepoModal}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar repositório</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveEditRepo} className="flex flex-col gap-4">
            <div>
              <Label className="mb-1.5">Nome</Label>
              <Input required value={editRepoName} onChange={(e) => setEditRepoName(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1.5">Descrição</Label>
              <Textarea rows={3} value={editRepoDesc} onChange={(e) => setEditRepoDesc(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1.5">Quem pode acessar</Label>
              <Select value={editRepoVisibility} onValueChange={(v) => setEditRepoVisibility(v as DocVisibility)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">Usuários selecionados</SelectItem>
                  <SelectItem value="team">Toda a equipe</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {isOwner && editRepoVisibility === 'private' && (
              <DocsUserAccessPicker users={allUsers} value={accessMembers} onChange={setAccessMembers} excludeUserIds={repo.owner_id ? [repo.owner_id] : []} />
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowEditRepoModal(false)}>
                Cancelar
              </Button>
              <Button type="submit">Salvar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Gerenciar acesso */}
      <Dialog open={showAccessModal} onOpenChange={setShowAccessModal}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Quem tem acesso</DialogTitle>
            <p className="text-sm text-muted-foreground">Selecione os usuários que podem ver ou editar arquivos neste repositório.</p>
          </DialogHeader>
          <DocsUserAccessPicker
            users={allUsers}
            value={accessMembers}
            onChange={setAccessMembers}
            excludeUserIds={[repo.owner_id, user?.id].filter((id): id is number => id != null)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAccessModal(false)}>
              Cancelar
            </Button>
            <Button disabled={savingAccess} onClick={handleSaveAccess}>
              {savingAccess ? 'Salvando...' : 'Salvar acessos'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
