import { expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

it('imports every runtime entrypoint from an npm tarball in plain Node without a loader', () => {
  const root = fileURLToPath(new URL('../', import.meta.url))
  // Keep all generated files and cleanup inside this task's directory.
  const scratch = mkdtempSync(
    fileURLToPath(new URL('../../.sdk-consumer-', import.meta.url)),
  )
  const env = { ...process.env, NODE_OPTIONS: '' }
  try {
    // Exercise the normal prepare/build lifecycle, not stale dist output.
    const [packed] = JSON.parse(
      execFileSync(
        'npm',
        ['pack', '--json', '--pack-destination', scratch],
        { cwd: root, env, encoding: 'utf8', timeout: 60_000 },
      ),
    )
    const consumer = join(scratch, 'consumer')
    mkdirSync(consumer)
    writeFileSync(
      join(consumer, 'package.json'),
      JSON.stringify({ private: true, type: 'module' }),
    )
    const source = JSON.parse(
      readFileSync(join(root, 'package.json'), 'utf8'),
    )
    // Copy the npm-ci-installed runtime dependencies instead of querying registry metadata.
    const dependencies = Object.keys(source.dependencies).map((name) =>
      join(root, 'node_modules', name),
    )
    execFileSync(
      'npm',
      [
        'install',
        '--offline',
        '--install-links',
        '--ignore-scripts',
        '--no-audit',
        '--no-fund',
        join(scratch, packed.filename),
        ...dependencies,
      ],
      { cwd: consumer, env, encoding: 'utf8', timeout: 60_000 },
    )
    const manifest = JSON.parse(
      readFileSync(
        join(consumer, 'node_modules/@duskdomains/sdk/package.json'),
        'utf8',
      ),
    )
    const specifiers = Object.keys(manifest.exports).map((key) =>
      key === '.' ? manifest.name : `${manifest.name}/${key.slice(2)}`,
    )
    const script = join(consumer, 'smoke.mjs')
    writeFileSync(
      script,
      `
      import assert from 'node:assert/strict';
      for (const specifier of ${JSON.stringify(specifiers)}) {
        const api = await import(specifier);
        assert.match(import.meta.resolve(specifier), /\\.(?:js|mjs)$/u);
        assert.ok(Object.keys(api).length > 0, specifier);
      }
      const catalog = await import('@duskdomains/sdk/event-catalog');
      assert.equal(catalog.indexerEventCatalog.commitment_created.role, 'store');
      const projection = await import('@duskdomains/sdk/projection');
      assert.equal(typeof projection.projectReceipt, 'function');
      const addresses = await import('@duskdomains/sdk/chain-addresses');
      assert.deepEqual(addresses.validateEthereumAddress('0x0000000000000000000000000000000000000000'), []);
      console.log(JSON.stringify(${JSON.stringify(specifiers)}));
    `,
    )
    const imported = JSON.parse(
      execFileSync(process.execPath, [script], {
        cwd: consumer,
        env,
        encoding: 'utf8',
        timeout: 30_000,
      }),
    )
    expect(imported).toHaveLength(8)
    expect(imported).toEqual(specifiers)
    for (const entry of Object.values(manifest.exports) as {
      types: string
      import: string
    }[]) {
      expect(
        packed.files.some(
          (file: { path: string }) => file.path === entry.types.slice(2),
        ),
      ).toBe(true)
      expect(
        packed.files.some(
          (file: { path: string }) => file.path === entry.import.slice(2),
        ),
      ).toBe(true)
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
}, 120_000)
