
-- Drop trigger-dependent functions first will be handled by CASCADE
DROP TABLE IF EXISTS public.tn_agent_versions CASCADE;
DROP TABLE IF EXISTS public.tn_ai_agents CASCADE;
DROP TABLE IF EXISTS public.tn_ai_credits CASCADE;
DROP TABLE IF EXISTS public.tn_audit_log CASCADE;
DROP TABLE IF EXISTS public.tn_booking_idempotency CASCADE;
DROP TABLE IF EXISTS public.tn_bookings CASCADE;
DROP TABLE IF EXISTS public.tn_campaigns CASCADE;
DROP TABLE IF EXISTS public.tn_customers CASCADE;
DROP TABLE IF EXISTS public.tn_expenses CASCADE;
DROP TABLE IF EXISTS public.tn_flow_events CASCADE;
DROP TABLE IF EXISTS public.tn_flow_sessions CASCADE;
DROP TABLE IF EXISTS public.tn_flow_templates CASCADE;
DROP TABLE IF EXISTS public.tn_flows CASCADE;
DROP TABLE IF EXISTS public.tn_messages CASCADE;
DROP TABLE IF EXISTS public.tn_meta_flows CASCADE;
DROP TABLE IF EXISTS public.tn_meta_templates CASCADE;
DROP TABLE IF EXISTS public.tn_payments CASCADE;
DROP TABLE IF EXISTS public.tn_permission_overrides CASCADE;
DROP TABLE IF EXISTS public.tn_services CASCADE;
DROP TABLE IF EXISTS public.tn_settings CASCADE;

DROP TABLE IF EXISTS public.appointments CASCADE;
DROP TABLE IF EXISTS public.clients CASCADE;
DROP TABLE IF EXISTS public.customers CASCADE;
DROP TABLE IF EXISTS public.employees CASCADE;
DROP TABLE IF EXISTS public.services CASCADE;
DROP TABLE IF EXISTS public.product_sizes CASCADE;
DROP TABLE IF EXISTS public.sale_items CASCADE;
DROP TABLE IF EXISTS public.sales CASCADE;
DROP TABLE IF EXISTS public.returns CASCADE;
DROP TABLE IF EXISTS public.purchase_items CASCADE;
DROP TABLE IF EXISTS public.purchases CASCADE;
DROP TABLE IF EXISTS public.suppliers CASCADE;
DROP TABLE IF EXISTS public.products CASCADE;
DROP TABLE IF EXISTS public.expenses CASCADE;
DROP TABLE IF EXISTS public.salon_invoice_items CASCADE;
DROP TABLE IF EXISTS public.salon_invoices CASCADE;
DROP TABLE IF EXISTS public.invoices CASCADE;
DROP TABLE IF EXISTS public.payment_history CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;

DROP TABLE IF EXISTS public.whatsapp_sessions CASCADE;

-- Legacy helpers that only served dropped tables
DROP FUNCTION IF EXISTS public.tn_owner_of(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.tn_shared_access(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.tn_team_can(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.tn_snapshot_agent_version() CASCADE;
DROP FUNCTION IF EXISTS public.tn_bookings_status_timeline() CASCADE;
DROP FUNCTION IF EXISTS public.tn_bookings_sync_payment() CASCADE;
DROP FUNCTION IF EXISTS public.tn_consume_ai_credit(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.tn_booking_to_lead() CASCADE;
