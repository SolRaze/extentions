// ==UserScript==
// @name         bridge
// @namespace    https://github.com/SolRaze/extentions/tree/main/userscript/bridge
// @version      1.0
// @description  open in orca
// @author       SolRaze
// @homepageURL  https://github.com/SolRaze/extentions
// @supportURL   https://github.com/SolRaze/extentions/issues
// @license      MIT
// @match        *://www.thingiverse.com/*
// @noframes
// @run-at       document-idle
// @grant        none
// ==/UserScript==

// Thingiverse renders the whole "Open in <slicer>" group behind a viewport gate — the group
// is mounted only when the window is wider than the 1024px tablet breakpoint. Narrowing the
// window does not hide the button with CSS, it unmounts it, so it cannot be styled back in.
// This puts an equivalent button next to each file's Download button at any width.

const SCHEME = 'orcaslicer';
const SLICEABLE = ['stl', '3mf', 'obj']; // the same extensions Thingiverse offers its own button for
const PILL_CLASS = 'bridge-orca-pill';

// Pure helpers (exported for selftest.js)
const extOf = (name) => (String(name).split('.').pop() || '').toLowerCase();
const isSliceable = (file) => !!file && !!file.public_url && SLICEABLE.includes(extOf(file.name || ''));
// OrcaSlicer matches ^(orcaslicer|prusaslicer|bambustudio|cura)://open/?\?file= and unescapes the
// payload exactly once, so the URL is encoded once here and must not be escaped beforehand.
const deepLink = (url) => `${SCHEME}://open?file=${encodeURIComponent(url)}`;

if (typeof module !== 'undefined') module.exports = { extOf, isSliceable, deepLink };

if (typeof document !== 'undefined') {
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

    const sync = () => {
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

    let queued = false;
    const schedule = () => {
        if (queued) return;
        queued = true;
        requestAnimationFrame(() => { queued = false; sync(); });
    };

    // Covers navigating between things, opening the Files tab, and crossing the breakpoint —
    // all of which reach the DOM as a re-render rather than a page load.
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
    sync();
}
