import {
  BriefcaseBusiness,
  FileText,
  Globe,
  KanbanSquare,
  ListChecks,
  Sunrise,
  UserRound,
} from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { useSession, useSignOut } from '../api/queries';

const NAV_ITEMS = [
  { to: '/today', label: 'Today', icon: Sunrise },
  { to: '/review', label: 'Review', icon: ListChecks },
  { to: '/jobs', label: 'Jobs', icon: BriefcaseBusiness },
  { to: '/boards', label: 'Boards', icon: Globe },
  { to: '/tracker', label: 'Tracker', icon: KanbanSquare },
  { to: '/profile', label: 'Profile', icon: UserRound },
  { to: '/markdown', label: 'Page to Markdown', icon: FileText },
] as const;

export function AppShell() {
  const session = useSession();
  const signOut = useSignOut();

  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className="shell__sidebar">
        <NavLink to="/today" className="shell__brand">
          <img src="/favicon.svg" alt="" width={32} height={32} />
          <span>KaziScout</span>
        </NavLink>
        <nav aria-label="Main">
          <ul className="shell__nav">
            {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <NavLink to={to} className="shell__link">
                  <Icon size={18} aria-hidden />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="shell__foot">
          <p>You review every application and press Submit yourself.</p>
          {session.data?.required && (
            <button type="button" className="shell__signout" onClick={() => signOut.mutate()}>
              Sign out
            </button>
          )}
        </div>
      </aside>
      <main id="main" className="shell__main" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  );
}
