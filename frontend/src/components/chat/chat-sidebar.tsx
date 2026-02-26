import { Plus, Trash2, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { ChatSession } from '@/lib/api/types';

interface ChatSidebarProps {
  sessions: ChatSession[];
  selectedSessionId: string | null;
  isLoading: boolean;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onDeleteSession: (id: string) => void;
  isDeletingId: string | null;
}

function formatSessionTitle(session: ChatSession): string {
  if (session.title) return session.title;
  const date = new Date(session.created_at);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function ChatSidebar({
  sessions,
  selectedSessionId,
  isLoading,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  isDeletingId,
}: ChatSidebarProps) {
  return (
    <div className="flex flex-col h-full bg-black border-r border-zinc-900">
      {/* Header */}
      <div className="p-4 border-b border-zinc-900">
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
          Chat Sessions
        </h2>
        <Button
          onClick={onNewChat}
          size="sm"
          className="w-full bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-800 gap-2"
          variant="ghost"
        >
          <Plus className="h-3.5 w-3.5" />
          New Chat
        </Button>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {isLoading && (
          <div className="space-y-2 p-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton
                key={i}
                className="h-14 w-full bg-zinc-900 rounded-md"
              />
            ))}
          </div>
        )}

        {!isLoading && sessions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <MessageSquare className="h-8 w-8 text-zinc-700 mb-3" />
            <p className="text-xs text-zinc-500">No conversations yet</p>
            <p className="text-xs text-zinc-600 mt-1">Start a new chat above</p>
          </div>
        )}

        {!isLoading &&
          sessions.map((session) => {
            const isActive = session.id === selectedSessionId;
            const isDeleting = isDeletingId === session.id;

            return (
              <div
                key={session.id}
                className={cn(
                  'group relative flex items-start gap-2 px-3 py-2.5 rounded-md cursor-pointer transition-all duration-150',
                  isActive
                    ? 'bg-zinc-900 border-l-2 border-white -ml-[2px] pl-[calc(0.75rem+2px)]'
                    : 'hover:bg-zinc-900/60 border-l-2 border-transparent'
                )}
                onClick={() => onSelectSession(session.id)}
              >
                <MessageSquare
                  className={cn(
                    'h-3.5 w-3.5 mt-0.5 shrink-0 transition-colors',
                    isActive ? 'text-white' : 'text-zinc-600'
                  )}
                />
                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      'text-xs font-medium truncate leading-snug',
                      isActive ? 'text-white' : 'text-zinc-300'
                    )}
                  >
                    {formatSessionTitle(session)}
                  </p>
                  <p className="text-[10px] text-zinc-600 mt-0.5">
                    {formatRelativeTime(session.last_activity_at)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity',
                    'text-zinc-600 hover:text-red-400 hover:bg-transparent'
                  )}
                  disabled={isDeleting}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteSession(session.id);
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            );
          })}
      </div>
    </div>
  );
}
