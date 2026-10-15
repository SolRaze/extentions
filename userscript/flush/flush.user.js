// ==UserScript==
// @name         flush
// @namespace    https://github.com/SolRaze/extentions/tree/main/userscript/flush
// @version      1.5
// @description  seek buttons and keys, miniplayer button, scroll gestures, sponsorblock skipping, cpu tamer, a decluttered youtube and the account's playlists tagged in mark
// @author       SolRaze
// @homepageURL  https://github.com/SolRaze/extentions
// @supportURL   https://github.com/SolRaze/extentions/issues
// @license      MIT
// @match        https://*.youtube.com/*
// @noframes
// @run-at       document-start
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @grant        GM_openInTab
// @grant        GM_info
// @grant        GM_cookie
// @grant        unsafeWindow
// @connect      sponsor.ajay.app
// @connect      greasyfork.org
// @downloadURL https://update.greasyfork.org/scripts/598191/flush.user.js
// @updateURL https://update.greasyfork.org/scripts/598191/flush.meta.js
// ==/UserScript==

// YouTube page elements hidden while the hide option is on (default). Same rules as the uBlock
// filters, so a YouTube deploy that renames a class just stops hiding that element.
const HIDE = [
    '.yt-spec-button-shape-next--enable-backdrop-filter-experiment.yt-spec-button-shape-next--icon-leading.yt-spec-button-shape-next--size-m.yt-spec-button-shape-next--overlay.yt-spec-button-shape-next--text.yt-spec-button-shape-next',
    '.yt-spec-button-shape-next--enable-backdrop-filter-experiment.yt-spec-button-shape-next--icon-only-default.yt-spec-button-shape-next--size-m.yt-spec-button-shape-next--overlay.yt-spec-button-shape-next--text.yt-spec-button-shape-next',
    'ytd-guide-section-renderer.ytd-guide-renderer.style-scope:nth-of-type(1)',
    'ytd-guide-section-renderer.ytd-guide-renderer.style-scope:nth-of-type(4)',
    'ytd-guide-section-renderer.ytd-guide-renderer.style-scope:nth-of-type(5)',
    'ytd-guide-section-renderer.ytd-guide-renderer.style-scope:nth-of-type(6)',
    'ytd-mini-guide-entry-renderer.ytd-mini-guide-renderer.style-scope:nth-of-type(2)',
    '#guide-links-primary',
    '#guide-links-secondary',
    '#copyright',
    '.ytd-guide-entry-renderer.style-scope.guide-icon',
    '#logo',
    '#header > .ytd-app.style-scope',
    '#icon > .yt-icon-button.style-scope',
    '.ytSpecButtonShapeNextEnableBackdropFilterExperiment.ytSpecButtonShapeNextIconLeading.ytSpecButtonShapeNextSizeM.ytSpecButtonShapeNextOverlay.ytSpecButtonShapeNextTonal.ytSpecButtonShapeNextHost',
    'yt-button-shape > .ytSpecButtonShapeNextEnableBackdropFilterExperiment.ytSpecButtonShapeNextIconLeading.ytSpecButtonShapeNextSizeM.ytSpecButtonShapeNextMono.ytSpecButtonShapeNextTonal.ytSpecButtonShapeNextHost',
    '.ytd-masthead.style-scope > yt-button-shape > .ytSpecButtonShapeNextEnableBackdropFilterExperiment.ytSpecButtonShapeNextIconOnlyDefault.ytSpecButtonShapeNextSizeM.ytSpecButtonShapeNextMono.ytSpecButtonShapeNextText.ytSpecButtonShapeNextHost',
    '.ytd-watch-flexy.style-scope > .ytd-donation-unavailable-renderer.style-scope',
    'ytd-badge-supported-renderer.ytd-watch-metadata.style-scope > .ytBadgeSupportedRendererHost > .ytBadgeSupportedRendererBadgeShape.badge-shape > .ytMetadataBadgeRendererHost > .ytBadgeShapeTypography.ytBadgeShapeCommerce.ytBadgeShapeHost > .ytBadgeShapeText',
    '.ytVideoMetadataCarouselViewModelHost',
    '#teaser-carousel',
    '.you-chat-entrypoint-button.ytd-menu-renderer.style-scope.ytSpecButtonViewModelHost',
];

// Pure helpers (exported for selftest)
const clampSeek = (cur, delta, dur) => {
    const t = cur + delta;
    if (t < 0) return 0;
    return dur > 0 && t > dur ? dur : t;
};
// Which way , and . should seek, or 0 to let the keypress through untouched.
// YouTube already owns these keys: frame-stepping while paused, and speed control
// with shift held. Both are left alone; we only claim them during playback.
const seekKeyDelta = ({ key, ctrlKey, metaKey, altKey, shiftKey, target }, step, paused) => {
    if (ctrlKey || metaKey || altKey || shiftKey) return 0;
    if (key !== ',' && key !== '.') return 0;
    if (paused) return 0;
    if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return 0;
    return key === '.' ? step : -step;
};

// Dotted versions compared numerically: 1.10 is newer than 1.9.
const newer = (a, b) => {
    const x = a.split('.').map(Number), y = b.split('.').map(Number);
    for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
    return false;
};
// Netscape cookies.txt as yt-dlp's --cookies reads it. The subdomain flag has to agree with the
// domain's leading dot or python's cookie jar rejects the file; expiry 0 is a session cookie.
const cookieFile = (cookies) => ['# Netscape HTTP Cookie File', ...cookies.map(c => [
    (c.httpOnly ? '#HttpOnly_' : '') + c.domain, c.domain.startsWith('.') ? 'TRUE' : 'FALSE', c.path,
    c.secure ? 'TRUE' : 'FALSE', Math.floor(c.expirationDate || 0), c.name, c.value].join('\t')), ''].join('\n');

