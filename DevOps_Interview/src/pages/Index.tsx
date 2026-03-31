import { useState, useCallback, useEffect } from 'react';
import { useDevOpsData } from '@/hooks/use-devops-data';
import { Question, getQuestionsForCategory } from '@/lib/devops-data';
import Header from '@/components/Header';
import SearchCommand from '@/components/SearchCommand';
import VoiceOverlay from '@/components/VoiceOverlay';
import SectionCard from '@/components/SectionCard';
import QuestionList from '@/components/QuestionList';
import AnswerView from '@/components/AnswerView';
import { Loader2, Terminal, Mic, MicOff, AlertCircle } from 'lucide-react';
import { useAlwaysOnVoice } from '@/hooks/use-always-on-voice';

type View =
  | { type: 'home' }
  | { type: 'section'; index: number }
  | { type: 'answer'; question: Question; sectionIndex: number };

const Index = () => {
  const { data, loading, error } = useDevOpsData();
  const [view, setView] = useState<View>({ type: 'home' });
  const [searchOpen, setSearchOpen] = useState(false);

  // ====== ALWAYS-ON VOICE ======
  const voice = useAlwaysOnVoice();

  // Индекс выделенного элемента (раздел на home, вопрос в section)
  const [focusIdx, setFocusIdx] = useState(0);

  // Сброс focusIdx при смене view
  useEffect(() => {
    setFocusIdx(0);
  }, [view.type, view.type === 'section' ? (view as { index: number }).index : 0]);

  const handleSelectQuestion = useCallback((q: Question) => {
    if (!data) return;
    const secIdx = data.categories.indexOf(q.category);
    setView({ type: 'answer', question: q, sectionIndex: secIdx >= 0 ? secIdx : 0 });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [data]);

  const handleNavigateAnswer = useCallback((direction: -1 | 1) => {
    if (!data || view.type !== 'answer') return;
    const questions = getQuestionsForCategory(data, view.sectionIndex);
    const curIdx = questions.findIndex(q => q.id === view.question.id);
    const newIdx = curIdx + direction;
    if (newIdx >= 0 && newIdx < questions.length) {
      setView({ type: 'answer', question: questions[newIdx], sectionIndex: view.sectionIndex });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [data, view]);

  // --- Клавиатурная навигация ---
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      const isInput = ['INPUT', 'TEXTAREA'].includes(tag);

      // Если голосовой оверлей активен — пропускаем навигацию (VoiceOverlay сам обрабатывает)
      if (voice.query.trim().length > 0) return;

      // "/" или "V" — текстовый поиск
      if ((e.key === '/' || e.key === 'v' || e.key === 'V' || e.key === 'м' || e.key === 'М') && !isInput && !searchOpen) {
        e.preventDefault();
        setSearchOpen(true);
        return;
      }

      // Escape — закрыть поиск или назад
      if (e.key === 'Escape') {
        if (searchOpen) {
          setSearchOpen(false);
        } else {
          setView(prev => {
            if (prev.type === 'answer') return { type: 'section', index: prev.sectionIndex };
            if (prev.type === 'section') return { type: 'home' };
            return prev;
          });
        }
        return;
      }

      if (isInput || searchOpen) return;

      // === HOME: навигация по разделам ===
      if (view.type === 'home' && data) {
        const total = data.categories.length;
        const cols = 3;

        if (e.key === 'ArrowRight') {
          e.preventDefault();
          setFocusIdx(i => Math.min(i + 1, total - 1));
          return;
        }
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          setFocusIdx(i => Math.max(i - 1, 0));
          return;
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setFocusIdx(i => Math.min(i + cols, total - 1));
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setFocusIdx(i => Math.max(i - cols, 0));
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          setView({ type: 'section', index: focusIdx });
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
      }

      // === SECTION: навигация по вопросам ===
      if (view.type === 'section' && data) {
        const questions = getQuestionsForCategory(data, view.index);
        const total = questions.length;

        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
          e.preventDefault();
          setFocusIdx(i => Math.min(i + 1, total - 1));
          return;
        }
        if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
          e.preventDefault();
          setFocusIdx(i => Math.max(i - 1, 0));
          return;
        }
        if (e.key === 'Enter' && questions[focusIdx]) {
          e.preventDefault();
          setView({ type: 'answer', question: questions[focusIdx], sectionIndex: view.index });
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
        if (e.key === 'Backspace') {
          e.preventDefault();
          setView({ type: 'home' });
          return;
        }
      }

      // === ANSWER: стрелки — пред/след, Backspace — назад ===
      if (view.type === 'answer') {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          handleNavigateAnswer(-1);
          return;
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          handleNavigateAnswer(1);
          return;
        }
        if (e.key === 'Backspace') {
          e.preventDefault();
          setView({ type: 'section', index: view.sectionIndex });
          return;
        }
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [searchOpen, view, data, focusIdx, handleNavigateAnswer, voice.query]);

  // Прокрутка выделенного элемента в видимую область
  useEffect(() => {
    const el = document.querySelector(`[data-focus-idx="${focusIdx}"]`);
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [focusIdx]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
          <p className="text-muted-foreground text-sm font-mono">Загрузка данных...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-2">
          <p className="text-destructive font-medium">Ошибка загрузки</p>
          <p className="text-muted-foreground text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header
        totalQuestions={data.questions.length}
        onSearchOpen={() => setSearchOpen(true)}
        voiceEnabled={voice.enabled}
        voiceListening={voice.listening}
        onVoiceToggle={voice.toggle}
        voiceSupported={voice.supported}
      />

      {/* Текстовый поиск (по /) */}
      <SearchCommand
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        data={data}
        onSelectQuestion={handleSelectQuestion}
      />

      {/* Голосовой оверлей — появляется при распознавании речи */}
      <VoiceOverlay
        query={voice.query}
        rawTranscript={voice.rawTranscript}
        data={data}
        onSelectQuestion={handleSelectQuestion}
        onClear={voice.clear}
      />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* HOME VIEW */}
        {view.type === 'home' && (
          <div className="animate-fade-in">
            {/* Hero */}
            <div className="mb-10 sm:mb-14">
              <div className="flex items-center gap-2 mb-3">
                <Terminal className="w-5 h-5 text-primary" />
                <span className="font-mono text-xs text-primary font-semibold">v1.0 · {data.categories.length} разделов</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
                Подготовка к <span className="text-primary">DevOps</span> собеседованию
              </h2>
              <p className="text-muted-foreground max-w-2xl leading-relaxed">
                {data.questions.length} вопросов и ответов по {data.categories.length} разделам — от Linux и сетей до Kubernetes и архитектуры.
                Нажмите <kbd className="px-1.5 py-0.5 text-xs font-mono bg-card rounded border border-border">/</kbd> для текстового поиска,
                {' '}<kbd className="px-1.5 py-0.5 text-xs font-mono bg-card rounded border border-border">←↑↓→</kbd> + <kbd className="px-1.5 py-0.5 text-xs font-mono bg-card rounded border border-border">Enter</kbd> для навигации.
              </p>
              {voice.supported && (
                <p className="text-muted-foreground text-sm mt-2">
                  {voice.enabled
                    ? <>🎙 <span className="text-green-500 font-medium">Микрофон включён</span> — просто говорите, результаты появятся автоматически</>
                    : <>Нажмите кнопку <span className="font-medium">🎙 Микрофон</span> справа внизу, чтобы включить голосовой поиск</>
                  }
                </p>
              )}
            </div>

            {/* Section grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.categories.map((cat, idx) => (
                <SectionCard
                  key={idx}
                  index={idx}
                  category={cat}
                  questionCount={getQuestionsForCategory(data, idx).length}
                  focused={idx === focusIdx}
                  dataFocusIdx={idx}
                  onClick={() => {
                    setView({ type: 'section', index: idx });
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* SECTION VIEW */}
        {view.type === 'section' && (
          <QuestionList
            category={data.categories[view.index]}
            categoryIndex={view.index}
            questions={getQuestionsForCategory(data, view.index)}
            focusIdx={focusIdx}
            onBack={() => setView({ type: 'home' })}
            onSelectQuestion={(q) => {
              setView({ type: 'answer', question: q, sectionIndex: view.index });
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}

        {/* ANSWER VIEW */}
        {view.type === 'answer' && (() => {
          const questions = getQuestionsForCategory(data, view.sectionIndex);
          const curIdx = questions.findIndex(q => q.id === view.question.id);
          return (
            <AnswerView
              question={view.question}
              onBack={() => {
                setView({ type: 'section', index: view.sectionIndex });
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onHome={() => {
                setView({ type: 'home' });
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onPrev={curIdx > 0 ? () => handleNavigateAnswer(-1) : null}
              onNext={curIdx < questions.length - 1 ? () => handleNavigateAnswer(1) : null}
            />
          );
        })()}
      </main>

      {/* Плавающая кнопка микрофона */}
      {voice.supported && (
        <button
          onClick={voice.toggle}
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-full shadow-lg border transition-all ${
            voice.enabled && voice.listening
              ? 'bg-red-500/10 border-red-500/30 text-red-500 shadow-red-500/20 animate-pulse'
              : voice.enabled
                ? 'bg-primary/10 border-primary/30 text-primary'
                : 'bg-card border-border text-muted-foreground hover:text-foreground hover:border-primary/30'
          }`}
          title={voice.enabled ? 'Микрофон ВКЛ — говорите любой запрос' : 'Включить постоянный микрофон'}
        >
          {voice.enabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
          <span className="text-xs font-mono hidden sm:inline">
            {voice.enabled ? (voice.listening ? 'Слушаю...' : 'Микрофон ВКЛ') : 'Микрофон ВЫКЛ'}
          </span>
        </button>
      )}

      {/* Ошибка микрофона */}
      {voice.error && (
        <div className="fixed bottom-20 right-6 z-50 max-w-xs bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2 flex items-center gap-2 text-xs text-destructive animate-fade-in">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {voice.error}
        </div>
      )}
    </div>
  );
};

export default Index;
