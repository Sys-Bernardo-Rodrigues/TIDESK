import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

export const RESOURCES = {
  TICKETS: 'tickets',
  FORMS: 'forms',
  PAGES: 'pages',
  USERS: 'users',
  CATEGORIES: 'categories',
  REPORTS: 'reports',
  HISTORY: 'history',
  APPROVE: 'approve',
  TRACK: 'track',
  CONFIG: 'config',
  AGENDA: 'agenda',
  WEBHOOKS: 'webhooks',
  PROJECTS: 'projects'
} as const;

export const ACTIONS = {
  CREATE: 'create',
  VIEW: 'view',
  EDIT: 'edit',
  DELETE: 'delete',
  APPROVE: 'approve',
  REJECT: 'reject'
} as const;

export const usePermissions = () => {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [allowedPages, setAllowedPages] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchPermissions();
    } else {
      setPermissions(new Set());
      setAllowedPages(new Set());
      setLoading(false);
    }
  }, [user]);

  const fetchPermissions = async () => {
    try {
      const response = await axios.get('/api/access-profiles/me/permissions');
      const permissions = response.data.permissions as string[];
      const userPermissions = new Set<string>(permissions);
      setPermissions(userPermissions);

      // Apenas role === 'admin' tem acesso total; perfis usam exatamente o configurado
      const userIsAdmin = user?.role === 'admin';

      if (userIsAdmin) {
        const allPages = new Set<string>([
          '/', '/tickets', '/projetos', '/docs',
          '/create/forms', '/create/pages', '/create/webhooks',
          '/create/forms/builder', '/create/pages/builder',
          '/config/perfil-de-acesso', '/config/usuarios', '/config/backup',
          '/config/atualizar', '/config/grupos',
          '/acompanhar/aprovar', '/acompanhar/acompanhar-tratativa', '/historico',
          '/relatorios', '/agenda/calendario-de-servico', '/agenda/calendario-de-plantoes'
        ]);
        setAllowedPages(allPages);
      } else {
        const pages = new Set<string>(response.data.pages || []);
        if (userPermissions.has('pages:create')) pages.add('/create/pages/builder');
        if (userPermissions.has('forms:create')) pages.add('/create/forms/builder');
        setAllowedPages(pages);
      }
    } catch (error) {
      console.error('Erro ao buscar permissões:', error);
      const userIsAdmin = user?.role === 'admin';
      if (userIsAdmin) {
        const allPerms = new Set<string>();
        Object.values(RESOURCES).forEach(resource => {
          Object.values(ACTIONS).forEach(action => {
            allPerms.add(`${resource}:${action}`);
          });
        });
        setPermissions(allPerms);
        setAllowedPages(new Set([
          '/', '/tickets', '/projetos', '/docs',
          '/create/forms', '/create/pages', '/create/webhooks',
          '/create/forms/builder', '/create/pages/builder',
          '/config/perfil-de-acesso', '/config/usuarios', '/config/backup',
          '/config/atualizar', '/config/grupos',
          '/acompanhar/aprovar', '/acompanhar/acompanhar-tratativa', '/historico',
          '/relatorios', '/agenda/calendario-de-servico', '/agenda/calendario-de-plantoes'
        ]));
      } else {
        setPermissions(new Set());
        setAllowedPages(new Set());
      }
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = (): boolean => user?.role === 'admin';

  const hasPermission = (resource: string, action: string): boolean => {
    if (isAdmin()) return true;
    return permissions.has(`${resource}:${action}`);
  };

  const hasAnyPermission = (...perms: Array<{ resource: string; action: string }>): boolean => {
    if (isAdmin()) return true;
    return perms.some(({ resource, action }) => permissions.has(`${resource}:${action}`));
  };

  const hasPageAccess = (pagePath: string): boolean => {
    if (isAdmin()) return true;
    
    // Verificar se a página está na lista de páginas permitidas
    if (allowedPages.has(pagePath)) {
      return true;
    }
    
    // Permitir acesso a rotas de builder se o usuário tem permissão de criar
    if (pagePath === '/create/pages/builder' || pagePath.startsWith('/create/pages/builder/')) {
      return permissions.has('pages:create') || permissions.has('pages:edit');
    }
    if (pagePath === '/create/forms/builder' || pagePath.startsWith('/create/forms/builder/')) {
      return permissions.has('forms:create') || permissions.has('forms:edit');
    }
    
    // Permitir acesso a tickets (lista e detalhe) se o usuário tem permissão de visualizar
    if (pagePath === '/tickets' || (pagePath.startsWith('/tickets/') && pagePath !== '/tickets')) {
      return permissions.has('tickets:view') || permissions.has('approve:view') || permissions.has('track:view');
    }
    if (pagePath === '/projetos') return permissions.has('projects:view');
    if (pagePath === '/historico') return permissions.has('history:view');
    if (pagePath === '/relatorios') return permissions.has('reports:view');
    if (pagePath.startsWith('/agenda/')) return permissions.has('agenda:view');

    // Permitir acesso a rotas públicas (formulários e páginas públicas)
    if (pagePath.startsWith('/form/') || pagePath.startsWith('/page/')) {
      return true; // Rotas públicas sempre permitidas
    }
    
    return false;
  };

  const getAllowedPages = (): string[] => {
    return Array.from(allowedPages);
  };

  return {
    permissions,
    allowedPages,
    hasPermission,
    hasAnyPermission,
    hasPageAccess,
    getAllowedPages,
    loading
  };
};
