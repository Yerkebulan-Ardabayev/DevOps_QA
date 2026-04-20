// Rewrite broken AI/ML questions and append new MLOps questions.
import { readFileSync, writeFileSync } from 'node:fs';

const HTML_PATH = 'DevOps_Interview.html';
const html = readFileSync(HTML_PATH, 'utf-8');

const startMarker = 'var DATA=';
const startIdx = html.indexOf(startMarker);
if (startIdx < 0) throw new Error('DATA marker not found');
const jsonStart = startIdx + startMarker.length;

let depth = 0, inString = false, escape = false, endIdx = -1;
for (let i = jsonStart; i < html.length; i++) {
  const c = html[i];
  if (escape) { escape = false; continue; }
  if (c === '\\') { escape = true; continue; }
  if (c === '"') { inString = !inString; continue; }
  if (inString) continue;
  if (c === '{') depth++;
  else if (c === '}') {
    depth--;
    if (depth === 0) { endIdx = i + 1; break; }
  }
}
if (endIdx < 0) throw new Error('DATA end not found');

const dataStr = html.slice(jsonStart, endIdx);
const data = JSON.parse(dataStr);

const CATEGORY = 'Вопросы по AI/ML в DevOps';

// === Rewrites for broken questions (keyed by id+text-prefix for safety) ===
const rewrites = [
  {
    id: 157,
    textPrefix: 'Масштабирование GPU',
    text: 'Масштабирование GPU. Как настроить taints и tolerations Kubernetes для рабочих нагрузок с GPU?',
    answer: `<p><b>Зачем taints на GPU-узлах.</b> GPU-узлы дорогие: ноду с 8× A100 нельзя отдавать обычным подам, иначе они вытеснят ML-нагрузку. Taint помечает ноду как «special», и только поды с соответствующим toleration смогут туда попасть.</p>

<p><b>Типовая схема для GPU-кластера:</b></p>
<ol>
<li><b>NVIDIA GPU Operator</b> ставит драйверы, <code>nvidia-device-plugin</code> и добавляет лейбл <code>nvidia.com/gpu.present=true</code>.</li>
<li>Админ ставит taint на GPU-ноды: <code>kubectl taint nodes gpu-node-1 nvidia.com/gpu=true:NoSchedule</code>.</li>
<li>ML-поды добавляют toleration и resource request:</li>
</ol>

<pre><code>apiVersion: v1
kind: Pod
spec:
  tolerations:
  - key: nvidia.com/gpu
    operator: Exists
    effect: NoSchedule
  containers:
  - name: trainer
    image: my-ml-image
    resources:
      limits:
        nvidia.com/gpu: 1
  nodeSelector:
    nvidia.com/gpu.product: A100-SXM4-80GB</code></pre>

<p><b>Тонкости для продакшена:</b></p>
<ul>
<li><b>Разные SKU GPU</b> (A100, H100, L40S, T4) — отдельный taint на каждый тип, чтобы training на A100 не оказался на T4.</li>
<li><b>MIG (Multi-Instance GPU):</b> A100/H100 можно порезать на 7 инстансов. Реквестим <code>nvidia.com/mig-1g.10gb: 1</code> вместо целого GPU.</li>
<li><b>Time-slicing</b> для dev/inference: несколько подов делят один GPU через конфиг device-plugin.</li>
<li><b>Combine with affinity:</b> taint + required node affinity по <code>nvidia.com/gpu.memory</code> гарантирует, что модель 70B не попадёт на 16 ГБ GPU.</li>
<li><b>Cluster Autoscaler / Karpenter</b> должен знать про taint, иначе не поднимет GPU-ноду под pending-под. В Karpenter добавляем taints в NodePool.</li>
</ul>

<p><b>Частая ошибка.</b> Ставить taint <code>NoExecute</code> без нужды — система эвиктит DaemonSet'ы (node-exporter, fluent-bit) и теряешь мониторинг GPU. Используй <code>NoSchedule</code> и явно разрешай DaemonSet'ам тolerate.</p>`,
  },
  {
    id: 245,
    textPrefix: 'Общее представление о линейной регрессии',
    text: 'Общее представление о линейной регрессии, деревьях решений, нейронных сетях. Для чего они используются?',
    answer: `<p>Три базовых класса моделей, которые DevOps-инженер встречает чаще всего при деплое ML-систем.</p>

<h4>1. Линейная / логистическая регрессия</h4>
<ul>
<li><b>Идея:</b> <code>y = w₁x₁ + w₂x₂ + ... + b</code>. Логистическая добавляет сигмоиду для классификации.</li>
<li><b>Для чего:</b> baseline для любой задачи, прогноз времени отклика, оценка вероятности оттока клиентов, A/B-тесты.</li>
<li><b>Плюсы:</b> быстро обучается, интерпретируется (веса = влияние фичи), занимает килобайты.</li>
<li><b>Serving:</b> достаточно scikit-learn pickle в Flask/FastAPI. GPU не нужен.</li>
</ul>

<h4>2. Деревья решений и ансамбли</h4>
<ul>
<li><b>Идея:</b> серия if-else по фичам. Ансамбли — Random Forest (усреднение независимых деревьев) и градиентный бустинг (XGBoost, LightGBM, CatBoost) — каждое следующее дерево исправляет ошибки предыдущих.</li>
<li><b>Для чего:</b> табличные данные, скоринг, fraud detection, recommendation ranking. Бустинги часто выигрывают Kaggle на табличных задачах.</li>
<li><b>Плюсы:</b> работают с разнотипными фичами, не нужна нормализация, хорошо ловят нелинейные зависимости.</li>
<li><b>Serving:</b> CPU, сотни-тысячи RPS на одно ядро. Модель от сотен КБ до сотен МБ.</li>
</ul>

<h4>3. Нейронные сети</h4>
<ul>
<li><b>Идея:</b> слои линейных преобразований + нелинейные активации (ReLU, GELU). Архитектуры: CNN (картинки), Transformer (текст, LLM), RNN/LSTM (последовательности, почти вытеснены трансформерами).</li>
<li><b>Для чего:</b> картинки, речь, текст, мультимодальные задачи, всё где нужны представления высокой размерности.</li>
<li><b>Стоимость:</b> обучение требует GPU/TPU, inference для больших моделей — тоже GPU. LLM 70B занимает ~140 ГБ VRAM в fp16.</li>
<li><b>Serving:</b> специальные runtime — Triton Inference Server, vLLM, TGI, TorchServe. Нужны batching и KV-cache для LLM.</li>
</ul>

<h4>Как выбрать</h4>
<ol>
<li>Табличные данные до 10M строк → начни с LightGBM/XGBoost.</li>
<li>Картинки/аудио/текст → трансформер или CNN.</li>
<li>Нужна интерпретируемость для регулятора → линейная модель или SHAP поверх бустинга.</li>
<li>Миллисекунды SLA на CPU → линейная или маленький бустинг.</li>
</ol>`,
  },
  {
    id: 236,
    textPrefix: 'Масштабирование AI/HPC',
    text: 'Масштабирование AI/HPC. Как автоматически масштабировать GPU-узлы для тренировочных нагрузок без оплаты простоя?',
    answer: `<p>GPU-час в облаке стоит от 1 до 40 USD. Простаивающая H100-нода за сутки — это 500–1000 USD в мусор. Задача: поднять GPU-узлы под pending-поды и быстро их убрать.</p>

<h4>Ключевые компоненты</h4>
<ul>
<li><b>Karpenter</b> или <b>Cluster Autoscaler</b> — поднимают ноды по требованию. Karpenter быстрее (секунды vs минуты) и гибче в выборе instance type.</li>
<li><b>NVIDIA GPU Operator</b> — устанавливает драйверы и device plugin через DaemonSet при появлении GPU-ноды.</li>
<li><b>NodePool / NodeGroup</b> с taint <code>nvidia.com/gpu=true:NoSchedule</code>, чтобы обычные поды не занимали GPU.</li>
<li><b>Queue-system</b>: Kueue, Volcano или Run:AI — батчат тренировки и запускают их последовательно на ограниченном пуле GPU.</li>
</ul>

<h4>Паттерн scale-to-zero</h4>
<ol>
<li>GPU NodePool настроен с <code>minSize: 0, maxSize: 16</code>.</li>
<li>Job подаётся через Kueue → уходит в очередь.</li>
<li>Kueue admitts job когда в квоте есть место → создаёт под.</li>
<li>Под pending (нет GPU) → Karpenter поднимает ноду <code>p4d.24xlarge</code>.</li>
<li>Job завершился → TTL controller удаляет Job → под исчезает → Karpenter снимает ноду через <code>consolidationPolicy: WhenEmpty</code>.</li>
</ol>

<h4>Экономия на инстансах</h4>
<ul>
<li><b>Spot / Preemptible</b> для тренировок с чекпоинтами (каждые 5–15 минут): даёт 60–80% скидки. Обязательно сохраняй checkpoint в S3/GCS.</li>
<li><b>Fallback</b>: если Spot недоступен, Karpenter автоматически пробует другие типы (<code>p4de</code>, <code>p5</code>) или on-demand.</li>
<li><b>Savings Plans / Committed Use</b> только на постоянный inference, не на тренировку.</li>
</ul>

<h4>Мониторинг пустого простоя</h4>
<ul>
<li><code>DCGM Exporter</code> → Prometheus: <code>DCGM_FI_DEV_GPU_UTIL</code>. Алерт если GPU &lt; 10% дольше 10 минут — модель крутится на CPU или застряла в data-loading.</li>
<li>Graylist worker'ов, которые недозагружают GPU, и убивай job с уведомлением автору.</li>
</ul>

<h4>Частые грабли</h4>
<ul>
<li>Данные по сети медленно грузятся → GPU idle 80% времени. Решение — локальный NVMe cache или FSx/Lustre.</li>
<li>Image pull 10 ГБ PyTorch-образа на новую ноду занимает 5 минут. Решение — warm pool, pre-pull через DaemonSet или использовать pre-pulled AMI.</li>
<li>Karpenter поднимает ноду, но под pending ещё 3 минуты из-за GPU Operator. Решение — startupTaints снимать, когда driver ready.</li>
</ul>`,
  },
  {
    id: 249,
    textPrefix: 'Развертывание моделей',
    text: 'Model Deployment / Serving — как выкатывать ML-модели в продакшен?',
    answer: `<p><b>Model Serving</b> — перевод обученной модели из ноутбука в production API с SLA по latency, throughput и доступности.</p>

<h4>1. Сериализация модели</h4>
<ul>
<li><b>pickle / joblib</b> — scikit-learn, классика для табличных моделей. Не используй между разными версиями библиотек.</li>
<li><b>SavedModel (TensorFlow)</b> или <b>TorchScript / torch.export</b> — нативные форматы фреймворков.</li>
<li><b>ONNX</b> — универсальный межфреймворковый формат. Запускается через ONNX Runtime на CPU/GPU/edge.</li>
<li><b>GGUF / safetensors</b> — для LLM. <code>safetensors</code> безопаснее <code>pickle</code> (нет произвольного кода при загрузке).</li>
</ul>

<h4>2. Паттерны деплоя</h4>
<ul>
<li><b>Online serving</b> (REST/gRPC) — низкий latency, интерактивное использование. Пример: FastAPI + uvicorn, или TorchServe/Triton.</li>
<li><b>Batch scoring</b> — прогнать миллиард строк за ночь. Spark, Ray, Airflow + GPU-под.</li>
<li><b>Streaming inference</b> — Kafka consumer считает фичи и предсказания в реальном времени.</li>
<li><b>Edge</b> — модель в мобильном устройстве (TensorFlow Lite, CoreML, ONNX Mobile).</li>
</ul>

<h4>3. Production-ready инструменты</h4>
<ul>
<li><b>NVIDIA Triton Inference Server</b> — TensorFlow, PyTorch, ONNX, TensorRT в одном бинарнике, dynamic batching, ensemble pipeline.</li>
<li><b>KServe</b> (ex KFServing) — Kubernetes CRD для serverless inference, autoscale 0→N, canary, traffic split.</li>
<li><b>Seldon Core</b> — граф моделей (A/B, multi-armed bandit), explainers, outlier detection.</li>
<li><b>BentoML</b> — pythonic упаковка модели в OCI-образ, хорошо дружит с CI/CD.</li>
<li><b>vLLM / TGI</b> — специализированные serving engines для LLM с PagedAttention и continuous batching.</li>
</ul>

<h4>4. Безопасный rollout</h4>
<ol>
<li><b>Shadow deployment:</b> новая модель получает реальный трафик, но её ответы не возвращаются — только логируются для сравнения.</li>
<li><b>Canary:</b> 5% трафика → метрики → 25% → 100%.</li>
<li><b>A/B test:</b> по user_id делится трафик, считается бизнес-метрика (конверсия), а не только latency.</li>
<li><b>Автоматический rollback</b> по метрикам качества (drift, accuracy-proxy, user complaints).</li>
</ol>

<h4>5. SLA и наблюдаемость</h4>
<ul>
<li>p50/p95/p99 latency, throughput, error rate — как в обычном сервисе.</li>
<li>Специфично для ML: prediction distribution, input feature distribution, model version, GPU utilization, KV-cache hit rate (для LLM).</li>
<li>Экспорт в Prometheus + Grafana, алерты при дрейфе input'ов за ±3σ.</li>
</ul>`,
  },
  {
    id: 250,
    textPrefix: 'Оркестрация ML-пайплайнов',
    text: 'Оркестрация ML-пайплайнов — зачем и чем делать (Kubeflow, Airflow, Flyte, Argo Workflows)?',
    answer: `<p>ML-пайплайн — цепочка шагов: ingest → validate → feature engineering → train → evaluate → register → deploy → monitor. Каждый шаг переносимый, версионируемый, с retry и кешем результатов.</p>

<h4>Почему не просто скрипт</h4>
<ul>
<li><b>Зависимости шагов:</b> train не запустится пока не готовы фичи. Нужен DAG.</li>
<li><b>Cache:</b> если данные не изменились, не пересчитывать фичи.</li>
<li><b>Retries и partial failures:</b> train упал на 3-м часу — перезапустить с чекпоинта, не с нуля.</li>
<li><b>Reproducibility:</b> кто/когда/на каких данных/с каким seed получил модель.</li>
<li><b>Trigger'ы:</b> новые данные → автотренировка; дрейф → автопереобучение.</li>
</ul>

<h4>Основные инструменты</h4>
<table>
<tr><th>Инструмент</th><th>Сильные стороны</th><th>Слабые</th></tr>
<tr><td><b>Kubeflow Pipelines</b></td><td>ML-first, tight integration с KServe, Katib (HPO), реестр экспериментов</td><td>Сложная установка, много движущихся частей</td></tr>
<tr><td><b>Airflow</b></td><td>Зрелый, огромное community, подходит для data + ML</td><td>Не pyhonic для ML (XCom ограничен), slow scheduling</td></tr>
<tr><td><b>Flyte</b></td><td>Strong typing, кеш по артефактам, k8s-native, отличен для ML/data</td><td>Меньшее community</td></tr>
<tr><td><b>Argo Workflows</b></td><td>K8s-native, быстрый, YAML/Python SDK</td><td>Low-level, сам пиши ML-абстракции</td></tr>
<tr><td><b>Metaflow</b></td><td>Простой Python API, хорош для DS-команд, дружит с AWS Batch</td><td>Менее гибкий на self-hosted k8s</td></tr>
<tr><td><b>ZenML / Prefect</b></td><td>Python-first, modern UX</td><td>Молодые экосистемы</td></tr>
</table>

<h4>Пример на Kubeflow Pipelines (KFP v2)</h4>
<pre><code>from kfp import dsl

@dsl.component(packages_to_install=["pandas", "scikit-learn"])
def train(data_path: str, model: dsl.Output[dsl.Model]):
    import pandas as pd
    from sklearn.ensemble import RandomForestClassifier
    import joblib
    df = pd.read_parquet(data_path)
    clf = RandomForestClassifier().fit(df.drop("y", axis=1), df["y"])
    joblib.dump(clf, model.path)

@dsl.pipeline(name="churn-pipeline")
def pipeline(data_path: str):
    train_task = train(data_path=data_path)
    train_task.set_accelerator_type("nvidia.com/gpu").set_accelerator_limit(1)</code></pre>

<h4>Триггеры запуска</h4>
<ul>
<li><b>Cron</b> — еженедельное переобучение.</li>
<li><b>Event-driven</b> — новый parquet в S3 → EventBridge → pipeline run.</li>
<li><b>Drift-triggered</b> — Evidently AI детектирует drift → webhook → pipeline run.</li>
</ul>

<h4>Как выбрать</h4>
<ul>
<li>Команда уже на Airflow и пайплайн смешанный (ETL + ML) → Airflow.</li>
<li>Чисто ML, Kubernetes-native, хочется HPO и A/B → Kubeflow.</li>
<li>Нужен strong typing и артефактный кеш → Flyte.</li>
<li>Хотите просто YAML и k8s-примитивы → Argo Workflows.</li>
</ul>`,
  },
  {
    id: 248,
    textPrefix: 'Отслеживание экспериментов',
    text: 'Experiment Tracking и Model Registry — MLflow, Weights & Biases, DVC',
    answer: `<p><b>Experiment Tracking</b> — логирование каждого запуска обучения (гиперпараметры, метрики, артефакты) для воспроизводимости и сравнения. <b>Model Registry</b> — каталог моделей со стадиями <i>staging → production → archived</i>.</p>

<h4>Что логируется в experiment</h4>
<ul>
<li><b>Params:</b> гиперпараметры (<code>lr=0.001, batch=64, seed=42</code>).</li>
<li><b>Metrics:</b> loss, accuracy, F1, AUC — как итоговые, так и по эпохам.</li>
<li><b>Artifacts:</b> модель, confusion matrix, feature importance plot.</li>
<li><b>Code version:</b> git commit SHA.</li>
<li><b>Data version:</b> ссылка на DVC/lakeFS коммит датасета.</li>
<li><b>Environment:</b> conda/poetry lock, CUDA version, Docker image digest.</li>
</ul>

<h4>Инструменты</h4>
<table>
<tr><th>Инструмент</th><th>Описание</th><th>Когда выбрать</th></tr>
<tr><td><b>MLflow</b></td><td>Open-source, tracking + registry + projects + models, работает локально и в k8s</td><td>Self-hosted, интеграция с Databricks, стандарт де-факто</td></tr>
<tr><td><b>Weights &amp; Biases</b></td><td>SaaS с отличным UI, богатые визуализации, hyperparam sweeps</td><td>Команде DS важен UX, нет проблемы с внешним сервисом</td></tr>
<tr><td><b>Neptune.ai</b></td><td>SaaS, масштабируется на миллионы runs, удобное сравнение</td><td>Много экспериментов в день</td></tr>
<tr><td><b>Comet ML</b></td><td>SaaS, enterprise-features</td><td>Нужны SOC2/audit trails из коробки</td></tr>
<tr><td><b>Aim</b></td><td>Open-source, быстрый UI</td><td>Минимализм без MLflow-overhead</td></tr>
</table>

<h4>MLflow в коде</h4>
<pre><code>import mlflow

with mlflow.start_run(run_name="rf-baseline") as run:
    mlflow.log_params({"n_estimators": 200, "max_depth": 10})
    clf.fit(X, y)
    acc = clf.score(X_test, y_test)
    mlflow.log_metric("val_accuracy", acc)
    mlflow.sklearn.log_model(clf, "model",
        registered_model_name="churn-predictor")

# Promote to production
client = mlflow.MlflowClient()
client.transition_model_version_stage(
    name="churn-predictor", version=5, stage="Production")</code></pre>

<h4>Model Registry в CI/CD</h4>
<ol>
<li>Training pipeline залогировал модель → <code>Staging</code>.</li>
<li>Automated validation (holdout metrics, fairness, latency) → <code>Production</code>.</li>
<li>KServe/Seldon следит за реестром и автоматически деплоит модель со стадией <code>Production</code>.</li>
<li>При откате — старая версия снова становится <code>Production</code>, новая → <code>Archived</code>.</li>
</ol>

<h4>Антипаттерны</h4>
<ul>
<li>Логировать только финальную метрику без learning curve — нельзя отличить недообучение от переобучения.</li>
<li>Хранить модели в git (LFS или нет) — registry существует именно для этого.</li>
<li>Не привязывать run к git commit и data version — эксперимент невоспроизводим.</li>
</ul>`,
  },
  {
    id: 243,
    textPrefix: 'Жизненный цикл ML',
    text: 'Жизненный цикл ML: от сбора данных до мониторинга и переобучения',
    answer: `<p>ML lifecycle — непрерывный цикл из 8 стадий. В отличие от классического SDLC, он замкнутый: мониторинг порождает новые итерации.</p>

<h4>1. Сбор и разметка данных (Data Collection)</h4>
<ul>
<li>Источники: продакшен-БД, логи, clickstream, сторонние API, ручная разметка (Label Studio, Scale AI, Prodigy).</li>
<li>Хранение: S3/GCS data lake (raw), Delta Lake / Iceberg (bronze/silver/gold).</li>
<li>Версионирование: DVC, lakeFS, Nessie — датасет как git-объект.</li>
</ul>

<h4>2. Предобработка (Data Preparation)</h4>
<ul>
<li>Очистка: дубликаты, пропуски, outliers.</li>
<li>Feature engineering: derived фичи, энкодинги, нормализация.</li>
<li>Feature Store (Feast, Tecton) — единый источник фичей для train и serving, устраняет training-serving skew.</li>
<li>Data validation: Great Expectations, Deepchecks, Pandera — контрактные тесты на схему и распределения.</li>
</ul>

<h4>3. Обучение (Training)</h4>
<ul>
<li>Эксперименты: grid/random/bayesian hyperparameter search (Optuna, Katib, W&amp;B Sweeps).</li>
<li>Distributed training для больших моделей: DDP, FSDP, DeepSpeed.</li>
<li>Tracking: MLflow/W&amp;B логирует params, metrics, artifacts, git SHA, data version.</li>
</ul>

<h4>4. Оценка (Evaluation)</h4>
<ul>
<li>Holdout и cross-validation метрики: accuracy, F1, AUC, RMSE.</li>
<li>Бизнес-метрики (offline): uplift, revenue-per-prediction, cost-of-error.</li>
<li>Fairness: disparate impact, equal opportunity по sensitive-атрибутам.</li>
<li>Explainability: SHAP, LIME — особенно если решение влияет на людей (кредит, медицина).</li>
</ul>

<h4>5. Регистрация (Model Registry)</h4>
<ul>
<li>Модель + metadata (метрики, data version, git SHA) попадает в MLflow Registry, SageMaker Model Registry или Vertex AI.</li>
<li>Стадии: None → Staging → Production → Archived.</li>
</ul>

<h4>6. Развертывание (Deployment)</h4>
<ul>
<li>Shadow → Canary → Full rollout.</li>
<li>Online (REST/gRPC), batch (Spark, Ray), streaming (Kafka), edge.</li>
<li>Инфраструктура: KServe, Seldon, BentoML, Triton, vLLM (для LLM).</li>
</ul>

<h4>7. Мониторинг (Monitoring)</h4>
<ul>
<li>Operational: latency, QPS, errors, GPU util.</li>
<li>Data drift: PSI, KS-test на входных фичах.</li>
<li>Concept drift: скользящая accuracy на labeled production data.</li>
<li>Prediction drift: распределение выходов vs baseline.</li>
<li>Инструменты: Evidently AI, Arize, Fiddler, WhyLabs.</li>
</ul>

<h4>8. Переобучение (Retraining)</h4>
<ul>
<li>Scheduled: cron раз в неделю.</li>
<li>Performance-based: accuracy упала ниже порога → trigger.</li>
<li>Drift-based: Evidently обнаружил drift → webhook → pipeline.</li>
<li>Continuous Training (CT) — автоматизация всего цикла 1→8 без участия человека.</li>
</ul>

<p><b>Идея MLOps:</b> каждая стадия версионируется, автоматизируется и имеет SLA. Модель — живой продукт, а не разовая поставка.</p>`,
  },
  {
    id: 237,
    textPrefix: 'Балансировка нагрузки',
    text: 'Multi-region GPU training: один из кластеров упирается в OOM, как ребалансировать в реальном времени?',
    answer: `<p>Сценарий: distributed training идёт по 3 регионам, в <code>eu-west-1</code> кончается GPU memory (OOM), training падает на 70% прогресса. Нужна стратегия, которая не теряет работу и перераспределяет нагрузку.</p>

<h4>1. Немедленные действия</h4>
<ol>
<li><b>Checkpoint recovery:</b> последний чекпоинт (каждые 500–5000 шагов) уже в S3/GCS. Убиваем упавший replica-set, перезапускаем с last checkpoint.</li>
<li><b>Reduce batch per replica</b> в этом регионе: global batch size = micro_batch × accum × data_parallel_size. Если OOM — увеличь gradient accumulation, уменьши micro-batch.</li>
<li><b>Drain region:</b> <code>kubectl cordon</code> проблемные GPU-ноды, <code>drain --ignore-daemonsets</code>, scheduler перенесёт реплики.</li>
</ol>

<h4>2. Ребалансировка workload'а</h4>
<ul>
<li><b>Elastic training</b> (TorchElastic / torch.distributed.run <code>--nnodes=MIN:MAX</code>): world size меняется на лету, joined/left workers переконфигурируют communicator.</li>
<li><b>Ray Train / Ray Tune</b> умеют перезапускать trials на других нодах при preemption.</li>
<li><b>Kubeflow Training Operator (PyTorchJob)</b> с <code>elasticPolicy.minReplicas/maxReplicas</code>.</li>
</ul>

<h4>3. Multi-region specifics</h4>
<ul>
<li><b>All-reduce через регионы</b> убивает пропускную способность: latency eu-west-1 ↔ us-east-1 ≈ 80 ms. NCCL ожидает &lt; 5 ms.</li>
<li><b>Решение:</b> гибрид — <b>sharded data parallel внутри региона</b> (NVLink/NVSwitch) + <b>async gradient averaging между регионами</b> (ZeRO-3 with hierarchical all-reduce).</li>
<li>Альтернативно — federated pattern: каждый регион обучает отдельную реплику, раз в N шагов усредняются веса.</li>
</ul>

<h4>4. Как снизить риск OOM в первую очередь</h4>
<ul>
<li><b>Activation checkpointing</b> (gradient checkpointing) — меняем compute на memory, экономим до 50% VRAM.</li>
<li><b>Mixed precision (bf16/fp16)</b> — модель занимает вдвое меньше.</li>
<li><b>ZeRO-3 / FSDP</b> — веса, градиенты и optimizer states шардятся между GPU.</li>
<li><b>Offload</b> optimizer states в CPU или NVMe (DeepSpeed ZeRO-Infinity).</li>
<li><b>Preflight check:</b> <code>torch.cuda.max_memory_allocated()</code> при маленьком batch, экстраполировать на целевой.</li>
</ul>

<h4>5. Наблюдаемость для предотвращения</h4>
<ul>
<li>DCGM exporter → Prometheus: <code>DCGM_FI_DEV_FB_USED</code>, <code>DCGM_FI_DEV_FB_FREE</code>.</li>
<li>Алерт при &gt; 90% VRAM на любом worker'е, прежде чем OOM.</li>
<li>Kueue quota per region — не отдавать последние 10% GPU под training.</li>
</ul>`,
  },
];

