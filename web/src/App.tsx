import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { AuthGate } from './components/AuthGate';
import { EmptyState } from './components/ui/Feedback';
import { BoardsPage } from './features/boards/BoardsPage';
import { ExtractPage } from './features/extract/ExtractPage';
import { DocumentPrintPage } from './features/jobs/DocumentPrintPage';
import { JobDetailPage } from './features/jobs/JobDetailPage';
import { JobsPage } from './features/jobs/JobsPage';
import { PracticeFormPage } from './features/practice/PracticeFormPage';
import { ProfilePage } from './features/profile/ProfilePage';
import { TodayPage } from './features/today/TodayPage';
import { TrackerPage } from './features/tracker/TrackerPage';
import { TriagePage } from './features/triage/TriagePage';

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
      <Route
        path="jobs/:id/print/:kind"
        element={
          <AuthGate>
            <DocumentPrintPage />
          </AuthGate>
        }
      />
      <Route
        element={
          <AuthGate>
            <AppShell />
          </AuthGate>
        }
      >
        <Route index element={<Navigate to="/today" replace />} />
        <Route path="today" element={<TodayPage />} />
        <Route path="jobs" element={<JobsPage />} />
        <Route path="jobs/:id" element={<JobDetailPage />} />
        <Route path="review" element={<TriagePage />} />
        <Route path="boards" element={<BoardsPage />} />
        <Route path="tracker" element={<TrackerPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="markdown" element={<ExtractPage />} />
        <Route path="practice-form" element={<PracticeFormPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
