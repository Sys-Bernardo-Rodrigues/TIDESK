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
import { startBackupScheduler } from './services/backup-scheduler';

dotenv.config();

// Configurar timezone para Brasília
process.env.TZ = 'America/Sao_Paulo';

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// Rota de health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'TIDESK API está funcionando' });
});

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
  app.listen(PORT, () => {
    console.log(`🚀 Servidor TIDESK rodando na porta ${PORT}`);
  });
  
  // Iniciar job de atualização de tickets finalizados
  await startClosedTicketsUpdater();
  
  // Iniciar agendador de backup automático
  startBackupScheduler();
}).catch((error) => {
  console.error('Erro ao inicializar banco de dados:', error);
  process.exit(1);
});
