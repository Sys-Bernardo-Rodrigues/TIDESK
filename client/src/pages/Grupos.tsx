import { useState, useEffect } from 'react';
import axios from 'axios';
import { Users, Plus, Search, Edit, Trash2, UserPlus, UserMinus, X, Save } from 'lucide-react';

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

interface Group {
  id: number;
  name: string;
  description: string | null;
  users: User[];
  users_count: number;
  created_by_name: string;
  created_at: string;
}

export default function Grupos() {
  const [searchTerm, setSearchTerm] = useState('');
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showUsersModal, setShowUsersModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });

  useEffect(() => {
    fetchGroups();
    fetchUsers();
  }, []);

  const fetchGroups = async () => {
    try {
      const response = await axios.get('/api/groups');
      setGroups(response.data);
    } catch (error) {
      console.error('Erro ao buscar grupos:', error);
      alert('Erro ao buscar grupos');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await axios.get('/api/users');
      setAllUsers(response.data);
    } catch (error) {
      console.error('Erro ao buscar usuários:', error);
    }
  };

  const handleCreate = () => {
    setFormData({
      name: '',
      description: ''
    });
    setSelectedGroup(null);
    setShowCreateModal(true);
  };

  const handleEdit = (group: Group) => {
    setFormData({
      name: group.name,
      description: group.description || ''
    });
    setSelectedGroup(group);
    setShowEditModal(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert('Nome do grupo é obrigatório');
      return;
    }

    try {
      if (selectedGroup) {
        await axios.put(`/api/groups/${selectedGroup.id}`, formData);
        alert('Grupo atualizado com sucesso!');
        setShowEditModal(false);
      } else {
        await axios.post('/api/groups', formData);
        alert('Grupo criado com sucesso!');
        setShowCreateModal(false);
      }
      setSelectedGroup(null);
      fetchGroups();
    } catch (error: any) {
      console.error('Erro ao salvar grupo:', error);
      alert(error.response?.data?.error || 'Erro ao salvar grupo');
    }
  };

  const handleDelete = async (groupId: number) => {
    if (!window.confirm('Tem certeza que deseja excluir este grupo? Os usuários serão desvinculados automaticamente.')) {
      return;
    }

    try {
      await axios.delete(`/api/groups/${groupId}`);
      setGroups(groups.filter(g => g.id !== groupId));
      alert('Grupo excluído com sucesso!');
    } catch (error: any) {
      console.error('Erro ao excluir grupo:', error);
      alert(error.response?.data?.error || 'Erro ao excluir grupo');
    }
  };

  const handleManageUsers = async (group: Group) => {
    setSelectedGroup(group);
    setShowUsersModal(true);
  };

  const handleAddUser = async (userId: number) => {
    if (!selectedGroup) return;

    try {
      await axios.post(`/api/groups/${selectedGroup.id}/users`, { userId });
      
      // Atualizar grupo selecionado
      const response = await axios.get(`/api/groups/${selectedGroup.id}`);
      setSelectedGroup(response.data);
      
      // Atualizar lista de grupos
      await fetchGroups();
    } catch (error: any) {
      console.error('Erro ao vincular usuário:', error);
      alert(error.response?.data?.error || 'Erro ao vincular usuário');
    }
  };

  const handleRemoveUser = async (userId: number) => {
    if (!selectedGroup) return;

    try {
      await axios.delete(`/api/groups/${selectedGroup.id}/users/${userId}`);
      
      // Atualizar grupo selecionado
      const response = await axios.get(`/api/groups/${selectedGroup.id}`);
      setSelectedGroup(response.data);
      
      // Atualizar lista de grupos
      await fetchGroups();
    } catch (error: any) {
      console.error('Erro ao desvincular usuário:', error);
      alert(error.response?.data?.error || 'Erro ao desvincular usuário');
    }
  };

  const filteredGroups = groups.filter(group =>
    group.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (group.description && group.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getAvailableUsers = (): User[] => {
    if (!selectedGroup) return allUsers;
    const groupUserIds = selectedGroup.users.map(u => u.id);
    return allUsers.filter(user => !groupUserIds.includes(user.id));
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
          Grupos
        </h1>
        <p style={{
          color: 'var(--text-secondary)',
          fontSize: '1rem',
          fontWeight: '400'
        }}>
          Crie grupos e vincule usuários para facilitar o gerenciamento
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
            placeholder="Buscar grupos..."
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
          Novo Grupo
        </button>
      </div>

      {loading ? (
        <div className="card" style={{ 
          textAlign: 'center', 
          padding: 'var(--spacing-2xl)',
          border: '1px solid var(--border-primary)'
        }}>
          <p style={{ color: 'var(--text-secondary)' }}>Carregando grupos...</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          {filteredGroups.length === 0 ? (
            <div className="card" style={{ 
              textAlign: 'center', 
              padding: 'var(--spacing-2xl)',
              border: '1px solid var(--border-primary)'
            }}>
              <Users size={48} color="var(--text-tertiary)" style={{ marginBottom: 'var(--spacing-md)' }} />
              <p style={{ 
                color: 'var(--text-secondary)',
                fontSize: '1rem',
                marginBottom: 'var(--spacing-sm)'
              }}>
                {searchTerm ? 'Nenhum grupo encontrado' : 'Nenhum grupo criado ainda'}
              </p>
              {!searchTerm && (
                <button 
                  className="btn btn-primary" 
                  style={{ marginTop: 'var(--spacing-md)' }}
                  onClick={handleCreate}
                >
                  <Plus size={20} />
                  Criar Primeiro Grupo
                </button>
              )}
            </div>
          ) : (
            filteredGroups.map((group) => (
              <div key={group.id} className="card" style={{ 
                border: '1px solid var(--border-primary)',
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
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: 'var(--spacing-md)'
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 'var(--spacing-md)',
                      marginBottom: 'var(--spacing-xs)',
                      flexWrap: 'wrap'
                    }}>
                      <Users size={20} color="var(--purple)" />
                      <h3 style={{ 
                        fontSize: '1.125rem', 
                        fontWeight: '600',
                        color: 'var(--text-primary)'
                      }}>
                        {group.name}
                      </h3>
                      <span style={{
                        fontSize: '0.75rem',
                        padding: '0.25rem 0.5rem',
                        borderRadius: 'var(--radius-full)',
                        background: 'var(--purple-light)',
                        color: 'var(--purple)',
                        fontWeight: '600'
                      }}>
                        {group.users_count || 0} {group.users_count === 1 ? 'usuário' : 'usuários'}
                      </span>
                    </div>
                    {group.description && (
                      <p style={{ 
                        fontSize: '0.875rem',
                        color: 'var(--text-secondary)',
                        marginLeft: '2.25rem',
                        marginBottom: 'var(--spacing-sm)'
                      }}>
                        {group.description}
                      </p>
                    )}
                    <div style={{ 
                      fontSize: '0.8125rem',
                      color: 'var(--text-tertiary)',
                      marginLeft: '2.25rem'
                    }}>
                      <strong>Criado por:</strong> {group.created_by_name} • <strong>Data:</strong> {new Date(group.created_at).toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                  <div style={{ 
                    display: 'flex', 
                    gap: 'var(--spacing-sm)'
                  }}>
                    <button 
                      className="btn btn-info btn-sm"
                      onClick={() => handleManageUsers(group)}
                    >
                      <UserPlus size={16} />
                      Usuários
                    </button>
                    <button 
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleEdit(group)}
                    >
                      <Edit size={16} />
                      Editar
                    </button>
                    <button 
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDelete(group.id)}
                    >
                      <Trash2 size={16} />
                      Excluir
                    </button>
                  </div>
                </div>

                {/* Lista de usuários do grupo */}
                {group.users && group.users.length > 0 && (
                  <div style={{
                    marginTop: 'var(--spacing-md)',
                    paddingTop: 'var(--spacing-md)',
                    borderTop: '1px solid var(--border-primary)'
                  }}>
                    <h4 style={{
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      color: 'var(--text-secondary)',
                      marginBottom: 'var(--spacing-sm)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      Usuários do Grupo
                    </h4>
                    <div style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 'var(--spacing-sm)'
                    }}>
                      {group.users.map(user => (
                        <div
                          key={user.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--spacing-xs)',
                            padding: 'var(--spacing-xs) var(--spacing-sm)',
                            background: 'var(--bg-tertiary)',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--border-primary)',
                            fontSize: '0.8125rem'
                          }}
                        >
                          <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>
                            {user.name}
                          </span>
                          <span style={{ color: 'var(--text-tertiary)' }}>
                            ({user.email})
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Modal de Criar/Editar Grupo */}
      {(showCreateModal || showEditModal) && (
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
        onClick={() => {
          setShowCreateModal(false);
          setShowEditModal(false);
          setSelectedGroup(null);
        }}
        >
          <div 
            className="card" 
            style={{
              width: '90%',
              maxWidth: '500px',
              border: '1px solid var(--border-primary)',
              padding: 'var(--spacing-xl)',
              backgroundColor: 'var(--bg-secondary)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 'var(--spacing-lg)',
              paddingBottom: 'var(--spacing-md)',
              borderBottom: '1px solid var(--border-primary)'
            }}>
              <h2 style={{
                fontSize: '1.5rem',
                fontWeight: '700',
                color: 'var(--text-primary)'
              }}>
                {selectedGroup ? 'Editar Grupo' : 'Criar Novo Grupo'}
              </h2>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setShowCreateModal(false);
                  setShowEditModal(false);
                  setSelectedGroup(null);
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
              <div>
                <label className="label">Nome do Grupo *</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Digite o nome do grupo"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div>
                <label className="label">Descrição</label>
                <textarea
                  className="input"
                  placeholder="Digite uma descrição para o grupo"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>
            </div>

            <div style={{ 
              display: 'flex', 
              gap: 'var(--spacing-sm)', 
              justifyContent: 'flex-end',
              marginTop: 'var(--spacing-xl)',
              paddingTop: 'var(--spacing-md)',
              borderTop: '1px solid var(--border-primary)'
            }}>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setShowCreateModal(false);
                  setShowEditModal(false);
                  setSelectedGroup(null);
                }}
              >
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={!formData.name.trim()}
              >
                <Save size={20} />
                {selectedGroup ? 'Atualizar' : 'Criar'} Grupo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Gerenciar Usuários */}
      {showUsersModal && selectedGroup && (
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
        onClick={() => {
          setShowUsersModal(false);
          setSelectedGroup(null);
        }}
        >
          <div 
            className="card" 
            style={{
              width: '90%',
              maxWidth: '600px',
              maxHeight: '80vh',
              border: '1px solid var(--border-primary)',
              padding: 'var(--spacing-xl)',
              backgroundColor: 'var(--bg-secondary)',
              overflow: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 'var(--spacing-lg)',
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
                  Gerenciar Usuários
                </h2>
                <p style={{
                  fontSize: '0.875rem',
                  color: 'var(--text-secondary)'
                }}>
                  {selectedGroup.name}
                </p>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setShowUsersModal(false);
                  setSelectedGroup(null);
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Usuários do Grupo */}
            {selectedGroup.users && selectedGroup.users.length > 0 && (
              <div style={{ marginBottom: 'var(--spacing-xl)' }}>
                <h3 style={{
                  fontSize: '1rem',
                  fontWeight: '600',
                  color: 'var(--text-primary)',
                  marginBottom: 'var(--spacing-md)'
                }}>
                  Usuários no Grupo ({selectedGroup.users.length})
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                  {selectedGroup.users.map(user => (
                    <div
                      key={user.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: 'var(--spacing-md)',
                        background: 'var(--bg-tertiary)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-primary)'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: '500', color: 'var(--text-primary)' }}>
                          {user.name}
                        </div>
                        <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                          {user.email}
                        </div>
                      </div>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleRemoveUser(user.id)}
                      >
                        <UserMinus size={16} />
                        Remover
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Usuários Disponíveis */}
            {getAvailableUsers().length > 0 && (
              <div>
                <h3 style={{
                  fontSize: '1rem',
                  fontWeight: '600',
                  color: 'var(--text-primary)',
                  marginBottom: 'var(--spacing-md)'
                }}>
                  Usuários Disponíveis ({getAvailableUsers().length})
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                  {getAvailableUsers().map(user => (
                    <div
                      key={user.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: 'var(--spacing-md)',
                        background: 'var(--bg-tertiary)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-primary)'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: '500', color: 'var(--text-primary)' }}>
                          {user.name}
                        </div>
                        <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                          {user.email}
                        </div>
                      </div>
                      <button
                        className="btn btn-success btn-sm"
                        onClick={() => handleAddUser(user.id)}
                      >
                        <UserPlus size={16} />
                        Adicionar
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {getAvailableUsers().length === 0 && (!selectedGroup.users || selectedGroup.users.length === 0) && (
              <div style={{
                textAlign: 'center',
                padding: 'var(--spacing-xl)',
                color: 'var(--text-tertiary)'
              }}>
                Nenhum usuário disponível
              </div>
            )}

            {getAvailableUsers().length === 0 && selectedGroup.users && selectedGroup.users.length > 0 && (
              <div style={{
                textAlign: 'center',
                padding: 'var(--spacing-xl)',
                color: 'var(--text-secondary)'
              }}>
                Todos os usuários já estão neste grupo
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
