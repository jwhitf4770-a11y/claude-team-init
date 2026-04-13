import { test, expect } from '@playwright/test';

// ─── Homepage ────────────────────────────────────────────────────────

test.describe('Homepage', () => {
  test('loads with correct branding and hero', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('nav .nav-brand')).toContainText('vibe-crew');
    await expect(page.locator('.hero h1')).toBeVisible();
    await page.screenshot({ path: 'e2e-results/01-homepage.png', fullPage: true });
  });

  test('install bar shows npx vibe-crew', async ({ page }) => {
    await page.goto('/');
    const installCode = page.locator('.install code').first();
    await expect(installCode).toContainText('npx vibe-crew');
    await page.screenshot({ path: 'e2e-results/02-install-bar.png' });
  });

  test('copy button works', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/');
    const copyBtn = page.locator('.install button').first();
    await copyBtn.click();
    await expect(copyBtn).toContainText('Copied!');
    await page.screenshot({ path: 'e2e-results/03-copy-clicked.png' });
  });
});

// ─── Navigation ──────────────────────────────────────────────────────

test.describe('Navigation', () => {
  test('nav links exist and scroll to sections', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('nav a[href="#guide"]')).toBeVisible();
    await expect(page.locator('nav a[href="#how"]')).toBeVisible();
    await expect(page.locator('nav a[href="#pricing"]')).toBeVisible();
    await expect(page.locator('nav a[href="#faq"]')).toBeVisible();

    await page.locator('nav a[href="#guide"]').click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'e2e-results/04-nav-guide.png' });

    await page.locator('nav a[href="#faq"]').click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'e2e-results/05-nav-faq.png' });
  });
});

// ─── Getting Started Guide ───────────────────────────────────────────

test.describe('Getting Started Guide', () => {
  test('all guide steps are visible', async ({ page }) => {
    await page.goto('/#guide');
    await page.waitForTimeout(300);

    const steps = page.locator('.guide-step');
    const count = await steps.count();
    expect(count).toBeGreaterThanOrEqual(6);

    await page.screenshot({ path: 'e2e-results/06-guide-top.png' });

    // Scroll to bottom of guide
    await steps.last().scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'e2e-results/07-guide-bottom.png' });
  });

  test('prerequisites section lists all requirements', async ({ page }) => {
    await page.goto('/#guide');
    await page.waitForTimeout(300);

    const prereqs = page.locator('.prereq');
    const count = await prereqs.count();
    expect(count).toBe(4);

    await expect(prereqs.nth(0)).toContainText('Node.js');
    await expect(prereqs.nth(1)).toContainText('Claude Code');
    await expect(prereqs.nth(2)).toContainText('codebase');
    await expect(prereqs.nth(3)).toContainText('Anthropic API');
    await page.screenshot({ path: 'e2e-results/08-prerequisites.png' });
  });

  test('code blocks contain correct commands', async ({ page }) => {
    await page.goto('/#guide');

    // Check for key activation command
    const codeBlocks = page.locator('.guide-step .code-block');
    const allText = await codeBlocks.allTextContents();
    const hasKeyCommand = allText.some(t => t.includes('npx vibe-crew --key'));
    expect(hasKeyCommand).toBe(true);

    // Check for slash commands
    const hasVibeAudit = allText.some(t => t.includes('/vibe-audit'));
    expect(hasVibeAudit).toBe(true);
  });
});

// ─── Terminal Demo ───────────────────────────────────────────────────

test.describe('Terminal Demo', () => {
  test('terminal shows vibe-crew command and agents', async ({ page }) => {
    await page.goto('/');
    const terminal = page.locator('.terminal-body').first();
    await terminal.scrollIntoViewIfNeeded();

    await expect(terminal).toContainText('npx vibe-crew');
    await expect(terminal).toContainText('vibe-audit');
    await expect(terminal).toContainText('build-gate');
    await expect(terminal).toContainText('orchestrator');
    await page.screenshot({ path: 'e2e-results/09-terminal-demo.png' });
  });
});

// ─── Pricing ─────────────────────────────────────────────────────────

test.describe('Pricing', () => {
  test('three pricing tiers are visible', async ({ page }) => {
    await page.goto('/#pricing');
    await page.waitForTimeout(300);

    const cards = page.locator('.price-card');
    expect(await cards.count()).toBe(3);

    await expect(cards.nth(0)).toContainText('Starter');
    await expect(cards.nth(0)).toContainText('$29');
    await expect(cards.nth(1)).toContainText('Pro');
    await expect(cards.nth(1)).toContainText('$9');
    await expect(cards.nth(2)).toContainText('Team');
    await expect(cards.nth(2)).toContainText('$29');

    await page.screenshot({ path: 'e2e-results/10-pricing.png' });
  });

  test('promo code input exists', async ({ page }) => {
    await page.goto('/#pricing');
    await page.waitForTimeout(300);

    const promoInput = page.locator('#promoCode');
    await expect(promoInput).toBeVisible();
    await promoInput.fill('BIGSKY');
    await page.screenshot({ path: 'e2e-results/11-promo-code.png' });
  });
});

// ─── Stripe Checkout ─────────────────────────────────────────────────

