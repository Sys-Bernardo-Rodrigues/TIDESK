import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Shield, Plus, Search, Edit, Trash2, Users, X, Save, CheckSquare, Square } from 'lucide-react';
import { RESOURCES, ACTIONS } from '../hooks/usePermissions';

interface Permission {
  resource: string;
  action: string;
}

interface AccessProfile {
  id: number;
  name: string;
  description: string | null;
  permissions: Permission[];
  users_count: number;
  permissions_count: number;
  created_at: string;
}

const RESOURCE_LABELS: Record<string, string> = {
  tickets: 'Tickets',
  forms: 'Formulários',
  pages: 'Páginas',
  users: 'Usuários',
  categories: 'Categorias',
  reports: 'Relatórios',
  history: 'Histórico',
  approve: 'Aprovar',
  track: 'Acompanhar Tratativa',
  config: 'Configurações',
  agenda: 'Agenda'
};

const ACTION_LABELS: Record<string, string> = {
  create: 'Criar',
  view: 'Visualizar',
  edit: 'Editar',
  delete: 'Excluir',
  approve: 'Aprovar',
  reject: 'Rejeitar'
};

export default function AccessProfile() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [profiles, setProfiles] = useState<AccessProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingProfile, setEditingProfile] = useState<AccessProfile | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    permissions: [] as Permission[]
  });

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    try {
      const response = await axios.get('/api/access-profiles');
      setProfiles(response.data);
    } catch (error) {
      console.error('Erro ao buscar perfis:', error);
      alert('Erro ao buscar perfis de acesso');
    } finally {
      setLoading(false);
    }
  };

  const createDefaultProfiles = async () => {
    try {
      await axios.post('/api/access-profiles/seed-default');
      // Recarregar perfis após criação
      const response = await axios.get('/api/access-profiles');
      setProfiles(response.data);
      alert('Perfis padrão criados com sucesso!');
    } catch (error: any) {
      console.error('Erro ao criar perfis padrão:', error);
      alert(error.response?.data?.error || 'Erro ao criar perfis padrão');
    }
  };

  const handleCreate = () => {
    setFormData({
      name: '',
      description: '',
      permissions: []
    });
    setEditingProfile(null);
    setShowModal(true);
  };

  const handleEdit = async (profileId: number) => {
    try {
      const response = await axios.get(`/api/access-profiles/${profileId}`);
      const profile = response.data;
      setFormData({
        name: profile.name,
        description: profile.description || '',
        permissions: profile.permissions || []
      });
      setEditingProfile(profile);
      setShowModal(true);
    } catch (error) {
      console.error('Erro ao buscar perfil:', error);
      alert('Erro ao carregar perfil');
    }
  };

  const handleDelete = async (profileId: number) => {
    if (!window.confirm('Tem certeza que deseja excluir este perfil de acesso?')) {
      return;
    }

    try {
      await axios.delete(`/api/access-profiles/${profileId}`);
      setProfiles(profiles.filter(p => p.id !== profileId));
      alert('Perfil excluído com sucesso!');
    } catch (error: any) {
      console.error('Erro ao excluir perfil:', error);
      alert(error.response?.data?.error || 'Erro ao excluir perfil');
    }
  };

  const togglePermission = (resource: string, action: string) => {
    const key = `${resource}:${action}`;
    const exists = formData.permissions.some(
      p => p.resource === resource && p.action === action
    );

    if (exists) {
      setFormData({
        ...formData,
        permissions: formData.permissions.filter(
          p => !(p.resource === resource && p.action === action)
        )
      });
    } else {
      setFormData({
        ...formData,
        permissions: [...formData.permissions, { resource, action }]
      });
    }
  };

  const hasPermission = (resource: string, action: string): boolean => {
    return formData.permissions.some(
      p => p.resource === resource && p.action === action
    );
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert('Nome do perfil é obrigatório');
      return;
    }

    try {
      const payload = {
        name: formData.name,
        description: formData.description || null,
        permissions: formData.permissions
      };

      if (editingProfile) {
        await axios.put(`/api/access-profiles/${editingProfile.id}`, payload);
        alert('Perfil atualizado com sucesso!');
      } else {
        await axios.post('/api/access-profiles', payload);
        alert('Perfil criado com sucesso!');
      }

      setShowModal(false);
      fetchProfiles();
    } catch (error: any) {
      console.error('Erro ao salvar perfil:', error);
      alert(error.response?.data?.error || 'Erro ao salvar perfil');
    }
  };

  const filteredProfiles = profiles.filter(profile =>
    profile.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (profile.description && profile.description.toLowerCase().includes(searchTerm.toLowerCase()))
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
          Perfil de Acesso
        </h1>
        <p style={{
          color: 'var(--text-secondary)',
          fontSize: '1rem',
          fontWeight: '400'
        }}>
          Gerencie os perfis de acesso e permissões do sistema
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
            placeholder="Buscar perfis..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '2.75rem' }}
          />
        </div>
        <button 
          className="btn btn-primary"
          onClick={handleCreate}
        >
          <Plus size={20} />
          Novo Perfil
        </button>
      </div>

      {loading ? (
        <div className="card" style={{ 
          textAlign: 'center', 
          padding: 'var(--spacing-2xl)',
          border: '1px solid var(--border-primary)'
        }}>
          <p style={{ color: 'var(--text-secondary)' }}>Carregando perfis...</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          {filteredProfiles.length === 0 ? (
            <div className="card" style={{ 
              textAlign: 'center', 
              padding: 'var(--spacing-2xl)',
              border: '1px solid var(--border-primary)'
            }}>
              <Shield size={48} color="var(--text-tertiary)" style={{ marginBottom: 'var(--spacing-md)' }} />
              <p style={{ 
                color: 'var(--text-secondary)',
                fontSize: '1rem',
                marginBottom: 'var(--spacing-sm)'
              }}>
                {searchTerm ? 'Nenhum perfil encontrado' : 'Nenhum perfil criado ainda'}
              </p>
            {!searchTerm && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)', alignItems: 'center' }}>
                <button 
                  className="btn btn-primary" 
                  style={{ marginTop: 'var(--spacing-md)' }}
                  onClick={createDefaultProfiles}
                >
                  <Shield size={20} />
                  Criar Perfis Padrão (Administrador, Agente, Usuário)
                </button>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>ou</span>
                <button 
                  className="btn btn-secondary" 
                  onClick={handleCreate}
                >
                  <Plus size={20} />
                  Criar Perfil Personalizado
                </button>
              </div>
            )}
            </div>
          ) : (
            filteredProfiles.map((profile) => (
              <div key={profile.id} className="card" style={{ 
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
                    <Shield size={20} color="var(--orange)" />
                    <h3 style={{ 
                      fontSize: '1.125rem', 
                      fontWeight: '600',
                      color: 'var(--text-primary)'
                    }}>
                      {profile.name}
                    </h3>
                  </div>
                  {profile.description && (
                    <p style={{
                      fontSize: '0.875rem',
                      color: 'var(--text-secondary)',
                      marginLeft: '2.25rem',
                      marginBottom: 'var(--spacing-xs)'
                    }}>
                      {profile.description}
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
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Users size={14} />
                      <strong>{profile.users_count || 0}</strong> usuários
                    </span>
                    <span><strong>{profile.permissions_count || 0}</strong> permissões</span>
                    <span><strong>Criado:</strong> {new Date(profile.created_at).toLocaleDateString('pt-BR')}</span>
                  </div>
                </div>
                <div style={{ 
                  display: 'flex', 
                  gap: 'var(--spacing-sm)'
                }}>
                  <button 
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleEdit(profile.id)}
                  >
                    <Edit size={16} />
                    Editar
                  </button>
                  <button 
                    className="btn btn-danger btn-sm"
                    onClick={() => handleDelete(profile.id)}
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

      {/* Modal de Edição/Criação */}
      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: 'var(--spacing-xl)'
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            setShowModal(false);
          }
        }}
        >
          <div className="card" style={{
            maxWidth: '900px',
            width: '100%',
            maxHeight: '90vh',
            overflow: 'auto',
            border: '1px solid var(--border-primary)',
            position: 'relative'
          }}
          onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 'var(--spacing-xl)',
              paddingBottom: 'var(--spacing-md)',
              borderBottom: '1px solid var(--border-primary)'
            }}>
              <h2 style={{
                fontSize: '1.5rem',
                fontWeight: '700',
                color: 'var(--text-primary)'
              }}>
                {editingProfile ? 'Editar Perfil' : 'Novo Perfil'}
              </h2>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowModal(false)}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
              <div>
                <label className="label">Nome do Perfil *</label>
                <input
                  type="text"
                  className="input"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Agente de Suporte"
                />
              </div>

              <div>
                <label className="label">Descrição</label>
                <textarea
                  className="input"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descrição do perfil de acesso..."
                  rows={3}
                />
              </div>

              <div>
                <label className="label">Permissões</label>
                <div style={{
                  border: '1px solid var(--border-primary)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--spacing-lg)',
                  maxHeight: '400px',
                  overflow: 'auto'
                }}>
                  {Object.entries(RESOURCES).map(([key, resource]) => (
                    <div key={resource} style={{ marginBottom: 'var(--spacing-xl)' }}>
                      <h3 style={{
                        fontSize: '1rem',
                        fontWeight: '600',
                        color: 'var(--text-primary)',
                        marginBottom: 'var(--spacing-md)'
                      }}>
                        {RESOURCE_LABELS[resource] || resource}
                      </h3>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                        gap: 'var(--spacing-sm)'
                      }}>
                        {Object.entries(ACTIONS).map(([actionKey, action]) => {
                          // Filtrar ações relevantes por recurso
                          if (resource === 'approve' && action !== 'view' && action !== 'approve' && action !== 'reject') {
                            return null;
                          }
                          if (resource !== 'approve' && (action === 'approve' || action === 'reject')) {
                            return null;
                          }

                          const checked = hasPermission(resource, action);
                          return (
                            <label
                              key={`${resource}-${action}`}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'var(--spacing-sm)',
                                padding: 'var(--spacing-sm)',
                                borderRadius: 'var(--radius-sm)',
                                cursor: 'pointer',
                                backgroundColor: checked ? 'var(--purple-light)' : 'transparent',
                                transition: 'all var(--transition-base)'
                              }}
                              onMouseEnter={(e) => {
                                if (!checked) {
                                  e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!checked) {
                                  e.currentTarget.style.backgroundColor = 'transparent';
                                }
                              }}
                            >
                              {checked ? (
                                <CheckSquare size={18} color="var(--purple)" />
                              ) : (
                                <Square size={18} color="var(--text-tertiary)" />
                              )}
                              <span style={{
                                fontSize: '0.875rem',
                                color: checked ? 'var(--text-primary)' : 'var(--text-secondary)',
                                fontWeight: checked ? '500' : '400'
                              }}>
                                {ACTION_LABELS[action] || action}
                              </span>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => togglePermission(resource, action)}
                                style={{ display: 'none' }}
                              />
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 'var(--spacing-sm)',
              marginTop: 'var(--spacing-xl)',
              paddingTop: 'var(--spacing-md)',
              borderTop: '1px solid var(--border-primary)'
            }}>
              <button
                className="btn btn-secondary"
                onClick={() => setShowModal(false)}
              >
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSave}
              >
                <Save size={20} />
                {editingProfile ? 'Atualizar' : 'Criar'} Perfil
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
