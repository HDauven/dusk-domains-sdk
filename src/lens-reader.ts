/**
 * A light reader for wallets and explorers: `createLensReader` resolves `.dusk` names and verifies
 * primary names through the release's read lens alone, fetching the lens's data driver and no other.
 * It checks the lens deployment once and every reply's evidence against the pinned release, as the full
 * client's lens path does, and never reads another way: whatever fails throws a `LensReaderError`.
 *
 * Base58 turns an account into the key bytes `verifyPrimary` takes. `resolveAccounts` in `./accounts`
 * reads what a name points to, with the account checked as a valid key.
 *
 * Import it where an app only resolves names; the root's `createClientFromManifest` does everything else.
 *
 * @module
 */
export {
  createLensReader,
  LensReaderError,
  type LensReader,
  type LensReaderFailure,
  type LensReaderOptions,
  type MoonlightAccount,
} from './frozen/lens-reader.ts'
export { decodeBase58, encodeBase58 } from './core/base58.ts'
export type { LensRefusal, NameLifecycle, Resolved, VerifiedPrimary } from './frozen/lens.ts'
export type { Contract, Forward, Located, NameView, PrimaryView, RecordValue } from './frozen/types.ts'
