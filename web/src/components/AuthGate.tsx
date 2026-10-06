import { useState, type FormEvent, type ReactNode } from 'react';
import { useSession, useSignIn } from '../api/queries';
import { Button } from './ui/Button';
import { ErrorState, Skeleton } from './ui/Feedback';
import { TextField } from './ui/Field';
import { ApiError } from '../api/client';

function SignInPage() {
  const signIn = useSignIn();
  const [token, setToken] = useState('');
  const [error, setError] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!token.trim()) return setError('Enter your access token');
    setError('');
    signIn.mutate(token.trim(), {
      onError: (failure) =>
        setError(
          failure instanceof ApiError ? failure.message : "Couldn't reach KaziScout. Try again.",
        ),
    });
  };

  return (
    <main className="auth">
      <form className="panel auth__panel" onSubmit={submit} noValidate>
        <h1>Sign in to KaziScout</h1>
        <TextField
          label="Access token"
          type="password"
          autoComplete="current-password"
          hint="The ACCESS_TOKEN value set where this KaziScout runs."
          value={token}
          error={error}
          onChange={(event) => setToken(event.target.value)}
        />
        <Button type="submit" variant="primary" isBusy={signIn.isPending}>
          {signIn.isPending ? 'Signing in' : 'Sign in'}
        </Button>
      </form>
    </main>
  );
}

/** Shows the app when no sign-in is needed or the person is signed in; otherwise the sign-in page. */
export function AuthGate({ children }: { children: ReactNode }) {
  const session = useSession();

  if (session.isPending) {
    return (
      <main className="auth" aria-busy="true" aria-label="Loading KaziScout">
        <Skeleton width="var(--column-min)" height="var(--space-16)" />
      </main>
    );
  }
  if (session.isError) {
    return (
      <main className="auth">
        <ErrorState error={session.error} onRetry={() => void session.refetch()} />
      </main>
    );
  }
  return session.data.authenticated ? children : <SignInPage />;
}