// Innertube browse replies, playlist pages and the playlists feed alike. Read by shape, not path: videos are
// lockups of type video, playlists lockups of type playlist, the next page the first continuation token.
// playlistVideoRenderer is the older playlist layout. setVideoId is the entry's id within its playlist;
// only an owner's view carries it, and removing one copy of a duplicate needs it.
const DEAD = /^\[(?:deleted|private) video\]$/i;
const ytText = (o) => o?.content ?? o?.simpleText ?? o?.runs?.map(r => r.text).join('') ?? '';
const walk = (o, fn) => { if (o && typeof o === 'object') { fn(o); for (const v of Object.values(o)) walk(v, fn); } };
function parsePage(json) {
    const videos = [], playlists = [];
    let next = null;
    walk(json, (o) => {
        const l = o.lockupViewModel, pv = o.playlistVideoRenderer;
        if (l?.contentId) {
            const md = l.metadata?.lockupMetadataViewModel, title = ytText(md?.title);
            if (l.contentType === 'LOCKUP_CONTENT_TYPE_VIDEO') {
                let set = '', len = '';
                walk(l, (x) => { set ||= x.setVideoId || ''; len ||= x.thumbnailBadgeViewModel?.text || ''; });
                const channel = ytText(md?.metadata?.contentMetadataViewModel?.metadataRows?.[0]?.metadataParts?.[0]?.text);
                videos.push({ id: l.contentId, title, channel, len, ...(set && { set }), ...(DEAD.test(title) && { dead: true }) });
            } else if (/PLAYLIST|ALBUM|PODCAST/.test(l.contentType)) playlists.push({ id: l.contentId, title });
        } else if (pv?.videoId) {
            videos.push({ id: pv.videoId, title: ytText(pv.title), channel: ytText(pv.shortBylineText), len: ytText(pv.lengthText),
                ...(pv.setVideoId && { set: pv.setVideoId }), ...((pv.isPlayable === false || DEAD.test(ytText(pv.title))) && { dead: true }) });
        }
        next ||= o.continuationCommand?.token || o.nextContinuationData?.continuation || null;
    });
    return { videos, playlists, next };
}

// The playlist <-> mark tag link: a playlist's title is the tag. Only pairs mark has not been sent yet
// go to it, so a tag removed in mark stays removed across refreshes and becomes a removal in the plan.
// Unavailable videos are never sent, their titles are placeholders.
const videoKey = (id) => `https://youtube.com/watch?v=${id}`;
const NO_TAG = new Set(['WL']); // watch later is a queue, not a category
function newPairs(lib, sent) {
    const entries = {}, nextSent = {};
    for (const p of lib.playlists) {
        if (NO_TAG.has(p.id)) continue;
        const was = new Set(sent[p.id] || []);
        nextSent[p.id] = [...new Set([...was, ...p.videos.filter(v => !v.dead).map(v => v.id)])];
        for (const v of p.videos) {
            if (was.has(v.id) || v.dead) continue;
            was.add(v.id); // a duplicate tags once
            (entries[videoKey(v.id)] ||= { tags: [], title: v.title, type: 'video' }).tags.push(p.title);
        }
    }
    return { entries, sent: nextSent };
}
// Cleanup for the account's playlists. Remove: unavailable videos, extra copies (needs setVideoId), videos whose
// playlist tag was removed in mark. Add: videos tagged with a playlist's title in mark. Tag removals only where
// the tag still exists in mark, so a wiped or missing mark store never empties a playlist. Liked videos is not
// editable this way, playlists that refused an edit are skipped.
function planCleanup(lib, tags, sent) {
    const byTag = new Map();
    for (const [k, ts] of Object.entries(tags || {})) {
        const id = k.match(/[?&]v=([\w-]+)/)?.[1];
        if (id) for (const t of ts) (byTag.get(t) || byTag.set(t, new Set()).get(t)).add(id);
    }
    const plan = [];
    for (const p of lib.playlists) {
        if (p.id === 'LL' || p.ro) continue;
        const tagged = byTag.get(p.title), was = new Set(sent[p.id] || []), seen = new Set();
        for (const v of p.videos) {
            const why = v.dead ? 'unavailable' : seen.has(v.id) ? (v.set ? 'duplicate' : '')
                : tagged && was.has(v.id) && !tagged.has(v.id) ? 'untagged in mark' : '';
            seen.add(v.id);
            if (why) plan.push({ pl: p.id, op: 'remove', id: v.id, ...(v.set && { set: v.set }), title: v.title, why });
        }
        for (const id of tagged || []) if (!seen.has(id)) plan.push({ pl: p.id, op: 'add', id, why: 'tagged in mark' });
    }
    return plan;
}
const editAction = (o) => o.op === 'add' ? { action: 'ACTION_ADD_VIDEO', addedVideoId: o.id }
    : o.set ? { action: 'ACTION_REMOVE_VIDEO', setVideoId: o.set } : { action: 'ACTION_REMOVE_VIDEO_BY_VIDEO_ID', removedVideoId: o.id };

// Settings, all in tampermonkey storage. Toggles default on.
const DEFAULTS = { hide: true, cputamer: true, seek: true, miniplayer: true, gesture: true, 'seek-step': 10, 'gesture-sensitivity': 5,
    'sb.sponsor': true, 'sb.selfpromo': true, 'sb.interaction': true, 'sb.intro': false, 'sb.outro': false, 'sb.preview': false, 'sb.filler': false, 'sb.music_offtopic': false, 'sb-markers': false };
const cfg = (k) => GM_getValue('flush.' + k, DEFAULTS[k]);
const setCfg = (k, v) => GM_setValue('flush.' + k, v);

/*
 * CPU tamer — while a video is playing, YouTube's own code stacks hundreds of
 * setTimeout/setInterval callbacks per second. This coalesces them onto one
 * animation frame, so they cost one wakeup instead of hundreds.
 *
 * Patches the page window at document-start, before YouTube's scripts capture
 * the timer functions. Toggling it takes effect on the next page load.
 */
