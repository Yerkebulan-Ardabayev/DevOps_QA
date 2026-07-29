/**
 * Проверки самого корпуса вопросов и ответов.
 *
 * Корпус получен конвертацией текстового дампа, и это оставило в нём набор
 * характерных дефектов: разъехавшиеся абзацы, съеденные `--` во флагах, лишние
 * обратные слэши перед кавычками, мусор из интерфейса чат-ботов, повторяющиеся
 * id. Всё это починено, а тесты ниже держат оборону: если дефект вернётся при
 * следующем обновлении контента, сборка упадёт, а не уедет на прод.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

interface Question {
  id: number;
  num: number;
  category: string;
  text: string;
  answer: string;
}

const ROOT = path.resolve(__dirname, '../..');
const CORPUS = path.join(ROOT, 'public/DevOps_Interview.html');
const CORPUS_COPY = path.resolve(ROOT, '../DevOps_Interview.html');

function loadCorpus(file: string): { categories: string[]; questions: Question[] } {
  const html = fs.readFileSync(file, 'utf8');
  const m = html.match(/var\s+DATA\s*=\s*(\{[\s\S]*?\});/);
  if (!m) throw new Error(`в ${file} не найден объект DATA`);
  return JSON.parse(m[1]);
}

const data = loadCorpus(CORPUS);

/** Компактный список номеров вопросов — чтобы упавший тест сразу называл виновных. */
const offenders = (re: RegExp) => data.questions.filter((q) => re.test(q.answer)).map((q) => q.num);

describe('целостность корпуса', () => {
  it('вопросы есть и разложены по разделам', () => {
    expect(data.questions.length).toBeGreaterThan(0);
    expect(data.categories.length).toBeGreaterThan(0);
  });

  it('каждый вопрос лежит в существующем разделе', () => {
    const known = new Set(data.categories);
    expect(data.questions.filter((q) => !known.has(q.category)).map((q) => q.num)).toEqual([]);
  });

  it('id уникальны', () => {
    // Index.tsx ищет соседний вопрос через findIndex по q.id, а списки
    // результатов используют id как React-ключ: дубли ломают и то, и другое.
    expect(new Set(data.questions.map((q) => q.id)).size).toBe(data.questions.length);
  });

  it('номера вопросов уникальны', () => {
    expect(new Set(data.questions.map((q) => q.num)).size).toBe(data.questions.length);
  });

  it('копия корпуса в корне репозитория совпадает с той, что раздаётся сайтом', () => {
    expect(fs.readFileSync(CORPUS_COPY, 'utf8')).toBe(fs.readFileSync(CORPUS, 'utf8'));
  });
});

describe('качество ответов', () => {
  it('нет заглушек вместо ответа', () => {
    expect(offenders(/Ответ не найден|TODO|Lorem ipsum/i)).toEqual([]);
  });

  it('нет обрубков вместо ответа', () => {
    expect(data.questions.filter((q) => q.answer.trim().length < 200).map((q) => q.num)).toEqual([]);
  });

  it('нет мусора из интерфейса чат-ботов', () => {
    expect(offenders(/КопироватьРедактировать|Экспортировать в Таблицы/)).toEqual([]);
  });

  it('нет лишних обратных слэшей перед кавычками', () => {
    // На странице это выглядело как \"мозг\" вместо "мозг".
    expect(offenders(/\\["']/)).toEqual([]);
  });

  it('ключи командной строки не превратились в длинное тире', () => {
    // Конвертация делала из `--single-transaction` строку `—single-transaction`.
    expect(offenders(/—[a-zA-Z]{2}/)).toEqual([]);
  });

  it('нет остатков pandoc-экранирования плейсхолдеров', () => {
    expect(offenders(/\\<|\\>/)).toEqual([]);
  });

  it('псевдотаблицы из тире не остались обычным текстом', () => {
    // Настоящая таблица — <table>, невосстановимая — <pre>. Голый <p> с рамкой
    // из тире означает, что блок снова разъехался.
    expect(offenders(/<p>[\s—–-]{6,}<\/p>/)).toEqual([]);
  });
});

describe('актуальность технических деталей', () => {
  it('не предлагает удалённый в MySQL 8.4 синтаксис репликации как рабочий', () => {
    // CHANGE MASTER TO / START SLAVE удалены в MySQL 8.4. Упоминание в
    // пояснении «так было раньше» допустимо (это <code> внутри текста),
    // а вот в примере для копирования — нет.
    expect(offenders(/<p>\s*(CHANGE MASTER TO|START SLAVE;)/)).toEqual([]);
    expect(offenders(/<pre><code>(?:(?!<\/code>)[\s\S])*?(CHANGE MASTER TO|START SLAVE;)/)).toEqual([]);
  });

  it('не предлагает удалённый в PostgreSQL 13 параметр wal_keep_segments', () => {
    expect(offenders(/wal_keep_segments\s*=/)).toEqual([]);
  });

  it('не предлагает устаревший метод md5 в pg_hba.conf', () => {
    expect(offenders(/^\s*host\s+\S+\s+\S+\s+\S+\s+md5\s*$/m)).toEqual([]);
  });
});
