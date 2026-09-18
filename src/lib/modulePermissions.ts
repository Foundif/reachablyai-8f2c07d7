// Granular per-module permissions stored on workspace_members.permissions (jsonb).
// Shape: { "records": { "view": true, "create": true, ... }, ... }

export const PERM_MODULES = [
  { id: 'inbox', label: 'Inbox' },
  { id: 'contacts', label: 'Contacts' },
  { id: 'leads', label: 'Leads' },
  { id: 'records', label: 'Records & Bookings' },
  { id: 'payments', label: 'Payments' },
  { id: 'campaigns', label: 'Campaigns' },
  { id: 'automations', label: 'Automations' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'team', label: 'Team' },
  { id: 'settings', label: 'Settings' },
] as const;

export const PERM_ACTIONS = ['view', 'create', 'edit', 'delete', 'export', 'manage'] as const;

export type PermModule = typeof PERM_MODULES[number]['id'];
export type PermAction = typeof PERM_ACTIONS[number];
export type PermissionMap = Partial<Record<PermModule, Partial<Record<PermAction, boolean>>>>;

/** Sensible staff defaults: front-desk work, no deletions, no settings/team. */
export const STAFF_DEFAULT_PERMISSIONS: PermissionMap = {
  inbox: { view: true, create: true, edit: true },
  contacts: { view: true, create: true, edit: true },
  leads: { view: true, create: true, edit: true },
  records: { view: true, create: true, edit: true },
  payments: { view: true },
  campaigns: { view: true },
  automations: { view: true },
  analytics: { view: true },
};

export const ADMIN_ALL_PERMISSIONS: PermissionMap = PERM_MODULES.reduce((acc, m) => {
  acc[m.id] = PERM_ACTIONS.reduce((a, act) => ({ ...a, [act]: true }), {});
  return acc;
}, {} as PermissionMap);

export const hasPermission = (
  perms: PermissionMap | null | undefined,
  module: PermModule,
  action: PermAction,
) => !!perms?.[module]?.[action];

export const togglePermission = (
  perms: PermissionMap,
  module: PermModule,
  action: PermAction,
): PermissionMap => ({
  ...perms,
  [module]: { ...(perms[module] || {}), [action]: !perms[module]?.[action] },
});
