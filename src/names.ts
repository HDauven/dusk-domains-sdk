/**
 * Rules for `.dusk` names as people type them, for wallets and explorers: whether input is meant as a
 * name, its canonical spelling, what is wrong with it, the name typed without `.dusk` likely means, a
 * close known name to suggest, and whether a name may be shown beside an account. Nothing is looked
 * up, and nothing else of the SDK is loaded: the root entrypoint exports all of it too.
 *
 * ```ts
 * import { asDuskName, isDuskName, nameProblem, toDuskName } from '@duskdomains/sdk/names'
 *
 * isDuskName(' Alice.dusk ') // true
 * toDuskName(' Alice.dusk ') // 'alice.dusk'
 * nameProblem('bad_name.dusk') // 'characters'
 * asDuskName('alice') // 'alice.dusk', to offer as "Did you mean alice.dusk?"
 * ```
 *
 * @module
 */
export {
  asDuskName,
  closeDuskName,
  isDuskName,
  nameProblem,
  nameToShow,
  toDuskName,
  type NameProblem,
} from './core/name-rules.ts'
export {
  normalizeNameInput,
  validateName,
  type NameIssue,
  type NameValidationResult,
  type NormalizedName,
  type RootEligibilityPolicy,
} from './core/names.ts'
export type { LabelStatus } from './frozen/types.ts'
