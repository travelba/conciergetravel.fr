/**
 * Little Emperors — private members club. No public B2B API (2026-06);
 * the connector degrades to a concierge/email handover.
 */
export const LITTLE_EMPERORS_INTEGRATION_VERSION = '0.1.0' as const;

export {
  createLittleEmperorsConnector,
  LITTLE_EMPERORS_FULFILMENT,
  type LittleEmperorsFulfilment,
} from './connector';
