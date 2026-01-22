// Utilitários para formatação de datas com timezone de Brasília (America/Sao_Paulo)

/**
 * Formata uma data para o formato brasileiro com timezone de Brasília
 */
export function formatDateBR(dateString: string, options?: {
  includeTime?: boolean;
  includeSeconds?: boolean;
}): string {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  
  // Criar um objeto de formatação que força o uso do timezone de Brasília
  const formatOptions: Intl.DateTimeFormatOptions = {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  };

  if (options?.includeTime) {
    formatOptions.hour = '2-digit';
    formatOptions.minute = '2-digit';
    formatOptions.hour12 = false; // Usar formato 24 horas
    if (options?.includeSeconds) {
      formatOptions.second = '2-digit';
    }
  }

  // Usar toLocaleString com locale pt-BR e timezone de Brasília
  // Isso garante que a data seja convertida corretamente para o timezone de Brasília
  const formatted = date.toLocaleString('pt-BR', formatOptions);
  
  return formatted;
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
