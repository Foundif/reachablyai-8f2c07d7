import { Client } from '@/types/client';
import { cn } from '@/lib/utils';
import { formatCurrency, formatDate } from '@/data/mockData';
import { Calendar, ArrowRight } from 'lucide-react';

interface PaymentTimelineProps {
  clients: Client[];
}

const PaymentTimeline = ({ clients }: PaymentTimelineProps) => {
  // Get all pending/overdue payments
  const payments = clients
    .flatMap(client => 
      client.paymentHistory
        .filter(p => p.status !== 'paid')
        .map(p => ({
          ...p,
          clientName: client.name,
          clientCompany: client.company,
          clientId: client.id,
          riskLevel: client.riskLevel,
        }))
    )
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  return (
    <div className="glass-card overflow-hidden">
      <div className="px-3 sm:px-4 lg:px-5 py-3 sm:py-4 border-b border-border flex items-center gap-2">
        <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
        <h3 className="font-semibold text-foreground text-sm sm:text-base">Payment Timeline</h3>
      </div>
      
      <div className="p-3 sm:p-4 overflow-x-auto custom-scrollbar">
        <div className="flex gap-2 sm:gap-3 lg:gap-4 min-w-max pb-2">
          {payments.map((payment, index) => {
            const isOverdue = payment.status === 'overdue';
            
            return (
              <div
                key={payment.id}
                className={cn(
                  'flex-shrink-0 w-44 sm:w-52 lg:w-64 p-3 sm:p-4 rounded-lg sm:rounded-xl border transition-all duration-300 hover-lift animate-fade-up',
                  isOverdue 
                    ? 'bg-risk-high/10 border-risk-high/30'
                    : 'bg-card border-border'
                )}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-center justify-between mb-2 sm:mb-3">
                  <span className={cn(
                    'text-[10px] sm:text-xs font-semibold px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full',
                    isOverdue 
                      ? 'bg-risk-high/20 text-risk-high'
                      : 'bg-primary/20 text-primary'
                  )}>
                    {isOverdue ? `${payment.delayDays}d overdue` : 'Upcoming'}
                  </span>
                  <span className="text-[10px] sm:text-xs text-muted-foreground">
                    {formatDate(payment.dueDate)}
                  </span>
                </div>
                
                <p className="font-bold text-base sm:text-lg lg:text-xl text-foreground mb-0.5 sm:mb-1">
                  {formatCurrency(payment.amount, payment.currency)}
                </p>
                
                <p className="text-xs sm:text-sm font-medium text-foreground truncate">
                  {payment.clientCompany}
                </p>
                <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                  {payment.clientName}
                </p>
                
                <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-border flex items-center justify-between">
                  <span className="text-[10px] sm:text-xs text-muted-foreground truncate max-w-[60%]">
                    {payment.invoiceId}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground flex-shrink-0" />
                </div>
              </div>
            );
          })}
          
          {payments.length === 0 && (
            <div className="flex items-center justify-center w-full py-6 sm:py-8 text-muted-foreground text-sm">
              No pending payments
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaymentTimeline;
