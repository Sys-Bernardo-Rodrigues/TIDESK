import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { usePermissions } from '../hooks/usePermissions';
import {
  LogOut,
  Ticket,
  Home,
  Plus,
  FileText,
  FileEdit,
  ChevronDown,
  ChevronRight,
  Settings,
  Shield,
  User,
  FileBarChart,
  PanelLeftClose,
  PanelLeft,
  Calendar,
  CalendarDays,
  Eye,
  CheckCircle,
  Users,
  History,
  Webhook,
  FolderKanban,
  Palette,
  LayoutDashboard,
  Database,
  RefreshCw,
  Pin,
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import type { LucideIcon } from 'lucide-react';
import { APP_VERSION_LABEL } from '../constants/appVersion';

type NavChild = { path: string; label: string; icon: LucideIcon; permission?: string };

type NavItem = {
  path: string;
  label: string;
  icon: LucideIcon;
  permission?: string;
  children?: NavChild[];
};

const MENU_STRUCTURE: { label: string; items: NavItem[] }[] = [
  {
    label: 'Principal',
    items: [
      { path: '/', label: 'Dashboard', icon: Home, permission: '/' },
      { path: '/tickets', label: 'Tickets', icon: Ticket, permission: '/tickets' },
      { path: '/projetos', label: 'Projetos', icon: FolderKanban, permission: '/projetos' },
      { path: '/docs', label: 'Arquivos', icon: FileText, permission: '/docs' },
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

function pathActive(pathname: string, path: string) {
  if (path === '/') return pathname === '/';
  return pathname === path || pathname.startsWith(path + '/');
}

export default function Layout() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const { hasPageAccess } = usePermissions();
  const navigate = useNavigate();
  const location = useLocation();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved !== 'false';
  });
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

  const toggleSidebar = () => {
    setSidebarCollapsed((c) => {
      const next = !c;
      localStorage.setItem('sidebarCollapsed', String(next));
      return next;
    });
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
    if (themeMenuOpen) document.addEventListener('mousedown', handleClickOutside);
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

  const hasAnyAccess = (permission?: string, children?: NavChild[]) => {
    if (permission && hasPageAccess(permission)) return true;
    return children?.some((c) => c.permission && hasPageAccess(c.permission)) ?? false;
  };

  const getInitials = (name?: string) => {
    if (!name) return '?';
    return name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
  };

  const renderNavLink = (path: string, label: string, Icon: LucideIcon, active: boolean) => (
    <Link
      key={path}
      to={path}
      className={`sidebar-rail-item ${active ? 'sidebar-rail-item--active' : ''}`}
      title={sidebarCollapsed ? label : undefined}
      data-tooltip={sidebarCollapsed ? label : undefined}
    >
      <span className="sidebar-rail-item__icon-wrap">
        <Icon size={18} strokeWidth={active ? 2.5 : 2} />
      </span>
      {!sidebarCollapsed && <span className="sidebar-rail-item__label">{label}</span>}
      {active && <span className="sidebar-rail-item__glow" aria-hidden />}
    </Link>
  );

  const renderFlyoutGroup = (item: NavItem) => {
    const groupKey = item.path.replace('/', '');
    const children = (item.children || []).filter((c) => c.permission && hasPageAccess(c.permission));
    if (!children.length) return null;

    const isActive = children.some((c) => pathActive(location.pathname, c.path));
    const isOpen = openGroups[groupKey];

    if (sidebarCollapsed) {
      return (
        <div key={item.path} className="sidebar-flyout-wrap">
          <button
            type="button"
            className={`sidebar-rail-item sidebar-rail-item--group ${isActive ? 'sidebar-rail-item--active' : ''}`}
            title={item.label}
          >
            <span className="sidebar-rail-item__icon-wrap">
              <item.icon size={18} strokeWidth={isActive ? 2.5 : 2} />
            </span>
            {isActive && <span className="sidebar-rail-item__glow" aria-hidden />}
          </button>
          <div className="sidebar-flyout">
            <div className="sidebar-flyout__head">{item.label}</div>
            <div className="sidebar-flyout__links">
              {children.map((child) => {
                const childActive = pathActive(location.pathname, child.path);
                return (
                  <Link
                    key={child.path}
                    to={child.path}
                    className={`sidebar-flyout__link ${childActive ? 'sidebar-flyout__link--active' : ''}`}
                  >
                    <child.icon size={15} strokeWidth={childActive ? 2.5 : 2} />
                    {child.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div key={item.path} className="sidebar-group">
        <button
          type="button"
          className={`sidebar-rail-item sidebar-rail-item--group ${isActive ? 'sidebar-rail-item--active' : ''}`}
          onClick={() => toggleGroup(groupKey)}
        >
          <span className="sidebar-rail-item__icon-wrap">
            <item.icon size={18} strokeWidth={isActive ? 2.5 : 2} />
          </span>
          <span className="sidebar-rail-item__label">{item.label}</span>
          <span className="sidebar-rail-item__chevron">
            {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
        </button>
        {isOpen && (
          <div className="sidebar-submenu">
            {children.map((child) => {
              const childActive = pathActive(location.pathname, child.path);
              return (
                <Link
                  key={child.path}
                  to={child.path}
                  className={`sidebar-submenu__link ${childActive ? 'sidebar-submenu__link--active' : ''}`}
                >
                  <child.icon size={14} strokeWidth={childActive ? 2.5 : 2} />
                  {child.label}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar-rail ${sidebarCollapsed ? 'sidebar-rail--collapsed' : 'sidebar-rail--expanded'}`}>
        <div className="sidebar-rail__accent" aria-hidden />

        <header className="sidebar-rail__header">
          <div className="sidebar-rail__brand">
            <div className="sidebar-rail__logo">
              <LayoutDashboard size={sidebarCollapsed ? 18 : 16} color="#fff" strokeWidth={2.5} />
            </div>
            {!sidebarCollapsed && (
              <div className="sidebar-rail__brand-text">
                <span className="sidebar-rail__brand-name">TIDESK</span>
                <span className="sidebar-rail__brand-ver">{APP_VERSION_LABEL}</span>
              </div>
            )}
          </div>
          <button
            type="button"
            className="sidebar-rail__pin"
            onClick={toggleSidebar}
            title={sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            {sidebarCollapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </header>

        <nav className="sidebar-rail__nav">
          {MENU_STRUCTURE.map((section, sIdx) => {
            const visibleItems = section.items.filter((item) => hasAnyAccess(item.permission, item.children));
            if (!visibleItems.length) return null;

            return (
              <div key={section.label} className="sidebar-rail__section">
                {!sidebarCollapsed && (
                  <div className="sidebar-rail__section-label">{section.label}</div>
                )}
                {sidebarCollapsed && sIdx > 0 && <div className="sidebar-rail__divider" />}
                <div className="sidebar-rail__section-items">
                  {visibleItems.map((item) => {
                    if (item.children) return renderFlyoutGroup(item);
                    if (!item.permission || !hasPageAccess(item.permission)) return null;
                    const active = pathActive(location.pathname, item.path);
                    return renderNavLink(item.path, item.label, item.icon, active);
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <footer className="sidebar-rail__footer">
          <div className={`sidebar-rail__user ${sidebarCollapsed ? 'sidebar-rail__user--compact' : ''}`}>
            <div className="sidebar-rail__avatar">{getInitials(user?.name)}</div>
            {!sidebarCollapsed && (
              <div className="sidebar-rail__user-info">
                <span className="sidebar-rail__user-name">{user?.name}</span>
                <span className="sidebar-rail__user-role">{user?.role}</span>
              </div>
            )}
          </div>

          <div className={`sidebar-rail__actions ${sidebarCollapsed ? 'sidebar-rail__actions--compact' : ''}`}>
            <div className="sidebar-rail__theme-wrap" ref={themeMenuRef}>
              <button
                type="button"
                className="sidebar-rail__action"
                onClick={() => setThemeMenuOpen(!themeMenuOpen)}
                title="Tema"
              >
                <Palette size={16} />
                {!sidebarCollapsed && (
                  <span>{theme === 'light' ? 'Claro' : theme === 'dark' ? 'Escuro' : 'Sistema'}</span>
                )}
              </button>
              {themeMenuOpen && (
                <div className="sidebar-rail__theme-menu">
                  <select
                    value={theme}
                    onChange={(e) => {
                      setTheme(e.target.value as 'light' | 'dark' | 'system');
                      setThemeMenuOpen(false);
                    }}
                    autoFocus
                  >
                    <option value="light">Claro</option>
                    <option value="dark">Escuro</option>
                    <option value="system">Sistema</option>
                  </select>
                </div>
              )}
            </div>
            <button
              type="button"
              className="sidebar-rail__action sidebar-rail__action--logout"
              onClick={handleLogout}
              title="Sair"
            >
              <LogOut size={16} />
              {!sidebarCollapsed && <span>Sair</span>}
            </button>
          </div>

          {sidebarCollapsed && (
            <button
              type="button"
              className="sidebar-rail__expand-hint"
              onClick={toggleSidebar}
              title="Fixar menu expandido"
            >
              <Pin size={12} />
            </button>
          )}
        </footer>
      </aside>

      <main className="app-main">
        <div className="fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
