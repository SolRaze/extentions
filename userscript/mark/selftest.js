// Self-check for mark.user.js link rules, tag edits and import merge. Run: node selftest.js
const assert = require('assert');
global.GM_setValue = () => {};
let gmStore;
global.GM_getValue = () => gmStore;
const { match, linkMatch, norm, load, merge, effectsOf, renameTag, retag, deleteTag, _setStore } = require('./mark.user.js');

const key = (href, text) => match(href, text)?.key ?? null;
const type = (href, text) => match(href, text)?.type ?? null;

assert.strictEqual(norm('https://www.reddit.com/r/foo/?x=1#c'), 'reddit.com/r/foo?x=1');
assert.strictEqual(norm('https://twitter.com/Jack'), 'x.com/Jack', 'twitter folds into x');
assert.strictEqual(norm('javascript:void(0)'), '');
assert.strictEqual(norm('https://a.com/x?utm_source=t&id=1&si=z'), 'a.com/x?id=1', 'tracking params drop');
assert.strictEqual(norm('https://a.com/x?q=a%20b'), 'a.com/x?q=a%20b', 'clean queries keep their encoding');

// x: users only from @handle links, reserved paths never
assert.strictEqual(key('https://x.com/Jack', '@Jack'), 'https://x.com/jack');
assert.strictEqual(key('https://x.com/Jack', 'Jack Dorsey'), null, 'display name link would double the chips');
assert.strictEqual(key('https://x.com/home', '@home'), null);
assert.strictEqual(type('https://x.com/jack/status/20', '2h'), 'post');
assert.strictEqual(match('https://x.com/Jack/status/20', '2h').up, 'https://x.com/jack', 'post carries its user');

// reddit: u/ and user/ share one key, post beats community
assert.strictEqual(key('https://www.reddit.com/u/Spez/', 'spez'), 'https://reddit.com/user/spez');
assert.strictEqual(key('https://old.reddit.com/user/spez', 'spez'), 'https://reddit.com/user/spez');
assert.strictEqual(type('https://www.reddit.com/r/foo/comments/abc/title/', 't'), 'post');
assert.strictEqual(key('https://www.reddit.com/r/Foo/', 'r/Foo'), 'https://reddit.com/r/foo');

// github: user, repo, issue, reserved paths
assert.strictEqual(type('https://github.com/torvalds', 'torvalds'), 'user');
assert.strictEqual(key('https://github.com/torvalds/linux', 'linux'), 'https://github.com/torvalds/linux');
assert.strictEqual(key('https://github.com/Torvalds/Linux', 'Linux'), 'https://github.com/torvalds/linux', 'repo folds case');
assert.strictEqual(match('https://github.com/a/b/issues/3', '#3').up, 'https://github.com/a/b');
assert.strictEqual(type('https://github.com/a/b/pull/12', '#12'), 'post');
assert.strictEqual(match('https://github.com/settings', 'settings'), null);
assert.strictEqual(match('https://github.com/torvalds/linux/blob/master/README', 'README'), null, 'files are not repos');

// youtube: watch, shorts and youtu.be are one video key; handles are users
const v = 'https://youtube.com/watch?v=jNQXAC9IVRw';
assert.strictEqual(key('https://www.youtube.com/watch?v=jNQXAC9IVRw&t=5', 'zoo'), v);
assert.strictEqual(key('https://www.youtube.com/shorts/jNQXAC9IVRw', 'zoo'), v);
assert.strictEqual(key('https://youtu.be/jNQXAC9IVRw', 'zoo'), v);
assert.strictEqual(key('https://www.youtube.com/@Jawed/videos', 'jawed'), 'https://youtube.com/@jawed');

// instagram + hacker news
assert.strictEqual(key('https://www.instagram.com/someone/p/Cxyz/', 'x'), 'https://instagram.com/p/Cxyz');
assert.strictEqual(type('https://www.instagram.com/someone/', 'someone'), 'user');
assert.strictEqual(match('https://www.instagram.com/explore/', 'explore'), null);
assert.strictEqual(type('https://news.ycombinator.com/user?id=pg', 'pg'), 'user');
assert.strictEqual(type('https://news.ycombinator.com/item?id=1', '3 comments'), 'post');
assert.strictEqual(match('https://example.com/u/x', 'x'), null, 'unknown sites never match');

