#!/usr/bin/env node
// Turns a hoard folder into an Obsidian vault: one note per post, author and collection, built
// from the window.HOARD data inlined in index.html. Media is embedded in place, never copied.
// Run after a sync: node vault.js [dir]   (dir defaults to ~/Downloads/instagram)
// notes/ is regenerated whole on every run — notes written by hand belong outside it.
// Caption hashtags stay inline, where Obsidian reads them as tags on its own.
const fs = require('fs');
const path = require('path');
const os = require('os');

// Obsidian tag: letters, digits, _ - /, and at least one non-digit
const tagOf = (s) => {
    const t = String(s).toLowerCase().replace(/[^\p{L}\p{N}_\-/]+/gu, '-').replace(/^-+|-+$/g, '');
    return /[^\d/]/.test(t) ? t : '';
};
const fileSafe = (s) => String(s).replace(/[\\/:*?"<>|#^[\]\x00-\x1f]+/g, '_').replace(/^\.+/, '').trim().slice(0, 80) || '_';

function readHoard(dir) {
    const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
    const m = /window\.HOARD = (.*);<\/script>/.exec(html);
    if (!m) throw new Error(`no window.HOARD in ${dir}/index.html — sync with hoard 1.2+ first`);
    return JSON.parse(m[1]);
}

// Returns { relative path: content } so the selftest can check it without touching disk.
function buildNotes(D) {
    const out = {};
    const colName = new Map(D.cols.map(c => [c.id, c.name]));
    const colNote = (id) => `collection ${fileSafe(colName.get(id) || id)}`;
    const date = (t) => t ? new Date(t * 1000).toISOString().slice(0, 10) : '';

    for (const p of D.posts) {
        const cols = p.cols.filter(id => colName.has(id));
        const tags = [...cols.map(id => 'collection/' + tagOf(colName.get(id))), p.type && 'type/' + p.type].filter(t => t && !t.endsWith('/'));
        out[`notes/posts/${p.code}.md`] = [
            '---',
            `tags: [${tags.join(', ')}]`,
            `date: ${date(p.taken)}`,
            `source: https://www.instagram.com/p/${p.code}/`,
            '---',
            `[[@${p.user}]] · ${cols.map(id => `[[${colNote(id)}]]`).join(' · ') || 'no collection'}`,
            '',
            ...p.media.map(m => `![[${m.p}]]`),
            '',
            p.caption,
            '',
        ].join('\n');
    }

    for (const user of new Set(D.posts.map(p => p.user))) {
        const prof = D.profiles[user] || {};
        out[`notes/authors/@${user}.md`] = [
            '---', 'tags: [author]', '---',
            ...(prof.pic ? [`![[${prof.pic}|96]]`] : []),
            prof.name || user,
            `https://www.instagram.com/${user}/`,
            '',
        ].join('\n');
    }

    for (const c of D.cols) {
        out[`notes/collections/${colNote(c.id)}.md`] = ['---', 'tags: [collection]', '---', c.name, ''].join('\n');
    }
    return out;
}

module.exports = { tagOf, buildNotes };

if (require.main === module) {
    const dir = path.resolve(process.argv[2] || path.join(os.homedir(), 'Downloads', 'instagram'));
    const notes = buildNotes(readHoard(dir));
    fs.rmSync(path.join(dir, 'notes'), { recursive: true, force: true });
    for (const [rel, text] of Object.entries(notes)) {
        fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
        fs.writeFileSync(path.join(dir, rel), text);
    }
    // Graph defaults, written once: tag nodes on, media nodes off. Obsidian owns the file after.
    const graph = path.join(dir, '.obsidian', 'graph.json');
    if (!fs.existsSync(graph)) {
        fs.mkdirSync(path.dirname(graph), { recursive: true });
        fs.writeFileSync(graph, JSON.stringify({ showTags: true, showAttachments: false, hideUnresolved: true }, null, 2));
    }
    console.log(`${Object.keys(notes).length} notes -> ${dir}/notes | open ${dir} as an Obsidian vault`);
}
