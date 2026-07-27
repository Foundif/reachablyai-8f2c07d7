
# Reachably WATI-parity roadmap

Three sprints, shipped in order. Each sprint lands fully working before the next starts.

---

## Sprint 1 — Auto-replies, Business Hours, Keywords (this turn)

**Goal:** every inbound WhatsApp message hits a lightweight rules engine before it just sits in the inbox.

### What you'll get
- **Business hours** per workspace (per-weekday open/close + timezone).
- **Away message** — auto-sent to inbound messages outside business hours (once per 24h per contact).
- **Welcome message** — auto-sent the first time a phone number ever messages you.
- **Keyword replies** — already partly in `automations`; upgraded to send free-form text replies (not just log a run) and match phrases + exact words + case-insensitive.
- **New Settings tab: "Auto-replies"** with toggles, message editor, business-hours grid, and a live preview of what the customer will see.

### Technical
- New table `workspace_settings` (1:1 with workspace): `business_hours jsonb`, `timezone`, `away_enabled`, `away_message`, `welcome_enabled`, `welcome_message`.
- Extend `automations.action_type` to allow `send_text` (free-form). Existing `send_template` keeps working.
- New `auto_reply_log` table to enforce "once per 24h per contact per rule".
- `whatsapp-webhook` gains an `evaluateAutoReplies()` step that runs after message insert, uses the existing `whatsapp-send` function to reply, and logs the event.

---

## Sprint 2 — No-code Flow Builder

**Goal:** WATI-style drag-drop chatbot builder.

### What you'll get
- Canvas at `/flows` using React Flow (already Lovable-friendly).
- Node types: **Message**, **Question** (waits for reply, stores answer in variable), **Condition** (if/else on variable or contact tag), **Delay**, **API Call** (HTTP request to any URL), **Handoff to human** (assigns chat to an agent/team).
- Publish/unpublish per flow. Trigger via keyword, new-contact, or manual "start flow" button from inbox.
- Live-run state stored in a new `flow_sessions` table so a conversation can resume across days.

### Technical
- Tables: `flows`, `flow_nodes` (or nodes stored inside `flows.graph jsonb`), `flow_sessions`, `flow_variables`.
- Runtime engine in an edge function `flow-runtime` called from `whatsapp-webhook` when an inbound message matches a running session or a trigger.
- Reuses `whatsapp-send` for outbound.

---

## Sprint 3 — Native CRM integrations

**Goal:** Reachably becomes the WhatsApp layer on top of the tools you already use.

### Providers (all five, day-one)
| Provider | How it connects | What it does |
|---|---|---|
| **Shopify** | `shopify--enable` (Lovable's native Shopify integration) | Abandoned-cart recovery → WhatsApp template; order-created & order-fulfilled → WhatsApp update; customer sync to Contacts. |
| **WooCommerce** | `standard_connectors` (gateway-backed) | Same event set via WooCommerce REST + webhooks. |
| **HubSpot** | `standard_connectors` (gateway-backed) | Two-way contact sync; deal-stage change → WhatsApp template; inbound WhatsApp reply → HubSpot timeline note. |
| **Zoho CRM** | `standard_connectors` (gateway-backed) | Contact sync + lead-status change → WhatsApp template. |
| **Google Sheets** | `google_sheets` App User Connector (per-user OAuth) | Two-way contact/lead sync to a chosen sheet; new row → optional WhatsApp send. |

### Technical
- New `integrations` table: `workspace_id`, `provider`, `status`, `config jsonb`, `last_sync_at`.
- One edge function per provider (`integration-shopify`, `integration-woocommerce`, `integration-hubspot`, `integration-zoho`, `integration-sheets`) handling: connect callback, initial sync, webhook receiver, outbound trigger dispatcher.
- Shared `integration-dispatch` helper that turns provider events (e.g. `abandoned_cart`) into WhatsApp sends via existing template/automation infra — so no duplicate messaging logic.
- New `Integrations` page in Settings with a card per provider (Connect / Configure / Disconnect / last-sync timestamp).

---

## Order of delivery
1. Sprint 1 starts now, single commit set, no waiting on secrets.
2. Sprint 2 kicks off after you confirm Sprint 1 works end-to-end on a real inbound message.
3. Sprint 3 goes provider-by-provider (Shopify & WooCommerce first — they only need webhook URLs; HubSpot & Zoho need connector approvals; Sheets needs the App User Connector client).

I'll start Sprint 1 as soon as you approve.
