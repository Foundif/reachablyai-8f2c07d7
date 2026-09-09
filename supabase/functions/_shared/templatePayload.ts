type TemplateRecord = {
  name: string;
  language?: string | null;
  body?: string | null;
  header?: string | null;
  header_type?: string | null;
  header_media_url?: string | null;
  header_media_id?: string | null;
  parameter_format?: string | null;
  variables?: unknown;
  carousel_cards?: any;
};

type RecipientValues = {
  name?: string | null;
  phone?: string | null;
  variables?: Record<string, unknown> | null;
};

const PLACEHOLDER = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

const cleanValue = (value: unknown, fallback: string): string => {
  const text = value === null || value === undefined ? '' : String(value).trim();
  if (!text || /\{\{[^}]+\}\}/.test(text)) return fallback;
  return text;
};

const placeholders = (text: string): string[] => {
  const names: string[] = [];
  for (const match of text.matchAll(PLACEHOLDER)) {
    if (!names.includes(match[1])) names.push(match[1]);
  }
  return names;
};

const resolveValue = (key: string, index: number, recipient: RecipientValues): string => {
  const supplied = recipient.variables && typeof recipient.variables === 'object' ? recipient.variables : {};
  const direct = supplied[key] ?? supplied[String(index + 1)] ?? supplied[`var${index + 1}`];
  const contactName = cleanValue(recipient.name, 'Customer');
  if (direct !== undefined && direct !== null && String(direct).trim()) return cleanValue(direct, contactName);

  const normalized = key.toLowerCase();
  if (['name', 'customer_name', 'contact_name', 'first_name', 'firstname', '1', 'var1'].includes(normalized)) {
    return normalized.includes('first') ? contactName.split(/\s+/)[0] : contactName;
  }
  if (['phone', 'number', 'mobile'].includes(normalized)) return cleanValue(recipient.phone, 'Customer');
  return contactName;
};

