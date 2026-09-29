// Self-check for the pure helpers in hoard.user.js. Run: node selftest.js
const assert = require('assert');
const { tagsOf, extOf, normalize, sortItems, filterItems, safe, fileName, suggest } = require('./hoard.user.js');

// tagsOf: unique, lowercased, unicode letters kept
assert.deepStrictEqual(tagsOf('#Cat and #cat #café_2 end'), ['#cat', '#café_2']);
assert.deepStrictEqual(tagsOf(''), []);

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
assert.deepStrictEqual(n.tags, ['#dog']);
assert.strictEqual(normalize({ id: 1, media_type: 2, product_type: 'clips' }, 0).type, 'reel');
assert.deepStrictEqual(normalize({ id: 1, media_type: 1 }, 0).files, [], 'missing media gives no files, not a crash');

// sort + filter
const it = (o) => ({ id: o.code, code: o.code, user: 'u', taken: 0, likes: 0, type: 'photo', caption: '', tags: [], cols: [], files: ['https://x/a.jpg'], ...o });
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

// suggest: author pulls a post into its collection, hashtags alone need enough weight
const cols = [{ id: 'c1', name: 'Cars' }, { id: 'c2', name: 'Food' }];
const lib = [
    it({ code: 'k1', user: 'revv', cols: ['c1'], tags: ['#jdm'] }),
    it({ code: 'k2', user: 'revv', cols: ['c1'], tags: ['#jdm'] }),
    it({ code: 'f1', user: 'chef', cols: ['c2'], tags: ['#pasta'] }),
    it({ code: 'u1', user: 'revv' }),                               // 2 posts by revv in Cars → 6
    it({ code: 'u2', user: 'nobody', tags: ['#jdm', '#pasta'] }),   // Cars 2, Food 1 → below 3
    it({ code: 'u3', user: 'painter', tags: ['#oil'] }),
    it({ code: 'u4', user: 'painter', tags: ['#oil'] }),
    it({ code: 'u5', user: 'painter' }),
    it({ code: 'u6', user: 'x', tags: ['#oil'] }),
    it({ code: 'u7', user: 'y', tags: ['#oil'] }),
    it({ code: 'u8', user: 'z', tags: ['#oil', '#cars'] }),
    it({ code: 'u9', user: 'q', tags: ['#cars'] }),
];
const s = suggest(lib, cols);
assert.deepStrictEqual(s.moves.map(m => [m.item.code, m.col, m.score]), [['u1', 'c1', 6]]);
assert.deepStrictEqual(s.fresh.map(f => [f.name, codes(f.items)]), [['painter', 'u3u4u5'], ['oil', 'u6u7u8']],
    'author first, a claimed post is not reused, "cars" matches an existing name and 2 posts is too few anyway');
assert.strictEqual(suggest(lib, cols, { minNew: 2 }).fresh.some(f => f.name === 'cars'), false, 'never recreate an existing collection name');

console.log('ok');
