hoard

instagram saved collections as offline reference library | synced to disk | read-only, never writes to the account

usage
hoard pill bottom-left | or tampermonkey menu open hoard | sync to disk | esc or ✕ closes
refresh pulls saved feed with tab session | cached until next refresh
collection membership comes from each saved post | names from the collection list, else the saved page
refresh from instagram.com/<you>/saved/ | scrolls the collection grid to the end | names kept after that
unknown name = post waits, sync skips it | status shows the count | refresh from /saved/ then sync
collection renamed on instagram = renamed in the archive | no redownload | tidy.py in the hoard repo moves the folder on disk
tab title reads saved on every instagram page
hide elements on by default | 20 selectors in HIDE | tampermonkey menu hide elements on/off | choice kept
in-tab library covers the rest of instagram | filter collection | type | user or caption | sort saved | newest | oldest | user

sync
sync to disk = download only posts not yet on disk from the loaded library | refresh first for new saves | rewrite index.html
index.html and sidecars written from a blob | a data: url over 2 MB never downloads
copy per collection folder | post in 2 collections sits in both | no collection goes to unsorted
full res | every carousel item | only missing folders downloaded | post added to a collection gets one new copy
unsaved posts and old folders stay | nothing deleted
sidecar <user>_<code>.json beside the media in every folder the post sits in | rewritten when its data changes | json only, media not refetched
sidecar fields come from the cached library | refresh brings location, tags, audio for posts loaded before 1.6
archive of what is on disk lives in tampermonkey storage `hoard.archive` | local paths, never cdn urls
saved after every post | interrupted sync resumes | failures retry on next sync

disk
paths sit under the browser download folder | Downloads here
Downloads/reference/index.html | offline viewer, library data inlined, opens from file://
Downloads/reference/<collection>/<user>_<code>[_n].<ext>
Downloads/reference/<collection>/<user>_<code>.json | posted time | author, profile url, pic | post url | caption | collections | type | location | tagged | coauthors | audio | per file size, duration, alt text
Downloads/reference/unsorted/<user>_<code>[_n].<ext>
Downloads/reference/profiles/<user>.jpg

viewer
collections grid | 2x2 cover | all posts first
collection | square 3-column grid | album and video icons
post | profile on top, linked | location, map link with coordinates | carousel with arrows, dots, ← → | caption with tags and mentions | tagged users | date and time | post link | profile link
no likes | no comments
photo click fits screen | second click 1:1 | third closes | esc goes back

tampermonkey setup
download mode browser api | subfolders and overwrite need it
whitelist `.html` `.json` `.jpg` `.mp4` `.webp` extensions
browser setting ask where to save off | else a prompt per file
browser setting show downloads when they're done off | else the downloads popup flashes per file | chrome://settings/downloads

gotchas
instagram 5xx or 429 retried after 5, 15, 45 s | still failing keeps the posts fetched so far | next refresh within an hour continues from that page | later ones start over, cdn links expire
throttled 1.5 s per feed page | 0.8 s per downloaded post | fast scraping risks account flag
per-collection feeds 404 since instagram retired them | collections rebuilt from the saved feed
hide selectors are instagram's generated class names | a deploy renames them | stale ones just stop hiding
media id stays a string | pk overflows a js number
tampermonkey storage cleared = archive lost | next sync redownloads everything

issues
downloads popup flashes every file | glitches with the address bar hidden | open | fix: browser setting above
sync counter crawls, every post failed | cdn links in the library expired | fixed 1.10 | refresh, then sync
refresh stuck on 572 at the feed end | resumed the stale walk forever | fixed 1.10 | resumes only within an hour
index.html never written | data: url over 2 MB dropped | fixed 1.8 | written from a blob
`collection <id>` folders | sync ran before names were known | fixed 1.8 | posts wait | tidy.py moves old ones
clicks while busy stacked `busy` in the status | fixed 1.11

github http://github.com/SolRaze/extentions/tree/main/userscript/hoard | greasyfork https://greasyfork.org/en/scripts/598006-hoard

license mit