test.describe('Stripe Checkout', () => {
  test('starter checkout redirects to Stripe', async ({ page }) => {
    await page.goto('/#pricing');
    await page.waitForTimeout(300);

    const starterBtn = page.locator('.price-btn').first();
    await expect(starterBtn).toContainText('vibe-crew');

    // Click and wait for navigation to Stripe
    await starterBtn.click();
    await page.waitForURL(/checkout\.stripe\.com/, { timeout: 15_000 });
    expect(page.url()).toContain('checkout.stripe.com');
    await page.screenshot({ path: 'e2e-results/12-stripe-checkout.png' });
  });

  test('checkout with promo code BIGSKY works', async ({ page }) => {
    await page.goto('/#pricing');
    await page.waitForTimeout(300);

    await page.locator('#promoCode').fill('BIGSKY');

    const starterBtn = page.locator('.price-btn').first();
    await starterBtn.click();
    await page.waitForURL(/checkout\.stripe\.com/, { timeout: 15_000 });
    expect(page.url()).toContain('checkout.stripe.com');
    await page.screenshot({ path: 'e2e-results/13-stripe-promo.png' });
  });

  test('invalid promo code returns error', async ({ page }) => {
    await page.goto('/#pricing');
    await page.waitForTimeout(300);

    await page.locator('#promoCode').fill('FAKECODE');

    // Listen for the alert dialog
    page.on('dialog', async dialog => {
      expect(dialog.message()).toContain('Invalid promo code');
      await dialog.accept();
    });

    const starterBtn = page.locator('.price-btn').first();
    await starterBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'e2e-results/14-checkout-invalid-promo.png' });
  });
});

// ─── License Validation API ──────────────────────────────────────────

test.describe('License Validation API', () => {
  test('rejects invalid key', async ({ request }) => {
    const res = await request.post('/api/validate', {
      data: { key: 'FAKE-KEY0-0000-0000' },
    });
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.valid).toBe(false);
    expect(json.error).toBe('Invalid license key');
  });

  test('rejects empty key', async ({ request }) => {
    const res = await request.post('/api/validate', {
      data: {},
    });
    expect(res.status()).toBe(400);
    const json = await res.json();
    expect(json.valid).toBe(false);
  });

  test('rejects wrong HTTP method', async ({ request }) => {
    const res = await request.get('/api/validate');
    expect(res.status()).toBe(405);
  });
});

// ─── FAQ Section ─────────────────────────────────────────────────────

test.describe('FAQ Section', () => {
  test('FAQ accordion opens and closes', async ({ page }) => {
    await page.goto('/#faq');
    await page.waitForTimeout(300);

    const faqItems = page.locator('.faq-item');
    const count = await faqItems.count();
    expect(count).toBeGreaterThanOrEqual(10);

    await page.screenshot({ path: 'e2e-results/15-faq-closed.png' });

    // Open first FAQ
    await faqItems.nth(0).locator('.faq-q').click();
    await expect(faqItems.nth(0)).toHaveClass(/open/);
    await expect(faqItems.nth(0).locator('.faq-a')).toBeVisible();
    await page.screenshot({ path: 'e2e-results/16-faq-open-first.png' });

    // Open second FAQ (first stays open)
    await faqItems.nth(1).locator('.faq-q').click();
    await expect(faqItems.nth(1)).toHaveClass(/open/);
    await page.screenshot({ path: 'e2e-results/17-faq-open-two.png' });

    // Close first FAQ
    await faqItems.nth(0).locator('.faq-q').click();
    await expect(faqItems.nth(0)).not.toHaveClass(/open/);
    await page.screenshot({ path: 'e2e-results/18-faq-closed-first.png' });
  });

  test('FAQ contains key topics', async ({ page }) => {
    await page.goto('/#faq');
    await page.waitForTimeout(300);

    const faqText = await page.locator('.faq-list').textContent();
    expect(faqText).toContain('vibe-crew generate');
    expect(faqText).toContain('modify my source code');
    expect(faqText).toContain('license email');
    expect(faqText).toContain('multiple projects');
    expect(faqText).toContain('Starter and Pro');
    expect(faqText).toContain('/vibe-audit');
    expect(faqText).toContain('offline');
  });
});

// ─── Comparison Section ──────────────────────────────────────────────

test.describe('Comparison Section', () => {
  test('linter vs vibe-audit comparison renders', async ({ page }) => {
    await page.goto('/');

    const bad = page.locator('.compare-card.bad');
    const good = page.locator('.compare-card.good');

    await bad.scrollIntoViewIfNeeded();
    await expect(bad).toContainText('linters find');
    await expect(good).toContainText('/vibe-audit');
    await page.screenshot({ path: 'e2e-results/19-comparison.png' });
  });
});

// ─── Mobile Responsive ──────────────────────────────────────────────

test.describe('Mobile Responsive', () => {
  test('site renders on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await expect(page.locator('.hero h1')).toBeVisible();
    await page.screenshot({ path: 'e2e-results/20-mobile-hero.png', fullPage: false });

    // Scroll to pricing
    await page.goto('/#pricing');
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'e2e-results/21-mobile-pricing.png' });

    // Scroll to FAQ
    await page.goto('/#faq');
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'e2e-results/22-mobile-faq.png' });
  });
});

// ─── Footer ──────────────────────────────────────────────────────────

test.describe('Footer', () => {
  test('footer links present', async ({ page }) => {
    await page.goto('/');
    const footer = page.locator('footer');
    await footer.scrollIntoViewIfNeeded();

    await expect(footer.locator('a[href="#guide"]')).toBeVisible();
    await expect(footer.locator('a[href="#faq"]')).toBeVisible();
    await page.screenshot({ path: 'e2e-results/23-footer.png' });
  });
});
