import {
  Inbox, Send, GitBranch,
  Sparkles, BarChart3, Bot,
  Users, CalendarDays, CreditCard,
  UserCog, Shield, FileText, BookOpen, Settings,
  LayoutDashboard, Library, Briefcase,
} from 'lucide-react';

export type ModuleItem = {
  to: string;
  icon: any;
  label: string;
  status: 'live' | 'soon';
  description?: string;
};

export type ModuleGroup = { label: string; items: ModuleItem[] };

// Travel-services focused navigation. Integrations / Billing / Plans / Catalog / Orders
// are intentionally NOT in the sidebar — they live inside the Profile page now.
export const MODULE_GROUPS: ModuleGroup[] = [
  {
    label: 'Overview',
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Dashboard', status: 'live' },
      { to: '/inbox', icon: Inbox, label: 'Inbox', status: 'live' },
    ],
  },
  {
    label: 'Services',
    items: [
      { to: '/services', icon: Briefcase, label: 'Services & Tariff', status: 'live' },
      { to: '/bookings', icon: CalendarDays, label: 'Bookings', status: 'live' },
      { to: '/customers', icon: Users, label: 'Customers', status: 'live' },
      { to: '/payments', icon: CreditCard, label: 'Payments', status: 'live' },
    ],
  },
  {
    label: 'Engage',
    items: [
      { to: '/campaigns', icon: Send, label: 'Campaigns', status: 'live' },
      { to: '/analytics', icon: BarChart3, label: 'Analytics', status: 'live' },
    ],
  },
  {
    label: 'Automation',
    items: [
      { to: '/flows', icon: GitBranch, label: 'Flow Builder', status: 'live' },
      { to: '/flows/templates', icon: Library, label: 'Templates', status: 'live' },
      { to: '/ai-studio', icon: Sparkles, label: 'AI Agent Studio', status: 'live' },
      { to: '/copilot', icon: Bot, label: 'AI Copilot', status: 'live' },
      { to: '/knowledge', icon: BookOpen, label: 'Knowledge Base', status: 'live' },
    ],
  },
  {
    label: 'Settings',
    items: [
      { to: '/whatsapp-settings', icon: Settings, label: 'WhatsApp', status: 'live' },
      { to: '/team', icon: UserCog, label: 'Team', status: 'live' },
      { to: '/roles', icon: Shield, label: 'Roles', status: 'live' },
      { to: '/audit', icon: FileText, label: 'Audit Logs', status: 'live' },
    ],
  },
];

export const MODULE_INDEX: Record<string, ModuleItem> = Object.fromEntries(
  MODULE_GROUPS.flatMap(g => g.items).map(i => [i.to, i])
);
