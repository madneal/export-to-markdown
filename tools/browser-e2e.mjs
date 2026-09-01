import assert from 'node:assert/strict'
import { readFile, mkdtemp, rm, writeFile } from 'node:fs/promises'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const extensionPath = path.resolve(process.env.EXTENSION_PATH || projectRoot)
const fixtureDirectory = path.join(projectRoot, 'tests', 'fixtures')
const userDataDirectory = await mkdtemp(path.join(os.tmpdir(), 'export-to-markdown-e2e-'))
const screenshotPath = path.join(os.tmpdir(), 'export-to-markdown-0.3.2-e2e.png')
const executablePath = process.env.CHROME_PATH || chromium.executablePath()
const results = []
const server = createFixtureServer()

let context
try {
  const port = await listen(server)
  const fixtureBaseUrl = 'http://127.0.0.1:' + port

  context = await chromium.launchPersistentContext(userDataDirectory, {
    executablePath,
    headless: false,
    viewport: { width: 1280, height: 800 },
    args: [
      '--disable-extensions-except=' + extensionPath,
      '--load-extension=' + extensionPath,
      '--enable-unsafe-extension-debugging'
    ]
  })

  const browserSession = await context.browser().newBrowserCDPSession()
  const extensionList = await browserSession.send('Extensions.getExtensions')
  const extension = extensionList.extensions.find(function (item) {
    return path.resolve(item.path) === extensionPath
  })

  assert.ok(extension, 'The unpacked extension was not loaded.')
  assert.equal(extension.name, 'Export to Markdown')
  assert.equal(extension.version, '0.3.2')
  assert.equal(extension.enabled, true)

  const harness = createExtensionHarness(context, browserSession, extension)

  const richArticle = await harness.convertPage({
    name: 'rich article fixture',
    url: fixtureBaseUrl + '/article.html',
    expected: /Building Reliable Conversion Pipelines/,
    minimumMarkdownLength: 700,
    expectedStatus: /Readability/
  })
  assert.match(richArticle.markdown, /\| Readability\s+\| Extract content\s+\|/)
  assert.doesNotMatch(richArticle.markdown, /Pricing Subscribe/)

  await richArticle.popup.screenshot(screenshotPath)
  await richArticle.popup.click('#copy-button', true)
  assert.equal(await richArticle.popup.text('#status'), 'Markdown copied to clipboard.')

  await richArticle.popup.clickAndWaitForConversion('#export-button')
  await waitForCompletedStatus(richArticle.popup)
  assert.equal(await richArticle.popup.value('#source'), richArticle.markdown)

  await richArticle.popup.click('#history-button')
  assert.equal(await richArticle.popup.count('.history-item'), 1)
  assert.match(await richArticle.popup.text('.history-title'), /Building Reliable Conversion Pipelines/)
  results.push({ name: 'copy, retry, and history', status: 'passed' })
  await richArticle.popup.close()
  await richArticle.page.close()

  const shortPage = await harness.convertPage({
    name: 'short semantic page fixture',
    url: fixtureBaseUrl + '/short-page.html',
    expected: /Short Release Note/,
    minimumMarkdownLength: 80,
    expectedStatus: /page fallback/
  })
  await shortPage.popup.close()
  await shortPage.page.close()

  const chromeDocs = await harness.convertPage({
    name: 'live Chrome Manifest V3 documentation',
    url: 'https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3',
    expected: /Manifest V3/i,
    minimumMarkdownLength: 1200,
    expectedStatus: /Readability|page fallback/,
    settleTime: 1500
  })
  await chromeDocs.popup.close()
  await chromeDocs.page.close()

  const mdnDocs = await harness.convertPage({
    name: 'live MDN DOM documentation',
    url: 'https://developer.mozilla.org/en-US/docs/Web/API/Document_Object_Model/Introduction',
    expected: /Document Object Model|DOM/i,
    minimumMarkdownLength: 1200,
    expectedStatus: /Readability/,
    settleTime: 1500
  })
  await mdnDocs.popup.close()
  await mdnDocs.page.close()

  const restrictedPage = await context.newPage()
  await restrictedPage.goto('chrome://extensions/')
  const restrictedPopup = await harness.openPopup(restrictedPage)
  await waitForCompletedStatus(restrictedPopup)
  assert.equal(await restrictedPopup.attribute('#status', 'data-state'), 'error')
  assert.match(
    await restrictedPopup.text('#status'),
    /only allows this extension to convert HTTP and HTTPS webpages/
  )
  assert.equal(await restrictedPopup.value('#source'), '')
  results.push({ name: 'protected Chrome page error', status: 'passed' })
  await restrictedPopup.close()
  await restrictedPage.close()

  console.log(JSON.stringify({
    browser: await context.browser().version(),
    extension: {
      id: extension.id,
      name: extension.name,
      version: extension.version,
      enabled: extension.enabled,
      path: extensionPath
    },
    results,
    screenshotPath
  }, null, 2))
} finally {
  if (context) await context.close()
  await closeServer(server)
  await rm(userDataDirectory, { recursive: true, force: true })
}

