// Long, seeded property campaign. Repeats every `*.fuzz.test.*` property in
// batches with a raised FUZZ_NUM_RUNS and a fresh seed per batch (seed, seed+1,
// ...) until --duration seconds have elapsed. Minimized regressions remain in
// the normal property suite under behavior-oriented names.
//
//   npm run test:fuzz -- --duration 900 --numRuns 100 --seed 20261010 --workers 2
//
// Results go to .fuzz/<timestamp>/: per-batch logs and JSON reports,
// properties.jsonl (one record per property run) and summary.json. Replay a
// failure with FUZZ_SEED=<batch seed> FUZZ_NUM_RUNS=<numRuns> npx vitest run <file> -t '<test name>'.
import { spawn } from 'node:child_process'
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseArgs } from 'node:util'

const { values } = parseArgs({ options: {
  duration: { type: 'string', default: process.env.FUZZ_DURATION ?? '900' },
  numRuns: { type: 'string', default: process.env.FUZZ_NUM_RUNS ?? '100' },
  seed: { type: 'string', default: process.env.FUZZ_SEED ?? '20261010' },
  workers: { type: 'string', default: process.env.FUZZ_WORKERS ?? '2' },
  filter: { type: 'string', default: '.fuzz.test.' },
} })
const duration = Number(values.duration), numRuns = Number(values.numRuns), seed = Number(values.seed), workers = Number(values.workers)
if (!Number.isInteger(duration) || duration < 0 || duration > 86400 ||
    !Number.isInteger(numRuns) || numRuns < 1 || numRuns > 1000000 ||
    !Number.isInteger(seed) || seed < -2147483648 || seed > 2147483647 ||
    !Number.isInteger(workers) || workers < 1 || workers > 64)
  throw new Error('Expected --duration 0..86400 seconds, --numRuns 1..1000000, a signed 32-bit --seed and --workers 1..64')

const directory = resolve('.fuzz', new Date().toISOString().replaceAll(':', '-'))
mkdirSync(directory, { recursive: true })
const stats = resolve(directory, 'properties.jsonl'), started = Date.now(), batches = []
console.log(`Fuzz results: ${directory}`)
do {
  const index = batches.length, batchSeed = (seed + index) | 0, report = resolve(directory, `batch-${index}.json`)
  const log = createWriteStream(resolve(directory, `batch-${index}.log`))
  const child = spawn(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', values.filter,
    `--maxWorkers=${workers}`, '--reporter=dot', '--reporter=json', `--outputFile.json=${report}`], {
    env: { ...process.env, FUZZ_NUM_RUNS: String(numRuns), FUZZ_SEED: String(batchSeed), FUZZ_STATS_FILE: stats,
      FUZZ_TIME_LIMIT_MS: process.env.FUZZ_TIME_LIMIT_MS ?? '600000' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  child.stdout.pipe(log, { end: false }); child.stderr.pipe(log, { end: false })
  const code = await new Promise((done, fail) => { child.on('error', fail); child.on('close', done) })
  await new Promise(done => log.end(done))
  const failures = existsSync(report) ? JSON.parse(readFileSync(report, 'utf8')).testResults
    .flatMap(file => file.assertionResults.filter(t => t.status === 'failed').map(t => t.fullName)) : ['<no report>']
  batches.push({ seed: batchSeed, exit: code, failures, seconds: (Date.now() - started) / 1000 })
  console.log(`Batch ${index + 1}: seed=${batchSeed}, exit=${code}, failures=${failures.length}, elapsed=${((Date.now() - started) / 1000).toFixed(1)}s`)
  for (const name of failures) console.log(`  FAILED ${name}`)
} while (Date.now() - started < duration * 1000)

const records = existsSync(stats) ? readFileSync(stats, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line)) : []
const properties = {}
for (const row of records) {
  const value = properties[row.property] ??= { runs: 0, examples: 0, shrinks: 0, failures: 0, batches: 0, metrics: {} }
  value.runs += row.runs; value.examples += row.examples; value.shrinks += row.shrinks
  value.failures += Number(row.failed || row.interrupted); value.batches++
  for (const [key, n] of Object.entries(row.metrics ?? {})) value.metrics[key] = (value.metrics[key] ?? 0) + n
}
const failed = batches.some(b => b.failures.length || b.exit !== 0)
const totalRuns = records.reduce((n, r) => n + r.runs, 0)
const summary = { started: new Date(started).toISOString(), seconds: (Date.now() - started) / 1000, seed, numRuns, workers,
  batches, failed, propertyCount: Object.keys(properties).length, totalRuns, properties }
writeFileSync(resolve(directory, 'summary.json'), JSON.stringify(summary, null, 2) + '\n')
console.log(`Completed ${batches.length} batches, ${Object.keys(properties).length} properties, ${totalRuns} property cases; summary: ${directory}/summary.json`)
process.exitCode = failed ? 1 : 0
