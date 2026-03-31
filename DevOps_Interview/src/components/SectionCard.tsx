import { BookOpen, ChevronRight } from 'lucide-react';
import { shortCat } from '@/lib/devops-data';

const SECTION_ICONS: Record<number, string> = {
  0: '🔄', 1: '🐧', 2: '🌐', 3: '☁️', 4: '🐳', 5: '☸️',
  6: '🔒', 7: '📊', 8: '🗄️', 9: '💾', 10: '📎', 11: '🔧', 12: '🤝'
};

interface SectionCardProps {
  index: number;
  category: string;
  questionCount: number;
  focused?: boolean;
  dataFocusIdx?: number;
  onClick: () => void;
}

const SectionCard = ({ index, category, questionCount, focused, dataFocusIdx, onClick }: SectionCardProps) => {
  return (
    <button
      onClick={onClick}
      data-focus-idx={dataFocusIdx}
      className={`group text-left w-full p-5 rounded-xl bg-card border transition-all duration-300 hover:translate-y-[-2px] card-glow ${
        focused
          ? 'border-primary ring-2 ring-primary/30 translate-y-[-2px] shadow-lg'
          : 'border-border'
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-2xl">{SECTION_ICONS[index] || '📋'}</span>
        <span className="font-mono text-xs text-muted-foreground font-semibold">
          #{String(index + 1).padStart(2, '0')}
        </span>
      </div>
      <h3 className={`font-semibold text-sm leading-snug mb-3 line-clamp-2 transition-colors ${
        focused ? 'text-primary' : 'text-foreground group-hover:text-primary'
      }`}>
        {shortCat(category)}
      </h3>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <BookOpen className="w-3.5 h-3.5" />
          <span className="font-mono">{questionCount}</span>
          <span>вопросов</span>
        </div>
        <ChevronRight className={`w-4 h-4 transition-all ${
          focused ? 'text-primary translate-x-0.5' : 'text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5'
        }`} />
      </div>
    </button>
  );
};

export default SectionCard;
