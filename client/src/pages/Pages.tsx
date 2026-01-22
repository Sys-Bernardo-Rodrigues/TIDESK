import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { FileText, Plus, Search, Edit, Trash2, Eye, Copy, Link as LinkIcon } from 'lucide-react';
import { formatDateBR } from '../utils/dateUtils';

interface PageButton {
  id: number;
  label: string;
  formId?: number;
  formName?: string;
  formUrl?: string;
  url?: string;
  style?: any;
  orderIndex: number;
}

interface Page {
  id: number;
  title: string;
  description: string | null;
  slug: string;
  content: string | null;
  publicUrl: string;
  buttons: PageButton[];
  buttons_count: number;
  created_at: string;
  updated_at: string;
}

export default function Pages() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPages();
  }, []);

  const fetchPages = async () => {
    try {
      const response = await axios.get('/api/pages');
      const pagesData = response.data.map((page: any) => ({
        id: page.id,
        title: page.title,
        description: page.description || '',
        slug: page.slug,
        content: page.content || '',
        publicUrl: `/page/${page.slug}`,
        buttons: page.buttons || [],
        buttons_count: page.buttons_count || 0,
        created_at: page.created_at,
        updated_at: page.updated_at
      }));
      setPages(pagesData);
    } catch (error) {
      console.error('Erro ao buscar páginas:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (pageId: number) => {
    if (!window.confirm('Tem certeza que deseja excluir esta página?')) {
      return;
    }

    try {
      await axios.delete(`/api/pages/${pageId}`);
      setPages(pages.filter(p => p.id !== pageId));
      alert('Página excluída com sucesso!');
    } catch (error: any) {
      console.error('Erro ao excluir página:', error);
      alert(error.response?.data?.error || 'Erro ao excluir página');
    }
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(`${window.location.origin}${url}`);
    alert('URL copiada para a área de transferência!');
  };

  const startCreatingPage = () => {
    navigate('/create/pages/builder');
  };

  const handleEdit = (pageId: number) => {
    navigate(`/create/pages/builder/${pageId}`);
  };

  const filteredPages = pages.filter(page =>
    page.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    page.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (page.description && page.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div>
      <div style={{ marginBottom: 'var(--spacing-2xl)' }}>
        <h1 style={{ 
          fontSize: '2.5rem', 
          fontWeight: '800', 
          marginBottom: 'var(--spacing-sm)',
          background: 'linear-gradient(135deg, var(--text-primary) 0%, var(--text-secondary) 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          letterSpacing: '-0.03em'
        }}>
          Páginas
        </h1>
        <p style={{
          color: 'var(--text-secondary)',
          fontSize: '1rem',
          fontWeight: '400'
        }}>
          Gerencie as páginas do sistema
        </p>
      </div>

      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: 'var(--spacing-lg)',
        gap: 'var(--spacing-md)',
        flexWrap: 'wrap'
      }}>
        <div style={{ 
          position: 'relative',
          flex: '1',
          minWidth: '300px',
          maxWidth: '500px'
        }}>
          <Search 
            size={20} 
            style={{ 
              position: 'absolute', 
              left: 'var(--spacing-md)', 
              top: '50%', 
              transform: 'translateY(-50%)',
              color: 'var(--text-tertiary)',
              pointerEvents: 'none'
            }} 
          />
          <input
            type="text"
            className="input"
            placeholder="Buscar páginas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '2.75rem' }}
          />
        </div>
        <button 
          className="btn btn-primary"
          onClick={startCreatingPage}
        >
          <Plus size={20} />
          Nova Página
        </button>
      </div>

      {loading ? (
        <div className="card" style={{ 
          textAlign: 'center', 
          padding: 'var(--spacing-2xl)',
          border: '1px solid var(--border-primary)'
        }}>
          <p style={{ color: 'var(--text-secondary)' }}>Carregando páginas...</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          {filteredPages.length === 0 ? (
          <div className="card" style={{ 
            textAlign: 'center', 
            padding: 'var(--spacing-2xl)',
            border: '1px solid var(--border-primary)'
          }}>
            <FileText size={48} color="var(--text-tertiary)" style={{ marginBottom: 'var(--spacing-md)' }} />
            <p style={{ 
              color: 'var(--text-secondary)',
              fontSize: '1rem',
              marginBottom: 'var(--spacing-sm)'
            }}>
              {searchTerm ? 'Nenhuma página encontrada' : 'Nenhuma página criada ainda'}
            </p>
            {!searchTerm && (
              <button 
                className="btn btn-primary" 
                style={{ marginTop: 'var(--spacing-md)' }}
                onClick={startCreatingPage}
              >
                <Plus size={20} />
                Criar Primeira Página
              </button>
            )}
          </div>
        ) : (
          filteredPages.map((page) => (
            <div key={page.id} className="card" style={{ 
              border: '1px solid var(--border-primary)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              transition: 'all var(--transition-base)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-secondary)';
              e.currentTarget.style.boxShadow = 'var(--shadow-md)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-primary)';
              e.currentTarget.style.boxShadow = 'var(--shadow)';
            }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 'var(--spacing-md)',
                  marginBottom: 'var(--spacing-xs)'
                }}>
                  <FileText size={20} color="var(--purple)" />
                  <h3 style={{ 
                    fontSize: '1.125rem', 
                    fontWeight: '600',
                    color: 'var(--text-primary)'
                  }}>
                    {page.title}
                  </h3>
                </div>
                {page.description && (
                  <p style={{ 
                    fontSize: '0.875rem',
                    color: 'var(--text-secondary)',
                    marginLeft: '2.25rem',
                    marginBottom: 'var(--spacing-xs)'
                  }}>
                    {page.description}
                  </p>
                )}
                <div style={{ 
                  display: 'flex', 
                  gap: 'var(--spacing-lg)',
                  fontSize: '0.875rem',
                  color: 'var(--text-secondary)',
                  marginLeft: '2.25rem',
                  flexWrap: 'wrap'
                }}>
                  <span><strong>Slug:</strong> /{page.slug}</span>
                  <span><strong>{page.buttons_count}</strong> botões</span>
                  <span><strong>Criado:</strong> {formatDateBR(page.created_at)}</span>
                  <span><strong>Atualizado:</strong> {formatDateBR(page.updated_at)}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
                    <LinkIcon size={14} />
                    <span style={{ 
                      color: 'var(--purple)',
                      textDecoration: 'underline',
                      cursor: 'pointer'
                    }}
                    onClick={() => copyUrl(page.publicUrl)}
                    >
                      {page.publicUrl}
                    </span>
                  </div>
                </div>
              </div>
              <div style={{ 
                display: 'flex', 
                gap: 'var(--spacing-sm)'
              }}>
                <button 
                  className="btn btn-info btn-sm"
                  onClick={() => window.open(page.publicUrl, '_blank')}
                >
                  <Eye size={16} />
                  Visualizar
                </button>
                <button 
                  className="btn btn-secondary btn-sm"
                  onClick={() => copyUrl(page.publicUrl)}
                >
                  <Copy size={16} />
                  Copiar URL
                </button>
                <button 
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleEdit(page.id)}
                >
                  <Edit size={16} />
                  Editar
                </button>
                <button 
                  className="btn btn-danger btn-sm"
                  onClick={() => handleDelete(page.id)}
                >
                  <Trash2 size={16} />
                  Excluir
                </button>
              </div>
            </div>
          ))
          )}
        </div>
      )}
    </div>
  );
}
