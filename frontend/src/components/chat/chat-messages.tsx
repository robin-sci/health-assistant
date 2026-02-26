import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { ChatStreamMessage } from './chat-stream-message';
import type { HAChatMessage, ChatStreamEvent } from '@/lib/api/types';

interface StreamingMessage {
  content: string;
  toolCalls: Array<{
    name: string;
    arguments: Record<string, unknown>;
    result?: string;
  }>;
  events: ChatStreamEvent[];
}

interface ChatMessagesProps {
  messages: HAChatMessage[];
  streamingMessage: StreamingMessage | null;
  isStreaming: boolean;
}

function UserMessage({ message }: { message: HAChatMessage }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[75%] bg-indigo-600 rounded-2xl rounded-tr-sm px-4 py-2.5">
        <p className="text-sm text-white leading-relaxed">{message.content}</p>
      </div>
    </div>
  );
}

function AssistantMessage({ message }: { message: HAChatMessage }) {
  const hasToolCalls =
    message.message_metadata &&
    Array.isArray(
      (message.message_metadata as Record<string, unknown>).tool_calls
    );

  const toolCalls = hasToolCalls
    ? ((message.message_metadata as Record<string, unknown>)
        .tool_calls as Array<{
        name: string;
        arguments: Record<string, unknown>;
        result?: string;
      }>)
    : [];

  return (
    <div className="flex justify-start">
      <div className="max-w-[80%] bg-zinc-900 border border-zinc-800 rounded-2xl rounded-tl-sm px-4 py-2.5">
        <ChatStreamMessage
          content={message.content}
          toolCalls={toolCalls}
          isStreaming={false}
          events={[]}
        />
      </div>
    </div>
  );
}

export function ChatMessages({
  messages,
  streamingMessage,
  isStreaming,
}: ChatMessagesProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, streamingMessage?.content]);

  if (messages.length === 0 && !isStreaming) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-8 py-16">
        <div className="text-center max-w-md">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/20 mb-5">
            <svg
              className="h-7 w-7 text-indigo-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-white mb-2">
            Health AI Assistant
          </h3>
          <p className="text-sm text-zinc-500 leading-relaxed">
            Ask me anything about your health data — activity, sleep, heart
            rate, workouts, and more.
          </p>
          <div className="mt-6 grid grid-cols-1 gap-2 text-left">
            {[
              'How was my sleep quality this week?',
              'What are my activity trends over the last month?',
              'Show me my recent heart rate data',
            ].map((suggestion) => (
              <div
                key={suggestion}
                className="text-xs text-zinc-500 bg-zinc-900/60 border border-zinc-800 rounded-lg px-3 py-2"
              >
                &ldquo;{suggestion}&rdquo;
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto px-6 py-4 space-y-4"
    >
      {messages.map((message) => {
        if (message.role === 'user') {
          return <UserMessage key={message.id} message={message} />;
        }
        if (message.role === 'assistant') {
          return <AssistantMessage key={message.id} message={message} />;
        }
        return null;
      })}

      {/* Streaming assistant message */}
      {isStreaming && streamingMessage && (
        <div className="flex justify-start">
          <div
            className={cn(
              'max-w-[80%] bg-zinc-900 border border-zinc-800',
              'rounded-2xl rounded-tl-sm px-4 py-2.5'
            )}
          >
            <ChatStreamMessage
              content={streamingMessage.content}
              toolCalls={streamingMessage.toolCalls}
              isStreaming={isStreaming}
              events={streamingMessage.events}
            />
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
