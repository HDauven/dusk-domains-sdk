/** What a name's spelling and an observation of it say about the name: invalid, reserved, available, registered. @module */
import { nameKey } from '../frozen/bytes.ts'
import { u64 } from '../frozen/json.ts'
import type { NameView } from '../frozen/types.ts'
import { validateName, type NameValidationResult, type RootEligibilityPolicy } from './names.ts'
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
