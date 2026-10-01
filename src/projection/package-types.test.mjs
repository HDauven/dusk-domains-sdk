import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { expect, it } from 'vitest'

it('ships declarations for plain-Node modules and typechecks both public entrypoints without allowJs', async () => {
  const root = fileURLToPath(new URL('../../', import.meta.url))
  const directory = await mkdtemp(join(root, 'node_modules/.projection-consumer-'))
  try {
    const [packed] = JSON.parse(execFileSync('npm', ['pack', '--ignore-scripts', '--offline', '--json', '--pack-destination', directory], { cwd: root, encoding: 'utf8' }))
    const packageDir = join(directory, 'node_modules/@duskdomains/sdk')
    await mkdir(packageDir, { recursive: true })
    execFileSync('tar', ['-xzf', join(directory, packed.filename), '--strip-components=1', '-C', packageDir])
    await writeFile(join(directory, 'package.json'), '{"type":"module"}')
    const consumer = join(directory, 'consumer.ts')
    await writeFile(consumer, `
      import { createDuskDomainsProjector, namehashHex } from '@duskdomains/sdk'
      import { createProjectionState, applyProjectionEvent, getReservedNamePolicy,
        createLifecycleEventProjector, type ProjectionState } from '@duskdomains/sdk/projection'
      const state: ProjectionState = createProjectionState()
      applyProjectionEvent(state, { type: 'record_cleared', node: namehashHex('alice.dusk'), controller: 'alice', key: 'website' })
      const owner: string | null | undefined = createDuskDomainsProjector().getNameByNode('node')?.owner
      const category: string | undefined = getReservedNamePolicy('dusk')?.category
      createLifecycleEventProjector().getFeeConfig().threeCharYearLux.toFixed()
      // @ts-expect-error Projection state is not an untyped implementation detail.
      state.namesByNode.set('node', 123)
      // @ts-expect-error Existing root imports retain their return types.
      const invalid: number = createDuskDomainsProjector().getFeeConfig()
      void [owner, category, invalid]
    `)
    const program = ts.createProgram([consumer], {
      target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler, strict: true,
      skipLibCheck: true, allowJs: false, noEmit: true,
      allowImportingTsExtensions: true, verbatimModuleSyntax: true,
    })
    expect(ts.getPreEmitDiagnostics(program).map(diagnostic =>
      `${diagnostic.code}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')}`,
    )).toEqual([])
    const paths = new Set(packed.files.map(file => file.path))
    for (const path of paths) {
      if (path.endsWith('.mjs')) expect(paths.has(path.replace(/\.mjs$/, '.d.mts')), path).toBe(true)
    }
    const manifest = JSON.parse(await readFile(join(packageDir, 'package.json'), 'utf8'))
    expect(manifest.types).toBe(manifest.exports['.'].types)
    expect(paths.has(manifest.exports['./projection'].types.slice(2))).toBe(true)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}, 20_000)
