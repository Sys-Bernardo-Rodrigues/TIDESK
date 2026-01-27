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
  WEBHOOKS: 'webhooks'
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
      const userPermissions = new Set<string>(response.data.permissions);
      setPermissions(userPermissions);
      
      // Verificar se é admin (role ou tem todas as permissões)
      const userIsAdmin = user?.role === 'admin' || (() => {
        const requiredPerms = [
          'tickets:create', 'tickets:view', 'tickets:edit', 'tickets:delete',
          'forms:create', 'forms:view', 'forms:edit', 'forms:delete',
          'pages:create', 'pages:view', 'pages:edit', 'pages:delete',
          'users:view', 'users:edit', 'config:view'
        ];
        return requiredPerms.every(perm => userPermissions.has(perm));
      })();
      
      // Se admin, dar acesso a todas as páginas
      if (userIsAdmin) {
        const allPages = new Set<string>([
          '/', '/tickets', '/create/forms', '/create/pages', '/create/webhooks', 
          '/create/forms/builder', '/create/pages/builder', // Rotas de criação
          '/config/perfil-de-acesso', '/config/usuarios', '/config/backup', 
          '/config/atualizar', '/config/grupos',
          '/acompanhar/aprovar', '/acompanhar/acompanhar-tratativa', '/historico',
          '/relatorios', '/agenda/calendario-de-servico', '/agenda/calendario-de-plantoes'
        ]);
        setAllowedPages(allPages);
      } else {
        const pages = new Set<string>(response.data.pages || []);
        // Adicionar rotas de builder se o usuário tem permissão de criar
        if (userPermissions.has('pages:create')) {
          pages.add('/create/pages/builder');
        }
        if (userPermissions.has('forms:create')) {
          pages.add('/create/forms/builder');
        }
        setAllowedPages(pages);
      }
    } catch (error) {
      console.error('Erro ao buscar permissões:', error);
      // Verificar se é admin (role ou tem todas as permissões)
      const userIsAdmin = user?.role === 'admin';
      
      // Se admin, dar todas as permissões
      if (userIsAdmin) {
        const allPerms = new Set<string>();
        Object.values(RESOURCES).forEach(resource => {
          Object.values(ACTIONS).forEach(action => {
            allPerms.add(`${resource}:${action}`);
          });
        });
        setPermissions(allPerms);
        const allPages = new Set<string>([
          '/', '/tickets', '/create/forms', '/create/pages', '/create/webhooks',
          '/create/forms/builder', '/create/pages/builder', // Rotas de criação
          '/config/perfil-de-acesso', '/config/usuarios', '/config/backup',
          '/config/atualizar', '/config/grupos',
          '/acompanhar/aprovar', '/acompanhar/acompanhar-tratativa', '/historico',
          '/relatorios', '/agenda/calendario-de-servico', '/agenda/calendario-de-plantoes'
        ]);
        setAllowedPages(allPages);
      }
    } finally {
      setLoading(false);
    }
  };

  // Verificar se usuário tem todas as permissões (indica admin)
  const isAdmin = (): boolean => {
    if (user?.role === 'admin') {
      return true;
    }
    // Se tem todas as permissões principais, considerar como admin
    const requiredPerms = [
      'tickets:create', 'tickets:view', 'tickets:edit', 'tickets:delete',
      'forms:create', 'forms:view', 'forms:edit', 'forms:delete',
      'pages:create', 'pages:view', 'pages:edit', 'pages:delete',
      'users:view', 'users:edit', 'config:view'
    ];
    return requiredPerms.every(perm => permissions.has(perm));
  };

  const hasPermission = (resource: string, action: string): boolean => {
    if (isAdmin()) {
      return true; // Admin tem todas as permissões
    }
    return permissions.has(`${resource}:${action}`);
  };

  const hasAnyPermission = (...perms: Array<{ resource: string; action: string }>): boolean => {
    if (isAdmin()) {
      return true;
    }
    return perms.some(({ resource, action }) => permissions.has(`${resource}:${action}`));
  };

  const hasPageAccess = (pagePath: string): boolean => {
    if (isAdmin()) {
      return true; // Admin tem acesso a todas as páginas
    }
    
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
    
    // Permitir acesso a rotas dinâmicas de tickets se o usuário tem permissão de visualizar tickets
    if (pagePath.startsWith('/tickets/') && pagePath !== '/tickets') {
      return permissions.has('tickets:view') || permissions.has('approve:view') || permissions.has('track:view');
    }
    
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
