// ==UserScript==
// @name         pace
// @namespace    https://github.com/SolRaze/extentions/tree/main/userscript/pace
// @version      1.3
// @description  one pace player: every arc and episode in one list on onepace.net, intro and outro skip, autonext, watched marks; a cleaner pixeldrain list player
// @author       SolRaze
// @homepageURL  https://github.com/SolRaze/extentions
// @supportURL   https://github.com/SolRaze/extentions/issues
// @license      MIT
// @match        https://onepace.net/*watch*
// @match        https://pixeldrain.net/l/*
// @match        https://pixeldrain.com/l/*
// @match        https://pixeldrain.net/u/*
// @match        https://pixeldrain.com/u/*
// @noframes
// @run-at       document-start
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @grant        GM_openInTab
// @grant        GM_info
// @connect      greasyfork.org
// @downloadURL https://update.greasyfork.org/scripts/598867/pace.user.js
// @updateURL https://update.greasyfork.org/scripts/598867/pace.meta.js
// ==/UserScript==

// Chapter titles skipped. Newer One Pace files carry an "Opening" chapter; most carry no chapters.
const SKIP = /^(opening|intro|op|ending|ed|outro|credits|preview|next episode)\b/i;
// Bytes read from the end of a file. One Pace muxes moov last with udta/chpl at its tail.
const TAIL = 16384;
const RES = ['1080p', '720p', '480p'];

// Nero chapter box: 'chpl', version, flags, 4 reserved (v1 only), u8 count,
// then per chapter a u64 start in 100 ns units, u8 title length, utf-8 title.
function parseChpl(bytes) {
    for (let i = bytes.length - 4; i >= 0; i--) {
        if (bytes[i] !== 0x63 || bytes[i + 1] !== 0x68 || bytes[i + 2] !== 0x70 || bytes[i + 3] !== 0x6c) continue;
        const v = new DataView(bytes.buffer, bytes.byteOffset);
        let o = i + 4;
        const version = bytes[o];
        o += 4 + (version === 1 ? 4 : 0);
        const count = bytes[o++];
        const out = [];
        for (let n = 0; n < count && o + 9 <= bytes.length; n++) {
            const start = (v.getUint32(o) * 2 ** 32 + v.getUint32(o + 4)) / 1e7;
            const len = bytes[o + 8];
            const title = new TextDecoder().decode(bytes.subarray(o + 9, o + 9 + len));
            out.push({ start, title });
            o += 9 + len;
        }
        return out;
    }
    return [];
}

// Chapters to skip as [start, end) ranges; the last chapter runs to the file's end.
function skipRanges(chapters, duration) {
    return chapters
        .map((c, i) => ({ title: c.title, start: c.start, end: i + 1 < chapters.length ? chapters[i + 1].start : duration }))
        .filter((c) => SKIP.test(c.title.trim()));
}

// Source for one episode. src maps a variant label ("English Dub, Extended Cut") to { res: fileId }.
// Labels with the picked base variant win, a cut label only when alt is on; resolution falls back
// to the nearest one carried.
function pickSource(src, variant, res, alt) {
    const labels = Object.keys(src);
    const base = (l) => l.split(',')[0].trim();
    const own = labels.filter((l) => base(l) === variant);
    const pool = own.length ? own : labels;
    const label = pool.find((l) => l.includes(',') === alt) || pool[0];
    if (!label) return null;
    const have = src[label];
    const want = parseInt(res, 10);
    const r = have[res] ? res : Object.keys(have).sort((a, b) => Math.abs(parseInt(a, 10) - want) - Math.abs(parseInt(b, 10) - want))[0];
    return { label, res: r, id: have[r] };
}

// An explicit start-end range: a suffix range (bytes=-N) is not CORS-safelisted, and pixeldrain
// fails the preflight it triggers from onepace.net.
// Dotted versions compared numerically: 2.10 is newer than 2.9.
const newer = (a, b) => {
    const x = a.split('.').map(Number), y = b.split('.').map(Number);
    for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
    return false;
};
// Latest version from greasyfork's meta file; installing goes through tampermonkey's own page.
const META_URL = 'https://update.greasyfork.org/scripts/598867/pace.meta.js';
const latest = () => new Promise((ok, fail) => GM_xmlhttpRequest({
    method: 'GET', url: META_URL + '?t=' + Date.now(), timeout: 15000,
    onload: (r) => { const v = /@version\s+(\S+)/.exec(r.responseText); v ? ok(v[1]) : fail(new Error('no version in meta')); },
    onerror: () => fail(new Error('greasyfork unreachable')), ontimeout: () => fail(new Error('greasyfork timed out')),
}));

