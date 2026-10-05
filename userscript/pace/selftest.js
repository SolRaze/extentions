// Self-check for pace.user.js: chapter parsing, skip ranges and source picking.
// Run: node selftest.js
const assert = require('assert');
const { parseChpl, skipRanges, pickSource } = require('./pace.user.js');

// chpl v1 as muxed in One Pace files, behind padding as in a file tail
const title = (s) => [s.length, ...Buffer.from(s)];
const time = (sec) => { const b = Buffer.alloc(8); b.writeBigUInt64BE(BigInt(Math.round(sec * 1e7))); return [...b]; };
const box = [
    ...Buffer.from('chpl'), 1, 0, 0, 0, 0, 0, 0, 0, 3,
    ...time(0), ...title("Ace's Despair"),
    ...time(80.35), ...title('Opening'),
    ...time(231.33), ...title('Episode'),
];
const bytes = new Uint8Array([...Buffer.alloc(100, 7), ...box]);

const ch = parseChpl(bytes);
assert.deepStrictEqual(ch.map((c) => c.title), ["Ace's Despair", 'Opening', 'Episode']);
assert.strictEqual(ch[1].start, 80.35);

// only the opening is skipped, and it ends where the episode starts
assert.deepStrictEqual(skipRanges(ch, 2058.7), [{ title: 'Opening', start: 80.35, end: 231.33 }]);
// an ending as the last chapter runs to the file's end
assert.deepStrictEqual(skipRanges([{ start: 0, title: 'Episode' }, { start: 1200, title: 'Ending' }], 1290), [{ title: 'Ending', start: 1200, end: 1290 }]);
// "Episode" and "Opener Arc"-like titles are not skipped
assert.deepStrictEqual(skipRanges([{ start: 0, title: 'Openers' }], 10), []);
// no chpl box, no chapters
assert.deepStrictEqual(parseChpl(new Uint8Array(64)), []);

// pickSource: variant base and cut, then nearest resolution
const src = {
    'English Subtitles': { '480p': 'a', '1080p': 'b' },
    'English Subtitles, Extended Cut': { '720p': 'c' },
    'English Dub': { '720p': 'd' },
};
assert.deepStrictEqual(pickSource(src, 'English Subtitles', '1080p', false), { label: 'English Subtitles', res: '1080p', id: 'b' });
assert.strictEqual(pickSource(src, 'English Subtitles', '720p', false).id, 'a', '720p missing: 480p is nearer than 1080p');
assert.strictEqual(pickSource(src, 'English Subtitles', '480p', true).id, 'c', 'alternate cut preferred when on');
assert.strictEqual(pickSource(src, 'English Dub', '1080p', true).id, 'd', 'no cut for this variant: plain one');
assert.strictEqual(pickSource(src, 'English Dub with Closed Captions', '480p', false).label, 'English Subtitles', 'variant missing: first label');
assert.strictEqual(pickSource({}, 'English Dub', '720p', false), null);

console.log('ok');
