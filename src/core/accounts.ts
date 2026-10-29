/** What a `.dusk` name points to: its public account, checked as a valid key, and its shielded address. @module */
import { decodeBase58, encodeBase58 } from './base58.ts'
import { isMoonlightEndpoint } from './endpoint.ts'
import type { LensReader } from '../frozen/lens-reader.ts'
import type { NameLifecycle, Resolved } from '../frozen/lens.ts'
/** What a name points to, as `resolveAccounts` reads it. */
export interface NameAccounts {
  /** The name's lifecycle at `height`: only an `Active` name points anywhere. */
  status: NameLifecycle
  /** The public account in its `moonlight_address` record, in Base58, when that is a valid Moonlight key. */
  account?: string
  /** The shielded address its `phoenix_payment_endpoint` record holds, when that is exactly one, as text. */
  address?: string
  /** The height it was read at. */
  height: bigint
}
/** The records `resolveAccounts` reads. */
const ACCOUNT_KEYS = ['moonlight_address', 'phoenix_payment_endpoint']
/** A resolution reduced to what the name points to, as `resolveAccounts` gives it. */
export function accountsOf({ status, records, height }: Resolved): NameAccounts {
  const value = (key: string) => (status === 'Active' ? records.find((r) => r?.key === key)?.value : undefined)
  const key = value('moonlight_address'),
    text = value('phoenix_payment_endpoint'),
    // A byte order mark is kept, so a record holding one holds no address.
    address = text && new TextDecoder('utf-8', { ignoreBOM: true }).decode(Uint8Array.from(text))
  return {
    status,
    height,
    ...(key && isMoonlightEndpoint(key) ? { account: encodeBase58(key) } : {}),
    ...(address && decodeBase58(address)?.length === 64 ? { address } : {}),
  }
}
/**
 * What a `.dusk` name points to, read in one lens query with `reader`, a light reader from
 * `createLensReader` (`./lens-reader`) or anything with its `resolve`: for an active name, the public
 * account in its `moonlight_address` record, in Base58, when that is a valid Moonlight key as the
 * protocol checks one (canonical, compressed, on the curve and in its subgroup), and the shielded
 * address in its `phoenix_payment_endpoint` record, when the record is exactly a shielded address as
 * UTF-8 text. Either is left out otherwise; a wallet still checks an address as it checks any. A
 * failed read rejects with the reader's error, and a name that is not canonical (`toDuskName` in
 * `./names` gives the canonical one) rejects before any request, as the reader's reads do.
 */
export async function resolveAccounts(reader: Pick<LensReader, 'resolve'>, name: string): Promise<NameAccounts> {
  return accountsOf(await reader.resolve(name, ACCOUNT_KEYS))
}
