// Self-check for mark.user.js link rules and import merge. Run: node selftest.js
const assert = require('assert');
global.GM_setValue = () => {};
const { match, norm, merge, effectsOf, _setStore } = require('./mark.user.js');

const key = (href, text) => match(href, text)?.key ?? null;
const type = (href, text) => match(href, text)?.type ?? null;

assert.strictEqual(norm('https://www.reddit.com/r/foo/?x=1#c'), 'reddit.com/r/foo?x=1');
assert.strictEqual(norm('https://twitter.com/Jack'), 'x.com/Jack', 'twitter folds into x');
assert.strictEqual(norm('javascript:void(0)'), '');

// x: users only from @handle links, reserved paths never
assert.strictEqual(key('https://x.com/Jack', '@Jack'), 'https://x.com/jack');
assert.strictEqual(key('https://x.com/Jack', 'Jack Dorsey'), null, 'display name link would double the chips');
assert.strictEqual(key('https://x.com/home', '@home'), null);
assert.strictEqual(type('https://x.com/jack/status/20', '2h'), 'post');

// reddit: u/ and user/ share one key, post beats community
assert.strictEqual(key('https://www.reddit.com/u/Spez/', 'spez'), 'https://reddit.com/user/spez');
assert.strictEqual(key('https://old.reddit.com/user/spez', 'spez'), 'https://reddit.com/user/spez');
assert.strictEqual(type('https://www.reddit.com/r/foo/comments/abc/title/', 't'), 'post');
assert.strictEqual(key('https://www.reddit.com/r/Foo/', 'r/Foo'), 'https://reddit.com/r/foo');

// github: user, repo, issue, reserved paths
assert.strictEqual(type('https://github.com/torvalds', 'torvalds'), 'user');
assert.strictEqual(key('https://github.com/torvalds/linux', 'linux'), 'https://github.com/torvalds/linux', 'repo keeps case');
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

// effects
assert.deepStrictEqual(effectsOf(['Block', 'foo']), ['hide']);
assert.deepStrictEqual(effectsOf(['★', 'clickbait']), ['star', 'dim']);

// merge: union of tags, deleted utags entries skipped, newer meta wins
const store = { data: { a: { tags: ['x'], meta: { title: 'old', updated: 1 } } } };
_setStore(store);
const n = merge({ data: { a: { tags: ['y'], meta: { title: 'new', updated: 2 } }, b: { tags: ['._DELETED_'] }, c: { tags: ['z'] } } });
assert.strictEqual(n, 2);
assert.deepStrictEqual(store.data.a.tags, ['x', 'y']);
assert.strictEqual(store.data.a.meta.title, 'new');
assert.ok(!store.data.b);
assert.throws(() => merge({ foo: 1 }));

console.log("ok"); // exit before the scan refresh() scheduled, there is no DOM here
process.exit(0);
