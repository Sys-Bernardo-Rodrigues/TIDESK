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
  AGENDA: 'agenda'
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchPermissions();
    } else {
      setPermissions(new Set());
      setLoading(false);
    }
  }, [user]);

  const fetchPermissions = async () => {
    try {
      const response = await axios.get('/api/access-profiles/me/permissions');
      setPermissions(new Set(response.data.permissions));
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

  return {
    permissions,
    hasPermission,
    hasAnyPermission,
    loading
  };
};
