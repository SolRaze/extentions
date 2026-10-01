// ==UserScript==
// @name         mark
// @namespace    https://github.com/SolRaze/extentions/tree/main/userscript/mark
// @version      1.0
// @description  tag users, posts and videos across sites | hide, dim or star what you tagged | searchable library
// @author       SolRaze
// @homepageURL  https://github.com/SolRaze/extentions
// @supportURL   https://github.com/SolRaze/extentions/issues
// @license      MIT
// @match        https://*.x.com/*
// @match        https://x.com/*
// @match        https://twitter.com/*
// @match        https://*.reddit.com/*
// @match        https://github.com/*
// @match        https://*.youtube.com/*
// @match        https://*.instagram.com/*
// @match        https://news.ycombinator.com/*
// @noframes
// @run-at       document-idle
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addValueChangeListener
// @grant        GM_registerMenuCommand
// ==/UserScript==

// Link rules per site; item is the list entry an effect applies to, a selector or a function of the link.
// A rule is [type, regex, key?, text?]: the regex runs on the normalized url
// (host without www/m, path, query), the key is 'https://' + key(match) or match[0], and text, if
// given, must match the link text. First matching rule wins, so specific paths go first.
// Rules apply to links on every matched site: a github repo link on hacker news gets its tags too.
const SITES = {
    'x.com': { item: '[data-testid="cellInnerDiv"]', links: [
        ['post', /^x\.com\/\w+\/status\/\d+/],
        ['user', /^x\.com\/(?!(?:home|explore|notifications|messages|i|search|settings|compose|tos|privacy|hashtag|intent|share|jobs)(?=$|[/?]))\w{1,15}(?=$|[?])/, null, /^@/],
    ] },
    'reddit.com': { item: 'shreddit-post, shreddit-comment, article', links: [
        ['post', /^reddit\.com\/r\/\w+\/comments\/\w+/],
        ['user', /^reddit\.com\/(?:u|user)\/([\w-]+)/, m => `reddit.com/user/${m[1]}`],
        ['community', /^reddit\.com\/r\/\w+(?=$|[/?])/],
    ] },
    'github.com': { item: '.Box-row, .js-timeline-item, article, li', links: [
        ['post', /^github\.com\/[\w.-]+\/[\w.-]+\/(?:issues|pull|discussions)\/\d+/],
        ['repo', /^github\.com\/(?!(?:orgs|settings|topics|features|sponsors|marketplace|apps|collections|trending|notifications|explore|search|login|signup|pricing|enterprise|about|security|site|readme|team|pulls|issues|codespaces|organizations|users|new|account)\/)[\w-]+\/[\w.-]+(?=$|[?])/],
        ['user', /^github\.com\/(?!(?:orgs|settings|topics|features|sponsors|marketplace|apps|collections|trending|notifications|explore|search|login|signup|pricing|enterprise|about|security|site|readme|team|pulls|issues|codespaces|organizations|users|new|account|dashboard|stars|watching|join)(?=$|[?]))[\w-]+(?=$|[?])/],
    ] },
    'youtube.com': { item: 'ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer, ytd-grid-video-renderer, yt-lockup-view-model, ytd-comment-thread-renderer, ytd-channel-renderer, ytd-playlist-renderer', links: [
        ['video', /^youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/)([\w-]{11})/, m => `youtube.com/watch?v=${m[1]}`],
        ['user', /^youtube\.com\/(@[^/?]+|channel\/[\w-]+|c\/[^/?]+|user\/[^/?]+)/],
    ] },
    'youtu.be': { links: [['video', /^youtu\.be\/([\w-]{11})/, m => `youtube.com/watch?v=${m[1]}`]] },
    'instagram.com': { item: 'article', links: [
        ['post', /^instagram\.com\/(?:[\w.]+\/)?(p|reel)\/([\w-]+)/, m => `instagram.com/${m[1]}/${m[2]}`],
        ['user', /^instagram\.com\/(?!(?:explore|reels|direct|accounts|stories|p|reel|about|legal|developer)(?=$|[/?]))[\w.]+(?=$|[/?])/],
    ] },
    // story links sit in the subtext row under the story's tr.athing, comment links inside it
    'news.ycombinator.com': { item: (a) => a.closest('tr.athing') || (a.closest('tr')?.previousElementSibling?.matches('tr.athing') && a.closest('tr').previousElementSibling), css: 'tr.athing[data-mark~="hide"] + tr { display: none !important; }', links: [
        ['post', /^news\.ycombinator\.com\/item\?id=\d+/],
        ['user', /^news\.ycombinator\.com\/user\?id=[\w-]+/],
    ] },
};
const ALIAS = { 'twitter.com': 'x.com' };
// Tags with a page effect on the list item holding the link. The first name is the one the editor toggles.
const EFFECTS = { star: ['star', '★'], dim: ['dim', 'ignore', 'clickbait', 'promotion', 'sb'], hide: ['hide', 'block'] };
const DELETED = '._DELETED_'; // utags marks removed entries with this tag; skipped on import

