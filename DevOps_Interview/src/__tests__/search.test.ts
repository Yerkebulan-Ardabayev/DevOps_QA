import { describe, expect, it } from 'vitest';
import {
  type DevOpsData,
  getQuestionsForCategory,
  searchQuestions,
  shortCat,
  stripHtml,
} from '@/lib/devops-data';
import { cyrToLatin, generateSearchVariants } from '@/lib/translit';
import { expandWithSynonyms } from '@/lib/synonyms';

const data: DevOpsData = {
  categories: ['1. Вопросы по Kubernetes и оркестрации', '2. Вопросы по сетям'],
  questions: [
    {
      id: 0,
      num: 1,
      category: '1. Вопросы по Kubernetes и оркестрации',
      text: 'Что такое Kubernetes?',
      answer: '<p>Оркестратор контейнеров.</p>',
    },
    {
      id: 1,
      num: 2,
      category: '1. Вопросы по Kubernetes и оркестрации',
      text: 'Что такое Pod?',
      answer: '<p>Наименьшая единица развёртывания. Внутри работает Kubernetes.</p>',
    },
    {
      id: 2,
      num: 3,
      category: '2. Вопросы по сетям',
      text: 'Как работает DNS?',
      answer: '<p>Разрешение имён в адреса.</p>',
    },
  ],
};

describe('stripHtml', () => {
  it('убирает теги и оставляет текст', () => {
    expect(stripHtml('<p>Привет <b>мир</b></p>')).toBe('Привет мир');
  });

  it('не превращает содержимое в HTML повторно', () => {
    expect(stripHtml('<p>a &lt; b</p>')).toBe('a < b');
  });
});

describe('shortCat', () => {
  it('срезает ведущий номер раздела', () => {
    expect(shortCat('3. Вопросы по сетям')).toBe('Вопросы по сетям');
  });

  it('не трогает название без номера', () => {
    expect(shortCat('Вопросы по сетям')).toBe('Вопросы по сетям');
  });
});

describe('getQuestionsForCategory', () => {
  it('возвращает только вопросы своего раздела', () => {
    expect(getQuestionsForCategory(data, 0).map((q) => q.num)).toEqual([1, 2]);
    expect(getQuestionsForCategory(data, 1).map((q) => q.num)).toEqual([3]);
  });
});

describe('searchQuestions', () => {
  it('пустой запрос не даёт результатов', () => {
    expect(searchQuestions(data, '   ')).toEqual([]);
  });

  it('находит по слову из заголовка', () => {
    expect(searchQuestions(data, 'Pod')[0].num).toBe(2);
  });

  it('совпадение в заголовке ранжируется выше совпадения в ответе', () => {
    // «Kubernetes» есть в заголовке #1 и в теле ответа #2 — первым должен быть #1
    const res = searchQuestions(data, 'kubernetes');
    expect(res.length).toBeGreaterThan(1);
    expect(res[0].num).toBe(1);
  });

  it('игнорирует стоп-слова: «что такое Pod» ищет по Pod', () => {
    expect(searchQuestions(data, 'что такое Pod')[0].num).toBe(2);
  });

  it('запрос из одних стоп-слов не роняет поиск', () => {
    expect(() => searchQuestions(data, 'что такое')).not.toThrow();
  });

  it('находит латинский термин по кириллическому написанию', () => {
    expect(searchQuestions(data, 'кубернетес').map((q) => q.num)).toContain(1);
  });

  it('заведомо отсутствующий термин не находится', () => {
    expect(searchQuestions(data, 'zzzнесуществующийтермин')).toEqual([]);
  });
});

describe('translit', () => {
  it('переводит кириллицу в латиницу', () => {
    expect(cyrToLatin('докер')).toBe('doker');
  });

  it('генерирует варианты, среди которых есть исходная транслитерация', () => {
    expect(generateSearchVariants('кубернетес')).toContain('kubernetes');
  });
});

describe('synonyms', () => {
  it('расширение синонимами не теряет исходные термины', () => {
    const out = expandWithSynonyms(['docker']);
    expect(out).toContain('docker');
  });
});
