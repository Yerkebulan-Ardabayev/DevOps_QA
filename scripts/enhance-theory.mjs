// Append substantial theory blocks to 23 AI/ML questions.
import { readFileSync, writeFileSync } from 'node:fs';

const HTML_PATH = 'DevOps_Interview.html';
const html = readFileSync(HTML_PATH, 'utf-8');

const startMarker = 'var DATA=';
const startIdx = html.indexOf(startMarker);
const jsonStart = startIdx + startMarker.length;
let depth = 0, inString = false, escape = false, endIdx = -1;
for (let i = jsonStart; i < html.length; i++) {
  const c = html[i];
  if (escape) { escape = false; continue; }
  if (c === '\\') { escape = true; continue; }
  if (c === '"') { inString = !inString; continue; }
  if (inString) continue;
  if (c === '{') depth++;
  else if (c === '}') { depth--; if (depth === 0) { endIdx = i + 1; break; } }
}
const data = JSON.parse(html.slice(jsonStart, endIdx));

// theory blocks keyed by text-prefix of the question
const theoryByPrefix = {
  'Масштабирование GPU': `
<h4>Теория: как Kubernetes решает «куда поставить под»</h4>
<p>Планировщик Kubernetes выбирает ноду через двухэтапный процесс: <b>Filtering</b> (какие ноды вообще подходят) и <b>Scoring</b> (какая из подходящих лучше). Taints работают на этапе filtering: если на ноде стоит taint, планировщик <i>исключает</i> её из кандидатов — за исключением подов с matching toleration.</p>
<p>Формально taint — это тройка <code>(key, value, effect)</code>, где effect принимает одно из трёх значений:</p>
<ul>
<li><b>NoSchedule</b> — мягкий барьер: новые поды не сядут, но уже работающие остаются.</li>
<li><b>PreferNoSchedule</b> — soft preference, kubernetes попробует избежать, но не гарантирует.</li>
<li><b>NoExecute</b> — жёсткий: уже работающие поды эвиктятся, если не имеют toleration (с опциональным <code>tolerationSeconds</code>).</li>
</ul>
<p>Toleration в поде имеет операторы <code>Equal</code> (точное совпадение) или <code>Exists</code> (достаточно ключа). Это классическая реализация <b>labels vs taints</b>-асимметрии: <i>labels притягивают</i> (через <code>nodeSelector</code>/<code>nodeAffinity</code>), <i>taints отталкивают</i>. Для GPU-нод нужно и то и другое: taint защищает от не-GPU подов, а nodeSelector/affinity направляет именно туда.</p>
<p><b>Inversion of control:</b> владелец ноды (платформа) ставит taint один раз, владельцы подов (команды) сами решают, терпят ли они это условие. Это единственный способ <i>заранее</i> разграничить дорогие ресурсы без централизованного admission controller'а.</p>
<p><b>Почему именно GPU:</b> цена единицы GPU-времени на 1–2 порядка выше CPU-времени, а конкуренция за память GPU приводит к OOM — в отличие от CPU, где kubernetes умеет throttling. Отсюда жёсткое разделение taint'ом, а не через QoS-классы.</p>`,

  'Общее представление о линейной регрессии': `
<h4>Теоретический фундамент</h4>
<p><b>Линейная регрессия</b> минимизирует <code>MSE = (1/n) Σ(yᵢ − ŷᵢ)²</code>. Закрытое решение через <b>нормальные уравнения</b>: <code>w* = (XᵀX)⁻¹ Xᵀy</code>. Это частный случай <b>Maximum Likelihood Estimation</b> при допущении нормальных ошибок с постоянной дисперсией (гомоскедастичность). Если фичи скоррелированы — <code>XᵀX</code> плохо обусловлена, появляется регуляризация: Ridge (L2, <code>+λ‖w‖²</code>) и Lasso (L1, <code>+λ‖w‖₁</code>, стимулирует разреженность).</p>
<p><b>Деревья решений</b> строятся жадно по критериям: <b>Gini impurity</b> <code>1 − Σp²ᵢ</code> или <b>entropy</b> <code>−Σpᵢlog₂pᵢ</code> для классификации, MSE для регрессии. На каждом узле ищется split, максимизирующий information gain. Одно дерево склонно к переобучению — решают ансамбли:</p>
<ul>
<li><b>Bagging (Random Forest):</b> bootstrap-выборка + случайные подмножества фичей → N независимых деревьев. Вариации ошибки падают как <code>σ²/N</code>, bias остаётся.</li>
<li><b>Boosting (XGBoost, LightGBM):</b> каждое следующее дерево fit'ится на <i>градиент функции потерь</i> предыдущего ансамбля. Математически — градиентный спуск в функциональном пространстве. Здесь уменьшается bias, но усилятся шум при большом числе деревьев.</li>
</ul>
<p><b>Нейронные сети</b> — композиция аффинных преобразований и нелинейных активаций: <code>h = σ(Wx + b)</code>. Universal Approximation Theorem (Cybenko, 1989) гарантирует, что одного скрытого слоя достаточно для аппроксимации любой непрерывной функции — но на практике глубина даёт экспоненциальное сокращение числа параметров. Обучение через <b>обратное распространение ошибки</b>: цепное правило для вычисления ∂L/∂W за один forward-backward pass. Современные архитектуры — <b>Transformer</b> (attention — softmax(QKᵀ/√d)V) — позволили моделям масштабироваться до сотен миллиардов параметров, и <b>scaling laws Kaplan/Hoffmann</b> показали, что loss убывает по степенному закону от compute, data и parameters.</p>`,

  'Масштабирование AI/HPC': `
<h4>Теория queueing и экономики GPU</h4>
<p>Cluster autoscaling — это задача <b>онлайн-оптимизации</b>: не зная будущих заявок, минимизировать сумму <code>cost(idle) + cost(delay)</code>. Алгоритмически это родственно <b>M/M/c-queue</b> из теории массового обслуживания: при интенсивности прихода λ и времени обслуживания μ нужна утилизация ρ = λ/(cμ) &lt; 1 для стабильности, но при ρ → 1 очередь растёт гиперболически (формула Erlang-C).</p>
<p>Для GPU-тренировок распределения нагрузки тяжелохвостые — редкие большие задачи (пре-тренинг LLM) соседствуют с сотнями мелких. Классический HPA по CPU не работает: метрика активности GPU (<code>DCGM_FI_DEV_GPU_UTIL</code>) — пиковая, не средняя, к тому же idle-pod ≠ idle-GPU. Отсюда событийная модель (<b>KEDA</b>) по длине очереди, а не по утилизации.</p>
<p><b>Karpenter</b> реализует модель «just-in-time provisioning»: вместо фиксированных node-групп он для каждой pending-подгруппы подов ищет <i>оптимальный</i> instance-type по bin-packing. Это NP-hard, но с небольшим числом типов сводится к greedy-эвристике. Cluster Autoscaler считает по фиксированным ASG — быстрее, но менее гибко.</p>
<p><b>Checkpointing theorem (Young's formula):</b> оптимальный интервал чекпоинта <code>τ* = √(2·C·M)</code>, где C — стоимость чекпоинта, M — MTBF (mean time between failures). Для spot-инстансов с MTBF ~2 часа и чекпоинтом 30 сек — оптимум около 5–10 минут. Это не «best practice», а математически вывод: отклонение от τ* увеличивает ожидаемое общее время обучения.</p>`,

  'Model Deployment / Serving': `
<h4>Теория: от batch к online serving</h4>
<p>Serving — это <b>SLA-driven</b> система: задача не «выдать предсказание», а выдать его с p99 latency ≤ T ms при throughput ≥ R RPS с availability ≥ 99.9%. Отсюда три независимых трейд-оффа.</p>
<p><b>1. Latency vs Throughput (Little's Law):</b> <code>N = λ × W</code>, где N — число in-flight запросов, λ — throughput, W — latency. Batching увеличивает W, но амортизирует fixed-cost операций (GPU kernel launch, cache warm-up), поднимая λ нелинейно. Оптимальный batch size — точка, где <code>dλ/dW ≈ 1</code>.</p>
<p><b>2. Freshness vs Cost:</b> модель можно пересчитать каждый запрос (фича recomputation), закешировать (stale predictions), или сгенерить впрок (batch scoring в таблицу). Выбор определяется «value-of-freshness» — бизнес-метрикой, деградирующей со временем.</p>
<p><b>3. Accuracy vs Latency:</b> ensembles и LLM больше = дольше. Техники снижения: <b>model distillation</b> (маленькая модель имитирует большую через KL-divergence loss <code>L = KL(p_teacher ‖ p_student)</code>), <b>early-exit networks</b> (выходим из сети раньше при уверенном предсказании), <b>speculative decoding</b> для LLM.</p>
<p><b>Почему OCI/Docker:</b> модель + Python-зависимости + CUDA-версия + weights = «environment», который нужно воспроизводимо запускать. Контейнер — это <i>immutable artifact</i> с хешем. Без него «это работало на моей машине» превращается в production-инциденты.</p>
<p><b>Protocol choice:</b> REST/JSON удобен, но JSON-сериализация добавляет 1–5 ms overhead. gRPC + Protobuf — бинарный, streaming, схема контрактна. Triton использует HTTP + gRPC параллельно. Для LLM — OpenAI-compatible API стал де-факто стандартом, так что streaming (SSE) критичен.</p>`,

  'Оркестрация ML-пайплайнов': `
<h4>Теория: пайплайн как DAG с семантикой</h4>
<p>ML-пайплайн — это <b>направленный ациклический граф (DAG)</b>, где вершины — идемпотентные операции, рёбра — артефакты (не потоки данных в реальном времени, как в Kafka, а материализованные объекты). Формально это близко к <b>build systems</b> (Bazel, Make) с дополнительными требованиями: сильная типизация артефактов, кеш на content-hash, versioned inputs.</p>
<p><b>Idempotency principle:</b> операция <code>f</code> идемпотентна если <code>f(x) == f(f(x))</code>. Для pipeline-стадии это означает: повторный запуск с теми же входами даёт тот же результат. Это фундамент для retry, caching и reproducibility. Flyte возводит это в принцип через <b>content-addressed caching</b>: хеш inputs → хеш outputs, повторные runs пропускают уже вычисленное.</p>
<p><b>Schema evolution:</b> типизированные артефакты решают проблему «silent breakage» — когда upstream поменял формат, а downstream тихо потребляет мусор. Flyte/TFX используют строгие протоколы (Protobuf/Arrow), Airflow — XCom, где типизация на совести разработчика.</p>
<p><b>Scheduling-теория:</b> DAG-scheduler решает три задачи — (1) топологическая сортировка для определения порядка, (2) critical path analysis для минимизации makespan, (3) resource-aware placement. Классическая задача <b>minimum makespan on m machines</b> NP-hard даже для деревьев зависимостей, поэтому все планировщики — эвристики. Argo Workflows использует priority queue, Flyte — Kubernetes-native scheduler с pluggable policy.</p>
<p><b>Trigger semantics:</b> различие между <b>time-based</b> (cron), <b>event-based</b> (S3 put), <b>condition-based</b> (drift detected) — это семантика автоматики уровня <b>event-sourced system</b>. Pipeline run становится реакцией на событие в шине. Отсюда требование к идемпотентности — одно событие может быть обработано несколько раз.</p>`,

  'Experiment Tracking': `
<h4>Теория: воспроизводимость как математическое свойство</h4>
<p>Воспроизводимость модели требует, чтобы функция <code>train: (code, data, hyperparams, seed) → model</code> была <b>детерминированной</b>. В ML это нетривиально:</p>
<ul>
<li><b>Недетерминизм на GPU:</b> параллельная сумма с плавающей запятой не коммутативна, cuBLAS использует разные алгоритмы в разных запусках. Решение — <code>torch.use_deterministic_algorithms(True)</code>, но ценой 1.2–2× замедления.</li>
<li><b>Random seed propagation:</b> нужно зафиксировать numpy, torch, python, CUDA, DataLoader worker seeds. Забыли один — потеряли воспроизводимость.</li>
<li><b>Data order:</b> shuffle с seed → детерминирован. Но distributed training с dynamic batching — нет.</li>
</ul>
<p><b>Experiment как triple:</b> <code>(inputs, procedure, outputs)</code>. Если любая часть не заfixирована — experiment не tracking'уется, а просто логируется. MLflow/W&amp;B — это append-only журнал этих triple'ов.</p>
<p><b>Model Registry как state machine:</b> версия модели проходит между состояниями {None → Staging → Production → Archived} через transitions с audit trail. Это классический <b>finite state automaton</b>. Transitions сопровождаются side-effects: обновление deployment'а, метаданных в database, уведомления. Правильная реализация — event-driven architecture (MLflow publishes на webhook → ArgoCD reconcile'ит deployment).</p>
<p><b>Почему не git:</b> git оптимизирован под текстовые дифы. Модель — бинарник размером от мегабайт до гигабайт. Git LFS помогает с размером, но не решает семантики versioning'а (какая модель «production», какая «champion»). Registry даёт эти concept'ы first-class.</p>
<p><b>Connection to MLflow Lineage:</b> каждая модель должна иметь ссылку на code commit, data version, training run. Это образует DAG lineage'а — аналог <b>data provenance</b> из databases. При расследовании продакшен-инцидента (модель выдаёт bias) нужно пройти этот DAG до data source.</p>`,

  'Жизненный цикл ML': `
<h4>Теория: почему ML-lifecycle ЗАМКНУТ</h4>
<p>Классический software lifecycle — линейный: requirements → design → implementation → maintenance. ML-lifecycle <b>замкнут</b>: мониторинг постоянно порождает новые требования через три феномена.</p>
<p><b>1. Concept drift (Tsymbal, 2004):</b> распределение p(y|x) меняется со временем. Пример: после COVID связь «время на сайте → конверсия» изменилась. Математически это non-stationary stochastic process; стационарное допущение (fundamental для statistical learning theory) нарушается. Модель, даже «правильная», деградирует по закону <code>accuracy(t) = accuracy(0) − α·t</code> или быстрее.</p>
<p><b>2. Data drift:</b> распределение p(x) меняется. Формально — <b>covariate shift</b>. Измеряется через:</p>
<ul>
<li><b>PSI (Population Stability Index):</b> <code>PSI = Σ(p_new − p_base)·ln(p_new/p_base)</code>. PSI &lt; 0.1 — OK, 0.1–0.25 — warning, &gt; 0.25 — major shift.</li>
<li><b>KL-divergence:</b> <code>D_KL(P‖Q) = Σ p_i log(p_i/q_i)</code>. Несимметричная — важно направление.</li>
<li><b>Wasserstein distance (Earth Mover's):</b> геометрическое расстояние между распределениями, устойчиво к разреженным зонам.</li>
</ul>
<p><b>3. Label drift:</b> распределение p(y) меняется. Часто — самое опасное, т.к. модель всё ещё «выдаёт правильные» предсказания для входов, но пропорции классов смещаются.</p>
<p><b>Обратная связь:</b> в некоторых задачах модель сама меняет распределение. Recsys показывает то, что считает релевантным → пользователи кликают → retrain на этих кликах → self-reinforcing bias. Это <b>feedback loops</b> (Sculley, «Hidden Technical Debt in ML», 2015) — главное различие ML от классического software: нельзя рассматривать модель как изолированный компонент.</p>
<p><b>Теоретический следствие:</b> CT (Continuous Training) — это не optimization, а <b>necessity</b>. Модель без переобучения деградирует со скоростью, зависящей от velocity of distribution shift в домене. Есть домены (кредитный скоринг, anti-fraud), где drift идёт месяцами; и домены (рекомендации, ad bidding), где drift идёт часами.</p>`,

  'Multi-region GPU training': `
<h4>Теория distributed training и communication primitives</h4>
<p>Параллельное обучение нейросети сводится к операции <b>all-reduce</b> градиентов: каждая реплика посчитала свой ∂L/∂W, нужно получить среднее на всех репликах. Два классических алгоритма:</p>
<ul>
<li><b>Ring all-reduce (Baidu, 2017):</b> N реплик образуют кольцо, градиент делится на N частей, за 2(N−1) шагов каждый узел получает полную сумму. Bandwidth-optimal: <code>2(N−1)/N · M ≈ 2M</code> данных передаётся на каждый узел.</li>
<li><b>Tree all-reduce:</b> логарифмическая глубина, но хуже по bandwidth. Лучше для latency-bound небольших тензоров.</li>
</ul>
<p><b>Почему cross-region тренировка проблематична:</b> all-reduce требует, чтобы все реплики синхронно добирались до collective call. Latency между регионами (20–200 ms) × число итераций (миллионы) = часы-сутки простоя. Решения:</p>
<ul>
<li><b>Hierarchical all-reduce:</b> внутри региона — ring, между регионами — async. Compromise с eventual consistency.</li>
<li><b>Local SGD / Slow momentum:</b> реплики локально делают K шагов, потом усредняются. Теория показывает (Lin et al., 2020), что это сходится к тому же optimum'у при правильных K и learning rate.</li>
<li><b>Parameter Server:</b> центральный узел хранит weights, workers пушат gradients. Устарел для LLM из-за bottleneck, но возвращается для Mixture-of-Experts.</li>
</ul>
<p><b>Теория fault-tolerance:</b> при P реплик и failure rate λ per replica, probability хотя бы одной неудачи за время T ≈ <code>1 − e^(−PλT)</code>. Для P = 1024 GPU и 1% daily failure rate за 1 день вероятность поломки ~100%. Отсюда обязательное checkpointing + elastic training (restart с меньшим world_size).</p>
<p><b>Memory math для больших моделей:</b> для модели с N параметров в bf16 нужно <code>16N</code> байт (веса) + <code>16N</code> (gradients) + <code>32N × 2</code> (Adam states: momentum + variance, fp32) = <b>96N байт</b>. Для 70B модели это 6.7 TB — невозможно на одной GPU. ZeRO-3 / FSDP шардят этот footprint между N устройств, каждое держит 96N/M байт, но нужна inter-device коммуникация для forward и backward.</p>`,

  'Что такое Feature Store': `
<h4>Теория: training-serving skew как математическое явление</h4>
<p>Основная гипотеза ML — <b>i.i.d.</b>: train и test семплы из одного распределения. При serving это нарушается двумя способами:</p>
<p><b>1. Temporal leakage:</b> при training для label в момент T использовались фичи, доступные только после T. В production таких фичей нет → модель работает хуже, чем в offline-тестах. Feature Store решает через <b>point-in-time correctness</b>: для каждого (entity, event_ts) отдаёт фичу по состоянию на event_ts, а не «последнее значение». Это реализуется как <b>as-of join</b> — SQL операция над временными рядами.</p>
<p><b>2. Code skew:</b> фичу считает ETL на Spark при training, а при serving — Python/Java-код в микросервисе. Результаты чуть-чуть разные (разные округления, разная обработка edge cases). Feature Store решает через <b>single feature definition</b>, материализуемое в оба store: offline-расчёт и online-lookup используют <i>один</i> контракт.</p>
<p><b>Формальная модель:</b> Feature Store — это пара функций <code>materialize_offline(source, from, to) → snapshot</code> и <code>lookup_online(entity, features) → values</code>, связанных инвариантом: для любого entity в любой момент t значения, которые видит online, eventually консистентны с значениями в offline для тех же t.</p>
<p><b>Почему это нужно именно Feature Store, а не просто warehouse:</b> warehouse оптимизирован под аналитические запросы (columnar scan на миллиарды строк). Online lookup требует latency &lt; 10 ms по ключу — для этого нужна in-memory key-value база. Feature Store — это abstraction layer, синхронизирующий оба.</p>
<p><b>Связь с CAP-теоремой:</b> online-store жертвует consistency в пользу availability и partition tolerance. Отсюда eventual consistency между offline (истина) и online (последний known snapshot). Feature Store делает это различие явным и управляемым.</p>
<p><b>Когда Feature Store не нужен:</b> если у вас одна модель и одна команда — overhead архитектуры не окупается. Закон Конвея: структура системы отражает структуру организации. Feature Store имеет смысл, когда features <b>пересекаются между командами</b> — он становится organizational contract, а не только техническим артефактом.</p>`,

  'Версионирование данных в ML': `
<h4>Теория: почему код-версионирование не подходит для данных</h4>
<p>Git оптимизирован под text diff: хранит snapshots + дельты через zlib-сжатие. Для бинарных данных размером гигабайты это ломается: один коммит — один blob, без дельт. Репозиторий разрастается экспоненциально.</p>
<p><b>Content-addressable storage:</b> DVC и lakeFS используют SHA-256 hash файла как «адрес». Идентичные файлы хранятся один раз (deduplication). Это та же идея, что в Git, но применённая к внешнему object store. Формально — <b>Merkle DAG</b>: каждый объект ссылается на child'ов через их hash'и, любое изменение propagates в hash корня.</p>
<p><b>Copy-on-write (lakeFS):</b> branch в lakeFS не копирует данные — создаёт метаданные, ссылающиеся на те же blobs. Изменения в ветке пишут новые blobs, старые остаются у main. Это классический <b>persistent data structure</b> из функционального программирования, применённый к petabyte-scale object store. Аналог — btrfs, ZFS snapshots, Git itself.</p>
<p><b>ACID и data versioning:</b> Delta Lake / Iceberg добавляют ACID поверх object store через transaction log (JSON-манифест commit'ов). <b>Optimistic concurrency control</b>: writer atomically appends to log; reader видит snapshot на свой timestamp. Это реализация <b>MVCC</b> (Multi-Version Concurrency Control) из RDBMS, применённая к data lake.</p>
<p><b>Теоретическое следствие — reproducibility:</b> чтобы воспроизвести модель, нужен (code_commit, data_snapshot, hyperparams). Code_commit даёт git, data_snapshot — DVC/lakeFS/Delta через immutable hash или version id. Без data_snapshot'а reproducibility математически невозможна, потому что training — функция двух аргументов, а не одного.</p>
<p><b>Time-travel как first-class operation:</b> <code>SELECT * FROM events VERSION AS OF 'v42'</code> (Delta) или <code>lakectl diff repo@v1..v2</code> (lakeFS). Это <b>bi-temporal модель</b> из temporal databases: каждая запись имеет valid_time (когда факт произошёл) и transaction_time (когда записан). Для audit, compliance, debug'а — критично.</p>`,

  'Continuous Training': `
<h4>Теория: CT как control system</h4>
<p>Continuous Training — это <b>замкнутый контур управления</b> с обратной связью, формально описываемый как control system из классической теории автоматического управления.</p>
<p><b>Классическая модель:</b></p>
<ul>
<li><b>Plant:</b> production model + трафик пользователей.</li>
<li><b>Sensor:</b> metrics monitor (accuracy, drift, latency).</li>
<li><b>Setpoint:</b> target SLA (accuracy ≥ 95%, drift PSI &lt; 0.15).</li>
<li><b>Controller:</b> retraining pipeline.</li>
<li><b>Actuator:</b> deployment system (canary/rollout).</li>
</ul>
<p>Разомкнутая система (только scheduled retrain) — <b>open-loop control</b>, не реагирует на реальность. Closed-loop CT — реагирует, но добавляет риск oscillations: слишком агрессивный trigger → постоянные retraining'и → нестабильная модель. Аналогия — <b>PID-controller</b>: P (пропорциональный отклик), I (накопленное отклонение — срабатывает при длительном drift), D (скорость изменения — ловит резкие shifts).</p>
<p><b>Why retraining ≠ optimization:</b> каждый retrain — это bias-variance trade-off заново. Новая модель может быть локально хуже на некоторых сегментах. Поэтому critical guardrails:</p>
<ul>
<li><b>Champion-challenger с margin:</b> новая модель должна быть лучше на ≥ δ, где δ берётся исходя из стат. значимости (обычно 2σ на holdout).</li>
<li><b>Shadow/Canary с статистическим тестом:</b> t-test или Mann-Whitney U между metric распределениями старой и новой версий.</li>
</ul>
<p><b>Connection to online learning:</b> CT — это batch analogue <b>online learning</b>. Online updates веса после каждого семпла (SGD), CT — периодически на накопленном батче. Trade-off: online даёт свежесть, но чувствителен к шуму и adversarial inputs; CT стабильнее, но запаздывает на Δt интервал retrain.</p>
<p><b>Reinforcement learning perspective:</b> если модель влияет на распределение (recsys), CT становится <b>on-policy learning</b> с рисками feedback loops. Формально — non-stationary MDP. Решения — off-policy evaluation (IPS, doubly robust estimators), epsilon-exploration.</p>`,

  'Shadow deployment, canary': `
<h4>Теория: статистическое различие между canary и A/B</h4>
<p>Часто путают, но это разные инструменты с разными математическими основаниями.</p>
<p><b>Canary</b> — это <b>sequential probability ratio test (SPRT)</b>: мы отвечаем на вопрос «стало ли хуже» как можно раньше, останавливаемся при достаточной confidence. Формально:</p>
<ul>
<li>H₀: новая версия не хуже старой.</li>
<li>H₁: новая версия хуже на ≥ δ.</li>
<li>На каждом шаге — likelihood ratio Λ. Если Λ пересекает верхний порог — accept H₀ (continue rollout). Нижний — reject (rollback).</li>
</ul>
<p>SPRT оптимален: в среднем требует минимальное число наблюдений для заданных α, β. Поэтому canary быстро обнаруживает регрессии.</p>
<p><b>A/B test</b> — это <b>fixed-horizon test</b> с заранее выбранной sample size, вычисленной из:</p>
<ul>
<li>Baseline rate p (напр. 5% конверсия).</li>
<li>Minimal detectable effect δ (хотим поймать ≥ 1% relative lift).</li>
<li>α = 0.05 (false positive), β = 0.20 (false negative / power = 80%).</li>
<li>Формула: <code>n ≈ 16 · p(1−p) / δ²</code> на variant.</li>
</ul>
<p>Для δ = 1% и p = 5% выходит ≈ 76 000 на вариант. Отсюда реальные A/B длятся недели — raise power без accumulating миллионов exposures технически нельзя (кроме CUPED и стратификации).</p>
<p><b>Multi-armed bandit (Thompson sampling):</b> вместо fix split — адаптивный. Каждому варианту поддерживаем Beta-distribution над его conversion rate. На каждом запросе — сэмпл из posterior'ов, роутим на max. Теоретически regret-bound ∼ <code>O(√(K·T·logT))</code> — оптимально по Gittins. Минус: теряется clean A/B statistic, сложнее для научного анализа.</p>
<p><b>Shadow deployment</b> — это <b>observational comparison</b>, не experiment. Нет randomization → нельзя claim causality. Но полезен для operational metrics (latency, errors) и для prediction distribution — где randomization не нужна.</p>
<p><b>Interference and leakage:</b> в социальных продуктах (feed, messaging) пользователи в A и B влияют друг на друга (network effects). Classical A/B недооценивает effect. Решения: <b>cluster randomization</b> по сообществам, <b>switchback design</b> (по времени), synthetic control.</p>`,

  'Distributed training: DDP': `
<h4>Теория: математика параллелизации SGD</h4>
<p>SGD обновляет <code>w_{t+1} = w_t − η·∇L(w_t, B_t)</code>. Параллелизация бывает четырёх типов с разной математикой.</p>
<p><b>Data parallelism:</b> батч размера B делится на K реплик по B/K. Градиенты усредняются: <code>∇L = (1/K) Σ ∇L_k</code>. Математически это <b>та же самая</b> оптимизация (несмещённая оценка градиента), только параллельная. Но effective batch size = B → нужно scale learning rate: <b>linear scaling rule</b> η ∝ B (Goyal et al., 2017). На большом B стабильность требует warmup, LARS/LAMB оптимизаторы.</p>
<p><b>ZeRO / FSDP (Rajbhandari, 2020):</b> наблюдение — DDP хранит полную копию оптимизатора на КАЖДОЙ реплике, это waste. ZeRO-3 шардит параметры W, градиенты G, optimizer states M по K GPU. Каждая держит <code>W/K + G/K + M/K</code>. Но для forward нужно all-gather W → временно собираем полные веса слоя, считаем, сбрасываем. Communication volume растёт, memory падает в K раз.</p>
<p><b>Tensor Parallel (Megatron-LM):</b> матричное умножение <code>Y = XW</code> для W размера [d × 4d] разбивается по выходной размерности: <code>W = [W₁ | W₂ | ... | W_K]</code>. Каждая GPU считает <code>Y_k = X·W_k</code>, потом concat. Alternative — разбить по входной: нужно all-reduce вместо concat. Megatron комбинирует оба: первый слой MLP — column-parallel, второй — row-parallel, между ними — пара all-reduce'ов на attention/MLP блок.</p>
<p><b>Pipeline Parallel:</b> слои модели разбиты по stages (GPU-1: слои 1–10, GPU-2: 11–20, ...). Проблема <b>pipeline bubble</b>: пока GPU-1 делает forward batch 1, GPU-2 простаивает. Решения — <b>GPipe</b> (micro-batch splitting), <b>1F1B</b> (интерлив forward и backward), Interleaved от Megatron (не одна группа слоёв на GPU, а несколько чередующихся).</p>
<p><b>3D parallelism:</b> комбинация TP × PP × DP = total_GPUs. Выбор основан на минимизации communication:</p>
<ul>
<li>TP требует very-fast intra-node (NVLink) — размещают внутри ноды.</li>
<li>PP нужна только for send/recv между stages — ok для slower inter-node.</li>
<li>DP использует all-reduce — может идти по сети.</li>
</ul>
<p><b>Scaling efficiency:</b> <code>strong scaling efficiency = T_1/(N·T_N)</code>. 90%+ — отлично, 70% — допустимо, &lt; 50% — смысла нет. Для LLM на 1000+ GPU достичь &gt; 50% efficiency — инженерный подвиг, требующий RDMA, топологии с низкой diameter'ой (Dragonfly, fat-tree).</p>`,

  'Quantization для LLM': `
<h4>Теория: представление чисел и ошибка квантования</h4>
<p>IEEE 754 float32 имеет 1 знаковый + 8 exponent + 23 mantissa бит. fp16 — 1+5+10. bf16 — 1+8+7 (Brain floating-point от Google). INT8 — просто 8-битное целое.</p>
<p><b>Affine quantization:</b> <code>x_int = round(x_float / scale) + zero_point</code>. Back: <code>x_float ≈ (x_int − zero_point) · scale</code>. Ошибка — uniform в [−scale/2, +scale/2]. Выбор scale определяет trade-off: большой scale покрывает выбросы, но теряет точность на средних значениях.</p>
<p><b>Теоретический error bound:</b> для n-бит квантования с равномерным распределением ошибки MSE пропорциональна <code>2^(−2n)</code>. Значит INT8 → INT4 увеличивает MSE в 256 раз. Почему на практике drop в 2–5%? Потому что нейросети <b>robust к шуму</b> (emergent свойство) и потому что NN-квантование адаптирует scale per-tensor или per-channel.</p>
<p><b>GPTQ (Frantar, 2023):</b> post-training quantization слой за слоем. Для каждого слоя решается задача <b>minimize ‖XW − XW_q‖²</b> через Optimal Brain Quantizer — это hessian-informed greedy. Почему важен Hessian: линейная аппроксимация ошибки — <code>ΔL ≈ ∇L·Δw + 0.5·Δwᵀ H Δw</code>. Для сходящейся модели ∇L ≈ 0, остаётся только квадратичный терм. Квантуем по направлениям малой кривизны H.</p>
<p><b>AWQ (Lin, 2023):</b> наблюдение — 0.1–1% весов «important», удержание их в fp16 сохраняет почти всё качество. AWQ идентифицирует important weights по magnitude <i>activations</i>, не самих weights, и применяет <b>pre-quantization scaling</b> <code>W' = W·s, x' = x/s</code>. Inference математически идентичен, но W' квантуется лучше.</p>
<p><b>Почему именно INT4:</b> H100 имеет нативные INT4 tensor cores с пропускной 4× больше fp16. Ширина memory-bus становится bottleneck для LLM (memory-bound workload), а INT4 даёт 4× эффективной bandwidth. Для compute-bound (prompt processing) выигрыш меньше.</p>
<p><b>Quantization-Aware Training (QAT):</b> fake quantize в forward, straight-through estimator (STE) в backward: <code>∂Q(x)/∂x ≈ 1</code>. Это math-incorrect но работает, потому что quantization — piecewise constant, честный gradient нулевой, STE даёт полезный сигнал. QAT даёт лучшее качество, но стоит полноценного re-training.</p>`,

  'Сравнение vector DB': `
<h4>Теория: Approximate Nearest Neighbor и проклятие размерности</h4>
<p><b>Exact kNN</b> в d-мерном пространстве требует сканировать все N точек → O(Nd) на запрос. Для миллиарда 768-мерных векторов — секунды на один запрос. Неприемлемо.</p>
<p><b>Curse of dimensionality (Beyer, 1999):</b> в высокой размерности расстояния между случайными точками концентрируются: <code>(max − min)/min → 0</code> при d → ∞. Традиционные spatial trees (k-d tree, ball tree) деградируют к брутфорсу при d &gt; 20. Отсюда <b>approximate</b> nearest neighbor (ANN).</p>
<p><b>HNSW (Malkov, 2018):</b> <i>Hierarchical Navigable Small World</i>. Строится многоуровневый граф, где на верхнем уровне — разреженные long-range links, на нижнем — плотные local connections. Поиск: greedy на верхнем уровне, спуск вниз с zoom-in. Основан на теории <b>small-world networks</b> (Watts &amp; Strogatz) — короткие пути при малом числе links. Сложность поиска ≈ <code>O(log N)</code>. Recall@10 = 0.95 при правильных параметрах (M = 32, efConstruction = 400). Минус — RAM-intensive: граф занимает в 2–4× больше памяти, чем сами векторы.</p>
<p><b>IVF (Inverted File Index, FAISS):</b> k-means на N точек → K кластеров. Запрос: находим nprobe ближайших кластеров, сканируем только их. Сложность <code>O(Nd/K · nprobe/K)</code>. Менее точный, чем HNSW, но меньше памяти. Хорош при N &gt; 100M.</p>
<p><b>Product Quantization (PQ):</b> вектор d-мерный делится на m подвекторов по d/m измерений. Каждый подвектор квантуется отдельно в 256 кодов (8 бит). Вектор → m байт. 768-мерный fp32 (3 КБ) → 96 байт при m=96. Сжатие 32× ценой точности. ScaNN и Milvus DiskANN используют PQ с reranking на full precision.</p>
<p><b>Hybrid search — sparse + dense:</b> BM25 (tf-idf вариант) ловит lexical matches, dense embeddings — semantic. Комбинация через <b>Reciprocal Rank Fusion</b>: <code>score(d) = Σ_q 1/(k + rank_q(d))</code>. RRF устойчивее линейной комбинации (не надо настраивать веса).</p>
<p><b>Почему embedding модель важнее vector DB:</b> recall ANN-движка ≈ 95%, но качество embedding определяет <i>какие</i> документы считаются близкими. Современные embeddings — bi-encoder'ы (sentence-transformers, E5, BGE) и cross-encoder'ы для rerank. Cross-encoder точнее, но слишком медленный для первого retrieval'а — отсюда two-stage pipeline: bi-encoder + rerank.</p>`,

  'LLMOps vs MLOps': `
<h4>Теория: почему LLM сломали классический MLOps</h4>
<p>MLOps строился на трёх допущениях: <b>(1)</b> модель обучается на собственных данных; <b>(2)</b> артефакт ограниченного размера; <b>(3)</b> поведение предсказуемо на validation set. LLM нарушает все три.</p>
<p><b>Допущение (1):</b> тренировка GPT-4 / Claude / Llama-405 — десятки миллионов долларов, terabytes данных. 99% команд не тренируют — они <b>потребляют</b>. Значит «Artifact = prompt + few-shot + retrieval index», не «model weights». Это сдвиг парадигмы: конфигурация важнее кода.</p>
<p><b>Допущение (2):</b> модель 405B параметров весит 800 ГБ fp16. Её нельзя просто «хранить в registry» — нужна <b>distributed inference</b>, KV-cache management, speculative decoding. Инфра-часть раздувается до размеров классической platform engineering.</p>
<p><b>Допущение (3):</b> LLM <b>stochastic</b>: temperature &gt; 0 → разные ответы. Non-determinism требует совершенно иной evaluation: vs ground truth перестаёт работать (правильных ответов много). Переходят к <b>LLM-as-judge</b> с rubric'ами, RAGAS metrics, human eval с inter-rater agreement (Cohen's kappa).</p>
<p><b>Новая ось: cost per query.</b> Классическое ML: deployment стоимости fixed (инстансы), inference marginal cost ≈ 0. LLM: каждый запрос = X USD (tokens). Это переводит модель из CAPEX в OPEX — меняется финансовое планирование, появляется concept <b>FinOps for LLM</b>: hard limits per tenant, cost-based routing, semantic cache как бюджетная оптимизация.</p>
<p><b>Новые риски:</b></p>
<ul>
<li><b>Prompt injection:</b> неразличимость данных и кода в LLM — CWE-класс, не существовавший до LLM. Классическое input sanitization не помогает.</li>
<li><b>Hallucinations:</b> model confidently выдаёт неверное. Калибровка confidence в LLM плохая — logprobs не отражают truthfulness.</li>
<li><b>Drift смысла (semantic drift):</b> модель поменяли с gpt-4 на gpt-4o → ответы чуть другие, downstream ломается. Нужен version pinning и semantic regression tests.</li>
</ul>
<p><b>Organizational impact:</b> LLMOps размывает границу между product и engineering. Prompt — это код (логика), но его может менять PM без PR-review. Отсюда нужны <b>prompt versioning</b>, A/B на промпт-уровне, review процессы для критичных шаблонов.</p>`,

  'Fine-tuning vs RAG vs Prompt': `
<h4>Теория: что чему учится</h4>
<p>Каждый метод воздействует на разные компоненты LLM-системы. Понимание этого — ключ к выбору.</p>
<p><b>Prompt Engineering</b> работает с <b>context window</b>. Веса не меняются. Теоретически — это <i>in-context learning</i> (ICL, Brown et al., 2020): few-shot примеры в промпте — это «обучение по одной эпохе» через attention. Статья Anthropic показала, что ICL аппроксимирует градиентный спуск в некоторых архитектурах (Akyurek, 2023). Слабость: context window limited (200K–2M токенов), каждый запрос платит за них.</p>
<p><b>RAG</b> расширяет context dynamically. Формально модель делает <code>p(y | query) = Σ_d p(d | query) · p(y | query, d)</code>, где d — retrieved document. Decomposition позволяет LLM не «знать факты», а уметь <i>использовать</i> их. Теоретически — это <b>memory-augmented neural network</b> (Graves, 2014), с внешней key-value памятью.</p>
<p><b>Fine-tuning</b> меняет веса. Полный fine-tuning для 70B модели требует train-time memory ~1.5 ТБ — нецелесообразно. Отсюда <b>LoRA</b> (Hu, 2021): гипотеза о <i>low intrinsic dimension</i> updates — ΔW низкого ранга. Заменяем <code>W + ΔW</code> на <code>W + BA</code>, где B ∈ ℝ^(d×r), A ∈ ℝ^(r×k), r ≪ d. Для r = 8 и d = 4096 экономия в 500× параметров. Train only B, A, freeze W. QLoRA — то же, но base model в NF4 quantization.</p>
<p><b>Что изменяется:</b></p>
<ul>
<li><b>Prompt:</b> поверхностное поведение, стиль «для этого запроса».</li>
<li><b>RAG:</b> знания модели расширены retrieved documents.</li>
<li><b>LoRA/SFT:</b> смещение поведения модели — формат вывода, доменный стиль, instruction following.</li>
<li><b>RLHF/DPO:</b> alignment с human preferences. DPO (Rafailov, 2023) — direct optimization через Bradley-Terry model: <code>p(y_w ≻ y_l) = σ(r(y_w) − r(y_l))</code>. Не требует reward model.</li>
</ul>
<p><b>Когда fine-tuning провоцирует забывание (catastrophic forgetting):</b> update W на новом домене ломает общие знания. LoRA смягчает — основные веса не меняются, только LoRA-adapters. Отсюда популярность <b>multi-LoRA</b>: базовая модель + переключаемые adapters для разных задач.</p>
<p><b>Decision rule (theoretic):</b></p>
<ul>
<li>Знания меняются часто или индивидуальны per-user → <b>RAG</b>.</li>
<li>Формат/стиль консистентный во всех запросах → <b>Fine-tuning</b> (дешевле по токенам).</li>
<li>Обе нужны → combine (RAG + fine-tuned base).</li>
<li>Задача простая, inference cost критичен → distill large LLM в small fine-tuned.</li>
</ul>`,

  'Безопасность LLM': `
<h4>Теория: почему LLM — принципиально новая attack surface</h4>
<p>Классическая security-модель опирается на <b>code/data isolation</b>: user input — данные, code — логика. LLM стирают границу: промпт — это одновременно инструкция для модели и данные пользователя. Формально это <b>confused deputy problem</b> (Hardy, 1988) на новом уровне: модель выполняет волю atacker'а, думая, что выполняет волю developer'а.</p>
<p><b>Prompt Injection как вариант SQL injection:</b> в обоих случаях — неразделение команд и данных. Но для SQL помогло parametrized queries (строгое разделение через protocol). Для LLM аналогичного <i>нет</i>: модель принимает единый входной поток токенов, где инструкции и данные семантически неразличимы.</p>
<p><b>Indirect prompt injection (Greshake, 2023):</b> атакующий не имеет прямого доступа к LLM, но размещает malicious text в документах, которые LLM прочтёт через RAG или web browsing. Это <b>transitive trust</b>: LLM считает документ данными, а атакующий — каналом инструкций. Нет известного defense, работающего универсально; только defense-in-depth.</p>
<p><b>Theoretical bounds на detection:</b> попытки обучить classifier prompt injection наталкиваются на <b>Rice's theorem analog</b>: невозможно detectнуть «инструкция ли это» в общем случае, т.к. любой текст может быть инструкцией в правильном контексте. Defense — структурная: ограничение capabilities, не полная filtering.</p>
<p><b>Adversarial examples через gradient access:</b> если attacker знает веса модели (open-source LLM), возможны <b>jailbreaks через адверсарные суффиксы</b> (GCG, Zou 2023): градиентный поиск токенов, которые bypass safety training. Эти суффиксы часто переносятся между моделями (transferability), что делает open-source LLM-defense особенно сложной.</p>
<p><b>Output guardrails как post-hoc correction:</b> теоретически правильнее делать safety на уровне training (RLHF с safety rewards), но на практике нужен runtime filter. Это <b>ambulance services</b>: ломается — лечим. Безопаснее combining: (1) alignment в обучении, (2) guardrails на вход/выход, (3) capability restrictions (least privilege для tools).</p>
<p><b>Principle of least agency (Greshake, 2023):</b> LLM-агенту дают минимально необходимые tools. Если агент может <code>read_file</code> — не даём <code>delete_file</code>. Это классическое least privilege, но особенно важно, потому что агент может вызвать tool <b>по инструкциям из данных</b>.</p>
<p><b>Model theft и distillation attacks:</b> через query access можно обучить student-модель, имитирующую production-модель. Теоретически защита — query rate limiting + query diversity monitoring + digital watermarking output'ов (статистически необычное распределение tokens).</p>`,

  'LLM Evaluation': `
<h4>Теория: что измерять при отсутствии ground truth</h4>
<p>Классический supervised learning: есть y_true, считаем метрику (accuracy, F1). LLM-output — это text без единственного правильного ответа. Это проблема <b>structured prediction evaluation</b>, давно известная в machine translation и summarization.</p>
<p><b>Reference-based metrics (old):</b></p>
<ul>
<li><b>BLEU (Papineni, 2002):</b> n-gram overlap с reference. Не коррелирует с качеством для creative tasks.</li>
<li><b>ROUGE:</b> recall-вариант BLEU. Аналогичные проблемы.</li>
<li><b>BERTScore:</b> cosine similarity между BERT-embeddings предсказания и reference. Лучше, но зависит от качества embedding.</li>
</ul>
<p><b>LLM-as-judge (Zheng, 2023):</b> сильная LLM оценивает ответ слабой по rubric. Эмпирически — корреляция с human judgment 70–85% (как inter-rater agreement у людей). Риски:</p>
<ul>
<li><b>Position bias:</b> в pairwise evaluation judge предпочитает первый вариант. Мitigate — random swap.</li>
<li><b>Length bias:</b> judge награждает длинные ответы.</li>
<li><b>Self-bias:</b> judge-модель предпочитает свой стиль.</li>
</ul>
<p><b>Calibration of judges:</b> на golden-set с human labels считаем agreement через <b>Cohen's kappa</b>: <code>κ = (p_o − p_e) / (1 − p_e)</code>. κ &gt; 0.6 — substantial, &gt; 0.8 — almost perfect. Если judge даёт κ &lt; 0.5 с human — он не лучше coin-flip'а, нужен другой judge или human-only eval.</p>
<p><b>RAG evaluation (RAGAS):</b> специальные reference-free metrics:</p>
<ul>
<li><b>Faithfulness:</b> фиксируем утверждения в ответе, проверяем entailment с retrieved context. Если утверждение не следует из context — hallucination.</li>
<li><b>Answer relevance:</b> генерируем вопросы из ответа, сравниваем с исходным вопросом cosine.</li>
<li><b>Context precision:</b> доля полезных chunks в retrieved set.</li>
</ul>
<p><b>Bootstrap confidence intervals:</b> для малых eval sets (50–500 примеров) точечные метрики шумные. Bootstrap resample'им eval set N = 1000 раз, считаем metric, берём 2.5/97.5 перцентили. Если CI двух моделей overlap'ятся — различие не значимо.</p>
<p><b>Statistical significance в pairwise comparison:</b> H₀ — модели равны, H₁ — A лучше B. Используем <b>paired bootstrap</b> или <b>McNemar's test</b> на discordant pairs. Для &gt; 2 моделей — Friedman test + post-hoc Nemenyi.</p>
<p><b>Overfitting на eval set:</b> если итеративно улучшаешь промпт «пока eval score растёт» — переобучаешься на eval set. Правильный подход: держать <b>blind test set</b>, к которому обращаешься только финально. MLflow и Langfuse поддерживают split eval / validation / test.</p>`,

  'Оптимизация стоимости LLM': `
<h4>Теория: что двигает стоимость inference</h4>
<p>Стоимость LLM inference = <code>tokens × price_per_token</code>. Разбираем, из чего складывается и где давить.</p>
<p><b>Tokenization математика:</b> модель не видит символы, она видит tokens (через BPE или SentencePiece). Для английского 1 токен ≈ 4 символа, для русского — 2–3 (кириллица дороже). Input-токены обычно в 2–5× дешевле output-токенов (у OpenAI/Anthropic), потому что prefill параллелизируется, а decoding — sequential.</p>
<p><b>Autoregressive decoding — sequential bottleneck:</b> каждый новый токен требует полного forward pass модели через все N токенов prefix'а. Complexity — <b>O(n²d)</b> для attention. Memory-bound: transformer для decoding большой LLM упирается не в compute, а в HBM bandwidth (читаем KV-cache каждый шаг).</p>
<p><b>KV-cache как доминирующая память:</b> размер cache <code>= 2 · L · H · d · n · bytes</code>, где L — слои, H — heads, d — head_dim, n — длина контекста. Для Llama-70B и 8K контекста — 2.5 ГБ на одного пользователя. Concurrent users × context → quadratic memory growth. Отсюда PagedAttention (vLLM) — аналог ОС-памяти с paging, позволяет fragmentation управлять.</p>
<p><b>Prompt caching — amortization fixed cost:</b> system prompt типично 500–5000 токенов, не меняется. Если каждый запрос его пересчитывает — waste. Prompt cache хранит KV-cache статической части, новый запрос переиспользует. Экономия ≈ 90% на кешированных токенах. Математически: если доля prefix'а — α от суммы, а cache-hit rate — β, экономия <code>α · β · cache_discount</code>. Для α = 0.8, β = 0.9, discount = 0.9 — экономия 65%.</p>
<p><b>Semantic cache — gambling on similarity:</b> если запрос «похож» на прежний — return сохранённый ответ. Risk — false positives: «Что такое TLS?» и «Что такое SSL?» семантически близки, но ответы должны различаться. Threshold similarity должен быть high (0.95+). Типичный hit rate 20–40% для support-ботов, 0–5% для creative.</p>
<p><b>Model routing — multi-armed choice:</b> простые запросы — на дешёвую модель (Haiku), сложные — на дорогую (Opus). Классификатор <code>cost(x) × P(answer OK)</code> оптимизируется. На практике уменьшает средний cost в 3–10× при &lt; 5% деградации качества. Реализуется через LLM-гейтвэй (LiteLLM, Portkey) с custom router'ом.</p>
<p><b>Speculative decoding:</b> маленькая «draft» модель предлагает K токенов, большая проверяет их одним forward pass'ом. Если все K приняты — ускорение ~K×. Математически — importance sampling из draft distribution с rejection. Теоретически (Leviathan, 2023) даёт 2–3× speedup при незначительной loss.</p>
<p><b>Distillation:</b> обучить маленькую модель имитировать большую. Loss — KL-divergence между распределениями: <code>L = Σ T · KL(soft(y_t/T) ‖ soft(y_s/T))</code>. Temperature T (Hinton, 2015) smooths target distribution, передаёт «dark knowledge» — информацию о всех классах, не только argmax. Хорошо работает на narrow domain: 7B модель может заменить 70B, если задача ограничена.</p>`,

  'Data Validation для ML': `
<h4>Теория: данные как нестрогий контракт</h4>
<p>Классический software: контракт (API schema, types) задан жёстко, compiler проверяет. Данные: статистические свойства, контракт вероятностный. Отсюда нужна <i>statistical data validation</i>, а не только schema validation.</p>
<p><b>Schema validation vs distribution validation:</b></p>
<ul>
<li><b>Schema:</b> деtermин — типы, nullability, range. Нарушение → точно bug.</li>
<li><b>Distribution:</b> вероятность — «mean колонки age должно быть в [32, 38]». Нарушение → подозрение, не уверенность. False positive rate ≠ 0.</li>
</ul>
<p><b>Multiple testing problem:</b> если проверяем 1000 expectations, при α = 0.05 ожидаем 50 false alarms только от шума. Решение — <b>Bonferroni correction</b> (α/n) или <b>False Discovery Rate control</b> (Benjamini-Hochberg). Great Expectations не делает это из коробки — ответственность на пользователе.</p>
<p><b>Schema inference vs manual:</b> автоматическое выведение schema из reference dataset — trade-off: пропустим edge cases, зато schema всегда актуальна. TFDV использует statistical heuristics (top-K unique values, quantiles). Manual — точнее, но требует владельца данных.</p>
<p><b>Contract-driven design:</b> data contract — это формальное API между data producer и consumer. Producer гарантирует (schema + SLI типа freshness &lt; 1 hour), consumer полагается. Это <b>extension of Postel's law</b> (be conservative in what you send) в данные.</p>
<p><b>Data quality dimensions (DAMA):</b></p>
<ul>
<li><b>Completeness</b> — missing rate.</li>
<li><b>Uniqueness</b> — duplicate rate.</li>
<li><b>Validity</b> — schema/business rules compliance.</li>
<li><b>Consistency</b> — одинаковые данные в разных местах.</li>
<li><b>Accuracy</b> — соответствие реальности (нельзя проверить без источника правды).</li>
<li><b>Timeliness</b> — freshness.</li>
</ul>
<p><b>Great Expectations как DSL:</b> expectation — декларативное утверждение, которое может быть (a) проверено, (b) задокументировано, (c) visualizedа. Это <b>functional programming for data</b>: чистые функции validation, композируемые через expectation suites.</p>
<p><b>Validation vs drift — разные инструменты:</b> validation работает с <i>static</i> rules, нарушение → fail pipeline. Drift — <i>temporal</i> comparison train vs production, нарушение → retrain, не fail. Путать их опасно: alert fatigue от drift-as-validation заставляет команду игнорировать реальные schema breaks.</p>
<p><b>Connection to testing pyramid:</b> classical testing — unit/integration/e2e. Data testing — свои уровни: raw ingestion tests, transformation tests, output contract tests. Каждый слой проверяет свой контракт, aналогично software testing pyramid.</p>`,

  'Serving comparison: KServe': `
<h4>Теория: эволюция model serving — от Python Flask до inference platform</h4>
<p>История model serving в три эпохи.</p>
<p><b>Эпоха 1 (2015–2018): Flask + pickle.</b> DS упаковывал модель в pickle, вокруг — Flask-эндпоинт. Проблемы: thread safety (Python GIL), no batching, no versioning, single model per service.</p>
<p><b>Эпоха 2 (2018–2021): dedicated model servers.</b> TensorFlow Serving, TorchServe, Triton. Решают <b>dynamic batching</b>: запросы группируются в батч (timeout-based или size-based), один forward pass обрабатывает несколько клиентов. Математически — amortization fixed cost kernel launch по batch.</p>
<p><b>Эпоха 3 (2021+): inference platforms.</b> KServe, Seldon. Model serving становится <b>platform concern</b>: autoscaling, canary, multi-model graphs, explainability — как first-class primitives.</p>
<p><b>Ключевая абстракция KServe — InferenceService CRD:</b> declarative описание «предсказательной функции» с pre-processing (Transformer) → prediction (Predictor) → post-processing. Это <b>pipeline as resource</b>, reconciled kubernetes controller'ом. Knative под капотом даёт scale-to-zero через activator + autoscaler.</p>
<p><b>Scale-to-zero math:</b> cold start penalty — model load + CUDA init может занять 30–120 сек для LLM. Нужен <b>keep-warm strategy</b> (minReplicas = 1) для latency-critical, или <b>scale-to-zero</b> только для редкого трафика. Break-even: при threshold trafic λ* инстанс окупает себя vs idle cost. λ* = cost_per_hour / (cost_per_request × 3600).</p>
<p><b>Seldon inference graphs — computation as DAG:</b> A/B router → model A | model B → combiner. Явное представление позволяет <b>inject observability</b> между стадий: shadow сравнение, explainer, drift detector. Theoretical advantage: pattern можно менять без изменения моделей.</p>
<p><b>Triton — performance-first:</b> backend-agnostic архитектура через C++ API. Ключ — <b>concurrent model execution</b>: несколько инстансов модели на одной GPU через CUDA streams. Для inference-bound workload даёт 1.5–3× throughput.</p>
<p><b>BentoML — developer-experience-first:</b> Python SDK с декораторами, OCI build. Модель в dev = модель в prod (same artifact). Trade-off: меньше knobs для перформанс-оптимизации, но быстрее time-to-production.</p>
<p><b>vLLM — LLM-specific innovation:</b> три ключевых trick'а — PagedAttention (память KV-cache как paged virtual memory), continuous batching (сборка batch'а на лету без wait), prefix caching. Даёт 3–10× throughput vs naive HF pipeline.</p>
<p><b>Выбор как decision tree:</b></p>
<ul>
<li>Нужен classical ML (sklearn, XGBoost) с autoscale → KServe.</li>
<li>Нужен LLM с max throughput → vLLM в KServe/standalone.</li>
<li>Нужен сложный ensemble/A-B pipeline → Seldon.</li>
<li>DS-команда, быстрый dev→prod → BentoML.</li>
<li>Max performance на one GPU → Triton (вложено в KServe).</li>
</ul>`,

  'Model Explainability в production': `
<h4>Теория: Shapley values и аксиомы fair attribution</h4>
<p>SHAP (SHapley Additive exPlanations) — не случайная эвристика, а единственный метод, удовлетворяющий четырём аксиомам fair attribution (Shapley, 1953):</p>
<ul>
<li><b>Efficiency:</b> сумма атрибуций = предсказание − baseline.</li>
<li><b>Symmetry:</b> равные по вкладу фичи получают равный credit.</li>
<li><b>Dummy:</b> фича без влияния получает 0.</li>
<li><b>Additivity:</b> линейность для ансамблей.</li>
</ul>
<p>Формула Shapley: <code>φᵢ = Σ_{S⊆F∖{i}} (|S|!(|F|−|S|−1)!/|F|!) · (f(S ∪ {i}) − f(S))</code>. Это ожидаемый marginal contribution фичи i по всем порядкам. Exponential в числе фичей — для модели с 100 фичами 2¹⁰⁰ оценок. SHAP делает approximation:</p>
<ul>
<li><b>TreeSHAP (Lundberg, 2018):</b> O(TLD²) для tree-ensembles через dynamic programming на путях по дереву. Exact, polynomial.</li>
<li><b>KernelSHAP:</b> weighted linear regression с kernel Shapley. Model-agnostic, но O(2^F) в worst case.</li>
<li><b>DeepSHAP:</b> композиция Shapley и DeepLIFT для neural networks.</li>
</ul>
<p><b>Важный caveat:</b> SHAP даёт <i>attribution в модели</i>, не <i>causal effect</i>. Если модель использует postal code как proxy для race, SHAP покажет postal code как важный — но это <b>алгоритмическая дискриминация</b>, не свойство реальности. Explainability ≠ causality.</p>
<p><b>LIME (Ribeiro, 2016):</b> семплирует perturbations вокруг точки, fit'ит linear model весами из exponential kernel по расстоянию. Даёт local linear approximation. Проще SHAP, но нестабильный: повторный запуск → разные объяснения (stochastic). В production надо set seed или усреднять.</p>
<p><b>Counterfactual explanations (Wachter, 2017):</b> «минимальное изменение x, меняющее решение». Формально: <code>min d(x, x') s.t. f(x') ≠ f(x)</code>. Это <b>actionable explanation</b>: клиенту говорим «увеличь доход на 10% — тогда одобрим кредит». GDPR Article 22 требует подобного для automated decisions.</p>
<p><b>Integrated Gradients (Sundararajan, 2017):</b> для deep networks. <code>IG_i(x) = (x_i − x'_i) ∫₀¹ ∂f(x' + α(x−x'))/∂x_i dα</code>, где x' — baseline (обычно чёрное изображение для CV). Удовлетворяет sensitivity и implementation invariance. Discrete approximation через 20–50 steps Riemann sum.</p>
<p><b>Explainability trade-offs:</b></p>
<ul>
<li><b>Intrinsic vs post-hoc:</b> интерпретируемая модель (log-reg, GAM, decision tree) vs «объясняющий» wrapper. Intrinsic — faithful by construction. Post-hoc — approximation, может врать.</li>
<li><b>Local vs global:</b> «почему этот клиент» vs «как модель работает». Методы разные.</li>
<li><b>Stability vs sensitivity:</b> объяснение должно быть стабильным к мелким изменениям входа, но чувствительным к решающим.</li>
</ul>
<p><b>Regulatory context:</b> EU AI Act, US ECOA, GDPR Article 22 требуют «meaningful information about logic involved». Это не conflict'ит с технически сложными моделями, но требует production-ready explainer'ов — KServe Explainer, Alibi — как first-class компоненты deployment.</p>`,
};

// apply
let enhanced = 0;
for (const prefix in theoryByPrefix) {
  const q = data.questions.find(x =>
    x.category === 'Вопросы по AI/ML в DevOps' &&
    x.text.startsWith(prefix)
  );
  if (!q) { console.warn('NOT FOUND:', prefix); continue; }
  // append theory block to existing answer
  q.answer = q.answer + '\n\n' + theoryByPrefix[prefix].trim();
  enhanced++;
}
console.log(`Enhanced ${enhanced}/${Object.keys(theoryByPrefix).length} questions`);

const newData = JSON.stringify(data);
const newHtml = html.slice(0, jsonStart) + newData + html.slice(endIdx);
writeFileSync(HTML_PATH, newHtml);
console.log(`Written ${newHtml.length} bytes`);
