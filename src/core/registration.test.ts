import { describe, expect, it } from 'vitest'
import {
  DEFAULT_GRACE_PERIOD_BLOCKS,
  REGISTRATION_YEAR_BLOCKS,
  createRegistrationLifecycle,
  registrationLifecycleStatus,
  renewRegistrationLifecycle,
} from './registration'

const now = 220_000

describe('Dusk Names registration lifecycle helpers', () => {
  it('creates deterministic expiry and grace windows in block heights', () => {
    expect(createRegistrationLifecycle({ startsAt: now, years: 3 })).toEqual({
      expiresAt: now + 3 * REGISTRATION_YEAR_BLOCKS,
      graceEndsAt: now + 3 * REGISTRATION_YEAR_BLOCKS + DEFAULT_GRACE_PERIOD_BLOCKS,
    })
  })

  it('renews from the later of current expiry or current time', () => {
    expect(renewRegistrationLifecycle({
      currentExpiresAt: now + REGISTRATION_YEAR_BLOCKS,
      now: now + 10,
      years: 1,
    }).expiresAt).toBe(now + 2 * REGISTRATION_YEAR_BLOCKS)

    expect(renewRegistrationLifecycle({
      currentExpiresAt: now - 10,
      now,
      years: 1,
    }).expiresAt).toBe(now + REGISTRATION_YEAR_BLOCKS)
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
