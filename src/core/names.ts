/** Frozen structural labels and policy-owned root eligibility. No availability is inferred. @module */
import { nameKey, validateLabel } from '../frozen/bytes.ts'
import type { LabelStatus, NameView } from '../frozen/types.ts'
import { u64 } from '../frozen/json.ts'

/** Launch policy list from protocol scripts/frozen/plan.mjs. Replacements may differ. */
export const RESERVED_LABELS: readonly string[] = Object.freeze([
  'admin',
  'airdrop',
  'bridge',
  'citadel',
  'claim',
  'connect',
  'docs',
  'dusk',
  'duskdomains',
  'duskds',
  'duskevm',
  'duskfoundation',
  'dusknetwork',
  'duskwallet',
  'exchange',
  'explorer',
  'faucet',
  'foundation',
  'grants',
  'hedger',
  'help',
  'helpdesk',
  'mainnet',
  'moderator',
  'moonlight',
  'npex',
  'official',
  'phoenix',
  'piecrust',
  'provisioner',
  'refund',
  'rusk',
  'security',
  'staking',
  'support',
  'team',
  'testnet',
  'trade',
  'verify',
  'wallet',
  'webwallet',
  'zedger',
])
export interface RootEligibilityPolicy {
  minimum_root_bytes: number
  reserved: readonly string[]
  denied: readonly string[]
}
export const LAUNCH_NAME_POLICY: Readonly<RootEligibilityPolicy> =
  Object.freeze({
    minimum_root_bytes: 3,
    reserved: Object.freeze([...RESERVED_LABELS]),
    denied: Object.freeze([]),
  })
export type NameIssue = 'empty' | 'suffix' | 'depth' | 'label'
export interface NormalizedName {
  canonical: string
  labels: string[]
  registrableLabel: string
  depth: number
}
export type NameValidationResult =
  | { ok: true; name: NormalizedName; rootEligibility: LabelStatus; issues: [] }
  | { ok: false; canonical: string; labels: string[]; issues: NameIssue[] }
/** User-input convenience only; hashes and wire builders require canonical spellings. */
export function normalizeNameInput(value: string): string {
  const text = value.trim().replace(/[A-Z]/gu, (c) => c.toLowerCase())
  return !text || text.endsWith('.dusk') ? text : `${text}.dusk`
}
export function rootLabelStatus(
  label: string,
  policy: RootEligibilityPolicy = LAUNCH_NAME_POLICY,
): LabelStatus {
  validateLabel(label)
  if (policy.denied.includes(label)) return 'Denied'
  if (policy.reserved.includes(label)) return 'Reserved'
  return label.length < policy.minimum_root_bytes ? 'Denied' : 'Public'
}
/** ok describes store structure, not permission to publicly register a root. */
export function validateName(
  value: string,
  policy: RootEligibilityPolicy = LAUNCH_NAME_POLICY,
): NameValidationResult {
  const canonical = normalizeNameInput(value),
    labels = canonical ? canonical.split('.') : []
  const issues: NameIssue[] = []
  if (!canonical) issues.push('empty')
  if (labels.length < 2 || labels.at(-1) !== 'dusk') issues.push('suffix')
  if (labels.length > 5) issues.push('depth')
  if (
    labels.some((label) => {
      try {
        validateLabel(label)
        return false
      } catch {
        return true
      }
    })
  )
    issues.push('label')
  if (issues.length) return { ok: false, canonical, labels, issues }
  const registrableLabel = labels.at(-2)!
  return {
    ok: true,
    name: { canonical, labels, registrableLabel, depth: labels.length - 2 },
    rootEligibility: rootLabelStatus(registrableLabel, policy),
    issues: [],
  }
}
export type NameStatus =
  | 'invalid'
  | 'reserved'
  | 'denied'
  | 'unchecked'
  | 'available'
  | 'registered'
  | 'grace'
  | 'subname'
export interface NameResult {
  canonical: string
  label: string
  status: NameStatus
  validation: NameValidationResult
  /** True only for an observed available root with public policy eligibility. */
  canRegister: boolean
}
/** Omitted current means unobserved; null means observed absent. Supply its observation height. */
export function analyzeName(
  query: string,
  options: {
    policy?: RootEligibilityPolicy
    current?: NameView | null
    height?: bigint
  } = {},
): NameResult {
  const validation = validateName(query, options.policy)
  const canonical = validation.ok
    ? validation.name.canonical
    : validation.canonical
  let status: NameStatus = 'invalid'
  if (validation.ok) {
    status = validation.name.depth ? 'subname' : 'unchecked'
    if (options.current !== undefined) {
      if (options.height === undefined)
        throw new Error('Missing observation height')
      const height = u64(options.height),
        current = options.current?.name
      if (current) {
        const key = nameKey(canonical)
        if (
          key.node.join() !== current.key.node.join() ||
          key.root.join() !== current.key.root.join()
        )
          throw new Error('Name observation mismatch')
      }
      status =
        current && height < current.expires_at
          ? 'registered'
          : current && !validation.name.depth && height < current.grace_end
            ? 'grace'
            : validation.name.depth
              ? 'subname'
              : 'available'
    }
    if (
      !validation.name.depth &&
      status !== 'registered' &&
      status !== 'grace'
    ) {
      if (validation.rootEligibility === 'Reserved') status = 'reserved'
      if (validation.rootEligibility === 'Denied') status = 'denied'
    }
  }
  return {
    canonical,
    label: validation.ok ? validation.name.registrableLabel : '',
    status,
    validation,
    canRegister: status === 'available',
  }
}
