// ==UserScript==
// @name         flush
// @namespace    https://github.com/SolRaze/extentions/tree/main/userscript/flush
// @version      1.8
// @description  decluttered youtube, instagram, spotify, x, soundcloud, claude, reddit and more, a switch per hidden element | on youtube seek buttons and keys, miniplayer, gestures, sponsorblock, cpu tamer, playlists tagged in mark
// @author       SolRaze
// @homepageURL  https://github.com/SolRaze/extentions
// @supportURL   https://github.com/SolRaze/extentions/issues
// @license      MIT
// @match        https://*.youtube.com/*
// @match        https://instagram.com/*
// @match        https://*.instagram.com/*
// @match        https://open.spotify.com/*
// @match        https://*.open.spotify.com/*
// @match        https://x.com/*
// @match        https://*.x.com/*
// @match        https://soundcloud.com/*
// @match        https://*.soundcloud.com/*
// @match        https://claude.ai/*
// @match        https://*.claude.ai/*
// @match        https://reddit.com/*
// @match        https://*.reddit.com/*
// @match        https://civitai.red/*
// @match        https://*.civitai.red/*
// @match        https://discord.com/*
// @match        https://*.discord.com/*
// @match        https://pinterest.com/*
// @match        https://*.pinterest.com/*
// @match        https://chess.com/*
// @match        https://*.chess.com/*
// @match        https://chat.deepseek.com/*
// @match        https://*.chat.deepseek.com/*
// @match        https://utags.link/*
// @match        https://*.utags.link/*
// @match        https://india.numakers.com/*
// @match        https://*.india.numakers.com/*
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

