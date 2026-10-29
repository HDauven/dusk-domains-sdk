/** Frozen structural labels and policy-owned root eligibility. No availability is inferred. @module */
import { lowered, validateLabel } from './name-rules.ts'
import type { LabelStatus } from '../frozen/types.ts'
export {
  asDuskName,
  closeDuskName,
  isDuskName,
  nameProblem,
  nameToShow,
  toDuskName,
  type NameProblem,
} from './name-rules.ts'

/** Launch policy list from protocol scripts/frozen/plan.mjs. Replacements may differ. */
export const RESERVED_LABELS: readonly string[] = Object.freeze([
  'admin',
  'airdrop',
  'autholykos',
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
  'gamo',
  'george',
  'grants',
  'hdauven',
  'hedger',
  'hein',
  'heindauven',
  'help',
  'helpdesk',
  'human',
  'mainnet',
  'moana',
  'mocello',
  'mochavi',
  'moderator',
  'moonlight',
  'neotamandua',
  'nocturne-standards',
  'npex',
  'official',
  'phoenix',
  'piecrust',
  'pieswap',
  'provisioner',
  'rannier',
  'refund',
  'rusk',
  'security',
  'seppia',
  'sozu',
  'staking',
  'support',
  'tdi',
  'team',
  'testnet',
  'thomas',
  'tminus',
  'trade',
  'verify',
  'wallet',
  'webwallet',
  'zedger',
])
/** Root label rules of a policy: minimum length in bytes, and the reserved and denied labels. */
export interface RootEligibilityPolicy {
  /** The shortest root label it lets anyone register, in bytes. */
  minimum_root_bytes: number
  /** Root labels only the operator issues. */
  reserved: readonly string[]
  /** Root labels nobody registers. */
  denied: readonly string[]
}
/** The launch policy's root rules: roots from 1 byte, `RESERVED_LABELS` reserved, nothing denied. */
export const LAUNCH_NAME_POLICY: Readonly<RootEligibilityPolicy> =
  Object.freeze({
    minimum_root_bytes: 1,
    reserved: Object.freeze([...RESERVED_LABELS]),
    denied: Object.freeze([]),
  })
/**
 * Why `validateName` rejects a spelling: `empty`, no `.dusk` suffix, more than three subname labels
 * (`depth`), or a label that is not canonical.
 */
export type NameIssue = 'empty' | 'suffix' | 'depth' | 'label'
/** A structurally valid name: canonical spelling, labels, root label and subname depth (0 for a root). */
export interface NormalizedName {
  /** The name's canonical spelling, such as `pay.alice.dusk`. */
  canonical: string
  /** Its labels, `dusk` last. */
  labels: string[]
  /** The root's label, such as `alice`. */
  registrableLabel: string
  /** How many labels it has below its root: 0 for a root. */
  depth: number
}
/** Outcome of `validateName`: the name and its root label's eligibility, or the spelling and its issues. */
export type NameValidationResult =
  | { ok: true; name: NormalizedName; rootEligibility: LabelStatus; issues: [] }
  | { ok: false; canonical: string; labels: string[]; issues: NameIssue[] }
/** User-input convenience only; hashes and wire builders require canonical spellings. */
export function normalizeNameInput(value: string): string {
  const text = lowered(value)
  return !text || text.endsWith('.dusk') ? text : `${text}.dusk`
}
/**
 * Eligibility of a root label under `policy`, the launch policy by default: `Denied` when listed as
 * denied, `Reserved` when reserved, `Denied` when shorter than the minimum, else `Public`. Throws
 * for a label that is not canonical.
 */
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
