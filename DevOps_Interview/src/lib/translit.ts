/**
 * Обратная транслитерация: кириллица → латиница.
 *
 * Когда Chrome пишет «губернетис» или «лейер» или «нетворк» —
 * мы превращаем это в «gubernetis», «leier», «network» и т.д.
 * Потом ищем ПО ОБОИМ вариантам.
 *
 * Это не словарь — это автоматическое преобразование ЛЮБОГО
 * кириллического текста в фонетическую латиницу.
 */

const CYR_TO_LAT: Record<string, string> = {
  'а': 'a',   'б': 'b',   'в': 'v',   'г': 'g',   'д': 'd',
  'е': 'e',   'ё': 'yo',  'ж': 'zh',  'з': 'z',   'и': 'i',
  'й': 'y',   'к': 'k',   'л': 'l',   'м': 'm',   'н': 'n',
  'о': 'o',   'п': 'p',   'р': 'r',   'с': 's',   'т': 't',
  'у': 'u',   'ф': 'f',   'х': 'kh',  'ц': 'ts',  'ч': 'ch',
  'ш': 'sh',  'щ': 'shch','ъ': '',    'ы': 'y',   'ь': '',
  'э': 'e',   'ю': 'yu',  'я': 'ya',
};

/**
 * Транслитерирует кириллический текст в латиницу.
 * «губернетис» → «gubernetis»
 * «докер» → «doker»
 * «лейер» → «leyer»
 * «нетворк» → «network» (close enough for fuzzy match)
 */
export function cyrToLatin(text: string): string {
  let result = '';
  for (const ch of text.toLowerCase()) {
    result += CYR_TO_LAT[ch] ?? ch;
  }
  return result;
}

/**
 * Генерирует фонетические варианты из транслитерации.
 * «gubernetis» → также пробуем «kubernetes» (g→k, u→u, b→b)
 *
 * Типичные замены Chrome:
 *   г/к (g/k), б/b, у/oo, е/э → e, и/i, с/s, т/t
 *   й → y/i, х → h/kh, ш → sh, ж → zh, ц → ts
 */
const PHONETIC_SWAPS: [RegExp, string[]][] = [
  // г↔к (Chrome часто путает: губернетис = kubernetes)
  [/g/g, 'k'],
  [/k/g, 'g'],
  // о↔а (безударные)
  [/o(?=[^u])/g, 'a'],
  // е↔э↔a
  [/e/g, 'a'],
  // и↔е↔ey
  [/i/g, 'e'],
  // дж → j
  [/dzh/g, 'j'],
  // кс → x
  [/ks/g, 'x'],
];

/**
 * Для одного транслитерированного слова — генерируем набор
 * фонетических вариантов для fuzzy-matching.
 */
export function phoneticVariants(latinWord: string): string[] {
  const variants = new Set<string>();
  variants.add(latinWord);

  // Одинарные замены
  for (const [regex, replacement] of PHONETIC_SWAPS) {
    const v = latinWord.replace(regex, replacement);
    if (v !== latinWord) variants.add(v);
  }

  // Специальная обработка: gubernetis → kubernetes
  // g→k, добавляем вариант
  const gToK = latinWord.replace(/^g/, 'k');
  if (gToK !== latinWord) variants.add(gToK);

  return Array.from(variants);
}

/**
 * Для строки на кириллице — генерирует набор латинских вариантов поиска.
 * Используется в search: ищем и по оригиналу, и по транслитерации.
 */
export function generateSearchVariants(cyrText: string): string[] {
  const latin = cyrToLatin(cyrText);
  const words = latin.split(/\s+/).filter(w => w.length > 2);

  const allVariants = new Set<string>();
  for (const w of words) {
    for (const v of phoneticVariants(w)) {
      allVariants.add(v);
    }
  }

  return Array.from(allVariants);
}
