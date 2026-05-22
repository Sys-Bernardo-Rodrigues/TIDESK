import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  HardDrive,
  Search,
  Plus,
  FileText,
  Users,
  Lock,
  ChevronRight,
  X,
  Trash2,
  ChevronLeft,
  Globe,
} from 'lucide-react';
import { usePermissions, RESOURCES, ACTIONS } from '../hooks/usePermissions';
import type { DocRepository, DocVisibility } from './docs/docsData';
import { formatDate } from './docs/docsData';
import DocsUserAccessPicker, {
  type AccessMember,
  type UserOption,
} from './docs/DocsUserAccessPicker';
import { useAuth } from '../contexts/AuthContext';

const PAGE_SIZE = 8;

const VISIBILITY_LABEL: Record<DocVisibility, string> = {
  private: 'Privado',
  team: 'Equipe',
};

export default function Docs() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission(RESOURCES.DOCS, ACTIONS.CREATE);

  const [search, setSearch] = useState('');
  const [repos, setRepos] = useState<DocRepository[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showNewRepoModal, setShowNewRepoModal] = useState(false);
  const [newRepoName, setNewRepoName] = useState('');
  const [newRepoDesc, setNewRepoDesc] = useState('');
  const [newRepoVisibility, setNewRepoVisibility] = useState<DocVisibility>('private');
  const [accessMembers, setAccessMembers] = useState<AccessMember[]>([]);
  const [allUsers, setAllUsers] = useState<UserOption[]>([]);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (!showNewRepoModal) return;
    axios
      .get<UserOption[]>('/api/docs/share-users')
      .then((res) => setAllUsers(res.data))
      .catch(() => setAllUsers([]));
  }, [showNewRepoModal]);

  const loadRepos = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get<DocRepository[]>('/api/docs/repositories');
      setRepos(res.data);
    } catch {
      setError('Não foi possível carregar os repositórios.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRepos();
  }, []);

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

  const handleOpenRepo = (repo: DocRepository) => {
    navigate(`/docs/${repo.id}`);
  };

  const handleDeleteRepo = async (e: React.MouseEvent, repo: DocRepository) => {
    e.stopPropagation();
    if (repo.access !== 'owner') {
      alert('Apenas o proprietário pode excluir este repositório.');
      return;
    }
    if (!window.confirm(`Excluir o repositório "${repo.name}" e todos os arquivos?`)) return;
    try {
      await axios.delete(`/api/docs/repositories/${repo.id}`);
      setRepos((prev) => prev.filter((r) => r.id !== repo.id));
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : 'Erro ao excluir';
      alert(msg || 'Erro ao excluir');
    }
  };

  const handleCreateRepo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRepoName.trim()) return;
    try {
      const res = await axios.post<DocRepository>('/api/docs/repositories', {
        name: newRepoName.trim(),
        description: newRepoDesc.trim(),
        visibility: newRepoVisibility,
        members:
          newRepoVisibility === 'private'
            ? accessMembers.map((m) => ({ user_id: m.user_id, permission: m.permission }))
            : [],
      });
      setShowNewRepoModal(false);
      setNewRepoName('');
      setNewRepoDesc('');
      setNewRepoVisibility('private');
      setAccessMembers([]);
      navigate(`/docs/${res.data.id}`);
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : 'Erro ao criar';
      alert(msg || 'Erro ao criar repositório');
    }
  };

  return (
    <div className="docs-page">
      <header className="docs-header">
        <h1 className="docs-header__title">Arquivos</h1>
        <p className="docs-header__subtitle">
          Repositório de arquivos da equipe — envie documentos, organize em pastas e compartilhe com colegas.
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
        {canCreate && (
          <button type="button" className="btn btn-primary" onClick={() => setShowNewRepoModal(true)}>
            <Plus size={18} />
            Novo repositório
          </button>
        )}
      </div>

      {error && (
        <p className="docs-error" role="alert">
          {error}
        </p>
      )}

      <div className="docs-repos">
        {loading ? (
          <div className="card docs-empty-card">
            <p className="docs-empty__text">Carregando repositórios...</p>
          </div>
        ) : filteredRepos.length === 0 ? (
          <div className="card docs-empty-card">
            <div className="docs-empty">
              <div className="docs-empty__icon docs-empty__icon--repo">
                <HardDrive size={40} />
              </div>
              <h3 className="docs-empty__title">
                {search ? 'Nenhum repositório encontrado' : 'Nenhum repositório ainda'}
              </h3>
              <p className="docs-empty__text">
                {search
                  ? 'Tente outro termo de busca.'
                  : 'Crie um repositório para armazenar e compartilhar arquivos com a equipe.'}
              </p>
              {!search && canCreate && (
                <button type="button" className="btn btn-primary" onClick={() => setShowNewRepoModal(true)}>
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
                    <HardDrive size={20} />
                  </span>
                  <div className="docs-list-item__content">
                    <span className="docs-list-item__name">{repo.name}</span>
                    <span className="docs-list-item__desc">{repo.description || 'Sem descrição'}</span>
                  </div>
                  <div className="docs-list-item__meta">
                    <span className={`docs-visibility docs-visibility--${repo.visibility}`}>
                      {repo.visibility === 'team' ? <Users size={12} /> : <Lock size={12} />}
                      {VISIBILITY_LABEL[repo.visibility]}
                    </span>
                    <span>
                      <FileText size={12} />
                      {repo.item_count} {repo.item_count === 1 ? 'item' : 'itens'}
                    </span>
                    <span>{formatDate(repo.updated_at)}</span>
                  </div>
                  <div className="docs-list-item__actions">
                    {repo.access === 'owner' && (
                      <button
                        type="button"
                        className="docs-list-item__btn docs-list-item__btn--delete"
                        onClick={(e) => handleDeleteRepo(e, repo)}
                        title="Excluir repositório"
                        aria-label="Excluir repositório"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
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
        <div className="docs-modal-backdrop" onClick={() => setShowNewRepoModal(false)}>
          <div className="docs-modal" onClick={(e) => e.stopPropagation()}>
            <div className="docs-modal__head">
              <div>
                <h2 className="docs-modal__title">Novo repositório</h2>
                <p className="docs-modal__subtitle">
                  Espaço para arquivos, pastas e notas. Compartilhe com usuários específicos ou com toda a equipe.
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
                  <label className="docs-form-label">Nome</label>
                  <input
                    type="text"
                    required
                    value={newRepoName}
                    onChange={(e) => setNewRepoName(e.target.value)}
                    placeholder="Ex: Documentos da equipe"
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
                    placeholder="Para que serve este repositório?"
                    className="docs-form-input docs-form-textarea"
                  />
                </div>
                <div className="docs-form-group docs-form-group--full">
                  <label className="docs-form-label">Quem pode acessar</label>
                  <select
                    value={newRepoVisibility}
                    onChange={(e) => setNewRepoVisibility(e.target.value as DocVisibility)}
                    className="docs-form-input"
                  >
                    <option value="private">Usuários selecionados (+ você como dono)</option>
                    <option value="team">Toda a equipe (quem tem permissão Arquivos)</option>
                  </select>
                </div>
                {newRepoVisibility === 'private' && (
                  <div className="docs-form-group docs-form-group--full">
                    <DocsUserAccessPicker
                      users={allUsers}
                      value={accessMembers}
                      onChange={setAccessMembers}
                      excludeUserIds={user?.id ? [user.id] : []}
                    />
                  </div>
                )}
              </div>
              <div className="docs-modal-footer">
                <div className="docs-modal-footer__hint">
                  <Globe size={14} />
                  <span>
                    {newRepoVisibility === 'private'
                      ? 'Somente os usuários marcados e você terão acesso.'
                      : 'Todos com permissão de Arquivos no sistema poderão ver.'}
                  </span>
                </div>
                <div className="docs-modal-footer__actions">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowNewRepoModal(false)}>
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
