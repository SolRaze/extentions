// ==UserScript==
// @name         hoard
// @namespace    https://github.com/SolRaze/extentions/tree/main/userscript/hoard
// @version      1.0.1
// @description  instagram saved library, sorter, downloader, collection organizer
// @author       SolRaze
// @homepageURL  https://github.com/SolRaze/extentions
// @supportURL   https://github.com/SolRaze/extentions/issues
// @license      MIT
// @match        https://www.instagram.com/*
// @noframes
// @run-at       document-idle
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_download
// @grant        GM_registerMenuCommand
// @connect      cdninstagram.com
// @connect      fbcdn.net
// @downloadURL https://update.greasyfork.org/scripts/598006/hoard.user.js
// @updateURL https://update.greasyfork.org/scripts/598006/hoard.meta.js
// ==/UserScript==

// Reads the saved feed through the same /api/v1 endpoints the web app calls, with the tab's own
// session, and shows it in a full-screen library that covers the rest of Instagram.

const AUTHOR_W = 3;          // one post by the same author in a collection weighs this many shared hashtags
const PAGE_DELAY = 1500;     // ms between feed pages
const DL_DELAY = 800;        // ms between downloaded posts
const WRITE_DELAY = 2500;    // ms between collection writes

// Pure helpers (exported for selftest.js)
const tagsOf = (text) => [...new Set((String(text).match(/#[\p{L}\p{N}_]+/gu) || []).map(t => t.toLowerCase()))];

const extOf = (url) => {
    const m = /\.(\w{2,4})$/.exec(new URL(url).pathname);
    return m ? m[1].toLowerCase() : 'jpg';
};

const pickUrl = (x) => x.video_versions?.[0]?.url || x.image_versions2?.candidates?.[0]?.url || '';

// Media ids are "<pk>_<owner>" strings; the numeric pk overflows a JS number, so it is never used.
function normalize(m, order) {
    const parts = m.carousel_media?.length ? m.carousel_media : [m];
    const cands = parts[0].image_versions2?.candidates || [];
    const caption = m.caption?.text || '';
    return {
        id: String(m.id), code: m.code, user: m.user?.username || '', order,
        taken: m.taken_at || 0, likes: m.like_count || 0, caption, tags: tagsOf(caption),
        type: m.media_type === 8 ? 'album' : m.media_type === 2 ? (m.product_type === 'clips' ? 'reel' : 'video') : 'photo',
        // candidates run largest first: the last one still 320px wide is the grid thumbnail
        thumb: (cands.filter(c => c.width >= 320).pop() || cands[0] || {}).url || '',
        files: parts.map(pickUrl).filter(Boolean),
        cols: [],
    };
}

const SORTS = {
    saved:  (a, b) => a.order - b.order,
    newest: (a, b) => b.taken - a.taken,
    oldest: (a, b) => a.taken - b.taken,
    user:   (a, b) => a.user.localeCompare(b.user) || a.order - b.order,
    likes:  (a, b) => b.likes - a.likes,
};
const sortItems = (items, key) => [...items].sort(SORTS[key] || SORTS.saved);

// col '' = everything, '-' = in no collection
function filterItems(items, { col = '', type = '', q = '' } = {}) {
    q = q.toLowerCase();
    return items.filter(it =>
        (!col || (col === '-' ? !it.cols.length : it.cols.includes(col))) &&
        (!type || it.type === type) &&
        (!q || it.user.toLowerCase().includes(q) || it.caption.toLowerCase().includes(q)));
}

const safe = (s) => String(s).replace(/[\\/:*?"<>|\x00-\x1f]+/g, '_').replace(/^\.+/, '').trim().slice(0, 80) || '_';
const fileName = (it, i, url, folder) =>
    `instagram/${safe(folder)}/${safe(it.user)}_${it.code}${it.files.length > 1 ? `_${i + 1}` : ''}.${extOf(url)}`;

// Posts in no collection are matched against the existing ones: every post of the same author
// already there scores AUTHOR_W, every shared hashtag scores once per post carrying it.
// What no collection claims clusters into new ones — by author first, then by commonest hashtag.
function suggest(items, cols, { minScore = 3, minNew = 3 } = {}) {
    const bump = (m, k) => m.set(k, (m.get(k) || 0) + 1);
    const stats = new Map(cols.map(c => [c.id, { users: new Map(), tags: new Map() }]));
    for (const it of items) for (const c of it.cols) {
        const s = stats.get(c);
        if (!s) continue;
        bump(s.users, it.user);
        it.tags.forEach(t => bump(s.tags, t));
    }

    const moves = [], rest = [];
    for (const it of items) {
        if (it.cols.length) continue;
        let best = null;
        for (const [col, s] of stats) {
            const score = AUTHOR_W * (s.users.get(it.user) || 0) + it.tags.reduce((n, t) => n + (s.tags.get(t) || 0), 0);
            if (score >= minScore && (!best || score > best.score)) best = { item: it, col, score };
        }
        if (best) moves.push(best); else rest.push(it);
    }

    const names = new Set(cols.map(c => c.name.toLowerCase()));
    const claimed = new Set();
    const fresh = [];
    const cluster = (keysOf) => {
        const g = new Map();
        for (const it of rest) if (!claimed.has(it)) for (const k of keysOf(it)) (g.get(k) || g.set(k, []).get(k)).push(it);
        for (const [name, list] of [...g].sort((a, b) => b[1].length - a[1].length)) {
            const left = list.filter(it => !claimed.has(it));
            if (left.length < minNew || names.has(name.toLowerCase())) continue;
            names.add(name.toLowerCase());
            fresh.push({ name, items: left });
            left.forEach(it => claimed.add(it));
        }
    };
    cluster(it => [it.user]);
    cluster(it => it.tags.map(t => t.slice(1)));
    return { moves, fresh };
}

if (typeof module !== 'undefined') module.exports = { tagsOf, extOf, normalize, sortItems, filterItems, safe, fileName, suggest };
else main();

function main() {
    const LIB_KEY = 'hoard.lib';
    const DONE_KEY = 'hoard.done';
    const APP_ID = '936619743392459';
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    const csrf = () => (document.cookie.match(/(?:^|; )csrftoken=([^;]+)/) || [])[1] || '';

    async function api(path, form) {
        const res = await fetch('/api/v1/' + path, {
            method: form ? 'POST' : 'GET',
            credentials: 'include',
            headers: {
                'X-IG-App-ID': APP_ID,
                'X-Requested-With': 'XMLHttpRequest',
                'X-CSRFToken': csrf(),
                ...(form && { 'Content-Type': 'application/x-www-form-urlencoded' }),
            },
            body: form ? new URLSearchParams(form) : undefined,
        });
        if (!res.ok) throw new Error(`${path} ${res.status}`);
        return res.json();
    }

    async function pages(path, onItems) {
        let max = '';
        do {
            const d = await api(path + (max ? (path.includes('?') ? '&' : '?') + 'max_id=' + encodeURIComponent(max) : ''));
            onItems(d.items || []);
            max = d.more_available ? d.next_max_id : '';
            if (max) await sleep(PAGE_DELAY);
        } while (max);
    }

    let lib = GM_getValue(LIB_KEY, null);
    const view = { col: '', type: '', q: '', sort: 'saved' };
    const colName = (id) => lib.cols.find(c => c.id === id)?.name || id;

    GM_addStyle(`
        #hoard { position: fixed; inset: 0; z-index: 2147483000; background: #0b0b0c; color: #ddd;
                 font: 13px/1.4 -apple-system, system-ui, sans-serif; display: flex; flex-direction: column; }
        #hoard[hidden], #hoard-view[hidden] { display: none; }
        #hoard .bar { display: flex; gap: 6px; align-items: center; padding: 8px 10px; border-bottom: 1px solid #222; flex-wrap: wrap; }
        #hoard button, #hoard select, #hoard input { background: #1a1a1d; color: #ddd; border: 1px solid #333; border-radius: 6px; padding: 4px 8px; font: inherit; }
        #hoard button:hover { background: #26262a; }
        #hoard .status { margin-left: auto; opacity: .7; }
        #hoard .body { flex: 1; overflow: auto; padding: 10px; }
        #hoard .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 6px; }
        #hoard .tile { position: relative; aspect-ratio: 1; background: #151517; cursor: pointer; overflow: hidden; border-radius: 4px; }
        #hoard .tile img { width: 100%; height: 100%; object-fit: cover; }
        #hoard .tile span { position: absolute; left: 4px; bottom: 4px; background: #000a; padding: 1px 5px; border-radius: 4px; font-size: 11px; }
        #hoard .tile.done::after { content: '✓'; position: absolute; top: 4px; right: 6px; }
        #hoard .row { display: flex; gap: 8px; align-items: center; padding: 3px 0; }
        #hoard .row img { width: 40px; height: 40px; object-fit: cover; border-radius: 3px; }
        #hoard h3 { margin: 12px 0 6px; font-size: 13px; }
        #hoard-view { position: fixed; inset: 0; z-index: 2147483001; background: #000d; display: flex; overflow: auto; padding: 20px; gap: 16px; }
        #hoard-view .media { flex: 1; display: flex; flex-direction: column; gap: 8px; align-items: center; }
        #hoard-view .media img, #hoard-view .media video { max-width: 100%; max-height: 85vh; }
        #hoard-view .side { width: 320px; color: #ddd; white-space: pre-wrap; font: 13px/1.4 system-ui; }
        #hoard-view a { color: #8ab4ff; }
        #hoard-pill { position: fixed; left: 10px; bottom: 10px; z-index: 2147482999; background: #1a1a1d; color: #ddd;
                      border: 1px solid #333; border-radius: 12px; padding: 3px 10px; font: 12px system-ui; cursor: pointer; }
    `);

    const h = (tag, props = {}, ...kids) => {
        const el = Object.assign(document.createElement(tag), props);
        el.append(...kids.filter(k => k != null));
        return el;
    };

    const root = h('div', { id: 'hoard', hidden: true });
    const viewer = h('div', { id: 'hoard-view', hidden: true });
    const statusEl = h('span', { className: 'status' });
    const body = h('div', { className: 'body' });
    const status = (t) => { statusEl.textContent = t; };

    const colSel = h('select', { onchange: () => { view.col = colSel.value; render(); } });
    const typeSel = h('select', { onchange: () => { view.type = typeSel.value; render(); } },
        ...['', 'photo', 'album', 'video', 'reel'].map(v => h('option', { value: v, textContent: v || 'all types' })));
    const sortSel = h('select', { onchange: () => { view.sort = sortSel.value; render(); } },
        ...Object.keys(SORTS).map(v => h('option', { value: v, textContent: v })));
    const search = h('input', { placeholder: 'user or caption', oninput: () => { view.q = search.value; render(); } });

    root.append(
        h('div', { className: 'bar' },
            h('button', { textContent: 'refresh', onclick: () => run(load) }),
            colSel, typeSel, sortSel, search,
            h('button', { textContent: 'download shown', onclick: () => run(() => download(shown())) }),
            h('button', { textContent: 'organize', onclick: organize }),
            statusEl,
            h('button', { textContent: '✕', onclick: close })),
        body);
    document.body.append(root, viewer,
        h('button', { id: 'hoard-pill', textContent: 'hoard', onclick: open }));

    let busy = false;
    async function run(task) {
        if (busy) return;
        busy = true;
        try { await task(); } catch (e) { status('error: ' + e.message); console.error('[hoard]', e); }
        busy = false;
    }

    async function load() {
        const cols = [];
        await pages('collections/list/?collection_types=' + encodeURIComponent('["MEDIA"]'),
            batch => batch.forEach(c => cols.push({ id: String(c.collection_id), name: c.collection_name })));
        const items = [];
        await pages('feed/saved/posts/', batch => {
            batch.forEach(x => x.media && items.push(normalize(x.media, items.length)));
            status(`saved ${items.length}`);
        });
        const byId = new Map(items.map(it => [it.id, it]));
        for (const [i, c] of cols.entries()) {
            status(`collection ${i + 1}/${cols.length} ${c.name}`);
            await pages(`feed/collection/${c.id}/posts/`, batch => batch.forEach(x => byId.get(String(x.media?.id))?.cols.push(c.id)));
        }
        lib = { items, cols, at: Date.now() };
        GM_setValue(LIB_KEY, lib);
        render();
    }

    const shown = () => sortItems(filterItems(lib?.items || [], view), view.sort);

    function render() {
        const cur = view.col;
        colSel.replaceChildren(
            h('option', { value: '', textContent: 'all saved' }),
            h('option', { value: '-', textContent: 'no collection' }),
            ...(lib?.cols || []).map(c => h('option', { value: c.id, textContent: c.name })));
        colSel.value = cur;
        if (!lib) { body.replaceChildren('no library yet — hit refresh'); return; }
        const done = new Set(GM_getValue(DONE_KEY, []));
        const list = shown();
        status(`${list.length} shown · ${lib.items.length} saved · ${new Date(lib.at).toLocaleString()}`);
        body.replaceChildren(h('div', { className: 'grid' }, ...list.map(it =>
            h('div', { className: 'tile' + (done.has(it.code) ? ' done' : ''), onclick: () => show(it) },
                h('img', { src: it.thumb, loading: 'lazy', referrerPolicy: 'no-referrer' }),
                h('span', { textContent: `@${it.user}${it.type === 'photo' ? '' : ' · ' + it.type}` })))));
    }

    function show(it) {
        viewer.replaceChildren(
            h('div', { className: 'media' }, ...it.files.map(url => /\.mp4$/i.test(new URL(url).pathname)
                ? h('video', { src: url, controls: true, loop: true })
                : h('img', { src: url, referrerPolicy: 'no-referrer' }))),
            h('div', { className: 'side' },
                h('a', { href: `/p/${it.code}/`, target: '_blank', textContent: `@${it.user} · open post` }),
                `\n${it.taken ? new Date(it.taken * 1000).toLocaleDateString() : ''} · ${it.likes} likes`,
                `\n${it.cols.map(colName).join(', ') || 'no collection'}\n\n${it.caption}\n\n`,
                h('button', { textContent: 'download', onclick: () => run(() => download([it], true)) })));
        viewer.hidden = false;
    }
    viewer.addEventListener('click', e => { if (e.target === viewer) viewer.hidden = true; });

    const gmDownload = (url, name) => new Promise((ok, fail) => GM_download({
        url, name, onload: ok,
        onerror: e => fail(new Error(e?.error || 'failed')),
        ontimeout: () => fail(new Error('timeout')),
    }));

    // Folder is the collection being viewed, else the post's first collection, else "saved".
    // Posts already downloaded are skipped unless forced.
    async function download(list, force = false) {
        const done = new Set(GM_getValue(DONE_KEY, []));
        const folderOf = (it) => view.col && view.col !== '-' ? colName(view.col) : it.cols[0] ? colName(it.cols[0]) : 'saved';
        let n = 0, failed = 0;
        for (const it of list) {
            n++;
            if (done.has(it.code) && !force) continue;
            try {
                for (const [i, url] of it.files.entries()) await gmDownload(url, fileName(it, i, url, folderOf(it)));
                done.add(it.code);
                GM_setValue(DONE_KEY, [...done]);
            } catch (e) {
                failed++;
                console.warn('[hoard]', it.code, e.message);
            }
            status(`download ${n}/${list.length}${failed ? ` · ${failed} failed (stale urls → refresh)` : ''}`);
            await sleep(DL_DELAY);
        }
        render();
    }

    function organize() {
        if (!lib) return;
        const { moves, fresh } = suggest(lib.items, lib.cols);
        const moveRows = moves.map(m => ({ m, box: h('input', { type: 'checkbox', checked: true }) }));
        const freshRows = fresh.map(f => ({ f, box: h('input', { type: 'checkbox', checked: true }), name: h('input', { value: f.name }) }));
        body.replaceChildren(
            h('button', { textContent: '← library', onclick: render }), ' ',
            h('button', { textContent: 'apply checked', onclick: () => run(() => apply(
                moveRows.filter(r => r.box.checked).map(r => r.m),
                freshRows.filter(r => r.box.checked && r.name.value.trim()).map(r => ({ ...r.f, name: r.name.value.trim() })))) }),
            h('h3', { textContent: `into existing collections · ${moves.length}` }),
            ...moveRows.map(({ m, box }) => h('label', { className: 'row' }, box,
                h('img', { src: m.item.thumb, referrerPolicy: 'no-referrer' }),
                `@${m.item.user} → ${colName(m.col)} (score ${m.score})`)),
            h('h3', { textContent: `new collections · ${fresh.length}` }),
            ...freshRows.map(({ f, box, name }) => h('label', { className: 'row' }, box, name,
                `${f.items.length} posts`, ...f.items.slice(0, 8).map(it => h('img', { src: it.thumb, referrerPolicy: 'no-referrer' })))));
        status(`${lib.items.filter(it => !it.cols.length).length} posts in no collection`);
    }

    async function apply(moves, fresh) {
        let n = 0;
        const total = moves.length + fresh.length;
        for (const m of moves) {
            await api(`media/${m.item.id}/save/`, { added_collection_ids: JSON.stringify([m.col]) });
            m.item.cols.push(m.col);
            GM_setValue(LIB_KEY, lib);
            status(`apply ${++n}/${total}`);
            await sleep(WRITE_DELAY);
        }
        for (const f of fresh) {
            const r = await api('collections/create/', {
                name: f.name,
                added_media_ids: JSON.stringify(f.items.map(it => it.id)),
                module_name: 'collection_create',
            });
            const id = String(r.collection_id);
            lib.cols.push({ id, name: f.name });
            f.items.forEach(it => it.cols.push(id));
            GM_setValue(LIB_KEY, lib);
            status(`apply ${++n}/${total}`);
            await sleep(WRITE_DELAY);
        }
        organize();
    }

    function open() {
        root.hidden = false;
        document.documentElement.style.overflow = 'hidden';
        render();
    }
    function close() {
        root.hidden = true;
        viewer.hidden = true;
        document.documentElement.style.overflow = '';
    }
    document.addEventListener('keydown', e => {
        if (e.key !== 'Escape' || root.hidden) return;
        if (!viewer.hidden) viewer.hidden = true; else close();
    });
    GM_registerMenuCommand('open hoard', open);
}
