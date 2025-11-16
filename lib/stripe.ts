import Stripe from 'stripe';

const secretKey = process.env.STRIPE_SECRET_KEY;

if (!secretKey) {
  throw new Error(
    '[stripe] STRIPE_SECRET_KEY is not set. Add it to your .env.local file.'
  );
}

export const stripe = new Stripe(secretKey, {
  apiVersion: '2024-06-20',
});
