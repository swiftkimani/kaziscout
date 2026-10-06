import { Link } from 'react-router-dom';
import { useSkillGaps } from '../../api/queries';

/** The skills most often missing across jobs the person nearly matches: what to learn next. */
export function SkillGapsPanel() {
  const report = useSkillGaps();
  // A side panel on the Today screen: while loading, on error or with nothing to say, it stays out of the way.
  if (!report.data || report.data.gaps.length === 0) return null;
  const { gaps, jobsConsidered } = report.data;
  const most = gaps[0]?.jobs ?? 1;

  return (
    <section className="panel" aria-labelledby="gaps-heading">
      <div className="stack-sm">
        <h2 id="gaps-heading">Skills worth learning next</h2>
        <p className="muted">
          Asked for in the {jobsConsidered} jobs you nearly match (scoring 3 to 4) and not in your
          profile or CV.
        </p>
      </div>
      <ol className="gaps">
        {gaps.map((gap) => (
          <li key={gap.skill} className="gaps__row">
            <span className="gaps__skill">{gap.skill}</span>
            <meter className="breakdown__meter" min={0} max={most} value={gap.jobs}>
              {gap.jobs}
            </meter>
            <span className="gaps__count">
              {gap.jobs} {gap.jobs === 1 ? 'job' : 'jobs'}
            </span>
            {gap.examples[0] && (
              <Link className="gaps__example" to={`/jobs/${gap.examples[0].id}`}>
                e.g. {gap.examples[0].title}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
