// Self-check for lance.user.js pure helpers. Run: node selftest.js
const assert = require('assert');
const { newer, injectPrefix, makeFilename, csvCell, mergePrompts } = require('./lance.user.js');

assert.ok(newer('1.10', '1.9') && !newer('1.2', '1.2') && !newer('1.0', '1.0.1'));
console.log('update: ok');

// injectPrefix: prepend and prompt each on their own, nothing twice
assert.strictEqual(injectPrefix('be terse', '', 'hi'), 'be terse\n\n', 'prepend alone injects');
assert.strictEqual(injectPrefix('', 'PROMPT', 'hi'), 'PROMPT\n\n');
assert.strictEqual(injectPrefix('a', 'b', 'hi'), 'a\n\nb\n\n');
assert.strictEqual(injectPrefix('', null, 'hi'), '', 'nothing to add');
assert.strictEqual(injectPrefix('a', 'b', 'a\n\nb\n\nhi'), '', 'already injected');
console.log('injection: ok');

assert.strictEqual(makeFilename('chat', 12, new Date(2026, 9, 5)), '20261005_0012_chat');
assert.strictEqual(csvCell('say "hi", ok'), '"say ""hi"", ok"');
console.log('export: ok');

// mergePrompts: invalid entries dropped, same title replaced, enabled kept
const saved = [{ title: 'a', content: 'old', enabled: true }];
const merged = mergePrompts(saved, [{ title: 'a', content: 'new' }, { title: 'b', content: 'x', enabled: false }, { title: '', content: 'y' }, { content: 'z' }, 'junk']);
assert.deepStrictEqual(merged, [{ title: 'a', content: 'new', enabled: true }, { title: 'b', content: 'x', enabled: false }]);
assert.strictEqual(saved[0].content, 'old', 'saved list untouched');
assert.throws(() => mergePrompts([], { title: 'a' }), /not a list/);
console.log('prompts: ok');
