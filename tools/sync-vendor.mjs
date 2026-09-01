import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const checkOnly = process.argv.includes('--check')
const mappings = [
  ['node_modules/@mozilla/readability/Readability.js', 'scripts/vendor/Readability.js'],
  ['node_modules/turndown/dist/turndown.js', 'scripts/vendor/turndown.js'],
  ['node_modules/turndown-plugin-gfm/dist/turndown-plugin-gfm.js', 'scripts/vendor/turndown-plugin-gfm.js'],
  ['node_modules/@mozilla/readability/LICENSE.md', 'third_party/Readability-LICENSE.txt'],
  ['node_modules/turndown/LICENSE', 'third_party/Turndown-LICENSE.txt'],
  ['node_modules/turndown-plugin-gfm/LICENSE', 'third_party/Turndown-Plugin-GFM-LICENSE.txt']
]

let hasMismatch = false

for (const [sourcePath, destinationPath] of mappings) {
  const source = await readFile(path.join(root, sourcePath))
  const destination = path.join(root, destinationPath)

  if (checkOnly) {
    let existing = null
    try {
      existing = await readFile(destination)
    } catch (error) {
      hasMismatch = true
      console.error(destinationPath + ' is missing. Run npm run vendor.')
      continue
    }

    if (!source.equals(existing)) {
      hasMismatch = true
      console.error(destinationPath + ' does not match the locked dependency.')
    }
  } else {
    await mkdir(path.dirname(destination), { recursive: true })
    await writeFile(destination, source)
    console.log('Updated ' + destinationPath)
  }
}

if (hasMismatch) process.exitCode = 1
