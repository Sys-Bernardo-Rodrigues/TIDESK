import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { usePermissions } from '../hooks/usePermissions';
import {
  LogOut, Ticket, Home, Plus, FileText, FileEdit, ChevronDown, ChevronRight,
  Settings, Shield, User, FileBarChart, PanelLeftClose, PanelLeft,
  Calendar, CalendarDays, Eye, CheckCircle, Users, History, Webhook, FolderKanban,
  Palette, LayoutDashboard, Database, RefreshCw
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import type { LucideIcon } from 'lucide-react';

type NavItem = {
  path: string;
  label: string;
  icon: LucideIcon;
  permission?: string;
  children?: { path: string; label: string; icon: LucideIcon; permission?: string }[];
};

const MENU_STRUCTURE: { label: string; items: NavItem[] }[] = [
  {
    label: 'Principal',
    items: [
      { path: '/', label: 'Dashboard', icon: Home, permission: '/' },
      { path: '/tickets', label: 'Tickets', icon: Ticket, permission: '/tickets' },
      { path: '/projetos', label: 'Projetos', icon: FolderKanban, permission: '/projetos' },
    ],
  },
  {
    label: 'Criar',
    items: [{
      path: '/create',
      label: 'Criar',
      icon: Plus,
      children: [
        { path: '/create/pages', label: 'Páginas', icon: FileText, permission: '/create/pages' },
        { path: '/create/forms', label: 'Formulários', icon: FileEdit, permission: '/create/forms' },
        { path: '/create/webhooks', label: 'Webhooks', icon: Webhook, permission: '/create/webhooks' },
      ],
    }],
  },
  {
    label: 'Operacional',
    items: [
      {
        path: '/agenda',
        label: 'Agenda',
        icon: Calendar,
        children: [
          { path: '/agenda/calendario-de-servico', label: 'Cal. Serviço', icon: Calendar, permission: '/agenda/calendario-de-servico' },
          { path: '/agenda/calendario-de-plantoes', label: 'Cal. Plantões', icon: CalendarDays, permission: '/agenda/calendario-de-plantoes' },
        ],
      },
      {
        path: '/acompanhar',
        label: 'Acompanhar',
        icon: Eye,
        children: [
          { path: '/acompanhar/aprovar', label: 'Aprovar', icon: CheckCircle, permission: '/acompanhar/aprovar' },
          { path: '/acompanhar/acompanhar-tratativa', label: 'Tratativa', icon: Eye, permission: '/acompanhar/acompanhar-tratativa' },
        ],
      },
      { path: '/historico', label: 'Histórico', icon: History, permission: '/historico' },
      { path: '/relatorios', label: 'Relatórios', icon: FileBarChart, permission: '/relatorios' },
    ],
  },
  {
    label: 'Sistema',
    items: [{
      path: '/config',
      label: 'Configurações',
      icon: Settings,
      children: [
        { path: '/config/perfil-de-acesso', label: 'Perfil de Acesso', icon: Shield, permission: '/config/perfil-de-acesso' },
        { path: '/config/usuarios', label: 'Usuários', icon: User, permission: '/config/usuarios' },
        { path: '/config/grupos', label: 'Grupos', icon: Users, permission: '/config/grupos' },
        { path: '/config/backup', label: 'Backup', icon: Database, permission: '/config/backup' },
        { path: '/config/atualizar', label: 'Atualizar', icon: RefreshCw, permission: '/config/atualizar' },
      ],
    }],
  },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const { hasPageAccess } = usePermissions();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const themeMenuRef = useRef<HTMLDivElement>(null);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    create: location.pathname.startsWith('/create'),
    agenda: location.pathname.startsWith('/agenda'),
    acompanhar: location.pathname.startsWith('/acompanhar'),
    config: location.pathname.startsWith('/config'),
  });

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleGroup = (key: string) => {
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(e.target as Node)) {
        setThemeMenuOpen(false);
      }
    };
    if (themeMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [themeMenuOpen]);

  useEffect(() => {
    if (sidebarCollapsed) {
      setThemeMenuOpen(false);
      setOpenGroups({ create: false, agenda: false, acompanhar: false, config: false });
    } else {
      setOpenGroups({
        create: location.pathname.startsWith('/create'),
        agenda: location.pathname.startsWith('/agenda'),
        acompanhar: location.pathname.startsWith('/acompanhar'),
        config: location.pathname.startsWith('/config'),
      });
    }
  }, [sidebarCollapsed, location.pathname]);

  const hasAnyAccess = (permission?: string, children?: { permission?: string }[]) => {
    if (permission && hasPageAccess(permission)) return true;
    return children?.some((c) => c.permission && hasPageAccess(c.permission)) ?? false;
  };

  const getInitials = (name?: string) => {
    if (!name) return '?';
    return name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-primary)' }}>
      <aside
        className={`sidebar ${sidebarCollapsed ? 'sidebar--collapsed' : 'sidebar--expanded'}`}
      >
        {/* Header */}
        <div className={`sidebar-header ${sidebarCollapsed ? 'sidebar-header--collapsed' : ''}`}>
          {sidebarCollapsed ? (
            <button
              className="sidebar-toggle sidebar-toggle--expand"
              onClick={() => setSidebarCollapsed(false)}
              title="Expandir menu"
            >
              <PanelLeft size={20} />
            </button>
          ) : (
            <>
              <div className="sidebar-logo">
                <LayoutDashboard size={18} color="#FFF" strokeWidth={2.5} />
              </div>
              <div className="sidebar-logo-text">
                TIDESK<span className="sidebar-logo-badge">BETA</span>
              </div>
              <button
                className="sidebar-toggle"
                onClick={() => setSidebarCollapsed(true)}
                title="Recolher menu"
              >
                <PanelLeftClose size={18} />
              </button>
            </>
          )}
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          {MENU_STRUCTURE.map((section) => (
            <div key={section.label} className="sidebar-section">
              <div className="sidebar-section-label">{section.label}</div>
              {section.items.map((item) => {
                if (item.children) {
                  const groupKey = item.path.replace('/', '');
                  const hasAccess = hasAnyAccess(item.permission, item.children);
                  if (!hasAccess) return null;

                  const isOpen = openGroups[groupKey];
                  const isActive = item.children.some((c) => location.pathname === c.path || location.pathname.startsWith(c.path + '/'));

                  if (sidebarCollapsed) {
                    return (
                      <div key={item.path} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {item.children
                          .filter((c) => c.permission && hasPageAccess(c.permission))
                          .map((child) => (
                            <Link
                              key={child.path}
                              to={child.path}
                              className={`sidebar-item tooltip ${location.pathname === child.path ? 'sidebar-item--active' : ''}`}
                              data-tooltip={child.label}
                              title={child.label}
                            >
                              <child.icon size={18} strokeWidth={location.pathname === child.path ? 2.5 : 2} className="sidebar-item-icon" />
                              <span className="sidebar-item-text">{child.label}</span>
                            </Link>
                          ))}
                      </div>
                    );
                  }

                  return (
                    <div key={item.path}>
                      <button
                        type="button"
                        className={`sidebar-group-btn ${isActive ? 'sidebar-group-btn--active' : ''}`}
                        onClick={() => toggleGroup(groupKey)}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <item.icon size={18} strokeWidth={isActive ? 2.5 : 2} className="sidebar-item-icon" />
                          <span className="sidebar-item-text">{item.label}</span>
                        </div>
                        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>
                      {isOpen && (
                        <div className="sidebar-submenu">
                          {item.children
                            .filter((c) => c.permission && hasPageAccess(c.permission))
                            .map((child) => (
                              <Link
                                key={child.path}
                                to={child.path}
                                className={`sidebar-subitem ${location.pathname === child.path ? 'sidebar-subitem--active' : ''}`}
                              >
                                <child.icon size={14} strokeWidth={location.pathname === child.path ? 2.5 : 2} className="sidebar-subitem-icon" />
                                {child.label}
                              </Link>
                            ))}
                        </div>
                      )}
                    </div>
                  );
                }

                if (!item.permission || !hasPageAccess(item.permission)) return null;

                const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`sidebar-item tooltip ${isActive ? 'sidebar-item--active' : ''}`}
                    data-tooltip={sidebarCollapsed ? item.label : ''}
                    title={sidebarCollapsed ? item.label : ''}
                  >
                    <item.icon size={18} strokeWidth={isActive ? 2.5 : 2} className="sidebar-item-icon" />
                    <span className="sidebar-item-text">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-user-avatar">{getInitials(user?.name)}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{user?.name}</div>
              <div className="sidebar-user-role">{user?.role}</div>
            </div>
          </div>
          <div className="sidebar-actions">
            <div className="sidebar-theme-select-wrapper" ref={themeMenuRef}>
              <button
                type="button"
                className="sidebar-action-btn sidebar-theme-trigger tooltip"
                onClick={() => setThemeMenuOpen(!themeMenuOpen)}
                title="Tema"
                data-tooltip="Tema"
              >
                <Palette size={16} />
                {!sidebarCollapsed && (
                  <>
                    <span className="sidebar-theme-label">
                      {theme === 'light' ? 'Claro' : theme === 'dark' ? 'Escuro' : 'Sistema'}
                    </span>
                    <ChevronDown size={14} style={{ marginLeft: 'auto' }} />
                  </>
                )}
              </button>
              {themeMenuOpen && (
                <div className="sidebar-theme-dropdown">
                  <select
                    className="sidebar-theme-select"
                    value={theme}
                    onChange={(e) => {
                      setTheme(e.target.value as 'light' | 'dark' | 'system');
                      setThemeMenuOpen(false);
                    }}
                    autoFocus
                  >
                    <option value="light">Claro</option>
                    <option value="dark">Escuro</option>
                    <option value="system">Padrão do sistema</option>
                  </select>
                </div>
              )}
            </div>
            <button
              type="button"
              className="sidebar-action-btn sidebar-action-btn--logout tooltip"
              onClick={handleLogout}
              title="Sair"
              data-tooltip="Sair"
              style={{ color: 'var(--red)' }}
            >
              <LogOut size={16} />
              {!sidebarCollapsed && <span>Sair</span>}
            </button>
          </div>
        </div>
      </aside>

      <main
        style={{
          flex: 1,
          padding: 'var(--spacing-2xl)',
          overflow: 'auto',
          backgroundColor: 'var(--bg-primary)',
          minWidth: 0,
        }}
      >
        <div className="fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
