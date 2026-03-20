/**
 * Derive a short, human-friendly order reference from the Stripe payment_intent ID.
 * Falls back to the first 8 chars of the DB id if payment_intent is missing.
 */
export function getOrderDisplayId(order: {
  payment_intent_id?: string | null;
  stripe_session_id?: string | null;
  id?: string;
}): string {
  if (order.payment_intent_id) {
    return '#' + order.payment_intent_id.slice(-8).toUpperCase();
  }
  if (order.stripe_session_id) {
    return '#' + order.stripe_session_id.slice(-8).toUpperCase();
  }
  if (order.id) {
    return '#' + order.id.slice(0, 8).toUpperCase();
  }
  return '#—';
}

/**
 * Same logic for edge functions (no import restrictions).
 */
export function getOrderRef(paymentIntentId?: string | null, stripeSessionId?: string | null, id?: string): string {
  if (paymentIntentId) return '#' + paymentIntentId.slice(-8).toUpperCase();
  if (stripeSessionId) return '#' + stripeSessionId.slice(-8).toUpperCase();
  if (id) return '#' + id.slice(0, 8).toUpperCase();
  return '#—';
}
