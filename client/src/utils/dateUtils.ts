// Utilitários para formatação de datas com timezone de Brasília (America/Sao_Paulo)

/**
 * Formata uma data para o formato brasileiro com timezone de Brasília
 * O banco salva em horário local (Brasília) quando TZ está configurado
 */
export function formatDateBR(dateString: string, options?: {
  includeTime?: boolean;
  includeSeconds?: boolean;
}): string {
  if (!dateString) return '';
  
  // Verificar se a string tem timezone explícito
  const hasTimezone = dateString.includes('Z') || 
                      dateString.includes('+') || 
                      (dateString.includes('T') && dateString.match(/[+-]\d{2}:\d{2}$/));
  
  if (hasTimezone) {
    // Tem timezone explícito - tratar como UTC e converter para Brasília
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    
    const formatOptions: Intl.DateTimeFormatOptions = {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    };

    if (options?.includeTime) {
      formatOptions.hour = '2-digit';
      formatOptions.minute = '2-digit';
      formatOptions.hour12 = false;
      if (options?.includeSeconds) {
        formatOptions.second = '2-digit';
      }
    }

    return date.toLocaleString('pt-BR', formatOptions);
  } else {
    // Formato SQLite sem timezone (YYYY-MM-DD HH:mm:ss)
    // Como o servidor está com TZ='America/Sao_Paulo', 
    // o banco salva em horário local (Brasília)
    // Extrair componentes e formatar diretamente
    const normalized = dateString.replace(' ', 'T');
    const [datePart, timePart = ''] = normalized.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hour = 0, minute = 0, second = 0] = timePart.split(':').map(Number);
    
    // Formatar diretamente sem conversão de timezone
    const dayStr = String(day).padStart(2, '0');
    const monthStr = String(month).padStart(2, '0');
    let formatted = `${dayStr}/${monthStr}/${year}`;
    
    if (options?.includeTime) {
      const hourStr = String(hour).padStart(2, '0');
      const minuteStr = String(minute).padStart(2, '0');
      formatted += `, ${hourStr}:${minuteStr}`;
      
      if (options?.includeSeconds) {
        const secondStr = String(second).padStart(2, '0');
        formatted += `:${secondStr}`;
      }
    }
    
    return formatted;
  }
}

/**
 * Formata uma data para exibição em chat (formato curto)
 */
export function formatDateChat(dateString: string): string {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  
  const now = new Date();
  
  // Calcular diferença usando timestamps UTC (mais confiável)
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Agora';
  if (diffMins < 60) return `${diffMins} min atrás`;
  if (diffHours < 24) return `${diffHours}h atrás`;
  if (diffDays === 1) return 'Ontem';
  if (diffDays < 7) return `${diffDays} dias atrás`;
  
  return formatDateBR(dateString, { includeTime: true });
}

/**
 * Formata uma data para exibição em lista (formato curto)
 */
export function formatDateList(dateString: string): string {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Hoje';
  if (diffDays === 1) return 'Ontem';
  if (diffDays < 7) return `${diffDays} dias atrás`;
  
  return formatDateBR(dateString);
}

/**
 * Remove o prefixo "Submissão: " do título do ticket (exibição)
 */
export function formatTicketTitle(title: string | null | undefined): string {
  if (!title) return '';
  return title.replace(/^Submissão:\s*/i, '').trim() || title;
}
