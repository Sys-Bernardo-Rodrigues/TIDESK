import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Plus, X, Save, ExternalLink } from 'lucide-react';

interface PageButton {
  id: string;
  label: string;
  formId?: number;
  url?: string;
  style?: {
    backgroundColor?: string;
    color?: string;
    size?: 'small' | 'medium' | 'large';
  };
}

interface Page {
  id: number;
  title: string;
  description: string | null;
  slug: string;
  content: string | null;
  buttons: PageButton[];
}

interface Form {
  id: number;
  name: string;
  public_url: string;
}

export default function PageBuilder() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const [currentPage, setCurrentPage] = useState<Partial<Page>>({
    title: '',
    description: '',
    slug: '',
    content: '',
    buttons: []
  });
  const [availableForms, setAvailableForms] = useState<Form[]>([]);
  const [selectedButton, setSelectedButton] = useState<PageButton | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchForms();
    if (id) {
      loadPage();
    }
  }, [id]);

  const fetchForms = async () => {
    try {
      const response = await axios.get('/api/forms');
      setAvailableForms(response.data.map((form: any) => ({
        id: form.id,
        name: form.name,
        public_url: form.public_url || form.publicUrl
      })));
    } catch (error) {
      console.error('Erro ao buscar formulários:', error);
    }
  };

  const loadPage = async () => {
    try {
      const response = await axios.get(`/api/pages/${id}`);
      const pageData = response.data;
      setCurrentPage({
        title: pageData.title,
        description: pageData.description || '',
        slug: pageData.slug,
        content: pageData.content || '',
        buttons: pageData.buttons?.map((btn: any) => ({
          id: btn.id.toString(),
          label: btn.label,
          formId: btn.formId,
          url: btn.url,
          style: btn.style || {}
        })) || []
      });
    } catch (error: any) {
      console.error('Erro ao carregar página:', error);
      alert('Erro ao carregar página');
      navigate('/create/pages');
    }
  };

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const handleTitleChange = (title: string) => {
    setCurrentPage({
      ...currentPage,
      title,
      slug: currentPage.slug || generateSlug(title)
    });
  };

  const addButton = () => {
    const newButton: PageButton = {
      id: Date.now().toString(),
      label: 'Novo Botão',
      style: {
        backgroundColor: 'var(--purple)',
        color: '#FFFFFF',
        size: 'medium'
      }
    };
    setCurrentPage({
      ...currentPage,
      buttons: [...(currentPage.buttons || []), newButton]
    });
    setSelectedButton(newButton);
  };

  const updateButton = (buttonId: string, updates: Partial<PageButton>) => {
    setCurrentPage({
      ...currentPage,
      buttons: currentPage.buttons?.map(btn =>
        btn.id === buttonId ? { ...btn, ...updates } : btn
      )
    });
    if (selectedButton?.id === buttonId) {
      setSelectedButton({ ...selectedButton, ...updates });
    }
  };

  const removeButton = (buttonId: string) => {
    setCurrentPage({
      ...currentPage,
      buttons: currentPage.buttons?.filter(btn => btn.id !== buttonId)
    });
    if (selectedButton?.id === buttonId) {
      setSelectedButton(null);
    }
  };

  const handleSave = async () => {
    if (!currentPage.title || !currentPage.slug) {
      alert('Preencha o título e o slug da página');
      return;
    }

    setLoading(true);
    try {
      const pageData = {
        title: currentPage.title,
        description: currentPage.description || null,
        slug: currentPage.slug,
        content: currentPage.content || null,
        buttons: currentPage.buttons?.map(btn => ({
          label: btn.label,
          formId: btn.formId,
          url: btn.url,
          style: btn.style
        })) || []
      };

      if (id) {
        await axios.put(`/api/pages/${id}`, pageData);
        alert('Página atualizada com sucesso!');
      } else {
        await axios.post('/api/pages', pageData);
        alert('Página criada com sucesso!');
      }

      navigate('/create/pages');
    } catch (error: any) {
      console.error('Erro ao salvar página:', error);
      alert(error.response?.data?.error || 'Erro ao salvar página. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (currentPage.title || (currentPage.buttons && currentPage.buttons.length > 0)) {
      if (window.confirm('Tem certeza que deseja sair? As alterações não salvas serão perdidas.')) {
        navigate('/create/pages');
      }
    } else {
      navigate('/create/pages');
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: 'var(--spacing-2xl)'
      }}>
        <div>
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
            {id ? 'Editar Página' : 'Nova Página'}
          </h1>
          <p style={{
            color: 'var(--text-secondary)',
            fontSize: '1rem',
            fontWeight: '400'
          }}>
            Crie páginas públicas com botões que redirecionam para formulários
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
          <button 
            className="btn btn-secondary"
            onClick={handleBack}
          >
            <ArrowLeft size={20} />
            Voltar
          </button>
          <button 
            className="btn btn-primary"
            onClick={handleSave}
            disabled={loading}
          >
            <Save size={20} />
            {loading ? 'Salvando...' : 'Salvar Página'}
          </button>
        </div>
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr',
        gap: 'var(--spacing-xl)'
      }}>
        {/* Painel Esquerdo - Configurações */}
        <div className="card" style={{ 
          border: '1px solid var(--border-primary)',
          padding: 'var(--spacing-xl)'
        }}>
          <h2 style={{ 
            fontSize: '1.5rem',
            fontWeight: '700',
            color: 'var(--text-primary)',
            marginBottom: 'var(--spacing-lg)'
          }}>
            Configurações da Página
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
            <div>
              <label className="label">Título *</label>
              <input
                type="text"
                className="input"
                value={currentPage.title || ''}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="Ex: Página Inicial"
              />
            </div>

            <div>
              <label className="label">Slug *</label>
              <input
                type="text"
                className="input"
                value={currentPage.slug || ''}
                onChange={(e) => setCurrentPage({ ...currentPage, slug: e.target.value })}
                placeholder="ex: pagina-inicial"
              />
              <small style={{ 
                display: 'block', 
                marginTop: 'var(--spacing-xs)',
                color: 'var(--text-tertiary)',
                fontSize: '0.75rem'
              }}>
                URL: /page/{currentPage.slug || 'slug'}
              </small>
            </div>

            <div>
              <label className="label">Descrição</label>
              <textarea
                className="input"
                value={currentPage.description || ''}
                onChange={(e) => setCurrentPage({ ...currentPage, description: e.target.value })}
                placeholder="Descrição da página..."
                rows={3}
              />
            </div>

            <div>
              <label className="label">Conteúdo (HTML opcional)</label>
              <textarea
                className="input"
                value={currentPage.content || ''}
                onChange={(e) => setCurrentPage({ ...currentPage, content: e.target.value })}
                placeholder="Conteúdo HTML da página..."
                rows={6}
                style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}
              />
            </div>
          </div>

          {/* Lista de Botões */}
          <div style={{ marginTop: 'var(--spacing-2xl)' }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 'var(--spacing-md)'
            }}>
              <h3 style={{ 
                fontSize: '1.125rem',
                fontWeight: '600',
                color: 'var(--text-primary)'
              }}>
                Botões
              </h3>
              <button 
                className="btn btn-primary btn-sm"
                onClick={addButton}
              >
                <Plus size={16} />
                Adicionar Botão
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
              {currentPage.buttons?.length === 0 ? (
                <p style={{ 
                  color: 'var(--text-tertiary)',
                  fontSize: '0.875rem',
                  textAlign: 'center',
                  padding: 'var(--spacing-lg)'
                }}>
                  Nenhum botão adicionado ainda
                </p>
              ) : (
                currentPage.buttons?.map((button) => (
                  <div
                    key={button.id}
                    className="card"
                    style={{
                      border: selectedButton?.id === button.id 
                        ? '2px solid var(--purple)' 
                        : '1px solid var(--border-primary)',
                      padding: 'var(--spacing-md)',
                      cursor: 'pointer',
                      transition: 'all var(--transition-base)',
                      backgroundColor: selectedButton?.id === button.id 
                        ? 'var(--purple-light)' 
                        : 'var(--bg-secondary)'
                    }}
                    onClick={() => setSelectedButton(button)}
                  >
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div>
                        <div style={{ 
                          fontWeight: '600',
                          color: 'var(--text-primary)',
                          marginBottom: 'var(--spacing-xs)'
                        }}>
                          {button.label}
                        </div>
                        <div style={{ 
                          fontSize: '0.75rem',
                          color: 'var(--text-secondary)'
                        }}>
                          {button.formId 
                            ? `Formulário: ${availableForms.find(f => f.id === button.formId)?.name || 'N/A'}`
                            : button.url 
                            ? `URL: ${button.url}`
                            : 'Sem destino'}
                        </div>
                      </div>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeButton(button.id);
                        }}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Painel Direito - Editor de Botão / Preview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xl)' }}>
          {/* Editor de Botão */}
          {selectedButton ? (
            <div className="card" style={{ 
              border: '1px solid var(--border-primary)',
              padding: 'var(--spacing-xl)'
            }}>
              <h2 style={{ 
                fontSize: '1.5rem',
                fontWeight: '700',
                color: 'var(--text-primary)',
                marginBottom: 'var(--spacing-lg)'
              }}>
                Editar Botão
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
                <div>
                  <label className="label">Rótulo do Botão *</label>
                  <input
                    type="text"
                    className="input"
                    value={selectedButton.label}
                    onChange={(e) => updateButton(selectedButton.id, { label: e.target.value })}
                    placeholder="Ex: Preencher Formulário"
                  />
                </div>

                <div>
                  <label className="label">Tipo de Destino</label>
                  <select
                    className="select"
                    value={selectedButton.formId ? 'form' : 'url'}
                    onChange={(e) => {
                      if (e.target.value === 'form') {
                        updateButton(selectedButton.id, { formId: undefined, url: undefined });
                      } else {
                        updateButton(selectedButton.id, { formId: undefined, url: '' });
                      }
                    }}
                  >
                    <option value="form">Formulário</option>
                    <option value="url">URL Externa</option>
                  </select>
                </div>

                {selectedButton.formId !== undefined || !selectedButton.url ? (
                  <div>
                    <label className="label">Formulário</label>
                    <select
                      className="select"
                      value={selectedButton.formId || ''}
                      onChange={(e) => updateButton(selectedButton.id, { 
                        formId: e.target.value ? parseInt(e.target.value) : undefined,
                        url: undefined
                      })}
                    >
                      <option value="">Selecione um formulário</option>
                      {availableForms.map(form => (
                        <option key={form.id} value={form.id}>
                          {form.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="label">URL Externa</label>
                    <input
                      type="text"
                      className="input"
                      value={selectedButton.url || ''}
                      onChange={(e) => updateButton(selectedButton.id, { 
                        url: e.target.value,
                        formId: undefined
                      })}
                      placeholder="https://exemplo.com"
                    />
                  </div>
                )}

                <div>
                  <label className="label">Tamanho</label>
                  <select
                    className="select"
                    value={selectedButton.style?.size || 'medium'}
                    onChange={(e) => updateButton(selectedButton.id, {
                      style: { ...selectedButton.style, size: e.target.value }
                    })}
                  >
                    <option value="small">Pequeno</option>
                    <option value="medium">Médio</option>
                    <option value="large">Grande</option>
                  </select>
                </div>

                <div>
                  <label className="label">Cor de Fundo</label>
                  <input
                    type="color"
                    value={selectedButton.style?.backgroundColor || '#9147FF'}
                    onChange={(e) => updateButton(selectedButton.id, {
                      style: { ...selectedButton.style, backgroundColor: e.target.value }
                    })}
                    style={{ width: '100%', height: '40px', borderRadius: 'var(--radius-md)' }}
                  />
                </div>

                <div>
                  <label className="label">Cor do Texto</label>
                  <input
                    type="color"
                    value={selectedButton.style?.color || '#FFFFFF'}
                    onChange={(e) => updateButton(selectedButton.id, {
                      style: { ...selectedButton.style, color: e.target.value }
                    })}
                    style={{ width: '100%', height: '40px', borderRadius: 'var(--radius-md)' }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="card" style={{ 
              border: '1px solid var(--border-primary)',
              padding: 'var(--spacing-xl)',
              textAlign: 'center'
            }}>
              <p style={{ color: 'var(--text-tertiary)' }}>
                Selecione um botão para editar ou adicione um novo botão
              </p>
            </div>
          )}

          {/* Preview */}
          <div className="card" style={{ 
            border: '1px solid var(--border-primary)',
            padding: 'var(--spacing-xl)'
          }}>
            <h2 style={{ 
              fontSize: '1.5rem',
              fontWeight: '700',
              color: 'var(--text-primary)',
              marginBottom: 'var(--spacing-lg)'
            }}>
              Preview
            </h2>

            <div style={{
              minHeight: '400px',
              padding: 'var(--spacing-xl)',
              background: 'var(--bg-primary)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-primary)'
            }}>
              {currentPage.title && (
                <h1 style={{ 
                  fontSize: '2rem',
                  fontWeight: '700',
                  color: 'var(--text-primary)',
                  marginBottom: 'var(--spacing-md)'
                }}>
                  {currentPage.title}
                </h1>
              )}
              {currentPage.description && (
                <p style={{ 
                  color: 'var(--text-secondary)',
                  marginBottom: 'var(--spacing-lg)'
                }}>
                  {currentPage.description}
                </p>
              )}
              {currentPage.content && (
                <div 
                  style={{ 
                    marginBottom: 'var(--spacing-lg)',
                    color: 'var(--text-primary)'
                  }}
                  dangerouslySetInnerHTML={{ __html: currentPage.content }}
                />
              )}
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column',
                gap: 'var(--spacing-md)',
                marginTop: 'var(--spacing-xl)'
              }}>
                {currentPage.buttons?.map((button) => {
                  const sizeMap = {
                    small: { padding: 'var(--spacing-xs) var(--spacing-md)', fontSize: '0.875rem' },
                    medium: { padding: 'var(--spacing-sm) var(--spacing-lg)', fontSize: '1rem' },
                    large: { padding: 'var(--spacing-md) var(--spacing-xl)', fontSize: '1.125rem' }
                  };
                  const size = sizeMap[button.style?.size || 'medium'];
                  
                  return (
                    <button
                      key={button.id}
                      className="btn"
                      style={{
                        backgroundColor: button.style?.backgroundColor || 'var(--purple)',
                        color: button.style?.color || '#FFFFFF',
                        ...size,
                        width: '100%',
                        justifyContent: 'center'
                      }}
                      onClick={() => {
                        if (button.formId) {
                          const form = availableForms.find(f => f.id === button.formId);
                          if (form) {
                            window.open(`/form/${form.public_url}`, '_blank');
                          }
                        } else if (button.url) {
                          window.open(button.url, '_blank');
                        }
                      }}
                    >
                      {button.label}
                      {button.formId && <ExternalLink size={16} style={{ marginLeft: 'var(--spacing-xs)' }} />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
