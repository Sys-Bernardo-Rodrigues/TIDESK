import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Tickets from './pages/Tickets';
import TicketDetail from './pages/TicketDetail';
import Pages from './pages/Pages';
import Forms from './pages/Forms';
import FormBuilder from './pages/FormBuilder';
import AccessProfile from './pages/AccessProfile';
import Users from './pages/Users';
import Backup from './pages/Backup';
import Atualizar from './pages/Atualizar';
import Grupos from './pages/Grupos';
import Aprovar from './pages/Aprovar';
import AcompanharTratativa from './pages/AcompanharTratativa';
import Reports from './pages/Reports';
import ServiceCalendar from './pages/ServiceCalendar';
import ShiftCalendar from './pages/ShiftCalendar';
import PublicForm from './pages/PublicForm';
import Historico from './pages/Historico';
import PageBuilder from './pages/PageBuilder';
import PublicPage from './pages/PublicPage';
import Webhooks from './pages/Webhooks';
import Projetos from './pages/Projetos';
import ProjetoDetail from './pages/ProjetoDetail';
import Docs from './pages/Docs';
import DocsRepo from './pages/DocsRepo';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import { RESOURCES, ACTIONS } from './hooks/usePermissions';

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loading">Carregando...</div>;
  }

  return user ? <>{children}</> : <Navigate to="/login" />;
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/form/:formId" element={<PublicForm />} />
          <Route path="/page/:slug" element={<PublicPage />} />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <Layout />
              </PrivateRoute>
            }
          >
            <Route index element={
              <ProtectedRoute resource={RESOURCES.TICKETS} action={ACTIONS.VIEW}>
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="tickets" element={
              <ProtectedRoute resource={RESOURCES.TICKETS} action={ACTIONS.VIEW}>
                <Tickets />
              </ProtectedRoute>
            } />
            <Route path="projetos" element={
              <ProtectedRoute resource={RESOURCES.PROJECTS} action={ACTIONS.VIEW}>
                <Projetos />
              </ProtectedRoute>
            } />
            <Route path="projetos/:id" element={
              <ProtectedRoute resource={RESOURCES.PROJECTS} action={ACTIONS.VIEW}>
                <ProjetoDetail />
              </ProtectedRoute>
            } />
            <Route 
              path="docs" 
              element={
                <ProtectedRoute resource={RESOURCES.PAGES} action={ACTIONS.VIEW}>
                  <Docs />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="docs/:repoId" 
              element={
                <ProtectedRoute resource={RESOURCES.PAGES} action={ACTIONS.VIEW}>
                  <DocsRepo />
                </ProtectedRoute>
              } 
            />
            <Route path="tickets/:id" element={
              <ProtectedRoute 
                resource={RESOURCES.TICKETS} 
                action={ACTIONS.VIEW}
                alternativePermissions={[
                  { resource: RESOURCES.APPROVE, action: ACTIONS.VIEW },
                  { resource: RESOURCES.TRACK, action: ACTIONS.VIEW }
                ]}
              >
                <TicketDetail />
              </ProtectedRoute>
            } />
            <Route 
              path="create/pages" 
              element={
                <ProtectedRoute resource={RESOURCES.PAGES} action={ACTIONS.VIEW}>
                  <Pages />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="create/pages/builder" 
              element={
                <ProtectedRoute resource={RESOURCES.PAGES} action={ACTIONS.CREATE}>
                  <PageBuilder />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="create/pages/builder/:id" 
              element={
                <ProtectedRoute resource={RESOURCES.PAGES} action={ACTIONS.EDIT}>
                  <PageBuilder />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="create/forms" 
              element={
                <ProtectedRoute resource={RESOURCES.FORMS} action={ACTIONS.VIEW}>
                  <Forms />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="create/forms/builder" 
              element={
                <ProtectedRoute resource={RESOURCES.FORMS} action={ACTIONS.CREATE}>
                  <FormBuilder />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="create/forms/builder/:id" 
              element={
                <ProtectedRoute resource={RESOURCES.FORMS} action={ACTIONS.EDIT}>
                  <FormBuilder />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="create/webhooks" 
              element={
                <ProtectedRoute resource={RESOURCES.WEBHOOKS} action={ACTIONS.VIEW}>
                  <Webhooks />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="config/perfil-de-acesso" 
              element={
                <ProtectedRoute resource={RESOURCES.CONFIG} action={ACTIONS.VIEW}>
                  <AccessProfile />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="config/usuarios" 
              element={
                <ProtectedRoute resource={RESOURCES.USERS} action={ACTIONS.VIEW}>
                  <Users />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="config/backup" 
              element={
                <ProtectedRoute resource={RESOURCES.CONFIG} action={ACTIONS.VIEW}>
                  <Backup />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="config/atualizar" 
              element={
                <ProtectedRoute resource={RESOURCES.CONFIG} action={ACTIONS.VIEW}>
                  <Atualizar />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="config/grupos" 
              element={
                <ProtectedRoute resource={RESOURCES.CONFIG} action={ACTIONS.VIEW}>
                  <Grupos />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="acompanhar/aprovar" 
              element={
                <ProtectedRoute resource={RESOURCES.APPROVE} action={ACTIONS.VIEW}>
                  <Aprovar />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="acompanhar/acompanhar-tratativa" 
              element={
                <ProtectedRoute resource={RESOURCES.TRACK} action={ACTIONS.VIEW}>
                  <AcompanharTratativa />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="historico" 
              element={
                <ProtectedRoute resource={RESOURCES.HISTORY} action={ACTIONS.VIEW}>
                  <Historico />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="relatorios" 
              element={
                <ProtectedRoute resource={RESOURCES.REPORTS} action={ACTIONS.VIEW}>
                  <Reports />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="agenda/calendario-de-servico" 
              element={
                <ProtectedRoute resource={RESOURCES.AGENDA} action={ACTIONS.VIEW}>
                  <ServiceCalendar />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="agenda/calendario-de-plantoes" 
              element={
                <ProtectedRoute resource={RESOURCES.AGENDA} action={ACTIONS.VIEW}>
                  <ShiftCalendar />
                </ProtectedRoute>
              } 
            />
          </Route>
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
