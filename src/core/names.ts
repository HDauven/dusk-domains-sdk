/** Frozen structural labels and policy-owned root eligibility. No availability is inferred. @module */
import { nameKey, validateLabel } from '../frozen/bytes.ts'
import type { LabelStatus, NameView } from '../frozen/types.ts'
import { u64 } from '../frozen/json.ts'

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
/** `value` trimmed, with ASCII capitals in lower case and every other character as it is. */
const lowered = (value: string): string =>
  value.trim().replace(/[A-Z]/gu, (c) => c.toLowerCase())
/** User-input convenience only; hashes and wire builders require canonical spellings. */
export function normalizeNameInput(value: string): string {
  const text = lowered(value)
  return !text || text.endsWith('.dusk') ? text : `${text}.dusk`
}
/**
 * Whether typed input is meant as a `.dusk` name rather than an address: once trimmed, it ends in
 * `.dusk`, in any case, and is not a `dusk:` payment link. An address never holds a dot. The name may
 * still be invalid; `nameProblem` says why.
 */
export function isDuskName(input: string): boolean {
  const text = String(input ?? '').trim()
  return /\.dusk$/iu.test(text) && !/^dusk:/iu.test(text)
}
/**
 * What is wrong with a typed `.dusk` name, the first that applies: `empty` (nothing typed), `suffix`
 * (no `.dusk` at the end), `characters` (a label holds something other than a–z, 0–9 and hyphens),
 * `hyphen` (a label starts or ends with one), `length` (a label is empty or over 63 characters) or
 * `depth` (more than three subname labels).
 */
export type NameProblem = 'empty' | 'suffix' | 'characters' | 'hyphen' | 'length' | 'depth'
const isLabel = (label: string): boolean => {
  try {
    validateLabel(label)
    return true
  } catch {
    return false
  }
}
/**
 * What is wrong with typed input as a `.dusk` name, or null when it is one: trimmed and with ASCII
 * capitals in lower case, it ends in `.dusk` and `validateName` accepts it.
 */
export function nameProblem(input: string): NameProblem | null {
  const name = lowered(String(input ?? ''))
  if (!name) return 'empty'
  const labels = name.split('.')
  if (labels.length < 2 || labels.at(-1) !== 'dusk') return 'suffix'
  const invalid = labels.filter((label) => !isLabel(label))
  if (invalid.some((label) => /[^a-z0-9-]/u.test(label))) return 'characters'
  if (invalid.some((label) => /^-|-$/u.test(label))) return 'hyphen'
  if (invalid.length) return 'length'
  return labels.length > 5 ? 'depth' : null
}
/**
 * The name typed input means, in canonical form, such as `alice.dusk` for ` Alice.DUSK `: null unless
 * `nameProblem` finds nothing wrong with it.
 */
export function toDuskName(input: string): string | null {
  const name = lowered(String(input ?? ''))
  return nameProblem(name) === null ? name : null
}
/**
 * The `.dusk` name that input typed without its ending, or with dots after it, likely means: `alice`,
 * `alice.` and `alice.dusk.` mean `alice.dusk`. Nothing is looked up. Null for anything that cannot be
 * a name, and for what reads as an address: a capital after the first character, or `0x` and hex.
 */
export function asDuskName(input: string): string | null {
  const typed = String(input ?? '').trim().replace(/\.+$/u, '')
  if (!typed || /[A-Z]/u.test(typed.slice(1)) || /^0x[0-9a-f]*$/iu.test(typed)) return null
  const labels = lowered(typed).split('.')
  const named = labels.at(-1) === 'dusk' ? labels.slice(0, -1) : labels
  const name = `${named.join('.')}.dusk`
  return named.length && nameProblem(name) === null ? name : null
}
/**
 * Edits between two strings, a letter added, removed or changed, or two neighbours swapped, each one
 * edit.
 */
function editDistance(a: string, b: string): number {
  const rows: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i])
  for (let j = 1; j <= b.length; j++) rows[0][j] = j
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) {
      const swapped =
        i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]
          ? rows[i - 2][j - 2] + 1
          : Infinity
      rows[i][j] = Math.min(
        rows[i - 1][j] + 1,
        rows[i][j - 1] + 1,
        rows[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
        swapped,
      )
    }
  return rows[a.length][b.length]
}
/**
 * The known name closest to a typed `.dusk` name, to suggest when the typed one is not registered:
 * one or two edits away (one for a name of four characters or fewer before `.dusk`), the first of the
 * closest in `known`'s order, and never the typed name itself or one that is not a valid name.
 * Nothing is looked up.
 */
export function closeDuskName(typed: string, known: Iterable<string>): string | null {
  const label = (name: string) => lowered(String(name ?? '')).replace(/\.dusk$/u, '')
  const want = label(typed)
  if (!want) return null
  let best: string | null = null,
    bestEdits = (want.length <= 4 ? 1 : 2) + 1
  for (const name of known) {
    const have = label(name)
    if (!have || have === want || nameProblem(`${have}.dusk`) !== null) continue
    const edits = editDistance(want, have)
    if (edits < bestEdits) {
      best = have
      bestEdits = edits
    }
  }
  return best ? `${best}.dusk` : null
}
/**
 * A label that reads as key material rather than a name: `0x` and hex, as a contract ID, or 16 or
 * more letters and digits with both among them, as the start of an account or address.
 */
const keyLike = (label: string): boolean =>
  /^0x[0-9a-f]*$/u.test(label) ||
  (label.length >= 16 && /^[a-z0-9]+$/u.test(label) && /[0-9]/u.test(label) && /[a-z]/u.test(label))
/**
 * A verified name as it may be shown beside an account: `name` when it is a canonical `.dusk` name of
 * at most `maxLength` characters (24 by default) none of whose labels reads like an account, address or
 * contract ID; null otherwise. A longer name is left out rather than cut short, as the part cut off
 * could be what tells it apart.
 */
export function nameToShow(name: unknown, maxLength = 24): string | null {
  if (typeof name !== 'string' || name.length > maxLength || toDuskName(name) !== name) return null
  return name.split('.').some(keyLike) ? null : name
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
/**
 * Status `analyzeName` reports: an `invalid` spelling, a `reserved` or `denied` root, `unchecked`
 * without an observation, `available`, `registered`, in `grace`, or a `subname`.
 */
export type NameStatus =
  | 'invalid'
  | 'reserved'
  | 'denied'
  | 'unchecked'
  | 'available'
  | 'registered'
  | 'grace'
  | 'subname'
/** What `analyzeName` reports: canonical spelling, root label, status and the validation behind it. */
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
