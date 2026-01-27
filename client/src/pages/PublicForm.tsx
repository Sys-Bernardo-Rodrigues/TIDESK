import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { FileEdit, CheckCircle } from 'lucide-react';

interface FormField {
  id: string;
  type: 'text' | 'email' | 'number' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'date' | 'file' | 'image';
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[];
  validation?: {
    accept?: string;
    maxSize?: number;
  };
}

interface Form {
  id: number;
  name: string;
  description: string;
  fields: FormField[];
  linkedUserId?: number;
  linkedGroupId?: number;
}

export default function PublicForm() {
  const { formId } = useParams<{ formId: string }>();
  const navigate = useNavigate();
  const [form, setForm] = useState<Form | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [publicUrl, setPublicUrl] = useState<string>('');
  const [ticketInfo, setTicketInfo] = useState<{ ticket_number: number | null; created_at: string | null } | null>(null);

  useEffect(() => {
    const fetchForm = async () => {
      try {
        const response = await axios.get(`/api/forms/public/${formId}`);
        const formData = response.data;
        
        // Armazenar o public_url para usar no submit
        if (formData.publicUrl) {
          setPublicUrl(formData.publicUrl);
        }
        
        setForm({
          id: formData.id,
          name: formData.name,
          description: formData.description,
          fields: formData.fields,
          linkedUserId: formData.linkedUserId,
          linkedGroupId: formData.linkedGroupId
        });
        
        // Armazenar o public_url para usar no submit
        if (formData.publicUrl) {
          setPublicUrl(formData.publicUrl);
        }

        // Inicializar formData
        const initialData: Record<string, any> = {};
        formData.fields.forEach((field: FormField) => {
          if (field.type === 'checkbox') {
            initialData[field.id] = false;
          } else if (field.type === 'radio') {
            initialData[field.id] = '';
          } else if (field.type === 'file' || field.type === 'image') {
            initialData[field.id] = null; // Para arquivos, armazenar File object
          } else {
            initialData[field.id] = '';
          }
        });
        setFormData(initialData);
      } catch (error: any) {
        console.error('Erro ao buscar formulário:', error);
        if (error.response?.status === 404) {
          // Formulário não encontrado - será tratado no render
        }
      }
    };

    if (formId) {
      fetchForm();
    }
  }, [formId]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    form?.fields.forEach(field => {
      const value = formData[field.id];

      if (field.required) {
        if (field.type === 'checkbox') {
          if (!value) {
            newErrors[field.id] = 'Este campo é obrigatório';
          }
        } else if (field.type === 'file' || field.type === 'image') {
          if (!value) {
            newErrors[field.id] = 'Este campo é obrigatório';
          } else if (field.validation?.maxSize) {
            const fileSizeMB = (value as File).size / (1024 * 1024);
            if (fileSizeMB > field.validation.maxSize) {
              newErrors[field.id] = `Arquivo muito grande. Tamanho máximo: ${field.validation.maxSize}MB`;
            }
          }
        } else {
          if (!value || (typeof value === 'string' && value.trim() === '')) {
            newErrors[field.id] = 'Este campo é obrigatório';
          }
        }
      }

      if (field.type === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        newErrors[field.id] = 'Email inválido';
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Preparar FormData para incluir arquivos
      const formDataToSend = new FormData();
      const textData: Record<string, any> = {};

      // Separar arquivos e dados de texto
      form?.fields.forEach(field => {
        const value = formData[field.id];
        if (field.type === 'file' || field.type === 'image') {
          if (value instanceof File) {
            formDataToSend.append(`file_${field.id}`, value);
            textData[field.id] = value.name; // Nome do arquivo para referência
          }
        } else {
          textData[field.id] = value;
        }
      });

      // Adicionar dados de texto como JSON string
      formDataToSend.append('formData', JSON.stringify(textData));

      // Submeter formulário via API usando public_url
      const submitUrl = publicUrl || formId; // Usar publicUrl se disponível, senão usar formId
      const response = await axios.post(`/api/forms/public/${submitUrl}/submit`, formDataToSend, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      const { needsApproval: apiNeedsApproval, ticket_number, created_at } = response.data;
      
      console.log('[PublicForm] Resposta do servidor:', { ticket_number, created_at, fullResponse: response.data });

      setTicketInfo({ ticket_number, created_at });
      setSubmitted(true);
    } catch (error) {
      console.error('Erro ao submeter formulário:', error);
      alert('Erro ao enviar formulário. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (fieldId: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [fieldId]: value
    }));
    // Limpar erro do campo quando o usuário começar a digitar
    if (errors[fieldId]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldId];
        return newErrors;
      });
    }
  };

  if (!form) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-primary)',
        padding: 'var(--spacing-lg)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <FileEdit size={48} color="var(--text-tertiary)" style={{ marginBottom: 'var(--spacing-md)' }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>
            Formulário não encontrado
          </p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-primary)',
        padding: 'var(--spacing-lg)'
      }}>
        <div className="card" style={{
          maxWidth: '600px',
          width: '100%',
          border: '1px solid var(--border-primary)',
          padding: 'var(--spacing-2xl)',
          textAlign: 'center'
        }}>
          <CheckCircle size={64} color="var(--green)" style={{ marginBottom: 'var(--spacing-lg)' }} />
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: '700',
            color: 'var(--text-primary)',
            marginBottom: 'var(--spacing-md)'
          }}>
            Formulário Enviado com Sucesso!
          </h2>
          {ticketInfo && ticketInfo.ticket_number !== null && ticketInfo.ticket_number !== undefined && ticketInfo.created_at && (() => {
            const date = new Date(ticketInfo.created_at);
            // Usar timezone de Brasília para extrair ano, mês e dia
            const year = parseInt(date.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo', year: 'numeric' }));
            const month = parseInt(date.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo', month: '2-digit' }));
            const day = parseInt(date.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo', day: '2-digit' }));
            const number = String(ticketInfo.ticket_number).padStart(3, '0');
            const fullId = `${year}${month}${day}${number}`;
            const formattedId = `${year}/${month}/${day}/${number}`;
            
            return (
              <div style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-primary)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--spacing-md)',
                marginBottom: 'var(--spacing-md)'
              }}>
                <p style={{
                  color: 'var(--text-primary)',
                  fontSize: '0.9375rem',
                  marginBottom: 'var(--spacing-xs)'
                }}>
                  <strong>ID do Ticket:</strong>
                </p>
                <p style={{
                  color: 'var(--purple)',
                  fontSize: '1.25rem',
                  fontWeight: '700',
                  fontFamily: 'monospace'
                }}>
                  {fullId}
                </p>
                <p style={{
                  color: 'var(--text-secondary)',
                  fontSize: '0.875rem',
                  marginTop: '0.25rem'
                }}>
                  (Formato legível: {formattedId})
                </p>
              </div>
            );
          })()}
          <p style={{
            color: 'var(--text-secondary)',
            fontSize: '1rem',
            marginBottom: 'var(--spacing-lg)'
          }}>
            Sua submissão foi recebida e um ticket foi criado no sistema.
            {form.linkedUserId || form.linkedGroupId ? (
              <span style={{ display: 'block', marginTop: 'var(--spacing-sm)', color: 'var(--orange)' }}>
                O ticket será analisado e aprovado antes de entrar em tratamento.
              </span>
            ) : (
              <span style={{ display: 'block', marginTop: 'var(--spacing-sm)', color: 'var(--green)' }}>
                O ticket foi criado e já está disponível para tratamento.
              </span>
            )}
          </p>
          <button
            className="btn btn-primary"
            onClick={() => {
              setSubmitted(false);
              setFormData({});
              // Recarregar página ou resetar formulário
              window.location.reload();
            }}
          >
            Enviar Outro
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--bg-primary)',
      padding: 'var(--spacing-2xl)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{ maxWidth: '800px', width: '100%' }}>
        <div className="card" style={{
          border: '1px solid var(--border-primary)',
          padding: 'var(--spacing-2xl)'
        }}>
          <div style={{ marginBottom: 'var(--spacing-xl)' }}>
            <h1 style={{
              fontSize: '2rem',
              fontWeight: '700',
              color: 'var(--text-primary)',
              marginBottom: 'var(--spacing-sm)'
            }}>
              {form.name}
            </h1>
            {form.description && (
              <p style={{
                color: 'var(--text-secondary)',
                fontSize: '1rem'
              }}>
                {form.description}
              </p>
            )}
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
              {form.fields.map(field => (
                <div key={field.id}>
                  <label style={{
                    display: 'block',
                    marginBottom: 'var(--spacing-xs)',
                    fontSize: '0.9375rem',
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
                      value={formData[field.id] || ''}
                      onChange={(e) => handleChange(field.id, e.target.value)}
                      style={{ width: '100%' }}
                    />
                  )}

                  {field.type === 'email' && (
                    <input
                      type="email"
                      className="input"
                      placeholder={field.placeholder || 'email@exemplo.com'}
                      value={formData[field.id] || ''}
                      onChange={(e) => handleChange(field.id, e.target.value)}
                      style={{ width: '100%' }}
                    />
                  )}

                  {field.type === 'number' && (
                    <input
                      type="number"
                      className="input"
                      placeholder={field.placeholder || '0'}
                      value={formData[field.id] || ''}
                      onChange={(e) => handleChange(field.id, e.target.value)}
                      style={{ width: '100%' }}
                    />
                  )}

                  {field.type === 'textarea' && (
                    <textarea
                      className="input"
                      placeholder={field.placeholder || 'Digite...'}
                      value={formData[field.id] || ''}
                      onChange={(e) => handleChange(field.id, e.target.value)}
                      style={{ 
                        width: '100%',
                        minHeight: '120px',
                        resize: 'vertical'
                      }}
                    />
                  )}

                  {field.type === 'select' && (
                    <select
                      className="select"
                      value={formData[field.id] || ''}
                      onChange={(e) => handleChange(field.id, e.target.value)}
                      style={{ width: '100%' }}
                    >
                      <option value="">Selecione uma opção</option>
                      {field.options?.map((opt, idx) => (
                        <option key={idx} value={opt}>{opt}</option>
                      ))}
                    </select>
                  )}

                  {field.type === 'radio' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
                      {field.options?.map((opt, idx) => (
                        <label 
                          key={idx} 
                          style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: 'var(--spacing-xs)',
                            cursor: 'pointer',
                            padding: 'var(--spacing-xs)',
                            borderRadius: 'var(--radius-md)',
                            transition: 'background var(--transition-base)'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                          <input
                            type="radio"
                            name={field.id}
                            value={opt}
                            checked={formData[field.id] === opt}
                            onChange={(e) => handleChange(field.id, e.target.value)}
                          />
                          <span style={{ fontSize: '0.9375rem', color: 'var(--text-primary)' }}>{opt}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {field.type === 'checkbox' && (
                    <label style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 'var(--spacing-xs)',
                      cursor: 'pointer',
                      padding: 'var(--spacing-xs)',
                      borderRadius: 'var(--radius-md)',
                      transition: 'background var(--transition-base)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                    >
                      <input
                        type="checkbox"
                        checked={formData[field.id] || false}
                        onChange={(e) => handleChange(field.id, e.target.checked)}
                      />
                      <span style={{ fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
                        {field.label}
                      </span>
                    </label>
                  )}

                  {field.type === 'date' && (
                    <input
                      type="date"
                      className="input"
                      value={formData[field.id] || ''}
                      onChange={(e) => handleChange(field.id, e.target.value)}
                      style={{ width: '100%' }}
                    />
                  )}

                  {(field.type === 'file' || field.type === 'image') && (
                    <div>
                      <input
                        type="file"
                        className="input"
                        accept={field.validation?.accept || (field.type === 'image' ? 'image/*' : undefined)}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            // Validar tamanho
                            if (field.validation?.maxSize) {
                              const fileSizeMB = file.size / (1024 * 1024);
                              if (fileSizeMB > field.validation.maxSize) {
                                setErrors(prev => ({
                                  ...prev,
                                  [field.id]: `Arquivo muito grande. Tamanho máximo: ${field.validation!.maxSize}MB`
                                }));
                                e.target.value = '';
                                return;
                              }
                            }
                            handleChange(field.id, file);
                            // Limpar erro se houver
                            if (errors[field.id]) {
                              setErrors(prev => {
                                const newErrors = { ...prev };
                                delete newErrors[field.id];
                                return newErrors;
                              });
                            }
                          }
                        }}
                        style={{ 
                          width: '100%',
                          padding: 'var(--spacing-sm)',
                          cursor: 'pointer'
                        }}
                      />
                      {formData[field.id] && (
                        <div style={{
                          marginTop: 'var(--spacing-xs)',
                          fontSize: '0.875rem',
                          color: 'var(--text-secondary)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 'var(--spacing-xs)'
                        }}>
                          <span>✓ Arquivo selecionado: {(formData[field.id] as File).name}</span>
                          <span style={{ color: 'var(--text-tertiary)' }}>
                            ({(Math.round((formData[field.id] as File).size / 1024 * 100) / 100).toFixed(2)} KB)
                          </span>
                        </div>
                      )}
                      {field.validation?.maxSize && (
                        <small style={{ 
                          display: 'block', 
                          marginTop: 'var(--spacing-xs)',
                          color: 'var(--text-tertiary)',
                          fontSize: '0.75rem'
                        }}>
                          Tamanho máximo: {field.validation.maxSize}MB
                        </small>
                      )}
                    </div>
                  )}

                  {errors[field.id] && (
                    <div style={{
                      marginTop: 'var(--spacing-xs)',
                      fontSize: '0.8125rem',
                      color: 'var(--red)'
                    }}>
                      {errors[field.id]}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div style={{
              display: 'flex',
              gap: 'var(--spacing-md)',
              marginTop: 'var(--spacing-xl)',
              justifyContent: 'flex-end'
            }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSubmitting}
                style={{ minWidth: '150px' }}
              >
                {isSubmitting ? 'Enviando...' : 'Enviar Formulário'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
