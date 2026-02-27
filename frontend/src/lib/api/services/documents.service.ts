import { apiClient } from '../client';
import { API_ENDPOINTS } from '../config';
import type { MedicalDocument } from '../types';

export const documentsService = {
  async getAll(userId: string): Promise<MedicalDocument[]> {
    return apiClient.get<MedicalDocument[]>(
      `${API_ENDPOINTS.documents}?user_id=${userId}`
    );
  },

  async getById(id: string): Promise<MedicalDocument> {
    return apiClient.get<MedicalDocument>(API_ENDPOINTS.documentDetail(id));
  },

  async upload(
    userId: string,
    file: File,
    meta: { title: string; document_type: string; document_date?: string }
  ): Promise<MedicalDocument> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('user_id', userId);
    formData.append('title', meta.title);
    formData.append('document_type', meta.document_type);
    if (meta.document_date) {
      formData.append('document_date', meta.document_date);
    }
    return apiClient.postMultipart<MedicalDocument>(
      API_ENDPOINTS.documentUpload,
      formData
    );
  },

  async delete(id: string): Promise<void> {
    return apiClient.delete<void>(API_ENDPOINTS.documentDetail(id));
  },
};
