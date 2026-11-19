import {
  Inbox, Contact, MessageSquareText, Instagram,
  UserCog, Settings, UserCircle,
  LayoutDashboard, BarChart3, Wallet, Megaphone, Workflow, Bot, Plug, ClipboardList, FormInput, KeyRound,
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
      { to: '/', icon: LayoutDashboard, label: 'Home', status: 'live' },
      { to: '/inbox', icon: Inbox, label: 'Team Inbox', status: 'live' },
      { to: '/leads', icon: Contact, label: 'Contacts', status: 'live' },
      { to: '/bookings', icon: ClipboardList, label: 'Bookings', status: 'live' },
      { to: '/services', icon: Wallet, label: 'Services & Tariff', status: 'live' },
    ],
  },
  {
    label: 'Growth',
    items: [
      { to: '/templates', icon: MessageSquareText, label: 'Templates', status: 'live' },
      { to: '/flows', icon: FormInput, label: 'WhatsApp Forms', status: 'live' },
      { to: '/campaigns', icon: Megaphone, label: 'Campaigns', status: 'live' },
      { to: '/auto-replies', icon: Bot, label: 'Automations & AI', status: 'live' },
    ],
  },
  {
    label: 'Insights',
    items: [
      { to: '/analytics', icon: BarChart3, label: 'Analytics', status: 'live' },
      { to: '/accounting', icon: Wallet, label: 'Accounting', status: 'live' },
      { to: '/meta-clients', icon: Workflow, label: 'Meta Ad Reports', status: 'live' },
    ],
  },

  {
    label: 'Settings',
    items: [
      { to: '/whatsapp-settings', icon: Settings, label: 'WhatsApp API', status: 'live' },
      { to: '/instagram', icon: Instagram, label: 'Instagram', status: 'live' },
      { to: '/integrations', icon: Plug, label: 'Integrations', status: 'live' },
      { to: '/settings/api', icon: KeyRound, label: 'API & Keys', status: 'live' },
      { to: '/team', icon: UserCog, label: 'Team', status: 'live' },
      { to: '/profile', icon: UserCircle, label: 'Profile', status: 'live' },
      { to: '/guide', icon: ClipboardList, label: 'Guide', status: 'live' },
    ],
  },
];

export const MODULE_INDEX: Record<string, ModuleItem> = Object.fromEntries(
  MODULE_GROUPS.flatMap(g => g.items).map(i => [i.to, i])
);

/* ---------- Turbodev-style navigation ---------- */
import {
  Home as HomeIcon, Radio, Tags, ListChecks, Zap, LayoutGrid, Users as UsersIcon, CreditCard,
  FileText, BarChart2, BookOpen, Briefcase,
} from 'lucide-react';

/** Compact primary rail. Everything else lives inside the Settings hub. */
export const MAIN_NAV: ModuleItem[] = [
  { to: '/', icon: HomeIcon, label: 'Home', status: 'live' },
  { to: '/inbox', icon: Inbox, label: 'Inbox', status: 'live' },
  { to: '/leads', icon: Contact, label: 'Contacts', status: 'live' },
  { to: '/bookings', icon: ClipboardList, label: 'Bookings', status: 'live' },
  { to: '/auto-replies', icon: Bot, label: 'Bots & AI', status: 'live' },
  { to: '/campaigns', icon: Megaphone, label: 'Broadcast', status: 'live' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics', status: 'live' },
  { to: '/integrations', icon: Plug, label: 'Integration', status: 'live' },
];

export type SettingsSection = { label: string; items: (ModuleItem & { access?: string })[] };

/** Settings hub sub-navigation. `access` = route used for permission check. */
export const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    label: 'Workspace',
    items: [
      { to: '/profile', icon: UserCircle, label: 'Account Details', status: 'live' },
      { to: '/settings/channels', icon: LayoutGrid, label: 'Channels', status: 'live', access: '/whatsapp-settings' },
      { to: '/team', icon: UsersIcon, label: 'Users, Teams & Roles', status: 'live' },
      { to: '/pricing', icon: CreditCard, label: 'Subscription', status: 'live', access: '/profile' },
    ],
  },
  {
    label: 'Inbox Settings',
    items: [
      { to: '/settings/contact-fields', icon: ListChecks, label: 'Contact Fields', status: 'live', access: '/leads' },
      { to: '/settings/tags', icon: Tags, label: 'Tags', status: 'live', access: '/leads' },
      { to: '/settings/canned-responses', icon: Zap, label: 'Canned Response', status: 'live', access: '/inbox' },
    ],
  },
  {
    label: 'WhatsApp',
    items: [
      { to: '/templates', icon: FileText, label: 'Templates', status: 'live' },
      { to: '/settings/ctwa', icon: BarChart2, label: 'CTWA', status: 'live', access: '/analytics' },
      { to: '/flows', icon: FormInput, label: 'Forms', status: 'live' },
      { to: '/services', icon: Wallet, label: 'Services & Tariff', status: 'live' },
      { to: '/accounting', icon: Briefcase, label: 'Payments', status: 'live' },
      { to: '/meta-clients', icon: Radio, label: 'Meta Ad Reports', status: 'live' },
    ],
  },
  {
    label: 'Developer',
    items: [
      { to: '/settings/api', icon: KeyRound, label: 'API Keys', status: 'live' },
      { to: '/guide', icon: BookOpen, label: 'Guide', status: 'live', access: '/profile' },
    ],
  },
];

export const SETTINGS_PATHS = [
  ...SETTINGS_SECTIONS.flatMap((s) => s.items.map((i) => i.to)),
  '/settings', '/whatsapp-settings', '/instagram', '/templates/', '/integrations/webhooks',
];

export const isSettingsPath = (p: string) =>
  p !== '/pricing' && SETTINGS_PATHS.some((s) => s !== '/pricing' && (p === s || p.startsWith(s.endsWith('/') ? s : s + '/')))
  && !p.startsWith('/integrations');
