import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { symptomsService } from '../../lib/api/services/symptoms.service';
import type { SymptomCreate, SymptomListParams } from '../../lib/api/types';
import { queryKeys } from '../../lib/query/keys';

export function useSymptoms(userId: string, params?: SymptomListParams) {
  return useQuery({
    queryKey: queryKeys.symptoms.list(userId, params),
    queryFn: () => symptomsService.getAll(userId, params),
    enabled: !!userId,
  });
}

export function useSymptomTypes(userId: string) {
  return useQuery({
    queryKey: queryKeys.symptoms.types(userId),
    queryFn: () => symptomsService.getTypes(userId),
    enabled: !!userId,
  });
}

export function useCreateSymptom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SymptomCreate) => symptomsService.create(data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.symptoms.lists(),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.symptoms.types(variables.user_id),
      });
      toast.success('Symptom logged successfully');
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error ? error.message : 'Failed to log symptom';
      toast.error(message);
    },
  });
}
