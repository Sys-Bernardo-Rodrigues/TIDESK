import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { dbGet, dbAll } from '../database';

export interface AuthRequest extends Request {
  userId?: number;
  userRole?: string;
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Token de autenticação não fornecido' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'tidesk-secret-key') as {
      userId: number;
      userRole: string;
    };

    req.userId = decoded.userId;
    req.userRole = decoded.userRole;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido' });
  }
};

// Verificar se usuário tem perfil de administrador
const hasAdminProfile = async (userId: number): Promise<boolean> => {
  try {
    const adminProfiles = await dbAll(`
      SELECT ap.id
      FROM user_access_profiles uap
      JOIN access_profiles ap ON uap.access_profile_id = ap.id
      WHERE uap.user_id = ? AND ap.name = 'Administrador'
    `, [userId]);
    return adminProfiles.length > 0;
  } catch (error) {
    console.error('Erro ao verificar perfil de administrador:', error);
    return false;
  }
};

export const requireAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  // Verificar role direto
  if (req.userRole === 'admin') {
    return next();
  }

  // Verificar se tem perfil de administrador
  if (req.userId) {
    const hasAdmin = await hasAdminProfile(req.userId);
    if (hasAdmin) {
      return next();
    }
  }

  return res.status(403).json({ error: 'Acesso negado. Apenas administradores.' });
};

export const requireAgent = async (req: AuthRequest, res: Response, next: NextFunction) => {
  // Verificar role direto
  if (req.userRole === 'admin' || req.userRole === 'agent') {
    return next();
  }

  // Verificar se tem perfil de administrador ou agente
  if (req.userId) {
    try {
      const profiles = await dbAll(`
        SELECT ap.name
        FROM user_access_profiles uap
        JOIN access_profiles ap ON uap.access_profile_id = ap.id
        WHERE uap.user_id = ? AND ap.name IN ('Administrador', 'Agente')
      `, [req.userId]);
      
      if (profiles.length > 0) {
        return next();
      }
    } catch (error) {
      console.error('Erro ao verificar perfis:', error);
    }
  }

  return res.status(403).json({ error: 'Acesso negado. Apenas agentes e administradores.' });
};
