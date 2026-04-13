import Stripe from 'stripe';
import { Resend } from 'resend';
import { randomUUID } from 'crypto';
import { supabase } from './lib/supabase.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);

export const config = {
  api: { bodyParser: false },
};

async function buffer(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

function generateLicenseKey() {
  const parts = [];
  for (let i = 0; i < 4; i++) {
    parts.push(randomUUID().slice(0, 4).toUpperCase());
  }
  return parts.join('-');
}

async function getOrCreateCustomer(email, stripeCustomerId) {
  const { data: existing } = await supabase
    .from('customers')
    .select('*')
    .eq('email', email)
    .single();

  if (existing) {
    if (stripeCustomerId && !existing.stripe_customer_id) {
      await supabase
        .from('customers')
        .update({ stripe_customer_id: stripeCustomerId })
        .eq('id', existing.id);
    }
    return existing;
  }

  const { data: customer, error } = await supabase
    .from('customers')
    .insert({
      email,
      stripe_customer_id: stripeCustomerId,
    })
    .select()
    .single();

  if (error) throw error;
  return customer;
}

async function createLicense(customerId, plan, stripeSubscriptionId) {
  const isOneTime = plan === 'starter';

  const license = {
    key: generateLicenseKey(),
    customer_id: customerId,
    plan,
    status: 'active',
    stripe_subscription_id: stripeSubscriptionId || null,
    expires_at: isOneTime ? null : null, // subscriptions managed by Stripe events
  };

  const { data, error } = await supabase
    .from('licenses')
    .insert(license)
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function sendLicenseEmail(email, licenseKey, plan) {
  const planName = plan.charAt(0).toUpperCase() + plan.slice(1);
  const cacheNote = plan === 'starter'
    ? 'Your Starter plan includes agent generation. Upgrade to Pro for the shared Fly.io cache that saves $15+/day in tokens.'
    : 'Your plan includes the shared Fly.io cache — make sure to install flyctl (brew install flyctl) before running setup.';

  await resend.emails.send({
    from: 'CodeCrew <noreply@picvaultpro.com>',
    to: email,
    subject: `Your CodeCrew license key — ${planName} plan`,
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
        <h1 style="color: #0ea5e9; font-size: 28px; margin-bottom: 8px;">CodeCrew</h1>
        <p style="color: #64748b; margin-top: 0;">Senior engineering team for your AI-generated code</p>

        <div style="background: #0f172a; border-radius: 12px; padding: 24px; margin: 24px 0;">
          <p style="color: #94a3b8; margin: 0 0 8px 0; font-size: 14px;">Your license key:</p>
          <p style="color: #22d3ee; font-family: monospace; font-size: 24px; margin: 0; letter-spacing: 2px;">${licenseKey}</p>
        </div>

        <h2 style="font-size: 18px; color: #f1f5f9;">Get started in 30 seconds:</h2>

        <div style="background: #1e293b; border-radius: 8px; padding: 16px; font-family: monospace; font-size: 14px; color: #e2e8f0;">
          <p style="margin: 0 0 8px 0;"><span style="color: #94a3b8;">$</span> npx vibe-crew --key ${licenseKey}</p>
        </div>

        <p style="color: #94a3b8; font-size: 14px; margin-top: 16px;">
          That's it. Run this inside any project directory. It scans your code, generates agents, and sets up everything automatically.
        </p>

        <p style="color: #94a3b8; font-size: 14px;">${cacheNote}</p>

        <h2 style="font-size: 18px; color: #f1f5f9;">After setup, inside Claude Code:</h2>
        <div style="background: #1e293b; border-radius: 8px; padding: 16px; font-family: monospace; font-size: 14px; color: #e2e8f0;">
          <p style="margin: 0 0 4px 0;"><span style="color: #22d3ee;">/vibe-audit</span>  — finds + fixes code issues to 95%</p>
          <p style="margin: 0 0 4px 0;"><span style="color: #22d3ee;">/vibe-launch</span> — 3 solutions, picks the best</p>
          <p style="margin: 0;"><span style="color: #22d3ee;">/vibe-crew</span>  — show all commands</p>
        </div>

        <p style="color: #475569; font-size: 12px; margin-top: 32px; border-top: 1px solid #1e293b; padding-top: 16px;">
          Plan: ${planName} · Questions? Reply to this email.
        </p>
      </div>
    `,
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const buf = await buffer(req);
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const email = session.customer_email || session.customer_details?.email;
      const plan = session.metadata?.plan || 'starter';
      const stripeCustomerId = session.customer;
      const stripeSubscriptionId = session.subscription;

      if (!email) break;

      const customer = await getOrCreateCustomer(email, stripeCustomerId);
      const license = await createLicense(customer.id, plan, stripeSubscriptionId);

      // Store license key in Stripe customer metadata for receipt email
      if (stripeCustomerId) {
        await stripe.customers.update(stripeCustomerId, {
          metadata: { license_key: license.key, plan },
        });
      }

      await sendLicenseEmail(email, license.key, plan);
      console.log(`License created and emailed: ${license.key} for ${email} (${plan})`);
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object;

      const { data: licenses } = await supabase
        .from('licenses')
        .select('*')
        .eq('stripe_subscription_id', subscription.id);

      if (licenses?.length) {
        await supabase
          .from('licenses')
          .update({ status: 'cancelled' })
          .eq('stripe_subscription_id', subscription.id);

        console.log(`Licenses cancelled for subscription ${subscription.id}`);
      }
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object;

      if (invoice.subscription) {
        await supabase
          .from('licenses')
          .update({ status: 'past_due' })
          .eq('stripe_subscription_id', invoice.subscription);

        console.log(`License past_due for subscription ${invoice.subscription}`);
      }
      break;
    }

    case 'invoice.paid': {
      const invoice = event.data.object;

      if (invoice.subscription) {
        await supabase
          .from('licenses')
          .update({ status: 'active' })
          .eq('stripe_subscription_id', invoice.subscription);
      }
      break;
    }
  }

  res.json({ received: true });
}
