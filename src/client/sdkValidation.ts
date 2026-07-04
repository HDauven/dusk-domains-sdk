import {
  createResolverRecord,
  getRecordDefinition,
  validateRecordValue,
} from '../core/records'
import type {
  DuskNamesRecordMutation,
  DuskNamesRecordMutationInput,
  DuskNamesResult,
} from './sdkTypes'
import { failure, success } from './sdkResults'
import { validateName } from '../core/namePolicy'

const MAX_RECORD_MUTATIONS_PER_BATCH = 8

export function validateRecordMutations(
  mutations: DuskNamesRecordMutationInput[],
): DuskNamesResult<DuskNamesRecordMutation[]> {
  if (mutations.length === 0) {
    return failure('invalid_record', 'Record batch is empty.')
  }
  if (mutations.length > MAX_RECORD_MUTATIONS_PER_BATCH) {
    return failure('invalid_record', `Record batch cannot exceed ${MAX_RECORD_MUTATIONS_PER_BATCH} changes.`)
  }

  const keys = new Set<string>()
  const normalized: DuskNamesRecordMutation[] = []
  for (const mutation of mutations) {
    if (keys.has(mutation.key)) {
      return failure('invalid_record', `Record batch contains duplicate key: ${mutation.key}.`)
    }
    keys.add(mutation.key)

    if (!getRecordDefinition(mutation.key)) {
      return failure('invalid_record', `Unsupported resolver record key: ${mutation.key}`)
    }

    if (mutation.action === 'set') {
      const errors = validateRecordValue(mutation.key, mutation.value)
      if (errors.length > 0) {
        return failure('invalid_record', errors.join(' '))
      }
      normalized.push({
        action: 'set',
        record: createResolverRecord(mutation.key, mutation.value),
      })
    } else {
      normalized.push({
        action: 'clear',
        key: mutation.key,
      })
    }
  }

  return success(normalized)
}

export function normalizeSdkName(name: string): DuskNamesResult<string> {
  const validation = validateName(name)

  if (!validation.ok) {
    const message = validation.issues.map((issue) => issue.text).join(' ') || 'Name is invalid.'
    return failure('invalid_name', message)
  }

  return success(validation.name.canonical)
}
