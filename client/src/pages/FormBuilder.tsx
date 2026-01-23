import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Plus, GripVertical, X, Users, User, Settings, Save } from 'lucide-react';

interface FormField {
  id: string;
  type: 'text' | 'email' | 'number' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'date' | 'file' | 'image';
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[];
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    accept?: string; // Para file/image: tipos aceitos (ex: "image/*", ".pdf,.doc")
    maxSize?: number; // Tamanho máximo em MB
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

export default function FormBuilder() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const [currentForm, setCurrentForm] = useState<Partial<Form>>({
    name: '',
    description: '',
    fields: [],
    linkedUserId: undefined,
    linkedGroupId: undefined
  });
  const [selectedField, setSelectedField] = useState<FormField | null>(null);
  const [optionsText, setOptionsText] = useState<string>(''); // Estado separado para o texto das opções
  const [availableUsers, setAvailableUsers] = useState<Array<{ id: number; name: string; email: string }>>([]);
  const [availableGroups, setAvailableGroups] = useState<Array<{ id: number; name: string }>>([]);

  const fieldTypes = [
    { value: 'text', label: 'Texto' },
    { value: 'email', label: 'Email' },
    { value: 'number', label: 'Número' },
    { value: 'textarea', label: 'Área de Texto' },
    { value: 'select', label: 'Seleção' },
    { value: 'checkbox', label: 'Checkbox' },
    { value: 'radio', label: 'Radio' },
    { value: 'date', label: 'Data' },
    { value: 'file', label: 'Arquivo' },
    { value: 'image', label: 'Imagem/Foto' },
  ];

  const generatePublicUrl = () => {
    return `/form/${Math.random().toString(36).substring(2, 15)}`;
  };

  const addField = () => {
    const newField: FormField = {
      id: Date.now().toString(),
      type: 'text',
      label: 'Novo Campo',
      required: false
    };
    setCurrentForm({
      ...currentForm,
      fields: [...(currentForm.fields || []), newField]
    });
    setSelectedField(newField);
    setOptionsText(''); // Limpar texto das opções
  };

  const updateField = (fieldId: string, updates: Partial<FormField>) => {
    setCurrentForm({
      ...currentForm,
      fields: currentForm.fields?.map(f => 
        f.id === fieldId ? { ...f, ...updates } : f
      )
    });
    if (selectedField?.id === fieldId) {
      const updatedField = { ...selectedField, ...updates };
      setSelectedField(updatedField);
      // Sincronizar o texto das opções apenas quando não está sendo editado diretamente
      // (evitar sobrescrever enquanto o usuário digita)
      if (updates.options !== undefined) {
        // Só atualizar se o texto atual não corresponde ao que está sendo atualizado
        const currentText = optionsText;
        const newText = updates.options.join('\n');
        if (currentText !== newText) {
          setOptionsText(newText);
        }
      }
    }
  };

  const removeField = (fieldId: string) => {
    setCurrentForm({
      ...currentForm,
      fields: currentForm.fields?.filter(f => f.id !== fieldId)
    });
    if (selectedField?.id === fieldId) {
      setSelectedField(null);
    }
  };

  const handleSave = async () => {
    if (!currentForm.name || !currentForm.fields || currentForm.fields.length === 0) {
      alert('Preencha o nome e adicione pelo menos um campo ao formulário');
      return;
    }

    try {
      const formData = {
        name: currentForm.name,
        description: currentForm.description || '',
        fields: currentForm.fields?.map(field => ({
          type: field.type,
          label: field.label,
          placeholder: field.placeholder,
          required: field.required,
          options: field.options,
          validation: field.validation
        })),
        linkedUserId: currentForm.linkedUserId,
        linkedGroupId: currentForm.linkedGroupId
      };

      if (id) {
        // Atualizar formulário existente
        await axios.put(`/api/forms/${id}`, formData);
        alert('Formulário atualizado com sucesso!');
      } else {
        // Criar novo formulário
        await axios.post('/api/forms', formData);
        alert('Formulário criado com sucesso!');
      }

      navigate('/create/forms');
    } catch (error: any) {
      console.error('Erro ao salvar formulário:', error);
      alert(error.response?.data?.error || 'Erro ao salvar formulário. Tente novamente.');
    }
  };