// 'https://www.reddit.com/r/foo/?x=1#c' -> 'reddit.com/r/foo?x=1'
function norm(href) {
    let u;
    try { u = new URL(href); } catch { return ''; }
    if (!/^https?:$/.test(u.protocol)) return '';
    const host = u.hostname.toLowerCase().replace(/^(?:www|m|mobile|old|new)\./, '');
    return (ALIAS[host] || host) + u.pathname.replace(/\/+$/, '') + u.search;
}

// Returns { key, type } for a taggable url, or null. User keys are lowercased: every site here
// treats handles case-insensitively, while post and video ids are case-sensitive.
function match(href, text = '') {
    const n = norm(href);
    const site = SITES[n.slice(0, n.indexOf('/') >>> 0)];
    for (const [type, re, key, txt] of site ? site.links : []) {
        const m = n.match(re);
        if (!m || (txt && !txt.test(text))) continue;
        const k = 'https://' + (key ? key(m) : m[0]);
        return { key: type === 'user' || type === 'community' ? k.toLowerCase() : k, type };
    }
    return null;
}

// Store in the utags shape, so exports open in either script:
// { data: { <url>: { tags: [], meta: { title, type, created, updated } } }, meta: { databaseVersion } }
const STORE = 'mark.store';
let store;
const load = () => { store = GM_getValue(STORE) || { data: {}, meta: { databaseVersion: 3 } }; };
const tagsOf = (key) => store.data[key]?.tags || [];
function setTags(key, tags, meta) {
    const now = Date.now(), old = store.data[key];
    if (tags.length) store.data[key] = { tags, meta: { ...old?.meta, ...meta, created: old?.meta?.created || now, updated: now } };
    else delete store.data[key];
    GM_setValue(STORE, store);
    refresh();
}
function tagCounts() {
    const c = new Map();
    for (const { tags } of Object.values(store.data)) for (const t of tags) c.set(t, (c.get(t) || 0) + 1);
    return [...c].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}
// Merges a utags or mark export: tag lists are unioned, the newer meta wins.
function merge(json) {
    const data = json?.data;
    if (!data || typeof data !== 'object') throw new Error('not a utags or mark export');
    let n = 0;
    for (const [key, v] of Object.entries(data)) {
        const tags = (v?.tags || []).filter(t => typeof t === 'string' && t && t !== DELETED);
        if (!tags.length || (v.tags || []).includes(DELETED)) continue;
        const old = store.data[key];
        const meta = !old || (v.meta?.updated || 0) > (old.meta?.updated || 0) ? v.meta : old.meta;
        store.data[key] = { tags: [...new Set([...(old?.tags || []), ...tags])], meta: { ...meta } };
        n++;
    }
    GM_setValue(STORE, store);
    refresh();
    return n;
}

// DOM helper: no innerHTML, so page text never parses as markup and YouTube's trusted types stay happy.
function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
        if (v == null || v === false) continue;
        if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
        else if (k in el && k !== 'style') el[k] = v;
        else el.setAttribute(k, v);
    }
    el.append(...kids.flat(Infinity).filter(k => k != null && k !== false));
    return el;
}
const hue = (s) => [...s].reduce((a, c) => (a * 31 + c.codePointAt(0)) >>> 0, 7) % 360;
const chip = (t, extra) => h('span', { className: 'mark-chip', style: `--h:${hue(t)}`, ...extra }, t);
const effectsOf = (tags) => Object.keys(EFFECTS).filter(e => tags.some(t => EFFECTS[e].includes(t.toLowerCase())));

