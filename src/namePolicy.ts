export type NameStatus = 'available' | 'registered' | 'reserved' | 'invalid'

export type SearchIssue = {
  tone: 'danger' | 'warning' | 'info'
  text: string
}

export type NameResult = {
  canonical: string
  canonicalRaw: string
  displayName: string
  label: string
  status: NameStatus
  price: number
  issues: SearchIssue[]
  transactionBlocked: boolean
  reserved?: ReservedNamePolicy
}

export type CoreFeeConfig = {
  threeCharYearLux: number
  fourCharYearLux: number
  fivePlusYearLux: number
  referralRewardBps: number
  renewalReferralRewardBps: number
  premiumReferralRewardBps: number
  version: number
  updatedAt: number
}

const LUX_PER_DUSK = 1_000_000_000
export const DEFAULT_FEE_CONFIG: CoreFeeConfig = {
  threeCharYearLux: 150 * LUX_PER_DUSK,
  fourCharYearLux: 50 * LUX_PER_DUSK,
  fivePlusYearLux: 10 * LUX_PER_DUSK,
  referralRewardBps: 2_000,
  renewalReferralRewardBps: 1_000,
  premiumReferralRewardBps: 0,
  version: 1,
  updatedAt: 0,
}

export type ReservedNameCategory =
  | 'protocol'
  | 'support'
  | 'security'
  | 'ecosystem'
  | 'exchange'
  | 'partner'
  | 'phishing'

export type ReservedNamePolicy = {
  label: string
  category: ReservedNameCategory
  reason: string
}

export type OfficialRecordPlan = {
  key: string
  status: 'configured' | 'withheld'
  value?: string
  reason?: string
}

export type OfficialNameProfile = {
  label: string
  name: `${string}.dusk`
  category: Extract<ReservedNameCategory, 'ecosystem' | 'support' | 'security' | 'protocol'>
  saleLocked: true
  records: OfficialRecordPlan[]
}

export type NormalizedName = {
  canonical: string
  labels: string[]
  registrableLabel: string
}

export type NameValidationResult =
  | {
      ok: true
      name: NormalizedName
      issues: SearchIssue[]
    }
  | {
      ok: false
      canonical: string
      labels: string[]
      issues: SearchIssue[]
    }

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
] as const satisfies readonly ReservedNamePolicy[]

export const RESERVED_LABELS = new Set(RESERVED_NAME_POLICIES.map((policy) => policy.label))

export const OFFICIAL_NAME_PROFILES = [
  official('bridge', 'ecosystem', [
    withheld('dusk_contract', 'Bridge contract ID must be assigned by the official Dusk operator before launch.'),
    withheld('website', 'Official bridge URL must be confirmed before launch.'),
  ]),
  official('wallet', 'ecosystem', [
    withheld('website', 'Official wallet URL must be confirmed before launch.'),
    withheld('content_pointer', 'Wallet release metadata must be assigned by the official Dusk operator.'),
  ]),
  official('explorer', 'ecosystem', [
    withheld('website', 'Official explorer URL must be confirmed before launch.'),
  ]),
  official('docs', 'ecosystem', [
    configured('website', 'https://docs.dusk.network'),
  ]),
  official('grants', 'ecosystem', [
    withheld('website', 'Official grants URL must be confirmed before launch.'),
  ]),
  official('staking', 'ecosystem', [
    withheld('website', 'Official staking URL must be confirmed before launch.'),
    withheld('dusk_contract', 'Canonical staking contract/module ID must be assigned by the official Dusk operator.'),
  ]),
  official('faucet', 'ecosystem', [
    withheld('website', 'Official faucet URL must be confirmed before launch.'),
  ]),
  official('support', 'support', [
    withheld('website', 'Official support URL must be confirmed before launch.'),
    withheld('service_endpoint.support', 'Support endpoint must be assigned by the official Dusk operator.'),
  ]),
] as const satisfies readonly OfficialNameProfile[]

export const OFFICIAL_NAMES = OFFICIAL_NAME_PROFILES.map((profile) => profile.name)

const registeredNames = new Set(['acme.dusk', 'npex.dusk', 'duskwallet.dusk'])
const asciiNamePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9]+(?:-[a-z0-9]+)*)*\.dusk$/

export function normalizeNameInput(value: string) {
  const trimmed = value.trim().toLowerCase()
  if (!trimmed) return ''
  return trimmed.endsWith('.dusk') ? trimmed : `${trimmed}.dusk`
}

export function apexLabel(canonical: string) {
  return canonical.replace(/\.dusk$/, '').split('.').at(-1) ?? ''
}

