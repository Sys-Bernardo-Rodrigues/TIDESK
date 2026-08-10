import { dbGet, dbRun, getBrasiliaTimestamp } from '../database';
import { sendSlackNewTicketNotification } from './slack-service';

export function getBrasiliaDate(): { year: number; month: number; day: number } {
  const now = new Date();
  const brasiliaDateStr = now.toLocaleString('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  const [month, day, year] = brasiliaDateStr.split('/').map(Number);

  return { year, month, day };
}

export async function generateTicketNumber(): Promise<number> {
  const { year, month, day } = getBrasiliaDate();
  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const countResult = await dbGet(
    `SELECT COUNT(*) as count FROM tickets WHERE DATE(created_at) = ?`,
    [dateStr]
  );

  const count = (countResult as any)?.count || 0;
  return count + 1;
}

export interface CreateTicketInput {
  title: string;
  description: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  category_id?: number | null;
  user_id: number;
}

export async function createTicketRecord(input: CreateTicketInput): Promise<any> {
  const priority = input.priority || 'medium';
  const ticketNumber = await generateTicketNumber();

  const result = await dbRun(
    `INSERT INTO tickets (title, description, status, priority, category_id, user_id, ticket_number, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [input.title, input.description, 'open', priority, input.category_id || null, input.user_id, ticketNumber, getBrasiliaTimestamp(), getBrasiliaTimestamp()]
  );

  const ticketId = (result as any).lastID;
  const ticket = await dbGet(
    `SELECT t.*,
            u.name as user_name,
            u.email as user_email,
            c.name as category_name
     FROM tickets t
     LEFT JOIN users u ON t.user_id = u.id
     LEFT JOIN categories c ON t.category_id = c.id
     WHERE t.id = ?`,
    [ticketId]
  );

  const createdTicket = ticket as any;
  sendSlackNewTicketNotification({
    ticketId: createdTicket.id,
    ticketNumber: createdTicket.ticket_number,
    title: createdTicket.title,
    description: createdTicket.description,
    priority: createdTicket.priority,
    userName: createdTicket.user_name,
    categoryName: createdTicket.category_name
  }).catch(() => {});

  return ticket;
}