function createFixtureServer() {
  return http.createServer(async function (request, response) {
    const pathname = new URL(request.url, 'http://127.0.0.1').pathname

    if (pathname === '/images/pipeline.png') {
      response.writeHead(204)
      response.end()
      return
    }

    const fixtures = {
      '/article.html': 'article.html',
      '/short-page.html': 'short-page.html'
    }
    const fixture = fixtures[pathname]
    if (!fixture) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      response.end('Not found')
      return
    }

    const body = await readFile(path.join(fixtureDirectory, fixture))
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    response.end(body)
  })
}

function listen(fixtureServer) {
  return new Promise(function (resolve, reject) {
    fixtureServer.once('error', reject)
    fixtureServer.listen(0, '127.0.0.1', function () {
      resolve(fixtureServer.address().port)
    })
  })
}

function closeServer(fixtureServer) {
  return new Promise(function (resolve) {
    if (!fixtureServer.listening) {
      resolve()
      return
    }
    fixtureServer.close(resolve)
  })
}

function createExtensionHarness(browserContext, browserSession, extension) {
  const extensionOrigin = 'chrome-extension://' + extension.id

  async function targetIdFor(page) {
    const deadline = Date.now() + 10000
    while (Date.now() < deadline) {
      const targets = await browserSession.send('Target.getTargets', {
        filter: [{ type: 'tab' }, { exclude: true }]
      })
      const target = targets.targetInfos.find(function (item) {
        return item.type === 'tab' && item.url === page.url()
      })
      if (target) return target.targetId
      await new Promise(function (resolve) { setTimeout(resolve, 100) })
    }
    throw new Error('Could not find the Chrome target for ' + page.url())
  }

  async function openPopup(page) {
    await page.bringToFront()
    const targetId = await targetIdFor(page)
    await browserSession.send('Extensions.triggerAction', { id: extension.id, targetId })

    const deadline = Date.now() + 10000
    while (Date.now() < deadline) {
      const targets = await browserSession.send('Target.getTargets', { filter: [{}] })
      const popupTarget = targets.targetInfos.find(function (candidate) {
        return candidate.type === 'page' && candidate.url === extensionOrigin + '/popup.html'
      })
      if (popupTarget) {
        const popupTab = targets.targetInfos.find(function (candidate) {
          return candidate.type === 'tab' && candidate.url === extensionOrigin + '/popup.html'
        })
        return attachToPopup(browserSession, popupTarget.targetId, popupTab && popupTab.targetId)
      }
      await new Promise(function (resolve) { setTimeout(resolve, 100) })
    }
    throw new Error('The extension popup did not open for ' + page.url())
  }

  async function convertPage(options) {
    const page = await browserContext.newPage()
    const response = await page.goto(options.url, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    })
    if (/^https?:/.test(options.url)) {
      assert.ok(response && response.ok(), options.name + ' returned an unsuccessful HTTP response.')
    }
    if (options.settleTime) await page.waitForTimeout(options.settleTime)

    const popup = await openPopup(page)
    await waitForCompletedStatus(popup)

    const statusState = await popup.attribute('#status', 'data-state')
    const statusText = await popup.text('#status')
    const markdown = await popup.value('#source')

    assert.equal(statusState, 'success', options.name + ': ' + statusText)
    assert.match(statusText, options.expectedStatus)
    assert.match(markdown, options.expected)
    assert.ok(
      markdown.length >= options.minimumMarkdownLength,
      options.name + ' produced only ' + markdown.length + ' Markdown characters.'
    )
    assert.deepEqual(popup.exceptions, [], options.name + ' reported popup errors.')

    const externalResources = await popup.evaluate(
      'performance.getEntriesByType("resource")' +
      '.map(function (entry) { return entry.name })' +
      '.filter(function (url) { return !url.startsWith(' + JSON.stringify(extensionOrigin) + ') })'
    )
    assert.deepEqual(externalResources, [], options.name + ' loaded a remote popup resource.')

    results.push({
      name: options.name,
      status: 'passed',
      extraction: statusText,
      markdownLength: markdown.length
    })
    return { page, popup, markdown }
  }

  return { openPopup, convertPage }
}