function tame(win) {
    // Frame-batching only pays off when frames are cheap, i.e. GPU compositing is on.
    try {
        if (!document.createElement('canvas').getContext('webgl')) return;
    } catch { return; }

    const native = {
        setTimeout: win.setTimeout.bind(win),
        setInterval: win.setInterval.bind(win),
        clearTimeout: win.clearTimeout.bind(win),
        clearInterval: win.clearInterval.bind(win)
    };
    const raf = win.requestAnimationFrame.bind(win);

    // Only tame while a video is actually running: timeupdate fires ~4x/s during playback.
    let lastVideoTick = 0;
    document.addEventListener('timeupdate', () => { lastVideoTick = Date.now(); }, true);

    // One shared promise per frame. Clearing it inside the callback *before* resolving
    // means anything scheduled by a woken handler queues for the next frame, not this one.
    let framePromise = null, frameResolve = null, frameTick = 0;
    const flushFrame = () => {
        const resolve = frameResolve;
        framePromise = frameResolve = null;
        if (resolve) resolve(++frameTick);
    };
    const nextFrame = () => framePromise || (framePromise = new Promise(resolve => {
        frameResolve = resolve;
        raf(flushFrame);
    }));

    // rAF stops firing in hidden tabs; without this, tamed timers would stall forever.
    // ponytail: 125ms is the fallback cadence, not a tuning knob — a hidden tab wants slow.
    let lastStuck = null;
    native.setInterval(() => {
        if (frameResolve && frameResolve === lastStuck) flushFrame();
        lastStuck = frameResolve;
    }, 125);

    const pending = new Set();
    const wrap = (schedule) => (fn, ms = 0, ...args) => {
        if (typeof fn !== 'function') return schedule(fn, ms, ...args); // string handlers etc.
        const handler = args.length ? fn.bind(null, ...args) : fn;
        const store = { dt: Date.now(), last: 0, cid: 0 };
        store.cid = schedule(async () => {
            const ct = Date.now();
            // Rapid-firing timer during playback -> ride the next frame with everything else.
            if (ct - lastVideoTick < 800 && ct - store.dt < 800) {
                pending.add(store.cid);
                const t = await nextFrame();
                if (!pending.delete(store.cid) || t === store.last) return; // cleared, or already ran this frame
                store.last = t;
            }
            store.dt = ct;
            try {
                handler();
            } catch (e) {
                console.error(e); // not rethrown: it would surface as an unhandled rejection instead
            }
        }, ms);
        return store.cid;
    };
    const unschedule = (clear) => (cid) => {
        pending.delete(cid); // cancels a callback currently waiting on a frame
        clear(cid);
    };

    win.setTimeout = wrap(native.setTimeout);
    win.setInterval = wrap(native.setInterval);
    win.clearTimeout = unschedule(native.clearTimeout);
    win.clearInterval = unschedule(native.clearInterval);

    // YouTube sniffs for native source on these; keep the disguise.
    for (const k of ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval']) {
        try { win[k].toString = native[k].toString.bind(native[k]); } catch { /* frozen */ }
    }
}

// Player features
const QS = (s) => document.querySelector(s);
const BTN_CLASS = 'ytp-button custom-yt-btn';

// DOM builder. YouTube enforces Trusted Types, so no innerHTML anywhere.
const SVG_TAGS = /^(svg|g|path|text)$/;
function h(tag, attrs = {}, ...kids) {
    const svg = SVG_TAGS.test(tag);
    const el = svg ? document.createElementNS('http://www.w3.org/2000/svg', tag) : document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
        if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
        else if (!svg && k in el) el[k] = v;
        else el.setAttribute(k, v);
    }
    el.append(...kids);
    return el;
}
// Glyphs are drawn on a 36 grid with a 6-unit margin; the viewBox crops to the 24px box the player's own icons use.
const icon = (...kids) => h('svg', { width: '24', height: '24', viewBox: '6 6 24 24' }, ...kids);
const ICONS = {
    mini: () => icon(h('path', { fill: '#fff', d: 'M25,17 L17,17 L17,23 L25,23 Z M29,25 L29,10.98 C29,9.88 28.1,9 27,9 L9,9 C7.9,9 7,9.88 7,10.98 L7,25 C7,26.1 7.9,27 9,27 L27,27 C28.1,27 29,26.1 29,25 Z M27,25.02 L9,25.02 L9,10.97 L27,10.97 Z' })),
    seek: (s, fwd) => icon(
        h('g', fwd ? { transform: 'translate(36,0) scale(-1,1)' } : {},
            h('path', { d: 'M18 6.3l5.6 4.2L18 14.7z', fill: '#fff' }),
            h('path', { d: 'M18 8.6a9.4 9.4 0 1 1-9.4 9.4', fill: 'none', stroke: '#fff', 'stroke-width': '2.2', 'stroke-linecap': 'round' })),
        h('text', { x: '18', y: '20', 'text-anchor': 'middle', 'dominant-baseline': 'middle', 'font-size': '9', 'font-weight': 'bold', fill: '#fff', 'font-family': 'Arial' }, String(s))),
};

function createBtn({ cls, title, svg, onClick, priority }) {
    const btn = h('button', { className: `${BTN_CLASS} ${cls}`, title, ariaLabel: title }, svg);
    if (priority) btn.dataset.priority = priority;
    if (onClick) btn.addEventListener('click', onClick);
    return btn;
}

function insertBtn(btn, refSelector, position = 'before') {
    const ref = QS(refSelector);
    if (ref && ref.parentNode) {
        position === 'before' ? ref.parentNode.insertBefore(btn, ref) : ref.parentNode.insertBefore(btn, ref.nextSibling);
    } else {
        const rc = QS('.ytp-right-controls');
        if (rc) rc.insertBefore(btn, rc.firstChild);
    }
}

function ensureMini() {
    // Skip if YouTube already renders its own miniplayer button
    if (QS('.custom-yt-mini-button') || QS('.ytp-miniplayer-button')) return;
    const btn = createBtn({ cls: 'custom-yt-mini-button', title: 'Miniplayer (i)', svg: ICONS.mini(), onClick: () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'i', keyCode: 73, bubbles: true })), priority: '7' });
    insertBtn(btn, '.ytp-settings-button', 'after');
}

