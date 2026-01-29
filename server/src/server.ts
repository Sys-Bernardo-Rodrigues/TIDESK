import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDatabase } from './database';
import authRoutes from './routes/auth';
import ticketRoutes from './routes/tickets';
import userRoutes from './routes/users';
import categoryRoutes from './routes/categories';
import formRoutes from './routes/forms';
import pageRoutes from './routes/pages';
import accessProfileRoutes from './routes/access-profiles';
import groupRoutes from './routes/groups';
import ticketMessageRoutes from './routes/ticket-messages';
import reportRoutes from './routes/reports';
import calendarRoutes from './routes/calendar';
import shiftRoutes from './routes/shifts';
import backupRoutes from './routes/backup';
import updateRoutes from './routes/updates';
import dashboardRoutes from './routes/dashboard';
import webhookRoutes from './routes/webhooks';
import { startBackupScheduler } from './services/backup-scheduler';

dotenv.config();

// Definir NODE_ENV como production se não estiver definido e não estiver em modo dev
if (!process.env.NODE_ENV && !process.argv.includes('watch')) {
  process.env.NODE_ENV = 'production';
}

// Configurar timezone para Brasília
process.env.TZ = 'America/Sao_Paulo';

const app = express();
const PORT = Number(process.env.PORT) || 5000;

// Configurar trust proxy para obter IP real do cliente quando atrás de proxy/load balancer
// Isso permite que o Express confie nos headers X-Forwarded-* de proxies reversos
app.set('trust proxy', true);

// Middleware para garantir que não há redirecionamento HTTPS forçado
// Isso é importante para permitir acesso via HTTP em dispositivos móveis
app.use((req, res, next) => {
  // Remover headers que podem forçar HTTPS
  res.removeHeader('Strict-Transport-Security');
  
  // Garantir que o protocolo detectado seja HTTP quando não há proxy HTTPS configurado
  // Se não houver certificado SSL configurado, manter HTTP
  const protocol = req.protocol || 'http';
  const isSecure = req.secure || (req.headers['x-forwarded-proto'] === 'https');
  
  // Não redirecionar para HTTPS se não estiver configurado
  // Permitir acesso via HTTP explicitamente
  next();
});

// Middleware CORS - Permitir acesso de qualquer origem
app.use(cors({
  origin: '*', // Permitir todas as origens
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-webhook-secret', 'x-secret-key'],
  credentials: false
}));

// Middleware condicional: aplicar raw body parsing apenas para rotas de recebimento de webhook
// Isso deve vir ANTES dos middlewares de parsing globais
const rawBodyMiddleware = express.raw({ type: '*/*', limit: '50mb' });
app.use((req, res, next) => {
  // Se for uma rota de recebimento ou teste de webhook, usar raw body parsing
  if (req.path.startsWith('/api/webhooks/receive/') || req.path.startsWith('/api/webhooks/test/')) {
    return rawBodyMiddleware(req, res, next);
  }
  // Caso contrário, passar para os middlewares normais
  next();
});

// Middleware para aceitar requisições de qualquer IP
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Servir arquivos estáticos (uploads)
import path from 'path';
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Rotas
app.use('/api/auth', authRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/forms', formRoutes);
app.use('/api/pages', pageRoutes);
app.use('/api/access-profiles', accessProfileRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/ticket-messages', ticketMessageRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/shifts', shiftRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/updates', updateRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Registrar rotas de webhook (incluindo recebimento que já tem raw body parsing)
app.use('/api/webhooks', webhookRoutes);

// Rota de health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'TIDESK API está funcionando' });
});

// O cliente é servido separadamente pelo Vite preview na porta 3333
// Não precisamos servir arquivos estáticos aqui

// Função para atualizar tickets finalizados periodicamente
async function startClosedTicketsUpdater() {
  const updateInterval = 60 * 60 * 1000; // 1 hora
  
  const updateTickets = async () => {
    try {
      const ticketRoutes = await import('./routes/tickets');
      if (ticketRoutes.updateClosedTicketsToResolved) {
        await ticketRoutes.updateClosedTicketsToResolved();
      }
    } catch (error) {
      console.error('Erro no job de atualização de tickets:', error);
    }
  };
  
  // Executar imediatamente ao iniciar
  await updateTickets();
  
  // Executar a cada hora
  setInterval(updateTickets, updateInterval);
  
  console.log('✅ Job de atualização de tickets finalizados iniciado (executa a cada 1 hora)');
}

// Inicializar banco de dados e servidor
initDatabase().then(async () => {
  // Escutar em todas as interfaces de rede (0.0.0.0) para aceitar conexões externas
  const HOST = process.env.HOST || '0.0.0.0';
  const port = typeof PORT === 'string' ? parseInt(PORT, 10) : PORT;
  
  app.listen(port, HOST, () => {
    console.log(`🚀 Servidor TIDESK rodando em http://${HOST}:${port}`);
    console.log(`🌐 Acessível de qualquer IP na rede`);
    if (HOST === '0.0.0.0') {
      console.log(`📡 Para acessar externamente, use o IP desta máquina na porta ${port}`);
    }
  });
  
  // Iniciar job de atualização de tickets finalizados
  await startClosedTicketsUpdater();
  
  // Iniciar agendador de backup automático
  startBackupScheduler();
}).catch((error) => {
  console.error('Erro ao inicializar banco de dados:', error);
  process.exit(1);
});
