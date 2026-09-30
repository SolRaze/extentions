hoard

instagram saved collections as offline reference library | synced to disk | read-only, never writes to the account

usage
hoard pill bottom-left | or tampermonkey menu open hoard | sync to disk | esc or ✕ closes
refresh pulls saved feed with tab session | cached until next refresh
collection membership comes from each saved post | names from the collection list, else the saved page
first refresh from instagram.com/<you>/saved/ | names kept after that
tab title reads saved on every instagram page
hide elements on by default | 20 selectors in HIDE | tampermonkey menu hide elements on/off | choice kept
in-tab library covers the rest of instagram | filter collection | type | user or caption | sort saved | newest | oldest | user

sync
sync to disk = download only posts not yet on disk from the loaded library | refresh first for new saves | rewrite index.html
copy per collection folder | post in 2 collections sits in both | no collection goes to unsorted
full res | every carousel item | only missing folders downloaded | post added to a collection gets one new copy
unsaved posts and old folders stay | nothing deleted
archive of what is on disk lives in tampermonkey storage `hoard.archive` | local paths, never cdn urls
saved after every post | interrupted sync resumes | failures retry on next sync

disk
paths sit under the browser download folder | Downloads here
Downloads/reference/index.html | offline viewer, library data inlined, opens from file://
Downloads/reference/<collection>/<user>_<code>[_n].<ext>
Downloads/reference/unsorted/<user>_<code>[_n].<ext>
Downloads/reference/profiles/<user>.jpg

viewer
collections grid | 2x2 cover | all posts first
collection | square 3-column grid | album and video icons
post | profile on top | carousel with arrows, dots, ← → | caption with tags and mentions | date | link to original
no likes | no comments
photo click fits screen | second click 1:1 | third closes | esc goes back

tampermonkey setup
download mode browser api | subfolders and overwrite need it
whitelist `.html` `.jpg` `.mp4` `.webp` extensions
browser setting ask where to save off | else a prompt per file

gotchas
instagram 5xx or 429 retried after 5, 15, 45 s | still failing keeps the posts fetched so far | next refresh continues from that page
throttled 1.5 s per feed page | 0.8 s per downloaded post | fast scraping risks account flag
per-collection feeds 404 since instagram retired them | collections rebuilt from the saved feed
hide selectors are instagram's generated class names | a deploy renames them | stale ones just stop hiding
media id stays a string | pk overflows a js number
tampermonkey storage cleared = archive lost | next sync redownloads everything

github http://github.com/SolRaze/extentions/tree/main/userscript/hoard | greasyfork https://greasyfork.org/en/scripts/598006-hoard

license mit