// Page pass: chips after tagged links, effect attributes on their list items.
let site = {};
const info = new WeakMap(); // link -> { href, m, chips, shown }
let marked = new Set();
function linkInfo(a) {
    let i = info.get(a);
    if (!i || i.href !== a.href) {
        const text = a.textContent.trim();
        // Image-only links (avatars, thumbnails) would double every chip, so only text links count.
        i = { href: a.href, m: text && text.length < 300 ? match(a.href, text) : null, title: text.slice(0, 160) };
        info.set(a, i);
    }
    return i;
}
function scan() {
    const items = new Map();
    for (const a of document.querySelectorAll('a[href]')) {
        if (a.closest('.mark-chips')) continue;
        const i = linkInfo(a);
        if (!i.m) continue;
        const tags = tagsOf(i.m.key), shown = tags.join('\n');
        if (i.shown !== shown || (i.chips && !i.chips.isConnected && tags.length)) {
            i.chips?.remove();
            i.chips = tags.length ? h('span', { className: 'mark-chips', onclick: (e) => { e.preventDefault(); e.stopPropagation(); edit(a); } }, tags.map(t => chip(t))) : null;
            if (i.chips) a.after(i.chips);
            i.shown = shown;
        }
        const fx = effectsOf(tags);
        if (!fx.length) continue;
        const item = (typeof site.item === 'function' ? site.item(a) : site.item && a.closest(site.item)) || a;
        const set = items.get(item) || items.set(item, new Set()).get(item);
        fx.forEach(f => set.add(f));
    }
    for (const el of marked) if (!items.has(el)) el.removeAttribute('data-mark');
    for (const [el, fx] of items) {
        const v = [...fx].join(' ');
        if (el.getAttribute('data-mark') !== v) el.setAttribute('data-mark', v);
    }
    marked = new Set(items.keys());
}
let scanTimer = 0;
const refresh = () => { if (!scanTimer) scanTimer = setTimeout(() => { scanTimer = 0; scan(); }, 300); };

const PAGE_CSS = `
.mark-chips { display: inline-flex; flex-wrap: wrap; gap: 3px; margin: 0 4px; vertical-align: middle; cursor: pointer; }
.mark-chip { font: 600 11px/17px system-ui, sans-serif; padding: 0 7px; border-radius: 9px; white-space: nowrap;
    background: hsl(var(--h) 80% 50% / .18); color: hsl(var(--h) 70% 45%); }
html:not(.mark-show-hidden) [data-mark~="hide"] { display: none !important; }
html.mark-show-hidden [data-mark~="hide"] { opacity: .25; }
[data-mark~="dim"] { opacity: .35; transition: opacity .15s; }
[data-mark~="dim"]:hover { opacity: 1; }
[data-mark~="star"] { box-shadow: inset 3px 0 #f5b301; background-color: rgb(245 179 1 / .08); }
`;

