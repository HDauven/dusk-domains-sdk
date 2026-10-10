import fc from 'fast-check'
import { appendFileSync } from 'node:fs'

// Defaults keep `npm test` short and reproducible. `npm run test:fuzz` raises
// FUZZ_NUM_RUNS and moves FUZZ_SEED per batch; FUZZ_PATH replays one shrink path.
export const numRuns = Number(process.env.FUZZ_NUM_RUNS ?? 20)
export const seed = Number(process.env.FUZZ_SEED ?? 20261010)
if (!Number.isSafeInteger(numRuns) || numRuns < 1 || numRuns > 1_000_000)
  throw new Error('FUZZ_NUM_RUNS must be an integer in 1..1000000')
if (!Number.isInteger(seed) || seed < -2147483648 || seed > 2147483647)
  throw new Error('FUZZ_SEED must be a signed 32-bit integer')
// Bounds a property's generation plus shrinking; a failure found before the limit is still reported.
export const timeLimit = Number(process.env.FUZZ_TIME_LIMIT_MS ?? 60_000)
/** Per-test vitest timeout for property files: the property limit plus setup. */
export const testTimeout = timeLimit + 60_000

export interface CheckOptions {
  /** Explicit boundary cases, run before the generated ones. */
  examples?: any[][]
  /** Relative cost: expensive properties run numRuns * weight cases (at least one). */
  weight?: number
  /** Counters filled by the property, recorded with the run counts. */
  metrics?: Record<string, number>
}

/** Run one seeded property and append its counts to FUZZ_STATS_FILE. */
export async function check(name: string, property: any, options: CheckOptions = {}) {
  const { examples = [], weight = 1, metrics } = options
  const requested = Math.max(1, Math.round(numRuns * weight))
  const started = performance.now()
  const result = await fc.check(property, {
    seed, numRuns: requested + examples.length, examples, interruptAfterTimeLimit: timeLimit,
    ...(process.env.FUZZ_PATH ? { path: process.env.FUZZ_PATH } : {}),
  })
  const record = {
    property: name, seed: result.seed, requested, examples: examples.length,
    runs: result.numRuns, skips: result.numSkips, shrinks: result.numShrinks,
    failed: result.failed, interrupted: result.interrupted,
    path: result.counterexamplePath, milliseconds: performance.now() - started,
    ...(metrics ? { metrics } : {}),
  }
  if (process.env.FUZZ_STATS_FILE)
    appendFileSync(process.env.FUZZ_STATS_FILE, `${JSON.stringify(record)}\n`)
  if (result.failed || result.interrupted)
    throw new Error(`${fc.defaultReportMessage(result) ?? `Property interrupted: ${name}`}\n${(result.errorInstance as any)?.stack ?? result.errorInstance ?? ''}`)
}

export const count = (metrics: Record<string, number>, key: string) => {
  metrics[key] = (metrics[key] ?? 0) + 1
}
export const accepts = (operation: () => unknown) => {
  try { operation(); return true } catch { return false }
}
