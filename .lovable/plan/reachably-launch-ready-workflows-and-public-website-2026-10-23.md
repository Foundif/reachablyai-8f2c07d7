# Reachably launch-ready workflows and public website

## What will change
Keep the existing CRM and navigation intact. Extend the current Meta integration rather than creating a second CRM or replacing working connections. Nothing will be published or intentionally activated for live scheduled sending in this work.

### 1. Finish the current-product audit
- Inventory all registered routes and identify real, incomplete and setup-dependent functionality.
- Check hosted schema and configuration before adding anything. The current roadmap contains older “database paused” blockers which need rechecking.
- Record the audit and update the roadmap with verified status, not inferred success.

### 2. Client management and Meta setup
- Add workspace-owned reporting clients: create, edit, archive, details, validated international WhatsApp destinations, account/Page/form selections and report preferences.
- Reuse existing Contacts, Companies, integrations, templates and WhatsApp numbers; reporting clients represent managed businesses, not duplicate customer contacts.
- Keep provider credentials server-only. Allow only authorized workspace managers to change connections or send reports. Preserve existing saved credentials and unrelated integration settings.
- Discover accounts, Pages and forms through official APIs only when authorized. Show missing permissions, expired tokens and unavailable assets explicitly; saving IDs alone never means “connected”.
- Reuse the existing Meta app for official OAuth, with workspace-bound, expiring state and server-side token exchange. No supported Meta App User Connector was found; this plan assumes extending the existing custom Meta app flow, not using one shared advertiser identity for every client.

### 3. Reports with reliable schedules
- Offer supported KPI selections (spend, impressions, clicks, leads and calculated CPL), daily/weekly/monthly cadence, time and timezone.
- Reports use the appropriate previous complete period, paginated Meta insights, and the client's selected destination and approved template.
- Record each run and per-destination acceptance/error; distinguish API acceptance from actual WhatsApp delivery receipts.
- Prevent overlapping or duplicate scheduled runs. Show paused, setup-required, next-run and last-error states.
- Prepare a single authenticated scheduler entrypoint and setup instructions. The required digest scheduling secret is currently absent; do not claim automatic delivery is active until scheduling is installed and verified.

### 4. Instant leads and backup checking
- Route official Page leadgen webhooks to configured clients/forms and destinations while preserving current CRM intake and custom field mapping.
- Require signature verification, validate events, check database writes, merge existing CRM notes/tags and make webhook retries idempotent.
- Add a clearly labelled manual “Backup reconciliation / check missed leads” action using the official form leads API, bounded pagination and a saved checkpoint. Never describe this slower backstop as instant delivery.
- Persist errors and retryable status without falsely claiming a message was delivered. Use approved templates for business-initiated alerts outside the service window.

### 5. Public Reachably landing page
- Show a fast public homepage to signed-out visitors while retaining the existing dashboard for signed-in users and existing links.
- Original editorial design using the current brand, optimized product visuals, mobile-first sections and restrained reduced-motion-aware transitions.
- Include workflow explanation, capabilities with truthful readiness labels, security, use cases, FAQ, account/pricing CTAs and actual Reachably plan cards/comparison.
- Read prices and limits directly from the current Plus/Scale/Supreme plan definitions, including GST disclosure. Preserve existing billing behavior and do not equate CRM contact limits with GoWap managed-client limits.
- Add a GoWap competitor-research section citing https://gowap.in/ and 22 October 2026. Include the supplied Starter/Growth figures, but label prices, quotas, delivery definition and monthly expiry as not independently verified where public evidence is unavailable. No affiliation, copied branding or testimonials.
- Update static SEO/social metadata and remove misleading free-price structured data; do not invent reviews, customer counts or security certifications.

## Technical details
- React/Vite, existing shadcn controls and semantic theme tokens; no additional heavy libraries.
- Additive workspace-scoped tables only where needed, with explicit grants, RLS and server-side authorization; no destructive schema changes.
- Share provider processing between instant intake and reconciliation; keep existing subscription/message checks and client-owned payment behavior.
- Keep token material out of browser-readable configuration and logs. Existing broad integration-settings access requires careful compatibility work before changing permission boundaries.
- Edge-function edits can be automatically released by Lovable Cloud even without website publishing. Avoid changing the live receivers until compatibility checks are complete, and do not enable recurring sends without explicit authorization.

## Verification and remaining user setup
- Add focused tests for schedules/periods, authorization, field mapping, duplicate events, invalid signatures and partial provider failures. Run the existing regression suite and inspect automatic compilation output; no manual production build.
- Check public landing and pricing at desktop/mobile sizes and verify core client save/read and setup/error flows with an authorized session where available.
- Live verification requires approved Meta permissions (ads_read; pages_show_list/pages_read_engagement and applicable pages_manage_ads/leads_retrieval/pages_manage_metadata), authorized asset access, Page leadgen subscription, valid tokens and an approved WhatsApp template/number.
- If no requesting-user session can be minted, authenticated checks remain blocked until an account is identified; do not select another customer's account or alter subscriptions.
- Finish with an exact implemented/tested/blocked report and setup checklist. No publication or fabricated end-to-end success.