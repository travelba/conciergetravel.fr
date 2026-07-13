import { describe, expect, it } from 'vitest';

import {
  allowedServiceRequestTransitions,
  canTransitionServiceRequest,
  isServiceRequestPending,
  isTerminalServiceRequestState,
  transitionServiceRequest,
} from './service-request-state';

describe('whatsapp service-request state machine', () => {
  it('advances requested → relayed → confirmed', () => {
    expect(canTransitionServiceRequest('requested', 'relayed')).toBe(true);
    expect(canTransitionServiceRequest('relayed', 'confirmed')).toBe(true);
  });

  it('advances relayed → refused', () => {
    expect(canTransitionServiceRequest('relayed', 'refused')).toBe(true);
  });

  it('forbids skipping relayed', () => {
    expect(canTransitionServiceRequest('requested', 'confirmed')).toBe(false);
    expect(canTransitionServiceRequest('requested', 'refused')).toBe(false);
  });

  it('forbids rewinding', () => {
    expect(canTransitionServiceRequest('relayed', 'requested')).toBe(false);
    expect(canTransitionServiceRequest('confirmed', 'relayed')).toBe(false);
  });

  it('refuses transitions out of terminal states', () => {
    expect(canTransitionServiceRequest('confirmed', 'refused')).toBe(false);
    expect(canTransitionServiceRequest('refused', 'requested')).toBe(false);
    const r = transitionServiceRequest('confirmed', 'relayed');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe('invalid_transition');
  });

  it('isTerminalServiceRequestState identifies confirmed and refused', () => {
    expect(isTerminalServiceRequestState('confirmed')).toBe(true);
    expect(isTerminalServiceRequestState('refused')).toBe(true);
    expect(isTerminalServiceRequestState('requested')).toBe(false);
  });

  it('allowedServiceRequestTransitions lists next hops', () => {
    expect(allowedServiceRequestTransitions('requested')).toEqual(['relayed']);
    expect(allowedServiceRequestTransitions('relayed')).toEqual(['confirmed', 'refused']);
    expect(allowedServiceRequestTransitions('confirmed')).toEqual([]);
  });

  it('isServiceRequestPending is true until terminal', () => {
    expect(isServiceRequestPending('requested')).toBe(true);
    expect(isServiceRequestPending('relayed')).toBe(true);
    expect(isServiceRequestPending('confirmed')).toBe(false);
    expect(isServiceRequestPending('refused')).toBe(false);
  });
});
