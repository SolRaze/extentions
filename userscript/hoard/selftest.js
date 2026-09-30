// Self-check for the pure helpers in hoard.user.js. Run: node selftest.js
const assert = require('assert');
const { extOf, normalize, sortItems, filterItems, safe, relPath, buildIndex } = require('./hoard.user.js');

// extOf: from the path only, a signed query string must not leak in
assert.strictEqual(extOf('https://scontent.cdninstagram.com/v/t51/123_n.jpg?stp=dst-jpg&_nc=1'), 'jpg');
assert.strictEqual(extOf('https://scontent.cdninstagram.com/o1/v/t16/f2/m86/AQ.mp4?efg=x'), 'mp4');
assert.strictEqual(extOf('https://scontent.cdninstagram.com/v/noext'), 'jpg');

// normalize: carousel parts each yield one file, video preferred over its poster
const img = (w) => ({ url: `https://x.cdninstagram.com/${w}.jpg`, width: w, height: w });
const raw = {
    id: '3401234567890123456_42', code: 'Cabc', taken_at: 100, like_count: 5, media_type: 8,
    user: { username: 'ann', full_name: 'Ann B', profile_pic_url: 'https://x.cdninstagram.com/ann.jpg' }, caption: { text: 'hi #Dog' },
    carousel_media: [
        { image_versions2: { candidates: [img(1080), img(640), img(320), img(150)] } },
        { video_versions: [{ url: 'https://x.cdninstagram.com/v.mp4', width: 720, height: 1280 }], image_versions2: { candidates: [img(1080)] } },
    ],
};
const n = normalize(raw, 0);
assert.strictEqual(n.id, '3401234567890123456_42', 'id stays a string, the pk overflows a number');
assert.strictEqual(n.type, 'album');
assert.strictEqual(n.thumb, img(320).url, 'smallest candidate still 320 wide');
assert.deepStrictEqual(n.files, [
    { url: img(1080).url, video: false, w: 1080, h: 1080 },
    { url: 'https://x.cdninstagram.com/v.mp4', video: true, w: 720, h: 1280 },
]);
assert.deepStrictEqual([n.name, n.pic], ['Ann B', 'https://x.cdninstagram.com/ann.jpg']);
assert.strictEqual(normalize({ id: 1, media_type: 2, product_type: 'clips' }, 0).type, 'reel');
assert.deepStrictEqual(normalize({ id: 1, media_type: 1 }, 0).files, [], 'missing media gives no files, not a crash');

// sort + filter
const it = (o) => ({ id: o.code, code: o.code, user: 'u', taken: 0, type: 'photo', caption: '', cols: [], files: [{ url: 'https://x/a.jpg' }], ...o });
const items = [
    it({ code: 'a', order: 0, user: 'zed', taken: 5, cols: ['c1'] }),
    it({ code: 'b', order: 1, user: 'amy', taken: 9, type: 'reel', caption: 'Sunset' }),
    it({ code: 'c', order: 2, user: 'amy', taken: 1 }),
];
const codes = (l) => l.map(x => x.code).join('');
assert.strictEqual(codes(sortItems(items, 'saved')), 'abc');
assert.strictEqual(codes(sortItems(items, 'newest')), 'bac');
assert.strictEqual(codes(sortItems(items, 'oldest')), 'cab');
assert.strictEqual(codes(sortItems(items, 'user')), 'bca', 'ties keep saved order');
assert.strictEqual(codes(sortItems(items, 'bogus')), 'abc');
assert.strictEqual(codes(items), 'abc', 'sort must not mutate');
assert.strictEqual(codes(filterItems(items, { col: 'c1' })), 'a');
assert.strictEqual(codes(filterItems(items, { col: '-' })), 'bc');
assert.strictEqual(codes(filterItems(items, { type: 'reel' })), 'b');
assert.strictEqual(codes(filterItems(items, { q: 'sunSET' })), 'b');
assert.strictEqual(codes(filterItems(items, { q: 'AMY' })), 'bc');

// file names: path-safe folder, numbered only for multi-file posts
assert.strictEqual(safe('a/b:c*?'), 'a_b_c_');
assert.strictEqual(safe('..'), '_');
assert.strictEqual(relPath(items[0], 0, 'https://x/a.jpg?x=1', 'Art / Refs'), 'Art _ Refs/zed_a.jpg');
const multi = it({ code: 'm', user: 'amy', files: [{ url: 'https://x/1.jpg' }, { url: 'https://x/2.mp4' }] });
assert.strictEqual(relPath(multi, 1, multi.files[1].url, 'saved'), 'saved/amy_m_2.mp4');

// buildIndex: data inlined, posts in saved order, a caption cannot break out of the script block
const arc = {
    cols: [{ id: 'c1', name: 'Cars' }],
    profiles: { zed: { name: 'Zed', pic: 'profiles/zed.jpg' } },
    posts: {
        b: { code: 'b', user: 'amy', order: 1, cols: [], caption: 'x</script><b>', media: [{ p: 'saved/amy_b.jpg' }] },
        a: { code: 'a', user: 'zed', order: 0, cols: ['c1'], caption: '', media: [{ p: 'Cars/zed_a.jpg' }] },
    },
};
const html = buildIndex(arc, 123);
assert.strictEqual(html.includes('__DATA__'), false);
assert.strictEqual((html.match(/<\/script>/g) || []).length, 2, 'only the two real closing tags');
const data = JSON.parse(/window\.HOARD = (.*);<\/script>/.exec(html)[1]);
assert.strictEqual(data.at, 123);
assert.deepStrictEqual(data.posts.map(p => p.code), ['a', 'b']);
assert.strictEqual(data.posts[1].caption, 'x</script><b>');
assert.strictEqual(buildIndex({ posts: {} }, 1).includes('"cols":[]'), true, 'empty archive still renders');

// vault.js: notes per post, author, collection; tags Obsidian accepts
const { tagOf, buildNotes } = require('./vault.js');
assert.strictEqual(tagOf('Art Refs'), 'art-refs');
assert.strictEqual(tagOf('Café #1'), 'café-1');
assert.strictEqual(tagOf('2024'), '', 'all-digit tags are not tags in Obsidian');
const notes = buildNotes(data);
assert.deepStrictEqual(Object.keys(notes).sort(), [
    'notes/authors/@amy.md', 'notes/authors/@zed.md', 'notes/collections/collection Cars.md',
    'notes/posts/a.md', 'notes/posts/b.md',
]);
assert.ok(notes['notes/posts/a.md'].includes('tags: [collection/cars]\n'), 'no type tag when the type is unknown');
assert.ok(notes['notes/posts/a.md'].includes('[[@zed]] · [[collection Cars]]'));
assert.ok(notes['notes/posts/a.md'].includes('![[Cars/zed_a.jpg]]'));
assert.ok(notes['notes/posts/b.md'].includes('[[@amy]] · no collection'));
assert.ok(notes['notes/authors/@zed.md'].includes('![[profiles/zed.jpg|96]]'));

console.log('ok');