const seekStep = () => Math.min(60, Math.max(1, parseInt(cfg('seek-step'), 10) || 10));
function seekBy(delta) {
    const v = QS('video');
    if (!v) return;
    v.currentTime = clampSeek(v.currentTime, delta, v.duration);
    showOverlay(`${delta > 0 ? '+' : ''}${delta}s`);
}
function removeSeek() {
    QS('.custom-yt-seek-back')?.remove();
    QS('.custom-yt-seek-fwd')?.remove();
}
function handleSeekKey(e) {
    if (!cfg('seek')) return; // rides the seek buttons toggle
    const v = QS('video');
    const delta = seekKeyDelta(e, seekStep(), !v || v.paused);
    if (!delta) return;
    e.preventDefault();
    e.stopImmediatePropagation(); // capture phase, so YouTube's own handler never sees it
    seekBy(delta);
}
function ensureSeek() {
    const step = seekStep();
    const existing = QS('.custom-yt-seek-back');
    if (existing) {
        if (existing.dataset.step === String(step)) return;
        removeSeek(); // step changed, rebuild with new icon/label
    }
    const back = createBtn({ cls: 'custom-yt-seek-back', title: `Back ${step}s`, svg: ICONS.seek(step, false), onClick: () => seekBy(-step), priority: '4' });
    const fwd = createBtn({ cls: 'custom-yt-seek-fwd', title: `Forward ${step}s`, svg: ICONS.seek(step, true), onClick: () => seekBy(step), priority: '5' });
    back.dataset.step = fwd.dataset.step = step;
    insertBtn(back, '.ytp-settings-button');
    insertBtn(fwd, '.ytp-settings-button');
}

// Gain above 100% routes the video through Web Audio. Only wired once boost is asked for:
// a suspended AudioContext silences the element.
let audioCtx, gainNode, gainVideo;
function setupAudio(v) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx || gainVideo === v) return; // graph already wired to this element
    audioCtx = audioCtx || new Ctx();
    try {
        // Throws if this element was already routed through another context
        const src = audioCtx.createMediaElementSource(v);
        gainNode = audioCtx.createGain();
        src.connect(gainNode).connect(audioCtx.destination);
    } catch {
        gainNode = null; // capped at 100%
    }
    gainVideo = v;
}

// Wheel over the player's outer 30% bands: left brightness, right volume. Listens on the
// document because overlays sit above the <video> and catch the events first.
const GESTURE_SKIP = '.ytp-chrome-bottom, .ytp-popup, .ytp-settings-menu, .ytp-panel, .ytp-ce-element, .ytp-endscreen-content, .ytp-autonav-endscreen';
function handleWheel(e) {
    if (e.ctrlKey || !cfg('gesture')) return;
    const p = e.target.closest?.('.html5-video-player');
    const v = p?.querySelector('video');
    if (!v || e.target.closest(GESTURE_SKIP)) return;
    const r = p.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    if (x > 0.3 && x < 0.7) return;
    e.preventDefault();
    e.stopPropagation();
    const delta = (e.deltaY < 0 ? 1 : -1) * (parseFloat(cfg('gesture-sensitivity')) || 5);
    x >= 0.7 ? stepVolume(p, v, delta) : stepBrightness(p, v, delta);
}
function stepVolume(p, v, delta) {
    // Player API keeps YouTube's own slider and saved volume in sync; plain element otherwise
    const api = typeof p.setVolume === 'function' ? p : unsafeWindow.document.getElementById(p.id);
    const hasApi = typeof api?.setVolume === 'function';
    const muted = hasApi ? api.isMuted() : v.muted;
    const boost = gainNode && gainVideo === v ? gainNode.gain.value : 1;
    const cur = muted ? 0 : (hasApi ? api.getVolume() : v.volume * 100) * boost;
    const next = Math.max(0, Math.min(200, Math.round(cur + delta)));
    const base = Math.min(100, next);
    if (hasApi) { api.setVolume(base); next > 0 && api.unMute(); }
    else { v.volume = base / 100; if (next > 0) v.muted = false; }
    if (next > 100 || gainVideo === v) setupAudio(v);
    if (gainNode && gainVideo === v) {
        gainNode.gain.value = Math.max(1, next / 100);
        audioCtx.resume();
    }
    showOverlay(`Volume ${gainNode && gainVideo === v ? next : base}%`, p);
}
function stepBrightness(p, v, delta) {
    const b = parseFloat(v.style.filter?.match(/brightness\(([^)]+)\)/)?.[1] || 1);
    const next = Math.max(0.1, Math.min(1, b + delta / 100));
    v.style.filter = next < 1 ? `brightness(${next})` : '';
    showOverlay(`Brightness ${Math.round(next * 100)}%`, p);
}

let ovTimeout;
function showOverlay(txt, p = QS('#movie_player')) {
    if (!p) return;
    let ov = p.querySelector(':scope > .flush-overlay');
    if (!ov) {
        ov = h('div', { className: 'flush-overlay' });
        Object.assign(ov.style, { position: 'absolute', left: '50%', top: '5%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: '2rem', padding: '0.5em 1.5em', borderRadius: '1em', zIndex: '999999', pointerEvents: 'none' });
        p.append(ov);
    }
    ov.textContent = txt; ov.style.display = 'block';
    clearTimeout(ovTimeout); ovTimeout = setTimeout(() => ov.style.display = 'none', 800);
}

// SponsorBlock: skip-type segments for the current video, skipped silently. No seek bar
// buttons; seek bar markers only with the sb-markers setting. The lookup sends only the first 4 hex chars of sha256(videoId).
const SB_API = 'https://sponsor.ajay.app/api/skipSegments/';
let sb = { id: '', segments: [], done: new Set() };
const videoId = () => new URLSearchParams(location.search).get('v') || location.pathname.match(/^\/shorts\/([\w-]{11})/)?.[1] || '';

const SB_COLORS = { sponsor: '#00d400', selfpromo: '#ffff00', interaction: '#cc00ff', intro: '#00ffff', outro: '#0202ed', preview: '#008fd6', filler: '#7300ff', music_offtopic: '#ff9900' };

// Enabled categories drawn over the progress bar. Runs on every DOM pass, so it rebuilds only when the key changes.
function renderMarkers() {
    const bar = QS('#movie_player .ytp-progress-bar');
    const v = QS('#movie_player video');
    let box = QS('.flush-sb-markers');
    const segs = cfg('sb-markers') && bar && v?.duration > 0 && sb.id === videoId() ? sb.segments.filter(s => cfg('sb.' + s.category)) : [];
    const key = segs.length ? `${sb.id}|${v.duration}|${segs.map(s => s.UUID).join()}` : '';
    if ((box?.dataset.key || '') === key && (!box || box.parentNode === bar)) return;
    box?.remove();
    if (!key) return;
    box = h('div', { className: 'flush-sb-markers' }, ...segs.map(s => {
        const d = h('div');
        d.style.cssText = `left: ${s.segment[0] / v.duration * 100}%; width: ${(s.segment[1] - s.segment[0]) / v.duration * 100}%; background: ${SB_COLORS[s.category]};`;
        return d;
    }));
    box.dataset.key = key;
    bar.append(box);
}

// Segment to skip at time t: enabled category, not skipped yet, not within its last 0.5s.
function segmentAt(segments, t, enabled, done) {
    return segments.find(s => enabled(s.category) && !done.has(s.UUID) && t >= s.segment[0] && t < s.segment[1] - 0.5);
}

async function loadSegments() {
    const id = videoId();
    if (id === sb.id) return;
    sb = { id, segments: [], done: new Set() };
    if (!id) return;
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(id)))]
        .map(b => b.toString(16).padStart(2, '0')).join('');
    const cats = encodeURIComponent(JSON.stringify(SB_CATEGORIES.map(([c]) => c)));
    GM_xmlhttpRequest({
        url: `${SB_API}${hash.slice(0, 4)}?categories=${cats}&actionTypes=${encodeURIComponent('["skip"]')}`,
        onload: (r) => {
            if (r.status !== 200 || sb.id !== id) return; // 404 = no segments for this prefix
            try { sb.segments = JSON.parse(r.responseText).find(x => x.videoID === id)?.segments || []; } catch { /* bad reply */ }
            renderMarkers();
        },
    });
}

