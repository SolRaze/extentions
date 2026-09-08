// ==UserScript==
// @name         lance
// @namespace    https://github.com/SolRaze/extentions/blob/main/userscript/lance 
// @version      1.1
// @description  exporter, usage tracker, enter-as-newline, injection with saved prompts, per-site settings
// @author       SolRaze
// @homepageURL  https://github.com/SolRaze/extensions
// @supportURL   https://github.com/SolRaze/extensions/issues
// @license      MIT
// @icon         data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMjIgMjIiIGZpbGw9ImN1cnJlbnRDb2xvciIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNNSAxOUgzVjE3SDRWMTZINVYxNUg2VjE0SDVWMTNINlYxMkg3VjExSDlWMTBIMTBWOUgxMVY4SDEzVjdIMTRWNkgxNVY1SDE2VjRIMThWM0gxOVY0SDE4VjZIMTdWN0gxNlY4SDE1VjlIMTRWMTFIMTNWMTJIMTJWM TNIMTFWMTVIMTBWMTZIOVYxN0g4VjE2SDdWMTdINlYxOEg1WiIvPjwvc3ZnPg==
// @include      *://claude.ai/*
// @include      *://chat.deepseek.com/*
// @include      *://search.brave.com/ask*
// @noframes
// @run-at       document-idle
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @downloadURL https://update.greasyfork.org/scripts/592831/lance.user.js 
// @updateURL https://update.greasyfork.org/scripts/592831/lance.meta.js
// ==/UserScript==