async function loadChapters(id) {
    try {
        const { size } = await (await fetch(`https://pixeldrain.net/api/file/${id}/info`)).json();
        const res = await fetch(`https://pixeldrain.net/api/file/${id}`, { headers: { Range: `bytes=${Math.max(size - TAIL, 0)}-${size - 1}` } });
        return parseChpl(new Uint8Array(await res.arrayBuffer()));
    } catch (_) {
        return [];
    }
}

// Arcs and episodes from the watch page, in page order. Each episode block is the parent of a
// ul[aria-label="Watch and download options"] holding /u/ links; arc blocks hold /l/ links and
// only mark where an arc starts. Links without a resolution label are All-in-One files.
function scrape(doc) {
    const arcs = [];
    for (const node of doc.querySelectorAll('h2[id$="-title"], ul[aria-label="Watch and download options"]')) {
        if (node.tagName === 'H2') {
            arcs.push({ slug: node.id.replace(/-title$/, ''), title: node.textContent.trim(), eps: [] });
            continue;
        }
        const arc = arcs[arcs.length - 1];
        const a = node.parentElement.querySelector('h3 a');
        if (!arc || !a) continue;
        const src = {};
        for (const li of node.querySelectorAll(':scope > li[aria-labelledby]')) {
            const label = li.querySelector(':scope > span')?.textContent.trim();
            for (const link of li.querySelectorAll('a[href*="pixeldrain.net/u/"]')) {
                const res = [...link.querySelectorAll('span')].pop()?.textContent.trim();
                if (!label || !/^\d+p$/.test(res)) continue;
                (src[label] = src[label] || {})[res] = link.getAttribute('href').split('/u/')[1];
            }
        }
        if (!Object.keys(src).length) continue;
        const [num, ...rest] = a.textContent.split(':');
        arc.eps.push({
            key: a.getAttribute('href').slice(1),
            arc: arc.slug,
            num: num.trim(),
            title: rest.join(':').trim(),
            desc: node.parentElement.querySelector('p')?.textContent.trim() || '',
            src,
        });
    }
    return arcs.filter((a) => a.eps.length);
}

if (typeof module !== 'undefined') module.exports = { parseChpl, skipRanges, pickSource, scrape, newer };

