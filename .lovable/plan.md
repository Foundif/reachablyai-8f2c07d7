# Plan: Meta Flow Editor + Google Sheets Viewer

## 1. Meta Flow Editor (new tab)

New page **`/flow-editor`** — sidebar entry "Flow Editor" under Business section.

**What it does:**
- Pulls the current Flow JSON live from Meta Graph API (`GET /{flow_id}/assets` for the latest published version).
- Shows it in a Monaco-style code editor (use existing `<Textarea>` with monospace + JSON validation; keep dependency footprint small).
- **Save Draft** → `POST /{flow_id}/assets` with the JSON (uploads as `flow.json` asset, creates draft on Meta side).
- **Publish** → `POST /{flow_id}/publish` (pushes draft live on Meta).
- **Validate** → client-side JSON parse + Meta's `GET /{flow_id}?fields=validation_errors`.
- Shows current Meta status badge (DRAFT / PUBLISHED), last sync time, validation errors panel.
- Pre-loaded with the user's pasted v7.3 JSON if the remote one is missing.

**Backend:** new edge function `meta-flow-manage` with actions `fetch | save | publish | validate`, using `META_ACCESS_TOKEN` + `meta_flow_id` from `tn_settings`.

## 2. Google Sheets viewer inside Chatarly

New page **`/sheets`** — sidebar entry "Bookings Sheet" under Business.

- Reads `tn_settings.google_sheet_id` (already exists in settings) + new optional `google_sheet_tab` field.
- Settings page gets a "Google Sheets" card to paste/edit Sheet ID + Tab name + a **Test Connection** button.
- New edge function `sheets-read` (uses existing Google Sheets connector) returns rows from `{sheet_id}!{tab}!A1:Z`.
- Page renders rows as a sortable table with search + CSV export + "Open in Google Sheets" link.
- Auto-refresh every 60s; manual refresh button.

## 3. Cleanup — remove unconnected pages

Remove from sidebar + routes (files stay but unrouted, or delete):
- Flow Builder (`/flows`) — replaced by Flow Editor.
- Flow Templates, AI Studio, Knowledge Base, Campaigns, Campaign Analytics — already hidden, remove route registrations.
- Network, Webhooks, API Console, Integrations, White Label — not used in travel CRM.
- Old `TNFlow` setup page — its useful "Copy JSON / Send Test" actions move into the new Flow Editor as a side panel.

Sidebar after cleanup (Business section): Bookings · Customers · Services · Messages · **Flow Editor** · **Bookings Sheet** · WhatsApp Settings · Razorpay · Accounting.

## 4. Schema

Migration: add `google_sheet_tab text default 'Bookings'` to `tn_settings`. No other changes.

## Technical notes

- Meta Flow asset upload uses multipart form with `name=flow.json`, `asset_type=FLOW_JSON`, `file=<JSON>` per Graph API v21.
- Publish requires the flow be in DRAFT and validation_errors empty — surface those errors in UI before allowing Publish.
- Sheets read uses the existing Google Sheets connector gateway (already configured: `GOOGLE_SHEETS_API_KEY` present).
- All edge functions verify the caller's JWT, then load that user's `tn_settings` row server-side — no Meta tokens or sheet IDs sent from client.

## Out of scope

- Visual drag-drop flow designer (text/JSON editor only).
- Writing to Google Sheets from the viewer (read-only; the webhook already writes bookings).
