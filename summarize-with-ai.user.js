// ==UserScript==
// @name         Summarize with AI
// @namespace    https://github.com/insign/summarize-with-ai
// @version      2024.10.11.1407
// @description  Adds a button or key shortcut to summarize articles, news, and similar content using the OpenAI API (gpt-4o-mini model). The summary is displayed in an overlay with improved styling and loading animation.
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
                background-color: rgba(0, 123, 255, 0.9);
                color: white;
                font-size: 24px;
                font-weight: bold;
                text-align: center;
                line-height: 50px;
                border-radius: 50%;
                cursor: pointer;
                z-index: 10000;
                box-shadow: 0 2px 5px rgba(0,0,0,0.3);
                transition: background-color 0.3s, transform 0.3s;
            }
            #summarize-button:hover {
                background-color: rgba(0, 123, 255, 1);
                transform: scale(1.1);
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
                border-radius: 8px;
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
                font-size: 14px;
            }
            .glow {
                font-size: 1.2em;
                color: #fff;
                text-align: center;
                animation: glow 1.5s ease-in-out infinite alternate;
            }
            @keyframes glow {
                from {
                    text-shadow: 0 0 10px #00e6e6, 0 0 20px #00e6e6, 0 0 30px #00e6e6, 0 0 40px #00e6e6, 0 0 50px #00e6e6, 0 0 60px #00e6e6;
                }
                to {
                    text-shadow: 0 0 20px #00ffff, 0 0 30px #00ffff, 0 0 40px #00ffff, 0 0 50px #00ffff, 0 0 60px #00ffff, 0 0 70px #00ffff;
                }
            }
            /* Media Queries para dispositivos móveis */
            @media (max-width: 768px) {
                #summarize-button {
                    width: 60px;
                    height: 60px;
                    font-size: 28px;
                    line-height: 60px;
                    bottom: 15px;
                    right: 15px;
                }
                #summarize-overlay {
                    width: 95%;
                    height: 95%;
                }
                #summarize-error {
                    bottom: 15px;
                    left: 15px;
                    font-size: 12px;
                }
            }
            /* Ajustes para telas muito pequenas */
            @media (max-width: 480px) {
                #summarize-button {
                    width: 70px;
                    height: 70px;
                    font-size: 32px;
                    line-height: 70px;
                    bottom: 10px;
                    right: 10px;
                }
                #summarize-overlay {
                    padding: 15px;
                }
                #summarize-error {
                    padding: 8px 16px;
                    font-size: 11px;
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
        showSummaryOverlay('<p class="glow">Gerando resumo...</p>');

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
            alert('Esta página pode não ser um artigo. Prosseguindo para resumir de qualquer forma.');
        }

        // Capture page source
        const pageContent = document.documentElement.outerHTML;

        // Show summary overlay with loading message
        showSummaryOverlay('<p class="glow">Gerando resumo...</p>');

        // Send content to OpenAI API
        summarizeContent(apiKey, pageContent);
    }

    // Handler for resetting the API key
    function onApiKeyReset() {
        const newKey = prompt('Por favor, insira sua chave de API da OpenAI:', '');
        if (newKey) {
            GM_setValue('openai_api_key', newKey.trim());
            alert('Chave de API atualizada com sucesso.');
        }
    }

    // Function to get the API key
    function getApiKey() {
        let apiKey = GM_getValue('openai_api_key');
        if (!apiKey) {
            apiKey = prompt('Por favor, insira sua chave de API da OpenAI:', '');
            if (apiKey) {
                GM_setValue('openai_api_key', apiKey.trim());
            } else {
                alert('A chave de API é necessária para gerar um resumo.');
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

        // Disable background scrolling
        document.body.style.overflow = 'hidden';

        // Add event listeners for closing the overlay
        document.getElementById('summarize-close').addEventListener('click', closeOverlay);
        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) {
                closeOverlay();
            }
        });
        document.addEventListener('keydown', onEscapePress);

        function onEscapePress(e) {
            if (e.key === 'Escape') {
                closeOverlay();
            }
        }

        function closeOverlay() {
            overlay.remove();
            document.body.style.overflow = '';
            document.removeEventListener('keydown', onEscapePress);
        }
    }

    // Function to update the summary content
    function updateSummaryOverlay(content) {
        const contentDiv = document.getElementById('summarize-content');
        if (contentDiv) {
            contentDiv.innerHTML = content;
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

    // Function to summarize the content using OpenAI API (non-streaming)
    function summarizeContent(apiKey, content) {
        const userLanguage = navigator.language || 'pt-BR'; // Ajuste para português por padrão

        // Prepare the API request
        const apiUrl = 'https://api.openai.com/v1/chat/completions';
        const requestData = {
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system', content: `Você é um assistente útil que resume artigos com base no conteúdo HTML fornecido. Você deve gerar um resumo conciso que inclua uma breve introdução, seguida por uma lista de tópicos e termine com uma breve conclusão. Para os tópicos, você deve usar emojis apropriados como marcadores, e os tópicos devem consistir em títulos descritivos resumindo o assunto do tópico.

                    Você deve sempre usar tags HTML para estruturar o texto do resumo. O título deve estar envolvido em tags h2, e você deve sempre usar o idioma do usuário além do idioma original do artigo. O HTML gerado deve estar pronto para ser injetado no destino final, e você nunca deve usar markdown.

                    Estrutura necessária:
                    - Use h2 para o título do resumo
                    - Use parágrafos para a introdução e conclusão
                    - Use emojis apropriados para tópicos
                    - Não adicione textos como "Resumo do artigo" ou "Sumário do artigo" no resumo, nem "Introdução", "Tópicos", "Conclusão", etc.

                    Idioma do usuário: ${userLanguage}.
                    Adapte o texto para ser curto, conciso e informativo.
                    `
                },
                { role: 'user', content: `Conteúdo da página: \n\n${content}` }
            ],
            max_tokens: 500,
            temperature: 0.5,
            n: 1,
            stream: false
        };

        // Send the request using GM_xmlhttpRequest
        GM_xmlhttpRequest({
            method: 'POST',
            url: apiUrl,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            data: JSON.stringify(requestData),
            onload: function(response) {
                if (response.status === 200) {
                    const resData = JSON.parse(response.responseText);
                    if (resData.choices && resData.choices.length > 0) {
                        const summary = resData.choices[0].message.content;
                        updateSummaryOverlay(summary.replaceAll('\n', '<br>'));
                    } else {
                        showErrorNotification('Erro: Resposta inválida da API.');
                        updateSummaryOverlay('<p>Erro: Resposta inválida da API.</p>');
                    }
                } else if (response.status === 401) {
                    showErrorNotification('Erro: Chave de API inválida.');
                    updateSummaryOverlay('<p>Erro: Chave de API inválida.</p>');
                } else {
                    showErrorNotification(`Erro: Falha ao recuperar o resumo. Status: ${response.status}`);
                    updateSummaryOverlay(`<p>Erro: Falha ao recuperar o resumo. Status: ${response.status}</p>`);
                }
            },
            onerror: function() {
                showErrorNotification('Erro: Problema de rede.');
                updateSummaryOverlay('<p>Erro: Problema de rede.</p>');
            },
            onabort: function() {
                showErrorNotification('Requisição cancelada.');
                updateSummaryOverlay('<p>Requisição cancelada.</p>');
            }
        });
    }

})();
