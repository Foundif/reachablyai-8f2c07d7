# Reachably functionality audit — 21 October 2026

## Completed repair
The highest-impact confirmed issue was the broken Integrations page: a missing LeadFieldMapping import prevented compilation. Restored the import and removed unsafe assertions in the touched rendering paths.

Related reliability fixes:
- Integration and webhook reads now surface errors instead of displaying an apparently empty workspace.
- Workspace resolution and reads have an eight-second deadline and a retry action; stale requests cannot replace newer results.
- Missing workspaces no longer expose setup controls whose actions silently return.
- Mapping saves read current settings before merging questions, check read/write errors and the updated row, retain input on failure, and release disabled controls after failure or timeout. This reduces stale-setting overwrites; it is not an atomic concurrency guarantee.

No schema, permissions, customer records, secrets, paid services, or deployed integration endpoints were changed.

## Evidence and checks
- Latest automatic compilation: passed.
- Available test suite: seven tests passed, including loading-error retry, stalled workspace lookup, missing workspace, settings preservation, zero-row update denial, and failed mapping reads.
- Browser: visiting /integrations while signed out redirects to /auth; no page runtime errors observed.
- Full authenticated UI read/write verification is blocked: there are multiple app users and no account matches the requesting user's email. Neither an account nor an active subscription was selected or modified automatically.
- Targeted ESLint is not clean: existing explicit-any usage remains, plus a ref-cleanup warning. Compilation and tests passing are not a claim of clean lint.

## Confirmed unfinished work, not changed in this bounded repair
1. **Quick replies:** reads discard errors; failed deletes are ignored; existing-row edits are not persisted by the save reconciler. Workspace switching can briefly retain old items. See src/components/inbox/QuickReplies.tsx.
2. **Meta lead webhook:** configured signature verification allows requests without a signature; CRM writes ignore database errors; matching existing leads replaces notes/tags rather than merging them. See supabase/functions/meta-leadgen-webhook/index.ts. City mapping is already implemented via mapped.city, so it is not an unfinished feature.
3. **Meta report:** the screen reports success despite recipient failures. The function calculates sent incorrectly when quota exhaustion breaks the recipient loop and does not paginate beyond the first fifty campaigns. Daily schedule configuration was not verified. See meta-ads-digest and Integrations sendDigestNow.
4. **Integrations configuration:** saving credentials labels the integration connected without verifying external service access. Required-field detection depends on label text rather than explicit field rules, so some documented defaults are wrongly required. Saving a mapping still needs a live Meta lead test.
5. **Unavailable features:** AuditLogs contains sample data and audit.ts is a stub; /audit redirects away. RolesPermissions uses a browser-local matrix but /roles redirects to Team. Shiprocket is marked coming soon; the scraper route is a placeholder. Non-keyword automation triggers are disabled as coming soon.

## Manual verification/setup
- Sign into the preview with an authorized active-plan account to verify Integrations, save a mapping, reopen it, and confirm it reads back.
- Submit a Meta test lead and inspect CRM fields/tags; use an approved template for notifications outside the WhatsApp conversation window.
- Verify the existing daily-report secret and schedule before advertising automatic daily delivery.
- Run real Shopify event, Google Sheet, staff-account, Meta Flow, and client-owned Razorpay payment tests. This audit did not establish their live success.