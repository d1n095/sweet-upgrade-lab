import { describe, it, expect } from 'vitest';
import { getOrderDisplayId, getOrderRef } from '@/utils/orderDisplay';

describe('getOrderDisplayId', () => {
  it('uses the last 8 chars of payment_intent_id when present', () => {
    const result = getOrderDisplayId({ payment_intent_id: 'pi_abcdefghijklmnop' });
    expect(result).toBe('#IJKLMNOP');
  });

  it('uppercases the payment_intent_id suffix', () => {
    const result = getOrderDisplayId({ payment_intent_id: 'pi_1234abcd' });
    expect(result).toBe('#1234ABCD');
  });

  it('falls back to stripe_session_id last 8 chars when payment_intent_id is absent', () => {
    const result = getOrderDisplayId({ stripe_session_id: 'cs_test_xyzabcde' });
    expect(result).toBe('#XYZABCDE');
  });

  it('falls back to stripe_session_id when payment_intent_id is null', () => {
    const result = getOrderDisplayId({
      payment_intent_id: null,
      stripe_session_id: 'cs_test_12345678',
    });
    expect(result).toBe('#12345678');
  });

  it('uses first 8 chars of id when both stripe fields are absent', () => {
    const result = getOrderDisplayId({ id: 'abcdefgh-1234-uuid' });
    expect(result).toBe('#ABCDEFGH');
  });

  it('returns #— when all fields are absent', () => {
    const result = getOrderDisplayId({});
    expect(result).toBe('#—');
  });

  it('returns #— when all fields are null/undefined', () => {
    const result = getOrderDisplayId({
      payment_intent_id: null,
      stripe_session_id: null,
      id: undefined,
    });
    expect(result).toBe('#—');
  });

  it('prefers payment_intent_id over stripe_session_id', () => {
    const result = getOrderDisplayId({
      payment_intent_id: 'pi_aaaaaaaa',
      stripe_session_id: 'cs_bbbbbbbb',
    });
    expect(result).toBe('#AAAAAAAA');
  });

  it('prefers stripe_session_id over id', () => {
    const result = getOrderDisplayId({
      payment_intent_id: null,
      stripe_session_id: 'cs_cccccccc',
      id: 'ddddddddd',
    });
    expect(result).toBe('#CCCCCCCC');
  });

  it('handles a payment_intent_id shorter than 8 chars', () => {
    const result = getOrderDisplayId({ payment_intent_id: 'pi_ab' });
    expect(result).toBe('#PI_AB');
  });
});

describe('getOrderRef', () => {
  it('uses payment intent id last 8 chars', () => {
    expect(getOrderRef('pi_abcdefghijklmnop')).toBe('#IJKLMNOP');
  });

  it('falls back to stripe session id', () => {
    expect(getOrderRef(null, 'cs_test_12345678')).toBe('#12345678');
  });

  it('falls back to id', () => {
    expect(getOrderRef(null, null, 'abcdefgh-rest')).toBe('#ABCDEFGH');
  });

  it('returns #— with no arguments', () => {
    expect(getOrderRef()).toBe('#—');
  });

  it('returns #— when all args are null/undefined', () => {
    expect(getOrderRef(null, null, undefined)).toBe('#—');
  });

  it('prefers payment_intent over session and id', () => {
    expect(getOrderRef('pi_11111111', 'cs_22222222', '33333333')).toBe('#11111111');
  });
});
