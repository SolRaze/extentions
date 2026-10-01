// ==UserScript==
// @name         flush
// @namespace    https://github.com/SolRaze/extentions/tree/main/userscript/flush
// @version      1.0
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
const DEFAULTS = { hide: true, cputamer: true, seek: true, miniplayer: true, gesture: true, 'seek-use-step': true, 'seek-step': 10, 'gesture-sensitivity': 5 };
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
const CE = (t) => document.createElement(t);
const BTN_CLASS = 'ytp-button custom-yt-btn';

const SVGS = {
    mini: `<svg height="100%" viewBox="0 0 36 36" width="100%"><use class="ytp-svg-shadow" xlink:href="#ytp-id-20"></use><path d="M25,17 L17,17 L17,23 L25,23 L25,17 L25,17 Z M29,25 L29,10.98 C29,9.88 28.1,9 27,9 L9,9 C7.9,9 7,9.88 7,10.98 L7,25 C7,26.1 7.9,27 9,27 L27,27 C28.1,27 29,26.1 29,25 L29,25 Z M27,25.02 L9,25.02 L9,10.97 L27,10.97 L27,25.02 L27,25.02 Z" fill="#fff" id="ytp-id-20"></path></svg>`
};
const getSeekIcon = (s, fwd) => `<svg width="100%" height="100%" viewBox="0 0 36 36"><g transform="${fwd ? 'translate(36,0) scale(-1,1)' : ''}"><path d="M18 6.3l5.6 4.2L18 14.7z" fill="#fff"/><path d="M18 8.6a9.4 9.4 0 1 1-9.4 9.4" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></g><text x="18" y="20" text-anchor="middle" dominant-baseline="middle" font-size="11" font-weight="bold" fill="#fff" font-family="Arial">${s}</text></svg>`;

function createBtn({ cls, title, html, onClick, priority }) {
    const btn = CE('button');
    btn.className = `${BTN_CLASS} ${cls}`;
    btn.title = btn.ariaLabel = title;
    if (priority) btn.dataset.priority = priority;
    btn.innerHTML = html;
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
    const btn = createBtn({ cls: 'custom-yt-mini-button', title: 'Miniplayer (i)', html: SVGS.mini, onClick: () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'i', keyCode: 73, bubbles: true })), priority: '7' });
    insertBtn(btn, '.ytp-settings-button', 'after');
}