// Page elements hidden per site, one switch per group and per rule, all on by default. Same rules as
// the uBlock filters they came from, so a deploy that renames a class just stops hiding that element.
// youtube's group keys are the hide.<key> settings of every flush release, keep them.
const SITES = {
    'youtube.com': { name: 'youtube', groups: [
        ["masthead", "logo, menu, create and bell", ["#logo", "#header > .ytd-app.style-scope", "#icon > .yt-icon-button.style-scope", "yt-button-shape > .ytSpecButtonShapeNextEnableBackdropFilterExperiment.ytSpecButtonShapeNextIconLeading.ytSpecButtonShapeNextSizeM.ytSpecButtonShapeNextMono.ytSpecButtonShapeNextTonal.ytSpecButtonShapeNextHost", ".ytd-masthead.style-scope > yt-button-shape > .ytSpecButtonShapeNextEnableBackdropFilterExperiment.ytSpecButtonShapeNextIconOnlyDefault.ytSpecButtonShapeNextSizeM.ytSpecButtonShapeNextMono.ytSpecButtonShapeNextText.ytSpecButtonShapeNextHost"]],
        ["profile", "profile picture", ["ytd-masthead ytd-topbar-menu-button-renderer:has(#avatar-btn)"]],
        ["sidebar", "sidebar extras and footer", ["ytd-guide-section-renderer.ytd-guide-renderer.style-scope:nth-of-type(1)", "ytd-guide-section-renderer.ytd-guide-renderer.style-scope:nth-of-type(4)", "ytd-guide-section-renderer.ytd-guide-renderer.style-scope:nth-of-type(5)", "ytd-guide-section-renderer.ytd-guide-renderer.style-scope:nth-of-type(6)", "ytd-mini-guide-entry-renderer.ytd-mini-guide-renderer.style-scope:nth-of-type(2)", "#guide-links-primary", "#guide-links-secondary", "#copyright", ".ytd-guide-entry-renderer.style-scope.guide-icon"]],
        ["overlay", "buttons over the video", [".yt-spec-button-shape-next--enable-backdrop-filter-experiment.yt-spec-button-shape-next--icon-leading.yt-spec-button-shape-next--size-m.yt-spec-button-shape-next--overlay.yt-spec-button-shape-next--text.yt-spec-button-shape-next", ".yt-spec-button-shape-next--enable-backdrop-filter-experiment.yt-spec-button-shape-next--icon-only-default.yt-spec-button-shape-next--size-m.yt-spec-button-shape-next--overlay.yt-spec-button-shape-next--text.yt-spec-button-shape-next", ".ytSpecButtonShapeNextEnableBackdropFilterExperiment.ytSpecButtonShapeNextIconLeading.ytSpecButtonShapeNextSizeM.ytSpecButtonShapeNextOverlay.ytSpecButtonShapeNextTonal.ytSpecButtonShapeNextHost"]],
        ["watch", "donations, shopping and carousels", [".ytd-watch-flexy.style-scope > .ytd-donation-unavailable-renderer.style-scope", "ytd-badge-supported-renderer.ytd-watch-metadata.style-scope > .ytBadgeSupportedRendererHost > .ytBadgeSupportedRendererBadgeShape.badge-shape > .ytMetadataBadgeRendererHost > .ytBadgeShapeTypography.ytBadgeShapeCommerce.ytBadgeShapeHost > .ytBadgeShapeText", ".ytVideoMetadataCarouselViewModelHost", "#teaser-carousel"]],
        ["ask", "ask (ai chat) button", [".you-chat-entrypoint-button.ytd-menu-renderer.style-scope.ytSpecButtonViewModelHost"]],
    ] },
    'instagram.com': { name: 'instagram', groups: [
        ["ig.nav", "sidebar nav entries", [".x1dlrdel.x1ddbhtg.x1fkh5qu.x11njtxf.x1n2onr6.x1c1uobl.x18d9i69.xyri2b.xexx8yu.x1lziwak.xat24cr.x14z9mp.xdj266r.x2lah0s.xdt5ytf.x78zum5.x9f619.x14e42zd.x1qhh985.x10w94by.x972fbf.x7a106z > ._a6hd.x1a2a7pz.xggy1nq.x1hl2dhg.x16tdsg8.x1c1uobl.x18d9i69.xyri2b.xexx8yu.x1lziwak.xat24cr.x14z9mp.xdj266r.x3ct3a4.xt0psk2.x1ypdohk.x9f619.x14e42zd.x1qhh985.x10w94by.x972fbf.xstzfhl.x1sy0etr.x18oe1m7.x1ejq31n.xjbqb8w.x1i10hfl", ".xhuyl8g.xl5mz7h > span.x1qrby5j.x7ja8zs.x1t2pt76.x1lytzrv.xedcshv.xarpa2k.x3igimt.x12ejxvf.xaigb6o.x1beo9mf.xv2umb2.x1jfb8zj.x1h9r5lt.x1h91t0o.x4k7w5x.x1vvkbs.x16tdsg8.x1hl2dhg.x1c1uobl.x18d9i69.xyri2b.xexx8yu.x1lziwak.xat24cr.x14z9mp.xdj266r.html-span > .x78zum5.x6s0dn4.x1n2onr6 > ._a6hd.x4gyw5p.x1a2a7pz.xggy1nq.x1hl2dhg.x16tdsg8.x1c1uobl.x18d9i69.xyri2b.xexx8yu.x1lziwak.xat24cr.x14z9mp.xdj266r.x3ct3a4.xt0psk2.x1ypdohk.x9f619.x14e42zd.x1qhh985.x10w94by.x972fbf.xstzfhl.x1sy0etr.x18oe1m7.x1ejq31n.xjbqb8w.x1i10hfl > .x159b3zp.x80pfx3.x1g0dm76.xsag5q8.xpdmqnj.xz9dl7a.x12dmmrz.x7nr27j.x6pnmvc.xo237n4.xjpr12u.xr9ek0c.x15x8krk.xde0f50.x5a5i1n.x1obq294.x3nfvp2.x9f619", ".xhuyl8g.xl5mz7h > span.x1qrby5j.x7ja8zs.x1t2pt76.x1lytzrv.xedcshv.xarpa2k.x3igimt.x12ejxvf.xaigb6o.x1beo9mf.xv2umb2.x1jfb8zj.x1h9r5lt.x1h91t0o.x4k7w5x.x1vvkbs.x16tdsg8.x1hl2dhg.x1c1uobl.x18d9i69.xyri2b.xexx8yu.x1lziwak.xat24cr.x14z9mp.xdj266r.html-span > .x1n2onr6 > ._a6hd.x4gyw5p.x1a2a7pz.xggy1nq.x1hl2dhg.x16tdsg8.x1c1uobl.x18d9i69.xyri2b.xexx8yu.x1lziwak.xat24cr.x14z9mp.xdj266r.x3ct3a4.xt0psk2.x1ypdohk.x9f619.x14e42zd.x1qhh985.x10w94by.x972fbf.xstzfhl.x1sy0etr.x18oe1m7.x1ejq31n.xjbqb8w.x1i10hfl > .xh8yej3.x1g0dm76.xsag5q8.xpdmqnj.xz9dl7a.x1q0g3np.x6s0dn4.x15x8krk.xde0f50.x5a5i1n.x1obq294.x159b3zp.x80pfx3.x12dmmrz.x7nr27j.x6pnmvc.xo237n4.xjpr12u.xr9ek0c.x3nfvp2.x9f619", "div:nth-of-type(5) > div > .x1qrby5j.x7ja8zs.x1t2pt76.x1lytzrv.xedcshv.xarpa2k.x3igimt.x12ejxvf.xaigb6o.x1beo9mf.xv2umb2.x1jfb8zj.x1h9r5lt.x1h91t0o.x4k7w5x.x1vvkbs.x16tdsg8.x1hl2dhg.x1c1uobl.x18d9i69.xyri2b.xexx8yu.x1lziwak.xat24cr.x14z9mp.xdj266r.html-span > .x1n2onr6 > ._a6hd.x4gyw5p.x1a2a7pz.xggy1nq.x1hl2dhg.x16tdsg8.x1c1uobl.x18d9i69.xyri2b.xexx8yu.x1lziwak.xat24cr.x14z9mp.xdj266r.x3ct3a4.xt0psk2.x1ypdohk.x9f619.x14e42zd.x1qhh985.x10w94by.x972fbf.xstzfhl.x1sy0etr.x18oe1m7.x1ejq31n.xjbqb8w.x1i10hfl > .xh8yej3.x1g0dm76.xsag5q8.xpdmqnj.xz9dl7a.x1q0g3np.x6s0dn4.x15x8krk.xde0f50.x5a5i1n.x1obq294.x159b3zp.x80pfx3.x12dmmrz.x7nr27j.x6pnmvc.xo237n4.xjpr12u.xr9ek0c.x3nfvp2.x9f619", ".xc26acl.xh8yej3.x1iyjqo2 > div > .x1qrby5j.x7ja8zs.x1t2pt76.x1lytzrv.xedcshv.xarpa2k.x3igimt.x12ejxvf.xaigb6o.x1beo9mf.xv2umb2.x1jfb8zj.x1h9r5lt.x1h91t0o.x4k7w5x.x1vvkbs.x16tdsg8.x1hl2dhg.x1c1uobl.x18d9i69.xyri2b.xexx8yu.x1lziwak.xat24cr.x14z9mp.xdj266r.html-span > .x1n2onr6 > ._a6hd.x4gyw5p.x1a2a7pz.xggy1nq.x1hl2dhg.x16tdsg8.x1c1uobl.x18d9i69.xyri2b.xexx8yu.x1lziwak.xat24cr.x14z9mp.xdj266r.x3ct3a4.xt0psk2.x1ypdohk.x9f619.x14e42zd.x1qhh985.x10w94by.x972fbf.xstzfhl.x1sy0etr.x18oe1m7.x1ejq31n.xjbqb8w.x1i10hfl > .xh8yej3.x1g0dm76.xsag5q8.xpdmqnj.xz9dl7a.x1q0g3np.x6s0dn4.x15x8krk.xde0f50.x5a5i1n.x1obq294.x159b3zp.x80pfx3.x12dmmrz.x7nr27j.x6pnmvc.xo237n4.xjpr12u.xr9ek0c.x3nfvp2.x9f619", ".x1n2onr6 > .x1qrby5j.x7ja8zs.x1t2pt76.x1lytzrv.xedcshv.xarpa2k.x3igimt.x12ejxvf.xaigb6o.x1beo9mf.xv2umb2.x1jfb8zj.x1h9r5lt.x1h91t0o.x4k7w5x.x1vvkbs.x16tdsg8.x1hl2dhg.x1c1uobl.x18d9i69.xyri2b.xexx8yu.x1lziwak.xat24cr.x14z9mp.xdj266r.html-span > .x1n2onr6 > ._a6hd.x4gyw5p.x1a2a7pz.xggy1nq.x1hl2dhg.x16tdsg8.x1c1uobl.x18d9i69.xyri2b.xexx8yu.x1lziwak.xat24cr.x14z9mp.xdj266r.x3ct3a4.xt0psk2.x1ypdohk.x9f619.x14e42zd.x1qhh985.x10w94by.x972fbf.xstzfhl.x1sy0etr.x18oe1m7.x1ejq31n.xjbqb8w.x1i10hfl > .xh8yej3.x1g0dm76.xsag5q8.xpdmqnj.xz9dl7a.x1q0g3np.x6s0dn4.x15x8krk.xde0f50.x5a5i1n.x1obq294.x159b3zp.x80pfx3.x12dmmrz.x7nr27j.x6pnmvc.xo237n4.xjpr12u.xr9ek0c.x3nfvp2.x9f619", ".xc26acl.xh8yej3.x1iyjqo2 > div > div > div > .x1qrby5j.x7ja8zs.x1t2pt76.x1lytzrv.xedcshv.xarpa2k.x3igimt.x12ejxvf.xaigb6o.x1beo9mf.xv2umb2.x1jfb8zj.x1h9r5lt.x1h91t0o.x4k7w5x.x1vvkbs.x16tdsg8.x1hl2dhg.x1c1uobl.x18d9i69.xyri2b.xexx8yu.x1lziwak.xat24cr.x14z9mp.xdj266r.html-span > .x1n2onr6 > ._a6hd.x4gyw5p.x1a2a7pz.xggy1nq.x1hl2dhg.x16tdsg8.x1c1uobl.x18d9i69.xyri2b.xexx8yu.x1lziwak.xat24cr.x14z9mp.xdj266r.x3ct3a4.xt0psk2.x1ypdohk.x9f619.x14e42zd.x1qhh985.x10w94by.x972fbf.xstzfhl.x1sy0etr.x18oe1m7.x1ejq31n.xjbqb8w.x1i10hfl > .xh8yej3.x1g0dm76.xsag5q8.xpdmqnj.xz9dl7a.x1q0g3np.x6s0dn4.x15x8krk.xde0f50.x5a5i1n.x1obq294.x159b3zp.x80pfx3.x12dmmrz.x7nr27j.x6pnmvc.xo237n4.xjpr12u.xr9ek0c.x3nfvp2.x9f619", "._a6hd.xlxy82.x1q0q8m5.x16stqrj.x1xnnf8n.x106a9eq.xn3w4p2.x1c4vz4f.x1lku1pv.x1hl2dhg.xl56j7k.x1q0g3np.x78zum5.x6s0dn4.x1a2a7pz.xggy1nq.x16tdsg8.x18d9i69.xexx8yu.x1lziwak.xat24cr.x14z9mp.xdj266r.x3ct3a4.x1ypdohk.x9f619.x14e42zd.x10w94by.x972fbf.xstzfhl.x18oe1m7.x1ejq31n.xjbqb8w.x1i10hfl"]],
        ["ig.stories", "story ring canvases", ["canvas"]],
        ["ig.tabs", "profile and saved page tab labels", ["span.xe9ewy2.x2fvf9.x1s688f.x1ypdohk:nth-of-type(3)", "span.xe9ewy2.x2fvf9.x1s688f.x1ypdohk:nth-of-type(4)", "span.xe9ewy2.x2fvf9.x1s688f.x1ypdohk:nth-of-type(5)", "span.xe9ewy2.x2fvf9.x1s688f.x1ypdohk:nth-of-type(2)"]],
        ["ig.misc", "other page panels, banners and buttons", [".x1n2onr6.x1odjw0f.xw2csxc.x5yr21d", "div.xmzvs34.xwib8y2.xf159sx.x1y1aw1k.xus2keu.xpzwpp9.x1epzrsm.x1a2a7pz.x1lku1pv.x87ps6o.x1q0g3np.x3nfvp2.xo1y3bh.x140muxe.xu25z0z.x1fmog5m.x1t137rt.x1ja2u2z.xggy1nq.x1hl2dhg.x16tdsg8.x1n2onr6.xeuugli.x2lwn1j.x1lziwak.xat24cr.x14z9mp.xdj266r.x3ct3a4.x2lah0s.xdl72j9.x1ypdohk.x9f619.x14e42zd.x1qhh985.x10w94by.x972fbf.x1t7ytsu.x1q0q8m5.x18b5jzi.x13fuv20.x1phubyo.xqeqjp1.xc5r6h4.xjqpnuy.xjbqb8w.x1qjc9v5.x1i10hfl:nth-of-type(2)", "div.xmzvs34.xwib8y2.xf159sx.x1y1aw1k.xus2keu.xpzwpp9.x1epzrsm.x1a2a7pz.x1lku1pv.x87ps6o.x1q0g3np.x3nfvp2.xo1y3bh.x140muxe.xu25z0z.x1fmog5m.x1t137rt.x1ja2u2z.xggy1nq.x1hl2dhg.x16tdsg8.x1n2onr6.xeuugli.x2lwn1j.x1lziwak.xat24cr.x14z9mp.xdj266r.x3ct3a4.x2lah0s.xdl72j9.x1ypdohk.x9f619.x14e42zd.x1qhh985.x10w94by.x972fbf.x1t7ytsu.x1q0q8m5.x18b5jzi.x13fuv20.x1phubyo.xqeqjp1.xc5r6h4.xjqpnuy.xjbqb8w.x1qjc9v5.x1i10hfl:nth-of-type(1)", "span > .x14snt5h.x1o7uuvo.x1jplu5e.x4gyw5p.x1epzrsm.xmzvs34.xwib8y2.xf159sx.x1y1aw1k.xl56j7k.x78zum5.x1ypdohk.xstzfhl.x1sy0etr.x18oe1m7.x1ejq31n.xjbqb8w.x6s0dn4.x1a2a7pz.xggy1nq.x1hl2dhg.x16tdsg8.x1lziwak.xat24cr.x14z9mp.xdj266r.x3ct3a4.x9f619.x14e42zd.x1qhh985.x10w94by.x972fbf.x1i10hfl", ".x1nhvcw1.x1oa3qoh.x1qjc9v5.xqjyukv.xdt5ytf.x2lah0s.x1c4vz4f.xryxfnj.x1plvlek.x1uhb9sk.xdwrcjd.xbiv7yw.x16uus16.x1ga7v0g.x15mokao.x78zum5.xjbqb8w.x9f619.x1c1uobl.x18d9i69.xyri2b.xexx8yu.xat24cr.x14z9mp.xdj266r.html-div > .x1n2onr6.x1lliihq > path", ".x1nhvcw1.x1oa3qoh.x6s0dn4.xqjyukv.x1q0g3np.x2lah0s.x1c4vz4f.xryxfnj.x1plvlek.x1uhb9sk.xbiv7yw.x16uus16.x1ga7v0g.x15mokao.x78zum5.xjbqb8w.x9f619.x1c1uobl.x18d9i69.xyri2b.xexx8yu.x1lziwak.xat24cr.x14z9mp.xdj266r.html-div > .x1n5bzlp.x1n2onr6.x1c1uobl.x18d9i69.xyri2b.xexx8yu.xt7dq6l.xt0psk2.x14e42zd.x1qhh985.x10w94by.x972fbf.x6en5u8.x1ui04y5.x1e4oeot.xr9e8f9.xjbqb8w.xt0b8zv.x20cjte.xf8g3cd.xr5sc7.x11q7cde.x1i0vuye.x18br7mf.x5c86q.x14atkfc.x87ps6o.xlyipyv.x2b8uid.x17ydfre.xl56j7k.x1f6kntn.x1ypdohk.x9f619.xstzfhl.x1sy0etr.x18oe1m7.x1ejq31n.xjyslct.x6s0dn4.x1a2a7pz.x1q0g3np.x1t137rt.x1ja2u2z.xggy1nq.x1hl2dhg.xeuugli.x2lwn1j.x1lziwak.xat24cr.x14z9mp.xdj266r.x3ct3a4.x2lah0s.xdl72j9.x1phubyo.xqeqjp1.xc5r6h4.xjqpnuy.x1i10hfl", ".x1nhvcw1.x1oa3qoh.x1cy8zhl.xqjyukv.x1a02dak.xdt5ytf.xeuugli.x2lwn1j.x1iyjqo2.xryxfnj.x1plvlek.x1n2onr6.xvc5jky.x4ii5y1.x11t971q.xr1yuqi.xbiv7yw.x16uus16.x1ga7v0g.x15mokao.x78zum5.xjbqb8w.x9f619.x1c1uobl.x18d9i69.xyri2b.xexx8yu.html-div > .x5n08af.xo1l8bm.xvs91rp.x1i0vuye.x1943h6x.x1fgarty.x1cpjm7i.x1gmr53x.xhkezso.x1s928wv.x1vvkbs.x13faqbe.x1fj9vlw.xeuugli.x193iq5w.x15dsfln.xyejjpt.x1n2onr6.xryxfnj.x1plvlek.x1lliihq", ".xstzfhl.x1sy0etr.x18oe1m7.x1ejq31n.x12qyh8a.xckx8r1.x1p2znge.xum2pek.xvbhtw8.x1c1uobl.xwib8y2.xyri2b.x1y1aw1k.x1nhvcw1.x1a02dak.x1q0g3np.x78zum5.x178xt8z.x1yvgwvq.xso031l.x1ixjvfu.x6s0dn4", ".xl56j7k.x1oa3qoh.x1qjc9v5.xqjyukv.x1a02dak.x1q0g3np.x2lah0s.x1c4vz4f.xryxfnj.x1plvlek.x1n2onr6.xbiv7yw.x16uus16.x1ga7v0g.x15mokao.x78zum5.xjbqb8w.x9f619.x1c1uobl.x18d9i69.xyri2b.xexx8yu.x1lziwak.xat24cr.x14z9mp.xdj266r.html-div", ".x1nhvcw1.x1oa3qoh.x1qjc9v5.xqjyukv.xdt5ytf.x2lah0s.x1c4vz4f.xryxfnj.x1plvlek.x1n2onr6.x5u0ere.xbiv7yw.x16uus16.x1ga7v0g.x15mokao.x78zum5.xjbqb8w.x9f619.x1c1uobl.x18d9i69.xyri2b.xexx8yu.x1lziwak.x14z9mp.xdj266r.html-div", ".xed3198.x1kylhsf.x4yb96v.xysibl7.x1ddxa5k.xf7dkkf.xv54qhq.xnnlda6.xpilrb4.xso031l.x1lun4ml.x178xt8z.xly64p6.xdwr3uu.x10qfohq.x6zsckl.x1n2onr6.xl56j7k.x3nfvp2.x1w60jca.x1t7ytsu.x1q0q8m5.x18b5jzi.x13fuv20.x1o29io0.xvhwddo.x11ppq56.x1ss9elp.x7r02ix.x6s0dn4.x1a2a7pz.x1lku1pv.x87ps6o.x1q0g3np.x1t137rt.x1ja2u2z.xggy1nq.x1hl2dhg.x16tdsg8.x18d9i69.xexx8yu.xeuugli.x2lwn1j.x1lziwak.xat24cr.x14z9mp.xdj266r.x3ct3a4.x2lah0s.xdl72j9.x1ypdohk.x9f619.x1i10hfl", ".xc26acl.xh8yej3.x1iyjqo2", ".xh8yej3.x1g0dm76.xpdmqnj.x1p5oq8j.xwxc41k.x1qughib.x1gvbg2u.xdt5ytf.x78zum5.x9f619.x1cy8zhl", ".x5n08af.x1s688f.x1fhwpqd.x1i0vuye.x1943h6x.x1fgarty.x1cpjm7i.x1gmr53x.xhkezso.x1s928wv.x1vvkbs.x13faqbe.x1fj9vlw.xeuugli.x193iq5w.x15dsfln.xyejjpt.x1n2onr6.xryxfnj.x1plvlek.x1lliihq > .xuxw1ft.xlyipyv.x10wlt62.x6ikm8r.x193iq5w.x1lliihq", ".x10xgr34.x1n2onr6.x1lliihq", ".xl56j7k.x78zum5.x6s0dn4.x1n2onr6.x10wlt62.x6ikm8r.x1ertn4p.x1pahc9y.xeusxvb.x1c9tyrk.xnz67gz", ".xl56j7k.xdt5ytf.x78zum5.x6s0dn4 > .x5n08af.x1n2onr6.x1lliihq", ".xl56j7k.x78zum5.xmixu3c.x6s0dn4.x1oa3qoh.xqjyukv.x1q0g3np.x2lah0s.x1c4vz4f.xryxfnj.x1plvlek.x1uhb9sk.x1e56ztr.xbiv7yw.x16uus16.x1ga7v0g.x15mokao.xjbqb8w.x9f619.x1c1uobl.x18d9i69.xyri2b.xexx8yu.x1lziwak.x14z9mp.xdj266r.html-div > .x5n08af.xo1l8bm.xvs91rp.x1i0vuye.x1943h6x.x1fgarty.x1cpjm7i.x1gmr53x.xhkezso.x1s928wv.x1vvkbs.x13faqbe.x1fj9vlw.xeuugli.x193iq5w.x15dsfln.xyejjpt.x1n2onr6.xryxfnj.x1plvlek.x1lliihq", ".x1nhvcw1.x1oa3qoh.x6s0dn4.xqjyukv.x1q0g3np.x2lah0s.x1c4vz4f.xryxfnj.x1plvlek.x1uhb9sk.xbiv7yw.x16uus16.x1ga7v0g.x15mokao.x78zum5.x40hh3e.xjbqb8w.x9f619.x1c1uobl.x18d9i69.xyri2b.xexx8yu.x1lziwak.xat24cr.x14z9mp.xdj266r.html-div", ".xl3ioum.xk4oym4.xixcex4.x1h6iz8e.x1aavi5t.x1xnnf8n.x106a9eq.xn3w4p2.x1mg3h75.x7vuprf.x1a5l9x9.x6nl9eh.x1i0vuye.x18br7mf.x5c86q.x14atkfc.x87ps6o.xlyipyv.x2b8uid.x1n2onr6.x17ydfre.xl56j7k.xwhw2v2.x1f6kntn.x78zum5.x1ypdohk.x9f619.xstzfhl.x1sy0etr.x18oe1m7.x1ejq31n.xjyslct.x6s0dn4.x1a2a7pz.x1lku1pv.x1q0g3np.x1t137rt.x1ja2u2z.xggy1nq.x1hl2dhg.x18d9i69.xexx8yu.xeuugli.x2lwn1j.x1lziwak.xat24cr.x14z9mp.xdj266r.x3ct3a4.x2lah0s.xdl72j9.x14e42zd.x1qhh985.x10w94by.x972fbf.x1phubyo.xqeqjp1.xc5r6h4.xjqpnuy.x1i10hfl", ".x1nhvcw1.x1oa3qoh.x1qjc9v5.xqjyukv.xdt5ytf.xeuugli.x2lwn1j.x1iyjqo2.x10wlt62.x6ikm8r.x1n2onr6.xbiv7yw.x16uus16.x1ga7v0g.x15mokao.x78zum5.xjbqb8w.x9f619.x1c1uobl.x18d9i69.xyri2b.xexx8yu.x1lziwak.xat24cr.x14z9mp.xdj266r.html-div", "._aade._aad7._aacx._aacu._aaco._ap3a > div > ._aade._aad7._aacx._aacu._aaco._ap3a", ".x1nhvcw1.x1oa3qoh.x6s0dn4.xqjyukv.x1q0g3np.xeuugli.x2lwn1j.x1iyjqo2.xryxfnj.x1plvlek.x1n2onr6.xbiv7yw.x16uus16.x1ga7v0g.x15mokao.x78zum5.xjbqb8w.x9f619.x1c1uobl.x18d9i69.xyri2b.xexx8yu.x1lziwak.xat24cr.x14z9mp.xdj266r.html-div", ".xxk16z8.x1n2onr6.x1lliihq", "img[src*=\"/v/t51.89012-19/573323465_1219825463302212_7278921664109726296_n.jpg\"]", ".x1n5bzlp.x1n2onr6.x1c1uobl.x18d9i69.xyri2b.xexx8yu.xt7dq6l.xt0psk2.x14e42zd.x1qhh985.x10w94by.x972fbf.x6en5u8.x1ui04y5.x1e4oeot.xr9e8f9.xjbqb8w.xt0b8zv.x14jxsvd.xlal1re.xr5sc7.xl0gqc1.x1i0vuye.x18br7mf.x5c86q.x14atkfc.x87ps6o.xlyipyv.x2b8uid.x17ydfre.xl56j7k.x1f6kntn.x1ypdohk.x9f619.xstzfhl.x1sy0etr.x18oe1m7.x1ejq31n.xjyslct.x6s0dn4.x1a2a7pz.x1q0g3np.x1t137rt.x1ja2u2z.xggy1nq.x1hl2dhg.xeuugli.x2lwn1j.x1lziwak.xat24cr.x14z9mp.xdj266r.x3ct3a4.x2lah0s.xdl72j9.x1phubyo.xqeqjp1.xc5r6h4.xjqpnuy.x1i10hfl", "._a9za._a9z6", "._aade._aad6._aacw._aaco._ap3a", ".x1nhvcw1.x1oa3qoh.x1qjc9v5.xqjyukv.x1q0g3np.xeuugli.x2lwn1j.x1iyjqo2.xryxfnj.x1plvlek.x1n2onr6.xbiv7yw.x16uus16.x1ga7v0g.x15mokao.x78zum5.xjbqb8w.x9f619.x1c1uobl.x18d9i69.xyri2b.xexx8yu.x1lziwak.xat24cr.x14z9mp.xdj266r.html-div", ".xv54qhq.x1hrcb2b.x1yrsyyn.x10b6aqq.x1n2onr6.x17ydfre.xl56j7k.xvs91rp.x2lah0s.x1roi4f4.x178xt8z.x13fuv20.x5ur3kl", ".xf7dkkf.xv54qhq.xo1ph6p.x1lziwak.xat24cr.x14z9mp.xdj266r.x178xt8z.x13fuv20.x1xp8e9x.x1yrsyyn.xwib8y2.x1q0g3np.x78zum5", ".x1nhvcw1.x1oa3qoh.x1qjc9v5.xc26acl.x1a02dak.x1q0g3np.xeuugli.x2lwn1j.x1iyjqo2.xryxfnj.x1plvlek.x1uhb9sk.xbiv7yw.x16uus16.x1ga7v0g.x15mokao.x78zum5.x40hh3e.xjbqb8w.x5lhr3w.x9f619.x1c1uobl.x18d9i69.xyri2b.xexx8yu.x1lziwak.xat24cr.x14z9mp.xdj266r.html-div", ".x1nhvcw1.x1oa3qoh.x1qjc9v5.xqjyukv.xdt5ytf.x2lah0s.x1c4vz4f.xryxfnj.x1plvlek.x1n2onr6.xdwrcjd.xbiv7yw.x16uus16.x1ga7v0g.x15mokao.x78zum5.xjbqb8w.x9f619.x1c1uobl.x18d9i69.xyri2b.xexx8yu.xat24cr.x14z9mp.xdj266r.html-div > .x1n2onr6.x1lliihq > path", "._aar2", ".x1n2onr6.xl56j7k.xdt5ytf.x78zum5.x6s0dn4.x71s49j.x10wlt62.x6ikm8r.x1a2a7pz.x1afcbsf.x1ja2u2z", ".xl56j7k.x1oa3qoh.x1qjc9v5.xqjyukv.xdt5ytf.x2lah0s.x1c4vz4f.xryxfnj.x1plvlek.x1n2onr6.x13fj5qh.xdj266r.xbiv7yw.x16uus16.x1ga7v0g.x15mokao.x78zum5.xjbqb8w.x9f619.x1c1uobl.x18d9i69.xyri2b.xexx8yu.xat24cr.x14z9mp.html-div > .x1n2onr6.x1lliihq > path", ".x1nhvcw1.x1oa3qoh.x1qjc9v5.xqjyukv.xdt5ytf.x2lah0s.x1c4vz4f.xryxfnj.x1plvlek.x1uhb9sk.xseo6mj.xbiv7yw.x16uus16.x1ga7v0g.x15mokao.x78zum5.xjbqb8w.x9f619.x1c1uobl.x18d9i69.xyri2b.xexx8yu.x1lziwak.xat24cr.x14z9mp.html-div", ".xn3w4p2.x1nhvcw1.x1oa3qoh.x1qjc9v5.xqjyukv.xdt5ytf.x2lah0s.x1c4vz4f.xryxfnj.x1plvlek.x1uhb9sk.x1y1aw1k.xwib8y2.xf7dkkf.xv54qhq.xbiv7yw.x16uus16.x1ga7v0g.x15mokao.x78zum5.xjbqb8w.x9f619.x1lziwak.xat24cr.x14z9mp.xdj266r.html-div", ".xh8yej3.x1g0dm76.xpdmqnj.x1p5oq8j.xwxc41k.x1qughib.x1gvbg2u.xdt5ytf.x78zum5.x9f619.x1cy8zhl > .xh8yej3.x1n2onr6", ".xfk6m8.x1rohswg.x1n2onr6.x10wlt62.xw2csxc.x5yr21d.x1q0g3np.x78zum5.x1qjc9v5", ".xh8yej3.x11njtxf.x1n2onr6.x5yr21d.xk390pu.xln7xf2.xdt5ytf.x78zum5.x9f619.x1qjc9v5", ".x1qe1wrf.x19app5s.x7ep2pv.xwy3nlu.xdj266r.x178p66w.x1yztbdb.xvc5jky.x11t971q", ".x1nhvcw1.x1oa3qoh.x1qjc9v5.xqjyukv.xdt5ytf.x2lah0s.x1c4vz4f.xryxfnj.x1plvlek.x1n2onr6.xyqm7xq.xbiv7yw.x16uus16.x1ga7v0g.x15mokao.x78zum5.xjbqb8w.x9f619.x1c1uobl.x18d9i69.xyri2b.xexx8yu.xat24cr.x14z9mp.xdj266r.html-div > .x676frb.x1s3etm8.x1roi4f4.xo1l8bm.x1fhwpqd.x1i0vuye.x1943h6x.x1fgarty.x1cpjm7i.x1gmr53x.xhkezso.x1s928wv.x1vvkbs.x13faqbe.x1fj9vlw.xeuugli.x193iq5w.x15dsfln.xyejjpt.x1n2onr6.xryxfnj.x1plvlek.x1lliihq", ".x1nhvcw1.x1oa3qoh.x1cy8zhl.xqjyukv.xdt5ytf.x2lah0s.x1c4vz4f.xryxfnj.x1plvlek.x1n2onr6.x14z9mp.x1lziwak.x1yztbdb.xg87l8a.xbiv7yw.x16uus16.x1ga7v0g.x15mokao.x78zum5.xjbqb8w.x9f619.x1c1uobl.x18d9i69.xyri2b.xexx8yu.html-div", ".x3nfvp2.x1n5bzlp.x1n2onr6.x1c1uobl.x18d9i69.xyri2b.xexx8yu.xt7dq6l.x14e42zd.x1qhh985.x10w94by.x972fbf.x6en5u8.x1ui04y5.x1e4oeot.xr9e8f9.xjbqb8w.xt0b8zv.x14jxsvd.xlal1re.xr5sc7.xl0gqc1.x1i0vuye.x18br7mf.x5c86q.x14atkfc.x87ps6o.xlyipyv.x2b8uid.x17ydfre.xl56j7k.x1f6kntn.x1ypdohk.x9f619.xstzfhl.x1sy0etr.x18oe1m7.x1ejq31n.xjyslct.x6s0dn4.x1a2a7pz.x1q0g3np.x1t137rt.x1ja2u2z.xggy1nq.x1hl2dhg.xeuugli.x2lwn1j.x1lziwak.xat24cr.x14z9mp.xdj266r.x3ct3a4.x2lah0s.xdl72j9.x1phubyo.xqeqjp1.xc5r6h4.xjqpnuy.x1i10hfl"]],
    ] },
    'open.spotify.com': { name: 'spotify', groups: [
        ["sp.upsell", "upsell and promo buttons", [".n4Ttl1dgCKAPuFlK.e-10180-legacy-button--small.encore-inverted-light-set.e-10180-button-primary__inner.e-10180-overflow-wrap-anywhere", ".encore-internal-color-text-subdued.e-10180-button-tertiary--text-subdued.e-10180-button--leading.e-10180-button-tertiary--small.e-10180-legacy-button--small.encore-text-body-small-bold.e-10180-overflow-wrap-anywhere.e-10180-legacy-button-tertiary.e-10180-legacy-button", ".n4Ttl1dgCKAPuFlK.e-10310-legacy-button--small.encore-inverted-light-set.e-10310-button-primary__inner.e-10310-overflow-wrap-anywhere", ".encore-internal-color-text-subdued.e-10310-button-tertiary--text-subdued.e-10310-button--leading.e-10310-button-tertiary--small.e-10310-legacy-button--small.encore-text-body-small-bold.e-10310-overflow-wrap-anywhere.e-10310-legacy-button-tertiary.e-10310-legacy-button", ".n4Ttl1dgCKAPuFlK.e-10451-legacy-button--small.encore-inverted-light-set.e-10451-button-primary__inner.e-10451-overflow-wrap-anywhere", ".encore-internal-color-text-subdued.e-10451-button-tertiary--text-subdued.e-10451-button--leading.e-10451-button-tertiary--small.e-10451-legacy-button--small.encore-text-body-small-bold.e-10451-overflow-wrap-anywhere.e-10451-legacy-button-tertiary.e-10451-legacy-button"]],
        ["sp.sidebar", "sidebar sections and resize bar", [".LayoutResizer__inline-start.LayoutResizer__resize-bar", "li.yqG4N5YYcY4uEujt:nth-of-type(4) > .KzLH25pAEr43wpSc", "li.yqG4N5YYcY4uEujt:nth-of-type(6) > .KzLH25pAEr43wpSc", "div.qV_CxbowaNkMarye:nth-of-type(3) > .FLjFgCRmVaE0WSqc", "div.qV_CxbowaNkMarye:nth-of-type(3)", "section.yTHNsGSMiG01kxo3.e4IK04uNVRsB6jbO.l3tPikCftuELMOzz:nth-of-type(3) > .va5STnBzPqkIqnaT > .T9JaL14g0fwnpw83.e-10451-legacy-list-row.e-10451-box--min-size.e-10451-box--padding-block-end-custom.e-10451-box--padding-block-start-custom.e-10451-box--padding-inline-end-custom.e-10451-box--padding-inline-start-custom.e-10451-box--naked.e-10451-box > .e-10451-legacy-list-row__header", "section.yTHNsGSMiG01kxo3.e4IK04uNVRsB6jbO.l3tPikCftuELMOzz:nth-of-type(3) > .va5STnBzPqkIqnaT", "section.yTHNsGSMiG01kxo3.e4IK04uNVRsB6jbO.l3tPikCftuELMOzz:nth-of-type(2) > .CsidsUzBet0_Mp5i.XtiGtrj_ysgd8Bmv.MyaStf5D5Im3gt9M > ._2WOtop0TLUrNXAd.uvcTYGvrsVEujQSN.dxlv5wfAu8zgm7HY", "section.yTHNsGSMiG01kxo3.e4IK04uNVRsB6jbO.l3tPikCftuELMOzz:nth-of-type(2) > .va5STnBzPqkIqnaT > .T9JaL14g0fwnpw83.e-10451-legacy-list-row.e-10451-box--min-size.e-10451-box--padding-block-end-custom.e-10451-box--padding-block-start-custom.e-10451-box--padding-inline-end-custom.e-10451-box--padding-inline-start-custom.e-10451-box--naked.e-10451-box > .e-10451-legacy-list-row__header", "section.yTHNsGSMiG01kxo3.e4IK04uNVRsB6jbO.l3tPikCftuELMOzz:nth-of-type(2) > .va5STnBzPqkIqnaT > .T9JaL14g0fwnpw83.e-10451-legacy-list-row.e-10451-box--min-size.e-10451-box--padding-block-end-custom.e-10451-box--padding-block-start-custom.e-10451-box--padding-inline-end-custom.e-10451-box--padding-inline-start-custom.e-10451-box--naked.e-10451-box"]],
        ["sp.footer", "footer and cookie banner", [".ot-sdk-container > .ot-sdk-row", ".footer"]],
        ["sp.misc", "other buttons and panels", ["button.sXjzYBob5Y4psogB.encore-internal-color-text-subdued.e-10180-button-tertiary--text-subdued.e-10180-button-tertiary--condensed-all.encore-text-body-small-bold.e-10180-overflow-wrap-anywhere.e-10180-legacy-button-tertiary.e-10180-legacy-button > .e-10180-icon", ".x2zIrx9Juns9lNvs.NA8gTZ4nPFEEcDYv", ".esBjsh.sc-jxOSlx", ".S0nU7XTXYMOBcASz", ".kxv3By32Og8yDEXy.uBpmNFia37U4nzmX.kUHE42xvQVzWqabl._Bg_zSvFrEutyacG.encore-internal-color-text-subdued.e-10180-button-tertiary--text-subdued.e-10180-button-tertiary--icon-only.e-10180-button-tertiary--icon-only-medium.e-10180-overflow-wrap-anywhere.e-10180-legacy-button-tertiary.e-10180-legacy-button", ".Re09zcWMhYTXRj0s", ".uBpmNFia37U4nzmX.kUHE42xvQVzWqabl._Bg_zSvFrEutyacG.encore-internal-color-text-subdued.e-10180-button-tertiary--text-subdued.e-10180-button-tertiary--icon-only.e-10180-button-tertiary--icon-only-medium.e-10180-overflow-wrap-anywhere.e-10180-legacy-button-tertiary.e-10180-legacy-button", ".wJiY1vDfuci2a4db", ".vH8s0xuGZZAqkkUl", ".WXUVXy433Xk07S0H.fEThIghNSPAx5Xs3.eWU4JoxyECcwnSf_", ".B6FK5_hz1604fa07", ".e93L7rh6x8hnJ4Y3", "#react-aria1130736945-\\:r37\\:", "#react-aria1130736945-\\:r1dk\\:", "span > ._EuXSrqTA94N1Evn.encore-internal-color-text-subdued.e-10451-button-tertiary--text-subdued.e-10451-button-tertiary--icon-only.e-10451-button-tertiary--icon-only-small.e-10451-overflow-wrap-anywhere.e-10451-legacy-button-tertiary.e-10451-legacy-button > .e-10451-button__icon-wrapper > .e-10451-icon > path"]],
    ] },
    'x.com': { name: 'x', groups: [
        ["x.nav", "sidebar nav links", ["a.r-1loqt21.r-1ny4l3l.r-1mkv55d.r-13qz1uu.r-1habvwh.r-16y2uox.r-eqz5dr.r-6koalj.css-175oi2r:nth-of-type(8)", "a.r-1loqt21.r-1ny4l3l.r-13qz1uu.r-cnw61z.r-1habvwh.r-16y2uox.r-eqz5dr.r-6koalj.css-175oi2r:nth-of-type(7)", "a.r-1loqt21.r-1ny4l3l.r-13qz1uu.r-cnw61z.r-1habvwh.r-16y2uox.r-eqz5dr.r-6koalj.css-175oi2r:nth-of-type(8)", "a.r-1loqt21.r-1ny4l3l.r-13qz1uu.r-cnw61z.r-1habvwh.r-16y2uox.r-eqz5dr.r-6koalj.css-175oi2r:nth-of-type(3)", "a.r-1loqt21.r-1ny4l3l.r-13qz1uu.r-cnw61z.r-1habvwh.r-16y2uox.r-eqz5dr.r-6koalj.css-175oi2r:nth-of-type(5)", "a.r-1loqt21.r-1ny4l3l.r-13qz1uu.r-cnw61z.r-1habvwh.r-16y2uox.r-eqz5dr.r-6koalj.css-175oi2r:nth-of-type(4)"]],
        ["x.misc", "sidebar and side panel extras", [".r-bnwqim.r-u9wvl5.r-w7s2jr.r-uaa2di.r-eqz5dr.r-1habvwh.css-175oi2r", ".r-12kyg2d.r-1awozwy.r-e7q0ms.css-175oi2r > .r-1loqt21.r-1ny4l3l.r-6416eg.r-o7ynqc.r-64el8z.r-19yznuf.r-lrvibr.r-rs99b7.r-1phboty.r-sdzlij.css-175oi2r > .r-1777fci.r-bcqeeo.r-16y2uox.r-18u37iz.r-6koalj.r-1awozwy.r-b88u0q.r-rjixqe.r-a023e6.r-q4m81j.r-37j5jr.r-qvutc0.css-146c3p1", ".r-12kyg2d.r-1awozwy.r-e7q0ms.css-175oi2r", ".r-1loqt21.r-1ny4l3l.r-6416eg.r-o7ynqc.r-1fkl15p.r-64el8z.r-19yznuf.r-lrvibr.r-rs99b7.r-1phboty.r-sdzlij.css-175oi2r", ".r-1ny4l3l.r-6416eg.r-o7ynqc.r-1loqt21.r-1tfmumk.r-u8s1d.r-1777fci.r-8oi148.r-qo02w8.r-rs99b7.r-1867qdf.r-j7xza8.r-5zmot.r-1e5uvyk.r-173mn98.r-1awozwy.r-105ug2t.css-175oi2r", ".r-3pj75a.r-1w6e6rj.r-18u37iz.css-175oi2r", ".r-1ny4l3l.r-6416eg.r-o7ynqc.r-3pj75a.r-1mmae3n.r-qklmqi.r-rull8r.r-1igl3o0.css-175oi2r", ".r-ttdzmv.r-vacyoi.css-175oi2r"]],
    ] },
    'soundcloud.com': { name: 'soundcloud', groups: [
        ["sc.footer", "footer and mobile apps", [".sc-border-light-top.standard.sc-text-secondary.sc-text-verylight.l-footer", ".mobileApps.g-all-transitions-200-linear.sidebarModule > .sc-border-light-bottom.sc-text-primary.sc-type-light.g-flex-row-centered-spread.sidebarHeader", ".m-sidebar.sc-clearfix.mobileAppsButtons"]],
        ["sc.header", "header upsell, for artists, upload, messages", [".left.header__upsellWrapper", ".header__forArtistsButton.header__link", ".header__link.uploadButton", ".header__userNavMessagesButton.header__userNavButton.header__userNavItem"]],
        ["sc.banners", "banners and credit tracker embeds", ["iframe[src*=\"/n/embeds/credit-tracker\"]", ".primary.l-inner-fullwidth.m-get_heard.sc-p-2x.sc-text-body.sc-type-medium.banner", ".visible.sc-p-2x.sc-mb-2x.sc-mx-2x.sc-border-light-bottom.featureHeader"]],
    ] },
    'claude.ai': { name: 'claude', groups: [
        ["cl.misc", "header, sidebar and input extras", [".p-1\\.5.overflow-hidden.h-\\[248px\\].flex-col.flex.z-10.relative.select-none.shadow-sm.rounded-xl.border-border-300.border-0\\.5.backdrop-blur-sm.bg-bg-000\\/95", "div.group.relative:nth-of-type(4) > ._ghost_10ocf_96._fill_10ocf_9.active\\:scale-\\[1\\.0\\].active\\:bg-bg-300.overflow-hidden.\\!-outline-offset-2.before\\:\\!transition-none.\\!transition-none.px-4.\\!rounded-\\[9px\\].py-1\\.5.group.\\!min-w-0.w-full.\\!text-xs.whitespace-nowrap.min-w-\\[4rem\\].px-3.rounded-md.h-8.ease-\\[cubic-bezier\\(0\\.165\\,0\\.85\\,0\\.45\\,1\\)\\].duration-300.font-base.transition.border-transparent.disabled\\:drop-shadow-none.disabled\\:shadow-none.disabled\\:opacity-50.disabled\\:pointer-events-none.select-none.can-focus.shrink-0.isolate.relative.justify-center.items-center.inline-flex", ".cursor-pointer.hover\\:border-transparent.hover\\:text-text-000.hover\\:bg-bg-400.border-border-200\\/30.text-text-000.bg-transparent.\\!rounded-lg.rounded-md.w-8.h-8.backface-hidden.duration-100.transition.overflow-hidden.border-0\\.5.font-base-bold.disabled\\:drop-shadow-none.disabled\\:shadow-none.disabled\\:opacity-50.disabled\\:pointer-events-none.select-none.can-focus.shrink-0.isolate.relative.justify-center.items-center.inline-flex.downloads-link", "#base-ui-_r_2k1_", "#base-ui-_r_2k2_", "#_r_2k5_", "div.bg-border.h-px.my-1.comfortable\\:mx-2\\.5.compact\\:mx-2:nth-of-type(4)", ".intercom-launcher.data-\\[highlighted\\]\\:bg-fill-ghost-hover.text-primary.data-\\[disabled\\]\\:pointer-events-none.data-\\[disabled\\]\\:opacity-50.outline-none.select-none.text-body.rounded.py-\\[calc\\(\\(var\\(--cds-h-control\\)-var\\(--cds-leading-body\\)\\)\\/2\\)\\].comfortable\\:px-2\\.5.compact\\:px-2.gap-xs.items-center.w-full.flex.cds-reset", "#_r_2ju_", "div.bg-border.h-px.my-1.comfortable\\:mx-2\\.5.compact\\:mx-2:nth-of-type(6)", "li:nth-of-type(4) > .hover\\:bg-bg-200.items-center.gap-3.flex.line-clamp-1.h-9.px-3.rounded-lg.ease-in-out.transition-colors.whitespace-nowrap.block.font-base", "li:nth-of-type(7) > .hover\\:bg-bg-200.items-center.gap-3.flex.line-clamp-1.h-9.px-3.rounded-lg.ease-in-out.transition-colors.whitespace-nowrap.block.font-base", ".text-start.font-normal.text-text-500.text-xs.truncate.w-full", ".text-bg-100.bg-text-200.text-\\[16px\\].w-9.h-9.select-none.font-bold.rounded-full.justify-center.items-center.shrink-0.flex", ".overflow-visible.flex-shrink-0.gap-2.items-center.flex > .flex-shrink-0 > path", "#base-ui-_r_26e_", ".bg-bg-300.pointer-events-auto.duration-150.transition-opacity.select-none.text-text-500.sm\\:font-base.font-small.text-center.pr-2\\.5.pl-2.h-8.rounded-lg.gap-1\\.5.items-center.inline-flex.ml-0\\.5", ".cursor-pointer.hover\\:border-transparent.hover\\:text-text-000.hover\\:bg-bg-400.border-border-200.text-text-000.bg-transparent.\\!rounded-lg.rounded-md.w-8.h-8.backface-hidden.duration-100.transition.overflow-hidden.border-0\\.5.font-base-bold.disabled\\:drop-shadow-none.disabled\\:shadow-none.disabled\\:opacity-50.disabled\\:pointer-events-none.select-none.can-focus.shrink-0.isolate.relative.justify-center.items-center.inline-flex.downloads-link", ".overflow-visible.flex-shrink-0.gap-2.items-center.flex", ".delay-300.md\\:opacity-100.ease-in-out.duration-150.transition-opacity.\\!h-12.gap-1.items-center.pr-3.min-w-0.shrink-0.justify-end.flex.max-md\\:pointer-events-auto.max-md\\:self-end.max-md\\:w-fit.z-20.md\\:top-0.md\\:right-0.md\\:absolute", ".transition.hover\\:text-text-300", ".relative > .group.relative > ._ghost_10ocf_96._fill_10ocf_9.active\\:scale-\\[1\\.0\\].active\\:bg-bg-300.overflow-hidden.\\!-outline-offset-2.before\\:\\!transition-none.\\!transition-none.px-4.\\!rounded-\\[9px\\].py-1\\.5.group.\\!min-w-0.w-full.\\!text-xs.whitespace-nowrap.min-w-\\[4rem\\].px-3.rounded-md.h-8.ease-\\[cubic-bezier\\(0\\.165\\,0\\.85\\,0\\.45\\,1\\)\\].duration-300.font-base.transition.border-transparent.disabled\\:drop-shadow-none.disabled\\:shadow-none.disabled\\:opacity-50.disabled\\:pointer-events-none.select-none.can-focus.shrink-0.isolate.relative.justify-center.items-center.inline-flex", ".bg-neutral-30.pointer-events-auto.duration-150.transition-opacity.select-none.text-muted.sm\\:font-base.font-small.text-center.pr-2\\.5.pl-2.h-8.rounded-lg.gap-1\\.5.items-center.inline-flex.ml-0\\.5"]],
    ] },
    'reddit.com': { name: 'reddit', groups: [
        ["rd.sidebar", "sidebar extras, advertise, footer links", [".justify-end.flex-col.flex.grow.py-md.visible", ".nd\\:hidden > .rounded-none.border-none.bg-transparent.m-0.p-0 > .font-normal > faceplate-tracker > .mt-0.list-none.relative > .s\\:rounded-2.bg-transparent.-outline-offset-1.py-2xs.cursor-pointer.hover\\:no-underline.hover\\:bg-neutral-background-hover.hover\\:text-secondary-hover.text-secondary.gap-xs.px-md.relative.justify-between.flex", "#recent-communities-section > .rounded-none.border-none.bg-transparent.m-0.p-0 > .font-normal > .mt-0.list-none.relative > .s\\:rounded-2.bg-transparent.-outline-offset-1.py-2xs.cursor-pointer.hover\\:no-underline.hover\\:bg-neutral-background-hover.hover\\:text-secondary-hover.text-secondary.gap-xs.px-md.relative.justify-between.flex", ".border-neutral-border-weak.border-solid.border-b-sm.border-0.pb-sm.mb-sm", ".nd\\:visible > faceplate-expandable-section-helper > .rounded-none.border-none.bg-transparent.m-0.p-0 > .font-normal > .mt-0.list-none.relative > .s\\:rounded-2.bg-transparent.-outline-offset-1.py-2xs.cursor-pointer.hover\\:no-underline.hover\\:bg-neutral-background-hover.hover\\:text-secondary-hover.text-secondary.gap-xs.px-md.relative.justify-between.flex", "hr.border-neutral-border-weak.my-sm.w-100:nth-of-type(2)", ".gap-xs.items-center.flex-wrap.gap-2xs.flex.list-none.m-0.p-0.text-caption-1.text-neutral-content-weak", "advertise-button > .contents.nd\\:visible > .contents.nd\\:visible > .inline-flex.button.justify-center.items-center.icon.button-plain.px-\\[calc\\(var\\(--rem12\\)-var\\(--button-border-width\\,0px\\)\\)\\].button-medium", ".inline-flex.button.justify-center.items-center.button-plain.px-\\[calc\\(var\\(--rem12\\)-var\\(--button-border-width\\,0px\\)\\)\\].button-medium.active\\:no-underline.hover\\:no-underline.no-underline"]],
    ] },
    'civitai.red': { name: 'civitai', groups: [
        ["cv.header", "header buttons, buzz, support", [".mantine-UnstyledButton-root.m_87cf2631.SupportButton-module-scss-module__Csn2Wa__supportButtonMediaQuery.SupportButton-module-scss-module__Csn2Wa__supportButtonRoyal.SupportButton-module-scss-module__Csn2Wa__supportButton.mantine-focus-auto", ".gap-3.items-center.flex > div.flex > .mantine-UnstyledButton-root.m_87cf2631.mantine-Button-root.m_77c9d27d.\\@md\\:pr-1.\\@md\\:rounded-r-none.py-2.\\!px-2.h-auto.mantine-active.mantine-focus-auto", ".mantine-UnstyledButton-root.m_87cf2631.mantine-Button-root.m_77c9d27d.HomeContentToggle-module__KEfbxa__tabHighlight.pr-4.pl-3.py-2.border-none.rounded-full.overflow-visible.h-8.mantine-active.mantine-focus-auto", ".gap-3.items-center.flex > div.flex > .mantine-UnstyledButton-root.m_87cf2631.mantine-Button-root.m_77c9d27d.\\@max-md\\:hidden.rounded-l-none.mantine-active.mantine-focus-auto", "#mantine-amuzixsny-target > .mantine-ActionIcon-icon.m_8d3afb97 > .tabler-icon-screen-share.tabler-icon", "#mantine-tyqjp6ln7-target > .mantine-ActionIcon-icon.m_8d3afb97", ".tabler-icon-eye-exclamation.tabler-icon", ".gap-3.items-center.flex > div > .mantine-Indicator-root.m_e5262200.font-bold.text-sm.items-center.flex > .mantine-UnstyledButton-root.m_87cf2631.mantine-ActionIcon-root.m_8d3f4000.mantine-active.mantine-focus-auto", ".gap-3.items-center.flex > .relative > .mantine-Indicator-root.m_e5262200.items-center.flex", ".dark\\:bg-dark-4.bg-gray-2.justify-between.my-1.-mx-1.hover\\:dark\\:bg-dark-4.\\@md\\:py-2\\.5.\\@md\\:px-3.hover\\:bg-gray-1.py-3.px-4.gap-2\\.5.items-center.flex", "#mantine-vh4bn0z8n-target > .\\@max-md\\:hidden.gap-2.items-center.flex > .mantine-Text-root.m_b6d8b162.UserBuzz-module-scss-module__Gnb6xa__withGradient.UserBuzz-module-scss-module__Gnb6xa__userBuzz.mantine-focus-auto > .mantine-Group-root.m_4081bf90", ".__m__-r643.\\@max-md\\:hidden.gap-3.justify-end.items-center.flex.mantine-Grid-col.m_96bdd299 > .mantine-Divider-root.m_3eebeb36", "img[src*=\"/xG1nkqKTMzGDvpLrqFT7WA/d1b70803-258d-4e6a-b90b-ef13773a1bb3/anim=false,width=450,optimized=true/b52bc605-cf38-47c5-ba9b-585f628b53d9-0.jpeg\"]", ".__m__-r13of.\\@max-md\\:hidden.gap-3.justify-end.items-center.flex.mantine-Grid-col.m_96bdd299 > .mantine-Divider-root.m_3eebeb36"]],
    ] },
    'discord.com': { name: 'discord', groups: [
        ["dc.notice", "notice banner", [".images-dark.theme-darker.theme-dark.notice__29487"]],
        ["dc.channels", "channel link rows", ["span > div > .container_e45859.channel__972a0 > .linkButton__972a0.interactive__972a0.interactive_f88cfd > .link__972a0", ".wrapper__553bf > .container_e45859.channel__972a0 > .linkButton__972a0.interactive__972a0.interactive_f88cfd > .link__972a0", ".content_d125d2 > li.container_e45859.channel__972a0 > .linkButton__972a0.interactive__972a0.interactive_f88cfd > .link__972a0"]],
    ] },
    'pinterest.com': { name: 'pinterest', groups: [
        ["pi.misc", "page clutter", [".n62I2n.mJ2PyB.bnBtRO.aHn_t7.NYgy1O.Fm_EPH.ADXRXN > div", ".n62I2n.mJ2PyB.bnBtRO.aHn_t7.NYgy1O.Fm_EPH.ADXRXN"]],
    ] },
    'chess.com': { name: 'chess', groups: [
        ["ch.ads", "ads and promo sidebar link", ["img[src*=\"/uploads/ad_image/31651.69a77f72.png\"]", ".sidebar-link-monetization-campaign.sidebar-link.cc-button-medium.cc-bg-ghost.cc-button-ghost.cc-button-component"]],
    ] },
    'chat.deepseek.com': { name: 'deepseek', groups: [
        ["ds.misc", "page clutter and avatar", ["._9d8da05", "img[src*=\"/user-avatar/iGpXXdWg-8HUZ8rPFjEA7lcR\"]"]],
    ] },
    'utags.link': { name: 'utags', groups: [
        ["ut.misc", "sidebar and header button", [".svelte-4ba2oq.dark\\:bg-gray-900.select-none.ease-in-out.duration-200.transition-all.pb-10.pr-2.pt-4.bg-white.overflow-y-auto.overflow-x-hidden.w-\\[var\\(--sidebar-width\\)\\].h-full.z-49.navigation-sidebar", ".gap-2.items-center.flex > button.dark\\:hover\\:bg-gray-800.dark\\:text-gray-300.hover\\:bg-gray-100.text-gray-600.p-2.rounded-full"]],
    ] },
    'india.numakers.com': { name: 'numakers', groups: [
        ["nm.misc", "whatsapp button", [".qr_wa_icon"]],
    ] },
};

