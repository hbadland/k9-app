import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { stripe } from '../config/stripe';
import { PRODUCTS, ProductKey } from '../config/products';
import { requireAuth, AuthRequest } from '../middleware/auth';
import * as WalletModel from '../models/wallet';
import * as UserModel from '../models/user';
import { pool } from '../config/db';
import { sendEmail } from '../utils/email';
import {
  paymentReceiptEmail,
  subscriptionRenewalEmail,
  paymentFailedEmail,
  subscriptionCancelledEmail,
} from '../utils/emailTemplates';

const router = Router();

// ── Wallet balance + history ───────────────────────────────────────────────

router.get('/wallet', requireAuth, async (req: AuthRequest, res: Response) => {
  const wallet = await WalletModel.getWalletWithTransactions(req.user!.userId);
  res.json(wallet);
});

// ── Create Stripe Checkout session ────────────────────────────────────────

const checkoutSchema = z.object({
  product: z.enum(['single', 'bundle5', 'bundle10', 'subscription']),
});

router.post('/checkout', requireAuth, async (req: AuthRequest, res: Response) => {
  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const product = PRODUCTS[parsed.data.product];
  const user = await UserModel.findById(req.user!.userId);
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }

  let customerId = user.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: [user.first_name, user.last_name].filter(Boolean).join(' ') || undefined,
      metadata: { userId: user.id },
    });
    customerId = customer.id;
    await pool.query('UPDATE users SET stripe_customer_id = $1 WHERE id = $2', [customerId, user.id]);
  }

  const scheme = process.env.APP_SCHEME ?? 'k9app';

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: product.mode,
    line_items: [{
      quantity: 1,
      price_data: product.mode === 'subscription'
        ? { currency: 'gbp', product_data: { name: product.label }, unit_amount: product.pricePence, recurring: { interval: 'month' } }
        : { currency: 'gbp', product_data: { name: product.label }, unit_amount: product.pricePence },
    }],
    success_url: `${scheme}://payment-success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:  `${scheme}://payment-cancelled`,
    metadata: {
      userId:  user.id,
      product: product.key,
      credits: String(product.credits),
    },
  });

  res.json({ url: session.url, sessionId: session.id });
});

// ── Stripe billing portal ─────────────────────────────────────────────────

router.post('/portal', requireAuth, async (req: AuthRequest, res: Response) => {
  const user = await UserModel.findById(req.user!.userId);
  if (!user?.stripe_customer_id) {
    res.status(400).json({ error: 'No billing account found. Purchase a plan first.' });
    return;
  }
  const scheme = process.env.APP_SCHEME ?? 'k9app';
  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripe_customer_id,
    return_url: `${scheme}://profile`,
  });
  res.json({ url: session.url });
});

export default router;

// ── Stripe webhook ────────────────────────────────────────────────────────

export async function webhookHandler(req: Request, res: Response): Promise<void> {
  const sig = req.headers['stripe-signature'];
  if (!sig) { res.status(400).send('Missing stripe-signature'); return; }

  let event: import('stripe').Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    res.status(400).send(`Webhook error: ${err.message}`);
    return;
  }

  try {
    // ── One-time purchase or initial subscription payment ──────────────────
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as import('stripe').Stripe.Checkout.Session;
      const { userId, product, credits } = session.metadata ?? {};
      if (userId && credits) {
        const creditAmount = parseInt(credits);
        const productLabel = PRODUCTS[product as ProductKey]?.label ?? 'Purchase';
        const type = product === 'subscription' ? 'subscription' : 'topup';
        const stripeRef = (session.payment_intent ?? session.subscription) as string | undefined;
        await WalletModel.creditWallet(
          userId, creditAmount, type,
          `${productLabel} — ${creditAmount} credit${creditAmount !== 1 ? 's' : ''} added`,
          stripeRef
        );

        const user = await UserModel.findById(userId);
        if (user) {
          sendEmail({
            to: user.email,
            subject: 'Payment confirmed — Battersea K9',
            html: paymentReceiptEmail({
              firstName: user.first_name,
              productLabel,
              credits: creditAmount,
              amountPence: PRODUCTS[product as ProductKey]?.pricePence ?? 0,
            }),
          });
        }
      }
    }

    // ── Subscription payment failed ────────────────────────────────────────
    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object as import('stripe').Stripe.Invoice;
      console.error('[Stripe] Payment failed for customer:', invoice.customer);
      const { rows } = await pool.query(
        'SELECT id, email, first_name FROM users WHERE stripe_customer_id = $1',
        [invoice.customer]
      );
      if (rows[0]) {
        sendEmail({
          to: rows[0].email,
          subject: 'Payment failed — Battersea K9',
          html: paymentFailedEmail({ firstName: rows[0].first_name }),
        });
      }
    }

    // ── Subscription renewal (month 2+) ────────────────────────────────────
    if (event.type === 'invoice.payment_succeeded') {
      const invoice = event.data.object as import('stripe').Stripe.Invoice;
      if (invoice.billing_reason === 'subscription_cycle') {
        const { rows } = await pool.query(
          'SELECT id, email, first_name FROM users WHERE stripe_customer_id = $1',
          [invoice.customer]
        );
        if (rows[0]) {
          await WalletModel.creditWallet(
            rows[0].id, 5, 'subscription',
            'Monthly Plan renewal — 5 credits added'
          );
          sendEmail({
            to: rows[0].email,
            subject: 'Monthly credits added — Battersea K9',
            html: subscriptionRenewalEmail({ firstName: rows[0].first_name, credits: 5 }),
          });
        }
      }
    }

    // ── Subscription cancelled ─────────────────────────────────────────────
    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as import('stripe').Stripe.Subscription;
      const { rows } = await pool.query(
        'SELECT id, email, first_name FROM users WHERE stripe_customer_id = $1',
        [subscription.customer]
      );
      if (rows[0]) {
        sendEmail({
          to: rows[0].email,
          subject: 'Subscription cancelled — Battersea K9',
          html: subscriptionCancelledEmail({ firstName: rows[0].first_name }),
        });
      }
    }
  } catch (err) {
    console.error('Webhook handler error:', err);
  }

  res.json({ received: true });
}
