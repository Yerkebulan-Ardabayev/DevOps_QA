import { useEffect, useRef, useCallback, useState } from 'react';
import { fixVoiceTranscript } from '@/lib/voice-fixes';

/**
 * Хук «всегда включённого» микрофона.
 * SpeechRecognition работает постоянно — без диалога поиска.
 *
 * Когда пользователь произносит фразу:
 *   1. Текст проходит через fixVoiceTranscript (DevOps‑термины)
 *   2. query обновляется → родитель делает searchQuestions()
 *   3. Через IDLE_TIMEOUT_MS тишины query автоматически очищается
 *
 * Returns: { query, listening, error, clear, toggle, supported }
 */

function getSR(): (new () => any) | null {
  if (typeof window === 'undefined') return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

const IDLE_TIMEOUT_MS = 4000; // через 4 сек тишины — скрываем результаты

export function useAlwaysOnVoice() {
  const [query, setQuery] = useState('');
  const [rawTranscript, setRawTranscript] = useState(''); // что Chrome услышал ДО коррекции
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);

  const recRef = useRef<any>(null);
  const enabledRef = useRef(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const SR = getSR();
  const supported = !!SR;

  // Синхронизируем ref
  useEffect(() => { enabledRef.current = enabled; }, [enabled]);

  // Очистка idle таймера
  const resetIdle = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      setQuery('');
    }, IDLE_TIMEOUT_MS);
  }, []);

  const clear = useCallback(() => {
    setQuery('');
    if (idleTimer.current) clearTimeout(idleTimer.current);
  }, []);

  const stop = useCallback(() => {
    try { recRef.current?.abort(); } catch {}
    recRef.current = null;
    setListening(false);
    if (idleTimer.current) clearTimeout(idleTimer.current);
  }, []);

  const start = useCallback(() => {
    if (!SR) return;
    stop();
    setError(null);

    const rec = new SR();
    rec.lang = 'ru-RU';
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onresult = (ev: any) => {
      const lastIdx = ev.results.length - 1;
      const raw = ev.results[lastIdx][0].transcript.trim();
      setRawTranscript(raw); // сохраняем сырой текст для дебага
      const fixed = fixVoiceTranscript(raw);
      if (fixed.length > 0) {
        setQuery(fixed);
        resetIdle();
      }
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
      if (err === undefined) setError(`Ошибка: ${ev.error}`);
      else if (err) setError(err);

      // no-speech — просто перезапускаем
      if (ev.error === 'no-speech' && enabledRef.current) {
        setTimeout(() => {
          if (enabledRef.current && !recRef.current) start();
        }, 300);
        return;
      }
      // aborted — тихо
      if (ev.error === 'aborted') return;
      // Другие ошибки — пауза и рестарт
      if (enabledRef.current) {
        setTimeout(() => {
          if (enabledRef.current && !recRef.current) start();
        }, 3000);
      }
    };

    rec.onend = () => {
      if (enabledRef.current) {
        // Автоматический перезапуск
        setTimeout(() => {
          if (enabledRef.current && !recRef.current) start();
        }, 200);
      } else {
        setListening(false);
      }
    };

    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch (e: any) {
      setError(`Не удалось запустить: ${e.message}`);
      setListening(false);
    }
  }, [SR, stop, resetIdle]);

  // Включение/выключение
  useEffect(() => {
    if (enabled) {
      start();
    } else {
      stop();
    }
    return () => stop();
  }, [enabled, start, stop]);

  const toggle = useCallback(() => {
    setEnabled(prev => !prev);
  }, []);

  return { query, rawTranscript, listening, error, enabled, clear, toggle, supported };
}
