import { ArrowLeft, ChevronRight } from 'lucide-react';
import { Question, shortCat } from '@/lib/devops-data';
import { useState } from 'react';

interface QuestionListProps {
  category: string;
  categoryIndex: number;
  questions: Question[];
  focusIdx?: number;
  onBack: () => void;
  onSelectQuestion: (question: Question) => void;
}

const QuestionList = ({ category, categoryIndex, questions, focusIdx = -1, onBack, onSelectQuestion }: QuestionListProps) => {
  const [filter, setFilter] = useState('');

  const filtered = filter.trim()
    ? questions.filter(q => q.text.toLowerCase().includes(filter.toLowerCase()))
    : questions;

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Все разделы
          <kbd className="ml-2 px-1.5 py-0.5 text-[10px] font-mono bg-muted rounded border border-border">Backspace</kbd>
        </button>
        <div className="flex items-center gap-3 mb-2">
          <span className="font-mono text-xs text-primary font-bold bg-primary/10 px-2 py-1 rounded-md border border-primary/20">
            Раздел {categoryIndex + 1}
          </span>
          <span className="text-xs text-muted-foreground font-mono">
            {questions.length} вопросов
          </span>
        </div>
        <h2 className="text-2xl font-bold tracking-tight">{shortCat(category)}</h2>
      </div>

      {/* Filter */}
      <div className="mb-6">
        <input
          type="text"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Фильтр вопросов..."
          className="w-full px-4 py-3 rounded-lg bg-card border border-border text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-all text-sm"
        />
      </div>

      {/* Questions */}
      <div className="space-y-2">
        {filtered.map((q, idx) => {
          const isFocused = idx === focusIdx;
          return (
            <button
              key={q.id}
              data-focus-idx={idx}
              onClick={() => onSelectQuestion(q)}
              className={`group w-full text-left flex items-center gap-3 px-4 py-3.5 rounded-lg bg-card border transition-all ${
                isFocused
                  ? 'border-primary ring-2 ring-primary/30 bg-primary/5 shadow-md'
                  : 'border-border hover:border-primary/30 hover:bg-primary/5'
              }`}
            >
              <span className="font-mono text-xs text-primary font-bold shrink-0 w-8">
                {q.num}.
              </span>
              <span className={`text-sm font-medium flex-1 transition-colors ${
                isFocused ? 'text-primary' : 'text-foreground group-hover:text-primary'
              }`}>
                {q.text}
              </span>
              <ChevronRight className={`w-4 h-4 shrink-0 transition-all ${
                isFocused ? 'text-primary translate-x-0.5' : 'text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5'
              }`} />
            </button>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            Вопросы не найдены
          </div>
        )}
      </div>
    </div>
  );
};

export default QuestionList;