export function validateName(value: string): NameValidationResult {
  const canonical = normalizeNameInput(value)
  const labels = canonical ? canonical.split('.') : []
  const registrableLabel = apexLabel(canonical)
  const issues: SearchIssue[] = []

  if (!canonical) {
    issues.push({ tone: 'info', text: 'Enter a name to check availability.' })
  } else if (!asciiNamePattern.test(canonical)) {
    issues.push({
      tone: 'danger',
      text: 'Use lowercase letters, numbers, or interior hyphens.',
    })
  }

  if (canonical.length > 63) {
    issues.push({ tone: 'danger', text: 'Names must be 63 characters or shorter.' })
  }

  const nameLabels = labels.filter((label) => label !== 'dusk')

  if (nameLabels.some((label) => label.length > 0 && label.length < 3)) {
    issues.push({ tone: 'danger', text: 'Labels shorter than 3 characters are reserved.' })
  }

  const officialLookalike = OFFICIAL_NAMES.find((name) => {
    const official = apexLabel(name)
    return registrableLabel.includes(official) && registrableLabel !== official
  })

  if (officialLookalike) {
    issues.push({
      tone: 'warning',
      text: `Possible official-name lookalike. The official name is ${officialLookalike}.`,
    })
  }

  const hasBlockingIssue = issues.some((issue) => issue.tone === 'danger') || !canonical

  if (hasBlockingIssue) {
    return {
      ok: false,
      canonical,
      labels,
      issues,
    }
  }

  return {
    ok: true,
    name: {
      canonical,
      labels,
      registrableLabel,
    },
    issues,
  }
}

export function getReservedNamePolicy(label: string) {
  return RESERVED_NAME_POLICIES.find((policy) => policy.label === label)
}

export function annualFeeLux(label: string, feeConfig: CoreFeeConfig = DEFAULT_FEE_CONFIG) {
  if (label.length <= 2) return 0
  if (label.length === 3) return feeConfig.threeCharYearLux
  if (label.length === 4) return feeConfig.fourCharYearLux
  return feeConfig.fivePlusYearLux
}

export function annualPrice(label: string, feeConfig: CoreFeeConfig = DEFAULT_FEE_CONFIG) {
  return annualFeeLux(label, feeConfig) / LUX_PER_DUSK
}

export function durationPrice(basePrice: number, years: number) {
  return basePrice * years
}

export function registrationFeeLux(label: string, years: number, feeConfig: CoreFeeConfig = DEFAULT_FEE_CONFIG) {
  return annualFeeLux(label, feeConfig) * years
}

export function registrationPrice(label: string, years: number, feeConfig: CoreFeeConfig = DEFAULT_FEE_CONFIG) {
  return registrationFeeLux(label, years, feeConfig) / LUX_PER_DUSK
}

export function referralRewardLux(feeLux: number, feeConfig: CoreFeeConfig = DEFAULT_FEE_CONFIG) {
  return Math.floor((feeLux * feeConfig.referralRewardBps) / 10_000)
}

export function analyzeName(query: string, feeConfig: CoreFeeConfig = DEFAULT_FEE_CONFIG): NameResult {
  const validation = validateName(query)
  const canonical = validation.ok ? validation.name.canonical : validation.canonical
  const label = validation.ok ? validation.name.registrableLabel : apexLabel(canonical)
  let status: NameStatus = validation.ok ? 'available' : 'invalid'
  const reservedPolicy = validation.ok ? getReservedNamePolicy(label) : undefined
  const issues = [...validation.issues]

  if (reservedPolicy) {
    status = 'reserved'
    issues.push({ tone: 'warning', text: reservedPolicy.reason })
  }
  else if (validation.ok && registeredNames.has(canonical)) status = 'registered'

  return {
    canonical,
    canonicalRaw: canonical,
    displayName: canonical,
    label,
    status,
    price: annualPrice(label, feeConfig),
    issues,
    transactionBlocked: status !== 'available',
    reserved: reservedPolicy,
  }
}

export const searchName = analyzeName

function reserved(label: string, category: ReservedNameCategory, reason: string): ReservedNamePolicy {
  return { label, category, reason }
}

function official(
  label: OfficialNameProfile['label'],
  category: OfficialNameProfile['category'],
  records: OfficialRecordPlan[],
): OfficialNameProfile {
  return {
    label,
    name: `${label}.dusk`,
    category,
    saleLocked: true,
    records,
  }
}

function configured(key: string, value: string): OfficialRecordPlan {
  return { key, status: 'configured', value }
}

function withheld(key: string, reason: string): OfficialRecordPlan {
  return { key, status: 'withheld', reason }
}
