# Frontend Development Guide

This file extends the root AGENTS.md with frontend-specific patterns.

## Tech Stack
- React 19 + TypeScript
- TanStack Router for file-based routing
- TanStack Query for server state
- React Hook Form + Zod for forms
- Tailwind CSS 4.0 + shadcn/ui for styling
- Sonner for toast notifications
- Lucide React for icons
- react-markdown for AI chat rendering
- Vitest for testing

### Resources
- [TanStack Start Documentation](https://tanstack.com/start)
- [TanStack Router Documentation](https://tanstack.com/router)
- [TanStack Query Documentation](https://tanstack.com/query)
- [shadcn/ui Documentation](https://ui.shadcn.com)
- [Tailwind CSS Documentation](https://tailwindcss.com)

## Project Structure
```
src/
├── routes/              # TanStack Router pages (file-based)
│   ├── __root.tsx       # Root layout with providers
│   ├── _authenticated.tsx  # Protected route guard
│   └── _authenticated/  # Protected pages
│       ├── dashboard.tsx
│       ├── chat.tsx     # AI chat page (NEW)
│       └── users.tsx
├── components/
│   ├── ui/              # shadcn/ui components
│   ├── common/          # Shared components (LoadingSpinner, ErrorState)
│   ├── chat/            # Chat UI components (NEW)
│   │   ├── chat-sidebar.tsx        # Session list with new/delete
│   │   ├── chat-messages.tsx       # Scrollable message list
│   │   ├── chat-input.tsx          # Auto-resize textarea + send
│   │   └── chat-stream-message.tsx # Markdown + tool call badges
│   └── [feature]/       # Feature components (user/, settings/)
├── hooks/
│   ├── api/             # React Query hooks (use-users.ts, use-chat.ts)
│   └── use-*.ts         # Custom hooks (use-auth.ts, use-mobile.ts)
├── lib/
│   ├── api/
│   │   ├── client.ts    # API client with retry logic
│   │   ├── config.ts    # Base URL, endpoints
│   │   ├── types.ts     # API types (incl. ChatSession, HAChatMessage)
│   │   └── services/    # Service modules (incl. chat.service.ts)
│   ├── auth/session.ts  # Session management (localStorage)
│   ├── constants/
│   │   └── routes.ts    # Centralized route paths and redirects
│   ├── query/keys.ts    # Query key factory
│   ├── validation/      # Zod schemas
│   └── errors/          # Error handling
└── styles.css           # Tailwind + CSS variables
```

## Reusable Components

### common/

| Component | Description |
|-----------|-------------|
| `LoadingSpinner` | Animated spinner with size variants (`sm`, `md`, `lg`) |
| `LoadingState` | Full-page loading with spinner and optional message |
| `ErrorState` | Error display with message and optional retry button |
| `MetricCard` | Statistics card with icon, value, label, and selection state |
| `SectionHeader` | Section title with optional date range selector |
| `CursorPagination` | Previous/next navigation for cursor-based pagination |

### chat/ (NEW — Health AI Assistant)

| Component | Props | Description |
|-----------|-------|-------------|
| `ChatSidebar` | sessions, selectedSessionId, onSelectSession, onNewChat, onDeleteSession | Session list with "New Chat" button, delete on hover, relative timestamps |
| `ChatMessages` | messages, streamingMessage, isStreaming | Scrollable message list with auto-scroll, welcome empty state with suggestions |
| `ChatInput` | onSend, isStreaming, isDisabled | Auto-resizing textarea, Enter to send, Shift+Enter for newline |
| `ChatStreamMessage` | content, toolCalls, isStreaming, events | Renders markdown via react-markdown, tool call badges, typing cursor |

### layout/

| Component | Description |
|-----------|-------------|
| `SimpleSidebar` | Navigation sidebar with menu items and logout button |

### pages/dashboard/

| Component | Description |
|-----------|-------------|
| `StatsCard` | Dashboard stat with value, icon, and growth percentage indicator |
| `StatsGrid` | Responsive grid layout for StatsCard instances |
| `DashboardLoadingState` | Skeleton loading state for dashboard |
| `DashboardErrorState` | Error state with retry button for dashboard |
| `DataSummaryCard` | Summary card showing count and label |
| `DataMetricsSection` | Displays top series and workout types |
| `RecentUsersSection` | Recent users list with status badges |

### user/

| Component | Description |
|-----------|-------------|
| `ProfileSection` | User profile header with edit dialog and connected providers list |
| `BodySection` | Body metrics display with period toggle (7d/30d/90d) |
| `SleepSection` | Sleep data with charts and session details |
| `ActivitySection` | Activity metrics with dynamic chart selection |
| `WorkoutSection` | Workout list with heart rate time series chart |
| `ConnectionCard` | Provider connection status with sync button |

## Common Patterns

### Creating API Hooks (React Query)

```typescript
// src/hooks/api/use-users.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { usersService } from '../../lib/api';
import { queryKeys } from '../../lib/query/keys';

// Simple query
export function useUsers(filters?: { search?: string }) {
  return useQuery({
    queryKey: queryKeys.users.list(filters),
    queryFn: () => usersService.getAll(filters),
  });
}

// Query with conditional fetching
export function useUser(id: string) {
  return useQuery({
    queryKey: queryKeys.users.detail(id),
    queryFn: () => usersService.getById(id),
    enabled: !!id,
  });
}

// Mutation with cache invalidation
export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UserCreate) => usersService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.lists() });
      toast.success('User created successfully');
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error ? error.message : 'Failed to create user';
      toast.error(message);
    },
  });
}
```

### Chat Hooks Pattern

```typescript
// src/hooks/api/use-chat.ts
export function useChatSessions(userId: string) {
  return useQuery({
    queryKey: queryKeys.chat.sessions(userId),
    queryFn: () => chatService.getSessions(userId),
    enabled: !!userId,
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
  });
}
```

### SSE Streaming Pattern (Chat)

The chat service uses an **async generator** for SSE streaming — NOT the apiClient (which doesn't support streaming).

```typescript
// src/lib/api/services/chat.service.ts
import { getToken } from '../../auth/session';
import { API_CONFIG, API_ENDPOINTS } from '../config';

export const chatService = {
  // Standard CRUD uses apiClient as usual
  async getSessions(userId: string): Promise<ChatSession[]> {
    return apiClient.get<ChatSession[]>(
      `${API_ENDPOINTS.chatSessions}?user_id=${userId}`
    );
  },

  // SSE streaming uses raw fetch + async generator
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

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ')) continue;
        const event = JSON.parse(trimmed.slice(6)) as ChatStreamEvent;
        yield event;
        if (event.type === 'done' || event.type === 'error') return;
      }
    }
  },
};
```

**Usage in chat page** (`routes/_authenticated/chat.tsx`):
```typescript
const stream = chatService.streamMessage(sessionId, content);
for await (const event of stream) {
  if (event.type === 'content') { /* append to streaming message */ }
  if (event.type === 'tool_call') { /* show tool badge */ }
  if (event.type === 'done') break;
}
```

### Query Keys Factory

```typescript
// src/lib/query/keys.ts
export const queryKeys = {
  users: {
    all: ['users'] as const,
    lists: () => [...queryKeys.users.all, 'list'] as const,
    list: (filters?: { search?: string }) =>
      [...queryKeys.users.lists(), filters] as const,
    details: () => [...queryKeys.users.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.users.details(), id] as const,
  },
  chat: {
    all: ['chat'] as const,
    sessions: (userId: string) =>
      [...queryKeys.chat.all, 'sessions', userId] as const,
    session: (id: string) =>
      [...queryKeys.chat.all, 'session', id] as const,
    messages: (sessionId: string) =>
      [...queryKeys.chat.all, 'messages', sessionId] as const,
  },
};
```

### Route Constants

All frontend route paths are centralized in `src/lib/constants/routes.ts`. **Never hardcode route paths** - always import from this file.

```typescript
// src/lib/constants/routes.ts
export const ROUTES = {
  // Public routes
  login: '/login',
  register: '/register',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  acceptInvite: '/accept-invite',

  // Authenticated routes
  dashboard: '/dashboard',
  users: '/users',
  settings: '/settings',
  chat: '/chat',

  // Widget routes
  widgetConnect: '/widget/connect',
} as const;

export const DEFAULT_REDIRECTS = {
  authenticated: ROUTES.dashboard,
  unauthenticated: ROUTES.login,
} as const;
```

### Protected Routes

```typescript
// src/routes/_authenticated.tsx
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { isAuthenticated } from '@/lib/auth/session';
import { DEFAULT_REDIRECTS } from '@/lib/constants/routes';

export const Route = createFileRoute('/_authenticated')({
  component: AuthenticatedLayout,
  beforeLoad: () => {
    if (typeof window === 'undefined') return;
    if (!isAuthenticated()) {
      throw redirect({ to: DEFAULT_REDIRECTS.unauthenticated });
    }
  },
});
```

### API Client

```typescript
// src/lib/api/client.ts — standard CRUD requests
export const apiClient = {
  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const url = `${API_CONFIG.baseUrl}${endpoint}`;
    const token = getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    };
    const response = await fetchWithRetry(url, { ...options, headers });
    if (response.status === 401) {
      clearSession();
      window.location.href = ROUTES.login;
    }
    if (!response.ok) throw ApiError.fromResponse(response);
    return response.json();
  },
  get<T>(endpoint: string) { /* ... */ },
  post<T>(endpoint: string, body: unknown) { /* ... */ },
  patch<T>(endpoint: string, body: unknown) { /* ... */ },
  delete<T>(endpoint: string) { /* ... */ },
};
```

**Note:** `apiClient` does NOT support streaming. For SSE (chat), use raw `fetch()` with `getToken()` from `lib/auth/session.ts`.

### Toast Notifications

```typescript
import { toast } from 'sonner';

toast.success('User created successfully');
toast.error('Failed to save changes');

// In mutations (common pattern)
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: queryKeys.users.lists() });
  toast.success('Operation completed');
},
onError: (error) => {
  toast.error(error instanceof Error ? error.message : 'Operation failed');
},
```

## Adding shadcn/ui Components

```bash
pnpm dlx shadcn@latest add button
pnpm dlx shadcn@latest add card
```

Components are installed to `src/components/ui/`.

## Code Style
- Line width: 80 characters
- Single quotes, semicolons always
- 2-space indentation
- TypeScript strict mode
- Use `cn()` utility for conditional Tailwind classes

```typescript
import { cn } from '@/lib/utils';

<div className={cn('base-class', isActive && 'active-class')} />
```

## Environment Variables

Access via `import.meta.env`:

```typescript
// src/lib/api/config.ts
export const API_CONFIG = {
  baseUrl: import.meta.env.VITE_API_URL || 'http://localhost:8000',
};
```

## Testing
- Framework: Vitest + React Testing Library
- Run: `pnpm run test`
- Test files: `*.test.ts`, `*.test.tsx`

## Commands

```bash
pnpm run dev          # Start dev server (port 3000)
pnpm run build        # Production build
pnpm run lint         # Run oxlint
pnpm run lint:fix     # Fix linting issues
pnpm run format       # Format with Prettier
pnpm run format:check # Check formatting
pnpm run test         # Run tests
```

Run `pnpm run lint:fix && pnpm run format` after making changes.
