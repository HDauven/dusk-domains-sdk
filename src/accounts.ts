/**
 * What a `.dusk` name points to, for an app that sends to names: `resolveAccounts` reads a name with a
 * light reader (`./lens-reader`) and gives its public account only when the record is a valid
 * Moonlight key, on the curve as the protocol checks a key, and its shielded address only when the
 * record is exactly one. The curve check is why it is an entry of its own: the reader alone does not
 * carry it.
 *
 * ```ts
 * import { createLensReader } from '@duskdomains/sdk/lens-reader'
 * import { resolveAccounts } from '@duskdomains/sdk/accounts'
 * import { PINNED_RELEASES } from '@duskdomains/sdk/releases'
 *
 * const release = PINNED_RELEASES.mainnet
 * const reader = await createLensReader(release, { nodeUrl: 'https://nodes.dusk.network/' })
 * const { status, account, address } = await resolveAccounts(reader, 'example.dusk')
 * if (account) console.log('send to', account) // a valid key, in Base58
 * ```
 *
 * @module
 */
export { resolveAccounts, type NameAccounts } from './core/accounts.ts'
export type { LensReader } from './frozen/lens-reader.ts'
export type { NameLifecycle, Resolved } from './frozen/lens.ts'
