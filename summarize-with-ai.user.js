// ==UserScript==
// @name         Summarize with AI (Unified)
// @namespace    https://github.com/insign/summarize-with-ai
// @version      2025.02.14.19.42
// @description  Single-button AI summarization with model selection dropdown
// @author       Hélio <open@helio.me>
// @license      WTFPL
// @match        *://*/*
// @grant        GM.addStyle
// @grant        GM.xmlHttpRequest
// @grant        GM.setValue
// @grant        GM.getValue
// @connect      api.openai.com
// @connect      generativelanguage.googleapis.com
// @require      https://cdnjs.cloudflare.com/ajax/libs/readability/0.5.0/Readability.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/readability/0.5.0/Readability-readerable.min.js
// ==/UserScript==

(function() {
  'use strict'

  const BUTTON_ID       = 'summarize-button'
  const DROPDOWN_ID     = 'model-dropdown'
  const OVERLAY_ID      = 'summarize-overlay'
  const CLOSE_BUTTON_ID = 'summarize-close'
  const CONTENT_ID      = 'summarize-content'
  const ERROR_ID        = 'summarize-error'

  const MODEL_GROUPS = {
    openai: {
      name   : 'OpenAI',
      models : [ 'gpt-4o-mini', 'o3-mini' ],
      baseUrl: 'https://api.openai.com/v1/chat/completions',
    },
    gemini: {
      name   : 'Gemini',
      models : [
        'gemini-2.0-flash-exp',
        'gemini-2.0-pro-exp-02-05',
        'gemini-2.0-flash-thinking-exp-01-21',
        'learnlm-1.5-pro-experimental',
        'gemini-2.0-flash-lite-preview-02-05',
      ],
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models/',
    },
  }

  const PROMPT_TEMPLATE = (title, content, lang) => `You are a helpful assistant that provides clear and affirmative explanations of content. 
Generate a concise summary that includes:
- 2-sentence introduction
- Bullet points with relevant emojis
- No section headers
- Use HTML formatting, but send withouy \`\`\`html markdown syntax since it well be injected into the page to the browser evaluate correctly
- After the last bullet point add a 2-sentence conclusion using opinionated language your general knowledge
- Language: ${lang}

Article Title: ${title}
Article Content: ${content}`

  let activeModel = 'gpt-4o-mini'
  let articleData = null

  function initialize() {
    document.addEventListener('keydown', handleKeyPress)
    setupFocusListeners()
    articleData = getArticleData()
    if (articleData) {
      addSummarizeButton()
      showElement(BUTTON_ID)
    }
  }

  function getArticleData() {
    try {
      const docClone = document.cloneNode(true)
      docClone.querySelectorAll('script, style').forEach(el => el.remove())
      if (!isProbablyReaderable(docClone)) return null
      const reader  = new Readability(docClone)
      const article = reader.parse()
      return article?.content ? { title: article.title, content: article.textContent } : null
    }
    catch (error) {
      console.error('Article parsing failed:', error)
      return null
    }
  }

  function addSummarizeButton() {
    if (document.getElementById(BUTTON_ID)) return
    const button       = document.createElement('div')
    button.id          = BUTTON_ID
    button.textContent = 'S'
    document.body.appendChild(button)
    const dropdown = createDropdown()
    document.body.appendChild(dropdown)
    button.addEventListener('click', toggleDropdown)
    button.addEventListener('dblclick', handleApiKeyReset)
    injectStyles()
  }

  function createDropdown() {
    const dropdown         = document.createElement('div')
    dropdown.id            = DROPDOWN_ID
    dropdown.style.display = 'none'
    Object.entries(MODEL_GROUPS).forEach(([ service, group ]) => {
      const groupDiv     = document.createElement('div')
      groupDiv.className = 'model-group'
      groupDiv.appendChild(createHeader(group.name))
      group.models.forEach(model => groupDiv.appendChild(createModelItem(model)))
      dropdown.appendChild(groupDiv)
    })
    return dropdown
  }

  function createHeader(text) {
    const header       = document.createElement('div')
    header.className   = 'group-header'
    header.textContent = text
    return header
  }

  function createModelItem(model) {
    const item       = document.createElement('div')
    item.className   = 'model-item'
    item.textContent = model
    item.addEventListener('click', () => {
      activeModel = model
      hideElement(DROPDOWN_ID)
      processSummarization()
    })
    return item
  }

  async function processSummarization() {
    try {
      const service = getCurrentService()
      const apiKey  = await getApiKey(service)
      if (!apiKey) return
      showSummaryOverlay('<p class="glow">Summarizing...</p>')
      const payload  = { title: articleData.title, content: articleData.content, lang: navigator.language || 'en-US' }
      const response = await sendApiRequest(service, apiKey, payload)
      handleApiResponse(response, service)
    }
    catch (error) {
      showErrorNotification(`Error: ${error.message}`)
    }
  }

  async function sendApiRequest(service, apiKey, payload) {
    const url = service === 'openai'
      ? MODEL_GROUPS.openai.baseUrl
      : `${MODEL_GROUPS.gemini.baseUrl}${activeModel}:generateContent?key=${apiKey}`
    return new Promise((resolve, reject) => {
      GM.xmlHttpRequest({
        method : 'POST',
        url,
        headers: getHeaders(service, apiKey),
        data   : JSON.stringify(buildRequestBody(service, payload)),
        onload : resolve,
        onerror: reject,
        onabort: () => reject(new Error('Request aborted')),
      })
    })
  }

  function handleApiResponse(response, service) {
    if (response.status !== 200) {
      throw new Error(`API Error (${response.status}): ${response.statusText}`)
    }
    const data    = JSON.parse(response.responseText)
    const summary = service === 'openai'
      ? data.choices[0].message.content
      : data.candidates[0].content.parts[0].text
    updateSummaryOverlay(summary.replace(/\n/g, '<br>'))
  }

  function buildRequestBody(service, { title, content, lang }) {
    return service === 'openai' ? {
      model      : activeModel,
      messages   : [
        {
          role   : 'system',
          content: PROMPT_TEMPLATE(title, content, lang),
        }, {
          role   : 'user',
          content: 'Generate summary',
        },
      ],
      temperature: 0.5,
      max_tokens : 500,
    } : {
      contents: [
        {
          parts: [
            {
              text: PROMPT_TEMPLATE(title, content, lang),
            },
          ],
        },
      ],
    }
  }

  function getHeaders(service, apiKey) {
    return service === 'openai' ? {
      'Content-Type' : 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    } : { 'Content-Type': 'application/json' }
  }

  function getCurrentService() {
    return Object.keys(MODEL_GROUPS).find(service =>
      MODEL_GROUPS[service].models.includes(activeModel),
    )
  }

  function toggleDropdown(e) {
    e.stopPropagation()
    const dropdown         = document.getElementById(DROPDOWN_ID)
    dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none'
  }

  function handleKeyPress(e) {
    if (e.altKey && e.code === 'KeyS') {
      e.preventDefault()
      document.getElementById(BUTTON_ID)?.click()
    }
  }

  async function getApiKey(service) {
    const storageKey = `${service}_api_key`
    let apiKey       = await GM.getValue(storageKey)
    if (!apiKey) {
      apiKey = prompt(`Enter ${service.toUpperCase()} API key:`)
      if (apiKey) await GM.setValue(storageKey, apiKey.trim())
    }
    return apiKey?.trim()
  }

  function handleApiKeyReset() {
    const service = prompt('Reset API key for (openai/gemini):').toLowerCase()
    if (MODEL_GROUPS[service]) {
      const newKey = prompt(`Enter new ${service} API key:`)
      if (newKey) GM.setValue(`${service}_api_key`, newKey.trim())
    }
  }

  function injectStyles() {
    GM.addStyle(`
            #${BUTTON_ID} {
                position: fixed;
                bottom: 20px;
                right: 20px;
                width: 60px;
                height: 60px;
                background: #2563eb;
                color: white;
                font-size: 28px;
                font-family: sans-serif;
                border-radius: 50%;
                cursor: pointer;
                z-index: 99999;
                box-shadow: 0 2px 10px rgba(0,0,0,0.2);
 display: flex !important;
    align-items: center !important;
    justify-content: center !important;
                transition: transform 0.2s;
                line-height: 1;
            }
            #${DROPDOWN_ID} {
                position: fixed;
                bottom: 90px;
                right: 20px;
                background: white;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                z-index: 100000;
                max-height: 60vh;
                overflow-y: auto;
                padding: 12px;
                width: 280px;
                font-family: sans-serif;
            }
            .model-group { margin: 8px 0; }
            .group-header {
                padding: 8px 12px;
                font-weight: 600;
                color: #4b5563;
                background: #f3f4f6;
                border-radius: 4px;
                margin-bottom: 6px;
                font-family: sans-serif;
            }
            .model-item {
                padding: 10px 16px;
                margin: 4px 0;
                border-radius: 6px;
                transition: background 0.2s;
                font-size: 14px;
                font-family: sans-serif;
                cursor: pointer;
            }
            .model-item:hover { background: #1143b2; }
            #${OVERLAY_ID} {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.5);
                z-index: 100000;
                display: flex;
                align-items: center;
                justify-content: center;
                overflow: auto;
                font-family: sans-serif;
            }
            #${CONTENT_ID} {
                background-color: #fff;
                padding: 30px;
                border-radius: 10px;
                box-shadow: 0 0 15px rgba(0,0,0,0.5);
                max-width: 700px;
                max-height: 90%;
                overflow: auto;
                position: relative;
                font-size: 1.2em;
                color: #000;
                font-family: sans-serif;
            }
            #${ERROR_ID} {
                position: fixed;
                bottom: 20px;
                left: 20px;
                background-color: rgba(255,0,0,0.8);
                color: white;
                padding: 10px 20px;
                border-radius: 5px;
                z-index: 100001;
                font-size: 14px;
                font-family: sans-serif;
            }
            .glow {
                font-size: 1.5em;
                color: #333;
                text-align: center;
                animation: glow 2s ease-in-out infinite alternate;
                font-family: sans-serif;
            }
            @keyframes glow {
                from { color: #4b6cb7; text-shadow: 0 0 10px #4b6cb7; }
                to { color: #182848; text-shadow: 0 0 20px #8e2de2; }
            }
        `)
  }

  function showSummaryOverlay(content) {
    if (document.getElementById(OVERLAY_ID)) {
      updateSummaryOverlay(content)
      return
    }
    const overlay     = document.createElement('div')
    overlay.id        = OVERLAY_ID
    overlay.innerHTML = `
            <div id="${CONTENT_ID}">
                <div id="${CLOSE_BUTTON_ID}">&times;</div>
                ${content}
            </div>
        `
    document.body.appendChild(overlay)
    document.body.style.overflow = 'hidden'
    document.getElementById(CLOSE_BUTTON_ID).addEventListener('click', closeOverlay)
    overlay.addEventListener('click', (e) => {
      if (!e.target.closest(`#${CONTENT_ID}`)) closeOverlay()
    })
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeOverlay()
    })

    function closeOverlay() {
      document.getElementById(OVERLAY_ID)?.remove()
      document.body.style.overflow = ''
    }
  }

  function updateSummaryOverlay(content) {
    const contentDiv = document.getElementById(CONTENT_ID)
    if (contentDiv) {
      contentDiv.innerHTML = `<div id="${CLOSE_BUTTON_ID}">&times;</div>${content}`
      document.getElementById(CLOSE_BUTTON_ID).addEventListener('click', closeOverlay)
    }

    function closeOverlay() {
      document.getElementById(OVERLAY_ID)?.remove()
      document.body.style.overflow = ''
    }
  }

  function showErrorNotification(message) {
    if (document.getElementById(ERROR_ID)) {
      document.getElementById(ERROR_ID).innerText = message
      return
    }
    const errorDiv     = document.createElement('div')
    errorDiv.id        = ERROR_ID
    errorDiv.innerText = message
    document.body.appendChild(errorDiv)
    setTimeout(() => errorDiv.remove(), 4000)
  }

  function hideElement(id) {
    const el = document.getElementById(id)
    if (el) el.style.display = 'none'
  }

  function showElement(id) {
    const el = document.getElementById(id)
    if (el) el.style.display = 'block'
  }

  function setupFocusListeners() {
    document.addEventListener('focusin', toggleButtonVisibility)
    document.addEventListener('focusout', toggleButtonVisibility)
  }

  function toggleButtonVisibility() {
    const active                                     = document.activeElement
    const isInput                                    = active?.matches('input, textarea, select, [contenteditable]')
    document.getElementById(BUTTON_ID).style.display = isInput ? 'none' : 'block'
  }

  initialize()
})()
