import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';

/**
 * Переключатель светлой и тёмной темы.
 *
 * До монтирования next-themes не знает разрешённую тему (её ставит инлайн-скрипт
 * в index.html), поэтому иконка рисуется только после mount — иначе на первом
 * кадре показывалась бы иконка не той темы.
 */
const ThemeToggle = () => {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isLight = resolvedTheme === 'light';

  return (
    <button
      onClick={() => setTheme(isLight ? 'dark' : 'light')}
      className="flex items-center justify-center w-9 h-9 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all"
      title={isLight ? 'Тёмная тема' : 'Светлая тема'}
      aria-label={isLight ? 'Включить тёмную тему' : 'Включить светлую тему'}
    >
      {!mounted ? (
        <span className="w-4 h-4" />
      ) : isLight ? (
        <Moon className="w-4 h-4" />
      ) : (
        <Sun className="w-4 h-4" />
      )}
    </button>
  );
};

export default ThemeToggle;
