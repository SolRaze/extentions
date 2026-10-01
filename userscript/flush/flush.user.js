// ==UserScript==
// @name         flush
// @namespace    https://github.com/SolRaze/extentions/tree/main/userscript/flush
// @version      1.1
// @description  seek buttons and keys, miniplayer button, scroll gestures, cpu tamer and a decluttered youtube
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
// @grant        unsafeWindow
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

// Settings, all in tampermonkey storage. Toggles default on.
const DEFAULTS = { hide: true, cputamer: true, seek: true, miniplayer: true, gesture: true, 'seek-step': 10, 'gesture-sensitivity': 5 };
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
const SVG_TAGS = /^(svg|g|path|circle|text)$/;
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
const icon = (...kids) => h('svg', { width: '100%', height: '100%', viewBox: '0 0 36 36' }, ...kids);
const ICONS = {
    mini: () => icon(h('path', { fill: '#fff', d: 'M25,17 L17,17 L17,23 L25,23 Z M29,25 L29,10.98 C29,9.88 28.1,9 27,9 L9,9 C7.9,9 7,9.88 7,10.98 L7,25 C7,26.1 7.9,27 9,27 L27,27 C28.1,27 29,26.1 29,25 Z M27,25.02 L9,25.02 L9,10.97 L27,10.97 Z' })),
    seek: (s, fwd) => icon(
        h('g', fwd ? { transform: 'translate(36,0) scale(-1,1)' } : {},
            h('path', { d: 'M18 6.3l5.6 4.2L18 14.7z', fill: '#fff' }),
            h('path', { d: 'M18 8.6a9.4 9.4 0 1 1-9.4 9.4', fill: 'none', stroke: '#fff', 'stroke-width': '2.2', 'stroke-linecap': 'round' })),
        h('text', { x: '18', y: '20', 'text-anchor': 'middle', 'dominant-baseline': 'middle', 'font-size': '11', 'font-weight': 'bold', fill: '#fff', 'font-family': 'Arial' }, String(s))),
    sliders: () => icon(
        h('path', { d: 'M10 13h16M10 18h16M10 23h16', stroke: '#fff', 'stroke-width': '2', 'stroke-linecap': 'round' }),
        h('circle', { cx: '14', cy: '13', r: '2.5', fill: '#fff' }),
        h('circle', { cx: '22', cy: '18', r: '2.5', fill: '#fff' }),
        h('circle', { cx: '16', cy: '23', r: '2.5', fill: '#fff' })),
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

function ensureFlushBtn() {
    if (QS('.custom-yt-flush') || !QS('.ytp-right-controls')) return;
    insertBtn(createBtn({ cls: 'custom-yt-flush', title: 'flush settings', svg: ICONS.sliders(), onClick: (e) => togglePanel(e.currentTarget), priority: '6' }), '.ytp-settings-button');
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

// Settings panel. Every change saves and applies at once, except the cpu tamer.
const TOGGLES = [['hide', 'hide clutter'], ['seek', 'seek buttons and , . keys'], ['miniplayer', 'miniplayer button'], ['gesture', 'wheel gestures'], ['cputamer', 'cpu tamer (reload)']];
const RANGES = [['seek-step', 'seek step', 1, 60, 's'], ['gesture-sensitivity', 'gesture step', 1, 20, '%']];
const PANEL_CSS = `
.p { font: 13px/1.4 system-ui, sans-serif; color: #eee; background: #1c1c20; border: 1px solid #333; border-radius: 10px; padding: 10px 12px; width: 220px; box-shadow: 0 8px 24px #0009; display: grid; gap: 6px; }
b { font-size: 14px; }
label { display: flex; align-items: center; gap: 8px; cursor: pointer; }
.r { display: grid; grid-template-columns: 1fr auto; gap: 2px 8px; }
.r input { grid-column: 1 / -1; width: 100%; }
input { accent-color: #f33; margin: 0; }
`;
let panel;
function buildPanel() {
    const host = h('div');
    host.style.cssText = 'position: fixed; z-index: 2147483647;';
    // The player under a fullscreen panel would treat these as its own clicks and keys
    for (const t of ['click', 'dblclick', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'wheel', 'keydown', 'keyup', 'keypress']) host.addEventListener(t, (e) => e.stopPropagation());
    const root = host.attachShadow({ mode: 'closed' });
    root.append(h('style', {}, PANEL_CSS), h('div', { className: 'p', onkeydown: (e) => e.key === 'Escape' && closePanel() },
        h('b', {}, 'flush'),
        ...TOGGLES.map(([k, label]) => h('label', {},
            h('input', { type: 'checkbox', checked: !!cfg(k), onchange: (e) => { setCfg(k, e.target.checked); applyFeatures(); } }), label)),
        ...RANGES.map(([k, label, min, max, unit]) => {
            const out = h('span', {}, cfg(k) + unit);
            return h('label', { className: 'r' }, label, out,
                h('input', { type: 'range', min, max, value: cfg(k), oninput: (e) => { out.textContent = e.target.value + unit; setCfg(k, +e.target.value); applyFeatures(); } }));
        })));
    return host;
}
function closePanel() { panel?.remove(); panel = null; }
function togglePanel(anchor) {
    if (panel) return closePanel();
    panel = buildPanel();
    (document.fullscreenElement || document.body).append(panel);
    const r = anchor?.getBoundingClientRect();
    Object.assign(panel.style, r
        ? { right: `${Math.max(8, innerWidth - r.right)}px`, bottom: `${innerHeight - r.top + 8}px` }
        : { right: '20px', top: '70px' });
}

let hideStyle;
function applyFeatures() {
    if (hideStyle) hideStyle.disabled = !cfg('hide');
    ensureFlushBtn();
    cfg('miniplayer') ? ensureMini() : QS('.custom-yt-mini-button')?.remove();
    cfg('seek') ? ensureSeek() : removeSeek();
}

function main() {
    if (cfg('cputamer')) tame(unsafeWindow);

    hideStyle = GM_addStyle(HIDE.map(sel => `${sel} { display: none !important; }`).join('\n'));
    hideStyle.disabled = !cfg('hide');
    // 36-unit icons with their own margin; 36px keeps them level with the player's 24px glyphs
    GM_addStyle(`.custom-yt-btn svg { width: 36px !important; height: 36px !important; display: block; margin: auto; pointer-events: none; }`);

    GM_registerMenuCommand('settings', () => togglePanel());

    document.addEventListener('keydown', handleSeekKey, true);
    document.addEventListener('wheel', handleWheel, { capture: true, passive: false });
    document.addEventListener('mousedown', (e) => {
        const path = e.composedPath();
        if (panel && !path.includes(panel) && !path.some(n => n.classList?.contains('custom-yt-flush'))) closePanel();
    }, true);
    window.addEventListener('yt-navigate-finish', () => {
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
    const observe = () => { new MutationObserver(scheduleApply).observe(document.body, { childList: true, subtree: true }); applyFeatures(); };
    document.body ? observe() : document.addEventListener('DOMContentLoaded', observe, { once: true });
}

if (typeof module !== 'undefined') module.exports = { clampSeek, seekKeyDelta, tame, HIDE };
else main();