function handleTime(e) {
    const v = e.target;
    if (!(v instanceof HTMLVideoElement) || !sb.segments.length || sb.id !== videoId()) return;
    const s = segmentAt(sb.segments, v.currentTime, (c) => cfg('sb.' + c), sb.done);
    if (!s) return;
    sb.done.add(s.UUID); // once per segment, so seeking back into it plays it
    v.currentTime = s.segment[1];
    showOverlay(`skipped ${s.category.replace('_', ' ')}`);
}

// Settings panel. Every change saves and applies at once, except the cpu tamer.
const TOGGLES = [['hide', 'hide clutter'], ['seek', 'seek buttons and , . keys'], ['miniplayer', 'miniplayer button'], ['gesture', 'wheel gestures'], ['cputamer', 'cpu tamer (reload)']];
const SB_CATEGORIES = [['sponsor', 'sponsor'], ['selfpromo', 'self promotion'], ['interaction', 'subscribe reminder'], ['intro', 'intro'], ['outro', 'outro'], ['preview', 'preview | recap'], ['filler', 'filler'], ['music_offtopic', 'non-music in music']];
const RANGES = [['seek-step', 'seek step', 1, 60, 's'], ['gesture-sensitivity', 'gesture step', 1, 20, '%']];
const PANEL_CSS = `
:host { all: initial; }
* { box-sizing: border-box; font: 13px/1.4 system-ui, sans-serif; color: inherit; }
.p { color: #e8e8ea; background: #1c1c20; border: 1px solid #ffffff1a; border-radius: 12px; padding: 12px; width: 240px;
    max-height: calc(100vh - 80px); overflow: auto; box-shadow: 0 12px 40px #0008; display: grid; gap: 6px; }
.top { display: flex; gap: 2px; align-items: center; }
.top b { flex: 1; font-weight: 600; }
.p > b { font-size: 11px; opacity: .45; margin-top: 4px; }
button { border: 0; background: none; cursor: pointer; opacity: .6; padding: 5px 8px; border-radius: 7px; white-space: nowrap; }
button:hover { opacity: 1; background: #ffffff14; }
.wide { opacity: 1; background: #ffffff0f; }
label { display: flex; align-items: center; gap: 8px; cursor: pointer; }
.r { display: grid; grid-template-columns: 1fr auto; gap: 2px 8px; }
.r input { grid-column: 1 / -1; width: 100%; }
input { accent-color: #4b6bfb; margin: 0; }
.hint { font-size: 11px; opacity: .45; overflow-wrap: anywhere; }
.hint:empty { display: none; }
`;

// Latest version from greasyfork's meta file; installing goes through tampermonkey's own page.
const META_URL = 'https://update.greasyfork.org/scripts/598191/flush.meta.js';
const latest = () => new Promise((ok, fail) => GM_xmlhttpRequest({
    method: 'GET', url: META_URL + '?t=' + Date.now(), timeout: 15000,
    onload: r => { const v = /@version\s+(\S+)/.exec(r.responseText); v ? ok(v[1]) : fail(new Error('no version in meta')); },
    onerror: () => fail(new Error('greasyfork unreachable')), ontimeout: () => fail(new Error('greasyfork timed out')),
}));

// youtube.com cookies, httpOnly ones included, saved as Downloads/youtube-cookies.txt for yt-dlp.
// Offered in private tabs only: youtube rotates the cookies of a session a browser keeps using,
// so the file has to come from a window that is closed right after.
function saveCookies(say) {
    GM_cookie.list({ domain: 'youtube.com' }, (cookies, err) => {
        if (err || !cookies?.length) return say('cookies not read: ' + (err || 'none returned'));
        if (!cookies.some(c => c.name === 'LOGIN_INFO')) return say('not signed in | sign in here, then get cookies');
        const a = h('a', { href: URL.createObjectURL(new Blob([cookieFile(cookies)], { type: 'text/plain' })), download: 'youtube-cookies.txt' });
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 10000);
        say(`${cookies.length} cookies in Downloads/youtube-cookies.txt | close this private window now`);
    });
}

