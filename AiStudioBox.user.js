// ==UserScript==
// @name         AiStudioBox
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  צמצום בלוקי הקוד באופן אוטומטי, הורדת קבצי קוד בשם המקורי שלהם.
// @author       צדיק וטוב לו וההודי של AiStudio
// @match        https://aistudio.google.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=aistudio.google.com
// @updateURL    https://raw.githubusercontent.com/Tzadikvtovlo/AiStudioBox/main/AiStudioBox.user.js
// @downloadURL  https://raw.githubusercontent.com/Tzadikvtovlo/AiStudioBox/main/AiStudioBox.user.js
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    console.log("🚀 AI Studio Code Enhancer (All Blocks) Started!");

    // פונקציית עזר ליצירת אלמנט SVG בטוח מול הגנות ה-CSP של גוגל
    function createSvgElement(tag, attrs) {
        const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
        for (const [k, v] of Object.entries(attrs)) {
            el.setAttribute(k, v);
        }
        return el;
    }

    // אייקון layers-arrow-down קווי ודק
    function createLayersArrowDownIcon() {
        const svg = createSvgElement('svg', {
            viewBox: '0 0 24 24',
            fill: 'none',
            stroke: 'currentColor',
            'stroke-width': '1.4',
            'stroke-linecap': 'round',
            'stroke-linejoin': 'round'
        });
        svg.style.width = '18px';
        svg.style.height = '18px';
        svg.style.flexShrink = '0';

        // חץ יורד
        svg.appendChild(createSvgElement('line', { x1: '12', y1: '2', x2: '12', y2: '11' }));
        svg.appendChild(createSvgElement('polyline', { points: '8 7 12 11 16 7' }));

        // שתי שכבות תחתונות
        svg.appendChild(createSvgElement('polyline', { points: '3 14 12 17 21 14' }));
        svg.appendChild(createSvgElement('polyline', { points: '3 18 12 21 21 18' }));

        return svg;
    }

    // אייקון V לסיום ההורדה
    function createCheckIcon() {
        const svg = createSvgElement('svg', {
            viewBox: '0 0 24 24',
            fill: 'none',
            stroke: 'currentColor',
            'stroke-width': '1.4',
            'stroke-linecap': 'round',
            'stroke-linejoin': 'round'
        });
        svg.style.width = '18px';
        svg.style.height = '18px';
        svg.style.flexShrink = '0';

        svg.appendChild(createSvgElement('polyline', { points: '20 6 9 17 4 12' }));
        return svg;
    }

    // --- פונקציות ליבה ---

    function getFilenameForBlock(block) {
        let filename = 'code_snippet.txt';
        const regex = /([a-zA-Z0-9_\-]+\.(?:py|js|html|css|cpp|c|h|java|cs|ts|json|txt|md|sh|yaml|yml|xml|php|rb|go|rs|jsx|tsx|vue|svelte|sql))/ig;

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
            if (matches.length > 0) {
                filename = matches[matches.length - 1][1];
            } else {
                const headerMatch = block.textContent.split('\n')[0].match(regex);
                if (headerMatch) filename = headerMatch[0];
            }
        }
        return filename;
    }

    function extractCode(block) {
        let clone = block.cloneNode(true);
        clone.querySelectorAll('button, mat-icon, [data-test-id], .header-bar, .code-block-header').forEach(el => el.remove());
        const codeContainer = clone.querySelector('code') || clone.querySelector('pre') || clone;
        let finalCode = codeContainer.textContent || "";
        return finalCode.replace(/^\s*[\r\n]/, '').trimEnd();
    }

    function triggerDownload(content, filename) {
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    function getNativeDownloadBtn(block) {
        const buttons = block.querySelectorAll('button');
        for (let btn of buttons) {
            const html = btn.innerHTML.toLowerCase();
            const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
            const testId = (btn.getAttribute('data-test-id') || '').toLowerCase();

            if (html.includes('download') || aria.includes('download') || testId.includes('download')) {
                return btn;
            }
        }
        return null;
    }

    // --- המנוע המרכזי ---

    function processEverything() {
        const allBlocks = document.querySelectorAll('ms-code-block');
        if (allBlocks.length === 0) return;

        const groups = new Map();

        // 1. מיפוי כל הבלוקים לפי הודעות
        allBlocks.forEach(block => {
            if (block.textContent.trim().length === 0) return;
            const container = block.closest('ms-model-turn, ms-chat-turn, ms-chunk, article, [class*="message"]') || block.parentElement;
            if (!groups.has(container)) groups.set(container, []);
            groups.get(container).push(block);
        });

        // 2. טיפול בבלוק בודד (פתיחה אוטומטית והורדה בשם מקורי)
        allBlocks.forEach(block => {
            try {
                if (block.textContent.trim().length === 0) return;
                if (block.getAttribute('data-ai-hijacked') === 'true') return;
                block.setAttribute('data-ai-hijacked', 'true');

                setTimeout(() => {
                    const expandSpans = block.querySelectorAll('button span, [data-test-id="expand-icon-button"] span, mat-icon');
                    for (let span of expandSpans) {
                        if (span.textContent.trim() === 'expand_less') {
                            const btn = span.closest('button');
                            if (btn) btn.click();
                            break;
                        }
                    }
                }, 800);

                setTimeout(() => {
                    const downloadBtn = getNativeDownloadBtn(block);
                    if (downloadBtn) {
                        const filename = getFilenameForBlock(block);
                        downloadBtn.title = `הורד בשם המקורי: ${filename}`;

                        downloadBtn.addEventListener('click', (e) => {
                            e.stopImmediatePropagation();
                            e.preventDefault();
                            triggerDownload(extractCode(block), filename);

                            const originalBg = downloadBtn.style.backgroundColor;
                            downloadBtn.style.backgroundColor = 'rgba(60, 64, 67, 0.12)';
                            setTimeout(() => { downloadBtn.style.backgroundColor = originalBg; }, 300);
                        }, true);
                    }
                }, 1000);
            } catch (err) {
                console.error("Single block error", err);
            }
        });

        // 3. הזרקת אייקון מרוכז עגול לכל תיבת קוד בהודעה מרובת קבצים
        groups.forEach((blocksInGroup) => {
            try {
                if (blocksInGroup.length < 2) return;

                const count = blocksInGroup.length;
                const tooltipText = `הורדת ${count} קבצים`;

                blocksInGroup.forEach(block => {
                    const nativeDownloadBtn = getNativeDownloadBtn(block);
                    const toolbar = nativeDownloadBtn
                        ? nativeDownloadBtn.parentElement
                        : block.querySelector('.header-bar, .code-block-header, [class*="header"]');

                    if (!toolbar) return;

                    let bulkBtn = toolbar.querySelector('.ai-ext-bulk-btn');
                    if (!bulkBtn) {
                        bulkBtn = document.createElement('button');
                        bulkBtn.className = 'ai-ext-bulk-btn';

                        // עיצוב עגול ושקוף בדומה לשאר כפתורי גוגל
                        bulkBtn.style.cssText = `
                            background: transparent;
                            color: #3c4043;
                            border: none;
                            outline: none;
                            width: 28px;
                            height: 28px;
                            border-radius: 50%;
                            padding: 0;
                            margin: 0 2px;
                            cursor: pointer;
                            display: inline-flex;
                            align-items: center;
                            justify-content: center;
                            vertical-align: middle;
                            box-sizing: border-box;
                            transition: background-color 0.15s;
                            flex-shrink: 0;
                        `;

                        bulkBtn.onmouseover = () => { bulkBtn.style.backgroundColor = 'rgba(60, 64, 67, 0.08)'; };
                        bulkBtn.onmouseout = () => { bulkBtn.style.backgroundColor = 'transparent'; };

                        // הזרקה לפני כפתור ההורדה הבודד
                        if (nativeDownloadBtn) {
                            toolbar.insertBefore(bulkBtn, nativeDownloadBtn);
                        } else {
                            toolbar.appendChild(bulkBtn);
                        }
                    }

                    // עדכון טולטיפ ואייקון
                    if (bulkBtn.getAttribute('data-status') !== 'downloading') {
                        if (bulkBtn.title !== tooltipText) {
                            bulkBtn.title = tooltipText;
                            bulkBtn.replaceChildren(createLayersArrowDownIcon());
                        }

                        if (bulkBtn.getAttribute('data-listener') !== 'true') {
                            bulkBtn.setAttribute('data-listener', 'true');

                            const clickHandler = async (e) => {
                                e.preventDefault();
                                e.stopImmediatePropagation();

                                // מעדכנים סטטוס בכל הכפתורים של אותה הודעה
                                blocksInGroup.forEach(b => {
                                    const btn = b.querySelector('.ai-ext-bulk-btn');
                                    if (btn) {
                                        btn.setAttribute('data-status', 'downloading');
                                        btn.title = 'מוריד...';
                                    }
                                });

                                let downloadedCount = 0;
                                for (let b of blocksInGroup) {
                                    if (b.textContent.trim().length === 0) continue;
                                    const filename = getFilenameForBlock(b);
                                    const codeContent = extractCode(b);
                                    triggerDownload(codeContent, filename);
                                    downloadedCount++;

                                    await new Promise(r => setTimeout(r, 400));
                                }

                                // חיווי סיום בכל הכפתורים
                                blocksInGroup.forEach(b => {
                                    const btn = b.querySelector('.ai-ext-bulk-btn');
                                    if (btn) {
                                        btn.title = `ירדו ${downloadedCount} קבצים בהצלחה!`;
                                        btn.replaceChildren(createCheckIcon());
                                    }
                                });

                                setTimeout(() => {
                                    blocksInGroup.forEach(b => {
                                        const btn = b.querySelector('.ai-ext-bulk-btn');
                                        if (btn) {
                                            btn.removeAttribute('data-status');
                                            btn.title = tooltipText;
                                            btn.replaceChildren(createLayersArrowDownIcon());
                                        }
                                    });
                                }, 3000);
                            };

                            bulkBtn.addEventListener('mousedown', clickHandler, true);
                        }
                    }
                });

            } catch (err) {
                console.error("Toolbar bulk buttons error", err);
            }
        });
    }

    setInterval(processEverything, 1500);

})();
