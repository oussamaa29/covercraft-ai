import "server-only";
import Stripe from "stripe";

const secretKey = process.env.STRIPE_SECRET_KEY;

export const stripe = new Stripe(secretKey ?? "sk_test_placeholder", {
  apiVersion: "2026-08-26.dahlia",
});

export const isStripeConfigured = Boolean(secretKey);
