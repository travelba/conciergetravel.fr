/**
 * Le Concierge Club — bounded context public surface.
 *
 * Tier rules, perks catalogue, subscription state, and benefits
 * resolution. All pure — no I/O, no Date.now(). Skill: loyalty-program.
 */
export * from './types';
export * from './catalogue';
export * from './tier';
export * from './benefits';
