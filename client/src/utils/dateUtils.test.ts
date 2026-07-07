import { describe, it, expect } from 'vitest';
import { formatDateBR, formatTicketTitle } from './dateUtils';

describe('formatDateBR', () => {
  it('formata string sem timezone (formato SQLite) sem converter fuso', () => {
    expect(formatDateBR('2026-01-15 09:30:00')).toBe('15/01/2026');
  });

  it('inclui hora e minuto quando includeTime', () => {
    expect(formatDateBR('2026-01-15 09:30:00', { includeTime: true })).toBe('15/01/2026, 09:30');
  });

  it('inclui segundos quando includeSeconds', () => {
    expect(
      formatDateBR('2026-01-15 09:30:05', { includeTime: true, includeSeconds: true })
    ).toBe('15/01/2026, 09:30:05');
  });

  it('retorna string vazia para entrada vazia', () => {
    expect(formatDateBR('')).toBe('');
  });

  it('converte string com timezone explícito (UTC) para o fuso de Brasília', () => {
    expect(formatDateBR('2026-01-15T12:00:00Z')).toBe('15/01/2026');
  });
});

describe('formatTicketTitle', () => {
  it('remove o prefixo "Submissão: "', () => {
    expect(formatTicketTitle('Submissão: Solicitação de acesso')).toBe('Solicitação de acesso');
  });

  it('mantém título sem o prefixo', () => {
    expect(formatTicketTitle('Problema no login')).toBe('Problema no login');
  });

  it('retorna string vazia para null/undefined', () => {
    expect(formatTicketTitle(null)).toBe('');
    expect(formatTicketTitle(undefined)).toBe('');
  });
});
