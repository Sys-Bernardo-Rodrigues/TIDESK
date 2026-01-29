/**
 * Utilitário para obter feriados brasileiros
 * Retorna o nome do feriado para uma data específica
 */

// Feriados fixos (mesmo dia todo ano)
const fixedHolidays: Array<{ month: number; day: number; name: string }> = [
  { month: 0, day: 1, name: 'Confraternização Universal' }, // 1 de Janeiro
  { month: 3, day: 21, name: 'Tiradentes' }, // 21 de Abril
  { month: 4, day: 1, name: 'Dia do Trabalhador' }, // 1 de Maio
  { month: 8, day: 7, name: 'Independência do Brasil' }, // 7 de Setembro
  { month: 9, day: 12, name: 'Nossa Senhora Aparecida' }, // 12 de Outubro
  { month: 10, day: 2, name: 'Finados' }, // 2 de Novembro
  { month: 10, day: 15, name: 'Proclamação da República' }, // 15 de Novembro
  { month: 11, day: 25, name: 'Natal' } // 25 de Dezembro
];

// Calcular Páscoa (algoritmo de Meeus/Jones/Butcher)
function calculateEaster(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

// Obter feriados móveis baseados na Páscoa
function getMovableHolidays(year: number): Array<{ date: Date; name: string }> {
  const easter = calculateEaster(year);
  const holidays: Array<{ date: Date; name: string }> = [];

  // Carnaval (47 dias antes da Páscoa)
  const carnival = new Date(easter);
  carnival.setDate(easter.getDate() - 47);
  holidays.push({ date: carnival, name: 'Carnaval' });

  // Sexta-feira Santa (2 dias antes da Páscoa)
  const goodFriday = new Date(easter);
  goodFriday.setDate(easter.getDate() - 2);
  holidays.push({ date: goodFriday, name: 'Sexta-feira Santa' });

  // Páscoa
  holidays.push({ date: new Date(easter), name: 'Páscoa' });

  // Corpus Christi (60 dias após a Páscoa)
  const corpusChristi = new Date(easter);
  corpusChristi.setDate(easter.getDate() + 60);
  holidays.push({ date: corpusChristi, name: 'Corpus Christi' });

  return holidays;
}

/**
 * Obter o nome do feriado para uma data específica
 * @param date Data para verificar
 * @returns Nome do feriado ou null se não houver feriado
 */
export function getHolidayName(date: Date): string | null {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();

  // Verificar feriados fixos
  for (const holiday of fixedHolidays) {
    if (holiday.month === month && holiday.day === day) {
      return holiday.name;
    }
  }

  // Verificar feriados móveis
  const movableHolidays = getMovableHolidays(year);
  for (const holiday of movableHolidays) {
    const holidayDate = new Date(holiday.date);
    if (
      holidayDate.getFullYear() === year &&
      holidayDate.getMonth() === month &&
      holidayDate.getDate() === day
    ) {
      return holiday.name;
    }
  }

  return null;
}

/**
 * Verificar se uma data é feriado
 */
export function isHoliday(date: Date): boolean {
  return getHolidayName(date) !== null;
}

/**
 * Obter todos os feriados de um ano
 */
export function getAllHolidays(year: number): Array<{ date: Date; name: string }> {
  const holidays: Array<{ date: Date; name: string }> = [];

  // Adicionar feriados fixos
  for (const holiday of fixedHolidays) {
    holidays.push({
      date: new Date(year, holiday.month, holiday.day),
      name: holiday.name
    });
  }

  // Adicionar feriados móveis
  const movableHolidays = getMovableHolidays(year);
  holidays.push(...movableHolidays);

  // Ordenar por data
  holidays.sort((a, b) => a.date.getTime() - b.date.getTime());

  return holidays;
}
