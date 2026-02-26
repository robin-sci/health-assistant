import { useState, useRef, useCallback } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  onSend: (content: string) => void;
  isStreaming: boolean;
  isDisabled?: boolean;
}

export function ChatInput({ onSend, isStreaming, isDisabled }: ChatInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || isStreaming || isDisabled) return;
    onSend(trimmed);
    setValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [value, isStreaming, isDisabled, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    // Auto-resize
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  };

  const canSend = value.trim().length > 0 && !isStreaming && !isDisabled;

  return (
    <div className="border-t border-zinc-900 bg-black px-4 py-4">
      <div
        className={cn(
          'flex items-end gap-3 bg-zinc-950 border rounded-xl px-4 py-3',
          'transition-colors duration-150',
          isDisabled
            ? 'border-zinc-800 opacity-50'
            : 'border-zinc-800 focus-within:border-zinc-700'
        )}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={
            isStreaming
              ? 'AI is responding...'
              : isDisabled
                ? 'Select or create a chat session to start'
                : 'Ask about your health data... (Enter to send)'
          }
          disabled={isStreaming || isDisabled}
          rows={1}
          className={cn(
            'flex-1 resize-none bg-transparent text-sm text-zinc-200',
            'placeholder:text-zinc-600 outline-none leading-relaxed',
            'disabled:cursor-not-allowed min-h-[24px] max-h-[160px]'
          )}
        />
        <Button
          onClick={handleSubmit}
          disabled={!canSend}
          size="icon"
          className={cn(
            'h-8 w-8 shrink-0 rounded-lg transition-all duration-150',
            canSend
              ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
              : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
          )}
        >
          {isStreaming ? (
            <span className="h-3 w-3 rounded-sm bg-current" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>
      <p className="text-[10px] text-zinc-700 text-center mt-2">
        Shift+Enter for new line · Enter to send
      </p>
    </div>
  );
}
