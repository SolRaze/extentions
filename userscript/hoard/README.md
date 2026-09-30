hoard

instagram saved collections as offline reference library | synced to disk | read-only, never writes to the account

usage
hoard pill bottom-left | or tampermonkey menu open hoard | sync to disk | esc or ✕ closes
refresh pulls saved feed with tab session | cached until next refresh
collection membership comes from each saved post | names from the collection list, else the saved page
first refresh from instagram.com/<you>/saved/ | names kept after that
in-tab library covers the rest of instagram | filter collection | type | user or caption | sort saved | newest | oldest | user

sync
sync to disk = download only posts not yet on disk from the loaded library | refresh first for new saves | rewrite index.html
each post downloaded once | full res | every carousel item | into first collection's folder | else saved
posts already on disk only get collections and saved order updated | unsaved posts stay
archive of what is on disk lives in tampermonkey storage `hoard.archive` | local paths, never cdn urls
saved after every post | interrupted sync resumes | failures retry on next sync

disk
Downloads/reference/index.html | offline viewer, library data inlined, opens from file://
Downloads/reference/<collection>/<user>_<code>[_n].<ext>
Downloads/reference/profiles/<user>.jpg

viewer
collections grid | 2x2 cover | all posts first
collection | square 3-column grid | album and video icons
post | profile on top | carousel with arrows, dots, ← → | caption with tags and mentions | date | link to original
no likes | no comments
photo click fits screen | second click 1:1 | third closes | esc goes back

obsidian
node vault.js [dir] | dir defaults to ~/Downloads/reference | run after sync
hoard folder becomes its own vault | not ~/Notes | no sync, media embedded in place
notes/posts/<code>.md | notes/authors/@<user>.md | notes/collections/collection <name>.md
tags collection/<name> | type/<photo|album|video|reel> | caption hashtags inline
graph.json written once | tag nodes on | attachments off
notes/ regenerated whole every run | hand-written notes go outside it

tampermonkey setup
download mode browser api | subfolders and overwrite need it
whitelist `.html` `.jpg` `.mp4` `.webp` extensions
browser setting ask where to save off | else a prompt per file

gotchas
instagram 5xx or 429 retried after 5, 15, 45 s | still failing keeps the posts fetched so far | next refresh continues from that page
throttled 1.5 s per feed page | 0.8 s per downloaded post | fast scraping risks account flag
per-collection feeds 404 since instagram retired them | collections rebuilt from the saved feed
media id stays a string | pk overflows a js number
tampermonkey storage cleared = archive lost | next sync redownloads everything

selftest node selftest.js

github http://github.com/SolRaze/extentions/tree/main/userscript/hoard | greasyfork https://greasyfork.org/en/scripts/598006-hoard

license mit
