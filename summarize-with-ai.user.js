// ==UserScript==
// @name         Summarize with AI
// @namespace    https://github.com/insign/summarize-with-ai
// @version      2024.10.11.1524
// @description  Adds a button or keyboard shortcut to summarize articles, news, and similar content using the OpenAI API (gpt-4o-mini model). The summary is displayed in an overlay with enhanced styling and a loading animation.
// @author       Hélio <open@helio.me>
// @license      WTFPL
// @match        *://*/*
// @grant        GM.addStyle
// @grant        GM.xmlHttpRequest
// @grant        GM.setValue
// @grant        GM.getValue
// @connect      api.openai.com
// @require      https://cdnjs.cloudflare.com/ajax/libs/readability/0.5.0/Readability.min.js
// ==/UserScript==

(function() {
    'use strict';

    /*** Constants ***/
    const BUTTON_ID = 'summarize-button';
    const OVERLAY_ID = 'summarize-overlay';
    const CLOSE_BUTTON_ID = 'summarize-close';
    const CONTENT_ID = 'summarize-content';
    const ERROR_ID = 'summarize-error';
    const API_URL = 'https://api.openai.com/v1/chat/completions';
    const VERSION = '2024.10.11.1516';

    /*** Initialization ***/

    // Variable to store whether the current page is an article
    let isArticle = false;
    // Variables to store article title and content
    let articleTitle = '';
    let articleContent = '';

    // Initialize the script
    initialize();

    /**
     * Initializes the userscript by detecting if the page is an article,
     * setting up the summarize button and keyboard shortcuts accordingly.
     */
    async function initialize() {
        try {
            // Use Readability to parse the article
            const articleData = getArticleData();
            if (articleData) {
                isArticle = true;
                articleTitle = articleData.title;
                articleContent = articleData.content;
                addSummarizeButton();
                setupKeyboardShortcuts();
            } else {
                isArticle = false;
                hideSummarizeButton();
                disableKeyboardShortcuts();
            }

            // Set up event listeners to handle focus changes
            setupFocusListeners();
        } catch (error) {
            console.error('Initialization error:', error);
            showErrorNotification('Error during initialization.');
        }
    }

    /*** Function Definitions ***/

    /**
     * Uses Mozilla's Readability to extract the article's title and content.
     * @returns {Object|null} An object containing the title and content if an article is found, otherwise null.
     */
    function getArticleData() {
        try {
            const doc = document.cloneNode(true);
            // Remove script and style tags to avoid parsing issues
            const scripts = doc.querySelectorAll('script, style');
            scripts.forEach(script => script.remove());

            const reader = new Readability(doc);
            const article = reader.parse();

            if (article && article.content && article.title) {
                return {
                    title: article.title,
                    content: article.textContent // Using textContent to send plain text to the API
                };
            } else {
                return null;
            }
        } catch (error) {
            console.error('Readability parsing error:', error);
            return null;
        }
    }

    /**
     * Adds the summarize button to the page with standardized styling.
     * The button is fixed at the bottom-right corner and has a high z-index.
     */
    function addSummarizeButton() {
        // Create the button element
        const button = document.createElement('div');
        button.id = BUTTON_ID;
        button.innerText = 'S';
        document.body.appendChild(button);

        // Add click and double-click event listeners
        button.addEventListener('click', onSummarizeClick);
        button.addEventListener('dblclick', onApiKeyReset);

        // Inject CSS styles using GM.addStyle to standardize them and prevent inheritance
        GM.addStyle(`
            /* Summarize Button Styling */
            #${BUTTON_ID} {
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
                z-index: 99999; /* Increased z-index to ensure visibility */
                box-shadow: 0 2px 5px rgba(0,0,0,0.3);
                transition: background-color 0.3s, transform 0.3s;
                user-select: none;
                font-family: Arial, sans-serif;
            }
            /* Hover effect for the summarize button */
            #${BUTTON_ID}:hover {
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
                background-color: rgba(0, 0, 0, 0.5); /* Semi-transparent background */
                z-index: 100000; /* Increased z-index to ensure it's above all elements */
                display: flex;
                align-items: center;
                justify-content: center;
                overflow: auto;
                font-family: Arial, sans-serif;
            }

            /* Summary Content Container */
            #${CONTENT_ID} {
                background-color: #ffffff;
                padding: 30px;
                border-radius: 10px;
                box-shadow: 0 0 15px rgba(0,0,0,0.5);
                max-width: 90%;
                max-height: 90%;
                overflow: auto;
                position: relative;
                font-size: 1.2em;
                color: #333333;
            }

            /* Close Button Styling */
            #${CLOSE_BUTTON_ID} {
                position: absolute;
                top: 15px;
                right: 15px;
                cursor: pointer;
                font-size: 26px;
                transition: transform 0.2s;
                color: #555555;
            }
            /* Tooltip for Close Button on Hover */
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
                z-index: 100001; /* Higher than overlay */
                font-size: 14px;
                font-family: Arial, sans-serif;
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
                #${BUTTON_ID} {
                    width: 70px;
                    height: 70px;
                    font-size: 32px;
                    line-height: 70px;
                    bottom: 15px;
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

            /* Additional Adjustments for Very Small Screens */
            @media (max-width: 480px) {
                #${BUTTON_ID} {
                    width: 80px;
                    height: 80px;
                    font-size: 36px;
                    line-height: 80px;
                    bottom: 10px;
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

            /* Remove Default Bullet Points from Lists */
            #${CONTENT_ID} ul {
                list-style: none;
                padding: 0;
            }
        `);
    }

    /**
     * Sets up keyboard shortcuts by adding a keydown event listener.
     * The 'S' key triggers the summarization unless an input element is focused.
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
     * Handles the keydown event to trigger summarization when 'S' key is pressed.
     * Ignores the event if an input, textarea, or contenteditable element is focused.
     * @param {KeyboardEvent} e - The keyboard event.
     */
    function handleKeyDown(e) {
        // Check if any input-related element is focused
        const activeElement = document.activeElement;
        const isInput = activeElement && (['INPUT', 'TEXTAREA', 'SELECT'].includes(activeElement.tagName) || activeElement.isContentEditable);
        if (isInput) {
            hideSummarizeButton();
            return;
        }

        // If 'S' or 's' is pressed, trigger summarization
        if (e.key.toLowerCase() === 's') {
            e.preventDefault(); // Prevent default behavior
            onSummarizeShortcut();
        } else {
            // Show the summarize button if 'S' is not pressed and not in input
            showSummarizeButton();
        }
    }

    /**
     * Sets up listeners to monitor focus changes on the page.
     * Hides the summarize button when an input element is focused and shows it otherwise.
     */
    function setupFocusListeners() {
        // Listen for focusin and focusout events to handle button visibility
        document.addEventListener('focusin', handleFocusChange);
        document.addEventListener('focusout', handleFocusChange);
    }

    /**
     * Handles focus changes to show or hide the summarize button.
     * @param {FocusEvent} e - The focus event.
     */
    function handleFocusChange(e) {
        const activeElement = document.activeElement;
        const isInput = activeElement && (['INPUT', 'TEXTAREA', 'SELECT'].includes(activeElement.tagName) || activeElement.isContentEditable);

        if (isInput) {
            hideSummarizeButton();
        } else if (isArticle) {
            showSummarizeButton();
        }
    }

    /**
     * Shows the summarize button by setting its display to block.
     */
    function showSummarizeButton() {
        const button = document.getElementById(BUTTON_ID);
        if (button) {
            button.style.display = 'block';
        }
    }

    /**
     * Hides the summarize button by setting its display to none.
     */
    function hideSummarizeButton() {
        const button = document.getElementById(BUTTON_ID);
        if (button) {
            button.style.display = 'none';
        }
    }

    /**
     * Handles the click event on the summarize button to initiate summarization.
     */
    function onSummarizeClick() {
        processSummarization();
    }

    /**
     * Handles the keyboard shortcut for summarization when 'S' key is pressed.
     * Alerts the user if the page might not be an article but proceeds to summarize.
     */
    function onSummarizeShortcut() {
        if (!isArticle) {
            alert('This page may not be an article. Proceeding to summarize anyway.');
        }
        processSummarization();
    }

    /**
     * Initiates the summarization process by obtaining the API key,
     * preparing the article data, displaying the loading overlay,
     * and sending the data to the OpenAI API.
     */
    async function processSummarization() {
        try {
            const apiKey = await getApiKey();
            if (!apiKey) {
                return;
            }

            // Prepare the data to send to the API
            const payload = {
                title: articleTitle,
                content: articleContent
            };

            // Display the overlay with the loading animation
            showSummaryOverlay('<p class="glow">Summarizing</p>');

            // Send the data to the OpenAI API for summarization
            await summarizeContent(apiKey, payload);
        } catch (error) {
            showErrorNotification('Error: Failed to initiate summarization.');
            updateSummaryOverlay('<p>Error: Failed to initiate summarization.</p>');
            console.error('Summarization process error:', error);
        }
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
    async function getApiKey() {
        try {
            let apiKey = await GM.getValue('openai_api_key');
            if (apiKey) {
                return apiKey.trim();
            } else {
                const userInput = prompt('Please enter your OpenAI API key:', '');
                if (userInput) {
                    apiKey = userInput.trim();
                    await GM.setValue('openai_api_key', apiKey);
                    return apiKey;
                } else {
                    alert('An API key is required to generate a summary.');
                    return null;
                }
            }
        } catch (error) {
            console.error('API key retrieval error:', error);
            alert('Failed to retrieve the API key.');
            return null;
        }
    }

    /**
     * Displays the summary overlay with the provided content.
     * Adds functionality to close the overlay by clicking the close button,
     * clicking outside the content area, or pressing the 'Escape' key.
     * @param {string} content - HTML content to display inside the overlay.
     */
    function showSummaryOverlay(content) {
        // Check if the overlay already exists to prevent multiple instances
        if (document.getElementById(OVERLAY_ID)) {
            updateSummaryOverlay(content);
            return;
        }

        // Create the overlay element
        const overlay = document.createElement('div');
        overlay.id = OVERLAY_ID;
        overlay.innerHTML = `
            <div id="${CONTENT_ID}">
                <div id="${CLOSE_BUTTON_ID}">&times;</div>
                ${content}
            </div>
        `;
        document.body.appendChild(overlay);

        // Disable background scrolling when the overlay is open
        document.body.style.overflow = 'hidden';

        // Reference to the content container
        const contentContainer = document.getElementById(CONTENT_ID);

        // Add event listener to the close button
        document.getElementById(CLOSE_BUTTON_ID).addEventListener('click', closeOverlay);

        // Add event listener to close the overlay when clicking outside the content area
        overlay.addEventListener('click', function(e) {
            if (!contentContainer.contains(e.target)) {
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
            const existingOverlay = document.getElementById(OVERLAY_ID);
            if (existingOverlay) {
                existingOverlay.remove();
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
        const contentDiv = document.getElementById(CONTENT_ID);
        if (contentDiv) {
            contentDiv.innerHTML = `<div id="${CLOSE_BUTTON_ID}">&times;</div>` + content;
            // Re-attach the close button event listener
            document.getElementById(CLOSE_BUTTON_ID).addEventListener('click', closeOverlay);
        }

        /**
         * Closes the summary overlay and re-enables background scrolling.
         */
        function closeOverlay() {
            const existingOverlay = document.getElementById(OVERLAY_ID);
            if (existingOverlay) {
                existingOverlay.remove();
                document.body.style.overflow = '';
                document.removeEventListener('keydown', onEscapePress);
            }
        }

        /**
         * Handles the 'Escape' key press to close the overlay.
         * @param {KeyboardEvent} e - The keyboard event.
         */
        function onEscapePress(e) {
            if (e.key === 'Escape') {
                closeOverlay();
            }
        }
    }

    /**
     * Displays an error notification at the bottom-left corner of the page.
     * @param {string} message - The error message to display.
     */
    function showErrorNotification(message) {
        // Check if an error notification already exists
        if (document.getElementById(ERROR_ID)) {
            document.getElementById(ERROR_ID).innerText = message;
            return;
        }

        // Create the error notification element
        const errorDiv = document.createElement('div');
        errorDiv.id = ERROR_ID;
        errorDiv.innerText = message;
        document.body.appendChild(errorDiv);

        // Remove the error notification after 4 seconds
        setTimeout(function() {
            const existingError = document.getElementById(ERROR_ID);
            if (existingError) {
                existingError.remove();
            }
        }, 4000);
    }

    /**
     * Sends the article data to the OpenAI API to generate a summary.
     * Handles the API response and updates the overlay with the summary or error messages.
     * @param {string} apiKey - The OpenAI API key.
     * @param {Object} payload - An object containing the title and content of the article.
     */
    async function summarizeContent(apiKey, payload) {
        try {
            // Prepare the API request payload
            const userLanguage = navigator.language || 'en-US'; // Default to English

            const requestData = {
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: `You are a helpful assistant that summarizes articles based on the provided title and content. You should generate a concise summary that includes a very brief introduction, followed by a list of topics. For the topics, use appropriate emojis as bullet points, and the topics should consist of descriptive titles summarizing the subject of each topic.

You must always use HTML tags to structure the summary text. You must always use the user's language in addition to the article's original language. The generated HTML should be ready to be injected into the target location, and you must never use markdown.

Required structure:
- Do not add any title
- Use max 2 sentences for the introduction.
- Use appropriate emojis for topics
- Do not add text like "Article Summary" or "Summary of the article" in the summary, nor "Introduction", "Topics", "Conclusion", etc.

User language: ${userLanguage}.
Adapt the text to be short, concise, and informative.`
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

            // Send the API request using GM.xmlHttpRequest
            GM.xmlHttpRequest({
                method: 'POST',
                url: API_URL,
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
        } catch (error) {
            showErrorNotification('Error: Failed to communicate with the API.');
            updateSummaryOverlay('<p>Error: Failed to communicate with the API.</p>');
            console.error('API communication error:', error);
        }
    }

})();
