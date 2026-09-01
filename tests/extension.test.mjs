import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { JSDOM } from 'jsdom'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

async function read(relativePath) {
  return readFile(path.join(root, relativePath), 'utf8')
}

async function extractFixture(fixture, url) {
  const dom = new JSDOM(await read('tests/fixtures/' + fixture), {
    runScripts: 'outside-only',
    url
  })
  dom.window.eval(await read('scripts/vendor/Readability.js'))
  return dom.window.eval(await read('scripts/extractor.js'))
}

async function createConverter() {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    runScripts: 'outside-only',
    url: 'https://example.com/'
  })
  dom.window.eval(await read('scripts/vendor/turndown.js'))
  dom.window.eval(await read('scripts/vendor/turndown-plugin-gfm.js'))
  dom.window.eval(await read('scripts/converter.js'))
  return dom.window.MarkdownConverter
}

test('Readability extracts a complete article and removes surrounding chrome', async function () {
  const result = await extractFixture('article.html', 'https://example.com/posts/reliable-conversion')

  assert.equal(result.title, 'Building Reliable Conversion Pipelines')
  assert.equal(result.extractionMethod, 'readability')
  assert.ok(result.length > 500)
  assert.match(result.content, /Extract the meaningful content/)
  assert.match(result.content, /https:\/\/example\.com\/guides\/extraction/)
  assert.match(result.content, /https:\/\/example\.com\/images\/pipeline\.png/)
  assert.doesNotMatch(result.content, /Pricing Subscribe/)
  assert.doesNotMatch(result.content, /promotional content/)
})

test('semantic fallback converts short content that Readability intentionally skips', async function () {
  const result = await extractFixture('short-page.html', 'https://example.com/releases/short')

  assert.equal(result.title, 'Short Release Note')
  assert.equal(result.extractionMethod, 'semantic-fallback')
  assert.match(result.content, /deployment is healthy/)
  assert.doesNotMatch(result.content, /Pricing Contact/)
  assert.doesNotMatch(result.content, /account controls/)
})

test('semantic quality comparison replaces an incomplete Readability result', async function () {
  const result = await extractFixture('documentation.html', 'https://example.com/docs/architecture')

  assert.equal(result.title, 'Extension Architecture Guide')
  assert.equal(result.extractionMethod, 'semantic-fallback')
  assert.match(result.content, /Design the extraction stage/)
  assert.match(result.content, /This final section must be present/)
  assert.doesNotMatch(result.content, /Products Blog Account Search/)
  assert.doesNotMatch(result.content, /Design Convert Test/)
})

test('Turndown produces readable GFM without duplicating the article title', async function () {
  const article = await extractFixture('article.html', 'https://example.com/posts/reliable-conversion')
  const converter = await createConverter()
  const markdown = converter.convertArticle(article)

  assert.match(markdown, /^# Building Reliable Conversion Pipelines\n/)
  assert.equal((markdown.match(/^# Building Reliable Conversion Pipelines$/gm) || []).length, 1)
  assert.match(markdown, /\[extraction guide\]\(https:\/\/example\.com\/guides\/extraction\)/)
  assert.match(markdown, /!\[Conversion pipeline\]\(https:\/\/example\.com\/images\/pipeline\.png\)/)
  assert.match(markdown, /```js\nconst markdown = convert\(article\.content\)\n```/)
  assert.match(markdown, /\| Stage\s+\| Responsibility\s+\|/)
  assert.match(markdown, /\| Readability\s+\| Extract content\s+\|/)
})

test('manifest uses temporary page access and only bundled scripts', async function () {
  const manifest = JSON.parse(await read('manifest.json'))
  const popup = await read('popup.html')
  const customScripts = await Promise.all([
    read('scripts/extractor.js'),
    read('scripts/converter.js'),
    read('scripts/widget.js')
  ])

  assert.equal(manifest.manifest_version, 3)
  assert.equal(manifest.version, '0.3.2')
  assert.deepEqual(manifest.permissions.slice().sort(), ['activeTab', 'scripting'])
  assert.equal(Object.hasOwn(manifest, 'host_permissions'), false)
  assert.doesNotMatch(popup, /<script[^>]+src=["']https?:\/\//i)
  assert.doesNotMatch(customScripts.join('\n'), /\bfetch\s*\(/)
  assert.doesNotMatch(customScripts.join('\n'), /\beval\s*\(/)

  const thirdPartyLicenses = await Promise.all([
    read('third_party/Readability-LICENSE.txt'),
    read('third_party/Turndown-LICENSE.txt'),
    read('third_party/Turndown-Plugin-GFM-LICENSE.txt')
  ])
  assert.match(thirdPartyLicenses[0], /Apache License/)
  assert.match(thirdPartyLicenses[1], /MIT License/)
  assert.match(thirdPartyLicenses[2], /MIT License/)
})
