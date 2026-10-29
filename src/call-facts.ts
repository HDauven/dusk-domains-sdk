/**
 * Facts about calls to Dusk Domains contracts, for wallet activity and approvals: whether a call goes
 * to Dusk Domains on its network, what it does, which name a registration registers, and whether a
 * reservation and a later registration from the same account are for the same name. It reads the
 * call alone, synchronously, and leaves the wording to the app.
 *
 * ```ts
 * import { nameCall, revealsReservation } from '@duskdomains/sdk/call-facts'
 *
 * // `register` and `commit`: calls from a transaction's call data, `account` the public account
 * // that sent both.
 * const registration = nameCall(register, 'testnet', account)
 * if (registration?.kind === 'registration') console.log(registration.name) // 'alice.dusk'
 * const reservation = nameCall(commit, 'testnet')
 * if (revealsReservation(registration, reservation)) console.log('Reserved', registration?.name)
 * ```
 *
 * @module
 */
export {
  nameCall,
  revealsReservation,
  type ContractCall,
  type NameCall,
  type NameCallKind,
} from './core/call-facts.ts'
export type { ReleaseRole } from './core/releases.ts'
