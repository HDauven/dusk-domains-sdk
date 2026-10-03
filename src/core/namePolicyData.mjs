export const LUX_PER_DUSK = 1_000_000_000
export const DEFAULT_FEE_CONFIG = {
  threeCharYearLux: 150 * LUX_PER_DUSK,
  fourCharYearLux: 50 * LUX_PER_DUSK,
  fivePlusYearLux: 10 * LUX_PER_DUSK,
  referralRewardBps: 2_000,
  renewalReferralRewardBps: 1_000,
  premiumReferralRewardBps: 0,
  premiumStartLux: 1_000_000 * LUX_PER_DUSK,
  version: 1,
  updatedAt: 0,
}

/** @type {readonly import('./namePolicy').ReservedNamePolicy[]} */
export const RESERVED_NAME_POLICIES = [
  reserved('dusk', 'protocol', 'Protocol root name reserved for Dusk-controlled infrastructure.'),
  reserved('rusk', 'protocol', 'Protocol implementation name reserved to prevent impersonation.'),
  reserved('wallet', 'ecosystem', 'Official wallet namespace reserved before public registration.'),
  reserved('webwallet', 'ecosystem', 'Official web wallet namespace reserved before public registration.'),
  reserved('bridge', 'ecosystem', 'Official bridge namespace reserved before public registration.'),
  reserved('explorer', 'ecosystem', 'Official explorer namespace reserved before public registration.'),
  reserved('docs', 'ecosystem', 'Official documentation namespace reserved before public registration.'),
  reserved('staking', 'ecosystem', 'Staking namespace reserved for official ecosystem use.'),
  reserved('faucet', 'ecosystem', 'Faucet namespace reserved for official ecosystem use.'),
  reserved('grants', 'ecosystem', 'Grants namespace reserved for official ecosystem use.'),
  reserved('citadel', 'ecosystem', 'Citadel namespace reserved for future official identity-related use.'),
  reserved('foundation', 'partner', 'Foundation namespace reserved to prevent false affiliation.'),
  reserved('npex', 'partner', 'Known partner/venue namespace reserved pending verification policy.'),
  reserved('trade', 'partner', 'Market infrastructure namespace reserved pending verification policy.'),
  reserved('exchange', 'exchange', 'Exchange-related namespace reserved to reduce user confusion.'),
  reserved('support', 'support', 'Support namespace reserved to reduce phishing and fake helpdesk risk.'),
  reserved('security', 'security', 'Security namespace reserved to reduce phishing and incident-response impersonation.'),
]

export const RESERVED_LABELS = new Set(RESERVED_NAME_POLICIES.map((policy) => policy.label))

export const RESERVED_REASONS = Object.fromEntries(RESERVED_NAME_POLICIES.map(({ label, reason }) => [label, reason]))

export function getReservedNamePolicy(label) {
  return RESERVED_NAME_POLICIES.find((policy) => policy.label === label)
}

function reserved(label, category, reason) {
  return { label, category, reason }
}
