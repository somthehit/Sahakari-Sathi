import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // Data remains fresh for 5 minutes
      gcTime: 15 * 60 * 1000,   // Garbage collect after 15 minutes of inactivity
      retry: 1,                 // Retry failed requests once
      refetchOnWindowFocus: false, // Do not refetch when switching tabs (better for ERPs)
    },
    mutations: {
      retry: 0, // Never retry mutations to prevent accidental double-submits (e.g., double payments)
    }
  },
});

// Canonical React Query keys for cheque-book management / cheque-leaf status.
// A transaction that consumes a leaf (withdrawal, cheque transfer, deposit
// clearing) must invalidate these so the register and account views refresh.
export const chequeQueryKeys = {
  all: ['cheque-book-register'] as const,
  books: () => ['cheque-book-register', 'books'] as const,
  leaves: () => ['cheque-book-register', 'leaves'] as const,
  accountCheques: () => ['account-cheques'] as const,
};

/** Invalidate every cached query that reflects cheque-leaf/register state. */
export function invalidateChequeRegister(client = queryClient) {
  return Promise.allSettled([
    client.invalidateQueries({ queryKey: ['cheque-book-register'] }),
    client.invalidateQueries({ queryKey: ['account-cheques'] }),
  ]);
}

