import { describe, expect, it } from 'vitest'
import {
  applyRecordMutations,
  recordDraftValuesFor,
  recordMutationPlan,
} from './recordDrafts'
import { createResolverRecord, type ResolverRecord, type ResolverRecordKey } from './records'

const keys = [
  'moonlight_address',
  'website',
  'text.description',
] as const satisfies readonly ResolverRecordKey[]

function records(): ResolverRecord[] {
  return [
    createResolverRecord('moonlight_address', 'dusk1abcdefghijklmnopqrst', '2026-06-24T10:00:00.000Z'),
    createResolverRecord('website', 'https://old.example', '2026-06-24T10:00:00.000Z'),
  ]
}

describe('record draft batch planning', () => {
  it('hydrates draft fields from current records until the user edits them', () => {
    expect(recordDraftValuesFor(keys, records(), {
      website: 'https://new.example',
    })).toMatchObject({
      moonlight_address: 'dusk1abcdefghijklmnopqrst',
      website: 'https://new.example',
      'text.description': '',
    })
  })

  it('creates one batch payload for dirty set and clear operations', () => {
    const plan = recordMutationPlan(keys, records(), {
      website: 'https://new.example',
      moonlight_address: '',
      'text.description': 'Institutional Dusk namespace',
    })

    expect(plan.errors).toEqual([])
    expect(plan.mutations).toEqual([
      { action: 'clear', key: 'moonlight_address' },
      { action: 'set', key: 'website', value: 'https://new.example', ttlSeconds: 3600 },
      { action: 'set', key: 'text.description', value: 'Institutional Dusk namespace', ttlSeconds: 3600 },
    ])
  })

  it('ignores unchanged and whitespace-only empty draft fields', () => {
    expect(recordMutationPlan(keys, records(), {
      website: ' https://old.example ',
      'text.description': '   ',
    })).toEqual({
      mutations: [],
      errors: [],
    })
  })

  it('returns validation errors without adding invalid set mutations', () => {
    const plan = recordMutationPlan(keys, records(), {
      website: 'http://not-secure.example',
      moonlight_address: 'not-a-dusk-address',
    })

    expect(plan.mutations).toEqual([])
    expect(plan.errors).toEqual([
      'Dusk Public Address: Dusk addresses must use a dusk1-prefixed address or Dusk account address form.',
      'Website: URLs must use HTTPS.',
    ])
  })

  it('applies successful batch mutations to local optimistic state', () => {
    const nextRecords = applyRecordMutations(records(), [
      { action: 'clear', key: 'moonlight_address' },
      { action: 'set', key: 'website', value: 'https://new.example', ttlSeconds: 3600 },
      { action: 'set', key: 'text.description', value: 'Institutional Dusk namespace', ttlSeconds: 3600 },
    ])

    expect(nextRecords.map((record) => [record.key, record.value])).toEqual([
      ['text.description', 'Institutional Dusk namespace'],
      ['website', 'https://new.example'],
    ])
  })
})