async function attachToPopup(browserSession, pageTargetId, tabTargetId) {
  const attached = await browserSession.send('Target.attachToTarget', {
    targetId: pageTargetId,
    flatten: false
  })
  const sessionId = attached.sessionId
  const pending = new Map()
  const exceptions = []
  let nextMessageId = 0

  function handleTargetMessage(event) {
    if (event.sessionId !== sessionId) return
    const message = JSON.parse(event.message)

    if (message.id && pending.has(message.id)) {
      const request = pending.get(message.id)
      pending.delete(message.id)
      if (message.error) request.reject(new Error(message.error.message))
      else request.resolve(message.result || {})
      return
    }

    if (message.method === 'Runtime.exceptionThrown') {
      const details = message.params && message.params.exceptionDetails
      exceptions.push(
        details && details.exception && details.exception.description ||
        details && details.text ||
        'Unknown popup exception'
      )
    }
  }

  browserSession.on('Target.receivedMessageFromTarget', handleTargetMessage)

  async function send(method, params = {}) {
    const id = ++nextMessageId
    const result = new Promise(function (resolve, reject) {
      pending.set(id, { resolve, reject })
    })

    try {
      await browserSession.send('Target.sendMessageToTarget', {
        sessionId,
        message: JSON.stringify({ id, method, params })
      })
    } catch (error) {
      pending.delete(id)
      throw error
    }

    return result
  }

  async function evaluate(expression, userGesture = false) {
    const response = await send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture
    })
    if (response.exceptionDetails) {
      const exception = response.exceptionDetails.exception
      throw new Error(exception && exception.description || response.exceptionDetails.text)
    }
    return response.result && response.result.value
  }

  async function waitFor(expression, timeout = 10000) {
    const deadline = Date.now() + timeout
    while (Date.now() < deadline) {
      try {
        if (await evaluate(expression)) return
      } catch (error) {
        // The popup document may still be initializing.
      }
      await new Promise(function (resolve) { setTimeout(resolve, 50) })
    }
    throw new Error('Timed out waiting for popup state: ' + expression)
  }

  function selectorExpression(selector, body) {
    return '(function () {' +
      'const element = document.querySelector(' + JSON.stringify(selector) + ');' +
      'if (!element) throw new Error("Missing popup element: " + ' + JSON.stringify(selector) + ');' +
      body +
      '})()'
  }

  const popup = {
    exceptions,
    evaluate,
    waitFor,
    text(selector) {
      return evaluate(selectorExpression(selector, 'return element.textContent;'))
    },
    value(selector) {
      return evaluate(selectorExpression(selector, 'return element.value;'))
    },
    attribute(selector, name) {
      return evaluate(selectorExpression(selector, 'return element.getAttribute(' + JSON.stringify(name) + ');'))
    },
    count(selector) {
      return evaluate('document.querySelectorAll(' + JSON.stringify(selector) + ').length')
    },
    click(selector, userGesture = false) {
      return evaluate(selectorExpression(selector, 'element.click(); return true;'), userGesture)
    },
    clickAndWaitForConversion(selector) {
      return evaluate(
        'new Promise(function (resolve, reject) {' +
        'const status = document.querySelector("#status");' +
        'const button = document.querySelector(' + JSON.stringify(selector) + ');' +
        'if (!status || !button) { reject(new Error("Missing retry controls")); return; }' +
        'let started = false;' +
        'const timeout = setTimeout(function () {' +
        'observer.disconnect(); reject(new Error("Retry timed out"));' +
        '}, 20000);' +
        'const observer = new MutationObserver(function () {' +
        'if (status.dataset.state === "idle") started = true;' +
        'if (started && status.dataset.state !== "idle") {' +
        'clearTimeout(timeout); observer.disconnect(); resolve(status.textContent);' +
        '}' +
        '});' +
        'observer.observe(status, { attributes: true, childList: true, subtree: true });' +
        'button.click();' +
        'if (status.dataset.state === "idle") started = true;' +
        '})',
        true
      )
    },
    async screenshot(destination) {
      const capture = await send('Page.captureScreenshot', { format: 'png', fromSurface: true })
      await writeFile(destination, Buffer.from(capture.data, 'base64'))
    },
    async close() {
      browserSession.off('Target.receivedMessageFromTarget', handleTargetMessage)
      await browserSession.send('Target.closeTarget', { targetId: tabTargetId || pageTargetId })
    }
  }

  await send('Runtime.enable')
  await send('Page.enable')
  await popup.waitFor('document.readyState !== "loading"')
  return popup
}

async function waitForCompletedStatus(popup) {
  await popup.waitFor(
    'document.querySelector("#status") && document.querySelector("#status").dataset.state !== "idle"',
    20000
  )
}