// The SITES entry for a hostname: the key itself or any subdomain of it.
const siteOf = (host) => Object.keys(SITES).find(k => host === k || host.endsWith('.' + k)) || null;
// Stylesheet text for the rules in force: group on, rule not switched off, skip excepted.
const hideCss = (groups, on, off, skip) => groups.filter(([k]) => on(k)).flatMap(([, , sels]) => sels)
    .filter(sel => !off[sel] && sel !== skip).map(sel => `${sel} { display: none !important; }`).join('\n');

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
const DEFAULTS = { cputamer: true, seek: true, miniplayer: true, gesture: true, 'seek-step': 10, 'gesture-sensitivity': 5,
    'sb.sponsor': true, 'sb.selfpromo': true, 'sb.interaction': true, 'sb.intro': false, 'sb.outro': false, 'sb.preview': false, 'sb.filler': false, 'sb.music_offtopic': false, 'sb-markers': false };
// a hide group without its own setting follows flush.hide, the all-groups switch
const cfg = (k) => GM_getValue('flush.' + k, k.startsWith('hide.') ? GM_getValue('flush.hide', true) : DEFAULTS[k]);
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
const SB_CATEGORIES = [['sponsor', 'sponsor'], ['selfpromo', 'self promotion'], ['interaction', 'subscribe reminder'], ['intro', 'intro'], ['outro', 'outro'], ['preview', 'preview | recap'], ['filler', 'filler'], ['music_offtopic', 'non-music in music']];
const PANEL_CSS = `
:host { all: initial; }
* { box-sizing: border-box; font: 13px/1.4 system-ui, sans-serif; color: inherit; }
.p { color: #e8e8ea; background: #1c1c20; border: 1px solid #ffffff1a; border-radius: 12px; padding: 12px; width: 300px;
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
.p > *, details, summary, .rules, .rule { min-width: 0; }
details { border-radius: 7px; }
details[open] { background: #ffffff08; padding-bottom: 4px; }
summary { display: flex; align-items: center; gap: 6px; cursor: pointer; list-style: none; padding: 1px 0; }
summary::before { content: '▸'; opacity: .4; font-size: 10px; width: 8px; }
details[open] > summary::before { content: '▾'; }
summary label { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.n { font-size: 11px; opacity: .45; font-variant-numeric: tabular-nums; }
.rules { display: grid; gap: 1px; padding-left: 14px; }
.rule { gap: 6px; font-size: 11px; padding: 1px 4px; border-radius: 5px; }
.rule:hover { background: #ffffff14; }
.sel { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 11px ui-monospace, monospace; opacity: .75; }
`;

