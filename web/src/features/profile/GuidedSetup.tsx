import { useState } from 'react';
import type { CvImport, FollowUpQuestion, Meta, Profile } from '../../api/types';
import { Button } from '../../components/ui/Button';
import { TextAreaField, TextField } from '../../components/ui/Field';
import { CountryPicker } from './CountryPicker';

const LIST_FIELDS = new Set<keyof Profile>(['targetTitles', 'skills']);

function splitList(text: string): string[] {
  return text
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

/** The control that answers one question, chosen by the kind of field it fills. */
function Answer({
  question,
  draft,
  meta,
  onChange,
}: {
  question: FollowUpQuestion;
  draft: Profile;
  meta?: Meta;
  onChange: (draft: Profile) => void;
}) {
  const { field } = question;
  if (field === 'countries') {
    return (
      <CountryPicker
        meta={meta}
        selected={draft.countries}
        onChange={(countries) => onChange({ ...draft, countries })}
      />
    );
  }
  if (field === 'isRemoteOk') {
    return (
      <div className="row" role="group" aria-label={question.question}>
        {[true, false].map((choice) => (
          <Button
            key={String(choice)}
            variant={draft.isRemoteOk === choice ? 'primary' : 'secondary'}
            aria-pressed={draft.isRemoteOk === choice}
            onClick={() => onChange({ ...draft, isRemoteOk: choice })}
          >
            {choice ? 'Yes, remote suits me' : 'No, on-site only'}
          </Button>
        ))}
      </div>
    );
  }
  if (LIST_FIELDS.has(field)) {
    const value = (draft[field] as string[]).join('\n');
    return (
      <TextAreaField
        label="Your answer"
        hint="One per line, or separated by commas."
        rows={4}
        // Uncontrolled, so typing a comma or a new line is not undone by re-splitting the list.
        defaultValue={value}
        onChange={(event) => onChange({ ...draft, [field]: splitList(event.target.value) })}
      />
    );
  }
  return (
    <TextField
      label="Your answer"
      value={String(draft[field])}
      onChange={(event) => onChange({ ...draft, [field]: event.target.value })}
    />
  );
}

/** Starting values for the answers: what the CV gave, plus any suggestion for an empty list. */
function withSuggestions(result: CvImport): Profile {
  const draft = { ...result.draft };
  const roles = result.questions.find((question) => question.field === 'targetTitles');
  if (draft.targetTitles.length === 0 && roles?.suggestion) {
    draft.targetTitles = splitList(roles.suggestion);
  }
  return draft;
}

/**
 * Asks the questions a CV import left open, one per step, then hands the finished profile back
 * to be saved. The person can leave for the full form at any step.
 */
export function GuidedSetup({
  result,
  meta,
  isSaving,
  onFinish,
  onUseFullForm,
}: {
  result: CvImport;
  meta?: Meta;
  isSaving: boolean;
  onFinish: (profile: Profile) => void;
  onUseFullForm: (profile: Profile) => void;
}) {
  const [draft, setDraft] = useState(() => withSuggestions(result));
  const [step, setStep] = useState(0);
  const { questions } = result;
  const question = questions[step];
  const isLast = step === questions.length - 1;
  const cannotFinish = !draft.fullName.trim();

  if (!question) return null;

  return (
    <section className="panel form" aria-labelledby="setup-question">
      <p className="muted" aria-live="polite">
        Question {step + 1} of {questions.length}
      </p>
      <h2 id="setup-question">{question.question}</h2>
      {/* The key resets the answer control between steps, so one step's text never leaks into the next. */}
      <Answer
        key={question.field}
        question={question}
        draft={draft}
        meta={meta}
        onChange={setDraft}
      />
      {isLast && cannotFinish && (
        <p className="field__error" role="alert">
          A profile needs your name. Go back and enter it, or use the full form.
        </p>
      )}
      <div className="row-between">
        <div className="row">
          {step > 0 && <Button onClick={() => setStep(step - 1)}>Back</Button>}
          {isLast ? (
            <Button
              variant="primary"
              isBusy={isSaving}
              disabled={cannotFinish}
              onClick={() => onFinish(draft)}
            >
              {isSaving ? 'Saving profile' : 'Save profile'}
            </Button>
          ) : (
            <Button variant="primary" onClick={() => setStep(step + 1)}>
              Next
            </Button>
          )}
        </div>
        <Button variant="ghost" onClick={() => onUseFullForm(draft)}>
          Edit everything in one form
        </Button>
      </div>
    </section>
  );
}
