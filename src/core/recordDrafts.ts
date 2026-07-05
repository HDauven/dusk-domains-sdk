import { type CoreRecordMutationInput } from '../contracts/calls'
import {
  createResolverRecord,
  getRecordDefinition,
  validateRecordValue,
  type ResolverRecord,
  type ResolverRecordKey,
} from './records'

export type RecordMutationPlan = {
  mutations: CoreRecordMutationInput[]
  errors: string[]
}

export function recordValueFor(records: ResolverRecord[], key: ResolverRecordKey): string {
  return records.find((record) => record.key === key)?.value ?? ''
}

export function recordDraftValuesFor(
  keys: readonly ResolverRecordKey[],
  records: ResolverRecord[],
  drafts: Record<string, string>,
) : Partial<Record<ResolverRecordKey, string>> {
  return Object.fromEntries(keys.map((key) => [
    key,
    Object.hasOwn(drafts, key) ? drafts[key] : recordValueFor(records, key),
  ])) as Partial<Record<ResolverRecordKey, string>>
}

export function recordMutationPlan(
  keys: readonly ResolverRecordKey[],
  records: ResolverRecord[],
  drafts: Record<string, string>,
): RecordMutationPlan {
  const mutations: CoreRecordMutationInput[] = []
  const errors: string[] = []

  for (const key of keys) {
    const existingValue = recordValueFor(records, key)
    const nextValue = (Object.hasOwn(drafts, key) ? drafts[key] : existingValue).trim()

    if (nextValue === existingValue) continue
    if (!nextValue) {
      if (existingValue) mutations.push({ action: 'clear', key })
      continue
    }

    const definition = getRecordDefinition(key)
    const validationErrors = validateRecordValue(key, nextValue)
    if (validationErrors.length > 0) {
      errors.push(`${definition?.label ?? key}: ${validationErrors.join(' ')}`)
      continue
    }

    const record = createResolverRecord(key, nextValue)
    mutations.push({
      action: 'set',
      key: record.key,
      value: record.value,
      ttlSeconds: record.ttlSeconds,
    })
  }

  return { mutations, errors }
}

export function applyRecordMutations(records: ResolverRecord[], mutations: CoreRecordMutationInput[]): ResolverRecord[] {
  return mutations.reduce((nextRecords, mutation) => {
    if (mutation.action === 'clear') {
      return nextRecords.filter((record) => record.key !== mutation.key)
    }

    return [
      createResolverRecord(mutation.key as ResolverRecordKey, mutation.value),
      ...nextRecords.filter((record) => record.key !== mutation.key),
    ]
  }, records)
}
