import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Loader2, AlertCircle } from 'lucide-react';
import axios from 'axios';

export default function Login() {
  const { theme, setTheme } = useTheme();
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

      try {
        const response = await axios.get('/api/access-profiles/me/permissions');
        const allowedPages = response.data.pages || [];

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
          '/agenda/calendario-de-plantoes',
        ];

        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (user.role === 'admin') {
          navigate('/');
          return;
        }

        const firstAllowedPage = pagePriority.find((page) =>
          allowedPages.includes(page)
        );

        if (firstAllowedPage) {
          navigate(firstAllowedPage);
        } else if (allowedPages.length > 0) {
          navigate(allowedPages[0]);
        } else {
          navigate('/');
        }
      } catch (permError) {
        console.error('Erro ao buscar páginas permitidas:', permError);
        navigate('/');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      {/* Background effects */}
      <div className="login-page__bg">
        <div className="login-page__gradient" />
        <div className="login-page__orb login-page__orb--1" aria-hidden />
        <div className="login-page__orb login-page__orb--2" aria-hidden />
        <div className="login-page__orb login-page__orb--3" aria-hidden />
        <div className="login-page__grid" aria-hidden />
        <div className="login-page__accent" aria-hidden />
      </div>

      {/* Theme selector */}
      <div className="login-theme">
        <select
          className="login-theme__select"
          value={theme}
          onChange={(e) =>
            setTheme(e.target.value as 'light' | 'dark' | 'system')
          }
          title="Tema"
        >
          <option value="light">Claro</option>
          <option value="dark">Escuro</option>
          <option value="system">Sistema</option>
        </select>
      </div>

      {/* Login card */}
      <div className="login-card">
        <div className="login-card__logo">
          <h1 className="login-card__title">TIDESK</h1>
          <p className="login-card__subtitle">
            Sistema de Helpdesk Profissional <span className="login-card__beta">BETA</span>
          </p>
        </div>

        {error && (
          <div className="login-card__error">
            <AlertCircle size={20} strokeWidth={2} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-card__form">
          <div className="login-card__field">
            <label htmlFor="email" className="login-card__label">
              Email
            </label>
            <input
              id="email"
              type="email"
              className="login-card__input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="seu@email.com"
              autoComplete="email"
            />
          </div>

          <div className="login-card__field">
            <label htmlFor="password" className="login-card__label">
              Senha
            </label>
            <input
              id="password"
              type="password"
              className="login-card__input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            className="login-card__submit"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 size={20} className="animate-spin" strokeWidth={2.5} />
                Entrando...
              </>
            ) : (
              'Entrar'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
