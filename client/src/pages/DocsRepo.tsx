import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  HardDrive,
  Folder,
  File,
  FileText,
  StickyNote,
  Search,
  Plus,
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
import type {
  DocRepository,
  DocEntry,
  DocSearchResult,
  DocRepositoryShare,
  DocVisibility,
} from './docs/docsData';
import {
  formatDate,
  formatFileSize,
  isPdfEntry,
  canPreviewInBrowser,
  getFilePreviewKind,
} from './docs/docsData';
import type { FilePreviewKind } from './docs/previewUtils';
import DocsUserAccessPicker, {
  type AccessMember,
  type UserOption,
} from './docs/DocsUserAccessPicker';
import { useAuth } from '../contexts/AuthContext';

type BreadcrumbItem = { id: number | null; name: string };

function sharedToMembers(shared: DocRepositoryShare[]): AccessMember[] {
  return shared.map((s) => ({
    user_id: s.user_id,
    name: s.user_name,
    email: s.user_email,
    permission: s.permission,
  }));
}

export default function DocsRepo() {
  const { repoId } = useParams<{ repoId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
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
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

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
        const res = await axios.get<DocSearchResult[]>(`/api/docs/repositories/${repoId}/search`, {
          params: { q: searchTerm },
        });
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
    return (
      e.name.toLowerCase().includes(term) ||
      (e.description ?? '').toLowerCase().includes(term) ||
      e.tags.some((t) => t.toLowerCase().includes(term))
    );
  });

  const displayEntries: (DocEntry | DocSearchResult)[] = isSearchMode
    ? searchResults ?? []
    : filteredEntries;

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
        await axios.post(`/api/docs/repositories/${repoId}/upload`, form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }
      await refresh(currentFolderId);
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : 'Erro no upload';
      alert(msg || 'Erro ao enviar arquivo');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderName.trim()) return;
    try {
      await axios.post(`/api/docs/repositories/${repoId}/folders`, {
        name: folderName.trim(),
        parent_id: currentFolderId,
      });
      setShowFolderModal(false);
      setFolderName('');
      await refresh(currentFolderId);
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : 'Erro';
      alert(msg || 'Erro ao criar pasta');
    }
  };

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteName.trim()) return;
    try {
      if (editingNote) {
        await axios.put(`/api/docs/entries/${editingNote.id}`, {
          name: noteName.trim(),
          content: noteContent,
        });
      } else {
        await axios.post(`/api/docs/repositories/${repoId}/notes`, {
          name: noteName.trim(),
          content: noteContent,
          parent_id: currentFolderId,
        });
      }
      closeNoteModal();
      await refresh(currentFolderId);
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : 'Erro';
      alert(msg || 'Erro ao salvar nota');
    }
  };

  const fetchPreviewBlob = async (entry: DocEntry) => {
    const res = await axios.get(`/api/docs/entries/${entry.id}/preview`, {
      responseType: 'blob',
    });
    const blob =
      res.data instanceof Blob
        ? res.data
        : new Blob([res.data], { type: entry.mime_type || 'application/octet-stream' });
    return blob;
  };

  const fetchFileBlob = async (entry: DocEntry) => {
    const res = await axios.get(`/api/docs/entries/${entry.id}/download`, {
      responseType: 'blob',
    });
    const blob =
      res.data instanceof Blob
        ? res.data
        : new Blob([res.data], { type: entry.mime_type || 'application/octet-stream' });
    return blob;
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
      alert('Erro ao baixar arquivo');
    }
  };

  const closeFilePreview = useCallback(() => {
    setFilePreview((prev) => {
      if (prev?.url) window.URL.revokeObjectURL(prev.url);
      return null;
    });
    setPreviewLoading(false);
  }, []);

  const openFilePreview = async (entry: DocEntry) => {
    const kind = getFilePreviewKind(entry);
    if (kind === 'none') {
      handleDownload(entry);
      return;
    }

    setFilePreview((prev) => {
      if (prev?.url) window.URL.revokeObjectURL(prev.url);
      return { entry, kind };
    });
    setPreviewLoading(true);

    try {
      if (kind === 'html') {
        const res = await axios.get<{ html: string }>(`/api/docs/entries/${entry.id}/preview-html`);
        setFilePreview({ entry, kind, htmlContent: res.data.html });
      } else if (kind === 'text' && entry.entry_type === 'note') {
        setFilePreview({ entry, kind, textContent: entry.content || '' });
      } else if (kind === 'text') {
        const blob = await fetchPreviewBlob(entry);
        const text = await blob.text();
        setFilePreview({ entry, kind, textContent: text });
      } else {
        const blob = await fetchPreviewBlob(entry);
        const mime =
          entry.mime_type ||
          (kind === 'pdf' ? 'application/pdf' : blob.type || 'application/octet-stream');
        const typed = blob.type ? blob : new Blob([blob], { type: mime });
        const url = window.URL.createObjectURL(typed);
        setFilePreview({ entry, kind, url });
      }
    } catch {
      closeFilePreview();
      alert('Não foi possível abrir o arquivo no navegador.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleOpenFile = (entry: DocEntry) => {
    if (canPreviewInBrowser(entry)) openFilePreview(entry);
    else handleDownload(entry);
  };

  const openViewNote = (entry: DocEntry) => setViewingNote(entry);
  const closeViewNote = () => setViewingNote(null);

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
    else if (entry.entry_type === 'note') openViewNote(entry);
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
    if (!window.confirm(`Excluir "${entry.name}"?`)) return;
    try {
      await axios.delete(`/api/docs/entries/${entry.id}`);
      await refresh(currentFolderId);
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : 'Erro';
      alert(msg || 'Erro ao excluir');
    }
  };

  const handleDeleteRepo = async () => {
    if (!repo || !window.confirm(`Excluir "${repo.name}" e todo o conteúdo?`)) return;
    try {
      await axios.delete(`/api/docs/repositories/${repo.id}`);
      navigate('/docs');
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : 'Erro';
      alert(msg || 'Erro ao excluir repositório');
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
      const payload: Record<string, unknown> = {
        name: editRepoName.trim(),
        description: editRepoDesc.trim(),
        visibility: editRepoVisibility,
      };
      if (isOwner && editRepoVisibility === 'private') {
        payload.members = accessMembers.map((m) => ({
          user_id: m.user_id,
          permission: m.permission,
        }));
      } else if (isOwner && editRepoVisibility === 'team') {
        payload.members = [];
      }
      const res = await axios.put<DocRepository>(`/api/docs/repositories/${repo.id}`, payload);
      setRepo(res.data);
      setShowEditRepoModal(false);
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : 'Erro';
      alert(msg || 'Erro ao salvar');
    }
  };

  const handleSaveAccess = async () => {
    if (!repoId) return;
    setSavingAccess(true);
    try {
      const res = await axios.put<{ shared_with: DocRepositoryShare[] }>(
        `/api/docs/repositories/${repoId}/access`,
        {
          members: accessMembers.map((m) => ({
            user_id: m.user_id,
            permission: m.permission,
          })),
        }
      );
      setRepo((prev) => (prev ? { ...prev, shared_with: res.data.shared_with } : prev));
      setShowAccessModal(false);
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : 'Erro';
      alert(msg || 'Erro ao salvar acessos');
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
    if (item.entry_type === 'note') openViewNote(item);
    else if (item.entry_type === 'file') handleOpenFile(item);
  };

  if (loading) {
    return (
      <div className="docs-page">
        <p className="docs-empty__text">Carregando...</p>
      </div>
    );
  }

  if (!repo) {
    return (
      <div className="docs-page">
        <button type="button" className="btn btn-secondary" onClick={handleBack}>
          <ArrowLeft size={16} />
          Voltar
        </button>
        <p style={{ marginTop: 'var(--spacing-lg)', color: 'var(--text-secondary)' }}>
          Repositório não encontrado ou sem acesso.
        </p>
      </div>
    );
  }

  return (
    <div className="docs-page docs-page--repo">
      <div className="docs-repo-top">
        <button type="button" className="btn btn-secondary docs-back-btn" onClick={handleBack}>
          <ArrowLeft size={18} />
          Voltar para Arquivos
        </button>
      </div>

      <nav className="docs-breadcrumb">
        <button type="button" className="docs-breadcrumb__link" onClick={handleBack}>
          Arquivos
        </button>
        <span className="docs-breadcrumb__sep">/</span>
        <button
          type="button"
          className="docs-breadcrumb__link"
          onClick={() => goToBreadcrumb(0)}
        >
          {repo.name}
        </button>
        {breadcrumb.slice(1).map((crumb, i) => (
          <span key={crumb.id ?? i}>
            <span className="docs-breadcrumb__sep">/</span>
            <button
              type="button"
              className={
                i === breadcrumb.length - 2
                  ? 'docs-breadcrumb__current'
                  : 'docs-breadcrumb__link'
              }
              onClick={() => goToBreadcrumb(i + 1)}
            >
              {crumb.name}
            </button>
          </span>
        ))}
      </nav>

      <header className="docs-repo-header">
        <div className="docs-repo-header__icon">
          <HardDrive size={28} />
        </div>
        <div className="docs-repo-header__text">
          <h1 className="docs-repo-header__title">{repo.name}</h1>
          <p className="docs-repo-header__desc">{repo.description || 'Sem descrição'}</p>
          <div className="docs-repo-header__meta">
            <span>
              {repo.visibility === 'team' ? <Users size={14} /> : <Lock size={14} />}
              {repo.visibility === 'team' ? 'Equipe' : 'Privado'}
            </span>
            <span>
              <FileText size={14} />
              {repo.item_count} itens no total
            </span>
            <span>Por {repo.owner_name}</span>
            {repo.visibility === 'private' && isOwner && (
              <span>
                <Users size={14} />
                {(repo.shared_with?.length ?? 0) === 0
                  ? 'Só você'
                  : `${repo.shared_with!.length} usuário(s) com acesso`}
              </span>
            )}
          </div>
        </div>
        <div className="docs-repo-header__actions">
          {isOwner && repo.visibility === 'private' && (
            <button type="button" className="btn btn-secondary" onClick={openAccessModal}>
              <Share2 size={16} />
              Gerenciar acesso
            </button>
          )}
          {canEdit && (
            <button type="button" className="btn btn-secondary" onClick={openEditRepoModal}>
              <Pencil size={16} />
              Editar
            </button>
          )}
          {isOwner && (
            <button type="button" className="btn btn-danger" onClick={handleDeleteRepo}>
              <Trash2 size={16} />
              Excluir
            </button>
          )}
        </div>
      </header>

      <div className="docs-toolbar">
        <div className="docs-search">
          <Search size={18} className="docs-search__icon" />
          <input
            type="text"
            placeholder="Buscar nome, notas e texto dentro dos arquivos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="docs-search__input"
          />
        </div>
        {canEdit && (
          <div className="docs-toolbar-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setShowFolderModal(true)}>
              <FolderPlus size={18} />
              Nova pasta
            </button>
            <button type="button" className="btn btn-secondary" onClick={openNewNoteModal}>
              <StickyNote size={18} />
              Nova nota
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={18} />
              {uploading ? 'Enviando...' : 'Enviar arquivo'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              hidden
              onChange={(e) => handleUpload(e.target.files)}
            />
          </div>
        )}
      </div>

      <div className="card docs-card">
        <div className="docs-card__head">
          <div className="docs-card__head-title">
            <Home size={18} />
            <span>{breadcrumb[breadcrumb.length - 1]?.name || 'Raiz'}</span>
          </div>
          <div className="docs-card__head-meta">
            {isSearchMode
              ? searching
                ? 'Buscando...'
                : `${displayEntries.length} resultado${displayEntries.length === 1 ? '' : 's'} no repositório`
              : `${displayEntries.length} ${displayEntries.length === 1 ? 'item' : 'itens'} nesta pasta`}
            {!canEdit && ' · Somente leitura'}
          </div>
        </div>
        <div className="docs-card__body">
          {displayEntries.length === 0 ? (
            <div className="docs-empty">
              <div className="docs-empty__icon">
                <Folder size={40} />
              </div>
              <h3 className="docs-empty__title">
                {isSearchMode ? 'Nenhum resultado' : 'Pasta vazia'}
              </h3>
              <p className="docs-empty__text">
                {isSearchMode
                  ? 'Tente outras palavras. A busca inclui PDF, DOCX, TXT e notas (mínimo 2 caracteres).'
                  : canEdit
                    ? 'Envie arquivos, crie pastas ou adicione notas de texto.'
                    : 'Não há arquivos nesta pasta.'}
              </p>
            </div>
          ) : isSearchMode ? (
            <ul className="docs-search-results">
              {(displayEntries as DocSearchResult[]).map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="docs-search-result"
                    onClick={() => openSearchResult(item)}
                  >
                    <span className="docs-search-result__name">{item.name}</span>
                    <span className="docs-search-result__path">
                      {(item.path?.length ? item.path.join(' / ') : 'Raiz') +
                        ` · ${item.entry_type === 'note' ? 'Nota' : 'Arquivo'}`}
                    </span>
                    {item.snippet && (
                      <span className="docs-search-result__snippet">{item.snippet}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="docs-file-grid">
              {displayEntries.map((entry) => {
                const Icon = entryIcon(entry);
                return (
                  <div
                    key={entry.id}
                    className={`docs-file-card docs-file-card--${entry.entry_type}`}
                    onClick={() => handleOpenEntry(entry as DocEntry)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleOpenEntry(entry);
                    }}
                  >
                    <div className="docs-file-card__icon">
                      <Icon size={32} />
                    </div>
                    <div className="docs-file-card__name" title={entry.name}>
                      {entry.name}
                    </div>
                    <div className="docs-file-card__meta">
                      {entry.entry_type === 'file' && isPdfEntry(entry) && 'PDF · '}
                      {entry.entry_type === 'file' && formatFileSize(entry.size_bytes)}
                      {entry.entry_type === 'folder' && 'Pasta'}
                      {entry.entry_type === 'note' && 'Nota'}
                      {' · '}
                      {formatDate(entry.updated_at)}
                    </div>
                    <div className="docs-file-card__actions" onClick={(e) => e.stopPropagation()}>
                      {entry.entry_type === 'file' && canPreviewInBrowser(entry) && (
                        <button
                          type="button"
                          className="docs-file-card__btn"
                          title="Visualizar no navegador"
                          onClick={() => openFilePreview(entry)}
                        >
                          <Eye size={16} />
                        </button>
                      )}
                      {entry.entry_type === 'file' && (
                        <button
                          type="button"
                          className="docs-file-card__btn"
                          title="Download"
                          onClick={() => handleDownload(entry)}
                        >
                          <Download size={16} />
                        </button>
                      )}
                      {entry.entry_type === 'note' && canEdit && (
                        <button
                          type="button"
                          className="docs-file-card__btn"
                          title="Editar nota"
                          onClick={() => openEditNote(entry)}
                        >
                          <Pencil size={16} />
                        </button>
                      )}
                      {canEdit && (
                        <button
                          type="button"
                          className="docs-file-card__btn docs-file-card__btn--danger"
                          title="Excluir"
                          onClick={() => handleDeleteEntry(entry)}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {filePreview && (
        <div className="docs-file-preview-backdrop" onClick={closeFilePreview}>
          <div className="docs-file-preview" onClick={(e) => e.stopPropagation()}>
            <header className="docs-file-preview__head">
              <div className="docs-file-preview__title">
                <FileType size={20} />
                <span title={filePreview.entry.name}>{filePreview.entry.name}</span>
              </div>
              <div className="docs-file-preview__actions">
                {filePreview.entry.entry_type === 'file' && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleDownload(filePreview.entry)}
                  >
                    <Download size={16} />
                    Baixar
                  </button>
                )}
                <button
                  type="button"
                  className="docs-modal__close"
                  onClick={closeFilePreview}
                  aria-label="Fechar visualizador"
                >
                  <X size={20} />
                </button>
              </div>
            </header>
            <div className="docs-file-preview__body">
              {previewLoading ? (
                <div className="docs-file-preview__loading">Carregando...</div>
              ) : filePreview.kind === 'pdf' && filePreview.url ? (
                <iframe
                  src={filePreview.url}
                  title={`Visualização: ${filePreview.entry.name}`}
                  className="docs-file-preview__iframe"
                />
              ) : filePreview.kind === 'image' && filePreview.url ? (
                <img
                  src={filePreview.url}
                  alt={filePreview.entry.name}
                  className="docs-file-preview__img"
                />
              ) : filePreview.kind === 'html' && filePreview.htmlContent ? (
                <div
                  className="docs-file-preview__html"
                  dangerouslySetInnerHTML={{ __html: filePreview.htmlContent }}
                />
              ) : filePreview.kind === 'text' && filePreview.textContent != null ? (
                <pre className="docs-file-preview__text">{filePreview.textContent}</pre>
              ) : (
                <div className="docs-file-preview__loading">Não foi possível exibir o arquivo.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {showFolderModal && (
        <div className="docs-modal-backdrop" onClick={() => setShowFolderModal(false)}>
          <div className="docs-modal docs-modal--sm" onClick={(e) => e.stopPropagation()}>
            <div className="docs-modal__head">
              <h2 className="docs-modal__title">Nova pasta</h2>
              <button type="button" className="docs-modal__close" onClick={() => setShowFolderModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateFolder} className="docs-modal__form">
              <div className="docs-form-group docs-form-group--full">
                <label className="docs-form-label">Nome da pasta</label>
                <input
                  type="text"
                  required
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                  className="docs-form-input"
                  autoFocus
                />
              </div>
              <div className="docs-modal-footer">
                <div className="docs-modal-footer__actions">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowFolderModal(false)}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Criar
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewingNote && (
        <div className="docs-modal-backdrop" onClick={closeViewNote}>
          <div className="docs-modal docs-modal--view" onClick={(e) => e.stopPropagation()}>
            <div className="docs-modal__head">
              <div className="docs-detail-header">
                <span className="docs-detail-type">
                  <StickyNote size={18} />
                  Nota
                </span>
                <h2 className="docs-modal__title">{viewingNote.name}</h2>
              </div>
              <button type="button" className="docs-modal__close" onClick={closeViewNote} aria-label="Fechar">
                <X size={20} />
              </button>
            </div>
            <div className="docs-modal__body docs-note-view">
              {viewingNote.description && (
                <div className="docs-detail-block">
                  <label className="docs-form-label">Descrição</label>
                  <p className="docs-detail-text">{viewingNote.description}</p>
                </div>
              )}
              <div className="docs-detail-block">
                <label className="docs-form-label">Conteúdo</label>
                <pre className="docs-note-view__content">
                  {viewingNote.content?.trim() || '(Nota vazia)'}
                </pre>
              </div>
              {viewingNote.tags.length > 0 && (
                <div className="docs-detail-block">
                  <label className="docs-form-label">Tags</label>
                  <div className="docs-detail-tags">
                    {viewingNote.tags.map((t) => (
                      <span key={t} className="docs-tag">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="docs-detail-meta">
                Criado em {formatDate(viewingNote.created_at)}
                {viewingNote.updated_at !== viewingNote.created_at &&
                  ` · Atualizado em ${formatDate(viewingNote.updated_at)}`}
                {viewingNote.created_by_name && ` · Por ${viewingNote.created_by_name}`}
              </div>
              <div className="docs-detail-footer">
                {canEdit && (
                  <button type="button" className="btn btn-secondary" onClick={openEditNoteFromView}>
                    <Pencil size={16} />
                    Editar
                  </button>
                )}
                <button type="button" className="btn btn-secondary" onClick={closeViewNote}>
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showNoteModal && (
        <div className="docs-modal-backdrop" onClick={closeNoteModal}>
          <div className="docs-modal" onClick={(e) => e.stopPropagation()}>
            <div className="docs-modal__head">
              <h2 className="docs-modal__title">{editingNote ? 'Editar nota' : 'Nova nota'}</h2>
              <button type="button" className="docs-modal__close" onClick={closeNoteModal}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveNote} className="docs-modal__form">
              <div className="docs-form-group docs-form-group--full">
                <label className="docs-form-label">Título</label>
                <input
                  type="text"
                  required
                  value={noteName}
                  onChange={(e) => setNoteName(e.target.value)}
                  className="docs-form-input"
                />
              </div>
              <div className="docs-form-group docs-form-group--full">
                <label className="docs-form-label">Conteúdo</label>
                <textarea
                  rows={8}
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  className="docs-form-input docs-form-textarea"
                  placeholder="Texto, instruções, links..."
                />
              </div>
              <div className="docs-modal-footer">
                <div className="docs-modal-footer__actions">
                  <button type="button" className="btn btn-secondary" onClick={closeNoteModal}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Salvar
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditRepoModal && (
        <div className="docs-modal-backdrop" onClick={() => setShowEditRepoModal(false)}>
          <div className="docs-modal" onClick={(e) => e.stopPropagation()}>
            <div className="docs-modal__head">
              <h2 className="docs-modal__title">Editar repositório</h2>
              <button type="button" className="docs-modal__close" onClick={() => setShowEditRepoModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveEditRepo} className="docs-modal__form">
              <div className="docs-form-group docs-form-group--full">
                <label className="docs-form-label">Nome</label>
                <input
                  type="text"
                  required
                  value={editRepoName}
                  onChange={(e) => setEditRepoName(e.target.value)}
                  className="docs-form-input"
                />
              </div>
              <div className="docs-form-group docs-form-group--full">
                <label className="docs-form-label">Descrição</label>
                <textarea
                  rows={3}
                  value={editRepoDesc}
                  onChange={(e) => setEditRepoDesc(e.target.value)}
                  className="docs-form-input docs-form-textarea"
                />
              </div>
              <div className="docs-form-group docs-form-group--full">
                <label className="docs-form-label">Quem pode acessar</label>
                <select
                  value={editRepoVisibility}
                  onChange={(e) => setEditRepoVisibility(e.target.value as DocVisibility)}
                  className="docs-form-input"
                >
                  <option value="private">Usuários selecionados</option>
                  <option value="team">Toda a equipe</option>
                </select>
              </div>
              {isOwner && editRepoVisibility === 'private' && (
                <div className="docs-form-group docs-form-group--full">
                  <DocsUserAccessPicker
                    users={allUsers}
                    value={accessMembers}
                    onChange={setAccessMembers}
                    excludeUserIds={repo.owner_id ? [repo.owner_id] : []}
                  />
                </div>
              )}
              <div className="docs-modal-footer">
                <div className="docs-modal-footer__actions">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowEditRepoModal(false)}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Salvar
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAccessModal && (
        <div className="docs-modal-backdrop" onClick={() => setShowAccessModal(false)}>
          <div className="docs-modal docs-modal--wide" onClick={(e) => e.stopPropagation()}>
            <div className="docs-modal__head">
              <div>
                <h2 className="docs-modal__title">Quem tem acesso</h2>
                <p className="docs-modal__subtitle">
                  Selecione os usuários que podem ver ou editar arquivos neste repositório.
                </p>
              </div>
              <button type="button" className="docs-modal__close" onClick={() => setShowAccessModal(false)}>
                <X size={20} />
              </button>
            </div>
            <DocsUserAccessPicker
              users={allUsers}
              value={accessMembers}
              onChange={setAccessMembers}
              excludeUserIds={[repo.owner_id, user?.id].filter((id): id is number => id != null)}
            />
            <div className="docs-modal-footer">
              <div className="docs-modal-footer__actions" style={{ marginLeft: 'auto' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAccessModal(false)}>
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={savingAccess}
                  onClick={handleSaveAccess}
                >
                  {savingAccess ? 'Salvando...' : 'Salvar acessos'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
