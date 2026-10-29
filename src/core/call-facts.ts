/** Facts about a call to a Dusk Domains contract, read from it synchronously. @module */
import { authority, commitmentHash, equalBytes, fromHex, hex, namehash, validateLabel } from '../frozen/bytes.ts'
import { decodeBase58 } from './base58.ts'
import { contractRole, type ReleaseRole } from './releases.ts'
/**
 * What a call to Dusk Domains does: a name's `reservation` (the first step of a registration) and its
 * `registration`, a `renewal`, the `issue` of a reserved name, a `subname` created, a `records` change,
 * a primary name set (`primary-set`) or cleared (`primary-cleared`), or `other`.
 */
export type NameCallKind =
  | 'reservation'
  | 'registration'
  | 'renewal'
  | 'issue'
  | 'subname'
  | 'records'
  | 'primary-set'
  | 'primary-cleared'
  | 'other'
/** A contract call: the contract, the function and its arguments, as bytes or hex, `0x` or not. */
export interface ContractCall {
  /** The contract ID, with or without `0x`. */
  contractId: string
  /** The function called. */
  fnName: string
  /** The call's arguments, as the chain keeps them. */
  args?: string | Uint8Array | readonly number[] | null
}
/** What `nameCall` reads from a call to a Dusk Domains contract. */
export interface NameCall {
  /** The contract's role in the network's release. */
  role: ReleaseRole
  /** What the call does. */
  kind: NameCallKind
  /**
   * For a registration: the name it registers, such as `alice.dusk`, or null when its arguments do not
   * read as a registration of a canonical name whose node is that name's.
   */
  name?: string | null
  /**
   * For a reservation: the commitment it makes. For a registration: the commitment it reveals, once it
   * checks out for the account that sent it. Lowercase hex; null when the arguments do not read, or
   * the registration does not check out or came without its sender.
   */
  reservation?: string | null
}
const KINDS: ReadonlyMap<string, NameCallKind> = /* @__PURE__ */ new Map([
  ['commit', 'reservation'],
  ['register', 'registration'],
  ['renew', 'renewal'],
  ['issue_reserved', 'issue'],
  ['create_subname', 'subname'],
  ['mutate_records', 'records'],
  ['replace_records', 'records'],
  ['set_primary', 'primary-set'],
  ['clear_primary', 'primary-cleared'],
])
/** The bytes of a call's arguments; null for text that is not hex. */
function bytesOf(args: ContractCall['args']): Uint8Array | null {
  if (args instanceof Uint8Array) return args
  if (Array.isArray(args)) return args.every((b) => Number.isInteger(b) && b >= 0 && b <= 255) ? Uint8Array.from(args) : null
  if (typeof args !== 'string') return null
  try {
    return Uint8Array.from(fromHex(args.trim().replace(/^0x/iu, '')))
  } catch {
    return null
  }
}
/** The size of a registration's archived arguments, which their root ends. */
const REGISTRATION_BYTES = 304
/** A registration's label, commitment and secret, where its arguments read exactly, or null. */
function registration(args: Uint8Array | null): { label: string; commitment: number[]; secret: number[] } | null {
  const root = args ? args.length - REGISTRATION_BYTES : -1
  if (!args || root < 0 || root % 8) return null
  // The label, 32 bytes in: up to 7 bytes in place with its length last, else its length and its
  // offset from there to the bytes, before the root.
  const at = root + 32,
    last = args[at + 7]
  let label: Uint8Array
  if (!(last & 0x80)) {
    if (last > 7) return null
    label = args.subarray(at, at + last)
  } else {
    const view = new DataView(args.buffer, args.byteOffset, args.byteLength),
      length = view.getUint32(at, true),
      start = at + view.getInt32(at + 4, true)
    if (length <= 7 || length > 63 || start < 0 || start + length > root) return null
    label = args.subarray(start, start + length)
  }
  const text = String.fromCharCode(...label)
  try {
    validateLabel(text)
  } catch {
    return null
  }
  // As the store checks it: the node the arguments name is the label's.
  if (!equalBytes(Array.from(args.subarray(root, root + 32)), namehash(`${text}.dusk`))) return null
  return { label: text, commitment: Array.from(args.subarray(root + 41, root + 73)), secret: Array.from(args.subarray(root + 73, root + 105)) }
}
/**
 * Facts about a call to a Dusk Domains contract, read from the call alone: the contract's role, what
 * the call does and, for a registration, the name it registers, checked as the store checks it. Null
 * for a contract that is not Dusk Domains' on `network`: its name (`testnet`), CAIP-2 chain ID
 * (`dusk:2`) or numeric chain ID (`2`), as `releaseFor` takes it.
 *
 * A reservation's `reservation` is the commitment it makes. A registration's is the commitment it
 * reveals, when `sender`, the public account that sent it, is the account it commits to: a
 * reservation and a later registration from the same account are for the same name when the two
 * are equal, as `revealsReservation` checks. It reads nothing from the node.
 */
export function nameCall(call: ContractCall, network: string | number, sender?: string | null): NameCall | null {
  const role = contractRole(call?.contractId, network)
  if (!role) return null
  const kind = (role === 'store' && KINDS.get(call.fnName)) || 'other'
  if (kind === 'reservation') {
    const bytes = bytesOf(call.args)
    return { role, kind, reservation: bytes?.length === 32 ? hex(bytes) : null }
  }
  if (kind !== 'registration') return { role, kind }
  const read = registration(bytesOf(call.args)),
    key = sender ? decodeBase58(String(sender).trim()) : null
  const reveals =
    read && key?.length === 96 &&
    equalBytes(commitmentHash(authority({ kind: 'Moonlight', bytes: Array.from(key) }), read.label, read.secret), read.commitment)
  return { role, kind, name: read ? `${read.label}.dusk` : null, reservation: reveals ? hex(read.commitment) : null }
}
/**
 * Whether a registration reveals what a reservation committed to, so both are for its name: each as
 * `nameCall` read it, the registration with its sender. Pass a reservation and a registration the same
 * account sent, the registration after the reservation; their order is the caller's to check.
 */
export function revealsReservation(registration: NameCall | null | undefined, reservation: NameCall | null | undefined): boolean {
  return (
    registration?.kind === 'registration' &&
    reservation?.kind === 'reservation' &&
    typeof registration.reservation === 'string' &&
    registration.reservation === reservation.reservation
  )
}
