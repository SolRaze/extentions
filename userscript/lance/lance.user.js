// ==UserScript==
// @name         lance
// @namespace    https://github.com/SolRaze/extentions/blob/main/userscript/lance
// @version      1.4
// @description  claude.ai chat export, usage tracker, enter-as-newline, first-prompt text
// @author       SolRaze
// @homepageURL  https://github.com/SolRaze/extentions
// @supportURL   https://github.com/SolRaze/extentions/issues
// @license      MIT
// @icon         data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMjIgMjIiIGZpbGw9ImN1cnJlbnRDb2xvciIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNNSAxOUgzVjE3SDRWMTZINVYxNUg2VjE0SDVWMTNINlYxMkg3VjExSDlWMTBIMTBWOUgxMVY4SDEzVjdIMTRWNkgxNVY1SDE2VjRIMThWM0gxOVY0SDE4VjZIMTdWN0gxNlY4SDE1VjlIMTRWMTFIMTNWMTJIMTJWM TNIMTFWMTVIMTBWMTZIOVYxN0g4VjE2SDdWMTdINlYxOEg1WiIvPjwvc3ZnPg==
// @include      *://claude.ai/*
// @noframes
// @run-at       document-idle
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @grant        GM_openInTab
// @connect      greasyfork.org
// @downloadURL https://update.greasyfork.org/scripts/592831/lance.user.js
// @updateURL https://update.greasyfork.org/scripts/592831/lance.meta.js
// ==/UserScript==

// Pure helpers (exported for selftest)
// Dotted versions compared numerically: 1.10 is newer than 1.9.
const newer = (a, b) => {
    const x = a.split('.').map(Number), y = b.split('.').map(Number);
    for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
    return false;
};
// Text put in front of the first prompt of a chat. '' when there is none or the input already starts with it.
const injectPrefix = (prepend, cur) => !prepend || cur.startsWith(prepend.trim()) ? '' : prepend + '\n\n';
// yyyymmdd_turns_title, turns zero-padded to 4 so a folder sorts by date then length
const makeFilename = (title, turns, d = new Date()) =>
    `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}_${String(turns).padStart(4, '0')}_${title}`;

