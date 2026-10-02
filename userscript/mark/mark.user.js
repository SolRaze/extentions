// ==UserScript==
// @name         mark
// @namespace    https://github.com/SolRaze/extentions/tree/main/userscript/mark
// @version      2.2
// @description  tag users, posts, videos and links across sites | colours, notes, per-tag hide, dim or star | tags page
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
// @match        https://soundcloud.com/*
// @match        https://pinterest.com/*
// @match        https://*.pinterest.com/*
// @match        https://civitai.com/*
// @match        https://civitai.red/*
// @noframes
// @run-at       document-idle
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addValueChangeListener
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @grant        GM_openInTab
// @grant        GM_info
// @connect      greasyfork.org
// @downloadURL https://update.greasyfork.org/scripts/598296/mark.user.js
// @updateURL https://update.greasyfork.org/scripts/598296/mark.meta.js
// ==/UserScript==

// Link rules per site. item is the list entry effects apply to: a selector or a function of the link.
// media lets image-only links count (pin and model grids have no text links).
// A rule is [type, regex, opts]: the regex runs on the normalized url (host without www/m, path,
// query); opts.key builds the key from the match (default match[0]), opts.up the parent key whose
// tags also drive effects (a post's user or community), opts.text must match the link text.
// First matching rule wins, so specific paths go first. Rules apply to links on every matched site.
const GH_RESERVED = 'orgs|settings|topics|features|sponsors|marketplace|apps|collections|trending|notifications|explore|search|login|signup|pricing|enterprise|about|security|site|readme|team|pulls|issues|codespaces|organizations|users|new|account|dashboard|stars|watching|join';
const SC_RESERVED = 'discover|stream|search|you|upload|feed|charts|pages|settings|messages|notifications|people|terms-of-use|mobile|pro|imprint|jobs|creators|artists|signin|logout|tags|popular|connect';
const SITES = {
    'x.com': { item: '[data-testid="cellInnerDiv"]', links: [
        ['post', /^x\.com\/(\w+)\/status\/\d+/, { up: m => `x.com/${m[1]}` }],
        ['user', /^x\.com\/(?!(?:home|explore|notifications|messages|i|search|settings|compose|tos|privacy|hashtag|intent|share|jobs)(?=$|[/?]))\w{1,15}(?=$|[?])/, { text: /^@/ }],
    ] },
    'reddit.com': { item: 'shreddit-post, shreddit-comment, article', links: [
        ['post', /^reddit\.com\/r\/(\w+)\/comments\/\w+/, { up: m => `reddit.com/r/${m[1]}` }],
        ['user', /^reddit\.com\/(?:u|user)\/([\w-]+)/, { key: m => `reddit.com/user/${m[1]}` }],
        ['community', /^reddit\.com\/r\/\w+(?=$|[/?])/],
    ] },
    'github.com': { item: '.Box-row, .js-timeline-item, article, li', links: [
        ['post', /^github\.com\/([\w.-]+\/[\w.-]+)\/(?:issues|pull|discussions)\/\d+/, { up: m => `github.com/${m[1]}` }],
        ['repo', new RegExp(`^github\\.com\\/(?!(?:${GH_RESERVED})\\/)([\\w-]+)\\/[\\w.-]+(?=$|[?])`), { up: m => `github.com/${m[1]}` }],
        ['user', new RegExp(`^github\\.com\\/(?!(?:${GH_RESERVED})(?=$|[?]))[\\w-]+(?=$|[?])`)],
    ] },
    'youtube.com': { item: 'ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer, ytd-grid-video-renderer, yt-lockup-view-model, ytd-comment-thread-renderer, ytd-channel-renderer, ytd-playlist-renderer', links: [
        ['video', /^youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/)([\w-]{11})/, { key: m => `youtube.com/watch?v=${m[1]}` }],
        ['user', /^youtube\.com\/(@[^/?]+|channel\/[\w-]+|c\/[^/?]+|user\/[^/?]+)/],
    ] },
    'youtu.be': { links: [['video', /^youtu\.be\/([\w-]{11})/, { key: m => `youtube.com/watch?v=${m[1]}` }]] },
    'instagram.com': { item: 'article', links: [
        ['post', /^instagram\.com\/(?:[\w.]+\/)?(p|reel)\/([\w-]+)/, { key: m => `instagram.com/${m[1]}/${m[2]}` }],
        ['user', /^instagram\.com\/(?!(?:explore|reels|direct|accounts|stories|p|reel|about|legal|developer)(?=$|[/?]))[\w.]+(?=$|[/?])/],
    ] },
    // story links sit in the subtext row under the story's tr.athing, comment links inside it
    'news.ycombinator.com': { item: (a) => a.closest('tr.athing') || (a.closest('tr')?.previousElementSibling?.matches('tr.athing') && a.closest('tr').previousElementSibling), css: 'tr.athing[data-mark~="hide"] + tr { display: none !important; }', links: [
        ['post', /^news\.ycombinator\.com\/item\?id=\d+/],
        ['user', /^news\.ycombinator\.com\/user\?id=[\w-]+/],
    ] },
    'soundcloud.com': { item: '.soundList__item, .searchList__item, .userStreamItem, .trackList__item, .systemPlaylistTrackList__item', links: [
        ['post', new RegExp(`^soundcloud\\.com\\/(?!(?:${SC_RESERVED})\\/)([\\w-]+)\\/sets\\/[\\w-]+(?=$|[?])`), { up: m => `soundcloud.com/${m[1]}` }],
        ['track', new RegExp(`^soundcloud\\.com\\/(?!(?:${SC_RESERVED})\\/)([\\w-]+)\\/(?!(?:sets|tracks|albums|reposts|likes|followers|following|popular-tracks|comments|spotlight|toptracks)(?=$|[/?]))[\\w-]+(?=$|[?])`), { up: m => `soundcloud.com/${m[1]}` }],
        ['user', new RegExp(`^soundcloud\\.com\\/(?!(?:${SC_RESERVED})(?=$|[/?]))[\\w-]+(?=$|[?])`)],
    ] },
    'pinterest.com': { media: true, item: '[data-grid-item], [data-test-id="pin"]', links: [
        ['pin', /^pinterest\.com\/pin\/\d+/],
        ['user', /^pinterest\.com\/(?!(?:pin|search|ideas|today|settings|business|explore|login|news_hub|categories|videos|_|resource|homefeed|create|me)(?=$|[/?]))[\w.-]+(?=$|[?])/],
    ] },
    'civitai.com': { media: true, item: '.mantine-Card-root, article', links: [
        ['model', /^civitai\.com\/models\/\d+/],
        ['post', /^civitai\.com\/(?:images|posts)\/\d+/],
        ['user', /^civitai\.com\/user\/([\w.-]+)(?=$|[/?])/, { key: m => `civitai.com/user/${m[1]}` }],
    ] },
};
const ALIAS = { 'twitter.com': 'x.com', 'civitai.red': 'civitai.com' };
// Keys of these types are lowercased: the sites treat names case-insensitively. Post and video ids keep case.
const NOCASE = new Set(['user', 'community', 'repo']);
// Default effects by tag name. A tag's own effect setting on the tags page overrides these.
const BUILTIN_FX = { star: 'star', '★': 'star', dim: 'dim', ignore: 'dim', clickbait: 'dim', promotion: 'dim', sb: 'dim', hide: 'hide', block: 'hide' };
const FX_ICON = { star: '★', dim: '◐', hide: '⊘' };
const TYPE_ICON = { user: '@', post: '¶', video: '▶', repo: '⎇', community: '#', track: '♪', pin: '◆', model: '◇', link: '↗', page: '▣' };
const DELETED = '._DELETED_'; // utags marks removed entries with this tag; skipped on import
const TRACKING = /^(?:utm_|fbclid$|gclid$|si$|igsh$|ref_src$)/;

