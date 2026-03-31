import { useEffect, useRef, useState, useCallback } from 'react';
import { Search, X, Mic, MicOff, AlertCircle } from 'lucide-react';
import { DevOpsData, searchQuestions, shortCat, Question } from '@/lib/devops-data';
import { fixVoiceTranscript } from '@/lib/voice-fixes';

function getSR(): (new () => any) | null {
  if (typeof window === 'undefined') return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

interface SearchCommandProps {
  open: boolean;
  onClose: () => void;
  data: DevOpsData;
  onSelectQuestion: (question: Question) => void;
}

const SearchCommand = ({ open, onClose, data, onSelectQuestion }: SearchCommandProps) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Question[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const recRef = useRef<any>(null);
  const shouldListenRef = useRef(false);

  const SR = getSR();
  const voiceSupported = !!SR;

  // ====== VOICE ======
  const stopVoice = useCallback(() => {
    shouldListenRef.current = false;
    try { recRef.current?.abort(); } catch {}
    recRef.current = null;
    setListening(false);
  }, []);

  const startVoice = useCallback(() => {
    if (!SR) return;
    stopVoice();
    setVoiceError(null);
    shouldListenRef.current = true;

    const rec = new SR();
    rec.lang = 'ru-RU';
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onresult = (ev: any) => {
      // Берём ТОЛЬКО последний результат — каждая фраза ЗАМЕНЯЕТ запрос
      const lastIdx = ev.results.length - 1;
      const raw = ev.results[lastIdx][0].transcript.trim();
      const fixed = fixVoiceTranscript(raw);
      setQuery(fixed);
    };

    rec.onerror = (ev: any) => {
      const msg: Record<string, string> = {
        'not-allowed': 'Микрофон заблокирован — нажмите 🔒 в адресной строке → разрешить',
        'audio-capture': 'Микрофон не найден',
        'network': 'Нужен интернет для распознавания',
        'no-speech': '',
        'aborted': '',
      };
      const err = msg[ev.error];
      if (err === undefined) setVoiceError(`Ошибка: ${ev.error}`);
      else if (err) setVoiceError(err);

      if (ev.error === 'no-speech' && shouldListenRef.current) {
        try { rec.start(); } catch { stopVoice(); }
        return;
      }
      if (ev.error !== 'aborted' && ev.error !== 'no-speech') stopVoice();
    };

    rec.onend = () => {
      if (shouldListenRef.current) {
        try { rec.start(); } catch { stopVoice(); }
        return;
      }
      setListening(false);
    };

    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch (e: any) {
      setVoiceError(`Не удалось: ${e.message}`);
      stopVoice();
    }
  }, [SR, stopVoice]);

  // ====== OPEN = VOICE ON, CLOSE = VOICE OFF ======
  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setSelectedIdx(0);
      setVoiceError(null);
      // Микрофон включается СРАЗУ — без кликов
      if (SR) setTimeout(() => startVoice(), 80);
      setTimeout(() => inputRef.current?.focus(), 80);
    } else {
      stopVoice();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ====== INSTANT SEARCH ======
  useEffect(() => {
    const q = query.trim();
    if (q.length > 0) {
      setResults(searchQuestions(data, q).slice(0, 20));
      setSelectedIdx(0);
    } else {
      setResults([]);
    }
  }, [query, data]);

  // ====== KEYBOARD ======
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIdx]) {
      onSelectQuestion(results[selectedIdx]);
      onClose();
    } else if (e.key === 'Escape') {
      onClose();
    }
  }, [results, selectedIdx, onSelectQuestion, onClose]);

  useEffect(() => {
    const el = listRef.current?.children[selectedIdx] as HTMLElement;
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIdx]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] animate-fade-in" onClick={onClose}>
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" />
      <div className="relative max-w-2xl mx-auto mt-[12vh] px-4" onClick={e => e.stopPropagation()}>
        <div className="bg-card border border-border rounded-xl shadow-2xl overflow-hidden animate-slide-up">

          {/* Input row */}
          <div className="flex items-center gap-2 px-4 border-b border-border">
            {/* Mic status — кликабельный toggle */}
            {voiceSupported && (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); listening ? stopVoice() : startVoice(); }}
                type="button"
                className={`p-1.5 rounded-lg transition-all shrink-0 ${
                  listening
                    ? 'text-red-500 bg-red-500/15 shadow-[0_0_10px_rgba(239,68,68,0.25)]'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
                title={listening ? 'Выключить микрофон' : 'Включить микрофон'}
              >
                {listening ? <Mic className="w-5 h-5 animate-pulse" /> : <MicOff className="w-5 h-5" />}
              </button>
            )}

            {!voiceSupported && <Search className="w-5 h-5 text-muted-foreground shrink-0" />}

            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={listening ? '🎙 Говорите...' : 'Введите запрос...'}
              className="flex-1 py-4 bg-transparent text-foreground placeholder:text-muted-foreground outline-none text-base"
            />

            {query.length > 0 && (
              <button onClick={() => setQuery('')} type="button"
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                title="Очистить">
                <X className="w-4 h-4" />
              </button>
            )}

            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-muted">
              <kbd className="text-[10px] font-mono">Esc</kbd>
            </button>
          </div>

          {/* Voice error */}
          {voiceError && (
            <div className="px-4 py-2 bg-destructive/5 border-b border-destructive/20 flex items-center gap-2 text-xs text-destructive">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {voiceError}
            </div>
          )}

          {/* Results */}
          <div ref={listRef} className="max-h-[55vh] overflow-y-auto">
            {query.trim().length > 0 && results.length === 0 && (
              <div className="p-6 text-center text-muted-foreground text-sm">Ничего не найдено</div>
            )}
            {results.map((q, idx) => (
              <button
                key={q.id}
                onClick={() => { onSelectQuestion(q); onClose(); }}
                className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors ${
                  idx === selectedIdx ? 'bg-primary/10 text-foreground' : 'hover:bg-muted text-foreground'
                }`}
              >
                <span className="font-mono text-xs text-primary font-semibold mt-1 shrink-0 w-8">#{q.num}</span>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{q.text}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{shortCat(q.category)}</div>
                </div>
              </button>
            ))}
          </div>

          {/* Footer */}
          <div className="px-4 py-1.5 border-t border-border flex items-center gap-3 text-[10px] text-muted-foreground font-mono">
            <span>{listening ? '🔴 микрофон вкл' : '⚫ микрофон выкл'}</span>
            <span>·</span>
            <span><kbd className="px-1 py-0.5 bg-muted rounded border border-border">↑↓</kbd> выбор</span>
            <span><kbd className="px-1 py-0.5 bg-muted rounded border border-border">Enter</kbd> открыть</span>
            <span className="ml-auto">автокоррекция терминов</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SearchCommand;
