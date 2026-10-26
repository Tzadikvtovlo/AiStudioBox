// ==UserScript==
// @name         AiStudioBox
// @namespace    http://tampermonkey.net/
// @version      2.6
// @description  צמצום חכם, מסגרות זוהרות, אייקוני רשימה דינמיים, ספירת קבצים מלאה ושינוי שם קובץ מותאם אישית בטולטיפ.
// @author       צדיק וטוב לו וההודי של AiStudio
// @match        https://aistudio.google.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=aistudio.google.com
// @updateURL    https://raw.githubusercontent.com/Tzadikvtovlo/AiStudioBox/main/AiStudioBox.user.js
// @downloadURL  https://raw.githubusercontent.com/Tzadikvtovlo/AiStudioBox/main/AiStudioBox.user.js
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    console.log("🚀 AI Studio Code Enhancer Started! (Lucide Icons & Dynamic Counts)");

    const CONFIG_KEY = 'AiStudioBox_CollapseMode';
    // 'live' = צמצום תוך כדי כתיבה | 'finished' = צמצום רק בסיום
    let collapseMode = localStorage.getItem(CONFIG_KEY) || 'live';

    // משתנים גלובליים לניהול הטולטיפ האינטראקטיבי של שמות הקבצים
    let customTooltipEl = null;
    let hideTooltipTimeout = null;

    // --- שרטוטי אייקונים קוויים נקיים (בהשראת Lucide) ---

    // מצב בלייב: רשימה + חיצים פונים פנימה (list-chevrons-down-up - מסמל צמצום אקטיבי)
    const listChevronsDownUpPaths = [
        {tag: 'line', attrs: {x1: '3', y1: '6', x2: '10', y2: '6'}},
        {tag: 'line', attrs: {x1: '3', y1: '12', x2: '10', y2: '12'}},
        {tag: 'line', attrs: {x1: '3', y1: '18', x2: '10', y2: '18'}},
        {tag: 'polyline', attrs: {points: '14 6 17 9 20 6'}}, // חץ יורד (למעלה)
        {tag: 'polyline', attrs: {points: '14 18 17 15 20 18'}} // חץ עולה (למטה)
    ];

    // מצב בסיום: רשימה + חיצים פונים החוצה (list-chevrons-up-down - מסמל הרחבה/המתנה)
    const listChevronsUpDownPaths = [
        {tag: 'line', attrs: {x1: '3', y1: '6', x2: '10', y2: '6'}},
        {tag: 'line', attrs: {x1: '3', y1: '12', x2: '10', y2: '12'}},
        {tag: 'line', attrs: {x1: '3', y1: '18', x2: '10', y2: '18'}},
        {tag: 'polyline', attrs: {points: '14 9 17 6 20 9'}}, // חץ עולה (למעלה)
        {tag: 'polyline', attrs: {points: '14 15 17 18 20 15'}} // חץ יורד (למטה)
    ];

    // אייקון שכבות עם חץ למטה (layers-arrow-down) - להורדת כל קבצי השיחה או קבוצה
    const layersArrowPaths = [
        {tag: 'line', attrs: {x1: '12', y1: '2', x2: '12', y2: '11'}},
        {tag: 'polyline', attrs: {points: '8 7 12 11 16 7'}},
        {tag: 'polyline', attrs: {points: '3 14 12 17 21 14'}},
        {tag: 'polyline', attrs: {points: '3 18 12 21 21 18'}}
    ];

    // אייקון V לאישור הורדה
    const checkPaths = [{tag: 'polyline', attrs: {points: '20 6 9 17 4 12'}}];

    function createSvg(width, height, elements) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '1.4');
        svg.setAttribute('stroke-linecap', 'round');
        svg.setAttribute('stroke-linejoin', 'round');
        svg.style.width = width;
        svg.style.height = height;
        svg.style.flexShrink = '0';
        elements.forEach(el => {
            const node = document.createElementNS('http://www.w3.org/2000/svg', el.tag);
            for (const [k, v] of Object.entries(el.attrs)) { node.setAttribute(k, v); }
            svg.appendChild(node);
        });
        return svg;
    }

    // --- הזרקת עיצוב (CSS) חסין שגיאות ---
    function injectStyles() {
        if (document.getElementById('ai-ext-styles')) return;
        const style = document.createElement('style');
        style.id = 'ai-ext-styles';
        style.textContent = `
            @keyframes aiExtPulseRed {
                0% { border-color: rgba(234, 67, 53, 0.8); box-shadow: 0 0 8px rgba(234, 67, 53, 0.4); }
                50% { border-color: rgba(234, 67, 53, 0.2); box-shadow: 0 0 2px rgba(234, 67, 53, 0.1); }
                100% { border-color: rgba(234, 67, 53, 0.8); box-shadow: 0 0 8px rgba(234, 67, 53, 0.4); }
            }
            .ai-ext-border-overlay {
                position: absolute; top: -1px; left: -1px; right: -1px; bottom: -1px;
                pointer-events: none; z-index: 99; border-radius: 12px;
                border: 2px solid transparent; transition: border-color 0.3s ease, box-shadow 0.3s ease;
            }
            .ai-ext-island {
                position: fixed; top: 12px; left: 50%; transform: translateX(-50%);
                display: flex; align-items: center; gap: 8px; z-index: 999999;
                background: transparent; border: none; box-shadow: none; padding: 4px;
            }
            .ai-ext-icon-btn {
                background: transparent; color: var(--sys-color-on-surface, currentColor);
                border: none; width: 36px; height: 36px;
                border-radius: 50%; cursor: pointer; display: inline-flex; align-items: center; justify-content: center;
                transition: background 0.2s, transform 0.1s, opacity 0.2s, color 0.2s;
                opacity: 0.6; padding: 0; outline: none;
            }
            .ai-ext-icon-btn:hover {
                opacity: 1;
                background: rgba(128, 128, 128, 0.15);
            }
            .ai-ext-icon-btn:active { transform: scale(0.92); }

            /* עיצוב טולטיפ שינוי שם הקובץ */
            .ai-ext-custom-tooltip {
                position: fixed;
                z-index: 1000000;
                display: none;
                align-items: center;
                gap: 8px;
                background: #1e1f20;
                color: #e3e3e3;
                border: 1px solid rgba(255, 255, 255, 0.16);
                border-radius: 8px;
                padding: 6px 10px;
                box-shadow: 0 6px 18px rgba(0, 0, 0, 0.45);
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                font-size: 13px;
                direction: rtl;
                pointer-events: auto;
            }
            .ai-ext-tooltip-label {
                font-size: 12px;
                color: #c4c7c5;
                white-space: nowrap;
                user-select: none;
            }
            .ai-ext-filename-input {
                background: rgba(255, 255, 255, 0.08);
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 4px;
                color: #ffffff;
                padding: 3px 8px;
                font-size: 12px;
                font-family: monospace, monospace;
                direction: ltr;
                text-align: left;
                outline: none;
                min-width: 150px;
                max-width: 260px;
                transition: border-color 0.2s, background 0.2s;
            }
            .ai-ext-filename-input:focus {
                border-color: #8ab4f8;
                background: rgba(255, 255, 255, 0.14);
            }
        `;
        (document.head || document.documentElement).appendChild(style);
    }

    // --- יצירה וניהול הטולטיפ האינטראקטיבי ---
    function getOrCreateCustomTooltip() {
        if (customTooltipEl) return customTooltipEl;

        const tip = document.createElement('div');
        tip.id = 'ai-ext-filename-tooltip';
        tip.className = 'ai-ext-custom-tooltip';

        const label = document.createElement('span');
        label.className = 'ai-ext-tooltip-label';
        label.textContent = 'שם קובץ:';

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'ai-ext-filename-input';
        input.spellcheck = false;

        tip.appendChild(label);
        tip.appendChild(input);
        document.body.appendChild(tip);

        // שמירת השם בזמן הקלדה
        input.addEventListener('input', (e) => {
            if (tip.currentBlock) {
                const val = e.target.value.trim();
                if (val) {
                    tip.currentBlock.setAttribute('data-custom-filename', val);
                } else {
                    tip.currentBlock.removeAttribute('data-custom-filename');
                }
            }
        });

        // יציאה בעת לחיצה על Enter
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                input.blur();
                tip.style.display = 'none';
            }
        });

        // סגירה בעזיבת פוקוס
        input.addEventListener('blur', () => {
            hideTooltipTimeout = setTimeout(() => {
                tip.style.display = 'none';
            }, 250);
        });

        tip.addEventListener('mouseenter', () => {
            clearTimeout(hideTooltipTimeout);
        });

        tip.addEventListener('mouseleave', () => {
            if (document.activeElement !== input) {
                hideTooltipTimeout = setTimeout(() => {
                    tip.style.display = 'none';
                }, 250);
            }
        });

        document.addEventListener('pointerdown', (e) => {
            if (tip.style.display !== 'none' && !tip.contains(e.target) && !e.target.closest('[data-ai-custom-dl]')) {
                tip.style.display = 'none';
            }
        });

        customTooltipEl = tip;
        return tip;
    }

    function updateToggleBtnState(btn) {
        if (collapseMode === 'live') {
            btn.replaceChildren(createSvg('22px', '22px', listChevronsDownUpPaths));
            btn.title = "פעיל: צמצום קוד אוטומטי בלייב (תוך כדי כתיבה)";
        } else {
            btn.replaceChildren(createSvg('22px', '22px', listChevronsUpDownPaths));
            btn.title = "פעיל: צמצום קוד ממתין (רק בסיום כתיבת הבלוק)";
        }
    }

    // --- יצירת השליטה המרכזית (האי השקוף) ---
    function createCentralControls() {
        if (document.getElementById('ai-ext-central-controls')) return;

        const container = document.createElement('div');
        container.id = 'ai-ext-central-controls';
        container.className = 'ai-ext-island';

        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'ai-ext-icon-btn';
        updateToggleBtnState(toggleBtn);
        toggleBtn.onclick = (e) => {
            e.preventDefault();
            collapseMode = (collapseMode === 'live') ? 'finished' : 'live';
            localStorage.setItem(CONFIG_KEY, collapseMode);
            updateToggleBtnState(toggleBtn);
        };

        const downloadAllBtn = document.createElement('button');
        downloadAllBtn.id = 'ai-ext-download-all-btn'; // הוספת מזהה ייחודי כדי לעדכן דינמית את הכיתוב
        downloadAllBtn.className = 'ai-ext-icon-btn';
        downloadAllBtn.replaceChildren(createSvg('22px', '22px', layersArrowPaths));
        downloadAllBtn.title = "הורדת קבצים בשיחה זו"; // יתעדכן דינמית בלופ

        downloadAllBtn.onclick = async (e) => {
            e.preventDefault();
            const blocks = Array.from(document.querySelectorAll('ms-code-block')).filter(b => b.textContent.trim().length > 0);
            if (blocks.length === 0) return;

            downloadAllBtn.setAttribute('data-status', 'downloading');
            downloadAllBtn.replaceChildren(createSvg('22px', '22px', checkPaths));
            downloadAllBtn.title = 'מוריד...';

            let count = 0;
            for (let b of blocks) {
                triggerDownload(extractCode(b), getFilenameForBlock(b));
                count++;
                await new Promise(r => setTimeout(r, 400));
            }

            downloadAllBtn.title = `ירדו ${count} קבצים בהצלחה!`;
            setTimeout(() => {
                downloadAllBtn.removeAttribute('data-status');
                downloadAllBtn.replaceChildren(createSvg('22px', '22px', layersArrowPaths));
                // הטולטיפ יחזור לעצמו באופן אוטומטי בלופ
            }, 3000);
        };

        container.appendChild(toggleBtn);
        container.appendChild(downloadAllBtn);
        document.body.appendChild(container);
    }

    // --- פונקציות ליבה לטיפול בקוד ---
    function getFilenameForBlock(block) {
        // אם המשתמש הגדיר שם קובץ מותאם אישית בטולטיפ
        const custom = block.getAttribute('data-custom-filename');
        if (custom && custom.trim().length > 0) return custom.trim();

        let filename = 'code_snippet.txt';
        const regex = /([a-zA-Z0-9_\-]+\.(?:json|jsx|tsx|html|yaml|vue|svelte|cpp|css|java|py|js|ts|cs|txt|md|sh|yml|xml|php|rb|go|rs|sql|c|h))\b/ig;
        const container = block.closest('ms-model-turn, ms-chat-turn, ms-chunk, article, [class*="message"]') || block.parentElement;
        if (container) {
            let textBefore = "";
            const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
            let currentNode;
            while ((currentNode = walker.nextNode())) {
                if (block.contains(currentNode)) break;
                textBefore += currentNode.nodeValue + " ";
            }
            const matches = [...textBefore.matchAll(regex)];
            if (matches.length > 0) filename = matches[matches.length - 1][1];
            else {
                const headerMatch = block.textContent.split('\n').slice(0, 3).join(' ').match(regex);
                if (headerMatch) filename = headerMatch[0];
            }
        }
        return filename;
    }

    function extractCode(block) {
        let clone = block.cloneNode(true);
        clone.querySelectorAll('button, mat-icon, [data-test-id], .header-bar, .code-block-header').forEach(el => el.remove());
        const codeContainer = clone.querySelector('code') || clone.querySelector('pre') || clone;
        return (codeContainer.textContent || "").replace(/^\s*[\r\n]/, '').trimEnd();
    }

    function triggerDownload(content, filename) {
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
    }

    function getNativeDownloadBtn(block) {
        const buttons = block.querySelectorAll('button');
        for (let btn of buttons) {
            const html = btn.innerHTML.toLowerCase(), aria = (btn.getAttribute('aria-label') || '').toLowerCase(), testId = (btn.getAttribute('data-test-id') || '').toLowerCase();
            if (html.includes('download') || aria.includes('download') || testId.includes('download')) return btn;
        }
        return null;
    }

    function collapseBlock(block) {
        setTimeout(() => {
            const expandSpans = block.querySelectorAll('button span, [data-test-id="expand-icon-button"] span, mat-icon');
            for (let span of expandSpans) {
                if (span.textContent.trim() === 'expand_less') {
                    const btn = span.closest('button');
                    if (btn) btn.click();
                    break;
                }
            }
        }, 300);
    }

    // --- מנוע הריצה המרכזי ---
    function processEverything() {
        injectStyles();
        createCentralControls();

        const allBlocks = document.querySelectorAll('ms-code-block');
        const validBlocks = Array.from(allBlocks).filter(b => b.textContent.trim().length > 0);

        // --- עדכון דינמי של הטולטיפ לכמות הקבצים בשיחה ---
        const downloadAllBtn = document.getElementById('ai-ext-download-all-btn');
        if (downloadAllBtn && downloadAllBtn.getAttribute('data-status') !== 'downloading') {
            downloadAllBtn.title = `הורדת ${validBlocks.length} קבצים בשיחה זו`;
        }

        if (allBlocks.length === 0) return;

        const groups = new Map();

        allBlocks.forEach(block => {
            if (block.textContent.trim().length === 0) return;
            const container = block.closest('ms-model-turn, ms-chat-turn, ms-chunk, article, [class*="message"]') || block.parentElement;
            if (!groups.has(container)) groups.set(container, []);
            groups.get(container).push(block);

            try {
                let overlay = block.querySelector('.ai-ext-border-overlay');
                if (!overlay) {
                    overlay = document.createElement('div');
                    overlay.className = 'ai-ext-border-overlay';
                    block.style.position = 'relative';
                    block.appendChild(overlay);
                }

                const currentLength = block.textContent.length;
                const prevLength = parseInt(block.getAttribute('data-prev-length') || '0', 10);
                let stableTicks = parseInt(block.getAttribute('data-stable-ticks') || '0', 10);

                if (currentLength !== prevLength && currentLength > 0) {
                    // כותב כעת -> הבהוב אדום
                    block.setAttribute('data-prev-length', currentLength);
                    block.setAttribute('data-stable-ticks', '0');
                    overlay.style.animation = 'aiExtPulseRed 1.5s infinite';

                    // צמצום מיידי בלייב
                    if (collapseMode === 'live' && !block.hasAttribute('data-collapsed-by-script')) {
                        collapseBlock(block);
                        block.setAttribute('data-collapsed-by-script', 'true');
                    }
                    return;
                } else {
                    stableTicks++;
                    block.setAttribute('data-stable-ticks', stableTicks);
                    if (stableTicks < 3) return;
                }

                // סיום כתיבה!
                if (block.getAttribute('data-ai-hijacked') === 'true') return;
                block.setAttribute('data-ai-hijacked', 'true');

                // הפיכה לירוק זוהר קבוע
                overlay.style.animation = 'none';
                overlay.style.borderColor = 'rgba(52, 168, 83, 0.9)';
                overlay.style.boxShadow = '0 0 8px rgba(52, 168, 83, 0.5)';

                // צמצום בסיום
                if (!block.hasAttribute('data-collapsed-by-script')) {
                    collapseBlock(block);
                    block.setAttribute('data-collapsed-by-script', 'true');
                }

                // הורדה אישית עם טולטיפ אינטראקטיבי לשינוי שם
                setTimeout(() => {
                    const downloadBtn = getNativeDownloadBtn(block);
                    if (downloadBtn && !downloadBtn.hasAttribute('data-ai-custom-dl')) {
                        downloadBtn.setAttribute('data-ai-custom-dl', 'true');
                        downloadBtn.removeAttribute('title'); // מניעת הטולטיפ הרגיל של הדפדפן

                        // הצגת הטולטיפ ועריכת השם בריחוף
                        downloadBtn.addEventListener('mouseenter', () => {
                            clearTimeout(hideTooltipTimeout);
                            const tip = getOrCreateCustomTooltip();
                            tip.currentBlock = block;
                            const input = tip.querySelector('.ai-ext-filename-input');
                            input.value = getFilenameForBlock(block);

                            tip.style.display = 'flex';
                            tip.style.visibility = 'hidden';

                            const rect = downloadBtn.getBoundingClientRect();
                            const tipRect = tip.getBoundingClientRect();
                            let top = rect.top - tipRect.height - 8;
                            if (top < 10) top = rect.bottom + 8;
                            let left = rect.left + (rect.width / 2) - (tipRect.width / 2);
                            if (left < 10) left = 10;
                            if (left + tipRect.width > window.innerWidth - 10) {
                                left = window.innerWidth - tipRect.width - 10;
                            }

                            tip.style.top = `${top}px`;
                            tip.style.left = `${left}px`;
                            tip.style.visibility = 'visible';
                        });

                        downloadBtn.addEventListener('mouseleave', () => {
                            hideTooltipTimeout = setTimeout(() => {
                                const tip = getOrCreateCustomTooltip();
                                const input = tip.querySelector('.ai-ext-filename-input');
                                if (document.activeElement !== input) {
                                    tip.style.display = 'none';
                                }
                            }, 250);
                        });

                        downloadBtn.addEventListener('click', (e) => {
                            e.stopImmediatePropagation(); e.preventDefault();
                            const currentFilename = getFilenameForBlock(block);
                            triggerDownload(extractCode(block), currentFilename);
                            const originalBg = downloadBtn.style.backgroundColor;
                            downloadBtn.style.backgroundColor = 'rgba(60, 64, 67, 0.12)';
                            setTimeout(() => { downloadBtn.style.backgroundColor = originalBg; }, 300);
                        }, true);
                    }
                }, 1000);

            } catch (err) { }
        });

        // כפתור מרוכז להודעה עצמה
        groups.forEach((blocksInGroup) => {
            if (blocksInGroup.length < 2) return;
            const allFinished = blocksInGroup.every(b => b.getAttribute('data-ai-hijacked') === 'true');
            if (!allFinished) return;

            const tooltipText = `הורדת ${blocksInGroup.length} קבצים בהודעה זו`;

            blocksInGroup.forEach(block => {
                const nativeDownloadBtn = getNativeDownloadBtn(block);
                const toolbar = nativeDownloadBtn ? nativeDownloadBtn.parentElement : block.querySelector('.header-bar, .code-block-header, [class*="header"]');
                if (!toolbar) return;

                let bulkBtn = toolbar.querySelector('.ai-ext-bulk-btn');
                if (!bulkBtn) {
                    bulkBtn = document.createElement('button');
                    bulkBtn.className = 'ai-ext-bulk-btn ai-ext-icon-btn';
                    bulkBtn.style.width = '28px'; bulkBtn.style.height = '28px'; bulkBtn.style.margin = '0 2px';
                    bulkBtn.style.color = '#3c4043';
                    if (nativeDownloadBtn) toolbar.insertBefore(bulkBtn, nativeDownloadBtn); else toolbar.appendChild(bulkBtn);
                }

                if (bulkBtn.getAttribute('data-status') !== 'downloading') {
                    if (bulkBtn.title !== tooltipText) { bulkBtn.title = tooltipText; bulkBtn.replaceChildren(createSvg('18px', '18px', layersArrowPaths)); }

                    if (bulkBtn.getAttribute('data-listener') !== 'true') {
                        bulkBtn.setAttribute('data-listener', 'true');
                        bulkBtn.addEventListener('mousedown', async (e) => {
                            e.preventDefault(); e.stopImmediatePropagation();
                            blocksInGroup.forEach(b => { const btn = b.querySelector('.ai-ext-bulk-btn'); if (btn) { btn.setAttribute('data-status', 'downloading'); btn.title = 'מוריד...'; } });
                            let downloadedCount = 0;
                            for (let b of blocksInGroup) {
                                if (b.textContent.trim().length === 0) continue;
                                triggerDownload(extractCode(b), getFilenameForBlock(b));
                                downloadedCount++;
                                await new Promise(r => setTimeout(r, 400));
                            }
                            blocksInGroup.forEach(b => { const btn = b.querySelector('.ai-ext-bulk-btn'); if (btn) { btn.title = `ירדו ${downloadedCount} קבצים!`; btn.replaceChildren(createSvg('18px', '18px', checkPaths)); } });
                            setTimeout(() => { blocksInGroup.forEach(b => { const btn = b.querySelector('.ai-ext-bulk-btn'); if (btn) { btn.removeAttribute('data-status'); btn.title = tooltipText; btn.replaceChildren(createSvg('18px', '18px', layersArrowPaths)); } }); }, 3000);
                        }, true);
                    }
                }
            });
        });
    }

    setInterval(processEverything, 1500);
})();