// Apply rewrites
let rewritten = 0;
for (const r of rewrites) {
  const q = data.questions.find(x =>
    x.category === CATEGORY &&
    x.id === r.id &&
    x.text.startsWith(r.textPrefix)
  );
  if (!q) {
    console.warn(`! NOT FOUND: id=${r.id} prefix="${r.textPrefix}"`);
    continue;
  }
  q.text = r.text;
  q.answer = r.answer;
  rewritten++;
}
console.log(`Rewrote ${rewritten}/${rewrites.length} questions`);

// === New MLOps questions ===
const maxId = Math.max(...data.questions.map(q => q.id));
const maxNum = Math.max(...data.questions.map(q => q.num));

const NEW = [
  {
    text: 'Что такое Feature Store и зачем он нужен в MLOps?',
    answer: `<p><b>Feature Store</b> — централизованный слой для хранения, версионирования и доставки признаков (features) между обучением и инференсом. Он решает главную боль production ML: <i>training-serving skew</i>, когда фичи в продакшене считаются не так, как при обучении.</p>

<h4>Что он даёт</h4>
<ul>
<li><b>Unified source of truth.</b> Одно определение фичи работает и для batch-тренировки, и для онлайн-инференса.</li>
<li><b>Re-use.</b> Команда A считает <code>user_7d_orders</code>. Команда B использует ту же фичу без дублирования ETL.</li>
<li><b>Point-in-time correctness.</b> При training для даты T берутся значения фичи <i>по состоянию на T</i>, а не последние — иначе label leakage.</li>
<li><b>Low-latency serving.</b> Online store выдаёт фичи за &lt; 10 мс.</li>
</ul>

<h4>Архитектура: offline + online</h4>
<ul>
<li><b>Offline store</b> (Parquet, Delta, BigQuery, Snowflake) — большие исторические таблицы для training и batch-scoring.</li>
<li><b>Online store</b> (Redis, DynamoDB, Cassandra, Aerospike) — последние значения фичей для real-time inference.</li>
<li><b>Sync</b>: materialization-job регулярно переливает данные из offline в online.</li>
<li><b>Registry</b> — каталог фичей с owner, schema, описанием.</li>
</ul>

<h4>Популярные решения</h4>
<ul>
<li><b>Feast</b> — open-source, самый популярный, работает поверх любого warehouse + Redis.</li>
<li><b>Tecton</b> — enterprise SaaS, авторы тех же людей, что Feast.</li>
<li><b>Databricks Feature Store</b> — встроенный в Databricks.</li>
<li><b>SageMaker / Vertex AI Feature Store</b> — managed от AWS / GCP.</li>
<li><b>Hopsworks</b> — open-source enterprise.</li>
</ul>

<h4>Пример Feast</h4>
<pre><code>from feast import Entity, FeatureView, Field, FileSource
from feast.types import Float32, Int64

user = Entity(name="user_id", join_keys=["user_id"])
source = FileSource(path="s3://bucket/user_stats.parquet",
                    timestamp_field="event_ts")

user_stats_fv = FeatureView(
    name="user_stats",
    entities=[user],
    schema=[Field(name="orders_7d", dtype=Int64),
            Field(name="avg_ticket", dtype=Float32)],
    source=source, online=True, ttl=timedelta(days=30))

# Training
train_df = store.get_historical_features(
    entity_df=labels, features=["user_stats:orders_7d"]).to_df()

# Serving
online_features = store.get_online_features(
    features=["user_stats:orders_7d"],
    entity_rows=[{"user_id": 42}]).to_dict()</code></pre>

<h4>Когда Feature Store не нужен</h4>
<ul>
<li>Одна модель, одна команда, фичи считаются прямо в сервисе.</li>
<li>Latency некритичен и batch-scoring достаточен — хватает warehouse + Airflow.</li>
</ul>

<p>Feature Store оправдан от десятков моделей и более 3–4 команд, которые делят фичи.</p>`,
  },
  {
    text: 'Версионирование данных в ML: DVC vs LakeFS vs Git-LFS vs Delta Lake',
    answer: `<p>Код версионируется git'ом, но ML-модель зависит от <b>данных</b>, которые git не умеет. Нужен отдельный слой — data versioning.</p>

<h4>Почему нужно версионирование данных</h4>
<ul>
<li><b>Reproducibility:</b> «эта модель обучена на датасете v2024-03-12» — без версии не воспроизведёшь.</li>
<li><b>Rollback:</b> новый clean-up убрал нужные строки — откатить датасет.</li>
<li><b>Audit:</b> регулятор спрашивает, какие данные видела модель при fit. Надо ответить.</li>
<li><b>Lineage:</b> из какого сырого source пришли фичи, через какие трансформации.</li>
</ul>

<h4>Сравнение инструментов</h4>
<table>
<tr><th>Инструмент</th><th>Подход</th><th>Плюсы</th><th>Минусы</th></tr>
<tr><td><b>Git-LFS</b></td><td>Бинарные файлы в отдельном storage, pointer в git</td><td>Прост, встроен в GitHub/GitLab</td><td>Плохо для &gt; 10 ГБ, нет data-specific операций</td></tr>
<tr><td><b>DVC</b></td><td>Git хранит хеши, данные в S3/GCS/Azure/SSH</td><td>Pipeline'ы (dvc.yaml), тесная интеграция с git, cache</td><td>Медленный для тысяч файлов, вторая система поверх git</td></tr>
<tr><td><b>lakeFS</b></td><td>Git-like на S3: branches, commits, merge на уровне object store</td><td>Изолированный эксперимент без копии данных, zero-copy branching</td><td>Нужен отдельный сервис</td></tr>
<tr><td><b>Delta Lake / Iceberg / Hudi</b></td><td>Table format поверх Parquet с time-travel</td><td>Нативный для Spark/Databricks, ACID, schema evolution</td><td>Не объект-версионирование, а табличное</td></tr>
<tr><td><b>Pachyderm</b></td><td>Git-like для data pipelines с provenance</td><td>Автоматический data lineage</td><td>Сложнее, Kubernetes-native</td></tr>
</table>

<h4>DVC — типичный flow</h4>
<pre><code># Добавить датасет в DVC
dvc add data/train.parquet
git add data/train.parquet.dvc .gitignore
git commit -m "data: initial train v1"

# Pipeline stage
dvc stage add -n train \\
  -d src/train.py -d data/train.parquet \\
  -o models/model.pkl -M metrics.json \\
  python src/train.py

dvc repro                 # пересчитать только изменившееся
dvc push                  # данные в S3
git push                  # метаданные в git

# Воспроизвести
git checkout abc123 && dvc pull
dvc repro</code></pre>

<h4>lakeFS — ветки данных</h4>
<pre><code>lakectl branch create lakefs://repo/experiment-A --source lakefs://repo/main
# модифицируем данные в ветке без копирования
spark.read.parquet("s3a://repo/experiment-A/events/")
# удачно — merge обратно
lakectl merge lakefs://repo/experiment-A lakefs://repo/main</code></pre>

<h4>Как выбрать</h4>
<ul>
<li>Небольшие датасеты, знакомый git flow → <b>DVC</b>.</li>
<li>Петабайты в S3, нужны эксперименты на подмножествах → <b>lakeFS</b>.</li>
<li>Spark/Databricks, нужны ACID-таблицы → <b>Delta</b> или <b>Iceberg</b>.</li>
<li>Простые бинарники до гигабайт → <b>Git-LFS</b>.</li>
</ul>`,
  },
  {
    text: 'Continuous Training (CT): как автоматизировать переобучение моделей?',
    answer: `<p><b>Continuous Training (CT)</b> — четвёртое «C» в MLOps (CI/CD/CT). Автоматический pipeline, который переобучает и передеплоит модель при наступлении триггера, без участия человека.</p>

<h4>Зачем это нужно</h4>
<ul>
<li>Поведение пользователей меняется — модель деградирует (concept drift).</li>
<li>Новые данные поступают ежедневно — без CT модель «замерзает» во времени.</li>
<li>Human-in-the-loop не масштабируется на десятки моделей.</li>
</ul>

<h4>Триггеры retraining</h4>
<ol>
<li><b>Scheduled (time-based):</b> cron раз в неделю / месяц. Просто, но нерационально.</li>
<li><b>Data-based:</b> накопилось N новых labeled примеров → trigger.</li>
<li><b>Performance-based:</b> accuracy на live data упала ниже порога → trigger. Нужен мониторинг с ground truth.</li>
<li><b>Drift-based:</b> Evidently/WhyLabs обнаружил drift → webhook → pipeline.</li>
<li><b>Event-based:</b> новый релиз продукта, смена сезона, регуляторное событие.</li>
</ol>

<h4>Архитектура CT-pipeline'а</h4>
<pre><code>Trigger → Pipeline run:
  1. Data ingestion (новые labeled данные из warehouse)
  2. Data validation (Great Expectations / TFDV)
     ↳ schema OK? distribution shift ≤ threshold?
  3. Training (distributed, с hyperparam tuning)
  4. Evaluation (holdout + fairness + latency)
     ↳ F1 новая ≥ F1 текущей − 0.5%? Иначе fail.
  5. Model registry: register as "candidate"
  6. Shadow deployment на 1–24 часа
     ↳ метрики предсказаний vs production
  7. Canary: 5% → 25% → 100%
  8. Promote в Production, старая → Archived</code></pre>

<h4>Критические safeguards</h4>
<ul>
<li><b>Training-serving skew check:</b> новая модель на той же test-выборке должна работать предсказуемо.</li>
<li><b>Champion-challenger:</b> новая модель выигрывает только если лучше текущей на ≥ margin.</li>
<li><b>Human approval gate</b> для high-stakes моделей (кредит, медицина) — pipeline останавливается и ждёт click'а.</li>
<li><b>Rollback automation:</b> если p95 latency или error rate выросли — автооткат на предыдущую версию.</li>
</ul>

<h4>Инструменты</h4>
<ul>
<li><b>Kubeflow Pipelines + KServe</b> — классический CT на k8s.</li>
<li><b>SageMaker Pipelines + Model Monitor</b> — managed.</li>
<li><b>Vertex AI Pipelines</b> — GCP managed.</li>
<li><b>TFX (TensorFlow Extended)</b> — pipeline-фреймворк с встроенной data validation.</li>
</ul>

<h4>Антипаттерны</h4>
<ul>
<li>Retrain на всё подряд, включая аномалии → модель учится на мусоре.</li>
<li>Нет baseline — не знаешь, стала модель лучше или хуже.</li>
<li>Авто-деплой без canary → один плохой retrain кладёт продакшен.</li>
</ul>`,
  },
  {
    text: 'Shadow deployment, canary и A/B-тестирование для ML-моделей',
    answer: `<p>Деплой ML-модели — не просто «поменять бинарь». Модель делает предсказания, которые влияют на бизнес-метрики (конверсия, fraud-catch), и одних latency/error-метрик мало.</p>

<h4>Shadow deployment (dark launch)</h4>
<ul>
<li><b>Что:</b> 100% трафика идёт и в старую, и в новую модель. Пользователь видит ответ старой. Ответ новой логируется.</li>
<li><b>Зачем:</b> оценить distribution предсказаний, latency, стоимость на реальном трафике <i>без риска</i>.</li>
<li><b>Длительность:</b> часы–сутки, пока не наберётся статистика.</li>
<li><b>Реализация:</b> async fire-and-forget в новую модель, sidecar-логгер, offline-сравнение.</li>
</ul>

<h4>Canary release</h4>
<ul>
<li><b>Что:</b> часть трафика (1% → 5% → 25% → 100%) попадает на новую модель, остальное — на старую.</li>
<li><b>Зачем:</b> ограничить blast radius. Если новая хуже — страдает 5% пользователей, не 100%.</li>
<li><b>Метрики прогресса:</b> latency p95, error rate, business KPI (конверсия, выручка) — автоматические SLO gates.</li>
<li><b>Реализация:</b> Istio/Linkerd traffic-split, KServe <code>InferenceService</code> с <code>canaryTrafficPercent</code>, Seldon <code>MAB</code>.</li>
</ul>

<h4>A/B test</h4>
<ul>
<li><b>Что:</b> детерминированный split по user_id (hash → 50/50). Одни пользователи всегда видят A, другие — B.</li>
<li><b>Зачем:</b> измерить <i>бизнес-эффект</i> новой модели с нормальной статистикой (t-test, CUPED).</li>
<li><b>Длительность:</b> дни–недели, чтобы набрать power.</li>
<li><b>Не путать с canary:</b> canary — о рисках деплоя, A/B — о value для бизнеса.</li>
</ul>

<h4>Multi-armed bandit (MAB)</h4>
<ul>
<li><b>Что:</b> трафик автоматически перенаправляется на лучшую модель в реальном времени (Thompson sampling, UCB).</li>
<li><b>Зачем:</b> минимизировать regret — платить меньше за исследование.</li>
<li><b>Минус:</b> сложнее интерпретировать, труднее делать выводы о статзначимости.</li>
</ul>

<h4>Champion / Challenger</h4>
<ul>
<li><b>Что:</b> production-модель (champion) постоянно сравнивается с кандидатами (challengers).</li>
<li><b>Как:</b> каждый challenger крутится в shadow-режиме. Когда challenger стабильно лучше N дней — он становится champion.</li>
</ul>

<h4>Что мерить</h4>
<ol>
<li><b>Technical:</b> latency p50/p95/p99, error rate, GPU utilization.</li>
<li><b>Model-level:</b> prediction distribution, confidence calibration, coverage.</li>
<li><b>Business:</b> CTR, конверсия, revenue per session, fraud caught, false-positive rate.</li>
<li><b>Fairness:</b> метрики по subgroup (gender, region).</li>
</ol>

<h4>Стек</h4>
<ul>
<li><b>KServe InferenceService</b> — traffic split, canary, explainers.</li>
<li><b>Seldon Core</b> — графы моделей, A/B, MAB из коробки.</li>
<li><b>Feature flags</b> (LaunchDarkly, Unleash) — для user-level routing.</li>
<li><b>Experimentation platform</b> (Eppo, Statsig, GrowthBook) — для A/B статистики.</li>
</ul>`,
  },
  {
    text: 'Distributed training: DDP, FSDP, DeepSpeed, Tensor Parallelism',
    answer: `<p>Модель не помещается в один GPU или обучается слишком медленно → распределённое обучение. Четыре основных подхода, которые часто комбинируются (3D parallelism).</p>

<h4>1. Data Parallelism (DP / DDP)</h4>
<ul>
<li><b>Идея:</b> копия модели на каждом GPU, разные батчи, синхронизация градиентов через all-reduce.</li>
<li><b>Требует:</b> модель помещается на один GPU.</li>
<li><b>PyTorch:</b> <code>torch.nn.parallel.DistributedDataParallel</code> (DDP). DataParallel (без Distributed) устарел, не использовать.</li>
<li><b>Когда:</b> модели &lt; 10B параметров, основная цель — ускорение.</li>
</ul>

<h4>2. FSDP / ZeRO</h4>
<ul>
<li><b>Идея:</b> шардировать параметры, градиенты, optimizer states между GPU. Каждый GPU хранит только свою часть.</li>
<li><b>Уровни ZeRO (DeepSpeed):</b>
  <ul>
    <li>ZeRO-1: шардятся optimizer states (~4x экономия).</li>
    <li>ZeRO-2: + градиенты (~8x).</li>
    <li>ZeRO-3: + параметры (~Nx, где N — кол-во GPU).</li>
    <li>ZeRO-Infinity: offload в CPU/NVMe — можно тренировать триллион параметров.</li>
  </ul>
</li>
<li><b>PyTorch FSDP</b> — нативная альтернатива, эквивалент ZeRO-3.</li>
<li><b>Когда:</b> модели не помещаются в один GPU (10B–100B+).</li>
</ul>

<h4>3. Tensor Parallelism</h4>
<ul>
<li><b>Идея:</b> одна матричная операция (например, attention weights) режется между GPU. Megatron-LM стиль.</li>
<li><b>Требует:</b> быстрый интерконнект (NVLink, NVSwitch). По сети TCP — не взлетит.</li>
<li><b>Комбинируется</b> с DP: TP внутри ноды, DP между нодами.</li>
<li><b>Когда:</b> огромные модели (&gt; 100B), работа в датацентре с NVLink.</li>
</ul>

<h4>4. Pipeline Parallelism</h4>
<ul>
<li><b>Идея:</b> разные слои модели на разных GPU. Батч делится на micro-batches, проходящие по pipeline.</li>
<li><b>Проблема:</b> pipeline bubble — GPU простаивают в начале/конце.</li>
<li><b>Решения:</b> GPipe, 1F1B, interleaved schedule (Megatron).</li>
<li><b>Когда:</b> очень глубокие модели, комбинация TP+PP+DP (3D parallelism).</li>
</ul>

<h4>Сравнительная таблица</h4>
<table>
<tr><th>Подход</th><th>Память</th><th>Сеть</th><th>Сложность</th></tr>
<tr><td>DDP</td><td>Nx</td><td>all-reduce градиентов</td><td>Низкая</td></tr>
<tr><td>ZeRO-3 / FSDP</td><td>~1x</td><td>all-gather весов</td><td>Средняя</td></tr>
<tr><td>Tensor Parallel</td><td>~1/TP-size</td><td>all-reduce каждой матрицы</td><td>Высокая</td></tr>
<tr><td>Pipeline Parallel</td><td>~1/PP-size</td><td>send/recv между стадиями</td><td>Высокая</td></tr>
</table>

<h4>Фреймворки и инструменты</h4>
<ul>
<li><b>DeepSpeed</b> — Microsoft, лучший ZeRO, ZeRO-Infinity, MoE.</li>
<li><b>Megatron-LM</b> — NVIDIA, tensor/pipeline parallelism, основа для GPT-подобных.</li>
<li><b>FairScale</b> — исторически от Meta, сейчас функции в FSDP.</li>
<li><b>Accelerate</b> (HuggingFace) — обёртка над DDP/FSDP/DeepSpeed, минимум кода.</li>
<li><b>PyTorch Lightning / Ray Train</b> — high-level оркестрация.</li>
</ul>

<h4>Runtime в Kubernetes</h4>
<ul>
<li><b>Kubeflow Training Operator</b>: <code>PyTorchJob</code>, <code>MPIJob</code> — запускает N подов с координацией через torch.distributed или MPI.</li>
<li><b>Volcano</b> — gang scheduling: либо запускается все N подов сразу, либо никто (иначе deadlock).</li>
<li><b>NCCL</b> — библиотека коммуникаций, нужен NVIDIA Network Operator для RDMA/InfiniBand.</li>
</ul>`,
  },
  {
    text: 'Quantization для LLM-inference: GPTQ, AWQ, GGUF, INT8, INT4',
    answer: `<p><b>Quantization</b> — снижение битности весов модели (fp32/fp16 → int8/int4). Цель: уменьшить размер модели и ускорить inference с минимальной потерей качества.</p>

<h4>Зачем квантовать</h4>
<ul>
<li><b>Память:</b> Llama-3 70B в fp16 = 140 ГБ, в int4 = ~40 ГБ → помещается в одну A100 80GB.</li>
<li><b>Throughput:</b> меньше memory bandwidth → быстрее декодинг. Для LLM на single-batch int4 бывает 2–3× быстрее fp16.</li>
<li><b>Cost:</b> в разы дешевле GPU или полный переход на CPU-inference.</li>
</ul>

<h4>Типы квантования</h4>
<table>
<tr><th>Тип</th><th>Описание</th><th>Качество</th></tr>
<tr><td><b>INT8 (dynamic)</b></td><td>Веса и активации в int8, scale вычисляется на лету</td><td>Минимальная потеря</td></tr>
<tr><td><b>INT8 (static / PTQ)</b></td><td>Post-training с калибровкой на sample данных</td><td>1–2% drop</td></tr>
<tr><td><b>INT4 (GPTQ)</b></td><td>Layer-by-layer quantization через Hessian-based optimization</td><td>2–5% drop</td></tr>
<tr><td><b>INT4 (AWQ)</b></td><td>Activation-aware: защита важных весов от квантования</td><td>~1–3% drop, обычно лучше GPTQ</td></tr>
<tr><td><b>INT4/INT2 (bitsandbytes NF4)</b></td><td>Normal Float 4, используется в QLoRA</td><td>Для fine-tuning отлично</td></tr>
<tr><td><b>QAT (Quantization-Aware Training)</b></td><td>Учитывает квантование во время обучения</td><td>Лучшее качество, дорого</td></tr>
</table>

<h4>Форматы файлов</h4>
<ul>
<li><b>GGUF (Georgi Gerganov Universal Format)</b> — для llama.cpp. Смешанные кванты по слоям (Q4_K_M, Q5_K_S, Q8_0). CPU/GPU inference.</li>
<li><b>GPTQ (.safetensors)</b> — для GPU, работает с vLLM, TGI, exllama.</li>
<li><b>AWQ</b> — аналогично GPTQ, поддерживается vLLM и TensorRT-LLM.</li>
<li><b>MLX</b> — формат Apple Silicon.</li>
</ul>

<h4>Практический выбор</h4>
<ul>
<li><b>Llama 70B на 1× A100 80GB:</b> AWQ int4 через vLLM.</li>
<li><b>Llama 8B на RTX 4090:</b> fp16 влезает, quant не нужен для качества.</li>
<li><b>Локально на MacBook / CPU:</b> GGUF Q4_K_M через llama.cpp или Ollama.</li>
<li><b>Edge / mobile:</b> int8 через ONNX Runtime или TFLite.</li>
</ul>

<h4>Как оценивать после квантования</h4>
<ol>
<li><b>Perplexity</b> на тестовом корпусе — грубая оценка деградации.</li>
<li><b>MMLU / HellaSwag / TruthfulQA</b> benchmarks — академическое качество.</li>
<li><b>Domain-specific eval:</b> свои 100–500 промптов с ground truth.</li>
<li><b>LLM-as-judge</b> (pairwise comparison) — сравнить quantized vs fp16.</li>
</ol>

<h4>Сочетание с другими оптимизациями</h4>
<ul>
<li><b>Speculative decoding:</b> маленькая quantized модель-драфтер + большая основная.</li>
<li><b>KV-cache quantization:</b> Q8 KV-cache удваивает context length при той же VRAM.</li>
<li><b>FlashAttention + quant:</b> совместимо, даёт кумулятивное ускорение.</li>
</ul>

<h4>Частые грабли</h4>
<ul>
<li>Квантовать модель и не проверить качество на реальных задачах. Для агентов и function-calling просадка бывает драматичнее, чем на perplexity.</li>
<li>GPTQ для слишком маленьких моделей (&lt; 3B) — потери могут быть 10%+.</li>
<li>Смешать квантованные веса с fp16 activations неправильно — overflow.</li>
</ul>`,
  },
  {
    text: 'Сравнение vector DB: Pinecone, Weaviate, Qdrant, Milvus, pgvector, Chroma',
    answer: `<p>Vector DB — база для хранения embeddings и поиска ближайших соседей (ANN — Approximate Nearest Neighbor). Основа для RAG и semantic search.</p>

<h4>Что сравнивать</h4>
<ul>
<li>Поддерживаемые алгоритмы ANN: HNSW, IVF, ScaNN, FAISS.</li>
<li>Hybrid search (dense + sparse / BM25).</li>
<li>Filtering metadata и payload (pre/post filter).</li>
<li>Масштаб: миллионы vs миллиарды векторов.</li>
<li>Latency p95/p99 при требуемом recall (например, recall@10 = 0.95).</li>
<li>Модель деплоя: SaaS, self-hosted k8s, встраиваемая.</li>
</ul>

<h4>Сравнительная таблица</h4>
<table>
<tr><th>DB</th><th>Деплой</th><th>Алгоритм</th><th>Hybrid</th><th>Когда выбрать</th></tr>
<tr><td><b>Pinecone</b></td><td>SaaS only</td><td>Proprietary</td><td>Да (sparse-dense)</td><td>Не хочешь инфру, готов платить, миллиарды векторов</td></tr>
<tr><td><b>Weaviate</b></td><td>Self-hosted / Cloud</td><td>HNSW</td><td>Да (BM25+vector)</td><td>Нужна GraphQL, встроенные vectorizer-модули</td></tr>
<tr><td><b>Qdrant</b></td><td>Self-hosted / Cloud</td><td>HNSW</td><td>Да (sparse+dense)</td><td>Rust-быстрый, отличные фильтры, k8s-friendly</td></tr>
<tr><td><b>Milvus</b></td><td>Self-hosted / Zilliz Cloud</td><td>HNSW, IVF, DiskANN</td><td>Да</td><td>Миллиарды векторов, enterprise</td></tr>
<tr><td><b>pgvector</b></td><td>Постgres extension</td><td>HNSW, IVFFlat</td><td>Да (FTS + vector)</td><td>Уже есть Postgres, до ~10M векторов</td></tr>
<tr><td><b>ChromaDB</b></td><td>Embedded / local</td><td>HNSW</td><td>Базовый</td><td>Прототипы, local dev, RAG в одном процессе</td></tr>
<tr><td><b>Elasticsearch / OpenSearch</b></td><td>Self-hosted</td><td>HNSW</td><td>Да (BM25+vector)</td><td>Уже есть ES в стеке, нужен hybrid search</td></tr>
<tr><td><b>Vespa</b></td><td>Self-hosted</td><td>HNSW</td><td>Да, первоклассный</td><td>Ranking pipeline, серьёзный hybrid search в проде</td></tr>
</table>

<h4>HNSW — де-факто стандарт</h4>
<p>Hierarchical Navigable Small World: граф из векторов с логарифмическим поиском. Параметры:</p>
<ul>
<li><code>M</code> — кол-во соседей (обычно 16–32).</li>
<li><code>ef_construction</code> — качество построения индекса (100–500).</li>
<li><code>ef_search</code> — trade-off latency vs recall на запросе.</li>
</ul>

<h4>Типичная архитектура</h4>
<pre><code>Document → chunker → embedding model (text-embedding-3, BGE, E5)
  → vector DB (upsert)

Query → embedding → vector DB (search top-K)
  → rerank (Cohere Rerank / cross-encoder)
  → LLM с контекстом</code></pre>

<h4>Нюансы для production</h4>
<ul>
<li><b>Payload filters:</b> если фильтруешь по tenant_id, проверь, что DB умеет pre-filter (Qdrant, Weaviate) а не post-filter — иначе ухудшается recall.</li>
<li><b>Consistency</b> при обновлениях: Pinecone/Milvus — eventual, Qdrant умеет strict.</li>
<li><b>Re-indexing:</b> смена embedding модели требует перегенерации всех векторов.</li>
<li><b>Cost per million vectors:</b> Pinecone дорогой, Qdrant/Weaviate self-hosted сильно дешевле.</li>
<li><b>Quantization vectors:</b> Qdrant/Milvus поддерживают scalar/binary quantization — до 32× экономии RAM.</li>
</ul>

<h4>Как выбрать за 30 секунд</h4>
<ol>
<li>&lt; 1M векторов, уже на Postgres → <b>pgvector</b>.</li>
<li>Prototype / local RAG → <b>Chroma</b>.</li>
<li>Self-hosted, хочу Rust и быстрые фильтры → <b>Qdrant</b>.</li>
<li>Managed SaaS, не хочу devops → <b>Pinecone</b>.</li>
<li>Миллиарды, on-prem enterprise → <b>Milvus</b>.</li>
<li>Сложный hybrid search и ranking → <b>Vespa</b>.</li>
</ol>`,
  },
  {
    text: 'LLMOps vs MLOps — в чём разница и почему это важно',
    answer: `<p><b>LLMOps</b> — подмножество MLOps со своей спецификой: модели не тренируем с нуля (слишком дорого), работаем с foundation-моделями через промпты, fine-tuning или RAG.</p>

<h4>Ключевые отличия</h4>
<table>
<tr><th>Аспект</th><th>Classic MLOps</th><th>LLMOps</th></tr>
<tr><td>Артефакт</td><td>Модель + код + данные</td><td>Prompt + retrieval index + few-shot + модель (часто внешняя API)</td></tr>
<tr><td>Training</td><td>От нуля или transfer learning</td><td>Fine-tuning (LoRA), RLHF, DPO, или совсем без обучения</td></tr>
<tr><td>Эксперименты</td><td>Гиперпараметры модели</td><td>Prompt variants, retrieval strategies, temperature, top-p</td></tr>
<tr><td>Evaluation</td><td>Accuracy, F1, RMSE</td><td>LLM-as-judge, RAGAS, TruLens, human eval, rubrics</td></tr>
<tr><td>Serving</td><td>REST на своих инстансах</td><td>Внешняя API (OpenAI, Anthropic) или vLLM/TGI self-hosted</td></tr>
<tr><td>Cost driver</td><td>GPU-время на training</td><td>Токены на inference; у больших моделей единицы-десятки USD за 1M токенов</td></tr>
<tr><td>Latency concern</td><td>p95 latency запроса</td><td>Time-to-First-Token (TTFT), тоkens/sec, context length</td></tr>
<tr><td>Monitoring</td><td>Data drift, accuracy</td><td>Hallucination rate, toxicity, prompt injection, semantic drift, cost per query</td></tr>
<tr><td>Security</td><td>Data exfiltration, adversarial</td><td>Prompt injection, jailbreaks, PII leakage, data exfiltration через RAG</td></tr>
</table>

<h4>Уникальные задачи LLMOps</h4>
<ul>
<li><b>Prompt versioning:</b> промпт — артефакт продукта. Хранить в git, тестировать регрессии.</li>
<li><b>Prompt A/B tests:</b> сравнение промптов на production-трафике, измерение качества и стоимости.</li>
<li><b>RAG pipeline ops:</b> re-indexing, chunk size tuning, retrieval eval.</li>
<li><b>LLM gateway:</b> единая прокси (LiteLLM, Portkey) для нескольких провайдеров, с fallback и rate-limiting.</li>
<li><b>Token budgeting:</b> alerts на cost per tenant, hard limits.</li>
<li><b>Output guardrails:</b> фильтры на PII, toxic content, schema validation JSON-ответов.</li>
<li><b>Caching:</b> semantic cache (похожие вопросы — готовый ответ) снижает стоимость в разы.</li>
</ul>

<h4>Типичный LLMOps-стек</h4>
<ul>
<li><b>Gateway:</b> LiteLLM, Portkey, Helicone.</li>
<li><b>Framework:</b> LangChain, LlamaIndex, Haystack, DSPy.</li>
<li><b>Prompt management:</b> PromptLayer, Langfuse, Helicone, Arize Phoenix.</li>
<li><b>Evaluation:</b> RAGAS, TruLens, DeepEval, Promptfoo.</li>
<li><b>Observability:</b> Langfuse, Arize Phoenix, LangSmith.</li>
<li><b>Self-hosted inference:</b> vLLM, TGI, Triton+TensorRT-LLM, SGLang.</li>
<li><b>Vector DB:</b> Pinecone, Qdrant, Weaviate, pgvector.</li>
<li><b>Fine-tuning:</b> Axolotl, LLaMA-Factory, Unsloth, HuggingFace TRL.</li>
</ul>

<h4>Когда LLMOps становится нужен</h4>
<ul>
<li>В продукте 3+ разных промптов/агентов и их поведение нужно мерить.</li>
<li>Стоимость токенов &gt; 1000 USD/месяц — начинай считать.</li>
<li>Регуляторка / compliance — нужен audit trail.</li>
<li>Два и более LLM-провайдеров (multi-vendor стратегия).</li>
</ul>`,
  },
  {
    text: 'Fine-tuning vs RAG vs Prompt Engineering — когда что использовать?',
    answer: `<p>Три инструмента адаптировать LLM под задачу. Выбор зависит от того, чего модели не хватает: <i>знаний</i>, <i>формата</i> или <i>поведения</i>.</p>

<h4>Сравнительная таблица</h4>
<table>
<tr><th>Подход</th><th>Решает</th><th>Стоимость</th><th>Latency</th><th>Обновление знаний</th></tr>
<tr><td><b>Prompt engineering</b></td><td>Формат, инструкции, few-shot</td><td>0 (только токены)</td><td>+instruction в каждом запросе</td><td>Мгновенно — поменяй промпт</td></tr>
<tr><td><b>RAG</b></td><td>Актуальные/внутренние знания</td><td>Embedding + vector DB</td><td>+retrieval (~50–200 ms)</td><td>Реиндексация документов</td></tr>
<tr><td><b>Fine-tuning (LoRA)</b></td><td>Стиль, формат, доменный язык</td><td>GPU-часы на training</td><td>Та же, что у base model</td><td>Нужен новый training run</td></tr>
<tr><td><b>Continued pre-training</b></td><td>Фундаментальные знания домена</td><td>Дни GPU-часов</td><td>Та же</td><td>Дорогое переобучение</td></tr>
</table>

<h4>Когда prompt engineering достаточно</h4>
<ul>
<li>Задача простая и есть few-shot примеры (3–10).</li>
<li>Модель уже знает домен.</li>
<li>Нужна быстрая итерация — изменил промпт, перезапустил.</li>
<li>Системы: <b>DSPy</b> оптимизирует промпты автоматически.</li>
</ul>

<h4>Когда нужен RAG</h4>
<ul>
<li>Ответы должны ссылаться на свежие / внутренние документы (runbooks, wiki, docs).</li>
<li>Нельзя допустить галлюцинаций — нужны citations.</li>
<li>Знания меняются часто — невыгодно переобучать.</li>
<li>Объём знаний превышает context window.</li>
<li><b>Ограничение:</b> RAG плохо учит <i>стиль</i> и <i>поведение</i>.</li>
</ul>

<h4>Когда нужен fine-tuning</h4>
<ul>
<li>Нужен специфичный формат вывода (JSON по схеме, XML, DSL).</li>
<li>Доменный язык (медицинские термины, код на внутреннем DSL).</li>
<li>Снизить стоимость: маленькая fine-tuned модель вместо GPT-5.</li>
<li>Latency: локальный 7B вместо API.</li>
<li><b>Техники:</b> LoRA, QLoRA (4-bit quant + LoRA), DPO, ORPO, RLHF.</li>
</ul>

<h4>Комбинация — часто лучший путь</h4>
<pre><code>Base Model
  ↓ continued pre-training  (домен знаний)
Domain Model
  ↓ fine-tuning (SFT/DPO)   (инструкции/стиль)
Instruction Model
  ↓ RAG                     (свежие/tenant-specific факты)
  ↓ Prompt engineering      (финальная инструкция)
Production Response</code></pre>

<h4>Decision tree</h4>
<ol>
<li>Работает ли базовая модель с хорошим промптом? → <b>Стоп, используй prompt.</b></li>
<li>Нужны специфические знания, которых нет в модели? → <b>RAG.</b></li>
<li>Выход должен быть в жёстком формате или на доменном языке? → <b>Fine-tuning.</b></li>
<li>Нужна другая стоимость/latency? → <b>Small fine-tuned model</b> вместо API.</li>
</ol>

<h4>Антипаттерны</h4>
<ul>
<li><b>Fine-tune на fresh data</b> — знания быстро устаревают, лучше RAG.</li>
<li><b>RAG вместо instructions</b> — запихивание инструкций в retrieval даёт плохое качество.</li>
<li><b>QLoRA на датасете из 50 примеров</b> — модель переобучится и деградирует на общих задачах.</li>
<li><b>Игнорировать evaluation</b> — fine-tuning без benchmark = полёт вслепую.</li>
</ul>`,
  },
  {
    text: 'Безопасность LLM: prompt injection, guardrails и защита production',
    answer: `<p>LLM-приложения получают новые угрозы: пользовательский ввод — одновременно и данные, и код (инструкции). Классический OWASP тут мало помогает, но <b>OWASP Top 10 for LLM</b> уже есть.</p>

<h4>Основные угрозы (OWASP LLM Top 10)</h4>
<ul>
<li><b>LLM01 — Prompt Injection:</b> пользователь вставляет «Ignore previous instructions and...». Direct injection через промпт, indirect — через документы в RAG.</li>
<li><b>LLM02 — Insecure Output Handling:</b> LLM вернул JS — ты его eval. LLM вернул SQL — ты выполняешь. LLM вернул URL — пользователь переходит.</li>
<li><b>LLM03 — Training Data Poisoning.</b></li>
<li><b>LLM04 — Model Denial of Service:</b> huge context window → дорого для провайдера.</li>
<li><b>LLM05 — Supply Chain:</b> скачал модель с HuggingFace, а там backdoor.</li>
<li><b>LLM06 — Sensitive Information Disclosure:</b> модель выдала PII из training или из RAG-корпуса.</li>
<li><b>LLM07 — Insecure Plugin Design:</b> агент с tools = attack surface.</li>
<li><b>LLM08 — Excessive Agency:</b> агент имеет права удалять, писать в БД — и делает это по чужой команде.</li>
<li><b>LLM09 — Overreliance:</b> доверять LLM там, где нужна детерминированная логика.</li>
<li><b>LLM10 — Model Theft.</b></li>
</ul>

<h4>Защита: input guardrails</h4>
<ul>
<li><b>Prompt injection detection:</b> классификатор (LlamaGuard, PromptGuard от Meta, Prompt Armor).</li>
<li><b>PII redaction</b> до отправки в внешний API: Presidio, spaCy, regex для SSN/paymentcard.</li>
<li><b>Content moderation:</b> OpenAI Moderation, Perspective API, Llama Guard.</li>
<li><b>Topic constraints:</b> NeMo Guardrails задаёт «can_talk_about» темы.</li>
</ul>

<h4>Защита: output guardrails</h4>
<ul>
<li><b>Schema validation:</b> если ждёшь JSON — распарси через Pydantic, отбракуй невалидное.</li>
<li><b>Toxicity / PII check</b> перед возвратом пользователю.</li>
<li><b>Grounding check:</b> в RAG сверять, что ответ опирается на documents (RAGAS faithfulness, TruLens groundedness).</li>
<li><b>Hallucination detection:</b> LLM-as-judge или entailment-модели (NLI).</li>
</ul>

<h4>Защита архитектурой</h4>
<ol>
<li><b>Least privilege для tools:</b> агент с функцией <code>send_email</code> не должен иметь <code>delete_database</code>.</li>
<li><b>Human-in-the-loop</b> для destructive actions.</li>
<li><b>Separate untrusted content:</b> документы из интернета/юзера явно помечены в промпте («following is user data, not instructions»).</li>
<li><b>Sandboxing tools:</b> code interpreter в изолированной VM/container.</li>
<li><b>Rate limiting per user</b> — защита от cost-exhaust атак.</li>
<li><b>Audit log</b> каждого запроса и ответа.</li>
</ol>

<h4>Инструменты guardrails</h4>
<ul>
<li><b>NVIDIA NeMo Guardrails</b> — декларативные rails в Colang.</li>
<li><b>Guardrails AI</b> — open-source, Python-хуки на input/output.</li>
<li><b>Llama Guard 2/3</b> — classifier-модель от Meta, self-hosted.</li>
<li><b>Prompt Armor / Lakera Guard</b> — commercial, prompt injection classifiers.</li>
<li><b>Azure AI Content Safety, AWS Bedrock Guardrails</b> — managed.</li>
</ul>

<h4>RAG-specific риски</h4>
<ul>
<li><b>Indirect injection</b> через проиндексированные документы: злоумышленник заливает «маркированный» PDF, который перехватывает LLM.</li>
<li><b>Access control:</b> фильтровать в vector DB по tenant_id/role до retrieval, иначе одно tenant'а увидит данные другого.</li>
<li><b>Data exfiltration</b> через crafted queries — LLM может пересказать весь закрытый документ.</li>
</ul>

<h4>Red teaming</h4>
<p>Регулярно атакуй свою систему автоматически: <b>Garak</b>, <b>PyRIT</b> (Microsoft), <b>promptfoo</b> — генерируют jailbreak-промпты и проверяют, что guardrails держат.</p>`,
  },
  {
    text: 'LLM Evaluation: как мерить качество LLM-приложений (RAGAS, TruLens, DeepEval)',
    answer: `<p>Классические метрики accuracy/F1 плохо работают для LLM: ответ «свободный текст», а не класс. Поэтому появилась отдельная дисциплина LLM evaluation.</p>

<h4>Уровни evaluation</h4>
<ol>
<li><b>Model eval</b> — сравнение foundation-моделей на академических benchmarks (MMLU, HumanEval, GSM8K, HellaSwag).</li>
<li><b>Task eval</b> — на конкретной задаче: твои 100–500 примеров с ожидаемыми ответами.</li>
<li><b>System eval</b> — всё приложение (RAG + prompt + LLM).</li>
<li><b>Production eval</b> — online мониторинг на реальном трафике.</li>
</ol>

<h4>Методы оценки</h4>
<ul>
<li><b>Reference-based (есть ground truth):</b> BLEU, ROUGE — устарели для LLM, дают шум. Лучше — semantic similarity (cosine on embeddings), или LLM-as-judge.</li>
<li><b>Reference-free:</b> коэффициенты качества без эталона — faithfulness, relevance, coherence.</li>
<li><b>LLM-as-judge:</b> другая модель (или та же, но сильнее) оценивает ответ по rubric. GPT-4/Claude как judge — standard practice.</li>
<li><b>Pairwise comparison:</b> судья сравнивает два ответа (A лучше B?) — точнее, чем абсолютная оценка.</li>
<li><b>Human eval:</b> golden standard, но дорого и медленно. Применяют для калибровки judge-моделей.</li>
</ul>

<h4>RAG-специфичные метрики (RAGAS)</h4>
<ul>
<li><b>Faithfulness (Groundedness):</b> ответ основан на retrieved контексте, а не выдуман.</li>
<li><b>Answer Relevance:</b> ответ релевантен вопросу.</li>
<li><b>Context Precision:</b> сколько из retrieved chunks реально полезны.</li>
<li><b>Context Recall:</b> retrieved chunks покрывают ground truth факты.</li>
<li><b>Context Entities Recall:</b> важные сущности сохранены в ответе.</li>
</ul>

<h4>Agent-специфичные метрики</h4>
<ul>
<li><b>Tool selection accuracy:</b> выбран ли правильный tool.</li>
<li><b>Tool argument correctness:</b> аргументы корректны и достаточны.</li>
<li><b>Trajectory eval:</b> последовательность шагов привела к цели.</li>
<li><b>Task success rate:</b> end-to-end задача решена.</li>
</ul>

<h4>Инструменты</h4>
<table>
<tr><th>Tool</th><th>Специализация</th></tr>
<tr><td><b>RAGAS</b></td><td>RAG metrics, интеграция с LangChain/LlamaIndex</td></tr>
<tr><td><b>TruLens</b></td><td>RAG feedback functions, observability</td></tr>
<tr><td><b>DeepEval</b></td><td>Pytest-стиль для LLM, 40+ метрик</td></tr>
<tr><td><b>Promptfoo</b></td><td>Prompt regression testing, matrix runs</td></tr>
<tr><td><b>Arize Phoenix / Langfuse / LangSmith</b></td><td>Observability + eval в проде</td></tr>
<tr><td><b>OpenAI Evals</b></td><td>Framework от OpenAI</td></tr>
<tr><td><b>HELM (Stanford)</b></td><td>Масштабный академический benchmark</td></tr>
</table>

<h4>Практический процесс</h4>
<ol>
<li><b>Golden dataset:</b> 100–500 curated примеров с ground truth. Обновляется по мере нахождения багов.</li>
<li><b>CI eval:</b> при каждом изменении промпта/модели прогонять golden set, сравнивать с baseline.</li>
<li><b>Production sampling:</b> 1–5% запросов попадают в eval pipeline, оцениваются LLM-as-judge + алерты.</li>
<li><b>Regression gate:</b> релиз не проходит, если score упал больше чем на X% на golden set.</li>
</ol>

<h4>Частые ошибки</h4>
<ul>
<li><b>Использовать ту же модель как judge</b>, что и как generator — positional bias и overrate.</li>
<li><b>Маленький eval set</b> (&lt; 50 примеров) — шум превышает сигнал.</li>
<li><b>Eval только на happy path</b> — упустишь edge cases.</li>
<li><b>Нет human calibration</b> для LLM-as-judge — судья может систематически ошибаться.</li>
</ul>`,
  },
  {
    text: 'Оптимизация стоимости LLM inference в production',
    answer: `<p>LLM в проде — часто самая дорогая строка в P&amp;L. Десятки и сотни USD за миллион токенов × миллионы запросов = серьёзные бюджеты. Разбираем уровни оптимизации.</p>

<h4>1. Выбор модели по задаче (model routing)</h4>
<ul>
<li>Не все запросы требуют самой мощной модели. Простые — на Haiku/3.5-Sonnet, сложные — на Opus.</li>
<li><b>Semantic router</b>: классификатор (на маленькой модели или embedding + threshold) определяет сложность и маршрутизирует.</li>
<li>Экономия 5–10× для mixed-workload.</li>
</ul>

<h4>2. Prompt optimization</h4>
<ul>
<li>Убрать лишние few-shot примеры — каждый съедает токены на <i>каждый</i> запрос.</li>
<li>Сжатие промптов: LLMLingua, AutoCompressors. До 20× compression ratio.</li>
<li>Вынос статичных инструкций в system message (кешируется у провайдера).</li>
</ul>

<h4>3. Prompt caching</h4>
<ul>
<li><b>Anthropic prompt caching, OpenAI / Google prompt caching</b> — кеш статической части контекста (до 90% дешевле на кешированных токенах).</li>
<li>Идеально для длинных system prompts и RAG-контекстов, которые повторяются.</li>
<li><b>TTL</b> обычно 5 минут — стройте workload так, чтобы попадать в окно.</li>
</ul>

<h4>4. Semantic caching</h4>
<ul>
<li>Embedding запроса → поиск в vector DB → если есть похожий (cosine &gt; 0.95) → возврат сохранённого ответа.</li>
<li>Инструменты: GPTCache, Redis-based semantic cache.</li>
<li>Экономия: для support-ботов с повторяющимися вопросами — 30–70%.</li>
<li><b>Осторожно:</b> неточная семантика → возврат неверного ответа. Нужны высокие пороги.</li>
</ul>

<h4>5. Batching и continuous batching (self-hosted)</h4>
<ul>
<li><b>vLLM, TGI, SGLang</b> делают continuous batching — на лету объединяют запросы, нет простоя GPU.</li>
<li>Throughput выше в 2–4× vs naive serving.</li>
</ul>

<h4>6. Quantization и distillation</h4>
<ul>
<li>INT4 / INT8 — меньше VRAM, быстрее, дешевле.</li>
<li>Distillation: обучить маленькую модель имитировать большую. На свой домен — иногда 3B заменяет 70B без потерь.</li>
</ul>

<h4>7. Speculative decoding</h4>
<ul>
<li>Маленькая draft-модель предлагает токены, большая подтверждает пакетом.</li>
<li>Ускорение 2–3× для latency, та же стоимость в tokens.</li>
</ul>

<h4>8. Output length control</h4>
<ul>
<li><b>max_tokens</b>: не давай модели писать сочинения, если нужен JSON.</li>
<li>Structured output (grammar/JSON schema) сокращает токены и убирает болтовню.</li>
<li>«Be concise» в system prompt — экономит 20–30%.</li>
</ul>

<h4>9. Context management в chat</h4>
<ul>
<li>Не отправлять всю историю каждый раз. Суммаризируй старые сообщения.</li>
<li>Sliding window: последние N сообщений + summary до них.</li>
<li>Экономия растёт с длиной сессии квадратично.</li>
</ul>

<h4>10. Multi-provider strategy</h4>
<ul>
<li>Gateway (LiteLLM, Portkey, Helicone) маршрутизирует по цене, доступности, SLA.</li>
<li>Spot instances на self-hosted inference.</li>
<li>Fallback на дешёвый провайдер при сбоях — не копим rate-limit errors.</li>
</ul>

<h4>11. Observability стоимости</h4>
<ul>
<li><b>Cost per user / tenant / feature</b> — детализированный трекинг.</li>
<li>Hard limits на пользователя / организацию, чтобы один запрос с длинным контекстом не сжёг бюджет.</li>
<li>Alert на spike спроса.</li>
<li>Инструменты: Langfuse, Helicone, Arize Phoenix — каждый запрос с usage токенов и USD.</li>
</ul>

<h4>Порядок применения</h4>
<ol>
<li><b>Инструментация и baseline</b> — меряй cost-per-request.</li>
<li><b>Prompt caching</b> — быстрая win на 50–90% от статической части.</li>
<li><b>Model routing</b> — кардинально снижает средний cost.</li>
<li><b>Structured outputs + max_tokens</b> — бесплатная экономия.</li>
<li><b>Semantic caching</b> — если трафик повторяется.</li>
<li><b>Self-hosting / quantization</b> — при больших объёмах.</li>
</ol>`,
  },
  {
    text: 'Data Validation для ML-пайплайнов: Great Expectations, Deepchecks, TFDV',
    answer: `<p>Модель — это <i>data-dependent software</i>. Сломанные данные ломают pipeline тихо: без ошибок exception'а, но с деградацией качества. Data validation — контрактные тесты на данные между стадиями pipeline.</p>

<h4>Что проверяется</h4>
<ul>
<li><b>Schema:</b> имена колонок, типы, nullable.</li>
<li><b>Ranges:</b> <code>age ∈ [0, 120]</code>, <code>price &gt; 0</code>.</li>
<li><b>Distributions:</b> mean, std, квантили в пределах историй.</li>
<li><b>Cardinality:</b> unique-значения категориальных фичей (если вдруг новая категория — alert).</li>
<li><b>Missing rate:</b> доля null не изменилась резко.</li>
<li><b>Uniqueness / PK:</b> дубликатов нет.</li>
<li><b>Referential integrity:</b> <code>user_id</code> в events существует в users.</li>
<li><b>Time coherence:</b> timestamps монотонные, нет «ответов до запросов».</li>
</ul>

<h4>Где размещать проверки</h4>
<ol>
<li><b>Ingestion:</b> сырые данные из источника. Схема контрактна с upstream.</li>
<li><b>После cleaning:</b> проверка, что очистка не сломала больше, чем починила.</li>
<li><b>Перед training:</b> финальный набор фичей соответствует baseline.</li>
<li><b>Перед serving (real-time):</b> каждый запрос валидируется — защита от garbage-in.</li>
</ol>

<h4>Инструменты</h4>
<table>
<tr><th>Tool</th><th>Сильные стороны</th><th>Minусы</th></tr>
<tr><td><b>Great Expectations</b></td><td>Огромная библиотека проверок, Data Docs (HTML-отчёты), Airflow/dbt плагины</td><td>Сложный для простых кейсов, много boilerplate</td></tr>
<tr><td><b>Deepchecks</b></td><td>ML-ориентированный: drift, leakage, train-test contamination</td><td>Моложе, меньше community</td></tr>
<tr><td><b>TFDV (TensorFlow Data Validation)</b></td><td>Встроен в TFX, отлично с протоколом schema</td><td>Привязан к TFX-стеку</td></tr>
<tr><td><b>Pandera</b></td><td>Pythonic, schema как Python-класс, dataframe-native</td><td>Только pandas/polars</td></tr>
<tr><td><b>Soda Core / Soda Cloud</b></td><td>Data quality для warehouses (Snowflake, BigQuery), SQL-first</td><td>Warehouse-focused, не для ML-фичей</td></tr>
<tr><td><b>dbt tests</b></td><td>Если ты уже на dbt — встроенные generic tests и custom SQL</td><td>Ограничен SQL</td></tr>
</table>

<h4>Great Expectations — пример</h4>
<pre><code>import great_expectations as gx

context = gx.get_context()
validator = context.sources.pandas_default.read_parquet("s3://data/train.parquet")

validator.expect_column_values_to_be_between("age", 0, 120)
validator.expect_column_values_to_not_be_null("user_id")
validator.expect_column_mean_to_be_between("price", 100, 500)
validator.expect_column_distinct_values_to_be_in_set(
    "country", ["KZ", "RU", "US", "DE"])

result = validator.validate()
if not result.success:
    raise ValueError("Data validation failed")</code></pre>

<h4>Пример Pandera schema</h4>
<pre><code>import pandera as pa
from pandera.typing import Series

class TrainSchema(pa.DataFrameModel):
    user_id: Series[int] = pa.Field(unique=True, ge=0)
    age: Series[int] = pa.Field(in_range={"min_value": 0, "max_value": 120})
    country: Series[str] = pa.Field(isin=["KZ", "RU", "US", "DE"])
    target: Series[int] = pa.Field(isin=[0, 1])

TrainSchema.validate(df)</code></pre>

<h4>Drift vs validation — разница</h4>
<ul>
<li><b>Validation</b> — static правила, которые не должны нарушаться <i>никогда</i>. Сработал — fail pipeline.</li>
<li><b>Drift detection</b> — сравнение распределений train vs production. Сработал — retrain, не fail.</li>
</ul>

<h4>Best practices</h4>
<ul>
<li>Генерируй schema из reference dataset, ревьюй руками, коммить в git.</li>
<li>Fail-fast: нарушение на ingestion стадии → pipeline падает, уведомление owner данных.</li>
<li>Soft vs hard checks: distribution drift — warning, schema mismatch — error.</li>
<li>Data Docs публикуй в Confluence / интранет — команда видит state данных.</li>
</ul>`,
  },
  {
    text: 'Serving comparison: KServe vs Seldon Core vs BentoML vs Triton',
    answer: `<p>Четыре основных production-serving решения, каждое со своим фокусом.</p>

<h4>Сравнение</h4>
<table>
<tr><th>Критерий</th><th>KServe</th><th>Seldon Core</th><th>BentoML</th><th>Triton</th></tr>
<tr><td>Модель</td><td>K8s CRD</td><td>K8s CRD</td><td>Python SDK + OCI</td><td>Standalone server</td></tr>
<tr><td>Backends</td><td>TF, PyTorch, XGBoost, ONNX, Triton, vLLM</td><td>Всё что в контейнере + pre-built servers</td><td>Любой Python ML</td><td>TF, PyTorch, ONNX, TensorRT, OpenVINO</td></tr>
<tr><td>Autoscale</td><td>Knative scale-to-zero</td><td>HPA + KEDA</td><td>HPA через Yatai</td><td>HPA</td></tr>
<tr><td>Model composition</td><td>Transformer + Predictor + Explainer</td><td>Inference graphs (A/B, ensemble)</td><td>Services с pipeline</td><td>Ensemble pipeline</td></tr>
<tr><td>Canary / A/B</td><td>Встроенный traffic split</td><td>Встроенный MAB</td><td>Через ingress / Yatai</td><td>Через ingress</td></tr>
<tr><td>Explainability</td><td>Alibi, Captum</td><td>Alibi integration</td><td>Сам пишешь</td><td>Через custom backend</td></tr>
<tr><td>LLM focus</td><td>vLLM runtime, Hugging Face</td><td>LLM Module</td><td>OpenLLM, vLLM integration</td><td>TensorRT-LLM backend</td></tr>
</table>

<h4>KServe (ex KFServing)</h4>
<ul>
<li><b>Философия:</b> serverless inference для Kubernetes. Scale-to-zero из коробки через Knative.</li>
<li><b>Pre-built servers:</b> sklearn, XGBoost, PyTorch, TF, ONNX, HuggingFace, vLLM.</li>
<li><b>Сильно:</b> canary, traffic split, transformer+predictor+explainer графы.</li>
<li><b>Когда выбрать:</b> Kubeflow-стек, много моделей разных типов, нужен autoscale 0↔N.</li>
</ul>

<pre><code>apiVersion: serving.kserve.io/v1beta1
kind: InferenceService
metadata:
  name: llama-8b
spec:
  predictor:
    model:
      modelFormat:
        name: huggingface
      args: ["--model_id=meta-llama/Llama-3.1-8B-Instruct"]
      resources:
        limits:
          nvidia.com/gpu: "1"
    canaryTrafficPercent: 10</code></pre>

<h4>Seldon Core</h4>
<ul>
<li><b>Философия:</b> inference graphs — A/B, MAB, shadow, ensemble как first-class concept.</li>
<li><b>v1</b> (старый) vs <b>v2 (MLServer)</b> — v2 rewrite, compatible с KServe API.</li>
<li><b>Сильно:</b> операционно богатые сценарии — outlier detection, drift, explanations в одном графе.</li>
<li><b>Когда выбрать:</b> нужна серьёзная оркестрация нескольких моделей/компонентов inference.</li>
</ul>

<h4>BentoML</h4>
<ul>
<li><b>Философия:</b> pythonic — упаковываешь модель в «Bento» (OCI-образ) с одним YAML.</li>
<li><b>Сильно:</b> DS-friendly, от локального теста до k8s deploy без переписывания.</li>
<li><b>Yatai / BentoCloud</b> — managed платформа для scaled deploy.</li>
<li><b>Когда выбрать:</b> команда из DS, быстрый time-to-production, меньше k8s YAML.</li>
</ul>

<pre><code>import bentoml

@bentoml.service(resources={"gpu": 1})
class ChurnPredictor:
    def __init__(self):
        self.model = bentoml.sklearn.load_model("churn:latest")

    @bentoml.api
    def predict(self, features: list[float]) -> float:
        return float(self.model.predict_proba([features])[0][1])</code></pre>

<h4>NVIDIA Triton</h4>
<ul>
<li><b>Философия:</b> high-performance inference server для GPU, backend-pluggable.</li>
<li><b>Сильно:</b> dynamic batching, concurrent model execution, TensorRT/TensorRT-LLM, Python backend, ensembles.</li>
<li><b>Минус:</b> сам по себе не k8s-native — используешь поверх KServe или kubeadm deployment.</li>
<li><b>Когда выбрать:</b> максимальный throughput на GPU, inference — узкое место.</li>
</ul>

<h4>LLM-specific layer</h4>
<ul>
<li><b>vLLM</b> — сам по себе сервер с OpenAI-compatible API. Лучшее throughput для LLM decoder'ов.</li>
<li><b>TGI (HF Text Generation Inference)</b> — production-ready с HF моделями.</li>
<li><b>SGLang</b> — быстрый runtime с advanced structured decoding.</li>
<li>Можно оборачивать в KServe как runtime.</li>
</ul>

<h4>Как выбрать за минуту</h4>
<ol>
<li>Kubernetes-first, много моделей разных типов, хочешь serverless → <b>KServe</b>.</li>
<li>Нужен сложный inference-граф (A/B + explainer + drift) → <b>Seldon v2</b>.</li>
<li>Python-команда, хочешь быстрый cycle dev→prod → <b>BentoML</b>.</li>
<li>Нужен максимальный throughput на NVIDIA GPU → <b>Triton</b> (часто внутри KServe).</li>
<li>Продакшен LLM — <b>vLLM</b> (standalone или в KServe).</li>
</ol>`,
  },
  {
    text: 'Model Explainability в production: SHAP, LIME, Captum и зачем это нужно',
    answer: `<p><b>Explainability</b> — способность объяснить, почему модель выдала конкретное предсказание. Критично для регулируемых индустрий (кредит, медицина, HR, страхование) и для отладки.</p>

<h4>Зачем в продакшене</h4>
<ul>
<li><b>Регуляторика:</b> GDPR «right to explanation», Equal Credit Opportunity Act, AI Act (EU).</li>
<li><b>Отладка:</b> модель ошиблась — понять, из-за какой фичи.</li>
<li><b>Bias detection:</b> выявить, что модель опирается на proxy для защищённых атрибутов.</li>
<li><b>Trust:</b> стейкхолдеры доверяют ответам, которые могут понять.</li>
<li><b>Feature engineering loop:</b> explainability показывает, какие фичи реально работают.</li>
</ul>

<h4>Global vs Local explanations</h4>
<ul>
<li><b>Global:</b> как модель работает в целом. Feature importance, permutation importance, PDP/ICE plots.</li>
<li><b>Local:</b> почему именно этому клиенту отказали. SHAP values, LIME, counterfactuals.</li>
</ul>

<h4>Ключевые методы</h4>
<table>
<tr><th>Метод</th><th>Что делает</th><th>Когда</th></tr>
<tr><td><b>SHAP</b></td><td>Shapley values из теории игр: вклад каждой фичи в предсказание</td><td>Универсальный стандарт для табличных</td></tr>
<tr><td><b>LIME</b></td><td>Локальная линейная аппроксимация вокруг точки</td><td>Быстрый local explain, текст и картинки</td></tr>
<tr><td><b>Integrated Gradients</b></td><td>Градиенты от baseline до точки (для DL)</td><td>Нейросети, картинки, текст</td></tr>
<tr><td><b>Captum</b></td><td>Библиотека методов для PyTorch (IG, GradCAM, DeepLift)</td><td>PyTorch-модели</td></tr>
<tr><td><b>Anchors</b></td><td>Правила «если X=a и Y=b, то 95% ответ Z»</td><td>Интерпретируемые правила</td></tr>
<tr><td><b>Counterfactuals</b></td><td>«Что изменить, чтобы получить другое решение»</td><td>Actionable explanations для юзеров</td></tr>
<tr><td><b>PDP / ICE</b></td><td>Partial Dependence Plots</td><td>Global взгляд на влияние фичи</td></tr>
</table>

<h4>SHAP в коде</h4>
<pre><code>import shap

# Для любой ML-модели
explainer = shap.TreeExplainer(xgb_model)  # или KernelExplainer, DeepExplainer
shap_values = explainer(X)

# Local explanation
shap.plots.waterfall(shap_values[0])

# Global feature importance
shap.plots.beeswarm(shap_values)

# В production: для каждого inference сохраняем top-5 SHAP-фичей
top_features = shap_values[0].values.argsort()[-5:]</code></pre>

<h4>Deployment explainability в production</h4>
<ul>
<li><b>KServe Explainer</b> — отдельный сервис рядом с predictor. Вызывается отдельным endpoint <code>/explain</code>.</li>
<li><b>Alibi</b> (Seldon) — production-ready реализации SHAP/LIME/Anchors/CF.</li>
<li><b>Pre-compute</b>: SHAP expensive — иногда считается async и отдаётся later.</li>
<li><b>Latency budget:</b> для интерактивного explain — SHAP TreeExplainer ~1–10 ms. KernelExplainer — секунды, не годится online.</li>
</ul>

<h4>Explainability для LLM</h4>
<ul>
<li><b>Attention visualization</b> — какие токены влияли. Носит ограниченную интерпретационную ценность.</li>
<li><b>Chain-of-Thought / reasoning traces</b> — модель сама объясняет, но может врать.</li>
<li><b>Source attribution в RAG:</b> citations на retrieved документы — самый практичный способ «объяснить».</li>
<li><b>Feature attribution via perturbation:</b> маскируем части промпта и смотрим изменение ответа.</li>
</ul>

<h4>Частые ошибки</h4>
<ul>
<li>Путать SHAP importance с <i>причинностью</i>. SHAP говорит о вкладе в предсказание, не о causal effect.</li>
<li>Использовать KernelExplainer на production латентности — CPU-heavy.</li>
<li>Отдавать SHAP values пользователю «как есть» — нужна адаптация в human-readable текст.</li>
<li>Explain чёрный ящик при требовании регулятора на interpretable model — иногда нужно просто логрегрессию или GAM, а не SHAP поверх нейросети.</li>
</ul>`,
  },
];

// Append new questions
let newId = maxId + 1;
let newNum = maxNum + 1;
for (const n of NEW) {
  data.questions.push({
    id: newId,
    category: CATEGORY,
    text: n.text,
    answer: n.answer,
    num: newNum,
  });
  newId++;
  newNum++;
}
console.log(`Appended ${NEW.length} new MLOps questions (id=${maxId + 1}..${newId - 1}, num=${maxNum + 1}..${newNum - 1})`);

// Serialize and replace in HTML
const newDataStr = JSON.stringify(data);
const newHtml = html.slice(0, jsonStart) + newDataStr + html.slice(endIdx);
writeFileSync(HTML_PATH, newHtml, 'utf-8');
console.log(`Written ${newHtml.length} bytes to ${HTML_PATH}`);
console.log(`AI/ML questions total: ${data.questions.filter(q => q.category === CATEGORY).length}`);
console.log(`Grand total: ${data.questions.length}`);
