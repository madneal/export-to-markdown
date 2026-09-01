(function () {
  'use strict'

  const HISTORY_KEY = 'exportToMarkdownHistoryV2'
  const MAX_HISTORY_ITEMS = 20
  const source = document.querySelector('#source')
  const status = document.querySelector('#status')
  const exportButton = document.querySelector('#export-button')
  const copyButton = document.querySelector('#copy-button')
  const historyButton = document.querySelector('#history-button')
  const historyPanel = document.querySelector('#history-panel')
  const historyList = document.querySelector('#history-list')
  const emptyHistory = document.querySelector('#empty-history')
  const loading = document.querySelector('#loading')

  exportButton.addEventListener('click', convertActivePage)
  copyButton.addEventListener('click', copyMarkdown)
  historyButton.addEventListener('click', toggleHistory)

  convertActivePage()

  function setStatus(message, state) {
    status.textContent = message
    status.dataset.state = state || 'idle'
  }

  function setBusy(isBusy) {
    loading.hidden = !isBusy
    exportButton.disabled = isBusy
    historyButton.disabled = isBusy
  }

  function queryActiveTab() {
    return new Promise(function (resolve, reject) {
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        const error = chrome.runtime.lastError
        if (error) {
          reject(new Error(error.message))
          return
        }
        resolve(tabs[0])
      })
    })
  }

  function isSupportedPage(url) {
    return /^https?:\/\//i.test(url || '')
  }

  async function extractActivePage(tabId) {
    const executions = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: [
        'scripts/vendor/Readability.js',
        'scripts/extractor.js'
      ]
    })
    return executions[0] && executions[0].result
  }

  async function convertActivePage() {
    setBusy(true)
    setStatus('Reading current page...', 'idle')
    showMarkdown()

    try {
      const activeTab = await queryActiveTab()
      if (!activeTab || !activeTab.id) throw new Error('No active webpage was found.')
      if (!isSupportedPage(activeTab.url)) {
        throw new Error('Chrome only allows this extension to convert HTTP and HTTPS webpages.')
      }

      const article = await extractActivePage(activeTab.id)
      if (!article || !article.content) {
        throw new Error('No readable content was found on this page.')
      }

      const markdown = MarkdownConverter.convertArticle(article)
      source.value = markdown
      copyButton.disabled = false
      saveHistory(article.title, article.url)

      const method = article.extractionMethod === 'readability' ? 'Readability' : 'page fallback'
      setStatus('Converted ' + article.length + ' characters with ' + method + '.', 'success')
    } catch (error) {
      console.error('Export failed:', error)
      source.value = ''
      copyButton.disabled = true
      setStatus(formatError(error), 'error')
    } finally {
      setBusy(false)
    }
  }

  function formatError(error) {
    const message = error && error.message ? error.message : 'The current page could not be converted.'
    if (/cannot access|extensions gallery|missing host permission/i.test(message)) {
      return 'Chrome does not allow extensions to read this page. Open a regular HTTP or HTTPS webpage.'
    }
    return message
  }

  async function copyMarkdown() {
    if (!source.value) return

    try {
      await navigator.clipboard.writeText(source.value)
    } catch (error) {
      source.focus()
      source.select()
      if (!document.execCommand('copy')) throw error
    }

    setStatus('Markdown copied to clipboard.', 'success')
  }

  function readHistory() {
    try {
      const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
      return Array.isArray(parsed) ? parsed : []
    } catch (error) {
      return []
    }
  }

  function saveHistory(title, url) {
    const nextItem = {
      title: String(title || 'Untitled page'),
      url: String(url || ''),
      convertedAt: new Date().toISOString()
    }
    const history = readHistory().filter(function (item) {
      return item.url !== nextItem.url
    })
    history.unshift(nextItem)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY_ITEMS)))
  }

  function toggleHistory() {
    if (historyPanel.hidden) {
      renderHistory()
      source.hidden = true
      historyPanel.hidden = false
      historyButton.textContent = 'Back to Markdown'
    } else {
      showMarkdown()
    }
  }

  function showMarkdown() {
    source.hidden = false
    historyPanel.hidden = true
    historyButton.textContent = 'History'
  }

  function renderHistory() {
    const history = readHistory()
    historyList.replaceChildren()
    emptyHistory.hidden = history.length > 0

    history.forEach(function (item, index) {
      const row = document.createElement('li')
      row.className = 'history-item'

      const details = document.createElement('div')
      const title = document.createElement('div')
      title.className = 'history-title'
      title.textContent = item.title
      const url = document.createElement('div')
      url.className = 'history-url'
      url.textContent = item.url
      details.append(title, url)

      const deleteButton = document.createElement('button')
      deleteButton.type = 'button'
      deleteButton.className = 'delete-history'
      deleteButton.textContent = 'Remove'
      deleteButton.addEventListener('click', function () {
        const updated = readHistory()
        updated.splice(index, 1)
        localStorage.setItem(HISTORY_KEY, JSON.stringify(updated))
        renderHistory()
      })

      row.append(details, deleteButton)
      historyList.appendChild(row)
    })
  }
})()
