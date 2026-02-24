import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  FolderGit2,
  Search,
  Plus,
  FileText,
  Lock,
  ChevronRight,
  X,
  Trash2,
  ChevronLeft,
} from 'lucide-react';
import { MOCK_REPOS, type DocRepo } from './docs/docsData';

const PAGE_SIZE = 8;
const STORAGE_KEY = 'tidesk_docs_repos';

function loadReposFromStorage(): DocRepo[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed) && parsed.length >= 0) return parsed as DocRepo[];
    }
  } catch {
    // ignore
  }
  return [...MOCK_REPOS];
}

function saveReposToStorage(repos: DocRepo[]) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(repos));
  } catch {
    // ignore
  }
}

function formatDate(s: string): string {
  try {
    return new Date(s).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return s;
  }
}

export default function Docs() {
  const navigate = useNavigate();
  const location = useLocation();
  const [search, setSearch] = useState('');
  const [repos, setRepos] = useState<DocRepo[]>(loadReposFromStorage);
  const [showNewRepoModal, setShowNewRepoModal] = useState(false);
  const [newRepoName, setNewRepoName] = useState('');
  const [newRepoDesc, setNewRepoDesc] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    saveReposToStorage(repos);
  }, [repos]);

  useEffect(() => {
    const deleteId = (location.state as { deleteRepoId?: string })?.deleteRepoId;
    if (deleteId) {
      const updatedRepos = repos.filter((r) => r.id !== deleteId);
      setRepos(updatedRepos);
      saveReposToStorage(updatedRepos);
      navigate('/docs', { replace: true, state: {} });
    }
  }, [location.state, navigate]);

  const handleDeleteRepo = (e: React.MouseEvent, repo: DocRepo) => {
    e.stopPropagation();
    if (!window.confirm(`Excluir o repositório "${repo.name}"? Todos os itens serão removidos.`)) return;
    setRepos((prev) => prev.filter((r) => r.id !== repo.id));
  };

  const filteredRepos = repos.filter(
    (r) =>
      r.name.toLowerCase().includes(search.trim().toLowerCase()) ||
      r.description.toLowerCase().includes(search.trim().toLowerCase()) ||
      r.slug.toLowerCase().includes(search.trim().toLowerCase())
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const totalPages = Math.max(1, Math.ceil(filteredRepos.length / PAGE_SIZE));
  const paginatedRepos = filteredRepos.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const handleOpenRepo = (repo: DocRepo) => {
    navigate(`/docs/${repo.id}`, { state: { repo } });
  };

  const handleCreateRepo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRepoName.trim()) return;
    const slug = newRepoName
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
    const now = new Date().toISOString();
    const newRepo: DocRepo = {
      id: String(Date.now()),
      name: newRepoName.trim(),
      slug: slug || String(Date.now()),
      description: newRepoDesc.trim(),
      itemCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    const updatedRepos = [...repos, newRepo];
    setRepos(updatedRepos);
    saveReposToStorage(updatedRepos);
    setNewRepoName('');
    setNewRepoDesc('');
    setShowNewRepoModal(false);
    navigate(`/docs/${newRepo.id}`, { state: { repo: newRepo } });
  };

  return (
    <div className="docs-page">
      <header className="docs-header">
        <h1 className="docs-header__title">Docs</h1>
        <p className="docs-header__subtitle">
          Repositórios de conhecimento da equipe — organize documentos, links, vídeos e credenciais.
        </p>
      </header>

      <div className="docs-toolbar">
        <div className="docs-search docs-search--repos">
          <Search size={18} className="docs-search__icon" />
          <input
            type="text"
            placeholder="Buscar repositórios..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="docs-search__input"
          />
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setShowNewRepoModal(true)}
        >
          <Plus size={18} />
          Novo repositório
        </button>
      </div>

      <div className="docs-repos">
        {filteredRepos.length === 0 ? (
          <div className="card docs-empty-card">
            <div className="docs-empty">
              <div className="docs-empty__icon docs-empty__icon--repo">
                <FolderGit2 size={40} />
              </div>
              <h3 className="docs-empty__title">
                {search ? 'Nenhum repositório encontrado' : 'Nenhum repositório ainda'}
              </h3>
              <p className="docs-empty__text">
                {search
                  ? 'Tente outro termo de busca.'
                  : 'Crie o primeiro repositório para organizar documentos da equipe.'}
              </p>
              {!search && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setShowNewRepoModal(true)}
                >
                  <Plus size={18} />
                  Criar repositório
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="card docs-list-card">
            <ul className="docs-list" role="list">
              {paginatedRepos.map((repo, index) => (
                <li
                  key={repo.id}
                  className="docs-list-item"
                  onClick={() => handleOpenRepo(repo)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && handleOpenRepo(repo)}
                >
                  <span className="docs-list-item__accent" aria-hidden />
                  <span className="docs-list-item__index">
                    {String((currentPage - 1) * PAGE_SIZE + index + 1).padStart(2, '0')}
                  </span>
                  <span className="docs-list-item__icon">
                    <FolderGit2 size={20} />
                  </span>
                  <div className="docs-list-item__content">
                    <span className="docs-list-item__name">{repo.name}</span>
                    <span className="docs-list-item__desc">{repo.description || 'Sem descrição'}</span>
                  </div>
                  <div className="docs-list-item__meta">
                    <span>
                      <FileText size={12} />
                      {repo.itemCount} {repo.itemCount === 1 ? 'item' : 'itens'}
                    </span>
                    <span>{formatDate(repo.updatedAt)}</span>
                  </div>
                  <div className="docs-list-item__actions">
                    <button
                      type="button"
                      className="docs-list-item__btn docs-list-item__btn--delete"
                      onClick={(e) => handleDeleteRepo(e, repo)}
                      title="Excluir repositório"
                      aria-label="Excluir repositório"
                    >
                      <Trash2 size={14} />
                    </button>
                    <span className="docs-list-item__open">
                      <ChevronRight size={18} />
                    </span>
                  </div>
                </li>
              ))}
            </ul>
            {totalPages > 1 && (
              <div className="docs-paginator">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft size={16} />
                  Anterior
                </button>
                <span className="docs-paginator__info">
                  Página {currentPage} de {totalPages} · {filteredRepos.length} repositórios
                </span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                >
                  Próxima
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {showNewRepoModal && (
        <div
          className="docs-modal-backdrop"
          onClick={() => setShowNewRepoModal(false)}
        >
          <div className="docs-modal" onClick={(e) => e.stopPropagation()}>
            <div className="docs-modal__head">
              <div>
                <h2 className="docs-modal__title">Novo repositório</h2>
                <p className="docs-modal__subtitle">
                  Crie um repositório para agrupar documentos, links, vídeos e credenciais.
                </p>
              </div>
              <button
                type="button"
                className="docs-modal__close"
                onClick={() => setShowNewRepoModal(false)}
                aria-label="Fechar"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateRepo} className="docs-modal__form">
              <div className="docs-form-grid">
                <div className="docs-form-group docs-form-group--full">
                  <label className="docs-form-label">Nome do repositório</label>
                  <input
                    type="text"
                    required
                    value={newRepoName}
                    onChange={(e) => setNewRepoName(e.target.value)}
                    placeholder="Ex: Procedimentos de rede"
                    className="docs-form-input"
                    autoFocus
                  />
                </div>
                <div className="docs-form-group docs-form-group--full">
                  <label className="docs-form-label">Descrição</label>
                  <textarea
                    rows={3}
                    value={newRepoDesc}
                    onChange={(e) => setNewRepoDesc(e.target.value)}
                    placeholder="Breve descrição do que este repositório contém."
                    className="docs-form-input docs-form-textarea"
                  />
                </div>
              </div>
              <div className="docs-modal-footer">
                <div className="docs-modal-footer__hint">
                  <Lock size={14} />
                  <span>Conteúdo sensível nos itens será armazenado criptografado.</span>
                </div>
                <div className="docs-modal-footer__actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowNewRepoModal(false)}
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Criar repositório
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