// 'https://www.reddit.com/r/foo/?x=1&utm_source=y#c' -> 'reddit.com/r/foo?x=1'
function norm(href) {
    let u;
    try { u = new URL(href); } catch { return ''; }
    if (!/^https?:$/.test(u.protocol)) return '';
    let host = u.hostname.toLowerCase().replace(/^(?:www|m|mobile|old|new)\./, '');
    if (/(?:^|\.)pinterest\.[a-z.]+$/.test(host)) host = 'pinterest.com';
    const drop = [...u.searchParams.keys()].filter(k => TRACKING.test(k));
    drop.forEach(k => u.searchParams.delete(k));
    // untouched queries keep their original encoding, so keys stay stable
    const search = drop.length ? (u.searchParams.size ? '?' + u.searchParams : '') : u.search;
    return (ALIAS[host] || host) + u.pathname.replace(/\/+$/, '') + search;
}
const hostOf = (n) => n.replace(/^https:\/\//, '').split(/[/?]/)[0];

// { key, type, up? } for a url a site rule knows, or null.
function match(href, text = '') {
    const n = norm(href);
    const site = SITES[hostOf(n)];
    for (const [type, re, o = {}] of site ? site.links : []) {
        const m = n.match(re);
        if (!m || (o.text && !o.text.test(text))) continue;
        const k = 'https://' + (o.key ? o.key(m) : m[0]);
        return { key: NOCASE.has(type) ? k.toLowerCase() : k, type, ...(o.up && { up: 'https://' + o.up(m).toLowerCase() }) };
    }
    return null;
}
// match(), or a plain 'link' for a url off the page's own site. Same-site links without a rule are navigation.
function linkMatch(href, text, pageHost) {
    const m = match(href, text);
    if (m) return m;
    const n = norm(href);
    return n && hostOf(n) !== pageHost ? { key: 'https://' + n, type: 'link' } : null;
}

// Store in the utags shape, so exports open in either script:
// { data: { <url>: { tags: [], meta: { title, type, created, updated, note? } } },
//   meta: { databaseVersion, colors: { tag: hue }, effects: { tag: 'star'|'dim'|'hide'|'' } } }
const STORE = 'mark.store';
let store;
const fresh = () => ({ data: {}, meta: { databaseVersion: 3 } });
// A store holding keys this script would not build (a utags import keeps www. and slashes) is rekeyed once.
const load = () => {
    store = GM_getValue(STORE) || fresh();
    if (Object.keys(store.data).some(k => rekey(k) !== k)) { const old = store; store = { ...old, data: {} }; merge(old); }
};
const commit = () => { GM_setValue(STORE, store); refresh(); };
const tagsOf = (key) => store.data[key]?.tags || [];

// Writes one entry; it stays while it has tags or a note.
function save(key, { tags, ...meta }) {
    const now = Date.now(), old = store.data[key];
    const m = { ...old?.meta, ...meta, created: old?.meta?.created || now, updated: now };
    if (!m.note) delete m.note;
    tags = tags ?? old?.tags ?? [];
    if (tags.length || m.note) store.data[key] = { tags, meta: m };
    else delete store.data[key];
    commit();
}
function tagCounts() {
    const c = new Map();
    for (const { tags } of Object.values(store.data)) for (const t of tags) c.set(t, (c.get(t) || 0) + 1);
    return [...c].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}
// Renaming onto an existing tag merges the two; the old tag's colour and effect move along unless the target has its own.
function renameTag(from, to) {
    for (const v of Object.values(store.data)) if (v.tags.includes(from)) v.tags = [...new Set(v.tags.map(t => t === from ? to : t))];
    for (const k of ['colors', 'effects']) {
        const o = store.meta[k];
        if (o && from in o) { if (!(to in o)) o[to] = o[from]; delete o[from]; }
    }
    commit();
}
function retag(keys, tag, add) {
    for (const k of keys) {
        const v = store.data[k];
        if (!v) continue;
        v.tags = add ? [...new Set([...v.tags, tag])] : v.tags.filter(t => t !== tag);
        if (!v.tags.length && !v.meta?.note) delete store.data[k];
    }
    commit();
}
const deleteTag = (t) => { retag(Object.keys(store.data), t, false); delete store.meta.colors?.[t]; delete store.meta.effects?.[t]; commit(); };
// The key this script builds for a stored url. '@' satisfies x's @handle rule; non-urls stay as they are.
const rekey = (k) => match(k, '@')?.key || (norm(k) ? 'https://' + norm(k) : k);
// Merges a utags or mark export, rekeyed: tag lists are unioned, the newer meta wins, tag settings fill gaps.
function merge(json) {
    const data = json?.data;
    if (!data || typeof data !== 'object') throw new Error('not a utags or mark export');
    let n = 0;
    for (let [key, v] of Object.entries(data)) {
        const tags = (v?.tags || []).filter(t => typeof t === 'string' && t && t !== DELETED);
        if ((v?.tags || []).includes(DELETED) || (!tags.length && !v?.meta?.note)) continue;
        key = rekey(key);
        const old = store.data[key];
        const meta = !old || (v.meta?.updated || 0) > (old.meta?.updated || 0) ? v.meta : old.meta;
        store.data[key] = { tags: [...new Set([...(old?.tags || []), ...tags])], meta: { ...meta } };
        n++;
    }
    for (const k of ['colors', 'effects']) if (json.meta?.[k]) store.meta[k] = { ...json.meta[k], ...store.meta[k] };
    commit();
    return n;
}
// Dotted versions compared numerically: 2.10 is newer than 2.9.
const newer = (a, b) => {
    const x = a.split('.').map(Number), y = b.split('.').map(Number);
    for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
    return false;
};
// Latest version from greasyfork's meta file; installing goes through tampermonkey's own page.
const META_URL = 'https://update.greasyfork.org/scripts/598296/mark.meta.js';
const latest = () => new Promise((ok, fail) => GM_xmlhttpRequest({
    method: 'GET', url: META_URL + '?t=' + Date.now(), timeout: 15000,
    onload: r => { const v = /@version\s+(\S+)/.exec(r.responseText); v ? ok(v[1]) : fail(new Error('no version in meta')); },
    onerror: () => fail(new Error('greasyfork unreachable')), ontimeout: () => fail(new Error('greasyfork timed out')),
}));

let undoSnap = null;
const snapshot = () => { undoSnap = JSON.stringify(store); };
const undo = () => { if (undoSnap) { store = JSON.parse(undoSnap); undoSnap = null; commit(); } };

const hue = (s) => [...s].reduce((a, c) => (a * 31 + c.codePointAt(0)) >>> 0, 7) % 360;
const hueOf = (t) => store.meta.colors?.[t] ?? hue(t);
const fxOf = (t) => { const e = store.meta.effects; return e && t in e ? e[t] : BUILTIN_FX[t.toLowerCase()] || ''; };
const effectsOf = (tags) => [...new Set(tags.map(fxOf).filter(Boolean))];

// DOM helper: no innerHTML, so page text never parses as markup and YouTube's trusted types stay happy.
function h(tag, props, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
        if (v == null || v === false) continue;
        if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
        else if (k in el && k !== 'style') el[k] = v;
        else el.setAttribute(k, v);
    }
    el.append(...kids(children));
    return el;
}
const kids = (list) => list.flat(Infinity).filter(k => k != null && k !== false);
const fill = (el, ...list) => el.replaceChildren(...kids(list));
const chip = (t, extra) => h('span', { className: 'mark-chip', style: `--h:${hueOf(t)}`, ...extra }, FX_ICON[fxOf(t)] ? `${FX_ICON[fxOf(t)]} ${t}` : t);
// Pill font from 11px for a tag used once up to 20px for the most used one.
const pillSize = (n, max) => (11 + 9 * Math.log1p(n) / Math.log1p(Math.max(max, 1))).toFixed(1) + 'px';

