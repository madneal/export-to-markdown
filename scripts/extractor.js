(function () {
  'use strict'

  const MIN_CONTENT_LENGTH = 40
  const READABILITY_MIN_CONTENT_LENGTH = 120
  const REMOVABLE_ELEMENTS = [
    'script',
    'style',
    'noscript',
    'template',
    'nav',
    'footer',
    'aside',
    'form',
    'dialog',
    '[role="navigation"]',
    '[role="complementary"]',
    '[aria-hidden="true"]',
    '.advertisement',
    '.advertising',
    '.ads',
    '.cookie-banner',
    '.modal',
    '.newsletter',
    '.popup',
    '.related',
    '.share',
    '.sidebar',
    '.table-of-contents',
    '.toc'
  ].join(',')

  function cleanContent(root) {
    root.querySelectorAll(REMOVABLE_ELEMENTS).forEach(function (element) {
      element.remove()
    })
  }

  function resolveResourceUrls(root, baseUrl) {
    root.querySelectorAll('[href], [src]').forEach(function (element) {
      for (const attribute of ['href', 'src']) {
        const value = element.getAttribute(attribute)
        if (!value || value.startsWith('#')) continue

        try {
          const resolved = new URL(value, baseUrl)
          const allowedProtocols = attribute === 'href'
            ? ['http:', 'https:', 'mailto:', 'tel:']
            : ['http:', 'https:']

          if (allowedProtocols.includes(resolved.protocol)) {
            element.setAttribute(attribute, resolved.href)
          } else {
            element.removeAttribute(attribute)
          }
        } catch (error) {
          element.removeAttribute(attribute)
        }
      }
    })
  }

  function serializeContent(html, baseUrl) {
    const container = document.createElement('div')
    container.innerHTML = html
    cleanContent(container)
    resolveResourceUrls(container, baseUrl)
    return container.innerHTML
  }

  function textLength(element) {
    return (element.textContent || '').replace(/\s+/g, ' ').trim().length
  }

  function linkTextLength(element) {
    return Array.from(element.querySelectorAll('a')).reduce(function (total, link) {
      return total + textLength(link)
    }, 0)
  }

  function findFallbackContent(sourceDocument) {
    const clone = sourceDocument.cloneNode(true)
    cleanContent(clone)

    const selectors = [
      'article',
      'main',
      '[role="main"]',
      '[itemprop="articleBody"]',
      '.article-content',
      '.article-body',
      '.entry-content',
      '.post-content'
    ]
    const candidates = []

    selectors.forEach(function (selector) {
      clone.querySelectorAll(selector).forEach(function (element) {
        if (!candidates.includes(element)) candidates.push(element)
      })
    })
    if (candidates.length === 0 && clone.body) candidates.push(clone.body)

    const bestCandidate = candidates.reduce(function (best, candidate) {
      const length = textLength(candidate)
      const score = length - Math.round(linkTextLength(candidate) * 0.35)
      if (!best || score > best.score) return { element: candidate, score: score, length: length }
      return best
    }, null)

    if (!bestCandidate || bestCandidate.length < MIN_CONTENT_LENGTH) return null

    resolveResourceUrls(bestCandidate.element, sourceDocument.baseURI)
    return {
      title: sourceDocument.title || 'Untitled page',
      byline: null,
      excerpt: null,
      content: bestCandidate.element.innerHTML,
      textContent: bestCandidate.element.textContent || '',
      length: bestCandidate.length,
      extractionMethod: 'semantic-fallback'
    }
  }

  function extractWithReadability(sourceDocument) {
    if (typeof Readability !== 'function') return null

    const article = new Readability(sourceDocument.cloneNode(true), {
      charThreshold: 80,
      keepClasses: true
    }).parse()

    if (!article || !article.content || textLengthFromString(article.textContent) < READABILITY_MIN_CONTENT_LENGTH) {
      return null
    }

    article.content = serializeContent(article.content, sourceDocument.baseURI)
    article.extractionMethod = 'readability'
    return article
  }

  function textLengthFromString(value) {
    return String(value || '').replace(/\s+/g, ' ').trim().length
  }

  function chooseBestExtraction(readableArticle, fallbackArticle) {
    if (!readableArticle) return fallbackArticle
    if (!fallbackArticle) return readableArticle

    const readableLength = textLengthFromString(readableArticle.textContent)
    const fallbackLength = textLengthFromString(fallbackArticle.textContent)
    const fallbackHasSubstantiallyMoreContent =
      fallbackLength >= readableLength + 400 &&
      fallbackLength >= readableLength * 1.5

    return fallbackHasSubstantiallyMoreContent ? fallbackArticle : readableArticle
  }

  if (!document.body) throw new Error('The current page has no readable document body.')

  let readableArticle = null
  try {
    readableArticle = extractWithReadability(document)
  } catch (error) {
    console.warn('Readability extraction failed; using semantic fallback.', error)
  }

  const article = chooseBestExtraction(readableArticle, findFallbackContent(document))
  if (!article || !article.content) {
    throw new Error('No readable content was found on this page.')
  }

  return {
    title: article.title || document.title || 'Untitled page',
    byline: article.byline || null,
    excerpt: article.excerpt || null,
    content: article.content,
    textContent: article.textContent || '',
    length: article.length || textLengthFromString(article.textContent),
    extractionMethod: article.extractionMethod,
    url: document.location.href
  }
})()
