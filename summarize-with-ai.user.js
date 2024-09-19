// ==UserScript==
// @name         Summarize with AI
// @namespace    https://github.com/insign/summarize-with-ai
// @version      2024.10.10.1212
// @description  Adds a button or key shortcut to summarize articles, news, and similar content using the OpenAI API (gpt-4o-mini model). The summary is displayed in an overlay with streaming support and improved styling.
// @author       Hélio
// @license      WTFPL
// @match        *://*/*
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      api.openai.com
// ==/UserScript==

(function() {
    'use strict';

    // Add keydown event listener for 'S' key to trigger summarization
    document.addEventListener('keydown', function(e) {
        const activeElement = document.activeElement;
        const isInput = activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.isContentEditable);
        if (!isInput && (e.key === 's' || e.key === 'S')) {
            onSummarizeShortcut();
        }
    });

    // Add summarize button if the page is an article
    addSummarizeButton();

    /*** Function Definitions ***/

    // Function to determine if the page is an article
    function isArticlePage() {
        // Check for <article> element
        if (document.querySelector('article')) {
            return true;
        }

        // Check for Open Graph meta tag
        const ogType = document.querySelector('meta[property="og:type"]');
        if (ogType && ogType.content === 'article') {
            return true;
        }

        // Check for news content in the URL
        const url = window.location.href;
        if (/news|article|story|post/i.test(url)) {
            return true;
        }

        // Check for significant text content (e.g., more than 500 words)
        const bodyText = document.body.innerText || "";
        const wordCount = bodyText.split(/\s+/).length;
        if (wordCount > 500) {
            return true;
        }

        return false;
    }

    // Function to add the summarize button
    function addSummarizeButton() {
        if (!isArticlePage()) {
            return; // Do not add the button if not an article
        }
        // Create the button element
        const button = document.createElement('div');
        button.id = 'summarize-button';
        button.innerText = 'S';
        document.body.appendChild(button);

        // Add event listeners
        button.addEventListener('click', onSummarizeClick);
        button.addEventListener('dblclick', onApiKeyReset);

        // Add styles
        GM_addStyle(`
            #summarize-button {
                position: fixed;
                bottom: 20px;
                right: 20px;
                width: 50px;
                height: 50px;
                background-color: #007bff;
                color: white;
                font-size: 24px;
                font-weight: bold;
                text-align: center;
                line-height: 50px;
                border-radius: 50%;
                cursor: pointer;
                z-index: 10000;
                box-shadow: 0 2px 5px rgba(0,0,0,0.3);
            }
            #summarize-overlay {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background-color: white;
                z-index: 10001;
                padding: 20px;
                box-shadow: 0 0 10px rgba(0,0,0,0.5);
                overflow: auto;
                font-size: 1.1em;
                max-width: 90%;
                max-height: 90%;
            }
            #summarize-overlay h2 {
                margin-top: 0;
                font-size: 1.5em;
            }
            #summarize-close {
                position: absolute;
                top: 10px;
                right: 10px;
                cursor: pointer;
                font-size: 22px;
            }
            #summarize-content {
                margin-top: 20px;
            }
            #summarize-error {
                position: fixed;
                bottom: 20px;
                left: 20px;
                background-color: rgba(255,0,0,0.8);
                color: white;
                padding: 10px 20px;
                border-radius: 5px;
                z-index: 10002;
            }
            @media (max-width: 768px) {
                #summarize-overlay {
                    width: 90%;
                    height: 90%;
                }
            }
            @media (min-width: 769px) {
                #summarize-overlay {
                    width: 60%;
                    height: 85%;
                }
            }
        `);
    }

    // Handler for clicking the "S" button
    function onSummarizeClick() {
        const apiKey = getApiKey();
        if (!apiKey) {
            return;
        }

        // Capture page source
        const pageContent = document.documentElement.outerHTML;

        // Show summary overlay with loading message
        showSummaryOverlay('<p>Generating summary...</p>');

        // Send content to OpenAI API
        summarizeContent(apiKey, pageContent);
    }

    // Handler for the "S" key shortcut
    function onSummarizeShortcut() {
        const apiKey = getApiKey();
        if (!apiKey) {
            return;
        }

        if (!isArticlePage()) {
            // Show a quick warning
            alert('This page may not be an article. Proceeding to summarize anyway.');
        }

        // Capture page source
        const pageContent = document.documentElement.outerHTML;

        // Show summary overlay with loading message
        showSummaryOverlay('<p>Generating summary...</p>');

        // Send content to OpenAI API
        summarizeContent(apiKey, pageContent);
    }

    // Handler for resetting the API key
    function onApiKeyReset() {
        const newKey = prompt('Please enter your OpenAI API key:', '');
        if (newKey) {
            GM_setValue('openai_api_key', newKey.trim());
            alert('API key updated successfully.');
        }
    }

    // Function to get the API key
    function getApiKey() {
        let apiKey = GM_getValue('openai_api_key');
        if (!apiKey) {
            apiKey = prompt('Please enter your OpenAI API key:', '');
            if (apiKey) {
                GM_setValue('openai_api_key', apiKey.trim());
            } else {
                alert('API key is required to generate a summary.');
                return null;
            }
        }
        return apiKey.trim();
    }

    // Function to show the summary overlay
    function showSummaryOverlay(initialContent = '') {
        // Create the overlay
        const overlay = document.createElement('div');
        overlay.id = 'summarize-overlay';
        overlay.innerHTML = `
            <div id="summarize-close">&times;</div>
            <div id="summarize-content">${initialContent}</div>
        `;
        document.body.appendChild(overlay);

        // Add event listener for close button
        document.getElementById('summarize-close').addEventListener('click', () => {
            overlay.remove();
            document.removeEventListener('keydown', onEscapePress);
        });

        // Add event listener for 'Escape' key to close the overlay
        document.addEventListener('keydown', onEscapePress);

        function onEscapePress(e) {
            if (e.key === 'Escape') {
                overlay.remove();
                document.removeEventListener('keydown', onEscapePress);
            }
        }
    }

    // Function to update the summary content incrementally
    function updateSummaryOverlay(content) {
        const contentDiv = document.getElementById('summarize-content');
        if (contentDiv) {
            contentDiv.innerHTML += content.replaceAll('\n', '<br>');
        }
    }

    // Function to display an error notification
    function showErrorNotification(message) {
        const errorDiv = document.createElement('div');
        errorDiv.id = 'summarize-error';
        errorDiv.innerText = message;
        document.body.appendChild(errorDiv);

        // Remove the notification after 4 seconds
        setTimeout(() => {
            errorDiv.remove();
        }, 4000);
    }

    // Variable to hold the XMLHttpRequest for cancellation (if needed)
    let xhrRequest = null;

    // Function to summarize the content using OpenAI API with streaming
    function summarizeContent(apiKey, content) {
        const userLanguage = navigator.language || 'en';

        // Prepare the API request
        const apiUrl = 'https://api.openai.com/v1/chat/completions';
        const requestData = {
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system', content: `You are a helpful assistant that summarizes articles based on the HTML content provided. You must generate a concise summary that includes a short introduction, followed by a list of topics, and ends with a short conclusion. For the topics, you must use appropriate emojis as bullet points, and the topics must consist of descriptive titles with no detailed descriptions.

                    You must always use HTML tags to structure the summary text. The title must be wrapped in h2 tags, and you must always use the user's language besides the article's original language. The generated HTML must be ready to be injected into the final target, and you must never use markdown.

                    Required structure:
                    - Use h2 for the summary title
                    - Use paragraphs for the introduction and conclusion
                    - Use appropriate emojis for topics

                    User language: ${userLanguage}`
                },
                { role: 'user', content: `Page content: \n\n${content}` }
            ],
            max_tokens: 500,
            temperature: 0.5,
            n: 1,
            stream: true
        };

        // Initialize variables for processing the streaming response
        let buffer = '';
        let lastPosition = 0;

        // Send the request using GM_xmlhttpRequest with streaming support
        xhrRequest = GM_xmlhttpRequest({
            method: 'POST',
            url: apiUrl,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            data: JSON.stringify(requestData),
            responseType: 'text',
            onprogress: function(response) {
                const newText = response.responseText.substring(lastPosition);
                lastPosition = response.responseText.length;

                buffer += newText;
                processStreamData();
            },
            onload: function(response) {
                // Streaming complete
            },
            onerror: function() {
                showErrorNotification('Error: Network error.');
            },
            onabort: function() {
                showErrorNotification('Request canceled.');
            }
        });

        // Function to process the streaming data
        function processStreamData() {
            let lines = buffer.split('\n');
            let incompleteLine = '';

            // If the last line is not empty, it's an incomplete line
            if (lines[lines.length - 1] && lines[lines.length - 1].trim() !== '') {
                incompleteLine = lines.pop();
            }

            for (let line of lines) {
                line = line.trim();
                if (line.startsWith('data: ')) {
                    let jsonStr = line.replace('data: ', '').trim();

                    if (jsonStr === '[DONE]') {
                        // Streaming complete
                        return;
                    }

                    try {
                        let json = JSON.parse(jsonStr);
                        let content = json.choices[0].delta.content;
                        if (content) {
                            // Update the summary overlay with new content
                            updateSummaryOverlay(content);
                        }
                    } catch (e) {
                        console.error('Failed to parse JSON chunk:', jsonStr);
                    }
                }
            }

            // Keep the incomplete line in buffer
            buffer = incompleteLine;
        }
    }

})();
