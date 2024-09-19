// ==UserScript==
// @name         Summarize with AI
// @namespace    https://github.com/insign/summarize-with-ai
// @version      2024.09.19.10.25
// @description  Adds a little button to summarize articles, news, and similar content using the OpenAI API (gpt-4o-mini model). The button only appears on pages detected as articles or news. The summary is displayed in a responsive overlay with a loading effect and error handling.
// @author       Hélio <open@helio.me>
// @license      WTFPL
// @match        *://*/*
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @connect      api.openai.com
// ==/UserScript==

(function() {
    'use strict';

    // Check if the current page is an article or news content
    if (!isArticlePage()) {
        return;
    }

    // Add the "S" button to the page
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
            }
            #summarize-overlay h2 {
                margin-top: 0;
            }
            #summarize-close {
                position: absolute;
                top: 10px;
                right: 10px;
                cursor: pointer;
                font-size: 18px;
            }
            #summarize-loading {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: linear-gradient(45deg, #007bff, #00ff6a, #007bff);
                background-size: 600% 600%;
                animation: GradientAnimation 3s ease infinite;
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-direction: column;
                color: white;
                font-size: 24px;
            }
            @keyframes GradientAnimation {
                0%{background-position:0% 50%}
                50%{background-position:100% 50%}
                100%{background-position:0% 50%}
            }
            #summarize-cancel {
                margin-top: 20px;
                padding: 10px 20px;
                background-color: rgba(0,0,0,0.3);
                border: none;
                color: white;
                font-size: 18px;
                cursor: pointer;
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

        // Show loading overlay
        showLoadingOverlay();

        // Send content to OpenAI API
        summarizeContent(apiKey, pageContent);
    }

    // Handler for resetting the API key
    function onApiKeyReset() {
        const newKey = prompt('Please enter your OpenAI API key:', '');
        if (newKey) {
            localStorage.setItem('openai_api_key', newKey.trim());
            alert('API key updated successfully.');
        }
    }

    // Function to get the API key
    function getApiKey() {
        let apiKey = localStorage.getItem('openai_api_key');
        if (!apiKey) {
            apiKey = prompt('Please enter your OpenAI API key:', '');
            if (apiKey) {
                localStorage.setItem('openai_api_key', apiKey.trim());
            } else {
                alert('API key is required to generate a summary.');
                return null;
            }
        }
        return apiKey.trim();
    }

    // Function to show the loading overlay with animation
    function showLoadingOverlay() {
        // Create the loading overlay
        const loadingDiv = document.createElement('div');
        loadingDiv.id = 'summarize-loading';
        loadingDiv.innerHTML = `
            <div>Generating summary...</div>
            <button id="summarize-cancel">Cancel</button>
        `;
        document.body.appendChild(loadingDiv);

        // Add event listener for cancel button
        document.getElementById('summarize-cancel').addEventListener('click', onCancelRequest);
    }

    // Handler to cancel the API request
    function onCancelRequest() {
        if (xhrRequest) {
            xhrRequest.abort();
            removeLoadingOverlay();
        }
    }

    // Function to remove the loading overlay
    function removeLoadingOverlay() {
        const loadingDiv = document.getElementById('summarize-loading');
        if (loadingDiv) {
            loadingDiv.remove();
        }
    }

    // Function to display the summary in an overlay
    function showSummaryOverlay(summaryText) {
        // Create the overlay
        const overlay = document.createElement('div');
        overlay.id = 'summarize-overlay';
        overlay.innerHTML = `
            <div id="summarize-close">&times;</div>
            <h2>Summary</h2>
            <div>${summaryText.replace(/\n/g, '<br>')}</div>
        `;
        document.body.appendChild(overlay);

        // Add event listener for close button
        document.getElementById('summarize-close').addEventListener('click', () => {
            overlay.remove();
        });
    }

    // Function to display an error notification
    function showErrorNotification(message) {
        const errorDiv = document.createElement('div');
        errorDiv.id = 'summarize-error';
        errorDiv.innerText = message;
        document.body.appendChild(errorDiv);

        // Remove the notification after 2 seconds
        setTimeout(() => {
            errorDiv.remove();
        }, 2000);
    }

    // Variable to hold the XMLHttpRequest for cancellation
    let xhrRequest = null;

    // Function to summarize the content using OpenAI API
    function summarizeContent(apiKey, content) {
        // Prepare the API request
        const apiUrl = 'https://api.openai.com/v1/chat/completions';
        const requestData = {
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: 'You are a helpful assistant that summarizes articles.' },
                { role: 'user', content: `Please provide a concise summary of the following article, add a small introduction and conclusion, in the middle list topics but instead of bullet points use the most appropriate emoji to indicate the topic: \n\n${content}` }
            ],
            max_tokens: 500,
            temperature: 0.5,
            n: 1,
            stream: false
        };

        // Send the request using GM_xmlhttpRequest
        xhrRequest = GM_xmlhttpRequest({
            method: 'POST',
            url: apiUrl,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            data: JSON.stringify(requestData),
            onload: function(response) {
                removeLoadingOverlay();
                if (response.status === 200) {
                    const resData = JSON.parse(response.responseText);
                    const summary = resData.choices[0].message.content;
                    showSummaryOverlay(summary);
                } else {
                    showErrorNotification('Error: Failed to retrieve summary.');
                }
            },
            onerror: function() {
                removeLoadingOverlay();
                showErrorNotification('Error: Network error.');
            },
            onabort: function() {
                removeLoadingOverlay();
                showErrorNotification('Request canceled.');
            }
        });
    }

})();
