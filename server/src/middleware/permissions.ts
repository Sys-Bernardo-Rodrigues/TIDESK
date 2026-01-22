import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { dbGet, dbAll } from '../database';

// Recursos e ações do sistema
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

// Cache de permissões do usuário (pode ser melhorado com Redis)
const permissionCache = new Map<number, Set<string>>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos
const cacheTimestamps = new Map<number, number>();

// Limpar cache expirado
setInterval(() => {
  const now = Date.now();
  for (const [userId, timestamp] of cacheTimestamps.entries()) {
    if (now - timestamp > CACHE_TTL) {
      permissionCache.delete(userId);
      cacheTimestamps.delete(userId);
    }
  }
}, 60000); // Verificar a cada minuto

// Buscar permissões do usuário
export const getUserPermissions = async (userId: number): Promise<Set<string>> => {
  // Verificar cache
  const cached = permissionCache.get(userId);
  const timestamp = cacheTimestamps.get(userId);
  if (cached && timestamp && Date.now() - timestamp < CACHE_TTL) {
    return cached;
  }

  // Buscar permissões do banco
  const permissions = new Set<string>();

  // Buscar perfil do usuário
  const userProfiles = await dbAll(`
    SELECT ap.id, ap.name
    FROM user_access_profiles uap
    JOIN access_profiles ap ON uap.access_profile_id = ap.id
    WHERE uap.user_id = ?
  `, [userId]);

  // Se usuário tem perfis, buscar permissões
  if (userProfiles.length > 0) {
    const profileIds = userProfiles.map((p: any) => p.id);
    const placeholders = profileIds.map(() => '?').join(',');

    const perms = await dbAll(`
      SELECT resource, action
      FROM permissions
      WHERE access_profile_id IN (${placeholders})
    `, profileIds);

    perms.forEach((perm: any) => {
      permissions.add(`${perm.resource}:${perm.action}`);
    });
  }

  // Admin sempre tem todas as permissões
  const user = await dbGet('SELECT role FROM users WHERE id = ?', [userId]) as any;
  if (user && user.role === 'admin') {
    // Adicionar todas as permissões para admin
    Object.values(RESOURCES).forEach(resource => {
      Object.values(ACTIONS).forEach(action => {
        permissions.add(`${resource}:${action}`);
      });
    });
  }

  // Atualizar cache
  permissionCache.set(userId, permissions);
  cacheTimestamps.set(userId, Date.now());

  return permissions;
};

// Middleware para verificar permissão (deve ser usado após authenticate)
export const requirePermission = (resource: string, action: string) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      // Verificar se usuário está autenticado (deve vir do middleware authenticate)
      if (!req.userId) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      const permissions = await getUserPermissions(req.userId);
      const permissionKey = `${resource}:${action}`;

      // Admin sempre tem acesso
      const user = await dbGet('SELECT role FROM users WHERE id = ?', [req.userId]) as any;
      if (user && user.role === 'admin') {
        return next();
      }

      if (!permissions.has(permissionKey)) {
        console.log(`[Permissão negada] Usuário ${req.userId} (${user?.role}) não tem permissão ${permissionKey}`);
        console.log(`[Permissões do usuário]`, Array.from(permissions));
        return res.status(403).json({ 
          error: 'Acesso negado. Você não tem permissão para realizar esta ação.',
          required: permissionKey
        });
      }

      next();
    } catch (error) {
      console.error('Erro ao verificar permissão:', error);
      res.status(500).json({ error: 'Erro ao verificar permissões' });
    }
  };
};

// Função auxiliar para verificar múltiplas permissões (OR)
export const requireAnyPermission = (...permissions: Array<{ resource: string; action: string }>) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      const userPermissions = await getUserPermissions(req.userId);

      // Admin sempre tem acesso
      const user = await dbGet('SELECT role FROM users WHERE id = ?', [req.userId]) as any;
      if (user && user.role === 'admin') {
        return next();
      }

      const hasPermission = permissions.some(({ resource, action }) => {
        return userPermissions.has(`${resource}:${action}`);
      });

      if (!hasPermission) {
        return res.status(403).json({ 
          error: 'Acesso negado. Você não tem permissão para realizar esta ação.'
        });
      }

      next();
    } catch (error) {
      console.error('Erro ao verificar permissão:', error);
      res.status(500).json({ error: 'Erro ao verificar permissões' });
    }
  };
};

// Invalidar cache de permissões de um usuário
export const invalidateUserPermissions = (userId: number) => {
  permissionCache.delete(userId);
  cacheTimestamps.delete(userId);
};

// Invalidar cache de todos os usuários (útil quando permissões são alteradas)
export const invalidateAllPermissions = () => {
  permissionCache.clear();
  cacheTimestamps.clear();
};
