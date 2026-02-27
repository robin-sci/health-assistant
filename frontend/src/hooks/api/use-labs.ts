import { useQuery } from '@tanstack/react-query';
import { labsService } from '../../lib/api/services/labs.service';
import { queryKeys } from '../../lib/query/keys';

export function useLabs(
  userId: string,
  params?: { days?: number; test_name?: string }
) {
  return useQuery({
    queryKey: queryKeys.labs.list(userId, params),
    queryFn: () => labsService.getAll(userId, params),
    enabled: !!userId,
  });
}

export function useLabTrend(userId: string, testName: string) {
  return useQuery({
    queryKey: queryKeys.labs.trend(userId, testName),
    queryFn: () => labsService.getTrend(userId, testName),
    enabled: !!userId && !!testName,
  });
}

export function useLabTestNames(userId: string) {
  return useQuery({
    queryKey: queryKeys.labs.testNames(userId),
    queryFn: () => labsService.getTestNames(userId),
    enabled: !!userId,
  });
}
