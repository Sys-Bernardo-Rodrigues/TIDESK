import { useEffect, useMemo, useRef, useCallback } from 'react';

export function splitSearchTerms(query: string): string[] {
  return query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length >= 2);
}

export function countTermMatches(text: string, term: string): number {
  if (!text || !term.trim()) return 0;
  const lower = text.toLowerCase();
  const t = term.toLowerCase();
  let count = 0;
  let pos = 0;
  while (true) {
    const i = lower.indexOf(t, pos);
    if (i < 0) break;
    count++;
    pos = i + t.length;
  }
  return count;
}

export function countAllMatches(text: string, query: string): number {
  const terms = [query.trim(), ...splitSearchTerms(query)].filter(Boolean);
  const seen = new Set<string>();
  let total = 0;
  for (const t of terms) {
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    total += countTermMatches(text, t);
  }
  return total;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function buildHighlightPattern(query: string): RegExp | null {
  const terms = [query.trim(), ...splitSearchTerms(query)].filter((t) => t.length >= 1);
  const unique = [...new Set(terms.map((t) => t.toLowerCase()))];
  if (!unique.length) return null;
  return new RegExp(`(${unique.map(escapeRegex).join('|')})`, 'gi');
}

export type TextPart = { text: string; highlight: boolean };

export function splitForHighlight(text: string, query: string): TextPart[] {
  const re = buildHighlightPattern(query);
  if (!re || !text) return [{ text, highlight: false }];
  const parts: TextPart[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  const regex = new RegExp(re.source, re.flags);
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index), highlight: false });
    parts.push({ text: m[0], highlight: true });
    last = m.index + m[0].length;
    if (m[0].length === 0) break;
  }
  if (last < text.length) parts.push({ text: text.slice(last), highlight: false });
  return parts.length ? parts : [{ text, highlight: false }];
}

export function HighlightedText({
  text,
  query,
  className,
  as: Tag = 'span',
}: {
  text: string;
  query: string;
  className?: string;
  as?: 'span' | 'pre' | 'p';
}) {
  const ref = useRef<HTMLElement>(null);
  const parts = useMemo(() => splitForHighlight(text, query), [text, query]);

  useEffect(() => {
    const el = ref.current?.querySelector('mark.docs-search-highlight');
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [text, query]);

  return (
    <Tag ref={ref as never} className={className}>
      {parts.map((p, i) =>
        p.highlight ? (
          <mark key={i} className="docs-search-highlight">
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        )
      )}
    </Tag>
  );
}

/** Destaca termos dentro de um container HTML já renderizado */
export function highlightTextInElement(root: HTMLElement, query: string): HTMLSpanElement[] {
  const re = buildHighlightPattern(query);
  if (!re) return [];

  const marks: HTMLSpanElement[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (node.parentElement?.closest('mark.docs-search-highlight')) continue;
    textNodes.push(node as Text);
  }

  for (const textNode of textNodes) {
    const value = textNode.nodeValue || '';
    const regex = new RegExp(re.source, re.flags);
    const fragments: (string | HTMLElement)[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    let changed = false;
    while ((m = regex.exec(value)) !== null) {
      changed = true;
      if (m.index > last) fragments.push(value.slice(last, m.index));
      const mark = document.createElement('mark');
      mark.className = 'docs-search-highlight';
      mark.textContent = m[0];
      fragments.push(mark);
      marks.push(mark);
      last = m.index + m[0].length;
      if (m[0].length === 0) break;
    }
    if (!changed) continue;
    if (last < value.length) fragments.push(value.slice(last));
    const parent = textNode.parentNode;
    if (!parent) continue;
    for (const frag of fragments) {
      if (typeof frag === 'string') parent.insertBefore(document.createTextNode(frag), textNode);
      else parent.insertBefore(frag, textNode);
    }
    parent.removeChild(textNode);
  }
  return marks;
}

export function goToMatchInRoot(
  root: HTMLElement | null,
  delta: number,
  indexRef: { current: number }
): void {
  if (!root) return;
  const marks = root.querySelectorAll('mark.docs-search-highlight');
  if (!marks.length) return;
  marks.forEach((m) => m.classList.remove('docs-search-highlight--active'));
  indexRef.current = (indexRef.current + delta + marks.length) % marks.length;
  const el = marks[indexRef.current] as HTMLElement;
  el.classList.add('docs-search-highlight--active');
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

export function countMarksInRoot(root: HTMLElement | null): number {
  return root?.querySelectorAll('mark.docs-search-highlight').length ?? 0;
}
