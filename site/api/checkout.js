import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required env var: STRIPE_SECRET_KEY');
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const PRICES = {
  starter: process.env.STRIPE_PRICE_STARTER,
  pro: process.env.STRIPE_PRICE_PRO,
  team: process.env.STRIPE_PRICE_TEAM,
};

const ONE_TIME_PLANS = ['starter'];

// Promo code → coupon mapping
const PROMO_CODES = {
  BIGSKY: {
    starter: 'BIGSKY',     // 100% off one-time
    pro: 'BIGSKY3MO',      // 3 months free
    team: 'BIGSKY3MO',     // 3 months free
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { plan, email, code } = req.body;

  if (!plan || !PRICES[plan]) {
    return res.status(400).json({ error: 'Invalid plan' });
  }

  const isOneTime = ONE_TIME_PLANS.includes(plan);

  const sessionParams = {
    mode: isOneTime ? 'payment' : 'subscription',
    customer_email: email || undefined,
    line_items: [{ price: PRICES[plan], quantity: 1 }],
    success_url: `${process.env.SITE_URL || 'https://codecrew-mu.vercel.app'}/?upgraded=${plan}`,
    cancel_url: `${process.env.SITE_URL || 'https://codecrew-mu.vercel.app'}/?cancelled=true`,
    metadata: { plan },
  };

  // Apply promo code if provided
  const upperCode = (code || '').toUpperCase().trim();
  if (upperCode && PROMO_CODES[upperCode]) {
    const couponId = PROMO_CODES[upperCode][plan];
    if (couponId) {
      sessionParams.discounts = [{ coupon: couponId }];
    }
  } else if (upperCode) {
    return res.status(400).json({ error: 'Invalid promo code' });
  }

  try {
    const session = await stripe.checkout.sessions.create(sessionParams);
    res.json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