// Innertube with the tab's session, the way youtube's own page calls it. SAPISIDHASH is the auth header
// youtube derives from the SAPISID cookie; X-Goog-PageId selects a brand account.
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function api(path, body) {
    const yt = unsafeWindow.ytcfg?.data_ || {};
    const sid = document.cookie.match(/(?:^|; )SAPISID=([^;]+)/)?.[1] || document.cookie.match(/(?:^|; )__Secure-3PAPISID=([^;]+)/)?.[1];
    const ts = Math.floor(Date.now() / 1000);
    const hash = sid && [...new Uint8Array(await crypto.subtle.digest('SHA-1', new TextEncoder().encode(`${ts} ${sid} ${location.origin}`)))]
        .map(b => b.toString(16).padStart(2, '0')).join('');
    const r = await fetch(`/youtubei/v1/${path}?prettyPrint=false`, { method: 'POST', credentials: 'include', body: JSON.stringify({ context: yt.INNERTUBE_CONTEXT, ...body }),
        headers: { 'content-type': 'application/json', 'x-origin': location.origin, 'x-goog-authuser': String(yt.SESSION_INDEX ?? 0),
            ...(yt.DELEGATED_SESSION_ID && { 'x-goog-pageid': yt.DELEGATED_SESSION_ID }), ...(hash && { authorization: `SAPISIDHASH ${ts}_${hash}` }),
            'x-youtube-client-name': String(yt.INNERTUBE_CONTEXT_CLIENT_NAME ?? 1), 'x-youtube-client-version': yt.INNERTUBE_CLIENT_VERSION || '' } });
    if (!r.ok) throw new Error(`${path} answered ${r.status}`);
    return r.json();
}
// Every page of a browse, 1 s apart.
async function browseAll(browseId, onPage) {
    let p = parsePage(await api('browse', { browseId }));
    for (const seen = new Set(); ; ) {
        onPage(p);
        if (!p.next || seen.has(p.next)) return;
        seen.add(p.next);
        await sleep(1000);
        p = parsePage(await api('browse', { continuation: p.next }));
    }
}

// mark's bridge, see mark:get in mark.user.js. null when mark is not installed or not answering.
function askMark(prefix) {
    return new Promise((ok) => {
        const id = Math.random().toString(36).slice(2);
        const on = (e) => { let r; try { r = JSON.parse(e.detail); } catch { return; } if (r?.id === id) { done(); ok(r.tags); } };
        const done = () => { clearTimeout(t); document.removeEventListener('mark:tags', on); };
        const t = setTimeout(() => { done(); ok(null); }, 1500);
        document.addEventListener('mark:tags', on);
        document.dispatchEvent(new CustomEvent('mark:get', { detail: JSON.stringify({ id, prefix }) }));
    });
}

