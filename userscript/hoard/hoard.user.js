// ==UserScript==
// @name         hoard
// @namespace    https://github.com/SolRaze/extentions/tree/main/userscript/hoard
// @version      1.28
// @description  instagram saved collections as a reference library: grid, graph, tags, batch collection edits, save to disk on demand
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
// @grant        GM_xmlhttpRequest
// @grant        GM_openInTab
// @connect      cdninstagram.com
// @connect      fbcdn.net
// @connect      greasyfork.org
// @connect      *
// @downloadURL https://update.greasyfork.org/scripts/598006/hoard.user.js
// @updateURL https://update.greasyfork.org/scripts/598006/hoard.meta.js
// ==/UserScript==
// @namespace stays the old repo url: tampermonkey keys a script and its storage by name + namespace,
// so a new one installs a second copy with an empty library.

// Reads the saved feed through the same /api/v1 endpoints the web app calls, with the tab's own
// session, and shows it in a full-screen library that covers the rest of Instagram: a grid, or a
// graph of islands per collection and own tag, all from live CDN links, nothing stored. Selected
// posts get tags and queued collection edits, which apply to the account in one paced run.
// Save to disk, for the selection or everything, writes each post once into
// Downloads/reference/<collection>/ and rewrites reference/index.html, a self-contained offline
// viewer with the library data inlined — file:// pages cannot fetch JSON.

const PAGE_DELAY = 1500;  // ms between feed pages
const DL_DELAY = 800;     // ms between downloaded posts
const RESUME_MS = 3600e3; // a stopped walk older than this restarts: its cdn links have expired

// Pure helpers (exported for selftest.js)
// The extension of the format the CDN serves: stp=dst-<fmt> names it (a .heic path serves JPEG
// under dst-jpg); else the path's own. A name that disagrees with the served type is renamed by the
// browser on save, so the archive would point at a file that is not there. dst-jpegr is an HDR
// JPEG and falls through to the path's .jpg.
// oe=<hex unix seconds> is when a signed CDN link stops working; a link without one never expires.
const expired = (url, now = Date.now()) => {
    const oe = new URL(url).searchParams.get('oe');
    return !!oe && parseInt(oe, 16) * 1000 <= now;
};

// Dotted versions compared numerically: 1.17 is newer than 1.9.
const newer = (a, b) => {
    const x = a.split('.').map(Number), y = b.split('.').map(Number);
    for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
    return false;
};
const extOf = (url) => {
    const u = new URL(url);
    const served = /^dst-(jpg|webp|png|heic|avif)(?![a-z])/.exec(u.searchParams.get('stp') || '');
    if (served) return served[1];
    const m = /\.(\w{2,4})$/.exec(u.pathname);
    return m ? m[1].toLowerCase() : 'jpg';
};

// Largest rendition the API offers: video over its poster, else the first image candidate.
const pickFile = (x) => {
    const v = x.video_versions?.[0];
    const i = x.image_versions2?.candidates?.[0];
    const f = v || i;
    return f?.url ? {
        url: f.url, video: !!v, w: f.width || 0, h: f.height || 0,
        alt: x.accessibility_caption || '', dur: v ? x.video_duration || 0 : 0,
    } : null;
};

const postUrl = (code) => `https://www.instagram.com/p/${code}/`;
const profileUrl = (user) => `https://www.instagram.com/${user}/`;

// Media ids are "<pk>_<owner>" strings; the numeric pk overflows a JS number, so it is never used.
// User pks fit a number; pk_id is the API's own string form and wins when present.
function normalize(m, order) {
    const parts = m.carousel_media?.length ? m.carousel_media : [m];
    const cands = parts[0].image_versions2?.candidates || [];
    const loc = m.location;
    const clip = m.clips_metadata;
    const music = clip?.music_info?.music_asset_info;
    const sound = clip?.original_sound_info;
    const audio = music ? { title: music.title || '', artist: music.display_artist || '' }
        : sound ? { title: sound.original_audio_title || '', artist: sound.ig_artist?.username || '' } : null;
    return {
        id: String(m.id), code: m.code, order,
        user: m.user?.username || '', uid: String(m.user?.pk_id ?? m.user?.pk ?? ''),
        name: m.user?.full_name || '', pic: m.user?.profile_pic_url || '',
        taken: m.taken_at || 0, caption: m.caption?.text || '',
        type: m.media_type === 8 ? 'album' : m.media_type === 2 ? (m.product_type === 'clips' ? 'reel' : 'video') : 'photo',
        // candidates run largest first: the last one still 320px wide is the grid thumbnail
        thumb: (cands.filter(c => c.width >= 320).pop() || cands[0] || {}).url || '',
        files: parts.map(pickFile).filter(Boolean),
        // the per-collection feeds are gone (404); membership rides on each saved item
        cols: (m.saved_collection_ids || []).map(String),
        location: loc?.name ? { name: loc.name, lat: loc.lat ?? null, lng: loc.lng ?? null } : null,
        // carousel items carry their own tags
        tagged: [...new Set([m, ...parts].flatMap(x => x.usertags?.in || []).map(t => t.user?.username).filter(Boolean))],
        coauthors: (m.coauthor_producers || []).map(u => u.username).filter(Boolean),
        audio,
    };
}

// Archive entry: everything the viewer and the sidecar need, local paths only.
function record(it, media, dirs) {
    const { code, user, uid, name, taken, type, caption, cols, order } = it;
    return {
        code, user, uid: uid || '', name: name || '', taken, type, caption, cols, order,
        url: postUrl(code), profile: profileUrl(user),
        location: it.location || null, tagged: it.tagged || [], coauthors: it.coauthors || [], audio: it.audio || null,
        media, dirs,
    };
}

// <dir>/<user>_<code>.json beside the media; every path in it is relative to the sidecar itself.
// No feed position: it shifts with every new save and would make every sidecar stale.
function sidecar(p, colName, pic) {
    const { media, dirs, cols, taken, order, side, ...rest } = p;
    return JSON.stringify({
        ...rest,
        taken, datetime: taken ? new Date(taken * 1000).toISOString() : '',
        pic: pic ? '../' + pic : '',
        cols, collections: cols.map(colName),
        media: media.map(m => ({ ...m, p: m.p.split('/').pop() })),
    }, null, 2);
}
const sidecarPath = (it, folder) => `${safe(folder)}/${safe(it.user)}_${it.code}.json`;
// djb2 over the sidecar text: a changed hash rewrites every copy
const hash = (s) => { let x = 5381; for (let i = 0; i < s.length; i++) x = (x * 33 ^ s.charCodeAt(i)) >>> 0; return x.toString(36); };

const SORTS = {
    saved:  (a, b) => a.order - b.order,
    newest: (a, b) => b.taken - a.taken,
    oldest: (a, b) => a.taken - b.taken,
    user:   (a, b) => a.user.localeCompare(b.user) || a.order - b.order,
};
const sortItems = (items, key) => [...items].sort(SORTS[key] || SORTS.saved);

