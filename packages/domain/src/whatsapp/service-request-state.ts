import { err, ok, type Result } from '../shared/result';

/**
 * WhatsApp concierge service-request lifecycle (Phase 8bis).
 *
 * A guest request (restaurant, transfert, late check-out…) is relayed to the
 * hotel / ops desk, then closed as confirmed or refused.
 *
 *   requested → relayed → confirmed
 *                      ↘ refused
 *
 * `confirmed` and `refused` are terminal.
 */
export type ServiceRequestState = 'requested' | 'relayed' | 'confirmed' | 'refused';

export type ServiceRequestError = {
  readonly kind: 'invalid_transition';
  readonly from: ServiceRequestState;
  readonly to: ServiceRequestState;
};

const TERMINAL: ReadonlySet<ServiceRequestState> = new Set(['confirmed', 'refused']);

export const isTerminalServiceRequestState = (state: ServiceRequestState): boolean =>
  TERMINAL.has(state);

export const invalidServiceRequestTransition = (
  from: ServiceRequestState,
  to: ServiceRequestState,
): ServiceRequestError => ({
  kind: 'invalid_transition',
  from,
  to,
});

/**
 * Legal transitions:
 *  - requested → relayed
 *  - relayed → confirmed | refused
 */
export const transitionServiceRequest = (
  from: ServiceRequestState,
  to: ServiceRequestState,
): Result<ServiceRequestState, ServiceRequestError> => {
  if (isTerminalServiceRequestState(from)) {
    return err(invalidServiceRequestTransition(from, to));
  }

  if (from === 'requested' && to === 'relayed') {
    return ok(to);
  }

  if (from === 'relayed' && (to === 'confirmed' || to === 'refused')) {
    return ok(to);
  }

  return err(invalidServiceRequestTransition(from, to));
};

export const canTransitionServiceRequest = (
  from: ServiceRequestState,
  to: ServiceRequestState,
): boolean => transitionServiceRequest(from, to).ok;

/** Next allowed states from a non-terminal position (for UI / ops tooling). */
export const allowedServiceRequestTransitions = (
  from: ServiceRequestState,
): readonly ServiceRequestState[] => {
  if (from === 'requested') return ['relayed'];
  if (from === 'relayed') return ['confirmed', 'refused'];
  return [];
};

/** Whether the request is still open (awaiting hotel response). */
export const isServiceRequestPending = (state: ServiceRequestState): boolean =>
  state === 'requested' || state === 'relayed';
