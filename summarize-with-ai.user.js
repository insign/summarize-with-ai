// ==UserScript==
// @name         Summarize with AI
// @namespace    https://github.com/insign/summarize-with-ai
// @version      2024.10.11.1514
// @description  Adds a button or keyboard shortcut to summarize articles, news, and similar content using the OpenAI API (gpt-4o-mini model). The summary is displayed in an overlay with enhanced styling and a loading animation.
// @author       Hélio
// @license      GPL-3.0
// @match        *://*/*
// @grant        GM.addStyle
// @grant        GM.xmlHttpRequest
// @grant        GM.setValue
// @grant        GM.getValue
// @connect      api.openai.com
// ==/UserScript==

(function() {
    'use strict';

    /*** Initialization ***/

    // Add a keyboard event listener for the 'S' key to trigger summarization
    document.addEventListener('keydown', function(e) {
        const activeElement = document.activeElement;
        const isInput = activeElement && (['INPUT', 'TEXTAREA'].includes(activeElement.tagName) || activeElement.isContentEditable);
        if (!isInput && (e.key === 's' || e.key === 'S')) {
            onSummarizeShortcut();
        }
    });

    // Check if the current page is an article and add the summarize button if true
    isArticlePage().then(function(isArticle) {
        if (isArticle) {
            addSummarizeButton();
        }
    }).catch(function(error) {
        console.error('Error checking if the page is an article:', error);
    });

    /*** Function Definitions ***/

    /**
     * Determines whether the current page is likely an article.
     * Checks for the presence of <article> tags, Open Graph meta tags, URL patterns, and word count.
     * @returns {Promise<boolean>} Promise resolving to true if the page is an article, false otherwise.
     */
    function isArticlePage() {
        return new Promise(function(resolve, reject) {
            try {
                // Check for the presence of an <article> element
                if (document.querySelector('article')) {
                    resolve(true);
                    return;
                }

                // Check for Open Graph meta tag indicating article type
                const ogType = document.querySelector('meta[property="og:type"]');
                if (ogType && ogType.content === 'article') {
                    resolve(true);
                    return;
                }

                // Check if the URL contains terms commonly associated with articles
                const url = window.location.href;
                if (/news|article|story|post/i.test(url)) {
                    resolve(true);
                    return;
                }

                // Check for significant textual content (e.g., more than 500 words)
                const bodyText = document.body.innerText || "";
                const wordCount = bodyText.split(/\s+/).length;
                if (wordCount > 500) {
                    resolve(true);
                    return;
                }

                // If none of the above conditions are met, it's likely not an article
                resolve(false);
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Adds the summarize button to the page.
     * Creates a styled button fixed at the bottom-right corner of the page.
     */
    function addSummarizeButton() {
        // Create the button element
        const button = document.createElement('div');
        button.id = 'summarize-button';
        button.innerText = 'S';
        document.body.appendChild(button);

        // Add event listeners for click and double-click actions
        button.addEventListener('click', onSummarizeClick);
        button.addEventListener('dblclick', onApiKeyReset);

        // Inject CSS styles using GM.addStyle
        GM.addStyle(`
            /* Summarize Button Styling */
            #summarize-button {
                position: fixed;
                bottom: 20px;
                right: 20px;
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
                z-index: 10000;
                box-shadow: 0 2px 5px rgba(0,0,0,0.3);
                transition: background-color 0.3s, transform 0.3s;
            }
            /* Hover effect for the summarize button */
            #summarize-button:hover {
                background-color: rgba(0, 123, 255, 1);
                transform: scale(1.1);
            }

            /* Summary Overlay Styling */
            #summarize-overlay {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background-color: #f0f0f0;
                z-index: 10001;
                padding: 30px;
                box-shadow: 0 0 15px rgba(0,0,0,0.5);
                overflow: auto;
                font-size: 1.2em;
                max-width: 90%;
                max-height: 90%;
                border-radius: 10px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
            }

            /* Close Button Styling */
            #summarize-close {
                position: absolute;
                top: 15px;
                right: 15px;
                cursor: pointer;
                font-size: 26px;
                transition: transform 0.2s;
            }
            /* Tooltip for Close Button on Hover */
            #summarize-close:hover::after {
                content: "ESC";
                position: absolute;
                top: -15px;
                right: -10px;
                background: rgba(0, 0, 0, 0.7);
                color: white;
                padding: 2px 6px;
                border-radius: 4px;
                font-size: 12px;
                white-space: nowrap;
            }

            /* Summary Content Styling */
            #summarize-content {
                margin-top: 40px;
                width: 100%;
            }

            /* Error Notification Styling */
            #summarize-error {
                position: fixed;
                bottom: 20px;
                left: 20px;
                background-color: rgba(255,0,0,0.8);
                color: white;
                padding: 10px 20px;
                border-radius: 5px;
                z-index: 10002;
                font-size: 14px;
            }

            /* Loading Text Animation */
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

            /* Media Queries for Mobile Devices */
            @media (max-width: 768px) {
                #summarize-button {
                    width: 70px;
                    height: 70px;
                    font-size: 32px;
                    line-height: 70px;
                    bottom: 15px;
                    right: 15px;
                }
                #summarize-overlay {
                    width: 95%;
                    height: 95%;
                    padding: 25px;
                }
                #summarize-error {
                    bottom: 15px;
                    left: 15px;
                    font-size: 12px;
                }
            }

            /* Additional Adjustments for Very Small Screens */
            @media (max-width: 480px) {
                #summarize-button {
                    width: 80px;
                    height: 80px;
                    font-size: 36px;
                    line-height: 80px;
                    bottom: 10px;
                    right: 10px;
                }
                #summarize-overlay {
                    padding: 20px;
                }
                #summarize-error {
                    padding: 8px 16px;
                    font-size: 11px;
                }
            }

            /* Remove Default Bullet Points from Lists */
            #summarize-content ul {
                list-style: none;
                padding: 0;
            }
        `);
    }

    /**
     * Handles the click event on the summarize button.
     * Initiates the summarization process.
     */
    function onSummarizeClick() {
        processSummarization();
    }

    /**
     * Handles the keyboard shortcut for summarization when 'S' key is pressed.
     * Checks if the page is not an article and alerts the user before proceeding.
     */
    function onSummarizeShortcut() {
        isArticlePage().then(function(isArticle) {
            if (!isArticle) {
                alert('This page may not be an article. Proceeding to summarize anyway.');
            }
            processSummarization();
        }).catch(function(error) {
            console.error('Error checking if the page is an article with shortcut:', error);
            processSummarization();
        });
    }

    /**
     * Initiates the summarization process by obtaining the API key,
     * capturing the page content, displaying the loading overlay,
     * and sending the content to the OpenAI API.
     */
    function processSummarization() {
        getApiKey().then(function(apiKey) {
            if (!apiKey) {
                return;
            }

            // Capture the entire page content
            const pageContent = document.documentElement.outerHTML;

            // Display the overlay with the loading animation
            showSummaryOverlay('<p class="glow">Generating summary...</p>');

            // Send the content to the OpenAI API for summarization
            summarizeContent(apiKey, pageContent);
        }).catch(function(error) {
            showErrorNotification('Error: Failed to retrieve the API key.');
            updateSummaryOverlay('<p>Error: Failed to retrieve the API key.</p>');
            console.error('Error retrieving the API key:', error);
        });
    }

    /**
     * Handles the double-click event on the summarize button to reset the API key.
     */
    function onApiKeyReset() {
        const newKey = prompt('Please enter your OpenAI API key:', '');
        if (newKey) {
            GM.setValue('openai_api_key', newKey.trim()).then(function() {
                alert('API key successfully updated.');
            }).catch(function(error) {
                alert('Error updating the API key.');
                console.error('Error updating the API key:', error);
            });
        }
    }

    /**
     * Retrieves the OpenAI API key from storage.
     * If not found, prompts the user to input it and saves it.
     * @returns {Promise<string|null>} Promise resolving to the API key or null if not provided.
     */
    function getApiKey() {
        return new Promise(function(resolve, reject) {
            GM.getValue('openai_api_key').then(function(apiKey) {
                if (apiKey) {
                    resolve(apiKey.trim());
                } else {
                    const userInput = prompt('Please enter your OpenAI API key:', '');
                    if (userInput) {
                        GM.setValue('openai_api_key', userInput.trim()).then(function() {
                            resolve(userInput.trim());
                        }).catch(function(error) {
                            reject(error);
                        });
                    } else {
                        alert('An API key is required to generate a summary.');
                        resolve(null);
                    }
                }
            }).catch(function(error) {
                reject(error);
            });
        });
    }

    /**
     * Displays the summary overlay with the provided content.
     * Adds functionality to close the overlay by clicking the close button,
     * clicking outside the content area, or pressing the 'Escape' key.
     * @param {string} content - HTML content to display inside the overlay.
     */
    function showSummaryOverlay(content) {
        // Check if the overlay already exists to prevent multiple instances
        if (document.getElementById('summarize-overlay')) {
            updateSummaryOverlay(content);
            return;
        }

        // Create the overlay element
        const overlay = document.createElement('div');
        overlay.id = 'summarize-overlay';
        overlay.innerHTML = `
            <div id="summarize-close">&times;</div>
            <div id="summarize-content">${content}</div>
        `;
        document.body.appendChild(overlay);

        // Disable background scrolling when the overlay is open
        document.body.style.overflow = 'hidden';

        // Add event listener to the close button
        document.getElementById('summarize-close').addEventListener('click', closeOverlay);

        // Add event listener to close the overlay when clicking outside the content area
        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) {
                closeOverlay();
            }
        });

        // Add event listener for the 'Escape' key to close the overlay
        document.addEventListener('keydown', onEscapePress);

        /**
         * Handles the 'Escape' key press to close the overlay.
         * @param {KeyboardEvent} e - The keyboard event.
         */
        function onEscapePress(e) {
            if (e.key === 'Escape') {
                closeOverlay();
            }
        }

        /**
         * Closes the summary overlay and re-enables background scrolling.
         */
        function closeOverlay() {
            if (document.getElementById('summarize-overlay')) {
                document.getElementById('summarize-overlay').remove();
                document.body.style.overflow = '';
                document.removeEventListener('keydown', onEscapePress);
            }
        }
    }

    /**
     * Updates the content within the summary overlay.
     * @param {string} content - New HTML content to display.
     */
    function updateSummaryOverlay(content) {
        const contentDiv = document.getElementById('summarize-content');
        if (contentDiv) {
            contentDiv.innerHTML = content;
        }
    }

    /**
     * Displays an error notification at the bottom-left corner of the page.
     * @param {string} message - The error message to display.
     */
    function showErrorNotification(message) {
        // Check if an error notification already exists
        if (document.getElementById('summarize-error')) {
            document.getElementById('summarize-error').innerText = message;
            return;
        }

        // Create the error notification element
        const errorDiv = document.createElement('div');
        errorDiv.id = 'summarize-error';
        errorDiv.innerText = message;
        document.body.appendChild(errorDiv);

        // Remove the error notification after 4 seconds
        setTimeout(function() {
            if (document.getElementById('summarize-error')) {
                document.getElementById('summarize-error').remove();
            }
        }, 4000);
    }

    /**
     * Sends the page content to the OpenAI API to generate a summary.
     * Handles the API response and updates the overlay with the summary or error messages.
     * @param {string} apiKey - The OpenAI API key.
     * @param {string} content - The HTML content of the page to summarize.
     */
    function summarizeContent(apiKey, content) {
        const userLanguage = navigator.language || 'en-US'; // Default to English

        // Prepare the API request payload
        const apiUrl = 'https://api.openai.com/v1/chat/completions';
        const requestData = {
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: `You are a helpful assistant that summarizes articles based on the provided HTML content. You should generate a concise summary that includes a brief introduction, followed by a list of topics, and ends with a short conclusion. For the topics, use appropriate emojis as bullet points, and the topics should consist of descriptive titles summarizing the subject of each topic.

You must always use HTML tags to structure the summary text. The title should be wrapped in <h2> tags, and you must always use the user's language in addition to the article's original language. The generated HTML should be ready to be injected into the target location, and you must never use markdown.

Required structure:
- Use <h2> for the summary title
- Use paragraphs for the introduction and conclusion
- Use appropriate emojis for topics
- Do not add text like "Article Summary" or "Summary of the article" in the summary, nor "Introduction", "Topics", "Conclusion", etc.

User language: ${userLanguage}.
Adapt the text to be short, concise, and informative.`
                },
                {
                    role: 'user',
                    content: `Page content:\n\n${content}`
                }
            ],
            max_tokens: 500,
            temperature: 0.5,
            n: 1,
            stream: false
        };

        // Send the API request using GM.xmlHttpRequest
        GM.xmlHttpRequest({
            method: 'POST',
            url: apiUrl,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            data: JSON.stringify(requestData),
            onload: function(response) {
                if (response && response.status === 200) {
                    try {
                        const resData = JSON.parse(response.responseText);
                        if (resData.choices && resData.choices.length > 0) {
                            const summary = resData.choices[0].message.content;

                            // Replace line breaks with <br> for HTML rendering
                            const formattedSummary = summary.replace(/\n/g, '<br>');

                            // Update the overlay with the generated summary
                            updateSummaryOverlay(formattedSummary);
                        } else {
                            showErrorNotification('Error: Invalid API response.');
                            updateSummaryOverlay('<p>Error: Invalid API response.</p>');
                        }
                    } catch (parseError) {
                        showErrorNotification('Error: Failed to parse API response.');
                        updateSummaryOverlay('<p>Error: Failed to parse API response.</p>');
                        console.error('Error parsing API response:', parseError);
                    }
                } else if (response && response.status === undefined) {
                    // Handle cases where response.status is undefined
                    showErrorNotification('Error: Unexpected API response.');
                    console.error('API response without status:', response);
                    updateSummaryOverlay('<p>Error: Unexpected API response.</p>');
                } else if (response && response.status === 401) {
                    // Handle unauthorized access (invalid API key)
                    showErrorNotification('Error: Invalid API key.');
                    updateSummaryOverlay('<p>Error: Invalid API key.</p>');
                } else {
                    // Handle other types of errors
                    showErrorNotification(`Error: Failed to retrieve summary. Status: ${response.status || 'N/A'}`);
                    updateSummaryOverlay(`<p>Error: Failed to retrieve summary. Status: ${response.status || 'N/A'}</p>`);
                }
            },
            onerror: function() {
                // Handle network errors
                showErrorNotification('Error: Network issue.');
                updateSummaryOverlay('<p>Error: Network issue.</p>');
            },
            onabort: function() {
                // Handle request abortion
                showErrorNotification('Request aborted.');
                updateSummaryOverlay('<p>Request aborted.</p>');
            }
        });
    }

})();
