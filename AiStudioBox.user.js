// ==UserScript==
// @name         AiStudioBox
// @namespace    http://tampermonkey.net/
// @version      1.0
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

    console.log("🚀 AI Studio Code Enhancer V7 (Ninja Mode - Clean UI) Started!");

    // חילוץ שם הקובץ במדויק מתוך הטקסט שלפני הבלוק
    function getFilenameForBlock(block) {
        let filename = 'code_snippet.txt';
        const regex = /([a-zA-Z0-9_\-]+\.(?:py|js|html|css|cpp|c|h|java|cs|ts|json|txt|md|sh|yaml|yml|xml|php|rb|go|rs|jsx|tsx|vue|svelte|sql))/ig;
        
        const container = block.closest('ms-chat-turn') || block.parentElement;
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

    function processBlocks() {
        const blocks = document.querySelectorAll('ms-code-block:not([data-ai-hijacked="true"])');
        
        blocks.forEach(block => {
            // מוודא שהבלוק לא ריק
            if (block.textContent.trim().length === 0) return; 
            
            // מסמן את הבלוק כבטיפול
            block.setAttribute('data-ai-hijacked', 'true');

            // --- משימה 1: צמצום (Collapse) אוטומטי ---
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

            // --- משימה 2: השתלטות שקטה (Ninja Mode) על כפתור ההורדה ---
            setTimeout(() => {
                const buttons = block.querySelectorAll('button');
                let downloadBtn = null;
                
                // חיפוש כפתור ההורדה של גוגל
                for (let btn of buttons) {
                    const html = btn.innerHTML.toLowerCase();
                    const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
                    const testId = (btn.getAttribute('data-test-id') || '').toLowerCase();
                    
                    if (html.includes('download') || aria.includes('download') || testId.includes('download')) {
                        downloadBtn = btn;
                        break;
                    }
                }

                // אם מצאנו את הכפתור
                if (downloadBtn) {
                    const filename = getFilenameForBlock(block);
                    
                    // משנה רק את הטקסט שקופץ בריחוף, מבלי לגעת בעיצוב הוויזואלי
                    downloadBtn.title = `הורד בשם המקורי: ${filename}`;
                    
                    // מחליף את פעולת הלחיצה
                    downloadBtn.addEventListener('click', (e) => {
                        e.stopImmediatePropagation(); // חוסם את ההורדה המקורית של גוגל
                        e.preventDefault();
                        
                        // משכפלים את הבלוק רק בזיכרון
                        let clone = block.cloneNode(true);
                        
                        // מנקים אלמנטים מיותרים
                        clone.querySelectorAll('button, mat-icon, [data-test-id], .header-bar, .code-block-header').forEach(el => el.remove());
                        
                        // חילוץ הקוד
                        const codeContainer = clone.querySelector('code') || clone.querySelector('pre') || clone;
                        let finalCode = codeContainer.textContent || "";
                        
                        // ניקוי שורות ריקות
                        finalCode = finalCode.replace(/^\s*[\r\n]/, '').trimEnd();

                        // יצירה והורדה של הקובץ התקין
                        const blob = new Blob([finalCode], { type: 'text/plain;charset=utf-8' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = filename;
                        a.click();
                        URL.revokeObjectURL(url);
                        
                        // אפקט קליק עדין מאוד (רק כדי לדעת שההורדה הופעלה)
                        const originalBg = downloadBtn.style.backgroundColor;
                        downloadBtn.style.backgroundColor = 'rgba(15, 157, 88, 0.2)';
                        setTimeout(() => { downloadBtn.style.backgroundColor = originalBg; }, 300);

                    }, true);
                }
            }, 1000); 
            
        });
    }

    // רץ בלולאה ברקע
    setInterval(processBlocks, 1500);

})();
