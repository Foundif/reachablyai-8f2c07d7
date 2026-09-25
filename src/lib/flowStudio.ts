import { TN45_FLOW_PRESET } from '@/lib/flowPreset';

export type FlowJson = { version?: string; screens?: FlowScreen[] };
export type FlowScreen = {
  id: string;
  title?: string;
  terminal?: boolean;
  data?: Record<string, unknown>;
  layout?: { type?: string; children?: FlowComponent[] };
};
export type FlowComponent = {
  type?: string;
  name?: string;
  label?: string;
  text?: string;
  ['input-type']?: string;
  required?: boolean;
  children?: FlowComponent[];
  ['data-source']?: Array<{ id?: string; title?: string; description?: string }>;
  ['on-click-action']?: { name?: string; next?: { type?: string; name?: string } };
};

const completeFooter = (label = 'Submit'): FlowComponent => ({
  type: 'Footer', label,
  'on-click-action': { name: 'complete' },
});

const singleScreen = (id: string, title: string, children: FlowComponent[]): FlowJson => ({
  version: '7.3',
  screens: [{
    id, title, terminal: true, data: {},
    layout: { type: 'SingleColumnLayout', children: [{ type: 'Form', name: 'form', children: [...children, completeFooter()] }] },
  }],
});

export const FLOW_STARTERS = [
  {
    id: 'blank', name: 'Blank form', description: 'Start with one screen and add any fields.', cta: 'Open form',
    definition: singleScreen('FORM', 'New Form', [
      { type: 'TextHeading', text: 'Tell us what you need' },
      { type: 'TextInput', name: 'name', label: 'Your name', 'input-type': 'text', required: true },
    ]),
  },
  {
    id: 'lead', name: 'Lead / enquiry', description: 'Capture contact details and an enquiry.', cta: 'Enquire now',
    definition: singleScreen('ENQUIRY', 'Send an Enquiry', [
      { type: 'TextInput', name: 'name', label: 'Your name', 'input-type': 'text', required: true },
      { type: 'TextInput', name: 'phone', label: 'Phone number', 'input-type': 'phone', required: true },
      { type: 'TextInput', name: 'email', label: 'Email address', 'input-type': 'email' },
      { type: 'Dropdown', name: 'interest', label: 'What are you interested in?', required: true, 'data-source': [
        { id: 'product', title: 'Product' }, { id: 'service', title: 'Service' }, { id: 'partnership', title: 'Partnership' }, { id: 'other', title: 'Other' },
      ] },
      { type: 'TextArea', name: 'message', label: 'How can we help?', required: true },
    ]),
  },
  {
    id: 'appointment', name: 'Appointment', description: 'Collect a preferred date, time, and purpose.', cta: 'Book appointment',
    definition: singleScreen('APPOINTMENT', 'Book an Appointment', [
      { type: 'TextInput', name: 'name', label: 'Your name', 'input-type': 'text', required: true },
      { type: 'TextInput', name: 'phone', label: 'Phone number', 'input-type': 'phone', required: true },
      { type: 'DatePicker', name: 'date', label: 'Preferred date', required: true },
      { type: 'TextInput', name: 'time', label: 'Preferred time', 'input-type': 'text', required: true },
      { type: 'TextArea', name: 'notes', label: 'Reason or notes' },
    ]),
  },
  {
    id: 'service', name: 'Service request', description: 'Let customers choose a service and share details.', cta: 'Request service',
    definition: singleScreen('SERVICE_REQUEST', 'Request a Service', [
      { type: 'TextInput', name: 'name', label: 'Your name', 'input-type': 'text', required: true },
      { type: 'TextInput', name: 'phone', label: 'Phone number', 'input-type': 'phone', required: true },
      { type: 'RadioButtonsGroup', name: 'service', label: 'Choose a service', required: true, 'data-source': [
        { id: 'service_one', title: 'Service one' }, { id: 'service_two', title: 'Service two' },
      ] },
      { type: 'TextArea', name: 'address', label: 'Address' },
      { type: 'TextArea', name: 'notes', label: 'Additional details' },
    ]),
  },
  {
    id: 'feedback', name: 'Feedback', description: 'Gather ratings and customer comments.', cta: 'Give feedback',
    definition: singleScreen('FEEDBACK', 'Share Feedback', [
      { type: 'RadioButtonsGroup', name: 'rating', label: 'How was your experience?', required: true, 'data-source': [
        { id: '5', title: 'Excellent' }, { id: '4', title: 'Good' }, { id: '3', title: 'Average' }, { id: '2', title: 'Poor' }, { id: '1', title: 'Very poor' },
      ] },
      { type: 'TextArea', name: 'feedback', label: 'Tell us more' },
      { type: 'OptIn', name: 'contact_permission', label: 'You may contact me about this feedback' },
    ]),
  },
  {
    id: 'event', name: 'Event registration', description: 'Register attendees and collect preferences.', cta: 'Register now',
    definition: singleScreen('REGISTRATION', 'Event Registration', [
      { type: 'TextInput', name: 'name', label: 'Full name', 'input-type': 'text', required: true },
      { type: 'TextInput', name: 'phone', label: 'Phone number', 'input-type': 'phone', required: true },
      { type: 'TextInput', name: 'email', label: 'Email address', 'input-type': 'email', required: true },
      { type: 'Dropdown', name: 'ticket_type', label: 'Ticket type', required: true, 'data-source': [
        { id: 'general', title: 'General' }, { id: 'vip', title: 'VIP' },
      ] },
      { type: 'CheckboxGroup', name: 'interests', label: 'Sessions of interest', 'data-source': [
        { id: 'networking', title: 'Networking' }, { id: 'workshops', title: 'Workshops' }, { id: 'keynotes', title: 'Keynotes' },
      ] },
    ]),
  },
  {
    id: 'travel', name: 'TN45 travel booking', description: 'Service menu, travel details, review, and advance payment.', cta: 'Book service',
    definition: TN45_FLOW_PRESET as FlowJson,
  },
] as const;

