import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  FolderKanban,
  Plus,
  MoreHorizontal,
  Trash2,
  LayoutList,
  X,
  ArrowRight,
  Calendar,
} from 'lucide-react';
import { usePermissions, RESOURCES, ACTIONS } from '../hooks/usePermissions';

interface Project {
  id: number;
  name: string;
  description: string | null;
  created_by: number;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
  tasks_count: number;
}

function ProjectCardSkeleton() {
  return (
    <div className="project-card project-card--skeleton">
      <div className="project-card__accent" />
      <div className="project-card__body">
        <div className="project-card__menu-wrap">
          <div className="skeleton skeleton--circle" style={{ width: 28, height: 28 }} />
        </div>
        <div className="skeleton skeleton--line" style={{ width: '70%', height: 22, marginBottom: 12 }} />
        <div className="skeleton skeleton--line" style={{ width: '100%', height: 14, marginBottom: 6 }} />
        <div className="skeleton skeleton--line" style={{ width: '85%', height: 14, marginBottom: 20 }} />
        <div className="project-card__footer">
          <div className="skeleton skeleton--pill" style={{ width: 72, height: 24 }} />
          <div className="skeleton skeleton--line" style={{ width: 80, height: 14 }} />
        </div>
      </div>
    </div>
  );
}

export default function Projetos() {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const menuRef = useRef<HTMLDivElement>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showMenuId, setShowMenuId] = useState<number | null>(null);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canCreate = hasPermission(RESOURCES.PROJECTS, ACTIONS.CREATE);
  const canEdit = hasPermission(RESOURCES.PROJECTS, ACTIONS.EDIT);
  const canDelete = hasPermission(RESOURCES.PROJECTS, ACTIONS.DELETE);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showMenuId != null && menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenuId]);

  const fetchProjects = async () => {
    try {
      setError(null);
      const res = await axios.get<Project[]>('/api/projects');
      setProjects(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao carregar projetos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;
    setSubmitting(true);
    try {
      const res = await axios.post<Project>('/api/projects', {
        name: formName.trim(),
        description: formDescription.trim() || null,
      });
      setShowModal(false);
      setFormName('');
      setFormDescription('');
      navigate(`/projetos/${res.data.id}`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao criar projeto');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!window.confirm(`Excluir o projeto "${name}"? Esta ação não pode ser desfeita.`)) return;
    try {
      await axios.delete(`/api/projects/${id}`);
      setProjects((prev) => prev.filter((p) => p.id !== id));
      setShowMenuId(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao excluir');
    }
  };

  const formatDate = (s: string) => {
    const d = new Date(s);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div className="projects-page">
      <header className="projects-page__header">
        <div className="projects-page__title-block">
          <div className="projects-page__icon-wrap">
            <FolderKanban size={28} strokeWidth={2} />
          </div>
          <div>
            <h1 className="projects-page__title">Projetos</h1>
            <p className="projects-page__subtitle">Gestão de projetos e quadros Kanban</p>
          </div>
        </div>
        {canCreate && (
          <button
            type="button"
            className="btn btn-primary projects-page__cta"
            onClick={() => setShowModal(true)}
          >
            <Plus size={20} aria-hidden />
            Novo projeto
          </button>
        )}
      </header>

      {error && (
        <div className="projects-page__error" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <div className="projects-page__grid">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <ProjectCardSkeleton key={i} />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="projects-page__empty">
          <div className="projects-page__empty-icon">
            <LayoutList size={56} strokeWidth={1.2} />
          </div>
          <h2 className="projects-page__empty-title">Nenhum projeto ainda</h2>
          <p className="projects-page__empty-text">
            Crie o primeiro projeto para começar a organizar tarefas em quadros Kanban, sprints e métricas.
          </p>
          {canCreate && (
            <button type="button" className="btn btn-primary projects-page__empty-cta" onClick={() => setShowModal(true)}>
              <Plus size={20} aria-hidden />
              Criar primeiro projeto
            </button>
          )}
        </div>
      ) : (
        <div className="projects-page__grid">
          {projects.map((project) => (
            <article key={project.id} className="project-card">
              <div className="project-card__accent" />
              <div className="project-card__body">
                <div className="project-card__menu-wrap" ref={showMenuId === project.id ? menuRef : undefined}>
                  {(canEdit || canDelete) && (
                    <>
                      <button
                        type="button"
                        className="project-card__menu-btn"
                        onClick={(e) => {
                          e.preventDefault();
                          setShowMenuId(showMenuId === project.id ? null : project.id);
                        }}
                        aria-expanded={showMenuId === project.id}
                        aria-haspopup="true"
                      >
                        <MoreHorizontal size={20} aria-hidden />
                      </button>
                      {showMenuId === project.id && (
                        <div className="project-card__dropdown">
                          {canDelete && (
                            <button
                              type="button"
                              className="project-card__dropdown-item project-card__dropdown-item--danger"
                              onClick={(e) => {
                                e.preventDefault();
                                handleDelete(project.id, project.name);
                              }}
                            >
                              <Trash2 size={16} aria-hidden />
                              Excluir
                            </button>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
                <Link to={`/projetos/${project.id}`} className="project-card__link">
                  <h3 className="project-card__name">{project.name}</h3>
                  {project.description ? (
                    <p className="project-card__description">{project.description}</p>
                  ) : (
                    <p className="project-card__description project-card__description--muted">
                      Sem descrição
                    </p>
                  )}
                  <div className="project-card__footer">
                    <span className="project-card__badge">
                      {project.tasks_count ?? 0} {project.tasks_count === 1 ? 'tarefa' : 'tarefas'}
                    </span>
                    <span className="project-card__date">
                      <Calendar size={14} aria-hidden />
                      {formatDate(project.updated_at)}
                    </span>
                  </div>
                  <span className="project-card__action">
                    Abrir quadro
                    <ArrowRight size={18} aria-hidden />
                  </span>
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}

      {showModal && (
        <div
          className="projects-modal-backdrop"
          onClick={() => !submitting && setShowModal(false)}
          role="presentation"
        >
          <div
            className="projects-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="modal-title"
            aria-modal="true"
          >
            <div className="projects-modal__head">
              <h2 id="modal-title" className="projects-modal__title">
                Novo projeto
              </h2>
              <button
                type="button"
                className="projects-modal__close"
                onClick={() => !submitting && setShowModal(false)}
                aria-label="Fechar"
              >
                <X size={22} aria-hidden />
              </button>
            </div>
            <form onSubmit={handleCreate} className="projects-modal__form">
              <label htmlFor="project-name" className="projects-modal__label">
                Nome *
              </label>
              <input
                id="project-name"
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Ex: App Mobile"
                required
                className="input projects-modal__input"
                autoFocus
              />
              <label htmlFor="project-desc" className="projects-modal__label">
                Descrição
              </label>
              <textarea
                id="project-desc"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Breve descrição do projeto"
                className="input projects-modal__textarea"
                rows={3}
              />
              <div className="projects-modal__actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => !submitting && setShowModal(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting || !formName.trim()}>
                  {submitting ? 'Criando...' : 'Criar projeto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