// UI lives in a shadow root: page css can't reach it and it can't reach the page.
const UI_CSS = `
:host { all: initial; }
* { box-sizing: border-box; font: 13px/1.4 system-ui, sans-serif; }
.btn { position: fixed; z-index: 2147483647; width: 22px; height: 22px; border: 0; border-radius: 50%; padding: 0;
    background: #222c; color: #fff; cursor: pointer; display: none; place-items: center; font-size: 12px; box-shadow: 0 1px 4px #0005; }
.btn.on { display: grid; }
.btn:hover { background: #4b6bfb; }
.pop, .lib { position: fixed; z-index: 2147483647; color: #e8e8ea; background: #1c1c20;
    border: 1px solid #ffffff1a; border-radius: 12px; box-shadow: 0 12px 40px #0008; }
.pop { width: 300px; padding: 10px; display: grid; gap: 8px; }
.title { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.type { font-size: 10px; text-transform: uppercase; letter-spacing: .06em; opacity: .55; margin-right: 6px; font-weight: 600; }
.field { display: flex; flex-wrap: wrap; gap: 4px; padding: 5px; border-radius: 8px; background: #ffffff0f; cursor: text; }
.field:focus-within { outline: 1px solid #4b6bfb; }
.field input { flex: 1; min-width: 80px; border: 0; outline: 0; background: none; color: inherit; padding: 2px; }
.mark-chip { font: 600 11px/18px system-ui, sans-serif; padding: 0 7px; border-radius: 9px; white-space: nowrap; cursor: pointer;
    background: hsl(var(--h) 80% 55% / .22); color: hsl(var(--h) 85% 72%); }
.mark-chip.x::after { content: ' ×'; opacity: .6; }
.mark-chip.dim { opacity: .5; }
.mark-chip.dim:hover, .mark-chip.sel { opacity: 1; outline: 1px solid currentColor; }
.row { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
.fx { flex: 1; border: 1px solid #ffffff1f; background: none; color: inherit; border-radius: 7px; padding: 4px; cursor: pointer; }
.fx.on { background: #4b6bfb; border-color: #4b6bfb; }
.hint { font-size: 11px; opacity: .45; }
.shade { position: fixed; inset: 0; z-index: 2147483646; background: #0006; }
.lib { top: 8vh; left: 50%; transform: translateX(-50%); width: min(760px, 94vw); max-height: 84vh; display: flex; flex-direction: column; }
.lib > * { padding: 10px 14px; }
.search { width: 100%; border: 0; outline: 0; background: #ffffff0f; color: inherit; border-radius: 8px; padding: 8px 10px; font-size: 14px; }
.list { overflow: auto; flex: 1; padding-top: 0; }
.item { display: grid; grid-template-columns: 1fr auto; gap: 2px 10px; padding: 7px 0; border-top: 1px solid #ffffff12; }
.item a { color: inherit; text-decoration: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.item a:hover { color: #8ea2ff; }
.host { font-size: 11px; opacity: .45; }
.acts { grid-row: span 2; display: flex; gap: 2px; align-items: center; }
.ib { border: 0; background: none; color: inherit; opacity: .5; cursor: pointer; padding: 4px 6px; border-radius: 6px; }
.ib:hover { opacity: 1; background: #ffffff14; }
.foot { display: flex; gap: 8px; align-items: center; border-top: 1px solid #ffffff14; }
.foot .grow { flex: 1; }
`;
let host, root, btn, corner;

// Hover button: one shared button that follows the hovered taggable link.
let hovered = null, hideTimer = 0;
function showBtn(a) {
    clearTimeout(hideTimer);
    hovered = a;
    const r = a.getClientRects()[0] || a.getBoundingClientRect();
    btn.style.left = Math.min(innerWidth - 26, r.right + 4) + 'px';
    btn.style.top = Math.max(2, r.top + r.height / 2 - 11) + 'px';
    btn.classList.add('on');
}
const hideBtnSoon = () => { clearTimeout(hideTimer); hideTimer = setTimeout(() => { btn.classList.remove('on'); hovered = null; }, 500); };

const typing = (e) => { const t = e.composedPath()[0]; return t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName); };

