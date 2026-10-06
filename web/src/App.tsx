import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { EmptyState } from './components/ui/Feedback';
import { BoardsPage } from './features/boards/BoardsPage';
import { ExtractPage } from './features/extract/ExtractPage';
import { JobDetailPage } from './features/jobs/JobDetailPage';
import { JobsPage } from './features/jobs/JobsPage';
import { ProfilePage } from './features/profile/ProfilePage';
import { TrackerPage } from './features/tracker/TrackerPage';

function NotFoundPage() {
  return (
    <EmptyState title="Page not found">
      That address doesn&apos;t exist. <Link to="/jobs">Go to jobs</Link>
    </EmptyState>
  );
}

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/jobs" replace />} />
        <Route path="jobs" element={<JobsPage />} />
        <Route path="jobs/:id" element={<JobDetailPage />} />
        <Route path="boards" element={<BoardsPage />} />
        <Route path="tracker" element={<TrackerPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="markdown" element={<ExtractPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
