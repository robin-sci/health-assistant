import { useState, useCallback, useRef } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useUsers } from '@/hooks/api/use-users';
import {
  useChatSessions,
  useChatSession,
  useCreateChatSession,
  useDeleteChatSession,
} from '@/hooks/api/use-chat';
import { chatService } from '@/lib/api';
import { ChatSidebar } from '@/components/chat/chat-sidebar';
import { ChatMessages } from '@/components/chat/chat-messages';
import { ChatInput } from '@/components/chat/chat-input';
import { Button } from '@/components/ui/button';
import type { HAChatMessage, ChatStreamEvent } from '@/lib/api/types';

export const Route = createFileRoute('/_authenticated/chat')({
  component: ChatPage,
});

interface StreamingMessage {
  content: string;
  toolCalls: Array<{
    name: string;
    arguments: Record<string, unknown>;
    result?: string;
  }>;
  events: ChatStreamEvent[];
}

function ChatPage() {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null
  );
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] =
    useState<StreamingMessage | null>(null);
  const [localMessages, setLocalMessages] = useState<HAChatMessage[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const abortRef = useRef<(() => void) | null>(null);

  // Get user ID from first user
  const { data: usersData } = useUsers({ limit: 1 });
  const userId = usersData?.items?.[0]?.id ?? '';

  const {
    data: sessions = [],
    isLoading: isLoadingSessions,
    error: sessionsError,
    refetch: refetchSessions,
  } = useChatSessions(userId);

  const {
    data: sessionDetail,
    error: sessionError,
    refetch: refetchSession,
  } = useChatSession(selectedSessionId ?? '');

  const createSession = useCreateChatSession();
  const deleteSession = useDeleteChatSession();

  // Messages to show: session messages + any local additions
  const messages: HAChatMessage[] = selectedSessionId
    ? (sessionDetail?.messages ?? localMessages)
    : [];

  const handleNewChat = useCallback(async () => {
    if (!userId) {
      toast.error('No user found to create a chat session');
      return;
    }
    try {
      const session = await createSession.mutateAsync({ userId });
      setSelectedSessionId(session.id);
      setLocalMessages([]);
      setStreamingMessage(null);
    } catch {
      // Error handled by hook
    }
  }, [userId, createSession]);

  const handleDeleteSession = useCallback(
    async (id: string) => {
      if (!userId) return;
      setDeletingId(id);
      try {
        await deleteSession.mutateAsync({ id, userId });
        if (selectedSessionId === id) {
          setSelectedSessionId(null);
          setLocalMessages([]);
          setStreamingMessage(null);
        }
      } finally {
        setDeletingId(null);
      }
    },
    [userId, deleteSession, selectedSessionId]
  );

  const handleSelectSession = useCallback(
    (id: string) => {
      if (isStreaming) return;
      setSelectedSessionId(id);
      setLocalMessages([]);
      setStreamingMessage(null);
    },
    [isStreaming]
  );

  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!selectedSessionId || isStreaming) return;

      // Add user message locally
      const userMsg: HAChatMessage = {
        id: `local-${Date.now()}`,
        session_id: selectedSessionId,
        role: 'user',
        content,
        message_metadata: null,
        created_at: new Date().toISOString(),
      };

      setLocalMessages((_prev) => {
        const base = sessionDetail?.messages ?? [];
        return [...base, userMsg];
      });

      setIsStreaming(true);
      setStreamingMessage({
        content: '',
        toolCalls: [],
        events: [],
      });

      let cancelled = false;
      abortRef.current = () => {
        cancelled = true;
      };

      try {
        const stream = chatService.streamMessage(selectedSessionId, content);

        for await (const event of stream) {
          if (cancelled) break;

          if (event.type === 'content' && event.content) {
            setStreamingMessage((prev) =>
              prev
                ? {
                    ...prev,
                    content: prev.content + event.content,
                    events: [...prev.events, event],
                  }
                : null
            );
          } else if (event.type === 'tool_call' && event.name) {
            setStreamingMessage((prev) =>
              prev
                ? {
                    ...prev,
                    toolCalls: [
                      ...prev.toolCalls,
                      {
                        name: event.name!,
                        arguments: event.arguments ?? {},
                      },
                    ],
                    events: [...prev.events, event],
                  }
                : null
            );
          } else if (event.type === 'tool_result' && event.name) {
            setStreamingMessage((prev) => {
              if (!prev) return null;
              const toolCalls = [...prev.toolCalls];
              const idx = toolCalls.findLastIndex(
                (tc) => tc.name === event.name && !tc.result
              );
              if (idx !== -1) {
                toolCalls[idx] = {
                  ...toolCalls[idx],
                  result: event.result ?? '',
                };
              }
              return {
                ...prev,
                toolCalls,
                events: [...prev.events, event],
              };
            });
          } else if (event.type === 'done') {
            break;
          } else if (event.type === 'error') {
            toast.error(event.error ?? 'Stream error');
            break;
          }
        }
      } catch (err) {
        if (!cancelled) {
          toast.error(
            err instanceof Error ? err.message : 'Failed to send message'
          );
        }
      } finally {
        setIsStreaming(false);
        setStreamingMessage(null);
        // Reset local messages so session detail refetch takes over
        setLocalMessages([]);
        abortRef.current = null;
      }
    },
    [selectedSessionId, isStreaming, sessionDetail]
  );

  return (
    <div className="flex h-screen overflow-hidden bg-black">
      {/* Session sidebar */}
      <div className="w-[260px] shrink-0 flex flex-col">
        {sessionsError && (
          <div className="p-4">
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-400">
                  Failed to load sessions
                </p>
                <p className="text-xs text-red-400/70 mt-0.5">
                  {sessionsError instanceof Error
                    ? sessionsError.message
                    : 'An unexpected error occurred'}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => refetchSessions()}
                className="border-red-500/30 text-red-300 hover:text-red-200 hover:border-red-500/50"
              >
                Retry
              </Button>
            </div>
          </div>
        )}
        <ChatSidebar
          sessions={sessions}
          selectedSessionId={selectedSessionId}
          isLoading={isLoadingSessions}
          onSelectSession={handleSelectSession}
          onNewChat={handleNewChat}
          onDeleteSession={handleDeleteSession}
          isDeletingId={deletingId}
        />
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="h-14 border-b border-zinc-900 flex items-center px-6 shrink-0">
          {selectedSessionId && sessionDetail ? (
            <div>
              <h1 className="text-sm font-medium text-white">
                {sessionDetail.title ??
                  new Date(sessionDetail.created_at).toLocaleDateString(
                    'en-US',
                    {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    }
                  )}
              </h1>
              <p className="text-xs text-zinc-600">
                {messages.length} message
                {messages.length !== 1 ? 's' : ''}
              </p>
            </div>
          ) : (
            <div>
              <h1 className="text-sm font-medium text-white">
                Health AI Assistant
              </h1>
              <p className="text-xs text-zinc-600">
                {userId ? 'Select a session or start a new chat' : 'Loading...'}
              </p>
            </div>
          )}
        </div>

        {sessionError && selectedSessionId && (
          <div className="p-4 border-b border-zinc-900">
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-400">
                  Failed to load chat session
                </p>
                <p className="text-xs text-red-400/70 mt-0.5">
                  {sessionError instanceof Error
                    ? sessionError.message
                    : 'An unexpected error occurred'}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => refetchSession()}
                className="border-red-500/30 text-red-300 hover:text-red-200 hover:border-red-500/50"
              >
                Retry
              </Button>
            </div>
          </div>
        )}

        {/* Messages */}
        <ChatMessages
          messages={messages}
          streamingMessage={streamingMessage}
          isStreaming={isStreaming}
        />

        {/* Input */}
        <ChatInput
          onSend={handleSendMessage}
          isStreaming={isStreaming}
          isDisabled={!selectedSessionId}
        />
      </div>
    </div>
  );
}
