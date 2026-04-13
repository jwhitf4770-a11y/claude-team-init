import { supabase } from './lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { key } = req.body;

  if (!key) {
    return res.status(400).json({ valid: false, error: 'No license key provided' });
  }

  const { data: license, error } = await supabase
    .from('licenses')
    .select('*, customers(*)')
    .eq('key', key)
    .single();

  if (error || !license) {
    return res.json({ valid: false, error: 'Invalid license key' });
  }

  if (license.status === 'past_due') {
    // 7-day grace period for failed payments
    const updatedAt = new Date(license.updated_at || license.created_at);
    const graceDays = 7;
    const graceExpires = new Date(updatedAt.getTime() + graceDays * 24 * 60 * 60 * 1000);
    if (new Date() > graceExpires) {
      return res.json({ valid: false, error: 'Payment overdue — update your payment method to restore access' });
    }
    // Still in grace period — allow but warn
  } else if (license.status !== 'active') {
    return res.json({ valid: false, error: `License is ${license.status}` });
  }

  if (license.expires_at && new Date(license.expires_at) < new Date()) {
    await supabase
      .from('licenses')
      .update({ status: 'expired' })
      .eq('id', license.id);

    return res.json({ valid: false, error: 'License expired' });
  }

  await supabase
    .from('licenses')
    .update({
      last_validated_at: new Date().toISOString(),
      validation_count: (license.validation_count || 0) + 1,
    })
    .eq('id', license.id);

  res.json({
    valid: true,
    plan: license.plan,
    email: license.customers?.email,
    features: {
      agents: true,
      cache: ['pro', 'team'].includes(license.plan),
      team: license.plan === 'team',
    },
  });
}
