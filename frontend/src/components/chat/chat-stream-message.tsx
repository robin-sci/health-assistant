import { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ChatStreamEvent } from '@/lib/api/types';

interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
  result?: string;
}

interface ChatStreamMessageProps {
  content: string;
  toolCalls: ToolCall[];
  isStreaming: boolean;
  events: ChatStreamEvent[];
}

function ToolCallBadge({ toolCall }: { toolCall: ToolCall }) {
  const hasResult = toolCall.result !== undefined;

  return (
    <div className="flex flex-col gap-1 my-2">
      <div className="flex items-center gap-2">
        <Badge
          className={cn(
            'text-[10px] px-2 py-0.5 gap-1.5 rounded font-mono',
            hasResult
              ? 'bg-emerald-950 text-emerald-400 border-emerald-900'
              : 'bg-amber-950 text-amber-400 border-amber-900 animate-pulse'
          )}
          variant="outline"
        >
          <span>{hasResult ? '✓' : '⟳'}</span>
          <span>{toolCall.name}</span>
        </Badge>
        {Object.keys(toolCall.arguments).length > 0 && (
          <span className="text-[10px] text-zinc-600 font-mono">
            {Object.entries(toolCall.arguments)
              .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
              .join(', ')}
          </span>
        )}
      </div>
    </div>
  );
}

export function ChatStreamMessage({
  content,
  toolCalls,
  isStreaming,
}: ChatStreamMessageProps) {
  const cursorRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!isStreaming && cursorRef.current) {
      cursorRef.current.style.display = 'none';
    }
  }, [isStreaming]);

  return (
    <div className="flex flex-col gap-2">
      {/* Tool calls */}
      {toolCalls.length > 0 && (
        <div className="flex flex-col gap-1 border border-zinc-800 rounded-md p-3 bg-zinc-950">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">
            Tool calls
          </p>
          {toolCalls.map((tc, i) => (
            <ToolCallBadge key={i} toolCall={tc} />
          ))}
        </div>
      )}

      {/* Message content */}
      {content && (
        <div className="prose prose-invert prose-sm max-w-none">
          <ReactMarkdown
            components={{
              p: ({ children }) => (
                <p className="text-sm text-zinc-200 leading-relaxed mb-2 last:mb-0">
                  {children}
                </p>
              ),
              code: ({ children, className }) => {
                const isBlock = className?.includes('language-');
                if (isBlock) {
                  return (
                    <pre className="bg-zinc-950 border border-zinc-800 rounded-md p-3 overflow-x-auto my-2">
                      <code className="text-xs text-zinc-300 font-mono">
                        {children}
                      </code>
                    </pre>
                  );
                }
                return (
                  <code className="text-xs bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded font-mono">
                    {children}
                  </code>
                );
              },
              ul: ({ children }) => (
                <ul className="text-sm text-zinc-200 list-disc pl-4 space-y-1 my-2">
                  {children}
                </ul>
              ),
              ol: ({ children }) => (
                <ol className="text-sm text-zinc-200 list-decimal pl-4 space-y-1 my-2">
                  {children}
                </ol>
              ),
              li: ({ children }) => (
                <li className="text-zinc-200">{children}</li>
              ),
              strong: ({ children }) => (
                <strong className="text-white font-semibold">{children}</strong>
              ),
              h1: ({ children }) => (
                <h1 className="text-base font-semibold text-white mt-3 mb-1">
                  {children}
                </h1>
              ),
              h2: ({ children }) => (
                <h2 className="text-sm font-semibold text-white mt-3 mb-1">
                  {children}
                </h2>
              ),
              h3: ({ children }) => (
                <h3 className="text-sm font-medium text-zinc-100 mt-2 mb-1">
                  {children}
                </h3>
              ),
              blockquote: ({ children }) => (
                <blockquote className="border-l-2 border-zinc-700 pl-3 italic text-zinc-400 my-2">
                  {children}
                </blockquote>
              ),
              a: ({ href, children }) => (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 underline"
                >
                  {children}
                </a>
              ),
            }}
          >
            {content}
          </ReactMarkdown>
          {isStreaming && (
            <span
              ref={cursorRef}
              className="inline-block w-0.5 h-4 bg-zinc-400 animate-pulse ml-0.5 align-middle"
            />
          )}
        </div>
      )}

      {isStreaming && !content && (
        <div className="flex items-center gap-1.5 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-zinc-500 animate-bounce [animation-delay:0ms]" />
          <span className="h-1.5 w-1.5 rounded-full bg-zinc-500 animate-bounce [animation-delay:150ms]" />
          <span className="h-1.5 w-1.5 rounded-full bg-zinc-500 animate-bounce [animation-delay:300ms]" />
        </div>
      )}
    </div>
  );
}
