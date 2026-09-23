ALTER TABLE public.automations DROP CONSTRAINT IF EXISTS automations_action_type_check;
ALTER TABLE public.automations ADD CONSTRAINT automations_action_type_check
  CHECK (action_type IN ('send_template','send_text','send_flow','add_tag','set_status','assign_agent'));
CREATE INDEX IF NOT EXISTS record_payments_link_idx ON public.record_payments (razorpay_link_id);