// Editor popover. Every change saves at once; Enter on an empty field or Esc closes.
let pop = null;
function closePop() { pop?.remove(); pop = null; removeEventListener('scroll', placePop, true); }
let popAnchor = null;
function placePop() {
    if (!pop || !popAnchor?.isConnected) return closePop();
    const r = popAnchor.getBoundingClientRect(), H = pop.offsetHeight;
    pop.style.left = Math.max(8, Math.min(innerWidth - 308, r.left)) + 'px';
    pop.style.top = (r.bottom + 6 + H > innerHeight && r.top > H + 6 ? r.top - H - 6 : Math.min(innerHeight - H - 8, r.bottom + 6)) + 'px';
}
function edit(anchor, entry) {
    const { key, type, title } = entry || (() => { const i = linkInfo(anchor); return { ...i.m, title: i.title }; })();
    closePop();
    btn.classList.remove('on');
    let tags = [...tagsOf(key)], sel = 0;
    const save = () => { setTags(key, tags, { title: store.data[key]?.meta?.title || title, type }); draw(); };
    const add = (t) => { t = t.trim().replace(/\s+/g, ' '); if (t && !tags.includes(t)) tags.push(t); input.value = ''; sel = 0; save(); };
    const toggle = (t) => { tags = tags.includes(t) ? tags.filter(x => x !== t) : [...tags, t]; save(); };
    const counts = tagCounts();
    const input = h('input', { placeholder: 'add tag, enter', oninput: () => { sel = 0; draw(); }, onkeydown: (e) => {
        const sugg = suggestions();
        if (e.key === 'Escape') { closePop(); return; }
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + sugg.length) % Math.max(1, sugg.length); draw(); return; }
        if (e.key === 'Tab' && sugg.length && input.value) { e.preventDefault(); add(sugg[sel]); return; }
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            if (input.value.trim()) add(input.value);
            else if (e.key === 'Enter') closePop();
            return;
        }
        if (e.key === 'Backspace' && !input.value && tags.length) { tags.pop(); save(); }
        e.stopPropagation(); // keep the page's own shortcuts out of the field
    } });
    // Typed text filters known tags by substring; an empty field offers the most used ones.
    const suggestions = () => {
        const q = input.value.trim().toLowerCase();
        return counts.map(([t]) => t).filter(t => !tags.includes(t) && !Object.values(EFFECTS).flat().includes(t) && (!q || t.toLowerCase().includes(q))).slice(0, 8);
    };
    const field = h('div', { className: 'field', onclick: () => input.focus() });
    const suggRow = h('div', { className: 'row' });
    const fxRow = h('div', { className: 'row' });
    function draw() {
        field.replaceChildren(...tags.map(t => chip(t, { className: 'mark-chip x', title: 'remove', onclick: (e) => { e.stopPropagation(); toggle(t); } })), input);
        suggRow.replaceChildren(...suggestions().map((t, i) => chip(t, { className: `mark-chip dim${i === sel && input.value ? ' sel' : ''}`, onclick: () => add(t) })));
        fxRow.replaceChildren(...[['star', '★ star'], ['dim', '◐ dim'], ['hide', '⊘ hide']].map(([t, label]) =>
            h('button', { className: `fx${effectsOf(tags).includes(t) ? ' on' : ''}`, onclick: () => {
                tags = effectsOf(tags).includes(t) ? tags.filter(x => !EFFECTS[t].includes(x.toLowerCase())) : [...tags, t];
                save();
            } }, label)));
        placePop();
    }
    pop = h('div', { className: 'pop' },
        h('div', { className: 'title', title: key }, h('span', { className: 'type' }, type), title || key),
        field, suggRow, fxRow,
        h('div', { className: 'hint' }, 'enter adds | tab completes | ⌫ removes last | esc closes'));
    popAnchor = anchor;
    root.append(pop);
    draw();
    addEventListener('scroll', placePop, true);
    input.focus();
}

