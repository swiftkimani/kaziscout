import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { api } from './client';
import type {
  Application,
  ApplicationDocuments,
  ApplicationStatus,
  Board,
  BoardScan,
  CvImport,
  Job,
  JobDetail,
  MarkdownPage,
  Meta,
  Profile,
  Today,
} from './types';

export interface JobFilters {
  search: string;
  board: string;
  country: string;
  remoteOnly: boolean;
  minScore: string;
  sort: 'newest' | 'score';
}

function toQueryString(filters: JobFilters, cursor: string | undefined): string {
  const params = new URLSearchParams({ sort: filters.sort });
  if (filters.search) params.set('search', filters.search);
  if (filters.board) params.set('board', filters.board);
  if (filters.country) params.set('country', filters.country);
  if (filters.remoteOnly) params.set('remote', 'true');
  if (filters.minScore) params.set('minScore', filters.minScore);
  if (cursor) params.set('cursor', cursor);
  return params.toString();
}

/** Scans, scoring and profile changes all alter what the job list shows. */
async function invalidateJobs(client: QueryClient): Promise<void> {
  await Promise.all([
    client.invalidateQueries({ queryKey: ['jobs'] }),
    // The meta response lists which countries have jobs, which a scan can change.
    client.invalidateQueries({ queryKey: ['meta'] }),
  ]);
}

export function useMeta() {
  return useQuery({
    queryKey: ['meta'],
    queryFn: () => api<Meta>('/v1/meta'),
  });
}

export function useJobs(filters: JobFilters) {
  return useInfiniteQuery({
    queryKey: ['jobs', 'list', filters],
    queryFn: ({ pageParam }) =>
      api<{ data: Job[]; next_cursor: string | null }>(
        `/v1/jobs?${toQueryString(filters, pageParam)}`,
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
  });
}

export function useJob(id: string) {
  return useQuery({
    queryKey: ['jobs', 'detail', id],
    queryFn: async () => (await api<{ data: JobDetail }>(`/v1/jobs/${id}`)).data,
  });
}

export const jobActions = {
  evaluate: (jobId: string, evaluator: 'heuristic' | 'ai') =>
    api<{ data: Job }>(`/v1/jobs/${jobId}/evaluate`, { method: 'POST', body: { evaluator } }),
  fetchFullPosting: (jobId: string) =>
    api<{ data: MarkdownPage }>(`/v1/jobs/${jobId}/markdown`, { method: 'POST' }),
  getPack: async (jobId: string) =>
    (await api<{ data: { pack: string } }>(`/v1/jobs/${jobId}/application-pack`)).data.pack,
  assist: (jobId: string) =>
    api<{ data: { pack: string } }>(`/v1/jobs/${jobId}/assist`, { method: 'POST' }),
};

export function useDocuments(jobId: string) {
  return useQuery({
    queryKey: ['documents', jobId],
    queryFn: async () =>
      (await api<{ data: ApplicationDocuments | null }>(`/v1/jobs/${jobId}/documents`)).data,
  });
}

export function useWriteDocuments(jobId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      (await api<{ data: ApplicationDocuments }>(`/v1/jobs/${jobId}/documents`, { method: 'POST' }))
        .data,
    onSuccess: (documents) => client.setQueryData(['documents', jobId], documents),
  });
}

export function useToday() {
  return useQuery({
    // Under "jobs" so scans, saves and scoring refresh it along with the job lists.
    queryKey: ['jobs', 'today'],
    queryFn: async () => (await api<{ data: Today }>('/v1/today')).data,
  });
}

export function useBoards() {
  return useQuery({
    queryKey: ['boards'],
    queryFn: async () => (await api<{ data: Board[] }>('/v1/boards')).data,
  });
}

export function useScan() {
  const client = useQueryClient();
  return useMutation({
    /** Scans one board, or every scannable board when no id is given. */
    mutationFn: async (boardId?: string): Promise<BoardScan[]> => {
      if (boardId === undefined) {
        return (await api<{ data: BoardScan[] }>('/v1/scans', { method: 'POST' })).data;
      }
      const one = await api<{ data: BoardScan }>(`/v1/boards/${boardId}/scan`, { method: 'POST' });
      return [one.data];
    },
    onSettled: () =>
      Promise.all([client.invalidateQueries({ queryKey: ['boards'] }), invalidateJobs(client)]),
  });
}

export function useProfile() {
  return useQuery({
    queryKey: ['profile'],
    queryFn: async () => (await api<{ data: Profile | null }>('/v1/profile')).data,
  });
}

export function useSaveProfile() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (profile: Profile) =>
      api<{ data: Profile; rescored: number }>('/v1/profile', { method: 'PUT', body: profile }),
    onSuccess: (result) => {
      client.setQueryData(['profile'], result.data);
      return invalidateJobs(client);
    },
  });
}

export type CvImportRequest =
  { filename: string; contentBase64: string } | { text: string } | { clipboard: true };

export function useImportCv() {
  return useMutation({
    mutationFn: async (request: CvImportRequest) =>
      (await api<{ data: CvImport }>('/v1/profile/import', { method: 'POST', body: request })).data,
  });
}

export function useApplications() {
  return useQuery({
    queryKey: ['applications'],
    queryFn: async () => (await api<{ data: Application[] }>('/v1/applications')).data,
  });
}

export function useApplicationMutations() {
  const client = useQueryClient();
  const onSuccess = () =>
    Promise.all([client.invalidateQueries({ queryKey: ['applications'] }), invalidateJobs(client)]);
  return {
    save: useMutation({
      mutationFn: (jobId: string) =>
        api<{ data: Application }>('/v1/applications', { method: 'POST', body: { jobId } }),
      onSuccess,
    }),
    update: useMutation({
      mutationFn: (change: { id: number; status?: ApplicationStatus; notes?: string }) =>
        api<{ data: Application }>(`/v1/applications/${change.id}`, {
          method: 'PATCH',
          body: { status: change.status, notes: change.notes },
        }),
      onSuccess,
    }),
    remove: useMutation({
      mutationFn: (id: number) => api<void>(`/v1/applications/${id}`, { method: 'DELETE' }),
      onSuccess,
    }),
  };
}

export function useExtract() {
  return useMutation({
    mutationFn: async (url: string) =>
      (await api<{ data: MarkdownPage }>('/v1/extract', { method: 'POST', body: { url } })).data,
  });
}

export interface Session {
  required: boolean;
  authenticated: boolean;
}

export function useSession() {
  return useQuery({
    queryKey: ['session'],
    queryFn: async () => (await api<{ data: Session }>('/v1/session')).data,
    staleTime: Infinity,
  });
}

export function useSignIn() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (token: string) =>
      (await api<{ data: Session }>('/v1/session', { method: 'POST', body: { token } })).data,
    // Everything fetched before sign-in was refused, so it is all fetched again.
    onSuccess: () => client.invalidateQueries(),
  });
}

export function useSignOut() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>('/v1/session', { method: 'DELETE' }),
    onSuccess: () => client.invalidateQueries(),
  });
}
