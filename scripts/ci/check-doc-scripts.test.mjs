import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { checkDocScripts, missingDocScripts } from './check-doc-scripts.mjs'

const roots = []
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('documented npm scripts', () => {
  it('checks inline, fenced, quoted and continued commands with line numbers', () => {
    const source = [
      '`npm run build` and `npm run missing:inline`.',
      '```sh',
      'npm --silent run "missing:fenced" -- --flag',
      'npm run --if-present missing:optional',
      'npm run \\',
      '  missing:continued',
      '```',
      'npm run-script missing:alias',
    ].join('\r\n')
    expect(missingDocScripts(source, { build: 'build' })).toEqual([
      { script: 'missing:inline', line: 1 },
      { script: 'missing:fenced', line: 3 },
      { script: 'missing:optional', line: 4 },
      { script: 'missing:continued', line: 5 },
      { script: 'missing:alias', line: 8 },
    ])
    expect(missingDocScripts('npm run toString', {})).toEqual([{ script: 'toString', line: 1 }])
  })

  it('checks complete script tokens after options and the option separator', () => {
    const scripts = { test: 'vitest run', 'valid+script': 'true' }
    expect(missingDocScripts([
      '`npm run -- removed-script`',
      '`npm run test+removed`',
      'npm run --silent -- "removed+script"',
      'npm run valid+script && npm run test',
    ].join('\n'), scripts)).toEqual([
      { script: 'removed-script', line: 1 },
      { script: 'test+removed', line: 2 },
      { script: 'removed+script', line: 3 },
    ])
  })

  it('checks whole script tokens assembled from quoted and unquoted parts', () => {
    const scripts = { test: 'vitest run', 'valid+script': 'true' }
    expect(missingDocScripts([
      '`npm run "test"+removed`',
      "`npm run test'+removed'`",
      '`npm run "valid+"script`',
      '`npm run test\\+removed`',
      '`npm run valid\\+script`',
    ].join('\n'), scripts)).toEqual([
      { script: 'test+removed', line: 1 },
      { script: 'test+removed', line: 2 },
      { script: 'test+removed', line: 4 },
    ])
  })

  it('checks npm options before run and run-script', () => {
    expect(missingDocScripts([
      'npm --loglevel error run definitely-missing',
      'npm --loglevel error run-script missing:alias',
      'npm --loglevel=error --silent run missing:equals',
      'npm --prefix "./app directory" --loglevel error run-script missing:prefix',
      'npm -w app run missing:workspace',
      'npm --loglevel error run test',
      'npm --loglevel error run-script test',
      'npm install package',
      'npm exec -- echo run unrelated',
    ].join('\n'), { test: 'vitest run' })).toEqual([
      { script: 'definitely-missing', line: 1 },
      { script: 'missing:alias', line: 2 },
      { script: 'missing:equals', line: 3 },
      { script: 'missing:prefix', line: 4 },
      { script: 'missing:workspace', line: 5 },
    ])
  })

  it.each(['\n', '\r\n'])('joins continued shell words and retains source lines (%j)', (newline) => {
    expect(missingDocScripts([
      'npm run test\\',
      '+missing',
      'npm run-script "test\\',
      '+quoted"',
      'npm --loglevel \\',
      'error run-script test\\',
      '+option',
      'npm ru\\',
      'n test',
      'npm run valid\\',
      '+script',
      'npm run after:continuations',
    ].join(newline), { test: 'vitest run', 'valid+script': 'true' })).toEqual([
      { script: 'test+missing', line: 1 },
      { script: 'test+quoted', line: 3 },
      { script: 'test+option', line: 5 },
      { script: 'after:continuations', line: 12 },
    ])
  })

  it('checks tracked Markdown against the selected repository and exits nonzero for a missing script', () => {
    const root = mkdtempSync(join(tmpdir(), 'doc-scripts-'))
    roots.push(root)
    mkdirSync(join(root, 'docs'))
    writeFileSync(join(root, 'package.json'), JSON.stringify({ scripts: { build: 'build' } }))
    writeFileSync(join(root, 'README.md'), 'npm run build\n')
    writeFileSync(join(root, 'docs/usage.mdx'), 'npm run missing\n')
    writeFileSync(join(root, 'untracked.md'), 'npm run ignored\n')
    execFileSync('git', ['init', '--quiet', root])
    execFileSync('git', ['add', 'README.md', 'docs/usage.mdx'], { cwd: root })
    expect(checkDocScripts(root)).toEqual([{ file: 'docs/usage.mdx', line: 1, script: 'missing' }])
    const command = resolve('scripts/ci/check-doc-scripts.mjs')
    const failed = spawnSync(process.execPath, [command, root], { encoding: 'utf8' })
    expect(failed.status).toBe(1)
    expect(failed.stderr).toContain('docs/usage.mdx:1: npm script "missing"')
    writeFileSync(join(root, 'package.json'), JSON.stringify({ scripts: { build: 'build', missing: 'test' } }))
    expect(checkDocScripts(root)).toEqual([])
    expect(spawnSync(process.execPath, [command, root]).status).toBe(0)
  })

  it('keeps repository documentation runnable', () => {
    expect(checkDocScripts()).toEqual([])
  })
})
