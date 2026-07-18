import {
  Inbox, Contact, MessageSquareText,
  UserCog, Settings, UserCircle,
  LayoutDashboard, BarChart3, Wallet, Megaphone, Workflow,
} from 'lucide-react';

export type ModuleItem = {
  to: string;
  icon: any;
  label: string;
  status: 'live' | 'soon';
  description?: string;
};

export type ModuleGroup = { label: string; items: ModuleItem[] };

export const MODULE_GROUPS: ModuleGroup[] = [
  {
    label: 'Overview',
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Dashboard', status: 'live' },
      { to: '/inbox', icon: Inbox, label: 'Inbox', status: 'soon' },
      { to: '/leads', icon: Contact, label: 'Leads', status: 'live' },
    ],
  },
  {
    label: 'Growth',
    items: [
      { to: '/templates', icon: MessageSquareText, label: 'Templates', status: 'live' },
      { to: '/campaigns', icon: Megaphone, label: 'Campaigns', status: 'live' },
      { to: '/automation', icon: Workflow, label: 'Automation', status: 'live' },
    ],
  },
  {
    label: 'Insights',
    items: [
      { to: '/analytics', icon: BarChart3, label: 'Analytics', status: 'soon' },
      { to: '/accounting', icon: Wallet, label: 'Accounting', status: 'soon' },
    ],
  },
  {
    label: 'Settings',
    items: [
      { to: '/whatsapp-settings', icon: Settings, label: 'WhatsApp API', status: 'live' },
      { to: '/team', icon: UserCog, label: 'Team', status: 'live' },
      { to: '/profile', icon: UserCircle, label: 'Profile', status: 'live' },
    ],
  },
];

export const MODULE_INDEX: Record<string, ModuleItem> = Object.fromEntries(
  MODULE_GROUPS.flatMap(g => g.items).map(i => [i.to, i])
);