// Page pass: chips after tagged links, effect attributes on their list items.
let site = {}, pageHost = '';
const info = new WeakMap(); // link -> { href, m, title, chips, shown }
let marked = new Set();
function linkInfo(a) {
    let i = info.get(a);
    if (!i || i.href !== a.href) {
        const text = a.textContent.trim();
        const label = text || (site.media && (a.getAttribute('aria-label') || a.querySelector('img[alt]')?.alt || '').trim());
        // Image-only links (avatars, thumbnails) would double every chip, so only text links count unless the site is media.
        const ok = label && text.length < 300 && !a.closest('.mark-chips');
        i = { href: a.href, m: ok ? linkMatch(a.href, text, pageHost) : null, title: (label || '').slice(0, 160) };
        info.set(a, i);
    }
    return i;
}
function scan() {
    const items = new Map();
    for (const a of document.querySelectorAll('a[href]')) {
        const i = linkInfo(a);
        if (!i.m) continue;
        const own = tagsOf(i.m.key), note = store.data[i.m.key]?.meta?.note || '';
        const shown = own.map(t => t + hueOf(t) + fxOf(t)).join('\n') + '\n' + note;
        if (i.shown !== shown || (i.chips && !i.chips.isConnected)) {
            i.chips?.remove();
            i.chips = own.length || note ? h('span', { className: 'mark-chips', title: note || null, onclick: (e) => { e.preventDefault(); e.stopPropagation(); edit(a); } },
                own.map(t => chip(t)), note ? h('span', { className: 'mark-chip note' }, '✎') : null) : null;
            if (i.chips) a.after(i.chips);
            i.shown = shown;
        }
        const fx = effectsOf(i.m.up ? [...own, ...tagsOf(i.m.up)] : own);
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
const refresh = () => { if (!scanTimer && typeof document !== 'undefined') scanTimer = setTimeout(() => { scanTimer = 0; scan(); }, 300); };

const PAGE_CSS = `
.mark-chips { display: inline-flex; flex-wrap: wrap; gap: 3px; margin: 0 4px; vertical-align: middle; cursor: pointer; }
.mark-chip { font: 600 11px/17px system-ui, sans-serif; padding: 0 7px; border-radius: 9px; white-space: nowrap;
    background: hsl(var(--h) 80% 50% / .18); color: hsl(var(--h) 70% 45%); }
.mark-chip.note { background: #8882; color: #888; }
html:not(.mark-show-hidden) [data-mark~="hide"] { display: none !important; }
html.mark-show-hidden [data-mark~="hide"] { opacity: .25; }
[data-mark~="dim"] { opacity: .35; transition: opacity .15s; }
[data-mark~="dim"]:hover { opacity: 1; }
[data-mark~="star"] { box-shadow: inset 3px 0 #f5b301; background-color: rgb(245 179 1 / .08); }
`;

// UI lives in a shadow root: page css can't reach it and it can't reach the page.
const UI_CSS = `
:host { all: initial; }
* { box-sizing: border-box; font: 13px/1.4 system-ui, sans-serif; color: inherit; }
button { border: 0; background: none; cursor: pointer; padding: 0; }
input, textarea, select { border: 0; outline: 0; background: #ffffff0f; border-radius: 8px; padding: 6px 9px; }
input:focus, textarea:focus { outline: 1px solid #4b6bfb; }
.btn { position: fixed; z-index: 2147483647; width: 22px; height: 22px; border-radius: 50%;
    background: #222c; color: #fff; display: none; place-items: center; font-size: 12px; box-shadow: 0 1px 4px #0005; }
.btn.on { display: grid; }
.btn:hover { background: #4b6bfb; }
.pop, .lib { color: #e8e8ea; background: #1c1c20; }
.pop { position: fixed; z-index: 2147483647; width: 380px; padding: 12px; display: grid; gap: 9px;
    border: 1px solid #ffffff1a; border-radius: 12px; box-shadow: 0 12px 40px #0008; }
.title { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.type { display: inline-block; min-width: 16px; opacity: .55; margin-right: 6px; text-align: center; }
.mark-chip { font: 600 11px/18px system-ui, sans-serif; padding: 0 8px; border-radius: 10px; white-space: nowrap; cursor: pointer;
    background: hsl(var(--h) 80% 55% / .2); color: hsl(var(--h) 85% 74%); }
.mark-chip.x::after { content: ' ×'; opacity: .6; }
.on-row { display: flex; flex-wrap: wrap; gap: 4px; min-height: 18px; }
.cloud { display: flex; flex-wrap: wrap; gap: 4px 8px; align-items: baseline; max-height: 42vh; overflow: auto; padding: 2px; }
.pill { color: hsl(var(--h) 75% 72%); opacity: .5; padding: 0 3px; border-radius: 6px; line-height: 1.25; white-space: nowrap; font-weight: 600; }
.pill:hover { opacity: 1; background: hsl(var(--h) 80% 55% / .12); }
.pill.sel { opacity: 1; background: hsl(var(--h) 80% 55% / .25); }
.pill.new { color: #8ea2ff; opacity: .8; font-style: italic; }
.pill small { font-size: 10px; opacity: .6; margin-left: 2px; font-weight: 400; }
textarea { resize: vertical; min-height: 32px; width: 100%; }
.hint { font-size: 11px; opacity: .45; }
.lib { position: fixed; inset: 0; z-index: 2147483646; display: grid; grid-template-rows: auto auto 1fr auto; }
.lib > * { padding: 12px max(16px, calc(50vw - 520px)); }
.top { display: flex; gap: 10px; align-items: center; border-bottom: 1px solid #ffffff14; }
.top .search { flex: 1; font-size: 15px; padding: 9px 12px; }
.ib { opacity: .6; padding: 5px 8px; border-radius: 7px; white-space: nowrap; }
.ib:hover { opacity: 1; background: #ffffff14; }
.ib.on { opacity: 1; background: #4b6bfb; }
.lib .cloud { max-height: 30vh; border-bottom: 1px solid #ffffff14; }
.tagbar { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; background: #ffffff08; }
.tagbar input[type=range] { width: 140px; padding: 0; accent-color: hsl(var(--h) 80% 60%); }
.list { overflow: auto; padding-top: 4px; }
.item { display: grid; grid-template-columns: 22px 18px minmax(0, 1fr) auto auto; gap: 8px; align-items: center; padding: 4px 6px; border-radius: 7px; }
.item:hover { background: #ffffff0a; }
.item input { visibility: hidden; margin: 0; padding: 0; }
.item:hover input, .item input:checked, .list.picking .item input { visibility: visible; }
.item a { text-decoration: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.item a:hover { color: #8ea2ff; }
.item .chips { display: flex; gap: 3px; flex-wrap: wrap; justify-content: flex-end; }
.item .acts { display: flex; opacity: 0; }
.item:hover .acts { opacity: 1; }
.foot { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; border-top: 1px solid #ffffff14; }
.foot .grow { flex: 1; }
.bulk { background: #4b6bfb22; }
`;
let host, root, btn;

// Hover button: one shared button that follows the hovered taggable link.
let hovered = null, hideTimer = 0;
function showBtn(a) {
    clearTimeout(hideTimer);
    hovered = a;
    const r = a.getClientRects()[0] || a.getBoundingClientRect();
    // tall links are image cards: sit inside their top right corner instead of past the edge
    const inside = r.height > 60;
    btn.style.left = Math.min(innerWidth - 26, inside ? r.right - 28 : r.right + 4) + 'px';
    btn.style.top = Math.max(2, inside ? r.top + 6 : r.top + r.height / 2 - 11) + 'px';
    btn.classList.add('on');
}
const hideBtnSoon = () => { clearTimeout(hideTimer); hideTimer = setTimeout(() => { btn.classList.remove('on'); hovered = null; }, 500); };
const typing = (e) => { const t = e.composedPath()[0]; return t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName); };

// Editor: the entry's tags on top, then every known tag as a pill sized by use. Click toggles,
// typing filters, Enter adds what's typed, Tab picks the first pill. Every change saves at once.
let pop = null, popAnchor = null;
function closePop() { pop?.flush(); pop?.remove(); pop = null; removeEventListener('scroll', placePop, true); }
// A null anchor pins the editor to the top right (tagging the page itself).
function placePop() {
    if (!pop) return;
    if (!popAnchor) return Object.assign(pop.style, { top: '8px', left: Math.max(8, innerWidth - 392) + 'px' });
    if (!popAnchor.isConnected) return closePop();
    const r = popAnchor.getBoundingClientRect(), H = pop.offsetHeight;
    pop.style.left = Math.max(8, Math.min(innerWidth - 388, r.left)) + 'px';
    pop.style.top = (r.bottom + 6 + H > innerHeight && r.top > H + 6 ? r.top - H - 6 : Math.max(8, Math.min(innerHeight - H - 8, r.bottom + 6))) + 'px';
}
function edit(anchor, entry) {
    const { key, type, title } = entry || { ...linkInfo(anchor).m, title: linkInfo(anchor).title };
    closePop();
    btn.classList.remove('on');
    let tags = [...tagsOf(key)];
    const base = () => ({ title: store.data[key]?.meta?.title || title, type });
    const put = (patch) => save(key, { ...base(), tags, ...patch });
    const known = (q) => tagCounts().find(([t]) => t.toLowerCase() === q.toLowerCase())?.[0];
    const add = (t) => { if (!tags.includes(t)) tags.push(t); input.value = ''; put(); draw(); };
    const toggle = (t) => { tags = tags.includes(t) ? tags.filter(x => x !== t) : [...tags, t]; put(); draw(); };
    const typed = () => input.value.trim().replace(/\s+/g, ' ');
    const filtered = () => { const q = typed().toLowerCase(); return tagCounts().filter(([t]) => !q || t.toLowerCase().includes(q)); };
    const input = h('input', { placeholder: 'filter or new tag', oninput: () => draw(), onkeydown: (e) => {
        e.stopPropagation(); // keep the page's own shortcuts out of the field
        const q = typed();
        if (e.key === 'Escape') return closePop();
        if (e.key === 'Enter') { e.preventDefault(); q ? add(known(q) || q) : closePop(); }
        else if (e.key === 'Tab' && q) { e.preventDefault(); const f = filtered()[0]; f ? (toggle(f[0]), input.value = '', draw()) : add(q); }
        else if (e.key === 'Backspace' && !input.value && tags.length) { tags.pop(); put(); draw(); }
    } });
    let noteTimer = 0;
    const note = h('textarea', { rows: 1, placeholder: 'note', value: store.data[key]?.meta?.note || '', onkeydown: (e) => { e.stopPropagation(); if (e.key === 'Escape') closePop(); },
        oninput: () => { clearTimeout(noteTimer); noteTimer = setTimeout(flush, 400); } });
    const flush = () => { clearTimeout(noteTimer); if (note.value.trim() !== (store.data[key]?.meta?.note || '')) put({ note: note.value.trim() }); };
    const onRow = h('div', { className: 'on-row' }), cloud = h('div', { className: 'cloud' });
    function draw() {
        fill(onRow, ...(tags.length ? tags.map(t => chip(t, { className: 'mark-chip x', title: 'remove', onclick: () => toggle(t) })) : [h('span', { className: 'hint' }, 'no tags yet')]));
        const list = filtered(), max = tagCounts()[0]?.[1] || 1, q = typed();
        fill(cloud, ...list.map(([t, n]) => h('button', { className: `pill${tags.includes(t) ? ' sel' : ''}`, style: `--h:${hueOf(t)};font-size:${pillSize(n, max)}`, title: `${n} tagged`, onclick: () => toggle(t) },
            FX_ICON[fxOf(t)] ? FX_ICON[fxOf(t)] + ' ' : '', t)),
            q && !known(q) ? h('button', { className: 'pill new', onclick: () => add(q) }, `+ ${q}`) : null);
        placePop();
    }
    pop = h('div', { className: 'pop' },
        h('div', { className: 'title', title: key }, h('span', { className: 'type', title: type }, TYPE_ICON[type] || '·'), title || key),
        onRow, input, cloud, note,
        h('div', { className: 'hint' }, 'click toggles | enter adds | tab picks first | ⌫ removes last | esc closes'));
    pop.flush = flush;
    popAnchor = anchor;
    root.append(pop);
    draw();
    addEventListener('scroll', placePop, true);
    input.focus();
}

// Tags page: full-tab overlay. Tag cloud on top; clicking tags filters the entries below (all
// picked tags must match). With exactly one tag picked, the tag bar renames, recolours, sets its
// effect or deletes it. Rows pick with checkboxes (shift extends) for the bulk bar.
let lib = null;
function closeLib() { lib?.remove(); lib = null; closePop(); document.documentElement.style.overflow = ''; }
function openLib() {
    if (lib) return closeLib();
    const picked = new Set(), checked = new Set();
    let lastChecked = null, msg = '';
    const search = h('input', { className: 'search', placeholder: 'search titles, urls, notes', oninput: () => draw(), onkeydown: (e) => { e.stopPropagation(); if (e.key === 'Escape') closeLib(); } });
    const cloud = h('div', { className: 'cloud' }), tagbar = h('div', { className: 'tagbar' }), list = h('div', { className: 'list' }), foot = h('div', { className: 'foot' });
    const bulkIn = h('input', { placeholder: 'tag', onkeydown: (e) => { e.stopPropagation(); if (e.key === 'Enter') bulk(true); } });
    const file = h('input', { type: 'file', accept: '.json,application/json', style: 'display:none', onchange: async () => {
        try { msg = `imported ${merge(JSON.parse(await file.files[0].text()))} entries`; } catch (err) { msg = 'import failed: ' + err.message; }
        file.value = '';
        draw();
    } });
    const act = (fn) => () => { snapshot(); fn(); draw(); };
    function bulk(add) {
        const t = bulkIn.value.trim();
        if (!t || !checked.size) return;
        act(() => retag(checked, t, add))();
        bulkIn.value = '';
    }
    const rows = () => {
        const words = search.value.toLowerCase().split(/\s+/).filter(Boolean);
        return Object.entries(store.data)
            .filter(([k, v]) => [...picked].every(t => v.tags.includes(t))
                && words.every(w => (k + ' ' + (v.meta?.title || '') + ' ' + (v.meta?.note || '') + ' ' + v.tags.join(' ')).toLowerCase().includes(w)))
            .sort((a, b) => (b[1].meta?.updated || 0) - (a[1].meta?.updated || 0));
    };
    function drawTagbar() {
        const [t] = picked.size === 1 ? picked : [];
        if (!t) return fill(tagbar, h('span', { className: 'hint' }, picked.size ? `${picked.size} tags picked | entries carry all of them` : 'click tags to filter | pick one to rename, colour, set its effect or delete it'));
        tagbar.style.setProperty('--h', hueOf(t));
        fill(tagbar,
            chip(t),
            h('input', { value: t, title: 'rename | an existing name merges', onkeydown: (e) => { e.stopPropagation(); if (e.key === 'Enter') e.target.blur(); },
                onchange: (e) => { const to = e.target.value.trim(); if (to && to !== t) { act(() => renameTag(t, to))(); picked.clear(); picked.add(to); draw(); } } }),
            h('input', { type: 'range', min: 0, max: 359, value: hueOf(t), title: 'colour',
                oninput: (e) => { (store.meta.colors ||= {})[t] = +e.target.value; tagbar.style.setProperty('--h', e.target.value); drawCloud(); },
                onchange: () => { commit(); draw(); } }),
            ...['', 'star', 'dim', 'hide'].map(f => h('button', { className: `ib${fxOf(t) === f ? ' on' : ''}`, title: f ? `entries tagged ${t} get ${f}` : 'plain label',
                onclick: () => { (store.meta.effects ||= {})[t] = f; commit(); draw(); } }, f ? `${FX_ICON[f]} ${f}` : 'label')),
            h('span', { className: 'grow' }),
            h('button', { className: 'ib', onclick: () => { [...picked].forEach(x => rows().forEach(([k]) => checked.add(k))); draw(); } }, 'select its entries'),
            h('button', { className: 'ib', onclick: act(() => { deleteTag(t); picked.clear(); }) }, 'delete tag'));
    }
    function drawCloud() {
        const counts = tagCounts(), max = counts[0]?.[1] || 1;
        fill(cloud, ...counts.map(([t, n]) => h('button', { className: `pill${picked.has(t) ? ' sel' : ''}`, style: `--h:${hueOf(t)};font-size:${pillSize(n, max)}`,
            onclick: () => { picked.has(t) ? picked.delete(t) : picked.add(t); draw(); } }, FX_ICON[fxOf(t)] ? FX_ICON[fxOf(t)] + ' ' : '', t, h('small', {}, n))),
            counts.length ? null : h('span', { className: 'hint' }, 'nothing tagged yet | hover a link and press t'));
    }
    function draw() {
        drawCloud();
        drawTagbar();
        const all = rows(), shown = all.slice(0, 500);
        list.classList.toggle('picking', checked.size > 0);
        fill(list, ...shown.map(([key, v], i) => h('div', { className: 'item', title: [key, v.meta?.note].filter(Boolean).join('\n') },
            h('input', { type: 'checkbox', checked: checked.has(key), onclick: (e) => {
                const on = e.target.checked;
                // shift-click sets the whole run since the last click
                const j = lastChecked == null || !e.shiftKey ? i : lastChecked;
                for (let x = Math.min(i, j); x <= Math.max(i, j); x++) on ? checked.add(shown[x][0]) : checked.delete(shown[x][0]);
                lastChecked = i;
                draw();
            } }),
            h('span', { className: 'type', title: v.meta?.type || '' }, TYPE_ICON[v.meta?.type] || '·'),
            h('a', { href: key, target: '_blank' }, v.meta?.title || key.replace(/^https:\/\//, '')),
            h('div', { className: 'chips' }, v.tags.map(t => chip(t, { onclick: () => { picked.add(t); draw(); } })), v.meta?.note ? h('span', { className: 'mark-chip note' }, '✎') : null),
            h('div', { className: 'acts' },
                h('button', { className: 'ib', title: 'edit', onclick: (e) => edit(e.currentTarget, { key, type: v.meta?.type, title: v.meta?.title }) }, '✎'),
                h('button', { className: 'ib', title: 'delete', onclick: act(() => { delete store.data[key]; checked.delete(key); commit(); }) }, '✕')))),
            all.length > shown.length ? h('div', { className: 'hint' }, `${all.length - shown.length} more | narrow the search`) : null);
        foot.className = 'foot' + (checked.size ? ' bulk' : '');
        fill(foot, ...(checked.size ? [
            h('span', {}, `${checked.size} selected`), bulkIn,
            h('button', { className: 'ib', onclick: () => bulk(true) }, '+ add tag'),
            h('button', { className: 'ib', onclick: () => bulk(false) }, '− remove tag'),
            h('button', { className: 'ib', onclick: act(() => { checked.forEach(k => delete store.data[k]); checked.clear(); commit(); }) }, 'delete'),
            h('span', { className: 'grow' }),
            h('button', { className: 'ib', onclick: () => { checked.clear(); draw(); } }, 'clear'),
        ] : [
            h('span', { className: 'hint grow' }, msg || `${all.length} of ${Object.keys(store.data).length}`),
            h('button', { className: 'ib', onclick: () => { all.forEach(([k]) => checked.add(k)); draw(); } }, 'select all shown'),
            h('button', { className: 'ib', onclick: () => { closeLib(); tagPage(); } }, 'tag this page'),
            h('button', { className: `ib${GM_getValue('mark.showHidden', false) ? ' on' : ''}`, onclick: () => { setShowHidden(!GM_getValue('mark.showHidden', false)); draw(); } }, 'show hidden'),
            h('button', { className: 'ib', onclick: exportJson }, 'export'),
            h('button', { className: 'ib', onclick: () => file.click() }, 'import'), file,
        ]), undoSnap ? h('button', { className: 'ib', onclick: () => { undo(); draw(); } }, 'undo') : null);
        msg = '';
    }
    const updateBtn = h('button', { className: 'ib', title: 'check greasyfork for a new version', onclick: async () => {
        const mine = GM_info.script.version;
        try {
            const v = await latest();
            if (!newer(v, mine)) { updateBtn.textContent = 'update'; msg = `${mine} is the latest`; return draw(); }
            msg = `installing ${v} | reload the page after`;
            GM_openInTab(GM_info.script.downloadURL || META_URL.replace('.meta.js', '.user.js'), { active: true });
        } catch (e) { msg = 'update check failed: ' + e.message; }
        draw();
    } }, 'update');
    latest().then(v => { if (newer(v, GM_info.script.version)) updateBtn.textContent = `update ${v}`; }).catch(() => {});
    lib = h('div', { className: 'lib' },
        h('div', { className: 'top' }, h('b', {}, 'mark'), search, updateBtn, h('button', { className: 'ib', title: 'close (esc)', onclick: closeLib }, '✕')),
        h('div', {}, cloud, tagbar), list, foot);
    lib.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !pop) closeLib(); });
    root.append(lib);
    document.documentElement.style.overflow = 'hidden';
    draw();
    search.focus();
}
function tagPage() {
    const m = match(location.href) || { key: 'https://' + norm(location.href), type: 'page' };
    edit(null, { ...m, title: document.title });
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
    pageHost = hostOf(norm(location.href));
    site = SITES[pageHost] || {};
    host = h('div', { id: 'mark-ui' });
    root = host.attachShadow({ mode: 'closed' });
    btn = h('button', { className: 'btn', title: 'tag (t)', onclick: () => hovered && edit(hovered), onmouseenter: () => clearTimeout(hideTimer), onmouseleave: hideBtnSoon }, '🏷');
    root.append(h('style', {}, UI_CSS), btn);
    GM_addStyle(PAGE_CSS + (site.css || ''));
    document.documentElement.append(host);
    setShowHidden(GM_getValue('mark.showHidden', false));

    document.addEventListener('mouseover', (e) => {
        const a = e.target.closest?.('a[href]');
        if (a && !lib && linkInfo(a).m) showBtn(a);
        else if (hovered && !btn.matches(':hover')) hideBtnSoon();
    }, true);
    // A closed shadow root hides its nodes from document listeners, so inside clicks are told apart in the root.
    document.addEventListener('mousedown', (e) => { if (pop && !e.composedPath().includes(host)) closePop(); }, true);
    root.addEventListener('mousedown', (e) => { if (pop && !e.composedPath().includes(pop)) closePop(); });
    document.addEventListener('keydown', (e) => {
        if (e.altKey && e.shiftKey && e.code === 'KeyT') { e.preventDefault(); openLib(); return; }
        if (e.key === 't' && !e.ctrlKey && !e.metaKey && !e.altKey && hovered && !typing(e) && !e.composedPath().includes(host)) { e.preventDefault(); e.stopPropagation(); edit(hovered); }
    }, true);

    GM_registerMenuCommand('mark', openLib);
    // Other tabs saving: pick up their store so every tab shows the same tags.
    GM_addValueChangeListener(STORE, (k, o, v, remote) => { if (remote) { store = v || fresh(); refresh(); } });

    new MutationObserver((ms) => { if (ms.some(m => m.target !== host && !m.target.closest?.('.mark-chips'))) refresh(); })
        .observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['href'] });
    scan();
}

if (typeof module !== 'undefined') module.exports = { newer, norm, load, match, linkMatch, merge, effectsOf, renameTag, retag, deleteTag, save, _setStore: (s) => { store = s; }, _store: () => store.data };
else main();
