#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

// Standalone so other repositories can run this against their own package.json.
export function checkDocScripts(root = '.') {
  const { scripts = {} } = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
  const files = execFileSync('git', ['ls-files', '-z', '--', '*.md', '*.mdx', '*.markdown'], {
    cwd: root,
    encoding: 'utf8',
  }).split('\0').filter(Boolean)
  return files.flatMap((file) => {
    const source = readFileSync(resolve(root, file), 'utf8')
    return missingDocScripts(source, scripts).map((reference) => ({ file, ...reference }))
  })
}

export function missingDocScripts(source, scripts) {
  const word = /(?:"(?:\\[^\r\n]|[^"\\\r\n])*"|'[^'\r\n]*'|\\[^\r\n]|[^\s`"'\\;&|<>()])+/.source
  const commands = new RegExp(String.raw`\bnpm\s+(?:--?[\w-]+(?:=${word})?\s+(?:${word}\s+)??)*?run(?:-script)?\s+(?:(?:--silent|-s|--if-present)\s+)*(?:--\s+)?(${word})`, 'gu')
  const continuations = []
  let removed = 0
  // Shell continuations join words without a space; retain their source line offsets.
  const text = source.replace(/\\\r?\n/gu, (continuation, offset) => {
    continuations.push(offset - removed)
    removed += continuation.length
    return ''
  })
  return [...text.matchAll(commands)]
    .map((match) => ({
      // Quoted and unquoted pieces can form one shell word: "test"+removed.
      script: match[1].replace(/"((?:\\.|[^"\\])*)"|'([^']*)'|\\(.)/gu,
        (_, double, single, escaped) => double !== undefined
          ? double.replace(/\\(["\\$`])/gu, '$1')
          : single ?? escaped),
      line: text.slice(0, match.index).split('\n').length
        + continuations.filter((offset) => offset <= match.index).length,
    }))
    .filter(({ script }) => !Object.hasOwn(scripts, script))
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const missing = checkDocScripts(process.argv[2] ?? '.')
    for (const { file, line, script } of missing) {
      console.error(`${file}:${line}: npm script "${script}" is missing from package.json`)
    }
    if (missing.length) process.exitCode = 1
    else console.log('Documented npm scripts exist.')
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
