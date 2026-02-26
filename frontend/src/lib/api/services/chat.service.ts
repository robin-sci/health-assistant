import { apiClient } from '../client';
import { API_ENDPOINTS } from '../config';
import { API_CONFIG } from '../config';
import { getToken } from '../../auth/session';
import type {
  ChatSession,
  ChatSessionDetail,
  HAChatMessage,
  ChatStreamEvent,
} from '../types';

export const chatService = {
  async getSessions(userId: string): Promise<ChatSession[]> {
    const url = `${API_ENDPOINTS.chatSessions}?user_id=${userId}`;
    return apiClient.get<ChatSession[]>(url);
  },

  async getSession(id: string): Promise<ChatSessionDetail> {
    return apiClient.get<ChatSessionDetail>(
      API_ENDPOINTS.chatSessionDetail(id)
    );
  },

  async getMessages(sessionId: string): Promise<HAChatMessage[]> {
    return apiClient.get<HAChatMessage[]>(
      API_ENDPOINTS.chatSessionMessages(sessionId)
    );
  },

  async createSession(userId: string, title?: string): Promise<ChatSession> {
    return apiClient.post<ChatSession>(API_ENDPOINTS.chatSessions, {
      user_id: userId,
      title: title ?? null,
    });
  },

  async deleteSession(id: string): Promise<void> {
    return apiClient.delete<void>(API_ENDPOINTS.chatSessionDetail(id));
  },

  async *streamMessage(
    sessionId: string,
    content: string
  ): AsyncGenerator<ChatStreamEvent> {
    const token = getToken();
    const url = `${API_CONFIG.baseUrl}${API_ENDPOINTS.chatSessionMessages(sessionId)}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ content }),
    });

    if (!response.ok) {
      throw new Error(`Stream request failed: ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('Response body is empty');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;

          const jsonStr = trimmed.slice(6).trim();
          if (!jsonStr) continue;

          try {
            const event = JSON.parse(jsonStr) as ChatStreamEvent;
            yield event;
            if (event.type === 'done' || event.type === 'error') {
              return;
            }
          } catch {
            // Skip malformed events
          }
        }
      }

      // Process remaining buffer
      if (buffer.trim().startsWith('data: ')) {
        const jsonStr = buffer.trim().slice(6).trim();
        if (jsonStr) {
          try {
            const event = JSON.parse(jsonStr) as ChatStreamEvent;
            yield event;
          } catch {
            // Skip malformed events
          }
        }
      }
    } finally {
      reader.cancel();
    }
  },
};
