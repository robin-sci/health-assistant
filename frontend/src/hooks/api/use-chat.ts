import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { chatService } from '../../lib/api';
import { queryKeys } from '../../lib/query/keys';

export function useChatSessions(userId: string) {
  return useQuery({
    queryKey: queryKeys.chat.sessions(userId),
    queryFn: () => chatService.getSessions(userId),
    enabled: !!userId,
  });
}

export function useChatSession(id: string) {
  return useQuery({
    queryKey: queryKeys.chat.session(id),
    queryFn: () => chatService.getSession(id),
    enabled: !!id,
  });
}

export function useCreateChatSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, title }: { userId: string; title?: string }) =>
      chatService.createSession(userId, title),
    onSuccess: (_data, { userId }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.chat.sessions(userId),
      });
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to create chat session';
      toast.error(message);
    },
  });
}

export function useDeleteChatSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, userId: _userId }: { id: string; userId: string }) =>
      chatService.deleteSession(id),
    onSuccess: (_data, { userId }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.chat.sessions(userId),
      });
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to delete chat session';
      toast.error(message);
    },
  });
}
