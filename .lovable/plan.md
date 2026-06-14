# Wave 3 — Campaigns, Permissions, Analytics, Prompt History

Four tightly-related features land together because they share schema and access rules.

## 1. Campaign Flow Builder (`/flows` becomes live)

Visual canvas for designing multi-step WhatsApp journeys.

- **Page**: `src/pages/FlowBuilder.tsx` (list) + `src/pages/FlowEditor.tsx` (canvas).
- **Canvas**: React Flow (`@xyflow/react`) on a glass surface. Node palette on the left, inspector on the right.
- **Node types**:
  - **Trigger** — `keyword`, `new_contact`, `tag_added`, `manual_broadcast`, `schedule`
  - **Message** — text / template / media
  - **Wait** — duration (mins/hours/days)
  - **Branch** — if/else on reply text, tag, customer field, AI intent
  - **Action** — add/remove tag, assign agent, call AI agent, webhook
  - **End**
- **Audience rules**: include/exclude by tag, last-seen window, segment query (stored as JSON).
- **Save**: persists `nodes` + `edges` JSON to `tn_flows`.

## 2. Campaigns / Broadcasts (`/campaigns` becomes live)

- **Page**: `src/pages/Campaigns.tsx`. Create campaign → pick flow + audience + schedule → publish.
- **Run engine**: edge function `campaign-dispatch` enqueues per-recipient sessions in `tn_flow_sessions` and sends step 1 via `whatsapp-send`. A second function `flow-step-advance` is invoked by the `whatsapp-webhook` on reply / by cron on `wait` expiry.
- **States**: draft / scheduled / running / paused / completed.

## 3. Role-Based Permissions (Agent Studio + Campaigns)

Uses the existing role model (`owner`, `admin`, `manager`, `staff`, …). No new tables — just a permission map.

- New helper `src/lib/permissions.ts` exporting `can(role, action)` for:
  - `agent.view`, `agent.edit_prompt`, `agent.edit_tools`, `agent.edit_model`, `agent.delete`
  - `campaign.view`, `campaign.edit`, `campaign.publish`, `campaign.delete`
  - `flow.view`, `flow.edit`, `flow.publish`
- Defaults: owner/admin = all; manager = edit but not publish/delete; staff = view only.
- Wired into AIStudio (lock prompt/tools/model fields, hide Delete), FlowEditor (read-only mode), Campaigns (hide Publish).
- Server-side enforcement: edge functions for publish/delete re-check role via `profiles.role`.

## 4. Campaign Analytics Dashboard

- **Page**: `src/pages/CampaignAnalytics.tsx` (also linked from each campaign row).
- **KPIs**: sent, delivered, read, replied, conversions, opt-outs.
- **Funnel by step**: drop-off chart (Recharts) from `tn_flow_sessions.current_step` aggregates.
- **Time-series**: replies/conversions over 24h/7d/30d.
- **Per-node breakdown table** with reply rate + avg response time.
- Data source: `tn_messages` (delivery status) + new `tn_flow_events` table.

## 5. AI Agent Prompt Versioning + Audit Trail

- New table `tn_agent_versions` snapshots `system_prompt`, `tools`, `model`, `temperature`, `changed_by`, `change_note` on every save.
- Trigger on `tn_ai_agents` UPDATE inserts a version row.
- New `tn_audit_log` table for cross-module events (`agent.updated`, `campaign.published`, `flow.edited`, …).
- AI Studio gets a **History** tab: timeline with diff (prompt before/after), restore button.

---

## Technical details

**New deps**: `@xyflow/react` (canvas), `diff` (prompt diff view).

**Migrations** (single migration, includes GRANTs + RLS):
```text
tn_flows(id, user_id, name, description, nodes jsonb, edges jsonb,
         audience_rules jsonb, status, created_at, updated_at)
tn_campaigns(id, user_id, flow_id, name, audience_snapshot jsonb,
             schedule_at, status, stats jsonb, created_at, updated_at)
tn_flow_events(id, user_id, campaign_id, session_id, node_id,
               event_type, customer_id, payload jsonb, created_at)
  -- event_type: entered | sent | delivered | read | replied | converted | dropped
tn_agent_versions(id, agent_id, user_id, system_prompt, tools jsonb,
                  model, temperature, change_note, created_by, created_at)
tn_audit_log(id, user_id, actor_id, entity_type, entity_id, action,
             before jsonb, after jsonb, created_at)
```
All RLS-scoped to `user_id = auth.uid()`; service_role full access; indexes on `(campaign_id, node_id)` and `(agent_id, created_at desc)`.

**Edge functions**: `campaign-dispatch`, `flow-step-advance`. Existing `whatsapp-webhook` extended to emit `flow_events` on reply.

**Sidebar**: `/flows` and `/campaigns` flip to `status: 'live'` in `src/lib/modules.ts`.

**Out of scope (later waves)**: A/B testing inside flows, advanced segment builder UI, multi-language template variants, agency white-label.

This is large — I'll ship it in one turn but expect ~15 new files. Confirm and I'll build.