/**
 * Карта синонимов и связанных понятий для DevOps-поиска.
 *
 * Когда пользователь говорит «слой» — расширяем запрос до:
 *   слой → layer, image layer, уровень, overlay
 *
 * Формат: ключ = любое слово которое может произнести пользователь,
 *          значение = массив синонимов/связанных терминов для расширения поиска.
 *
 * ВСЕ ключи lowercase!
 */

const SYNONYM_MAP: Record<string, string[]> = {
  // === Слой / Layer ===
  'слой':      ['layer', 'слой', 'image layer', 'overlay', 'уровень'],
  'слои':      ['layer', 'слои', 'layers', 'image layer', 'overlay', 'уровень'],
  'layer':     ['layer', 'слой', 'image layer', 'overlay'],
  'layers':    ['layers', 'layer', 'слой', 'image layer'],

  // === Образ / Image ===
  'образ':     ['image', 'образ', 'docker-image', 'docker image', 'контейнер'],
  'образы':    ['image', 'образ', 'docker-image', 'images'],
  'image':     ['image', 'образ', 'docker-image', 'docker image'],

  // === Контейнер / Container ===
  'контейнер':     ['контейнер', 'container', 'docker', 'docker-контейнер'],
  'контейнеры':    ['контейнер', 'container', 'контейнеризация', 'docker'],
  'container':     ['container', 'контейнер', 'docker'],

  // === Сеть / Network ===
  'сеть':      ['сеть', 'network', 'сети', 'networking', 'tcp', 'ip', 'dns'],
  'сети':      ['сети', 'network', 'сеть', 'networking', 'tcp', 'ip'],
  'network':   ['network', 'сеть', 'networking'],

  // === Под / Pod ===
  'под':       ['pod', 'под', 'контейнер', 'k8s'],
  'поды':      ['pod', 'поды', 'pods'],
  'pod':       ['pod', 'под', 'контейнер'],

  // === Том / Volume ===
  'том':       ['volume', 'том', 'volumes', 'storage', 'хранилище', 'mount'],
  'тома':      ['volume', 'тома', 'volumes', 'storage'],
  'volume':    ['volume', 'том', 'mount', 'storage'],
  'volumes':   ['volumes', 'volume', 'тома', 'mount'],

  // === Хранение / Storage ===
  'хранение':   ['storage', 'хранение', 'хранилище', 'volume', 'ceph', 'minio', 'pv', 'pvc'],
  'хранилище':  ['storage', 'хранилище', 'volume', 'ceph', 'minio'],
  'storage':    ['storage', 'хранение', 'хранилище', 'volume'],

  // === Безопасность / Security ===
  'безопасность':   ['безопасность', 'security', 'секрет', 'secret', 'шифрование', 'tls', 'ssl'],
  'security':       ['security', 'безопасность', 'секрет', 'secret'],
  'секрет':         ['секрет', 'secret', 'secrets', 'vault', 'hashicorp'],
  'secret':         ['secret', 'секрет', 'secrets', 'vault'],

  // === Мониторинг / Monitoring ===
  'мониторинг':     ['мониторинг', 'monitoring', 'prometheus', 'grafana', 'observability', 'метрики'],
  'monitoring':     ['monitoring', 'мониторинг', 'prometheus', 'grafana'],
  'метрики':        ['метрики', 'metrics', 'prometheus', 'мониторинг'],

  // === Логи / Logs ===
  'логи':      ['логи', 'logs', 'логирование', 'logging', 'elk', 'logstash', 'kibana'],
  'логирование':  ['логирование', 'logging', 'логи', 'logs', 'elk'],
  'logs':      ['logs', 'логи', 'logging', 'логирование'],

  // === Деплой / Deploy ===
  'деплой':    ['deploy', 'деплой', 'deployment', 'развёртывание', 'ci/cd', 'pipeline'],
  'deploy':    ['deploy', 'деплой', 'deployment', 'развёртывание'],
  'развёртывание':  ['развёртывание', 'deploy', 'deployment', 'деплой'],

  // === Пайплайн / Pipeline ===
  'пайплайн':  ['pipeline', 'пайплайн', 'ci/cd', 'jenkins', 'gitlab ci'],
  'pipeline':  ['pipeline', 'пайплайн', 'ci/cd'],

  // === Модель OSI ===
  'osi':       ['osi', 'модель osi', 'tcp/ip', 'уровень', 'layer', 'сеть'],
  'оси':       ['osi', 'модель osi', 'tcp/ip', 'уровень'],

  // === Репликация / Replication ===
  'репликация':  ['репликация', 'replication', 'реплика', 'master', 'slave', 'primary', 'replica'],
  'replication': ['replication', 'репликация', 'реплика'],

  // === Балансировка / Load Balancing ===
  'балансировка':  ['балансировка', 'load balancing', 'load balancer', 'balancer', 'haproxy', 'nginx', 'ingress'],
  'балансировщик': ['балансировщик', 'load balancer', 'balancer', 'haproxy', 'nginx'],

  // === Кластер / Cluster ===
  'кластер':   ['кластер', 'cluster', 'нода', 'node', 'кворум'],
  'cluster':   ['cluster', 'кластер', 'node'],

  // === Нода / Node ===
  'нода':      ['нода', 'node', 'узел', 'worker', 'master'],
  'node':      ['node', 'нода', 'узел'],
  'узел':      ['узел', 'node', 'нода'],

  // === Сервис / Service ===
  'сервис':    ['сервис', 'service', 'микросервис', 'microservice'],
  'service':   ['service', 'сервис', 'микросервис'],
  'микросервис':  ['микросервис', 'microservice', 'сервис', 'service'],

  // === Namespace ===
  'неймспейс':    ['namespace', 'неймспейс', 'пространство имён'],
  'namespace':    ['namespace', 'неймспейс', 'пространство'],

  // === Конфигурация / Config ===
  'конфигурация':  ['конфигурация', 'config', 'configmap', 'configuration', 'настройка'],
  'конфиг':        ['конфиг', 'config', 'configmap', 'конфигурация'],
  'config':        ['config', 'конфигурация', 'configmap'],

  // === Процесс / Process ===
  'процесс':   ['процесс', 'process', 'pid', 'systemd', 'daemon'],
  'process':   ['process', 'процесс', 'pid'],

  // === Файловая система / Filesystem ===
  'файловая':  ['файловая', 'filesystem', 'inode', 'файл', 'диск'],
  'файл':      ['файл', 'file', 'filesystem', 'inode'],
  'диск':      ['диск', 'disk', 'storage', 'файловая', 'lvm', 'raid'],

  // === Память / Memory ===
  'память':    ['память', 'memory', 'ram', 'oom', 'swap', 'swappiness'],
  'memory':    ['memory', 'память', 'ram', 'oom'],
  'oom':       ['oom', 'oomkilled', 'память', 'memory', 'out of memory'],

  // === Масштабирование / Scaling ===
  'масштабирование':  ['масштабирование', 'scaling', 'autoscaling', 'hpa', 'scale'],
  'scaling':          ['scaling', 'масштабирование', 'autoscaling', 'hpa'],

  // === DNS ===
  'dns':       ['dns', 'домен', 'domain', 'resolve', 'имена'],

  // === Сертификат / Certificate ===
  'сертификат':  ['сертификат', 'certificate', 'tls', 'ssl', 'https', 'cert'],
  'certificate': ['certificate', 'сертификат', 'tls', 'ssl'],
  'tls':         ['tls', 'ssl', 'сертификат', 'certificate', 'https'],

  // === Бэкап / Backup ===
  'бэкап':     ['бэкап', 'backup', 'резервное', 'восстановление', 'restore'],
  'backup':    ['backup', 'бэкап', 'резервное', 'восстановление'],

  // === Архитектура / Architecture ===
  'архитектура':  ['архитектура', 'architecture', 'дизайн', 'паттерн', 'микросервис'],
  'architecture': ['architecture', 'архитектура', 'дизайн'],

  // === Авторизация / Auth ===
  'авторизация':  ['авторизация', 'authorization', 'аутентификация', 'authentication', 'oauth', 'mfa', 'rbac'],
  'аутентификация':  ['аутентификация', 'authentication', 'авторизация', 'mfa', 'totp'],
  'rbac':        ['rbac', 'role', 'роль', 'авторизация', 'доступ'],
};

/**
 * Расширяет список терминов синонимами.
 * Например: ['слой'] → ['слой', 'layer', 'image layer', 'overlay', 'уровень']
 */
export function expandWithSynonyms(terms: string[]): string[] {
  const expanded = new Set<string>();

  for (const t of terms) {
    expanded.add(t);
    const syns = SYNONYM_MAP[t];
    if (syns) {
      for (const s of syns) {
        expanded.add(s.toLowerCase());
      }
    }
  }

  return Array.from(expanded);
}
