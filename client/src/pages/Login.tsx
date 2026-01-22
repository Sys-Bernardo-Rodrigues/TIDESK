import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      
      // Buscar páginas permitidas do usuário
      try {
        const response = await axios.get('/api/access-profiles/me/permissions');
        const allowedPages = response.data.pages || [];
        
        // Ordem de prioridade das páginas
        const pagePriority = [
          '/',
          '/tickets',
          '/create/forms',
          '/create/pages',
          '/config/perfil-de-acesso',
          '/config/usuarios',
          '/acompanhar/aprovar',
          '/acompanhar/acompanhar-tratativa',
          '/historico',
          '/relatorios',
          '/agenda/calendario-de-servico',
          '/agenda/calendario-de-plantoes'
        ];
        
        // Se admin, tem acesso a todas as páginas
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (user.role === 'admin') {
          navigate('/');
          return;
        }
        
        // Encontrar a primeira página permitida na ordem de prioridade
        const firstAllowedPage = pagePriority.find(page => allowedPages.includes(page));
        
        if (firstAllowedPage) {
          navigate(firstAllowedPage);
        } else if (allowedPages.length > 0) {
          // Se não encontrou na ordem de prioridade, usar a primeira disponível
          navigate(allowedPages[0]);
        } else {
          // Se não tem nenhuma página permitida, ir para dashboard (será bloqueado pelo ProtectedRoute)
          navigate('/');
        }
      } catch (permError) {
        console.error('Erro ao buscar páginas permitidas:', permError);
        // Em caso de erro, tentar ir para dashboard
        navigate('/');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-secondary) 100%)',
      padding: 'var(--spacing-lg)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <div style={{
        position: 'absolute',
        top: '-50%',
        right: '-50%',
        width: '800px',
        height: '800px',
        background: 'radial-gradient(circle, rgba(145, 71, 255, 0.1) 0%, transparent 70%)',
        borderRadius: '50%',
        pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute',
        bottom: '-50%',
        left: '-50%',
        width: '600px',
        height: '600px',
        background: 'radial-gradient(circle, rgba(59, 130, 246, 0.1) 0%, transparent 70%)',
        borderRadius: '50%',
        pointerEvents: 'none'
      }} />
      
      <div className="card glass fade-in" style={{ 
        width: '100%', 
        maxWidth: '440px',
        border: '1px solid var(--border-primary)',
        position: 'relative',
        zIndex: 1,
        boxShadow: 'var(--shadow-xl)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--spacing-2xl)' }}>
          <h1 style={{ 
            fontSize: '2.5rem', 
            fontWeight: '800', 
            marginBottom: 'var(--spacing-sm)', 
            background: 'linear-gradient(135deg, var(--purple) 0%, var(--blue) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            letterSpacing: '-0.03em'
          }}>
            TIDESK
          </h1>
          <p style={{ 
            color: 'var(--text-secondary)', 
            fontSize: '1rem',
            fontWeight: '400'
          }}>
            Sistema de Helpdesk Profissional
          </p>
        </div>

        {error && (
          <div style={{
            padding: 'var(--spacing-md)',
            backgroundColor: 'var(--red-light)',
            color: 'var(--red)',
            borderRadius: 'var(--radius-md)',
            marginBottom: 'var(--spacing-lg)',
            fontSize: '0.875rem',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-sm)'
          }}>
            <span style={{ fontSize: '1.125rem' }}>⚠️</span>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '0.5rem', 
              fontSize: '0.875rem', 
              fontWeight: '500',
              color: 'var(--text-secondary)'
            }}>
              Email
            </label>
            <input
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="seu@email.com"
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '0.5rem', 
              fontSize: '0.875rem', 
              fontWeight: '500',
              color: 'var(--text-secondary)'
            }}>
              Senha
            </label>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%' }}
            disabled={loading}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p style={{ 
          textAlign: 'center', 
          marginTop: '1.5rem', 
          fontSize: '0.875rem', 
          color: 'var(--text-secondary)' 
        }}>
          Não tem uma conta?{' '}
          <Link to="/register" style={{ 
            color: 'var(--purple)', 
            textDecoration: 'none',
            fontWeight: '600'
          }}>
            Cadastre-se
          </Link>
        </p>
      </div>
    </div>
  );
}