  useEffect(() => {
    // Buscar usuários e grupos
    const fetchData = async () => {
      try {
        const [usersResponse, groupsResponse] = await Promise.all([
          axios.get('/api/users'),
          axios.get('/api/groups')
        ]);
        setAvailableUsers(usersResponse.data.map((u: any) => ({ id: u.id, name: u.name, email: u.email })));
        setAvailableGroups(groupsResponse.data.map((g: any) => ({ id: g.id, name: g.name })));
      } catch (error) {
        console.error('Erro ao buscar usuários/grupos:', error);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    // Carregar formulário se estiver editando
    const loadForm = async () => {
      if (id) {
        try {
          const response = await axios.get(`/api/forms/${id}`);
          const formData = response.data;
          
          setCurrentForm({
            name: formData.name,
            description: formData.description || '',
            fields: formData.fields.map((field: any) => ({
              id: field.id,
              type: field.type,
              label: field.label,
              placeholder: field.placeholder,
              required: field.required,
              options: field.options,
              validation: field.validation
            })),
            linkedUserId: formData.linked_user_id,
            linkedGroupId: formData.linked_group_id
          });
        } catch (error: any) {
          console.error('Erro ao carregar formulário:', error);
          alert('Erro ao carregar formulário');
          navigate('/create/forms');
        }
      }
    };

    loadForm();
  }, [id, navigate]);

  const handleBack = () => {
    if (currentForm.name || (currentForm.fields && currentForm.fields.length > 0)) {
      if (window.confirm('Tem certeza que deseja sair? As alterações não salvas serão perdidas.')) {
        navigate('/create/forms');
      }
    } else {
      navigate('/create/forms');
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh',
      backgroundColor: 'var(--bg-primary)',
      padding: 'var(--spacing-2xl)'
    }}>
      <div style={{ maxWidth: '1600px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-md)',
          marginBottom: 'var(--spacing-xl)'
        }}>
          <button
            onClick={handleBack}
            style={{
              padding: 'var(--spacing-sm)',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              background: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all var(--transition-base)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-hover)';
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--bg-tertiary)';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 style={{
              fontSize: '2rem',
              fontWeight: '700',
              color: 'var(--text-primary)',
              margin: 0
            }}>
              Construtor de Formulários
            </h1>
            <p style={{
              fontSize: '0.875rem',
              color: 'var(--text-secondary)',
              margin: 0
            }}>
              {id ? 'Editando formulário' : 'Criando novo formulário'}
            </p>
          </div>
        </div>

