import { QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

import { createQueryClient } from '@/serverState/createQueryClient';

type ServerStateProviderProps = {
  children: ReactNode;
};

export function ServerStateProvider({ children }: ServerStateProviderProps) {
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