// pixeldrain list player: side bars hidden, chapters skipped, playback kept going between files.
function pixeldrain() {
    GM_addStyle(`
        .toolbar, .sharebar, .border_top, .headerbar > button.round { display: none !important; }
        .file_preview { left: 0 !important; right: 0 !important; }
        .headerbar { min-height: 0 !important; padding: 2px 8px !important; }
        .list_item_thumbnail { height: 48px !important; width: auto !important; }
        .file_preview video { width: 100% !important; height: 100% !important; object-fit: contain; background: #000; }
    `);

    const state = new WeakMap(); // video -> { id, ranges, done }
    const fileId = (video) => (video.currentSrc || video.querySelector('source')?.src || '').match(/\/api\/file\/([^/?#]+)/)?.[1];
    const next = () => [...document.querySelectorAll('.controls button')].find((b) => b.textContent.trim() === 'skip_next')?.click();

    document.addEventListener('loadedmetadata', async (e) => {
        const video = e.target;
        if (!(video instanceof HTMLVideoElement)) return;
        video.play().catch(() => {});
        const id = fileId(video);
        if (!id || state.get(video)?.id === id) return;
        const s = { id, ranges: [], done: new Set() };
        state.set(video, s);
        const chapters = await loadChapters(id);
        if (state.get(video) === s) s.ranges = skipRanges(chapters, video.duration);
    }, true);

    // Each range skips once per file, so seeking back into it plays it.
    document.addEventListener('timeupdate', (e) => {
        const video = e.target;
        const s = state.get(video);
        if (!s || s.id !== fileId(video)) return;
        for (const r of s.ranges) {
            if (video.currentTime < r.start || video.currentTime >= r.end || s.done.has(r)) continue;
            s.done.add(r);
            if (r.end >= video.duration - 1) next();
            else video.currentTime = r.end;
        }
    }, true);
}

// onepace.net watch page: the page hidden behind a list and player built from its own links.
function onepace() {
    const arcs = scrape(document);
    const eps = arcs.flatMap((a) => a.eps);
    if (!eps.length) return;

    const get = (k, d) => GM_getValue(k, d);
    const set = (k, v) => GM_setValue(k, v);
    const opt = { variant: get('variant', 'English Subtitles'), res: get('res', '1080p'), alt: get('alt', false), skip: get('skip', true), auto: get('auto', true), list: get('list', true) };
    const watched = get('watched', {}); // episode key -> 1
    const marks = get('marks', {}); // arc slug -> { intro: seconds from start, outro: seconds before end }
    const variants = [...new Set(eps.flatMap((e) => Object.keys(e.src).map((l) => l.split(',')[0].trim())))];

    GM_addStyle(`
        html.pace-on { overflow: hidden !important; }
        html.pace-on body > :not(#pace) { display: none !important; }
        @font-face { font-family: 'pace-op'; src: url(https://db.onlinewebfonts.com/t/82848488b73a87d72f2436c02b9ab608.woff2) format('woff2'), url(https://db.onlinewebfonts.com/t/82848488b73a87d72f2436c02b9ab608.woff) format('woff'); }
    `);
    const host = document.createElement('div');
    host.id = 'pace';
    document.body.append(host);
    const root = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `
        :host { all: initial; }
        * { box-sizing: border-box; }
        .app { position: fixed; inset: 0; z-index: 2147483646; display: grid; grid-template-columns: 340px 1fr; grid-template-rows: auto minmax(0, 1fr); background: #0b0d10; color: #d8dde3; font: 13px/1.4 system-ui, sans-serif; }
        .app[hidden] { display: none; }
        .app.nolist { grid-template-columns: 1fr; }
        .app.nolist aside { display: none; }
        aside { overflow-y: auto; border-right: 1px solid #1d2229; }
        header { grid-column: 1 / -1; display: flex; align-items: center; border-bottom: 1px solid #1d2229; background: #12161b; }
        .brand { width: 340px; display: flex; align-items: center; justify-content: space-between; padding: 6px 12px; border-right: 1px solid #1d2229; }
        .app.nolist .brand { width: auto; gap: 16px; border-right: 0; }
        .logo { font: 22px/1 'pace-op', system-ui, sans-serif; color: #f5c518; letter-spacing: 1px; }
        header .gear { margin-left: auto; margin-right: 12px; }
        .arc { position: sticky; top: 0; padding: 8px 12px; background: #12161b; border-bottom: 1px solid #1d2229; font-weight: 600; cursor: pointer; user-select: none; }
        .arc small { color: #6b7480; font-weight: 400; margin-left: 6px; }
        .arc.open { color: #fff; }
        .arc.cur { color: #f5c518; box-shadow: inset 3px 0 #f5c518; }
        .ep { display: flex; gap: 8px; padding: 6px 12px; cursor: pointer; align-items: baseline; }
        .ep:hover { background: #151a20; }
        .ep.cur { background: #1b2733; color: #fff; }
        .ep .n { color: #6b7480; min-width: 34px; white-space: nowrap; font-variant-numeric: tabular-nums; }
        .ep.seen .t { color: #6b7480; }
        .ep.seen .n::after { content: ' ✓'; color: #4caf50; }
        .eps[hidden] { display: none; }
        main { display: flex; flex-direction: column; min-width: 0; min-height: 0; }
        .stage { position: relative; flex: 1; min-height: 0; background: #000; }
        video { width: 100%; height: 100%; display: block; }
        video:focus, button:focus, a:focus { outline: none; }
        .ov { position: absolute; left: 50%; top: 5%; transform: translateX(-50%); background: #000b; color: #fff; font-size: 2rem; padding: 0.4em 1.4em; border-radius: 1em; pointer-events: none; }
        .ov[hidden] { display: none; }
        .icon { padding: 4px 10px; }
        .info { padding: 10px 16px; border-top: 1px solid #1d2229; }
        .bar { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; margin-bottom: 8px; user-select: none; }
        .bar .mid { grid-column: 2; display: flex; gap: 8px; }
        .bar .dl { grid-column: 3; justify-self: end; text-decoration: none; }
        .arcname { color: #6b7480; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
        .title { font-size: 16px; font-weight: 600; color: #fff; }
        .desc { color: #8a939e; margin-top: 4px; max-width: 90ch; }
        button, select, .dl { font: inherit; color: inherit; background: #1a1f26; border: 1px solid #2a313a; border-radius: 6px; padding: 4px 8px; cursor: pointer; }
        button:hover, select:hover, .dl:hover { border-color: #3d4752; }
        label { display: flex; gap: 4px; align-items: center; cursor: pointer; }
        .note { color: #6b7480; }
        .settings { position: absolute; right: 12px; top: 48px; z-index: 1; display: grid; gap: 8px; padding: 12px; background: #12161b; border: 1px solid #2a313a; border-radius: 8px; box-shadow: 0 8px 24px #0008; }
        .settings[hidden] { display: none; }
        .settings .row { display: flex; gap: 8px; }
        .pill { position: fixed; right: 16px; bottom: 16px; z-index: 2147483646; }
    `;
    root.append(style);

    const el = (tag, props = {}, ...kids) => {
        const n = Object.assign(document.createElement(tag), props);
        n.append(...kids);
        return n;
    };

    const video = el('video', { controls: true, playsInline: true, crossOrigin: 'anonymous' });
    const ov = el('div', { className: 'ov', hidden: true });
    const arcname = el('div', { className: 'arcname' });
    const dl = el('a', { className: 'dl', textContent: '↓ download', title: 'download this file' });
    const title = el('div', { className: 'title' });
    const desc = el('div', { className: 'desc' });
    const note = el('span', { className: 'note' });
    const select = (key, values) => {
        const s = el('select', {}, ...values.map((v) => el('option', { value: v, textContent: v, selected: v === opt[key] })));
        s.onchange = () => { opt[key] = s.value; set(key, s.value); play(cur, video.currentTime); };
        return s;
    };
    const check = (key, text, live) => {
        const c = el('input', { type: 'checkbox', checked: opt[key] });
        c.onchange = () => { opt[key] = c.checked; set(key, c.checked); if (live) play(cur, video.currentTime); };
        return el('label', {}, c, text);
    };
    // mousedown default would move focus onto the button and leave a ring after the click.
    const button = (text, fn) => el('button', { textContent: text, onclick: fn, onmousedown: (e) => e.preventDefault() });

    const list = el('aside');
    const rows = new Map(); // episode key -> row
    const heads = new Map(); // arc slug -> { head, box, count, arc }
    // One arc open at a time; the list reads as arcs only.
    const openArc = (slug, on) => {
        for (const [k, h] of heads) {
            h.box.hidden = !(on && k === slug);
            h.head.classList.toggle('open', !h.box.hidden);
        }
    };
    for (const arc of arcs) {
        const box = el('div', { className: 'eps', hidden: true });
        const count = el('small');
        const head = el('div', { className: 'arc', textContent: arc.title }, count);
        head.onclick = () => openArc(arc.slug, box.hidden);
        heads.set(arc.slug, { head, box, count, arc });
        for (const ep of arc.eps) {
            const row = el('div', { className: 'ep' }, el('span', { className: 'n', textContent: ep.num }), el('span', { className: 't', textContent: ep.title }));
            row.onclick = () => play(eps.indexOf(ep));
            rows.set(ep.key, row);
            box.append(row);
        }
        list.append(head, box);
    }

    const status = el('span', { className: 'note' });
    const updateBtn = button('update', async () => {
        const mine = GM_info.script.version;
        try {
            const v = await latest();
            if (!newer(v, mine)) { updateBtn.textContent = 'update'; status.textContent = `${mine} is the latest`; return; }
            status.textContent = `installing ${v} | reload the page after`;
            GM_openInTab(GM_info.script.downloadURL || META_URL.replace('.meta.js', '.user.js'), { active: true });
        } catch (e) { status.textContent = 'update check failed: ' + e.message; }
    });
    updateBtn.title = 'check greasyfork for a new version';
    latest().then((v) => { if (newer(v, GM_info.script.version)) { updateBtn.textContent = `update ${v}`; gear.textContent = 'pace •'; } }).catch(() => {});
    const gear = button('pace', () => { settings.hidden = !settings.hidden; });
    const seek = (d) => { video.currentTime = Math.min(Math.max(video.currentTime + d, 0), video.duration || 0); };
    const settings = el('div', { className: 'settings', hidden: true },
        el('div', { className: 'row' }, select('variant', variants), select('res', RES)),
        check('alt', 'alternate cuts', true),
        check('skip', 'skip intro/outro'),
        check('auto', 'autonext'),
        el('div', { className: 'row' },
            button('mark intro end', () => mark('intro', video.currentTime)),
            button('mark outro start', () => mark('outro', video.duration - video.currentTime)),
            button('clear marks', () => mark())),
        note,
        el('div', { className: 'row' }, updateBtn, button('show onepace page', () => show(false))),
        status);
    const side = button('☰', () => { opt.list = !opt.list; set('list', opt.list); app.classList.toggle('nolist', !opt.list); });
    side.title = 'episode list';
    gear.className = 'gear';
    const app = el('div', { className: 'app' + (opt.list ? '' : ' nolist') },
        el('header', {}, el('div', { className: 'brand' }, el('span', { className: 'logo', textContent: 'One Piece' }), side), gear),
        list,
        el('main', {},
            settings,
            el('div', { className: 'stage' }, video, ov),
            el('div', { className: 'info' },
                el('div', { className: 'bar' },
                    el('div', { className: 'mid' },
                        button('⏮ prev', () => play(cur - 1)),
                        button('−10s', () => seek(-10)),
                        button('+10s', () => seek(10)),
                        button('next ⏭', () => play(cur + 1))),
                    dl),
                arcname,
                title,
                desc)));
    for (const b of app.querySelectorAll('header button')) b.classList.add('icon');
    root.addEventListener('click', (e) => {
        if (!settings.hidden && !e.composedPath().some((n) => n === settings || n === gear)) settings.hidden = true;
    });
    const pill = el('button', { className: 'pill', textContent: 'pace', onclick: () => show(true) });
    root.append(app, pill);

    // The page's router rewrites <title> after load, so the tab title is held while the player shows.
    const TITLE = 'One Piece';
    const pageTitle = document.title;
    new MutationObserver(() => {
        if (!app.hidden && document.title !== TITLE) document.title = TITLE;
    }).observe(document.head, { childList: true, subtree: true, characterData: true });
    const show = (on) => {
        document.title = on ? TITLE : pageTitle;
        app.hidden = !on;
        pill.hidden = on;
        document.documentElement.classList.toggle('pace-on', on);
        if (!on) video.pause();
    };

    let cur = -1;
    let ranges = [];
    let done = new Set(); // per-file: 'intro', 'outro', chapter ranges

    const paint = () => {
        for (const ep of eps) rows.get(ep.key).classList.toggle('seen', !!watched[ep.key]);
        for (const h of heads.values()) h.count.textContent = `${h.arc.eps.filter((e) => watched[e.key]).length}/${h.arc.eps.length}`;
        const m = marks[eps[cur]?.arc];
        note.textContent = [ranges.length && `chapters: ${ranges.map((r) => r.title).join(', ')}`,
            m?.intro && `intro ${Math.round(m.intro)}s`, m?.outro && `outro last ${Math.round(m.outro)}s`].filter(Boolean).join(' · ');
    };

    function mark(kind, seconds) {
        const arc = eps[cur].arc;
        if (!kind) delete marks[arc];
        else marks[arc] = { ...marks[arc], [kind]: seconds };
        set('marks', marks);
        paint();
    }

    async function play(i, at = 0, go = true) {
        if (i < 0 || i >= eps.length) return;
        const ep = eps[i];
        const s = pickSource(ep.src, opt.variant, opt.res, opt.alt);
        if (!s) return;
        if (i !== cur) at = 0;
        rows.get(eps[cur]?.key)?.classList.remove('cur');
        heads.get(eps[cur]?.arc)?.head.classList.remove('cur');
        heads.get(ep.arc).head.classList.add('cur');
        cur = i;
        set('last', ep.key);
        const row = rows.get(ep.key);
        row.classList.add('cur');
        openArc(ep.arc, true);
        row.scrollIntoView({ block: 'nearest' });
        const arc = arcs.find((a) => a.slug === ep.arc);
        arcname.textContent = arc.title;
        title.textContent = `${ep.num} · ${ep.title}`;
        dl.href = `https://pixeldrain.net/api/file/${s.id}?download`;
        desc.textContent = `${ep.desc}  [${s.label} · ${s.res}]`;
        ranges = [];
        done = new Set();
        video.src = `https://pixeldrain.net/api/file/${s.id}`;
        video.currentTime = at;
        if (go) video.play().catch(() => {});
        paint();
        const chapters = await loadChapters(s.id);
        if (cur !== i) return;
        const apply = () => { ranges = skipRanges(chapters, video.duration); paint(); };
        if (video.duration) apply();
        else video.addEventListener('loadedmetadata', apply, { once: true });
    }

    const finish = () => {
        const key = eps[cur].key;
        if (!watched[key]) { watched[key] = 1; set('watched', watched); paint(); }
    };

    // Chapter ranges first; the arc's manual marks apply to files without chapters.
    // Each skip fires once per file, so seeking back into skipped time plays it.
    video.addEventListener('timeupdate', () => {
        const t = video.currentTime;
        const d = video.duration;
        if (!d) return;
        if (t > d * 0.9) finish();
        if (!opt.skip) return;
        for (const r of ranges) {
            if (t < r.start || t >= r.end || done.has(r)) continue;
            done.add(r);
            if (r.end >= d - 1) { finish(); if (opt.auto) play(cur + 1); }
            else video.currentTime = r.end;
            return;
        }
        if (ranges.length) return;
        const m = marks[eps[cur].arc] || {};
        if (m.intro && t < m.intro && !done.has('intro')) { done.add('intro'); video.currentTime = m.intro; }
        if (m.outro && t >= d - m.outro && !done.has('outro')) { done.add('outro'); finish(); if (opt.auto) play(cur + 1); }
    });
    video.addEventListener('ended', () => { finish(); if (opt.auto) play(cur + 1); });

    // Wheel over the video's outer 30% bands: left brightness, right volume up to 200%.
    // Gain above 100% routes the element through Web Audio, wired only once boost is asked for.
    let audio, gain, ovTimer;
    const overlay = (text) => {
        ov.textContent = text;
        ov.hidden = false;
        clearTimeout(ovTimer);
        ovTimer = setTimeout(() => { ov.hidden = true; }, 800);
    };
    video.addEventListener('wheel', (e) => {
        if (e.ctrlKey) return;
        const r = video.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        if (x > 0.3 && x < 0.7) return;
        e.preventDefault();
        const delta = e.deltaY < 0 ? 5 : -5;
        if (x < 0.3) {
            const b = parseFloat(video.style.filter.match(/brightness\(([^)]+)\)/)?.[1] || 1);
            const next = Math.max(0.1, Math.min(1, b + delta / 100));
            video.style.filter = next < 1 ? `brightness(${next})` : '';
            return overlay(`Brightness ${Math.round(next * 100)}%`);
        }
        const now = video.muted ? 0 : video.volume * 100 * (gain ? gain.gain.value : 1);
        const next = Math.max(0, Math.min(200, Math.round(now + delta)));
        video.volume = Math.min(100, next) / 100;
        if (next > 0) video.muted = false;
        if (next > 100 && !gain) {
            audio = new AudioContext();
            gain = audio.createGain();
            audio.createMediaElementSource(video).connect(gain).connect(audio.destination);
        }
        if (gain) { gain.gain.value = Math.max(1, next / 100); audio.resume(); }
        overlay(`Volume ${next}%`);
    }, { passive: false });
    // A context created outside a user activation starts suspended and silences the element.
    video.addEventListener('play', () => audio?.resume());

    document.addEventListener('keydown', (e) => {
        const t = e.composedPath()[0];
        if (app.hidden || /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName) || e.metaKey || e.ctrlKey || e.altKey) return;
        if (e.key === ',') seek(-10);
        else if (e.key === '.') seek(10);
        else if (e.key === 'Escape') settings.hidden = true;
        else if (e.key === 'n') play(cur + 1);
        else if (e.key === 'p') play(cur - 1);
    });

    const last = eps.findIndex((e) => e.key === get('last', ''));
    const first = eps.findIndex((e) => !watched[e.key]);
    show(true);
    play(last >= 0 ? last : Math.max(first, 0), 0, false);
}

if (typeof GM_addStyle !== 'undefined') {
    if (location.hostname === 'onepace.net') {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', onepace);
        else onepace();
    } else {
        pixeldrain();
    }
}
