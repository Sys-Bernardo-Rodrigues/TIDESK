import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Loader2, AlertCircle } from 'lucide-react';
import axios from 'axios';
import { APP_VERSION_LABEL } from '../constants/appVersion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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
        <Select value={theme} onValueChange={(v) => setTheme(v as 'light' | 'dark' | 'system')}>
          <SelectTrigger className="bg-card" title="Tema">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="light">Claro</SelectItem>
            <SelectItem value="dark">Escuro</SelectItem>
            <SelectItem value="system">Sistema</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Login card */}
      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-card p-8 shadow-xl ring-1 ring-foreground/5">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-extrabold tracking-tight text-primary">TIDESK</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sistema de Helpdesk Profissional{' '}
            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">
              {APP_VERSION_LABEL}
            </span>
          </p>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle size={18} strokeWidth={2} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <Label htmlFor="email" className="mb-1.5">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="seu@email.com"
              autoComplete="email"
            />
          </div>

          <div>
            <Label htmlFor="password" className="mb-1.5">
              Senha
            </Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          <Button type="submit" disabled={loading} className="mt-1 h-10">
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" strokeWidth={2.5} />
                Entrando...
              </>
            ) : (
              'Entrar'
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
