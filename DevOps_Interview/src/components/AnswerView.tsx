import { ArrowLeft, ChevronLeft, ChevronRight, Home } from 'lucide-react';
import { Question, shortCat } from '@/lib/devops-data';

interface AnswerViewProps {
  question: Question;
  onBack: () => void;
  onHome: () => void;
  onPrev: (() => void) | null;
  onNext: (() => void) | null;
}

const AnswerView = ({ question, onBack, onHome, onPrev, onNext }: AnswerViewProps) => {
  return (
    <div className="animate-fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <button
          onClick={onHome}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
          title="На главную (Escape дважды)"
        >
          <Home className="w-4 h-4" />
          Главная
        </button>
        <span className="text-muted-foreground">/</span>
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
          title="К списку вопросов (Backspace)"
        >
          <ArrowLeft className="w-4 h-4" />
          {shortCat(question.category)}
        </button>
        <span className="text-muted-foreground">/</span>
        <span className="text-xs font-mono text-primary font-semibold bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
          №{question.num}
        </span>
      </div>

      {/* Title */}
      <h2 className="text-2xl sm:text-3xl font-bold tracking-tight leading-snug mb-8 pb-6 border-b-2 border-border">
        {question.text}
      </h2>

      {/* Answer */}
      <div
        className="answer-content text-secondary-foreground leading-relaxed"
        dangerouslySetInnerHTML={{ __html: question.answer }}
      />

      {/* Navigation */}
      <div className="flex items-center justify-between mt-12 pt-6 border-t border-border gap-2 flex-wrap">
        {onPrev ? (
          <button
            onClick={onPrev}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border bg-card text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all"
            title="Предыдущий вопрос (←)"
          >
            <ChevronLeft className="w-4 h-4" />
            Пред.
          </button>
        ) : <div />}

        <div className="flex items-center gap-2">
          <button
            onClick={onHome}
            className="px-4 py-2.5 rounded-lg border border-border bg-card text-sm text-muted-foreground font-medium hover:text-foreground hover:border-primary/30 transition-all"
            title="На главную"
          >
            <Home className="w-4 h-4 inline mr-1.5" />
            Главная
          </button>
          <button
            onClick={onBack}
            className="px-4 py-2.5 rounded-lg border border-primary/30 bg-primary/10 text-sm text-primary font-medium hover:bg-primary/20 transition-all"
            title="К списку вопросов (Backspace)"
          >
            ← К списку
          </button>
        </div>

        {onNext ? (
          <button
            onClick={onNext}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border bg-card text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all"
            title="Следующий вопрос (→)"
          >
            След.
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : <div />}
      </div>

      {/* Keyboard hints */}
      <div className="mt-4 flex items-center gap-4 text-[11px] text-muted-foreground font-mono justify-center">
        <span><kbd className="px-1 py-0.5 bg-muted rounded border border-border">←→</kbd> пред/след</span>
        <span><kbd className="px-1 py-0.5 bg-muted rounded border border-border">Backspace</kbd> к списку</span>
        <span><kbd className="px-1 py-0.5 bg-muted rounded border border-border">Escape</kbd> назад</span>
      </div>
    </div>
  );
};

export default AnswerView;