        <div style={{ 
          display: 'flex', 
          gap: 'var(--spacing-lg)',
          height: 'calc(100vh - 200px)',
          minHeight: '600px'
        }}>
          {/* Painel Esquerdo - Configurações e Campos */}
          <div style={{ 
            flex: '0 0 380px',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--spacing-md)',
            overflow: 'hidden'
          }}>
            {/* Informações Básicas */}
            <div className="card" style={{ 
              border: '1px solid var(--border-primary)',
              padding: 'var(--spacing-md)',
              overflow: 'auto'
            }}>
              <h3 style={{
                fontSize: '1rem',
                fontWeight: '600',
                color: 'var(--text-primary)',
                marginBottom: 'var(--spacing-md)'
              }}>
                Informações Básicas
              </h3>
              <div style={{ marginBottom: 'var(--spacing-md)' }}>
                <label style={{
                  display: 'block',
                  marginBottom: 'var(--spacing-xs)',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: 'var(--text-secondary)'
                }}>
                  Nome do Formulário *
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="Digite o nome"
                  value={currentForm.name || ''}
                  onChange={(e) => setCurrentForm({ ...currentForm, name: e.target.value })}
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: 'var(--spacing-xs)',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: 'var(--text-secondary)'
                }}>
                  Descrição
                </label>
                <textarea
                  className="input"
                  placeholder="Digite uma descrição"
                  value={currentForm.description || ''}
                  onChange={(e) => setCurrentForm({ ...currentForm, description: e.target.value })}
                  style={{ 
                    width: '100%',
                    minHeight: '80px',
                    resize: 'vertical'
                  }}
                />
              </div>
            </div>

            {/* Vinculação */}
            <div className="card" style={{ 
              border: '1px solid var(--border-primary)',
              padding: 'var(--spacing-md)',
              overflow: 'auto'
            }}>
              <h3 style={{
                fontSize: '1rem',
                fontWeight: '600',
                color: 'var(--text-primary)',
                marginBottom: 'var(--spacing-md)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-xs)'
              }}>
                <Settings size={16} />
                Vinculação (Opcional)
              </h3>
              <p style={{
                fontSize: '0.8125rem',
                color: 'var(--text-tertiary)',
                marginBottom: 'var(--spacing-md)'
              }}>
                Vincule um usuário ou grupo para ativar o fluxo de aprovação obrigatória
              </p>
              
              <div style={{ marginBottom: 'var(--spacing-md)' }}>
                <label style={{
                  display: 'block',
                  marginBottom: 'var(--spacing-xs)',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: 'var(--text-secondary)'
                }}>
                  Vincular Usuário
                </label>
                <select
                  className="select"
                  value={currentForm.linkedUserId || ''}
                  onChange={(e) => setCurrentForm({ 
                    ...currentForm, 
                    linkedUserId: e.target.value ? parseInt(e.target.value) : undefined,
                    linkedGroupId: undefined
                  })}
                  style={{ width: '100%' }}
                >
                  <option value="">Nenhum</option>
                  {availableUsers.map(user => (
                    <option key={user.id} value={user.id}>{user.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{
                  display: 'block',
                  marginBottom: 'var(--spacing-xs)',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: 'var(--text-secondary)'
                }}>
                  Vincular Grupo
                </label>
                <select
                  className="select"
                  value={currentForm.linkedGroupId || ''}
                  onChange={(e) => setCurrentForm({ 
                    ...currentForm, 
                    linkedGroupId: e.target.value ? parseInt(e.target.value) : undefined,
                    linkedUserId: undefined
                  })}
                  style={{ width: '100%' }}
                >
                  <option value="">Nenhum</option>
                  {availableGroups.map(group => (
                    <option key={group.id} value={group.id}>{group.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Lista de Campos */}
            <div className="card" style={{ 
              border: '1px solid var(--border-primary)',
              padding: 'var(--spacing-md)',
              flex: 1,
              minHeight: '200px',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'auto'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 'var(--spacing-md)'
              }}>
                <h3 style={{
                  fontSize: '1rem',
                  fontWeight: '600',
                  color: 'var(--text-primary)'
                }}>
                  Campos ({currentForm.fields?.length || 0})
                </h3>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={addField}
                >
                  <Plus size={16} />
                  Adicionar
                </button>
              </div>
              <div style={{ 
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--spacing-xs)',
                overflow: 'auto',
                flex: 1
              }}>
                {currentForm.fields?.map((field) => (
                  <div
                    key={field.id}
                    style={{
                      padding: 'var(--spacing-sm)',
                      background: selectedField?.id === field.id ? 'var(--purple-light)' : 'var(--bg-tertiary)',
                      border: selectedField?.id === field.id ? '1px solid var(--purple)' : '1px solid var(--border-primary)',
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--spacing-sm)'
                    }}
                    onClick={() => {
                      setSelectedField(field);
                      setOptionsText(field.options?.join('\n') || '');
                    }}
                  >
                    <GripVertical size={16} color="var(--text-tertiary)" />
                    <div style={{ flex: 1 }}>
                      <div style={{ 
                        fontWeight: '500',
                        color: 'var(--text-primary)',
                        fontSize: '0.875rem'
                      }}>
                        {field.label || 'Campo sem nome'}
                      </div>
                      <div style={{ 
                        fontSize: '0.75rem',
                        color: 'var(--text-tertiary)'
                      }}>
                        {fieldTypes.find(t => t.value === field.type)?.label}
                        {field.required && ' • Obrigatório'}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeField(field.id);
                      }}
                      style={{
                        padding: 'var(--spacing-xs)',
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--text-tertiary)',
                        cursor: 'pointer',
                        borderRadius: 'var(--radius-md)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                        e.currentTarget.style.color = 'var(--red)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = 'var(--text-tertiary)';
                      }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
                {(!currentForm.fields || currentForm.fields.length === 0) && (
                  <div style={{
                    textAlign: 'center',
                    padding: 'var(--spacing-lg)',
                    color: 'var(--text-tertiary)',
                    fontSize: '0.875rem'
                  }}>
                    Nenhum campo adicionado ainda
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Painel Central - Editor de Campo */}
          <div style={{ 
            flex: '1',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--spacing-md)',
            overflow: 'auto',
            minWidth: 0
          }}>
            {selectedField ? (
              <div className="card" style={{ 
                border: '1px solid var(--border-primary)',
                padding: 'var(--spacing-lg)'
              }}>
                <h3 style={{
                  fontSize: '1.125rem',
                  fontWeight: '600',
                  color: 'var(--text-primary)',
                  marginBottom: 'var(--spacing-lg)'
                }}>
                  Editar Campo
                </h3>

                <div style={{ marginBottom: 'var(--spacing-md)' }}>
                  <label style={{
                    display: 'block',
                    marginBottom: 'var(--spacing-xs)',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: 'var(--text-secondary)'
                  }}>
                    Tipo de Campo
                  </label>
                  <select
                    className="select"
                    value={selectedField.type}
                    onChange={(e) => {
                      const newType = e.target.value as FormField['type'];
                      const newOptions = (newType === 'select' || newType === 'radio') ? ['Opção 1', 'Opção 2'] : undefined;
                      updateField(selectedField.id, { 
                        type: newType,
                        options: newOptions
                      });
                      // Atualizar o texto das opções
                      setOptionsText(newOptions?.join('\n') || '');
                    }}
                    style={{ width: '100%' }}
                  >
                    {fieldTypes.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom: 'var(--spacing-md)' }}>
                  <label style={{
                    display: 'block',
                    marginBottom: 'var(--spacing-xs)',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: 'var(--text-secondary)'
                  }}>
                    Rótulo *
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Digite o rótulo do campo"
                    value={selectedField.label}
                    onChange={(e) => updateField(selectedField.id, { label: e.target.value })}
                    style={{ width: '100%' }}
                  />
                </div>

                {(selectedField.type === 'text' || selectedField.type === 'email' || selectedField.type === 'number') && (
                  <div style={{ marginBottom: 'var(--spacing-md)' }}>
                    <label style={{
                      display: 'block',
                      marginBottom: 'var(--spacing-xs)',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: 'var(--text-secondary)'
                    }}>
                      Placeholder
                    </label>
                    <input
                      type="text"
                      className="input"
                      placeholder="Digite o placeholder"
                      value={selectedField.placeholder || ''}
                      onChange={(e) => updateField(selectedField.id, { placeholder: e.target.value })}
                      style={{ width: '100%' }}
                    />
                  </div>
                )}

                {(selectedField.type === 'select' || selectedField.type === 'radio') && (
                  <div style={{ marginBottom: 'var(--spacing-md)' }}>
                    <label style={{
                      display: 'block',
                      marginBottom: 'var(--spacing-xs)',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: 'var(--text-secondary)'
                    }}>
                      Opções (uma por linha)
                    </label>
                    <textarea
                      className="input"
                      placeholder="Opção 1&#10;Opção 2&#10;Opção 3"
                      value={optionsText}
                      onChange={(e) => {
                        const value = e.target.value;
                        // Atualizar o texto diretamente (permitir digitação livre)
                        setOptionsText(value);
                        
                        // Processar opções: dividir por linhas e filtrar linhas vazias
                        const lines = value.split('\n');
                        const validOptions = lines.filter(l => l.trim() !== '');
                        
                        // Atualizar o campo apenas com opções válidas
                        updateField(selectedField.id, { 
                          options: validOptions.length > 0 ? validOptions : undefined
                        });
                      }}
                      style={{ 
                        width: '100%',
                        minHeight: '100px',
                        resize: 'vertical',
                        fontFamily: 'monospace',
                        fontSize: '0.875rem',
                        lineHeight: '1.5'
                      }}
                    />
                  </div>
                )}

                <div style={{ 
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-sm)',
                  marginTop: 'var(--spacing-md)'
                }}>
                  <input
                    type="checkbox"
                    id={`required-${selectedField.id}`}
                    checked={selectedField.required}
                    onChange={(e) => updateField(selectedField.id, { required: e.target.checked })}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <label 
                    htmlFor={`required-${selectedField.id}`}
                    style={{
                      fontSize: '0.875rem',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer'
                    }}
                  >
                    Campo obrigatório
                  </label>
                </div>
              </div>
            ) : (
              <div className="card" style={{ 
                border: '1px solid var(--border-primary)',
                padding: 'var(--spacing-xl)',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '300px'
              }}>
                <Settings size={48} color="var(--text-tertiary)" style={{ marginBottom: 'var(--spacing-md)' }} />
                <p style={{
                  color: 'var(--text-secondary)',
                  fontSize: '1rem'
                }}>
                  Selecione um campo para editar ou adicione um novo campo
                </p>
              </div>
            )}
          </div>

          {/* Painel Direito - Preview */}
          <div style={{ 
            flex: '0 0 450px',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--spacing-md)',
            overflow: 'hidden',
            minHeight: 0
          }}>
            <div className="card" style={{ 
              border: '1px solid var(--border-primary)',
              padding: 'var(--spacing-lg)',
              backgroundColor: 'var(--bg-primary)',
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              minHeight: 0,
              overflow: 'hidden'
            }}>
              <h3 style={{
                fontSize: '1rem',
                fontWeight: '600',
                color: 'var(--text-primary)',
                marginBottom: 'var(--spacing-md)',
                flexShrink: 0
              }}>
                Preview
              </h3>
              <div style={{
                padding: 'var(--spacing-lg)',
                background: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-primary)',
                overflow: 'auto',
                flex: 1,
                minHeight: 0
              }}>
                <h4 style={{
                  fontSize: '1.125rem',
                  fontWeight: '600',
                  color: 'var(--text-primary)',
                  marginBottom: 'var(--spacing-xs)'
                }}>
                  {currentForm.name || 'Nome do Formulário'}
                </h4>
                {currentForm.description && (
                  <p style={{
                    fontSize: '0.875rem',
                    color: 'var(--text-secondary)',
                    marginBottom: 'var(--spacing-lg)'
                  }}>
                    {currentForm.description}
                  </p>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                  {currentForm.fields?.map(field => (
                    <div key={field.id}>
                      <label style={{
                        display: 'block',
                        marginBottom: 'var(--spacing-xs)',
                        fontSize: '0.875rem',
                        fontWeight: '500',
                        color: 'var(--text-primary)'
                      }}>
                        {field.label}
                        {field.required && <span style={{ color: 'var(--red)' }}> *</span>}
                      </label>
                      {field.type === 'text' && (
                        <input
                          type="text"
                          className="input"
                          placeholder={field.placeholder || 'Digite...'}
                          disabled
                          style={{ width: '100%' }}
                        />
                      )}
                      {field.type === 'email' && (
                        <input
                          type="email"
                          className="input"
                          placeholder={field.placeholder || 'email@exemplo.com'}
                          disabled
                          style={{ width: '100%' }}
                        />
                      )}
                      {field.type === 'number' && (
                        <input
                          type="number"
                          className="input"
                          placeholder={field.placeholder || '0'}
                          disabled
                          style={{ width: '100%' }}
                        />
                      )}
                      {field.type === 'textarea' && (
                        <textarea
                          className="input"
                          placeholder={field.placeholder || 'Digite...'}
                          disabled
                          style={{ width: '100%', minHeight: '100px' }}
                        />
                      )}
                      {field.type === 'select' && (
                        <select className="select" disabled style={{ width: '100%' }}>
                          <option>Selecione uma opção</option>
                          {field.options?.map((opt, idx) => (
                            <option key={idx}>{opt}</option>
                          ))}
                        </select>
                      )}
                      {field.type === 'radio' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
                          {field.options?.map((opt, idx) => (
                            <label key={idx} style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', cursor: 'pointer' }}>
                              <input type="radio" name={`preview-${field.id}`} disabled />
                              <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>{opt}</span>
                            </label>
                          ))}
                        </div>
                      )}
                      {field.type === 'checkbox' && (
                        <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', cursor: 'pointer' }}>
                          <input type="checkbox" disabled />
                          <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>Marcar</span>
                        </label>
                      )}
                      {field.type === 'date' && (
                        <input
                          type="date"
                          className="input"
                          disabled
                          style={{ width: '100%' }}
                        />
                      )}
                      {(field.type === 'file' || field.type === 'image') && (
                        <input
                          type="file"
                          className="input"
                          disabled
                          accept={field.validation?.accept}
                          style={{ padding: 'var(--spacing-sm)' }}
                        />
                      )}
                    </div>
                  ))}
                  {(!currentForm.fields || currentForm.fields.length === 0) && (
                    <div style={{
                      textAlign: 'center',
                      padding: 'var(--spacing-lg)',
                      color: 'var(--text-tertiary)',
                      fontSize: '0.875rem'
                    }}>
                      Adicione campos para ver o preview
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer com Botões */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 'var(--spacing-lg)',
          paddingTop: 'var(--spacing-lg)',
          borderTop: '1px solid var(--border-primary)'
        }}>
          <button
            className="btn btn-secondary"
            onClick={handleBack}
          >
            <ArrowLeft size={18} />
            Voltar
          </button>
          <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={!currentForm.name || !currentForm.fields || currentForm.fields.length === 0}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-xs)'
              }}
            >
              <Save size={18} />
              Salvar Formulário
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
