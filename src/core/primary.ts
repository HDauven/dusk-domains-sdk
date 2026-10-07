/** Primary names require a live incarnation and an exact forward endpoint match. @module */
import { equalBytes, nameKey } from '../frozen/bytes.ts'
import { u64 } from '../frozen/json.ts'
import type { NameView, PrimaryView, RecordValue } from '../frozen/types.ts'
export type PrimaryNameStatus =
  | 'missing'
  | 'stale'
  | 'inactive'
  | 'forward_missing'
  | 'forward_mismatch'
  | 'verified'
export interface PrimaryNameVerification {
  status: PrimaryNameStatus
  verified: boolean
}
/** Evaluate an observation at one height. Read failures must propagate before calling this helper. */
export function primaryNameStatus(input: {
  endpoint: number[]
  primary: PrimaryView | null
  name: NameView | null
  record: RecordValue | null
  height: bigint
}): PrimaryNameVerification {
  const { endpoint, primary, name, record } = input,
    height = u64(input.height)
  const result = (status: PrimaryNameStatus): PrimaryNameVerification => ({
    status,
    verified: status === 'verified',
  })
  if (!primary) return result('missing')
  if (!name) return result('stale')
  const p = primary.primary,
    n = name.name,
    spelling = nameKey(primary.spelling)
  if (
    !equalBytes(p.endpoint, endpoint) ||
    !equalBytes(p.name.key.root, n.key.root) ||
    !equalBytes(p.name.key.node, n.key.node) ||
    !equalBytes(spelling.root, n.key.root) ||
    !equalBytes(spelling.node, n.key.node) ||
    p.name.incarnation.generation !== n.incarnation.generation ||
    p.name.incarnation.serial !== n.incarnation.serial
  )
    return result('stale')
  if (!name.active || height >= n.expires_at) return result('inactive')
  if (!record) return result('forward_missing')
  if (record.key !== 'moonlight_address' || !equalBytes(record.value, endpoint))
    return result('forward_mismatch')
  return result('verified')
}
