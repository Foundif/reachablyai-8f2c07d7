import { useState } from 'react';
import { z } from 'zod';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  User, 
  Building2, 
  Mail, 
  Globe, 
  Briefcase,
  Loader2,
  Check
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const clientSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name too long'),
  email: z.string().trim().email('Invalid email').max(255, 'Email too long').optional().or(z.literal('')),
  company: z.string().trim().min(1, 'Company is required').max(100, 'Company too long'),
  industry: z.string().min(1, 'Industry is required'),
  country: z.string().min(1, 'Country is required'),
  notes: z.string().max(500, 'Notes too long').optional(),
});

type ClientFormData = z.infer<typeof clientSchema>;

const INDUSTRIES = [
  'Technology', 'Marketing', 'Finance', 'Healthcare', 
  'E-commerce', 'Education', 'Real Estate', 'Consulting', 
  'Media', 'Manufacturing', 'Other'
];

const COUNTRIES = [
  'United States', 'United Kingdom', 'Canada', 'Australia',
  'Germany', 'France', 'India', 'Singapore', 'Netherlands',
  'Brazil', 'Japan', 'Other'
];

interface AddClientModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const AddClientModal = ({ open, onOpenChange, onSuccess }: AddClientModalProps) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof ClientFormData, string>>>({});
  const [formData, setFormData] = useState<ClientFormData>({
    name: '',
    email: '',
    company: '',
    industry: '',
    country: '',
    notes: '',
  });

  const handleChange = (field: keyof ClientFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate
    const result = clientSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof ClientFormData, string>> = {};
      result.error.errors.forEach(err => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as keyof ClientFormData] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    if (!user) {
      toast.error('You must be logged in');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from('clients').insert({
        user_id: user.id,
        name: result.data.name,
        email: result.data.email || null,
        company: result.data.company,
        industry: result.data.industry,
        country: result.data.country,
        notes: result.data.notes || null,
        trust_score: 75,
        risk_level: 'medium',
      });

      if (error) throw error;

      toast.success('Client added successfully!');
      setFormData({ name: '', email: '', company: '', industry: '', country: '', notes: '' });
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add client');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-foreground flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            Add New Client
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* Name & Email Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name" className="flex items-center gap-1.5 mb-1.5">
                <User className="w-3.5 h-3.5" />
                Contact Name *
              </Label>
              <Input
                id="name"
                placeholder="John Doe"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className={cn(errors.name && 'border-risk-high')}
              />
              {errors.name && <p className="text-xs text-risk-high mt-1">{errors.name}</p>}
            </div>

            <div>
              <Label htmlFor="email" className="flex items-center gap-1.5 mb-1.5">
                <Mail className="w-3.5 h-3.5" />
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="john@company.com"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                className={cn(errors.email && 'border-risk-high')}
              />
              {errors.email && <p className="text-xs text-risk-high mt-1">{errors.email}</p>}
            </div>
          </div>

          {/* Company */}
          <div>
            <Label htmlFor="company" className="flex items-center gap-1.5 mb-1.5">
              <Building2 className="w-3.5 h-3.5" />
              Company Name *
            </Label>
            <Input
              id="company"
              placeholder="Acme Corporation"
              value={formData.company}
              onChange={(e) => handleChange('company', e.target.value)}
              className={cn(errors.company && 'border-risk-high')}
            />
            {errors.company && <p className="text-xs text-risk-high mt-1">{errors.company}</p>}
          </div>

          {/* Industry & Country Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="flex items-center gap-1.5 mb-1.5">
                <Briefcase className="w-3.5 h-3.5" />
                Industry *
              </Label>
              <Select value={formData.industry} onValueChange={(v) => handleChange('industry', v)}>
                <SelectTrigger className={cn(errors.industry && 'border-risk-high')}>
                  <SelectValue placeholder="Select industry" />
                </SelectTrigger>
                <SelectContent>
                  {INDUSTRIES.map((ind) => (
                    <SelectItem key={ind} value={ind}>{ind}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.industry && <p className="text-xs text-risk-high mt-1">{errors.industry}</p>}
            </div>

            <div>
              <Label className="flex items-center gap-1.5 mb-1.5">
                <Globe className="w-3.5 h-3.5" />
                Country *
              </Label>
              <Select value={formData.country} onValueChange={(v) => handleChange('country', v)}>
                <SelectTrigger className={cn(errors.country && 'border-risk-high')}>
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.country && <p className="text-xs text-risk-high mt-1">{errors.country}</p>}
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes" className="mb-1.5 block">Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Any notes about this client..."
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              className="min-h-[80px] resize-none"
            />
          </div>

          {/* Submit */}
          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="trust"
              className="flex-1"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Add Client
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddClientModal;
