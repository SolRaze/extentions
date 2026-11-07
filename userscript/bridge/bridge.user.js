// ==UserScript==
// @name         bridge
// @namespace    https://github.com/SolRaze/extentions/tree/main/userscript/bridge
// @version      1.4
// @description  open in orca, tidy makerworld and thingiverse, dark thingiverse, monotone model sites
// @author       SolRaze
// @homepageURL  https://github.com/SolRaze/extentions
// @supportURL   https://github.com/SolRaze/extentions/issues
// @license      MIT
// @match        *://*/*
// @noframes
// @run-at       document-start
// @grant        none
// @downloadURL https://update.greasyfork.org/scripts/592839/bridge.user.js
// @updateURL https://update.greasyfork.org/scripts/592839/bridge.meta.js
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

// Site clutter. coin_big.png is hidden, not blocked: a userscript cannot cancel the request.
// Thingiverse class names end in a hash that changes on every deploy, so rules match the prefix.
const THINGIVERSE_HIDE = [
    '[class*="PageHeader__pageHeaderButtonCountWrapper--"]:nth-of-type(1) > [class*="PageHeader__pageHeaderNavLink--"].tv-button--icon-solo',
    '[class*="PageHeader__counter--"]',
    '[class*="PageHeader__pageHeaderCreateButton--"]',
    '[class*="PageHeader__pageHeaderNavLink--"].tv-ad-free-cta',
    '[class*="PageHeader__fullSizeLogo--"]',
    '[class*="PageHeader__smallLogo--"]',
    '[class*="HomePageTagline__tagline--"]',
    '[class*="HomePageBanner__homeBannerSlide--"]',
    '[class*="Footer__footerBottomSection--"]',
    '[class*="Footer__footerTopSection--"]',
    '[class*="HomePage__homePageDiscoverCTA--"]',
    '[class*="PageHeader__left--"] > [class*="Dropdown__dropdown--"]:nth-of-type(1)',
    'a[class*="PageHeaderMenuItem__default--"].margin-bottom--lg[class*="PageHeaderMenuItem__pageHeaderMenuItem--"]:nth-of-type(1)',
];
// Thingiverse has no theme of its own. Semantic --tv-* tokens resolve through these primitives, so
// flipping the ramps darkens most of the site. :root:root outranks the site's later :root rule.
// --tv-white stays white: it is also the text colour on accent buttons.
const THINGIVERSE_DARK = `:root:root {
    color-scheme: dark;
    --tv-neutral-faint: #14161b; --tv-neutral-subtle: #262a33; --tv-neutral-muted: #767d90; --tv-neutral-main: #a5abba;
    --tv-neutral-strong: #c5c9d3; --tv-neutral-bold: #dcdfe6; --tv-neutral-ink: #eceef2;
    --tv-brand-faint: #141a33; --tv-brand-subtle: #1c2750; --tv-brand-muted: #3b4f9e; --tv-brand-ink: #e6e8ef;
    --tv-positive-faint: #0c211e; --tv-positive-subtle: #10302b; --tv-positive-muted: #1b6157; --tv-positive-ink: #8addd3;
    --tv-negative-faint: #2a1218; --tv-negative-subtle: #3a1722; --tv-negative-muted: #7a2a3b; --tv-negative-ink: #ffa3b4;
    --tv-warning-faint: #26210c; --tv-warning-subtle: #352d0e; --tv-warning-muted: #6b5a14; --tv-warning-ink: #ffe48b;
    --tv-highlight-faint: #1e1433; --tv-highlight-subtle: #2a1b4a; --tv-highlight-muted: #57389a; --tv-highlight-ink: #d3bdfb;
    --tv-bg-layer-01: #1c1f26; --tv-bg-layer-03: #1c1f26; --tv-bg-layer-hover-01: #262a33; --tv-bg-layer-hover-03: #262a33;
    --tv-bg-disabled: #3a4153; --tv-border-disabled: #3a4153; --tv-border-inverse: #2b303b;
    --tv-content-accent: #9dafff; --tv-content-accent-dark: #c3cfff; --tv-content-accent-light: #6f86e8;
}
[class*="HomePageTagline__brand--"] { color: var(--tv-content-accent) !important; }`;
// mw-css-* names are build hashes with no stable prefix, so a site deploy can silently stop a rule.
const MAKERWORLD_HIDE = [
    '.mw-css-1rq1hy0.expanded',
    '.mw-css-1r8ctpz',
    '.mw-css-1r97hlx.MuiLink-root > svg',
    'img[src*="/makerworld/static/assets/points/coin_big.png"]',
    '.mw-css-1jbvih8.is-new-version > svg',
    '.mw-css-1f0l885.is-new-version.upload',
    '.mw-css-1y3ojfh.user-operate-btns.MuiStack-root',
    'div.mw-css-14pbytn.expanded:nth-of-type(2) > .mw-css-1x3uo9m > li.mw-css-m4e6it > .mw-css-16xu7u0',
    '.mw-css-16xu7u0.active',
    '.mw-css-13rnsht > .mw-css-1x3uo9m > li.mw-css-m4e6it:nth-of-type(3) > .mw-css-16xu7u0',
    '.mw-css-13rnsht > .mw-css-1x3uo9m > li.mw-css-m4e6it:nth-of-type(4) > .mw-css-16xu7u0',
    'li.mw-css-m4e6it:nth-of-type(5) > .mw-css-16xu7u0',
    'li.mw-css-m4e6it:nth-of-type(6) > .mw-css-16xu7u0',
    'div.mw-css-79elbk:nth-of-type(2) > .mw-css-8x7z17 > .mw-css-1t7o07x',
    '.mw-css-p9l683 > div.mw-css-79elbk:nth-of-type(2)',
];

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