// Library: every tagged entry, searchable. "#tag" terms and tag clicks filter by tag, other words
// match title, url or tag text.
let lib = null;
function closeLib() { lib?.remove(); lib = null; closePop(); }
function openLib() {
    if (lib) return closeLib();
    const picked = new Set();
    let undo = null;
    const search = h('input', { className: 'search', placeholder: 'search | #tag', oninput: () => draw(), onkeydown: (e) => { if (e.key === 'Escape') closeLib(); e.stopPropagation(); } });
    const cloud = h('div', { className: 'row' }), list = h('div', { className: 'list' }), count = h('span', { className: 'hint grow' });
    const file = h('input', { type: 'file', accept: '.json,application/json', style: 'display:none', onchange: async () => {
        try { const n = merge(JSON.parse(await file.files[0].text())); count.textContent = `imported ${n} entries`; }
        catch (err) { count.textContent = 'import failed: ' + err.message; }
        file.value = '';
        draw(true);
    } });
    const showHidden = h('input', { type: 'checkbox', checked: GM_getValue('mark.showHidden', false), onchange: () => setShowHidden(showHidden.checked) });
    function draw(keepCount) {
        const words = search.value.toLowerCase().split(/\s+/).filter(Boolean);
        const want = [...picked, ...words.filter(w => w.startsWith('#')).map(w => w.slice(1))];
        const text = words.filter(w => !w.startsWith('#'));
        const rows = Object.entries(store.data)
            .filter(([k, v]) => want.every(t => v.tags.some(x => x.toLowerCase() === t.toLowerCase()))
                && text.every(w => (k + ' ' + (v.meta?.title || '') + ' ' + v.tags.join(' ')).toLowerCase().includes(w)))
            .sort((a, b) => (b[1].meta?.updated || 0) - (a[1].meta?.updated || 0));
        cloud.replaceChildren(...tagCounts().slice(0, 40).map(([t, n]) => chip(`${t} ${n}`, { className: `mark-chip${picked.has(t) ? ' sel' : ' dim'}`, onclick: () => { picked.has(t) ? picked.delete(t) : picked.add(t); draw(); } })));
        list.replaceChildren(...rows.slice(0, 300).map(([key, v]) => {
            const row = h('div', { className: 'item' },
                h('a', { href: key, target: '_blank', title: key }, h('span', { className: 'type' }, v.meta?.type || ''), v.meta?.title || key),
                h('div', { className: 'acts' },
                    h('button', { className: 'ib', title: 'edit', onclick: () => edit(row, { key, type: v.meta?.type, title: v.meta?.title }) }, '✎'),
                    h('button', { className: 'ib', title: 'delete', onclick: () => { undo = [key, store.data[key]]; setTags(key, []); draw(); } }, '✕')),
                h('div', { className: 'row' }, h('span', { className: 'host' }, key.replace(/^https:\/\//, '').split(/[/?]/)[0]), v.tags.map(t => chip(t))));
            return row;
        }), rows.length > 300 ? h('div', { className: 'hint' }, `${rows.length - 300} more | narrow the search`) : null);
        if (!keepCount) count.replaceChildren(`${rows.length} of ${Object.keys(store.data).length}`,
            undo ? h('button', { className: 'ib', onclick: () => { store.data[undo[0]] = undo[1]; undo = null; GM_setValue(STORE, store); refresh(); draw(); } }, 'undo delete') : null);
    }
    lib = h('div', {},
        h('div', { className: 'shade', onclick: closeLib }),
        h('div', { className: 'lib' },
            h('div', {}, search), h('div', {}, cloud), list,
            h('div', { className: 'foot' }, count,
                h('label', { className: 'hint' }, showHidden, ' show hidden'),
                h('button', { className: 'ib', onclick: exportJson }, 'export'),
                h('button', { className: 'ib', onclick: () => file.click() }, 'import'), file)));
    root.append(lib);
    draw();
    search.focus();
}
function exportJson() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(store, null, 2)], { type: 'application/json' }));
    h('a', { href: url, download: `mark-${new Date().toISOString().slice(0, 10)}.json` }).click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function setShowHidden(on) {
    GM_setValue('mark.showHidden', on);
    document.documentElement.classList.toggle('mark-show-hidden', on);
}

function main() {
    load();
    site = SITES[norm(location.href).split('/')[0]] || {};
    host = h('div', { id: 'mark-ui' });
    root = host.attachShadow({ mode: 'closed' });
    btn = h('button', { className: 'btn', title: 'tag (t)', onclick: () => hovered && edit(hovered), onmouseenter: () => clearTimeout(hideTimer), onmouseleave: hideBtnSoon }, '🏷');
    // anchor for page tags: the editor opens top right
    corner = h('div', { style: 'position:fixed;top:4px;right:12px;width:300px;height:0' });
    root.append(h('style', {}, UI_CSS), btn, corner);
    GM_addStyle(PAGE_CSS + (site.css || ''));
    document.documentElement.append(host);
    setShowHidden(GM_getValue('mark.showHidden', false));

    document.addEventListener('mouseover', (e) => {
        const a = e.target.closest?.('a[href]');
        if (a && linkInfo(a).m) showBtn(a);
        else if (hovered && !btn.matches(':hover')) hideBtnSoon();
    }, true);
    document.addEventListener('mousedown', (e) => { if (!e.composedPath().includes(host)) closePop(); }, true);
    document.addEventListener('keydown', (e) => {
        if (e.altKey && e.shiftKey && e.code === 'KeyT') { e.preventDefault(); openLib(); return; }
        if (e.key === 't' && !e.ctrlKey && !e.metaKey && !e.altKey && hovered && !typing(e)) { e.preventDefault(); e.stopPropagation(); edit(hovered); }
    }, true);

    GM_registerMenuCommand('library (alt+shift+t)', openLib);
    GM_registerMenuCommand('tag this page', () => {
        const m = match(location.href) || { key: 'https://' + norm(location.href).replace(/\?.*/, ''), type: 'page' };
        edit(corner, { ...m, title: document.title });
    });
    GM_registerMenuCommand('show hidden on/off', () => setShowHidden(!GM_getValue('mark.showHidden', false)));
    // Other tabs saving: pick up their store so every tab shows the same tags.
    if (typeof GM_addValueChangeListener === 'function') GM_addValueChangeListener(STORE, (k, o, v, remote) => { if (remote) { store = v || { data: {} }; refresh(); } });

    new MutationObserver((ms) => { if (ms.some(m => m.target !== host && !m.target.closest?.('.mark-chips'))) refresh(); })
        .observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['href'] });
    scan();
}

if (typeof module !== 'undefined') module.exports = { norm, match, merge, effectsOf, _setStore: (s) => { store = s; } };
else main();
