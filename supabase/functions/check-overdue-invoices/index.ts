import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Invoice {
  id: string;
  invoice_number: string;
  client_id: string;
  amount: number;
  due_date: string;
  status: string;
  user_id: string;
}

interface Client {
  id: string;
  name: string;
  email: string;
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date().toISOString().split('T')[0];

    // Find invoices that are past due and not yet marked as overdue
    const { data: overdueInvoices, error: invoiceError } = await supabase
      .from('invoices')
      .select('*')
      .lt('due_date', today)
      .neq('status', 'paid')
      .neq('status', 'overdue');

    if (invoiceError) {
      console.error("Error fetching invoices:", invoiceError);
      throw invoiceError;
    }

    console.log(`Found ${overdueInvoices?.length || 0} newly overdue invoices`);

    const results = [];

    for (const invoice of overdueInvoices || []) {
      // Update invoice status to overdue
      const { error: updateError } = await supabase
        .from('invoices')
        .update({ status: 'overdue' })
        .eq('id', invoice.id);

      if (updateError) {
        console.error(`Error updating invoice ${invoice.id}:`, updateError);
        continue;
      }

      // Get client info
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', invoice.client_id)
        .single();

      if (clientError || !client) {
        console.error(`Error fetching client for invoice ${invoice.id}:`, clientError);
        continue;
      }

      // Send overdue email if Resend is configured
      if (resendApiKey && client.email) {
        try {
          const emailResponse = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${resendApiKey}`,
            },
            body: JSON.stringify({
              from: "Chatarly <onboarding@resend.dev>",
              to: [client.email],
              subject: `⚠️ OVERDUE: Invoice ${invoice.invoice_number} - $${invoice.amount}`,
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
                      <p style="margin: 10px 0 0 0; opacity: 0.9;">Invoice ${invoice.invoice_number}</p>
                    </div>
                    <div class="content">
                      <p>Hi ${client.name},</p>
                      <div class="alert-box">
                        <strong>This invoice is now overdue.</strong>
                        <p style="margin: 5px 0 0 0;">Please arrange payment at your earliest convenience to avoid any service interruptions.</p>
                      </div>
                      <div class="details">
                        <div class="detail-row">
                          <span>Invoice Number</span>
                          <strong>${invoice.invoice_number}</strong>
                        </div>
                        <div class="detail-row">
                          <span>Amount Due</span>
                          <span class="amount">$${invoice.amount.toFixed(2)}</span>
                        </div>
                        <div class="detail-row">
                          <span>Original Due Date</span>
                          <strong style="color: #dc2626;">${new Date(invoice.due_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</strong>
                        </div>
                      </div>
                      <p>If you have already made this payment, please disregard this notice.</p>
                    </div>
                    <div class="footer">
                      <p>Sent via Chatarly - Salon & Spa Management</p>
                    </div>
                  </div>
                </body>
                </html>
              `,
            }),
          });

          const emailResult = await emailResponse.json();
          console.log(`Email sent for invoice ${invoice.invoice_number}:`, emailResult);
        } catch (emailError) {
          console.error(`Failed to send email for invoice ${invoice.id}:`, emailError);
        }
      }

      results.push({
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
        client_name: client.name,
        amount: invoice.amount,
        status: 'marked_overdue',
      });
    }

    // Also find invoices that are approaching due date (3 days before) for reminders
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    const reminderDate = threeDaysFromNow.toISOString().split('T')[0];

    const { data: upcomingInvoices, error: upcomingError } = await supabase
      .from('invoices')
      .select('*')
      .eq('due_date', reminderDate)
      .eq('status', 'sent');

    if (!upcomingError && upcomingInvoices && upcomingInvoices.length > 0 && resendApiKey) {
      console.log(`Sending reminders for ${upcomingInvoices.length} invoices due in 3 days`);
      
      for (const invoice of upcomingInvoices) {
        const { data: client } = await supabase
          .from('clients')
          .select('*')
          .eq('id', invoice.client_id)
          .single();

        if (client?.email) {
          try {
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${resendApiKey}`,
              },
              body: JSON.stringify({
                from: "Chatarly <onboarding@resend.dev>",
                to: [client.email],
                subject: `Payment Reminder: Invoice ${invoice.invoice_number} due in 3 days`,
                html: `
                  <!DOCTYPE html>
                  <html>
                  <head>
                    <style>
                      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
                      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                      .header { background: linear-gradient(135deg, #f59e0b, #d97706); color: white; padding: 30px; border-radius: 12px 12px 0 0; }
                      .content { background: #fffbeb; padding: 30px; border-radius: 0 0 12px 12px; }
                      .amount { font-size: 28px; font-weight: bold; color: #d97706; }
                      .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
                      .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #fef3c7; }
                      .footer { text-align: center; padding: 20px; color: #64748b; font-size: 14px; }
                    </style>
                  </head>
                  <body>
                    <div class="container">
                      <div class="header">
                        <h1 style="margin: 0;">⏰ Payment Reminder</h1>
                        <p style="margin: 10px 0 0 0; opacity: 0.9;">Invoice ${invoice.invoice_number}</p>
                      </div>
                      <div class="content">
                        <p>Hi ${client.name},</p>
                        <p>This is a friendly reminder that your invoice is due in <strong>3 days</strong>.</p>
                        <div class="details">
                          <div class="detail-row">
                            <span>Invoice Number</span>
                            <strong>${invoice.invoice_number}</strong>
                          </div>
                          <div class="detail-row">
                            <span>Amount Due</span>
                            <span class="amount">$${invoice.amount.toFixed(2)}</span>
                          </div>
                          <div class="detail-row">
                            <span>Due Date</span>
                            <strong>${new Date(invoice.due_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</strong>
                          </div>
                        </div>
                        <p>Please ensure payment is made by the due date to avoid any late fees.</p>
                      </div>
                      <div class="footer">
                        <p>Sent via Chatarly - Salon & Spa Management</p>
                      </div>
                    </div>
                  </body>
                  </html>
                `,
              }),
            });
            console.log(`Reminder sent for invoice ${invoice.invoice_number}`);
          } catch (e) {
            console.error(`Failed to send reminder for invoice ${invoice.id}:`, e);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        results,
        timestamp: new Date().toISOString(),
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  } catch (error: any) {
    console.error("Error in check-overdue-invoices:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