// Replaces every colour in a CSS value with the grey of equal luminance, alpha kept. url() is
// matched so a #fragment inside one is left alone. Grey maps to itself, so a rerun changes nothing.
const COLOR_RE = /url\([^)]*\)|#[0-9a-f]{3,8}\b|rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*(?:[,/]\s*([\d.]+%?)\s*)?\)|(hsla?\(\s*[^\s,]+[\s,]+)[\d.]+%?|(oklch\(\s*[\d.]+%?\s+)[\d.]+/gi;
const luma = (r, g, b) => Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
const greyCss = (value) => value.replace(COLOR_RE, (match, r, g, b, alpha, hsl, oklch) => {
    if (hsl) return `${hsl}0%`;
    if (oklch) return `${oklch}0`;
    if (r !== undefined) {
        const y = luma(+r, +g, +b);
        return alpha === undefined ? `rgb(${y}, ${y}, ${y})` : `rgba(${y}, ${y}, ${y}, ${alpha})`;
    }
    if (match[0] !== '#' || ![3, 4, 6, 8].includes(match.length - 1)) return match;
    const hex = match.length <= 5 ? [...match.slice(1)].map((c) => c + c).join('') : match.slice(1);
    const y = luma(...[0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16))).toString(16).padStart(2, '0');
    return `#${y}${y}${y}${hex.slice(6)}`;
});

if (typeof module !== 'undefined') module.exports = { extOf, isSliceable, modelUrl, deepLink, greyCss };

if (typeof document !== 'undefined') {
    // Added at document-start so the clutter never paints.
    // Monotone: site CSS is rewritten rule by rule rather than filtered, so photos and model previews
    // keep their colour and hover states go grey too. Inline svg paint is often an attribute, hence
    // the filter.
    const monotone = /(^|\.)(makerworld|thingiverse|printables|cults3d|turbosquid|stlfinder|yeggi|thangs|pinshape|cgtrader|grabcad|sketchfab|myminifactory|crealitycloud|defcad|thebasemesh|open3dmodel|free3d)\.(com|io)$/i.test(location.hostname);
    const seenSheets = new WeakSet();
    const greyStyle = (style) => {
        for (const prop of [...style]) {
            const value = style.getPropertyValue(prop);
            const grey = greyCss(value);
            if (grey !== value) style.setProperty(prop, grey, style.getPropertyPriority(prop));
        }
    };
    const greyRules = (rules) => {
        for (const rule of rules) {
            if (rule.style) greyStyle(rule.style);
            if (rule.cssRules) greyRules(rule.cssRules);
        }
    };
    const syncMonotone = () => {
        for (const sheet of [...document.styleSheets, ...document.adoptedStyleSheets]) {
            if (seenSheets.has(sheet)) continue;
            try {
                greyRules(sheet.cssRules);
                seenSheets.add(sheet);
            } catch (e) {
                // A cross-origin sheet is unreadable unless loaded with CORS, so load it again that way
                // and drop the original once the copy is in. A CDN without CORS fails the copy and
                // the original stays, coloured. A sheet still loading throws too; the next sweep retries.
                const link = sheet.ownerNode;
                if (e.name !== 'SecurityError' || !link || link.tagName !== 'LINK' || link.dataset.bridgeCors) continue;
                link.dataset.bridgeCors = '1';
                const copy = link.cloneNode();
                copy.crossOrigin = 'anonymous';
                copy.onload = () => link.remove();
                copy.onerror = () => copy.remove();
                link.after(copy);
            }
        }
        for (const el of document.querySelectorAll('[style*="rgb" i], [style*="#"], [style*="hsl" i], [style*="oklch" i]')) greyStyle(el.style);
    };
    if (monotone) {
        // CSS-in-JS libraries add rules through insertRule, which no mutation observer sees.
        const insertRule = CSSStyleSheet.prototype.insertRule;
        CSSStyleSheet.prototype.insertRule = function (rule, index = 0) {
            const at = insertRule.call(this, rule, index);
            try { greyRules([this.cssRules[at]]); } catch {}
            return at;
        };
    }

    const hideRule = (selectors) => `${selectors.join(',\n')} { display: none !important; }`;
    const css = (monotone ? 'svg { filter: grayscale(1); }\n' : '')
        + (/(^|\.)makerworld\.com$/i.test(location.hostname) ? hideRule(MAKERWORLD_HIDE)
            : /^www\.thingiverse\.com$/i.test(location.hostname) ? `${THINGIVERSE_DARK}\n${hideRule(THINGIVERSE_HIDE)}`
            : '');
    if (css) {
        const style = document.createElement('style');
        style.textContent = css;
        (document.head || document.documentElement).append(style);
    }

    // Narrowing by substring first keeps the sweep in the browser's selector engine; modelUrl then
    // throws out the near misses it lets through, like ".object" or ".stpx".
    const LINK_SELECTOR = SLICEABLE.map((ext) => `a[href*=".${ext}" i]`).join(', ');

    const chipFor = (url) => {
        const chip = document.createElement('a');
        chip.className = LINK_CLASS;
        chip.href = deepLink(url);
        chip.textContent = 'Orca';
        const name = url.split(/[?#]/)[0].split('/').pop();
        // a malformed %-escape in the name would throw and stop the sweep for the whole page
        let shown = name;
        try { shown = decodeURIComponent(name); } catch {}
        chip.title = `Open ${shown} in OrcaSlicer`;
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
        if (monotone) syncMonotone();
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
    new MutationObserver(schedule).observe(document, { childList: true, subtree: true });
    if (monotone) document.addEventListener('load', schedule, true); // a stylesheet finishing is no mutation
    schedule();
}
