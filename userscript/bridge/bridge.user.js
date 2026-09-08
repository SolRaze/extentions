// ==UserScript==
// @name         bridge
// @namespace    https://github.com/SolRaze/extentions/tree/main/userscript/bridge
// @version      1.1
// @description  open in orca
// @author       SolRaze
// @homepageURL  https://github.com/SolRaze/extentions
// @supportURL   https://github.com/SolRaze/extentions/issues
// @license      MIT
// @match        *://*/*
// @noframes
// @run-at       document-idle
// @grant        none
// @downloadURL https://update.greasyfork.org/scripts/592839/bridge.user.js
// @updateURL https://update.greasyfork.org/scripts/592839/bridge.user.js
// ==/UserScript==

// Two ways in. Anywhere on the web, a link that points at a model file gets an Orca chip beside
// it. On Thingiverse there are no such links — downloads run through JS — so the file rows get
// their own button, which also works around Thingiverse rendering the whole "Open in <slicer>"
// group behind a viewport gate: below the 1024px tablet breakpoint the group is not hidden with
// CSS, it is never mounted, so it cannot be styled back in.

const SCHEME = 'orcaslicer';
const SLICEABLE = ['stl', '3mf', 'obj', 'step', 'stp', 'amf'];
const PILL_CLASS = 'bridge-orca-pill';
const LINK_CLASS = 'bridge-orca-link';

// Pure helpers (exported for selftest.js)
const extOf = (name) => (String(name).split('.').pop() || '').toLowerCase();
const isSliceable = (file) => !!file && !!file.public_url && SLICEABLE.includes(extOf(file.name || ''));
// The URL to hand Orca for a link, or null if the link is not a model file it can open. Orca
// fetches this itself with no browser session, so anything but plain http(s) is a dead end.
const modelUrl = (href) => {
    if (!/^https?:\/\//i.test(href)) return null;
    return SLICEABLE.includes(extOf(href.split(/[?#]/)[0])) ? href : null;
};
// OrcaSlicer matches ^(orcaslicer|prusaslicer|bambustudio|cura)://open/?\?file= and unescapes the
// payload exactly once, so the URL is encoded once here and must not be escaped beforehand.
const deepLink = (url) => `${SCHEME}://open?file=${encodeURIComponent(url)}`;

if (typeof module !== 'undefined') module.exports = { extOf, isSliceable, modelUrl, deepLink };

if (typeof document !== 'undefined') {
    // Narrowing by substring first keeps the sweep in the browser's selector engine; modelUrl then
    // throws out the near misses it lets through, like ".object" or ".stpx".
    const LINK_SELECTOR = SLICEABLE.map((ext) => `a[href*=".${ext}" i]`).join(', ');

    const chipFor = (url) => {
        const chip = document.createElement('a');
        chip.className = LINK_CLASS;
        chip.href = deepLink(url);
        chip.textContent = 'Orca';
        chip.title = `Open ${decodeURIComponent(url.split(/[?#]/)[0].split('/').pop())} in OrcaSlicer`;
        chip.style.cssText = 'margin-left:.4em;padding:0 .45em;border:1px solid currentColor;border-radius:.7em;'
            + 'font:inherit;font-size:.85em;line-height:1.5;text-decoration:none;color:inherit;opacity:.7;'
            + 'vertical-align:baseline;white-space:nowrap;';
        return chip;
    };

    const syncLinks = () => {
        for (const link of document.querySelectorAll(LINK_SELECTOR)) {
            if (link.dataset.bridgeSniffed) continue;
            link.dataset.bridgeSniffed = '1'; // marked either way, so a near miss is tested once only
            const url = modelUrl(link.href);
            if (url) link.after(chipFor(url));
        }
    };

    const fiberOf = (node) => {
        const key = Object.keys(node).find((k) => k.startsWith('__reactFiber$'));
        return key ? node[key] : null;
    };

    // A file row carries only the file's name in the DOM — the URL lives in the `thing` prop of an
    // ancestor component — so walk up the fiber tree from the row until the file list turns up.
    const filesFor = (node) => {
        for (let fiber = fiberOf(node); fiber; fiber = fiber.return) {
            const files = fiber.memoizedProps && fiber.memoizedProps.thing && fiber.memoizedProps.thing.files;
            if (Array.isArray(files)) return files;
        }
        return null;
    };

    // Cloning the row's own Download button is what keeps this looking native: Thingiverse ships
    // hashed class names that change on every deploy, so there is nothing stable to restyle against.
    const makePill = (model, file) => {
        const pill = model.cloneNode(true);
        pill.classList.add(PILL_CLASS);
        pill.textContent = 'Open in Orca';
        // Deliberately not "Open in …" — that prefix is how a native button is recognised below.
        pill.setAttribute('aria-label', `Open ${file.name} in OrcaSlicer`);
        pill.addEventListener('click', () => { window.location.href = deepLink(file.public_url); });
        return pill;
    };

    const syncFileRows = () => {
        // Widening the window past the breakpoint mounts Thingiverse's own button again, so drop
        // ours from any row that has one rather than leaving the row with two.
        for (const pill of document.querySelectorAll(`.${PILL_CLASS}`)) {
            const row = pill.parentElement;
            if (!row || row.querySelector('[aria-label^="Open in "]')) pill.remove();
        }

        for (const button of document.querySelectorAll('[aria-label^="Download "]')) {
            const row = button.parentElement;
            if (!row || row.querySelector(`.${PILL_CLASS}`)) continue;
            if (row.querySelector('[aria-label^="Open in "]')) continue;

            const files = filesFor(button);
            if (!files) continue;
            // Matching on the label is also what filters out the page's download-everything button,
            // whose label names no file in the list.
            const name = button.getAttribute('aria-label').slice('Download '.length);
            const file = files.find((f) => f.name === name);
            if (!isSliceable(file)) continue;

            row.insertBefore(makePill(button, file), button);
        }
    };

    const onThingiverse = /(^|\.)thingiverse\.com$/i.test(location.hostname);
    const sync = () => {
        syncLinks();
        if (onThingiverse) syncFileRows();
    };

    let queued = false;
    const schedule = () => {
        if (queued) return;
        queued = true;
        requestAnimationFrame(() => { queued = false; sync(); });
    };

    // Catches links added after load, and on Thingiverse also covers navigating between things,
    // opening the Files tab, and crossing the breakpoint — all re-renders rather than page loads.
    // ponytail: one document-wide observer on every site, rAF-coalesced. Narrow it to a container
    // per site only if a page turns out to churn the DOM hard enough to matter.
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
    sync();
}
