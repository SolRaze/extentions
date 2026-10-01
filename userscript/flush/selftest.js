// Self-check for flush.user.js: seek helpers, then the cpu tamer against a stub window/document.
// Run: node selftest.js
const assert = require('assert');

const rafQueue = [];
const listeners = {};
const win = {
    setTimeout, setInterval, clearTimeout, clearInterval,
    requestAnimationFrame: (cb) => rafQueue.push(cb)
};
global.document = {
    addEventListener: (type, fn) => { (listeners[type] = listeners[type] || []).push(fn); },
    createElement: () => ({ getContext: () => ({}) })
};

const { clampSeek, seekKeyDelta, tame, segmentAt } = require('./flush.user.js');

// clampSeek: never leaves the [0, duration] range
assert.strictEqual(clampSeek(30, 10, 100), 40);
assert.strictEqual(clampSeek(30, -10, 100), 20);
assert.strictEqual(clampSeek(5, -10, 100), 0, 'must not seek before the start');
assert.strictEqual(clampSeek(95, 10, 100), 100, 'must not seek past the end');
assert.strictEqual(clampSeek(0, -10, 100), 0);
// Live streams report duration as Infinity or NaN; seeking should still work
assert.strictEqual(clampSeek(30, 10, Infinity), 40);
assert.strictEqual(clampSeek(30, 10, NaN), 40);

// seekKeyDelta: claims , and . only while playing, and never from the other bindings
const key = (over) => ({ key: '.', ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, target: null, ...over });
assert.strictEqual(seekKeyDelta(key({}), 10, false), 10);
assert.strictEqual(seekKeyDelta(key({ key: ',' }), 10, false), -10);
assert.strictEqual(seekKeyDelta(key({}), 10, true), 0, 'paused stays YouTube frame-stepping');
assert.strictEqual(seekKeyDelta(key({ shiftKey: true }), 10, false), 0, 'shift stays YouTube speed control');
assert.strictEqual(seekKeyDelta(key({ ctrlKey: true }), 10, false), 0, 'must not eat browser shortcuts');
assert.strictEqual(seekKeyDelta(key({ key: 'k' }), 10, false), 0);
assert.strictEqual(seekKeyDelta(key({ target: { tagName: 'INPUT' } }), 10, false), 0, 'must not seek while typing in search');
assert.strictEqual(seekKeyDelta(key({ target: { tagName: 'DIV', isContentEditable: true } }), 10, false), 0, 'must not seek while typing a comment');
assert.strictEqual(seekKeyDelta(key({ target: { tagName: 'DIV' } }), 10, false), 10, 'plain page elements still seek');
console.log('seek: ok');

tame(win);
const { setTimeout: tamedTimeout, clearTimeout: tamedClear } = win;
const playing = () => listeners.timeupdate.forEach(fn => fn());
const frame = () => rafQueue.splice(0).forEach(fn => fn());
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const settle = async () => { await wait(10); await Promise.resolve(); await Promise.resolve(); };

(async () => {
    // No playback: nothing to tame, callbacks run on their own schedule.
    let idle = 0;
    tamedTimeout(() => idle++, 0);
    await settle();
    assert.strictEqual(idle, 1, 'must run normally when no video is playing');

    // Playback: callbacks wait for a frame, then all fire together.
    playing();
    let held = 0;
    tamedTimeout(() => held++, 0);
    tamedTimeout(() => held++, 0);
    await settle();
    assert.strictEqual(held, 0, 'must defer until the next animation frame while playing');
    frame();
    await settle();
    assert.strictEqual(held, 2, 'must release every waiting callback on one frame');

    // Clearing a callback that is already waiting on a frame must cancel it.
    playing();
    let cleared = 0;
    const cid = tamedTimeout(() => cleared++, 0);
    await settle();
    tamedClear(cid);
    frame();
    await settle();
    assert.strictEqual(cleared, 0, 'clearTimeout must cancel a callback waiting on a frame');

    // Hidden tab: requestAnimationFrame never fires, the watchdog has to flush.
    playing();
    let stalled = 0;
    tamedTimeout(() => stalled++, 0);
    await wait(400);
    assert.strictEqual(stalled, 1, 'watchdog must flush when requestAnimationFrame stalls');

    console.log('cpu tamer: ok');
    process.exit(0);
})();

// segmentAt: enabled categories only, once per segment, never in the last 0.5s
const segs = [{ UUID: 'a', category: 'sponsor', segment: [10, 20] }, { UUID: 'b', category: 'intro', segment: [0, 5] }];
const on = (c) => c === 'sponsor';
assert.strictEqual(segmentAt(segs, 12, on, new Set())?.UUID, 'a');
assert.strictEqual(segmentAt(segs, 2, on, new Set()), undefined, 'disabled category');
assert.strictEqual(segmentAt(segs, 12, on, new Set(['a'])), undefined, 'already skipped');
assert.strictEqual(segmentAt(segs, 19.7, on, new Set()), undefined, 'too close to the end');
assert.strictEqual(segmentAt(segs, 20, on, new Set()), undefined);
console.log('sponsorblock: ok');