// Library: the account's playlists, read-only until a plan is applied. tampermonkey storage flush.library
// {at, playlists: [{id, title, ro?, videos: [{id, title, channel, len, set?, dead?}]}]}, flush.sent {playlist id: [video ids]}.
const LIB_CSS = `
:host { all: initial; }
* { box-sizing: border-box; font: 13px/1.4 system-ui, sans-serif; color: inherit; }
.lib { position: fixed; inset: 0; color: #ddd; background: #0b0b0c; display: flex; flex-direction: column; }
.bar { display: flex; gap: 6px 12px; align-items: center; padding: 8px 10px; border-bottom: 1px solid #222; flex-wrap: wrap; }
.group { display: flex; gap: 6px; align-items: center; }
.filters { flex: 1 1 360px; min-width: 0; }
.filters select { max-width: 260px; }
.filters input { flex: 1 1 120px; min-width: 0; }
button, select, input { background: #1a1a1d; color: #ddd; border: 1px solid #333; border-radius: 6px; padding: 4px 8px; }
button { cursor: pointer; }
button:hover { background: #26262a; }
button[hidden] { display: none; }
.status { flex-basis: 100%; opacity: .7; font-size: 12px; overflow-wrap: anywhere; }
.status:empty { display: none; }
.body { flex: 1; overflow: auto; padding: 6px max(10px, calc(50vw - 560px)); }
.row { display: grid; grid-template-columns: 14px minmax(0, 1fr) minmax(0, 200px) 52px minmax(0, auto); gap: 10px; align-items: center; padding: 3px 6px; border-radius: 6px; }
.row:hover { background: #ffffff0a; }
.row a { color: inherit; text-decoration: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.row a:hover { color: #8ea2ff; }
.dim { opacity: .5; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.chips { display: flex; gap: 3px; flex-wrap: wrap; justify-content: flex-end; }
.chip { font: 600 11px/18px system-ui, sans-serif; padding: 0 6px; border-radius: 3px; white-space: nowrap; background: #ffffff14; }
.chip.tag { background: #4b6bfb33; color: #b3c0ff; }
.add { color: #7d7; } .rm { color: #e77; }
h4 { margin: 12px 0 4px; font-weight: 600; opacity: .8; }
`;
let lib;
function openLibrary() {
    if (lib) return;
    closePanel();
    const host = h('div');
    host.style.cssText = 'position: fixed; inset: 0; z-index: 2147483000;';
    // keys typed in the search must not reach the player
    for (const t of ['keydown', 'keyup', 'keypress', 'wheel']) host.addEventListener(t, (e) => e.stopPropagation());
    const root = host.attachShadow({ mode: 'closed' });
    let data = GM_getValue('flush.library', { at: 0, playlists: [] }), tags = {}, plan = null, busy = false;
    const statusEl = h('div', { className: 'status' }), body = h('div', { className: 'body' });
    const say = (t) => { statusEl.textContent = t; };
    const plSel = h('select', { onchange: () => { plan = null; draw(); } });
    const search = h('input', { placeholder: 'title or channel', oninput: () => draw() });
    const applyBtn = h('button', { hidden: true, title: 'make these changes on the account', onclick: () => run(apply) }, 'apply');
    const close = () => { host.remove(); lib = null; document.documentElement.style.overflow = ''; };

    const run = async (fn) => {
        if (busy) return;
        busy = true;
        try { await fn(); } catch (e) { say('failed: ' + e.message); } finally { busy = false; }
    };
    const loadTags = async () => { tags = (await askMark('https://youtube.com/watch?v=')) || {}; };

    async function refresh() {
        const pls = [];
        await browseAll('FEplaylist_aggregation', (p) => { pls.push(...p.playlists); say(`${pls.length} playlists`); });
        for (const [id, title] of [['WL', 'Watch later'], ['LL', 'Liked videos']]) if (!pls.some(p => p.id === id)) pls.push({ id, title });
        const old = new Map(data.playlists.map(p => [p.id, p]));
        const out = [], failed = [];
        for (const [i, p] of pls.entries()) {
            if (out.some(o => o.id === p.id)) continue;
            const videos = [];
            // a playlist that will not load keeps what the last refresh had
            const ok = await browseAll('VL' + p.id, (pg) => { videos.push(...pg.videos); say(`${i + 1}/${pls.length} ${p.title} | ${videos.length} videos`); })
                .then(() => true, (e) => { failed.push(`${p.title} (${e.message})`); return false; });
            out.push({ ...p, ...(old.get(p.id)?.ro && { ro: true }), videos: ok ? videos : old.get(p.id)?.videos || [] });
            await sleep(1000);
        }
        data = { at: Date.now(), playlists: out };
        GM_setValue('flush.library', data);
        const n = out.reduce((a, p) => a + p.videos.length, 0);
        const marked = await sendToMark();
        await loadTags();
        say(`${out.length} playlists | ${n} videos | ${marked}${failed.length ? ' | not loaded: ' + failed.join(', ') : ''}`);
        draw();
    }
    async function sendToMark() {
        if (await askMark('-') === null) return 'mark not answering, tags not sent';
        const { entries, sent } = newPairs(data, GM_getValue('flush.sent', {}));
        if (Object.keys(entries).length) document.dispatchEvent(new CustomEvent('mark:add', { detail: JSON.stringify(entries) }));
        GM_setValue('flush.sent', sent);
        return `${Object.keys(entries).length} videos tagged in mark`;
    }
    async function makePlan() {
        if (!data.at) return say('refresh first');
        const t = await askMark('https://youtube.com/watch?v=');
        if (t === null) return say('mark not answering | the plan reads tags from mark');
        tags = t;
        plan = planCleanup(data, tags, GM_getValue('flush.sent', {}));
        say(plan.length ? `${plan.length} changes | nothing is written until apply` : 'nothing to clean up');
        draw();
    }
    async function apply() {
        const by = Map.groupBy ? Map.groupBy(plan, o => o.pl) : plan.reduce((m, o) => m.set(o.pl, [...(m.get(o.pl) || []), o]), new Map());
        if (!confirm(`apply ${plan.length} changes to ${by.size} playlists on the youtube account?`)) return;
        const failed = [];
        for (const [pl, ops] of by) {
            const p = data.playlists.find(x => x.id === pl);
            for (let i = 0; i < ops.length; i += 50) {
                say(`${p.title} | ${i}/${ops.length}`);
                const r = await api('browse/edit_playlist', { playlistId: pl, actions: ops.slice(i, i + 50).map(editAction) }).catch(() => null);
                if (r?.status !== 'STATUS_SUCCEEDED') { p.ro = true; failed.push(p.title); break; }
                await sleep(1000);
            }
        }
        GM_setValue('flush.library', data);
        plan = null;
        say(failed.length ? `refused, skipped from now on: ${failed.join(', ')} | refreshing` : 'applied | refreshing');
        await refresh();
    }
    function exportLib() {
        const a = h('a', { href: URL.createObjectURL(new Blob([JSON.stringify({ ...data, tags }, null, 1)], { type: 'application/json' })), download: 'flush-playlists.json' });
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 10000);
        say('Downloads/flush-playlists.json');
    }

    function draw() {
        const pick = plSel.value;
        plSel.replaceChildren(h('option', { value: '' }, 'all playlists'), ...data.playlists.map(p => h('option', { value: p.id }, `${p.title} (${p.videos.length})`)));
        plSel.value = pick;
        applyBtn.hidden = !plan?.length;
        if (plan) {
            const title = new Map(data.playlists.flatMap(p => p.videos.map(v => [v.id, v.title])));
            const groups = data.playlists.map(p => [p, plan.filter(o => o.pl === p.id)]).filter(([, ops]) => ops.length);
            return body.replaceChildren(...groups.flatMap(([p, ops]) => [h('h4', {}, `${p.title} | ${ops.length}`),
                ...ops.map(o => h('div', { className: 'row' }, h('span', { className: o.op === 'add' ? 'add' : 'rm' }, o.op === 'add' ? '+' : '−'),
                    h('a', { href: '/watch?v=' + o.id, target: '_blank' }, o.title || title.get(o.id) || o.id), h('span', { className: 'dim' }, o.why), h('span'), h('span')))]));
        }
        const q = search.value.toLowerCase(), names = new Map(data.playlists.map(p => [p.id, p.title]));
        const vids = new Map();
        for (const p of data.playlists) if (!pick || p.id === pick) for (const v of p.videos) {
            const e = vids.get(v.id) || vids.set(v.id, { ...v, pls: new Set() }).get(v.id);
            e.pls.add(p.id);
        }
        const rows = [...vids.values()].filter(v => !q || `${v.title} ${v.channel}`.toLowerCase().includes(q));
        const shown = rows.slice(0, 500);
        body.replaceChildren(...shown.map(v => {
            const pl = [...v.pls].map(id => names.get(id));
            const own = (tags[videoKey(v.id)] || []).filter(t => !pl.includes(t));
            return h('div', { className: 'row' }, h('span', { className: 'dim' }, v.dead ? '⊘' : ''),
                h('a', { href: '/watch?v=' + v.id, target: '_blank', title: v.title }, v.title), h('span', { className: 'dim' }, v.channel), h('span', { className: 'dim' }, v.len),
                h('span', { className: 'chips' }, ...pl.map(t => h('span', { className: 'chip' }, t)), ...own.map(t => h('span', { className: 'chip tag' }, t))));
        }), rows.length > shown.length ? h('div', { className: 'dim' }, `${rows.length - shown.length} more | narrow the search`) : '');
        if (!busy && !plan) say(data.at ? `${data.playlists.length} playlists | ${rows.length} videos shown | refreshed ${new Date(data.at).toLocaleString()}` : 'refresh pulls the account\'s playlists');
    }

    root.append(h('style', {}, LIB_CSS), h('div', { className: 'lib', onkeydown: (e) => e.key === 'Escape' && (plan ? (plan = null, draw()) : close()) },
        h('div', { className: 'bar' },
            h('div', { className: 'group' },
                h('button', { title: 'pull every playlist of the account, then tag new videos in mark', onclick: () => run(refresh) }, 'refresh'),
                h('button', { title: 'what cleanup would change, nothing written', onclick: () => run(makePlan) }, 'plan'), applyBtn),
            h('div', { className: 'group filters' }, plSel, search),
            h('div', { className: 'group' },
                h('button', { title: 'Downloads/flush-playlists.json', onclick: exportLib }, 'export'),
                h('button', { title: 'close (esc)', onclick: close }, '✕')),
            statusEl),
        body));
    document.body.append(host);
    document.documentElement.style.overflow = 'hidden';
    lib = host;
    loadTags().then(draw);
    draw();
    search.focus();
}

