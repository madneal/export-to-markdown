let mainDiv = document.querySelector('.main')
const loadIcon = document.querySelector('.load')
const sourceDiv = document.querySelector('#source')
const copyBtn = document.querySelector('.copy')
const rightAreaDiv = document.querySelector('.right-area')
const MEDIUM_IMG_CDN = 'https://cdn-images-1.medium.com/max/'
const exportBtn = document.querySelector('.export')

window.onload = function() {
  if (sourceDiv.style.display === 'none') {
    sourceDiv.style.display = null
  }
  exportActivePage()
}

exportBtn.addEventListener('click', exportActivePage)

document.querySelector('.copy').addEventListener('click', function () {
  copyBtn.innerText = 'copied'
  const value = document.querySelector('#source').value
  copyToClipboard(value);
  setTimeout(function() {
    copyBtn.innerText = 'copy to clipboard'
  }, 2000)
})

document.querySelector('.history').addEventListener('click', function() {
  displayHistory()
  document.querySelector('.history-list').addEventListener('click', function (event) {
    const parentLi = event.target.parentElement
    const deletedKey = parentLi.firstElementChild.innerText
    parentLi.remove()
    localStorage.removeItem(deletedKey)
  })
})

function createLoadForm() {
  const existingShadow = document.querySelector('#shadow')
  if (existingShadow) existingShadow.remove()
  let shadow = document.createElement('div')
  shadow.id = 'shadow'
  const oHeight = document.documentElement.scrollHeight
  shadow.style.height = oHeight + 'px'
  mainDiv.appendChild(shadow)
}

function cancelLoad() {
  const shadow = document.querySelector('#shadow')
  if (shadow) shadow.remove()
  loadIcon.style.visibility = 'hidden'
}

async function exportActivePage() {
  createLoadForm()
  loadIcon.style.visibility = 'visible'
  exportBtn.disabled = true

  try {
    const [activeTab] = await new Promise(function (resolve) {
      chrome.tabs.query({ active: true, currentWindow: true }, resolve)
    })

    if (!activeTab || !activeTab.id || !activeTab.url) {
      throw new Error('No active webpage found.')
    }

    if (!/^https?:\/\//i.test(activeTab.url)) {
      throw new Error('This page cannot be exported. Open an HTTP or HTTPS webpage.')
    }

    let result = null
    if (activeTab.url.includes('medium.com')) {
      try {
        result = await exportMediumArticle(activeTab.url)
      } catch (error) {
        console.warn('Medium JSON export failed; falling back to page content.', error)
      }
    }

    if (!result) {
      const executions = await chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        func: extractPageContent
      })
      result = executions[0] && executions[0].result
    }

    if (!result || (!result.content && !result.markdown)) {
      throw new Error('No article content could be found on this page.')
    }

    const title = result.title || activeTab.title || 'Untitled page'
    let markdownText
    if (result.markdown) {
      markdownText = '# ' + title + '\n\n' + result.markdown.trim()
    } else {
      const turndownService = new TurndownService()
      const titleHtml = escapeHtml(title)
      markdownText = turndownService.turndown(
        '<h1>' + titleHtml + '</h1>' + result.content
      ).trim()
    }

    saveHistory(title, result.url || activeTab.url)
    sourceDiv.style.display = null
    sourceDiv.value = markdownText
  } catch (error) {
    console.error('Export failed:', error)
    sourceDiv.style.display = null
    sourceDiv.value = error.message || 'The current page could not be exported.'
  } finally {
    exportBtn.disabled = false
    cancelLoad()
  }
}

async function exportMediumArticle(url) {
  const separator = url.includes('?') ? '&' : '?'
  const response = await fetch(url + separator + 'format=json')
  if (!response.ok) throw new Error('Medium returned HTTP ' + response.status)

  const story = parseJsonToMarkdown(await response.text())
  if (!story || !story.markdown) throw new Error('Invalid Medium article response')
  return {
    title: story.title,
    url: url,
    markdown: story.markdown.join('')
  }
}

