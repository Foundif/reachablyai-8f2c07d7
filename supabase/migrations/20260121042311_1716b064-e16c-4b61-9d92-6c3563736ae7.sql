-- Enable realtime for clients table to track risk score changes
ALTER PUBLICATION supabase_realtime ADD TABLE public.clients;

-- Enable realtime for payment_history table to track overdue payments
ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_history;

-- Enable realtime for invoices table
ALTER PUBLICATION supabase_realtime ADD TABLE public.invoices;