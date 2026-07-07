import { describe, it, expect } from 'vitest';
import { formatBrasiliaDateTime, toNumber, round2 } from './report-period';

describe('formatBrasiliaDateTime', () => {
  it('formata para o fuso America/Sao_Paulo (UTC-3)', () => {
    const date = new Date('2026-01-15T12:00:00Z');
    expect(formatBrasiliaDateTime(date)).toBe('2026-01-15 09:00:00');
  });

  it('endOfDay força 23:59:59', () => {
    const date = new Date('2026-01-15T12:00:00Z');
    expect(formatBrasiliaDateTime(date, true)).toBe('2026-01-15 23:59:59');
  });
});

describe('toNumber', () => {
  it('converte valores numéricos válidos', () => {
    expect(toNumber('42')).toBe(42);
    expect(toNumber(3.5)).toBe(3.5);
  });

  it('retorna 0 para null/undefined/inválido', () => {
    expect(toNumber(null)).toBe(0);
    expect(toNumber(undefined)).toBe(0);
    expect(toNumber('abc')).toBe(0);
  });
});

describe('round2', () => {
  it('arredonda para 2 casas decimais', () => {
    expect(round2(2.345)).toBe(2.35);
    expect(round2(2.999)).toBe(3);
  });
});
