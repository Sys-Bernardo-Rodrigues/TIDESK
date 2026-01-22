import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions, RESOURCES, ACTIONS } from '../hooks/usePermissions';
import { LogOut, Ticket, Home, Plus, FileText, FileEdit, ChevronDown, ChevronRight, Settings, Shield, User, FileBarChart, Menu, X, LayoutDashboard, Calendar, CalendarDays, Database, RefreshCw, Eye, CheckCircle, Users, History } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function Layout() {
  const { user, logout } = useAuth();
  const { hasPermission } = usePermissions();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [createMenuOpen, setCreateMenuOpen] = useState(
    location.pathname.startsWith('/create')
  );

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isCreateActive = location.pathname.startsWith('/create');
  const isPagesActive = location.pathname === '/create/pages';
  const isFormsActive = location.pathname === '/create/forms';
  
  const [configMenuOpen, setConfigMenuOpen] = useState(
    location.pathname.startsWith('/config')
  );
  
  const isConfigActive = location.pathname.startsWith('/config');
  const isAccessProfileActive = location.pathname === '/config/perfil-de-acesso';
  const isUsersActive = location.pathname === '/config/usuarios';
  const isBackupActive = location.pathname === '/config/backup';
  const isAtualizarActive = location.pathname === '/config/atualizar';
  const isGruposActive = location.pathname === '/config/grupos';

  const [agendaMenuOpen, setAgendaMenuOpen] = useState(
    location.pathname.startsWith('/agenda')
  );
  
  const isAgendaActive = location.pathname.startsWith('/agenda');
  const isServiceCalendarActive = location.pathname === '/agenda/calendario-de-servico';
  const isShiftCalendarActive = location.pathname === '/agenda/calendario-de-plantoes';

  const [acompanharMenuOpen, setAcompanharMenuOpen] = useState(
    location.pathname.startsWith('/acompanhar')
  );
  
  const isAcompanharActive = location.pathname.startsWith('/acompanhar');
  const isAprovarActive = location.pathname === '/acompanhar/aprovar';
  const isAcompanharTratativaActive = location.pathname === '/acompanhar/acompanhar-tratativa';

  // Auto-colapsar submenus quando sidebar é colapsado
  useEffect(() => {
    if (sidebarCollapsed) {
      setCreateMenuOpen(false);
      setConfigMenuOpen(false);
      setAgendaMenuOpen(false);
      setAcompanharMenuOpen(false);
    } else {
      setCreateMenuOpen(location.pathname.startsWith('/create'));
      setConfigMenuOpen(location.pathname.startsWith('/config'));
      setAgendaMenuOpen(location.pathname.startsWith('/agenda'));
      setAcompanharMenuOpen(location.pathname.startsWith('/acompanhar'));
    }
  }, [sidebarCollapsed, location.pathname]);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-primary)' }}>
      {/* Sidebar */}
      <aside className="glass" style={{
        width: sidebarCollapsed ? '80px' : '240px',
        backgroundColor: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border-primary)',
        padding: sidebarCollapsed ? 'var(--spacing-md)' : 'var(--spacing-lg)',
        display: 'flex',
        flexDirection: 'column',
        position: 'sticky',
        top: 0,
        height: '100vh',
        overflowY: 'auto',
        overflowX: 'hidden',
        boxShadow: 'var(--shadow-lg)',
        transition: 'width var(--transition-slow), padding var(--transition-slow)'
      }}>
         {/* Header com Logo Icon e Hamburger */}
         <div style={{ 
           marginBottom: 'var(--spacing-2xl)',
           display: 'flex',
           alignItems: 'center',
           justifyContent: sidebarCollapsed ? 'center' : 'space-between',
           gap: 'var(--spacing-md)'
         }}>
           {!sidebarCollapsed && (
             <div style={{
               display: 'flex',
               alignItems: 'center',
               gap: 'var(--spacing-md)',
               flex: 1
             }}>
               <div style={{
                 padding: 'var(--spacing-sm)',
                 background: 'linear-gradient(135deg, var(--purple) 0%, var(--blue) 100%)',
                 borderRadius: 'var(--radius-md)',
                 display: 'flex',
                 alignItems: 'center',
                 justifyContent: 'center',
                 minWidth: '40px',
                 minHeight: '40px',
                 boxShadow: 'var(--shadow-purple)'
               }}>
                 <LayoutDashboard size={24} color="#FFFFFF" strokeWidth={2.5} />
               </div>
               <div>
                 <div style={{ 
                   fontSize: '0.9375rem', 
                   fontWeight: '700', 
                   color: 'var(--text-primary)',
                   letterSpacing: '-0.02em',
                   lineHeight: '1.2'
                 }}>
                   TIDESK
                 </div>
                 <div style={{
                   fontSize: '0.625rem',
                   color: 'var(--text-tertiary)',
                   fontWeight: '500',
                   letterSpacing: '0.05em',
                   textTransform: 'uppercase'
                 }}>
                   System
                 </div>
               </div>
             </div>
           )}
           <button
             onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
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
               transition: 'all var(--transition-base)',
               minWidth: '36px',
               minHeight: '36px'
             }}
             onMouseEnter={(e) => {
               e.currentTarget.style.background = 'var(--bg-hover)';
               e.currentTarget.style.transform = 'scale(1.05)';
             }}
             onMouseLeave={(e) => {
               e.currentTarget.style.background = 'var(--bg-tertiary)';
               e.currentTarget.style.transform = 'scale(1)';
             }}
             title={sidebarCollapsed ? 'Expandir menu' : 'Colapsar menu'}
           >
             {sidebarCollapsed ? <Menu size={20} /> : <X size={20} />}
           </button>
         </div>

        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
          <Link
            to="/"
            className={`nav-link ${location.pathname === '/' ? 'active' : ''} ${sidebarCollapsed ? 'tooltip' : ''}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: sidebarCollapsed ? '0' : 'var(--spacing-sm)',
              padding: sidebarCollapsed ? 'var(--spacing-sm)' : 'var(--spacing-sm) var(--spacing-md)',
              borderRadius: 'var(--radius-md)',
              textDecoration: 'none',
              color: location.pathname === '/' ? 'var(--purple)' : 'var(--text-secondary)',
              backgroundColor: location.pathname === '/' ? 'var(--purple-light)' : 'transparent',
              transition: 'all var(--transition-base)',
              fontWeight: location.pathname === '/' ? '600' : '500',
              fontSize: '0.875rem',
              justifyContent: sidebarCollapsed ? 'center' : 'flex-start'
            }}
            onMouseEnter={(e) => {
              if (location.pathname !== '/') {
                e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }
            }}
            onMouseLeave={(e) => {
              if (location.pathname !== '/') {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }
            }}
            title={sidebarCollapsed ? 'Dashboard' : ''}
            data-tooltip={sidebarCollapsed ? 'Dashboard' : ''}
          >
            <Home size={sidebarCollapsed ? 28 : 20} strokeWidth={location.pathname === '/' ? 2.5 : 2} />
            {!sidebarCollapsed && <span>Dashboard</span>}
          </Link>
          <Link
            to="/tickets"
            className={`nav-link ${location.pathname.startsWith('/tickets') ? 'active' : ''} ${sidebarCollapsed ? 'tooltip' : ''}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: sidebarCollapsed ? '0' : 'var(--spacing-sm)',
              padding: sidebarCollapsed ? 'var(--spacing-sm)' : 'var(--spacing-sm) var(--spacing-md)',
              borderRadius: 'var(--radius-md)',
              textDecoration: 'none',
              color: location.pathname.startsWith('/tickets') ? 'var(--purple)' : 'var(--text-secondary)',
              backgroundColor: location.pathname.startsWith('/tickets') ? 'var(--purple-light)' : 'transparent',
              transition: 'all var(--transition-base)',
              fontWeight: location.pathname.startsWith('/tickets') ? '600' : '500',
              fontSize: '0.875rem',
              justifyContent: sidebarCollapsed ? 'center' : 'flex-start'
            }}
            onMouseEnter={(e) => {
              if (!location.pathname.startsWith('/tickets')) {
                e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }
            }}
            onMouseLeave={(e) => {
              if (!location.pathname.startsWith('/tickets')) {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }
            }}
            title={sidebarCollapsed ? 'Tickets' : ''}
            data-tooltip={sidebarCollapsed ? 'Tickets' : ''}
          >
            <Ticket size={sidebarCollapsed ? 28 : 20} strokeWidth={location.pathname.startsWith('/tickets') ? 2.5 : 2} />
            {!sidebarCollapsed && <span>Tickets</span>}
          </Link>

          {/* Create Menu */}
          {!sidebarCollapsed && (
            <div style={{ marginTop: 'var(--spacing-xs)' }}>
              <button
                onClick={() => setCreateMenuOpen(!createMenuOpen)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 'var(--spacing-sm)',
                  padding: 'var(--spacing-sm) var(--spacing-md)',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  background: isCreateActive ? 'var(--purple-light)' : 'transparent',
                  color: isCreateActive ? 'var(--purple)' : 'var(--text-secondary)',
                  transition: 'all var(--transition-base)',
                  fontWeight: isCreateActive ? '600' : '500',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
                onMouseEnter={(e) => {
                  if (!isCreateActive) {
                    e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isCreateActive) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                  <Plus size={20} strokeWidth={isCreateActive ? 2.5 : 2} />
                  <span>Criar</span>
                </div>
                {createMenuOpen ? (
                  <ChevronDown size={18} />
                ) : (
                  <ChevronRight size={18} />
                )}
              </button>

              {createMenuOpen && (
                <div className="submenu" style={{
                  marginTop: 'var(--spacing-xs)',
                  marginLeft: 'var(--spacing-lg)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--spacing-xs)'
                }}>
                  {hasPermission(RESOURCES.PAGES, ACTIONS.VIEW) && (
                    <Link
                      to="/create/pages"
                      className={`nav-link ${isPagesActive ? 'active' : ''}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--spacing-md)',
                        padding: 'var(--spacing-sm)',
                        borderRadius: 'var(--radius-md)',
                        textDecoration: 'none',
                        color: isPagesActive ? 'var(--purple)' : 'var(--text-secondary)',
                        backgroundColor: isPagesActive ? 'var(--purple-light)' : 'transparent',
                        transition: 'all var(--transition-base)',
                        fontWeight: isPagesActive ? '600' : '500',
                        fontSize: '0.875rem'
                      }}
                      onMouseEnter={(e) => {
                        if (!isPagesActive) {
                          e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                          e.currentTarget.style.color = 'var(--text-primary)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isPagesActive) {
                          e.currentTarget.style.backgroundColor = 'transparent';
                          e.currentTarget.style.color = 'var(--text-secondary)';
                        }
                      }}
                    >
                      <FileText size={16} strokeWidth={isPagesActive ? 2.5 : 2} />
                      Páginas
                    </Link>
                  )}
                  {hasPermission(RESOURCES.FORMS, ACTIONS.VIEW) && (
                    <Link
                      to="/create/forms"
                      className={`nav-link ${isFormsActive ? 'active' : ''}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--spacing-sm)',
                      padding: 'var(--spacing-sm) var(--spacing-md)',
                      borderRadius: 'var(--radius-md)',
                      textDecoration: 'none',
                      color: isFormsActive ? 'var(--purple)' : 'var(--text-secondary)',
                      backgroundColor: isFormsActive ? 'var(--purple-light)' : 'transparent',
                      transition: 'all var(--transition-base)',
                      fontWeight: isFormsActive ? '600' : '500',
                      fontSize: '0.8125rem'
                    }}
                    onMouseEnter={(e) => {
                      if (!isFormsActive) {
                        e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                        e.currentTarget.style.color = 'var(--text-primary)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isFormsActive) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = 'var(--text-secondary)';
                      }
                    }}
                  >
                      <FileEdit size={16} strokeWidth={isFormsActive ? 2.5 : 2} />
                      Formulários
                    </Link>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Create Menu - Colapsado (apenas ícones) */}
          {(hasPermission(RESOURCES.PAGES, ACTIONS.VIEW) || hasPermission(RESOURCES.FORMS, ACTIONS.VIEW)) && sidebarCollapsed && (
            <div style={{ marginTop: 'var(--spacing-xs)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
              {hasPermission(RESOURCES.PAGES, ACTIONS.VIEW) && (
                <Link
                  to="/create/pages"
                  className={`nav-link ${isPagesActive ? 'active' : ''} tooltip`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 'var(--spacing-sm)',
                    borderRadius: 'var(--radius-md)',
                    textDecoration: 'none',
                    color: isPagesActive ? 'var(--purple)' : 'var(--text-secondary)',
                    backgroundColor: isPagesActive ? 'var(--purple-light)' : 'transparent',
                    transition: 'all var(--transition-base)',
                    fontWeight: isPagesActive ? '600' : '500'
                  }}
                  title="Páginas"
                  data-tooltip="Páginas"
                >
                  <FileText size={28} strokeWidth={isPagesActive ? 2.5 : 2} />
                </Link>
              )}
              {hasPermission(RESOURCES.FORMS, ACTIONS.VIEW) && (
                <Link
                  to="/create/forms"
                  className={`nav-link ${isFormsActive ? 'active' : ''} tooltip`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 'var(--spacing-sm)',
                    borderRadius: 'var(--radius-md)',
                    textDecoration: 'none',
                    color: isFormsActive ? 'var(--purple)' : 'var(--text-secondary)',
                    backgroundColor: isFormsActive ? 'var(--purple-light)' : 'transparent',
                    transition: 'all var(--transition-base)',
                    fontWeight: isFormsActive ? '600' : '500'
                  }}
                  title="Formulários"
                  data-tooltip="Formulários"
                >
                  <FileEdit size={28} strokeWidth={isFormsActive ? 2.5 : 2} />
                </Link>
              )}
            </div>
          )}

          {/* Config Menu */}
          {hasPermission(RESOURCES.CONFIG, ACTIONS.VIEW) && !sidebarCollapsed && (
            <div style={{ marginTop: 'var(--spacing-xs)' }}>
              <button
                onClick={() => setConfigMenuOpen(!configMenuOpen)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 'var(--spacing-sm)',
                  padding: 'var(--spacing-sm) var(--spacing-md)',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  background: isConfigActive ? 'var(--purple-light)' : 'transparent',
                  color: isConfigActive ? 'var(--purple)' : 'var(--text-secondary)',
                  transition: 'all var(--transition-base)',
                  fontWeight: isConfigActive ? '600' : '500',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
                onMouseEnter={(e) => {
                  if (!isConfigActive) {
                    e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isConfigActive) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                  <Settings size={20} strokeWidth={isConfigActive ? 2.5 : 2} />
                  <span>Configurações</span>
                </div>
                {configMenuOpen ? (
                  <ChevronDown size={18} />
                ) : (
                  <ChevronRight size={18} />
                )}
              </button>

              {configMenuOpen && (
                <div className="submenu" style={{
                  marginTop: 'var(--spacing-xs)',
                  marginLeft: 'var(--spacing-lg)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--spacing-xs)'
                }}>
                  <Link
                    to="/config/perfil-de-acesso"
                    className={`nav-link ${isAccessProfileActive ? 'active' : ''}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--spacing-md)',
                      padding: 'var(--spacing-sm)',
                      borderRadius: 'var(--radius-md)',
                      textDecoration: 'none',
                      color: isAccessProfileActive ? 'var(--purple)' : 'var(--text-secondary)',
                      backgroundColor: isAccessProfileActive ? 'var(--purple-light)' : 'transparent',
                      transition: 'all var(--transition-base)',
                      fontWeight: isAccessProfileActive ? '600' : '500',
                      fontSize: '0.875rem'
                    }}
                    onMouseEnter={(e) => {
                      if (!isAccessProfileActive) {
                        e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                        e.currentTarget.style.color = 'var(--text-primary)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isAccessProfileActive) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = 'var(--text-secondary)';
                      }
                    }}
                  >
                    <Shield size={16} strokeWidth={isAccessProfileActive ? 2.5 : 2} />
                    Perfil de Acesso
                  </Link>
                  <Link
                    to="/config/usuarios"
                    className={`nav-link ${isUsersActive ? 'active' : ''}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--spacing-sm)',
                      padding: 'var(--spacing-sm) var(--spacing-md)',
                      borderRadius: 'var(--radius-md)',
                      textDecoration: 'none',
                      color: isUsersActive ? 'var(--purple)' : 'var(--text-secondary)',
                      backgroundColor: isUsersActive ? 'var(--purple-light)' : 'transparent',
                      transition: 'all var(--transition-base)',
                      fontWeight: isUsersActive ? '600' : '500',
                      fontSize: '0.8125rem'
                    }}
                    onMouseEnter={(e) => {
                      if (!isUsersActive) {
                        e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                        e.currentTarget.style.color = 'var(--text-primary)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isUsersActive) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = 'var(--text-secondary)';
                      }
                    }}
                  >
                    <User size={16} strokeWidth={isUsersActive ? 2.5 : 2} />
                    Usuários
                  </Link>
                  <Link
                    to="/config/backup"
                    className={`nav-link ${isBackupActive ? 'active' : ''}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--spacing-sm)',
                      padding: 'var(--spacing-sm) var(--spacing-md)',
                      borderRadius: 'var(--radius-md)',
                      textDecoration: 'none',
                      color: isBackupActive ? 'var(--purple)' : 'var(--text-secondary)',
                      backgroundColor: isBackupActive ? 'var(--purple-light)' : 'transparent',
                      transition: 'all var(--transition-base)',
                      fontWeight: isBackupActive ? '600' : '500',
                      fontSize: '0.8125rem'
                    }}
                    onMouseEnter={(e) => {
                      if (!isBackupActive) {
                        e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                        e.currentTarget.style.color = 'var(--text-primary)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isBackupActive) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = 'var(--text-secondary)';
                      }
                    }}
                  >
                    <Database size={16} strokeWidth={isBackupActive ? 2.5 : 2} />
                    Backup
                  </Link>
                  <Link
                    to="/config/atualizar"
                    className={`nav-link ${isAtualizarActive ? 'active' : ''}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--spacing-sm)',
                      padding: 'var(--spacing-sm) var(--spacing-md)',
                      borderRadius: 'var(--radius-md)',
                      textDecoration: 'none',
                      color: isAtualizarActive ? 'var(--purple)' : 'var(--text-secondary)',
                      backgroundColor: isAtualizarActive ? 'var(--purple-light)' : 'transparent',
                      transition: 'all var(--transition-base)',
                      fontWeight: isAtualizarActive ? '600' : '500',
                      fontSize: '0.8125rem'
                    }}
                    onMouseEnter={(e) => {
                      if (!isAtualizarActive) {
                        e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                        e.currentTarget.style.color = 'var(--text-primary)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isAtualizarActive) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = 'var(--text-secondary)';
                      }
                    }}
                  >
                    <RefreshCw size={16} strokeWidth={isAtualizarActive ? 2.5 : 2} />
                    Atualizar
                  </Link>
                  <Link
                    to="/config/grupos"
                    className={`nav-link ${isGruposActive ? 'active' : ''}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--spacing-sm)',
                      padding: 'var(--spacing-sm) var(--spacing-md)',
                      borderRadius: 'var(--radius-md)',
                      textDecoration: 'none',
                      color: isGruposActive ? 'var(--purple)' : 'var(--text-secondary)',
                      backgroundColor: isGruposActive ? 'var(--purple-light)' : 'transparent',
                      transition: 'all var(--transition-base)',
                      fontWeight: isGruposActive ? '600' : '500',
                      fontSize: '0.8125rem'
                    }}
                    onMouseEnter={(e) => {
                      if (!isGruposActive) {
                        e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                        e.currentTarget.style.color = 'var(--text-primary)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isGruposActive) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = 'var(--text-secondary)';
                      }
                    }}
                  >
                    <Users size={16} strokeWidth={isGruposActive ? 2.5 : 2} />
                    Grupos
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* Config Menu - Colapsado (apenas ícones) */}
          {hasPermission(RESOURCES.CONFIG, ACTIONS.VIEW) && sidebarCollapsed && (
            <div style={{ marginTop: 'var(--spacing-xs)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
              <Link
                to="/config/perfil-de-acesso"
                className={`nav-link ${isAccessProfileActive ? 'active' : ''} tooltip`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 'var(--spacing-sm)',
                  borderRadius: 'var(--radius-md)',
                  textDecoration: 'none',
                  color: isAccessProfileActive ? 'var(--purple)' : 'var(--text-secondary)',
                  backgroundColor: isAccessProfileActive ? 'var(--purple-light)' : 'transparent',
                  transition: 'all var(--transition-base)',
                  fontWeight: isAccessProfileActive ? '600' : '500'
                }}
                title="Perfil de Acesso"
                data-tooltip="Perfil de Acesso"
              >
                <Shield size={28} strokeWidth={isAccessProfileActive ? 2.5 : 2} />
              </Link>
              <Link
                to="/config/usuarios"
                className={`nav-link ${isUsersActive ? 'active' : ''} tooltip`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 'var(--spacing-sm)',
                  borderRadius: 'var(--radius-md)',
                  textDecoration: 'none',
                  color: isUsersActive ? 'var(--purple)' : 'var(--text-secondary)',
                  backgroundColor: isUsersActive ? 'var(--purple-light)' : 'transparent',
                  transition: 'all var(--transition-base)',
                  fontWeight: isUsersActive ? '600' : '500'
                }}
                title="Usuários"
                data-tooltip="Usuários"
              >
                <User size={28} strokeWidth={isUsersActive ? 2.5 : 2} />
              </Link>
              <Link
                to="/config/backup"
                className={`nav-link ${isBackupActive ? 'active' : ''} tooltip`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 'var(--spacing-sm)',
                  borderRadius: 'var(--radius-md)',
                  textDecoration: 'none',
                  color: isBackupActive ? 'var(--purple)' : 'var(--text-secondary)',
                  backgroundColor: isBackupActive ? 'var(--purple-light)' : 'transparent',
                  transition: 'all var(--transition-base)',
                  fontWeight: isBackupActive ? '600' : '500'
                }}
                title="Backup"
                data-tooltip="Backup"
              >
                <Database size={28} strokeWidth={isBackupActive ? 2.5 : 2} />
              </Link>
              <Link
                to="/config/atualizar"
                className={`nav-link ${isAtualizarActive ? 'active' : ''} tooltip`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 'var(--spacing-sm)',
                  borderRadius: 'var(--radius-md)',
                  textDecoration: 'none',
                  color: isAtualizarActive ? 'var(--purple)' : 'var(--text-secondary)',
                  backgroundColor: isAtualizarActive ? 'var(--purple-light)' : 'transparent',
                  transition: 'all var(--transition-base)',
                  fontWeight: isAtualizarActive ? '600' : '500'
                }}
                title="Atualizar"
                data-tooltip="Atualizar"
              >
                <RefreshCw size={28} strokeWidth={isAtualizarActive ? 2.5 : 2} />
              </Link>
              <Link
                to="/config/grupos"
                className={`nav-link ${isGruposActive ? 'active' : ''} tooltip`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 'var(--spacing-sm)',
                  borderRadius: 'var(--radius-md)',
                  textDecoration: 'none',
                  color: isGruposActive ? 'var(--purple)' : 'var(--text-secondary)',
                  backgroundColor: isGruposActive ? 'var(--purple-light)' : 'transparent',
                  transition: 'all var(--transition-base)',
                  fontWeight: isGruposActive ? '600' : '500'
                }}
                title="Grupos"
                data-tooltip="Grupos"
              >
                <Users size={28} strokeWidth={isGruposActive ? 2.5 : 2} />
              </Link>
            </div>
          )}

          {/* Agenda Menu */}
          {hasPermission(RESOURCES.AGENDA, ACTIONS.VIEW) && !sidebarCollapsed && (
            <div style={{ marginTop: 'var(--spacing-xs)' }}>
              <button
                onClick={() => setAgendaMenuOpen(!agendaMenuOpen)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 'var(--spacing-sm)',
                  padding: 'var(--spacing-sm) var(--spacing-md)',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  background: isAgendaActive ? 'var(--purple-light)' : 'transparent',
                  color: isAgendaActive ? 'var(--purple)' : 'var(--text-secondary)',
                  transition: 'all var(--transition-base)',
                  fontWeight: isAgendaActive ? '600' : '500',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
                onMouseEnter={(e) => {
                  if (!isAgendaActive) {
                    e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isAgendaActive) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                  <Calendar size={20} strokeWidth={isAgendaActive ? 2.5 : 2} />
                  <span>Agenda</span>
                </div>
                {agendaMenuOpen ? (
                  <ChevronDown size={18} />
                ) : (
                  <ChevronRight size={18} />
                )}
              </button>

              {agendaMenuOpen && (
                <div className="submenu" style={{
                  marginTop: 'var(--spacing-xs)',
                  marginLeft: 'var(--spacing-lg)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--spacing-xs)'
                }}>
                  <Link
                    to="/agenda/calendario-de-servico"
                    className={`nav-link ${isServiceCalendarActive ? 'active' : ''}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--spacing-md)',
                      padding: 'var(--spacing-sm)',
                      borderRadius: 'var(--radius-md)',
                      textDecoration: 'none',
                      color: isServiceCalendarActive ? 'var(--purple)' : 'var(--text-secondary)',
                      backgroundColor: isServiceCalendarActive ? 'var(--purple-light)' : 'transparent',
                      transition: 'all var(--transition-base)',
                      fontWeight: isServiceCalendarActive ? '600' : '500',
                      fontSize: '0.875rem'
                    }}
                    onMouseEnter={(e) => {
                      if (!isServiceCalendarActive) {
                        e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                        e.currentTarget.style.color = 'var(--text-primary)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isServiceCalendarActive) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = 'var(--text-secondary)';
                      }
                    }}
                  >
                    <Calendar size={16} strokeWidth={isServiceCalendarActive ? 2.5 : 2} />
                    Calendário de Serviço
                  </Link>
                  <Link
                    to="/agenda/calendario-de-plantoes"
                    className={`nav-link ${isShiftCalendarActive ? 'active' : ''}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--spacing-sm)',
                      padding: 'var(--spacing-sm) var(--spacing-md)',
                      borderRadius: 'var(--radius-md)',
                      textDecoration: 'none',
                      color: isShiftCalendarActive ? 'var(--purple)' : 'var(--text-secondary)',
                      backgroundColor: isShiftCalendarActive ? 'var(--purple-light)' : 'transparent',
                      transition: 'all var(--transition-base)',
                      fontWeight: isShiftCalendarActive ? '600' : '500',
                      fontSize: '0.8125rem'
                    }}
                    onMouseEnter={(e) => {
                      if (!isShiftCalendarActive) {
                        e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                        e.currentTarget.style.color = 'var(--text-primary)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isShiftCalendarActive) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = 'var(--text-secondary)';
                      }
                    }}
                  >
                    <CalendarDays size={16} strokeWidth={isShiftCalendarActive ? 2.5 : 2} />
                    Calendário de Plantões
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* Agenda Menu - Colapsado (apenas ícones) */}
          {hasPermission(RESOURCES.AGENDA, ACTIONS.VIEW) && sidebarCollapsed && (
            <div style={{ marginTop: 'var(--spacing-xs)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
              <Link
                to="/agenda/calendario-de-servico"
                className={`nav-link ${isServiceCalendarActive ? 'active' : ''} tooltip`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 'var(--spacing-sm)',
                  borderRadius: 'var(--radius-md)',
                  textDecoration: 'none',
                  color: isServiceCalendarActive ? 'var(--purple)' : 'var(--text-secondary)',
                  backgroundColor: isServiceCalendarActive ? 'var(--purple-light)' : 'transparent',
                  transition: 'all var(--transition-base)',
                  fontWeight: isServiceCalendarActive ? '600' : '500'
                }}
                title="Calendário de Serviço"
                data-tooltip="Calendário de Serviço"
              >
                <Calendar size={28} strokeWidth={isServiceCalendarActive ? 2.5 : 2} />
              </Link>
              <Link
                to="/agenda/calendario-de-plantoes"
                className={`nav-link ${isShiftCalendarActive ? 'active' : ''} tooltip`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 'var(--spacing-sm)',
                  borderRadius: 'var(--radius-md)',
                  textDecoration: 'none',
                  color: isShiftCalendarActive ? 'var(--purple)' : 'var(--text-secondary)',
                  backgroundColor: isShiftCalendarActive ? 'var(--purple-light)' : 'transparent',
                  transition: 'all var(--transition-base)',
                  fontWeight: isShiftCalendarActive ? '600' : '500'
                }}
                title="Calendário de Plantões"
                data-tooltip="Calendário de Plantões"
              >
                <CalendarDays size={28} strokeWidth={isShiftCalendarActive ? 2.5 : 2} />
              </Link>
            </div>
          )}

          {/* Acompanhar Menu */}
          {(hasPermission(RESOURCES.APPROVE, ACTIONS.VIEW) || hasPermission(RESOURCES.TRACK, ACTIONS.VIEW)) && !sidebarCollapsed && (
            <div style={{ marginTop: 'var(--spacing-xs)' }}>
              <button
                onClick={() => setAcompanharMenuOpen(!acompanharMenuOpen)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 'var(--spacing-sm)',
                  padding: 'var(--spacing-sm) var(--spacing-md)',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  background: isAcompanharActive ? 'var(--purple-light)' : 'transparent',
                  color: isAcompanharActive ? 'var(--purple)' : 'var(--text-secondary)',
                  transition: 'all var(--transition-base)',
                  fontWeight: isAcompanharActive ? '600' : '500',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
                onMouseEnter={(e) => {
                  if (!isAcompanharActive) {
                    e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isAcompanharActive) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                  <Eye size={20} strokeWidth={isAcompanharActive ? 2.5 : 2} />
                  <span>Acompanhar</span>
                </div>
                {acompanharMenuOpen ? (
                  <ChevronDown size={18} />
                ) : (
                  <ChevronRight size={18} />
                )}
              </button>

              {acompanharMenuOpen && (
                <div className="submenu" style={{
                  marginTop: 'var(--spacing-xs)',
                  marginLeft: 'var(--spacing-lg)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--spacing-xs)'
                }}>
                  {hasPermission(RESOURCES.APPROVE, ACTIONS.VIEW) && (
                    <Link
                      to="/acompanhar/aprovar"
                      className={`nav-link ${isAprovarActive ? 'active' : ''}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--spacing-md)',
                        padding: 'var(--spacing-sm)',
                        borderRadius: 'var(--radius-md)',
                        textDecoration: 'none',
                        color: isAprovarActive ? 'var(--purple)' : 'var(--text-secondary)',
                        backgroundColor: isAprovarActive ? 'var(--purple-light)' : 'transparent',
                        transition: 'all var(--transition-base)',
                        fontWeight: isAprovarActive ? '600' : '500',
                        fontSize: '0.875rem'
                      }}
                      onMouseEnter={(e) => {
                        if (!isAprovarActive) {
                          e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                          e.currentTarget.style.color = 'var(--text-primary)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isAprovarActive) {
                          e.currentTarget.style.backgroundColor = 'transparent';
                          e.currentTarget.style.color = 'var(--text-secondary)';
                        }
                      }}
                    >
                      <CheckCircle size={16} strokeWidth={isAprovarActive ? 2.5 : 2} />
                      Aprovar
                    </Link>
                  )}
                  {hasPermission(RESOURCES.TRACK, ACTIONS.VIEW) && (
                    <Link
                      to="/acompanhar/acompanhar-tratativa"
                      className={`nav-link ${isAcompanharTratativaActive ? 'active' : ''}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--spacing-sm)',
                      padding: 'var(--spacing-sm) var(--spacing-md)',
                      borderRadius: 'var(--radius-md)',
                      textDecoration: 'none',
                      color: isAcompanharTratativaActive ? 'var(--purple)' : 'var(--text-secondary)',
                      backgroundColor: isAcompanharTratativaActive ? 'var(--purple-light)' : 'transparent',
                      transition: 'all var(--transition-base)',
                      fontWeight: isAcompanharTratativaActive ? '600' : '500',
                      fontSize: '0.8125rem'
                    }}
                    onMouseEnter={(e) => {
                      if (!isAcompanharTratativaActive) {
                        e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                        e.currentTarget.style.color = 'var(--text-primary)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isAcompanharTratativaActive) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = 'var(--text-secondary)';
                      }
                    }}
                  >
                      <Eye size={16} strokeWidth={isAcompanharTratativaActive ? 2.5 : 2} />
                      Acompanhar Tratativa
                    </Link>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Acompanhar Menu - Colapsado (apenas ícones) */}
          {(hasPermission(RESOURCES.APPROVE, ACTIONS.VIEW) || hasPermission(RESOURCES.TRACK, ACTIONS.VIEW)) && sidebarCollapsed && (
            <div style={{ marginTop: 'var(--spacing-xs)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
              {hasPermission(RESOURCES.APPROVE, ACTIONS.VIEW) && (
                <Link
                  to="/acompanhar/aprovar"
                  className={`nav-link ${isAprovarActive ? 'active' : ''} tooltip`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 'var(--spacing-sm)',
                  borderRadius: 'var(--radius-md)',
                  textDecoration: 'none',
                  color: isAprovarActive ? 'var(--purple)' : 'var(--text-secondary)',
                  backgroundColor: isAprovarActive ? 'var(--purple-light)' : 'transparent',
                  transition: 'all var(--transition-base)',
                  fontWeight: isAprovarActive ? '600' : '500'
                }}
                title="Aprovar"
                data-tooltip="Aprovar"
              >
                  <CheckCircle size={28} strokeWidth={isAprovarActive ? 2.5 : 2} />
                </Link>
              )}
              {hasPermission(RESOURCES.TRACK, ACTIONS.VIEW) && (
                <Link
                  to="/acompanhar/acompanhar-tratativa"
                  className={`nav-link ${isAcompanharTratativaActive ? 'active' : ''} tooltip`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 'var(--spacing-sm)',
                  borderRadius: 'var(--radius-md)',
                  textDecoration: 'none',
                  color: isAcompanharTratativaActive ? 'var(--purple)' : 'var(--text-secondary)',
                  backgroundColor: isAcompanharTratativaActive ? 'var(--purple-light)' : 'transparent',
                  transition: 'all var(--transition-base)',
                  fontWeight: isAcompanharTratativaActive ? '600' : '500'
                }}
                title="Acompanhar Tratativa"
                data-tooltip="Acompanhar Tratativa"
              >
                <Eye size={28} strokeWidth={isAcompanharTratativaActive ? 2.5 : 2} />
              </Link>
              )}
            </div>
          )}

          {/* Histórico Link */}
          {hasPermission(RESOURCES.HISTORY, ACTIONS.VIEW) && (
            <Link
              to="/historico"
              className={`nav-link ${location.pathname === '/historico' ? 'active' : ''} ${sidebarCollapsed ? 'tooltip' : ''}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: sidebarCollapsed ? '0' : 'var(--spacing-sm)',
                padding: sidebarCollapsed ? 'var(--spacing-sm)' : 'var(--spacing-sm) var(--spacing-md)',
                borderRadius: 'var(--radius-md)',
                textDecoration: 'none',
                color: location.pathname === '/historico' ? 'var(--purple)' : 'var(--text-secondary)',
                backgroundColor: location.pathname === '/historico' ? 'var(--purple-light)' : 'transparent',
                transition: 'all var(--transition-base)',
                fontWeight: location.pathname === '/historico' ? '600' : '500',
                fontSize: '0.875rem',
                justifyContent: sidebarCollapsed ? 'center' : 'flex-start'
              }}
              onMouseEnter={(e) => {
                if (location.pathname !== '/historico') {
                  e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }
              }}
              onMouseLeave={(e) => {
                if (location.pathname !== '/historico') {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }
              }}
              title={sidebarCollapsed ? 'Histórico' : ''}
              data-tooltip={sidebarCollapsed ? 'Histórico' : ''}
            >
              <History size={sidebarCollapsed ? 28 : 20} strokeWidth={location.pathname === '/historico' ? 2.5 : 2} />
              {!sidebarCollapsed && <span>Histórico</span>}
            </Link>
          )}

          {/* Relatórios Link */}
          {hasPermission(RESOURCES.REPORTS, ACTIONS.VIEW) && (
            <Link
              to="/relatorios"
              className={`nav-link ${location.pathname === '/relatorios' ? 'active' : ''} ${sidebarCollapsed ? 'tooltip' : ''}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: sidebarCollapsed ? '0' : 'var(--spacing-sm)',
                padding: sidebarCollapsed ? 'var(--spacing-sm)' : 'var(--spacing-sm) var(--spacing-md)',
                borderRadius: 'var(--radius-md)',
                textDecoration: 'none',
                color: location.pathname === '/relatorios' ? 'var(--purple)' : 'var(--text-secondary)',
                backgroundColor: location.pathname === '/relatorios' ? 'var(--purple-light)' : 'transparent',
                transition: 'all var(--transition-base)',
                fontWeight: location.pathname === '/relatorios' ? '600' : '500',
                fontSize: '0.875rem',
                justifyContent: sidebarCollapsed ? 'center' : 'flex-start'
              }}
              onMouseEnter={(e) => {
                if (location.pathname !== '/relatorios') {
                  e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }
              }}
              onMouseLeave={(e) => {
                if (location.pathname !== '/relatorios') {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }
              }}
              title={sidebarCollapsed ? 'Relatórios' : ''}
              data-tooltip={sidebarCollapsed ? 'Relatórios' : ''}
            >
              <FileBarChart size={sidebarCollapsed ? 28 : 20} strokeWidth={location.pathname === '/relatorios' ? 2.5 : 2} />
              {!sidebarCollapsed && <span>Relatórios</span>}
            </Link>
          )}
        </nav>

        <div style={{
          paddingTop: 'var(--spacing-lg)',
          borderTop: '1px solid var(--border-primary)',
          marginTop: 'auto'
        }}>
          {!sidebarCollapsed ? (
            <>
              <div className="card" style={{ 
                marginBottom: 'var(--spacing-md)',
                padding: 'var(--spacing-md)',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-primary)'
              }}>
                <div style={{ 
                  fontSize: '0.875rem', 
                  fontWeight: '600',
                  color: 'var(--text-primary)',
                  marginBottom: 'var(--spacing-xs)'
                }}>
                  {user?.name}
                </div>
                <div style={{ 
                  fontSize: '0.75rem', 
                  color: 'var(--text-tertiary)',
                  marginBottom: 'var(--spacing-xs)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {user?.email}
                </div>
                <div style={{
                  display: 'inline-block',
                  fontSize: '0.6875rem',
                  color: 'var(--purple)',
                  marginTop: 'var(--spacing-xs)',
                  textTransform: 'uppercase',
                  fontWeight: '700',
                  letterSpacing: '0.05em',
                  padding: '0.25rem 0.5rem',
                  background: 'var(--purple-light)',
                  borderRadius: 'var(--radius-full)',
                  border: '1px solid rgba(145, 71, 255, 0.2)'
                }}>
                  {user?.role}
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="btn btn-secondary"
                style={{
                  width: '100%',
                  justifyContent: 'flex-start',
                  fontSize: '0.875rem'
                }}
              >
                <LogOut size={18} />
                Sair
              </button>
            </>
          ) : (
            <button
              onClick={handleLogout}
              className="btn btn-secondary"
              style={{
                width: '100%',
                justifyContent: 'center',
                fontSize: '0.875rem',
                padding: 'var(--spacing-md)'
              }}
              title="Sair"
            >
              <LogOut size={28} />
            </button>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main style={{ 
        flex: 1, 
        padding: 'var(--spacing-2xl)', 
        overflow: 'auto',
        backgroundColor: 'var(--bg-primary)',
        minWidth: 0
      }}>
        <div className="fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
