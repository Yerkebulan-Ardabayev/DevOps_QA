/**
 * Разбиение текста на куски «совпало / не совпало» для подсветки результатов поиска.
 *
 * Поиск ранжирует по набору терминов (слова пользователя + синонимы + транслит),
 * поэтому и подсветка идёт по тому же набору — см. buildSearchTerms. Иначе
 * подсветка показывала бы не то, из-за чего результат вообще попал в выдачу.
 */

export interface Segment {
  text: string;
  /** true — этот кусок совпал с одним из поисковых терминов. */
  hit: boolean;
}

/** Минимальная длина термина: односимвольные подсвечивают пол-текста и только мешают. */
const MIN_TERM_LEN = 2;

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Строит регулярку из терминов. Длинные термины идут первыми, чтобы
 * «kubernetes» побеждал «kube» и подсветка не рвалась на части.
 */
function buildRegex(terms: string[]): RegExp | null {
  const usable = [...new Set(terms.map(t => t.trim().toLowerCase()).filter(t => t.length >= MIN_TERM_LEN))].sort(
    (a, b) => b.length - a.length
  );
  if (usable.length === 0) return null;
  return new RegExp(`(${usable.map(escapeRe).join('|')})`, 'gi');
}

/**
 * Возвращает текст, разрезанный на сегменты. Куски без совпадений склеены,
 * чтобы React не рендерил лишние узлы.
 */
export function highlightSegments(text: string, terms: string[]): Segment[] {
  if (!text) return [];
  const re = buildRegex(terms);
  if (!re) return [{ text, hit: false }];

  const out: Segment[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    const start = m.index ?? 0;
    if (start > last) out.push({ text: text.slice(last, start), hit: false });
    out.push({ text: m[0], hit: true });
    last = start + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), hit: false });
  return out;
}
