import { useEffect, useRef, useState, useCallback } from 'react';
import { Mic, X, ChevronRight, ExternalLink } from 'lucide-react';
import { DevOpsData, searchQuestions, shortCat, stripHtml, Question } from '@/lib/devops-data';

interface VoiceOverlayProps {
  query: string;
  rawTranscript?: string; // что Chrome услышал до коррекции
  data: DevOpsData;
  onSelectQuestion: (question: Question) => void;
  onClear: () => void;
}

/** Обрезает текст до maxLen символов */
function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).replace(/\s+\S*$/, '') + '…';
}

/**
 * Голосовой оверлей — умная панель результатов.
 *
 * - Лучший результат показывается крупно с превью ответа
 * - Остальные — компактный список с первой строкой ответа
 * - Enter / клик — открывает полный ответ
 */
const VoiceOverlay = ({ query, rawTranscript, data, onSelectQuestion, onClear }: VoiceOverlayProps) => {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [results, setResults] = useState<Question[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Поиск при изменении query
  useEffect(() => {
    const q = query.trim();
    if (q.length > 0) {
      const all = searchQuestions(data, q);
      setResults(all.slice(0, 8));
      setSelectedIdx(0);
    } else {
      setResults([]);
    }
  }, [query, data]);

  // Клавиатура — ↑↓ Enter Esc
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (query.trim().length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIdx]) {
      e.preventDefault();
      onSelectQuestion(results[selectedIdx]);
      onClear();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClear();
    }
  }, [query, results, selectedIdx, onSelectQuestion, onClear]);

  useEffect(() => {
    if (query.trim().length > 0) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [query, handleKeyDown]);

  // Scroll selected item into view
  useEffect(() => {
    const el = containerRef.current?.querySelector(`[data-vidx="${selectedIdx}"]`) as HTMLElement;
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIdx]);

  // Не показывать если нет запроса
  if (query.trim().length === 0) return null;

  const bestMatch = results[0];

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[90] w-full max-w-2xl px-4 animate-fade-in">
      <div
        ref={containerRef}
        className="bg-card/95 backdrop-blur-lg border border-primary/30 rounded-xl shadow-2xl shadow-primary/10 overflow-hidden"
      >

        {/* Header — показывает что услышал + что исправлено */}
        <div className="flex flex-col gap-0.5 px-4 py-2 border-b border-border">
          <div className="flex items-center gap-2">
            <Mic className="w-4 h-4 text-red-500 animate-pulse shrink-0" />
            <span className="text-sm font-medium text-foreground truncate flex-1">
              «{query}»
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              {results.length > 0 ? `${results.length} найдено` : 'нет результатов'}
            </span>
            <button
              onClick={onClear}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Закрыть (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {/* Дебаг: что Chrome реально услышал (до коррекции) */}
          {rawTranscript && rawTranscript !== query && (
            <div className="text-[10px] text-muted-foreground font-mono pl-6 truncate">
              Chrome услышал: «{rawTranscript}»
            </div>
          )}
        </div>

        {/* Лучший результат — крупно с превью ответа */}
        {bestMatch && (
          <button
            onClick={() => { onSelectQuestion(bestMatch); onClear(); }}
            data-vidx={0}
            className={`w-full text-left px-4 py-3 border-b border-border transition-colors ${
              selectedIdx === 0
                ? 'bg-primary/10'
                : 'hover:bg-muted/50'
            }`}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <span className="font-mono text-xs text-primary font-bold">#{bestMatch.num}</span>
              <span className="text-sm font-semibold text-foreground flex-1">{bestMatch.text}</span>
              <ExternalLink className="w-3 h-3 text-muted-foreground shrink-0" />
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed" style={{
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}>
              {truncate(stripHtml(bestMatch.answer), 280)}
            </p>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-[10px] text-primary/70 font-mono bg-primary/5 px-1.5 py-0.5 rounded">
                {shortCat(bestMatch.category)}
              </span>
              <span className="text-[10px] text-muted-foreground">
                Enter — открыть полный ответ
              </span>
            </div>
          </button>
        )}

        {/* Остальные результаты — компактный список с превью */}
        {results.length > 1 && (
          <div className="max-h-[35vh] overflow-y-auto">
            {results.slice(1).map((q, rawIdx) => {
              const idx = rawIdx + 1;
              return (
                <button
                  key={q.id}
                  data-vidx={idx}
                  onClick={() => { onSelectQuestion(q); onClear(); }}
                  className={`w-full text-left px-4 py-2 flex items-center gap-3 transition-colors ${
                    idx === selectedIdx
                      ? 'bg-primary/10 text-foreground'
                      : 'hover:bg-muted/50 text-foreground'
                  }`}
                >
                  <span className="font-mono text-xs text-primary font-semibold shrink-0 w-7">
                    #{q.num}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm truncate">{q.text}</div>
                    <div className="text-[10px] text-muted-foreground truncate mt-0.5">
                      {truncate(stripHtml(q.answer), 90)}
                    </div>
                  </div>
                  <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                </button>
              );
            })}
          </div>
        )}

        {/* Пустой результат */}
        {results.length === 0 && (
          <div className="p-4 text-center text-muted-foreground text-sm">
            Ничего не найдено — попробуйте другое слово
          </div>
        )}

        {/* Footer */}
        <div className="px-4 py-1.5 border-t border-border flex items-center gap-3 text-[10px] text-muted-foreground font-mono">
          <span><kbd className="px-1 py-0.5 bg-muted rounded border border-border">↑↓</kbd> выбор</span>
          <span><kbd className="px-1 py-0.5 bg-muted rounded border border-border">Enter</kbd> открыть</span>
          <span><kbd className="px-1 py-0.5 bg-muted rounded border border-border">Esc</kbd> закрыть</span>
          <span className="ml-auto">синонимы + ранжирование</span>
        </div>
      </div>
    </div>
  );
};

export default VoiceOverlay;
