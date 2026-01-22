import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { FileEdit, Plus, Search, Edit, Trash2, Eye, Copy, Link as LinkIcon, Users, User } from 'lucide-react';
import { formatDateBR } from '../utils/dateUtils';

interface FormField {
  id: string;
  type: 'text' | 'email' | 'number' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'date';
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[]; // Para select, radio
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
}

interface Form {
  id: number;
  name: string;
  description: string;
  fields: FormField[];
  publicUrl: string;
  linkedUserId?: number;
  linkedGroupId?: number;
  linkedUserName?: string;
  linkedGroupName?: string;
  submissions: number;
  created: string;
}

export default function Forms() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [forms, setForms] = useState<Form[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchForms();
  }, []);

  const fetchForms = async () => {
    try {
      const response = await axios.get('/api/forms');
      const formsData = response.data.map((form: any) => ({
        id: form.id,
        name: form.name,
        description: form.description || '',
        fields: form.fields || [],
        publicUrl: `/form/${form.public_url}`,
        linkedUserId: form.linked_user_id,
        linkedGroupId: form.linked_group_id,
        linkedUserName: form.linked_user_name,
        linkedGroupName: form.linked_group_name,
        submissions: form.submissions_count || 0,
        created: form.created_at
      }));
      setForms(formsData);
    } catch (error) {
      console.error('Erro ao buscar formulários:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (formId: number) => {
    if (!window.confirm('Tem certeza que deseja excluir este formulário?')) {
      return;
    }

    try {
      await axios.delete(`/api/forms/${formId}`);
      setForms(forms.filter(f => f.id !== formId));
      alert('Formulário excluído com sucesso!');
    } catch (error: any) {
      console.error('Erro ao excluir formulário:', error);
      alert(error.response?.data?.error || 'Erro ao excluir formulário');
    }
  };

  const filteredForms = forms.filter(form =>
    form.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    form.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(`${window.location.origin}${url}`);
    alert('URL copiada para a área de transferência!');
  };

  const startCreatingForm = () => {
    navigate('/create/forms/builder');
  };

  const handleEdit = (formId: number) => {
    navigate(`/create/forms/builder/${formId}`);
  };

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
          Formulários
        </h1>
        <p style={{
          color: 'var(--text-secondary)',
          fontSize: '1rem',
          fontWeight: '400'
        }}>
          Crie formulários públicos e gerencie submissões que geram tickets automaticamente
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
            placeholder="Buscar formulários..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '2.75rem' }}
          />
        </div>
        <button 
          className="btn btn-primary"
          onClick={startCreatingForm}
        >
          <Plus size={20} />
          Novo Formulário
        </button>
      </div>

      {loading ? (
        <div className="card" style={{ 
          textAlign: 'center', 
          padding: 'var(--spacing-2xl)',
          border: '1px solid var(--border-primary)'
        }}>
          <p style={{ color: 'var(--text-secondary)' }}>Carregando formulários...</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          {filteredForms.length === 0 ? (
          <div className="card" style={{ 
            textAlign: 'center', 
            padding: 'var(--spacing-2xl)',
            border: '1px solid var(--border-primary)'
          }}>
            <FileEdit size={48} color="var(--text-tertiary)" style={{ marginBottom: 'var(--spacing-md)' }} />
            <p style={{ 
              color: 'var(--text-secondary)',
              fontSize: '1rem',
              marginBottom: 'var(--spacing-sm)'
            }}>
              {searchTerm ? 'Nenhum formulário encontrado' : 'Nenhum formulário criado ainda'}
            </p>
            {!searchTerm && (
              <button 
                className="btn btn-primary" 
                style={{ marginTop: 'var(--spacing-md)' }}
                onClick={startCreatingForm}
              >
                <Plus size={20} />
                Criar Primeiro Formulário
              </button>
            )}
          </div>
        ) : (
          filteredForms.map((form) => (
            <div key={form.id} className="card" style={{ 
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
                  <FileEdit size={20} color="var(--blue)" />
                  <h3 style={{ 
                    fontSize: '1.125rem', 
                    fontWeight: '600',
                    color: 'var(--text-primary)'
                  }}>
                    {form.name}
                  </h3>
                  {form.linkedUserId && (
                    <span style={{
                      fontSize: '0.75rem',
                      padding: '0.25rem 0.5rem',
                      borderRadius: 'var(--radius-full)',
                      background: 'var(--purple-light)',
                      color: 'var(--purple)',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem'
                    }}>
                      <User size={12} />
                      {form.linkedUserName}
                    </span>
                  )}
                  {form.linkedGroupId && (
                    <span style={{
                      fontSize: '0.75rem',
                      padding: '0.25rem 0.5rem',
                      borderRadius: 'var(--radius-full)',
                      background: 'var(--blue-light)',
                      color: 'var(--blue)',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem'
                    }}>
                      <Users size={12} />
                      {form.linkedGroupName}
                    </span>
                  )}
                </div>
                <p style={{ 
                  fontSize: '0.875rem',
                  color: 'var(--text-secondary)',
                  marginLeft: '2.25rem',
                  marginBottom: 'var(--spacing-xs)'
                }}>
                  {form.description}
                </p>
                <div style={{ 
                  display: 'flex', 
                  gap: 'var(--spacing-lg)',
                  fontSize: '0.875rem',
                  color: 'var(--text-secondary)',
                  marginLeft: '2.25rem',
                  flexWrap: 'wrap'
                }}>
                  <span><strong>{form.fields.length}</strong> campos</span>
                  <span><strong>{form.submissions}</strong> submissões</span>
                  <span><strong>Criado:</strong> {formatDateBR(form.created)}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
                    <LinkIcon size={14} />
                    <span style={{ 
                      color: 'var(--purple)',
                      textDecoration: 'underline',
                      cursor: 'pointer'
                    }}
                    onClick={() => copyUrl(form.publicUrl)}
                    >
                      {form.publicUrl}
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
                  onClick={() => window.open(form.publicUrl, '_blank')}
                >
                  <Eye size={16} />
                  Visualizar
                </button>
                <button 
                  className="btn btn-secondary btn-sm"
                  onClick={() => copyUrl(form.publicUrl)}
                >
                  <Copy size={16} />
                  Copiar URL
                </button>
                <button 
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleEdit(form.id)}
                >
                  <Edit size={16} />
                  Editar
                </button>
                <button 
                  className="btn btn-danger btn-sm"
                  onClick={() => handleDelete(form.id)}
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
