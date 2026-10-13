import { expect, it } from 'vitest'
import {
  registrationCalls,
  type RegistrationInput,
} from '../src/frozen/actions.ts'
import { registrationCommitWindow } from '../src/core/commitment.ts'
import {
  estimateRegistrationQuote,
  launchPolicyConfig,
} from '../src/core/pricing.ts'
import { namehash } from '../src/frozen/bytes.ts'
import { U64_MAX } from '../src/frozen/json.ts'
import { bytes, clientQuote, id, sample } from './helpers.ts'

// A launch-policy quote, read from store 4 by a client that verified its policy (contract 3).
// A quote is fixed once verified: `quoteValidUntil` is the policy's, set before.
async function input(commitHeight = 100n, quoteValidUntil?: bigint): Promise<RegistrationInput> {
  const quote = sample('RegistrationQuote')
  const { estimate, total_lux, ...policyQuote } =
    estimateRegistrationQuote(launchPolicyConfig(), {
      version: 1,
      directory: bytes(1),
      store: bytes(4),
      actor: bytes(1),
      node: namehash('example.dusk'),
      label: 'example',
      previous_generation: 0n,
      previous_grace_end: null,
      policy_version: 1n,
      height: commitHeight,
      years: 1,
    })
  expect(estimate).toBe(true)
  quote.quote = { ...policyQuote, valid_until: quoteValidUntil ?? policyQuote.valid_until }
  quote.total_lux = total_lux
  quote.policy = bytes(3)
  return {
    actor: bytes(1),
    label: 'example',
    years: 1,
    secret: bytes(3),
    commitmentStore: id(4),
    commitHeight,
    quote: await clientQuote(quote),
  }
}

it('keeps a launch-policy quote usable throughout the inclusive commitment window', async () => {
  const reviewed = await input(),
    { reveal } = registrationCalls(id(4), reviewed)
  expect(reviewed.quote.quote.valid_until).toBe(100n)
  expect(reveal.args.valid_until).toBe(8740n)
  expect(reveal.args.expected_fee_lux).toBe(reviewed.quote.total_lux)
  expect(reveal.args.expected_policy_version).toBe(
    reviewed.quote.policy_version,
  )
  expect(reveal.args.expected_policy_config_version).toBe(
    reviewed.quote.quote.config_version,
  )
  // Check every height, including both neighboring invalid commitment ages.
  for (let age = 0n; age <= 8641n; age++) {
    const height = reviewed.commitHeight + age
    const canReveal =
      registrationCommitWindow(reviewed.commitHeight, height).status ===
        'ready' && height <= reveal.args.valid_until
    expect(canReveal, `commitment age ${age}`).toBe(
      age >= 5n && age <= 8640n,
    )
  }
})

it.each([105n, 4000n, 8740n])(
  'accepts a separately reviewed deadline at %s',
  async (validUntil) => {
    const reviewed = await input()
    expect(
      registrationCalls(id(4), { ...reviewed, validUntil }).reveal.args
        .valid_until,
    ).toBe(validUntil)
  },
)

it.each([
  null,
  0n,
  100n,
  104n,
  8741n,
  -1n,
  U64_MAX + 1n,
  1.5,
  Number.MAX_SAFE_INTEGER + 1,
])('rejects an invalid transaction deadline %s', async (validUntil) => {
  const reviewed = await input()
  expect(() =>
    registrationCalls(id(4), {
      ...reviewed,
      validUntil: validUntil as bigint,
    }),
  ).toThrow()
})

it('does not extend the window when the quote height changes', async () => {
  const reviewed = await input(100n, 8700n)
  expect(registrationCalls(id(4), reviewed).reveal.args.valid_until).toBe(
    8740n,
  )
  expect(() =>
    registrationCalls(id(4), { ...reviewed, validUntil: 8700n + 8640n }),
  ).toThrow('window')
})

it('bounds the deadline at u64 maximum without wrapping the first reveal block', async () => {
  expect(
    registrationCalls(id(4), await input(U64_MAX - 5n)).reveal.args.valid_until,
  ).toBe(U64_MAX)
  const last = await input(U64_MAX - 4n)
  expect(() => registrationCalls(id(4), last)).toThrow('u64')
})

it.each([undefined, -1n, U64_MAX + 1n, 1.5])(
  'rejects an invalid commit height %s',
  async (commitHeight) => {
    const reviewed = await input()
    expect(() =>
      registrationCalls(id(4), {
        ...reviewed,
        commitHeight: commitHeight as bigint,
      }),
    ).toThrow('u64')
  },
)
