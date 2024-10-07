// ==UserScript==
// @name         Summarize with AI
// @namespace    https://github.com/insign/summarize-with-ai
// @version      2024.10.11.1517
// @description  Adds a button or keyboard shortcut to summarize articles, news, and similar content using the OpenAI API (gpt-4o-mini model). The summary is displayed in an overlay with enhanced styling and a loading animation.
// @author       Hélio
// @license      GPL-3.0
// @match        *://*/*
// @grant        GM.addStyle
// @grant        GM.xmlHttpRequest
// @grant        GM.setValue
// @grant        GM.getValue
// @grant        GM.getResourceURL
// @connect      api.openai.com
// @require      https://www.unpkg.com/@mozilla/readability@0.5.0/Readability.js
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
    const VERSION = '2024.10.11.1517';

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
                console.log('Summarize with AI: No article detected on this page.');
                return; // Disable further script functionality
            }

            // Set up event listeners to handle focus changes
            setupFocusListeners();
        } catch (error) {
            console.error('Initialization error:', error);
            showErrorNotification('Erro durante a inicialização.');
        }
    }

    /*** Function Definitions ***/

    /**
     * Uses Mozilla's Readability to extract the article's title and content.
     * @returns {Object|null} An object containing the title and content if an article is found, otherwise null.
     */
    function getArticleData() {
        try {
            const documentClone = document.cloneNode(true);
            const readability = new Readability(documentClone);
            const article = readability.parse();

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
                z-index: 100001; /* Increased z-index to ensure visibility */
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
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background-color: #ffffff;
                z-index: 100002; /* Increased z-index to ensure it's above all elements */
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
                font-family: Arial, sans-serif;
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

            /* Summary Content Styling */
            #${CONTENT_ID} {
                margin-top: 40px;
                width: 100%;
                color: #333333;
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
                z-index: 100003; /* Higher than overlay */
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
                #${OVERLAY_ID} {
                    width: 95%;
                    height: 95%;
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
                #${OVERLAY_ID} {
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
            alert('Esta página pode não ser um artigo. Continuando para resumir de qualquer maneira.');
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

            // Display the overlay com animação de carregamento
            showSummaryOverlay('<p class="glow">Gerando resumo...</p>');

            // Envie os dados para a API da OpenAI para resumir
            await summarizeContent(apiKey, payload);
        } catch (error) {
            showErrorNotification('Erro: Falha ao iniciar a sumarização.');
            updateSummaryOverlay('<p>Erro: Falha ao iniciar a sumarização.</p>');
            console.error('Erro no processo de sumarização:', error);
        }
    }

    /**
     * Handles the double-click event on the summarize button to reset the API key.
     */
    function onApiKeyReset() {
        const newKey = prompt('Por favor, insira sua chave de API da OpenAI:', '');
        if (newKey) {
            GM.setValue('openai_api_key', newKey.trim()).then(function() {
                alert('Chave de API atualizada com sucesso.');
            }).catch(function(error) {
                alert('Erro ao atualizar a chave de API.');
                console.error('Erro ao atualizar a chave de API:', error);
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
                const userInput = prompt('Por favor, insira sua chave de API da OpenAI:', '');
                if (userInput) {
                    apiKey = userInput.trim();
                    await GM.setValue('openai_api_key', apiKey);
                    return apiKey;
                } else {
                    alert('É necessária uma chave de API para gerar um resumo.');
                    return null;
                }
            }
        } catch (error) {
            console.error('Erro ao recuperar a chave de API:', error);
            alert('Falha ao recuperar a chave de API.');
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
            <div id="${CLOSE_BUTTON_ID}">&times;</div>
            <div id="${CONTENT_ID}">${content}</div>
        `;
        document.body.appendChild(overlay);

        // Disable background scrolling when the overlay is open
        document.body.style.overflow = 'hidden';

        // Add event listener to the close button
        document.getElementById(CLOSE_BUTTON_ID).addEventListener('click', closeOverlay);

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
            contentDiv.innerHTML = content;
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
            const userLanguage = navigator.language || 'pt-BR'; // Default to Portuguese if navigator.language is undefined

            const requestData = {
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: `Você é um assistente útil que resume artigos com base no título e conteúdo fornecidos. Você deve gerar um resumo conciso que inclua uma breve introdução, seguida por uma lista de tópicos e termine com uma curta conclusão. Para os tópicos, use emojis apropriados como marcadores, e os tópicos devem consistir em títulos descritivos que resumem o assunto de cada tópico.

Você deve sempre usar tags HTML para estruturar o texto do resumo. O título deve estar envolto em tags <h2>, e você deve sempre usar o idioma do usuário além do idioma original do artigo. O HTML gerado deve estar pronto para ser injetado no local de destino, e você nunca deve usar markdown.

Estrutura requerida:
- Use <h2> para o título do resumo
- Use parágrafos para a introdução e conclusão
- Use emojis apropriados para os tópicos
- Não adicione textos como "Resumo do Artigo" ou "Sumário do artigo" no resumo, nem "Introdução", "Tópicos", "Conclusão", etc.

Idioma do usuário: ${userLanguage}.
Adapte o texto para ser curto, conciso e informativo.`
                    },
                    {
                        role: 'user',
                        content: `Título: ${payload.title}\n\nConteúdo: ${payload.content}`
                    }
                ],
                max_tokens: 500,
                temperature: 0.5,
                n: 1,
                stream: false
            };

            // Envie a requisição para a API da OpenAI usando GM.xmlHttpRequest
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

                                // Substitui quebras de linha por <br> para renderização HTML
                                const formattedSummary = summary.replace(/\n/g, '<br>');

                                // Atualiza o overlay com o resumo gerado
                                updateSummaryOverlay(formattedSummary);
                            } else {
                                showErrorNotification('Erro: Resposta inválida da API.');
                                updateSummaryOverlay('<p>Erro: Resposta inválida da API.</p>');
                            }
                        } catch (parseError) {
                            showErrorNotification('Erro: Falha ao analisar a resposta da API.');
                            updateSummaryOverlay('<p>Erro: Falha ao analisar a resposta da API.</p>');
                            console.error('Erro ao analisar a resposta da API:', parseError);
                        }
                    } else if (response && response.status === undefined) {
                        // Lida com casos onde response.status está indefinido
                        showErrorNotification('Erro: Resposta inesperada da API.');
                        console.error('Resposta da API sem status:', response);
                        updateSummaryOverlay('<p>Erro: Resposta inesperada da API.</p>');
                    } else if (response && response.status === 401) {
                        // Lida com acesso não autorizado (chave de API inválida)
                        showErrorNotification('Erro: Chave de API inválida.');
                        updateSummaryOverlay('<p>Erro: Chave de API inválida.</p>');
                    } else {
                        // Lida com outros tipos de erros
                        showErrorNotification(`Erro: Falha ao recuperar o resumo. Status: ${response.status || 'N/A'}`);
                        updateSummaryOverlay(`<p>Erro: Falha ao recuperar o resumo. Status: ${response.status || 'N/A'}</p>`);
                    }
                },
                onerror: function() {
                    // Lida com erros de rede
                    showErrorNotification('Erro: Problema de rede.');
                    updateSummaryOverlay('<p>Erro: Problema de rede.</p>');
                },
                onabort: function() {
                    // Lida com aborto da requisição
                    showErrorNotification('Requisição abortada.');
                    updateSummaryOverlay('<p>Requisição abortada.</p>');
                }
            });
        } catch (error) {
            showErrorNotification('Erro: Falha ao comunicar com a API.');
            updateSummaryOverlay('<p>Erro: Falha ao comunicar com a API.</p>');
            console.error('Erro de comunicação com a API:', error);
        }
    }

})();
