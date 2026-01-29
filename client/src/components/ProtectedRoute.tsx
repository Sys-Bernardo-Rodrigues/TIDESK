import { Navigate, useLocation } from 'react-router-dom';
import { usePermissions } from '../hooks/usePermissions';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  resource: string;
  action: string;
  fallback?: React.ReactNode;
  alternativePermissions?: Array<{ resource: string; action: string }>;
}

export default function ProtectedRoute({ 
  children, 
  resource, 
  action,
  fallback,
  alternativePermissions = []
}: ProtectedRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const { hasPermission, hasPageAccess, getAllowedPages, loading: permLoading } = usePermissions();
  const location = useLocation();

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

  // Verificar acesso à página
  const currentPath = location.pathname;
  if (!hasPageAccess(currentPath)) {
    // Redirecionar para a primeira página permitida
    const allowedPages = getAllowedPages();
    if (allowedPages.length > 0) {
      return <Navigate to={allowedPages[0]} replace />;
    }
    
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
        </div>
      </div>
    );
  }

  // Verificar permissão principal ou permissões alternativas
  const hasMainPermission = hasPermission(resource, action);
  const hasAlternativePermission = alternativePermissions.length > 0 && 
    alternativePermissions.some(alt => hasPermission(alt.resource, alt.action));
  
  if (!hasMainPermission && !hasAlternativePermission) {
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
            {alternativePermissions.length > 0 && (
              <>
                {' ou '}
                {alternativePermissions.map((alt, idx) => (
                  <span key={idx}>
                    {idx > 0 && ' ou '}
                    <strong>{alt.resource}:{alt.action}</strong>
                  </span>
                ))}
              </>
            )}
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
