# Registration quotes and premiums

Public re-registration of a dropped root adds a premium to the normal annual fee
for 21 days after its previous `grace_ends_at`. The previous owner pays it too.
Renewals, subnames, operator-issued reserved names and never-registered roots do
not pay it.

`CoreFeeConfig.premiumStartLux` defaults to 1,000,000,000,000,000 Lux
(1,000,000 DUSK). The router operator can change it, including for names already in
the window, and 0 disables it. `premiumReferralRewardBps` is independent of the
base referral share and defaults to 0.

```ts
import { quoteRegistration } from '@duskdomains/sdk'
import { coreCompleteRegistrationRuntimeCall } from '@duskdomains/sdk/writes'

const quote = quoteRegistration('aurora.dusk', 2, feeConfig, {
  graceEndsAtBlockHeight: previousRecord?.graceEndsAtBlockHeight ?? null,
  currentBlockHeight,
  nowSeconds: Math.floor(Date.now() / 1000),
})
const call = coreCompleteRegistrationRuntimeCall({
  ...registrationArgs,
  feeLux: quote.totalLux,
})
```

The quote returns `baseLux`, `premiumLux`, `totalLux`, `nextStepBlockHeight`,
`premiumEndsAtBlockHeight`, `nextStepAt` and `premiumEndsAt`. Dates are estimates
using ten seconds per block; omit `nowSeconds` for a quote containing only block
heights. `quoteRegistration` accepts only public root names.

`registrationPremiumSchedule` exposes the same schedule independently of a
registration term. It uses integer shifts with BigInt internally, then returns
safe integer Lux. For whole 8,640-block days `d`, the premium is
`(start >> d) - (start >> 21)` until day 21, when it becomes zero.

`registrationFeeLux(label, years, config, premiumLux)` and `registrationPrice`
include an optional quoted premium; omitting it gives the base fee for new names
or renewals. A call builder preserves the supplied total as `fee_lux`.
`referralRewardLux(totalLux, config, premiumLux)` calculates the two referral
shares separately with whole-Lux rounding.
`validateFeeConfigPrices` enforces the contract's maximum: the start premium plus
the largest ten-year base fee must fit in 9,007,199,254,740,991 Lux.

For a direct chain read, use `onChain.getRegistrationPremium(name)` or
`coreRegistrationPremiumCall({ node })`. Pool routing selects the name's owning
registry. `getFeeConfig()` decodes the router's current `premium_start_lux`.

A quote stays constant through one daily step. A reveal after the next step fails
the exact-fee check; refresh and retry within the commitment's existing lifetime.
Warn users in the final ten minutes before `nextStepAt`, and offer to wait or
confirm at the current price. Operator price changes can also invalidate a quote.

Indexer search results expose `premiumLux`, `premiumEndsAt`,
`premiumNextStepAt`, their block-height counterparts and the stored grace end.
See [event projection](indexer-events.md#registration-premiums) for paid premiums
and treasury income.

`getRegistrationPremium(name)` reads the driver’s bare u64 decimal string and
returns a non-negative safe-integer number, including zero for a name without a
premium. Numeric outputs from compatible transports are also accepted. Fee
configuration, lifecycle and record reads accept decimal strings or numbers for
all integer fields and reject values outside their supported bounds.