// Off = plain 10s jumps, ignoring the step setting. Buttons and keys both read this.
const seekStep = () => cfg('seek-use-step') === false ? 10 : Math.max(1, parseInt(cfg('seek-step'), 10) || 10);
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
    const back = createBtn({ cls: 'custom-yt-seek-back', title: `Back ${step}s`, html: getSeekIcon(step, false), onClick: () => seekBy(-step), priority: '4' });
    const fwd = createBtn({ cls: 'custom-yt-seek-fwd', title: `Forward ${step}s`, html: getSeekIcon(step, true), onClick: () => seekBy(step), priority: '5' });
    back.dataset.step = fwd.dataset.step = step;
    insertBtn(back, '.ytp-settings-button');
    insertBtn(fwd, '.ytp-settings-button');
}

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
        gainVideo = v;
    } catch {
        gainNode = null; // fall back to plain video.volume
        gainVideo = v;
    }
}
function handleWheel(e) {
    const v = e.currentTarget;
    const rect = v.getBoundingClientRect();
    const x = e.clientX - rect.left, w = rect.width;
    if (x > w * 0.3 && x < w * 0.7) return;

    const step = (parseFloat(cfg('gesture-sensitivity')) || 5) / 100;
    e.preventDefault();
    const isVol = x >= w * 0.7;
    const delta = e.deltaY < 0 ? step : -step;

    if (isVol) {
        setupAudio(v);
        if (gainNode) {
            gainNode.gain.value = Math.max(0, Math.min(2, gainNode.gain.value + delta));
            v.volume = 1;
            showOverlay(`Volume: ${Math.round(gainNode.gain.value * 100)}%`);
        } else {
            v.volume = Math.max(0, Math.min(1, v.volume + delta));
            showOverlay(`Volume: ${Math.round(v.volume * 100)}%`);
        }
    } else {
        let b = parseFloat(v.style.filter?.match(/brightness\(([^)]+)\)/)?.[1] || 1);
        b = Math.max(0.1, Math.min(1, b + delta));
        v.style.filter = `brightness(${b})`;
        showOverlay(`Brightness: ${Math.round(b * 100)}%`);
    }
}
let ovTimeout;
function showOverlay(txt) {
    let ov = document.getElementById('yt-gesture-overlay');
    if (!ov) {
        ov = CE('div'); ov.id = 'yt-gesture-overlay';
        Object.assign(ov.style, { position: 'absolute', left: '50%', top: '5%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: '2rem', padding: '0.5em 1.5em', borderRadius: '1em', zIndex: '999999', pointerEvents: 'none' });
        QS('video').parentElement.append(ov);
    }
    ov.textContent = txt; ov.style.display = 'block';
    clearTimeout(ovTimeout); ovTimeout = setTimeout(() => ov.style.display = 'none', 800);
}

function applyFeatures() {
    cfg('miniplayer') ? ensureMini() : QS('.custom-yt-mini-button')?.remove();
    cfg('seek') ? ensureSeek() : removeSeek();

    const v = QS('video');
    if (v) {
        // This runs on every DOM burst, so only touch the video when something actually changed
        const wantGesture = cfg('gesture');
        if (v.__gestureOn !== wantGesture) {
            v.__gestureOn = wantGesture;
            v.removeEventListener('wheel', handleWheel);
            if (wantGesture) {
                v.addEventListener('wheel', handleWheel, { passive: false });
                v.onwheel = e => {
                    const x = e.clientX - v.getBoundingClientRect().left;
                    if (x <= v.offsetWidth * 0.3 || x >= v.offsetWidth * 0.7) e.preventDefault();
                };
            } else {
                v.onwheel = null;
            }
        }
    }
}

function main() {
    if (cfg('cputamer')) tame(unsafeWindow);

    const hideStyle = GM_addStyle(HIDE.map(sel => `${sel} { display: none !important; }`).join('\n'));
    hideStyle.disabled = !cfg('hide');
    GM_addStyle(`.custom-yt-btn svg, .custom-yt-btn img { width: auto !important; height: auto !important; display: inline-block; pointer-events: none; transform: scale(1.5); transform-origin: center; }`);

    const toggle = (k) => { setCfg(k, !cfg(k)); applyFeatures(); };
    const askNumber = (k, label, min, max) => {
        const n = parseInt(prompt(`${label} (${min}-${max})`, cfg(k)), 10);
        if (n >= min && n <= max) { setCfg(k, n); applyFeatures(); }
    };
    GM_registerMenuCommand('hide elements on/off', () => {
        hideStyle.disabled = !hideStyle.disabled;
        setCfg('hide', !hideStyle.disabled);
    });
    GM_registerMenuCommand('seek buttons on/off', () => toggle('seek'));
    GM_registerMenuCommand('seek step or fixed 10s', () => toggle('seek-use-step'));
    GM_registerMenuCommand('seek step seconds', () => askNumber('seek-step', 'seek step seconds', 1, 60));
    GM_registerMenuCommand('miniplayer button on/off', () => toggle('miniplayer'));
    GM_registerMenuCommand('gestures on/off', () => toggle('gesture'));
    GM_registerMenuCommand('gesture sensitivity', () => askNumber('gesture-sensitivity', 'gesture step percent', 1, 20));
    GM_registerMenuCommand('cpu tamer on/off (reload)', () => setCfg('cputamer', !cfg('cputamer')));

    document.addEventListener('keydown', handleSeekKey, true);
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
