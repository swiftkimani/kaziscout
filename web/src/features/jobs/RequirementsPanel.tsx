import { Check, Minus } from 'lucide-react';
import type { Requirement } from '../../api/types';

/** What the posting asks for, each marked as shown or not shown by the person's profile and CV. */
export function RequirementsPanel({ requirements }: { requirements: Requirement[] }) {
  if (requirements.length === 0) return null;
  const met = requirements.filter((requirement) => requirement.inProfile).length;

  return (
    <section className="panel" aria-labelledby="requirements-heading">
      <div className="row-between">
        <h2 id="requirements-heading">What it asks for</h2>
        <p className="muted">
          {met} of {requirements.length} in your profile
        </p>
      </div>
      <ul className="checklist">
        {requirements.map(({ skill, inProfile }) => (
          <li key={skill} className={inProfile ? 'checklist__met' : 'checklist__missing'}>
            {inProfile ? <Check size={16} aria-hidden /> : <Minus size={16} aria-hidden />}
            <span>{skill}</span>
            <span className="visually-hidden">
              {inProfile ? ' (in your profile)' : ' (not in your profile)'}
            </span>
          </li>
        ))}
      </ul>
      <p className="field__hint">
        Skills the posting names, from a fixed list. It is a quick check, not the full requirements.
      </p>
    </section>
  );
}
