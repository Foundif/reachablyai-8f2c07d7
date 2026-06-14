// Role-based permission map for Wave 3 modules + per-user overrides.
export type Action =
  | 'agent.view' | 'agent.create' | 'agent.edit_prompt' | 'agent.edit_tools' | 'agent.edit_model' | 'agent.delete' | 'agent.restore_version'
  | 'campaign.view' | 'campaign.create' | 'campaign.edit' | 'campaign.publish' | 'campaign.pause' | 'campaign.delete'
  | 'flow.view' | 'flow.create' | 'flow.edit' | 'flow.publish' | 'flow.delete'
  | 'template.view' | 'template.create' | 'template.share';

export const ALL_ACTIONS: Action[] = [
  'agent.view','agent.create','agent.edit_prompt','agent.edit_tools','agent.edit_model','agent.delete','agent.restore_version',
  'campaign.view','campaign.create','campaign.edit','campaign.publish','campaign.pause','campaign.delete',
  'flow.view','flow.create','flow.edit','flow.publish','flow.delete',
  'template.view','template.create','template.share',
];

const MAP: Record<string, Action[]> = {
  owner: ALL_ACTIONS,
  admin: ALL_ACTIONS,
  freelancer: ALL_ACTIONS,
  manager: [
    'agent.view','agent.create','agent.edit_prompt','agent.edit_tools',
    'campaign.view','campaign.create','campaign.edit','campaign.pause',
    'flow.view','flow.create','flow.edit',
    'template.view','template.create',
  ],
  receptionist: ['agent.view','campaign.view','flow.view','template.view'],
  staff: ['agent.view','campaign.view','flow.view','template.view'],
};

// Runtime override store, hydrated by usePermissionOverrides hook.
let OVERRIDES: Record<string, boolean> = {};
export function setPermissionOverrides(map: Record<string, boolean>) {
  OVERRIDES = map || {};
}
export function getPermissionOverrides() { return { ...OVERRIDES }; }

export function can(role: string | null | undefined, action: Action): boolean {
  if (action in OVERRIDES) return OVERRIDES[action];
  const r = role || 'freelancer';
  return (MAP[r] || MAP.freelancer).includes(action);
}

export function defaultsFor(role: string | null | undefined): Action[] {
  const r = role || 'freelancer';
  return MAP[r] || MAP.freelancer;
}

export function roleLabel(role: string | null | undefined) {
  const r = (role || 'freelancer');
  return r.charAt(0).toUpperCase() + r.slice(1);
}

export const ACTION_GROUPS: { label: string; actions: Action[] }[] = [
  { label: 'AI Agent Studio', actions: ['agent.view','agent.create','agent.edit_prompt','agent.edit_tools','agent.edit_model','agent.delete','agent.restore_version'] },
  { label: 'Campaigns', actions: ['campaign.view','campaign.create','campaign.edit','campaign.publish','campaign.pause','campaign.delete'] },
  { label: 'Flow Builder', actions: ['flow.view','flow.create','flow.edit','flow.publish','flow.delete'] },
  { label: 'Templates', actions: ['template.view','template.create','template.share'] },
];
