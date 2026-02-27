import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { documentsService } from '../../lib/api/services/documents.service';
import { queryKeys } from '../../lib/query/keys';
import { TERMINAL_DOCUMENT_STATUSES } from '../../lib/api/types';

export function useDocuments(userId: string) {
  return useQuery({
    queryKey: queryKeys.documents.list(userId),
    queryFn: () => documentsService.getAll(userId),
    enabled: !!userId,
  });
}

export function useDocument(id: string, pollUntilComplete = false) {
  return useQuery({
    queryKey: queryKeys.documents.detail(id),
    queryFn: () => documentsService.getById(id),
    enabled: !!id,
    // Poll every 3 seconds until document reaches a terminal status
    refetchInterval: (query) => {
      if (!pollUntilComplete) return false;
      const status = query.state.data?.status;
      if (status && TERMINAL_DOCUMENT_STATUSES.includes(status)) return false;
      return 3000;
    },
  });
}

export function useUploadDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      userId,
      file,
      meta,
    }: {
      userId: string;
      file: File;
      meta: {
        title: string;
        document_type: string;
        document_date?: string;
      };
    }) => documentsService.upload(userId, file, meta),
    onSuccess: (_data, { userId }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.documents.list(userId),
      });
      toast.success('Document uploaded — parsing in progress');
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Upload failed';
      toast.error(message);
    },
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, userId: _userId }: { id: string; userId: string }) =>
      documentsService.delete(id),
    onSuccess: (_data, { userId }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.documents.list(userId),
      });
      toast.success('Document deleted');
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error ? error.message : 'Failed to delete document';
      toast.error(message);
    },
  });
}
