import { highlightSegments } from '@/lib/highlight';

interface HighlightedProps {
  text: string;
  /** Термины поиска — тот же набор, по которому ранжировались результаты. */
  terms: string[];
  className?: string;
}

/**
 * Текст с подсветкой совпадений. Используется в списках результатов поиска
 * (текстового и голосового), чтобы было видно, из-за чего результат нашёлся.
 */
const Highlighted = ({ text, terms, className }: HighlightedProps) => {
  const segments = highlightSegments(text, terms);

  return (
    <span className={className}>
      {segments.map((seg, i) =>
        seg.hit ? (
          <mark key={i} className="search-hit">
            {seg.text}
          </mark>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </span>
  );
};

export default Highlighted;
