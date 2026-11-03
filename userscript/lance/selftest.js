// Self-check for lance.user.js pure helpers. Run: node selftest.js
const assert = require('assert');
const { newer, injectPrefix, makeFilename } = require('./lance.user.js');

assert.ok(newer('1.10', '1.9') && !newer('1.2', '1.2') && !newer('1.0', '1.0.1'));
console.log('update: ok');

assert.strictEqual(injectPrefix('be terse', 'hi'), 'be terse\n\n');
assert.strictEqual(injectPrefix('', 'hi'), '', 'nothing to add');
assert.strictEqual(injectPrefix('be terse', 'be terse\n\nhi'), '', 'already injected');
assert.strictEqual(injectPrefix('  ', 'hi'), '', 'blank adds nothing');
console.log('injection: ok');

assert.strictEqual(makeFilename('chat', 12, new Date(2026, 9, 5)), '20261005_0012_chat');
console.log('export: ok');
