import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';

const TABS = [
  { to: '/auto-replies', label: 'Auto-replies & AI' },
  { to: '/automation', label: 'Keyword workflows' },
  { to: '/chatbots', label: 'Web chatbots' },
];

/** One switcher shared by the three automation screens so the menu has a single entry. */
export default function AutomationTabs() {
  return (
    <div className="flex gap-1 overflow-x-auto rounded-lg bg-muted p-1 w-fit max-w-full">
      {TABS.map(t => (
        <NavLink
          key={t.to}
          to={t.to}
          className={({ isActive }) =>
            cn(
              'whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              isActive ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )
          }
        >
          {t.label}
        </NavLink>
      ))}
    </div>
  );
}
