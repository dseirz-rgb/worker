/**
 * tRPC Client Stub
 * 
 * The actual server implementation uses Vercel Functions (api folder)
 * This stub provides type-safe mock implementations for auth hooks
 * TODO: If tRPC is needed, implement proper server/routers/index.ts
 */

import React from 'react';

// Mock user type
type User = {
  id: string;
  email: string;
  name?: string;
} | null;

// Provider component type
interface ProviderProps {
  children: React.ReactNode;
  client: unknown;
  queryClient: unknown;
}

// Create a mock trpc object that satisfies the usage in useAuth and main.tsx
export const trpc = {
  useUtils: () => ({
    auth: {
      me: {
        setData: (_key: unknown, _data: User) => {},
        invalidate: async () => {},
      },
    },
  }),
  auth: {
    me: {
      useQuery: (_input?: unknown, _options?: unknown) => ({
        data: null as User,
        isLoading: false,
        error: null,
        refetch: async () => ({ data: null }),
      }),
    },
    logout: {
      useMutation: (_options?: unknown) => ({
        mutateAsync: async () => {},
        isPending: false,
        error: null,
      }),
    },
  },
  Provider: ({ children }: ProviderProps) => React.createElement(React.Fragment, null, children),
  createClient: (_options: unknown) => ({}),
};
