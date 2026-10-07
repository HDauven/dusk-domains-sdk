import { expect, it } from 'vitest'
import {
  createRegistrationLifecycle,
  renewRegistrationLifecycle,
  registrationLifecycleStatus,
  blockHeightToUnixSeconds,
  blocksForSeconds,
} from '../src/core/lifecycle.ts'
import { U64_MAX } from '../src/frozen/json.ts'
it.each(Array.from({ length: 10 }, (_, i) => i + 1))(
  'registers %s whole years from the current block',
  (years) => {
    expect(createRegistrationLifecycle({ startsAt: 100n, years })).toEqual({
      expiresAt: 100n + BigInt(years) * 3153600n,
      graceEndsAt: 259300n + BigInt(years) * 3153600n,
    })
  },
)
it.each([0, -1, 11, 1.5, NaN, Infinity])(
  'rejects invalid years %s instead of truncating',
  (years) => {
    expect(() => createRegistrationLifecycle({ startsAt: 0n, years })).toThrow()
    expect(() =>
      renewRegistrationLifecycle({ currentExpiresAt: 10n, now: 1n, years }),
    ).toThrow()
  },
)
it.each([
  [9n, 'active'],
  [10n, 'grace'],
  [19n, 'grace'],
  [20n, 'expired'],
])('lifecycle at %s', (height, status) =>
  expect(
    registrationLifecycleStatus({ expiresAt: 10n, graceEndsAt: 20n }, height),
  ).toBe(status),
)
it.each([9n, 10n, 11n, 259209n])(
  'renews from stored expiry at %s, including grace',
  (now) =>
    expect(
      renewRegistrationLifecycle({ currentExpiresAt: 10n, now, years: 1 }),
    ).toEqual({ expiresAt: 3153610n, graceEndsAt: 3412810n }),
)
it.each([259210n, 259211n])('forbids renewal at/after grace end %s', (now) =>
  expect(() =>
    renewRegistrationLifecycle({ currentExpiresAt: 10n, now, years: 1 }),
  ).toThrow('Expired'),
)
it('accepts exactly the horizon and rejects one block beyond it', () => {
  expect(
    renewRegistrationLifecycle({
      currentExpiresAt: 28382400n,
      now: 0n,
      years: 1,
    }).expiresAt,
  ).toBe(31536000n)
  expect(() =>
    renewRegistrationLifecycle({
      currentExpiresAt: 28382401n,
      now: 0n,
      years: 1,
    }),
  ).toThrow('horizon')
})
it.each([-1n, U64_MAX])('checks registration overflow %s', (startsAt) =>
  expect(() => createRegistrationLifecycle({ startsAt, years: 1 })).toThrow(),
)
it('checks grace overflow and mismatched stored grace', () => {
  expect(() =>
    createRegistrationLifecycle({ startsAt: U64_MAX - 3153600n, years: 1 }),
  ).toThrow()
  expect(() =>
    renewRegistrationLifecycle({
      currentExpiresAt: 10n,
      currentGraceEndsAt: 11n,
      now: 0n,
      years: 1,
    }),
  ).toThrow()
})
it.each([
  [0, 0n],
  [1, 1n],
  [9, 1n],
  [10, 1n],
  [11, 2n],
  [86400, 8640n],
])('estimates blocks for %s seconds', (seconds, expected) =>
  expect(blocksForSeconds(seconds)).toBe(expected),
)
it.each([-1, 0.5, Infinity, NaN])('rejects unsafe seconds %s', (seconds) =>
  expect(() => blocksForSeconds(seconds)).toThrow(),
)
it('estimates relative time losslessly even at large absolute heights', () => {
  expect(blockHeightToUnixSeconds(U64_MAX, U64_MAX - 5n, 1000)).toBe(1050)
  expect(blockHeightToUnixSeconds(0n, 5n, 1000)).toBe(950)
  expect(() => blockHeightToUnixSeconds(U64_MAX, 0n, 1000)).toThrow()
})
