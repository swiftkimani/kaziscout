import { useState } from 'react';
import { useProfile } from '../../api/queries';
import type { CvImport, FollowUpQuestion, Profile } from '../../api/types';
import { ErrorState, Skeleton } from '../../components/ui/Feedback';
import { ImportCvPanel } from './ImportCvPanel';
import { ProfileForm } from './ProfileForm';

const EMPTY_PROFILE: Profile = {
  fullName: '',
  email: '',
  phone: '',
  headline: '',
  cvText: '',
  skills: [],
  targetTitles: [],
  countries: [],
  isRemoteOk: true,
};

/** The questions a CV import left open, shown above the form that answers them. */
function FollowUps({ result }: { result: CvImport }) {
  return (
    <section className="panel followups" aria-labelledby="followups-heading" role="status">
      <h2 id="followups-heading">
        Read your CV {result.readBy === 'ai' ? 'with the AI model' : ''}. A few things to confirm
      </h2>
      <ul className="points">
        {result.questions.map(({ field, question, suggestion }: FollowUpQuestion) => (
          <li key={field}>
            {question}
            {suggestion && <span className="muted"> Suggested: {suggestion}</span>}
          </li>
        ))}
      </ul>
      <p className="muted">Check the fields below, answer these, then save.</p>
    </section>
  );
}

export function ProfilePage() {
  const profile = useProfile();
  // Each import gets a number so the form below is rebuilt from the new draft.
  const [imported, setImported] = useState<{ result: CvImport; count: number } | null>(null);

  const draftOver = (saved: Profile | null): Profile => {
    if (!imported) return saved ?? EMPTY_PROFILE;
    const { draft } = imported.result;
    // Roles are the person's choice, so ones already saved outlive a new CV that suggests none.
    const keepRoles = draft.targetTitles.length === 0 && saved;
    return keepRoles ? { ...draft, targetTitles: saved.targetTitles } : draft;
  };

  return (
    <div className="stack">
      <header className="stack-sm">
        <h1>Profile</h1>
        <p className="muted">What you are looking for. Every job is scored against this.</p>
      </header>
      {profile.isPending && (
        <div className="stack form" aria-busy="true" aria-label="Loading profile">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} height="var(--space-12)" />
          ))}
        </div>
      )}
      {profile.isError && (
        <ErrorState error={profile.error} onRetry={() => void profile.refetch()} />
      )}
      {profile.isSuccess && (
        <>
          <ImportCvPanel
            onImported={(result) =>
              setImported((previous) => ({ result, count: (previous?.count ?? 0) + 1 }))
            }
          />
          {imported && <FollowUps result={imported.result} />}
          <ProfileForm key={imported?.count ?? 0} initial={draftOver(profile.data)} />
        </>
      )}
    </div>
  );
}
