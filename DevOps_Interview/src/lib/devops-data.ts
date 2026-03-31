import { expandWithSynonyms } from './synonyms';
import { generateSearchVariants } from './translit';

export interface Question {
  id: number;
  num: number;
  category: string;
  text: string;
  answer: string;
}

export interface DevOpsData {
  categories: string[];
  questions: Question[];
}

export async function loadDevOpsData(): Promise<DevOpsData> {
  const resp = await fetch(`${import.meta.env.BASE_URL}DevOps_Interview.html`);
  const html = await resp.text();
  
  // Extract the script content
  const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!scriptMatch) throw new Error('No script found');
  
  const scriptContent = scriptMatch[1];
  
  // Extract DATA object using Function constructor (safer than eval)
  const dataMatch = scriptContent.match(/var\s+DATA\s*=\s*(\{[\s\S]*?\});/);
  if (!dataMatch) {
    // Try alternative: DATA might be assigned differently
    // Fallback: execute the script in a sandboxed way
    const fn = new Function(`
      var DATA;
      ${scriptContent.split('// ===== HELPERS')[0]}
      return DATA;
    `);
    const data = fn();
    if (data) return data as DevOpsData;
    throw new Error('Could not extract DATA');
  }
  
  try {
    const data = JSON.parse(dataMatch[1]);
    return data as DevOpsData;
  } catch {
    // If not valid JSON, evaluate it
    const fn = new Function(`return ${dataMatch[1]}`);
    return fn() as DevOpsData;
  }
}

