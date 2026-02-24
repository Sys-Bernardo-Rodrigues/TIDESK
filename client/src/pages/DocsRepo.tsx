import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  FileText,
  FolderGit2,
  Lock,
  Link as LinkIcon,
  KeyRound,
  Video,
  Search,
  Plus,
  X,
  ArrowLeft,
  ExternalLink,
  Copy,
  Eye,
  EyeOff,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  getRepoById,
  getItemsByRepo,
  DOC_TYPE_LABEL,
  DOC_TYPE_ICON,
  type DocRepo,
  type DocItem,
  type DocType,
} from './docs/docsData';

const PAGE_SIZE = 8;

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

export default function DocsRepo() {
  const { repoId } = useParams<{ repoId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [repo, setRepo] = useState<DocRepo | null>(null);
  const [items, setItems] = useState<DocItem[]>([]);
  const [search, setSearch] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState<DocType | 'todos'>('todos');
  const [showDocModal, setShowDocModal] = useState(false);
  const [formTipo, setFormTipo] = useState<DocType>('documento');
  const [formTitulo, setFormTitulo] = useState('');
  const [formDescricao, setFormDescricao] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formConteudo, setFormConteudo] = useState('');
  const [formTags, setFormTags] = useState('');
  const [formUsuario, setFormUsuario] = useState('');
  const [selectedItem, setSelectedItem] = useState<DocItem | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [showEditRepoModal, setShowEditRepoModal] = useState(false);
  const [editRepoName, setEditRepoName] = useState('');
  const [editRepoDesc, setEditRepoDesc] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (!repoId) return;
    const fromState = (location.state as { repo?: DocRepo })?.repo;
    if (fromState && fromState.id === repoId) {
      setRepo(fromState);
    } else {
      setRepo(getRepoById(repoId) || null);
    }
    setItems(getItemsByRepo(repoId));
  }, [repoId, location.state]);

  const filteredItems = items.filter((item) => {
    const matchTipo = tipoFiltro === 'todos' || item.tipo === tipoFiltro;
    const term = search.trim().toLowerCase();
    if (!term) return matchTipo;
    return (
      matchTipo &&
      (item.titulo.toLowerCase().includes(term) ||
        (item.descricao ?? '').toLowerCase().includes(term) ||
        item.tags.some((t) => t.toLowerCase().includes(term)))
    );
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [search, tipoFiltro]);

  const totalItemPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const paginatedItems = filteredItems.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const handleBack = () => navigate('/docs');

  const handleNewDoc = () => {
    setEditingItemId(null);
    setFormTipo('documento');
    setFormTitulo('');
    setFormDescricao('');
    setFormUrl('');
    setFormConteudo('');
    setFormTags('');
    setFormUsuario('');
    setShowDocModal(true);
  };

  const startEditItem = (item: DocItem) => {
    setEditingItemId(item.id);
    setFormTipo(item.tipo);
    setFormTitulo(item.titulo);
    setFormDescricao(item.descricao || '');
    setFormUrl(item.url || '');
    setFormConteudo(item.conteudoSensivel || '');
    setFormTags(item.tags.join(', '));
    setFormUsuario(item.usuario || '');
    setSelectedItem(null);
    setShowDocModal(true);
  };

  const handleSaveDoc = (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoId) return;
    const now = new Date().toISOString();
    const tags = formTags ? formTags.split(',').map((t) => t.trim()).filter(Boolean) : [];
    if (editingItemId) {
      setItems((prev) =>
        prev.map((i) =>
          i.id === editingItemId
            ? {
                ...i,
                tipo: formTipo,
                titulo: formTitulo,
                descricao: formDescricao || undefined,
                tags,
                url: formTipo === 'link' || formTipo === 'video' ? formUrl || undefined : undefined,
                usuario: formTipo === 'credencial' ? formUsuario || undefined : undefined,
                conteudoSensivel: formConteudo || undefined,
                atualizadoEm: now,
              }
            : i
        )
      );
    } else {
      const newItem: DocItem = {
        id: `i${Date.now()}`,
        repoId,
        tipo: formTipo,
        titulo: formTitulo,
        descricao: formDescricao || undefined,
        tags,
        url: formTipo === 'link' || formTipo === 'video' ? formUrl || undefined : undefined,
        usuario: formTipo === 'credencial' ? formUsuario || undefined : undefined,
        conteudoSensivel: formConteudo || undefined,
        criadoEm: now,
        atualizadoEm: now,
      };
      setItems((prev) => [...prev, newItem]);
    }
    setShowDocModal(false);
    setEditingItemId(null);
  };

  const closeModal = () => {
    setShowDocModal(false);
    setEditingItemId(null);
  };

  const handleDeleteItem = (item: DocItem) => {
    if (!window.confirm(`Excluir "${item.titulo}"?`)) return;
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    setSelectedItem(null);
  };

  const openEditRepoModal = () => {
    setEditRepoName(repo!.name);
    setEditRepoDesc(repo!.description || '');
    setShowEditRepoModal(true);
  };

  const handleSaveEditRepo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!repo) return;
    setRepo({
      ...repo,
      name: editRepoName.trim(),
      description: editRepoDesc.trim(),
      updatedAt: new Date().toISOString(),
    });
    setShowEditRepoModal(false);
  };

  const handleDeleteRepo = () => {
    if (!repo) return;
    if (!window.confirm(`Excluir o repositório "${repo.name}"? Todos os itens serão removidos.`)) return;
    navigate('/docs', { state: { deleteRepoId: repo.id } });
  };

  const handleOpenItem = (item: DocItem) => {
    setSelectedItem(item);
    setShowPassword(false);
  };

  const closeDetailModal = () => setSelectedItem(null);

  const copyToClipboard = (text: string, label?: string) => {
    navigator.clipboard.writeText(text).then(
      () => alert(label ? `${label} copiado!` : 'Copiado para a área de transferência.'),
      () => alert('Não foi possível copiar.')
    );
  };

  const openUrl = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  if (!repo) {
    return (
      <div className="docs-page">
        <button type="button" className="btn btn-secondary" onClick={handleBack}>
          <ArrowLeft size={16} />
          Voltar aos repositórios
        </button>
        <p style={{ marginTop: 'var(--spacing-lg)', color: 'var(--text-secondary)' }}>
          Repositório não encontrado.
        </p>
      </div>
    );
  }

  return (
    <div className="docs-page docs-page--repo">
      <div className="docs-repo-top">
        <button type="button" className="btn btn-secondary docs-back-btn" onClick={handleBack}>
          <ArrowLeft size={18} />
          Voltar para Docs
        </button>
      </div>
      <nav className="docs-breadcrumb">
        <button type="button" className="docs-breadcrumb__link" onClick={handleBack}>
          Docs
        </button>
        <span className="docs-breadcrumb__sep">/</span>
        <span className="docs-breadcrumb__current">{repo.name}</span>
      </nav>

      <header className="docs-repo-header">
        <div className="docs-repo-header__icon">
          <FolderGit2 size={28} />
        </div>
        <div className="docs-repo-header__text">
          <h1 className="docs-repo-header__title">{repo.name}</h1>
          <p className="docs-repo-header__desc">{repo.description || 'Sem descrição'}</p>
          <div className="docs-repo-header__meta">
            <span>
              <FileText size={14} />
              {items.length} {items.length === 1 ? 'item' : 'itens'}
            </span>
            <span>Atualizado em {formatDate(repo.updatedAt)}</span>
          </div>
        </div>
        <div className="docs-repo-header__actions">
          <button type="button" className="btn btn-secondary" onClick={openEditRepoModal}>
            <Pencil size={16} />
            Editar repositório
          </button>
          <button type="button" className="btn btn-danger" onClick={handleDeleteRepo}>
            <Trash2 size={16} />
            Excluir repositório
          </button>
          <button type="button" className="btn btn-primary" onClick={handleNewDoc}>
            <Plus size={18} />
            Novo documento
          </button>
        </div>
      </header>

      <div className="docs-toolbar">
        <div className="docs-search">
          <Search size={18} className="docs-search__icon" />
          <input
            type="text"
            placeholder="Buscar neste repositório..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="docs-search__input"
          />
        </div>
        <div className="docs-filters">
          {(['todos', 'documento', 'link', 'video', 'credencial'] as const).map((tipo) => {
            const isTodos = tipo === 'todos';
            const isActive = tipoFiltro === tipo;
            const Icon = isTodos ? null : DOC_TYPE_ICON[tipo];
            return (
              <button
                key={tipo}
                type="button"
                className={`docs-filter-btn ${isActive ? 'docs-filter-btn--active' : ''}`}
                onClick={() => setTipoFiltro(tipo)}
              >
                {Icon && <Icon size={14} />}
                {isTodos ? 'Todos' : DOC_TYPE_LABEL[tipo]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="card docs-card">
        <div className="docs-card__head">
          <div className="docs-card__head-title">
            <Lock size={18} />
            <span>Conteúdo do repositório</span>
          </div>
          <div className="docs-card__head-meta">
            Campos sensíveis são armazenados criptografados.
          </div>
        </div>
        <div className="docs-card__body">
          {filteredItems.length === 0 ? (
            <div className="docs-empty">
              <div className="docs-empty__icon">
                <FileText size={40} />
              </div>
              <h3 className="docs-empty__title">Nenhum documento ainda</h3>
              <p className="docs-empty__text">
                Adicione documentos, links, vídeos ou credenciais a este repositório.
              </p>
              <button type="button" className="btn btn-primary" onClick={handleNewDoc}>
                <Plus size={18} />
                Adicionar primeiro documento
              </button>
            </div>
          ) : (
            <>
              <div className="docs-table-wrap">
                <table className="docs-table">
                  <thead>
                    <tr>
                      <th>Tipo</th>
                      <th>Título</th>
                      <th>Descrição</th>
                      <th>Tags</th>
                      <th>Atualizado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedItems.map((item) => {
                      const Icon = DOC_TYPE_ICON[item.tipo];
                      return (
                        <tr
                          key={item.id}
                          className="docs-table__row docs-table__row--clickable"
                          onClick={() => handleOpenItem(item)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => e.key === 'Enter' && handleOpenItem(item)}
                        >
                          <td>
                            <span className="docs-table-type">
                              <Icon size={14} />
                              {DOC_TYPE_LABEL[item.tipo]}
                            </span>
                          </td>
                          <td>{item.titulo}</td>
                          <td className="docs-table-desc">{item.descricao || '—'}</td>
                          <td>
                            {item.tags.length
                              ? item.tags.map((t) => (
                                  <span key={t} className="docs-tag">
                                    {t}
                                  </span>
                                ))
                              : '—'}
                          </td>
                          <td>{formatDate(item.atualizadoEm || item.criadoEm)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {filteredItems.length > 0 && (
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
                    Página {currentPage} de {totalItemPages} · {filteredItems.length} itens
                  </span>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={currentPage >= totalItemPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalItemPages, p + 1))}
                  >
                    Próxima
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showDocModal && (
        <div className="docs-modal-backdrop" onClick={closeModal}>
          <div className="docs-modal" onClick={(e) => e.stopPropagation()}>
            <div className="docs-modal__head">
              <div>
                <h2 className="docs-modal__title">
                  {editingItemId ? 'Editar documento' : 'Novo documento'}
                </h2>
                <p className="docs-modal__subtitle">
                  {editingItemId
                    ? 'Altere os dados do item. Dados sensíveis serão criptografados.'
                    : `Adicione um item ao repositório "${repo.name}". Dados sensíveis serão criptografados.`}
                </p>
              </div>
              <button
                type="button"
                className="docs-modal__close"
                onClick={closeModal}
                aria-label="Fechar"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveDoc} className="docs-modal__form">
              <div className="docs-form-grid">
                <div className="docs-form-group">
                  <label className="docs-form-label">Tipo</label>
                  <select
                    value={formTipo}
                    onChange={(e) => setFormTipo(e.target.value as DocType)}
                    className="docs-form-input"
                  >
                    <option value="documento">Documento</option>
                    <option value="link">Link</option>
                    <option value="video">Vídeo</option>
                    <option value="credencial">Credencial / Senha</option>
                  </select>
                </div>
                <div className="docs-form-group docs-form-group--full">
                  <label className="docs-form-label">Título</label>
                  <input
                    type="text"
                    required
                    value={formTitulo}
                    onChange={(e) => setFormTitulo(e.target.value)}
                    placeholder="Ex: Procedimento de backup diário"
                    className="docs-form-input"
                  />
                </div>
                <div className="docs-form-group docs-form-group--full">
                  <label className="docs-form-label">Descrição</label>
                  <textarea
                    rows={2}
                    value={formDescricao}
                    onChange={(e) => setFormDescricao(e.target.value)}
                    placeholder="Resumo para facilitar buscas."
                    className="docs-form-input docs-form-textarea"
                  />
                </div>
                {(formTipo === 'link' || formTipo === 'video') && (
                  <div className="docs-form-group docs-form-group--full">
                    <label className="docs-form-label">URL</label>
                    <input
                      type="url"
                      value={formUrl}
                      onChange={(e) => setFormUrl(e.target.value)}
                      placeholder="https://..."
                      className="docs-form-input"
                    />
                  </div>
                )}
                {formTipo === 'credencial' && (
                  <>
                    <div className="docs-form-group">
                      <label className="docs-form-label">Usuário / Login</label>
                      <input
                        type="text"
                        value={formUsuario}
                        onChange={(e) => setFormUsuario(e.target.value)}
                        placeholder="Usuário (criptografado)"
                        className="docs-form-input"
                      />
                    </div>
                    <div className="docs-form-group">
                      <label className="docs-form-label">Senha / Token</label>
                      <input
                        type="password"
                        value={formConteudo}
                        onChange={(e) => setFormConteudo(e.target.value)}
                        placeholder="Senha (criptografada)"
                        className="docs-form-input"
                      />
                    </div>
                  </>
                )}
                {formTipo === 'documento' && (
                  <div className="docs-form-group docs-form-group--full">
                    <label className="docs-form-label">Conteúdo / Instruções</label>
                    <textarea
                      rows={5}
                      value={formConteudo}
                      onChange={(e) => setFormConteudo(e.target.value)}
                      placeholder="Instruções, passo a passo ou detalhes."
                      className="docs-form-input docs-form-textarea"
                    />
                  </div>
                )}
                <div className="docs-form-group docs-form-group--full">
                  <label className="docs-form-label">Tags (separadas por vírgula)</label>
                  <input
                    type="text"
                    value={formTags}
                    onChange={(e) => setFormTags(e.target.value)}
                    placeholder="backup, vpn, firewall..."
                    className="docs-form-input"
                  />
                </div>
              </div>
              <div className="docs-modal-footer">
                <div className="docs-modal-footer__hint">
                  <Lock size={14} />
                  <span>Campos sensíveis serão armazenados criptografados no backend.</span>
                </div>
                <div className="docs-modal-footer__actions">
                  <button type="button" className="btn btn-secondary" onClick={closeModal}>
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

      {/* Modal de detalhe do item (visualização) */}
      {selectedItem && (
        <div className="docs-modal-backdrop" onClick={closeDetailModal}>
          <div className="docs-modal docs-modal--view" onClick={(e) => e.stopPropagation()}>
            <div className="docs-modal__head">
              <div className="docs-detail-header">
                <span className="docs-detail-type">
                  {(() => {
                    const Icon = DOC_TYPE_ICON[selectedItem.tipo];
                    return (
                      <>
                        <Icon size={18} />
                        {DOC_TYPE_LABEL[selectedItem.tipo]}
                      </>
                    );
                  })()}
                </span>
                <h2 className="docs-modal__title">{selectedItem.titulo}</h2>
              </div>
              <button
                type="button"
                className="docs-modal__close"
                onClick={closeDetailModal}
                aria-label="Fechar"
              >
                <X size={20} />
              </button>
            </div>
            <div className="docs-modal__body docs-detail-body">
              {selectedItem.descricao && (
                <div className="docs-detail-block">
                  <label className="docs-form-label">Descrição</label>
                  <p className="docs-detail-text">{selectedItem.descricao}</p>
                </div>
              )}
              {(selectedItem.tipo === 'link' || selectedItem.tipo === 'video') && selectedItem.url && (
                <div className="docs-detail-block">
                  <label className="docs-form-label">URL</label>
                  <div className="docs-detail-actions">
                    <code className="docs-detail-url">{selectedItem.url}</code>
                    <div className="docs-detail-buttons">
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => openUrl(selectedItem.url!)}
                      >
                        <ExternalLink size={14} />
                        Abrir
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => copyToClipboard(selectedItem.url!, 'Link')}
                      >
                        <Copy size={14} />
                        Copiar
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {selectedItem.tipo === 'documento' && selectedItem.conteudoSensivel && (
                <div className="docs-detail-block">
                  <label className="docs-form-label">Conteúdo</label>
                  <pre className="docs-detail-pre">{selectedItem.conteudoSensivel}</pre>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ marginTop: 'var(--spacing-sm)' }}
                    onClick={() => copyToClipboard(selectedItem.conteudoSensivel!, 'Conteúdo')}
                  >
                    <Copy size={14} />
                    Copiar conteúdo
                  </button>
                </div>
              )}
              {selectedItem.tipo === 'credencial' && (
                <div className="docs-detail-block">
                  {selectedItem.usuario && (
                    <div className="docs-detail-field">
                      <label className="docs-form-label">Usuário / Login</label>
                      <div className="docs-detail-actions">
                        <code className="docs-detail-code">{selectedItem.usuario}</code>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => copyToClipboard(selectedItem.usuario!, 'Usuário')}
                        >
                          <Copy size={14} />
                          Copiar
                        </button>
                      </div>
                    </div>
                  )}
                  {selectedItem.conteudoSensivel && (
                    <div className="docs-detail-field">
                      <label className="docs-form-label">Senha / Token</label>
                      <div className="docs-detail-actions">
                        <code className="docs-detail-code">
                          {showPassword ? selectedItem.conteudoSensivel : '••••••••••••'}
                        </code>
                        <div className="docs-detail-buttons">
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setShowPassword((p) => !p)}
                          >
                            {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                            {showPassword ? 'Ocultar' : 'Mostrar'}
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => copyToClipboard(selectedItem.conteudoSensivel!, 'Senha')}
                          >
                            <Copy size={14} />
                            Copiar
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {selectedItem.tags.length > 0 && (
                <div className="docs-detail-block">
                  <label className="docs-form-label">Tags</label>
                  <div className="docs-detail-tags">
                    {selectedItem.tags.map((t) => (
                      <span key={t} className="docs-tag">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="docs-detail-meta">
                Criado em {formatDate(selectedItem.criadoEm)}
                {selectedItem.atualizadoEm && ` · Atualizado em ${formatDate(selectedItem.atualizadoEm)}`}
              </div>
              <div className="docs-detail-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => startEditItem(selectedItem)}
                >
                  <Pencil size={16} />
                  Editar
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => handleDeleteItem(selectedItem)}
                >
                  <Trash2 size={16} />
                  Excluir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal editar repositório */}
      {showEditRepoModal && repo && (
        <div className="docs-modal-backdrop" onClick={() => setShowEditRepoModal(false)}>
          <div className="docs-modal" onClick={(e) => e.stopPropagation()}>
            <div className="docs-modal__head">
              <div>
                <h2 className="docs-modal__title">Editar repositório</h2>
                <p className="docs-modal__subtitle">Altere nome e descrição do repositório.</p>
              </div>
              <button
                type="button"
                className="docs-modal__close"
                onClick={() => setShowEditRepoModal(false)}
                aria-label="Fechar"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveEditRepo} className="docs-modal__form">
              <div className="docs-form-grid">
                <div className="docs-form-group docs-form-group--full">
                  <label className="docs-form-label">Nome do repositório</label>
                  <input
                    type="text"
                    required
                    value={editRepoName}
                    onChange={(e) => setEditRepoName(e.target.value)}
                    placeholder="Ex: Procedimentos de rede"
                    className="docs-form-input"
                  />
                </div>
                <div className="docs-form-group docs-form-group--full">
                  <label className="docs-form-label">Descrição</label>
                  <textarea
                    rows={3}
                    value={editRepoDesc}
                    onChange={(e) => setEditRepoDesc(e.target.value)}
                    placeholder="Breve descrição."
                    className="docs-form-input docs-form-textarea"
                  />
                </div>
              </div>
              <div className="docs-modal-footer">
                <div className="docs-modal-footer__actions" style={{ marginLeft: 0 }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowEditRepoModal(false)}
                  >
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
    </div>
  );
}
