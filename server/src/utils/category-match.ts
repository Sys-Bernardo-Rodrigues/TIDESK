export interface CategoryCandidate {
  id: number;
  name: string;
}

export interface CategoryMatch extends CategoryCandidate {
  score: number;
}

const MATCH_THRESHOLD = 0.55;
const SUBSTRING_BOOST = 0.2;
const DIACRITICS_REGEX = new RegExp('[\\u0300-\\u036f]', 'g');

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(DIACRITICS_REGEX, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

function levenshteinDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix: number[][] = Array.from({ length: rows }, () => new Array(cols).fill(0));

  for (let i = 0; i < rows; i++) matrix[i][0] = i;
  for (let j = 0; j < cols; j++) matrix[0][j] = j;

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[rows - 1][cols - 1];
}

function similarityScore(a: string, b: string): number {
  if (!a.length && !b.length) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;

  const distance = levenshteinDistance(a, b);
  let score = 1 - distance / maxLen;

  if (a.includes(b) || b.includes(a)) {
    score = Math.min(1, score + SUBSTRING_BOOST);
  }

  return score;
}

export function findBestCategoryMatch(
  suggestedName: string | null | undefined,
  categories: CategoryCandidate[]
): CategoryMatch | null {
  if (!suggestedName || !suggestedName.trim() || categories.length === 0) {
    return null;
  }

  const normalizedSuggestion = normalize(suggestedName);
  let best: CategoryMatch | null = null;

  for (const category of categories) {
    const score = similarityScore(normalizedSuggestion, normalize(category.name));
    if (!best || score > best.score) {
      best = { id: category.id, name: category.name, score };
    }
  }

  if (!best || best.score < MATCH_THRESHOLD) {
    return null;
  }

  return best;
}
