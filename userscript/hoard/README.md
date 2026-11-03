hoard

instagram saved collections as reference library | grid, tags | batch collection edits | save to disk only when asked | collections and tags sent to mark

usage
hoard pill right edge | or tampermonkey menu open hoard | esc clears the selection, then closes
refresh pulls saved feed with tab session | nothing downloaded | cached until next refresh | cdn links in it expire, refresh again when thumbs break
collection membership comes from each saved post | names from the collection list, else the saved page
refresh from instagram.com/<you>/saved/ | walks the collection grid a screen at a time, learning names at every step | names kept after that
unknown name = post waits, sync skips it | status shows the count | refresh from /saved/
collection renamed on instagram = renamed in the archive | no redownload | tidy.py in the hoard repo moves the folder where the library is kept
tampermonkey menu forget posts | paste post codes or urls | dropped from the archive | sync downloads them again
tab title reads saved on every instagram page
instagram page clutter is hidden by flush | per element switches there
bar | refresh, select, apply, discard left | filters middle | sync to disk, log, update, ✕ right | status, then selection bar full width below | narrow window puts filters on their own row
update button checks greasyfork | panel open checks once, label shows the new version | click opens tampermonkey's install page | reload instagram after
in-tab library covers the rest of instagram | filter collection or #tag | type | user, caption or tag | sort saved | newest | oldest | user

select
shift, cmd or ctrl click selects | once anything is selected a plain click toggles | select = every post shown, again clears
selection bar | collection picker | add | remove | move | tag | save to disk | clear
move shows while filtered to a collection | adds to the picked one, removes from the filtered one


tags
tag on the selection | space separated | -tag removes | own tags, never sent to instagram
tampermonkey menu tag store | couchdb database url with user:password | tags kept as docs `ig:<code>` {tags} | loaded on panel open
no tag store = tampermonkey storage `hoard.tags`
mark installed = named collections and own tags sent to it as post tags | removals follow | `hoard.marked` holds what it took

collection edits
add, remove, move queue in tampermonkey storage `hoard.queue` | nothing reaches the account before apply
apply N sends the queue | new collection created first | 50 posts a call, 1.5 s apart
each touched post's collections read back after | edit not shown = back on the queue | no ids in the answer = unconfirmed
discard drops the queue | hover apply lists it per collection

sync
sync to disk = download only posts not yet on disk from the loaded library | selection bar's save to disk does the same for the selection | retries failures without a refresh | link expired = refresh first | rewrite index.html
index.html and sidecars written from a blob | a data: url over 2 MB never downloads
copy per collection folder | post in 2 collections sits in both | no collection goes to unsorted
full res | every carousel item | only missing folders downloaded | post added to a collection gets one new copy
unsaved posts and old folders stay | nothing deleted
sidecar <user>_<code>.json beside the media in every folder the post sits in | rewritten when its data changes | json only, media not refetched
sidecar fields come from the cached library | refresh brings location, tags, audio for posts loaded before 1.6
archive of what is on disk lives in tampermonkey storage `hoard.archive` | local paths, never cdn urls
saved after every post | interrupted sync resumes | failures retry on next sync

log
every run, api retry, failed post and failed download logged | tampermonkey storage `hoard.log` | last 2000 entries | also in the console as [hoard]
written to Downloads/reference/hoard-log.json after each run | log button writes it on demand

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
whitelist `.html` `.json` `.jpg` `.jpeg` `.png` `.mp4` `.webp` | settings, config mode advanced, downloads
browser setting ask where to save off | else a prompt per file
browser setting show downloads when they're done off | else the downloads popup flashes per file | chrome://settings/downloads

gotchas
instagram 5xx or 429 retried after 5, 15, 45 s | still failing keeps the posts fetched so far | next refresh within an hour continues from that page | later ones start over, cdn links expire
throttled 1.5 s per feed page | 0.8 s per downloaded post | fast scraping risks account flag
per-collection feeds 404 since instagram retired them | collections rebuilt from the saved feed
media id stays a string | pk overflows a js number
tampermonkey storage cleared = archive lost | next sync redownloads everything

github http://github.com/SolRaze/extentions/tree/main/userscript/hoard | greasyfork https://greasyfork.org/en/scripts/598006-hoard

license mit
