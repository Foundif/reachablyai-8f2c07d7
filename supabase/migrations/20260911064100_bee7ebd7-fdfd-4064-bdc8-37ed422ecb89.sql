CREATE TABLE public.feedback_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  submitted_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('bug', 'feature', 'ui_issue', 'other')),
  title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 120),
  description text NOT NULL CHECK (char_length(description) BETWEEN 10 AND 2000),
  screenshot_urls text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'reviewing', 'in_progress', 'resolved', 'closed')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  resolution_note text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.feedback_tickets TO authenticated;
GRANT ALL ON public.feedback_tickets TO service_role;
ALTER TABLE public.feedback_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own feedback tickets"
ON public.feedback_tickets FOR SELECT TO authenticated
USING (submitted_by = auth.uid() AND public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "Users can submit feedback for their workspace"
ON public.feedback_tickets FOR INSERT TO authenticated
WITH CHECK (submitted_by = auth.uid() AND public.is_workspace_member(workspace_id, auth.uid()));
CREATE UNIQUE INDEX feedback_one_active_ticket_per_user
ON public.feedback_tickets(submitted_by)
WHERE status IN ('submitted', 'reviewing', 'in_progress');
CREATE INDEX feedback_tickets_workspace_status_created_idx
ON public.feedback_tickets(workspace_id, status, created_at DESC);
CREATE TRIGGER update_feedback_tickets_updated_at
BEFORE UPDATE ON public.feedback_tickets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();