import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { User, Plus, Search, Edit, Trash2, Mail, Shield, X, Link as LinkIcon, Unlink, Save } from 'lucide-react';

interface AccessProfile {
  id: number;
  name: string;
  description: string | null;
}

interface UserData {
  id: number;
  name: string;
  email: string;
  role: string;
  created_at: string;
  access_profiles?: AccessProfile[];
}

export default function Users() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [availableProfiles, setAvailableProfiles] = useState<AccessProfile[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'user'
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await axios.get('/api/users');
      setUsers(response.data);
    } catch (error) {
      console.error('Erro ao buscar usuários:', error);
      alert('Erro ao buscar usuários');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableProfiles = async () => {
    setLoadingProfiles(true);
    try {
      const response = await axios.get('/api/access-profiles');
      setAvailableProfiles(response.data);
    } catch (error) {
      console.error('Erro ao buscar perfis:', error);
      alert('Erro ao buscar perfis de acesso');
    } finally {
      setLoadingProfiles(false);
    }
  };

  const handleManageProfiles = async (user: UserData) => {
    setSelectedUser(user);
    await fetchAvailableProfiles();
    setShowProfileModal(true);
  };

  const handleLinkProfile = async (profileId: number) => {
    if (!selectedUser) return;

    try {
      await axios.post(`/api/users/${selectedUser.id}/access-profiles`, {
        access_profile_id: profileId
      });
      
      alert('Perfil vinculado com sucesso!');
      
      // Buscar usuário atualizado
      const response = await axios.get(`/api/users/${selectedUser.id}`);
      setSelectedUser(response.data);
      
      // Atualizar lista de usuários
      await fetchUsers();
    } catch (error: any) {
      console.error('Erro ao vincular perfil:', error);
      alert(error.response?.data?.error || 'Erro ao vincular perfil');
    }
  };

  const handleUnlinkProfile = async (profileId: number) => {
    if (!selectedUser) return;

    if (!window.confirm('Tem certeza que deseja desvincular este perfil?')) {
      return;
    }

    try {
      await axios.delete(`/api/users/${selectedUser.id}/access-profiles/${profileId}`);
      
      alert('Perfil desvinculado com sucesso!');
      
      // Buscar usuário atualizado
      const response = await axios.get(`/api/users/${selectedUser.id}`);
      setSelectedUser(response.data);
      
      // Atualizar lista de usuários
      await fetchUsers();
    } catch (error: any) {
      console.error('Erro ao desvincular perfil:', error);
      alert(error.response?.data?.error || 'Erro ao desvincular perfil');
    }
  };

  const getRoleBadge = (role: string) => {
    const badges: Record<string, { color: string; label: string }> = {
      admin: { color: 'var(--purple)', label: 'Administrador' },
      agent: { color: 'var(--blue)', label: 'Agente' },
      user: { color: 'var(--green)', label: 'Usuário' }
    };
    return badges[role] || { color: 'var(--text-secondary)', label: role };
  };

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isProfileLinked = (profileId: number): boolean => {
    if (!selectedUser || !selectedUser.access_profiles) return false;
    return selectedUser.access_profiles.some(p => p.id === profileId);
  };

  const handleCreate = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'user'
    });
    setEditingUser(null);
    setShowUserModal(true);
  };

  const handleEdit = async (user: UserData) => {
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role
    });
    setEditingUser(user);
    setShowUserModal(true);
  };

  const handleDelete = async (userId: number) => {
    if (!window.confirm('Tem certeza que deseja excluir este usuário? Esta ação não pode ser desfeita.')) {
      return;
    }

    try {
      await axios.delete(`/api/users/${userId}`);
      setUsers(users.filter(u => u.id !== userId));
      alert('Usuário excluído com sucesso!');
    } catch (error: any) {
      console.error('Erro ao excluir usuário:', error);
      alert(error.response?.data?.error || 'Erro ao excluir usuário');
    }
  };

  const handleSaveUser = async () => {
    if (!formData.name.trim() || !formData.email.trim()) {
      alert('Nome e email são obrigatórios');
      return;
    }

    if (!editingUser && !formData.password) {
      alert('Senha é obrigatória para novos usuários');
      return;
    }

    try {
      const payload: any = {
        name: formData.name,
        email: formData.email,
        role: formData.role
      };

      if (formData.password) {
        payload.password = formData.password;
      }

      if (editingUser) {
        await axios.put(`/api/users/${editingUser.id}`, payload);
        alert('Usuário atualizado com sucesso!');
      } else {
        await axios.post('/api/users', payload);
        alert('Usuário criado com sucesso!');
      }

      setShowUserModal(false);
      setEditingUser(null);
      fetchUsers();
    } catch (error: any) {
      console.error('Erro ao salvar usuário:', error);
      alert(error.response?.data?.error || 'Erro ao salvar usuário');
    }
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
          Usuários
        </h1>
        <p style={{
          color: 'var(--text-secondary)',
          fontSize: '1rem',
          fontWeight: '400'
        }}>
          Gerencie os usuários e seus perfis de acesso do sistema
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
            placeholder="Buscar usuários..."
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
          Novo Usuário
        </button>
      </div>

      {loading ? (
        <div className="card" style={{ 
          textAlign: 'center', 
          padding: 'var(--spacing-2xl)',
          border: '1px solid var(--border-primary)'
        }}>
          <p style={{ color: 'var(--text-secondary)' }}>Carregando usuários...</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          {filteredUsers.length === 0 ? (
            <div className="card" style={{ 
              textAlign: 'center', 
              padding: 'var(--spacing-2xl)',
              border: '1px solid var(--border-primary)'
            }}>
              <User size={48} color="var(--text-tertiary)" style={{ marginBottom: 'var(--spacing-md)' }} />
              <p style={{ 
                color: 'var(--text-secondary)',
                fontSize: '1rem',
                marginBottom: 'var(--spacing-sm)'
              }}>
                {searchTerm ? 'Nenhum usuário encontrado' : 'Nenhum usuário cadastrado ainda'}
              </p>
              {!searchTerm && (
                <button 
                  className="btn btn-primary" 
                  style={{ marginTop: 'var(--spacing-md)' }}
                  onClick={handleCreate}
                >
                  <Plus size={20} />
                  Cadastrar Primeiro Usuário
                </button>
              )}
            </div>
          ) : (
            filteredUsers.map((user) => {
              const roleBadge = getRoleBadge(user.role);
              return (
                <div key={user.id} className="card" style={{ 
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
                      marginBottom: 'var(--spacing-xs)',
                      flexWrap: 'wrap'
                    }}>
                      <User size={20} color="var(--blue)" />
                      <h3 style={{ 
                        fontSize: '1.125rem', 
                        fontWeight: '600',
                        color: 'var(--text-primary)'
                      }}>
                        {user.name}
                      </h3>
                      <span className="badge" style={{
                        fontSize: '0.6875rem',
                        padding: '0.25rem 0.5rem',
                        backgroundColor: roleBadge.color + '20',
                        color: roleBadge.color,
                        border: `1px solid ${roleBadge.color}40`
                      }}>
                        {roleBadge.label}
                      </span>
                    </div>
                    <div style={{ 
                      display: 'flex', 
                      gap: 'var(--spacing-lg)',
                      fontSize: '0.875rem',
                      color: 'var(--text-secondary)',
                      marginLeft: '2.25rem',
                      flexWrap: 'wrap',
                      alignItems: 'center'
                    }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Mail size={14} />
                        {user.email}
                      </span>
                      {user.access_profiles && user.access_profiles.length > 0 && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Shield size={14} color="var(--orange)" />
                          <strong>{user.access_profiles.length}</strong> perfil{user.access_profiles.length > 1 ? 's' : ''}
                        </span>
                      )}
                      <span><strong>Criado:</strong> {new Date(user.created_at).toLocaleDateString('pt-BR')}</span>
                    </div>
                    {user.access_profiles && user.access_profiles.length > 0 && (
                      <div style={{
                        marginLeft: '2.25rem',
                        marginTop: 'var(--spacing-xs)',
                        display: 'flex',
                        gap: 'var(--spacing-xs)',
                        flexWrap: 'wrap'
                      }}>
                        {user.access_profiles.map(profile => (
                          <span
                            key={profile.id}
                            className="badge"
                            style={{
                              fontSize: '0.75rem',
                              padding: '0.25rem 0.5rem',
                              backgroundColor: 'var(--orange-light)',
                              color: 'var(--orange)',
                              border: '1px solid var(--orange)40'
                            }}
                          >
                            {profile.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ 
                    display: 'flex', 
                    gap: 'var(--spacing-sm)'
                  }}>
                    <button 
                      className="btn btn-info btn-sm"
                      onClick={() => handleManageProfiles(user)}
                    >
                      <Shield size={16} />
                      Perfis
                    </button>
                    <button 
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleEdit(user)}
                    >
                      <Edit size={16} />
                      Editar
                    </button>
                    <button 
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDelete(user.id)}
                    >
                      <Trash2 size={16} />
                      Excluir
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Modal de Gerenciamento de Perfis */}
      {showProfileModal && selectedUser && (
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
            setShowProfileModal(false);
            setSelectedUser(null);
          }
        }}
        >
          <div className="card" style={{
            maxWidth: '700px',
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
              <div>
                <h2 style={{
                  fontSize: '1.5rem',
                  fontWeight: '700',
                  color: 'var(--text-primary)',
                  marginBottom: 'var(--spacing-xs)'
                }}>
                  Perfis de Acesso
                </h2>
                <p style={{
                  fontSize: '0.875rem',
                  color: 'var(--text-secondary)'
                }}>
                  {selectedUser.name} ({selectedUser.email})
                </p>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setShowProfileModal(false);
                  setSelectedUser(null);
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ marginBottom: 'var(--spacing-lg)' }}>
              <h3 style={{
                fontSize: '1rem',
                fontWeight: '600',
                color: 'var(--text-primary)',
                marginBottom: 'var(--spacing-md)'
              }}>
                Perfis Vinculados
              </h3>
              {selectedUser.access_profiles && selectedUser.access_profiles.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                  {selectedUser.access_profiles.map(profile => (
                    <div
                      key={profile.id}
                      className="card"
                      style={{
                        border: '1px solid var(--border-primary)',
                        padding: 'var(--spacing-md)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div>
                        <div style={{
                          fontWeight: '600',
                          color: 'var(--text-primary)',
                          marginBottom: 'var(--spacing-xs)'
                        }}>
                          {profile.name}
                        </div>
                        {profile.description && (
                          <div style={{
                            fontSize: '0.875rem',
                            color: 'var(--text-secondary)'
                          }}>
                            {profile.description}
                          </div>
                        )}
                      </div>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleUnlinkProfile(profile.id)}
                      >
                        <Unlink size={16} />
                        Desvincular
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{
                  color: 'var(--text-tertiary)',
                  fontSize: '0.875rem',
                  fontStyle: 'italic'
                }}>
                  Nenhum perfil vinculado
                </p>
              )}
            </div>

            <div>
              <h3 style={{
                fontSize: '1rem',
                fontWeight: '600',
                color: 'var(--text-primary)',
                marginBottom: 'var(--spacing-md)'
              }}>
                Perfis Disponíveis
              </h3>
              {loadingProfiles ? (
                <p style={{ color: 'var(--text-secondary)' }}>Carregando perfis...</p>
              ) : availableProfiles.length === 0 ? (
                <p style={{
                  color: 'var(--text-tertiary)',
                  fontSize: '0.875rem',
                  fontStyle: 'italic'
                }}>
                  Nenhum perfil disponível
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                  {availableProfiles.map(profile => {
                    const isLinked = isProfileLinked(profile.id);
                    return (
                      <div
                        key={profile.id}
                        className="card"
                        style={{
                          border: '1px solid var(--border-primary)',
                          padding: 'var(--spacing-md)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          opacity: isLinked ? 0.6 : 1
                        }}
                      >
                        <div>
                          <div style={{
                            fontWeight: '600',
                            color: 'var(--text-primary)',
                            marginBottom: 'var(--spacing-xs)'
                          }}>
                            {profile.name}
                            {isLinked && (
                              <span style={{
                                marginLeft: 'var(--spacing-sm)',
                                fontSize: '0.75rem',
                                color: 'var(--green)',
                                fontWeight: '500'
                              }}>
                                (Vinculado)
                              </span>
                            )}
                          </div>
                          {profile.description && (
                            <div style={{
                              fontSize: '0.875rem',
                              color: 'var(--text-secondary)'
                            }}>
                              {profile.description}
                            </div>
                          )}
                        </div>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleLinkProfile(profile.id)}
                          disabled={isLinked}
                        >
                          <LinkIcon size={16} />
                          {isLinked ? 'Vinculado' : 'Vincular'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Criar/Editar Usuário */}
      {showUserModal && (
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
            setShowUserModal(false);
            setEditingUser(null);
          }
        }}
        >
          <div className="card" style={{
            maxWidth: '600px',
            width: '100%',
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
                {editingUser ? 'Editar Usuário' : 'Novo Usuário'}
              </h2>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setShowUserModal(false);
                  setEditingUser(null);
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
              <div>
                <label className="label">Nome *</label>
                <input
                  type="text"
                  className="input"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nome completo"
                />
              </div>

              <div>
                <label className="label">Email *</label>
                <input
                  type="email"
                  className="input"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@exemplo.com"
                />
              </div>

              <div>
                <label className="label">
                  Senha {!editingUser && '*'}
                  {editingUser && <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: 'normal' }}> (deixe em branco para não alterar)</span>}
                </label>
                <input
                  type="password"
                  className="input"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder={editingUser ? "Nova senha (opcional)" : "Mínimo 6 caracteres"}
                />
              </div>

              <div>
                <label className="label">Perfil *</label>
                <select
                  className="select"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                >
                  <option value="user">Usuário</option>
                  <option value="agent">Agente</option>
                  <option value="admin">Administrador</option>
                </select>
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
                onClick={() => {
                  setShowUserModal(false);
                  setEditingUser(null);
                }}
              >
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSaveUser}
              >
                <Save size={20} />
                {editingUser ? 'Atualizar' : 'Criar'} Usuário
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
