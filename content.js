(function() {
    'use strict';

    // 配置选项
    const CONFIG = {
        checkDelay: 500,
        highlightColor: '#ff6b6b',
        normalColor: '',
        showNotification: true,
        checkOnSubmit: true,
        caseSensitive: true,
        urlInputWidthThreshold: 150 // 宽度阈值 (px)，可根据实际调整
    };

    let inputHistory = new Set();
    let checkTimeout;
    let panel;
    let minimizeButton;
    let isDragging = false, offsetX = 0, offsetY = 0;
    let isDraggingMinimize = false;

    const STORAGE_KEYS = {
        position: 'duplicateCheckerPanelPosition',
        minimized: 'duplicateCheckerPanelMinimized'
    };

    function savePanelPosition(left, top) {
        localStorage.setItem(STORAGE_KEYS.position, JSON.stringify({ left, top }));
    }

    function saveMinimizedState(minimized) {
        localStorage.setItem(STORAGE_KEYS.minimized, JSON.stringify(minimized));
    }

    function getPanelPosition() {
        const stored = localStorage.getItem(STORAGE_KEYS.position);
        return stored ? JSON.parse(stored) : null;
    }

    function getMinimizedState() {
        const stored = localStorage.getItem(STORAGE_KEYS.minimized);
        return stored ? JSON.parse(stored) : false;
    }

    function createNotification() {
        const notification = document.createElement('div');
        notification.id = 'duplicate-notification';
        document.body.appendChild(notification);
        return notification;
    }

    function showNotification(message) {
        if (!CONFIG.showNotification) return;
        let notification = document.getElementById('duplicate-notification');
        if (!notification) notification = createNotification();
        notification.textContent = message;
        notification.classList.add('visible');
        setTimeout(() => {
            notification.classList.remove('visible');
        }, 3000);
    }

    function checkForDuplicates(inputElement) {
        if (inputElement.offsetWidth <= CONFIG.urlInputWidthThreshold) {
            inputElement.style.backgroundColor = CONFIG.normalColor;
            return false;
        }

        const value = CONFIG.caseSensitive ? inputElement.value : inputElement.value.toLowerCase();
        if (!value.trim()) {
            inputElement.style.backgroundColor = CONFIG.normalColor;
            return false;
        }

        if (inputHistory.has(value)) {
            inputElement.style.backgroundColor = CONFIG.highlightColor;
            showNotification(`检测到重复内容: "${inputElement.value}"`);
            return true;
        } else {
            inputElement.style.backgroundColor = CONFIG.normalColor;
            inputHistory.add(value);
            return false;
        }
    }

    // 自动根据 URL 填写层级并高亮显示
    function updateLevelByURL(urlInput) {
        if (!urlInput || urlInput.offsetWidth <= CONFIG.urlInputWidthThreshold) return;

        const row = urlInput.closest('tr');
        if (!row) return;

        const allInputs = Array.from(row.querySelectorAll('input[type="text"], input[type="email"], textarea'));
        const urlInputs = allInputs.filter(input => input.offsetWidth > CONFIG.urlInputWidthThreshold);
        const levelInputs = allInputs.filter(input => input.offsetWidth <= CONFIG.urlInputWidthThreshold);

        if (urlInputs.length === 0 || levelInputs.length === 0) return;

        const url = urlInput.value.trim();
        if (!url) {
            levelInputs[0].value = '';
            return;
        }

        let path = url.replace(/^https?:\/\//, '');
        path = path.replace(/\/$/, '');
        const level = (path.match(/\//g) || []).length;

        const levelInput = levelInputs[0];
        levelInput.value = level;
        levelInput.dispatchEvent(new Event('input', { bubbles: true }));

        const originalColor = levelInput.style.backgroundColor;
        levelInput.style.backgroundColor = '#d4f7d4';
        setTimeout(() => {
            levelInput.style.backgroundColor = originalColor || '';
        }, 1000);
    }

    function handleInput(event) {
        const inputElement = event.target;
        clearTimeout(checkTimeout);
        checkTimeout = setTimeout(() => {
            checkForDuplicates(inputElement);
            updateLevelByURL(inputElement);
        }, CONFIG.checkDelay);
    }

    function handleSubmit(event) {
        if (!CONFIG.checkOnSubmit) return;
        const form = event.target;
        const inputs = form.querySelectorAll('input[type="text"], input[type="email"], textarea');
        let hasDuplicates = false;
        const currentValues = new Set();
        inputs.forEach(input => {
            if (input.offsetWidth > CONFIG.urlInputWidthThreshold) {
                const value = CONFIG.caseSensitive ? input.value : input.value.toLowerCase();
                if (value.trim() && currentValues.has(value)) {
                    hasDuplicates = true;
                    input.style.backgroundColor = CONFIG.highlightColor;
                } else {
                    currentValues.add(value);
                }
            } else {
                input.style.backgroundColor = CONFIG.normalColor;
            }
        });
        if (hasDuplicates) {
            event.preventDefault();
            showNotification('表单中包含重复内容，请检查！');
            return false;
        }
    }

    function addInputListeners() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.addedNodes.length) {
                    const inputs = document.querySelectorAll('input[type="text"], input[type="email"], textarea');
                    inputs.forEach(input => {
                        if (!input.dataset.listenerAdded) {
                            input.addEventListener('input', handleInput);
                            input.dataset.listenerAdded = 'true';
                        }
                    });
                }
            });
        });
        observer.observe(document.body, { childList: true, subtree: true });

        document.querySelectorAll('input[type="text"], input[type="email"], textarea').forEach(input => {
            input.addEventListener('input', handleInput);
            input.dataset.listenerAdded = 'true';
        });

        document.addEventListener('submit', function(event) {
            if (event.target.tagName === 'FORM') {
                handleSubmit(event);
            }
        }, true);
    }

    function addControlPanel() {
        const storedPosition = getPanelPosition();
        const isMinimized = getMinimizedState();

        panel = document.createElement('div');
        panel.id = 'duplicate-checker-panel';
        panel.style.cssText = `
            position: fixed;
            width: 130px;
            background: #4682B4;
            border: 1px solid #ccc;
            border-radius: 5px;
            padding: 4px 6px;
            z-index: 10001;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        `;

        panel.innerHTML = `
            <div id="dc-panel-header" style="cursor: move; padding: 5px; background: #f0f0f0; border-bottom: 1px solid #ccc;">🔍 内容检查器</div>
            <div style="padding: 5px;">
                <label><input type="checkbox" id="case-sensitive" checked style="margin-right: 5px;"> 区分大小写</label>
            </div>
            <div style="padding: 5px;">
                <label><input type="checkbox" id="check-submit" checked style="margin-right: 5px;"> 提交时检查</label>
            </div>
            <div style="padding: 5px;">
                <label><input type="checkbox" id="show-notification" checked style="margin-right: 5px;"> 显示通知</label>
            </div>
            <button id="clear-history" style="display: block; width: 100%; padding: 5px; margin: 5px 0; background: linear-gradient(135deg, #e6ccff, #d4f7d4); color: #333; border: none; border-radius: 3px; cursor: pointer;">清除历史记录</button>
            <button id="add-ten-rows" style="display: block; width: 100%; padding: 5px; margin: 5px 0; background: linear-gradient(135deg, #cce5ff, #d4f7d4); color: #333; border: none; border-radius: 3px; cursor: pointer;">添加10行</button>
            <button id="minimize-panel" style="display: block; width: 100%; padding: 5px; margin: 5px 0; background: linear-gradient(135deg, #ccffd9, #d4f7d4); color: #333; border: none; border-radius: 3px; cursor: pointer;">最小化面板</button>
        `;

        if (storedPosition) {
            panel.style.left = storedPosition.left + 'px';
            panel.style.top = storedPosition.top + 'px';
            panel.style.right = 'auto';
            panel.style.bottom = 'auto';
        } else {
            panel.style.bottom = '20px';
            panel.style.right = '20px';
        }

        document.body.appendChild(panel);

        minimizeButton = document.createElement('button');
        minimizeButton.innerHTML = '🔍';
        minimizeButton.id = 'minimize-toggle';
        minimizeButton.style.cssText = `
            position: fixed;
            width: 30px;
            height: 30px;
            background: #FF9800;
            color: white;
            border: none;
            border-radius: 50%;
            cursor: pointer;
            font-size: 15px;
            z-index: 10002;
            display: flex;
            align-items: center;
            justify-content: center;
            left: ${storedPosition ? storedPosition.left + 'px' : 'auto'};
            top: ${storedPosition ? storedPosition.top + 'px' : 'auto'};
            right: auto;
            bottom: auto;
        `;
        document.body.appendChild(minimizeButton);

        if (isMinimized) {
            panel.style.display = 'none';
            minimizeButton.style.display = 'block';
            const pos = getPanelPosition();
            if (pos) {
                minimizeButton.style.left = pos.left + 'px';
                minimizeButton.style.top = pos.top + 'px';
            }
        } else {
            panel.style.display = 'block';
            minimizeButton.style.display = 'none';
        }

        const header = panel.querySelector('#dc-panel-header');
        header.addEventListener('mousedown', function(e) {
            isDragging = true;
            offsetX = e.clientX - panel.getBoundingClientRect().left;
            offsetY = e.clientY - panel.getBoundingClientRect().top;
            document.body.style.userSelect = 'none';
        });
        document.addEventListener('mousemove', function(e) {
            if (isDragging) {
                let left = e.clientX - offsetX;
                let top = e.clientY - offsetY;
                left = Math.max(0, Math.min(window.innerWidth - panel.offsetWidth, left));
                top = Math.max(0, Math.min(window.innerHeight - panel.offsetHeight, top));
                panel.style.left = left + 'px';
                panel.style.top = top + 'px';
                panel.style.right = 'auto';
                panel.style.bottom = 'auto';
                minimizeButton.style.left = left + 'px';
                minimizeButton.style.top = top + 'px';
                savePanelPosition(left, top);
            } else if (isDraggingMinimize) {
                let left = e.clientX - offsetX;
                let top = e.clientY - offsetY;
                left = Math.max(0, Math.min(window.innerWidth - minimizeButton.offsetWidth, left));
                top = Math.max(0, Math.min(window.innerHeight - minimizeButton.offsetHeight, top));
                minimizeButton.style.left = left + 'px';
                minimizeButton.style.top = top + 'px';
                savePanelPosition(left, top);
            }
        });
        document.addEventListener('mouseup', function() {
            isDragging = false;
            isDraggingMinimize = false;
            document.body.style.userSelect = '';
        });

        document.getElementById('case-sensitive').addEventListener('change', function() {
            CONFIG.caseSensitive = this.checked;
            inputHistory.clear();
        });
        document.getElementById('check-submit').addEventListener('change', function() {
            CONFIG.checkOnSubmit = this.checked;
        });
        document.getElementById('show-notification').addEventListener('change', function() {
            CONFIG.showNotification = this.checked;
        });
        document.getElementById('clear-history').addEventListener('click', function() {
            inputHistory.clear();
            document.querySelectorAll('input, textarea').forEach(el => {
                el.style.backgroundColor = CONFIG.normalColor;
            });
            showNotification('历史记录已清除');
        });

        document.getElementById('add-ten-rows').addEventListener('click', function() {
            const addButtons = document.querySelectorAll('button');
            const addButton = Array.from(addButtons).find(btn => {
                const hasSvg = btn.querySelector('svg') !== null;
                const hasText = /加标|添加标注/.test(btn.textContent);
                return hasSvg && hasText;
            });
            if (addButton) {
                for (let i = 0; i < 10; i++) addButton.click();
                showNotification('已添加10行');
            } else {
                showNotification('未找到包含SVG和“加标”或“添加标注”的按钮，请检查网页结构');
            }
        });

        document.getElementById('minimize-panel').addEventListener('click', function() {
            const rect = panel.getBoundingClientRect();
            savePanelPosition(rect.left, rect.top);
            saveMinimizedState(true);
            panel.style.display = 'none';
            minimizeButton.style.display = 'block';
            minimizeButton.style.left = rect.left + 'px';
            minimizeButton.style.top = rect.top + 'px';
        });

        minimizeButton.addEventListener('click', function() {
            panel.style.display = 'block';
            const pos = getPanelPosition();
            if (pos) {
                panel.style.left = pos.left + 'px';
                panel.style.top = pos.top + 'px';
                panel.style.right = 'auto';
                panel.style.bottom = 'auto';
                minimizeButton.style.left = pos.left + 'px';
                minimizeButton.style.top = pos.top + 'px';
            }
            minimizeButton.style.display = 'none';
            saveMinimizedState(false);
        });

        minimizeButton.addEventListener('mousedown', function(e) {
            isDraggingMinimize = true;
            offsetX = e.clientX - minimizeButton.getBoundingClientRect().left;
            offsetY = e.clientY - minimizeButton.getBoundingClientRect().top;
            document.body.style.userSelect = 'none';
        });
    }

    function init() {
        console.log('📝 重复内容检查器已启动，由艾合开发');
        addInputListeners();
        addControlPanel();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();