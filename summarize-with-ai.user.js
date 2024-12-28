// ==UserScript==
// @name         Summarize with AI (OpenAI/Gemini)
// @namespace    https://github.com/insign/summarize-with-ai
// @version      2024.12.28.1418
// @description  Adds buttons to summarize articles, news, and similar content using the OpenAI API (gpt-4o-mini model) or Google Gemini API (gemini-2.0-flash-exp model). The summary is displayed in an overlay with enhanced styling and a loading animation.
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

(function () {
    'use strict';

    /*** Constants ***/
    const OPENAI_BUTTON_ID = 'openai-summarize-button';
    const GEMINI_BUTTON_ID = 'gemini-summarize-button';
    const OVERLAY_ID = 'summarize-overlay';
    const CLOSE_BUTTON_ID = 'summarize-close';
    const CONTENT_ID = 'summarize-content';
    const ERROR_ID = 'summarize-error';
    const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
    const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=';

    /*** Initialization ***/
    let isArticle = false;
    let articleTitle = '';
    let articleContent = '';
    let activeModel = 'openai'; // Default model

    initialize();

    /**
     * Initializes the Userscript by detecting article content,
     * setting up the summarize buttons and keyboard shortcuts,
     * and adding necessary event listeners.
     */
    async function initialize() {
        try {
            const articleData = getArticleData();
            if (articleData) {
                isArticle = true;
                ({ title: articleTitle, content: articleContent } = articleData);
                addSummarizeButtons();
                setupKeyboardShortcuts();
            } else {
                isArticle = false;
                hideElement(OPENAI_BUTTON_ID);
                hideElement(GEMINI_BUTTON_ID);
                disableKeyboardShortcuts();
            }

            setupFocusListeners();
        } catch (error) {
            console.error('Initialization error:', error);
            showErrorNotification('Error during initialization.');
        }
    }

    /*** Function Definitions ***/

    /**
     * Extracts the article's title and content using Readability.
     * @returns {Object|null} Article data or null if not found.
     */
    function getArticleData() {
        try {
            const clonedDoc = document.cloneNode(true);
            // Remove unwanted tags to prevent parsing issues
            clonedDoc.querySelectorAll('script, style').forEach(el => el.remove());

            if (!isProbablyReaderable(clonedDoc)) return null;

            const reader = new Readability(clonedDoc);
            const article = reader.parse();

            if (article && article.content && article.title) {
                return {
                    title: article.title,
                    content: article.textContent // Plain text for API
                };
            }
            return null;
        } catch (error) {
            console.error('Readability parsing error:', error);
            return null;
        }
    }

    /**
     * Adds the summarize buttons to the page with predefined styles and event listeners.
     */
    function addSummarizeButtons() {
        if (!document.getElementById(OPENAI_BUTTON_ID)) {
            const openaiButton = document.createElement('div');
            openaiButton.id = OPENAI_BUTTON_ID;
            openaiButton.innerText = 'O';
            document.body.appendChild(openaiButton);
            openaiButton.addEventListener('click', () => {
                activeModel = 'openai';
                processSummarization();
            });
            openaiButton.addEventListener('dblclick', resetOpenAIApiKey);
        }

        if (!document.getElementById(GEMINI_BUTTON_ID)) {
            const geminiButton = document.createElement('div');
            geminiButton.id = GEMINI_BUTTON_ID;
            geminiButton.innerText = 'G';
            document.body.appendChild(geminiButton);
            geminiButton.addEventListener('click', () => {
                activeModel = 'gemini';
                processSummarization();
            });
            geminiButton.addEventListener('dblclick', resetGeminiApiKey);
        }

        injectStyles();
    }

    /**
     * Injects CSS styles for the summarize buttons, overlay, and notifications.
     */
    function injectStyles() {
        GM.addStyle(`
            /* Summarize Button Styling */
            #${OPENAI_BUTTON_ID}, #${GEMINI_BUTTON_ID} {
                position: fixed;
                bottom: 20px;
                width: 60px;
                height: 60px;
                background-color: rgba(0, 123, 255, 0.9);
                color: white;
                font-size: 28px;
                font-weight: bold;
                text-align: center;
                line-height: 60px;
                border-radius: 50%;
                cursor: pointer;
                z-index: 99999;
                box-shadow: 0 2px 5px rgba(0,0,0,0.3);
                transition: background-color 0.3s, transform 0.3s;
                user-select: none;
                font-family: Arial, sans-serif;
            }
            #${OPENAI_BUTTON_ID} {
                right: 90px; /* Adjusted for two buttons */
            }
            #${GEMINI_BUTTON_ID} {
                right: 20px;
            }
            #${OPENAI_BUTTON_ID}:hover, #${GEMINI_BUTTON_ID}:hover {
                background-color: rgba(0, 123, 255, 1);
                transform: scale(1.1);
            }

            /* Summary Overlay Styling */
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
                font-family: Arial, sans-serif;
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
            }
            #${CLOSE_BUTTON_ID} {
                position: absolute;
                top: 15px;
                right: 15px;
                cursor: pointer;
                font-size: 26px;
                color: #555;
                transition: transform 0.2s;
            }
            #${CLOSE_BUTTON_ID}:hover::after {
                content: "ESC";
                position: absolute;
                top: -12px;
                right: -10px;
                background: rgba(0, 0, 0, 0.7);
                color: white;
                padding: 2px 6px;
                border-radius: 4px;
                font-size: 12px;
                white-space: nowrap;
            }

            /* Error Notification Styling */
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
                font-family: Arial, sans-serif;
            }

            /* Loading Animation */
            .glow {
                font-size: 1.5em;
                color: #333;
                text-align: center;
                animation: glow 2s ease-in-out infinite alternate;
            }
            @keyframes glow {
                from {
                    color: #4b6cb7;
                    text-shadow: 0 0 10px #4b6cb7, 0 0 20px #4b6cb7, 0 0 30px #4b6cb7;
                }
                to {
                    color: #182848;
                    text-shadow: 0 0 20px #8e2de2, 0 0 30px #8e2de2, 0 0 40px #8e2de2;
                }
            }

            /* Responsive Design */
            @media (max-width: 768px) {
                #${OPENAI_BUTTON_ID}, #${GEMINI_BUTTON_ID} {
                    width: 70px;
                    height: 70px;
                    font-size: 32px;
                    line-height: 70px;
                    bottom: 15px;
                }
                #${OPENAI_BUTTON_ID} {
                    right: 95px;
                }
                #${GEMINI_BUTTON_ID} {
                    right: 15px;
                }
                #${CONTENT_ID} {
                    padding: 25px;
                }
                #${ERROR_ID} {
                    bottom: 15px;
                    left: 15px;
                    font-size: 12px;
                }
            }
            @media (max-width: 480px) {
                #${OPENAI_BUTTON_ID}, #${GEMINI_BUTTON_ID} {
                    width: 80px;
                    height: 80px;
                    font-size: 36px;
                    line-height: 80px;
                    bottom: 10px;
                }
                #${OPENAI_BUTTON_ID} {
                    right: 90px;
                }
                #${GEMINI_BUTTON_ID} {
                    right: 10px;
                }
                #${CONTENT_ID} {
                    padding: 20px;
                }
                #${ERROR_ID} {
                    padding: 8px 16px;
                    font-size: 11px;
                }
            }

            /* Clean List Styles */
            #${CONTENT_ID} ul, #${CONTENT_ID} p {
                list-style: none;
                padding: 0;
                margin: 0;
            }
        `);
    }

    /**
     * Sets up keyboard shortcuts for summarization.
     * 'Alt+O' key combination triggers OpenAI summarization unless an input is focused.
     * 'Alt+G' key combination triggers Gemini summarization unless an input is focused.
     */
    function setupKeyboardShortcuts() {
        document.addEventListener('keydown', handleKeyDown);
    }

    /**
     * Disables keyboard shortcuts by removing the keydown event listener.
     */
    function disableKeyboardShortcuts() {
        document.removeEventListener('keydown', handleKeyDown);
    }

    /**
     * Handles keydown events to trigger summarization with 'Alt+O' or 'Alt+G' key combination.
     * @param {KeyboardEvent} e
     */
    function handleKeyDown(e) {
        const active = document.activeElement;
        const isInput = active && (['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName) || active.isContentEditable);

        if (isInput) {
            hideElement(OPENAI_BUTTON_ID);
            hideElement(GEMINI_BUTTON_ID);
            return;
        } else {
            showElement(OPENAI_BUTTON_ID);
            showElement(GEMINI_BUTTON_ID);
        }

        if (e.altKey) {
            e.preventDefault();
            if (e.code === 'KeyO') {
                activeModel = 'openai';
                triggerSummarization();
            } else if (e.code === 'KeyG') {
                activeModel = 'gemini';
                triggerSummarization();
            }
        }
    }

    /**
     * Monitors focus changes to show or hide the summarize buttons accordingly.
     */
    function setupFocusListeners() {
        document.addEventListener('focusin', toggleButtonVisibility);
        document.addEventListener('focusout', toggleButtonVisibility);
    }

    /**
     * Toggles the visibility of the summarize buttons based on focused element.
     */
    function toggleButtonVisibility() {
        const active = document.activeElement;
        const isInput = active && (['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName) || active.isContentEditable);

        if (isInput) {
            hideElement(OPENAI_BUTTON_ID);
            hideElement(GEMINI_BUTTON_ID);
        } else if (isArticle) {
            showElement(OPENAI_BUTTON_ID);
            showElement(GEMINI_BUTTON_ID);
        }
    }

    /**
     * Shows an element by its ID.
     * @param {string} id
     */
    function showElement(id) {
        const el = document.getElementById(id);
        if (el) el.style.display = 'block';
    }

    /**
     * Hides an element by its ID.
     * @param {string} id
     */
    function hideElement(id) {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    }

    /**
     * Triggers the summarization process, handling both button clicks and keyboard shortcuts.
     */
    function triggerSummarization() {
        if (!isArticle) {
            alert('This page may not be an article. Proceeding to summarize anyway.');
        }
        processSummarization();
    }

    /**
     * Initiates the summarization process by fetching the API key,
     * displaying the loading overlay, and sending data to the selected API.
     */
    async function processSummarization() {
        try {
            let apiKey;
            if (activeModel === 'openai') {
                apiKey = await getOpenAIApiKey();
            } else {
                apiKey = await getGeminiApiKey();
            }

            if (!apiKey) return;

            const payload = { title: articleTitle, content: articleContent };

            showSummaryOverlay('<p class="glow">Summarizing</p>');
            if (activeModel === 'openai') {
                await summarizeContentOpenAI(apiKey, payload);
            } else {
                await summarizeContentGemini(apiKey, payload);
            }
        } catch (error) {
            console.error('Summarization process error:', error);
            showErrorNotification('Error: Failed to initiate summarization.');
            updateSummaryOverlay('<p>Error: Failed to initiate summarization.</p>');
        }
    }

    /**
     * Handles double-click on the OpenAI summarize button to reset the API key.
     */
    function resetOpenAIApiKey() {
        const newKey = prompt('Please enter your OpenAI API key:', '');
        if (newKey) {
            GM.setValue('openai_api_key', newKey.trim())
              .then(() => alert('OpenAI API key successfully updated.'))
              .catch(error => {
                  alert('Error updating the OpenAI API key.');
                  console.error('OpenAI API key update error:', error);
              });
        }
    }

    /**
     * Handles double-click on the Gemini summarize button to reset the API key.
     */
    function resetGeminiApiKey() {
        const newKey = prompt('Please enter your Gemini API key:', '');
        if (newKey) {
            GM.setValue('gemini_api_key', newKey.trim())
              .then(() => alert('Gemini API key successfully updated.'))
              .catch(error => {
                  alert('Error updating the Gemini API key.');
                  console.error('Gemini API key update error:', error);
              });
        }
    }

    /**
     * Retrieves the OpenAI API key from storage or prompts the user to input it.
     * @returns {Promise<string|null>} The API key or null if not provided.
     */
    async function getOpenAIApiKey() {
        try {
            let apiKey = (await GM.getValue('openai_api_key'))?.trim();
            if (!apiKey) {
                const userInput = prompt('Please enter your OpenAI API key:', '');
                if (userInput) {
                    apiKey = userInput.trim();
                    await GM.setValue('openai_api_key', apiKey);
                } else {
                    alert('An API key is required to generate a summary.');
                    return null;
                }
            }
            return apiKey;
        } catch (error) {
            console.error('OpenAI API key retrieval error:', error);
            alert('Failed to retrieve the OpenAI API key.');
            return null;
        }
    }

    /**
     * Retrieves the Gemini API key from storage or prompts the user to input it.
     * @returns {Promise<string|null>} The API key or null if not provided.
     */
    async function getGeminiApiKey() {
        try {
            let apiKey = (await GM.getValue('gemini_api_key'))?.trim();
            if (!apiKey) {
                const userInput = prompt('Please enter your Gemini API key:', '');
                if (userInput) {
                    apiKey = userInput.trim();
                    await GM.setValue('gemini_api_key', apiKey);
                } else {
                    alert('A Gemini API key is required to generate a summary.');
                    return null;
                }
            }
            return apiKey;
        } catch (error) {
            console.error('Gemini API key retrieval error:', error);
            alert('Failed to retrieve the Gemini API key.');
            return null;
        }
    }

    /**
     * Displays the summary overlay with specified content.
     * Sets up event listeners for closing the overlay.
     * @param {string} content - HTML content to display.
     */
    function showSummaryOverlay(content) {
        if (document.getElementById(OVERLAY_ID)) {
            updateSummaryOverlay(content);
            return;
        }

        const overlay = document.createElement('div');
        overlay.id = OVERLAY_ID;
        overlay.innerHTML = `
            <div id="${CONTENT_ID}">
                <div id="${CLOSE_BUTTON_ID}">&times;</div>
                ${content}
            </div>
        `;
        document.body.appendChild(overlay);
        document.body.style.overflow = 'hidden';

        const contentContainer = document.getElementById(CONTENT_ID);
        document.getElementById(CLOSE_BUTTON_ID).addEventListener('click', closeOverlay);
        overlay.addEventListener('click', (e) => {
            if (!contentContainer.contains(e.target)) {
                closeOverlay();
            }
        });
        document.addEventListener('keydown', onEscapePress);

        /**
         * Closes the overlay and restores page scrolling.
         */
        function closeOverlay() {
            document.getElementById(OVERLAY_ID)?.remove();
            document.body.style.overflow = '';
            document.removeEventListener('keydown', onEscapePress);
        }

        /**
         * Handles 'Escape' key press to close the overlay.
         * @param {KeyboardEvent} e
         */
        function onEscapePress(e) {
            if (e.key === 'Escape') closeOverlay();
        }
    }

    /**
     * Updates the content within the summary overlay.
     * @param {string} content - New HTML content to display.
     */
    function updateSummaryOverlay(content) {
        const contentDiv = document.getElementById(CONTENT_ID);
        if (contentDiv) {
            contentDiv.innerHTML = `<div id="${CLOSE_BUTTON_ID}">&times;</div>` + content;
            document.getElementById(CLOSE_BUTTON_ID).addEventListener('click', closeOverlay);
        }

        /**
         * Closes the summary overlay and re-enables background scrolling.
         */
        function closeOverlay() {
            document.getElementById(OVERLAY_ID)?.remove();
            document.body.style.overflow = '';
            document.removeEventListener('keydown', onEscapePress);
        }

        /**
         * Handles the 'Escape' key press to close the overlay.
         * @param {KeyboardEvent} e
         */
        function onEscapePress(e) {
            if (e.key === 'Escape') closeOverlay();
        }
    }

    /**
     * Displays an error notification on the page.
     * @param {string} message - The error message to display.
     */
    function showErrorNotification(message) {
        if (document.getElementById(ERROR_ID)) {
            document.getElementById(ERROR_ID).innerText = message;
            return;
        }

        const errorDiv = document.createElement('div');
        errorDiv.id = ERROR_ID;
        errorDiv.innerText = message;
        document.body.appendChild(errorDiv);

        setTimeout(() => {
            errorDiv.remove();
        }, 4000);
    }

    /**
     * Sends the article data to the OpenAI API to generate a summary.
     * Handles the response and updates the overlay accordingly.
     * @param {string} apiKey - The OpenAI API key.
     * @param {Object} payload - Contains title and content of the article.
     */
    async function summarizeContentOpenAI(apiKey, payload) {
        try {
            const userLanguage = navigator.language || 'en-US';

            const requestData = {
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: `You are a helpful assistant that provides clear and affirmative explanations of the content within an article based on its title and content. Your summary should convey exactly what is contained in the article and each of its sections, ensuring that all crucial and fundamental points are covered so that the reader does not miss any important details without needing to read the entire article. Additionally, ensure that the summary addresses the proposition of the title while encompassing a broader overview of the article's content, as the full article answers more than what is suggested by the title.

You should generate a concise summary that includes a brief introduction followed by a list of topics. For the topics, use appropriate emojis as bullet points, and each topic should consist of descriptive and affirmative statements summarizing its subject.

You must always use HTML tags to structure the summary text. You must always use the user's language in addition to the article's original language. The generated HTML should be ready to be injected into the target location, and you must never use markdown, not even to refer the HTML code itself.

Required structure:
- Do not add any title
- Use a maximum of 2 sentences for the introduction.
- Use appropriate emojis for topics
- Do not add text like "Article Summary" or "Summary of the article" in the summary, nor "Introduction", "Topics", "Conclusion", etc.
- Be concise, informative, and avoid losing important details. But short for fast reading.

User language: ${userLanguage}.
Adapt the text to be short, concise, and informative without losing important details.`
                    },
                    {
                        role: 'user',
                        content: `Title: ${payload.title}\n\nContent: ${payload.content}`
                    }
                ],
                max_tokens: 500,
                temperature: 0.5,
                n: 1,
                stream: false
            };

            GM.xmlHttpRequest({
                method: 'POST',
                url: OPENAI_API_URL,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                data: JSON.stringify(requestData),
                onload: function (response) {
                    handleOpenAIResponse(response);
                },
                onerror: () => handleRequestError('Network issue.'),
                onabort: () => handleRequestError('Request aborted.')
            });
        } catch (error) {
            console.error('OpenAI API communication error:', error);
            showErrorNotification('Error: Failed to communicate with the OpenAI API.');
            updateSummaryOverlay('<p>Error: Failed to communicate with the OpenAI API.</p>');
        }
    }

    /**
     * Sends the article data to the Gemini API to generate a summary.
     * Handles the response and updates the overlay accordingly.
     * @param {string} apiKey - The Gemini API key.
     * @param {Object} payload - Contains title and content of the article.
     */
    async function summarizeContentGemini(apiKey, payload) {
        try {
            const userLanguage = navigator.language || 'en-US';

            const requestData = {
                contents: [
                    {
                        role: 'user',
                        parts: [
                            {
                                text: `You are a helpful assistant that provides clear and affirmative explanations of the content within an article based on its title and content. Your summary should convey exactly what is contained in the article and each of its sections, ensuring that all crucial and fundamental points are covered so that the reader does not miss any important details without needing to read the entire article. Additionally, ensure that the summary addresses the proposition of the title while encompassing a broader overview of the article's content, as the full article answers more than what is suggested by the title.

You should generate a concise summary that includes a brief introduction followed by a list of topics. For the topics, use appropriate emojis as bullet points, and each topic should consist of descriptive and affirmative statements summarizing its subject.

You must always use HTML tags to structure the summary text. You must always use the user's language in addition to the article's original language. The generated HTML should be ready to be injected into the target location, and you must never use markdown.

Required structure:
- Do not add any title
- Use a maximum of 2 sentences for the introduction.
- Use appropriate emojis for topics
- Do not add text like "Article Summary" or "Summary of the article" in the summary, nor "Introduction", "Topics", "Conclusion", etc.

User language: ${userLanguage}.
Adapt the text to be short, concise, and informative without losing important details.

Title: ${payload.title}

Content: ${payload.content}`
                            }
                        ]
                    }
                ]
            };

            GM.xmlHttpRequest({
                method: 'POST',
                url: GEMINI_API_URL + apiKey,
                headers: {
                    'Content-Type': 'application/json'
                },
                data: JSON.stringify(requestData),
                onload: function (response) {
                    handleGeminiResponse(response);
                },
                onerror: () => handleRequestError('Network issue.'),
                onabort: () => handleRequestError('Request aborted.')
            });
        } catch (error) {
            console.error('Gemini API communication error:', error);
            showErrorNotification('Error: Failed to communicate with the Gemini API.');
            updateSummaryOverlay('<p>Error: Failed to communicate with the Gemini API.</p>');
        }
    }

    /**
     * Handles the OpenAI API response, updating the overlay or showing errors as needed.
     * @param {Object} response - The API response object.
     */
    function handleOpenAIResponse(response) {
        if (response.status !== 200) {
            let errorMessage = `Error: Failed to retrieve summary. Status: ${response.status || 'N/A'}`;
            if (response.status === 401) {
                errorMessage = 'Error: Invalid OpenAI API key.';
            } else if (response.status === undefined) {
                errorMessage = 'Error: Unexpected OpenAI API response.';
            }
            showErrorNotification(errorMessage);
            updateSummaryOverlay(`<p>${errorMessage}</p>`);
            console.error('OpenAI API response error:', response);
            return;
        }

        try {
            const resData = JSON.parse(response.responseText);
            const summary = resData?.choices?.[0]?.message?.content;
            if (summary) {
                const formattedSummary = summary.replace(/\n+/g, '<br>');
                updateSummaryOverlay(formattedSummary);
            } else {
                throw new Error('Invalid OpenAI API response structure.');
            }
        } catch (parseError) {
            console.error('Error parsing OpenAI API response:', parseError);
            showErrorNotification('Error: Failed to parse OpenAI API response.');
            updateSummaryOverlay('<p>Error: Failed to parse OpenAI API response.</p>');
        }
    }

    /**
     * Handles the Gemini API response, updating the overlay or showing errors as needed.
     * @param {Object} response - The API response object.
     */
    function handleGeminiResponse(response) {
        if (response.status !== 200) {
            let errorMessage = `Error: Failed to retrieve summary. Status: ${response.status || 'N/A'}`;
            if (response.status === 401) {
                errorMessage = 'Error: Invalid Gemini API key.';
            } else if (response.status === undefined) {
                errorMessage = 'Error: Unexpected Gemini API response.';
            }
            showErrorNotification(errorMessage);
            updateSummaryOverlay(`<p>${errorMessage}</p>`);
            console.error('Gemini API response error:', response);
            return;
        }

        try {
            const resData = JSON.parse(response.responseText);
            const summary = resData?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (summary) {
                const formattedSummary = summary.replace(/\n+/g, '<br>');
                updateSummaryOverlay(formattedSummary);
            } else {
                throw new Error('Invalid Gemini API response structure.');
            }
        } catch (parseError) {
            console.error('Error parsing Gemini API response:', parseError);
            showErrorNotification('Error: Failed to parse Gemini API response.');
            updateSummaryOverlay('<p>Error: Failed to parse Gemini API response.</p>');
        }
    }

    /**
     * Handles request errors by displaying notifications and updating the overlay.
     * @param {string} message - The error message to display.
     */
    function handleRequestError(message) {
        showErrorNotification(`Error: ${message}`);
        updateSummaryOverlay(`<p>Error: ${message}</p>`);
    }

})();
