import { useState, useEffect, useMemo } from 'react';
import { useClients } from './useClients';
import { useInvoices } from './useInvoices';

export interface Alert {
  id: string;
  type: 'risk_increase' | 'payment_overdue' | 'trust_drop' | 'new_client' | 'payment_received';
  severity: 'low' | 'medium' | 'high';
  title: string;
  message: string;
  clientId?: string;
  clientName?: string;
  invoiceId?: string;
  createdAt: string;
  read: boolean;
}

export const useAlerts = () => {
  const { clients } = useClients();
  const { invoices } = useInvoices();
  const [readAlerts, setReadAlerts] = useState<Set<string>>(new Set());

  // Generate alerts based on real data
  const alerts = useMemo(() => {
    const generatedAlerts: Alert[] = [];
    const now = new Date();

    // Check for overdue invoices
    invoices.forEach((invoice) => {
      if (invoice.status === 'overdue' && invoice.due_date) {
        const client = clients.find((c) => c.id === invoice.client_id);
        const dueDate = new Date(invoice.due_date);
        const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        
        generatedAlerts.push({
          id: `overdue-${invoice.id}`,
          type: 'payment_overdue',
          severity: daysOverdue > 30 ? 'high' : daysOverdue > 14 ? 'medium' : 'low',
          title: 'Payment Overdue',
          message: `Invoice ${invoice.invoice_number} is ${daysOverdue} days overdue ($${invoice.amount.toLocaleString()})`,
          clientId: invoice.client_id,
          clientName: client?.name || 'Unknown Client',
          invoiceId: invoice.id,
          createdAt: invoice.due_date,
          read: readAlerts.has(`overdue-${invoice.id}`),
        });
      }
    });

    // Check for high-risk clients
    clients.forEach((client) => {
      if (client.risk_level === 'high') {
        generatedAlerts.push({
          id: `risk-${client.id}`,
          type: 'risk_increase',
          severity: 'high',
          title: 'High Risk Client',
          message: `${client.name} has a high risk profile (Trust Score: ${client.trust_score})`,
          clientId: client.id,
          clientName: client.name,
          createdAt: client.updated_at,
          read: readAlerts.has(`risk-${client.id}`),
        });
      }

      // Low trust score alerts
      if (client.trust_score < 50 && client.risk_level !== 'high') {
        generatedAlerts.push({
          id: `trust-${client.id}`,
          type: 'trust_drop',
          severity: 'medium',
          title: 'Low Trust Score',
          message: `${client.name}'s trust score dropped to ${client.trust_score}`,
          clientId: client.id,
          clientName: client.name,
          createdAt: client.updated_at,
          read: readAlerts.has(`trust-${client.id}`),
        });
      }

      // Recently added clients (last 7 days)
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      if (new Date(client.created_at) > sevenDaysAgo) {
        generatedAlerts.push({
          id: `new-${client.id}`,
          type: 'new_client',
          severity: 'low',
          title: 'New Client Added',
          message: `${client.name} was added to your client list`,
          clientId: client.id,
          clientName: client.name,
          createdAt: client.created_at,
          read: readAlerts.has(`new-${client.id}`),
        });
      }
    });

    // Check for recent payments
    invoices.forEach((invoice) => {
      if (invoice.status === 'paid') {
        const client = clients.find((c) => c.id === invoice.client_id);
        const updatedDate = new Date(invoice.updated_at);
        const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
        
        if (updatedDate > threeDaysAgo) {
          generatedAlerts.push({
            id: `paid-${invoice.id}`,
            type: 'payment_received',
            severity: 'low',
            title: 'Payment Received',
            message: `Payment of $${invoice.amount.toLocaleString()} received for ${invoice.invoice_number}`,
            clientId: invoice.client_id,
            clientName: client?.name || 'Unknown Client',
            invoiceId: invoice.id,
            createdAt: invoice.updated_at,
            read: readAlerts.has(`paid-${invoice.id}`),
          });
        }
      }
    });

    // Sort by date (newest first)
    return generatedAlerts.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [clients, invoices, readAlerts]);

  const unreadCount = alerts.filter((a) => !a.read).length;

  const markAsRead = (alertId: string) => {
    setReadAlerts((prev) => new Set([...prev, alertId]));
  };

  const markAllAsRead = () => {
    setReadAlerts(new Set(alerts.map((a) => a.id)));
  };

  return {
    alerts,
    unreadCount,
    markAsRead,
    markAllAsRead,
  };
};
