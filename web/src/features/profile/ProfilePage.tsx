import { useState, type FormEvent } from 'react';
import { ApiError } from '../../api/client';
import { useMeta, useProfile, useSaveProfile } from '../../api/queries';
import type { Profile } from '../../api/types';
import { Button } from '../../components/ui/Button';
import { ErrorState, Skeleton } from '../../components/ui/Feedback';
import { Checkbox, TextAreaField, TextField } from '../../components/ui/Field';
import { useToast } from '../../components/ui/Toast';
import { CountryPicker } from './CountryPicker';

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

function splitList(text: string): string[] {
  return text
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function ProfileForm({ initial }: { initial: Profile }) {
  const meta = useMeta();
  const save = useSaveProfile();
  const toast = useToast();
  const [profile, setProfile] = useState(initial);
  // Lists are edited as free text and split on save, so typing a comma doesn't fight the cursor.
  const [skillsText, setSkillsText] = useState(initial.skills.join(', '));
  const [titlesText, setTitlesText] = useState(initial.targetTitles.join('\n'));
  const [nameError, setNameError] = useState('');

  const fieldErrors = save.error instanceof ApiError ? save.error.fieldErrors : {};
  const validateName = (name: string) => setNameError(name.trim() ? '' : 'Enter your name');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!profile.fullName.trim()) return validateName(profile.fullName);
    save.mutate(
      { ...profile, skills: splitList(skillsText), targetTitles: splitList(titlesText) },
      {
        onSuccess: (result) => toast.success(`Profile saved. ${result.rescored} jobs re-scored.`),
        onError: (error) => toast.error(error, "Couldn't save your profile. Try again."),
      },
    );
  };

  return (
    <form className="stack form" onSubmit={submit} noValidate>
      <TextField
        label="Full name"
        autoComplete="name"
        value={profile.fullName}
        error={nameError || fieldErrors.fullName}
        onChange={(event) => setProfile({ ...profile, fullName: event.target.value })}
        onBlur={(event) => validateName(event.target.value)}
      />
      <TextField
        label="Email address"
        type="email"
        autoComplete="email"
        hint="Optional. Goes into your application pack so forms can be filled in."
        value={profile.email}
        error={fieldErrors.email}
        onChange={(event) => setProfile({ ...profile, email: event.target.value })}
      />
      <TextField
        label="Phone number"
        type="tel"
        autoComplete="tel"
        hint="Optional. Include the country code, for example +254 712 345 678."
        value={profile.phone}
        error={fieldErrors.phone}
        onChange={(event) => setProfile({ ...profile, phone: event.target.value })}
      />
      <TextField
        label="Headline"
        hint="One line on what you do, for example: Full-stack developer, 3 years."
        value={profile.headline}
        error={fieldErrors.headline}
        onChange={(event) => setProfile({ ...profile, headline: event.target.value })}
      />
      <TextAreaField
        label="Roles you want"
        hint="One job title per line. Jobs with similar titles score higher."
        rows={3}
        value={titlesText}
        error={fieldErrors.targetTitles}
        onChange={(event) => setTitlesText(event.target.value)}
      />
      <TextAreaField
        label="Skills"
        hint="Separate with commas. Jobs that mention them score higher."
        rows={3}
        value={skillsText}
        error={fieldErrors.skills}
        onChange={(event) => setSkillsText(event.target.value)}
      />
      <CountryPicker
        meta={meta.data}
        selected={profile.countries}
        onChange={(countries) => setProfile((current) => ({ ...current, countries }))}
      />
      <Checkbox
        label="I'm open to remote work"
        checked={profile.isRemoteOk}
        onChange={(event) => setProfile({ ...profile, isRemoteOk: event.target.checked })}
      />
      <TextAreaField
        label="CV"
        hint="Paste your CV as plain text. It stays on this computer unless you ask an AI model to assess a job."
        rows={12}
        value={profile.cvText}
        error={fieldErrors.cvText}
        onChange={(event) => setProfile({ ...profile, cvText: event.target.value })}
      />
      <div>
        <Button type="submit" variant="primary" isBusy={save.isPending}>
          {save.isPending ? 'Saving profile' : 'Save profile'}
        </Button>
      </div>
    </form>
  );
}

export function ProfilePage() {
  const profile = useProfile();

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
      {profile.isSuccess && <ProfileForm initial={profile.data ?? EMPTY_PROFILE} />}
    </div>
  );
}
