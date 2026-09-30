// ==UserScript==
// @name         hoard
// @namespace    https://github.com/SolRaze/extentions/tree/main/userscript/hoard
// @version      1.3.3
// @description  instagram saved collections as an offline reference library, synced to disk
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
// @namespace stays the old repo url: tampermonkey keys a script and its storage by name + namespace,
// so a new one installs a second copy with an empty library.

// Reads the saved feed through the same /api/v1 endpoints the web app calls, with the tab's own
// session, and shows it in a full-screen library that covers the rest of Instagram. Sync writes
// every post once into Downloads/reference/<collection>/ and rewrites reference/index.html, a
// self-contained offline viewer with the library data inlined — file:// pages cannot fetch JSON.

const PAGE_DELAY = 1500;  // ms between feed pages
const DL_DELAY = 800;     // ms between downloaded posts

// Pure helpers (exported for selftest.js)
const extOf = (url) => {
    const m = /\.(\w{2,4})$/.exec(new URL(url).pathname);
    return m ? m[1].toLowerCase() : 'jpg';
};

// Largest rendition the API offers: video over its poster, else the first image candidate.
const pickFile = (x) => {
    const v = x.video_versions?.[0];
    const i = x.image_versions2?.candidates?.[0];
    const f = v || i;
    return f?.url ? { url: f.url, video: !!v, w: f.width || 0, h: f.height || 0 } : null;
};

// Media ids are "<pk>_<owner>" strings; the numeric pk overflows a JS number, so it is never used.
function normalize(m, order) {
    const parts = m.carousel_media?.length ? m.carousel_media : [m];
    const cands = parts[0].image_versions2?.candidates || [];
    return {
        id: String(m.id), code: m.code, order,
        user: m.user?.username || '', name: m.user?.full_name || '', pic: m.user?.profile_pic_url || '',
        taken: m.taken_at || 0, caption: m.caption?.text || '',
        type: m.media_type === 8 ? 'album' : m.media_type === 2 ? (m.product_type === 'clips' ? 'reel' : 'video') : 'photo',
        // candidates run largest first: the last one still 320px wide is the grid thumbnail
        thumb: (cands.filter(c => c.width >= 320).pop() || cands[0] || {}).url || '',
        files: parts.map(pickFile).filter(Boolean),
        // the per-collection feeds are gone (404); membership rides on each saved item
        cols: (m.saved_collection_ids || []).map(String),
    };
}