export function stringifyFlow(definition: FlowJson) {
  return JSON.stringify(definition, null, 2);
}

export function validateFlowJson(source: string) {
  const errors: string[] = [];
  let definition: FlowJson | null = null;
  if (!source.trim()) return { ok: false, errors: ['Form code is empty'], screens: [] as FlowScreen[], definition };
  try { definition = JSON.parse(source); } catch (error) {
    return { ok: false, errors: [error instanceof Error ? error.message : 'Invalid JSON'], screens: [], definition };
  }
  const screens = Array.isArray(definition?.screens) ? definition.screens : [];
  if (!definition?.version) errors.push('A Meta Flow version is required.');
  if (!screens.length) errors.push('Add at least one screen.');
  const ids = screens.map(screen => String(screen?.id || '').trim());
  ids.forEach((id, index) => { if (!id) errors.push(`Screen ${index + 1} needs an ID.`); });
  if (new Set(ids.filter(Boolean)).size !== ids.filter(Boolean).length) errors.push('Every screen ID must be unique.');
  screens.forEach((screen, index) => {
    if (!screen?.layout || !Array.isArray(screen.layout.children)) errors.push(`${screen?.id || `Screen ${index + 1}`} needs a layout with children.`);
    let hasCompleteAction = false;
    const componentNames = new Set<string>();
    const visit = (items: FlowComponent[] = []) => items.forEach(item => {
      const target = item?.['on-click-action']?.next?.name;
      if (target && !ids.includes(target)) errors.push(`${screen.id}: link points to missing screen “${target}”.`);
      if (item.type === 'Form' && !item.name) errors.push(`${screen.id}: every Form needs a name.`);
      if (item.name && item.type !== 'Form') {
        if (componentNames.has(item.name)) errors.push(`${screen.id}: field name “${item.name}” is duplicated.`);
        componentNames.add(item.name);
      }
      if (item.type === 'TextInput' && !item['input-type']) errors.push(`${screen.id}: TextInput “${item.name || item.label || 'field'}” needs an input-type.`);
      if (['Dropdown', 'RadioButtonsGroup', 'CheckboxGroup'].includes(item.type || '') && !item['data-source']?.length) errors.push(`${screen.id}: ${item.type} “${item.name || item.label || 'field'}” needs options.`);
      if (item?.['on-click-action']?.name === 'complete') hasCompleteAction = true;
      if (item.children) visit(item.children);
    });
    visit(screen?.layout?.children);
    if (screen.terminal && !hasCompleteAction) errors.push(`${screen.id}: terminal screens need a complete button.`);
  });
  return { ok: errors.length === 0, errors, screens, definition };
}