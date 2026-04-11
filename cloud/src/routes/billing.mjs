import { Router } from 'express';
import Stripe from 'stripe';
import { getTenantByApiKey, getTenantByStripeCustomerId, upgradeTenant } from '../store.mjs';

const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const BASE_URL = process.env.BASE_URL || 'https://claude-team-cloud.fly.dev';

const stripe = STRIPE_SECRET ? new Stripe(STRIPE_SECRET) : null;

export const router = Router();

// Price IDs — set these in Stripe Dashboard, then add to env vars
const PRICES = {
  pro: process.env.STRIPE_PRICE_PRO || '',    // $9/month
  team: process.env.STRIPE_PRICE_TEAM || '',   // $29/month
};

// Auth middleware
function auth(req, res, next) {
  const bearer = req.headers.authorization?.replace('Bearer ', '');
  if (!bearer) return res.status(401).json({ error: 'unauthorized' });
  const tenant = getTenantByApiKey(bearer);
  if (!tenant) return res.status(401).json({ error: 'invalid api key' });
  req.tenant = tenant;
  next();
}

// Get current plan
router.get('/plan', auth, (req, res) => {
  res.json({
    plan: req.tenant.plan,
    limits: req.tenant.limits,
    usage: {
      cacheKeys: req.tenant.cache.size,
      maxKeys: req.tenant.limits.maxKeys,
    },
  });
});

// Create checkout session
router.post('/checkout', auth, (req, res) => {
  if (!stripe) return res.status(503).json({ error: 'Stripe not configured' });

  const { plan } = req.body;
  if (!plan || !PRICES[plan]) {
    return res.status(400).json({ error: 'Invalid plan. Use "pro" or "team".' });
  }

  const tenant = req.tenant;

  (async () => {
    try {
      // Create or reuse Stripe customer
      let customerId = tenant.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: tenant.email,
          metadata: { tenant_id: tenant.id },
        });
        customerId = customer.id;
        tenant.stripeCustomerId = customerId;
      }

      // Create checkout session
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'subscription',
        line_items: [{ price: PRICES[plan], quantity: 1 }],
        success_url: `${BASE_URL}/dashboard?upgraded=true`,
        cancel_url: `${BASE_URL}/dashboard?cancelled=true`,
        metadata: { tenant_id: tenant.id, plan },
      });

      res.json({ url: session.url });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  })();
});

// Manage subscription (cancel/update)
router.post('/portal', auth, (req, res) => {
  if (!stripe) return res.status(503).json({ error: 'Stripe not configured' });

  const tenant = req.tenant;
  if (!tenant.stripeCustomerId) {
    return res.status(400).json({ error: 'No subscription to manage' });
  }

  (async () => {
    try {
      const session = await stripe.billingPortal.sessions.create({
        customer: tenant.stripeCustomerId,
        return_url: `${BASE_URL}/dashboard`,
      });
      res.json({ url: session.url });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  })();
});

// Stripe webhook handler (called from server.mjs with raw body)
export function webhookHandler(req, res) {
  if (!stripe || !STRIPE_WEBHOOK_SECRET) {
    return res.status(503).json({ error: 'Stripe not configured' });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      req.headers['stripe-signature'],
      STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const tenantId = session.metadata?.tenant_id;
      const plan = session.metadata?.plan;

      if (tenantId && plan) {
        const tenant = getTenantByStripeCustomerId(session.customer);
        if (tenant) {
          tenant.stripeSubscriptionId = session.subscription;
          upgradeTenant(tenant, plan);
          console.log(`Upgraded tenant ${tenant.id} to ${plan}`);
        }
      }
      break;
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object;
      const tenant = getTenantByStripeCustomerId(sub.customer);
      if (tenant) {
        if (sub.status === 'active') {
          // Check which price to determine plan
          const priceId = sub.items?.data?.[0]?.price?.id;
          if (priceId === PRICES.team) upgradeTenant(tenant, 'team');
          else if (priceId === PRICES.pro) upgradeTenant(tenant, 'pro');
        }
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object;
      const tenant = getTenantByStripeCustomerId(sub.customer);
      if (tenant) {
        upgradeTenant(tenant, 'free');
        console.log(`Downgraded tenant ${tenant.id} to free`);
      }
      break;
    }
  }

  res.json({ received: true });
}