/** Builds the exact runtime template object accepted by WhatsApp Cloud API. */
export function buildTemplatePayload(template: TemplateRecord, recipient: RecipientValues) {
  const bodyVariables = Array.isArray(template.variables)
    ? template.variables.map(String)
    : placeholders(String(template.body || ''));
  const inferredNamed = bodyVariables.some((value) => !/^\d+$/.test(value) && !/^var\d+$/.test(value));
  const parameterFormat = String(template.parameter_format || (inferredNamed ? 'NAMED' : 'POSITIONAL')).toUpperCase();
  const named = parameterFormat === 'NAMED';
  const components: Array<Record<string, unknown>> = [];

  const headerType = String(template.header_type || 'none').toLowerCase();
  const headerUrl = cleanValue(template.header_media_url, '');
  switch (headerType) {
    case 'image':
    case 'video':
      if (!template.header_media_id && !headerUrl) throw new Error(`Approved ${headerType} template is missing its header media. Upload the header again and retry.`);
      components.push({ type: 'header', parameters: [{ type: headerType, [headerType]: template.header_media_id ? { id: template.header_media_id } : { link: headerUrl } }] });
      break;
    case 'document':
      if (!template.header_media_id && !headerUrl) throw new Error('Approved document template is missing its header media. Upload the header again and retry.');
      components.push({ type: 'header', parameters: [{ type: 'document', document: template.header_media_id ? { id: template.header_media_id, filename: 'Document' } : { link: headerUrl, filename: 'Document' } }] });
      break;
    case 'text': {
      // Static text headers are already part of the approved template. Only a
      // variable text header must be supplied at send time.
      const headerVariables = placeholders(String(template.header || ''));
      if (headerVariables.length) {
        const key = headerVariables[0];
        const parameter: Record<string, string> = { type: 'text', text: resolveValue(key, 0, recipient) };
        if (named) parameter.parameter_name = key;
        components.push({ type: 'header', parameters: [parameter] });
      }
      break;
    }
  }

  if (bodyVariables.length) {
    const parameters = bodyVariables.map((key, index) => {
      const parameter: Record<string, string> = { type: 'text', text: resolveValue(key, index, recipient) };
      if (named) parameter.parameter_name = key;
      return parameter;
    });
    components.push({ type: 'body', parameters });
  }

  // Carousel templates must be sent as ONE message with a `carousel` component —
  // never as a series of individual image messages. Meta requires every card to
  // carry a non-empty `components` array (`template.components.cards.components`).
  const cards = Array.isArray(template.carousel_cards) ? template.carousel_cards : [];
  if (cards.length) {
    const problems = validateCarouselTemplate(template);
    if (problems.length) throw new Error(problems.join(' '));
    components.push({
      type: 'carousel',
      cards: cards.slice(0, 10).map((card: any, cardIndex: number) => {
        const cardComponents: Array<Record<string, unknown>> = [];
        const kind = String(card.header_type || 'image').toLowerCase() === 'video' ? 'video' : 'image';
        const mediaId = card.header_media_id;
        const mediaLink = cleanValue(card.header_media_url, '');
        cardComponents.push({
          type: 'header',
          parameters: [{ type: kind, [kind]: mediaId ? { id: mediaId } : { link: mediaLink } }],
        });
        const cardVars = placeholders(String(card.body || ''));
        if (cardVars.length) {
          cardComponents.push({
            type: 'body',
            parameters: cardVars.map((key, index) => {
              const parameter: Record<string, string> = { type: 'text', text: resolveValue(key, index, recipient) };
              if (named) parameter.parameter_name = key;
              return parameter;
            }),
          });
        }
        // Dynamic URL buttons need their suffix supplied at send time; static
        // quick replies / full URLs are already part of the approved card.
        (Array.isArray(card.buttons) ? card.buttons : []).forEach((btn: any, btnIndex: number) => {
          const url = String(btn?.url || '');
          const match = url.match(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/);
          if (String(btn?.type || '').toUpperCase() === 'URL' && match) {
            cardComponents.push({
              type: 'button',
              sub_type: 'url',
              index: String(btnIndex),
              parameters: [{ type: 'text', text: resolveValue(match[1], btnIndex, recipient) }],
            });
          }
        });
        return { card_index: cardIndex, components: cardComponents };
      }),
    });
  }


  return {
    name: template.name,
    language: { code: template.language || 'en' },
    ...(named ? { parameter_format: 'NAMED' } : {}),
    ...(components.length ? { components } : {}),
  };
}
/**
 * Pre-send guard for carousel templates. Returns a list of human-readable
 * problems naming the exact card and field, so a malformed template is blocked
 * before Meta answers with `template.components.cards.components is required.`
 */
export function validateCarouselTemplate(template: TemplateRecord): string[] {
  const cards = Array.isArray(template.carousel_cards) ? template.carousel_cards : [];
  if (!cards.length) return [];
  const problems: string[] = [];
  if (cards.length < 2) problems.push('A carousel needs at least 2 cards.');
  cards.slice(0, 10).forEach((card: any, i: number) => {
    const n = i + 1;
    const hasMedia = Boolean(card?.header_media_id) || Boolean(cleanValue(card?.header_media_url, ''));
    if (!hasMedia) problems.push(`Card ${n} is missing its image or video — re-upload it in the template editor.`);
    if (!String(card?.body || '').trim()) problems.push(`Card ${n} is missing its description text.`);
    const buttons = Array.isArray(card?.buttons) ? card.buttons : [];
    if (!buttons.length || buttons.length > 2) problems.push(`Card ${n} must have 1 or 2 buttons.`);
    buttons.forEach((b: any, bi: number) => {
      if (!String(b?.text || '').trim()) problems.push(`Card ${n} button ${bi + 1} is missing its text.`);
      if (String(b?.type || '').toUpperCase() === 'URL' && !String(b?.url || '').trim()) {
        problems.push(`Card ${n} button ${bi + 1} is a link button but has no URL.`);
      }
    });
  });
  return problems;
}