export function stripHtml(html: string): string {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

export function shortCat(cat: string): string {
  return cat.replace(/^\d+\.\s*/, '');
}

export function getQuestionsForCategory(data: DevOpsData, categoryIndex: number): Question[] {
  const cat = data.categories[categoryIndex];
  return data.questions.filter(q => q.category === cat);
}

/**
 * Стоп-слова — убираем из голосового запроса, чтобы «что такое Kubernetes»
 * искало только по «kubernetes», а не требовало «что» + «такое» + «kubernetes».
 */
const STOP_WORDS = new Set([
  // Русские
  'что', 'такое', 'как', 'это', 'про', 'о', 'об', 'и', 'в', 'на', 'с', 'к', 'у',
  'не', 'по', 'для', 'из', 'от', 'до', 'при', 'за', 'над', 'без',
  'мне', 'мой', 'мои', 'меня', 'тебе', 'нам', 'вам',
  'расскажи', 'покажи', 'объясни', 'найди', 'найти', 'поиск', 'ищи', 'искать',
  'скажи', 'открой', 'дай', 'давай',
  'пожалуйста', 'можно', 'можешь', 'нужно', 'нужен', 'нужна',
  'все', 'всё', 'вся', 'весь', 'этот', 'эта', 'эти', 'тот', 'та', 'те',
  'а', 'но', 'или', 'же', 'ли', 'бы', 'ведь',
  'чем', 'кто', 'где', 'когда', 'зачем', 'почему', 'какой', 'какая', 'какие',
  'есть', 'быть', 'будет', 'было', 'были', 'является',
  'так', 'тоже', 'также', 'ещё', 'еще', 'уже', 'только', 'вот',
  // English
  'what', 'is', 'are', 'how', 'do', 'does', 'the', 'a', 'an', 'to', 'in', 'of',
  'about', 'tell', 'me', 'show', 'find', 'search', 'explain', 'and', 'or',
]);

/**
 * Ключевые DevOps-термины — вопросы с этими словами в ЗАГОЛОВКЕ
 * получают x3 boost при ранжировании.
 */
const DEVOPS_KEYWORDS = new Set([
  'kubernetes', 'k8s', 'docker', 'docker-compose', 'compose',
  'jenkins', 'ansible', 'terraform', 'prometheus', 'grafana',
  'nginx', 'helm', 'linux', 'bash', 'git', 'github', 'gitlab',
  'aws', 'azure', 'gcp', 'devops', 'ci/cd', 'cicd', 'pipeline',
  'ssh', 'https', 'http', 'dns', 'tcp', 'udp', 'ip',
  'yaml', 'json', 'deployment', 'deploy', 'ingress', 'namespace',
  'volume', 'configmap', 'secret', 'pod', 'service', 'node',
  'ceph', 'minio', 'vault', 'hashicorp', 'elk', 'elastic', 'kibana',
  'logstash', 'istio', 'argocd', 'argo', 'etcd', 'kubelet', 'kubectl',
  'vagrant', 'packer', 'consul', 'nomad', 'redis', 'postgresql', 'mysql',
  'mongodb', 'rabbitmq', 'kafka', 'zookeeper', 'haproxy', 'traefik',
  'containerd', 'cri-o', 'flannel', 'calico', 'metallb', 'cert-manager',
]);

/** Убираем стоп-слова, оставляем значимые термины */
function filterStopWords(terms: string[]): string[] {
  const meaningful = terms.filter(t => t.length > 1 && !STOP_WORDS.has(t));
  // Если всё убрали — вернуть оригинал (лучше искать хоть по чему-то)
  return meaningful.length > 0 ? meaningful : terms;
}

/**
 * Умный поиск с:
 *   1. Стоп-слова убираются
 *   2. Синонимы расширяют запрос (слой → layer, image layer, overlay...)
 *   3. Транслитерация кириллицы → латиница (губернетис → gubernetis → kubernetes)
 *   4. Совпадение в заголовке × 5, в категории × 3, в ответе × 1
 *   5. Оригинальные термины пользователя весят × 2 по сравнению с синонимами
 *   6. DevOps-термин в заголовке — ещё бонус
 *   7. Результат сортируется по score ↓
 */
export function searchQuestions(data: DevOpsData, query: string): Question[] {
  const rawTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 0);
  if (rawTerms.length === 0) return [];

  const userTerms = filterStopWords(rawTerms);

  // 1) Расширяем синонимами
  const withSynonyms = expandWithSynonyms(userTerms);

  // 2) Для каждого кириллического слова — генерируем латинские варианты
  //    (губернетис → gubernetis, kubernetes, kubernatis и т.д.)
  const translitVariants: string[] = [];
  for (const t of userTerms) {
    // Если слово содержит кириллицу — транслитерируем
    if (/[а-яё]/i.test(t)) {
      translitVariants.push(...generateSearchVariants(t));
    }
  }

  // Объединяем все варианты поиска
  const allTerms = new Set([...withSynonyms, ...translitVariants]);

  // Множество оригинальных терминов для повышенного веса
  const userSet = new Set(userTerms);

  const scored: { q: Question; score: number }[] = [];

  for (const q of data.questions) {
    const title = q.text.toLowerCase();
    const cat = q.category.toLowerCase();
    const body = stripHtml(q.answer).toLowerCase();

    let score = 0;
    let matchedUserTerms = 0;

    for (const t of allTerms) {
      const isUser = userSet.has(t);
      const multiplier = isUser ? 2 : 1;

      const inTitle = title.includes(t);
      const inCat = cat.includes(t);
      const inBody = body.includes(t);

      if (!inTitle && !inCat && !inBody) continue;

      // Вес по расположению
      if (inTitle) score += 5 * multiplier;
      if (inCat) score += 3 * multiplier;
      if (inBody) score += 1 * multiplier;

      // DevOps-термин в заголовке — бонус
      if (inTitle && DEVOPS_KEYWORDS.has(t)) score += 10;

      if (isUser) matchedUserTerms++;
    }

    // Хотя бы что-то совпало
    if (score === 0) continue;

    // Бонус за долю совпавших ПОЛЬЗОВАТЕЛЬСКИХ терминов
    if (userTerms.length > 0) {
      score += (matchedUserTerms / userTerms.length) * 8;
    }

    // Если ВСЕ пользовательские термины совпали — большой бонус
    if (matchedUserTerms === userTerms.length && userTerms.length > 0) {
      score += 20;
    }

    scored.push({ q, score });
  }

  // Сортируем по убыванию score
  scored.sort((a, b) => b.score - a.score);

  return scored.map(s => s.q);
}
