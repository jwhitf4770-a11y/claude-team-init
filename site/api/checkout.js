import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const PRICES = {
  starter: process.env.STRIPE_PRICE_STARTER,
  pro: process.env.STRIPE_PRICE_PRO,
  team: process.env.STRIPE_PRICE_TEAM,
};

const ONE_TIME_PLANS = ['starter'];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { plan, email } = req.body;

  if (!plan || !PRICES[plan]) {
    return res.status(400).json({ error: 'Invalid plan' });
  }

  const isOneTime = ONE_TIME_PLANS.includes(plan);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: isOneTime ? 'payment' : 'subscription',
      customer_email: email || undefined,
      line_items: [{ price: PRICES[plan], quantity: 1 }],
      success_url: `${process.env.SITE_URL || 'https://codecrew-mu.vercel.app'}/?upgraded=${plan}`,
      cancel_url: `${process.env.SITE_URL || 'https://codecrew-mu.vercel.app'}/?cancelled=true`,
      metadata: { plan },
    });

    res.json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
