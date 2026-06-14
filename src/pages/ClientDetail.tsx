import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import TrustScoreDial from '@/components/TrustScoreDial';
import RiskBadge from '@/components/RiskBadge';
import { useClients, usePaymentHistory, Client } from '@/hooks/useClients';
import { useInvoices } from '@/hooks/useInvoices';
import { formatCurrency, formatDate } from '@/data/mockData';
import { useCurrency } from '@/hooks/useCurrency';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  ArrowLeft,
  Building2, 
  MapPin,
  Mail,
  FileText,
  Clock,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Lightbulb,
  Shield,
  Edit3,
  Save,
  X,
  Pencil,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import EditClientModal from '@/components/clients/EditClientModal';
import SendReminderModal from '@/components/invoices/SendReminderModal';

const ClientDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { clients, loading: clientsLoading } = useClients();
  const { payments, loading: paymentsLoading } = usePaymentHistory(id);
  const { invoices } = useInvoices();
  const currency = useCurrency();
  
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editTrustScore, setEditTrustScore] = useState(75);
  const [editRiskLevel, setEditRiskLevel] = useState<'safe' | 'medium' | 'high'>('medium');
  const [saving, setSaving] = useState(false);
  const [editClientModalOpen, setEditClientModalOpen] = useState(false);
  const [reminderModalOpen, setReminderModalOpen] = useState(false);

  const client = clients.find(c => c.id === id);
  const clientInvoices = invoices.filter(inv => inv.client_id === id);

  useEffect(() => {
    if (client) {
      setEditTrustScore(client.trust_score);
      setEditRiskLevel(client.risk_level);
    }
  }, [client]);

  const handleSaveRisk = async () => {
    if (!client) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('clients')
        .update({
          trust_score: editTrustScore,
          risk_level: editRiskLevel,
        })
        .eq('id', client.id);

      if (error) throw error;
      
      toast.success('Risk profile updated successfully');
      setEditModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update risk profile');
    } finally {
      setSaving(false);
    }
  };

  if (clientsLoading) {
    return (
      <AppLayout>
        <div className="p-4 md:p-6 lg:p-8 space-y-6">
          <Skeleton className="h-8 w-32" />
          <div className="glass-card p-6 md:p-8">
            <div className="flex flex-col lg:flex-row gap-8">
              <Skeleton className="w-32 h-32 rounded-full" />
              <div className="flex-1 space-y-4">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-4 w-48" />
                <div className="grid grid-cols-4 gap-4 pt-4">
                  {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} className="h-16" />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!client) {
    return (
      <AppLayout>
        <div className="p-8 text-center">
          <p className="text-muted-foreground">Client not found</p>
          <Link to="/clients" className="text-primary hover:underline mt-2 inline-block">
            Back to clients
          </Link>
        </div>
      </AppLayout>
    );
  }

  // Calculate suggestions based on risk
  const suggestedAdvance = client.risk_level === 'high' ? 50 : client.risk_level === 'medium' ? 30 : 0;
  const suggestedTerms = client.risk_level === 'high' ? 'NET 7' : client.risk_level === 'medium' ? 'NET 15' : 'NET 30';

  return (
    <AppLayout>
      <div className="p-3 sm:p-4 md:p-6 lg:p-8 space-y-4 sm:space-y-6">
        {/* Back Button */}
        <Link 
          to="/clients"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm sm:text-base"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to clients
        </Link>

        {/* Header */}
        <div className="glass-card p-4 sm:p-6 md:p-8">
          <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
            {/* Trust Score - Hero */}
            <div className="flex flex-col items-center gap-3 sm:gap-4">
              <TrustScoreDial score={client.trust_score} size="lg" />
              <RiskBadge level={client.risk_level} size="lg" />
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setEditModalOpen(true)}
                className="mt-2"
              >
                <Edit3 className="w-4 h-4" />
                Edit Risk
              </Button>
            </div>
            
            {/* Client Info */}
            <div className="flex-1 space-y-4">
              <div>
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-2">
                  {client.name}
                </h1>
                <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-sm text-muted-foreground">
                  {client.company && (
                    <span className="flex items-center gap-2">
                      <Building2 className="w-4 h-4" />
                      {client.company}
                    </span>
                  )}
                  {client.country && (
                    <span className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      {client.country}
                    </span>
                  )}
                  {client.email && (
                    <span className="flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      {client.email}
                    </span>
                  )}
                </div>
              </div>
              
              {/* Quick Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 pt-4 border-t border-border">
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground mb-1">Total Invoices</p>
                  <p className="text-lg sm:text-xl font-bold text-foreground">{clientInvoices.length}</p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground mb-1">Total Paid</p>
                  <p className="text-lg sm:text-xl font-bold text-trust-safe">{formatCurrency(client.total_paid, currency)}</p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground mb-1">Outstanding</p>
                  <p className={cn(
                    'text-lg sm:text-xl font-bold',
                    client.total_outstanding > 0 ? 'text-risk-medium' : 'text-foreground'
                  )}>
                    {formatCurrency(client.total_outstanding, currency)}
                  </p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground mb-1">Trust Score</p>
                  <p className="text-lg sm:text-xl font-bold text-foreground">{client.trust_score}</p>
                </div>
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex flex-col gap-3 lg:w-48">
              <Button 
                variant="trust" 
                className="w-full"
                onClick={() => navigate(`/invoices/create?client=${client.id}`)}
              >
                <FileText className="w-4 h-4" />
                Create Invoice
              </Button>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => setReminderModalOpen(true)}
              >
                <Mail className="w-4 h-4" />
                Send Reminder
              </Button>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => setEditClientModalOpen(true)}
              >
                <Pencil className="w-4 h-4" />
                Edit Client
              </Button>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
            {/* Risk Explanation */}
            <div className="glass-card p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className={cn(
                  'w-5 h-5',
                  client.risk_level === 'high' ? 'text-risk-high' :
                  client.risk_level === 'medium' ? 'text-risk-medium' :
                  'text-trust-safe'
                )} />
                <h2 className="font-semibold text-foreground text-base sm:text-lg">Risk Analysis</h2>
              </div>
              
              <p className="text-sm sm:text-base text-muted-foreground mb-4">
                {client.risk_level === 'high' 
                  ? `${client.name} shows payment patterns that indicate high financial risk. Consider protective measures.`
                  : client.risk_level === 'medium'
                  ? `${client.name} has moderate risk. Monitor closely and consider adjusted terms.`
                  : `${client.name} has an excellent payment track record. Low risk for future engagements.`
                }
              </p>
              
              {/* Risk Factors */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <TrendingDown className={cn(
                    'w-4 h-4',
                    client.total_outstanding > 20000 ? 'text-risk-high' : 'text-muted-foreground'
                  )} />
                  <span className="text-sm text-muted-foreground">Outstanding balance:</span>
                  <span className={cn(
                    'text-sm font-medium',
                    client.total_outstanding > 20000 ? 'text-risk-high' : 'text-foreground'
                  )}>
                    {formatCurrency(client.total_outstanding, currency)}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Shield className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Trust Score:</span>
                  <span className="text-sm font-medium text-foreground">{client.trust_score}/100</span>
                </div>
              </div>
            </div>
            
            {/* Payment History */}
            <div className="glass-card overflow-hidden">
              <div className="px-4 sm:px-6 py-4 border-b border-border">
                <h2 className="font-semibold text-foreground text-base sm:text-lg">Payment History</h2>
              </div>
              
              {paymentsLoading ? (
                <div className="p-4 sm:p-6 space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-16" />
                  ))}
                </div>
              ) : payments.length === 0 ? (
                <div className="p-6 sm:p-8 text-center">
                  <p className="text-muted-foreground text-sm sm:text-base">No payment history yet</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {payments.map((payment, index) => (
                    <div 
                      key={payment.id}
                      className="px-4 sm:px-6 py-4 flex items-center gap-3 sm:gap-4 animate-fade-up"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div className={cn(
                        'p-2 rounded-lg flex-shrink-0',
                        payment.status === 'paid' ? 'bg-[hsl(var(--risk-safe))]/20 text-trust-safe' :
                        payment.status === 'overdue' ? 'bg-risk-high/20 text-risk-high' :
                        'bg-primary/20 text-primary'
                      )}>
                        {payment.status === 'paid' ? <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" /> :
                         payment.status === 'overdue' ? <XCircle className="w-4 h-4 sm:w-5 sm:h-5" /> :
                         <Clock className="w-4 h-4 sm:w-5 sm:h-5" />}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-medium text-foreground text-sm sm:text-base">
                            {payment.invoice_id ? `Invoice` : 'Payment'}
                          </span>
                          <span className={cn(
                            'text-xs px-2 py-0.5 rounded-full',
                            payment.status === 'paid' ? 'bg-[hsl(var(--risk-safe))]/20 text-trust-safe' :
                            payment.status === 'overdue' ? 'bg-risk-high/20 text-risk-high' :
                            'bg-primary/20 text-primary'
                          )}>
                            {payment.status === 'paid' ? 'Paid' : 
                             payment.status === 'overdue' ? `${payment.days_late}d overdue` : 
                             'Pending'}
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          {payment.due_date && `Due: ${formatDate(payment.due_date)}`}
                          {payment.payment_date && ` • Paid: ${formatDate(payment.payment_date)}`}
                        </p>
                      </div>
                      
                      <div className="text-right flex-shrink-0">
                        <p className="font-semibold text-foreground text-sm sm:text-base">
                          {formatCurrency(payment.amount, currency)}
                        </p>
                        {payment.days_late > 0 && payment.status === 'paid' && (
                          <p className="text-xs text-muted-foreground">
                            +{payment.days_late} days late
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          {/* Right Column - Recommendations */}
          <div className="space-y-4 sm:space-y-6">
            {/* Smart Recommendations */}
            <div className="glass-card p-4 sm:p-6 border-l-4 border-l-primary">
              <div className="flex items-center gap-2 mb-4">
                <Lightbulb className="w-5 h-5 text-primary" />
                <h2 className="font-semibold text-foreground text-base sm:text-lg">Smart Recommendations</h2>
              </div>
              
              <div className="space-y-3 sm:space-y-4">
                <div className="p-3 sm:p-4 rounded-lg bg-accent/50">
                  <p className="text-xs sm:text-sm text-muted-foreground mb-1">Suggested Advance</p>
                  <p className="text-xl sm:text-2xl font-bold text-foreground">
                    {suggestedAdvance > 0 ? `${suggestedAdvance}%` : 'Not required'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {suggestedAdvance > 0 
                      ? 'Request upfront to mitigate risk'
                      : 'Client history supports standard terms'}
                  </p>
                </div>
                
                <div className="p-3 sm:p-4 rounded-lg bg-accent/50">
                  <p className="text-xs sm:text-sm text-muted-foreground mb-1">Suggested Terms</p>
                  <p className="text-xl sm:text-2xl font-bold text-foreground">{suggestedTerms}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Based on risk profile
                  </p>
                </div>
              </div>
            </div>
            
            {/* Industry Comparison */}
            <div className="glass-card p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="w-5 h-5 text-primary" />
                <h2 className="font-semibold text-foreground text-base sm:text-lg">Industry Comparison</h2>
              </div>
              
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs sm:text-sm text-muted-foreground">This Client</span>
                    <span className="text-xs sm:text-sm font-medium text-foreground">{client.trust_score}</span>
                  </div>
                  <div className="data-bar">
                    <div 
                      className="data-bar-fill"
                      style={{ width: `${client.trust_score}%` }}
                    />
                  </div>
                </div>
                
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs sm:text-sm text-muted-foreground">Industry Avg</span>
                    <span className="text-xs sm:text-sm font-medium text-foreground">72</span>
                  </div>
                  <div className="data-bar">
                    <div 
                      className="data-bar-fill opacity-50"
                      style={{ width: '72%' }}
                    />
                  </div>
                </div>
                
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs sm:text-sm text-muted-foreground">Platform Avg</span>
                    <span className="text-xs sm:text-sm font-medium text-foreground">68</span>
                  </div>
                  <div className="data-bar">
                    <div 
                      className="data-bar-fill opacity-50"
                      style={{ width: '68%' }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Risk Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Risk Profile</DialogTitle>
            <DialogDescription>
              Manually adjust the trust score and risk level for {client.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Trust Score Slider */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Trust Score</Label>
                <span className="text-2xl font-bold text-foreground">{editTrustScore}</span>
              </div>
              <Slider
                value={[editTrustScore]}
                onValueChange={(value) => setEditTrustScore(value[0])}
                min={0}
                max={100}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>High Risk</span>
                <span>Safe</span>
              </div>
            </div>

            {/* Risk Level Select */}
            <div className="space-y-2">
              <Label>Risk Level</Label>
              <Select value={editRiskLevel} onValueChange={(v) => setEditRiskLevel(v as typeof editRiskLevel)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="safe">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-[hsl(var(--risk-safe))]" />
                      Safe
                    </div>
                  </SelectItem>
                  <SelectItem value="medium">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-[hsl(var(--risk-medium))]" />
                      Medium
                    </div>
                  </SelectItem>
                  <SelectItem value="high">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-[hsl(var(--risk-high))]" />
                      High
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditModalOpen(false)}>
              <X className="w-4 h-4" />
              Cancel
            </Button>
            <Button onClick={handleSaveRisk} disabled={saving}>
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Client Modal */}
      <EditClientModal
        client={client}
        open={editClientModalOpen}
        onOpenChange={setEditClientModalOpen}
        onDelete={() => navigate('/clients')}
      />

      {/* Send Reminder Modal */}
      <SendReminderModal
        open={reminderModalOpen}
        onOpenChange={setReminderModalOpen}
        clientName={client.name}
        clientEmail={client.email}
        amount={client.total_outstanding}
      />
    </AppLayout>
  );
};

export default ClientDetail;