// Same look as mark's .pill-open, in the masthead's top right where the profile picture sits.
const PILL_CSS = `
:host { all: initial; }
button { position: fixed; right: 10px; top: 17px; z-index: 2147482999; background: #1a1a1d; color: #ddd; border: 1px solid #333;
    border-radius: 12px; padding: 3px 10px; font: 12px system-ui; line-height: normal; cursor: pointer; opacity: .7; box-sizing: border-box; }
button:hover { opacity: 1; }
button.low { top: auto; bottom: 40px; }
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
                // only an answer other than success marks the playlist read-only; a network error just stops it this run
                const r = await api('browse/edit_playlist', { playlistId: pl, actions: ops.slice(i, i + 50).map(editAction) }).catch((e) => ({ error: e.message }));
                if (r.error) { failed.push(`${p.title} (${r.error})`); break; }
                if (r.status !== 'STATUS_SUCCEEDED') { p.ro = true; failed.push(p.title); break; }
                await sleep(1000);
            }
        }
        GM_setValue('flush.library', data);
        plan = null;
        say(failed.length ? `not applied: ${failed.join(', ')} | refused ones skipped from now on | refreshing` : 'applied | refreshing');
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
    const toggle = (k, label) => h('label', {},
        h('input', { type: 'checkbox', checked: !!cfg(k), onchange: (e) => { setCfg(k, e.target.checked); applyHide(); applyFeatures(); } }), label);
    const range = (k, label, min, max, unit) => {
        const out = h('span', {}, cfg(k) + unit);
        return h('label', { className: 'r' }, label, out,
            h('input', { type: 'range', min, max, value: cfg(k), oninput: (e) => { out.textContent = e.target.value + unit; setCfg(k, +e.target.value); applyFeatures(); } }));
    };
    root.append(h('style', {}, PANEL_CSS), h('div', { className: 'p', onkeydown: (e) => e.key === 'Escape' && closePanel() },
        h('div', { className: 'top' }, h('b', {}, 'flush'), YT ? h('button', { title: 'the account\'s playlists', onclick: openLibrary }, 'playlists') : '', updateBtn, h('button', { title: 'close (esc)', onclick: closePanel }, '✕')),
        ...(YT ? [h('b', {}, 'player'),
        toggle('seek', 'seek buttons and , . keys'), range('seek-step', 'seek step', 1, 60, 's'),
        toggle('miniplayer', 'miniplayer button (i)'),
        toggle('gesture', 'wheel gestures'), range('gesture-sensitivity', 'gesture step', 1, 20, '%'),
        h('b', {}, 'sponsorblock skip'),
        ...SB_CATEGORIES.map(([c, label]) => toggle('sb.' + c, label)),
        toggle('sb-markers', 'seek bar markers')] : []),
        h('b', {}, `hidden on ${SITES[SITE].name} | hover a rule to show what it hides`),
        ...hideGroups(toggle),
        ...(YT ? [h('b', {}, 'performance'),
        toggle('cputamer', 'cpu tamer (reload)'),
        ...(GM_info.isIncognito ? [h('b', {}, 'yt-dlp'),
            h('button', { className: 'wide', title: 'save youtube.com cookies as Downloads/youtube-cookies.txt', onclick: () => saveCookies(say) }, 'get cookies')] : [])] : []),
        hint));
    return host;
}
function closePanel() { panel?.remove(); panel = null; applyHide(); }
function togglePanel() {
    if (panel) return closePanel();
    panel = buildPanel();
    Object.assign(panel.style, YT ? { right: '10px', top: '46px' } : { right: '10px', bottom: '72px' });
    (document.fullscreenElement || document.body).append(panel);
}

// SITE is the SITES key of this page, YT whether it is youtube; every player feature is youtube only.
let SITE = null, YT = false, hideStyle;
const ruleOff = () => GM_getValue('flush.ruleoff', {});  // selector -> 1 for a rule switched off
// show: the rule being hovered in the panel, shown outlined instead of hidden.
function applyHide(show) {
    if (!hideStyle) return;
    hideStyle.textContent = hideCss(SITES[SITE].groups, k => cfg('hide.' + k), ruleOff(), show)
        + (show ? `\n${show} { outline: 2px solid #f0f !important; outline-offset: -2px !important; }` : '');
}
// The last compound of a selector, unescaped: enough to tell rules apart, the full one is the tooltip.
const ruleName = (sel) => sel.split(/\s*>\s*|\s+/).pop().replace(/\\/g, '');
// One group per details: its switch in the summary, its rules inside, each with its own switch and the
// number of elements it matches on this page; 0 is a rule the site no longer carries.
function hideGroups(toggle) {
    return SITES[SITE].groups.map(([k, label, sels]) => {
        const list = h('div', { className: 'rules' });
        const d = h('details', { ontoggle: () => d.open && list.replaceChildren(...sels.map(sel => {
            let n = 0;
            try { n = document.querySelectorAll(sel).length; } catch { /* selector this browser rejects */ }
            return h('label', { className: 'rule', title: sel, onmouseenter: () => applyHide(sel), onmouseleave: () => applyHide() },
                h('input', { type: 'checkbox', checked: !ruleOff()[sel], onchange: (e) => {
                    const off = ruleOff();
                    if (e.target.checked) delete off[sel]; else off[sel] = 1;
                    GM_setValue('flush.ruleoff', off);
                    applyHide(sel);
                } }),
                h('span', { className: 'sel' }, ruleName(sel)), h('span', { className: 'n' }, String(n)));
        })) }, h('summary', {}, toggle('hide.' + k, label), h('span', { className: 'n' }, String(sels.length))), list);
        return d;
    });
}
function applyFeatures() {
    if (!YT) return;
    cfg('miniplayer') ? ensureMini() : QS('.custom-yt-mini-button')?.remove();
    cfg('seek') ? ensureSeek() : removeSeek();
    renderMarkers();
}