function extractPageContent() {
  if (!document.body) throw new Error('Document body not found.')

  const body = document.body.cloneNode(true)
  body.querySelectorAll(
    'script, style, noscript, nav, footer, aside, form, .ads, .advertisement, .comments, [role="complementary"], [role="navigation"], .cookie-banner, .popup, .overlay, .modal'
  ).forEach(function (element) {
    element.remove()
  })

  const selectors = [
    'article',
    'main',
    '[role="main"]',
    '#content',
    '.article-post-wrapper',
    '.post__content',
    '.post',
    '.entry',
    '.content'
  ]
  let content = null
  for (const selector of selectors) {
    const candidate = body.querySelector(selector)
    if (candidate && candidate.textContent.trim().length > 100) {
      content = candidate
      break
    }
  }
  content = content || body

  content.querySelectorAll('[href], [src]').forEach(function (element) {
    for (const attribute of ['href', 'src']) {
      const value = element.getAttribute(attribute)
      if (!value) continue
      try {
        const resolved = new URL(value, document.baseURI)
        if (resolved.protocol === 'http:' || resolved.protocol === 'https:') {
          element.setAttribute(attribute, resolved.href)
        } else {
          element.removeAttribute(attribute)
        }
      } catch (error) {
        element.removeAttribute(attribute)
      }
    }
  })

  return {
    title: document.title || 'Untitled page',
    url: document.location.href,
    content: content.innerHTML
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function saveHistory(title, url) {
  localStorage.setItem(title, url);
}

function displayHistory() {
  let list = ''
  for (const ele in localStorage) {
    const title = ele
    if (localStorage.hasOwnProperty(ele)) {
      const url = localStorage.getItem(title)
      const str = '* [' + title + '](' + url + ') ![trash](icons/trash-can.png)\n'
      list = list + str
    }
  }
  rightAreaDiv.innerHTML = snarkdown(list)
  rightAreaDiv.querySelector('ul').className = 'history-list'
  sourceDiv.style.display = 'none'
}

function parseJsonToMarkdown(jsonStr) {
  // cut the useless string to format json string
  const str = jsonStr.substring(16, jsonStr.length)
  const data = JSON.parse(str)
  let article = null
  if (!data.payload) {
    return null
  }
  article = data.payload.value || data.payload.post
  let story = {}
  story.title = article.title
  story.subtile = article.content.subtitle
  story.date = new Date(article.createdAt)
  story.url = article.canonicalUrl
  story.language = article.detectedLanguage
  story.license = article.license
  story.sections = article.content.bodyModel.sections
  story.paragraphs = article.content.bodyModel.paragraphs

  let sections = []
  for (let i = 0; i < story.sections.length; i++) {
    const s = story.sections[i]
    const section = processSection(s)
    sections[s.startIndex] = section
  }

  story.markdown = []

  const paragraphs = story.paragraphs
  let sequence = 0
  for (let i = 0; i < paragraphs.length; i++) {
    if (sections[i]) {
      story.markdown.push(sections[i])
    }
    const p = paragraphs[i];
    if (p.type === 10) {
      sequence++
    } else {
      sequence = 0
    }
    const text = processParagraph(p, sequence);
    lastPtype = p.type;
    if (text !== story.markdown[i]) {
      story.markdown.push(text)
    }
  }
  return story
}

function processSection(s) {
  let section = ''
  if (s.backgroundImage) {
    const imageWidth = parseInt(s.backgroundImage.originalWidth, 10)
    const imageSrc = MEDIUM_IMG_CDN + Math.max(imageWidth * 2, 2000) + '/' + s.backgroundImage.id
    section = '\n![](' + imageSrc + ')'
  }
  return section
}

function processParagraph(p, sequence) {
  const markups_array = createMarkupsArray(p.markups)
  if (markups_array.length > 0) {
    let previousIndex = 0, text = p.text, tokens = []
    let j = 0
    for (; j < markups_array.length; j++) {
      if (markups_array[j]) {
        token = text.substring(previousIndex, j)
        previousIndex = j
        tokens.push(token)
        tokens.push(markups_array[j])
      }
    }
    tokens = processMarkupSpace(tokens)
    tokens.push(text.substring(j - 1))
    p.text = tokens.join('')
  }

  let markup = ''
  switch (p.type) {
    case 1:
      markup = '\n'
      break
    case 2:
      p.text = '\n# ' + p.text.replace(/\n/g, '\n #')
      break
    case 3:
      p.text = '\n## ' + p.text.replace(/\n/g, '\n ##')
      break
    case 4:
      const imageWidth = parseInt(p.metadata.originalWidth, 10)
      const imageSrc = MEDIUM_IMG_CDN + Math.max(imageWidth * 2, 2000) + '/' + p.metadata
        .id
      p.text = '\n![' + p.text + '](' + imageSrc + ')'
      break
    case 6:
      markup = '>  '
      break
    case 7:
      p.text = '> # ' + p.text.replace(/\n/g, '\n> #')
      break
    case 8:
      p.text = '\n    ' + p.text.replace(/\n/g, '\n    ')
      break
    case 9:
      markup = '\n* '
      break
    case 10:
      markup = '\n ' + sequence + '. '
      break
    case 11:
      p.text = '\n <iframe src="https://medium.com/media/' + p.iframe.mediaResourceId + '" frameborder=0></iframe>'
      break
    case 13:
      markup = '\n### '
      break
    case 15:
      p.text = '*' + p.text + '*'
      break
  }

  p.text = markup + p.text + '\n'

  if (p.alignment === 2 && p.type !== 6 && p.type !== 7) {
    p.text = '<center>' + p.text + '</center>'
  }
  return p.text
}

// for the first position is space
function processMarkupSpace(tokens) {
  let times = 0 // markup times
  for (let i = 0; i < tokens.length; i++) {
    const ele = tokens[i]
    if (ele === '**' || ele === '*' || ele === '[' || ele === ']') {
      times = times + 1;
      if (times % 2 === 1 && tokens[i + 1] && tokens[i + 1][0] === ' ') {
        tokens[i + 1] = tokens[i + 1].substring(1);
        tokens[i - 1] = tokens[i - 1] + ' '
        i = i + 1;
      }
    }
  }
  return tokens;
}

function addMarkup(markups_array, open, close, start, end) {
  if (markups_array[start]) {
    markups_array[start] += open
  } else {
    markups_array[start] = open
  }
  if (markups_array[end]) {
    markups_array[end] += close
  } else {
    markups_array[end] = close
  }
  return markups_array
}

function createMarkupsArray(markups) {
  let markups_array = []
  if (!markups || markups.length === 0) {
    return markups_array
  }
  for (let i = 0; i < markups.length; i++) {
    const m = markups[i]
    switch (m.type) {
      case 1: // bold
        addMarkup(markups_array, '**', '**', m.start, m.end)
        break
      case 2: // italic
        addMarkup(markups_array, '*', '*', m.start, m.end)
        break
      case 3: // anchor tag
        addMarkup(markups_array, '[', '](' + m.href + ')', m.start, m.end)
        break
      // case 10: // code tag
      //   if (m.end - m.start < 30) {
      //     addMarkup(markups_array, '`', '`', m.start, m.end)
      //   }
      //   break
      default:
        console.log('Unknown markup type' + m.type, m)
        break
    }
  }
  return markups_array
}

function copyToClipboard(input) {
  const el = document.createElement('textarea');
  el.style.fontsize = '12pt'
  el.style.border = '0'
  el.style.padding = '0'
  el.style.margin = '0'
  el.style.position = 'absolute'
  el.style.left = '-9999px'
  el.setAttribute('readonly', '')
  el.value = input

  document.body.appendChild(el)
  el.select()

  let success = false;
  try {
    success = document.execCommand('copy', true);
  } catch (err) { }

  document.body.removeChild(el);
  return success;
}
