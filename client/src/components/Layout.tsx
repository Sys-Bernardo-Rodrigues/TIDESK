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
  Sun,
  Moon,
  Monitor,
  LayoutDashboard,
  Database,
  RefreshCw,
  Menu,
} from 'lucide-react';
import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { APP_VERSION_LABEL } from '../constants/appVersion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';

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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
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

  const toggleGroup = (key: string, forceOpen = false) => {
    setOpenGroups((prev) => ({ ...prev, [key]: forceOpen ? true : !prev[key] }));
  };

  const hasAnyAccess = (permission?: string, children?: NavChild[]) => {
    if (permission && hasPageAccess(permission)) return true;
    return children?.some((c) => c.permission && hasPageAccess(c.permission)) ?? false;
  };

  const getInitials = (name?: string) => {
    if (!name) return '?';
    return name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
  };

  const themeIcon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;
  const ThemeIcon = themeIcon;

  const renderNavLink = (path: string, label: string, Icon: LucideIcon, active: boolean, collapsed: boolean, onNavigate?: () => void) => {
    const link = (
      <Link
        key={path}
        to={path}
        onClick={onNavigate}
        className={cn(
          'group flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
          active && 'bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary',
          collapsed && 'justify-center px-0'
        )}
      >
        <Icon size={18} strokeWidth={active ? 2.5 : 2} className="shrink-0" />
        {!collapsed && <span className="truncate">{label}</span>}
      </Link>
    );

    if (!collapsed) return link;

    return (
      <Tooltip key={path} delayDuration={200}>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    );
  };

  const renderGroup = (item: NavItem, collapsed: boolean, onNavigate?: () => void) => {
    const groupKey = item.path.replace('/', '');
    const children = (item.children || []).filter((c) => c.permission && hasPageAccess(c.permission));
    if (!children.length) return null;

    const isActive = children.some((c) => pathActive(location.pathname, c.path));
    const isOpen = openGroups[groupKey];

    const trigger = (
      <button
        type="button"
        onClick={() => {
          if (collapsed) {
            setSidebarCollapsed(false);
            localStorage.setItem('sidebarCollapsed', 'false');
          }
          toggleGroup(groupKey, collapsed);
        }}
        className={cn(
          'flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
          isActive && 'text-primary',
          collapsed && 'justify-center px-0'
        )}
      >
        <item.icon size={18} strokeWidth={isActive ? 2.5 : 2} className="shrink-0" />
        {!collapsed && (
          <>
            <span className="flex-1 truncate text-left">{item.label}</span>
            {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </>
        )}
      </button>
    );

    return (
      <div key={item.path}>
        {collapsed ? (
          <Tooltip delayDuration={200}>
            <TooltipTrigger asChild>{trigger}</TooltipTrigger>
            <TooltipContent side="right">{item.label}</TooltipContent>
          </Tooltip>
        ) : (
          trigger
        )}
        {!collapsed && isOpen && (
          <div className="mt-0.5 ml-4 flex flex-col gap-0.5 border-l border-border pl-3">
            {children.map((child) => {
              const childActive = pathActive(location.pathname, child.path);
              return (
                <Link
                  key={child.path}
                  to={child.path}
                  onClick={onNavigate}
                  className={cn(
                    'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
                    childActive && 'bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary'
                  )}
                >
                  <child.icon size={14} strokeWidth={childActive ? 2.5 : 2} />
                  <span className="truncate">{child.label}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderNavContent = (collapsed: boolean, onNavigate?: () => void) => (
    <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-3 py-3">
      {MENU_STRUCTURE.map((section) => {
        const visibleItems = section.items.filter((item) => hasAnyAccess(item.permission, item.children));
        if (!visibleItems.length) return null;

        return (
          <div key={section.label} className="flex flex-col gap-0.5">
            {!collapsed && (
              <div className="px-2.5 pb-1 text-[11px] font-semibold tracking-wide text-muted-foreground/70 uppercase">
                {section.label}
              </div>
            )}
            {visibleItems.map((item) => {
              if (item.children) return renderGroup(item, collapsed, onNavigate);
              if (!item.permission || !hasPageAccess(item.permission)) return null;
              const active = pathActive(location.pathname, item.path);
              return renderNavLink(item.path, item.label, item.icon, active, collapsed, onNavigate);
            })}
          </div>
        );
      })}
    </nav>
  );

  const brand = (collapsed: boolean) => (
    <div className="flex items-center gap-2.5 overflow-hidden">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary">
        <LayoutDashboard size={16} className="text-primary-foreground" strokeWidth={2.5} />
      </div>
      {!collapsed && (
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-sm font-semibold text-foreground">TIDESK</span>
          <span className="truncate text-[11px] text-muted-foreground">{APP_VERSION_LABEL}</span>
        </div>
      )}
    </div>
  );

  const footer = (collapsed: boolean, onNavigate?: () => void) => (
    <div className="flex flex-col gap-2 border-t border-border p-3">
      <div className={cn('flex items-center gap-2.5', collapsed && 'justify-center')}>
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
          {getInitials(user?.name)}
        </div>
        {!collapsed && (
          <div className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-sm font-medium text-foreground">{user?.name}</span>
            <span className="truncate text-xs text-muted-foreground capitalize">{user?.role}</span>
          </div>
        )}
      </div>
      <div className={cn('flex gap-1.5', collapsed && 'flex-col items-center')}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size={collapsed ? 'icon-sm' : 'sm'} className={cn(!collapsed && 'flex-1 justify-start gap-2')}>
              <ThemeIcon size={15} />
              {!collapsed && <span>Tema</span>}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top">
            <DropdownMenuItem onClick={() => setTheme('light')}>
              <Sun size={14} /> Claro
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme('dark')}>
              <Moon size={14} /> Escuro
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme('system')}>
              <Monitor size={14} /> Sistema
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          variant="ghost"
          size={collapsed ? 'icon-sm' : 'sm'}
          className={cn(!collapsed && 'flex-1 justify-start gap-2', 'text-destructive hover:text-destructive')}
          onClick={() => {
            onNavigate?.();
            handleLogout();
          }}
        >
          <LogOut size={15} />
          {!collapsed && <span>Sair</span>}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden shrink-0 flex-col border-r border-border bg-card transition-[width] duration-200 md:flex',
          sidebarCollapsed ? 'w-16' : 'w-64'
        )}
      >
        <div className="flex items-center justify-between gap-2 border-b border-border p-3">
          {brand(sidebarCollapsed)}
          <Button variant="ghost" size="icon-sm" onClick={toggleSidebar} className="shrink-0">
            {sidebarCollapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
          </Button>
        </div>
        {renderNavContent(sidebarCollapsed)}
        {footer(sidebarCollapsed)}
      </aside>

      {/* Mobile drawer */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="flex w-72 flex-col p-0 sm:max-w-xs">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <div className="flex items-center gap-2.5 border-b border-border p-3">{brand(false)}</div>
          {renderNavContent(false, () => setMobileNavOpen(false))}
          {footer(false, () => setMobileNavOpen(false))}
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Mobile topbar */}
        <header className="flex items-center gap-3 border-b border-border p-3 md:hidden">
          <Button variant="ghost" size="icon-sm" onClick={() => setMobileNavOpen(true)}>
            <Menu size={18} />
          </Button>
          {brand(false)}
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
