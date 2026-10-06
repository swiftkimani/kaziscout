import { useState, type FormEvent } from 'react';
import { Button } from '../../components/ui/Button';
import { TextAreaField, TextField } from '../../components/ui/Field';

interface Submission {
  fullName: string;
  email: string;
  phone: string;
  headline: string;
  coverLetter: string;
}

const EMPTY: Submission = { fullName: '', email: '', phone: '', headline: '', coverLetter: '' };

/**
 * A stand-in for an employer's application form. It sends nothing anywhere. People and AI agents
 * use it to rehearse an assisted application, including stopping before Submit.
 */
export function PracticeFormPage() {
  const [form, setForm] = useState(EMPTY);
  const [submitted, setSubmitted] = useState<Submission | null>(null);
  const set = (key: keyof Submission) => (event: { target: { value: string } }) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(form);
  };

  return (
    <div className="stack form">
      <header className="stack-sm">
        <h1>Practice application form</h1>
        <p className="muted">
          A rehearsal form shaped like a typical employer&apos;s. Nothing you enter leaves this
          page. Use it to try an assisted application before a real one.
        </p>
      </header>

      {submitted ? (
        <div className="panel" role="status">
          <h2>Practice form submitted</h2>
          <p>Nothing was sent. On a real form, this is the step only you should take.</p>
          <dl className="stack-sm">
            {Object.entries(submitted).map(([field, value]) => (
              <div key={field}>
                <dt className="field__label">{field}</dt>
                <dd className="muted">{value || '(left blank)'}</dd>
              </div>
            ))}
          </dl>
          <div>
            <Button
              onClick={() => {
                setSubmitted(null);
                setForm(EMPTY);
              }}
            >
              Start again
            </Button>
          </div>
        </div>
      ) : (
        <form className="stack" onSubmit={submit} aria-label="Practice application">
          <TextField
            label="Full name"
            autoComplete="off"
            value={form.fullName}
            onChange={set('fullName')}
          />
          <TextField
            label="Email address"
            type="email"
            autoComplete="off"
            value={form.email}
            onChange={set('email')}
          />
          <TextField
            label="Phone number"
            type="tel"
            autoComplete="off"
            value={form.phone}
            onChange={set('phone')}
          />
          <TextField
            label="Current role or headline"
            autoComplete="off"
            value={form.headline}
            onChange={set('headline')}
          />
          <TextAreaField
            label="Why are you a good fit for this role?"
            rows={8}
            value={form.coverLetter}
            onChange={set('coverLetter')}
          />
          <div>
            <Button type="submit" variant="primary">
              Submit application
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
