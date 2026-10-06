import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ApiError } from './api/client';
import { App } from './App';
import { ToastProvider } from './components/ui/Toast';
import './styles/tokens.css';
import './styles/base.css';
import './components/ui/ui.css';
import './styles/app.css';

const queryClient: QueryClient = new QueryClient({
  queryCache: new QueryCache({
    // A 401 mid-session means the sign-in expired: re-check it, which brings up the sign-in page.
    onError: (error, query) => {
      if (error instanceof ApiError && error.status === 401 && query.queryKey[0] !== 'session') {
        void queryClient.invalidateQueries({ queryKey: ['session'] });
      }
    },
  }),
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
});

const root = document.getElementById('root');
if (!root) throw new Error('index.html is missing the #root element');

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ToastProvider>
          <App />
        </ToastProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