// col '' = everything, '-' = in no collection, 'tag:<t>' = own tag; tags: own tags by post code
function filterItems(items, { col = '', type = '', q = '' } = {}, tags = {}) {
    q = q.toLowerCase();
    const t = q.replace(/^#/, '');
    return items.filter(it =>
        (!col || (col === '-' ? !it.cols.length : col.startsWith('tag:') ? (tags[it.code] || []).includes(col.slice(4)) : it.cols.includes(col))) &&
        (!type || it.type === type) &&
        (!q || it.user.toLowerCase().includes(q) || it.caption.toLowerCase().includes(q) || (tags[it.code] || []).some(x => x.includes(t))));
}

// Pending collection edits until applied: {<collection id | 'new:<name>'>: {add: [codes], rm: [codes]}}.
// The last action on a post wins; one that matches what has(code) says it already is drops out.
function queueEdit(q, col, codes, add, has = () => false) {
    const e = q[col] ||= { add: [], rm: [] };
    for (const c of codes) {
        e.add = e.add.filter(x => x !== c);
        e.rm = e.rm.filter(x => x !== c);
        if (add !== has(c)) (add ? e.add : e.rm).push(c);
    }
    if (!e.add.length && !e.rm.length) delete q[col];
    return q;
}

// Graph layout: an island per hub (collection or tag) shared by 2+ posts, each post in its
// smallest hub's island so the specific beats the broad; the rest pool in one unnamed island ('').
// Islands on an outward spiral, largest first; posts on a sunflower inside each, S apart.
// Returns {islands: [{hub, n, x, y, r, members}], at: Map(code -> [x, y])}.
const GOLD = Math.PI * (3 - Math.sqrt(5));
function layout(items, hubsOf, S = 40) {
    const count = new Map();
    for (const it of items) for (const k of hubsOf(it)) count.set(k, (count.get(k) || 0) + 1);
    const by = new Map();
    for (const it of items) {
        const k = hubsOf(it).filter(k => count.get(k) > 1).sort((a, b) => count.get(a) - count.get(b) || a.localeCompare(b))[0] || '';
        (by.get(k) || by.set(k, []).get(k)).push(it);
    }
    const c = S * 0.7;
    const islands = [...by].map(([hub, members]) => ({ hub, n: count.get(hub) || members.length, members, r: c * Math.sqrt(members.length) + S }))
        .sort((a, b) => (!a.hub - !b.hub) || b.members.length - a.members.length);
    const at = new Map(), placed = [];
    for (const is of islands) {
        for (let i = 0; ; i++) {
            const d = 2.25 * S * Math.sqrt(i), x = d * Math.cos(i * GOLD), y = d * Math.sin(i * GOLD);
            if (placed.every(p => Math.hypot(p.x - x, p.y - y) > p.r + is.r + S * 1.6)) { is.x = x; is.y = y; break; }
        }
        placed.push(is);
        is.members.forEach((it, i) => {
            const d = c * Math.sqrt(i + 0.5);
            at.set(it.code, [is.x + d * Math.cos(i * GOLD), is.y + d * Math.sin(i * GOLD)]);
        });
    }
    return { islands, at };
}

const safe = (s) => String(s).replace(/[\\/:*?"<>|\x00-\x1f]+/g, '_').replace(/^\.+/, '').trim().slice(0, 80) || '_';

// Folders a post belongs in: one per collection, "unsorted" when it is in none.
const dirsOf = (it, name) => it.cols.length ? [...new Set(it.cols.map(id => safe(name(id))))] : ['unsorted'];
// Folders an archived post already has on disk; entries without dirs hold one, the media's own.
const dirsHave = (p) => p ? p.dirs || [p.media[0]?.p.split('/')[0]] : [];

// Path under reference/, which is also the src the offline viewer loads.
const relPath = (it, i, url, folder) =>
    `${safe(folder)}/${safe(it.user)}_${it.code}${it.files.length > 1 ? `_${i + 1}` : ''}.${extOf(url)}`;

// Folder each collection id was written under. A collection whose name changed, or whose name was
// learned after its posts landed in "collection <id>", is renamed in the archive here; the move on
// disk is tidy.py's job, reading the pending pairs from index.html. Returns this run's pairs.
function renameFolders(arc, cols) {
    const folders = arc.folders || (arc.folders = {});
    const used = new Set(Object.values(arc.posts).flatMap(dirsHave));
    const mv = new Map();
    for (const c of cols) {
        const now = safe(c.name), fallback = safe('collection ' + c.id);
        const was = folders[c.id] || (used.has(fallback) ? fallback : now);
        if (was !== now) mv.set(was, now);
        folders[c.id] = now;
    }
    if (!mv.size) return [];
    for (const p of Object.values(arc.posts)) {
        if (p.dirs) p.dirs = [...new Set(p.dirs.map(d => mv.get(d) || d))];
        for (const m of p.media) {
            const i = m.p.indexOf('/'), d = m.p.slice(0, i);
            if (mv.has(d)) m.p = mv.get(d) + m.p.slice(i);
        }
    }
    const pairs = [...mv];
    arc.renames = [...(arc.renames || []), ...pairs];
    return pairs;
}

// Drops posts from the archive so the next sync downloads them again; a userscript cannot see
// the disk, so a file lost or misnamed there is reported from outside. Takes post codes or post
// urls split by spaces, commas or newlines. Returns how many were in the archive.
function forget(arc, text) {
    let n = 0;
    for (const t of text.split(/[\s,]+/)) {
        const code = /([\w-]+)\/?$/.exec(t)?.[1];
        if (code && arc.posts[code]) { delete arc.posts[code]; n++; }
    }
    return n;
}

// '<' is escaped so a caption holding "</script>" cannot close the inline data block.
function buildIndex(arc, at) {
    const data = {
        at, cols: arc.cols || [], profiles: arc.profiles || {}, renames: arc.renames || [],
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
.ph span { display: block; color: var(--mute); font-size: 12px; }
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
.date a { margin-left: 8px; text-transform: none; color: var(--blue); }
.with { padding: 0 12px 8px; color: var(--mute); font-size: 12px; }
.with a { color: var(--tag); }
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

    // location name, linked to a map when it has coordinates
    function place(l) {
        return l.lat != null && l.lng != null
            ? '<a href="https://www.google.com/maps?q=' + l.lat + ',' + l.lng + '" target="_blank">' + esc(l.name) + '</a>' : esc(l.name);
    }

    var slide = 0, cur = null;
    function post(p, from) {
        var prof = D.profiles[p.user] || {};
        var prof_url = p.profile || 'https://www.instagram.com/' + encodeURIComponent(p.user) + '/';
        cur = p; slide = 0;
        app.innerHTML = head('#c/' + encodeURIComponent(from), colTitle(from), '') +
            '<article class="post"><div class="ph">' +
            (prof.pic ? '<img class="av" src="' + esc(prof.pic) + '">' : '<div class="av"></div>') +
            '<div><a href="' + esc(prof_url) + '" target="_blank"><b>' + esc(p.user) + '</b></a>' +
            (prof.name || p.name ? '<span>' + esc(prof.name || p.name) + '</span>' : '') +
            (p.location ? '<span class="loc">' + place(p.location) + '</span>' : '') + '</div></div>' +
            '<div class="stage"><div class="slide"></div>' +
            (p.media.length > 1 ? '<button class="nav l">&#8249;</button><button class="nav r">&#8250;</button>' : '') + '</div>' +
            (p.media.length > 1 ? '<div class="dots">' + p.media.map(function () { return '<i></i>'; }).join('') + '</div>' : '') +
            (p.caption ? '<div class="cap"><b>' + esc(p.user) + '</b>' + caption(p.caption) + '</div>' : '') +
            (p.tagged && p.tagged.length ? '<div class="with">with ' + p.tagged.map(function (u) {
                return '<a href="https://www.instagram.com/' + encodeURIComponent(u) + '/" target="_blank">@' + esc(u) + '</a>';
            }).join(', ') + '</div>' : '') +
            '<div class="date">' + (p.taken ? new Date(p.taken * 1000).toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '') +
            '<a href="' + esc(p.url || 'https://www.instagram.com/p/' + encodeURIComponent(p.code) + '/') + '" target="_blank">open post</a>' +
            '<a href="' + esc(prof_url) + '" target="_blank">profile</a></div></article>';
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

// What mark should hold per post: its named collections and own tags. sent {code: tags} is what mark last
// took; returns the mark:add and mark:remove payloads for the posts in items, keyed the way mark keys posts.
const markUrl = (it) => `https://instagram.com/${it.type === 'reel' ? 'reel' : 'p'}/${it.code}`;
function markDiff(items, colNames, own, sent) {
    const add = {}, rm = {}, next = { ...sent };
    for (const it of items) {
        const want = [...new Set([...it.cols.map(c => colNames[c]).filter(Boolean), ...(own[it.code] || [])])];
        const had = sent[it.code] || [];
        const plus = want.filter(t => !had.includes(t)), minus = had.filter(t => !want.includes(t));
        if (plus.length) add[markUrl(it)] = { tags: plus, title: '@' + it.user, type: 'post' };
        if (minus.length) rm[markUrl(it)] = { tags: minus };
        if (want.length) next[it.code] = want; else delete next[it.code];
    }
    return { add, rm, next };
}

if (typeof module !== 'undefined') module.exports = { expired, newer, extOf, normalize, record, renameFolders, sidecar, sidecarPath, hash, sortItems, filterItems, safe, relPath, dirsOf, dirsHave, buildIndex, forget, queueEdit, layout, markDiff };
else main();

function main() {
    const LIB_KEY = 'hoard.lib';
    const ARC_KEY = 'hoard.archive';
    const NAMES_KEY = 'hoard.cols';
    const QUEUE_KEY = 'hoard.queue';
    const APP_ID = '936619743392459';
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    // 5xx (Instagram's 572 included) and 429 are transient mid-paging: back off and retry the same cursor.
    // form: POST fields, sent with the csrftoken cookie as instagram's own writes are
    async function api(path, form) {
        for (let wait = 5000; ; wait *= 3) {
            const res = await fetch('/api/v1/' + path, {
                credentials: 'include',
                headers: { 'X-IG-App-ID': APP_ID, 'X-Requested-With': 'XMLHttpRequest',
                    ...form && { 'X-CSRFToken': /csrftoken=([^;]+)/.exec(document.cookie)?.[1] || '', 'Content-Type': 'application/x-www-form-urlencoded' } },
                ...form && { method: 'POST', body: new URLSearchParams(form) },
            });
            if (res.ok) return res.json();
            if ((res.status < 500 && res.status !== 429) || wait > 45000) throw new Error(`${path} ${res.status}`);
            log('api retry', { path, status: res.status, wait });
            status(`instagram ${res.status}, retrying in ${wait / 1000}s`);
            await sleep(wait);
        }
    }

    // pages.at holds the cursor being fetched, so a failed walk can resume there
    async function pages(path, onItems, max = '') {
        do {
            pages.at = max;
            const d = await api(path + (max ? (path.includes('?') ? '&' : '?') + 'max_id=' + encodeURIComponent(max) : ''));
            max = d.more_available ? d.next_max_id : '';
            onItems(d.items || [], max);
            if (max) await sleep(PAGE_DELAY);
        } while (max);
    }

    let lib = GM_getValue(LIB_KEY, null);
    // Everything synced to disk: posts by code with local paths, never CDN urls — those expire.
    const archive = () => GM_getValue(ARC_KEY, null) || { posts: {}, profiles: {}, cols: [] };
    const view = { col: '', type: '', q: '', sort: 'saved', graph: false };
    const colName = (id) => lib.cols.find(c => c.id === id)?.name || GM_getValue(NAMES_KEY, {})[id] || id;
    const sel = new Set();  // selected post codes
    const byCode = () => new Map((lib?.items || []).map(it => [it.code, it]));

    GM_addStyle(`
        #hoard { position: fixed; inset: 0; z-index: 2147483000; background: #0b0b0c; color: #ddd;
                 font: 13px/1.4 -apple-system, system-ui, sans-serif; display: flex; flex-direction: column; }
        #hoard[hidden], #hoard-view[hidden] { display: none; }
        #hoard .bar { display: flex; gap: 6px 12px; align-items: center; padding: 8px 10px; border-bottom: 1px solid #222; flex-wrap: wrap; }
        #hoard .group { display: flex; gap: 6px; align-items: center; }
        #hoard .filters { flex: 1 1 360px; min-width: 0; flex-wrap: wrap; }
        #hoard .filters select { flex: 0 1 auto; min-width: 0; max-width: 220px; }
        #hoard .filters input { flex: 1 1 120px; min-width: 0; }
        #hoard .tools { margin-left: auto; }
        @media (max-width: 640px) {
            #hoard .filters { order: 1; flex-basis: 100%; }
            #hoard .filters select { flex: 1 1 0; max-width: none; }
            #hoard .filters input { flex-basis: 100%; }
        }
        #hoard button, #hoard select, #hoard input { background: #1a1a1d; color: #ddd; border: 1px solid #333; border-radius: 6px; padding: 4px 8px; font: inherit; }
        #hoard button:hover { background: #26262a; }
        #hoard .status { order: 2; flex-basis: 100%; opacity: .7; font-size: 12px; overflow-wrap: anywhere; }
        #hoard .status:empty { display: none; }
        #hoard .body { flex: 1; overflow: auto; padding: 10px; }
        #hoard .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 6px; }
        #hoard .tile { position: relative; aspect-ratio: 1; background: #151517; cursor: pointer; overflow: hidden; border-radius: 4px; }
        #hoard .tile img { width: 100%; height: 100%; object-fit: cover; }
        #hoard .tile span { position: absolute; left: 4px; bottom: 4px; background: #000a; padding: 1px 5px; border-radius: 4px; font-size: 11px; }
        #hoard .tile.done::after { content: '✓'; position: absolute; top: 4px; right: 6px; }
        #hoard .tile.sel { outline: 3px solid #8ab4ff; outline-offset: -3px; }
        #hoard .tile.sel img { opacity: .75; }
        #hoard [hidden] { display: none !important; }
        #hoard .selbar { order: 3; flex-basis: 100%; flex-wrap: wrap; }
        #hoard .body.g { padding: 0; overflow: hidden; }
        #hoard canvas { width: 100%; height: 100%; display: block; }
        #hoard-view { position: fixed; inset: 0; z-index: 2147483001; background: #000d; display: flex; overflow: auto; padding: 20px; gap: 16px; }
        #hoard-view .media { flex: 1; display: flex; flex-direction: column; gap: 8px; align-items: center; }
        #hoard-view .media img, #hoard-view .media video { max-width: 100%; max-height: 85vh; }
        #hoard-view .side { width: 320px; color: #ddd; white-space: pre-wrap; font: 13px/1.4 system-ui; }
        #hoard-view a { color: #8ab4ff; }
        #hoard-view .x { position: fixed; top: 12px; right: 16px; z-index: 1; background: #1a1a1d; color: #ddd; border: 1px solid #333;
                         border-radius: 50%; width: 32px; height: 32px; font: 16px system-ui; cursor: pointer; }
        #hoard-pill { position: fixed; right: 10px; top: 8px; z-index: 2147482999; background: #1a1a1d; color: #ddd;
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

    // Debug log: the last LOG_MAX events in tampermonkey storage `hoard.log`, kept across reloads.
    // Every refresh and sync, and the log button, write it to reference/hoard-log.json.
    const LOG_KEY = 'hoard.log', LOG_MAX = 2000;
    const logs = GM_getValue(LOG_KEY, []);
    const log = (event, data = {}) => {
        logs.push({ t: new Date().toISOString(), v: GM_info.script.version, event, ...data });
        if (logs.length > LOG_MAX) logs.splice(0, logs.length - LOG_MAX);
        GM_setValue(LOG_KEY, logs);
        console.log('[hoard]', event, data);
    };
    const saveLog = () => save(JSON.stringify(logs, null, 1), 'application/json', 'reference/hoard-log.json')
        .catch(e => console.warn('[hoard] log not written', e.message));

    const colSel = h('select', { onchange: () => { view.col = colSel.value; render(); } });
    const typeSel = h('select', { onchange: () => { view.type = typeSel.value; render(); } },
        ...['', 'photo', 'album', 'video', 'reel'].map(v => h('option', { value: v, textContent: v || 'all types' })));
    const sortSel = h('select', { onchange: () => { view.sort = sortSel.value; render(); } },
        ...Object.keys(SORTS).map(v => h('option', { value: v, textContent: v })));
    const search = h('input', { placeholder: 'user or caption', oninput: () => { view.q = search.value; render(); } });

    // Latest version from greasyfork's meta file; installing goes through tampermonkey's own page.
    const META_URL = 'https://update.greasyfork.org/scripts/598006/hoard.meta.js';
    const latest = () => new Promise((ok, fail) => GM_xmlhttpRequest({
        method: 'GET', url: META_URL + '?t=' + Date.now(), timeout: 15000,
        onload: r => { const v = /@version\s+(\S+)/.exec(r.responseText); v ? ok(v[1]) : fail(new Error('no version in meta')); },
        onerror: () => fail(new Error('greasyfork unreachable')), ontimeout: () => fail(new Error('greasyfork timed out')),
    }));
    const updateBtn = h('button', { textContent: 'update', title: 'check greasyfork for a new version', onclick: async () => {
        const mine = GM_info.script.version;
        try {
            const v = await latest();
            if (!newer(v, mine)) { updateBtn.textContent = 'update'; return status(`${mine} is the latest`); }
            status(`installing ${v} | reload instagram after`);
            GM_openInTab(GM_info.script.downloadURL || META_URL.replace('.meta.js', '.user.js'), { active: true });
        } catch (e) { status('update check failed: ' + e.message); }
    } });
    const checkUpdate = () => latest().then(v => { if (newer(v, GM_info.script.version)) updateBtn.textContent = `update ${v}`; }).catch(() => {});

    const graphBtn = h('button', { textContent: 'graph', title: 'islands per collection and tag', onclick: () => { view.graph = !view.graph; render(); } });
    const applyBtn = h('button', { hidden: true, onclick: () => run(apply) });
    const discardBtn = h('button', { textContent: 'discard', hidden: true, title: 'drop every pending collection edit', onclick: () => {
        if (busy || !confirm('drop every pending collection edit?')) return;
        GM_setValue(QUEUE_KEY, {});
        renderQueue();
    } });
    const selN = h('span');
    const target = h('select', { title: 'collection the edit goes to' });
    const moveBtn = h('button', { textContent: 'move', title: 'add to the chosen collection, remove from the one filtered', onclick: () => edit(true, true) });
    const selBar = h('div', { className: 'group selbar', hidden: true },
        selN, target,
        h('button', { textContent: 'add', title: 'queue: add the selection to the chosen collection', onclick: () => edit(true) }),
        h('button', { textContent: 'remove', title: 'queue: remove the selection from the chosen collection', onclick: () => edit(false) }),
        moveBtn,
        h('button', { textContent: 'tag', title: 'add tags, -tag removes', onclick: () => tagSel() }),
        h('button', { textContent: 'save to disk', title: 'download the selection', onclick: () => run(saveSelected) }),
        h('button', { textContent: 'clear', title: 'clear the selection (esc)', onclick: () => { sel.clear(); render(); } }));

    root.append(
        h('div', { className: 'bar' },
            h('div', { className: 'group act' },
                h('button', { textContent: 'refresh', title: 'pull the saved feed', onclick: () => run(load) }),
                h('button', { textContent: 'select', title: 'select every post shown, again clears', onclick: () => {
                    const list = shown();
                    if (list.every(it => sel.has(it.code))) sel.clear(); else list.forEach(it => sel.add(it.code));
                    render();
                } }),
                graphBtn, applyBtn, discardBtn),
            h('div', { className: 'group filters' }, colSel, typeSel, sortSel, search),
            h('div', { className: 'group tools' },
                h('button', { textContent: 'sync to disk', title: 'download every post not on disk yet', onclick: () => run(sync) }),
                h('button', { textContent: 'log', title: 'write Downloads/reference/hoard-log.json', onclick: () => saveLog().then(() => status('log written to reference/hoard-log.json')) }),
                updateBtn,
                h('button', { textContent: '✕', title: 'close (esc)', onclick: close })),
            statusEl, selBar),
        body);
    document.body.append(root, viewer,
        h('button', { id: 'hoard-pill', textContent: 'hoard', onclick: open }));

    let busy = false;
    async function run(task) {
        if (busy) return status(status.last.split(' · busy')[0] + ' · busy, wait for it to finish');
        busy = true;
        // display sleep stalls tampermonkey's downloader for good; hold the screen on while busy
        const wake = await navigator.wakeLock?.request('screen').catch(() => null);
        log('start', { task: task.name, page: location.pathname });
        try { await task(); log('done', { task: task.name, status: status.last }); }
        catch (e) { status('error: ' + e.message); log('error', { task: task.name, error: e.message, stack: e.stack }); }
        busy = false;
        wake?.release();
        await saveLog();
    }

    // Collection names by id, merged across refreshes: the list endpoint may 404, and the saved
    // page's collection links (/<user>/saved/<slug>/<id>/) are the fallback source.
    function learnNames() {
        const names = GM_getValue(NAMES_KEY, {});
        for (const a of document.querySelectorAll('a[href*="/saved/"]')) {
            const m = /\/saved\/([^/]+)\/(\d+)\/?$/.exec(new URL(a.href).pathname);
            if (m && m[1] !== 'all-posts') names[m[2]] = a.textContent.trim() || decodeURIComponent(m[1]).replace(/-/g, ' ');
        }
        GM_setValue(NAMES_KEY, names);
        return names;
    }

    // The saved page lazy-loads its collection grid and drops tiles scrolled past: walk it a screen
    // at a time, learning names at every step, until the bottom gives nothing new 4 times running.
    async function scrollSaved() {
        let names = learnNames();
        if (!/^\/[^/]+\/saved\/?$/.test(location.pathname)) return names;
        window.scrollTo(0, 0);
        for (let idle = 0; idle < 4;) {
            const k = Object.keys(names).length;
            status(`reading collection names ${k}`);
            window.scrollBy(0, innerHeight * 0.8);
            await sleep(PAGE_DELAY);
            names = learnNames();
            const bottom = scrollY + innerHeight >= document.documentElement.scrollHeight - 2;
            idle = Object.keys(names).length > k || !bottom ? 0 : idle + 1;
        }
        return names;
    }

    async function load() {
        const names = await scrollSaved();
        try {
            await pages('collections/list/?collection_types=' + encodeURIComponent('["MEDIA"]'),
                batch => batch.forEach(c => { names[String(c.collection_id)] = c.collection_name; }));
            GM_setValue(NAMES_KEY, names);
        } catch (e) { log('collection list unavailable', { error: e.message }); }
        // lib.next: the cursor a failed walk stopped at; a refresh within RESUME_MS continues from it
        // lib.from: when the walk began, carried across resumes; a library without it restarts
        const resume = lib?.next && Date.now() - lib.from < RESUME_MS ? lib : null;
        const items = resume ? resume.items : [];
        const from = resume ? resume.from : Date.now();
        const publish = (next) => {
            const ids = [...new Set(items.flatMap(it => it.cols))];
            lib = { items, cols: ids.map(id => ({ id, name: names[id] || 'collection ' + id })), at: Date.now(), from, next };
            GM_setValue(LIB_KEY, lib);
            render();
            return ids.filter(id => !names[id]).length;
        };
        let walked = 0;
        try {
            await pages('feed/saved/posts/', (batch, next) => {
                batch.forEach(x => x.media && items.push(normalize(
                    { ...x.media, saved_collection_ids: x.media.saved_collection_ids || x.saved_collection_ids }, items.length)));
                status(`saved ${items.length}`);
                // checkpoint: a reload mid-walk resumes from here instead of losing the walk
                if (next && ++walked % 25 === 0) { publish(next); log('refresh checkpoint', { items: items.length }); }
            }, resume?.next);
        } catch (e) {
            // instagram answers 572 for the page past the last saved post. A resumed walk that gets
            // 572 again at its first cursor, with nothing new, is at the end of the feed.
            const is572 = / 572$/.test(e.message);
            if (!(is572 && resume && items.length === resume.items.length)) {
                // keep what arrived: a partial library still shows and syncs
                if (items.length) publish(pages.at);
                throw new Error(is572
                    ? `572 after ${items.length} posts | likely the feed end | refresh again in 10 min to confirm`
                    : `${e.message} after ${items.length} posts, refresh continues from there`);
            }
            log('feed end', { items: items.length, cursor: pages.at });
        }
        const unnamed = publish('');
        log('refresh end', { items: items.length, resumed: !!resume, names: Object.keys(names).length, unnamed });
        if (unnamed) status(`${unnamed} collection names unknown: open instagram.com/<you>/saved/, then refresh`);
    }

    const shown = () => sortItems(filterItems(lib?.items || [], view, tags), view.sort);

    const allTags = () => [...new Set(Object.values(tags).flat())].sort();
    let markT;
    function render() {
        clearTimeout(markT);
        markT = setTimeout(toMark, 1000);
        const cur = view.col, cols = lib?.cols || [];
        colSel.replaceChildren(
            h('option', { value: '', textContent: 'all saved' }),
            h('option', { value: '-', textContent: 'no collection' }),
            ...cols.map(c => h('option', { value: c.id, textContent: c.name })),
            ...allTags().map(t => h('option', { value: 'tag:' + t, textContent: '#' + t })));
        colSel.value = cur;
        const tv = target.value;
        target.replaceChildren(...cols.map(c => h('option', { value: c.id, textContent: c.name })),
            h('option', { value: 'new', textContent: 'new collection…' }));
        if (tv) target.value = tv;
        renderQueue();
        graphBtn.textContent = view.graph ? 'grid' : 'graph';
        body.classList.toggle('g', view.graph && !!lib);
        if (!lib) { body.replaceChildren('no library yet — hit refresh'); return; }
        const synced = archive().posts;
        const list = shown();
        status(`${list.length} shown · ${lib.items.length} saved · ${Object.keys(synced).length} on disk · ${new Date(lib.at).toLocaleString()} · shift-click selects`);
        renderSel();
        if (view.graph) return graph(list);
        body.replaceChildren(h('div', { className: 'grid' }, ...list.map(it =>
            h('div', { className: 'tile' + (synced[it.code] ? ' done' : '') + (sel.has(it.code) ? ' sel' : ''), onclick: e => pick(e, it, e.currentTarget) },
                h('img', { src: it.thumb, loading: 'lazy', referrerPolicy: 'no-referrer' }),
                h('span', { textContent: `@${it.user}${it.type === 'photo' ? '' : ' · ' + it.type}${tags[it.code]?.length ? ' · #' + tags[it.code].join(' #') : ''}` })))));
    }

    // a modifier click, or any click once something is selected, toggles; else it opens the post
    function pick(e, it, tile) {
        if (!(e.shiftKey || e.metaKey || e.ctrlKey || sel.size)) return show(it);
        sel.has(it.code) ? sel.delete(it.code) : sel.add(it.code);
        tile?.classList.toggle('sel', sel.has(it.code));
        renderSel();
    }
    function renderSel() {
        selBar.hidden = !sel.size;
        selN.textContent = `${sel.size} selected`;
        moveBtn.hidden = !/^\d+$/.test(view.col);
        if (view.graph) graph.draw?.();
    }

    function show(it) {
        viewer.replaceChildren(
            h('div', { className: 'media' }, ...it.files.map(f => f.video
                ? h('video', { src: f.url, controls: true, loop: true })
                : h('img', { src: f.url, referrerPolicy: 'no-referrer' }))),
            h('div', { className: 'side' },
                h('a', { href: postUrl(it.code), target: '_blank', textContent: 'open post' }), ' · ',
                h('a', { href: profileUrl(it.user), target: '_blank', textContent: `@${it.user}` }),
                `\n${it.taken ? new Date(it.taken * 1000).toLocaleString() : ''}`,
                it.location ? `\n${it.location.name}` : null,
                it.tagged?.length ? `\nwith ${it.tagged.map(u => '@' + u).join(', ')}` : null,
                `\n${it.cols.map(colName).join(', ') || 'no collection'}`,
                tags[it.code]?.length ? `\n#${tags[it.code].join(' #')}` : null,
                `\n\n${it.caption}`));
        viewer.prepend(h('button', { className: 'x', textContent: '✕', onclick: () => { viewer.hidden = true; } }));
        viewer.hidden = false;
    }
    // .media fills the backdrop, so a click on its empty space closes too
    viewer.addEventListener('click', e => { if (e.target === viewer || e.target.className === 'media') viewer.hidden = true; });

    // A Blob, not a data: URL: Chromium drops URLs over 2 MB, which the inlined index.html passes.
    const save = (text, type, name) => gmDownload(new Blob([text], { type }), name);

    // GM_download never calls back when the download is blocked outright (extension not whitelisted,
    // download mode not browser api), so a hard timeout turns that into a visible failure.
    const gmDownload = (url, name) => new Promise((ok, reject) => {
        const fail = (err, raw) => {
            log('download failed', { name, error: err.message, raw, url: typeof url === 'string' ? url.split('?')[0] : 'blob' });
            reject(err);
        };
        const t = setTimeout(() => fail(new Error('no response from the tampermonkey downloader')), 60000);
        GM_download({
            url, name, conflictAction: 'overwrite', onload: () => { clearTimeout(t); ok(); },
            onerror: e => {
                clearTimeout(t);
                const why = e?.error || 'failed';
                fail(new Error(why === 'not_whitelisted' ? `${why}: add .${name.split('.').pop()} to tampermonkey's download whitelist` : why), e);
            },
            ontimeout: () => { clearTimeout(t); fail(new Error('timeout')); },
        });
    });

    // Uses the library already loaded (refresh first for new saves). Every post gets a copy in each
    // of its collections' folders (else "unsorted"); only folders it does not have yet are
    // downloaded, so a post added to another collection gets one new copy. Nothing is deleted.
    // The archive is saved after every post, so an interrupted sync resumes.
    async function sync(items) {
        if (!lib) await load();
        items ||= lib.items;
        const arc = archive();
        for (const it of lib.items) {
            const p = arc.posts[it.code];
            if (p) { p.cols = it.cols; p.order = it.order; }
        }
        const renamed = renameFolders(arc, lib.cols);
        // A post is due when a folder lacks its media or its sidecar is stale; a stale sidecar alone
        // (posts synced before sidecars, or a refresh that brought new fields) rewrites JSON only.
        const entry = (it, want, have) => {
            const media = it.files.map((f, i) => ({ p: relPath(it, i, f.url, want[0]), v: f.video, w: f.w, h: f.h, alt: f.alt || '', dur: f.dur || 0 }));
            return record(it, media, [...new Set([...have, ...want])]);
        };
        const side = (p) => sidecar(p, colName, arc.profiles[p.user]?.pic);
        const due = (it) => {
            const want = dirsOf(it, colName), have = dirsHave(arc.posts[it.code]);
            const media = want.some(d => !have.includes(d));
            return media || (it.files.length && arc.posts[it.code].side !== hash(side(entry(it, want, have))));
        };
        // A post in a collection whose name is unknown waits: its folder name is final once written,
        // and a userscript cannot move files afterwards.
        const names = GM_getValue(NAMES_KEY, {});
        // archives below sideV 2 hash sidecars that held the feed position; their hashes are adopted
        // once, so the files keep a stale order field instead of every copy being rewritten
        if (arc.sideV !== 2) {
            for (const it of lib.items) {
                const p = arc.posts[it.code];
                if (p?.side) p.side = hash(side(entry(it, dirsOf(it, colName), dirsHave(p))));
            }
            arc.sideV = 2;
        }
        const waiting = items.filter(it => it.cols.some(id => !names[id])).length;
        const todo = items.filter(it => it.cols.every(id => names[id]) && due(it));
        let n = 0, failed = 0, fetched = 0, stuck = 0;
        log('sync start', { items: items.length, todo: todo.length, waiting, renamed: renamed.length, libAge: Math.round((Date.now() - lib.at) / 60000) + ' min' });
        status(`sync 0/${todo.length}`);
        for (const it of todo) {
            n++;
            status(`sync ${n}/${todo.length} @${it.user}${failed ? ` · ${failed} failed (${status.first})` : ''}`);
            if (!arc.profiles[it.user] && it.pic) {
                const pic = `profiles/${safe(it.user)}.jpg`;
                try {
                    await gmDownload(it.pic, 'reference/' + pic);
                    arc.profiles[it.user] = { name: it.name, pic };
                } catch (e) { log('profile failed', { user: it.user, error: e.message }); }
            }
            try {
                if (!it.files.length) throw new Error('no media');
                const want = dirsOf(it, colName), have = dirsHave(arc.posts[it.code]);
                const missing = want.filter(d => !have.includes(d));
                if (missing.length && it.files.some(f => expired(f.url))) throw new Error('link expired, refresh first');
                for (const dir of missing) {
                    for (const [i, f] of it.files.entries()) await gmDownload(f.url, 'reference/' + relPath(it, i, f.url, dir));
                }
                if (missing.length) fetched++;
                // the viewer loads each post from its first folder, which now exists on disk
                const p = entry(it, want, have), json = side(p);
                for (const dir of p.dirs) {
                    await save(json, 'application/json', 'reference/' + sidecarPath(it, dir));
                }
                p.side = hash(json);
                arc.posts[it.code] = p;
                GM_setValue(ARC_KEY, arc);
                stuck = 0;
                if (missing.length) await sleep(DL_DELAY);
            } catch (e) {
                failed++;
                log('post failed', { code: it.code, user: it.user, cols: it.cols, files: it.files.map(f => ({ ext: extOf(f.url), expired: expired(f.url), host: new URL(f.url).host })), error: e.message });
                if (failed === 1) status.first = e.message;
                // tampermonkey's downloader hung: every later post would wait out the same 60 s
                if (e.message.startsWith('no response') && ++stuck === 3)
                    throw new Error(`downloads stopped answering at ${n}/${todo.length}: restart helium, then sync again`);
                await sleep(DL_DELAY);
            }
        }
        arc.cols = lib.cols;
        GM_setValue(ARC_KEY, arc);
        const html = buildIndex(arc, Date.now());
        await save(html, 'text/html', 'reference/index.html');
        render();
        log('sync end', { synced: todo.length - failed, fetched, failed, onDisk: Object.keys(arc.posts).length, renamed: renamed.length, waiting });
        status(`synced ${todo.length - failed} (${fetched} with media) · ${Object.keys(arc.posts).length} on disk${failed ? ` · ${failed} failed (${status.first}), sync again` : ''}${renamed.length ? ` · ${renamed.length} folders renamed, run tidy.py` : ''}${waiting ? ` · ${waiting} wait for collection names, refresh from /saved/` : ''}`);
    }

    const saveSelected = () => sync(lib.items.filter(it => sel.has(it.code)));

    // Own tags by post code. With a tag store set (tampermonkey menu), a couchdb database url with
    // user:password in it, each lives there as {_id: 'ig:<code>', tags}, the docs the hoard app
    // reads; else in tampermonkey storage `hoard.tags`.
    const TAGS_KEY = 'hoard.tags', STORE_KEY = 'hoard.store';
    let tags = GM_getValue(TAGS_KEY, {});
    const docs = {};  // couch docs by code, held for their _rev
    function couch(method, path, body) {
        const u = new URL(GM_getValue(STORE_KEY, ''));
        const auth = 'Basic ' + btoa(decodeURIComponent(u.username) + ':' + decodeURIComponent(u.password));
        u.username = u.password = '';
        return new Promise((ok, fail) => GM_xmlhttpRequest({
            method, url: u.href.replace(/\/?$/, '/') + path, timeout: 30000,
            headers: { Authorization: auth, 'Content-Type': 'application/json' }, data: body && JSON.stringify(body),
            onload: r => r.status < 300 ? ok(JSON.parse(r.responseText)) : fail(new Error(`tag store ${r.status}`)),
            onerror: () => fail(new Error('tag store unreachable')), ontimeout: () => fail(new Error('tag store timed out')),
        }));
    }
    async function loadTags() {
        if (!GM_getValue(STORE_KEY, '')) return;
        const k = (s) => encodeURIComponent(JSON.stringify(s));
        const d = await couch('GET', `_all_docs?include_docs=true&startkey=${k('ig:')}&endkey=${k('ig:￰')}`);
        tags = {};
        for (const row of d.rows) if (row.doc) { const c = row.id.slice(3); docs[c] = row.doc; if (row.doc.tags?.length) tags[c] = row.doc.tags; }
        GM_setValue(TAGS_KEY, tags);
    }
    async function retag(codes, fn) {
        for (const c of codes) { const t = [...new Set(fn(tags[c] || []))]; if (t.length) tags[c] = t; else delete tags[c]; }
        GM_setValue(TAGS_KEY, tags);
        if (!GM_getValue(STORE_KEY, '')) return 0;
        const body = codes.map(c => ({ ...(docs[c] || { _id: 'ig:' + c }), tags: tags[c] || [] }));
        const res = await couch('POST', '_bulk_docs', { docs: body });
        res.forEach((r, i) => { if (r.ok) docs[codes[i]] = { ...body[i], _rev: r.rev }; });
        return res.filter(r => !r.ok).length;
    }
    // Collections and own tags to mark through its page bridge (mark:add, mark:remove in mark.user.js).
    // Placeholder names (collection <id>) stay out. mark not answering: nothing is recorded as sent.
    const MARKED_KEY = 'hoard.marked';
    function askMark() {
        return new Promise((ok) => {
            const id = Math.random().toString(36).slice(2);
            const on = (e) => { let r; try { r = JSON.parse(e.detail); } catch { return; } if (r?.id === id) { done(); ok(true); } };
            const done = () => { clearTimeout(t); document.removeEventListener('mark:tags', on); };
            const t = setTimeout(() => { done(); ok(false); }, 1500);
            document.addEventListener('mark:tags', on);
            document.dispatchEvent(new CustomEvent('mark:get', { detail: JSON.stringify({ id, prefix: '-' }) }));
        });
    }
    async function toMark() {
        if (!lib?.items?.length || !await askMark()) return;
        const names = Object.fromEntries(lib.cols.filter(c => !/^collection \d+$/.test(c.name)).map(c => [c.id, c.name]));
        const { add, rm, next } = markDiff(lib.items, names, tags, GM_getValue(MARKED_KEY, {}));
        if (Object.keys(add).length) document.dispatchEvent(new CustomEvent('mark:add', { detail: JSON.stringify(add) }));
        if (Object.keys(rm).length) document.dispatchEvent(new CustomEvent('mark:remove', { detail: JSON.stringify(rm) }));
        GM_setValue(MARKED_KEY, next);
    }
    async function tagSel() {
        const text = prompt(`tags for ${sel.size} posts, space separated · -tag removes`);
        if (!text) return;
        const words = text.toLowerCase().split(/[\s,]+/).map(w => w.replace(/^#/, '')).filter(Boolean);
        const add = words.filter(w => !w.startsWith('-')), rm = words.filter(w => w.startsWith('-')).map(w => w.slice(1));
        try {
            const bad = await retag([...sel], t => [...t.filter(x => !rm.includes(x)), ...add]);
            render();
            status(`${sel.size} posts tagged${bad ? ` · ${bad} not written to the tag store, reload and retry` : ''}`);
        } catch (e) { render(); status('tags kept here, not in the tag store: ' + e.message); }
    }

    // Collection edits queue in `hoard.queue` until apply; nothing touches the account before it.
    function edit(add, move) {
        if (busy) return status('busy, wait for it to finish');
        let col = target.value;
        if (col === 'new') {
            if (!add) return status('remove needs an existing collection');
            const name = prompt('new collection name')?.trim();
            if (!name) return;
            col = 'new:' + name;
        }
        const q = GM_getValue(QUEUE_KEY, {}), items = byCode(), codes = [...sel];
        queueEdit(q, col, codes, add, c => !!items.get(c)?.cols.includes(col));
        if (move && view.col !== col) queueEdit(q, view.col, codes, false, c => !!items.get(c)?.cols.includes(view.col));
        GM_setValue(QUEUE_KEY, q);
        renderQueue();
        status(`queued · ${applyBtn.textContent} when ready`);
    }
    function renderQueue() {
        const q = GM_getValue(QUEUE_KEY, {}), ops = Object.entries(q);
        const n = ops.reduce((s, [, e]) => s + e.add.length + e.rm.length, 0);
        applyBtn.hidden = discardBtn.hidden = !n;
        applyBtn.textContent = `apply ${n}`;
        applyBtn.title = ops.map(([c, e]) => `${c.startsWith('new:') ? c.slice(4) + ' (new)' : colName(c)}${e.add.length ? ' +' + e.add.length : ''}${e.rm.length ? ' −' + e.rm.length : ''}`).join('\n');
    }

    // Sends the queue, PAGE_DELAY apart, 50 posts a call. Instagram can answer ok to an edit it
    // ignores, so each touched post's own saved_collection_ids is read back: an edit it does not
    // show goes back on the queue. A post whose info carries no ids stays as sent, unconfirmed.
    async function apply() {
        if (!lib) throw new Error('refresh first');
        const q = GM_getValue(QUEUE_KEY, {}), items = byCode(), names = GM_getValue(NAMES_KEY, {});
        const pk = (c) => items.get(c)?.id.split('_')[0];
        const ids = (cs) => JSON.stringify(cs.map(pk).filter(Boolean));
        const sent = [];
        let n = 0;
        for (const [key, e] of Object.entries(q)) {
            let col = key;
            if (key.startsWith('new:')) {
                status(`creating ${key.slice(4)}`);
                const r = await api('collections/create/', { name: key.slice(4), added_media_ids: ids(e.add), module_name: 'feed_saved_add_to_collection' });
                col = String(r.collection_id ?? r.collection?.collection_id ?? '');
                if (!col) throw new Error('collection create answered without an id');
                names[col] = key.slice(4);
                GM_setValue(NAMES_KEY, names);
            } else {
                for (let i = 0; i < Math.max(e.add.length, e.rm.length); i += 50) {
                    status(`applying ${colName(col)} ${n}`);
                    await api(`collections/${col}/edit/`, { added_media_ids: ids(e.add.slice(i, i + 50)), removed_media_ids: ids(e.rm.slice(i, i + 50)), module_name: 'feed_saved_collections' });
                    await sleep(PAGE_DELAY);
                }
            }
            sent.push([col, e]);
            n += e.add.length + e.rm.length;
            delete q[key];
            GM_setValue(QUEUE_KEY, q);
            log('collection edit', { col, add: e.add.length, rm: e.rm.length });
        }
        const touched = [...new Set(sent.flatMap(([, e]) => [...e.add, ...e.rm]))].filter(c => items.has(c));
        let i = 0, unsure = 0;
        for (const c of touched) {
            status(`checking ${++i}/${touched.length}`);
            const m = (await api(`media/${pk(c)}/info/`)).items?.[0];
            if (m?.saved_collection_ids) items.get(c).cols = m.saved_collection_ids.map(String);
            else { unsure++; items.get(c).unsure = true; }
            await sleep(300);
        }
        let missed = 0;
        for (const [col, e] of sent) for (const [add, cs] of [[true, e.add], [false, e.rm]]) {
            const bad = cs.filter(c => items.has(c) && !items.get(c).unsure && items.get(c).cols.includes(col) !== add);
            if (bad.length) { queueEdit(q, col, bad, add); missed += bad.length; }
        }
        touched.forEach(c => delete items.get(c).unsure);
        GM_setValue(QUEUE_KEY, q);
        const cols = [...new Set(lib.items.flatMap(it => it.cols))];
        lib.cols = cols.map(id => ({ id, name: names[id] || 'collection ' + id }));
        GM_setValue(LIB_KEY, lib);
        render();
        log('apply end', { sent: n, missed, unsure });
        status(`${n - missed - unsure} edits confirmed${missed ? ` · ${missed} not taken by instagram, back on the queue` : ''}${unsure ? ` · ${unsure} unconfirmed` : ''}`);
    }

    // Islands per collection and own tag (layout above), thumbs from the live CDN links.
    // Drag pans, wheel zooms, click opens or selects a post, click a heading filters by it.
    const thumbs = new Map();
    function graph(list) {
        const S = 40, hubsOf = (it) => [...it.cols.map(c => 'col:' + c), ...(tags[it.code] || []).map(t => 'tag:' + t)];
        const { islands, at } = layout(list, hubsOf, S);
        const cv = h('canvas');
        body.replaceChildren(cv);
        const ctx = cv.getContext('2d'), dpr = devicePixelRatio || 1, W = cv.clientWidth, H = cv.clientHeight;
        cv.width = W * dpr; cv.height = H * dpr;
        const label = (hub) => hub.startsWith('tag:') ? '#' + hub.slice(4) : colName(hub.slice(4));
        const b = islands.length ? [Math.min(...islands.map(i => i.x - i.r)), Math.min(...islands.map(i => i.y - i.r)) - S,
            Math.max(...islands.map(i => i.x + i.r)), Math.max(...islands.map(i => i.y + i.r))] : [-S, -S, S, S];
        const k0 = Math.min(4, 0.95 * Math.min(W / (b[2] - b[0]), H / (b[3] - b[1])));
        const T = { k: k0, x: -k0 * (b[0] + b[2]) / 2, y: -k0 * (b[1] + b[3]) / 2 };
        const heads = [];
        const img = (it) => {
            let im = thumbs.get(it.code);
            if (!im) {
                im = new Image();
                im.referrerPolicy = 'no-referrer';
                im.onload = () => graph.draw();
                im.src = it.thumb;
                thumbs.set(it.code, im);
            }
            return im.naturalWidth ? im : null;
        };
        let queued = false;
        graph.draw = () => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; if (cv.isConnected) draw(); }); } };
        function draw() {
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, cv.width, cv.height);
            ctx.setTransform(dpr * T.k, 0, 0, dpr * T.k, dpr * (W / 2 + T.x), dpr * (H / 2 + T.y));
            const x0 = (-W / 2 - T.x) / T.k - S, y0 = (-H / 2 - T.y) / T.k - S, x1 = x0 + W / T.k + 2 * S, y1 = y0 + H / T.k + 2 * S;
            for (const it of list) {
                const [x, y] = at.get(it.code);
                if (x < x0 || x > x1 || y < y0 || y > y1) continue;
                const im = S * T.k > 6 && img(it);
                if (im) ctx.drawImage(im, x - S / 2, y - S / 2, S, S);
                else { ctx.fillStyle = '#1a1a1d'; ctx.fillRect(x - S / 2, y - S / 2, S, S); }
                if (sel.has(it.code)) { ctx.strokeStyle = '#8ab4ff'; ctx.lineWidth = 3 / T.k; ctx.strokeRect(x - S / 2, y - S / 2, S, S); }
            }
            heads.length = 0;
            const fs = 13 / T.k;
            ctx.font = `600 ${fs}px system-ui`;
            ctx.textAlign = 'center';
            for (const is of islands) {
                if (!is.hub || is.r * 2 * T.k < 40) continue;
                const t = `${label(is.hub)} ${is.n}`, w = ctx.measureText(t).width, y = is.y - is.r - fs * 0.2;
                ctx.fillStyle = '#0b0b0ce0';
                ctx.fillRect(is.x - w / 2 - fs * 0.4, y - fs * 1.1, w + fs * 0.8, fs * 1.5);
                ctx.fillStyle = is.hub.startsWith('tag:') ? '#76a98a' : '#c4a26a';
                ctx.fillText(t, is.x, y);
                heads.push([is, is.x - w / 2 - fs * 0.4, y - fs * 1.1, w + fs * 0.8, fs * 1.5]);
            }
            ctx.textAlign = 'left';
        }
        const world = (e) => [(e.offsetX - W / 2 - T.x) / T.k, (e.offsetY - H / 2 - T.y) / T.k];
        let down = null;
        cv.onmousedown = (e) => { down = { x: e.clientX, y: e.clientY, tx: T.x, ty: T.y, moved: false }; };
        cv.onmousemove = (e) => {
            if (!down) return;
            T.x = down.tx + e.clientX - down.x; T.y = down.ty + e.clientY - down.y;
            down.moved ||= Math.abs(e.clientX - down.x) + Math.abs(e.clientY - down.y) > 4;
            graph.draw();
        };
        cv.onmouseup = (e) => {
            const moved = down?.moved;
            down = null;
            if (moved) return;
            const [x, y] = world(e);
            const hd = heads.find(([, hx, hy, hw, hh]) => x >= hx && x <= hx + hw && y >= hy && y <= hy + hh);
            if (hd) { view.col = hd[0].hub.startsWith('tag:') ? hd[0].hub : hd[0].hub.slice(4); view.graph = false; return render(); }
            const it = list.find(it => { const [px, py] = at.get(it.code); return Math.abs(px - x) <= S / 2 && Math.abs(py - y) <= S / 2; });
            if (it) pick(e, it);
        };
        cv.onwheel = (e) => {
            e.preventDefault();
            const [x, y] = world(e), k = Math.min(30, Math.max(0.02, T.k * Math.exp(-e.deltaY * 0.0015)));
            T.k = k; T.x = e.offsetX - W / 2 - x * k; T.y = e.offsetY - H / 2 - y * k;
            graph.draw();
        };
        draw();
    }

    function open() {
        if (!open.checked) { open.checked = true; checkUpdate(); loadTags().then(render, e => status('tag store: ' + e.message)); }
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
        if (!viewer.hidden) viewer.hidden = true;
        else if (sel.size) { sel.clear(); render(); }
        else close();
    }, true);
    // Tab reads "saved"; Instagram rewrites the title on every navigation.
    const retitle = () => { if (document.title !== 'saved') document.title = 'saved'; };
    new MutationObserver(retitle).observe(document.head, { childList: true, subtree: true, characterData: true });
    retitle();

    GM_registerMenuCommand('open hoard', open);
    GM_registerMenuCommand('sync to disk', () => run(sync));
    GM_registerMenuCommand('tag store', () => {
        const url = prompt('couchdb database url for tags, https://user:password@host/db/ · empty keeps them in tampermonkey', GM_getValue(STORE_KEY, ''));
        if (url === null) return;
        GM_setValue(STORE_KEY, url.trim());
        open();
        loadTags().then(() => { render(); status(url.trim() ? 'tag store connected' : 'tags kept in tampermonkey'); }, e => status('tag store: ' + e.message));
    });
    GM_registerMenuCommand('forget posts', () => {
        const text = prompt('post codes or urls to download again');
        if (!text) return;
        const arc = archive(), n = forget(arc, text);
        GM_setValue(ARC_KEY, arc);
        log('forget', { n });
        open();
        status(`${n} posts forgotten · refresh downloads them again`);
    });
}
