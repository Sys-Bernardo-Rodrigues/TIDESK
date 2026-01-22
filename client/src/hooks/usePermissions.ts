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
      setPermissions(new Set(response.data.permissions));
      // Se admin, dar acesso a todas as páginas
      if (user?.role === 'admin') {
        const allPages = new Set<string>([
          '/', '/tickets', '/create/forms', '/create/pages', '/create/webhooks', '/config/perfil-de-acesso',
          '/config/usuarios', '/config/backup', '/config/atualizar', '/config/grupos',
          '/acompanhar/aprovar', '/acompanhar/acompanhar-tratativa', '/historico',
          '/relatorios', '/agenda/calendario-de-servico', '/agenda/calendario-de-plantoes'
        ]);
        setAllowedPages(allPages);
      } else {
        setAllowedPages(new Set(response.data.pages || []));
      }
    } catch (error) {
      console.error('Erro ao buscar permissões:', error);
      // Se admin, dar todas as permissões
      if (user?.role === 'admin') {
        const allPerms = new Set<string>();
        Object.values(RESOURCES).forEach(resource => {
          Object.values(ACTIONS).forEach(action => {
            allPerms.add(`${resource}:${action}`);
          });
        });
        setPermissions(allPerms);
        const allPages = new Set<string>([
          '/', '/tickets', '/create/forms', '/create/pages', '/create/webhooks', '/config/perfil-de-acesso',
          '/config/usuarios', '/config/backup', '/config/atualizar', '/config/grupos',
          '/acompanhar/aprovar', '/acompanhar/acompanhar-tratativa', '/historico',
          '/relatorios', '/agenda/calendario-de-servico', '/agenda/calendario-de-plantoes'
        ]);
        setAllowedPages(allPages);
      }
    } finally {
      setLoading(false);
    }
  };

  const hasPermission = (resource: string, action: string): boolean => {
    if (user?.role === 'admin') {
      return true; // Admin tem todas as permissões
    }
    return permissions.has(`${resource}:${action}`);
  };

  const hasAnyPermission = (...perms: Array<{ resource: string; action: string }>): boolean => {
    if (user?.role === 'admin') {
      return true;
    }
    return perms.some(({ resource, action }) => permissions.has(`${resource}:${action}`));
  };

  const hasPageAccess = (pagePath: string): boolean => {
    if (user?.role === 'admin') {
      return true; // Admin tem acesso a todas as páginas
    }
    return allowedPages.has(pagePath);
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