function main() {
    SITE = siteOf(location.hostname);
    if (!SITE) return;
    YT = SITE === 'youtube.com';
    if (YT && cfg('cputamer')) tame(unsafeWindow);
    hideStyle = GM_addStyle('');
    applyHide();
    GM_registerMenuCommand('settings', () => togglePanel());
    document.addEventListener('mousedown', (e) => {
        if (panel && !e.composedPath().some(n => n === panel || n.id === 'flush-pill')) closePanel();
    }, true);
    const pill = () => {
        // shadow root keeps the site's own button css off it, so it renders exactly like mark's pill
        const el = h('div', { id: 'flush-pill' });
        el.attachShadow({ mode: 'closed' }).append(h('style', {}, PILL_CSS), h('button', { title: 'flush settings', className: YT ? '' : 'low', onclick: togglePanel }, 'flush'));
        document.body.append(el);
    };
    const ready = (fn) => document.body ? fn() : document.addEventListener('DOMContentLoaded', fn, { once: true });
    if (!YT) return ready(pill);

    GM_addStyle(`.custom-yt-btn svg { pointer-events: none; }
.flush-sb-markers { position: absolute; inset: 0; pointer-events: none; z-index: 40; }
.flush-sb-markers > div { position: absolute; top: 0; height: 100%; opacity: 0.8; }`);

    GM_registerMenuCommand('playlists', () => openLibrary());

    document.addEventListener('keydown', handleSeekKey, true);
    document.addEventListener('wheel', handleWheel, { capture: true, passive: false });
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
    ready(() => {
        pill();
        new MutationObserver(scheduleApply).observe(document.body, { childList: true, subtree: true }); applyFeatures(); loadSegments();
    });
}

if (typeof module !== 'undefined') module.exports = { clampSeek, seekKeyDelta, tame, SITES, siteOf, hideCss, segmentAt, newer, cookieFile, parsePage, newPairs, planCleanup, editAction };
else main();