// soundcloud, pinterest, civitai
assert.strictEqual(type('https://soundcloud.com/artist', 'artist'), 'user');
assert.strictEqual(type('https://soundcloud.com/artist/song', 'song'), 'track');
assert.strictEqual(match('https://soundcloud.com/artist/song', 's').up, 'https://soundcloud.com/artist');
assert.strictEqual(type('https://soundcloud.com/artist/sets/album', 'a'), 'post');
assert.strictEqual(match('https://soundcloud.com/discover', 'd'), null);
assert.strictEqual(match('https://soundcloud.com/artist/likes', 'l'), null);
assert.strictEqual(key('https://de.pinterest.com/pin/123/', 'p'), 'https://pinterest.com/pin/123', 'regional hosts fold');
assert.strictEqual(type('https://www.pinterest.com/someone/', 's'), 'user');
assert.strictEqual(key('https://civitai.red/models/42/name', 'm'), 'https://civitai.com/models/42');
assert.strictEqual(type('https://civitai.com/images/9', 'i'), 'post');
assert.strictEqual(key('https://civitai.com/user/Bob/models', 'b'), 'https://civitai.com/user/bob');

// any link: off-site links tag as 'link', same-site links without a rule are navigation
assert.deepStrictEqual(linkMatch('https://blog.dev/post?utm_source=x', 'b', 'x.com'), { key: 'https://blog.dev/post', type: 'link' });
assert.strictEqual(linkMatch('https://x.com/i/bookmarks', 'b', 'x.com'), null);

// effects: built-in names by default, the tag's own setting wins
const store = { data: { a: { tags: ['x'], meta: { title: 'old', updated: 1 } } }, meta: { effects: { foo: 'star', block: '' } } };
_setStore(store);
assert.deepStrictEqual(effectsOf(['hide', 'foo']), ['hide', 'star']);
assert.deepStrictEqual(effectsOf(['★', 'clickbait', 'block']), ['star', 'dim']);

// merge: union of tags, deleted utags entries skipped, newer meta wins
_setStore(store);
const n = merge({ data: { a: { tags: ['y'], meta: { title: 'new', updated: 2 } }, b: { tags: ['._DELETED_'] }, c: { tags: ['z'] } } });
assert.strictEqual(n, 2);
assert.deepStrictEqual(store.data.a.tags, ['x', 'y']);
assert.strictEqual(store.data.a.meta.title, 'new');
assert.ok(!store.data.b);
assert.throws(() => merge({ foo: 1 }));

// rename merges onto an existing tag and carries its settings, retag and delete drop empty entries
store.meta.colors = { y: 120 };
renameTag('y', 'x');
assert.deepStrictEqual(store.data.a.tags, ['x']);
assert.strictEqual(store.meta.colors.x, 120);
retag(['a', 'c'], 'q', true);
assert.deepStrictEqual(store.data.c.tags, ['z', 'q']);
retag(['c'], 'z', false);
deleteTag('q');
assert.ok(!store.data.c, 'entry without tags or note is gone');
assert.deepStrictEqual(store.data.a.tags, ['x']);

// load rekeys a utags-shaped store so its tags reach the links they belong to
gmStore = { data: { 'https://www.youtube.com/watch?v=jNQXAC9IVRw': { tags: ['a'], meta: {} }, 'https://youtu.be/jNQXAC9IVRw': { tags: ['b'], meta: {} }, 'https://x.com/Jack/': { tags: ['c'], meta: {} } }, meta: {} };
load();
assert.deepStrictEqual(Object.keys(require('./mark.user.js')._store()).sort(), ['https://x.com/jack', v], 'www, slash, case and youtu.be fold');


console.log("ok"); // exit before the scan refresh() scheduled, there is no DOM here
process.exit(0);
