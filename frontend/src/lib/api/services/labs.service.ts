import { apiClient } from '../client';
import { API_ENDPOINTS } from '../config';
import type { LabResult, LabTrendResponse } from '../types';

export const labsService = {
  async getAll(
    userId: string,
    params?: { days?: number; test_name?: string }
  ): Promise<LabResult[]> {
    const searchParams = new URLSearchParams({ user_id: userId });
    if (params?.days !== undefined) {
      searchParams.append('days', String(params.days));
    }
    if (params?.test_name) {
      searchParams.append('test_name', params.test_name);
    }
    return apiClient.get<LabResult[]>(
      `${API_ENDPOINTS.labs}?${searchParams.toString()}`
    );
  },

  async getTrend(
    userId: string,
    testName: string,
    months?: number
  ): Promise<LabTrendResponse> {
    const searchParams = new URLSearchParams({ user_id: userId });
    if (months !== undefined) {
      searchParams.append('months', String(months));
    }
    return apiClient.get<LabTrendResponse>(
      `${API_ENDPOINTS.labTrend(testName)}?${searchParams.toString()}`
    );
  },

  async getTestNames(userId: string): Promise<string[]> {
    return apiClient.get<string[]>(
      `${API_ENDPOINTS.labTestNames}?user_id=${userId}`
    );
  },
};