const SORTS = {
    saved:  (a, b) => a.order - b.order,
    newest: (a, b) => b.taken - a.taken,
    oldest: (a, b) => a.taken - b.taken,
    user:   (a, b) => a.user.localeCompare(b.user) || a.order - b.order,
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

// Path under reference/, which is also the src the offline viewer loads.
const relPath = (it, i, url, folder) =>
    `${safe(folder)}/${safe(it.user)}_${it.code}${it.files.length > 1 ? `_${i + 1}` : ''}.${extOf(url)}`;

// '<' is escaped so a caption holding "</script>" cannot close the inline data block.
function buildIndex(arc, at) {
    const data = {
        at, cols: arc.cols || [], profiles: arc.profiles || {},
        posts: Object.values(arc.posts || {}).sort((a, b) => a.order - b.order),
    };
    return VIEWER.replace('__DATA__', () => JSON.stringify(data).replace(/</g, '\\u003c'));
}

// Offline viewer. Plain ES5 inside a template literal: no backticks and no dollar-brace in here.
const VIEWER = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>saved</title>
<style>
:root { --bg: #000; --fg: #f5f5f5; --mute: #a8a8a8; --line: #262626; --tag: #e0f1ff; --blue: #0095f6; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--fg); font: 14px/18px -apple-system, system-ui, "Segoe UI", Roboto, sans-serif; }
a { color: inherit; text-decoration: none; }
.wrap { max-width: 935px; margin: 0 auto; padding: 0 16px 48px; }
header { position: sticky; top: 0; z-index: 2; display: flex; align-items: center; gap: 8px; height: 56px; background: var(--bg); border-bottom: 1px solid var(--line); }
header .back { font-size: 26px; padding: 0 8px 4px 0; }
header h1 { margin: 0; font-size: 16px; font-weight: 600; }
header .n { margin-left: auto; color: var(--mute); font-size: 12px; }
.cols { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 20px 16px; padding-top: 20px; }
.cover { aspect-ratio: 1; display: grid; grid-template: 1fr 1fr / 1fr 1fr; gap: 1px; border-radius: 8px; overflow: hidden; background: #121212; }
.cover.one { grid-template: 1fr / 1fr; }
.col .name { margin-top: 8px; font-weight: 600; }
.col .count { color: var(--mute); font-size: 12px; }
.grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; padding-top: 4px; }
.tile { position: relative; aspect-ratio: 1; overflow: hidden; background: #121212; }
.tile img, .tile video, .cover img, .cover video { display: block; width: 100%; height: 100%; object-fit: cover; }
.ic { position: absolute; top: 8px; right: 8px; width: 20px; height: 20px; fill: #fff; filter: drop-shadow(0 0 2px #0009); }
.post { max-width: 470px; margin: 16px auto; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
.ph { display: flex; align-items: center; gap: 10px; padding: 10px 12px; }
.av { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; background: var(--line); flex: none; }
.ph b { display: block; font-weight: 600; }
.ph span { color: var(--mute); font-size: 12px; }
.stage { position: relative; background: #000; }
.slide img, .slide video { display: block; width: 100%; max-height: 82vh; object-fit: contain; }
.slide img { cursor: zoom-in; }
.nav { position: absolute; top: 50%; transform: translateY(-50%); width: 28px; height: 28px; border: 0; border-radius: 50%; background: #fffd; color: #000; font-size: 18px; line-height: 28px; cursor: pointer; }
.nav.l { left: 8px; } .nav.r { right: 8px; }
.dots { display: flex; justify-content: center; gap: 4px; padding-top: 12px; }
.dots i { width: 6px; height: 6px; border-radius: 50%; background: #555; }
.dots i.on { background: var(--blue); }
.cap { padding: 12px 12px 6px; white-space: pre-wrap; overflow-wrap: anywhere; }
.cap b { font-weight: 600; margin-right: 4px; }
.cap .t { color: var(--tag); }
.date { padding: 0 12px 14px; color: var(--mute); font-size: 10px; letter-spacing: .2px; text-transform: uppercase; }
.date a { margin-left: 8px; text-transform: none; }
.lb { position: fixed; inset: 0; z-index: 9; display: flex; align-items: center; justify-content: center; overflow: auto; background: #000f; cursor: zoom-in; }
.lb img { max-width: 100vw; max-height: 100vh; }
.lb.full { display: block; cursor: zoom-out; }
.lb.full img { max-width: none; max-height: none; }
.empty { padding: 48px; text-align: center; color: var(--mute); }
</style></head>
<body><div class="wrap" id="app"></div>
<script>window.HOARD = __DATA__;</script>
<script>
(function () {
    var D = window.HOARD, app = document.getElementById('app');
    var byCode = {};
    D.posts.forEach(function (p) { byCode[p.code] = p; });
    var ICON = {
        album: '<svg class="ic" viewBox="0 0 24 24"><path d="M3 7h12a2 2 0 0 1 2 2v12H5a2 2 0 0 1-2-2z"/><path d="M7 3h12a2 2 0 0 1 2 2v12h-2V5H7z"/></svg>',
        video: '<svg class="ic" viewBox="0 0 24 24"><path d="M7 4l13 8-13 8z"/></svg>'
    };
    ICON.reel = ICON.video;

    function esc(s) {
        return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
    }
    // #t=0.1 makes a paused video paint its first frame as a poster
    function mediaTag(m, extra) {
        return m.v ? '<video src="' + esc(m.p) + '#t=0.1" preload="metadata" muted playsinline ' + (extra || '') + '></video>'
                   : '<img src="' + esc(m.p) + '" loading="lazy" ' + (extra || '') + '>';
    }
    function inCol(id) {
        return id === 'all' ? D.posts : D.posts.filter(function (p) { return p.cols.indexOf(id) >= 0; });
    }
    function colTitle(id) {
        if (id === 'all') return 'All posts';
        for (var i = 0; i < D.cols.length; i++) if (D.cols[i].id === id) return D.cols[i].name;
        return id;
    }
    function head(back, title, n) {
        return '<header>' + (back ? '<a class="back" href="' + back + '">&#8249;</a>' : '') +
            '<h1>' + esc(title) + '</h1><span class="n">' + esc(n) + '</span></header>';
    }

    function home() {
        var cols = [{ id: 'all', name: 'All posts' }].concat(D.cols);
        app.innerHTML = head('', 'Saved', D.posts.length + ' posts · synced ' + new Date(D.at).toLocaleDateString()) +
            '<div class="cols">' + cols.map(function (c) {
                var list = inCol(c.id), four = list.length >= 4;
                return '<a class="col" href="#c/' + encodeURIComponent(c.id) + '"><div class="cover' + (four ? '' : ' one') + '">' +
                    list.slice(0, four ? 4 : 1).map(function (p) { return mediaTag(p.media[0]); }).join('') +
                    '</div><div class="name">' + esc(c.name) + '</div><div class="count">' + list.length + ' posts</div></a>';
            }).join('') + '</div>';
    }

    function col(id) {
        var list = inCol(id);
        app.innerHTML = head('#', colTitle(id), list.length + ' posts') + (list.length ? '<div class="grid">' + list.map(function (p) {
            return '<a class="tile" href="#p/' + encodeURIComponent(p.code) + '/' + encodeURIComponent(id) + '">' +
                mediaTag(p.media[0]) + (ICON[p.type] || '') + '</a>';
        }).join('') + '</div>' : '<div class="empty">no posts</div>');
    }

    function caption(s) {
        return esc(s).replace(/([#@][\\w.\\u00c0-\\uffff]+)/g, '<span class="t">$1</span>');
    }

    var slide = 0, cur = null;
    function post(p, from) {
        var prof = D.profiles[p.user] || {};
        cur = p; slide = 0;
        app.innerHTML = head('#c/' + encodeURIComponent(from), colTitle(from), '') +
            '<article class="post"><div class="ph">' +
            (prof.pic ? '<img class="av" src="' + esc(prof.pic) + '">' : '<div class="av"></div>') +
            '<div><b>' + esc(p.user) + '</b>' + (prof.name ? '<span>' + esc(prof.name) + '</span>' : '') + '</div></div>' +
            '<div class="stage"><div class="slide"></div>' +
            (p.media.length > 1 ? '<button class="nav l">&#8249;</button><button class="nav r">&#8250;</button>' : '') + '</div>' +
            (p.media.length > 1 ? '<div class="dots">' + p.media.map(function () { return '<i></i>'; }).join('') + '</div>' : '') +
            (p.caption ? '<div class="cap"><b>' + esc(p.user) + '</b>' + caption(p.caption) + '</div>' : '') +
            '<div class="date">' + (p.taken ? new Date(p.taken * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '') +
            '<a href="https://www.instagram.com/p/' + encodeURIComponent(p.code) + '/" target="_blank">open on instagram</a></div></article>';
        var l = app.querySelector('.nav.l'), r = app.querySelector('.nav.r');
        if (l) { l.onclick = function () { go(-1); }; r.onclick = function () { go(1); }; }
        show();
    }
    function show() {
        var m = cur.media[slide], box = app.querySelector('.slide');
        box.innerHTML = m.v ? '<video src="' + esc(m.p) + '" controls loop playsinline autoplay muted></video>' : '<img src="' + esc(m.p) + '">';
        var img = box.querySelector('img');
        if (img) img.onclick = function () { lightbox(m.p); };
        app.querySelectorAll('.dots i').forEach(function (d, i) { d.className = i === slide ? 'on' : ''; });
        var l = app.querySelector('.nav.l'), r = app.querySelector('.nav.r');
        if (l) { l.style.visibility = slide ? '' : 'hidden'; r.style.visibility = slide < cur.media.length - 1 ? '' : 'hidden'; }
    }
    function go(d) {
        if (!cur || cur.media.length < 2) return;
        slide = Math.max(0, Math.min(cur.media.length - 1, slide + d));
        show();
    }

    // first click fits the screen, second shows 1:1, third closes
    function lightbox(src) {
        var lb = document.createElement('div');
        lb.className = 'lb';
        lb.innerHTML = '<img src="' + esc(src) + '">';
        lb.onclick = function () { if (lb.classList.contains('full')) lb.remove(); else lb.classList.add('full'); };
        document.body.appendChild(lb);
    }

    var scroll = {}, key = '';
    function route() {
        scroll[key] = window.scrollY;
        key = location.hash;
        var h = location.hash.slice(1).split('/').map(decodeURIComponent);
        cur = null;
        if (h[0] === 'c') col(h[1]);
        else if (h[0] === 'p' && byCode[h[1]]) post(byCode[h[1]], h[2] || 'all');
        else home();
        window.scrollTo(0, scroll[key] || 0);
    }
    document.addEventListener('keydown', function (e) {
        var lb = document.querySelector('.lb');
        if (e.key === 'Escape') {
            if (lb) lb.remove();
            else { var b = document.querySelector('header .back'); if (b) location.hash = b.getAttribute('href'); }
        }
        if (!lb && e.key === 'ArrowLeft') go(-1);
        if (!lb && e.key === 'ArrowRight') go(1);
    });
    window.addEventListener('hashchange', route);
    route();
})();
</script>
</body></html>
`;

if (typeof module !== 'undefined') module.exports = { extOf, normalize, sortItems, filterItems, safe, relPath, buildIndex };
else main();

function main() {
    const LIB_KEY = 'hoard.lib';
    const ARC_KEY = 'hoard.archive';
    const APP_ID = '936619743392459';
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    // 5xx (Instagram's 572 included) and 429 are transient mid-paging: back off and retry the same cursor.
    async function api(path) {
        for (let wait = 5000; ; wait *= 3) {
            const res = await fetch('/api/v1/' + path, {
                credentials: 'include',
                headers: { 'X-IG-App-ID': APP_ID, 'X-Requested-With': 'XMLHttpRequest' },
            });
            if (res.ok) return res.json();
            if ((res.status < 500 && res.status !== 429) || wait > 45000) throw new Error(`${path} ${res.status}`);
            status(`instagram ${res.status}, retrying in ${wait / 1000}s`);
            await sleep(wait);
        }
    }

    // pages.at holds the cursor being fetched, so a failed walk can resume there
    async function pages(path, onItems, max = '') {
        do {
            pages.at = max;
            const d = await api(path + (max ? (path.includes('?') ? '&' : '?') + 'max_id=' + encodeURIComponent(max) : ''));
            onItems(d.items || []);
            max = d.more_available ? d.next_max_id : '';
            if (max) await sleep(PAGE_DELAY);
        } while (max);
    }

    let lib = GM_getValue(LIB_KEY, null);
    // Everything synced to disk: posts by code with local paths, never CDN urls — those expire.
    const archive = () => GM_getValue(ARC_KEY, null) || { posts: {}, profiles: {}, cols: [] };
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
        #hoard-view { position: fixed; inset: 0; z-index: 2147483001; background: #000d; display: flex; overflow: auto; padding: 20px; gap: 16px; }
        #hoard-view .media { flex: 1; display: flex; flex-direction: column; gap: 8px; align-items: center; }
        #hoard-view .media img, #hoard-view .media video { max-width: 100%; max-height: 85vh; }
        #hoard-view .side { width: 320px; color: #ddd; white-space: pre-wrap; font: 13px/1.4 system-ui; }
        #hoard-view a { color: #8ab4ff; }
        #hoard-view .x { position: fixed; top: 12px; right: 16px; z-index: 1; background: #1a1a1d; color: #ddd; border: 1px solid #333;
                         border-radius: 50%; width: 32px; height: 32px; font: 16px system-ui; cursor: pointer; }
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
    const status = (t) => { statusEl.textContent = status.last = t; };

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
            h('button', { textContent: 'sync to disk', onclick: () => run(sync) }),
            statusEl,
            h('button', { textContent: '✕', onclick: close })),
        body);
    document.body.append(root, viewer,
        h('button', { id: 'hoard-pill', textContent: 'hoard', onclick: open }));

    let busy = false;
    async function run(task) {
        if (busy) return status(status.last + ' · busy, wait for it to finish');
        busy = true;
        try { await task(); } catch (e) { status('error: ' + e.message); console.error('[hoard]', e); }
        busy = false;
    }

    // Collection names by id, merged across refreshes: the list endpoint may 404, and the saved
    // page's collection links (/<user>/saved/<slug>/<id>/) are the fallback source.
    const NAMES_KEY = 'hoard.cols';
    function learnNames() {
        const names = GM_getValue(NAMES_KEY, {});
        for (const a of document.querySelectorAll('a[href*="/saved/"]')) {
            const m = /\/saved\/([^/]+)\/(\d+)\/?$/.exec(new URL(a.href).pathname);
            if (m && m[1] !== 'all-posts') names[m[2]] = a.textContent.trim() || decodeURIComponent(m[1]).replace(/-/g, ' ');
        }
        GM_setValue(NAMES_KEY, names);
        return names;
    }

    async function load() {
        const names = learnNames();
        try {
            await pages('collections/list/?collection_types=' + encodeURIComponent('["MEDIA"]'),
                batch => batch.forEach(c => { names[String(c.collection_id)] = c.collection_name; }));
            GM_setValue(NAMES_KEY, names);
        } catch (e) { console.warn('[hoard] collection list unavailable, using saved page names', e); }
        // lib.next: the cursor a failed walk stopped at; the next refresh continues from it
        const resume = lib?.next ? lib : null;
        const items = resume ? resume.items : [];
        const publish = (next) => {
            const ids = [...new Set(items.flatMap(it => it.cols))];
            lib = { items, cols: ids.map(id => ({ id, name: names[id] || 'collection ' + id })), at: Date.now(), next };
            GM_setValue(LIB_KEY, lib);
            render();
            return ids.filter(id => !names[id]).length;
        };
        try {
            await pages('feed/saved/posts/', batch => {
                batch.forEach(x => x.media && items.push(normalize(
                    { ...x.media, saved_collection_ids: x.media.saved_collection_ids || x.saved_collection_ids }, items.length)));
                status(`saved ${items.length}`);
            }, resume?.next);
        } catch (e) {
            // keep what arrived: a partial library still shows and syncs
            if (items.length) publish(pages.at);
            throw new Error(`${e.message} after ${items.length} posts, refresh continues from there`);
        }
        const unnamed = publish('');
        if (unnamed) status(`${unnamed} collection names unknown: open instagram.com/<you>/saved/, then refresh`);
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
        const synced = archive().posts;
        const list = shown();
        status(`${list.length} shown · ${lib.items.length} saved · ${Object.keys(synced).length} on disk · ${new Date(lib.at).toLocaleString()}`);
        body.replaceChildren(h('div', { className: 'grid' }, ...list.map(it =>
            h('div', { className: 'tile' + (synced[it.code] ? ' done' : ''), onclick: () => show(it) },
                h('img', { src: it.thumb, loading: 'lazy', referrerPolicy: 'no-referrer' }),
                h('span', { textContent: `@${it.user}${it.type === 'photo' ? '' : ' · ' + it.type}` })))));
    }

    function show(it) {
        viewer.replaceChildren(
            h('div', { className: 'media' }, ...it.files.map(f => f.video
                ? h('video', { src: f.url, controls: true, loop: true })
                : h('img', { src: f.url, referrerPolicy: 'no-referrer' }))),
            h('div', { className: 'side' },
                h('a', { href: `/p/${it.code}/`, target: '_blank', textContent: `@${it.user} · open post` }),
                `\n${it.taken ? new Date(it.taken * 1000).toLocaleDateString() : ''}`,
                `\n${it.cols.map(colName).join(', ') || 'no collection'}\n\n${it.caption}`));
        viewer.prepend(h('button', { className: 'x', textContent: '✕', onclick: () => { viewer.hidden = true; } }));
        viewer.hidden = false;
    }
    // .media fills the backdrop, so a click on its empty space closes too
    viewer.addEventListener('click', e => { if (e.target === viewer || e.target.className === 'media') viewer.hidden = true; });

    // GM_download never calls back when the download is blocked outright (extension not whitelisted,
    // download mode not browser api), so a hard timeout turns that into a visible failure.
    const gmDownload = (url, name) => new Promise((ok, fail) => {
        const t = setTimeout(() => fail(new Error('no response, check tampermonkey download settings')), 60000);
        GM_download({
            url, name, conflictAction: 'overwrite', onload: () => { clearTimeout(t); ok(); },
            onerror: e => { clearTimeout(t); fail(new Error(e?.error || 'failed')); },
            ontimeout: () => { clearTimeout(t); fail(new Error('timeout')); },
        });
    });

    // Uses the library already loaded (refresh first for new saves), then downloads only posts not yet in the archive, each once into its first
    // collection's folder (else "saved"). Posts already on disk just get their collections and
    // order updated. The archive is saved after every post, so an interrupted sync resumes.
    async function sync() {
        if (!lib) await load();
        const arc = archive();
        for (const it of lib.items) {
            const p = arc.posts[it.code];
            if (p) { p.cols = it.cols; p.order = it.order; }
        }
        const fresh = lib.items.filter(it => !arc.posts[it.code]);
        let n = 0, failed = 0;
        status(`sync 0/${fresh.length}`);
        for (const it of fresh) {
            n++;
            status(`sync ${n}/${fresh.length} @${it.user}${failed ? ` · ${failed} failed` : ''}`);
            if (!arc.profiles[it.user] && it.pic) {
                const pic = `profiles/${safe(it.user)}.jpg`;
                try {
                    await gmDownload(it.pic, 'reference/' + pic);
                    arc.profiles[it.user] = { name: it.name, pic };
                } catch (e) { console.warn('[hoard] profile', it.user, e.message); }
            }
            try {
                if (!it.files.length) throw new Error('no media');
                const folder = it.cols[0] ? colName(it.cols[0]) : 'saved';
                const media = [];
                for (const [i, f] of it.files.entries()) {
                    const p = relPath(it, i, f.url, folder);
                    await gmDownload(f.url, 'reference/' + p);
                    media.push({ p, v: f.video, w: f.w, h: f.h });
                }
                const { code, user, taken, type, caption, cols, order } = it;
                arc.posts[code] = { code, user, taken, type, caption, cols, order, media };
                GM_setValue(ARC_KEY, arc);
            } catch (e) {
                failed++;
                console.warn('[hoard]', it.code, e.message);
                if (failed === 1) status.first = e.message;
            }
            await sleep(DL_DELAY);
        }
        arc.cols = lib.cols;
        GM_setValue(ARC_KEY, arc);
        const html = buildIndex(arc, Date.now());
        await gmDownload('data:text/html;charset=utf-8,' + encodeURIComponent(html), 'reference/index.html');
        render();
        status(`synced ${fresh.length - failed} new · ${Object.keys(arc.posts).length} on disk${failed ? ` · ${failed} failed (${status.first}), sync again` : ''}`);
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
    // capture phase: Instagram's own handlers stop Escape before it bubbles to document
    window.addEventListener('keydown', e => {
        if (e.key !== 'Escape' || root.hidden) return;
        e.stopPropagation();
        if (!viewer.hidden) viewer.hidden = true; else close();
    }, true);
    GM_registerMenuCommand('open hoard', open);
    GM_registerMenuCommand('sync to disk', () => run(sync));
}