if (typeof module !== 'undefined') module.exports = { newer, injectPrefix, makeFilename };
else (function () {
    'use strict';

    // claude.ai enforces trusted types; every html string goes through lance's own policy
    let policy = null;
    try { policy = window.trustedTypes?.createPolicy('lance', { createHTML: s => s }) || null; } catch (_) {}
    const trusted = (s) => policy ? policy.createHTML(s) : s;
    const setHTML = (el, s) => { el.innerHTML = trusted(s); };

    const qs = (sel, root = document) => root.querySelector(sel);
    const qsa = (sel, root = document) => [...root.querySelectorAll(sel)];

    // sites is the store of 1.3 and earlier: read when no flat settings exist yet, kept so its saved prompts stay in storage.
    const DEFAULTS = { enterNewline: true, injectionEnabled: false, usageTracker: true, prepend: '' };
    function loadCfg() {
        try {
            const c = JSON.parse(GM_getValue("lance_cfg") || '{}');
            const s = c.sites?.claude;
            if (!s || c.enterNewline !== undefined) return { ...DEFAULTS, ...c };
            const picked = s.savedPrompts?.find(p => p.title === s.selectedPrompt && p.enabled !== false);
            return { ...DEFAULTS, enterNewline: c.global?.enterNewline ?? true, injectionEnabled: !!s.injectionEnabled, usageTracker: s.usageTracker ?? true,
                prepend: [s.prepend, picked?.content].filter(Boolean).join('\n\n'), sites: c.sites };
        } catch (_) {
            return { ...DEFAULTS };
        }
    }
    function saveCfg(c) { GM_setValue("lance_cfg", JSON.stringify(c)); }
    const CFG = loadCfg();

    const getChatInput = () => qs('div.ProseMirror') || qs('[contenteditable="true"][data-placeholder]');
    const findSubmit = () => qs('button[aria-label*="Send"]');

    function prependToInput(el, prefix) {
        el.focus();
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

    // The first prompt of a chat is one sent while the page holds no user message yet, so a new chat in the same tab gets it too
    function applyInjectionIfNeeded() {
        if (!CFG.injectionEnabled || qs('[data-testid="user-message"]')) return;
        const el = getChatInput();
        const cur = el && (el.innerText || el.textContent || '').trim();
        if (!cur) return;
        const prefix = injectPrefix(CFG.prepend, cur);
        if (prefix) prependToInput(el, prefix);
    }

    function getEventTarget(e) { return e.composedPath ? e.composedPath()[0] || e.target : e.target; }

    window.addEventListener("keydown", e => {
        if (e.key !== "Enter" || e.altKey || e.isComposing || e.keyCode === 229) return;
        const t = getEventTarget(e);
        const input = getChatInput();
        if (!input || !(input === t || input.contains(t))) return;
        const plain = !e.ctrlKey && !e.shiftKey && !e.metaKey;
        if (!CFG.enterNewline) {
            if (plain) applyInjectionIfNeeded();
            return;
        }
        if (plain) {
            e.preventDefault();
            e.stopPropagation();
            const ev = new KeyboardEvent("keydown", { key: "Enter", code: "Enter", shiftKey: true, bubbles: true, cancelable: true });
            t.dispatchEvent(ev);
            if (!ev.defaultPrevented) document.execCommand("insertParagraph");
        } else if (e.metaKey !== e.ctrlKey) {
            const sb = findSubmit();
            if (!sb || sb.disabled) return;
            e.preventDefault();
            e.stopPropagation();
            applyInjectionIfNeeded();
            sb.click();
        }
    }, true);
    // a send by mouse injects too: capture runs before the site's own click handler reads the input
    window.addEventListener("click", e => {
        const sb = findSubmit();
        if (sb && sb.contains(getEventTarget(e))) applyInjectionIfNeeded();
    }, true);

    // ---- export functions ----
    function sanitize(t) { return (t || document.title || "Export").trim().replace(/[\/\\\?\%\*\:\|"<>\.]/g, "_"); }

    function toMd(html) {
        const doc = new DOMParser().parseFromString(trusted(html), "text/html");
        qsa("span.katex-html", doc).forEach(e => e.remove());
        qsa("mrow", doc).forEach(e => e.remove());
        qsa('annotation[encoding="application/x-tex"]', doc).forEach(e => e.replaceWith(e.closest(".katex-display") ? `\n$$\n${e.textContent.trim()}\n$$\n` : `$${e.textContent.trim()}$`));
        const rp = (el, txt) => el.parentNode.replaceChild(document.createTextNode(txt), el);
        qsa("strong,b", doc).forEach(e => rp(e, `**${e.textContent}**`));
        qsa("em,i", doc).forEach(e => rp(e, `*${e.textContent}*`));
        qsa("p code", doc).forEach(e => rp(e, `\`${e.textContent}\``));
        qsa("a", doc).forEach(e => rp(e, `[${e.textContent}](${e.href})`));
        qsa("img", doc).forEach(e => rp(e, `![${e.alt}](${e.src})`));
        qsa("pre", doc).forEach(pre => {
            const code = qs("code", pre);
            const type = code ? Array.from(code.classList).find(c => c.startsWith("language-"))?.replace("language-","") || "" : "";
            pre.textContent = `\n\`\`\`${type}\n${code ? code.textContent : pre.textContent}\n\`\`\`\n`;
        });
        qsa("ul", doc).forEach(ul => rp(ul, "\n" + qsa(":scope>li", ul).map(li => `- ${li.textContent.trim()}`).join("\n")));
        qsa("ol", doc).forEach(ol => rp(ol, "\n" + qsa(":scope>li", ol).map((li, i) => `${i+1}. ${li.textContent.trim()}`).join("\n")));
        for (let i = 1; i <= 6; i++) qsa(`h${i}`, doc).forEach(h => rp(h, `\n${"#".repeat(i)} ${h.textContent}\n`));
        qsa("p", doc).forEach(p => rp(p, `\n${p.textContent}\n`));
        return doc.body.textContent.trim();
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

    function mdDoc(title, pairs) {
        const yaml = ["---",
            `title: "${title}"`,
            `date: "${new Date().toISOString()}"`,
            `source: claude`,
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

    function fileExport(fmt) {
        const res = qsa('[data-testid="user-message"],.font-claude-response');
        if (!res.length) return;
        const title = sanitize(document.title), pairs = [];
        const md = el => toMd(el.innerHTML);
        for (let i = 0; i < res.length - 1; i += 2) {
            const att = fmt === "md" ? extractAttachments(res[i]) : [];
            pairs.push({ q: md(res[i]) + (att.length ? renderAttachmentsMd(att) : ''), a: md(res[i + 1]) });
        }
        const name = `${makeFilename(title, pairs.length)}.${fmt}`;
        if (fmt === "json") anchorSave(JSON.stringify(pairs, null, 2), "application/json", name);
        else anchorSave(mdDoc(title, pairs), "text/markdown", name);
    }

    // Tab on the right edge, a 6px sliver until hover, same slot as mark and pace, whose sites lance never runs on.
    function buildPill() {
        const tab = document.createElement('button');
        tab.className = 'lance-tab'; tab.textContent = 'lance';
        const menu = document.createElement('div');
        menu.className = 'lance-menu'; menu.hidden = true;
        const show = (on) => { menu.hidden = !on; tab.classList.toggle('open', on); };
        const item = (label, fn) => {
            const b = document.createElement('button');
            b.className = 'lance-menu-item'; b.textContent = label;
            b.onclick = () => { show(false); fn(); };
            return b;
        };
        menu.append(item('export markdown', () => fileExport('md')), item('export json', () => fileExport('json')), item('settings', openDashboard));
        tab.onclick = () => show(menu.hidden);
        document.addEventListener('click', e => { if (!tab.contains(e.target) && !menu.contains(e.target)) show(false); });
        document.body.append(tab, menu);
    }

    // ---- claude usage tracker ----
    const UT = (() => {

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
            setHTML(root, `<div class="t"><div class="b"><div class="f" data-role="tf"></div></div></div><div class="p">${ROWS.map(([,label], i) => `<div class="r" data-i="${i}"><div class="hh"><span class="l">${label}</span><span class="m" data-role="m"></span></div><div class="k"><div class="f" data-role="f"></div></div></div>`).join('')}</div>`);
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
            if (!CFG.usageTracker) { document.getElementById(ID)?.remove(); return; }
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

    // ---- settings dashboard ----
    // Latest version from greasyfork's meta file; installing goes through tampermonkey's own page.
    const META_URL = 'https://update.greasyfork.org/scripts/592831/lance.meta.js';
    const latest = () => new Promise((ok, fail) => GM_xmlhttpRequest({
        method: 'GET', url: META_URL + '?t=' + Date.now(), timeout: 15000,
        onload: r => { const v = /@version\s+(\S+)/.exec(r.responseText); v ? ok(v[1]) : fail(new Error('no version in meta')); },
        onerror: () => fail(new Error('greasyfork unreachable')), ontimeout: () => fail(new Error('greasyfork timed out')),
    }));

    function openDashboard() {
        const existing = qs('#lance-dashboard');
        if (existing) { existing.remove(); qs('#lance-overlay')?.remove(); return; }

        const bg = "#1c1c20", bg3 = "#27272c", fg = "#e4e4e8", fg2 = "rgba(228,228,232,0.5)", bd = "rgba(255,255,255,0.07)", wht = "#ffffff";

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
        siteLabel.textContent = 'lance';
        Object.assign(siteLabel.style, { fontSize: '17px', color: wht });
        const closeBtn = document.createElement('button'); closeBtn.textContent = '✕';
        Object.assign(closeBtn.style, { background: 'none', border: 'none', color: fg2, cursor: 'pointer', fontSize: '16px', padding: '0', lineHeight: '1', transition: 'color 0.1s' });
        closeBtn.addEventListener('mouseenter', () => { closeBtn.style.color = wht; });
        closeBtn.addEventListener('mouseleave', () => { closeBtn.style.color = fg2; });
        closeBtn.onclick = () => { dlg.remove(); ov.remove(); };
        const hint = document.createElement('div');
        Object.assign(hint.style, { fontSize: '11px', color: fg2, overflowWrap: 'anywhere' });
        const say = (t) => { hint.textContent = t; };
        const updateBtn = document.createElement('button'); updateBtn.textContent = 'update';
        updateBtn.title = 'check greasyfork for a new version';
        Object.assign(updateBtn.style, { background: 'none', border: 'none', color: fg2, cursor: 'pointer', fontSize: '12px', marginLeft: 'auto', marginRight: '12px' });
        updateBtn.onclick = async () => {
            const mine = GM_info.script.version;
            try {
                const v = await latest();
                if (!newer(v, mine)) { updateBtn.textContent = 'update'; return say(`${mine} is the latest`); }
                say(`installing ${v} | reload the page after`);
                GM_openInTab(GM_info.script.downloadURL || META_URL.replace('.meta.js', '.user.js'), { active: true });
            } catch (e) { say('update check failed: ' + e.message); }
        };
        latest().then(v => { if (newer(v, GM_info.script.version)) updateBtn.textContent = `update ${v}`; }).catch(() => {});
        hdr.appendChild(siteLabel); hdr.appendChild(updateBtn); hdr.appendChild(closeBtn);
        dlg.appendChild(hdr);


        dlg.appendChild(rowEl('enter inserts a newline, cmd or ctrl + enter sends', toggle(CFG.enterNewline, v => {
            CFG.enterNewline = v;
            saveCfg(CFG);
        })));

        dlg.appendChild(rowEl('inject into the first prompt', toggle(CFG.injectionEnabled, v => {
            CFG.injectionEnabled = v;
            saveCfg(CFG);
        })));

        const prependRow = document.createElement('div');
        Object.assign(prependRow.style, { display: 'flex', flexDirection: 'column', gap: '4px', padding: '6px 0', borderBottom: `1px solid ${bd}` });
        const prependLabel = document.createElement('span'); prependLabel.textContent = 'text put before the first prompt:'; prependLabel.style.color = fg;
        const prependInput = document.createElement('textarea');
        prependInput.value = CFG.prepend;
        Object.assign(prependInput.style, { background: bg3, border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: fg, padding: '6px 8px', fontSize: '12px', resize: 'vertical', minHeight: '40px', width: '100%', outline: 'none' });
        prependInput.oninput = () => { CFG.prepend = prependInput.value; saveCfg(CFG); };
        prependRow.appendChild(prependLabel); prependRow.appendChild(prependInput);
        dlg.appendChild(prependRow);

        dlg.appendChild(rowEl('show inline usage bar', toggle(CFG.usageTracker, v => {
            CFG.usageTracker = v;
            saveCfg(CFG);
            UT.refresh();
        })));

        dlg.appendChild(hint);
        document.body.appendChild(dlg);
    }

    GM_addStyle(`
        .lance-tab {
            position: fixed; right: 0; top: calc(50% - 30px); z-index: 2147482999; background: #1a1a1d; color: #ddd;
            border: 1px solid #333; border-right: 0; border-radius: 8px 0 0 8px; padding: 8px 3px; font: 12px system-ui; line-height: normal;
            cursor: pointer; opacity: .7; writing-mode: vertical-rl; transform: translateX(calc(100% - 6px));
        }
        .lance-tab:hover, .lance-tab:focus-visible, .lance-tab.open { opacity: 1; transform: none; }
        .lance-menu {
            position: fixed; right: 26px; top: calc(50% - 30px); z-index: 2147483646; display: flex; flex-direction: column; gap: 1px;
            min-width: 160px; padding: 4px; background: #1c1c20; border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; box-shadow: 0 12px 40px rgba(0,0,0,0.6);
        }
        .lance-menu[hidden] { display: none; }
        .lance-menu-item {
            padding: 9px 12px; background: transparent; border: none; border-radius: 8px; text-align: left; cursor: pointer;
            color: rgba(228,228,232,0.75); font: 500 12px system-ui; white-space: nowrap;
        }
        .lance-menu-item:hover, .lance-menu-item:focus-visible { background: rgba(255,255,255,0.07); color: #fff; }
    `);

    GM_registerMenuCommand("settings", openDashboard);

    setTimeout(() => {
        buildPill();
        UT.init();
    }, 1000);
})();
