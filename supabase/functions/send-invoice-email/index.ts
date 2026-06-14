import { Hono } from "https://deno.land/x/hono@v4.3.11/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  type: 'invoice_created' | 'invoice_overdue' | 'payment_reminder';
  invoiceId: string;
  recipientEmail: string;
  recipientName: string;
  invoiceNumber: string;
  amount: number;
  dueDate?: string;
  clientName?: string;
  currency?: string;
}

const formatCurrency = (amount: number, currency = 'USD') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
};

const getEmailContent = (data: EmailRequest) => {
  const formattedAmount = formatCurrency(data.amount, data.currency);
  
  switch (data.type) {
    case 'invoice_created':
      return {
        subject: `New Invoice ${data.invoiceNumber} - ${formattedAmount}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; padding: 30px; border-radius: 12px 12px 0 0; }
              .content { background: #f8fafc; padding: 30px; border-radius: 0 0 12px 12px; }
              .amount { font-size: 32px; font-weight: bold; color: #1d4ed8; }
              .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
              .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e2e8f0; }
              .detail-row:last-child { border-bottom: none; }
              .footer { text-align: center; padding: 20px; color: #64748b; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0;">📄 New Invoice</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">Invoice ${data.invoiceNumber}</p>
              </div>
              <div class="content">
                <p>Hi ${data.recipientName},</p>
                <p>A new invoice has been created:</p>
                <div class="details">
                  <div class="detail-row">
                    <span>Invoice Number</span>
                    <strong>${data.invoiceNumber}</strong>
                  </div>
                  <div class="detail-row">
                    <span>Amount Due</span>
                    <span class="amount">${formattedAmount}</span>
                  </div>
                  ${data.dueDate ? `
                  <div class="detail-row">
                    <span>Due Date</span>
                    <strong>${new Date(data.dueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</strong>
                  </div>
                  ` : ''}
                </div>
              </div>
              <div class="footer">
                <p>Sent via Chatarly</p>
              </div>
            </div>
          </body>
          </html>
        `,
      };
      
    case 'invoice_overdue':
      return {
        subject: `⚠️ OVERDUE: Invoice ${data.invoiceNumber} - ${formattedAmount}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #ef4444, #dc2626); color: white; padding: 30px; border-radius: 12px 12px 0 0; }
              .content { background: #fef2f2; padding: 30px; border-radius: 0 0 12px 12px; }
              .amount { font-size: 32px; font-weight: bold; color: #dc2626; }
              .alert-box { background: white; border-left: 4px solid #ef4444; padding: 15px 20px; margin: 20px 0; border-radius: 0 8px 8px 0; }
              .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
              .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #fee2e2; }
              .footer { text-align: center; padding: 20px; color: #64748b; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0;">🚨 Payment Overdue</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">Invoice ${data.invoiceNumber}</p>
              </div>
              <div class="content">
                <p>Hi ${data.recipientName},</p>
                <div class="alert-box">
                  <strong>This invoice is now overdue.</strong>
                  <p style="margin: 5px 0 0 0;">Please arrange payment at your earliest convenience.</p>
                </div>
                <div class="details">
                  <div class="detail-row">
                    <span>Invoice Number</span>
                    <strong>${data.invoiceNumber}</strong>
                  </div>
                  <div class="detail-row">
                    <span>Amount Due</span>
                    <span class="amount">${formattedAmount}</span>
                  </div>
                  ${data.dueDate ? `
                  <div class="detail-row">
                    <span>Original Due Date</span>
                    <strong style="color: #dc2626;">${new Date(data.dueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</strong>
                  </div>
                  ` : ''}
                </div>
              </div>
              <div class="footer">
                <p>Sent via Chatarly</p>
              </div>
            </div>
          </body>
          </html>
        `,
      };
      
    case 'payment_reminder':
      return {
        subject: `Payment Reminder: Invoice ${data.invoiceNumber} - ${formattedAmount}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #f59e0b, #d97706); color: white; padding: 30px; border-radius: 12px 12px 0 0; }
              .content { background: #fffbeb; padding: 30px; border-radius: 0 0 12px 12px; }
              .amount { font-size: 32px; font-weight: bold; color: #d97706; }
              .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
              .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #fef3c7; }
              .footer { text-align: center; padding: 20px; color: #64748b; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0;">⏰ Payment Reminder</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">Invoice ${data.invoiceNumber}</p>
              </div>
              <div class="content">
                <p>Hi ${data.recipientName},</p>
                <p>This is a friendly reminder that payment is due soon:</p>
                <div class="details">
                  <div class="detail-row">
                    <span>Invoice Number</span>
                    <strong>${data.invoiceNumber}</strong>
                  </div>
                  <div class="detail-row">
                    <span>Amount Due</span>
                    <span class="amount">${formattedAmount}</span>
                  </div>
                  ${data.dueDate ? `
                  <div class="detail-row">
                    <span>Due Date</span>
                    <strong>${new Date(data.dueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</strong>
                  </div>
                  ` : ''}
                </div>
              </div>
              <div class="footer">
                <p>Sent via Chatarly</p>
              </div>
            </div>
          </body>
          </html>
        `,
      };
      
    default:
      throw new Error('Unknown email type');
  }
};

const app = new Hono();

app.options('/*', (c) => {
  return c.text('', 200, corsHeaders);
});

app.post('/*', async (c) => {
  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const data: EmailRequest = await c.req.json();
    
    if (!data.recipientEmail || !data.invoiceNumber) {
      throw new Error('Missing required fields: recipientEmail, invoiceNumber');
    }
    
    const emailContent = getEmailContent(data);

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Chatarly <onboarding@resend.dev>",
        to: [data.recipientEmail],
        subject: emailContent.subject,
        html: emailContent.html,
      }),
    });

    const result = await response.json();
    console.log("Email sent successfully:", result);

    return c.json({ success: true, data: result }, 200, corsHeaders);
  } catch (error: any) {
    console.error("Error in send-invoice-email:", error);
    return c.json({ success: false, error: error.message }, 500, corsHeaders);
  }
});

Deno.serve(app.fetch);