(function () {
    'use strict';

    const host = window.location.hostname;
    const P =
        host.includes("claude.ai")           ? "claude"   :
        host.includes("deepseek.com")        ? "deepseek" :
        host.includes("search.brave.com")    ? "brave"    : "unknown";

    // ---- ICONS ----
    const LANCE_ICON = `<svg class="lance-pill-icon" viewBox="0 0 22 22" fill="currentColor" aria-hidden="true"><path d="M5 19H3V17H4V16H5V15H6V14H5V13H6V12H7V11H9V10H10V9H11V8H13V7H14V6H15V5H16V4H18V3H19V4H18V6H17V7H16V8H15V9H14V11H13V12H12V13H11V15H10V16H9V17H8V16H7V17H6V18H5Z"/></svg>`;
    const PIN_ICON = `<svg viewBox="0 0 16 16" fill="currentColor" style="width:12px;height:12px;"><path d="M9.828.722a.5.5 0 0 1 .354.146l4.95 4.95a.5.5 0 0 1 0 .707l-1.414 1.414a.5.5 0 0 1-.707 0l-2.12-2.121-1.415 1.415 2.122 2.12a.5.5 0 0 1 0 .708l-1.414 1.414a.5.5 0 0 1-.707 0l-4.95-4.95a.5.5 0 0 1 0-.707l1.414-1.414a.5.5 0 0 1 .707 0l2.12 2.121 1.415-1.415-2.121-2.12a.5.5 0 0 1 0-.708L9.475.868a.5.5 0 0 1 .353-.146zM4.464 6.536L3.05 7.95a.5.5 0 0 0 0 .707l4.95 4.95a.5.5 0 0 0 .707 0l1.414-1.414-6.657-6.657z"/></svg>`;

    const qs = (sel, root = document) => root.querySelector(sel);
    const qsa = (sel, root = document) => [...root.querySelectorAll(sel)];
    function mkEl(tag, opts = {}) {
        const el = document.createElement(tag);
        if (opts.html)      el.innerHTML   = opts.html;
        if (opts.text)      el.textContent = opts.text;
        if (opts.className) el.className   = opts.className;
        if (opts.style)     Object.assign(el.style, opts.style);
        return el;
    }

    // ---- config with per-site support ----
    const DEFAULTS = {
        global: {
            shortcuts:     { ctrl: false, meta: true, alt: false },
            dockTopRight:  false,
            pinExport:     false,
        },
        sites: {
            claude:   { injectionEnabled: false, usageTracker: true, pills: { export: true }, prepend: '', savedPrompts: [], selectedPrompt: '' },
            deepseek: { injectionEnabled: false, usageTracker: false, pills: { export: true }, prepend: '', savedPrompts: [], selectedPrompt: '' },
            brave:    { injectionEnabled: false, usageTracker: false, pills: { export: true }, prepend: '', savedPrompts: [], selectedPrompt: '' },
        }
    };

    function loadCfg() {
        try {
            const raw = GM_getValue("lance_cfg");
            if (!raw) return JSON.parse(JSON.stringify(DEFAULTS));
            const parsed = JSON.parse(raw);
            if (!parsed.global && !parsed.sites) {
                const migrated = JSON.parse(JSON.stringify(DEFAULTS));
                const flat = parsed;
                if (flat.shortcuts) migrated.global.shortcuts = flat.shortcuts;
                if (flat.dockTopRight !== undefined) migrated.global.dockTopRight = flat.dockTopRight;
                if (flat.pinExport !== undefined) migrated.global.pinExport = flat.pinExport;
                for (const site of ['claude', 'deepseek', 'brave']) {
                    if (flat.injectionEnabled !== undefined) migrated.sites[site].injectionEnabled = flat.injectionEnabled;
                    if (flat.usageTracker !== undefined) migrated.sites[site].usageTracker = flat.usageTracker;
                    if (flat.pills) migrated.sites[site].pills = { ...flat.pills };
                    if (flat.prepend !== undefined) migrated.sites[site].prepend = flat.prepend;
                    if (flat.savedPrompts) migrated.sites[site].savedPrompts = [...flat.savedPrompts];
                    if (flat.selectedPrompt !== undefined) migrated.sites[site].selectedPrompt = flat.selectedPrompt;
                }
                return migrated;
            }
            for (const site of ['claude', 'deepseek', 'brave']) {
                if (!parsed.sites[site]) parsed.sites[site] = JSON.parse(JSON.stringify(DEFAULTS.sites[site]));
            }
            return parsed;
        } catch(_) {
            return JSON.parse(JSON.stringify(DEFAULTS));
        }
    }
    function saveCfg(c) { GM_setValue("lance_cfg", JSON.stringify(c)); }
    let CFG = loadCfg();

    function siteCfg() {
        const s = P === 'unknown' ? 'claude' : P;
        return CFG.sites[s] || CFG.sites.claude;
    }

    const INJECTED_KEY = 'lance_injected';
    function injectionDue() {
        const sc = siteCfg();
        if (!sc.injectionEnabled) return false;
        const prompt = getSelectedPrompt();
        if (!prompt) return false;
        try { return sessionStorage.getItem(INJECTED_KEY) !== '1'; } catch(_) { return false; }
    }
    function markInjected() { try { sessionStorage.setItem(INJECTED_KEY, '1'); } catch(_) {} }

    function getSelectedPrompt() {
        const sc = siteCfg();
        if (!sc.selectedPrompt) return null;
        const found = sc.savedPrompts.find(p => p.title === sc.selectedPrompt);
        if (!found) return null;
        if (found.enabled === false) return null;
        return found.content;
    }

    function getChatInput() {
        if (P === "claude")   return qs('div.ProseMirror') || qs('[contenteditable="true"][data-placeholder]');
        if (P === "deepseek") return qs('textarea#chat-input') || qs('textarea');
        if (P === "brave")    return qs('textarea') || qs('[contenteditable="true"]');
        return qs('textarea') || qs('div[contenteditable="true"]');
    }

    function getInputText(el) {
        return (el.tagName === 'TEXTAREA' ? el.value : (el.innerText || el.textContent || '')).trim();
    }

    function prependToInput(el, prefix) {
        el.focus();
        if (el.tagName === 'TEXTAREA') {
            const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
            const cur = el.value;
            if (nativeSetter) nativeSetter.call(el, prefix + cur);
            else el.value = prefix + cur;
            el.selectionStart = el.selectionEnd = prefix.length;
            el.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true }));
        } else {
            const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
            const firstText = walker.nextNode();
            const sel = window.getSelection();
            if (!sel) return;
            const range = document.createRange();
            if (firstText) range.setStart(firstText, 0);
            else range.setStart(el, 0);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
            const ok = document.execCommand('insertText', false, prefix);
            if (!ok) {
                try {
                    const dt = new DataTransfer();
                    dt.setData('text/plain', prefix);
                    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
                } catch(_) {
                    el.textContent = prefix + (el.textContent || '');
                    el.dispatchEvent(new InputEvent('input', { bubbles: true }));
                }
            }
        }
    }

    function applyInjectionIfNeeded() {
        if (P === "brave") return false;
        if (!injectionDue()) return false;
        const el = getChatInput();
        if (!el) return false;
        const cur = getInputText(el);
        if (!cur) return false;
        const sc = siteCfg();
        let prefix = sc.prepend ? sc.prepend + '\n\n' : '';
        const prompt = getSelectedPrompt();
        if (prompt) prefix += prompt + '\n\n';
        if (!prefix) return false;
        if (cur.startsWith(prefix.slice(0, 12))) return false;
        markInjected();
        prependToInput(el, prefix);
        return true;
    }

    function clickSendWithInjection() {
        applyInjectionIfNeeded();
        const sb = findSubmit();
        if (sb && !sb.disabled) sb.click();
    }

    function findSubmit() {
        if (P === "deepseek") {
            const bc = qs(".bf38813a");
            if (!bc) return null;
            const btns = qsa('div[role="button"].ds-button', bc);
            for (let i = btns.length - 1; i >= 0; i--) {
                const b = btns[i];
                if (!b.classList.contains('ds-button--disabled')) return b;
            }
            return null;
        }
        if (P === "claude") return qs('button[aria-label*="Send"]');
        if (P === "brave") {
            const scope = qs('form') || document;
            return qs('button[type="submit"]:not([disabled])', scope) ||
                   qs('button[aria-label*="Ask" i]', scope) ||
                   qs('button[aria-label*="Send" i]', scope) ||
                   qs('button[type="submit"]', scope);
        }
        return null;
    }

    function getEventTarget(e) { return e.composedPath ? e.composedPath()[0] || e.target : e.target; }
    function isComposing(e) { return e.isComposing || e.keyCode === 229; }
    function isEditableTarget(t) { return /INPUT|TEXTAREA|SELECT/.test(t.tagName) || (t.getAttribute && t.getAttribute("contenteditable") === "true"); }

    window.addEventListener("keydown", e => {
        if (isComposing(e)) return;
        const t = getEventTarget(e);
        if (e.key === "Enter" && !e.ctrlKey && !e.shiftKey && !e.metaKey && !e.altKey && isEditableTarget(t)) {
            e.preventDefault();
            e.stopPropagation();
            if (t.tagName === "TEXTAREA") {
                const s = t.selectionStart, v = t.value;
                t.value = v.substring(0, s) + "\n" + v.substring(t.selectionEnd);
                t.selectionStart = t.selectionEnd = s + 1;
                t.dispatchEvent(new Event("input", { bubbles: true }));
            } else {
                const ev = new KeyboardEvent("keydown", { key: "Enter", code: "Enter", shiftKey: true, bubbles: true, cancelable: true });
                t.dispatchEvent(ev);
                if (!ev.defaultPrevented) document.execCommand("insertParagraph");
            }
            return;
        }
        if (CFG.global.shortcuts.meta && e.key === "Enter" && e.metaKey && !e.ctrlKey && !e.altKey && isEditableTarget(t)) {
            const sb = findSubmit();
            if (sb && !sb.disabled) {
                e.preventDefault();
                e.stopPropagation();
                clickSendWithInjection();
            }
            return;
        }
    }, true);

    // ---- export functions ----
    async function getDeepSeekContents() {
        const vl = qs('div.ds-virtual-list') ||
            (() => { let b = null, bH = 0; qsa('div').forEach(el => { if (el.scrollHeight > el.clientHeight + 100 && el.scrollHeight > bH) { bH = el.scrollHeight; b = el; } }); return b; })();
        if (!vl) { console.warn('[lance] deepseek: container not found'); return []; }
        function settle(ms) {
            return new Promise(resolve => {
                const cap = ms || 500;
                let t = setTimeout(resolve, cap);
                const obs = new MutationObserver(() => {
                    clearTimeout(t);
                    t = setTimeout(() => { obs.disconnect(); resolve(); }, 150);
                });
                obs.observe(document.body, { childList: true, subtree: true });
                setTimeout(() => { obs.disconnect(); resolve(); }, cap);
            });
        }
        const seen = new WeakSet();
        const aMsgs = [], uMsgs = [];
        const seenUser = new Set();
        const BTN_SEL = 'div.ds-flex > div.ds-icon-button:nth-child(1)';
        const USR_SEL = 'div[class*="fbb737a4"]';
        async function collectVisible() {
            qsa(USR_SEL).forEach(el => {
                const t = el.textContent.trim();
                if (t && !seenUser.has(t)) { seenUser.add(t); uMsgs.push(t); }
            });
            for (const btn of qsa(BTN_SEL)) {
                if (seen.has(btn)) continue;
                seen.add(btn);
                btn.click();
                await new Promise(r => setTimeout(r, 350));
                try { const t = await navigator.clipboard.readText(); if (t) aMsgs.push(t); } catch(_) {}
            }
        }
        vl.scrollTop = 0;
        await settle(700);
        await collectVisible();
        const STEP = 1200;
        let prev = -1, stalls = 0, step = 0;
        while (true) {
            const maxScroll = vl.scrollHeight - vl.clientHeight;
            const atBottom = vl.scrollTop >= maxScroll - 200;
            if (atBottom) break;
            vl.scrollTop += STEP;
            step++;
            await settle(step < 5 ? 600 : 500);
            await collectVisible();
            const total = uMsgs.length + aMsgs.length;
            if (total === prev) {
                stalls++;
                if (stalls >= 15) {
                    const remaining = maxScroll - vl.scrollTop;
                    if (remaining > 500) {
                        vl.scrollTop += remaining / 2;
                        stalls = 0;
                        await settle(800);
                        await collectVisible();
                    } else break;
                }
            } else { stalls = 0; prev = total; }
        }
        vl.scrollTop = vl.scrollHeight;
        await settle(600);
        await collectVisible();
        const result = [];
        const pairs = Math.min(uMsgs.length, aMsgs.length);
        for (let i = 0; i < pairs; i++) {
            result.push({ role: 'user', text: uMsgs[i] });
            result.push({ role: 'assistant', text: aMsgs[i] });
        }
        for (let i = pairs; i < aMsgs.length; i++) result.push({ role: 'assistant', text: aMsgs[i] });
        return result;
    }

    function groupDeepSeekPairs(items) {
        const pairs = [];
        let currentQ = null, currentA = [];
        for (const item of items) {
            if (item.role === 'user') {
                if (currentQ !== null) pairs.push({ q: currentQ, a: currentA.join('\n\n') });
                currentQ = item.text; currentA = [];
            } else if (item.role === 'assistant') {
                if (currentQ === null) currentQ = '';
                currentA.push(item.text);
            }
        }
        if (currentQ !== null && currentA.length) pairs.push({ q: currentQ, a: currentA.join('\n\n') });
        return pairs;
    }

    function makeFilename(title, turnCount) {
        const d = new Date();
        return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}${String(turnCount).padStart(4,'0')}_${title}`;
    }
    function sanitize(t) { return (t || document.title || "Export").trim().replace(/[\/\\\?\%\*\:\|"<>\.]/g, "_"); }
    function getTitle() {
        if (P === "deepseek") {
            const byZ = qsa('[style*="z-index"],div').find(el => getComputedStyle(el).zIndex === "12");
            return sanitize(byZ?.textContent || qs('div[class*="chat-item--active"] span,li[class*="active"] .title,a[class*="active"] span')?.textContent);
        }
        if (P === "brave") return sanitize(document.title.replace(/ - Ask Brave$/, '').trim().slice(0, 50));
        return sanitize(document.title);
    }

    function toMd(html) {
        const doc = new DOMParser().parseFromString(html, "text/html");
        const isClaude = P === "claude", isDS = P === "deepseek";
        qsa("span.katex-html", doc).forEach(e => e.remove());
        qsa("mrow", doc).forEach(e => e.remove());
        qsa('annotation[encoding="application/x-tex"]', doc).forEach(e => e.replaceWith(e.closest(".katex-display") ? `\n$$\n${e.textContent.trim()}\n$$\n` : `$${e.textContent.trim()}$`));
        const rp = (el, txt) => el.parentNode.replaceChild(document.createTextNode(txt), el);
        qsa("strong,b", doc).forEach(e => rp(e, `**${e.textContent}**`));
        qsa("em,i", doc).forEach(e => rp(e, `*${e.textContent}*`));
        qsa("p code", doc).forEach(e => rp(e, `\`${e.textContent}\``));
        qsa("a", doc).forEach(e => rp(e, `[${e.textContent}](${e.href})`));
        qsa("img", doc).forEach(e => rp(e, `![${e.alt}](${e.src})`));
        if (isClaude) {
            qsa("pre", doc).forEach(pre => {
                const code = qs("code", pre);
                const type = code ? Array.from(code.classList).find(c => c.startsWith("language-"))?.replace("language-","") || "" : "";
                pre.innerHTML = `\n\`\`\`${type}\n${code ? code.textContent : pre.textContent}\n\`\`\`\n`;
            });
        } else if (isDS) {
            qsa("pre", doc).forEach(pre => {
                const code = qs("code", pre);
                let type = code ? Array.from(code.classList).find(c => c.startsWith("language-"))?.replace("language-","") || "" : "";
                if (!type) type = qs('span.code-lang,span[class*="lang"],div[class*="code-header"] span', pre.closest("div"))?.textContent.trim() || "";
                pre.innerHTML = `\n\`\`\`${type}\n${code ? code.textContent : pre.textContent}\n\`\`\`\n`;
            });
            qsa('div[class*="think"],details.think,div.ds-think', doc).forEach(e => rp(e, `\n> **[thinking]**\n${e.textContent.trim().split("\n").map(l => `> ${l}`).join("\n")}\n`));
        }
        qsa("ul", doc).forEach(ul => rp(ul, "\n" + qsa(":scope>li", ul).map(li => `- ${li.textContent.trim()}`).join("\n")));
        qsa("ol", doc).forEach(ol => rp(ol, "\n" + qsa(":scope>li", ol).map((li, i) => `${i+1}. ${li.textContent.trim()}`).join("\n")));
        for (let i = 1; i <= 6; i++) qsa(`h${i}`, doc).forEach(h => rp(h, `\n${"#".repeat(i)} ${h.textContent}\n`));
        qsa("p", doc).forEach(p => rp(p, `\n${p.textContent}\n`));
        return doc.body.innerHTML.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").trim();
    }

    function extractAttachments(msgEl) {
        const seen = new Set(), out = [];
        qsa("img[src]", msgEl).forEach(img => {
            const src = img.src || "";
            if (src && !seen.has(src) && !src.includes("avatar") && !src.includes("icon") && src !== window.location.href) {
                seen.add(src);
                out.push({ name: img.alt || "image", type: "image", src });
            }
        });
        qsa('[data-testid*="file-thumbnail"],[class*="FileAttachment"],[class*="file-name"],[class*="attachment-name"]', msgEl).forEach(el => {
            const name = (el.querySelector('[class*="name"],span,p') || el).textContent.trim();
            if (name && name.length < 200 && !seen.has(name)) {
                seen.add(name);
                out.push({ name, type: "file", src: null });
            }
        });
        return out;
    }
    function renderAttachmentsMd(a) {
        if (!a.length) return "";
        return "\n**attachments:**\n" + a.map(x => x.type === "image" ? `![${x.name}](${x.src})` : `- \`${x.name}\``).join("\n") + "\n";
    }

    function getElements() {
        const res = [];
        if (P === "claude") res.push(...qsa('[data-testid="user-message"],.font-claude-response'));
        else if (P === "brave") {
            const nodes = qsa('div.message.user,div.message.assistant.llm-output');
            let u = null, ais = [];
            const flush = () => { if (!u) return; res.push(u); const w = document.createElement('div'); ais.forEach(a => w.appendChild(a.cloneNode(true))); res.push(w); u = null; ais = []; };
            nodes.forEach(n => { if (n.classList.contains('user')) { flush(); u = n; } else if (u) ais.push(n); });
            flush();
        }
        return res;
    }

    function mdDoc(title, pairs) {
        const yaml = ["---",
            `title: "${title}"`,
            `date: "${new Date().toISOString()}"`,
            `source: ${P}`,
            `url: "${document.URL}"`,
            `turns: ${pairs.length}`,
            "---", "", ""].join("\n");
        return yaml + pairs.map(p => `## user\n\n${p.q.trim()}\n\n## assistant\n\n${p.a.trim()}\n\n---\n\n`).join("");
    }

    function anchorSave(text, mime, filename) {
        const u = URL.createObjectURL(new Blob([text], { type: mime }));
        const a = Object.assign(document.createElement("a"), { href: u, download: filename });
        document.body.appendChild(a); a.click();
        setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(u); }, 0);
    }

    async function fileExport(fmt) {
        let c = "", m = "text/plain", title, fname;
        if (P === "deepseek") {
            const items = await getDeepSeekContents(); if (!items.length) return;
            title = getTitle(); const pl = groupDeepSeekPairs(items);
            fname = makeFilename(title, pl.length);
            if (fmt === "json") { c = JSON.stringify(pl, null, 2); m = "application/json"; }
            else if (fmt === "csv") { c = "Q,A\n" + pl.map(p => `"${p.q.replace(/"/g,'""')}","${p.a.replace(/"/g,'""')}"`).join("\n"); m = "text/csv"; }
            else if (fmt === "html") { c = `<html><body style="font-family:sans-serif;max-width:800px;margin:auto;padding:30px;line-height:1.7;">${pl.map(p => `<div style="background:#f4f4f5;padding:15px;border-radius:12px;margin:20px 0;"><b>Q:</b> ${p.q}</div><div><b>A:</b> ${p.a}</div><hr/>`).join("")}</body></html>`; m = "text/html"; }
            else if (fmt === "md") { c = mdDoc(title, pl); m = "text/markdown"; }
            else { c = pl.map(p => `\nQ:\n${p.q}\n\nA:\n${p.a}\n\n---\n`).join(""); }
        } else {
            const res = getElements(); if (!res.length) return;
            title = getTitle(); fname = makeFilename(title, Math.floor(res.length / 2));
            const md = el => toMd(el.innerHTML), txt = el => el.textContent.trim();
            if (fmt === "json") {
                c = JSON.stringify(res.reduce((a, x, i) => { if (i % 2 === 0 && res[i + 1]) a.push({ q: md(x), a: md(res[i + 1]) }); return a; }, []), null, 2);
                m = "application/json";
            } else if (fmt === "csv") {
                c = "Q,A\n" + res.reduce((a, x, i) => { if (i % 2 === 0 && res[i + 1]) a += `"${md(x).replace(/"/g,'""')}","${md(res[i + 1]).replace(/"/g,'""')}"\n`; return a; }, "");
                m = "text/csv";
            } else if (fmt === "html") {
                c = `<html><body style="font-family:sans-serif;max-width:800px;margin:auto;padding:30px;line-height:1.7;">${res.reduce((a, x, i) => { if (i % 2 === 0 && res[i + 1]) a += `<div style="background:#f4f4f5;padding:15px;border-radius:12px;margin:20px 0;"><b>Q:</b> ${x.innerHTML}</div><div><b>A:</b> ${res[i + 1].innerHTML}</div><hr/>`; return a; }, "")}</body></html>`;
                m = "text/html";
            } else if (fmt === "md") {
                const pairs = [];
                for (let i = 0; i < res.length - 1; i += 2) {
                    if (!res[i + 1]) break;
                    const att = extractAttachments(res[i]);
                    pairs.push({ q: md(res[i]) + (att.length ? renderAttachmentsMd(att) : ''), a: md(res[i + 1]) });
                }
                c = mdDoc(title, pairs);
                m = "text/markdown";
            } else {
                c = res.reduce((a, x, i) => { if (i % 2 === 0 && res[i + 1]) a += `\nQ:\n${txt(x)}\n\nA:\n${txt(res[i + 1])}\n\n---\n`; return a; }, "");
            }
        }
        anchorSave(c.replace(/&amp;/g, "&"), m, `${fname}.${fmt}`);
    }

    // ---- export pill with pin circle and edge mirroring ----
    function buildExportPill() {
        const box = mkEl('div', { className: 'lance-drag-box' });

        // Main pill
        const pillInner = mkEl('div', { className: 'lance-pill-inner' });
        pillInner.innerHTML = `${LANCE_ICON}<span class="lance-pill-text">lance</span>`;
        box.appendChild(pillInner);

        // Pin circle button
        const pinCircle = mkEl('button', { className: 'lance-pin-circle' });
        pinCircle.innerHTML = PIN_ICON;
        pinCircle.title = 'Toggle pin position';
        box.appendChild(pinCircle);

        // Menu panel
        const menu = mkEl('div', { className: 'lance-menu-panel' });

        // ---- quick injection toggle ----
        const injToggle = mkEl('button', { className: 'lance-menu-item' });
        const sc = siteCfg();
        const injOn = sc.injectionEnabled;
        injToggle.innerHTML = `<span>injection</span><span class="lance-badge">${injOn ? '⚡ on' : '⚡ off'}</span>`;
        injToggle.onclick = e => {
            e.stopPropagation();
            sc.injectionEnabled = !sc.injectionEnabled;
            saveCfg(CFG);
            injToggle.innerHTML = `<span>injection</span><span class="lance-badge">${sc.injectionEnabled ? '⚡ on' : '⚡ off'}</span>`;
            box.classList.remove('open');
            if (!sc.injectionEnabled) {
                try { sessionStorage.removeItem(INJECTED_KEY); } catch(_) {}
            }
        };
        menu.appendChild(injToggle);

        // ---- export parent with submenu ----
        const exportParent = mkEl('div', { className: 'lance-menu-parent' });
        const parentBtn = mkEl('button', { className: 'lance-menu-item' });
        parentBtn.innerHTML = `<span>export</span><span class="lance-badge">▸</span>`;
        exportParent.appendChild(parentBtn);

        const submenu = mkEl('div', { className: 'lance-submenu' });
        const formats = [
            ['markdown', '.md', () => fileExport('md')],
            ['json', '.json', () => fileExport('json')],
            ['csv', '.csv', () => fileExport('csv')],
            ['plain text', '.txt', () => fileExport('txt')],
            ['html', '.html', () => fileExport('html')],
        ];
        formats.forEach(([name, badge, fn]) => {
            const b = mkEl('button', { className: 'lance-menu-item' });
            b.innerHTML = `<span>${name}</span><span class="lance-badge">${badge}</span>`;
            b.onclick = e => {
                e.stopPropagation();
                box.classList.remove('open');
                fn();
            };
            submenu.appendChild(b);
        });
        exportParent.appendChild(submenu);
        menu.appendChild(exportParent);

        // parentBtn click: toggle submenu with positioning
        parentBtn.onclick = e => {
            e.stopPropagation();
            const isOpen = exportParent.classList.contains('open');
            document.querySelectorAll('.lance-menu-parent.open').forEach(el => {
                if (el !== exportParent) el.classList.remove('open');
            });
            if (!isOpen) {
                const rect = exportParent.getBoundingClientRect();
                const subWidth = 160;
                const spaceRight = window.innerWidth - rect.right;
                const spaceLeft = rect.left;
                if (spaceRight < subWidth && spaceLeft > subWidth) {
                    exportParent.classList.add('lance-submenu-left');
                } else {
                    exportParent.classList.remove('lance-submenu-left');
                }
                exportParent.classList.add('open');
            } else {
                exportParent.classList.remove('open');
            }
        };

        // settings button
        const settingsBtn = mkEl('button', { className: 'lance-menu-item' });
        settingsBtn.innerHTML = `<span>settings</span><span class="lance-badge">⚙</span>`;
        settingsBtn.onclick = e => { e.stopPropagation(); box.classList.remove('open'); openDashboard(); };
        menu.appendChild(settingsBtn);

        box.appendChild(menu);
        document.body.appendChild(box);

        // ---- pin circle logic ----
        function updatePinUI() {
            const pinned = CFG.global.pinExport;
            pinCircle.classList.toggle('pinned', pinned);
            pinCircle.title = pinned ? 'Unpin position' : 'Pin position';
            box.onmousedown = pinned ? null : (e => {
                if (CFG.global.dockTopRight) return;
                drag = true; moved = false; x0 = e.clientX; y0 = e.clientY; l0 = box.offsetLeft; t0 = box.offsetTop; e.preventDefault();
            });
        }

        pinCircle.onclick = e => {
            e.stopPropagation();
            CFG.global.pinExport = !CFG.global.pinExport;
            saveCfg(CFG);
            updatePinUI();
            box.classList.remove('open');
        };

        updatePinUI();

        // ---- drag logic ----
        let drag = false, moved = false, x0, y0, l0, t0;
        document.addEventListener('mousemove', e => {
            if (!drag) return;
            const dx = e.clientX - x0, dy = e.clientY - y0;
            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;
            box.style.left = (l0 + dx) + 'px'; box.style.top = (t0 + dy) + 'px';
            // Update menu position live while dragging if open
            updateMenuPosition();
        });
        document.addEventListener('mouseup', () => {
            if (drag && moved) {
                GM_setValue('export_x', box.offsetLeft);
                GM_setValue('export_y', box.offsetTop);
                updateBoxEdgeClass();
                clampBoxToViewport();
            }
            drag = false;
        });

        // ---- helper to mirror pill when near right edge ----
        function updateBoxEdgeClass() {
            const rect = box.getBoundingClientRect();
            const rightEdge = rect.right;
            const nearRight = (window.innerWidth - rightEdge) < 35;
            box.classList.toggle('lance-drag-box-right-edge', nearRight);
            // Also update menu position if open
            updateMenuPosition();
        }

        function clampBoxToViewport() {
            // ensure box's right edge is not beyond viewport
            const rect = box.getBoundingClientRect();
            const margin = 10;
            if (rect.right > window.innerWidth - margin) {
                const overflow = rect.right - (window.innerWidth - margin);
                const newLeft = box.offsetLeft - overflow;
                if (newLeft < 0) {
                    box.style.left = '0px';
                } else {
                    box.style.left = newLeft + 'px';
                }
            }
            // also ensure left edge not negative
            if (box.offsetLeft < 0) {
                box.style.left = '0px';
            }
            updateBoxEdgeClass();
        }

        // ---- live menu repositioning ----
        function updateMenuPosition() {
            if (!box.classList.contains('open')) return;
            const r = box.getBoundingClientRect();
            const isB = r.top > window.innerHeight / 2;
            const menuWidth = 185;
            const spaceRight = window.innerWidth - r.right;
            const spaceLeft = r.left;
            const anchorRight = (spaceRight < menuWidth && spaceLeft > menuWidth) ? true : false;
            let posClass = '';
            if (isB) {
                posClass = anchorRight ? 'pos-bottom-right' : 'pos-bottom-left';
            } else {
                posClass = anchorRight ? 'pos-top-right' : 'pos-top-left';
            }
            // Keep the 'lance-menu-panel' base class
            menu.className = 'lance-menu-panel';
            menu.classList.add(posClass);
        }

        // ---- click on box toggles menu with mirroring ----
        box.onclick = e => {
            if (e.target.closest && e.target.closest('.lance-pin-circle')) return;
            if (moved) return;
            if (box.classList.contains('open')) {
                box.classList.remove('open');
                document.querySelectorAll('.lance-menu-parent.open').forEach(el => el.classList.remove('open'));
                return;
            }
            // open menu – set initial position
            const sc2 = siteCfg();
            injToggle.innerHTML = `<span>injection</span><span class="lance-badge">${sc2.injectionEnabled ? '⚡ on' : '⚡ off'}</span>`;
            box.classList.add('open');
            document.querySelectorAll('.lance-menu-parent.open').forEach(el => el.classList.remove('open'));
            // position it
            updateMenuPosition();
            // after opening, clamp and update edge class (width may have changed)
            setTimeout(() => {
                clampBoxToViewport();
                updateBoxEdgeClass();
            }, 10);
        };

        document.addEventListener('click', e => {
            if (!box.contains(e.target)) {
                box.classList.remove('open');
                document.querySelectorAll('.lance-menu-parent.open').forEach(el => el.classList.remove('open'));
            }
        });

        // ---- initial positioning ----
        const x = GM_getValue('export_x', window.innerWidth - 160);
        const y = GM_getValue('export_y', 8);   // moved further up (from 15 to 8)
        box.style.left = Math.max(0, Math.min(x, window.innerWidth - 120)) + 'px';
        box.style.top  = Math.max(0, Math.min(y, window.innerHeight - 60)) + 'px';
        // apply edge class
        setTimeout(() => {
            updateBoxEdgeClass();
            clampBoxToViewport();
        }, 50);

        // also on resize
        window.addEventListener('resize', () => {
            clampBoxToViewport();
            updateBoxEdgeClass();
        });
    }

    function refreshPills() {
        const box = document.querySelector('.lance-drag-box');
        if (box) {
            const sc = siteCfg();
            box.style.display = sc.pills?.export !== false ? '' : 'none';
        }
    }

    // ---- claude usage tracker (unchanged) ----
    const UT = (() => {
        if (P !== 'claude') return { init() {} };

        const ID = 'lance-cut', SID = 'lance-cut-style', API = '/api/organizations';
        const POLL = 60000, HOVER_REFRESH = 30000, MIN_GAP = 15000, WARN = 60, DANGER = 80;
        const A = 'lance-cut-anchor', H = 'lance-cut-hover';
        const ROWS = [['five_hour', 'current session'], ['seven_day', 'weekly limit (all)'], ['seven_day_opus', 'weekly limit (opus)']];
        const S = { org: null, inflight: null, last: null, lastAt: 0, anchor: null, ui: null, poll: 0, sched: 0, mo: null };
        const clamp = v => (v = +v || 0) < 0 ? 0 : v > 100 ? 100 : v;
        const fmt = iso => {
            if (!iso) return 'n/a';
            const m = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
            if (m < 1) return 'resetting soon';
            if (m < 60) return `in ${m} min`;
            const h = (m / 60) | 0;
            return h < 24 ? `in ${h} hr` : `in ${(h / 24) | 0} days`;
        };
        const jget = u => fetch(u, { credentials: 'include' }).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });

        async function orgId() { if (S.org) return S.org; const orgs = await jget(API); return (S.org = orgs?.[0]?.uuid ?? null); }
        function getUsage(force) {
            const now = Date.now();
            if (!force && now - S.lastAt < MIN_GAP) return Promise.resolve(S.last);
            if (S.inflight) return S.inflight;
            return (S.inflight = (async () => {
                try {
                    const id = await orgId();
                    if (!id) return S.last;
                    const d = await jget(`${API}/${id}/usage`);
                    if (d) { S.last = d; S.lastAt = Date.now(); }
                    return S.last;
                } catch (e) { S.org = null; return S.last; } finally { S.inflight = null; }
            })());
        }

        function injectStyle() {
            if (document.getElementById(SID)) return;
            const s = document.createElement('style'); s.id = SID;
            s.textContent = `
#${ID}{position:absolute;inset:auto 16px -15px;z-index:30;font-family:var(--font-ui,system-ui,-apple-system,sans-serif);color:hsl(var(--text-100))}
#${ID} .t{height:12px;display:flex;align-items:center;cursor:pointer}
#${ID} .b{width:100%;height:3px;background:hsla(var(--border-300)/.12);border-radius:999px;overflow:hidden;transition:height .16s}
#${ID} .t:hover .b{height:4px}
#${ID} .f{height:100%;width:0%;background:hsl(var(--brand-000));transition:width .25s}
#${ID} .fw{background:hsl(var(--warning-100))}
#${ID} .fd{background:hsl(var(--danger-100))}
#${ID} .p{position:absolute;bottom:14px;left:0;right:0;background:hsl(var(--bg-000));border-radius:16px;display:flex;flex-direction:column;gap:10px;padding:12px 14px 10px;box-shadow:0 .25rem 1.25rem hsl(var(--always-black)/3.5%),0 0 0 .5px hsla(var(--border-300)/.15);opacity:0;visibility:hidden;pointer-events:none;transform:translateY(8px);transition:opacity .16s,transform .16s,visibility 0s linear .16s}
#${ID} .t:hover + .p{opacity:1;visibility:visible;transform:translateY(0);transition:opacity .16s,transform .16s}
#${ID} .hh{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;margin-bottom:6px;font-size:13px}
#${ID} .l{font-weight:550;color:hsl(var(--text-100))}
#${ID} .m{font-size:12px;font-weight:430;color:hsl(var(--text-500));white-space:nowrap}
#${ID} .k{width:100%;height:6px;background:hsla(var(--border-300)/.12);border-radius:999px;overflow:hidden}
.${A}{transition:background-color .2s,box-shadow .2s,border-color .2s}
.${A}.${H}{background-color:transparent!important;box-shadow:none!important;border-color:transparent!important}
.${A}>:not(#${ID}){transition:opacity .2s}
.${A}.${H}>:not(#${ID}){opacity:0!important;pointer-events:none!important}`;
            document.head.appendChild(s);
        }

        function clsFor(p) { return p > DANGER ? 'f fd' : p > WARN ? 'f fw' : 'f'; }
        function setFill(el, p) { const sp = '' + p; if (el.dataset.p !== sp) { el.dataset.p = sp; el.style.width = sp + '%'; const c = clsFor(p); if (el.className !== c) el.className = c; } }

        function buildUI() {
            const root = document.createElement('div'); root.id = ID;
            root.innerHTML = `<div class="t"><div class="b"><div class="f" data-role="tf"></div></div></div><div class="p">${ROWS.map(([,label], i) => `<div class="r" data-i="${i}"><div class="hh"><span class="l">${label}</span><span class="m" data-role="m"></span></div><div class="k"><div class="f" data-role="f"></div></div></div>`).join('')}</div>`;
            const tf = root.querySelector('[data-role="tf"]');
            const rEls = [...root.querySelectorAll('.r')];
            const metas = rEls.map(r => r.querySelector('[data-role="m"]'));
            const fills = rEls.map(r => r.querySelector('[data-role="f"]'));
            root.addEventListener('pointerenter', () => { S.anchor && S.anchor.classList.add(H); if (Date.now() - S.lastAt > HOVER_REFRESH) doRefresh(1); }, { passive: true });
            root.addEventListener('pointerleave', () => { S.anchor && S.anchor.classList.remove(H); }, { passive: true });
            return { root, tf, rEls, metas, fills };
        }

        function render(d) {
            if (!S.ui || !d) return;
            setFill(S.ui.tf, clamp(d?.five_hour?.utilization));
            for (let i = 0; i < ROWS.length; i++) {
                const key = ROWS[i][0];
                const b = d?.[key];
                const row = S.ui.rEls[i];
                if (!b) { row.hidden = true; continue; }
                row.hidden = false;
                const p = clamp(b.utilization);
                setFill(S.ui.fills[i], p);
                const t = `${p}% · ${fmt(b.resets_at)}`;
                const m = S.ui.metas[i];
                if (m.dataset.t !== t) { m.dataset.t = t; m.textContent = t; }
            }
        }

        async function doRefresh(force) { if (!S.ui || (!force && document.hidden)) return; render(await getUsage(!!force)); }

        function findAnchor() {
            const ed = document.querySelector('[contenteditable="true"].tiptap'); if (!ed) return null;
            const fs = ed.closest('fieldset'); if (!fs) return null;
            return fs.querySelector('div[class*="bg-bg-000"][class*="rounded-[20px]"]') || fs;
        }

        function attach() {
            const sc = siteCfg();
            if (!sc.usageTracker) { document.getElementById(ID)?.remove(); return; }
            const a = findAnchor(); if (!a) return;
            const existing = document.getElementById(ID);
            if (a === S.anchor && existing && a.contains(existing)) return;
            existing?.remove();
            a.classList.add(A);
            if (getComputedStyle(a).position === 'static') a.style.position = 'relative';
            S.anchor = a; S.ui = buildUI();
            a.insertBefore(S.ui.root, a.firstChild);
            doRefresh(1);
        }

        function schedAttach() { if (S.sched) return; const cb = () => { S.sched = 0; attach(); }; S.sched = window.requestIdleCallback ? requestIdleCallback(cb, { timeout: 800 }) : requestAnimationFrame(cb); }
        function startPoll() { stopPoll(); const tick = () => { if (document.hidden) { S.poll = 0; return; } doRefresh(0); S.poll = setTimeout(tick, POLL); }; S.poll = setTimeout(tick, POLL); }
        function stopPoll() { S.poll && clearTimeout(S.poll); S.poll = 0; }

        return {
            init() {
                injectStyle();
                const patch = m => { const o = history[m]; history[m] = function () { const r = o.apply(this, arguments); schedAttach(); return r; }; };
                patch('pushState'); patch('replaceState');
                addEventListener('popstate', schedAttach, { passive: true });
                addEventListener('hashchange', schedAttach, { passive: true });
                let t = 0;
                S.mo = new MutationObserver(() => { if (t) return; t = setTimeout(() => { t = 0; schedAttach(); }, 200); });
                S.mo.observe(document.body, { childList: true, subtree: true });
                document.addEventListener('visibilitychange', () => { if (document.hidden) stopPoll(); else { schedAttach(); doRefresh(1); startPoll(); } }, { passive: true });
                addEventListener('focus', () => !document.hidden && doRefresh(1), { passive: true });

                schedAttach();

                let attempts = 0;
                const retryInterval = setInterval(() => {
                    attempts++;
                    if (document.getElementById(ID) || attempts >= 10) {
                        clearInterval(retryInterval);
                        return;
                    }
                    schedAttach();
                }, 2000);

                startPoll();
            },
            refresh() { schedAttach(); },
        };
    })();

    // ---- settings dashboard (unchanged) ----
    function openDashboard() {
        const existing = qs('#lance-dashboard');
        if (existing) { existing.remove(); qs('#lance-overlay')?.remove(); return; }

        const bg = "#18181b", bg3 = "#27272c", fg = "#e4e4e8", fg2 = "rgba(228,228,232,0.5)", bd = "rgba(255,255,255,0.07)", wht = "#ffffff";

        const ov = document.createElement('div'); ov.id = 'lance-overlay';
        Object.assign(ov.style, { position: 'fixed', inset: '0', background: 'rgba(0,0,0,0.6)', zIndex: '2147483645', backdropFilter: 'blur(2px)' });
        ov.onclick = () => { ov.remove(); dlg.remove(); };
        document.body.appendChild(ov);

        const dlg = document.createElement('div'); dlg.id = 'lance-dashboard';
        Object.assign(dlg.style, {
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            background: bg, color: fg, border: `1px solid ${bd}`, borderRadius: '14px',
            padding: '20px 24px 24px', width: '360px', maxWidth: '94vw', maxHeight: '88vh',
            overflowY: 'auto', zIndex: '2147483646', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
            fontSize: '13px', lineHeight: '1.5', boxShadow: '0 24px 64px rgba(0,0,0,0.6),0 0 0 1px rgba(255,255,255,0.05)',
            scrollbarWidth: 'thin', scrollbarColor: `${bg3} transparent`
        });

        const rowEl = (label, control) => {
            const d = document.createElement('div');
            Object.assign(d.style, { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: `1px solid ${bd}` });
            const la = document.createElement('span'); la.textContent = label; la.style.color = fg;
            d.appendChild(la); if (control) d.appendChild(control);
            return d;
        };

        const toggle = (val, onChange) => {
            const lbl = document.createElement('label');
            Object.assign(lbl.style, { position: 'relative', display: 'inline-block', width: '34px', height: '18px', flexShrink: '0' });
            const inp = document.createElement('input'); inp.type = 'checkbox'; inp.checked = val;
            Object.assign(inp.style, { opacity: '0', width: '0', height: '0', position: 'absolute' });
            const sl = document.createElement('span');
            Object.assign(sl.style, { position: 'absolute', inset: '0', borderRadius: '18px', cursor: 'pointer', background: val ? wht : 'rgba(255,255,255,0.12)', transition: 'background 0.18s', border: '1px solid rgba(255,255,255,0.1)' });
            const dot = document.createElement('span');
            Object.assign(dot.style, { position: 'absolute', height: '12px', width: '12px', left: val ? '18px' : '3px', bottom: '2px', background: val ? '#111' : 'rgba(255,255,255,0.4)', borderRadius: '50%', transition: 'left 0.18s,background 0.18s' });
            sl.appendChild(dot);
            inp.onchange = () => {
                const v = inp.checked;
                sl.style.background = v ? wht : 'rgba(255,255,255,0.12)';
                dot.style.left = v ? '18px' : '3px';
                dot.style.background = v ? '#111' : 'rgba(255,255,255,0.4)';
                onChange(v);
            };
            lbl.appendChild(inp); lbl.appendChild(sl);
            return lbl;
        };

        const hdr = document.createElement('div');
        Object.assign(hdr.style, { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' });
        const siteLabel = document.createElement('span');
        siteLabel.textContent = `lance · ${P}`;
        Object.assign(siteLabel.style, { fontSize: '17px', color: wht });
        const closeBtn = document.createElement('button'); closeBtn.textContent = '✕';
        Object.assign(closeBtn.style, { background: 'none', border: 'none', color: fg2, cursor: 'pointer', fontSize: '16px', padding: '0', lineHeight: '1', transition: 'color 0.1s' });
        closeBtn.addEventListener('mouseenter', () => { closeBtn.style.color = wht; });
        closeBtn.addEventListener('mouseleave', () => { closeBtn.style.color = fg2; });
        closeBtn.onclick = () => { dlg.remove(); ov.remove(); };
        hdr.appendChild(siteLabel); hdr.appendChild(closeBtn);
        dlg.appendChild(hdr);

        const sc = siteCfg();

        dlg.appendChild(rowEl('export button', toggle(sc.pills?.export ?? true, v => {
            sc.pills = { ...(sc.pills || DEFAULTS.sites.claude.pills), export: v };
            saveCfg(CFG);
            refreshPills();
        })));

        dlg.appendChild(rowEl('cmd / win + enter (global)', toggle(CFG.global.shortcuts.meta ?? DEFAULTS.global.shortcuts.meta, v => {
            CFG.global.shortcuts.meta = v;
            saveCfg(CFG);
        })));

        dlg.appendChild(rowEl('enable injection', toggle(sc.injectionEnabled, v => {
            sc.injectionEnabled = v;
            saveCfg(CFG);
            if (!v) { try { sessionStorage.removeItem(INJECTED_KEY); } catch(_) {} }
        })));

        const prependRow = document.createElement('div');
        Object.assign(prependRow.style, { display: 'flex', flexDirection: 'column', gap: '4px', padding: '6px 0', borderBottom: `1px solid ${bd}` });
        const prependLabel = document.createElement('span'); prependLabel.textContent = 'prepend (always added):'; prependLabel.style.color = fg;
        const prependInput = document.createElement('textarea');
        prependInput.value = sc.prepend || '';
        Object.assign(prependInput.style, { background: bg3, border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: fg, padding: '6px 8px', fontSize: '12px', resize: 'vertical', minHeight: '40px', width: '100%', outline: 'none' });
        prependInput.oninput = () => { sc.prepend = prependInput.value; saveCfg(CFG); };
        prependRow.appendChild(prependLabel); prependRow.appendChild(prependInput);
        dlg.appendChild(prependRow);

        const promptsSection = document.createElement('div');
        promptsSection.style.padding = '6px 0';
        const promptsLabel = document.createElement('div'); promptsLabel.textContent = 'saved prompts:'; Object.assign(promptsLabel.style, { fontSize: '11px', color: fg, marginBottom: '6px' });
        promptsSection.appendChild(promptsLabel);

        const promptsList = document.createElement('div');
        promptsList.style.display = 'flex'; promptsList.style.flexDirection = 'column'; promptsList.style.gap = '6px';

        function renderPrompts() {
            promptsList.innerHTML = '';
            if (!sc.savedPrompts.length) {
                const empty = document.createElement('div'); empty.textContent = 'no prompts saved'; Object.assign(empty.style, { fontSize: '12px', color: fg2, padding: '4px 0' });
                promptsList.appendChild(empty);
            } else {
                sc.savedPrompts.forEach((p, idx) => {
                    const enabled = p.enabled !== false;
                    const row = document.createElement('div');
                    Object.assign(row.style, {
                        display: 'flex', alignItems: 'center', gap: '6px',
                        background: bg3, padding: '4px 8px', borderRadius: '6px',
                        opacity: enabled ? 1 : 0.5
                    });
                    const enToggle = document.createElement('input');
                    enToggle.type = 'checkbox';
                    enToggle.checked = enabled;
                    Object.assign(enToggle.style, { flexShrink: 0, margin: 0, cursor: 'pointer' });
                    enToggle.onchange = () => {
                        sc.savedPrompts[idx].enabled = enToggle.checked;
                        saveCfg(CFG);
                        renderPrompts();
                    };
                    row.appendChild(enToggle);

                    const titleSpan = document.createElement('span');
                    titleSpan.textContent = p.title;
                    Object.assign(titleSpan.style, { flex: '1', fontSize: '12px', color: fg, cursor: 'pointer' });
                    titleSpan.onclick = () => {
                        sc.selectedPrompt = p.title;
                        saveCfg(CFG);
                        renderPrompts();
                    };

                    const activeDot = document.createElement('span');
                    activeDot.textContent = sc.selectedPrompt === p.title ? '●' : '○';
                    Object.assign(activeDot.style, { fontSize: '14px', color: sc.selectedPrompt === p.title ? wht : fg2, marginRight: '4px' });

                    const deleteBtn = document.createElement('button');
                    deleteBtn.textContent = '✕';
                    Object.assign(deleteBtn.style, { background: 'transparent', border: 'none', color: fg2, cursor: 'pointer', fontSize: '12px' });
                    deleteBtn.onclick = () => {
                        if (confirm(`delete prompt "${p.title}"?`)) {
                            sc.savedPrompts = sc.savedPrompts.filter((_, i) => i !== idx);
                            if (sc.selectedPrompt === p.title) sc.selectedPrompt = '';
                            saveCfg(CFG);
                            renderPrompts();
                        }
                    };

                    row.appendChild(activeDot);
                    row.appendChild(titleSpan);
                    row.appendChild(deleteBtn);
                    promptsList.appendChild(row);
                });
            }
        }
        renderPrompts();
        promptsSection.appendChild(promptsList);
        dlg.appendChild(promptsSection);

        const addRow = document.createElement('div');
        Object.assign(addRow.style, { display: 'flex', gap: '6px', padding: '4px 0', borderTop: `1px solid ${bd}` });
        const titleInput = document.createElement('input');
        titleInput.placeholder = 'title';
        Object.assign(titleInput.style, { flex: '1', background: bg3, border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: fg, padding: '4px 6px', fontSize: '12px', outline: 'none' });
        const contentInput = document.createElement('textarea');
        contentInput.placeholder = 'prompt content';
        Object.assign(contentInput.style, { flex: '2', background: bg3, border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: fg, padding: '4px 6px', fontSize: '12px', resize: 'vertical', minHeight: '40px', outline: 'none' });
        const addBtn = document.createElement('button');
        addBtn.textContent = '+';
        Object.assign(addBtn.style, { background: bg3, border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: fg, padding: '4px 12px', cursor: 'pointer', fontSize: '12px' });
        addBtn.onclick = () => {
            const title = titleInput.value.trim();
            const content = contentInput.value.trim();
            if (!title || !content) return alert('both title and content required');
            if (sc.savedPrompts.find(p => p.title === title)) return alert('title already exists');
            sc.savedPrompts.push({ title, content, enabled: true });
            if (!sc.selectedPrompt) sc.selectedPrompt = title;
            saveCfg(CFG);
            titleInput.value = ''; contentInput.value = '';
            renderPrompts();
        };
        addRow.appendChild(titleInput);
        addRow.appendChild(contentInput);
        addRow.appendChild(addBtn);
        promptsSection.appendChild(addRow);

        const rearmBtn = document.createElement('button');
        rearmBtn.textContent = 're-arm injection for this tab';
        Object.assign(rearmBtn.style, { background: bg3, border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: fg, padding: '6px 12px', fontSize: '12px', cursor: 'pointer', margin: '8px 0 4px', width: '100%' });
        rearmBtn.onclick = () => { try { sessionStorage.removeItem(INJECTED_KEY); } catch(_) {} };
        dlg.appendChild(rearmBtn);

        if (P === 'claude') {
            dlg.appendChild(rowEl('show inline usage bar', toggle(sc.usageTracker ?? true, v => {
                sc.usageTracker = v;
                saveCfg(CFG);
                UT.refresh();
            })));
        }

        const footer = document.createElement('div');
        footer.style.textAlign = 'center';
        footer.style.marginTop = '16px';
        footer.style.fontSize = '11px';
        footer.style.color = fg2;

        const gfLink = document.createElement('a');
        gfLink.href = 'https://greasyfork.org/en/scripts/579601-lance';
        gfLink.target = '_blank';
        gfLink.textContent = 'greasyfork';
        gfLink.style.color = fg2;
        gfLink.style.textDecoration = 'none';
        gfLink.addEventListener('mouseenter', () => gfLink.style.color = wht);
        gfLink.addEventListener('mouseleave', () => gfLink.style.color = fg2);

        footer.appendChild(gfLink);
        dlg.appendChild(footer);

        document.body.appendChild(dlg);
    }

    // ---- styles with edge mirroring ----
    GM_addStyle(`
        .lance-drag-box {
            position: fixed; z-index: 2147483646; display: flex; align-items: center; justify-content: center;
            height: 42px; min-width: 42px; padding: 0 4px 0 0;
            background: rgba(24,24,27,0.9); backdrop-filter: blur(14px);
            color: rgba(255,255,255,0.85); border-radius: 100px;
            box-shadow: 0 4px 24px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.07);
            cursor: move; user-select: none; font-family: system-ui; font-size: 13px; font-weight: 600;
            transition: transform 0.15s, box-shadow 0.15s; white-space: nowrap;
            gap: 2px;
        }
        .lance-drag-box:hover { transform: scale(1.04); color: #fff; box-shadow: 0 6px 30px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.12); }

        .lance-pill-inner {
            display: flex; align-items: center; justify-content: center;
            padding: 0 14px;
        }
        .lance-pill-icon { width: 14px; height: 14px; flex-shrink: 0; text-align: center; line-height: 14px; }
        .lance-pill-text {
            box-sizing: border-box; max-width: 0; padding-left: 0; padding-right: 0;
            opacity: 0; overflow: hidden;
            transition: max-width .22s cubic-bezier(.16,1,.3,1), padding-left .22s cubic-bezier(.16,1,.3,1), padding-right .22s cubic-bezier(.16,1,.3,1), opacity .15s;
        }
        .lance-drag-box.open .lance-pill-text { max-width: 140px; padding-left: 7px; padding-right: 0; opacity: 1; }

        .lance-pin-circle {
            display: none;
            width: 26px; height: 26px; border-radius: 50%;
            background: transparent; border: none; cursor: pointer;
            color: rgba(255,255,255,0.4); transition: all 0.2s;
            flex-shrink: 0; padding: 0; margin-right: 4px;
            align-items: center; justify-content: center;
        }
        .lance-pin-circle:hover { color: #fff; background: rgba(255,255,255,0.1); }
        .lance-pin-circle.pinned { color: #fff; background: rgba(255,255,255,0.15); }
        .lance-drag-box.open .lance-pin-circle { display: flex; }

        /* Edge mirror: when near right edge, pin goes left, text goes left of icon (only when open) */
        .lance-drag-box-right-edge .lance-pill-inner { order: 2; }
        .lance-drag-box-right-edge .lance-pin-circle { order: 1; margin-right: 0; margin-left: 4px; }
        .lance-drag-box-right-edge .lance-pill-icon { order: 2; }
        .lance-drag-box-right-edge .lance-pill-text { order: 1; } /* keep padding 0 when closed */

        /* When open and on right edge, swap padding for text (right padding for spacing) */
        .lance-drag-box-right-edge.open .lance-pill-text { padding-left: 0; padding-right: 7px; }

        .lance-menu-panel {
            position: absolute; width: max-content; min-width: 185px;
            background: #18181b; border: 1px solid rgba(255,255,255,0.07);
            border-radius: 12px; padding: 4px; display: none; flex-direction: column; gap: 1px;
            box-shadow: 0 12px 40px rgba(0,0,0,0.6);
        }
        .lance-drag-box.open > .lance-menu-panel { display: flex; }

        .pos-bottom-right { bottom: calc(100% + 12px); right: 0; transform-origin: bottom right; animation: aiPopUp .2s cubic-bezier(.16,1,.3,1); }
        .pos-bottom-left { bottom: calc(100% + 12px); left: 0; transform-origin: bottom left; animation: aiPopUp .2s cubic-bezier(.16,1,.3,1); }
        .pos-top-right { top: calc(100% + 12px); right: 0; transform-origin: top right; animation: aiPopDown .2s cubic-bezier(.16,1,.3,1); }
        .pos-top-left { top: calc(100% + 12px); left: 0; transform-origin: top left; animation: aiPopDown .2s cubic-bezier(.16,1,.3,1); }

        @keyframes aiPopUp { 0% { opacity: 0; transform: scale(.94) translateY(6px); } 100% { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes aiPopDown { 0% { opacity: 0; transform: scale(.94) translateY(-6px); } 100% { opacity: 1; transform: scale(1) translateY(0); } }

        .lance-menu-item {
            display: flex; align-items: center; padding: 9px 12px; background: transparent; border: none;
            border-radius: 8px; text-align: left; cursor: pointer; color: rgba(228,228,232,0.75);
            font-size: 12px; font-weight: 500; transition: background .1s, color .1s; width: 100%;
            white-space: nowrap; letter-spacing: 0.01em;
        }
        .lance-menu-item:hover { background: rgba(255,255,255,0.07); color: #fff; }
        .lance-badge { margin-left: auto; font-size: 9px; font-weight: 700; letter-spacing: .04em; font-family: monospace; color: rgba(255,255,255,0.2); }

        /* Submenu */
        .lance-menu-parent { position: relative; }
        .lance-menu-parent .lance-submenu {
            display: none;
            position: absolute;
            top: 0;
            background: #18181b;
            border: 1px solid rgba(255,255,255,0.07);
            border-radius: 12px;
            padding: 4px;
            min-width: 140px;
            box-shadow: 0 12px 40px rgba(0,0,0,0.6);
            flex-direction: column;
            gap: 1px;
        }
        .lance-menu-parent .lance-submenu { left: 100%; right: auto; }
        .lance-menu-parent.lance-submenu-left .lance-submenu { left: auto; right: 100%; }
        .lance-menu-parent.open > .lance-submenu { display: flex; }
    `);

    GM_registerMenuCommand("settings", openDashboard);

    if (typeof trustedTypes !== "undefined" && trustedTypes.defaultPolicy === null)
        trustedTypes.createPolicy("default", { createHTML: s => s, createScriptURL: s => s, createScript: s => s });

    setTimeout(() => {
        buildExportPill();
        UT.init();
        refreshPills();
    }, 1000);
})();
