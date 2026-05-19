import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { Resend } from "https://esm.sh/resend@3.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2025-08-27.basil",
});

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { persistSession: false } }
);

// Map Stripe price IDs -> internal plan names (must match useSubscription PLANS)
const PRICE_TO_PLAN: Record<string, string> = {
  "price_1SYVOhF2249riykhzMKCVXNw": "basic",
  "price_1SYVOhF2249riykh1HAwzkce": "basic",
  "price_1SYVOiF2249riykhLo07A0Lx": "professional",
  "price_1SYVOiF2249riykhphMkNE0w": "professional",
  "price_1SYVOjF2249riykhJmw4RoVM": "premium",
  "price_1SYVOjF2249riykhi2o98hEf": "premium",
  "price_1Sq1xDF2249riykhpt3dJbLS": "super_premium",
  "price_1Sq1xZF2249riykhmTrDAtsF": "super_premium",
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

async function syncSubscription(subscription: Stripe.Subscription) {
  try {
    const customerId = subscription.customer as string;
    const customer = await stripe.customers.retrieve(customerId);
    const email = "email" in customer ? customer.email : null;
    if (!email) {
      logStep("Cannot sync: customer has no email", { customerId });
      return;
    }

    const { data: userList } = await supabaseAdmin.auth.admin.listUsers();
    const user = userList?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (!user) {
      logStep("No matching user for email", { email });
      return;
    }

    const priceId = subscription.items.data[0]?.price.id ?? null;
    const planName = (priceId && PRICE_TO_PLAN[priceId]) || "basic";
    const isActive = ["active", "trialing"].includes(subscription.status);

    await supabaseAdmin.from("user_subscriptions").upsert({
      user_id: user.id,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      stripe_price_id: priceId,
      plan_name: isActive ? planName : "free",
      status: subscription.status,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

    logStep("Subscription synced", { userId: user.id, planName, status: subscription.status });
  } catch (err) {
    logStep("Error syncing subscription", { error: (err as Error).message });
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Webhook received");
    
    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      throw new Error("No stripe signature found");
    }

    const body = await req.text();
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    
    if (!webhookSecret) {
      throw new Error("STRIPE_WEBHOOK_SECRET not configured");
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
      logStep("Webhook signature verified", { type: event.type });
    } catch (err) {
      const error = err as Error;
      logStep("Webhook signature verification failed", { error: error.message });
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle different event types
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        logStep("Checkout completed", { sessionId: session.id, subId: session.subscription });
        if (session.subscription) {
          const sub = await stripe.subscriptions.retrieve(session.subscription as string);
          await syncSubscription(sub);
        }
        break;
      }

      case "customer.subscription.created": {
        const subscription = event.data.object as Stripe.Subscription;
        logStep("Subscription created", { id: subscription.id });
        await syncSubscription(subscription);
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        logStep("Invoice paid", { id: invoice.id });
        if (invoice.subscription) {
          const sub = await stripe.subscriptions.retrieve(invoice.subscription as string);
          await syncSubscription(sub);
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        logStep("Subscription updated", { subscriptionId: subscription.id, status: subscription.status });
        await syncSubscription(subscription);
        
        // Check if subscription is ending soon (7 days before)
        const daysUntilEnd = Math.floor(
          (subscription.current_period_end * 1000 - Date.now()) / (1000 * 60 * 60 * 24)
        );
        
        if (daysUntilEnd <= 7 && daysUntilEnd > 0 && subscription.status === "active") {
          const customer = await stripe.customers.retrieve(subscription.customer as string);
          
          if ("email" in customer && customer.email) {
            await sendExpiringSubscriptionEmail(customer.email, daysUntilEnd, subscription);
          }
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        logStep("Payment failed", { invoiceId: invoice.id });
        
        const customer = await stripe.customers.retrieve(invoice.customer as string);
        
        if ("email" in customer && customer.email) {
          await sendPaymentFailedEmail(customer.email, invoice);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        logStep("Subscription deleted", { subscriptionId: subscription.id });
        
        const customer = await stripe.customers.retrieve(subscription.customer as string);
        
        if ("email" in customer && customer.email) {
          await sendSubscriptionCanceledEmail(customer.email, subscription);
        }
        break;
      }

      default:
        logStep("Unhandled event type", { type: event.type });
    }

    return new Response(
      JSON.stringify({ received: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const error = err as Error;
    logStep("ERROR", { message: error.message });
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function sendExpiringSubscriptionEmail(
  email: string,
  daysUntilEnd: number,
  subscription: Stripe.Subscription
) {
  const endDate = new Date(subscription.current_period_end * 1000).toLocaleDateString("pt-BR");
  
  try {
    await resend.emails.send({
      from: "Essência Dental Lab <onboarding@resend.dev>",
      to: [email],
      subject: `⚠️ Sua assinatura vence em ${daysUntilEnd} dias`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
              .alert { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 5px; }
              .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
              .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>⏰ Renovação de Assinatura</h1>
              </div>
              <div class="content">
                <p>Olá!</p>
                
                <div class="alert">
                  <strong>Sua assinatura está próxima do vencimento!</strong>
                  <p>Faltam apenas <strong>${daysUntilEnd} dias</strong> para o fim do período atual da sua assinatura.</p>
                  <p>Data de vencimento: <strong>${endDate}</strong></p>
                </div>
                
                <p>Para garantir a continuidade dos seus serviços sem interrupções:</p>
                <ul>
                  <li>Verifique se seu método de pagamento está atualizado</li>
                  <li>Certifique-se de que há saldo/limite disponível</li>
                  <li>Entre em contato conosco se tiver alguma dúvida</li>
                </ul>
                
                <center>
                  <a href="${Deno.env.get("VITE_SUPABASE_URL")}/planos" class="button">
                    Gerenciar Assinatura
                  </a>
                </center>
                
                <p>Se você deseja cancelar sua assinatura, pode fazê-lo a qualquer momento através das configurações da sua conta.</p>
                
                <div class="footer">
                  <p>Essência Dental Lab</p>
                  <p>essenciadentallab@gmail.com</p>
                </div>
              </div>
            </div>
          </body>
        </html>
      `,
    });
    
    logStep("Expiring subscription email sent", { email, daysUntilEnd });
  } catch (err) {
    const error = err as Error;
    logStep("Error sending expiring subscription email", { error: error.message });
  }
}

async function sendPaymentFailedEmail(email: string, invoice: Stripe.Invoice) {
  const amount = (invoice.amount_due / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
  
  try {
    await resend.emails.send({
      from: "Essência Dental Lab <onboarding@resend.dev>",
      to: [email],
      subject: "❌ Falha no pagamento da sua assinatura",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
              .error { background: #fee2e2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0; border-radius: 5px; }
              .button { display: inline-block; background: #ef4444; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
              .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>⚠️ Falha no Pagamento</h1>
              </div>
              <div class="content">
                <p>Olá!</p>
                
                <div class="error">
                  <strong>Não conseguimos processar o pagamento da sua assinatura.</strong>
                  <p>Valor: <strong>${amount}</strong></p>
                  <p>Fatura: <strong>${invoice.number || invoice.id}</strong></p>
                </div>
                
                <p><strong>O que fazer agora?</strong></p>
                <ol>
                  <li>Verifique se há saldo/limite disponível no cartão</li>
                  <li>Confirme se os dados do cartão estão corretos</li>
                  <li>Atualize o método de pagamento se necessário</li>
                  <li>Tente novamente através do portal de gerenciamento</li>
                </ol>
                
                <center>
                  <a href="${invoice.hosted_invoice_url}" class="button">
                    Ver Fatura e Tentar Novamente
                  </a>
                </center>
                
                <p><strong>Importante:</strong> Se o pagamento não for processado em breve, sua assinatura pode ser cancelada e você perderá acesso aos recursos premium.</p>
                
                <p>Se precisar de ajuda, entre em contato conosco em essenciadentallab@gmail.com</p>
                
                <div class="footer">
                  <p>Essência Dental Lab</p>
                  <p>essenciadentallab@gmail.com</p>
                </div>
              </div>
            </div>
          </body>
        </html>
      `,
    });
    
    logStep("Payment failed email sent", { email, amount });
  } catch (err) {
    const error = err as Error;
    logStep("Error sending payment failed email", { error: error.message });
  }
}

async function sendSubscriptionCanceledEmail(
  email: string,
  subscription: Stripe.Subscription
) {
  const endDate = new Date(subscription.current_period_end * 1000).toLocaleDateString("pt-BR");
  
  try {
    await resend.emails.send({
      from: "Essência Dental Lab <onboarding@resend.dev>",
      to: [email],
      subject: "Sua assinatura foi cancelada",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
              .info { background: #e0e7ff; border-left: 4px solid #667eea; padding: 15px; margin: 20px 0; border-radius: 5px; }
              .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
              .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Assinatura Cancelada</h1>
              </div>
              <div class="content">
                <p>Olá!</p>
                
                <p>Sua assinatura foi cancelada. Sentiremos sua falta! 😢</p>
                
                <div class="info">
                  <p><strong>Você ainda terá acesso aos recursos premium até:</strong></p>
                  <p style="font-size: 18px; font-weight: bold; color: #667eea;">${endDate}</p>
                </div>
                
                <p>Após esta data, sua conta será automaticamente rebaixada para o plano gratuito.</p>
                
                <p><strong>O que você pode fazer:</strong></p>
                <ul>
                  <li>Reativar sua assinatura a qualquer momento</li>
                  <li>Exportar seus dados antes do fim do período</li>
                  <li>Entrar em contato conosco se tiver dúvidas</li>
                </ul>
                
                <center>
                  <a href="${Deno.env.get("VITE_SUPABASE_URL")}/planos" class="button">
                    Reativar Assinatura
                  </a>
                </center>
                
                <p>Obrigado por ter usado nossos serviços! Se houver algo que possamos melhorar, por favor nos avise.</p>
                
                <div class="footer">
                  <p>Essência Dental Lab</p>
                  <p>essenciadentallab@gmail.com</p>
                </div>
              </div>
            </div>
          </body>
        </html>
      `,
    });
    
    logStep("Subscription canceled email sent", { email });
  } catch (err) {
    const error = err as Error;
    logStep("Error sending subscription canceled email", { error: error.message });
  }
}
