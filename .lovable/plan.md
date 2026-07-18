
# Reachably — Turn 1 Build Plan

Scope for THIS turn only. I stop after Leads and show you the result before Campaigns/Automation/etc.

⚠️ **Risk callout on full workspace migration:** You currently have live bookings, Google Sheets sync, WhatsApp webhook, Razorpay, staff/owner_id logic — all keyed by `user_id`. Migrating every `tn_*` table to `workspace_id` in one shot will break the webhook, sheets writer, and staff RLS unless done very carefully. I'll do it in a **backwards-compatible** way: add `workspace_id` alongside `user_id`, backfill, keep `user_id` working, and update RLS to accept either. Nothing breaks; new modules use `workspace_id`; we can drop `user_id` in a later cleanup turn.

---

## 1. Rebrand → Reachably

- Generate a new **Reachably** wordmark logo (purple→pink gradient to match existing theme) via `imagegen`, save to `src/assets/reachably-logo.png`.
- Replace visible "Chatarly" / "Glamsup" text in: `index.html` (title, meta, og), sidebar header, auth page headings, footer copyright, onboarding, any page titles. Keep "© 2026 Foundif Innovations".
- Search codebase with `rg -i "chatarly|glamsup|my salon"` and replace text-only references.
- Leave asset filenames, DB tables, function names untouched.

## 2. Multi-tenant workspaces (backwards-compatible)

**Migration:**
```
workspaces (id, name, plan_tier, whatsapp_mode, owner_id, created_at, updated_at)
workspace_members (workspace_id, user_id, role ['owner'|'admin'|'agent'], created_at)
whatsapp_sessions (id, workspace_id, mode, status, phone_number,
                   meta_api_key_encrypted, meta_phone_number_id,
                   meta_business_account_id, qr_code_url, last_connected_at,
                   updated_at)
```
- Trigger on `auth.users` insert: auto-create a personal workspace + owner membership.
- Backfill: one workspace per existing user; owner = user; members row = user/owner.
- Helper SECURITY DEFINER fn `current_workspace_id()` returns caller's active workspace (from a `profiles.active_workspace_id` column, default = personal workspace).
- Add nullable `workspace_id` to `tn_bookings`, `tn_customers`, `tn_messages`, `tn_settings`, `tn_payments`, `tn_services`, `tn_campaigns`, `tn_meta_flows`, `tn_meta_templates`, `tn_flows`, `tn_ai_agents`, `tn_expenses`. Backfill from `user_id`.
- Add workspace-aware RLS policy alongside existing ones (OR condition), so both old code paths and new module code work.

**Auth flow:** No workspace picker yet (each user has one personal workspace auto-created). UI + picker come in a later turn when you add real team invites at workspace level.

## 3. Dashboard 2×2 module grid

- Replace whatever's on `/dashboard` (or the current home route) with a 2×2 grid of tap-to-open cards matching the existing card style: **Leads, Inbox, Campaigns, Automation**.
- Each card shows one live stat: Leads count (new this week), Inbox unread, Campaigns sent this month, Automation active count. Skeleton loaders while fetching.
- Below the grid, keep whatever KPIs/quick actions already live there — I won't rip them out.
- Cards not yet implemented (Campaigns, Automation) route to a `/coming-soon` placeholder that matches app styling, not a broken page.

## 4. Leads module

**Table:**
```
leads (id, workspace_id, name, phone, email, source ['manual'|'csv'|'meta_ads'|'scraped'|'booking'],
       status ['new'|'contacted'|'converted'|'lost'], tags text[], assigned_to uuid,
       notes text, created_at, updated_at)
```
Full RLS: members of the workspace can CRUD. `service_role` full.

**Pages/components (all under existing app shell, same header/sidebar):**
- `/leads` — list; toggle Card view / Table view; filter by status + source; search by name/phone; row/card actions:
  - **Open WhatsApp chat** — deep-links to existing Inbox thread by phone (creates thread if none).
  - **Change status** — dropdown.
  - **Add tag** — inline tag input.
  - Source badge (colored chip per source).
- **+ Add Lead** modal — manual form (name, phone required; email/tags optional).
- **Import CSV** — client-side parse (papaparse), preview 5 rows, map columns, insert in batch of 100. Source auto = `csv`.
- `/leads/:id` — detail drawer/sheet with edit form, tag chips, assign-to dropdown (workspace members), activity feed placeholder.

**Bookings → Leads bridge:** trigger on `tn_bookings` insert also inserts a `leads` row with `source='booking'` (dedupe by phone within workspace). Keeps CRM booking pipeline unaffected.

**Nav:** Add "Leads" to sidebar (both mobile drawer and desktop) using the existing `AppSidebar` module list — no restructuring. Reuse the module registry in `src/lib/modules.ts`.

## 5. What I am NOT doing this turn

- Inbox extensions (assign/notes/labels/quick-replies/mode badge) — next turn.
- Campaigns, Automation, Team Inbox, Payments (Razorpay-linked leads), Ads, Settings redesign, AI Assistant FAB — future turns.
- Baileys/unofficial WhatsApp UI — future turn once you have the external Node host ready. The `whatsapp_sessions` table + `mode` field ships now so the toggle can land later without another migration.

---

### Order of operations

1. Run schema migration (workspaces, members, whatsapp_sessions, leads, add workspace_id to tn_* tables, backfill, triggers, RLS). **You approve migration first.**
2. Generate Reachably logo.
3. Text rebrand pass.
4. Dashboard 2×2 grid.
5. Leads pages + CSV import + booking→lead trigger.
6. Stop, show you the result.

Approve and I'll start with the migration.
