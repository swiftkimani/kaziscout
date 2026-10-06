import { Link } from 'react-router-dom';
import type { Evaluation } from '../../api/types';
import { Badge } from '../../components/ui/Feedback';

function PointList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="stack-sm">
      <h3>{title}</h3>
      <ul className="points">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

const BREAKDOWN_PARTS = [
  ['title', 'Title'],
  ['skills', 'Skills'],
  ['location', 'Location'],
  ['freshness', 'Freshness'],
] as const;

/** The four parts of the keyword score as labelled meters, so the number explains itself. */
function ScoreBreakdown({ breakdown }: { breakdown: NonNullable<Evaluation['breakdown']> }) {
  return (
    <dl className="breakdown">
      {BREAKDOWN_PARTS.map(([key, label]) => {
        const percent = Math.round(breakdown[key] * 100);
        return (
          <div key={key} className="breakdown__row">
            <dt>{label}</dt>
            <dd>
              <meter className="breakdown__meter" min={0} max={100} value={percent}>
                {percent}%
              </meter>
              <span className="breakdown__value">{percent}%</span>
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

export function EvaluationPanel({ evaluation }: { evaluation?: Evaluation }) {
  return (
    <section className="panel" aria-labelledby="fit-heading">
      <div className="row-between">
        <h2 id="fit-heading">Fit</h2>
        {evaluation && (
          <Badge tone={evaluation.evaluator === 'ai' ? 'info' : 'neutral'}>
            {evaluation.evaluator === 'ai'
              ? `Assessed by ${evaluation.model ?? 'AI'}`
              : 'Keyword score'}
          </Badge>
        )}
      </div>
      {evaluation ? (
        <div className="stack">
          <p>{evaluation.verdict}</p>
          {evaluation.breakdown && <ScoreBreakdown breakdown={evaluation.breakdown} />}
          <PointList title="Why you fit" items={evaluation.strengths} />
          <PointList title="Gaps to address" items={evaluation.gaps} />
          {evaluation.pitch && (
            <div className="stack-sm">
              <h3>Suggested opening</h3>
              <p className="pitch">{evaluation.pitch}</p>
            </div>
          )}
        </div>
      ) : (
        <p className="muted">
          This job has no score yet. <Link to="/profile">Fill in your profile</Link> and every job
          is scored against it.
        </p>
      )}
    </section>
  );
}
