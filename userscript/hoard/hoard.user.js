// ==UserScript==
// @name         hoard
// @namespace    https://github.com/SolRaze/extentions/tree/main/userscript/hoard
// @version      1.13
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
const RESUME_MS = 3600e3; // a stopped walk older than this restarts: its cdn links have expired

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
function sidecar(p, colName, pic) {
    const { media, dirs, cols, taken, ...rest } = p;
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

// Instagram page elements hidden while the hide option is on (default). Class names are generated
// and change between deploys: a selector that stops matching just stops hiding. One rule each,
// so a selector the browser rejects cannot drop the others.
const HIDE = [
    '.x1nhvcw1.x1oa3qoh.x1qjc9v5.xqjyukv.xdt5ytf.x2lah0s.x1c4vz4f.xryxfnj.x1plvlek.x1uhb9sk.xseo6mj.xbiv7yw.x16uus16.x1ga7v0g.x15mokao.x78zum5.xjbqb8w.x9f619.x1c1uobl.x18d9i69.xyri2b.xexx8yu.x1lziwak.xat24cr.x14z9mp.html-div',
    '.xhuyl8g.xl5mz7h > span.x1qrby5j.x7ja8zs.x1t2pt76.x1lytzrv.xedcshv.xarpa2k.x3igimt.x12ejxvf.xaigb6o.x1beo9mf.xv2umb2.x1jfb8zj.x1h9r5lt.x1h91t0o.x4k7w5x.x1vvkbs.x16tdsg8.x1hl2dhg.x1c1uobl.x18d9i69.xyri2b.xexx8yu.x1lziwak.xat24cr.x14z9mp.xdj266r.html-span > .x78zum5.x6s0dn4.x1n2onr6 > ._a6hd.x4gyw5p.x1a2a7pz.xggy1nq.x1hl2dhg.x16tdsg8.x1c1uobl.x18d9i69.xyri2b.xexx8yu.x1lziwak.xat24cr.x14z9mp.xdj266r.x3ct3a4.xt0psk2.x1ypdohk.x9f619.x14e42zd.x1qhh985.x10w94by.x972fbf.xstzfhl.x1sy0etr.x18oe1m7.x1ejq31n.xjbqb8w.x1i10hfl > .x159b3zp.x80pfx3.x1g0dm76.xsag5q8.xpdmqnj.xz9dl7a.x12dmmrz.x7nr27j.x6pnmvc.xo237n4.xjpr12u.xr9ek0c.x15x8krk.xde0f50.x5a5i1n.x1obq294.x3nfvp2.x9f619',
    '.xhuyl8g.xl5mz7h > span.x1qrby5j.x7ja8zs.x1t2pt76.x1lytzrv.xedcshv.xarpa2k.x3igimt.x12ejxvf.xaigb6o.x1beo9mf.xv2umb2.x1jfb8zj.x1h9r5lt.x1h91t0o.x4k7w5x.x1vvkbs.x16tdsg8.x1hl2dhg.x1c1uobl.x18d9i69.xyri2b.xexx8yu.x1lziwak.xat24cr.x14z9mp.xdj266r.html-span > .x1n2onr6 > ._a6hd.x4gyw5p.x1a2a7pz.xggy1nq.x1hl2dhg.x16tdsg8.x1c1uobl.x18d9i69.xyri2b.xexx8yu.x1lziwak.xat24cr.x14z9mp.xdj266r.x3ct3a4.xt0psk2.x1ypdohk.x9f619.x14e42zd.x1qhh985.x10w94by.x972fbf.xstzfhl.x1sy0etr.x18oe1m7.x1ejq31n.xjbqb8w.x1i10hfl > .xh8yej3.x1g0dm76.xsag5q8.xpdmqnj.xz9dl7a.x1q0g3np.x6s0dn4.x15x8krk.xde0f50.x5a5i1n.x1obq294.x159b3zp.x80pfx3.x12dmmrz.x7nr27j.x6pnmvc.xo237n4.xjpr12u.xr9ek0c.x3nfvp2.x9f619',
    'div:nth-of-type(5) > div > .x1qrby5j.x7ja8zs.x1t2pt76.x1lytzrv.xedcshv.xarpa2k.x3igimt.x12ejxvf.xaigb6o.x1beo9mf.xv2umb2.x1jfb8zj.x1h9r5lt.x1h91t0o.x4k7w5x.x1vvkbs.x16tdsg8.x1hl2dhg.x1c1uobl.x18d9i69.xyri2b.xexx8yu.x1lziwak.xat24cr.x14z9mp.xdj266r.html-span > .x1n2onr6 > ._a6hd.x4gyw5p.x1a2a7pz.xggy1nq.x1hl2dhg.x16tdsg8.x1c1uobl.x18d9i69.xyri2b.xexx8yu.x1lziwak.xat24cr.x14z9mp.xdj266r.x3ct3a4.xt0psk2.x1ypdohk.x9f619.x14e42zd.x1qhh985.x10w94by.x972fbf.xstzfhl.x1sy0etr.x18oe1m7.x1ejq31n.xjbqb8w.x1i10hfl > .xh8yej3.x1g0dm76.xsag5q8.xpdmqnj.xz9dl7a.x1q0g3np.x6s0dn4.x15x8krk.xde0f50.x5a5i1n.x1obq294.x159b3zp.x80pfx3.x12dmmrz.x7nr27j.x6pnmvc.xo237n4.xjpr12u.xr9ek0c.x3nfvp2.x9f619',
    '.xc26acl.xh8yej3.x1iyjqo2 > div > .x1qrby5j.x7ja8zs.x1t2pt76.x1lytzrv.xedcshv.xarpa2k.x3igimt.x12ejxvf.xaigb6o.x1beo9mf.xv2umb2.x1jfb8zj.x1h9r5lt.x1h91t0o.x4k7w5x.x1vvkbs.x16tdsg8.x1hl2dhg.x1c1uobl.x18d9i69.xyri2b.xexx8yu.x1lziwak.xat24cr.x14z9mp.xdj266r.html-span > .x1n2onr6 > ._a6hd.x4gyw5p.x1a2a7pz.xggy1nq.x1hl2dhg.x16tdsg8.x1c1uobl.x18d9i69.xyri2b.xexx8yu.x1lziwak.xat24cr.x14z9mp.xdj266r.x3ct3a4.xt0psk2.x1ypdohk.x9f619.x14e42zd.x1qhh985.x10w94by.x972fbf.xstzfhl.x1sy0etr.x18oe1m7.x1ejq31n.xjbqb8w.x1i10hfl > .xh8yej3.x1g0dm76.xsag5q8.xpdmqnj.xz9dl7a.x1q0g3np.x6s0dn4.x15x8krk.xde0f50.x5a5i1n.x1obq294.x159b3zp.x80pfx3.x12dmmrz.x7nr27j.x6pnmvc.xo237n4.xjpr12u.xr9ek0c.x3nfvp2.x9f619',
    '.x1n2onr6 > .x1qrby5j.x7ja8zs.x1t2pt76.x1lytzrv.xedcshv.xarpa2k.x3igimt.x12ejxvf.xaigb6o.x1beo9mf.xv2umb2.x1jfb8zj.x1h9r5lt.x1h91t0o.x4k7w5x.x1vvkbs.x16tdsg8.x1hl2dhg.x1c1uobl.x18d9i69.xyri2b.xexx8yu.x1lziwak.xat24cr.x14z9mp.xdj266r.html-span > .x1n2onr6 > ._a6hd.x4gyw5p.x1a2a7pz.xggy1nq.x1hl2dhg.x16tdsg8.x1c1uobl.x18d9i69.xyri2b.xexx8yu.x1lziwak.xat24cr.x14z9mp.xdj266r.x3ct3a4.xt0psk2.x1ypdohk.x9f619.x14e42zd.x1qhh985.x10w94by.x972fbf.xstzfhl.x1sy0etr.x18oe1m7.x1ejq31n.xjbqb8w.x1i10hfl > .xh8yej3.x1g0dm76.xsag5q8.xpdmqnj.xz9dl7a.x1q0g3np.x6s0dn4.x15x8krk.xde0f50.x5a5i1n.x1obq294.x159b3zp.x80pfx3.x12dmmrz.x7nr27j.x6pnmvc.xo237n4.xjpr12u.xr9ek0c.x3nfvp2.x9f619',
    '.xc26acl.xh8yej3.x1iyjqo2 > div > div > div > .x1qrby5j.x7ja8zs.x1t2pt76.x1lytzrv.xedcshv.xarpa2k.x3igimt.x12ejxvf.xaigb6o.x1beo9mf.xv2umb2.x1jfb8zj.x1h9r5lt.x1h91t0o.x4k7w5x.x1vvkbs.x16tdsg8.x1hl2dhg.x1c1uobl.x18d9i69.xyri2b.xexx8yu.x1lziwak.xat24cr.x14z9mp.xdj266r.html-span > .x1n2onr6 > ._a6hd.x4gyw5p.x1a2a7pz.xggy1nq.x1hl2dhg.x16tdsg8.x1c1uobl.x18d9i69.xyri2b.xexx8yu.x1lziwak.xat24cr.x14z9mp.xdj266r.x3ct3a4.xt0psk2.x1ypdohk.x9f619.x14e42zd.x1qhh985.x10w94by.x972fbf.xstzfhl.x1sy0etr.x18oe1m7.x1ejq31n.xjbqb8w.x1i10hfl > .xh8yej3.x1g0dm76.xsag5q8.xpdmqnj.xz9dl7a.x1q0g3np.x6s0dn4.x15x8krk.xde0f50.x5a5i1n.x1obq294.x159b3zp.x80pfx3.x12dmmrz.x7nr27j.x6pnmvc.xo237n4.xjpr12u.xr9ek0c.x3nfvp2.x9f619',
    '.xn3w4p2.x1nhvcw1.x1oa3qoh.x1qjc9v5.xqjyukv.xdt5ytf.x2lah0s.x1c4vz4f.xryxfnj.x1plvlek.x1uhb9sk.x1y1aw1k.xwib8y2.xf7dkkf.xv54qhq.xbiv7yw.x16uus16.x1ga7v0g.x15mokao.x78zum5.xjbqb8w.x9f619.x1lziwak.xat24cr.x14z9mp.xdj266r.html-div',
    '.xc26acl.xh8yej3.x1iyjqo2',
    '.xh8yej3.x1g0dm76.xpdmqnj.x1p5oq8j.xwxc41k.x1qughib.x1gvbg2u.xdt5ytf.x78zum5.x9f619.x1cy8zhl > .xh8yej3.x1n2onr6',
    '.xh8yej3.x1g0dm76.xpdmqnj.x1p5oq8j.xwxc41k.x1qughib.x1gvbg2u.xdt5ytf.x78zum5.x9f619.x1cy8zhl',
    '.xfk6m8.x1rohswg.x1n2onr6.x10wlt62.xw2csxc.x5yr21d.x1q0g3np.x78zum5.x1qjc9v5',
    '.xh8yej3.x11njtxf.x1n2onr6.x5yr21d.xk390pu.xln7xf2.xdt5ytf.x78zum5.x9f619.x1qjc9v5',
    '.x1qe1wrf.x19app5s.x7ep2pv.xwy3nlu.xdj266r.x178p66w.x1yztbdb.xvc5jky.x11t971q',
    '._a6hd.xlxy82.x1q0q8m5.x16stqrj.x1xnnf8n.x106a9eq.xn3w4p2.x1c4vz4f.x1lku1pv.x1hl2dhg.xl56j7k.x1q0g3np.x78zum5.x6s0dn4.x1a2a7pz.xggy1nq.x16tdsg8.x18d9i69.xexx8yu.x1lziwak.xat24cr.x14z9mp.xdj266r.x3ct3a4.x1ypdohk.x9f619.x14e42zd.x10w94by.x972fbf.xstzfhl.x18oe1m7.x1ejq31n.xjbqb8w.x1i10hfl',
    '.xed3198.x1kylhsf.x4yb96v.xysibl7.x1ddxa5k.xf7dkkf.xv54qhq.xnnlda6.xpilrb4.xso031l.x1lun4ml.x178xt8z.xly64p6.xdwr3uu.x10qfohq.x6zsckl.x1n2onr6.xl56j7k.x3nfvp2.x1w60jca.x1t7ytsu.x1q0q8m5.x18b5jzi.x13fuv20.x1o29io0.xvhwddo.x11ppq56.x1ss9elp.x7r02ix.x6s0dn4.x1a2a7pz.x1lku1pv.x87ps6o.x1q0g3np.x1t137rt.x1ja2u2z.xggy1nq.x1hl2dhg.x16tdsg8.x18d9i69.xexx8yu.xeuugli.x2lwn1j.x1lziwak.xat24cr.x14z9mp.xdj266r.x3ct3a4.x2lah0s.xdl72j9.x1ypdohk.x9f619.x1i10hfl',
    '.xl56j7k.x1oa3qoh.x1qjc9v5.xqjyukv.x1a02dak.x1q0g3np.x2lah0s.x1c4vz4f.xryxfnj.x1plvlek.x1n2onr6.xbiv7yw.x16uus16.x1ga7v0g.x15mokao.x78zum5.xjbqb8w.x9f619.x1c1uobl.x18d9i69.xyri2b.xexx8yu.x1lziwak.xat24cr.x14z9mp.xdj266r.html-div',
    '.x1nhvcw1.x1oa3qoh.x1qjc9v5.xqjyukv.xdt5ytf.x2lah0s.x1c4vz4f.xryxfnj.x1plvlek.x1n2onr6.xyqm7xq.xbiv7yw.x16uus16.x1ga7v0g.x15mokao.x78zum5.xjbqb8w.x9f619.x1c1uobl.x18d9i69.xyri2b.xexx8yu.xat24cr.x14z9mp.xdj266r.html-div > .x676frb.x1s3etm8.x1roi4f4.xo1l8bm.x1fhwpqd.x1i0vuye.x1943h6x.x1fgarty.x1cpjm7i.x1gmr53x.xhkezso.x1s928wv.x1vvkbs.x13faqbe.x1fj9vlw.xeuugli.x193iq5w.x15dsfln.xyejjpt.x1n2onr6.xryxfnj.x1plvlek.x1lliihq',
    '.x1nhvcw1.x1oa3qoh.x1cy8zhl.xqjyukv.xdt5ytf.x2lah0s.x1c4vz4f.xryxfnj.x1plvlek.x1n2onr6.x14z9mp.x1lziwak.x1yztbdb.xg87l8a.xbiv7yw.x16uus16.x1ga7v0g.x15mokao.x78zum5.xjbqb8w.x9f619.x1c1uobl.x18d9i69.xyri2b.xexx8yu.html-div',
    '.x3nfvp2.x1n5bzlp.x1n2onr6.x1c1uobl.x18d9i69.xyri2b.xexx8yu.xt7dq6l.x14e42zd.x1qhh985.x10w94by.x972fbf.x6en5u8.x1ui04y5.x1e4oeot.xr9e8f9.xjbqb8w.xt0b8zv.x14jxsvd.xlal1re.xr5sc7.xl0gqc1.x1i0vuye.x18br7mf.x5c86q.x14atkfc.x87ps6o.xlyipyv.x2b8uid.x17ydfre.xl56j7k.x1f6kntn.x1ypdohk.x9f619.xstzfhl.x1sy0etr.x18oe1m7.x1ejq31n.xjyslct.x6s0dn4.x1a2a7pz.x1q0g3np.x1t137rt.x1ja2u2z.xggy1nq.x1hl2dhg.xeuugli.x2lwn1j.x1lziwak.xat24cr.x14z9mp.xdj266r.x3ct3a4.x2lah0s.xdl72j9.x1phubyo.xqeqjp1.xc5r6h4.xjqpnuy.x1i10hfl',
];

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

if (typeof module !== 'undefined') module.exports = { extOf, normalize, record, renameFolders, sidecar, sidecarPath, hash, sortItems, filterItems, safe, relPath, dirsOf, dirsHave, buildIndex };
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
        if (busy) return status(status.last.split(' · busy')[0] + ' · busy, wait for it to finish');
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

    // The saved page lazy-loads its collection grid: scroll to the end so every name is in the DOM.
    async function scrollSaved() {
        if (!/^\/[^/]+\/saved\/?$/.test(location.pathname)) return;
        for (let n = -1, k; n !== (k = document.querySelectorAll('a[href*="/saved/"]').length); n = k) {
            status(`reading collection names ${k}`);
            window.scrollTo(0, document.documentElement.scrollHeight);
            await sleep(PAGE_DELAY);
        }
    }

    async function load() {
        await scrollSaved();
        const names = learnNames();
        try {
            await pages('collections/list/?collection_types=' + encodeURIComponent('["MEDIA"]'),
                batch => batch.forEach(c => { names[String(c.collection_id)] = c.collection_name; }));
            GM_setValue(NAMES_KEY, names);
        } catch (e) { console.warn('[hoard] collection list unavailable, using saved page names', e); }
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
                h('a', { href: postUrl(it.code), target: '_blank', textContent: 'open post' }), ' · ',
                h('a', { href: profileUrl(it.user), target: '_blank', textContent: `@${it.user}` }),
                `\n${it.taken ? new Date(it.taken * 1000).toLocaleString() : ''}`,
                it.location ? `\n${it.location.name}` : null,
                it.tagged?.length ? `\nwith ${it.tagged.map(u => '@' + u).join(', ')}` : null,
                `\n${it.cols.map(colName).join(', ') || 'no collection'}\n\n${it.caption}`));
        viewer.prepend(h('button', { className: 'x', textContent: '✕', onclick: () => { viewer.hidden = true; } }));
        viewer.hidden = false;
    }
    // .media fills the backdrop, so a click on its empty space closes too
    viewer.addEventListener('click', e => { if (e.target === viewer || e.target.className === 'media') viewer.hidden = true; });

    // A Blob, not a data: URL: Chromium drops URLs over 2 MB, which the inlined index.html passes.
    const save = (text, type, name) => gmDownload(new Blob([text], { type }), name);

    // GM_download never calls back when the download is blocked outright (extension not whitelisted,
    // download mode not browser api), so a hard timeout turns that into a visible failure.
    const gmDownload = (url, name) => new Promise((ok, fail) => {
        const t = setTimeout(() => fail(new Error('no response, check tampermonkey download settings')), 60000);
        GM_download({
            url, name, conflictAction: 'overwrite', onload: () => { clearTimeout(t); ok(); },
            onerror: e => {
                clearTimeout(t);
                const why = e?.error || 'failed';
                fail(new Error(why === 'not_whitelisted' ? `${why}: add .${name.split('.').pop()} to tampermonkey's download whitelist` : why));
            },
            ontimeout: () => { clearTimeout(t); fail(new Error('timeout')); },
        });
    });

    // Uses the library already loaded (refresh first for new saves). Every post gets a copy in each
    // of its collections' folders (else "unsorted"); only folders it does not have yet are
    // downloaded, so a post added to another collection gets one new copy. Nothing is deleted.
    // The archive is saved after every post, so an interrupted sync resumes.
    async function sync() {
        if (!lib) await load();
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
        const waiting = lib.items.filter(it => it.cols.some(id => !names[id])).length;
        const todo = lib.items.filter(it => it.cols.every(id => names[id]) && due(it));
        let n = 0, failed = 0, fetched = 0;
        status(`sync 0/${todo.length}`);
        for (const it of todo) {
            n++;
            status(`sync ${n}/${todo.length} @${it.user}${failed ? ` · ${failed} failed` : ''}`);
            if (!arc.profiles[it.user] && it.pic) {
                const pic = `profiles/${safe(it.user)}.jpg`;
                try {
                    await gmDownload(it.pic, 'reference/' + pic);
                    arc.profiles[it.user] = { name: it.name, pic };
                } catch (e) { console.warn('[hoard] profile', it.user, e.message); }
            }
            try {
                if (!it.files.length) throw new Error('no media');
                const want = dirsOf(it, colName), have = dirsHave(arc.posts[it.code]);
                const missing = want.filter(d => !have.includes(d));
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
                if (missing.length) await sleep(DL_DELAY);
            } catch (e) {
                failed++;
                console.warn('[hoard]', it.code, e.message);
                if (failed === 1) status.first = e.message;
                await sleep(DL_DELAY);
            }
        }
        arc.cols = lib.cols;
        GM_setValue(ARC_KEY, arc);
        const html = buildIndex(arc, Date.now());
        await save(html, 'text/html', 'reference/index.html');
        render();
        status(`synced ${todo.length - failed} (${fetched} with media) · ${Object.keys(arc.posts).length} on disk${failed ? ` · ${failed} failed (${status.first}), sync again` : ''}${renamed.length ? ` · ${renamed.length} folders renamed, run tidy.py` : ''}${waiting ? ` · ${waiting} wait for collection names, refresh from /saved/` : ''}`);
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
    const HIDE_KEY = 'hoard.hide';
    const hideStyle = GM_addStyle(HIDE.map(sel => `${sel} { display: none !important; }`).join('\n'));
    hideStyle.disabled = !GM_getValue(HIDE_KEY, true);

    // Tab reads "saved"; Instagram rewrites the title on every navigation.
    const retitle = () => { if (document.title !== 'saved') document.title = 'saved'; };
    new MutationObserver(retitle).observe(document.head, { childList: true, subtree: true, characterData: true });
    retitle();

    GM_registerMenuCommand('open hoard', open);
    GM_registerMenuCommand('hide elements on/off', () => {
        hideStyle.disabled = !hideStyle.disabled;
        GM_setValue(HIDE_KEY, !hideStyle.disabled);
    });
    GM_registerMenuCommand('sync to disk', () => run(sync));
}
