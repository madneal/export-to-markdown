(function (root) {
  'use strict'

  function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase()
  }

  function escapeHeading(value) {
    return String(value || 'Untitled page')
      .replace(/\\/g, '\\\\')
      .replace(/([`*_{}\[\]<>])/g, '\\$1')
      .replace(/\r?\n/g, ' ')
      .trim()
  }

  function prepareContent(html, title) {
    const parsed = new DOMParser().parseFromString(String(html || ''), 'text/html')
    parsed.querySelectorAll('script, style, noscript, template, iframe, object, embed').forEach(function (element) {
      element.remove()
    })

    const firstHeading = parsed.body.querySelector('h1, h2, h3')
    if (firstHeading && normalizeText(firstHeading.textContent) === normalizeText(title)) {
      firstHeading.remove()
    }

    return parsed.body.innerHTML
  }

  function createTurndownService() {
    if (typeof root.TurndownService !== 'function') {
      throw new Error('The Markdown converter could not be loaded.')
    }

    const service = new root.TurndownService({
      headingStyle: 'atx',
      bulletListMarker: '-',
      codeBlockStyle: 'fenced',
      fence: '```',
      emDelimiter: '_',
      strongDelimiter: '**',
      linkStyle: 'inlined'
    })

    if (root.turndownPluginGfm && root.turndownPluginGfm.gfm) {
      service.use(root.turndownPluginGfm.gfm)
    }

    return service
  }

  function convertArticle(article) {
    if (!article || !article.content) {
      throw new Error('No webpage content was provided for conversion.')
    }

    const title = String(article.title || 'Untitled page').trim() || 'Untitled page'
    const content = prepareContent(article.content, title)
    const markdownBody = createTurndownService().turndown(content).trim()

    if (!markdownBody) {
      throw new Error('The webpage content did not produce any Markdown.')
    }

    return '# ' + escapeHeading(title) + '\n\n' + markdownBody
  }

  root.MarkdownConverter = {
    convertArticle: convertArticle
  }
})(globalThis)
