let mainDiv = document.querySelector('.main')
const loadIcon = document.querySelector('.load')
const exportBtn = document.querySelector('.export')

document.querySelector('.export').addEventListener('click', function () {
  createLoadForm()
  loadIcon.style.visibility = 'visible'
  exportMedium()
})

document.querySelector('.copy').addEventListener('click', function() {
  const value = document.querySelector('#source').value
  copyToClipboard(value);
})

const MEDIUM_IMG_CDN = 'https://cdn-images-1.medium.com/max/'

function createLoadForm() {
  let shadow = document.createElement('div')
  shadow.id = 'shadow'
  const oHeight = document.documentElement.scrollHeight
  shadow.style.height = oHeight + 'px'
  mainDiv.appendChild(shadow)
}

function cancelLoad() {
  const len = mainDiv.childNodes.length
  mainDiv.removeChild(mainDiv.childNodes[len - 1])
  loadIcon.style.visibility = 'hidden'
}

function exportMedium () {
  chrome.tabs.query({active: true, currentWindow: true}, function (arrayOfTabs) {
    const activeTab = arrayOfTabs[0]
    const url = activeTab.url + '?format=json'
    fetch(url)
      .then(function (res) {
        if (res.ok) {
          return res.text()
        } else {
          console.error('The fetch fails, and the response code is ' + res.status)
        }
      })
      .then(function (text) {
        const story = parseJsonToMarkdown(text)
        const markdownText = story.markdown.join('')
        cancelLoad()
        document.querySelector('#source').value = markdownText;
        document.querySelector('.right-area').innerHTML = snarkdown(markdownText);
      })
      .catch(function (err) {
        console.error(err)
      })
  })
}

function parseJsonToMarkdown (jsonStr) {
  // cut the useless string to format json string
  const str = jsonStr.substring(16, jsonStr.length)
  const data = JSON.parse(str)
  let article = null
  if (!data.payload) {
    return null
  }
  article = data.payload.value
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
  for (let i = 0; i < paragraphs.length; i++) {
    if (sections[i]) {
      story.markdown.push(sections[i])
    }
    const p = paragraphs[i];
    const text = processParagraph(p);
    if (text !== story.markdown[i]) {
      story.markdown.push(text)
    }
  }
  return story
}

function processSection (s) {
  let section = ''
  if (s.backgroundImage) {
    const imageWidth = parseInt(s.backgroundImage.originalWidth, 10)
    const imageSrc = MEDIYM_IMG_CDN + Math.max(imageWidth * 2, 2000) + '/' + s.backgroundImage.id
    section = '\n![](' + imageSrc + ')'
  }
  return section
}

function processParagraph (p) {
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
      markup = '\n 1. '
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

function addMarkup (markups_array, open, close, start, end) {
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

function createMarkupsArray (markups) {
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
	} catch (err) {}

	document.body.removeChild(el);

	return success;
}