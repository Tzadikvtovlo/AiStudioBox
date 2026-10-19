// ==UserScript==
// @name         AiStudio מצמצם בלוקי קוד ב
// @namespace    http://tampermonkey.net/
// @version      0.9
// @description  AiStudioBox
// @author       צדיק וטוב לו וההודי של gemini
// @match        https://aistudio.google.com/*
// @updateURL    https://raw.githubusercontent.com/Tzadikvtovlo/AiStudioBox/main/Tampermonkey.user.js
// @downloadURL  https://raw.githubusercontent.com/Tzadikvtovlo/AiStudioBox/main/Tampermonkey.user.js
// @icon         https://www.google.com/s2/favicons?sz=64&domain=AiStudio.google.com
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    function processCodeBlocks() {
        const codeBlocks = document.querySelectorAll('pre:not([data-collapsed-init])');

        codeBlocks.forEach(pre => {
            pre.setAttribute('data-collapsed-init', 'true');

            const details = document.createElement('details');
            const summary = document.createElement('summary');

            summary.textContent = '◀ לחץ להצגת הקוד';
            summary.style.cssText = 'cursor: pointer; padding: 6px 12px; font-weight: bold; font-family: system-ui, sans-serif; opacity: 0.85; user-select: none;';

            if (pre.parentNode) {
                pre.parentNode.insertBefore(details, pre);
                details.appendChild(summary);
                details.appendChild(pre);
            }
        });
    }

    const observer = new MutationObserver(processCodeBlocks);
    observer.observe(document.body, { childList: true, subtree: true });
})();
