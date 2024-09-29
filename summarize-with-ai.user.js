// ==UserScript==
// @name         Summarize with AI
// @namespace    https://github.com/insign/summarize-with-ai
// @version      2024.10.11.1453
// @description  Adiciona um botão ou atalho de teclado para resumir artigos, notícias e conteúdos similares usando a API da OpenAI (modelo gpt-4o-mini). O resumo é exibido em uma sobreposição com estilos aprimorados e animação de carregamento.
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

    /*** Inicialização ***/

    // Adicionar evento de teclado para a tecla 'S' para acionar a sumarização
    document.addEventListener('keydown', function(e) {
        const activeElement = document.activeElement;
        const isInput = activeElement && (['INPUT', 'TEXTAREA'].includes(activeElement.tagName) || activeElement.isContentEditable);
        if (!isInput && (e.key === 's' || e.key === 'S')) {
            onSummarizeShortcut();
        }
    });

    // Verificar se a página é um artigo e adicionar o botão se for
    isArticlePage().then(function(isArticle) {
        if (isArticle) {
            addSummarizeButton();
        }
    }).catch(function(error) {
        console.error('Erro ao verificar se a página é um artigo:', error);
    });

    /*** Definições de Funções ***/

    // Função para determinar se a página é um artigo
    function isArticlePage() {
        return new Promise(function(resolve, reject) {
            try {
                // Verificar se existe um elemento <article>
                if (document.querySelector('article')) {
                    resolve(true);
                    return;
                }

                // Verificar a meta tag Open Graph
                const ogType = document.querySelector('meta[property="og:type"]');
                if (ogType && ogType.content === 'article') {
                    resolve(true);
                    return;
                }

                // Verificar se a URL contém termos relacionados a notícias ou artigos
                const url = window.location.href;
                if (/news|article|story|post/i.test(url)) {
                    resolve(true);
                    return;
                }

                // Verificar o conteúdo textual significativo (mais de 500 palavras)
                const bodyText = document.body.innerText || "";
                const wordCount = bodyText.split(/\s+/).length;
                if (wordCount > 500) {
                    resolve(true);
                    return;
                }

                resolve(false);
            } catch (error) {
                reject(error);
            }
        });
    }

    // Função para adicionar o botão de sumarização
    function addSummarizeButton() {
        // Criar o elemento do botão
        const button = document.createElement('div');
        button.id = 'summarize-button';
        button.innerText = 'S';
        document.body.appendChild(button);

        // Adicionar listeners de eventos
        button.addEventListener('click', onSummarizeClick);
        button.addEventListener('dblclick', onApiKeyReset);

        // Adicionar estilos via GM.addStyle
        GM.addStyle(`
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

    // Handler para o clique no botão "S"
    function onSummarizeClick() {
        processSummarization();
    }

    // Handler para o atalho de teclado "S"
    function onSummarizeShortcut() {
        isArticlePage().then(function(isArticle) {
            if (!isArticle) {
                alert('Esta página pode não ser um artigo. Prosseguindo para resumir de qualquer forma.');
            }
            processSummarization();
        }).catch(function(error) {
            console.error('Erro ao verificar se a página é um artigo no atalho:', error);
            processSummarization();
        });
    }

    // Função para processar a sumarização
    function processSummarization() {
        getApiKey().then(function(apiKey) {
            if (!apiKey) {
                return;
            }

            // Capturar o conteúdo da página
            const pageContent = document.documentElement.outerHTML;

            // Mostrar sobreposição de resumo com mensagem de carregamento
            showSummaryOverlay('<p class="glow">Gerando resumo...</p>');

            // Enviar conteúdo para a API da OpenAI
            summarizeContent(apiKey, pageContent);
        }).catch(function(error) {
            showErrorNotification('Erro: Falha ao obter a chave da API.');
            updateSummaryOverlay('<p>Erro: Falha ao obter a chave da API.</p>');
            console.error('Erro ao obter a chave da API:', error);
        });
    }

    // Handler para resetar a chave da API
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

    // Função para obter a chave da API
    function getApiKey() {
        return new Promise(function(resolve, reject) {
            GM.getValue('openai_api_key').then(function(apiKey) {
                if (apiKey) {
                    resolve(apiKey.trim());
                } else {
                    const userInput = prompt('Por favor, insira sua chave de API da OpenAI:', '');
                    if (userInput) {
                        GM.setValue('openai_api_key', userInput.trim()).then(function() {
                            resolve(userInput.trim());
                        }).catch(function(error) {
                            reject(error);
                        });
                    } else {
                        alert('A chave de API é necessária para gerar um resumo.');
                        resolve(null);
                    }
                }
            }).catch(function(error) {
                reject(error);
            });
        });
    }

    // Função para exibir a sobreposição de resumo
    function showSummaryOverlay(content) {
        // Verificar se a sobreposição já existe
        if (document.getElementById('summarize-overlay')) {
            updateSummaryOverlay(content);
            return;
        }

        // Criar a sobreposição
        const overlay = document.createElement('div');
        overlay.id = 'summarize-overlay';
        overlay.innerHTML = `
            <div id="summarize-close">&times;</div>
            <div id="summarize-content">${content}</div>
        `;
        document.body.appendChild(overlay);

        // Desabilitar a rolagem de fundo
        document.body.style.overflow = 'hidden';

        // Adicionar listeners para fechar a sobreposição
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
            if (document.getElementById('summarize-overlay')) {
                document.getElementById('summarize-overlay').remove();
                document.body.style.overflow = '';
                document.removeEventListener('keydown', onEscapePress);
            }
        }
    }

    // Função para atualizar o conteúdo da sobreposição de resumo
    function updateSummaryOverlay(content) {
        const contentDiv = document.getElementById('summarize-content');
        if (contentDiv) {
            contentDiv.innerHTML = content;
        }
    }

    // Função para exibir uma notificação de erro
    function showErrorNotification(message) {
        // Verificar se a notificação já existe
        if (document.getElementById('summarize-error')) {
            document.getElementById('summarize-error').innerText = message;
            return;
        }

        const errorDiv = document.createElement('div');
        errorDiv.id = 'summarize-error';
        errorDiv.innerText = message;
        document.body.appendChild(errorDiv);

        // Remover a notificação após 4 segundos
        setTimeout(function() {
            if (document.getElementById('summarize-error')) {
                document.getElementById('summarize-error').remove();
            }
        }, 4000);
    }

    // Função para resumir o conteúdo usando a API da OpenAI (não streaming)
    function summarizeContent(apiKey, content) {
        const userLanguage = navigator.language || 'pt-BR'; // Ajuste para português por padrão

        // Preparar a requisição para a API
        const apiUrl = 'https://api.openai.com/v1/chat/completions';
        const requestData = {
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: `Você é um assistente útil que resume artigos com base no conteúdo HTML fornecido. Você deve gerar um resumo conciso que inclua uma breve introdução, seguida por uma lista de tópicos e termine com uma breve conclusão. Para os tópicos, você deve usar emojis apropriados como marcadores, e os tópicos devem consistir em títulos descritivos resumindo o assunto do tópico.

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
                { role: 'user', content: `Conteúdo da página:\n\n${content}` }
            ],
            max_tokens: 500,
            temperature: 0.5,
            n: 1,
            stream: false
        };

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
                            updateSummaryOverlay(summary.replace(/\n/g, '<br>'));
                        } else {
                            showErrorNotification('Erro: Resposta inválida da API.');
                            updateSummaryOverlay('<p>Erro: Resposta inválida da API.</p>');
                        }
                    } catch (parseError) {
                        showErrorNotification('Erro: Falha ao processar a resposta da API.');
                        updateSummaryOverlay('<p>Erro: Falha ao processar a resposta da API.</p>');
                        console.error('Erro ao analisar a resposta da API:', parseError);
                    }
                } else if (response && response.status === undefined) {
                    // Tratamento para caso o status esteja indefinido
                    showErrorNotification('Erro: Resposta inesperada da API.');
                    console.error('Resposta da API sem status:', response);
                    updateSummaryOverlay('<p>Erro: Resposta inesperada da API.</p>');
                } else if (response && response.status === 401) {
                    showErrorNotification('Erro: Chave de API inválida.');
                    updateSummaryOverlay('<p>Erro: Chave de API inválida.</p>');
                } else {
                    showErrorNotification(`Erro: Falha ao recuperar o resumo. Status: ${response.status || 'N/A'}`);
                    updateSummaryOverlay(`<p>Erro: Falha ao recuperar o resumo. Status: ${response.status || 'N/A'}</p>`);
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
