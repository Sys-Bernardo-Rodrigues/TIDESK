import { Navigate } from 'react-router-dom';
import { usePermissions, RESOURCES, ACTIONS } from '../hooks/usePermissions';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  resource: string;
  action: string;
  fallback?: React.ReactNode;
}

export default function ProtectedRoute({ 
  children, 
  resource, 
  action,
  fallback 
}: ProtectedRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const { hasPermission, loading: permLoading } = usePermissions();

  if (authLoading || permLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-primary)'
      }}>
        <div className="loading">Verificando permissões...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (!hasPermission(resource, action)) {
    if (fallback) {
      return <>{fallback}</>;
    }
    
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-primary)',
        padding: 'var(--spacing-2xl)'
      }}>
        <div className="card" style={{
          maxWidth: '600px',
          textAlign: 'center',
          padding: 'var(--spacing-2xl)',
          border: '1px solid var(--border-primary)'
        }}>
          <h1 style={{
            fontSize: '2rem',
            fontWeight: '700',
            color: 'var(--red)',
            marginBottom: 'var(--spacing-md)'
          }}>
            Acesso Negado
          </h1>
          <p style={{
            color: 'var(--text-secondary)',
            fontSize: '1rem',
            marginBottom: 'var(--spacing-lg)'
          }}>
            Você não tem permissão para acessar esta página.
          </p>
          <p style={{
            color: 'var(--text-tertiary)',
            fontSize: '0.875rem'
          }}>
            Permissão necessária: <strong>{resource}:{action}</strong>
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
