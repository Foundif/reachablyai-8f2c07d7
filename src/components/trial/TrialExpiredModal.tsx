import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Crown, Lock, Eye } from 'lucide-react';

const ACTIVE_STATUSES = new Set(['active', 'starter', 'growth', 'pro', 'professional', 'enterprise']);
const EXEMPT_ROUTES = new Set(['/pricing', '/profile', '/privacy', '/terms', '/billing']);

// Read-only lock modal disabled — users can freely browse; upgrade CTA lives in the sidebar (TrialCard) and Pricing page.
const TrialExpiredModal = () => null;

export default TrialExpiredModal;
