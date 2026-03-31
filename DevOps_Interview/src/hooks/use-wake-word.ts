import { useEffect, useRef, useCallback, useState } from 'react';
import { fixVoiceTranscript } from '@/lib/voice-fixes';

/**
 * Фоновое прослушивание. Когда пользователь произносит одну из
 * триггер-фраз — вызывается onWake(). Поиск открывается сразу с микрофоном.
 *
 * Триггеры: «поиск», «найди», «искать», «search», «find», «окей девопс»
 */

const WAKE_WORDS = [
  'поиск', 'найди', 'найти', 'искать', 'ищи',
  'search', 'find',
  'окей девопс', 'ок девопс',
];

function getSR(): (new () => any) | null {
  if (typeof window === 'undefined') return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

export function useWakeWord(onWake: () => void, enabled: boolean = true) {
  const recRef = useRef<any>(null);
  const [active, setActive] = useState(false);
  const enabledRef = useRef(enabled);
  const onWakeRef = useRef(onWake);
  const SR = getSR();

  // Обновляем рефы, чтобы не пересоздавать recognition
  useEffect(() => { enabledRef.current = enabled; }, [enabled]);
  useEffect(() => { onWakeRef.current = onWake; }, [onWake]);

  const stop = useCallback(() => {
    try { recRef.current?.abort(); } catch {}
    recRef.current = null;
    setActive(false);
  }, []);

  const start = useCallback(() => {
    if (!SR || !enabledRef.current) return;
    stop();

    const rec = new SR();
    rec.lang = 'ru-RU';
    rec.continuous = true;
    rec.interimResults = false;
    rec.maxAlternatives = 3;

    rec.onresult = (ev: any) => {
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        if (!ev.results[i].isFinal) continue;
        for (let a = 0; a < ev.results[i].length; a++) {
          const raw = ev.results[i][a].transcript.toLowerCase().trim();
          const fixed = fixVoiceTranscript(raw).toLowerCase();
          const matched = WAKE_WORDS.some(w => raw.includes(w) || fixed.includes(w));
          if (matched) {
            stop();
            onWakeRef.current();
            return;
          }
        }
      }
    };

    rec.onerror = (ev: any) => {
      if (ev.error === 'no-speech' || ev.error === 'aborted') {
        if (enabledRef.current) {
          setTimeout(() => { if (enabledRef.current && !recRef.current) start(); }, 500);
        }
        return;
      }
      // Другие ошибки — пауза и рестарт
      setTimeout(() => { if (enabledRef.current && !recRef.current) start(); }, 3000);
    };

    rec.onend = () => {
      if (enabledRef.current) {
        setTimeout(() => { if (enabledRef.current && !recRef.current) start(); }, 300);
      } else {
        setActive(false);
      }
    };

    recRef.current = rec;
    try {
      rec.start();
      setActive(true);
    } catch {
      setActive(false);
    }
  }, [SR, stop]);

  useEffect(() => {
    if (enabled) {
      start();
    } else {
      stop();
    }
    return () => stop();
  }, [enabled, start, stop]);

  return { active, supported: !!SR };
}
