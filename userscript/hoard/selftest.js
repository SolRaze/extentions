// Self-check for the pure helpers in hoard.user.js. Run: node selftest.js
const assert = require('assert');
const { extOf, normalize, sortItems, filterItems, safe, fileName } = require('./hoard.user.js');

// extOf: from the path only, a signed query string must not leak in
assert.strictEqual(extOf('https://scontent.cdninstagram.com/v/t51/123_n.jpg?stp=dst-jpg&_nc=1'), 'jpg');
assert.strictEqual(extOf('https://scontent.cdninstagram.com/o1/v/t16/f2/m86/AQ.mp4?efg=x'), 'mp4');
assert.strictEqual(extOf('https://scontent.cdninstagram.com/v/noext'), 'jpg');

// normalize: carousel parts each yield one file, video preferred over its poster
const img = (w) => ({ url: `https://x.cdninstagram.com/${w}.jpg`, width: w });
const raw = {
    id: '3401234567890123456_42', code: 'Cabc', taken_at: 100, like_count: 5, media_type: 8,
    user: { username: 'ann' }, caption: { text: 'hi #Dog' },
    carousel_media: [
        { image_versions2: { candidates: [img(1080), img(640), img(320), img(150)] } },
        { video_versions: [{ url: 'https://x.cdninstagram.com/v.mp4' }], image_versions2: { candidates: [img(1080)] } },
    ],
};
const n = normalize(raw, 0);
assert.strictEqual(n.id, '3401234567890123456_42', 'id stays a string, the pk overflows a number');
assert.strictEqual(n.type, 'album');
assert.strictEqual(n.thumb, img(320).url, 'smallest candidate still 320 wide');
assert.deepStrictEqual(n.files, [img(1080).url, 'https://x.cdninstagram.com/v.mp4']);
assert.strictEqual(normalize({ id: 1, media_type: 2, product_type: 'clips' }, 0).type, 'reel');
assert.deepStrictEqual(normalize({ id: 1, media_type: 1 }, 0).files, [], 'missing media gives no files, not a crash');

// sort + filter
const it = (o) => ({ id: o.code, code: o.code, user: 'u', taken: 0, likes: 0, type: 'photo', caption: '', cols: [], files: ['https://x/a.jpg'], ...o });
const items = [
    it({ code: 'a', order: 0, user: 'zed', taken: 5, likes: 1, cols: ['c1'] }),
    it({ code: 'b', order: 1, user: 'amy', taken: 9, likes: 7, type: 'reel', caption: 'Sunset' }),
    it({ code: 'c', order: 2, user: 'amy', taken: 1, likes: 3 }),
];
const codes = (l) => l.map(x => x.code).join('');
assert.strictEqual(codes(sortItems(items, 'saved')), 'abc');
assert.strictEqual(codes(sortItems(items, 'newest')), 'bac');
assert.strictEqual(codes(sortItems(items, 'oldest')), 'cab');
assert.strictEqual(codes(sortItems(items, 'user')), 'bca', 'ties keep saved order');
assert.strictEqual(codes(sortItems(items, 'likes')), 'bca');
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
assert.strictEqual(fileName(items[0], 0, 'https://x/a.jpg?x=1', 'Art / Refs'), 'instagram/Art _ Refs/zed_a.jpg');
const multi = it({ code: 'm', user: 'amy', files: ['https://x/1.jpg', 'https://x/2.mp4'] });
assert.strictEqual(fileName(multi, 1, multi.files[1], 'saved'), 'instagram/saved/amy_m_2.mp4');

console.log('ok');
