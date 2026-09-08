// Self-check for the pure helpers in bridge.user.js. Run: node selftest.js
const assert = require('assert');
const { extOf, isSliceable, modelUrl, deepLink } = require('./bridge.user.js');

// The exact pattern OrcaSlicer validates a deep link against (Downloader.cpp).
const ORCA_RE = /^(orcaslicer|prusaslicer|bambustudio|cura):\/\/open\/?\?file=/i;
const payload = (link) => decodeURIComponent(link.replace(ORCA_RE, ''));

// deepLink: builds a link Orca accepts, and survives one unescape back to the original URL
const plain = 'https://cdn.thingiverse.com/assets/ab/cd/benchy.stl';
assert.ok(ORCA_RE.test(deepLink(plain)), 'must match the URL pattern Orca accepts');
assert.strictEqual(payload(deepLink(plain)), plain);

const spaced = 'https://cdn.thingiverse.com/assets/ab/cd/3D Benchy v2.stl';
assert.strictEqual(deepLink(spaced).includes('+'), false, 'spaces are %20, not + — this is a path, not a form field');
assert.strictEqual(payload(deepLink(spaced)), spaced);

const query = 'https://cdn.thingiverse.com/assets/ab/cd/part.stl?token=a1&expires=2';
assert.strictEqual(payload(deepLink(query)), query, 'a signed URL must not lose its query string');

const percent = 'https://cdn.thingiverse.com/assets/ab/cd/100%25 scale.stl';
assert.strictEqual(payload(deepLink(percent)), percent, 'Orca unescapes once, so a literal % must be encoded');

// extOf: last dotted segment, lowercased
assert.strictEqual(extOf('benchy.stl'), 'stl');
assert.strictEqual(extOf('BENCHY.STL'), 'stl');
assert.strictEqual(extOf('plate.v2.3mf'), '3mf');
assert.strictEqual(extOf('readme'), 'readme', 'no dot means the whole name, which no whitelist matches');

// isSliceable: a printable file that actually has a URL to hand Orca
const file = (over) => ({ name: 'benchy.stl', public_url: 'https://cdn.thingiverse.com/x/benchy.stl', ...over });
assert.strictEqual(isSliceable(file()), true);
assert.strictEqual(isSliceable(file({ name: 'plate.3mf' })), true);
assert.strictEqual(isSliceable(file({ name: 'mesh.obj' })), true);
assert.strictEqual(isSliceable(file({ name: 'notes.pdf' })), false);
assert.strictEqual(isSliceable(file({ name: 'sliced.gcode' })), false, 'gcode is not something to open for slicing');
assert.strictEqual(isSliceable(file({ public_url: '' })), false, 'no URL means nothing to hand over');
assert.strictEqual(isSliceable(file({ name: '' })), false);
assert.strictEqual(isSliceable(undefined), false, 'a Download button naming no known file must be skipped');

// modelUrl: which links on an arbitrary page are worth putting a chip next to
assert.strictEqual(modelUrl('https://example.com/parts/bracket.stl'), 'https://example.com/parts/bracket.stl');
assert.strictEqual(modelUrl('http://example.com/a.STEP'), 'http://example.com/a.STEP', 'extension match is case insensitive');
assert.strictEqual(modelUrl('https://example.com/dl?file=a.stl&id=2'), null, 'the extension has to be in the path, not a parameter');
assert.strictEqual(modelUrl('https://example.com/a.stl?dl=1'), 'https://example.com/a.stl?dl=1', 'but a query string after it is fine');
assert.strictEqual(modelUrl('https://example.com/a.stl#preview'), 'https://example.com/a.stl#preview');
// the substring selector that feeds this casts a wider net than the extension list does
assert.strictEqual(modelUrl('https://example.com/page.object'), null);
assert.strictEqual(modelUrl('https://example.com/file.stpx'), null);
assert.strictEqual(modelUrl('https://example.com/steps'), null);
assert.strictEqual(modelUrl('https://example.com/a.stl.zip'), null, 'an archive is not something Orca can open');
// Orca fetches the URL itself, with no browser session and no access to the page
assert.strictEqual(modelUrl('blob:https://example.com/9f2c-4b1a'), null);
assert.strictEqual(modelUrl('data:model/stl;base64,c29saWQ='), null);
assert.strictEqual(modelUrl('file:///Users/sol/a.stl'), null);
assert.strictEqual(modelUrl('javascript:void(0)'), null);

console.log('ok');
