import { describe, expect, it } from 'vitest'
import {
  DEFAULT_GRACE_PERIOD_BLOCKS,
  REGISTRATION_YEAR_BLOCKS,
  createRegistrationLifecycle,
  registrationLifecycleStatus,
  renewRegistrationLifecycle,
} from './registration'

const now = 220_000

describe('Dusk Domains registration lifecycle helpers', () => {
  it('creates deterministic expiry and grace windows in block heights', () => {
    expect(createRegistrationLifecycle({ startsAt: now, years: 3 })).toEqual({
      expiresAt: now + 3 * REGISTRATION_YEAR_BLOCKS,
      graceEndsAt: now + 3 * REGISTRATION_YEAR_BLOCKS + DEFAULT_GRACE_PERIOD_BLOCKS,
    })
  })

  it('renews from the old expiry before expiry and during grace', () => {
    expect(renewRegistrationLifecycle({
      currentExpiresAt: now + REGISTRATION_YEAR_BLOCKS,
      now: now + 10,
      years: 1,
    }).expiresAt).toBe(now + 2 * REGISTRATION_YEAR_BLOCKS)

    for (const elapsed of [0, 1, DEFAULT_GRACE_PERIOD_BLOCKS - 1]) {
      expect(renewRegistrationLifecycle({
        currentExpiresAt: now,
        now: now + elapsed,
        years: 1,
      })).toEqual({
        expiresAt: now + REGISTRATION_YEAR_BLOCKS,
        graceEndsAt: now + REGISTRATION_YEAR_BLOCKS + DEFAULT_GRACE_PERIOD_BLOCKS,
      })
    }
  })

  it('reports active grace and expired states deterministically', () => {
    const lifecycle = createRegistrationLifecycle({ startsAt: now, years: 1 })

    expect(registrationLifecycleStatus(lifecycle, now)).toBe('active')
    expect(registrationLifecycleStatus(lifecycle, lifecycle.expiresAt)).toBe('grace')
    expect(registrationLifecycleStatus(lifecycle, lifecycle.graceEndsAt)).toBe('expired')
  })

  it('rejects durations outside the MVP one to ten year window', () => {
    expect(() => createRegistrationLifecycle({ startsAt: now, years: 0 })).toThrow('between 1 and 10 years')
    expect(() => createRegistrationLifecycle({ startsAt: now, years: 11 })).toThrow('between 1 and 10 years')
  })
})