let panel;
function buildPanel() {
    const host = h('div');
    host.style.cssText = 'position: fixed; z-index: 2147483647;';
    // The player under a fullscreen panel would treat these as its own clicks and keys
    for (const t of ['click', 'dblclick', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'wheel', 'keydown', 'keyup', 'keypress']) host.addEventListener(t, (e) => e.stopPropagation());
    const root = host.attachShadow({ mode: 'closed' });
    const hint = h('div', { className: 'hint' });
    const say = (t) => { hint.textContent = t; };
    const updateBtn = h('button', { title: 'check greasyfork for a new version', onclick: async () => {
        const mine = GM_info.script.version;
        try {
            const v = await latest();
            if (!newer(v, mine)) { updateBtn.textContent = 'update'; return say(`${mine} is the latest`); }
            say(`installing ${v} | reload the page after`);
            GM_openInTab(GM_info.script.downloadURL || META_URL.replace('.meta.js', '.user.js'), { active: true });
        } catch (e) { say('update check failed: ' + e.message); }
    } }, 'update');
    latest().then(v => { if (newer(v, GM_info.script.version)) updateBtn.textContent = `update ${v}`; }).catch(() => {});
    root.append(h('style', {}, PANEL_CSS), h('div', { className: 'p', onkeydown: (e) => e.key === 'Escape' && closePanel() },
        h('div', { className: 'top' }, h('b', {}, 'flush'), h('button', { title: 'the account\'s playlists', onclick: openLibrary }, 'playlists'), updateBtn, h('button', { title: 'close (esc)', onclick: closePanel }, '✕')),
        ...TOGGLES.map(([k, label]) => h('label', {},
            h('input', { type: 'checkbox', checked: !!cfg(k), onchange: (e) => { setCfg(k, e.target.checked); applyFeatures(); } }), label)),
        h('b', {}, 'sponsorblock skip'),
        h('label', {}, h('input', { type: 'checkbox', checked: !!cfg('sb-markers'), onchange: (e) => { setCfg('sb-markers', e.target.checked); renderMarkers(); } }), 'seek bar markers'),
        ...SB_CATEGORIES.map(([c, label]) => h('label', {},
            h('input', { type: 'checkbox', checked: !!cfg('sb.' + c), onchange: (e) => { setCfg('sb.' + c, e.target.checked); renderMarkers(); } }), label)),
        h('b', {}, 'steps'),
        ...RANGES.map(([k, label, min, max, unit]) => {
            const out = h('span', {}, cfg(k) + unit);
            return h('label', { className: 'r' }, label, out,
                h('input', { type: 'range', min, max, value: cfg(k), oninput: (e) => { out.textContent = e.target.value + unit; setCfg(k, +e.target.value); applyFeatures(); } }));
        }),
        ...(GM_info.isIncognito ? [h('b', {}, 'yt-dlp'),
            h('button', { className: 'wide', title: 'save youtube.com cookies as Downloads/youtube-cookies.txt', onclick: () => saveCookies(say) }, 'get cookies')] : []),
        hint));
    return host;
}
function closePanel() { panel?.remove(); panel = null; }
function togglePanel() {
    if (panel) return closePanel();
    panel = buildPanel();
    Object.assign(panel.style, { right: '10px', bottom: '64px' });
    (document.fullscreenElement || document.body).append(panel);
}

let hideStyle;
function applyFeatures() {
    if (hideStyle) hideStyle.disabled = !cfg('hide');
    cfg('miniplayer') ? ensureMini() : QS('.custom-yt-mini-button')?.remove();
    cfg('seek') ? ensureSeek() : removeSeek();
    renderMarkers();
}

function main() {
    if (cfg('cputamer')) tame(unsafeWindow);

    hideStyle = GM_addStyle(HIDE.map(sel => `${sel} { display: none !important; }`).join('\n'));
    hideStyle.disabled = !cfg('hide');
    GM_addStyle(`.custom-yt-btn svg { pointer-events: none; }
.flush-sb-markers { position: absolute; inset: 0; pointer-events: none; z-index: 40; }
.flush-sb-markers > div { position: absolute; top: 0; height: 100%; opacity: 0.8; }
#flush-pill { position: fixed; right: 10px; bottom: 36px; z-index: 2147482999; background: #1a1a1d; color: #ddd; border: 1px solid #333;
    border-radius: 12px; padding: 3px 10px; font: 12px system-ui; cursor: pointer; opacity: .7; }
#flush-pill:hover { opacity: 1; }`);

    GM_registerMenuCommand('settings', () => togglePanel());
    GM_registerMenuCommand('playlists', () => openLibrary());

    document.addEventListener('keydown', handleSeekKey, true);
    document.addEventListener('wheel', handleWheel, { capture: true, passive: false });
    document.addEventListener('mousedown', (e) => {
        if (panel && !e.composedPath().some(n => n === panel || n.id === 'flush-pill')) closePanel();
    }, true);
    document.addEventListener('timeupdate', handleTime, true); // media events don't bubble, capture sees them
    window.addEventListener('yt-navigate-finish', () => {
        loadSegments();
        const v = QS('video');
        if (v) v.style.filter = ''; // brightness lives on the element and would leak into the next video
        applyFeatures();
    });

    // YouTube mutates the DOM constantly. Cap this at one pass per 250ms instead of
    // rescheduling on every mutation, which never settles while the page is busy.
    let applyTimer = 0;
    const scheduleApply = () => {
        if (applyTimer) return;
        applyTimer = setTimeout(() => { applyTimer = 0; applyFeatures(); }, 250);
    };
    const observe = () => {
        // sits above mark's pill, which holds the corner
        document.body.append(h('button', { id: 'flush-pill', title: 'flush settings', onclick: togglePanel }, 'flush'));
        new MutationObserver(scheduleApply).observe(document.body, { childList: true, subtree: true }); applyFeatures(); loadSegments();
    };
    document.body ? observe() : document.addEventListener('DOMContentLoaded', observe, { once: true });
}

if (typeof module !== 'undefined') module.exports = { clampSeek, seekKeyDelta, tame, HIDE, segmentAt, newer, cookieFile, parsePage, newPairs, planCleanup, editAction };
else main();
